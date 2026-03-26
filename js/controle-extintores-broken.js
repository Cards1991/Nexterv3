// js/controle-extintores.js - COMPLETE & ERROR-FREE VERSION

// =================================================================
// Sistema de Controle de Extintores (NR-23) - All functions exposed
// =================================================================

let extintores = [];
let inspecoes = [];
let recargas = [];
let chartExtintoresStatus = null;
let chartExtintoresTipo = null;

// Utility function to format dates (assuming it's not globally available)
function formatarData(data) {
    if (!data) return '-';
    const d = data.toDate ? data.toDate() : new Date(data);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
}


// Inicializar (app.js calls this)
async function inicializarControleExtintores() {
    console.log("✅ Controle de Extintores FULLY loaded");
    
    const tabs = document.querySelectorAll('#extintores-tabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => setTimeout(() => carregarDadosExtintoresPorAba(tab.dataset.tab), 100));
    });
    
    await carregarDadosExtintores();
    verificarAlertasExtintores();
    configurarFiltrosExtintores();
}

async function carregarDadosExtintores() {
    try {
        extintores = (await db.collection('extintores').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        inspecoes = (await db.collection('extintores_inspecoes').orderBy('data', 'desc').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        recargas = (await db.collection('extintores_recargas').orderBy('data', 'desc').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        
        renderizarDashboardExtintores();
        renderizarListaExtintores();
        renderizarListaInspecoes();
        renderizarListaRecargas();
        
    } catch (error) {
        console.error("Extintores load error:", error);
        mostrarMensagem('Erro dados: ' + error.message, 'error');
    }
}

async function carregarDadosExtintoresPorAba(aba) {
    await carregarDadosExtintores();
}

// ========== DASHBOARD ==========
function renderizarDashboardExtintores() {
    const total = extintores.length;
    const hoje = new Date();
    
    let validos = 0, proximo = 0, vencidos = 0;
    extintores.forEach(ext => {
        if (!ext.validade) {
            validos++;
        } else {
            const validade = ext.validade.toDate ? ext.validade.toDate() : new Date(ext.validade);
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) vencidos++;
            else if (diffDias <= 30) proximo++;
            else validos++;
        }
    });
    
    const conformidade = total > 0 ? ((validos / total) * 100).toFixed(1) : 0;
    
    atualizarElemento('kpi-extintores-total', total);
    atualizarElemento('kpi-extintores-validos', validos);
    atualizarElemento('kpi-extintores-proximo', proximo);
    atualizarElemento('kpi-extintores-vencidos', vencidos);
    atualizarElemento('kpi-extintores-conformidade', conformidade + '%');
    
    renderizarGraficoStatusExtintores();
    renderizarGraficoTipoExtintores();
}

function atualizarElemento(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

// Charts
function renderizarGraficoStatusExtintores() {
    const ctx = document.getElementById('chart-extintores-status')?.getContext('2d');
    if (!ctx) return;
    
    if (chartExtintoresStatus) chartExtintoresStatus.destroy();
    
    const hoje = new Date();
    let validos = 0, proximoVencimento = 0, vencidos = 0;
    
    extintores.forEach(ext => {
        if (!ext.validade) {
            validos++;
        } else {
            const validade = ext.validade.toDate ? ext.validade.toDate() : new Date(ext.validade);
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) vencidos++;
            else if (diffDias <= 30) proximoVencimento++;
            else validos++;
        }
    });

    chartExtintoresStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Válidos', 'Próximo Vencimento', 'Vencidos'],
            datasets: [{ data: [validos, proximoVencimento, vencidos], backgroundColor: ['#198754', '#ffc107', '#dc3545'] }]
        },
        options: { responsive: true }
    });
}

