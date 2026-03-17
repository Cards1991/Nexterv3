// js/brigada-incendio.js - COMPLETE & FIXED (No TS syntax errors)

// =================================================================
// Módulo Completo Brigada de Incêndio (NR-23)
// =================================================================

let brigadistas = [];
let simulados = [];
let ocorrencias = [];

// Inicializador principal (called by app.js)
async function inicializarBrigadaIncendio() {
    console.log("✅ Módulo Brigada de Incêndio inicializado completamente (NR-23).");
    
    await carregarDadosBrigada();
    renderizarDashboardBrigada();
    configurarAbasBrigada();
    configurarFiltrosBrigada();
    verificarAlertasBrigada();
}

// ========== CARREGAMENTO DE DADOS ==========
async function carregarDadosBrigada() {
    try {
        const brigadistasSnap = await db.collection('brigada_brigadistas').orderBy('nome').get();
        brigadistas = brigadistasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const simuladosSnap = await db.collection('brigada_simulados').orderBy('data', 'desc').get();
        simulados = simuladosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const ocorrenciasSnap = await db.collection('brigada_ocorrencias').orderBy('data', 'desc').get();
        ocorrencias = ocorrenciasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        renderizarListaBrigadistas();
        renderizarListaSimulados();
        renderizarListaOcorrencias();
        renderizarEscalaTurnos();
        
    } catch (error) {
        console.error("Erro carregando brigada:", error);
        mostrarMensagem('Erro ao carregar dados da brigada: ' + error.message, 'error');
    }
}

// ========== DASHBOARD KPIs ==========
function renderizarDashboardBrigada() {
    const hoje = new Date();
    
    atualizarElemento('kpi-brigada-total', brigadistas.length);
    atualizarElemento('kpi-brigada-ativos', brigadistas.filter(b => b.status === 'Ativo').length);
    
    const cursosValidos = brigadistas.filter(b => {
        if (!b.validadeCurso) return false;
        const validade = b.validadeCurso.toDate ? b.validadeCurso.toDate() : new Date(b.validadeCurso);
        return validade > hoje;
    }).length;
    atualizarElemento('kpi-brigada-curso-valido', cursosValidos);
    
    const porFuncao = {};
    brigadistas.forEach(b => {
        const f = b.funcao || 'Outro';
        porFuncao[f] = (porFuncao[f] || 0) + 1;
    });
    atualizarElemento('kpi-brigada-lider', porFuncao['Líder'] || 0);
    atualizarElemento('kpi-brigada-abandono', porFuncao['Abandono'] || 0);
    atualizarElemento('kpi-brigada-combate', porFuncao['Combate'] || 0);
    atualizarElemento('kpi-brigada-socorros', porFuncao['Primeiros Socorros'] || porFuncao['1º Socorros'] || 0);
    
    renderizarGraficoSimulados();
    renderizarGraficoOcorrencias();
}

