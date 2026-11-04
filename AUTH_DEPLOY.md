# Envio de Brindes — autenticação por convite (revisão)

## Correção de CORS — 04/11/2026

Alvo: Vercel `env-brindes-hercules`, Supabase `cddxvgegzzyafxgcpklt`,
branch `fix/vercel-build-configuration`, PR #1. Login e painel funcionando no Preview
foram informados pelo responsável. O teste HTTP da função publicada confirmou:

- `OPTIONS /functions/v1/manage-users` com a origem
  `https://env-brindes-hercules-qz1mh0ytu-felipesievert864-7979s-projects.vercel.app`
  retorna **403**, `{"error":"Origem não autorizada."}`, sem `Access-Control-Allow-Origin`.
- Isso bloqueia a requisição no navegador antes de listar os usuários.
- Os acessos ao Supabase Hércules e ao Vercel foram restabelecidos.
- A candidata `manage-users-preview` foi publicada separadamente. A variável
  `VITE_MANAGE_USERS_FUNCTION=manage-users-preview` foi configurada somente para Preview
  da branch `fix/vercel-build-configuration`.
- Esta correção não executa SQL, migrations, alterações de políticas ou envios reais de convites.
  A homologação autenticada deve ocorrer antes de substituir a função `manage-users`.

### Implantação isolada antes da produção

1. No Supabase **`cddxvgegzzyafxgcpklt`**, preserve `APP_URL`, credenciais, configurações
   de e-mail, Redirect URLs e todos os valores já presentes em `ALLOWED_ORIGINS`.
   As origens exatas dos Previews confiáveis estão em `preview-origins.ts`, incluindo o
   alias estável da branch usado para testar novos builds:
   `https://env-brindes-hercules-git-7201d7-felipesievert864-7979s-projects.vercel.app`.
   Esse arquivo contém somente URLs públicas confirmadas no Vercel e na sessão do
   responsável; não modifica nem substitui os segredos existentes. Novos links únicos
   precisam ser incluídos explicitamente ou em `ALLOWED_ORIGINS`. Não use `*` ou `*.vercel.app`.
2. Publique primeiro a função **`manage-users-preview`**, preservando `verify_jwt=false`
   da função já publicada. A validação de JWT continua obrigatória dentro do handler,
   por `admin.auth.getUser(token)`, seguida da autorização em `app_users`.
   Inclua `supabase/functions/manage-users-preview/index.ts`,
   `supabase/functions/manage-users/index.ts`, `supabase/functions/manage-users/cors.ts`
   e `supabase/functions/manage-users/preview-origins.ts`,
   preservando os caminhos relativos. Isso cria um endpoint separado; não substitui
   `manage-users`. O preflight dispensa sessão, mas POST valida token, perfil e status.
3. No Vercel, configure **apenas Preview**, para esta branch,
   `VITE_MANAGE_USERS_FUNCTION=manage-users-preview` e gere um novo Preview.
   Produção mantém a variável ausente, usando `manage-users` como antes.
   Use o alias estável já autorizado para abrir o novo build.
4. Execute os testes locais com Node 24+ e as dependências do lockfile:
   ```sh
   npm run test:manage-users
   npm run build
   node scripts/check-manage-users-cors.mjs https://ORIGEM-EXATA-DO-PREVIEW.vercel.app manage-users-preview
   ```
   O teste HTTP verifica OPTIONS e rejeição sem sessão, sem gravar dados.
   Os testes locais usam HTTP simulado e não enviam e-mails nem consultam o banco real.
5. No navegador, entre no Preview com uma conta administradora existente e abra
   **Gerenciar usuários**. Confirme OPTIONS 204, POST `list` 200 e a tabela preenchida.
   Confira que um operador continua impedido de administrar. Revise o fluxo de
   convite/ativação com os testes locais; um envio real requer um destinatário de teste
   expressamente autorizado. Não altere perfis, senhas ou status das contas existentes
   para realizar a homologação.
6. Só depois dessa homologação publique os mesmos arquivos em **`manage-users`**,
   preservando a autenticação do handler, o valor atual de `verify_jwt` e as origens de produção, e repita o teste HTTP com a
   origem de produção. A publicação do frontend em produção é uma etapa separada.
   Não mescle o PR nem promova o Preview durante a investigação.

### O que a correção cobre

- Origens explícitas normalizadas, incluindo `APP_URL` e os aliases exatos de `preview-origins.ts`;
  origens desconhecidas continuam negadas. `ALLOWED_ORIGINS` e `APP_URL` existentes são preservados.
- Cabeçalhos de CORS do SDK fixado em `2.115.0`, incluindo retry e tracing; somente POST/OPTIONS.
- Preflight antes da inicialização do cliente privilegiado; erros previstos e inesperados
  incluem CORS para origens autorizadas, sem cache de respostas administrativas.
- Um único cliente de chamadas para listagem, convites e ativação, com erros legíveis
  e seleção de função isolada no Preview. Não há repetição automática de ações.
- Autorização por `app_users`, convite por e-mail e ativação do próprio convidado preservados.

### Validação registrada

- Testes locais: **14/14 passaram**, com backend simulado.
- `npm run build`: passou.
- Teste HTTP na função atual: reproduziu o 403 de origem, confirmando o bloqueio publicado.
- TypeScript: os mesmos 7 erros já existentes no commit-base `dabb290`, em
  `AuthGate.tsx` (PromiseLike/finally) e `Configuracoes.tsx` (tipos de configuração).
  Nenhum novo erro foi introduzido por esta correção; a checagem global ainda não passa.
- Candidata publicada: `manage-users-preview`, versão 1; sem substituir `manage-users` v4.
- Pendente: validar uma listagem autenticada no Preview antes de substituir `manage-users`.

## Configuração inicial (referência histórica)

Os passos abaixo são para a instalação inicial. Não os reexecute sobre o banco existente
para resolver CORS. Preserve os dados, as políticas e os convites já configurados.

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
