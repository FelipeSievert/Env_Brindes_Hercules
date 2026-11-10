-- Default tracking email CC: Maicon Muraro (registered responsible).
-- Reads his current email from the database instead of hard-coding the address.
-- This migration does not resend any messages.
CREATE OR REPLACE FUNCTION public.save_tracking_notification(p_id uuid, p_codigo text, p_mensagem text DEFAULT ''::text, p_email_copia text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 d public.declaracoes%rowtype;
 queued public.rastreio_emails%rowtype;
begin
 if not exists(select 1 from public.app_users where id=auth.uid() and status='active') then
  raise insufficient_privilege;
 end if;
 p_codigo := upper(trim(p_codigo));
 p_email_copia := lower(trim(coalesce(p_email_copia,'')));
 if p_codigo !~ '^[A-Z]{2}[0-9]{9}[A-Z]{2}$' then
  raise exception 'Informe um código de rastreio válido, como AA123456789BR.';
 end if;
 if length(p_mensagem)>3000 then
  raise exception 'A mensagem deve ter até 3000 caracteres.';
 end if;
 if p_email_copia<>'' and (length(p_email_copia)>254 or p_email_copia !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') then
  raise exception 'Informe um e-mail de cópia (CC) válido.';
 end if;
 select * into d from public.declaracoes where id=p_id for update;
 if not found then raise exception 'Declaração não encontrada.'; end if;
 if d.status in ('cancelado','devolvido') then
  raise exception 'Esta declaração não permite alterar o rastreio.';
 end if;
 -- By default, CC goes to the employee registered as Maicon Muraro.
 -- Existing queued jobs retain their saved CC to avoid changing or duplicating messages.
 if d.responsavel_email<>'' and p_email_copia='' then
  select * into queued from public.rastreio_emails
   where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
  if found then
   p_email_copia := coalesce(queued.email_copia,'');
  else
   select lower(trim(r.email)) into p_email_copia
    from public.responsaveis_solicitacao r
    where r.id='d520eb5b-d523-47f6-9f74-feb3ddee3a80'::uuid;
   p_email_copia := coalesce(p_email_copia,'');
   -- Do not send two copies to Maicon if he is also the primary responsible.
   if p_email_copia=lower(d.responsavel_email) then p_email_copia:=''; end if;
  end if;
 end if;
 if p_email_copia<>'' and (length(p_email_copia)>254 or p_email_copia !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}
 if p_email_copia<>'' and d.responsavel_email='' then
  raise exception 'Cadastre um responsável com e-mail antes de adicionar CC.';
 end if;
 if p_email_copia<>'' and lower(d.responsavel_email)=p_email_copia then
  raise exception 'O e-mail em cópia deve ser diferente do destinatário principal.';
 end if;
 if d.responsavel_email<>'' and length(trim(p_mensagem))=0 then
  raise exception 'Escreva a mensagem para o responsável antes de salvar.';
 end if;
 -- Do not mutate the CC of a queued or sent message. Avoid duplicate emails.
 if d.responsavel_email<>'' then
  select * into queued from public.rastreio_emails
   where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
  if found and queued.email_copia is distinct from p_email_copia then
    raise exception 'Já existe um aviso para este código com outro CC. Para evitar reenvio duplicado, o CC deste aviso não pode ser alterado.';
  end if;
 end if;
 update public.declaracoes set codigo_rastreio=p_codigo,status='informado',
   mensagem_rastreio=trim(p_mensagem),email_copia=p_email_copia,data_rastreio=now()
  where id=p_id;
 if d.responsavel_email<>'' then
  insert into public.rastreio_emails(declaracao_id,email,codigo,mensagem,email_copia)
   values(p_id,d.responsavel_email,p_codigo,trim(p_mensagem),p_email_copia)
   on conflict(declaracao_id,email,codigo) do nothing;
  select * into queued from public.rastreio_emails
   where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
 end if;
 return jsonb_build_object('email_id',queued.id,'status',queued.status);
end $function$
) then
  raise exception 'O e-mail de cópia cadastrado é inválido.';
 end if;
 if p_email_copia<>'' and d.responsavel_email='' then
  raise exception 'Cadastre um responsável com e-mail antes de adicionar CC.';
 end if;
 if p_email_copia<>'' and lower(d.responsavel_email)=p_email_copia then
  raise exception 'O e-mail em cópia deve ser diferente do destinatário principal.';
 end if;
 if d.responsavel_email<>'' and length(trim(p_mensagem))=0 then
  raise exception 'Escreva a mensagem para o responsável antes de salvar.';
 end if;
 -- Do not mutate the CC of a queued or sent message. Avoid duplicate emails.
 if d.responsavel_email<>'' then
  select * into queued from public.rastreio_emails
   where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
  if found and queued.email_copia is distinct from p_email_copia then
    raise exception 'Já existe um aviso para este código com outro CC. Para evitar reenvio duplicado, o CC deste aviso não pode ser alterado.';
  end if;
 end if;
 update public.declaracoes set codigo_rastreio=p_codigo,status='informado',
   mensagem_rastreio=trim(p_mensagem),email_copia=p_email_copia,data_rastreio=now()
  where id=p_id;
 if d.responsavel_email<>'' then
  insert into public.rastreio_emails(declaracao_id,email,codigo,mensagem,email_copia)
   values(p_id,d.responsavel_email,p_codigo,trim(p_mensagem),p_email_copia)
   on conflict(declaracao_id,email,codigo) do nothing;
  select * into queued from public.rastreio_emails
   where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
 end if;
 return jsonb_build_object('email_id',queued.id,'status',queued.status);
end $function$
;
