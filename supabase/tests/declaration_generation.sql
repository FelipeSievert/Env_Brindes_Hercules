-- Run inside a transaction after applying the migration; always ROLLBACK.
-- Uses disposable records only; no real declaration or stock is changed permanently.
do $$
declare employee uuid;
begin
  select id into employee from public.app_users where status = 'active' and role = 'admin' limit 1;
  if employee is null then raise exception 'An active test actor is required'; end if;
  perform set_config('request.jwt.claim.sub', employee::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if has_function_privilege('anon', 'public.create_declaracoes(jsonb)', 'execute') then
    raise exception 'Anonymous execution must remain denied';
  end if;
  if (select prosecdef from pg_proc where oid='public.create_declaracoes(jsonb)'::regprocedure) then
    raise exception 'Creation must enforce caller RLS';
  end if;
end $$;
set local role authenticated;
do $$
declare
  dest_id uuid;
  gift_id uuid;
  saved jsonb;
  base jsonb;
  before_count integer;
  before_stock integer;
  rejected boolean;
begin
  insert into public.destinatarios (nome,cpf_cnpj,cep,endereco,numero,bairro,cidade,uf,aos_cuidados)
  values ('__qa_declaration_recipient', '', '', 'Rua Teste', '1', 'Teste', 'Timbó', 'SC', 'Contato padrão') returning id into dest_id;
  insert into public.brindes (nome,quantidade,peso_unitario,valor)
  values ('__qa_declaration_gift', 20, 0.25, 5) returning id into gift_id;
  base := jsonb_build_object('numero','__qa_'||gen_random_uuid(), 'destinatario_id',dest_id,'data','04/11/2026', 'status','gerado', 'aos_cuidados','  Compras  ', 'itens', jsonb_build_array(jsonb_build_object('brinde_id',gift_id,'quantidade',2)));
  saved := public.create_declaracoes(jsonb_build_array(base, base || jsonb_build_object('numero','__qa_'||gen_random_uuid(),'aos_cuidados','')));
  if jsonb_array_length(saved) <> 2 or saved->0->>'status' <> 'gerado' then raise exception 'Batch did not save'; end if;
  if (saved->0->>'total_itens')::integer <> 2 or (saved->0->>'peso_total')::numeric <> 0.5 then raise exception 'Totals must come from real items'; end if;
  if saved->0->'destinatario_snapshot'->>'aos_cuidados' <> 'Compras' or saved->1->'destinatario_snapshot'->>'aos_cuidados' <> '' then raise exception 'Optional A/C was lost'; end if;
  if saved->0->'itens'->0->'brinde_snapshot'->>'nome' <> '__qa_declaration_gift' then raise exception 'Gift snapshot was lost'; end if;
  if (select quantidade from public.brindes where id=gift_id) <> 16 then raise exception 'Stock must decrease exactly once'; end if;
  update public.destinatarios set aos_cuidados='Outro contato' where id=dest_id;
  if (select destinatario_snapshot->>'aos_cuidados' from public.declaracoes where id=(saved->0->>'id')::uuid) <> 'Compras' then raise exception 'Historical A/C changed'; end if;

  select count(*) into before_count from public.declaracoes;
  select quantidade into before_stock from public.brindes where id=gift_id;
  rejected := false;
  begin
    perform public.create_declaracoes(jsonb_build_array(
      base || jsonb_build_object('numero','__qa_'||gen_random_uuid()),
      base || jsonb_build_object('numero','__qa_'||gen_random_uuid(),'itens',jsonb_build_array(jsonb_build_object('brinde_id',gift_id,'quantidade',1000)))
    ));
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected or (select count(*) from public.declaracoes) <> before_count or (select quantidade from public.brindes where id=gift_id) <> before_stock then raise exception 'Insufficient stock must roll back the ENTIRE batch'; end if;

  rejected := false;
  begin
    perform public.create_declaracoes(jsonb_build_array(base || jsonb_build_object('numero','__qa_'||gen_random_uuid(),'itens',jsonb_build_array(jsonb_build_object('brinde_id',gift_id,'quantidade',-1)))));
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Negative quantities accepted'; end if;

  rejected := false;
  begin
    perform public.create_declaracoes(jsonb_build_array(base || jsonb_build_object('status','gerada')));
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Invalid database status accepted'; end if;

  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected := false;
  begin
    perform public.create_declaracoes(jsonb_build_array(base));
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Inactive account was allowed'; end if;
end $$;
reset role;