function atualizarElemento(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function renderizarGraficoSimulados() {
    const ctx = document.getElementById('chart-brigada-simulados');
    if (!ctx) return;
    
    const porTipo = {};
    simulados.forEach(s => {
        const tipo = s.tipo || 'Outro';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{ data: Object.values(porTipo), backgroundColor: ['#0d6efd', '#ffc107', '#dc3545', '#198754'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderizarGraficoOcorrencias() {
    const ctx = document.getElementById('chart-brigada-ocorrencias');
    if (!ctx) return;
    
    const porTipo = {};
    ocorrencias.forEach(o => {
        const tipo = o.tipo || 'Outro';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{ label: 'Ocorrências', data: Object.values(porTipo), backgroundColor: '#dc3545' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ========== BRIGADISTAS CRUD ==========
function renderizarListaBrigadistas() {
    const tbody = document.getElementById('brigada-brigadistas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const hoje = new Date();
    
    brigadistas.forEach(b => {
        const statusBadge = b.status === 'Ativo' ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>';
        const cursoStatus = b.validadeCurso ? 
            (new Date(b.validadeCurso.toDate()) > hoje ? '<span class="badge bg-success">Válido</span>' : '<span class="badge bg-danger">Vencido</span>') : 
            '<span class="badge bg-warning">Pendente</span>';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${b.nome || '-'}</td>
            <td>${b.setor || '-'}</td>
            <td>${b.turno || '-'}</td>
            <td><span class="badge bg-info">${b.funcao || '-'}</span></td>
            <td>${b.dataCurso ? formatarData(b.dataCurso) : '-'}</td>
            <td>${b.validadeCurso ? formatarData(b.validadeCurso) : '-'}</td>
            <td>${cursoStatus}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarBrigadista('${b.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirBrigadista('${b.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarBrigadista(dados) {
    try {
        // Se dados não foi passado (chamada via onclick), coleta do formulário
        if (!dados || typeof dados !== 'object') {
            dados = {
                id: document.getElementById('brigada-brigadista-id')?.value || null,
                nome: document.getElementById('brigada-brigadista-nome')?.value,
                setor: document.getElementById('brigada-brigadista-setor')?.value,
                turno: document.getElementById('brigada-brigadista-turno')?.value,
                funcao: document.getElementById('brigada-brigadista-funcao')?.value,
                dataCurso: document.getElementById('brigada-brigadista-curso-data')?.value ? new Date(document.getElementById('brigada-brigadista-curso-data').value) : null,
                validadeCurso: document.getElementById('brigada-brigadista-curso-validade')?.value ? new Date(document.getElementById('brigada-brigadista-curso-validade').value) : null,
                status: document.getElementById('brigada-brigadista-status')?.value
            };
        }

        if (dados.id) {
            await db.collection('brigada_brigadistas').doc(dados.id).update(dados);
            mostrarMensagem('Brigadista atualizado!', 'success');
        } else {
            await db.collection('brigada_brigadistas').add(dados);
            mostrarMensagem('Brigadista cadastrado!', 'success');
        }
        await carregarDadosBrigada();
        fecharModalBrigadista();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function editarBrigadista(id) {
    const brigadista = brigadistas.find(b => b.id === id);
    if (!brigadista) return;
    
    document.getElementById('brigada-brigadista-id').value = brigadista.id;
    document.getElementById('brigada-brigadista-nome').value = brigadista.nome || '';
    document.getElementById('brigada-brigadista-setor').value = brigadista.setor || '';
    document.getElementById('brigada-brigadista-turno').value = brigadista.turno || '';
    document.getElementById('brigada-brigadista-funcao').value = brigadista.funcao || '';
    document.getElementById('brigada-brigadista-curso-data').value = brigadista.dataCurso ? new Date(brigadista.dataCurso.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('brigada-brigadista-curso-validade').value = brigadista.validadeCurso ? new Date(brigadista.validadeCurso.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('brigada-brigadista-status').value = brigadista.status || 'Ativo';
    
    abrirModalBrigadista();
}

async function excluirBrigadista(id) {
    if (!confirm('Excluir brigadista?')) return;
    try {
        await db.collection('brigada_brigadistas').doc(id).delete();
        mostrarMensagem('Brigadista excluído!', 'success');
        await carregarDadosBrigada();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== MODAL BRIGADISTA ==========
function abrirModalBrigadista() {
    const modal = new bootstrap.Modal(document.getElementById('brigada-brigadista-modal'));
    modal.show();
}

function fecharModalBrigadista() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('brigada-brigadista-modal'));
    if (modal) modal.hide();
    const form = document.getElementById('brigada-brigadista-form');
    if (form) form.reset();
    document.getElementById('brigada-brigadista-id').value = '';
}

// ========== SIMULADOS ==========
function renderizarListaSimulados() {
    const tbody = document.getElementById('brigada-simulados-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    simulados.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(s.data)}</td>
            <td><span class="badge bg-info">${s.tipo}</span></td>
            <td>${s.tempoEvacuacao || 0} min</td>
            <td><span class="badge ${s.avaliacao === 'Excelente' ? 'bg-success' : s.avaliacao === 'Ruim' ? 'bg-danger' : 'bg-warning'}">${s.avaliacao}</span></td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="excluirSimulado('${s.id}')"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarSimulado(dados) {
    try {
        // Coleta dados do formulário se não forem passados
        if (!dados || typeof dados !== 'object') {
            const dataStr = document.getElementById('brigada-simulado-data')?.value;
            dados = {
                data: dataStr ? new Date(dataStr + 'T00:00:00') : new Date(),
                tipo: document.getElementById('brigada-simulado-tipo')?.value,
                tempoEvacuacao: document.getElementById('brigada-simulado-tempo')?.value,
                avaliacao: document.getElementById('brigada-simulado-avaliacao')?.value,
                observacoes: document.getElementById('brigada-simulado-obs')?.value || ''
            };
        }

        await db.collection('brigada_simulados').add(dados);
        mostrarMensagem('Simulado registrado!', 'success');
        await carregarDadosBrigada();
        const modal = document.getElementById('brigada-simulado-modal');
        if (modal) modal.querySelector('.btn-close').click();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== ESCALA ==========
function renderizarEscalaTurnos() {
    const manha = brigadistas.filter(b => b.turno === 'Manhã' && b.status === 'Ativo');
    const tarde = brigadistas.filter(b => b.turno === 'Tarde' && b.status === 'Ativo');  
    const noite = brigadistas.filter(b => b.turno === 'Noite' && b.status === 'Ativo');
    
    const escalaManha = document.getElementById('escala-manha');
    if (escalaManha) {
        escalaManha.innerHTML = manha.length ? 
            manha.map(b => `<li class="list-group-item">${b.nome} (${b.funcao})</li>`).join('') : 
            '<li class="list-group-item text-muted">Nenhum brigadista</li>';
    }
    
    const escalaTarde = document.getElementById('escala-tarde');
    if (escalaTarde) {
        escalaTarde.innerHTML = tarde.length ? 
            tarde.map(b => `<li class="list-group-item">${b.nome} (${b.funcao})</li>`).join('') : 
            '<li class="list-group-item text-muted">Nenhum brigadista</li>';
    }
    
    const escalaNoite = document.getElementById('escala-noite');
    if (escalaNoite) {
        escalaNoite.innerHTML = noite.length ? 
            noite.map(b => `<li class="list-group-item">${b.nome} (${b.funcao})</li>`).join('') : 
            '<li class="list-group-item text-muted">Nenhum brigadista</li>';
    }
}

// ========== OCORRÊNCIAS ==========
function renderizarListaOcorrencias() {
    const tbody = document.getElementById('brigada-ocorrencias-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    ocorrencias.forEach(o => {
        const statusBadge = o.status === 'Encerrada' ? 'bg-success' : o.status === 'Em Andamento' ? 'bg-warning' : 'bg-danger';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(o.data)}</td>
            <td><span class="badge bg-info">${o.tipo}</span></td>
            <td>${o.local || '-'}</td>
            <td>${o.responsavel || '-'}</td>
            <td><span class="badge ${statusBadge}">${o.status}</span></td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="excluirOcorrencia('${o.id}')"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarOcorrencia(dados) {
    try {
        // CORREÇÃO: Coleta dados do formulário se a função for chamada sem argumentos (pelo botão Salvar)
        if (!dados || typeof dados !== 'object') {
            const dataStr = document.getElementById('brigada-ocorrencia-data')?.value;
            dados = {
                data: dataStr ? new Date(dataStr + 'T00:00:00') : new Date(),
                tipo: document.getElementById('brigada-ocorrencia-tipo')?.value || 'Outro',
                local: document.getElementById('brigada-ocorrencia-local')?.value || '',
                responsavel: document.getElementById('brigada-ocorrencia-responsavel')?.value || '',
                status: document.getElementById('brigada-ocorrencia-status')?.value || 'Em Andamento',
                descricao: document.getElementById('brigada-ocorrencia-descricao')?.value || ''
            };
        }

        await db.collection('brigada_ocorrencias').add(dados);
        mostrarMensagem('Ocorrência registrada!', 'success');
        await carregarDadosBrigada();
        
        // Fecha o modal corretamente
        const modalEl = document.getElementById('brigada-ocorrencia-modal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

// ========== UTILITÁRIOS ==========
function configurarAbasBrigada() {
    const tabs = document.querySelectorAll('#brigada-tabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => setTimeout(carregarDadosBrigada, 100));
    });
}

function configurarFiltrosBrigada() {
    const filtroTurno = document.getElementById('brigada-filtro-turno');
    if (filtroTurno) {
        filtroTurno.addEventListener('change', () => {
            const turno = filtroTurno.value;
            const filtrados = turno ? brigadistas.filter(b => b.turno === turno) : brigadistas;
            renderizarListaBrigadistas();
        });
    }
}

function verificarAlertasBrigada() {
    const hoje = new Date();
    const container = document.getElementById('brigada-alertas');
    
    if (!container) return;
    
    const cursosVencidos = brigadistas.filter(b => {
        if (!b.validadeCurso) return false;
        return new Date(b.validadeCurso.toDate()) < hoje;
    });
    
    if (cursosVencidos.length > 0) {
        container.classList.remove('d-none');
        container.innerHTML = `<div class="alert alert-danger">⚠️ ${cursosVencidos.length} curso(s) de brigada vencido(s)!</div>`;
    } else {
        container.classList.add('d-none');
    }
}

// ========== EXPOSE GLOBAL FUNCTIONS ==========
window.inicializarBrigadaIncendio = inicializarBrigadaIncendio;
window.abrirModalBrigadista = abrirModalBrigadista;
window.salvarBrigadista = salvarBrigadista;
window.editarBrigadista = editarBrigadista;
window.excluirBrigadista = excluirBrigadista;
window.salvarSimulado = salvarSimulado;
window.salvarOcorrencia = salvarOcorrencia;
window.fecharModalBrigadista = fecharModalBrigadista;

// Missing onclick handlers from brigada-incendio.html
window.abrirModalSimulado = () => {
    document.getElementById('brigada-simulado-form').reset();
    document.getElementById('brigada-simulado-id').value = '';
    new bootstrap.Modal(document.getElementById('brigada-simulado-modal')).show();
};

window.excluirSimulado = async (id) => {
    if (confirm('Excluir simulado?')) {
        await db.collection('brigada_simulados').doc(id).delete();
        mostrarMensagem('Simulado excluído!', 'success');
        await carregarDadosBrigada();
    }
};

window.abrirModalOcorrencia = () => {
    document.getElementById('brigada-ocorrencia-form').reset();
    document.getElementById('brigada-ocorrencia-id').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('brigada-ocorrencia-modal')).show();
};

window.excluirOcorrencia = async (id) => {
    if (confirm('Excluir ocorrência?')) {
        await db.collection('brigada_ocorrencias').doc(id).delete();
        mostrarMensagem('Ocorrência excluída!', 'success');
        await carregarDadosBrigada();
    }
};

window.excluirSimulado = excluirSimulado; // Already defined above
