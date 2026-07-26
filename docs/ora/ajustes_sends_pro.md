# Visão Geral

Precisamos fazer uma refatoração na importação de planilha do modulo sends pro.

Na pasta "docs/ora/templates-importacao" temos os 4 tipos de templates(matrizes de score) que são atribuídos as matrizes de score do sistema.

Então, antes de importar o arquivo, é preciso listar as matrizes de score para que o usuário escolha o tipo de planilha que ele está subindo, após isso, libera o campo para importação e validação dos campos (todos os dados obrigatórios, menos e-mail).

## Regras de atribuição

**TIPO: USER**
- O importador do arquivo do tipo USER ao importar já vai atribuir os leads importados pra si e pra sua equipe, ou seja, os leads importados já vão estar atribuídos a ele e a sua equipe.

**TIPO: MANAGER**
- O importador do arquivo do tipo MANAGER ao importar vai ter um campo select para selecionar a equipe e da equipe selecionada um outro campo select para selecionar o usuário, ou seja, os leads importados já vão estar atribuídos a um usuário específico da equipe selecionada.

**TIPO: ADMIN**
- O importador do arquivo do tipo ADMIN ao importar vai ter um campo select para selecionar a equipe e da equipe selecionada um outro campo select para selecionar o usuário, ou seja, os leads importados já vão estar atribuídos a um usuário específico da equipe selecionada.

Após criar a importação, os leads devem ser criados como já é feito hoje e o campo origem_lista deve ser preenchido com o nome da importação.