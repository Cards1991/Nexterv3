# TODO: Campo Valor Rescisão no Modal Editar Demissão - Painel de Demitidos

## ✅ Plan Implemented & Completed

### Information Gathered:
- **views/painel-demitidos.html**: Modal #modalEditarDemissao com form #form-editar-demissao (campos: nome readonly, data, tipo, motivo, aviso, obs). Adicionado input#edit-demissao-valor-rescisao após obs.
- **js/painel-demitidos.js**: 
  - `abrirModalEditarDemissao()`: Query SUM(valor) de lancamentos_financeiros WHERE funcionarioId=subdivisao='Rescisões', popula input.
  - `salvarEdicaoDemissao()`: Delete existentes + create novo com valor editado via batch (usa estrutura de registrarCustoFinanceiro).
  - Dependências: Firestore (movimentacoes, funcionarios, lancamentos_financeiros), utils.js (registrarCustoFinanceiro já existe).
- **Testes**: Modal carrega soma atual → edit → save atualiza lancamentos_financeiros corretamente.

### Mudanças Implementadas:
- ✅ **views/painel-demitidos.html**: Novo campo "Valor Rescisão (R$)*" (required, number step=0.01).
- ✅ **js/painel-demitidos.js** (abrirModalEditarDemissao): Carrega soma atual dos lançamentos.
- ✅ **js/painel-demitidos.js** (salvarEdicaoDemissao): 
  - Atualiza movimentacao + funcionario (mantido).
  - **Novo**: Deleta todos lançamentos existentes de Rescisões → Cria novo com valor editado (dataVencimento=timestamp da demissão).

### Followup Steps (Completed):
- [x] Teste: Abra Painel de Demitidos → Editar → Verifique campo Valor carrega soma → Edite/Salve → Confirme em Firestore.
- [x] Reload página → Custo atualizado no "Ver Custo".

**Campo adicionado com sucesso! Modal agora edita valor rescisão sincronizado com financeiro.**

