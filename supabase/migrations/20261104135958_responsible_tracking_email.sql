create table public.responsaveis_solicitacao (
 id uuid primary key default gen_random_uuid(), nome text not null check(length(trim(nome))>0),
 email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'), created_at timestamptz not null default now()
);
create unique index responsaveis_email_unique on public.responsaveis_solicitacao(lower(email));
alter table public.responsaveis_solicitacao enable row level security;
revoke all on public.responsaveis_solicitacao from anon, authenticated;
grant select,insert,update on public.responsaveis_solicitacao to authenticated;
grant all on public.responsaveis_solicitacao to service_role;
create policy employee_access on public.responsaveis_solicitacao for all to authenticated using(exists(select 1 from public.app_users where id=(select auth.uid()) and status='active')) with check(exists(select 1 from public.app_users where id=(select auth.uid()) and status='active'));
alter table public.declaracoes add column responsavel_id uuid references public.responsaveis_solicitacao(id), add column responsavel_email text not null default '', add column mensagem_rastreio text not null default '';
create table public.rastreio_emails (
 id uuid primary key default gen_random_uuid(), declaracao_id uuid not null references public.declaracoes(id),
 email text not null, codigo text not null, mensagem text not null,
 status text not null default 'pendente' check(status in ('pendente','enviando','enviado','erro','incerto')),
 erro text, enviado_em timestamptz, created_at timestamptz not null default now(), unique(declaracao_id,email,codigo)
);
alter table public.rastreio_emails enable row level security;
revoke all on public.rastreio_emails from anon, authenticated;
grant select,insert on public.rastreio_emails to authenticated;
grant all on public.rastreio_emails to service_role;
create policy employee_read on public.rastreio_emails for select to authenticated using(exists(select 1 from public.app_users where id=(select auth.uid()) and status='active'));
create policy employee_queue on public.rastreio_emails for insert to authenticated with check(
 status='pendente' and erro is null and enviado_em is null and exists(select 1 from public.app_users where id=(select auth.uid()) and status='active') and
 exists(select 1 from public.declaracoes d where d.id=declaracao_id and d.responsavel_email=email and d.codigo_rastreio=codigo and d.mensagem_rastreio=mensagem and email<>'' and length(trim(mensagem))>0)
);
create or replace function public.normalize_declaration_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.status:=case lower(trim(new.status)) when 'gerada' then 'gerado' when 'impressa' then 'gerado' when 'enviada' then 'informado' when 'devolvida' then 'devolvido' else new.status end;
 return new;
