// =================================================================
// Sistema de Controle de Extintores
// =================================================================

let extintores = [];
let inspecoes = [];
let recargas = [];
let chartExtintoresStatus = null;
let chartExtintoresTipo = null;
let mapExtintores = null;

// Inicializar sistema
async function inicializarControleExtintores() {
    console.log("Inicializando Controle de Extintores...");
    
    // Configurar abas
    const tabs = document.querySelectorAll('#extintores-tabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(() => carregarDadosExtintoresPorAba(tab.dataset.tab), 100);
        });
    });
    
    await carregarDadosExtintores();
    verificarAlertasExtintores();
    configurarFiltrosExtintores();
}

async function carregarDadosExtintores() {
    try {
        // Carregar extintores
        const extintoresSnap = await db.collection('extintores').get();
        extintores = extintoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar inspeções
        const inspecoesSnap = await db.collection('extintores_inspecoes').orderBy('data', 'desc').get();
        inspecoes = inspecoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar recargas
        const recargasSnap = await db.collection('extintores_recargas').orderBy('data', 'desc').get();
        recargas = recargasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Renderizar
        renderizarDashboardExtintores();
        renderizarListaExtintores();
        renderizarListaInspecoes();
        renderizarListaRecargas();
        
    } catch (error) {
        console.error("Erro ao carregar dados de extintores:", error);
    }
}

async function carregarDadosExtintoresPorAba(aba) {
    await carregarDadosExtintores();
}

// ========== DASHBOARD ==========

function renderizarDashboardExtintores() {
    const total = extintores.length;
    const hoje = new Date();
    const dias30 = 30 * 24 * 60 * 60 * 1000;
    
    // Contagem por status
    let validos = 0;
    let proximoVencimento = 0;
    let vencidos = 0;
    
    extintores.forEach(ext => {
        if (!ext.validade) {
            validos++;
        } else {
            const validade = ext.validade.toDate ? ext.validade.toDate() : new Date(ext.validade);
            const diffMs = validade - hoje;
            const diffDias = diffMs / (1000 * 60 * 60 * 24);
            
            if (diffDias < 0) {
                vencidos++;
            } else if (diffDias <= 30) {
                proximoVencimento++;
            } else {
                validos++;
            }
        }
    });
    
    const conformidade = total > 0 ? ((validos / total) * 100).toFixed(1) : 0;
    
    // KPIs
    atualizarElementoExtintor('kpi-extintores-total', total);
    atualizarElementoExtintor('kpi-extintores-validos', validos);
    atualizarElementoExtintor('kpi-extintores-proximo', proximoVencimento);
    atualizarElementoExtintor('kpi-extintores-vencidos', vencidos);
    atualizarElementoExtintor('kpi-extintores-conformidade', conformidade + '%');
    
    // Gráficos
    renderizarGraficoStatusExtintores();
    renderizarGraficoTipoExtintores();
}

