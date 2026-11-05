-- Historical actor IDs and name snapshots deliberately survive account deletion.
-- No backfill: older rows must never be assigned to the deploying administrator.
DO $columns$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['destinatarios','brindes','declaracoes','responsaveis_solicitacao','configuracoes','estoque_movimentacoes','devolucoes','eb_auditoria','declaracao_historico'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by uuid, ADD COLUMN created_by_name text, ADD COLUMN updated_by uuid, ADD COLUMN updated_by_name text, ADD COLUMN IF NOT EXISTS updated_at timestamptz', target);
  END LOOP;
END $columns$;

CREATE OR REPLACE FUNCTION eb_audit_private.stamp_record_authorship()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  actor_id uuid := auth.uid();
  actor_name text;
  caller_role text := pg_catalog.current_setting('role', true);
BEGIN
  IF TG_LEVEL <> 'ROW' OR TG_WHEN <> 'BEFORE' OR TG_NARGS <> 0
    OR TG_OP NOT IN ('INSERT', 'UPDATE')
    OR TG_RELID NOT IN (
      'public.destinatarios'::regclass, 'public.brindes'::regclass,
      'public.declaracoes'::regclass, 'public.responsaveis_solicitacao'::regclass,
      'public.configuracoes'::regclass, 'public.estoque_movimentacoes'::regclass,
      'public.devolucoes'::regclass, 'public.eb_auditoria'::regclass,
      'public.declaracao_historico'::regclass
    ) THEN
    RAISE EXCEPTION 'Contexto de autoria não autorizado.' USING ERRCODE = '42501';
  END IF;

  IF actor_id IS NOT NULL THEN
    SELECT coalesce(nullif(btrim(u.full_name), ''), u.email)
      INTO actor_name FROM public.app_users u
      WHERE u.id = actor_id AND u.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta sem acesso ativo para registrar alterações.' USING ERRCODE = '42501';
    END IF;
  ELSIF caller_role = 'service_role'
     OR (session_user IN ('postgres', 'supabase_admin')
       AND caller_role IN ('none', 'postgres', 'supabase_admin')) THEN
    actor_name := 'Sistema';
  ELSE
    RAISE EXCEPTION 'Conta sem acesso ativo para registrar alterações.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := actor_id;
    NEW.created_by_name := actor_name;
    NEW.created_at := statement_timestamp();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_by := actor_id;
  NEW.updated_by_name := actor_name;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION eb_audit_private.stamp_record_authorship() FROM PUBLIC, anon, authenticated;

DO $triggers$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['destinatarios','brindes','declaracoes','responsaveis_solicitacao','configuracoes','estoque_movimentacoes','devolucoes','eb_auditoria','declaracao_historico'] LOOP
    -- Run before existing audit triggers so their snapshots include attribution.
    EXECUTE format('CREATE TRIGGER a_eb_authorship BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION eb_audit_private.stamp_record_authorship()', target);
  END LOOP;
END $triggers$;

-- Team members can inspect stock movements; writes remain in the existing backend.
GRANT SELECT ON public.estoque_movimentacoes TO authenticated;
CREATE POLICY eb_active_team_read_movements ON public.estoque_movimentacoes
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users u WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
  ));
NOTIFY pgrst, 'reload schema';
