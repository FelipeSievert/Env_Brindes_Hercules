IMPORTANTE: NÃO CRIAR UM NOVO SISTEMA DO ZERO.

Atualize e corrija o sistema atual de Declaração de Conteúdo que já foi criado.

O objetivo desta atualização é resolver dois problemas principais:

1. Tornar o layout da declaração o MAIS FIEL POSSÍVEL ao modelo original de Declaração de Conteúdo utilizado atualmente pela empresa.

2. Conectar completamente o sistema ao Supabase já existente, utilizando as tabelas, banco de dados, estoque e containers/estruturas que já foram criados no projeto.

NÃO utilizar dados temporários em memória, local state ou dados fictícios como armazenamento principal.

Todos os dados precisam ser persistidos no Supabase.

==================================================
PARTE 1 — FIDELIDADE AO MODELO ORIGINAL
==================================================

A página de visualização e impressão da Declaração de Conteúdo deve deixar de ter aparência de dashboard moderno.

Ela deve parecer um DOCUMENTO OFICIAL.

O objetivo é reproduzir digitalmente o layout do modelo atual da declaração, mantendo sua estrutura visual.

A declaração deve utilizar uma folha:

A4

Vertical.

O documento deve possuir:

- Bordas retas
- Linhas divisórias
- Tabelas
- Campos alinhados
- Texto compacto
- Aparência formal
- Poucos elementos decorativos
- Sem cards modernos
- Sem sombras
- Sem cantos excessivamente arredondados
- Sem elementos típicos de dashboard

A página de impressão deve parecer uma declaração/documento administrativo real.

==================================================
ESTRUTURA EXATA DA DECLARAÇÃO
==================================================

NO TOPO:

Título centralizado:

DECLARAÇÃO DE CONTEÚDO

Abaixo ou próximo ao cabeçalho, criar a área:

CARIMBO DA UNIDADE

CAMPOS EXCLUSIVOS DOS CORREIOS

Com campos:

UNIDADE DE POSTAGEM

NÚMERO DO REGISTRO

Esses campos devem permanecer vazios para preenchimento posterior.

==================================================
REMETENTE E DESTINATÁRIO
==================================================

Criar uma grande seção dividida verticalmente em DUAS COLUNAS.

LADO ESQUERDO:

R E M E T E N T E

LADO DIREITO:

D E S T I N A T Á R I O

Manter os títulos visualmente semelhantes ao modelo original.

Os dados devem aparecer organizados em linhas.

REMETENTE:

NOME:

ENDEREÇO:

CIDADE:

UF:

CEP:

CPF/CNPJ:

DESTINATÁRIO:

NOME:

ENDEREÇO:

CIDADE:

UF:

CEP:

CPF/CNPJ:

Os dois blocos devem ficar lado a lado, separados por uma linha vertical.

Não transformar esses dados em cards.

Devem parecer campos de um formulário/documento oficial.

==================================================
IDENTIFICAÇÃO DOS BENS
==================================================

Criar um título:

I D E N T I F I C A Ç Ã O   D O S   B E N S

Logo abaixo, criar uma tabela com linhas retas.

Colunas:

ITEM

CONTEÚDO

QUANT.

VALOR

Os dados dos brindes devem ser preenchidos automaticamente.

Exemplo:

1 | CAMISA P | 1 |

2 | CAMISA M | 4 |

3 | CAMISA GG | 1 |

Abaixo da tabela:

TOTAIS

Quantidade total dos itens.

Depois:

PESO TOTAL (kg)

O peso deve ser calculado automaticamente utilizando os pesos cadastrados nos produtos/brindes.

==================================================
DECLARAÇÃO
==================================================

Criar a seção:

D E C L A R A Ç Ã O

Manter o texto padrão da declaração.

O texto deve aparecer como texto corrido e compacto, semelhante a um documento oficial.

Não colocar dentro de cards.

Não utilizar caixas modernas.

==================================================
DATA
==================================================

A DATA DEVE SER AUTOMÁTICA.

Não exigir que o usuário informe manualmente a data.

Sempre utilizar automaticamente a data atual do sistema no momento da geração da declaração.

Formato visual:

TIMBÓ, [DIA] DE [MÊS] DE [ANO]

Exemplo:

