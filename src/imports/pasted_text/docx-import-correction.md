CORRIJA A IMPORTAÇÃO DOS ARQUIVOS WORD (.DOCX).

O arquivo "ERIK FREITAS.docx" está apresentando:

"Seção DESTINATÁRIO não encontrada"

Porém, analisando o documento original, a seção DESTINATÁRIO EXISTE e está dentro de uma TABELA do Microsoft Word.

O problema atual é que a lógica está tentando procurar o texto "DESTINATÁRIO" de forma simples, mas no documento o título pode ser extraído como:

"D E S T I N A T Á R I O"

com espaços entre cada letra.

Portanto, a lógica atual de identificação precisa ser completamente corrigida.

==================================================
REGRA PRINCIPAL
==================================================

NÃO depender exclusivamente de:

text.includes("DESTINATÁRIO")

NÃO depender exclusivamente de:

text.includes("DESTINATARIO")

A implementação deve reconhecer textos mesmo quando as letras estiverem separadas por espaços.

Exemplos que devem ser considerados equivalentes:

DESTINATÁRIO

DESTINATARIO

D E S T I N A T Á R I O

D E S T I N A T A R I O

==================================================
NORMALIZAÇÃO DE TEXTO
==================================================

Criar uma função robusta chamada:

normalizarTexto()

Essa função deve:

1. Converter para maiúsculas.
2. Remover acentos.
3. Remover quebras de linha.
4. Remover espaços duplicados.
5. Fazer trim().
6. Criar também uma versão sem TODOS os espaços para comparação.

Exemplo:

Texto original:

"D E S T I N A T Á R I O"

Normalizado:

"DESTINATARIO"

O mesmo deve funcionar para:

"R E M E T E N T E"

que deve ser reconhecido como:

"REMETENTE"

IMPORTANTE:

Para comparação de títulos e rótulos, utilizar uma versão do texto sem espaços.

==================================================
ESTRUTURA REAL DO DOCUMENTO
==================================================

O documento possui uma tabela principal.

Dentro dela existe uma área organizada visualmente assim:

REMETENTE | DESTINATÁRIO

Os dois blocos ficam lado a lado.

A estrutura é aproximadamente:

--------------------------------------------------

REMETENTE              | DESTINATÁRIO

NOME: [valor]          | NOME: [valor]

ENDEREÇO: [valor]      | ENDEREÇO: [valor]

CIDADE: [valor]        | CIDADE: [valor]
UF: [valor]            | UF: [valor]

CEP: [valor]           | CEP: [valor]

CPF/CNPJ: [valor]      | CPF/CNPJ: [valor]

--------------------------------------------------

O DESTINATÁRIO está visualmente no lado DIREITO da tabela.

==================================================
NOVA ESTRATÉGIA DE EXTRAÇÃO
==================================================

Como todos os arquivos importados seguem esse mesmo modelo de Declaração de Conteúdo, NÃO utilizar uma estratégia genérica baseada apenas em procurar uma seção de texto.

A estratégia principal deve ser:

1. Ler o arquivo .docx corretamente.
2. Extrair TODAS as tabelas do documento.
3. Percorrer linhas e células.
4. Preservar a posição das células.
5. Localizar a tabela que contém simultaneamente:

REMETENTE
DESTINATÁRIO

mesmo que estejam escritos com espaços entre as letras.

6. Depois de encontrar essa tabela, identificar o bloco/COLUNA da DIREITA como DESTINATÁRIO.
7. Extrair os dados localizados nesse bloco.

==================================================
MUITO IMPORTANTE: NÃO ACHATAR A TABELA
==================================================

A implementação NÃO deve simplesmente transformar toda a tabela em um texto único e depois tentar adivinhar os dados.

É necessário preservar a estrutura:

LINHA
→ CÉLULA ESQUERDA
→ CÉLULA DIREITA

Porque:

Célula esquerda = REMETENTE

Célula direita = DESTINATÁRIO

O sistema deve saber qual informação pertence à direita.

==================================================
EXTRAÇÃO DOS DADOS
==================================================

Depois de identificar o bloco do DESTINATÁRIO, procurar:

NOME:

ENDEREÇO:

CIDADE:

UF:

CEP:

CPF/CNPJ:

