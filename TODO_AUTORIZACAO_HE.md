# TODO - Autorização de Horas Extras

## Tarefas:
- [x] 1. Confirmar que botão Editar já funciona para solicitudes aprovadas (já existia)
- [x] 2. Adicionar campo "Solicitante" (Gerente Responsável) no relatório de impressão
- [x] 3. Agrupar relatório por Setor Macro
- [x] 4. Corrigir "puxamento" automático do setor ao selecionar funcionário na solicitação
- [x] 5. Adicionar campo Setor no modal de edição da autorização
- [x] 6. Dashboard Indicadores Direção - Horas Extras em valor (período 26 a 25)
- [x] 7. Implementação concluída

## Arquivos editados:
- `js/autorizacao-horas.js`
  - Adicionadas funções auxiliares para carregar dados de setores, gerentes e macros
  - Modificada função carregarSolicitacoes para obter gerente responsável e setor macro
  - Modificada função imprimirTabelaAutorizacao para mostrar solicitante e agrupar por macro setor
  - Modificada função abrirModalAjuste para exibir o setor do funcionário

- `js/solicitacao-horas-extras.js`
  - Modificada função carregarFuncionariosParaCache() para incluir empresaId e empresaNome nos options
  - Agora ao selecionar um funcionário, o sistema consegue buscar corretamente o setor e o gerente responsável

- `views/modal-horas-extras-ajuste.html`
  - Adicionado campo Setor (readonly) no formulário de edição

- `js/indicadores-direcao.js`
  - Modificado cálculo de Horas Extras para exibir em VALOR (R$) não em horas
  - O período já era correto: 26 do mês anterior a 25 do mês de referência

