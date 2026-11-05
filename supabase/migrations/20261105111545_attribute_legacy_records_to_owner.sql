-- The owner confirmed that all previously unattributed records are theirs.
-- Resolve the original administrator dynamically; never overwrite another creator.
DO $backfill$
DECLARE
  owner_id uuid; owner_name text; target text; before_payload jsonb; after_payload jsonb;
  targets text[] := ARRAY['destinatarios','brindes','declaracoes','responsaveis_solicitacao','configuracoes','estoque_movimentacoes','devolucoes','eb_auditoria','declaracao_historico'];
BEGIN
  SELECT id,coalesce(nullif(btrim(full_name),''),email) INTO STRICT owner_id,owner_name
    FROM public.app_users WHERE role='admin' AND status='active' ORDER BY created_at,id LIMIT 1;
  -- These locks prevent concurrent writes while the immutable-creator guard is suspended.
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',target);
  END LOOP;
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER a_eb_authorship',target);
  END LOOP;
  ALTER TABLE public.destinatarios DISABLE TRIGGER eb_destinatarios_audit;
  ALTER TABLE public.brindes DISABLE TRIGGER eb_brindes_audit;
  ALTER TABLE public.configuracoes DISABLE TRIGGER eb_config_audit;
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('SELECT jsonb_agg(to_jsonb(r) - ''created_by'' - ''created_by_name'' ORDER BY id) FROM public.%I r',target) INTO before_payload;
    EXECUTE format('UPDATE public.%I SET created_by=$1,created_by_name=$2 WHERE created_by IS NULL AND created_by_name IS NULL',target) USING owner_id,owner_name;
    EXECUTE format('SELECT jsonb_agg(to_jsonb(r) - ''created_by'' - ''created_by_name'' ORDER BY id) FROM public.%I r',target) INTO after_payload;
    IF before_payload IS DISTINCT FROM after_payload THEN
      RAISE EXCEPTION 'Backfill changed unrelated data in %',target;
    END IF;
  END LOOP;
  ALTER TABLE public.destinatarios ENABLE TRIGGER eb_destinatarios_audit;
  ALTER TABLE public.brindes ENABLE TRIGGER eb_brindes_audit;
  ALTER TABLE public.configuracoes ENABLE TRIGGER eb_config_audit;
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER a_eb_authorship',target);
  END LOOP;
END $backfill$;