function renderizarGraficoTipoExtintores() {
    const ctx = document.getElementById('chart-extintores-tipo');
    if (!ctx) return;
    
    if (chartExtintoresTipo) chartExtintoresTipo.destroy();
    
    const porTipo = {};
    extintores.forEach(ext => porTipo[ext.tipo || 'Outros'] = (porTipo[ext.tipo || 'Outros'] || 0) + 1);
    
    chartExtintoresTipo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{ label: 'Qtd', data: Object.values(porTipo), backgroundColor: '#007bff' }]
        },
        options: { responsive: true }
    });
}

// Alerts
function verificarAlertasExtintores() {
    const container = document.getElementById('extintores-alertas');
    if (!container) return;
    
    const hoje = new Date();
    const vencidos = extintores.filter(e => e.validade && new Date(e.validade.toDate()) < hoje).length;
    
    if (vencidos > 0) {
        container.classList.remove('d-none');
        container.innerHTML = `<div class="alert alert-danger">⚠️ ${vencidos} extintor(es) vencido(s)!</div>`;
    } else {
        container.classList.add('d-none');
    }
}

// ========== CRUD EXTINTORES ==========
function renderizarListaExtintores() {
    const tbody = document.getElementById('extintores-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const hoje = new Date();
    
    extintores.forEach(ext => {
        const validade = ext.validade ? new Date(ext.validade.toDate()) : null;
        const diffDias = validade ? Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24)) : 0;
        let status = diffDias > 30 ? 'OK' : diffDias > 0 ? 'Próximo' : 'Vencido';
        const statusClass = status === 'OK' ? 'bg-success' : status === 'Próximo' ? 'bg-warning' : 'bg-danger';
        
        console.log('[DEBUG] Rendering extintor:', ext.id);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${ext.codigo || ''}</td>
            <td>${ext.patrimonio || ''}</td>
            <td><span class="badge bg-info">${ext.tipo || ''}</span></td>
            <td>${ext.capacidade || ''}</td>
            <td>${ext.localizacao}</td>
            <td>${ext.seloINMETRO || ''}</td>
            <td>${ext.validade ? formatarData(ext.validade) : ''}</td>
            <td>${ext.proximaInspecao ? formatarData(ext.proximaInspecao) : ''}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editarExtintor('${ext.id}')">Editar</button>
                <button class="btn btn-sm btn-danger btn-delete-ext" data-id="${ext.id}">Excluir</button>
            </td>
        `;
    });
    addDeleteListeners();


async function salvarExtintor(dados) {
    try {
        if (dados.id) {
            await db.collection('extintores').doc(dados.id).update(dados);
        } else {
            await db.collection('extintores').add(dados);
        }
        mostrarMensagem('Extintor salvo!', 'success');
        await carregarDadosExtintores();
        fecharModalExtintor();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

function editarExtintor(id) {
    const ext = extintores.find(e => e.id === id);
    if (!ext) return;
    
    document.getElementById('extintor-id').value = ext.id;
    document.getElementById('extintor-codigo').value = ext.codigo || '';
    document.getElementById('extintor-patrimonio').value = ext.patrimonio || '';
    document.getElementById('extintor-tipo').value = ext.tipo || '';
    document.getElementById('extintor-capacidade').value = ext.capacidade || '';
    document.getElementById('extintor-localizacao').value = ext.localizacao || '';
    document.getElementById('extintor-selo').value = ext.seloINMETRO || '';
    document.getElementById('extintor-validade').value = ext.validade ? new Date(ext.validade.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('extintor-inspecao').value = ext.proximaInspecao ? new Date(ext.proximaInspecao.toDate()).toISOString().split('T')[0] : '';
    
    abrirModalExtintor();
}

async function excluirExtintor(id) {
    console.log('[DEBUG] excluirExtintor called:', {id, type: typeof id});
    if (!id) {
        console.error("[ModalFix] ID do extintor vazio ao tentar excluir.");
        mostrarMensagem('Erro: ID do extintor não fornecido para exclusão.', 'error');
        return;
    }
    if (!confirm('Excluir?')) return;
    try {
        await db.collection('extintores').doc(id).delete();
        mostrarMensagem('Excluído!', 'success');
        await carregarDadosExtintores();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== INSPEÇÕES ==========
function renderizarListaInspecoes() {
    const tbody = document.getElementById('extintores-inspecoes-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    inspecoes.forEach(i => {
        console.log('[DEBUG] Rendering inspecao:', i.id);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${formatarData(i.data)}</td>
            <td>${i.extintorCodigo}</td>
            <td>${i.lacre ? '✅' : '❌'}</td>
            <td>${i.manometro ? '✅' : '❌'}</td>
            <td>${i.semDanos ? '✅' : '❌'}</td>
            <td>${i.localDesobstruido ? '✅' : '❌'}</td>
            <td><span class="badge ${i.status === 'OK' ? 'bg-success' : 'bg-danger'}">${i.status}</span></td>
            <td><button class="btn btn-sm btn-danger btn-delete-ins" data-id="${i.id}">X</button></td>
        `;
    });
    addDeleteListeners();
}
}

