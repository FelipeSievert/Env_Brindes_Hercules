-- Rename the original owner's display name without changing their role or record dates.
DO $rename$
DECLARE
  owner_id uuid; target text; before_payload jsonb; after_payload jsonb;
  targets text[] := ARRAY['destinatarios','brindes','declaracoes','responsaveis_solicitacao','configuracoes','estoque_movimentacoes','devolucoes','eb_auditoria','declaracao_historico'];
BEGIN
  SELECT id INTO STRICT owner_id FROM public.app_users
    WHERE role='admin' AND status='active' ORDER BY created_at,id LIMIT 1;
  IF NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=owner_id AND full_name IN ('Administrador','Felipe Sievert')) THEN
    RAISE EXCEPTION 'Original owner display name no longer matches the reviewed account';
  END IF;
  UPDATE public.app_users SET full_name='Felipe Sievert' WHERE id=owner_id;
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
    EXECUTE format('SELECT jsonb_agg(to_jsonb(r) - ''created_by_name'' - ''updated_by_name'' ORDER BY id) FROM public.%I r',target) INTO before_payload;
    EXECUTE format('UPDATE public.%I SET created_by_name=CASE WHEN created_by=$1 AND created_by_name=''Administrador'' THEN ''Felipe Sievert'' ELSE created_by_name END, updated_by_name=CASE WHEN updated_by=$1 AND updated_by_name=''Administrador'' THEN ''Felipe Sievert'' ELSE updated_by_name END WHERE (created_by=$1 AND created_by_name=''Administrador'') OR (updated_by=$1 AND updated_by_name=''Administrador'')',target) USING owner_id;
    EXECUTE format('SELECT jsonb_agg(to_jsonb(r) - ''created_by_name'' - ''updated_by_name'' ORDER BY id) FROM public.%I r',target) INTO after_payload;
    IF before_payload IS DISTINCT FROM after_payload THEN
      RAISE EXCEPTION 'Rename changed unrelated data in %',target;
    END IF;
  END LOOP;
  ALTER TABLE public.destinatarios ENABLE TRIGGER eb_destinatarios_audit;
  ALTER TABLE public.brindes ENABLE TRIGGER eb_brindes_audit;
  ALTER TABLE public.configuracoes ENABLE TRIGGER eb_config_audit;
  FOREACH target IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER a_eb_authorship',target);
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=owner_id AND full_name='Felipe Sievert' AND role='admin') THEN
    RAISE EXCEPTION 'Owner name or administrator role incorrect';
  END IF;
END $rename$;