TIMBÓ, 4 DE SETEMBRO DE 2026

A cidade deve utilizar a cidade configurada como cidade de emissão da empresa.

==================================================
ASSINATURA
==================================================

Criar espaço suficiente para assinatura.

Texto:

Assinatura do Declarante / Remetente

Manter a aparência semelhante ao documento original.

==================================================
REMOVER COMPLETAMENTE A OBSERVAÇÃO DO RODAPÉ
==================================================

IMPORTANTE:

REMOVER COMPLETAMENTE a seção:

OBSERVAÇÃO

Também remover completamente o texto relacionado a:

"Constitui crime contra a ordem tributária suprimir ou reduzir tributo..."

NÃO exibir esse texto.

NÃO deixar uma caixa vazia no lugar.

NÃO deixar uma borda vermelha.

NÃO deixar espaço reservado para essa observação.

A declaração deve terminar após a área de:

DATA

ASSINATURA DO DECLARANTE / REMETENTE

==================================================
BOTÕES FORA DA ÁREA DE IMPRESSÃO
==================================================

Os botões devem existir apenas na interface do sistema.

Exemplo:

VOLTAR

EDITAR

IMPRIMIR

GERAR PDF

BAIXAR PDF

Esses botões NÃO podem aparecer na impressão.

Ao imprimir ou gerar PDF, mostrar SOMENTE o documento A4.

Sem:

Sidebar

Botões

Dashboard

Menus

Elementos de navegação

==================================================
PARTE 2 — CONEXÃO REAL COM O SUPABASE
==================================================

ATUALMENTE OS DADOS ESTÃO FUNCIONANDO APENAS ENQUANTO A GUIA ESTÁ ABERTA.

CORRIGIR ISSO.

O sistema NÃO deve depender exclusivamente de:

- Local state
- Dados temporários
- Arrays fictícios
- Dados mockados
- Session storage como banco principal

Todos os dados importantes devem ser carregados e salvos no SUPABASE.

Antes de criar novas tabelas, analisar e utilizar a estrutura do Supabase que JÁ EXISTE no projeto.

IMPORTANTE:

NÃO criar um segundo banco de estoque.

NÃO duplicar tabelas já existentes.

NÃO criar uma estrutura paralela para os containers.

Utilizar as tabelas e relacionamentos existentes.

==================================================
DESTINATÁRIOS
==================================================

Conectar a página de Destinatários ao Supabase.

As operações devem ser reais:

CRIAR

EDITAR

EXCLUIR ou DESATIVAR

PESQUISAR

IMPORTAR

Ao atualizar a página:

Os destinatários devem continuar existindo.

Ao fechar e abrir novamente:

Os destinatários devem continuar existindo.

==================================================
IMPORTAÇÃO DE EXCEL
==================================================

A importação deve salvar os destinatários realmente no Supabase.

Fluxo:

1. Usuário seleciona arquivo Excel ou CSV.
2. Sistema lê os dados.
3. Mostra uma prévia.
4. Permite mapear colunas.
5. Valida os dados.
6. Salva os destinatários válidos no Supabase.
7. Mostra erros encontrados.
8. Evita duplicações quando possível.

Após importar:

Os dados devem aparecer imediatamente na tabela de Destinatários.

E continuar disponíveis mesmo depois de atualizar a página.

==================================================
ESTOQUE E BRINDES
==================================================

IMPORTANTE:

O sistema já possui uma estrutura de ESTOQUE e CONTAINERS criada anteriormente.

A Declaração de Conteúdo deve utilizar essa estrutura existente.

NÃO criar um estoque separado apenas para as declarações.

NÃO criar uma lista fictícia de brindes.

Ao criar uma declaração:

Os brindes disponíveis devem ser carregados diretamente do estoque existente no Supabase.

Quando o usuário selecionar um brinde:

Mostrar:

Nome

Quantidade disponível

Peso unitário

Outras informações disponíveis no cadastro existente.

==================================================
INTEGRAÇÃO COM CONTAINERS
==================================================

Os containers que já existem no sistema devem permanecer integrados à lógica atual.

Antes de alterar a estrutura:

ANALISAR AS TABELAS, RELACIONAMENTOS E CAMPOS JÁ EXISTENTES NO SUPABASE.

Utilizar as relações existentes entre:

