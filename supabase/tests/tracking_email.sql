begin;

do $$ begin perform set_config('request.jwt.claim.sub',(select id::text from public.app_users where role='admin' and status='active' limit 1),true);end $$;
set local role authenticated;
do $$
declare r uuid; d uuid; original text; q jsonb; qty integer;
begin
 insert into public.responsaveis_solicitacao(nome,email) values('__qa_responsavel','qa@example.invalid') returning id into r;
 select id,status into d,original from public.declaracoes where status='gerado' limit 1;
 if d is null then raise exception 'No fixture';end if;
 update public.declaracoes set status='gerada' where id=d;
 if (select status from public.declaracoes where id=d)<>'gerado' then raise exception 'legacy status failed';end if;
 update public.declaracoes set responsavel_id=r,responsavel='QA',responsavel_email='qa@example.invalid' where id=d;
 q:=public.save_tracking_notification(d,'aa123456789br','Mensagem de teste');
 if q->>'email_id' is null then raise exception 'queue missing';end if;
 perform public.save_tracking_notification(d,'aa123456789br','Mensagem de teste');
 select count(*) into qty from public.rastreio_emails where declaracao_id=d;
 if qty<>1 then raise exception 'duplicate queue';end if;
 if (select status from public.declaracoes where id=d)<>'informado' then raise exception 'status missing';end if;
 if has_table_privilege('authenticated','public.rastreio_emails','update') then raise exception 'users can falsify delivery';end if;
 if has_table_privilege('anon','public.rastreio_emails','select') then raise exception 'anon access';end if;
end $$;

do $$ declare out jsonb; r uuid; begin
 select id into r from public.responsaveis_solicitacao where email='qa@example.invalid';
 out:=public.create_declaracoes(jsonb_build_array(jsonb_build_object('numero','__qa_mail_'||gen_random_uuid(),'destinatario_id',(select id from public.destinatarios limit 1),'responsavel_id',r,'status','gerado','data','04/11/2026','itens',jsonb_build_array(jsonb_build_object('brinde_id',(select id from public.brindes where quantidade>1 limit 1),'quantidade',1)))));
 if out->0->>'responsavel_email'<>'qa@example.invalid' then raise exception 'responsible snapshot missing';end if;
end $$;
reset role;

rollback;

