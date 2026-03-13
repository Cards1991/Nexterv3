// js/gestao-cipa.js - COMPLETE CIPA MODULE (NR-5)

// =================================================================
// Gestão Completa CIPA - Comissão Interna de Prevenção de Acidentes
// =================================================================

let cipaMembros = [];
let cipaEleicoes = [];
let cipaTreinamentos = [];
let cipaReunioes = [];
let cipaAcoes = [];
let draggedAcao = null;

// Inicializador principal (app.js)
async function inicializarGestaoCipa() {
    console.log("✅ Módulo CIPA inicializado completamente (NR-5).");
    
    await carregarDadosCipa();
    renderizarDashboardCipa();
    configurarKanbanCipa();
    configurarAbasCipa();
    verificarAlertasCipa();
}

// ========== CARREGAMENTO ==========
async function carregarDadosCipa() {
    try {
        cipaMembros = (await db.collection('cipa_membros').orderBy('nome').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        cipaEleicoes = (await db.collection('cipa_eleicoes').orderBy('ano', 'desc').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        cipaTreinamentos = (await db.collection('cipa_treinamentos').orderBy('dataCurso', 'desc').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        cipaReunioes = (await db.collection('cipa_reunioes').orderBy('data', 'desc').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        cipaAcoes = (await db.collection('cipa_acoes').orderBy('prazo').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        
        renderizarListaMembros();
        renderizarListaEleicoes();
        renderizarListaTreinamentos();
        renderizarListaReunioes();
        renderizarKanbanAcoes();
        
    } catch (error) {
        console.error("Erro CIPA:", error);
        mostrarMensagem('Erro carregando CIPA: ' + error.message, 'error');
    }
}

// ========== DASHBOARD ==========
function renderizarDashboardCipa() {
    atualizarElemento('kpi-cipa-membros', cipaMembros.length);
    atualizarElemento('kpi-cipa-titulares', cipaMembros.filter(m => m.tipo === 'Titular').length);
    atualizarElemento('kpi-cipa-suplentes', cipaMembros.filter(m => m.tipo === 'Suplente').length);
    atualizarElemento('kpi-cipa-reunioes', cipaReunioes.length);
    
    const pendentes = cipaAcoes.filter(a => a.status === 'Pendente').length;
    const andamento = cipaAcoes.filter(a => a.status === 'Em Andamento').length;
    atualizarElemento('kpi-cipa-acoes-pendentes', pendentes);
    atualizarElemento('kpi-cipa-acoes-andamento', andamento);
    atualizarElemento('kpi-cipa-acoes-concluidas', cipaAcoes.filter(a => a.status === 'Concluído').length);
    
    renderizarChartAcoesCipa();
}

function renderizarChartAcoesCipa() {
    const ctx = document.getElementById('chart-cipa-acoes')?.getContext('2d');
    if (!ctx) return;
    
    const statusCount = {};
    cipaAcoes.forEach(a => {
        statusCount[a.status] = (statusCount[a.status] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCount),
            datasets: [{ 
                data: Object.values(statusCount), 
                backgroundColor: ['#ffc107', '#0d6efd', '#198754']
            }]
        },
        options: { responsive: true }
    });
}

// ========== MEMBROS CRUD ==========
function renderizarListaMembros() {
    const tbody = document.getElementById('cipa-membros-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cipaMembros.forEach(m => {
        const statusBadge = m.status === 'Ativo' ? 'bg-success' : 'bg-secondary';
        const mandatoStatus = m.dataFimMandato && new Date(m.dataFimMandato.toDate()) < new Date() ? 'bg-danger' : 'bg-info';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${m.nome}</td>
            <td>${m.matricula || '-'}</td>
            <td>${m.setor || '-'}</td>
            <td>${m.cargo || '-'}</td>
            <td><span class="badge bg-primary">${m.tipo}</span></td>
            <td>${formatarData(m.dataInicioMandato)}</td>
            <td>${formatarData(m.dataFimMandato)}</td>
            <td><span class="badge ${statusBadge}">${m.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarMembroCipa('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirMembroCipa('${m.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarMembroCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_membros').doc(dados.id).update(dados);
        } else {
            await db.collection('cipa_membros').add(dados);
        }
        mostrarMensagem('Membro salvo!', 'success');
        await carregarDadosCipa();
        fecharModalMembroCipa();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function editarMembroCipa(id) {
    const membro = cipaMembros.find(m => m.id === id);
    if (!membro) return;
    
    document.getElementById('cipa-membro-id').value = membro.id;
    document.getElementById('cipa-membro-nome').value = membro.nome || '';
    document.getElementById('cipa-membro-matricula').value = membro.matricula || '';
    document.getElementById('cipa-membro-setor').value = membro.setor || '';
    document.getElementById('cipa-membro-cargo').value = membro.cargo || '';
    document.getElementById('cipa-membro-tipo').value = membro.tipo || '';
    document.getElementById('cipa-membro-inicio').value = membro.dataInicioMandato ? new Date(membro.dataInicioMandato.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-membro-fim').value = membro.dataFimMandato ? new Date(membro.dataFimMandato.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-membro-status').value = membro.status || '';
    
    abrirModalMembroCipa();
}

async function excluirMembroCipa(id) {
    if (confirm('Excluir membro da CIPA?')) {
        await db.collection('cipa_membros').doc(id).delete();
        mostrarMensagem('Membro excluído!', 'success');
        await carregarDadosCipa();
    }
}

function abrirModalCipa() {
    document.getElementById('cipa-membro-id').value = '';
    document.getElementById('cipa-membro-form').reset();
    const modal = new bootstrap.Modal(document.getElementById('cipa-membro-modal'));
    modal.show();
}

function fecharModalMembroCipa() {
    bootstrap.Modal.getInstance(document.getElementById('cipa-membro-modal'))?.hide();
}

// ========== KANBAN AÇÕES (Drag & Drop) ==========
function renderizarKanbanAcoes() {
    const pendente = document.getElementById('kanban-pendente');
    const andamento = document.getElementById('kanban-andamento'); 
    const concluido = document.getElementById('kanban-concluido');
    
    if (!pendente || !andamento || !concluido) return;
    
    pendente.innerHTML = cipaAcoes.filter(a => a.status === 'Pendente').map(a => criarCardAcao(a)).join('');
    andamento.innerHTML = cipaAcoes.filter(a => a.status === 'Em Andamento').map(a => criarCardAcao(a)).join('');
    concluido.innerHTML = cipaAcoes.filter(a => a.status === 'Concluído').map(a => criarCardAcao(a)).join('');
}

function criarCardAcao(acao) {
    const prioridadeBadge = acao.prioridade === 'Alta' ? 'bg-danger' : acao.prioridade === 'Média' ? 'bg-warning' : 'bg-success';
    const prazo = acao.prazo ? formatarData(acao.prazo) : '';
    
    return `
        <div class="card mb-2 acao-card" draggable="true" data-id="${acao.id}" data-status="${acao.status}">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between">
                    <h6 class="card-title mb-1">${acao.titulo}</h6>
                    <span class="badge ${prioridadeBadge}">${acao.prioridade}</span>
                </div>
                <small class="text-muted">${acao.setor} - ${acao.responsavel}</small>
                ${prazo ? `<div class="mt-1"><small class="text-danger">Prazo: ${prazo}</small></div>` : ''}
            </div>
        </div>
    `;
}

function configurarKanbanCipa() {
    document.addEventListener('dragstart', e => {
        if (e.target.classList.contains('acao-card')) {
            draggedAcao = e.target.dataset.id;
            e.target.style.opacity = '0.5';
        }
    });
    
    document.addEventListener('dragend', e => {
        if (e.target.classList.contains('acao-card')) {
            e.target.style.opacity = '1';
        }
    });
    
    ['kanban-pendente', 'kanban-andamento', 'kanban-concluido'].forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.addEventListener('dragover', e => e.preventDefault());
            container.addEventListener('drop', async e => {
                e.preventDefault();
                if (draggedAcao) {
                    const novoStatus = id === 'kanban-pendente' ? 'Pendente' : 
                                    id === 'kanban-andamento' ? 'Em Andamento' : 'Concluído';
                    await db.collection('cipa_acoes').doc(draggedAcao).update({ status: novoStatus });
                    mostrarMensagem(`Ação movida para ${novoStatus}!`, 'success');
                    await carregarDadosCipa();
                }
            });
        }
    });
}

async function salvarAcaoCipa(dados) {
    try {
        await db.collection('cipa_acoes').add(dados);
        mostrarMensagem('Ação criada!', 'success');
        await carregarDadosCipa();
        document.getElementById('cipa-acao-modal').querySelector('.btn-close').click();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== OUTRAS LISTAS (Simplified CRUD) ==========
function renderizarListaEleicoes() {
    const tbody = document.getElementById('cipa-eleicoes-tabela');
    if (tbody) tbody.innerHTML = cipaEleicoes.map(e => `<tr><td>${formatarData(e.dataAbertura)}</td><td>${e.ano}</td><td>${e.editalPublicado ? 'Sim' : 'Não'}</td><td>${e.totalCandidatos || 0}</td><td><span class="badge bg-info">${e.status}</span></td></tr>`).join('') || '<tr><td colspan="6" class="text-center">Nenhum registro</td></tr>';
}

function renderizarListaTreinamentos() {
    const tbody = document.getElementById('cipa-treinamentos-tabela');
    if (tbody) tbody.innerHTML = cipaTreinamentos.map(t => `<tr><td>${t.participante}</td><td>${t.curso}</td><td>${t.cargaHoraria}h</td><td>${t.instrutor}</td><td>${formatarData(t.dataCurso)}</td><td>${formatarData(t.validade)}</td></tr>`).join('') || '<tr><td colspan="8" class="text-center">Nenhum registro</td></tr>';
}

function renderizarListaReunioes() {
    const tbody = document.getElementById('cipa-reunioes-tabela');
    if (tbody) tbody.innerHTML = cipaReunioes.map(r => `<tr><td>${formatarData(r.data)}</td><td>${r.pauta?.slice(0,50)}...</td><td>${r.participantes?.length || 0}</td><td>${r.ata ? 'Sim' : 'Não'}</td><td>${r.planoAcao ? 'Sim' : 'Não'}</td></tr>`).join('') || '<tr><td colspan="6" class="text-center">Nenhum registro</td></tr>';
}

// ========== UTILITÁRIOS ==========
function configurarAbasCipa() {
    document.querySelectorAll('#cipa-tabs .nav-link').forEach(tab => {
        tab.addEventListener('click', () => setTimeout(carregarDadosCipa, 100));
    });
}

function verificarAlertasCipa() {
    const hoje = new Date();
    const container = document.getElementById('cipa-alertas-mandato');
    
    const mandatosVencidos = cipaMembros.filter(m => m.dataFimMandato && new Date(m.dataFimMandato.toDate()) < hoje);
    
    if (mandatosVencidos.length > 0 && container) {
        container.classList.remove('d-none');
        container.innerHTML = `<div class="alert alert-warning">${mandatosVencidos.length} mandato(s) vencido(s)!</div>`;
    }
}

// ========== GLOBAL EXPOSE ==========
window.inicializarGestaoCipa = inicializarGestaoCipa;
window.abrirModalCipa = abrirModalCipa;
window.salvarMembroCipa = salvarMembroCipa;
window.editarMembroCipa = editarMembroCipa;
window.excluirMembroCipa = excluirMembroCipa;
window.salvarAcaoCipa = salvarAcaoCipa;

// Placeholder functions for HTML onclick (matching views/gestao-cipa.html)
window.salvarEleicaoCipa = async (dados) => {
    try {
        await db.collection('cipa_eleicoes').add(dados);
        mostrarMensagem('Eleição salva!', 'success');
        await carregarDadosCipa();
        bootstrap.Modal.getInstance(document.getElementById('cipa-eleicao-modal'))?.hide();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
};

window.salvarTreinamentoCipa = async (dados) => {
    try {
        await db.collection('cipa_treinamentos').add(dados);
        mostrarMensagem('Treinamento salvo!', 'success');
        await carregarDadosCipa();
        bootstrap.Modal.getInstance(document.getElementById('cipa-treinamento-modal'))?.hide();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
};

window.salvarReuniaoCipa = async (dados) => {
    try {
        await db.collection('cipa_reunioes').add(dados);
        mostrarMensagem('Reunião salva!', 'success');
        await carregarDadosCipa();
        bootstrap.Modal.getInstance(document.getElementById('cipa-reuniao-modal'))?.hide();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
};

window.abrirModalEleicaoCipa = () => {
    const modal = new bootstrap.Modal(document.getElementById('cipa-eleicao-modal'));
    modal.show();
};

window.abrirModalTreinamentoCipa = () => {
    const modal = new bootstrap.Modal(document.getElementById('cipa-treinamento-modal'));
    modal.show();
};

window.abrirModalReuniaoCipa = () => {
    const modal = new bootstrap.Modal(document.getElementById('cipa-reuniao-modal'));
    modal.show();
};

window.fecharModalMembroCipa = fecharModalMembroCipa;

// Fix final missing onclick for CIPA Ações tab
window.abrirModalAcaoCipa = () => {
    document.getElementById('cipa-acao-id').value = '';
    document.getElementById('cipa-acao-form').reset();
    const modal = new bootstrap.Modal(document.getElementById('cipa-acao-modal'));
    modal.show();
};

window.editarAcaoCipa = async (id) => {
    const acao = cipaAcoes.find(a => a.id === id);
    if (!acao) return;
    
    document.getElementById('cipa-acao-id').value = acao.id;
    document.getElementById('cipa-acao-titulo').value = acao.titulo || '';
    document.getElementById('cipa-acao-setor').value = acao.setor || '';
    document.getElementById('cipa-acao-risco').value = acao.risco || '';
    document.getElementById('cipa-acao-responsavel').value = acao.responsavel || '';
    document.getElementById('cipa-acao-prazo').value = acao.prazo ? new Date(acao.prazo.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-acao-status').value = acao.status || 'Pendente';
    document.getElementById('cipa-acao-prioridade').value = acao.prioridade || 'Média';
    document.getElementById('cipa-acao-descricao').value = acao.descricao || '';
    
    const modal = new bootstrap.Modal(document.getElementById('cipa-acao-modal'));
    modal.show();
};

window.excluirAcaoCipa = async (id) => {
    if (confirm('Excluir ação?')) {
        await db.collection('cipa_acoes').doc(id).delete();
        mostrarMensagem('Ação excluída!', 'success');
        await carregarDadosCipa();
    }
};
