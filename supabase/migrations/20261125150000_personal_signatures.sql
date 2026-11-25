-- Personal reusable signature is distinct from immutable issued document snapshots.
create table public.personal_signatures (
  user_id uuid primary key references auth.users(id) on delete cascade,
  image text not null check (length(image) between 32 and 400000 and image ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'),
  version uuid not null unique
);
alter table public.personal_signatures enable row level security;
revoke all on public.personal_signatures from public, anon, authenticated;
grant select, insert, update, delete on public.personal_signatures to authenticated;
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
    insert into public.declaration_signatures(declaration_id, signer_id, image)
      values ((declaration->>'id')::uuid, auth.uid(), sig.image);
    result := result || jsonb_build_array(declaration || jsonb_build_object('assinatura',jsonb_build_object('image',sig.image)));
  end loop;
  return result;
end $$;
revoke all on function public.create_signed_declarations(jsonb,uuid) from public, anon;
grant execute on function public.create_signed_declarations(jsonb,uuid) to authenticated;
notify pgrst, 'reload schema';
