# Permissões da auditoria — correção aplicada em 04/11/2026

## Problema

O cadastro de destinatários falhava com `permission denied for table eb_auditoria`.
Os funcionários ativos tinham permissão para gravar nas tabelas operacionais, mas
o trigger `public.eb_audit_trigger()` executava como o funcionário e tentava inserir
em uma tabela de auditoria reservada ao backend. O mesmo trigger era usado por
`destinatarios`, `brindes` e `configuracoes`.

## Correção

Migration aplicada no projeto Hércules `cddxvgegzzyafxgcpklt`:
`supabase/migrations/20261104130913_fix_audit_trigger_permissions.sql`.

A rotina de auditoria foi movida para `eb_audit_private`, preservando seu OID e os
três vínculos de trigger. A gravação de histórico agora tem uma identidade própria
do banco (`SECURITY DEFINER`), com as seguintes restrições:

- Schema privado, sem USAGE para `anon`/`authenticated`, e função sem EXECUTE para
  esses papéis nem para PUBLIC. Não há nova RPC pública.
- `search_path` vazio e referências de tabelas/schema explícitas.
- Somente os três triggers existentes de linha, BEFORE INSERT/UPDATE/DELETE, são aceitos.
- Chamadas de funcionários exigem `auth.uid()` e cadastro ativo em `app_users`.
- Rotinas de backend com `service_role` e manutenção pelo proprietário do banco são preservadas.
- A identificação do chamador usa o papel original da conexão, não `current_user`,
  que dentro da função passa a ser o proprietário.

As permissões/RLS das tabelas operacionais e de `eb_auditoria` não foram ampliadas.
O navegador continua sem poder ler ou forjar registros de auditoria. O formato
antes/depois do histórico e o comportamento de `updated_at` foram preservados.

## Verificação

`supabase/tests/audit_permissions.sql` foi executado com a correção dentro de uma
transação revertida antes de a migration ser aplicada. Foram confirmados:

- INSERT, UPDATE e DELETE de destinatário por funcionário ativo, com os três eventos de auditoria.
- UPDATE em brindes e configurações com seus eventos de auditoria.
- Rejeição de gravação direta no histórico, acesso anônimo e usuário sem cadastro ativo.
- Funcionamento das rotinas `service_role` e da manutenção pelo proprietário.
- Preservação dos três vínculos de trigger e das restrições do schema/função privados.

Após aplicar a migration, o cadastro real já preenchido na interface foi salvo.
A persistência foi confirmada com um único cadastro e um único evento INSERT de
auditoria correspondente. Nenhum registro ou evento dos testes permaneceu no banco.
Os avisos dos advisors de segurança permaneceram os mesmos do levantamento inicial.

Nenhum dado anterior, política operacional, conta ou configuração de convite foi alterado.

Referências: [triggers no PostgreSQL](https://www.postgresql.org/docs/17/trigger-definition.html)
e [funções com privilégios próprios](https://www.postgresql.org/docs/17/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).
