-- Transactional integration test: every fixture, stock change and audit row rolls back.
BEGIN;
SELECT set_config('test.actor_a', (SELECT id::text FROM public.app_users WHERE role='admin' AND status='active' LIMIT 1), true);
SELECT set_config('test.actor_b', coalesce((SELECT id::text FROM public.app_users WHERE status='active' AND id::text <> current_setting('test.actor_a') LIMIT 1), current_setting('test.actor_a')), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.actor_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $create$
DECLARE recipient public.destinatarios; gift public.brindes; docs jsonb; declaration_id uuid;
BEGIN
  INSERT INTO public.destinatarios(nome,created_by,created_by_name,created_at)
    VALUES('__authorship_rollback__',gen_random_uuid(),'Forged','2000-01-01') RETURNING * INTO recipient;
  IF recipient.created_by::text <> current_setting('test.actor_a') OR recipient.created_by_name='Forged'
     OR recipient.created_at < transaction_timestamp() THEN RAISE EXCEPTION 'Creation attribution was forged'; END IF;
  PERFORM set_config('test.recipient',recipient.id::text,true);
  PERFORM set_config('test.creator_name',recipient.created_by_name,true);
  INSERT INTO public.brindes(nome,quantidade,peso_unitario) VALUES('__authorship_rollback__',10,0.1) RETURNING * INTO gift;
  PERFORM set_config('test.gift',gift.id::text,true);
  docs := public.create_declaracoes(jsonb_build_array(jsonb_build_object(
    'numero','authorship-'||gen_random_uuid(), 'destinatario_id',recipient.id,'data','05/11/2026',
    'itens',jsonb_build_array(jsonb_build_object('brinde_id',gift.id,'quantidade',2)))));
  declaration_id := (docs->0->>'id')::uuid;
  PERFORM set_config('test.declaration',declaration_id::text,true);
  IF docs->0->>'created_by' <> current_setting('test.actor_a') THEN RAISE EXCEPTION 'RPC did not return creator'; END IF;
  -- This is the same insertion path used by bulk imports: no client actor fields.
  INSERT INTO public.destinatarios(nome) VALUES('__authorship_import_rollback__'),('__authorship_import_rollback__');
  IF (SELECT count(*) FROM public.destinatarios WHERE nome='__authorship_import_rollback__' AND created_by=auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'Bulk import authorship missing'; END IF;
END $create$;
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.actor_b'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $edit$
DECLARE recipient public.destinatarios; original_date timestamptz;
BEGIN
  SELECT created_at INTO original_date FROM public.destinatarios WHERE id=current_setting('test.recipient')::uuid;
  UPDATE public.destinatarios SET cidade='Outra edição',created_by=gen_random_uuid(),created_by_name='Forged again',created_at='2000-01-01',updated_by=gen_random_uuid(),updated_by_name='Forged'
    WHERE id=current_setting('test.recipient')::uuid RETURNING * INTO recipient;
  IF recipient.created_by::text <> current_setting('test.actor_a') OR recipient.created_by_name <> current_setting('test.creator_name')
    OR recipient.created_at IS DISTINCT FROM original_date OR recipient.updated_by::text <> current_setting('test.actor_b') OR recipient.updated_by_name='Forged' THEN
    RAISE EXCEPTION 'Editing replaced original author or forged editor'; END IF;
  -- Another active team member can see and update the document.
  UPDATE public.declaracoes SET observacao='Teste' WHERE id=current_setting('test.declaration')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared team access lost'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.declaracoes WHERE id=current_setting('test.declaration')::uuid AND created_by::text=current_setting('test.actor_a') AND updated_by=auth.uid()) THEN
    RAISE EXCEPTION 'Declaration author/editor incorrect'; END IF;
END $edit$;
RESET ROLE;
DO $history$
DECLARE movement public.estoque_movimentacoes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.eb_auditoria WHERE registro_id=current_setting('test.recipient') AND acao='UPDATE' AND created_by::text=current_setting('test.actor_b')) THEN
    RAISE EXCEPTION 'Audit event actor missing'; END IF;
  INSERT INTO public.estoque_movimentacoes(brinde_id,brinde_nome,tipo,quantidade,saldo_apos,motivo)
    VALUES(current_setting('test.gift')::uuid,'__authorship_rollback__','entrada',1,9,'Teste') RETURNING * INTO movement;
  IF movement.created_by::text <> current_setting('test.actor_b') THEN RAISE EXCEPTION 'Stock movement actor missing'; END IF;
  IF has_function_privilege('authenticated','eb_audit_private.stamp_record_authorship()','execute') THEN
    RAISE EXCEPTION 'Private trigger is callable by client'; END IF;
END $history$;
SET LOCAL ROLE authenticated;
DO $read_history$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.estoque_movimentacoes WHERE brinde_id=current_setting('test.gift')::uuid) THEN
    RAISE EXCEPTION 'Team cannot read stock history'; END IF;
  BEGIN
    INSERT INTO public.estoque_movimentacoes(brinde_nome,tipo,quantidade,saldo_apos,motivo) VALUES('forged','entrada',1,1,'forged');
    RAISE EXCEPTION 'Browser can forge a stock movement';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $read_history$;
RESET ROLE;
-- A prior record remains without a creator when edited for the first time.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.actor_a'),'role','authenticated')::text,true);
DO $legacy$
DECLARE legacy public.destinatarios;
BEGIN
  SELECT * INTO legacy FROM public.destinatarios WHERE created_by IS NULL LIMIT 1;
  IF legacy.id IS NOT NULL THEN
    UPDATE public.destinatarios SET nome=nome WHERE id=legacy.id RETURNING * INTO legacy;
    IF legacy.created_by IS NOT NULL OR legacy.created_by_name IS NOT NULL OR legacy.updated_by::text<>current_setting('test.actor_a') THEN
      RAISE EXCEPTION 'Legacy record received invented creator'; END IF;
  END IF;
END $legacy$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $inactive$
BEGIN
  IF EXISTS(SELECT 1 FROM public.estoque_movimentacoes) THEN RAISE EXCEPTION 'Inactive account can read history'; END IF;
  BEGIN
    INSERT INTO public.destinatarios(nome) VALUES('__inactive_authorship__');
    RAISE EXCEPTION 'Inactive account wrote data';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $inactive$;
RESET ROLE;
ROLLBACK;
