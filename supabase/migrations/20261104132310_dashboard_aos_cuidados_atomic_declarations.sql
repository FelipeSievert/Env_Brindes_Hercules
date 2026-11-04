-- Additive change: existing recipient data, declaration snapshots, grants and RLS stay intact.
alter table public.destinatarios
  add column if not exists aos_cuidados text not null default '';

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

    insert into public.declaracoes (
      numero, destinatario_id, data, local, status, responsavel, destinatario_snapshot
    ) values (
      btrim(draft->>'numero'), recipient.id, draft->>'data', coalesce(draft->>'local', 'TIMBÓ'),
      'gerado', coalesce(draft->>'responsavel', ''), recipient_snapshot
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
