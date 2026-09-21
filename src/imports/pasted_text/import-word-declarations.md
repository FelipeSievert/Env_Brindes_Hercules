Desenvolva uma nova funcionalidade integrada ao sistema existente chamada:

# 📥 Importar Declarações de Conteúdo Word

## OBJETIVO PRINCIPAL

Criar uma funcionalidade capaz de receber arquivos Microsoft Word (`.docx`) de Declarações de Conteúdo que seguem o mesmo modelo/layout do documento utilizado atualmente no sistema, como o arquivo de referência **ERIK FREITAS**.

O sistema deve:

1. Permitir o upload de um ou vários arquivos `.docx`.
2. Ler automaticamente o conteúdo de cada arquivo Word.
3. Identificar a estrutura da Declaração de Conteúdo.
4. Diferenciar corretamente os dados do **REMETENTE** e do **DESTINATÁRIO**.
5. Extrair exclusivamente os dados do **DESTINATÁRIO** para esta funcionalidade.
6. Transformar os dados encontrados em informações estruturadas.
7. Verificar se o destinatário já existe no banco de dados.
8. Criar ou atualizar o destinatário diretamente no **Supabase**.
9. Garantir que os dados permaneçam salvos permanentemente após fechar ou atualizar a página.

Não utilizar armazenamento apenas temporário no navegador.

---

# MODELO DE REFERÊNCIA DOS ARQUIVOS

Os arquivos que serão importados possuem o mesmo padrão visual e estrutural da Declaração de Conteúdo de referência.

A IA deve reconhecer uma estrutura semelhante a:

**REMETENTE | DESTINATÁRIO**

Com informações organizadas lado a lado.

Exemplo conceitual:

REMETENTE:

NOME: [Nome do remetente]

ENDEREÇO: [Endereço do remetente]

CIDADE: [Cidade]
UF: [Estado]

CEP: [CEP]

CPF/CNPJ: [Documento]

DESTINATÁRIO:

NOME: [Nome do destinatário]

ENDEREÇO: [Endereço completo do destinatário]

CIDADE: [Cidade]
UF: [Estado]

CEP: [CEP]

CPF/CNPJ: [Documento, quando existente]

---

# REGRA MAIS IMPORTANTE: EXTRAIR APENAS O DESTINATÁRIO

A Declaração possui dados de duas pessoas/empresas:

* REMETENTE
* DESTINATÁRIO

Para esta funcionalidade, o sistema deve salvar no banco de dados apenas os dados localizados na seção **DESTINATÁRIO**.

⚠️ Nunca confundir os dados do remetente com os dados do destinatário.

Por exemplo, se o documento possuir:

REMETENTE:

* Nome: HERCULES MOTORES ELÉTRICOS
* Cidade: TIMBÓ
* UF: SC

DESTINATÁRIO:

* Nome: ERIK FREITAS
* Cidade: BELÉM
* UF: PA

O registro criado no banco deve ser:

Nome: ERIK FREITAS

Cidade: BELÉM

UF: PA

E não os dados do remetente.

---

# CAMPOS QUE DEVEM SER EXTRAÍDOS

O sistema deve procurar especificamente na coluna/seção **DESTINATÁRIO**:

### Dados principais

* Nome
* CPF
* CNPJ
* Endereço
* Cidade
* UF
* CEP

### Estrutura esperada

Os campos normalmente estarão identificados por textos como:

* `NOME:`
* `ENDEREÇO:`
* `CIDADE:`
* `UF:`
* `CEP:`
* `CPF/CNPJ:`

A extração deve utilizar esses rótulos para identificar os valores.

---

# PROCESSAMENTO DO ENDEREÇO

O campo `ENDEREÇO` pode conter informações completas em uma única linha.

Exemplo:

`CONJ. COHAB, GLEBA 1, PASS Q-1, N20 - MARAMBAIA`

O sistema deve salvar inicialmente o endereço completo sem perder informações.