Extrair SOMENTE os valores pertencentes ao DESTINATÁRIO.

Retornar:

{
  nome: "",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  cpf: null,
  cnpj: null
}

==================================================
ARQUIVO DE TESTE OBRIGATÓRIO
==================================================

Utilizar o arquivo:

ERIK FREITAS.docx

como teste obrigatório da implementação.

A leitura desse arquivo NÃO pode retornar:

"Seção DESTINATÁRIO não encontrada"

O sistema deve conseguir identificar o bloco da direita da tabela.

Os dados esperados devem ser equivalentes aos dados visíveis no documento:

NOME:
YPORA INDUSTRIA E COMERCIO

ENDEREÇO:
AVENIDA OSCAR ARARIPE, 3422 - BOM JARDIM

CIDADE:
FORTALEZA

UF:
CE

CEP:
60540-442

CPF/CNPJ:
vazio

IMPORTANTE:

Os dados devem ser extraídos da coluna da DIREITA.

NÃO utilizar os dados da coluna REMETENTE.

==================================================
ESTRATÉGIA DE FALLBACK
==================================================

Caso a leitura das tabelas não funcione perfeitamente, utilizar estratégias alternativas nesta ordem:

ESTRATÉGIA 1:
Ler tabelas e células preservando posições.

ESTRATÉGIA 2:
Ler a estrutura XML interna do .docx e identificar:

<w:tbl>
<w:tr>
<w:tc>

preservando linhas e células.

ESTRATÉGIA 3:
Extrair texto completo e utilizar normalização robusta.

Ao utilizar texto completo:

"D E S T I N A T Á R I O"

deve ser convertido para:

"DESTINATARIO"

antes da comparação.

==================================================
LEITURA REAL DE DOCX
==================================================

Verificar se a implementação atual realmente possui uma biblioteca capaz de ler arquivos Microsoft Word (.docx).

Se a biblioteca atual não consegue extrair tabelas corretamente, substituir ou complementar a implementação por uma solução que consiga processar a estrutura interna do DOCX.

O .docx é um arquivo estruturado e pode conter XML e tabelas.

A solução deve conseguir acessar corretamente:

- document.xml
- tabelas
- linhas
- células
- textos dentro das células

==================================================
DEBUG
==================================================

Adicionar temporariamente informações de debug durante o processamento.

Para cada arquivo, registrar:

1. Quantidade de tabelas encontradas.
2. Quantidade de linhas em cada tabela.
3. Conteúdo textual das células.
4. Se REMETENTE foi encontrado.
5. Se DESTINATÁRIO foi encontrado.
6. Dados finais extraídos.

Exemplo:

Arquivo: ERIK FREITAS.docx

Tabelas encontradas: X

Tabela candidata encontrada: SIM

REMETENTE encontrado: SIM

DESTINATÁRIO encontrado: SIM

Dados extraídos:

{
 nome: "...",
 endereco: "...",
 cidade: "...",
 uf: "...",
 cep: "..."
}

==================================================
NÃO SALVAR ANTES DA EXTRAÇÃO
==================================================

O fluxo deve ser:

UPLOAD
↓
LER DOCX
↓
IDENTIFICAR TABELA
↓
IDENTIFICAR COLUNA DESTINATÁRIO
↓
EXTRAIR DADOS
↓
MOSTRAR PRÉ-VISUALIZAÇÃO
↓
VALIDAR
↓
VERIFICAR DUPLICIDADE NO SUPABASE
↓
SALVAR

O Supabase NÃO deve ser chamado para criar destinatários enquanto a extração ainda estiver falhando.

==================================================
OBJETIVO FINAL
==================================================

Corrigir a implementação existente para conseguir importar corretamente centenas de arquivos Word que possuem o mesmo layout da Declaração de Conteúdo apresentada.

A solução deve ser baseada principalmente na ESTRUTURA DA TABELA.

Como o layout é padronizado:

COLUNA ESQUERDA = REMETENTE

COLUNA DIREITA = DESTINATÁRIO

Essa relação estrutural deve ser utilizada para garantir que os dados corretos sejam extraídos.

NÃO remover a interface atual de importação.

CORRIGIR APENAS A lógica de leitura e extração do DOCX.