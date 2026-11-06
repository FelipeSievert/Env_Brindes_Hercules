-- Saidas internas de brindes, sem declaracao de conteudo.
-- A insercao de uma saida e a baixa de todos os seus itens formam uma transacao.
CREATE TABLE public.saidas_avulsas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino text NOT NULL CHECK (char_length(btrim(destino)) BETWEEN 2 AND 160),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 3 AND 500),
  itens jsonb NOT NULL CHECK (
    jsonb_typeof(itens) = 'array'
    AND jsonb_array_length(itens) BETWEEN 1 AND 50
  ),
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saidas_avulsas_created_at_idx ON public.saidas_avulsas (created_at DESC);
ALTER TABLE public.estoque_movimentacoes
  ADD COLUMN saida_avulsa_id uuid REFERENCES public.saidas_avulsas(id) ON DELETE RESTRICT;
CREATE INDEX estoque_movimentacoes_saida_avulsa_idx
  ON public.estoque_movimentacoes (saida_avulsa_id)
  WHERE saida_avulsa_id IS NOT NULL;

ALTER TABLE public.saidas_avulsas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saidas_avulsas FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.saidas_avulsas TO authenticated;
CREATE POLICY saidas_avulsas_active_team_select ON public.saidas_avulsas
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
  ));
CREATE POLICY saidas_avulsas_active_team_insert ON public.saidas_avulsas
  FOR INSERT TO authenticated WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.app_users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'active'
    )
  );

-- Atribuicao imutavel dos campos de autoria, nunca a partir do navegador.
CREATE FUNCTION eb_audit_private.stamp_saida_avulsa()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE
  actor_id uuid := auth.uid();
  actor_name text;
BEGIN
  IF TG_RELID <> 'public.saidas_avulsas'::regclass OR TG_WHEN <> 'BEFORE'
     OR TG_LEVEL <> 'ROW' OR TG_OP <> 'INSERT' OR TG_NARGS <> 0 THEN
    RAISE EXCEPTION 'Contexto de autoria de saida nao autorizado.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(btrim(u.full_name), ''), u.email)
    INTO actor_name FROM public.app_users u
    WHERE u.id = actor_id AND u.status = 'active';
  IF actor_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Conta sem acesso ativo para registrar saidas.' USING ERRCODE = '42501';
  END IF;
  NEW.created_by := actor_id;
  NEW.created_by_name := actor_name;
  NEW.created_at := statement_timestamp();
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION eb_audit_private.stamp_saida_avulsa() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_eb_saida_avulsa_authorship BEFORE INSERT ON public.saidas_avulsas
  FOR EACH ROW EXECUTE FUNCTION eb_audit_private.stamp_saida_avulsa();

-- Efeitos privilegiados limitados estritamente ao INSERT autorizado nesta tabela.
-- O usuario nao recebe INSERT no historico de estoque nem credenciais administrativas.
CREATE FUNCTION eb_audit_private.apply_saida_avulsa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
DECLARE
  item jsonb;
  gift public.brindes%ROWTYPE;
  updated_gift public.brindes%ROWTYPE;
  gift_id uuid;
  gift_ids uuid[] := ARRAY[]::uuid[];
  qty integer;
BEGIN
  IF TG_RELID <> 'public.saidas_avulsas'::regclass OR TG_WHEN <> 'AFTER'
     OR TG_LEVEL <> 'ROW' OR TG_OP <> 'INSERT' OR TG_NARGS <> 0 THEN
    RAISE EXCEPTION 'Contexto de baixa de estoque nao autorizado.' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid()
     OR NOT EXISTS (
       SELECT 1 FROM public.app_users u WHERE u.id = auth.uid() AND u.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Conta sem acesso ativo para registrar saidas.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(NEW.itens) IS DISTINCT FROM 'array'
     OR jsonb_array_length(NEW.itens) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Informe de 1 a 50 brindes.' USING ERRCODE = '22023';
  END IF;

  -- Valide todas as quantidades e IDs antes de efetuar qualquer baixa.
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.itens) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR coalesce(item->>'quantidade', '') !~ '^[1-9][0-9]{0,6}$'
       OR nullif(item->>'brinde_id', '') IS NULL THEN
      RAISE EXCEPTION 'Item de saida invalido.' USING ERRCODE = '22023';
    END IF;
    gift_id := (item->>'brinde_id')::uuid;
    IF gift_id = ANY(gift_ids) THEN
      RAISE EXCEPTION 'O mesmo brinde nao pode aparecer duas vezes.' USING ERRCODE = '22023';
    END IF;
    gift_ids := array_append(gift_ids, gift_id);
  END LOOP;

  -- Bloqueios em ordem fixa impedem corrida de saldo e reduzem deadlocks.
  PERFORM b.id FROM public.brindes b
    WHERE b.id = ANY(gift_ids) ORDER BY b.id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.itens) LOOP
    gift_id := (item->>'brinde_id')::uuid;
    qty := (item->>'quantidade')::integer;
    SELECT * INTO gift FROM public.brindes WHERE id = gift_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Brinde nao encontrado.' USING ERRCODE = '22023';
    END IF;
    IF gift.quantidade < qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %: apenas % unidade(s).', gift.nome, gift.quantidade
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(NEW.itens) LOOP
    gift_id := (item->>'brinde_id')::uuid;
    qty := (item->>'quantidade')::integer;
    UPDATE public.brindes SET quantidade = quantidade - qty
      WHERE id = gift_id RETURNING * INTO updated_gift;
    INSERT INTO public.estoque_movimentacoes
      (brinde_id, brinde_nome, saida_avulsa_id, tipo, quantidade, saldo_apos, motivo)
    VALUES
      (updated_gift.id, updated_gift.nome, NEW.id, 'saida', -qty, updated_gift.quantidade,
       'Saida avulsa para ' || NEW.destino || ': ' || NEW.motivo);
  END LOOP;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION eb_audit_private.apply_saida_avulsa() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER z_eb_apply_saida_avulsa AFTER INSERT ON public.saidas_avulsas
  FOR EACH ROW EXECUTE FUNCTION eb_audit_private.apply_saida_avulsa();
NOTIFY pgrst, 'reload schema';
