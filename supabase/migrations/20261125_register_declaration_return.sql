-- Authenticated return workflow; privileged operations stay in the non-exposed schema.
CREATE OR REPLACE FUNCTION eb_audit_private.register_declaration_return(p_id uuid,p_motivo text,p_itens jsonb,p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE d public.declaracoes; ret public.devolucoes; x jsonb; it public.declaracao_itens; b public.brindes; q integer; ret_id uuid; sig text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users u WHERE u.id=auth.uid() AND u.status='active' AND u.role IN ('master','admin','operator')) THEN
    RAISE EXCEPTION 'Conta sem acesso ativo para registrar devoluções.' USING ERRCODE='42501';
  END IF;
  IF p_key IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF char_length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Informe um motivo entre 3 e 500 caracteres.'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Informe os brindes que retornaram.'; END IF;
  IF jsonb_array_length(p_itens)<1 OR (SELECT count(DISTINCT value->>'brindeId') FROM jsonb_array_elements(p_itens))<>jsonb_array_length(p_itens) THEN
    RAISE EXCEPTION 'Informe os brindes que retornaram, sem repetições.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_itens) WHERE value->>'quantidade' ~ '^[1-9][0-9]*$') THEN RAISE EXCEPTION 'Informe ao menos uma unidade que retornou.'; END IF;
  sig:=md5(jsonb_build_object('id',p_id,'motivo',btrim(p_motivo),'itens',p_itens)::text);
  SELECT * INTO d FROM public.declaracoes WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR d.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Declaração não encontrada ou excluída.'; END IF;
  SELECT * INTO ret FROM public.devolucoes WHERE declaracao_id=p_id;
  IF FOUND THEN
    IF ret.request_key=p_key AND ret.assinatura=sig THEN RETURN ret.id; END IF;
    RAISE EXCEPTION 'A devolução desta declaração já foi registrada.';
  END IF;
  IF d.status<>'informado' THEN RAISE EXCEPTION 'Somente envios com código informado permitem devolução.'; END IF;
  INSERT INTO public.devolucoes(declaracao_id,motivo,request_key,assinatura) VALUES(p_id,btrim(p_motivo),p_key,sig) RETURNING id INTO ret_id;
  FOR x IN SELECT value FROM jsonb_array_elements(p_itens) ORDER BY value->>'brindeId' LOOP
    IF coalesce(x->>'quantidade','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'As quantidades retornadas devem ser inteiras.'; END IF;
    q:=(x->>'quantidade')::integer;
    SELECT * INTO it FROM public.declaracao_itens WHERE declaracao_id=p_id AND brinde_id=(x->>'brindeId')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Brinde não pertence a esta declaração.'; END IF;
    IF q>it.quantidade THEN RAISE EXCEPTION 'A quantidade retornada não pode ultrapassar a enviada.'; END IF;
    IF q=0 THEN CONTINUE; END IF;
    SELECT * INTO b FROM public.brindes WHERE id=it.brinde_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Brinde não encontrado.'; END IF;
    -- Older declarations and the current creation RPC maintain this legacy counter differently.
    UPDATE public.brindes SET quantidade=quantidade+q,quantidade_utilizada=greatest(0,quantidade_utilizada-q) WHERE id=b.id RETURNING * INTO b;
    INSERT INTO public.devolucao_itens(devolucao_id,declaracao_item_id,quantidade) VALUES(ret_id,it.id,q);
    INSERT INTO public.estoque_movimentacoes(brinde_id,brinde_nome,declaracao_id,tipo,quantidade,saldo_apos,motivo) VALUES(b.id,b.nome,p_id,'devolucao',q,b.quantidade,btrim(p_motivo));
  END LOOP;
  UPDATE public.declaracoes SET status='devolvido',data_devolucao=now(),motivo_devolucao=btrim(p_motivo) WHERE id=p_id;
  INSERT INTO public.declaracao_historico(declaracao_id,acao,detalhes) VALUES(p_id,'Devolução registrada',jsonb_build_object('motivo',btrim(p_motivo),'itens',p_itens));
  RETURN ret_id;
END $$;
REVOKE ALL ON FUNCTION eb_audit_private.register_declaration_return(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA eb_audit_private TO authenticated;
GRANT EXECUTE ON FUNCTION eb_audit_private.register_declaration_return(uuid,text,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.register_declaration_return(p_id uuid,p_motivo text,p_itens jsonb,p_key uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path TO '' AS $$
  SELECT eb_audit_private.register_declaration_return(p_id,p_motivo,p_itens,p_key);
$$;
REVOKE ALL ON FUNCTION public.register_declaration_return(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_declaration_return(uuid,text,jsonb,uuid) TO authenticated;
