# TODO: ISO Manutenção & Máquinas Updates

**Approved Plan (User Feedback):**
1. **ISO Manutenção (`js/iso-manutencao.js`):** Remove "Enviar para TODOS mecânicos" option.
2. **Máquinas (`js/iso-maquinas.js`, `views/iso-maquinas.html`):** Add dashboard with KPIs.

**Status:** Files analyzed.

## Detailed Plan:

### 1. Remove "TODOS Mecânicos" (js/iso-manutencao.js)
- **Find:** `onclick="reenviarParaTodosMecanicos('${chamado.id}')"` in table HTML.
- **Action:** Remove `<button ...><i class="fas fa-users"></i>T</button>` button.
- **Dependent:** Update `reenviarParaTodosMecanicos()` to warn/deprecate.
- **Test:** No "T" button in table actions.

### 2. Maquinas Dashboard (views/iso-maquinas.html + js/iso-maquinas.js)
**UI Addition (views/iso-maquinas.html):**
```
<div class="row mb-4" id="dashboard-maquinas-metricas">
  <!-- Metrics cards populated by JS -->
</div>
```
Before table.

**JS (`inicializarMaquinas()` after `carregarMaquinas()`):**
```
async function renderizarDashboardMaquinas() {
  const total = await __db.collection('maquinas').get().then(s => s.size);
  const criticas = await __db.collection('maquinas').where('isCritica', '==', true).get().then(s => s.size);
  const semGerente = await __db.collection('maquinas').where('gerente', '==', null).get().then(s => s.size);
  const chamadosAbertos = await __db.collection('manutencao_chamados')
    .where('status', 'in', ['Aberto', 'Em Andamento']).get().then(s => s.size);
  
  document.getElementById('dashboard-maquinas-metricas').innerHTML = `
    <div class="col-xl-3 col-md-6 mb-4">
      <div class="card border-left-primary shadow h-100 py-2">
        <div class="card-body">
          <div class="row no-gutters align-items-center">
            <div class="col mr-2">
              <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Total Máquinas</div>
              <div class="h5 mb-0 font-weight-bold text-gray-800">${total}</div>
            </div>
            <div class="col-auto">
              <i class="fas fa-cogs fa-2x text-gray-300"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Similar cards for Críticas, Sem Gerente, Chamados Abertos -->
  `;
}
```
**Call:** `await renderizarDashboardMaquinas();` in `inicializarMaquinas()`.

**Metrics:**
- Total machines
- Críticas
- Sem gerente
- Chamados abertos

**Followup:**
- Update `carregarMaquinas()` to refresh dashboard.
- Test: navigate `iso-maquinas` → see cards above table.

**Approve plan?** I'll create detailed TODO.md + breakdown steps.
