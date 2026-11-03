# Envio de Brindes — autenticação por convite (revisão)

> Atenção: este código é uma proposta em PR de revisão, não uma implantação pronta.
> O repositório de setembro precisa ser sincronizado com a versão atual do site antes do deploy.

## Regras aprovadas
- Sem cadastro público. Somente o administrador convida pelo e-mail.
- Convite por Supabase Auth; cada funcionário cria sua senha pelo link recebido.
- Operador e administrador possuem as mesmas funções operacionais.
- Somente administrador acessa Gerenciar usuários e pode convidar, bloquear ou alterar perfil.
- Não há campo Setor. A instalação inicial atende a três funcionários.

## Preparação ANTES do deploy
1. Confirme o projeto Supabase correto. No código anterior o project ref era `cddxvgegzzyafxgcpklt`; o projeto da conexão atual do ChatGPT é **diferente**. Nenhuma alteração no banco foi executada.
2. Faça backup do banco correto. Analise `supabase/auth_invite_only.sql` com o responsável técnico e execute só depois de confirmar todas as tabelas, políticas e funções existentes. Nunca reexecute `supabase_migration.sql` depois de endurecer RLS, pois o script antigo recria políticas abertas.
3. Desabilite cadastro público em Supabase Auth (Signups). Ative autenticação por e-mail e configure seu provedor SMTP, caso necessário, para envio de convites.
4. Crie o primeiro usuário no painel Supabase Authentication > Users. Copie o UUID do usuário e, usando SQL Editor com privilégios de administrador no projeto **correto**, cadastre o primeiro administrador:
   ```sql
   INSERT INTO public.app_users(id, full_name, email, role, status)
   VALUES ('COLE_UUID_DO_AUTH_USERS', 'Administrador', 'COLE_EMAIL_DO_ADMIN', 'admin', 'active')
   ON CONFLICT (id) DO UPDATE SET role='admin', status='active';
   ```
   *Nunca faça bootstrap automático de administrador pelo frontend.*
5. Implante `supabase/functions/manage-users/index.ts` no projeto correto e deixe a validação de JWT ativada.
6. Configure os segredos da Edge Function: `APP_URL` com a URL final do site (sem barra no fim) e `ALLOWED_ORIGINS` com essa URL; acrescente prévias confiáveis somente para testes. `SUPABASE_SERVICE_ROLE_KEY` existe apenas na função/server e nunca no navegador ou GitHub.
7. No Vercel, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave publishable/anon do **mesmo projeto**); no Supabase Auth, adicione a URL do Vercel em Site URL e Redirect URLs.
8. Faça o build e teste, no ambiente de homologação, as três situações: usuário sem sessão (negado), operador ativo (funcionalidades operacionais), administrador ativo (gerenciar usuários). Teste bloqueio e acesso anônimo diretamente no banco. Só depois publique.
9. Não compartilhe `service_role` nem senhas. O projeto GitHub é público.

## Limites desta alteração
- SQL e Edge Function estão versionados, mas **não foram executados/publicados**.
- Envio de convites depende de configurar o Supabase, SMTP e URL de redirecionamento.
- Banco/versão atual do site ainda não foram verificados.
- Não há integração automática com rastreamento dos Correios. O código antigo pode conter rotinas de lembrete de código manual.
