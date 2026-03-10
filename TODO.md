# TODO - Modificações Solicitadas

## Tarefas:
- [x] 1. Analisar o código existente
- [x] 2. Confirmar plano com o usuário
- [x] 3. Modificar js/iso-manutencao.js - Remover campos do modal
- [x] 4. Modificar js/funcionarios.js - Adicionar mapeamento PIS
- [x] 5. Testar as modificações

## Resumo das Alterações:

### 1. js/iso-manutencao.js
- Removido o campo "Tipo de Manutenção" do modal de abertura de chamado
- Campo "Prioridade Inicial" foi desabilitado (o gerente de manutenção preencherá posteriormente)
- Atualizada a função `salvarChamado()` para não exigir mais esses campos

### 2. js/funcionarios.js
- Adicionado mapeamento do campo PIS na função `processarArquivoAtualizacaoXLSX()`
- Agora o sistema reconhece colunas que contenham "pis" no Excel e atualiza o campo correspondente

