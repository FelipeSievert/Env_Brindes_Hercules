-- Run through an administrator connection. All row changes are rolled back.
-- No credentials or fixture user IDs are stored in this file.
BEGIN;

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', (SELECT id FROM public.app_users WHERE role = 'admin' AND status = 'active' LIMIT 1),
  'role', 'authenticated'
)::text, true);
SET LOCAL ROLE authenticated;

DO $active$
DECLARE
  recipient_id uuid;
  gift_id uuid;
  config_id integer;
  affected integer;
BEGIN
  INSERT INTO public.destinatarios(nome) VALUES ('__audit_permission_rollback__') RETURNING id INTO recipient_id;
  UPDATE public.destinatarios SET cidade = 'Teste transacional' WHERE id = recipient_id;
  DELETE FROM public.destinatarios WHERE id = recipient_id;
  PERFORM set_config('eb_test.recipient_id', recipient_id::text, true);

  -- Exercise the same writer on the other two existing trigger attachments.
  -- Values and audit events are discarded at the final ROLLBACK.
  SELECT id INTO gift_id FROM public.brindes LIMIT 1;
  UPDATE public.brindes SET updated_at = updated_at WHERE id = gift_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Gift trigger was not exercised'; END IF;
  PERFORM set_config('eb_test.gift_id', gift_id::text, true);

  SELECT id INTO config_id FROM public.configuracoes LIMIT 1;
  UPDATE public.configuracoes SET updated_at = updated_at WHERE id = config_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Configuration trigger was not exercised'; END IF;
  PERFORM set_config('eb_test.config_id', config_id::text, true);

  BEGIN
    INSERT INTO public.eb_auditoria(tabela, acao) VALUES ('forged_browser_event', 'INSERT');
    RAISE EXCEPTION 'Authenticated caller could forge an audit row';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $active$;
RESET ROLE;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.eb_auditoria
      WHERE tabela = 'destinatarios' AND registro_id = current_setting('eb_test.recipient_id')) <> 3 THEN
    RAISE EXCEPTION 'Expected INSERT/UPDATE/DELETE audit events';
  END IF;
  IF (SELECT count(DISTINCT acao) FROM public.eb_auditoria
      WHERE tabela = 'destinatarios' AND registro_id = current_setting('eb_test.recipient_id')) <> 3 THEN
    RAISE EXCEPTION 'Audit actions missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.eb_auditoria
      WHERE tabela = 'brindes' AND registro_id = current_setting('eb_test.gift_id')
        AND acao = 'UPDATE' AND created_at = transaction_timestamp()) THEN
    RAISE EXCEPTION 'Gift audit event missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.eb_auditoria
      WHERE tabela = 'configuracoes' AND registro_id = current_setting('eb_test.config_id')
        AND acao = 'UPDATE' AND created_at = transaction_timestamp()) THEN
    RAISE EXCEPTION 'Configuration audit event missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.destinatarios
      WHERE id = current_setting('eb_test.recipient_id')::uuid) THEN
    RAISE EXCEPTION 'Recipient DELETE failed';
  END IF;
  IF has_table_privilege('authenticated', 'public.eb_auditoria', 'SELECT,INSERT,UPDATE,DELETE')
     OR has_table_privilege('anon', 'public.eb_auditoria', 'SELECT,INSERT,UPDATE,DELETE')
     OR has_schema_privilege('authenticated', 'eb_audit_private', 'USAGE')
     OR has_function_privilege('authenticated', 'eb_audit_private.eb_audit_trigger()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Audit privileges exposed to browser roles';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgfoid = 'eb_audit_private.eb_audit_trigger()'::regprocedure AND NOT tgisinternal) <> 3 THEN
    RAISE EXCEPTION 'Existing trigger attachments were not preserved';
  END IF;
END $verify$;

-- An authenticated account without an active app_users record is denied.
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated'
)::text, true);
SET LOCAL ROLE authenticated;
DO $inactive$
BEGIN
  BEGIN
    INSERT INTO public.destinatarios(nome) VALUES ('__audit_inactive_rollback__');
    RAISE EXCEPTION 'Inactive account could insert a recipient';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'Conta sem acesso ativo para registrar alterações.' THEN RAISE; END IF;
  END;
END $inactive$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $anonymous$
BEGIN
  BEGIN
    INSERT INTO public.destinatarios(nome) VALUES ('__audit_anon_rollback__');
    RAISE EXCEPTION 'Anonymous caller could insert a recipient';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $anonymous$;
RESET ROLE;

-- Existing backend access remains available without an end-user subject.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
DO $backend$
DECLARE recipient_id uuid;
BEGIN
  INSERT INTO public.destinatarios(nome) VALUES ('__audit_backend_rollback__') RETURNING id INTO recipient_id;
  DELETE FROM public.destinatarios WHERE id = recipient_id;
  PERFORM set_config('eb_test.backend_id', recipient_id::text, true);
END $backend$;
RESET ROLE;
DO $backend_verify$
BEGIN
  IF (SELECT count(*) FROM public.eb_auditoria
      WHERE registro_id = current_setting('eb_test.backend_id')) <> 2 THEN
    RAISE EXCEPTION 'Backend audit events missing';
  END IF;
END $backend_verify$;

-- Direct trusted database-owner maintenance remains available too.
SELECT set_config('request.jwt.claims', '{}', true);
DO $owner$
DECLARE recipient_id uuid;
BEGIN
  INSERT INTO public.destinatarios(nome) VALUES ('__audit_owner_rollback__') RETURNING id INTO recipient_id;
  DELETE FROM public.destinatarios WHERE id = recipient_id;
  IF (SELECT count(*) FROM public.eb_auditoria WHERE registro_id = recipient_id::text) <> 2 THEN
    RAISE EXCEPTION 'Database-owner audit events missing';
  END IF;
END $owner$;

ROLLBACK;
SELECT 'PASS: authenticated CRUD and audit events; three trigger attachments; browser audit writes/inactive/anonymous denied; backend and owner preserved; all changes rolled back' AS result;