function atualizarElementoExtintor(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function renderizarGraficoStatusExtintores() {
    const ctx = document.getElementById('chart-extintores-status')?.getContext('2d');
    if (!ctx) return;
    
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
    
    if (chartExtintoresStatus) chartExtintoresStatus.destroy();
    
    chartExtintoresStatus = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Válidos', 'Próximo Vencimento', 'Vencidos'],
            datasets: [{
                data: [validos, proximo, vencidos],
                backgroundColor: ['#198754', '#ffc107', '#dc3545']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderizarGraficoTipoExtintores() {
    const ctx = document.getElementById('chart-extintores-tipo')?.getContext('2d');
    if (!ctx) return;
    
    const porTipo = {};
    extintores.forEach(ext => {
        const tipo = ext.tipo || 'Outros';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    
    if (chartExtintoresTipo) chartExtintoresTipo.destroy();
    
    chartExtintoresTipo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{
                label: 'Quantidade',
                data: Object.values(porTipo),
                backgroundColor: ['#0d6efd', '#dc3545', '#ffc107', '#198754']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Alertas
function verificarAlertasExtintores() {
    const hoje = new Date();
    const diasAlerta = 30;
    const container = document.getElementById('extintores-alertas');
    
    if (!container) return;
    
    const alertas = [];
    
    // Extintores vencidos
    const vencidos = extintores.filter(e => {
        if (!e.validade) return false;
        const validade = e.validade.toDate ? e.validade.toDate() : new Date(e.validade);
        return validade < hoje;
    });
    
    if (vencidos.length > 0) {
        alertas.push(`<strong>Extintores vencidos:</strong> ${vencidos.length} extintor(es) com validade expirada!`);
    }
    
    // Próximos do vencimento
    const proximo = extintores.filter(e => {
        if (!e.validade) return false;
        const validade = e.validade.toDate ? e.validade.toDate() : new Date(e.validade);
        const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return diffDias > 0 && diffDias <= diasAlerta;
    });
    
    if (proximo.length > 0) {
        alertas.push(`<strong>Extintores próximos do vencimento:</strong> ${proximo.length} extintor(es) vencem em menos de 30 dias.`);
    }
    
    if (alertas.length > 0) {
        container.classList.remove('d-none');
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${alertas.join('<br>')}
            </div>
        `;
    } else {
        container.classList.add('d-none');
    }
}

// ========== MÓDULO 1: EXTINTORES ==========

function renderizarListaExtintores() {
    const tbody = document.getElementById('extintores-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const hoje = new Date();
    
    extintores.forEach(ext => {
        let statusBadge = '<span class="badge bg-secondary">Sem validade</span>';
        
        if (ext.validade) {
            const validade = ext.validade.toDate ? ext.validade.toDate() : new Date(ext.validade);
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) {
                statusBadge = '<span class="badge bg-danger">Vencido</span>';
            } else if (diffDias <= 30) {
                statusBadge = '<span class="badge bg-warning">Próximo</span>';
            } else {
                statusBadge = '<span class="badge bg-success">OK</span>';
            }
        }
        
        const tipoBadge = getTipoExtintorBadge(ext.tipo);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ext.codigo || '-'}</td>
            <td>${ext.patrimonio || '-'}</td>
            <td>${tipoBadge}</td>
            <td>${ext.capacidade || '-'}</td>
            <td>${ext.localizacao || '-'}</td>
            <td>${ext.seloINMETRO || '-'}</td>
            <td>${ext.validade ? formatarData(ext.validade) : '-'}</td>
            <td>${ext.proximaInspecao ? formatarData(ext.proximaInspecao) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarExtintor('${ext.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirExtintor('${ext.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getTipoExtintorBadge(tipo) {
    const cores = {
        'Água': 'bg-primary',
        'Pó Químico': 'bg-danger',
        'CO₂': 'bg-dark',
        'Espuma': 'bg-info'
    };
    return `<span class="badge ${cores[tipo] || 'bg-secondary'}">${tipo || 'Não especificado'}</span>`;
}

async function salvarExtintor(dados) {
    try {
        if (dados.id) {
            await db.collection('extintores').doc(dados.id).update(dados);
            mostrarMensagem('Extintor atualizado com sucesso!', 'success');
        } else {
            await db.collection('extintores').add(dados);
            mostrarMensagem('Extintor cadastrado com sucesso!', 'success');
        }
        
        await carregarDadosExtintores();
        fecharModalExtintor();
    } catch (error) {
        console.error("Erro ao salvar extintor:", error);
        mostrarMensagem('Erro ao salvar extintor: ' + error.message, 'error');
    }
}

async function editarExtintor(id) {
    const extintor = extintores.find(e => e.id === id);
    if (!extintor) return;
    
    document.getElementById('extintor-id').value = extintor.id;
    document.getElementById('extintor-codigo').value = extintor.codigo || '';
    document.getElementById('extintor-patrimonio').value = extintor.patrimonio || '';
    document.getElementById('extintor-tipo').value = extintor.tipo || 'Água';
    document.getElementById('extintor-capacidade').value = extintor.capacidade || '';
    document.getElementById('extintor-localizacao').value = extintor.localizacao || '';
    document.getElementById('extintor-selo').value = extintor.seloINMETRO || '';
    document.getElementById('extintor-validade').value = extintor.validade ? new Date(extintor.validade.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('extintor-inspecao').value = extintor.proximaInspecao ? new Date(extintor.proximaInspecao.toDate()).toISOString().split('T')[0] : '';
    
    abrirModalExtintor();
}

async function excluirExtintor(id) {
    if (!confirm('Tem certeza que deseja excluir este extintor?')) return;
    
    try {
        await db.collection('extintores').doc(id).delete();
        mostrarMensagem('Extintor excluído com sucesso!', 'success');
        await carregarDadosExtintores();
    } catch (error) {
        console.error("Erro ao excluir extintor:", error);
        mostrarMensagem('Erro ao excluir extintor!', 'error');
    }
}

function abrirModalExtintor() {
    const modal = new bootstrap.Modal(document.getElementById('extintor-modal'));
    modal.show();
}

function fecharModalExtintor() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-form').reset();
    document.getElementById('extintor-id').value = '';
}

// ========== MÓDULO 2: INSPEÇÕES ==========

function renderizarListaInspecoes() {
    const tbody = document.getElementById('extintores-inspecoes-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    inspecoes.forEach(inspecao => {
        const data = inspecao.data?.toDate ? inspecao.data.toDate() : new Date(inspecao.data);
        
        const statusBadge = inspecao.status === 'OK'
            ? '<span class="badge bg-success">OK</span>'
            : '<span class="badge bg-danger">Necessita Manutenção</span>';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(data)}</td>
            <td>${inspecao.extintorCodigo || '-'}</td>
            <td>${inspecao.lacre ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td>${inspecao.manometro ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td>${inspecao.semDanos ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td>${inspecao.localDesobstruido ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirInspecao('${inspecao.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarInspecao(dados) {
    try {
        await db.collection('extintores_inspecoes').add(dados);
        mostrarMensagem('Inspeção registrada com sucesso!', 'success');
        
        await carregarDadosExtintores();
        fecharModalInspecao();
    } catch (error) {
        console.error("Erro ao salvar inspeção:", error);
        mostrarMensagem('Erro ao salvar inspeção: ' + error.message, 'error');
    }
}

async function excluirInspecao(id) {
    if (!confirm('Tem certeza que deseja excluir esta inspeção?')) return;
    
    try {
        await db.collection('extintores_inspecoes').doc(id).delete();
        mostrarMensagem('Inspeção excluída com sucesso!', 'success');
        await carregarDadosExtintores();
    } catch (error) {
        console.error("Erro ao excluir inspeção:", error);
        mostrarMensagem('Erro ao excluir inspeção!', 'error');
    }
}

function abrirModalInspecao() {
    const modal = new bootstrap.Modal(document.getElementById('extintor-inspecao-modal'));
    modal.show();
    
    // Preencher select de extintores
    const select = document.getElementById('inspecao-extintor');
    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>';
        extintores.forEach(ext => {
            const opt = document.createElement('option');
            opt.value = ext.codigo;
            opt.textContent = `${ext.codigo} - ${ext.localizacao}`;
            select.appendChild(opt);
        });
    }
}

function fecharModalInspecao() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-inspecao-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-inspecao-form').reset();
}

// ========== MÓDULO 3: RECARGAS ==========

function renderizarListaRecargas() {
    const tbody = document.getElementById('extintores-recargas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    recargas.forEach(recarga => {
        const data = recarga.data?.toDate ? recarga.data.toDate() : new Date(recarga.data);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(data)}</td>
            <td>${recarga.extintorCodigo || '-'}</td>
            <td>${recarga.empresa || '-'}</td>
            <td>${recarga.notaFiscal || '-'}</td>
            <td>${recarga.proximaValidade ? formatarData(recarga.proximaValidade) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirRecarga('${recarga.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarRecarga(dados) {
    try {
        await db.collection('extintores_recargas').add(dados);
        mostrarMensagem('Recarga registrada com sucesso!', 'success');
        
        await carregarDadosExtintores();
        fecharModalRecarga();
    } catch (error) {
        console.error("Erro ao salvar recarga:", error);
        mostrarMensagem('Erro ao salvar recarga: ' + error.message, 'error');
    }
}

function abrirModalRecarga() {
    const modal = new bootstrap.Modal(document.getElementById('extintor-recarga-modal'));
    modal.show();
    
    // Preencher select de extintores
    const select = document.getElementById('recarga-extintor');
    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>';
        extintores.forEach(ext => {
            const opt = document.createElement('option');
            opt.value = ext.codigo;
            opt.textContent = `${ext.codigo} - ${ext.localizacao}`;
            select.appendChild(opt);
        });
    }
}

function fecharModalRecarga() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('extintor-recarga-modal'));
    if (modal) modal.hide();
    document.getElementById('extintor-recarga-form').reset();
}

// ========== CONFIGURAR FILTROS ==========

function configurarFiltrosExtintores() {
    const filtroTipo = document.getElementById('extintores-filtro-tipo');
    if (filtroTipo) {
        filtroTipo.addEventListener('change', () => {
            const tipo = filtroTipo.value;
            const filtrados = tipo ? extintores.filter(e => e.tipo === tipo) : extintores;
            renderizarListaExtintoresFiltrada(filtrados);
        });
    }
}

function renderizarListaExtintoresFiltrada(lista) {
    const tbody = document.getElementById('extintores-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const hoje = new Date();
    
    lista.forEach(ext => {
        let statusBadge = '<span class="badge bg-secondary">Sem validade</span>';
        
        if (ext.validade) {
            const validade = ext.validade.toDate ? ext.validade.toDate() : new Date(ext.validade);
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            
            if (diffDias < 0) statusBadge = '<span class="badge bg-danger">Vencido</span>';
            else if (diffDias <= 30) statusBadge = '<span class="badge bg-warning">Próximo</span>';
            else statusBadge = '<span class="badge bg-success">OK</span>';
        }
        
        const tipoBadge = getTipoExtintorBadge(ext.tipo);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ext.codigo || '-'}</td>
            <td>${ext.patrimonio || '-'}</td>
            <td>${tipoBadge}</td>
            <td>${ext.capacidade || '-'}</td>
            <td>${ext.localizacao || '-'}</td>
            <td>${ext.seloINMETRO || '-'}</td>
            <td>${ext.validade ? formatarData(ext.validade) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarExtintor('${ext.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirExtintor('${ext.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ========== EXPORTAR ==========

window.inicializarControleExtintores = inicializarControleExtintores;
window.carregarDadosExtintores = carregarDadosExtintores;
window.salvarExtintor = salvarExtintor;
window.editarExtintor = editarExtintor;
window.excluirExtintor = excluirExtintor;
window.salvarInspecao = salvarInspecao;
window.salvarRecarga = salvarRecarga;
window.abrirModalExtintor = abrirModalExtintor;
window.fecharModalExtintor = fecharModalExtintor;
window.abrirModalInspecao = abrirModalInspecao;
window.fecharModalInspecao = fecharModalInspecao;
window.abrirModalRecarga = abrirModalRecarga;
window.fecharModalRecarga = fecharModalRecarga;

