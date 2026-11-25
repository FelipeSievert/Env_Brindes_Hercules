-- Personal reusable signature is distinct from immutable issued document snapshots.
create table public.personal_signatures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  image text not null check (length(image) between 32 and 400000 and image ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'),
  version uuid not null unique,
  consented_at timestamptz not null default statement_timestamp()
);
alter table public.personal_signatures enable row level security;
revoke all on public.personal_signatures from public, anon, authenticated;
grant select, insert (user_id,image,version), update (user_id,image,version), delete on public.personal_signatures to authenticated;
revoke all on public.personal_signatures from service_role;
create policy personal_signature_owner on public.personal_signatures for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.app_users u where u.id = (select auth.uid()) and u.status = 'active'))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.app_users u where u.id = (select auth.uid()) and u.status = 'active'));

create table public.declaration_signatures (
  declaration_id uuid primary key references public.declaracoes(id),
  signer_id uuid not null,
  image text not null,
  signed_at timestamptz not null default statement_timestamp()
);
alter table public.declaration_signatures enable row level security;
revoke all on public.declaration_signatures from public, anon, authenticated;
grant select, insert (declaration_id, signer_id, image) on public.declaration_signatures to authenticated;
revoke all on public.declaration_signatures from service_role;
grant select on public.declaration_signatures to service_role;
create policy signed_document_read on public.declaration_signatures for select to authenticated
  using (exists(select 1 from public.app_users u where u.id = (select auth.uid()) and u.status = 'active')
    and exists(select 1 from public.declaracoes d where d.id = declaration_id and d.deleted_at is null));
create policy signed_document_insert on public.declaration_signatures for insert to authenticated
  with check (signer_id = (select auth.uid())
    and exists(select 1 from public.declaracoes d where d.id = declaration_id and d.created_by = (select auth.uid())
      and d.created_at = statement_timestamp() and d.deleted_at is null)
    and exists(select 1 from public.personal_signatures s where s.user_id = (select auth.uid()) and s.image = declaration_signatures.image));

-- Explicit version confirmation; snapshot and original stock/declaration RPC are atomic.
create function public.create_signed_declarations(p_declaracoes jsonb, p_version uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  sig public.personal_signatures%rowtype;
  declarations jsonb;
  declaration jsonb;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select * into sig from public.personal_signatures s
    where s.user_id = auth.uid() and s.version = p_version for share;
  if not found then raise exception 'Assinatura alterada ou excluída. Revise a confirmação.'; end if;
  declarations := public.create_declaracoes(p_declaracoes);
  for declaration in select value from jsonb_array_elements(declarations) loop
    update public.declaracoes set remetente_snapshot = (
      select jsonb_build_object('nome',c.nome,'cnpj',c.cnpj,'endereco',c.endereco,'numero',c.numero,
      'bairro',c.bairro,'cidade',c.cidade,'uf',c.uf,'cep',c.cep) from public.configuracoes c where c.id=1
    ) where id=(declaration->>'id')::uuid
    returning declaration || jsonb_build_object('remetente_snapshot',remetente_snapshot) into declaration;
    if declaration->'remetente_snapshot' is null or declaration->'remetente_snapshot' = 'null'::jsonb then
      raise exception 'Remetente não configurado.';
    end if;
    insert into public.declaration_signatures(declaration_id, signer_id, image)
      values ((declaration->>'id')::uuid, auth.uid(), sig.image);
    result := result || jsonb_build_array(declaration || jsonb_build_object('assinatura',jsonb_build_object('image',sig.image)));
  end loop;
  return result;
end $$;
revoke all on function public.create_signed_declarations(jsonb,uuid) from public, anon;
grant execute on function public.create_signed_declarations(jsonb,uuid) to authenticated;
-- Validate a bounded PNG canvas and stamp consent at the server.
create function eb_audit_private.validate_personal_signature() returns trigger
language plpgsql security invoker set search_path='' as $
declare png bytea;
begin
  if length(new.image) > 400000 or new.image !~ '^data:image/png;base64,[A-Za-z0-9+/=]+
 then
    raise exception 'Imagem de assinatura inválida.';
  end if;
  png := decode(substr(new.image,23),'base64');
  -- PNG signature, IHDR and fixed 600x180 canvas: prevents excessive image dimensions.
  if length(png)<45 or encode(substring(png from 1 for 24),'hex') <> '89504e470d0a1a0a0000000d4948445200000258000000b4'
     or encode(substring(png from length(png)-11 for 12),'hex') <> '0000000049454e44ae426082' then
    raise exception 'Formato de assinatura inválido.';
  end if;
  if tg_op='UPDATE' and new.version=old.version then raise exception 'Nova versão obrigatória.'; end if;
  new.consented_at:=statement_timestamp();
  return new;
end $;
revoke all on function eb_audit_private.validate_personal_signature() from public,anon,authenticated;
create trigger signature_validate before insert or update on public.personal_signatures
for each row execute function eb_audit_private.validate_personal_signature();

-- Protect the content, not the operational tracking/return status.
create function eb_audit_private.guard_signed_declaration() returns trigger
language plpgsql security definer set search_path='' as $
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.declaration_signatures s where s.declaration_id=old.id) then
      raise exception 'Documento assinado não pode ser removido fisicamente.' using errcode='42501';
    end if;
    return old;
  end if;
  if exists(select 1 from public.declaration_signatures s where s.declaration_id=old.id)
    and (new.id,new.numero,new.destinatario_id,new.data,new.local,new.total_itens,new.peso_total,new.destinatario_snapshot,new.remetente_snapshot)
       is distinct from (old.id,old.numero,old.destinatario_id,old.data,old.local,old.total_itens,old.peso_total,old.destinatario_snapshot,old.remetente_snapshot) then
      raise exception 'Conteúdo de documento assinado não pode ser alterado.' using errcode='42501';
  end if;
  return new;
end $;
revoke all on function eb_audit_private.guard_signed_declaration() from public,anon,authenticated;
create trigger guard_signed_declaration before update or delete on public.declaracoes for each row execute function eb_audit_private.guard_signed_declaration();

create function eb_audit_private.guard_signed_items() returns trigger
language plpgsql security definer set search_path='' as $
declare old_id uuid; new_id uuid;
begin
  if tg_op<>'INSERT' then old_id:=old.declaracao_id; end if;
  if tg_op<>'DELETE' then new_id:=new.declaracao_id; end if;
  if exists(select 1 from public.declaration_signatures s where s.declaration_id in (old_id,new_id)) then
    raise exception 'Itens de documento assinado não podem ser alterados.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $;
revoke all on function eb_audit_private.guard_signed_items() from public,anon,authenticated;
create trigger guard_signed_items before insert or update or delete on public.declaracao_itens for each row execute function eb_audit_private.guard_signed_items();
notify pgrst, 'reload schema';