Se a estrutura atual da tabela de destinatários possuir campos separados, tentar identificar quando possível:

* Logradouro
* Número
* Complemento
* Bairro

Porém:

⚠️ Não inventar informações.

Caso não seja possível separar corretamente, manter o endereço completo no campo apropriado.

Preservar integralmente as informações presentes no Word.

---

# CPF/CNPJ

O campo do documento pode aparecer como:

`CPF/CNPJ:`

Seguido por:

* Um CPF
* Um CNPJ
* Nenhum valor

O sistema deve:

### Se encontrar CPF

Salvar no campo CPF.

### Se encontrar CNPJ

Salvar no campo CNPJ.

### Se o campo estiver vazio

Não inventar um número.

Permitir salvar o destinatário utilizando os outros dados disponíveis.

---

# UPLOAD DE ARQUIVOS

Criar uma tela chamada:

# Importar Declarações Word

Adicionar uma área de upload com suporte para:

* Um arquivo `.docx`
* Múltiplos arquivos `.docx`
* Arrastar e soltar arquivos

Texto da interface:

**Arraste suas Declarações de Conteúdo aqui**

ou

**Selecionar arquivos Word**

Aceitar apenas arquivos:

`.docx`

---

# LEITURA DOS ARQUIVOS WORD

O sistema deve realmente processar o conteúdo interno dos arquivos `.docx`.

Não tentar interpretar o arquivo apenas pelo nome.

A leitura deve considerar:

* Textos
* Parágrafos
* Tabelas
* Células de tabelas

Como os documentos seguem um modelo padrão, a funcionalidade deve procurar a seção identificada como:

**DESTINATÁRIO**

E extrair os valores associados aos campos:

* NOME
* ENDEREÇO
* CIDADE
* UF
* CEP
* CPF/CNPJ

---

# NÃO UTILIZAR OUTRAS PARTES DA DECLARAÇÃO COMO DADOS DO DESTINATÁRIO

Ignorar completamente informações como:

## Dados dos Correios

* Unidade de postagem
* Número do registro
* Carimbo

## Dados do Remetente

Não salvar o remetente como destinatário.

## Identificação dos bens

Não utilizar:

* ITEM
* CONTEÚDO
* QUANTIDADE
* VALOR
* TOTAIS
* PESO

## Declaração

Ignorar:

* Texto jurídico
* Assinatura
* Data

Essas informações não devem ser utilizadas para criar o destinatário.

---

# PROCESSAMENTO EM LOTE

Permitir importar diversos documentos Word simultaneamente.

Exemplo:

* ERIK FREITAS.docx
* JOÃO SILVA.docx
* EMPRESA ABC.docx
* MARIA SOUZA.docx

O sistema deve processar cada documento individualmente.

Cada arquivo deve gerar um resultado independente.

---

# PRÉ-VISUALIZAÇÃO DOS DADOS

Antes de finalizar a importação, mostrar uma tabela com os dados identificados.

Exemplo:

| Arquivo           | Nome         | CPF/CNPJ       | Cidade   | UF | CEP       | Status |
| ----------------- | ------------ | -------------- | -------- | -- | --------- | ------ |
| ERIK FREITAS.docx | ERIK FREITAS | —              | BELÉM    | PA | 66623-274 | Pronto |
| JOÃO.docx         | JOÃO SILVA   | CPF encontrado | CURITIBA | PR | XXXXX-XXX | Pronto |

Permitir corrigir manualmente informações caso a leitura automática tenha identificado algo incorretamente.

---

# INTEGRAÇÃO COM SUPABASE

Após confirmar a importação, os dados devem ser enviados diretamente para a tabela real de destinatários já existente no projeto Supabase.

Utilizar a integração atual do projeto.

Os registros devem ser persistentes.

Depois de importar:

* Atualizar a tabela de destinatários.
* Fazer os dados aparecerem imediatamente no cadastro/listagem de destinatários.
* Os destinatários devem continuar disponíveis após recarregar a página.
* Os destinatários devem poder ser utilizados na criação de novas Declarações de Conteúdo.

