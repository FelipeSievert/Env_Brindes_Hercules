BEGIN;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM public.app_users WHERE status='active' AND role='admin' ORDER BY created_at LIMIT 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE recipient uuid; gift uuid; saved jsonb; declaration_id uuid; stock integer;
BEGIN
 INSERT INTO public.destinatarios(nome) VALUES('__deletion_rollback__') RETURNING id INTO recipient;
 INSERT INTO public.brindes(nome,quantidade,peso_unitario,valor) VALUES('__deletion_rollback__',20,0.1,5) RETURNING id INTO gift;
 saved:=public.create_declaracoes(jsonb_build_array(jsonb_build_object('numero','__delete_'||gen_random_uuid(),'destinatario_id',recipient,'data','05/11/2026','itens',jsonb_build_array(jsonb_build_object('brinde_id',gift,'quantidade',2)))));
 declaration_id:=(saved->0->>'id')::uuid;
 IF (SELECT quantidade FROM public.brindes WHERE id=gift)<>18 THEN RAISE EXCEPTION 'Fixture stock incorrect'; END IF;
 PERFORM public.delete_declaration(declaration_id);
 IF (SELECT quantidade FROM public.brindes WHERE id=gift)<>20 THEN RAISE EXCEPTION 'Stock not restored'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.declaracoes WHERE id=declaration_id AND deleted_at IS NOT NULL AND status='cancelado') THEN RAISE EXCEPTION 'Declaration not excluded'; END IF;
 PERFORM public.delete_declaration(declaration_id);
 IF (SELECT quantidade FROM public.brindes WHERE id=gift)<>20 THEN RAISE EXCEPTION 'Duplicate deletion restored stock twice'; END IF;
 IF (SELECT count(*) FROM public.estoque_movimentacoes WHERE declaracao_id=declaration_id AND tipo='cancelamento')<>1 THEN RAISE EXCEPTION 'Duplicate stock history'; END IF;
 BEGIN
  UPDATE public.declaracoes SET deleted_at=NULL WHERE id=declaration_id;
  RAISE EXCEPTION 'Browser can undo deletion without reversing stock';
 EXCEPTION WHEN sqlstate '22023' THEN NULL;
 END;
 -- A previously cancelled declaration must not return its items a second time.
 INSERT INTO public.declaracoes(numero,destinatario_id,data,status) VALUES('__cancelled_'||gen_random_uuid(),recipient,'05/11/2026','cancelado') RETURNING id INTO declaration_id;
 INSERT INTO public.declaracao_itens(declaracao_id,brinde_id,quantidade,peso_total) VALUES(declaration_id,gift,2,0.2);
 PERFORM public.delete_declaration(declaration_id);
 IF (SELECT quantidade FROM public.brindes WHERE id=gift)<>20 THEN RAISE EXCEPTION 'Cancelled stock returned twice'; END IF;
END $test$;
RESET ROLE;
DO $privileges$ BEGIN
 IF has_function_privilege('anon','public.delete_declaration(uuid)','EXECUTE') OR has_function_privilege('authenticated','eb_audit_private.delete_declaration_effects()','EXECUTE') OR has_schema_privilege('authenticated','eb_audit_private','USAGE') THEN RAISE EXCEPTION 'Privileged deletion exposed'; END IF;
END $privileges$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $inactive$
BEGIN
 BEGIN
  PERFORM public.delete_declaration(gen_random_uuid()); RAISE EXCEPTION 'Inactive caller permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $inactive$;
RESET ROLE;
ROLLBACK;
