Crie o design completo de um sistema web responsivo chamado **Sistema de Declaração de Conteúdo**, utilizado internamente pela empresa **Hercules Motores Elétricos** para cadastrar destinatários, controlar brindes/itens e gerar automaticamente declarações de conteúdo prontas para impressão.

O sistema deve ter aparência profissional, moderna, organizada e corporativa, com interface simples e intuitiva.

## OBJETIVO PRINCIPAL

O sistema deve substituir o processo manual de preenchimento de declarações de conteúdo no Microsoft Word.

O usuário deve conseguir:

1. Cadastrar destinatários
2. Importar destinatários através de planilhas Excel
3. Cadastrar brindes e itens disponíveis
4. Controlar o estoque dos brindes
5. Criar uma declaração selecionando um ou mais destinatários
6. Adicionar brindes e suas respectivas quantidades
7. Calcular automaticamente quantidade total e peso total
8. Gerar uma declaração de conteúdo formatada
9. Visualizar a declaração antes da impressão
10. Imprimir ou salvar a declaração em PDF

---

# ESTRUTURA DO SISTEMA

Criar um menu lateral fixo com as seguintes opções:

* Dashboard
* Destinatários
* Brindes e Estoque
* Nova Declaração
* Declarações Geradas
* Configurações

Utilizar ícones modernos ao lado de cada opção.

---

# TELA 1 — DASHBOARD

Criar uma tela inicial com cards mostrando:

* Total de destinatários cadastrados
* Total de brindes cadastrados
* Estoque disponível
* Declarações geradas no mês

Adicionar uma seção de declarações recentes mostrando:

* Número da declaração
* Destinatário
* Data
* Quantidade de itens
* Status

Adicionar botões rápidos:

* * Nova Declaração
* * Novo Destinatário
* * Novo Brinde

---

# TELA 2 — DESTINATÁRIOS

Criar uma tela de gerenciamento de destinatários.

No topo:

Título: **Destinatários**

Botões:

* * Novo Destinatário
* Importar Excel

Adicionar uma barra de pesquisa para procurar por:

* Nome
* CPF
* CNPJ
* Cidade

Criar uma tabela com as colunas:

* Nome
* CPF/CNPJ
* Endereço
* Cidade
* UF
* CEP
* Ações

Nas ações incluir:

* Editar
* Excluir
* Visualizar

---

# FORMULÁRIO DE DESTINATÁRIO

Criar formulário com:

* Nome completo / Razão Social
* CPF ou CNPJ
* CEP
* Endereço
* Número
* Complemento
* Bairro
* Cidade
* Estado

Adicionar botão:

**Salvar Destinatário**

---

# TELA 3 — BRINDES E ESTOQUE

Criar uma tela para cadastrar e controlar os brindes disponíveis.

No topo:

Título: **Brindes e Estoque**

Botão:

* Novo Brinde

Adicionar tabela com:

* Nome do brinde
* Categoria
* Quantidade disponível
* Peso unitário
* Valor
* Status
* Ações

Exemplos de brindes:

* Camisa P
* Camisa M
* Camisa G
* Camisa GG
* Boné
* Caneca
* Chaveiro

Criar indicador visual de estoque:

* Estoque normal
* Estoque baixo
* Sem estoque

---

# TELA 4 — NOVA DECLARAÇÃO

Esta deve ser a principal tela do sistema.

Título:

**Nova Declaração de Conteúdo**

Dividir a tela em etapas.

## ETAPA 1 — REMETENTE

Mostrar os dados fixos da empresa:

Nome:

HERCULES MOTORES ELÉTRICOS

Endereço:

RUA CHAPECÓ, 590

Bairro:

INDUSTRIAL

Cidade:

TIMBÓ

UF:

SC

CEP:

89120-000

CNPJ:

07.442.711/0001-65

Permitir que esses dados sejam configurados posteriormente nas configurações.

---

## ETAPA 2 — DESTINATÁRIO

Adicionar uma barra de pesquisa grande:

🔎 Pesquisar destinatário por nome, CPF ou CNPJ

Ao selecionar um destinatário, preencher automaticamente:

* Nome
* Endereço
* Bairro
* Cidade
* UF
* CEP
* CPF/CNPJ

Permitir editar temporariamente os dados antes de gerar a declaração.