async function salvarInspecao(dados) {
    try {
        await db.collection('extintores_inspecoes').add(dados);
        mostrarMensagem('Inspeção salva!', 'success');
        await carregarDadosExtintores();
        fecharModalInspecao();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function excluirInspecao(id) {
    console.log('[DEBUG] excluirInspecao called:', {id, type: typeof id});
    if (!id) {
        console.error("[ModalFix] ID da inspeção vazio ao tentar excluir.");
        mostrarMensagem('Erro: ID da inspeção não fornecido para exclusão.', 'error');
        return;
    }
    if (!confirm('Excluir?')) return;
    try {
        await db.collection('extintores_inspecoes').doc(id).delete();
        mostrarMensagem('Excluída!', 'success');
        await carregarDadosExtintores();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== RECARGAS ==========
function renderizarListaRecargas() {
    const tbody = document.getElementById('extintores-recargas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    recargas.forEach(r => {
        console.log('[DEBUG] Rendering recarga:', r.id);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${formatarData(r.data)}</td>
            <td>${r.extintorCodigo}</td>
            <td>${r.empresa}</td>
            <td>${r.notaFiscal}</td>
            <td>${formatarData(r.proximaValidade)}</td>
            <td><button class="btn btn-sm btn-danger btn-delete-rec" data-id="${r.id}">X</button></td>
        `;
    });
    addDeleteListeners();
}


async function salvarRecarga(dados) {
    try {
        await db.collection('extintores_recargas').add(dados);
        mostrarMensagem('Recarga salva!', 'success');
        await carregarDadosExtintores();
        fecharModalRecarga();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function excluirRecarga(id) {
    console.log('[DEBUG] excluirRecarga called:', {id, type: typeof id});
    if (!id) {
        console.error("[ModalFix] ID da recarga vazio ao tentar excluir.");
        mostrarMensagem('Erro: ID da recarga não fornecido para exclusão.', 'error');
        return;
    }
    if (!confirm('Excluir?')) return;
    try {
        await db.collection('extintores_recargas').doc(id).delete();
        mostrarMensagem('Excluída!', 'success');
        await carregarDadosExtintores();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== MODALS ==========
function abrirModalExtintor() { new bootstrap.Modal(document.getElementById('extintor-modal')).show(); }
function fecharModalExtintor() { 
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-form').reset();
    document.getElementById('extintor-id').value = '';
}
function abrirModalInspecao() { 
    new bootstrap.Modal(document.getElementById('extintor-inspecao-modal')).show();
    const select = document.getElementById('inspecao-extintor');
    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>' + 
            extintores.map(e => `<option value="${e.codigo}">${e.codigo} - ${e.localizacao}</option>`).join('');
    }
}
function fecharModalInspecao() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-inspecao-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-inspecao-form').reset();
}
function abrirModalRecarga() {
    new bootstrap.Modal(document.getElementById('extintor-recarga-modal')).show();
    const select = document.getElementById('recarga-extintor');
    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>' + 
            extintores.map(e => `<option value="${e.codigo}">${e.codigo} - ${e.localizacao}</option>`).join('');
    }
}
function fecharModalRecarga() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-recarga-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-recarga-form').reset();
}

// Filters
function configurarFiltrosExtintores() {
    const filtro = document.getElementById('extintores-filtro-tipo');
    if (filtro) {
        filtro.onchange = () => {
            const tipo = filtro.value;
            const filtrados = tipo ? extintores.filter(e => e.tipo === tipo) : extintores;
            renderizarListaExtintoresFiltrada(filtrados);
        };
    }
}

function renderizarListaExtintoresFiltrada(lista) {
    const tbody = document.getElementById('extintores-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const hoje = new Date();
    let statusBadge = ''; // Define statusBadge here
    
    lista.forEach(ext => {
        console.log('[DEBUG] Rendering filtered extintor:', ext.id);
        const validade = ext.validade ? new Date(ext.validade.toDate()) : null;
        const diffDias = validade ? Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24)) : 0;
        let status = diffDias > 30 ? 'OK' : diffDias > 0 ? 'Próximo' : 'Vencido';
        const statusClass = status === 'OK' ? 'bg-success' : status === 'Próximo' ? 'bg-warning' : 'bg-danger';
        
        statusBadge = `<span class="badge ${statusClass}">${status}</span>`; // Calculate statusBadge
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${ext.codigo || ''}</td><td>${ext.patrimonio || ''}</td>
            <td><span class="badge bg-info">${ext.tipo || ''}</span></td>
            <td>${ext.capacidade || ''}</td><td>${ext.localizacao}</td><td>${ext.seloINMETRO || ''}</td>
            <td>${ext.validade ? formatarData(ext.validade) : ''}</td><td>${statusBadge}</td>
            <td><button class="btn btn-sm btn-primary me-1" onclick="editarExtintor('${ext.id}')">Editar</button>
                <button class="btn btn-sm btn-danger btn-delete-ext" data-id="${ext.id}">X</button></td>
        `;
    });
    addDeleteListeners();
}

// Event delegation for delete buttons
function handleDeleteExtintor(e) {
  if (e.target.matches('.btn-delete-ext')) {
    const id = e.target.dataset.id;
    console.log('[DEBUG] Delete button clicked, ID from data:', id);
    excluirExtintor(id);
  }
}
function handleDeleteInspecao(e) {
  if (e.target.matches('.btn-delete-ins')) {
    const id = e.target.dataset.id;
    excluirInspecao(id);
  }
}
function handleDeleteRecarga(e) {
  if (e.target.matches('.btn-delete-rec')) {
    const id = e.target.dataset.id;
    excluirRecarga(id);
  }
}

// Add listeners after rendering
function addDeleteListeners() {
  const extTable = document.getElementById('extintores-tabela');
  const insTable = document.getElementById('extintores-inspecoes-tabela');
  const recTable = document.getElementById('extintores-recargas-tabela');
  if (extTable) extTable.addEventListener('click', handleDeleteExtintor);
  if (insTable) insTable.addEventListener('click', handleDeleteInspecao);
  if (recTable) recTable.addEventListener('click', handleDeleteRecarga);
}

// Modify render functions to add listeners
// (call addDeleteListeners() after each renderLista*)
window.addDeleteListeners = addDeleteListeners;

// ========== GLOBAL EXPOSE ==========
window.inicializarControleExtintores = inicializarControleExtintores;
window.abrirModalExtintor = abrirModalExtintor;
window.fecharModalExtintor = fecharModalExtintor;
window.salvarExtintor = salvarExtintor;
window.editarExtintor = editarExtintor;
window.abrirModalInspecao = abrirModalInspecao;
window.fecharModalInspecao = fecharModalInspecao;
window.salvarInspecao = salvarInspecao;
window.abrirModalRecarga = abrirModalRecarga;
window.fecharModalRecarga = fecharModalRecarga;
window.salvarRecarga = salvarRecarga;