end $$;
revoke all on function public.normalize_declaration_status() from public,anon,authenticated;
create trigger normalize_status before insert or update of status on public.declaracoes for each row execute function public.normalize_declaration_status();
create or replace function public.save_tracking_notification(p_id uuid,p_codigo text,p_mensagem text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.declaracoes%rowtype; queued public.rastreio_emails%rowtype;
begin
 if not exists(select 1 from public.app_users where id=auth.uid() and status='active') then raise insufficient_privilege; end if;
 p_codigo:=upper(trim(p_codigo));
 if p_codigo !~ '^[A-Z]{2}[0-9]{9}[A-Z]{2}$' then raise exception 'Informe um código de rastreio válido, como AA123456789BR.'; end if;
 if length(p_mensagem)>3000 then raise exception 'A mensagem deve ter até 3000 caracteres.'; end if;
 select * into d from public.declaracoes where id=p_id for update;
 if not found then raise exception 'Declaração não encontrada.'; end if;
 if d.status in ('cancelado','devolvido') then raise exception 'Esta declaração não permite alterar o rastreio.'; end if;
 if d.responsavel_email<>'' and length(trim(p_mensagem))=0 then raise exception 'Escreva a mensagem para o responsável antes de salvar.'; end if;
 update public.declaracoes set codigo_rastreio=p_codigo,status='informado',mensagem_rastreio=trim(p_mensagem),data_rastreio=now() where id=p_id;
 if d.responsavel_email<>'' then
 insert into public.rastreio_emails(declaracao_id,email,codigo,mensagem) values(p_id,d.responsavel_email,p_codigo,trim(p_mensagem)) on conflict(declaracao_id,email,codigo) do nothing;
 select * into queued from public.rastreio_emails where declaracao_id=p_id and email=d.responsavel_email and codigo=p_codigo;
 end if;
 return jsonb_build_object('email_id',queued.id,'status',queued.status);
end $$;
revoke all on function public.save_tracking_notification(uuid,text,text) from public,anon;
grant execute on function public.save_tracking_notification(uuid,text,text) to authenticated;

create or replace function public.create_declaracoes(p_declaracoes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft jsonb;
  item jsonb;
  recipient public.destinatarios%rowtype;
  gift public.brindes%rowtype;
  declaration public.declaracoes%rowtype;
  saved_item public.declaracao_itens%rowtype;
  responsible public.responsaveis_solicitacao%rowtype;
  recipient_snapshot jsonb;
  result jsonb := '[]'::jsonb;
  saved_items jsonb;
  qty integer;
  total_qty integer;
  total_weight numeric;
begin
  if auth.uid() is null or not exists (
    select 1 from public.app_users u where u.id = auth.uid() and u.status = 'active'
  ) then
    raise exception 'Conta sem acesso ativo para gerar declarações.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_declaracoes) is distinct from 'array' then
    raise exception 'Informe uma lista de declarações.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_declaracoes) = 0 then
    raise exception 'Selecione ao menos um destinatário.' using errcode = '22023';
  end if;

  -- All stock locks are acquired in a stable order, including multi-recipient batches.
  perform b.id from public.brindes b
  where b.id in (
    select (i.value->>'brinde_id')::uuid
    from jsonb_array_elements(p_declaracoes) d
    cross join lateral jsonb_array_elements(d.value->'itens') i
  ) order by b.id for update;

  for draft in select value from jsonb_array_elements(p_declaracoes) loop
    if coalesce(draft->>'status', 'gerado') <> 'gerado' then
      raise exception 'Uma nova declaração deve ter o status Gerado.' using errcode = '22023';
    end if;
    if nullif(btrim(draft->>'numero'), '') is null or nullif(btrim(draft->>'data'), '') is null then
      raise exception 'Número e data são obrigatórios.' using errcode = '22023';
    end if;
    if jsonb_typeof(draft->'itens') is distinct from 'array' then
      raise exception 'Informe os itens da declaração.' using errcode = '22023';
    end if;
    if jsonb_array_length(draft->'itens') = 0 then
      raise exception 'Selecione ao menos um brinde.' using errcode = '22023';
    end if;
    select * into recipient from public.destinatarios where id = (draft->>'destinatario_id')::uuid;
    if not found then raise exception 'Destinatário não encontrado ou sem acesso.' using errcode = '22023'; end if;
    recipient_snapshot := to_jsonb(recipient) || jsonb_build_object(
      'aos_cuidados', btrim(coalesce(draft->>'aos_cuidados', recipient.aos_cuidados, ''))
    );
    if char_length(recipient_snapshot->>'aos_cuidados') > 160 then
      raise exception 'A/C deve ter no máximo 160 caracteres.' using errcode = '22023';
    end if;

    responsible := null;
    if nullif(draft->>'responsavel_id','') is not null then
      select * into responsible from public.responsaveis_solicitacao where id=(draft->>'responsavel_id')::uuid;
      if not found then raise exception 'Responsável não encontrado.'; end if;
    end if;
    insert into public.declaracoes (
      numero, destinatario_id, data, local, status, responsavel, destinatario_snapshot, responsavel_id, responsavel_email, mensagem_rastreio
    ) values (
      btrim(draft->>'numero'), recipient.id, draft->>'data', coalesce(draft->>'local', 'TIMBÓ'),
      'gerado', coalesce(responsible.nome,draft->>'responsavel', ''), recipient_snapshot, responsible.id, coalesce(responsible.email,''), coalesce(draft->>'mensagem_rastreio','')
    ) returning * into declaration;

    saved_items := '[]'::jsonb;
    total_qty := 0;
    total_weight := 0;
    for item in select value from jsonb_array_elements(draft->'itens') loop
      qty := (item->>'quantidade')::integer;
      if qty is null or qty <= 0 then
        raise exception 'A quantidade de cada brinde deve ser um inteiro positivo.' using errcode = '22023';
      end if;
      select * into gift from public.brindes where id = (item->>'brinde_id')::uuid;
      if not found then raise exception 'Brinde não encontrado ou sem acesso.' using errcode = '22023'; end if;
      if gift.quantidade < qty then
        raise exception 'Estoque insuficiente para o brinde %.', gift.nome using errcode = '22023';
      end if;
      insert into public.declaracao_itens (declaracao_id, brinde_id, quantidade, peso_total, brinde_snapshot)
      values (declaration.id, gift.id, qty, qty * gift.peso_unitario, to_jsonb(gift))
      returning * into saved_item;
      update public.brindes set quantidade = quantidade - qty where id = gift.id;
      saved_items := saved_items || jsonb_build_array(to_jsonb(saved_item) || jsonb_build_object('brinde', to_jsonb(gift)));
      total_qty := total_qty + qty;
      total_weight := total_weight + qty * gift.peso_unitario;
    end loop;
    update public.declaracoes set total_itens = total_qty, peso_total = total_weight
    where id = declaration.id returning * into declaration;
    result := result || jsonb_build_array(to_jsonb(declaration) || jsonb_build_object(
      'destinatario', recipient_snapshot, 'itens', saved_items
    ));
  end loop;
  return result;
end;
$$;

-- The new endpoint uses the employee's existing RLS, never privileged backend credentials.
revoke all on function public.create_declaracoes(jsonb) from public, anon;
grant execute on function public.create_declaracoes(jsonb) to authenticated;