Caso seja necessário enviar para mais de um destinatário, permitir selecionar múltiplos destinatários e gerar uma declaração individual para cada um utilizando os mesmos brindes selecionados.

---

## ETAPA 3 — IDENTIFICAÇÃO DOS BENS

Criar uma seção chamada:

**Brindes e Itens da Declaração**

Adicionar botão:

* Adicionar Brinde

Ao clicar, abrir uma seleção de brindes cadastrados no estoque.

Cada item deve possuir:

* Número do item
* Nome do brinde
* Quantidade
* Peso unitário
* Peso total
* Valor
* Botão para remover

Exemplo:

ITEM | CONTEÚDO | QUANTIDADE | PESO

1 | CAMISA P | 1 | 0,2 KG

2 | CAMISA M | 4 | 0,8 KG

3 | CAMISA GG | 1 | 0,2 KG

O sistema deve calcular automaticamente:

**TOTAL DE ITENS: 6**

**PESO TOTAL: 1,2 KG**

---

# ETAPA 4 — DATA

Adicionar:

Local:

TIMBÓ

Data:

04 DE SETEMBRO DE 2026

Utilizar seletor de data.

---

# BOTÃO PRINCIPAL

Na parte inferior:

**GERAR DECLARAÇÃO**

Botão grande e destacado.

---

# TELA 5 — VISUALIZAÇÃO DA DECLARAÇÃO

Após clicar em GERAR DECLARAÇÃO, abrir uma página de visualização pronta para impressão.

O layout deve ser semelhante a um documento oficial de declaração de conteúdo.

Formato A4.

Criar:

Título centralizado:

# DECLARAÇÃO DE CONTEÚDO

Adicionar uma área superior dividida entre:

## REMETENTE

Nome

HERCULES MOTORES ELÉTRICOS

Endereço

Cidade

UF

CEP

CPF/CNPJ

E:

## DESTINATÁRIO

Nome

Endereço

Cidade

UF

CEP

CPF/CNPJ

---

Adicionar seção:

# IDENTIFICAÇÃO DOS BENS

Criar tabela com:

ITEM

CONTEÚDO

QUANTIDADE

VALOR

Adicionar uma linha de:

TOTAL DE ITENS

PESO TOTAL

---

Adicionar seção:

# DECLARAÇÃO

Inserir o seguinte texto padrão:

"Declaro que não me enquadro no conceito de contribuinte previsto no art. 4º da Lei Complementar nº 87/1996, uma vez que não realizo, com habitualidade ou em volume que caracterize intuito comercial, operações de circulação de mercadoria, ainda que se iniciem no exterior, ou estou dispensado da emissão da nota fiscal por força da legislação tributária vigente, responsabilizando-me, nos termos da lei e a quem de direito, por informações inverídicas."

---

Na parte inferior:

TIMBÓ, DIA de MÊS de ANO

Área para:

Assinatura do Declarante/Remetente

Adicionar observação:

"Constitui crime contra a ordem tributária suprimir ou reduzir tributo, ou contribuição social e qualquer acessório."

---

# BOTÕES DA VISUALIZAÇÃO

No topo da página:

🖨️ Imprimir

📄 Gerar PDF

⬇️ Baixar PDF

✏️ Editar Declaração

---

# TELA 6 — DECLARAÇÕES GERADAS

Criar histórico de todas as declarações.

Tabela:

* Número
* Destinatário
* Data
* Quantidade de itens
* Peso total
* Status

Adicionar ações:

* Visualizar
* Imprimir novamente
* Baixar PDF
* Duplicar declaração

Adicionar filtros por:

* Data
* Destinatário
* Cidade
* Status

---

# DESIGN

Criar um design moderno e corporativo.

Características:

* Interface limpa
* Cards com cantos levemente arredondados
* Tabelas organizadas
* Boa hierarquia visual
* Ícones modernos
* Sidebar profissional
* Layout responsivo
* Desktop como prioridade
* Página de impressão totalmente limpa, sem elementos desnecessários
* A visualização da declaração deve parecer um documento oficial em folha A4

Utilizar uma identidade visual corporativa e profissional.

A tela de geração da declaração deve ser extremamente rápida e simples de utilizar, permitindo que o usuário selecione um destinatário, escolha os brindes, informe as quantidades e gere imediatamente um documento pronto para impressão.

Priorizar produtividade, facilidade de uso e redução do trabalho manual.