⚠️ Não utilizar apenas:

* localStorage
* sessionStorage
* estado temporário do React
* memória da página

O Supabase deve ser a fonte principal e permanente dos dados.

---

# VERIFICAÇÃO DE DUPLICIDADE

Antes de criar um novo destinatário, verificar se ele já existe.

Utilizar a seguinte prioridade:

## 1. CPF

Se existir CPF, procurar um destinatário com o mesmo CPF.

## 2. CNPJ

Se existir CNPJ, procurar um destinatário com o mesmo CNPJ.

## 3. Nome + CEP

Caso não exista CPF ou CNPJ:

Comparar:

* Nome
* CEP

## 4. Nome + endereço

Caso não exista documento nem CEP válido:

Comparar:

* Nome
* Endereço
* Cidade

---

# SE O DESTINATÁRIO JÁ EXISTIR

Não criar um registro duplicado.

Mostrar o status:

🔵 **Destinatário já existente**

Se existirem informações novas ou diferentes no documento:

Mostrar:

🟡 **Possível atualização**

Permitir que o usuário escolha:

* Manter dados existentes
* Atualizar com dados importados

Não sobrescrever automaticamente informações importantes sem validação.

---

# SE O DESTINATÁRIO NÃO EXISTIR

Criar automaticamente um novo registro na tabela do Supabase.

Mostrar:

🟢 **Novo destinatário criado**

---

# TRATAMENTO DE ERROS

Caso um arquivo não siga corretamente o modelo esperado:

Mostrar:

🔴 **Não foi possível identificar o destinatário**

Explicar o motivo.

Exemplos:

* Campo NOME não encontrado.
* Seção DESTINATÁRIO não encontrada.
* Arquivo Word inválido.
* Dados insuficientes.

Permitir que os outros arquivos do lote continuem sendo processados normalmente.

Um erro em um documento não deve cancelar toda a importação.

---

# INTERFACE

Criar uma interface moderna e integrada ao visual atual do sistema.

Estrutura:

## Cabeçalho

**Importar Declarações de Conteúdo**

Descrição:

> Importe arquivos Word de Declarações de Conteúdo e cadastre automaticamente os destinatários encontrados.

---

## Área de upload

Grande área com:

📄

**Arraste arquivos Word aqui**

**ou**

Botão:

**Selecionar arquivos**

---

## Lista de arquivos

Após selecionar:

📄 ERIK FREITAS.docx

Status:

⏳ Aguardando processamento

---

## Botão principal

**Processar Declarações**

---

## Resultados

Após o processamento, mostrar:

* Quantidade de arquivos processados
* Novos destinatários
* Destinatários já existentes
* Arquivos com erro

Exemplo:

✅ 15 arquivos processados
🟢 10 novos destinatários
🔵 3 já existentes
🔴 2 com problemas

---

# BOTÃO FINAL

Após revisar os dados:

**Salvar Destinatários no Banco de Dados**

Esse botão deve realizar a operação real no Supabase.

Após concluir:

Exibir uma confirmação de sucesso.

Atualizar automaticamente a lista de destinatários existente no sistema.

---

# REQUISITO FUNDAMENTAL

Esta funcionalidade deve ser projetada especificamente para importar Declarações de Conteúdo que seguem o mesmo padrão estrutural do documento de referência.

A lógica não deve tentar ser uma IA genérica que adivinha qualquer documento Word.

Ela deve utilizar a estrutura padronizada:

**REMETENTE → DESTINATÁRIO**

E extrair especificamente os campos existentes na área do:

# DESTINATÁRIO

Isso deve tornar a importação consistente para centenas de documentos Word que possuem o mesmo layout, mas dados diferentes.

O sistema deve priorizar precisão e evitar misturar informações entre REMETENTE e DESTINATÁRIO.
