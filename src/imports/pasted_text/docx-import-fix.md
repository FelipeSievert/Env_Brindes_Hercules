CORRIJA A FUNCIONALIDADE DE IMPORTAÇÃO DE DECLARAÇÕES WORD.

Atualmente, ao importar o arquivo de referência "ERIK FREITAS.docx", o sistema apresenta o erro:

"Seção DESTINATÁRIO não encontrada"
"Não foi possível extrair dados"

Isso está incorreto.

O problema não está necessariamente no documento. O problema está na lógica atual de leitura do arquivo .docx.

O arquivo Word possui uma estrutura visual onde REMETENTE e DESTINATÁRIO aparecem lado a lado, provavelmente utilizando tabelas, células ou elementos estruturados do documento.

A implementação atual aparentemente está tentando localizar uma seção chamada "DESTINATÁRIO" como se fosse um texto simples isolado.

NÃO utilizar apenas uma busca simples como:

documentText.includes("DESTINATÁRIO")

ou regex baseada exclusivamente em texto linear.

A leitura deve considerar corretamente a estrutura interna de arquivos .docx.

--------------------------------------------------

## IMPLEMENTAÇÃO NECESSÁRIA

Implementar uma leitura real do arquivo .docx utilizando uma biblioteca compatível com documentos Word.

A solução deve conseguir extrair:

- Parágrafos
- Tabelas
- Linhas
- Células
- Texto existente dentro das células

O sistema deve percorrer todas as tabelas existentes no documento.

Para cada tabela:

1. Percorrer todas as linhas.
2. Percorrer todas as células.
3. Extrair o texto de cada célula.
4. Preservar a relação entre células que estão lado a lado.

Isso é fundamental porque REMETENTE e DESTINATÁRIO podem estar em células diferentes da mesma linha.

--------------------------------------------------

# ESTRUTURA DO DOCUMENTO DE REFERÊNCIA

Os documentos importados seguem o modelo da Declaração de Conteúdo utilizada atualmente.

Existe uma estrutura semelhante a:

REMETENTE | DESTINATÁRIO

NOME: [REMETENTE] | NOME: [DESTINATÁRIO]

ENDEREÇO: [REMETENTE] | ENDEREÇO: [DESTINATÁRIO]

CIDADE: [REMETENTE] UF: [UF] | CIDADE: [DESTINATÁRIO] UF: [UF]

CEP: [REMETENTE] CPF/CNPJ: [DOCUMENTO] | CEP: [DESTINATÁRIO] CPF/CNPJ: [DOCUMENTO]

IMPORTANTE:

Os dados do REMETENTE e DESTINATÁRIO podem aparecer visualmente na mesma linha.

Portanto, NÃO concatenar todo o conteúdo do documento e depois tentar adivinhar qual informação pertence ao destinatário.

A lógica precisa preservar a posição/estrutura das células.

--------------------------------------------------

# NOVA LÓGICA DE EXTRAÇÃO

Criar uma função específica para:

extrairDestinatarioDoDocx()

Essa função deve:

1. Ler completamente o arquivo .docx.
2. Extrair todas as tabelas.
3. Identificar a tabela onde existem os textos:

"REMETENTE"
e
"DESTINATÁRIO"

ou variações equivalentes.

4. Determinar qual coluna/célula representa o DESTINATÁRIO.
5. Extrair SOMENTE os dados dessa coluna.

--------------------------------------------------

# EXTRAÇÃO DOS CAMPOS

Dentro da área/coluna do DESTINATÁRIO, procurar os seguintes campos:

NOME:
ENDEREÇO:
CIDADE:
UF:
CEP:
CPF/CNPJ:

A extração deve retornar um objeto estruturado:

{
  nome: "",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  cpf: "",
  cnpj: ""
}

--------------------------------------------------

# TRATAMENTO DE CPF/CNPJ

O campo "CPF/CNPJ:" pode estar vazio.

Isso NÃO deve causar erro.

Exemplo:

CPF/CNPJ:

sem nenhum valor.

Nesse caso:

cpf = null
cnpj = null

O destinatário ainda pode ser importado normalmente caso possua:

