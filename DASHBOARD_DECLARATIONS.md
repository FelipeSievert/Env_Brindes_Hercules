# Dashboard, A/C e geração de declarações

Ao gerar uma declaração, a tela enviava `gerada`, enquanto `declaracoes_status_check` aceita `gerado`, `informado`, `devolvido` e `cancelado`. A criação e a duplicação agora usam `gerado`; valores antigos são normalizados na camada de dados e os filtros usam os status atuais.

O Dashboard apresenta três gráficos com dados reais: declarações por mês (6 ou 12 meses, pela data do documento), situação de todos os registros e quantidade dos seis brindes mais usados nas declarações Gerado/Informado. Devolvidos e cancelados ficam fora do uso ativo. Meses vazios e listas vazias não recebem dados de exemplo.

O campo opcional A/C aparece no cadastro, importação CSV e seleção do destinatário. Na seleção é possível ajustar o contato só para aquela declaração. O valor é salvo em `destinatario_snapshot` e aparece abaixo do nome no documento de tela/impressão/PDF somente se preenchido. Alterar o cadastro depois não muda declarações anteriores.

## Banco e estoque

Migration: `supabase/migrations/20261104132310_dashboard_aos_cuidados_atomic_declarations.sql`, aplicada no projeto Hércules `cddxvgegzzyafxgcpklt`.

- Adiciona `destinatarios.aos_cuidados` com padrão vazio; não reescreve documentos antigos.
- `create_declaracoes(jsonb)` salva o lote inteiro, itens, snapshots e baixa de estoque em uma transação. Falha em qualquer item/destinatário reverte o lote completo.
- Usa SECURITY INVOKER, search_path vazio, conta ativa, RLS existente e bloqueios de estoque em ordem estável. Nenhuma credencial privilegiada vai ao navegador. Execução por anon/PUBLIC é negada.
- Totais/pesos vêm dos dados atuais dos brindes; quantidades inválidas e saldo insuficiente são rejeitados.
- O cliente faz uma única RPC e não repete automaticamente uma mutação com resposta perdida.

## Validação

- `npm run test:declarations`: 8 testes passaram, incluindo status antigos/inválidos, virada de ano, datas inválidas, vazios, contagem por situação, A/C histórico, renderização real de impressão com/sem A/C e chamada real da camada de dados com backend simulado.
- `npm run test:manage-users`: 14 testes passaram, preservando convite e CORS.
- `npm run build`: passou. O build do Vercel também chegou a READY.
- SQL real como funcionário authenticated ativo: lote com e sem A/C, snapshot após editar destinatário, totais, baixa única de estoque, recusa de quantidade negativa/status inválido/conta sem acesso e reversão de todo o lote por falta de estoque. Todos passaram em transação descartável com ROLLBACK.
- Após aplicar, continuaram 120 destinatários, 25 declarações, 81 itens e saldo 3741. Hashes do estoque e de todas as declarações existentes ficaram idênticos. Sem novos avisos dos advisors em relação ao levantamento inicial.
- TypeScript global continua com os mesmos sete erros anteriores em AuthGate/Configuracoes documentados em AUTH_DEPLOY.md; não houve erros novos nos arquivos desta atualização.
- Preview estável respondeu HTTP 200 e serviu o bundle com os três gráficos, A/C e a nova RPC.
- A conferência visual autenticada desta atualização ficou pendente: a conexão com o navegador deixou de responder na recarga. Não foi feita promoção do frontend para produção; PR #1 continua em rascunho.

Preview: https://env-brindes-hercules-git-7201d7-felipesievert864-7979s-projects.vercel.app
