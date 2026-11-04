-- Aplica acesso a funcionarios convidados e ativos ao banco original da Hercules.
-- Revisao baseada nas politicas observadas: eb_backend_service_only nas 5 tabelas principais.
-- PRESERVA as politicas atuais de service_role; NAO recria, exclui ou altera registros.
-- Execute SOMENTE no projeto correto cddxvgegzzyafxgcpklt, apos backup.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'A tabela app_users precisa existir antes desta migracao.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE role = 'admin' AND status = 'active') THEN
    RAISE EXCEPTION 'Cadastre um administrador ativo antes desta migracao.';
  END IF;
END $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_users TO authenticated;
DROP POLICY IF EXISTS app_users_read_self ON public.app_users;
CREATE POLICY app_users_read_self ON public.app_users
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brindes', 'configuracoes', 'declaracao_itens',
    'declaracoes', 'destinatarios', 'notificacoes'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Tabela ausente: public.%', t;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- O navegador nao deve acessar nenhuma das seis tabelas de forma anonima.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);

    -- Mantem as politicas antigas de service_role e adiciona apenas
    -- uma politica para funcionarios ativos.
    EXECUTE format('DROP POLICY IF EXISTS eb_active_employee_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY eb_active_employee_access ON public.%I
       FOR ALL TO authenticated
       USING (EXISTS (
         SELECT 1 FROM public.app_users AS u
         WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
       ))
       WITH CHECK (EXISTS (
         SELECT 1 FROM public.app_users AS u
         WHERE u.id = (SELECT auth.uid()) AND u.status = ''active''
       ))',
      t
    );
  END LOOP;
END $$;

-- Protege funcoes publicas do estoque contra chamadas anonimas.
DO $$
BEGIN
  IF to_regprocedure('public.decrease_stock(uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.decrease_stock(uuid,integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.decrease_stock(uuid,integer) TO authenticated;
  END IF;
  IF to_regprocedure('public.increase_stock(uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.increase_stock(uuid,integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.increase_stock(uuid,integer) TO authenticated;
  END IF;
  IF to_regprocedure('public.run_rastreio_check()') IS NOT NULL THEN
    -- Rotina de backend nao deve ser executavel pelo navegador.
    REVOKE EXECUTE ON FUNCTION public.run_rastreio_check() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
COMMIT;

-- POS-VERIFICACAO (somente leitura; executar apos COMMIT):
-- SELECT tablename, policyname, roles FROM pg_policies
-- WHERE schemaname='public' AND policyname='eb_active_employee_access';
-- SELECT c.relname AS tabela,
--        has_table_privilege('anon', c.oid, 'SELECT') AS leitura_anonima,
--        has_table_privilege('authenticated', c.oid, 'SELECT') AS leitura_autenticada
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public' AND c.relname IN
--   ('brindes','configuracoes','declaracao_itens','declaracoes','destinatarios','notificacoes');