- Nome
- Endereço
- Cidade
- UF
- CEP

Não exigir CPF ou CNPJ obrigatoriamente.

--------------------------------------------------

# TRATAMENTO DE ACENTOS

A busca pelos textos deve ser tolerante a:

DESTINATÁRIO
DESTINATARIO

REMETENTE

Também deve ignorar:

- Maiúsculas/minúsculas
- Espaços extras
- Quebras de linha
- Espaçamento incomum causado pelo Word

Criar uma função de normalização antes da comparação.

Exemplo:

normalizarTexto(texto)

Essa função deve:

- Converter para maiúsculas.
- Remover acentos para comparação.
- Remover espaços duplicados.
- Remover quebras de linha desnecessárias.
- Fazer trim().

Assim:

" D E S T I N A T Á R I O "

também deve conseguir ser reconhecido como:

"DESTINATARIO"

--------------------------------------------------

# FALLBACK IMPORTANTE

Caso a estrutura de tabela não possa ser identificada diretamente:

Criar uma segunda estratégia.

Extrair todo o texto do documento preservando a ordem.

Localizar o bloco:

REMETENTE DESTINATÁRIO

Depois identificar os pares de informações.

Porém, a prioridade deve ser sempre:

1. Estrutura de tabelas e células.
2. Estrutura dos elementos XML do .docx.
3. Texto linear como fallback.

--------------------------------------------------

# ARQUIVO DE TESTE

Utilizar "ERIK FREITAS.docx" como arquivo obrigatório para validar a funcionalidade.

Ao importar esse arquivo, o sistema DEVE conseguir encontrar o destinatário.

O resultado esperado é semelhante a:

Nome:
ERIK FREITAS

Endereço:
CONJ. COHAB, GLEBA 1, PASS Q-1, N20 - MARAMBAIA

Cidade:
BELÉM

UF:
PA

CEP:
66623-274

CPF/CNPJ:
vazio, caso não exista valor preenchido

IMPORTANTE:

Não confundir esses dados com os dados do REMETENTE.

--------------------------------------------------

# TESTE ANTES DE EXIBIR SUCESSO

Antes de considerar a importação concluída:

1. Processar o arquivo.
2. Exibir no console/log os dados extraídos.
3. Validar se o nome do destinatário foi encontrado.
4. Validar se cidade e UF foram encontrados.
5. Somente então permitir salvar.

Se os dados forem encontrados corretamente, mostrar uma prévia na tabela.

Exemplo:

Arquivo: ERIK FREITAS.docx
Nome: ERIK FREITAS
Endereço: CONJ. COHAB, GLEBA 1, PASS Q-1, N20 - MARAMBAIA
Cidade: BELÉM
UF: PA
CEP: 66623-274
Status: Pronto para importar

--------------------------------------------------

# SALVAMENTO NO SUPABASE

Somente depois que a extração estiver funcionando corretamente, executar a lógica de banco de dados.

Fluxo correto:

UPLOAD DOCX
↓
LEITURA DO DOCX
↓
LEITURA DAS TABELAS/CÉLULAS
↓
IDENTIFICAÇÃO DA COLUNA DESTINATÁRIO
↓
EXTRAÇÃO DOS DADOS
↓
PRÉ-VISUALIZAÇÃO
↓
VERIFICAÇÃO DE DUPLICIDADE NO SUPABASE
↓
INSERT OU UPDATE
↓
CONFIRMAÇÃO

NÃO tentar salvar no Supabase antes de confirmar que os dados foram extraídos corretamente.

--------------------------------------------------

# OBJETIVO DA CORREÇÃO

O sistema deve ser capaz de importar centenas de arquivos Word que utilizam exatamente o mesmo modelo/layout do arquivo ERIK FREITAS.docx.

A solução deve ser baseada na estrutura real dos arquivos .docx, principalmente tabelas e células, e não apenas em uma busca simples por texto.

CORRIJA A IMPLEMENTAÇÃO EXISTENTE SEM REMOVER AS FUNCIONALIDADES ATUAIS DA TELA DE IMPORTAÇÃO.