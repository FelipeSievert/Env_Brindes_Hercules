-- MIGRAÇÃO PROPOSTA, NÃO EXECUTAR ANTES DE CONFIRMAR O SUPABASE DO SITE.
-- Esta mudança revoga acesso anônimo, substitui políticas antigas e exige usuários convidados.
-- Faça backup e valide a versão do site antes de aplicar.
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'blocked')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_users TO authenticated;
DROP POLICY IF EXISTS app_users_read_self ON public.app_users;
CREATE POLICY app_users_read_self ON public.app_users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- As contas são gerenciadas exclusivamente pela Edge Function, usando service_role.
-- Ambos os perfis ativos possuem as mesmas permissões operacionais.
-- Antes de iniciar, garanta que ao menos um usuário administrador seja criado
-- pelo Dashboard do Supabase (Authentication > Users), e que haja um app_users
-- para esse mesmo auth.users.id, com role='admin' e status='active'.

DO $$
DECLARE
  table_name TEXT;
  existing_policy RECORD;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'destinatarios', 'brindes', 'configuracoes', 'declaracoes',
    'declaracao_itens', 'notificacoes'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Tabela ausente: public.%', table_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR existing_policy IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, table_name);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format(
      'CREATE POLICY app_users_active_access ON public.%I FOR ALL TO authenticated
       USING (EXISTS (SELECT 1 FROM public.app_users
                      WHERE id = (SELECT auth.uid()) AND status = ''active''))
       WITH CHECK (EXISTS (SELECT 1 FROM public.app_users
                           WHERE id = (SELECT auth.uid()) AND status = ''active''))',
      table_name
    );
  END LOOP;
END $$;

-- Protege RPCs que alteram estoque. RLS da tabela brindes permanece em vigor.
DO $$
BEGIN
  IF to_regprocedure('public.decrease_stock(uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.decrease_stock(UUID, INTEGER) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.decrease_stock(UUID, INTEGER) TO authenticated;
  END IF;
  IF to_regprocedure('public.increase_stock(uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.increase_stock(UUID, INTEGER) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.increase_stock(UUID, INTEGER) TO authenticated;
  END IF;
  -- Verificação por cron permanece no backend: nunca expor essa função definer no browser.
  IF to_regprocedure('public.run_rastreio_check()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.run_rastreio_check() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
COMMIT;
