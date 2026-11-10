-- Optional email CC per tracking job, retaining the existing PDF and deduplication.
alter table public.declaracoes add column if not exists email_copia text not null default '' check (email_copia = '' or (char_length(email_copia) <= 254 and email_copia ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'));
alter table public.rastreio_emails add column if not exists email_copia text not null default '' check (email_copia = '' or (char_length(email_copia) <= 254 and email_copia ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'));
drop policy if exists employee_queue on public.rastreio_emails;
create policy employee_queue on public.rastreio_emails for insert to authenticated with check (((status = 'pendente'::text) AND (erro IS NULL) AND (enviado_em IS NULL) AND (EXISTS ( SELECT 1
   FROM app_users
  WHERE ((app_users.id = ( SELECT auth.uid() AS uid)) AND (app_users.status = 'active'::text)))) AND (EXISTS ( SELECT 1
   FROM declaracoes d
  WHERE ((d.id = rastreio_emails.declaracao_id) AND (d.responsavel_email = rastreio_emails.email) AND ((d.codigo_rastreio)::text = rastreio_emails.codigo) AND (d.mensagem_rastreio = rastreio_emails.mensagem) AND (d.email_copia = rastreio_emails.email_copia) AND (rastreio_emails.email <> ''::text) AND (length(TRIM(BOTH FROM rastreio_emails.mensagem)) > 0))))));
-- Replace the three-argument RPC to avoid ambiguous PostgREST overloads.
drop function if exists public.save_tracking_notification(uuid,text,text);
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

revoke all on function public.save_tracking_notification(uuid,text,text,text) from public,anon;
grant execute on function public.save_tracking_notification(uuid,text,text,text) to authenticated;
