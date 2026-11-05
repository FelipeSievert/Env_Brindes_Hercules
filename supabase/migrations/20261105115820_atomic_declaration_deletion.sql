ALTER TABLE public.declaracoes ADD COLUMN deleted_at timestamptz;

-- A narrow row trigger can maintain protected stock and history without exposing a
-- privileged RPC or granting browser clients direct access to the backend tables.
CREATE FUNCTION eb_audit_private.delete_declaration_effects()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE actor_id uuid := auth.uid(); gift record; restored integer; total_restored integer := 0;
BEGIN
 IF TG_LEVEL<>'ROW' OR TG_WHEN<>'BEFORE' OR TG_OP<>'UPDATE' OR TG_NARGS<>0
    OR TG_RELID<>'public.declaracoes'::regclass THEN
   RAISE EXCEPTION 'Contexto de exclusão não autorizado.' USING ERRCODE='42501';
 END IF;
 IF actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=actor_id AND status='active') THEN
   RAISE EXCEPTION 'Conta sem acesso ativo para excluir declarações.' USING ERRCODE='42501';
 END IF;
 IF OLD.deleted_at IS NOT NULL THEN
   IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
     RAISE EXCEPTION 'Esta declaração já foi excluída.' USING ERRCODE='22023';
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.deleted_at IS NULL THEN RETURN NEW; END IF;
 PERFORM id FROM public.rastreio_emails WHERE declaracao_id=OLD.id ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.rastreio_emails WHERE declaracao_id=OLD.id AND status IN ('enviando','incerto')) THEN
   RAISE EXCEPTION 'Há um e-mail em envio ou sem confirmação. Confira o histórico antes de excluir.' USING ERRCODE='22023';
 END IF;
 IF OLD.status IN ('gerado','informado') THEN
   FOR gift IN SELECT b.id,b.nome FROM public.brindes b
     WHERE b.id IN (SELECT brinde_id FROM public.declaracao_itens WHERE declaracao_id=OLD.id)
     ORDER BY b.id FOR UPDATE LOOP
     SELECT coalesce(sum(i.quantidade - coalesce(r.returned,0)),0)::integer INTO restored
       FROM public.declaracao_itens i LEFT JOIN LATERAL (
         SELECT sum(di.quantidade) AS returned FROM public.devolucao_itens di WHERE di.declaracao_item_id=i.id
       ) r ON true WHERE i.declaracao_id=OLD.id AND i.brinde_id=gift.id;
     IF restored < 0 THEN RAISE EXCEPTION 'Devolução de estoque inconsistente para %.',gift.nome; END IF;
     IF restored > 0 THEN
       UPDATE public.brindes SET quantidade=quantidade+restored,
         quantidade_utilizada=greatest(0,quantidade_utilizada-restored) WHERE id=gift.id;
       INSERT INTO public.estoque_movimentacoes(brinde_id,brinde_nome,declaracao_id,tipo,quantidade,saldo_apos,motivo)
         SELECT b.id,b.nome,OLD.id,'cancelamento',restored,b.quantidade,'Exclusão da declaração '||OLD.numero
         FROM public.brindes b WHERE b.id=gift.id;
       total_restored := total_restored+restored;
     END IF;
   END LOOP;
 END IF;
 NEW.deleted_at:=now(); NEW.status:='cancelado';
 DELETE FROM public.notificacoes WHERE declaracao_id=OLD.id;
 DELETE FROM public.rastreio_emails WHERE declaracao_id=OLD.id AND status IN ('pendente','erro');
 INSERT INTO public.declaracao_historico(declaracao_id,acao,detalhes)
   VALUES(OLD.id,'Declaração excluída',jsonb_build_object('status_anterior',OLD.status,'itens_repostos',total_restored));
 INSERT INTO public.eb_auditoria(tabela,registro_id,acao,detalhes)
   VALUES('declaracoes',OLD.id::text,'DELETE',jsonb_build_object('antes',to_jsonb(OLD),'itens_repostos',total_restored));
 RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION eb_audit_private.delete_declaration_effects() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER eb_declaration_delete BEFORE UPDATE OF deleted_at ON public.declaracoes
  FOR EACH ROW EXECUTE FUNCTION eb_audit_private.delete_declaration_effects();

CREATE FUNCTION public.delete_declaration(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE d public.declaracoes;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=auth.uid() AND status='active') THEN
   RAISE EXCEPTION 'Conta sem acesso ativo para excluir declarações.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.declaracoes WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Declaração não encontrada.' USING ERRCODE='22023'; END IF;
 IF d.deleted_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.declaracoes SET deleted_at=now() WHERE id=p_id;
END $body$;
REVOKE ALL ON FUNCTION public.delete_declaration(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_declaration(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
