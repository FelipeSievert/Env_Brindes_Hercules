A FUNCIONALIDADE DE IMPORTAÇÃO WORD EVOLUIU E JÁ CONSEGUE PROCESSAR CORRETAMENTE ALGUNS ARQUIVOS, COMO "ERIK FREITAS.docx".

NÃO REMOVER, REESCREVER OU QUEBRAR A LÓGICA QUE JÁ ESTÁ FUNCIONANDO.

O problema atual é que outro arquivo apresentou:

"Seção DESTINATÁRIO não encontrada"

Portanto, precisamos manter a estratégia atual que funciona e adicionar FALLBACKS para diferentes variações do mesmo modelo de Declaração de Conteúdo.

==================================================
ESTRATÉGIA: NÃO QUEBRAR O QUE FUNCIONA
==================================================

Manter integralmente a lógica atual utilizada para processar corretamente:

ERIK FREITAS.docx

Esse arquivo deve continuar sendo processado corretamente após qualquer alteração.

Antes de finalizar a implementação, testar novamente o ERIK FREITAS.docx.

==================================================
NOVO SISTEMA DE MÚLTIPLAS ESTRATÉGIAS
==================================================

Implementar uma cadeia de estratégias.

ESTRATÉGIA 1 — ATUAL

Executar primeiro a lógica atual que já funciona.

Se conseguir identificar corretamente:

- Nome
- Endereço
- Cidade
- UF
- CEP

considerar o arquivo processado.

==================================================

ESTRATÉGIA 2 — TABELAS

Se a estratégia atual falhar:

Percorrer todas as tabelas do documento.

Para cada tabela:

- Ler todas as linhas.
- Ler todas as células.
- Normalizar o conteúdo.
- Procurar REMETENTE e DESTINATÁRIO.

A busca deve reconhecer:

DESTINATÁRIO
DESTINATARIO
D E S T I N A T Á R I O

E também variações de espaçamento.

==================================================

ESTRATÉGIA 3 — IDENTIFICAÇÃO POR CAMPOS

Caso não seja possível encontrar literalmente o título DESTINATÁRIO:

Procurar uma estrutura contendo campos repetidos em dois blocos, como:

NOME:
ENDEREÇO:
CIDADE:
UF:
CEP:
CPF/CNPJ:

Se forem encontrados DOIS grupos semelhantes lado a lado:

- Grupo da esquerda = REMETENTE
- Grupo da direita = DESTINATÁRIO

Utilizar o grupo da direita.

Isso deve funcionar mesmo quando o título:

DESTINATÁRIO

não for extraído corretamente do Word.

==================================================

ESTRATÉGIA 4 — XML DO DOCX
==================================================

Se as estratégias anteriores falharem:

Ler a estrutura interna do arquivo DOCX.

O DOCX é um arquivo ZIP contendo XML.

Analisar document.xml.

Procurar:

<w:tbl>
<w:tr>
<w:tc>

Preservar:

- Tabelas
- Linhas
- Células

Extrair os textos das células e identificar o bloco da direita.

==================================================
NORMALIZAÇÃO
==================================================

Criar uma única função central de normalização.

Ela deve:

- Converter para maiúsculas.
- Remover acentos.
- Remover quebras de linha.
- Remover espaços duplicados.
- Criar uma versão sem espaços para comparação.

Exemplos equivalentes:

"D E S T I N A T Á R I O"

"DESTINATÁRIO"

"DESTINATARIO"

Todos devem gerar:

"DESTINATARIO"

O mesmo vale para:

REMETENTE

R E M E T E N T E

==================================================
IMPORTANTE: NÃO EXIGIR O TÍTULO
==================================================

A presença da palavra DESTINATÁRIO não pode ser o único requisito para processar um arquivo.

Se a estrutura possuir claramente dois blocos de cadastro contendo:

NOME
ENDEREÇO
CIDADE
UF
CEP

o sistema deve conseguir identificar:

BLOCO 1 = REMETENTE
BLOCO 2 = DESTINATÁRIO

mesmo que o título DESTINATÁRIO esteja ausente ou tenha sido extraído incorretamente.

==================================================
VALIDAÇÃO
==================================================

Um destinatário pode ser considerado válido se possuir pelo menos:

- Nome
E
- Cidade ou CEP

O CPF/CNPJ NÃO é obrigatório.

O endereço pode ser opcional caso não seja possível extrair completamente.

Não retornar "Erro na leitura" apenas porque um único campo está vazio.

==================================================
DEBUG
==================================================

Quando um arquivo falhar, registrar internamente:

- Quantidade de tabelas encontradas.
- Quantidade de linhas.
- Quantidade de células.
- Texto normalizado encontrado.
- Qual estratégia falhou.
- Em qual etapa ocorreu a falha.

Mostrar um erro mais específico.

Exemplos:

"Não foi encontrada uma estrutura de tabela compatível."

ou:

"Foram encontrados campos, mas não foi possível separar remetente e destinatário."

NÃO utilizar apenas:

"Seção DESTINATÁRIO não encontrada"

para todos os tipos de falha.

==================================================
OBJETIVO FINAL
==================================================

Criar uma importação robusta para diferentes arquivos Word baseados no mesmo modelo de Declaração de Conteúdo.

Manter o processamento que já funciona para ERIK FREITAS.docx.

Adicionar estratégias alternativas para conseguir processar documentos que tenham pequenas diferenças na estrutura interna do Word.

Um documento que possui o mesmo visual pode possuir uma estrutura XML diferente.

Por isso, não depender exclusivamente do texto visual ou da posição exata de uma única tabela.