- Estoque
- Produtos/Brindes
- Containers
- Movimentações

A nova funcionalidade de Declaração de Conteúdo deve se encaixar nessa estrutura.

NÃO quebrar funcionalidades existentes.

==================================================
GERAÇÃO DA DECLARAÇÃO E ESTOQUE
==================================================

Quando uma declaração for GERADA ou CONFIRMADA:

1. Buscar os brindes reais do estoque.
2. Verificar a quantidade disponível.
3. Validar se existe quantidade suficiente.
4. Criar a declaração no banco.
5. Criar os itens da declaração.
6. Registrar a movimentação de saída no estoque existente.
7. Atualizar a quantidade disponível.
8. Salvar tudo corretamente no Supabase.

IMPORTANTE:

A operação deve ser consistente.

Não permitir que uma declaração seja criada sem estoque suficiente.

Não permitir estoque negativo.

Se alguma parte da operação falhar:

Não deixar o estoque parcialmente alterado.

==================================================
MÚLTIPLOS DESTINATÁRIOS
==================================================

Caso o usuário selecione vários destinatários:

Exemplo:

ERIK FREITAS

JOÃO SILVA

MARIA SOUZA

E os brindes forem:

CAMISA P — 1

CAMISA M — 4

CAMISA GG — 1

O sistema deve calcular o estoque necessário considerando TODOS os destinatários.

Exemplo:

3 destinatários.

Cada destinatário receberá:

4 CAMISAS M.

Necessário:

12 CAMISAS M.

O sistema deve verificar se existem pelo menos 12 unidades antes de permitir confirmar.

Após confirmar:

Criar uma declaração individual para cada destinatário.

Cada declaração deve ser salva no Supabase.

Cada declaração deve possuir seus próprios itens.

Cada declaração deve aparecer no histórico.

==================================================
HISTÓRICO DE DECLARAÇÕES
==================================================

Criar ou conectar a tabela de Declarações ao Supabase.

Ao atualizar a página:

As declarações antigas devem continuar disponíveis.

Cada registro deve possuir:

Número da declaração

Destinatário

Data

Itens

Peso total

Status

PDF, caso gerado

Ações:

VISUALIZAR

IMPRIMIR NOVAMENTE

BAIXAR PDF

DUPLICAR

CANCELAR

==================================================
GERAÇÃO REAL DE PDF
==================================================

A geração de PDF deve utilizar os dados reais carregados do Supabase.

O PDF precisa reproduzir fielmente o layout da declaração A4.

O PDF deve conter:

- Dados reais do remetente
- Dados reais do destinatário
- Itens reais selecionados
- Quantidades
- Peso total calculado
- Data automática
- Layout oficial

Não gerar apenas uma imagem ou uma prévia.

Gerar um PDF funcional.

O PDF não deve incluir:

OBSERVAÇÃO SOBRE CRIME TRIBUTÁRIO

Bordas vermelhas

Cards modernos

Menus

Botões

Sidebar

==================================================
ESTADO DO SISTEMA
==================================================

Garantir que todas as telas carreguem os dados reais do Supabase.

Ao abrir a aplicação:

Carregar dados do banco.

Ao criar:

Salvar no banco.

Ao editar:

Atualizar no banco.

Ao excluir:

Atualizar no banco.

Após atualizar a página:

Recarregar os dados do Supabase.

Implementar estados visuais:

CARREGANDO

SUCESSO

ERRO

SEM DADOS

==================================================
REGRA FINAL
==================================================

A prioridade desta atualização é:

1. FIDELIDADE AO MODELO ORIGINAL DA DECLARAÇÃO.
2. REMOVER COMPLETAMENTE A OBSERVAÇÃO DO RODAPÉ.
3. CONECTAR TODOS OS DADOS AO SUPABASE.
4. UTILIZAR O ESTOQUE E CONTAINERS JÁ EXISTENTES.
5. NÃO DUPLICAR ESTRUTURAS DE BANCO.
6. GARANTIR PERSISTÊNCIA DOS DADOS.
7. GERAR DECLARAÇÕES REAIS PRONTAS PARA IMPRESSÃO.

Antes de criar qualquer nova tabela relacionada a estoque ou containers, verificar a estrutura existente do Supabase e reutilizar os relacionamentos já criados.