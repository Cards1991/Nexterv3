// =================================================================
// Sistema de Brigada de Incêndio (NR-23)
// =================================================================

let brigadistas = [];
let simulados = [];
let escalaBrigada = [];
let ocorrencias = [];
let chartSimulados = null;
let chartOcorrencias = null;

// Inicializar sistema
async function inicializarBrigadaIncendio() {
    console.log("Inicializando Brigada de Incêndio...");
    
    // Configurar abas
    const tabs = document.querySelectorAll('#brigada-tabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(() => carregarDadosBrigadaPorAba(tab.dataset.tab), 100);
        });
    });
    
    await carregarDadosBrigada();
    verificarAlertasBrigada();
    configurarFiltrosBrigada();
}

async function carregarDadosBrigada() {
    try {
        // Carregar brigadistas
        const brigadistasSnap = await db.collection('brigada_brigadistas').get();
        brigadistas = brigadistasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar simulados
        const simuladoSnap = await db.collection('brigada_simulados').orderBy('data', 'desc').get();
        simulados = simuladoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar escala
        const escalaSnap = await db.collection('brigada_escala').get();
        escalaBrigada = escalaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar ocorrências
        const ocorrenciasSnap = await db.collection('brigada_ocorrencias').orderBy('data', 'desc').get();
        ocorrencias = ocorrenciasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Renderizar
        renderizarDashboardBrigada();
        renderizarListaBrigadistas();
        renderizarListaSimulados();
        renderizarListaOcorrencias();
        
    } catch (error) {
        console.error("Erro ao carregar dados da brigada:", error);
    }
}

async function carregarDadosBrigadaPorAba(aba) {
    await carregarDadosBrigada();
}

// ========== DASHBOARD ==========

function renderizarDashboardBrigada() {
    const totalBrigadistas = brigadistas.length;
    const ativos = brigadistas.filter(b => b.status === 'Ativo').length;
    const cursoValido = brigadistas.filter(b => {
        if (!b.validadeCurso) return true;
        const validade = b.validadeCurso.toDate ? b.validadeCurso.toDate() : new Date(b.validadeCurso);
        return validade > new Date();
    }).length;
    
    // Contagem por função
    const porFuncao = {
        Líder: brigadistas.filter(b => b.funcao === 'Líder').length,
        Abandono: brigadistas.filter(b => b.funcao === 'Abandono').length,
        Combate: brigadistas.filter(b => b.funcao === 'Combate').length,
        'Primeiros Socorros': brigadistas.filter(b => b.funcao === 'Primeiros Socorros').length
    };
    
    // Calcular média de tempo de evacuação
    const ultimosSimulados = simulados.slice(0, 5);
    const tempoMedio = ultimosSimulados.length > 0
        ? ultimosSimulados.reduce((acc, s) => acc + (s.tempoEvacuacao || 0), 0) / ultimosSimulados.length
        : 0;
    
    // Atualizar KPIs
    atualizarElementoBrigada('kpi-brigada-total', totalBrigadistas);
    atualizarElementoBrigada('kpi-brigada-ativos', ativos);
    atualizarElementoBrigada('kpi-brigada-curso-valido', cursoValido);
    atualizarElementoBrigada('kpi-brigada-tempo', tempoMedio.toFixed(1) + ' min');
    atualizarElementoBrigada('kpi-brigada-lider', porFuncao['Líder']);
    atualizarElementoBrigada('kpi-brigada-abandono', porFuncao['Abandono']);
    atualizarElementoBrigada('kpi-brigada-combate', porFuncao['Combate']);
    atualizarElementoBrigada('kpi-brigada-socorros', porFuncao['Primeiros Socorros']);
    
    // Renderizar gráficos
    renderizarGraficoSimulados();
    renderizarGraficoOcorrencias();
}

function atualizarElementoBrigada(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function renderizarGraficoSimulados() {
    const ctx = document.getElementById('chart-brigada-simulados')?.getContext('2d');
    if (!ctx || simulados.length === 0) return;
    
    const ultimos = simulados.slice(0, 6).reverse();
    const labels = ultimos.map(s => {
        const data = s.data?.toDate ? s.data.toDate() : new Date(s.data);
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const dados = ultimos.map(s => s.tempoEvacuacao || 0);
    
    if (chartSimulados) chartSimulados.destroy();
    
    chartSimulados = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tempo de Evacuação (min)',
                data: dados,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Minutos' } }
            }
        }
    });
}

function renderizarGraficoOcorrencias() {
    const ctx = document.getElementById('chart-brigada-ocorrencias')?.getContext('2d');
    if (!ctx) return;
    
    const porTipo = {};
    ocorrencias.forEach(o => {
        const tipo = o.tipo || 'Outros';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    
    if (chartOcorrencias) chartOcorrencias.destroy();
    
    chartOcorrencias = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{
                data: Object.values(porTipo),
                backgroundColor: ['#dc3545', '#ffc107', '#0d6efd', '#198754', '#6c757d']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Alertas
function verificarAlertasBrigada() {
    const hoje = new Date();
    const diasAlerta = 60;
    const container = document.getElementById('brigada-alertas');
    
    if (!container) return;
    
    const alertas = [];
    
    // Cursos vencendo
    const cursosVencendo = brigadistas.filter(b => {
        if (!b.validadeCurso) return false;
        const validade = b.validadeCurso.toDate ? b.validadeCurso.toDate() : new Date(b.validadeCurso);
        const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        return diffDias > 0 && diffDias <= diasAlerta;
    });
    
    if (cursosVencendo.length > 0) {
        alertas.push(`<strong>Cursos vencendo:</strong> ${cursosVencendo.length} brigadista(s) com curso próximo do vencimento.`);
    }
    
    // Brigadistas insuficientes por turno
    const turnos = ['Manhã', 'Tarde', 'Noite'];
    turnos.forEach(turno => {
        const count = brigadistas.filter(b => b.turno === turno && b.status === 'Ativo').length;
        if (count < 2) {
            alertas.push(`<strong>Turno ${turno}:</strong> Apenas ${count} brigadista(s) ativo(s) (mínimo recomendado: 2).`);
        }
    });
    
    if (alertas.length > 0) {
        container.classList.remove('d-none');
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${alertas.join('<br>')}
            </div>
        `;
    } else {
        container.classList.add('d-none');
    }
}

// ========== MÓDULO 1: BRIGADISTAS ==========

function renderizarListaBrigadistas() {
    const tbody = document.getElementById('brigada-brigadistas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const hoje = new Date();
    const diasAlerta = 60;
    
    brigadistas.forEach(brigadista => {
        let statusBadge = '<span class="badge bg-secondary">Inativo</span>';
        
        if (brigadista.status === 'Ativo') {
            if (!brigadista.validadeCurso) {
                statusBadge = '<span class="badge bg-success">Ativo</span>';
            } else {
                const validade = brigadista.validadeCurso.toDate ? brigadista.validadeCurso.toDate() : new Date(brigadista.validadeCurso);
                const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
                
                if (diffDias < 0) {
                    statusBadge = '<span class="badge bg-danger">Curso Vencido</span>';
                } else if (diffDias <= diasAlerta) {
                    statusBadge = '<span class="badge bg-warning">Curso Vencer</span>';
                } else {
                    statusBadge = '<span class="badge bg-success">Ativo</span>';
                }
            }
        }
        
        const funcaoBadge = getFuncaoBadge(brigadista.funcao);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${brigadista.nome}</td>
            <td>${brigadista.setor || '-'}</td>
            <td>${brigadista.turno || '-'}</td>
            <td>${funcaoBadge}</td>
            <td>${brigadista.dataCurso ? formatarData(brigadista.dataCurso) : '-'}</td>
            <td>${brigadista.validadeCurso ? formatarData(brigadista.validadeCurso) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarBrigadista('${brigadista.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirBrigadista('${brigadista.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getFuncaoBadge(funcao) {
    const cores = {
        'Líder': 'bg-danger',
        'Abandono': 'bg-warning',
        'Combate': 'bg-primary',
        'Primeiros Socorros': 'bg-success'
    };
    return `<span class="badge ${cores[funcao] || 'bg-secondary'}">${funcao}</span>`;
}

async function salvarBrigadista(dados) {
    try {
        if (dados.id) {
            await db.collection('brigada_brigadistas').doc(dados.id).update(dados);
            mostrarMensagem('Brigadista atualizado com sucesso!', 'success');
        } else {
            await db.collection('brigada_brigadistas').add(dados);
            mostrarMensagem('Brigadista cadastrado com sucesso!', 'success');
        }
        
        await carregarDadosBrigada();
        fecharModalBrigadista();
    } catch (error) {
        console.error("Erro ao salvar brigadista:", error);
        mostrarMensagem('Erro ao salvar brigadista: ' + error.message, 'error');
    }
}

async function editarBrigadista(id) {
    const brigadista = brigadistas.find(b => b.id === id);
    if (!brigadista) return;
    
    document.getElementById('brigada-brigadista-id').value = brigadista.id;
    document.getElementById('brigada-brigadista-nome').value = brigadista.nome || '';
    document.getElementById('brigada-brigadista-setor').value = brigadista.setor || '';
    document.getElementById('brigada-brigadista-turno').value = brigadista.turno || 'Manhã';
    document.getElementById('brigada-brigadista-funcao').value = brigadista.funcao || 'Líder';
    document.getElementById('brigada-brigadista-curso-data').value = brigadista.dataCurso ? new Date(brigadista.dataCurso.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('brigada-brigadista-curso-validade').value = brigadista.validadeCurso ? new Date(brigadista.validadeCurso.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('brigada-brigadista-status').value = brigadista.status || 'Ativo';
    
    abrirModalBrigadista();
}

async function excluirBrigadista(id) {
    if (!confirm('Tem certeza que deseja excluir este brigadista?')) return;
    
    try {
        await db.collection('brigada_brigadistas').doc(id).delete();
        mostrarMensagem('Brigadista excluído com sucesso!', 'success');
        await carregarDadosBrigada();
    } catch (error) {
        console.error("Erro ao excluir brigadista:", error);
        mostrarMensagem('Erro ao excluir brigadista!', 'error');
    }
}

function abrirModalBrigadista() {
    const modal = new bootstrap.Modal(document.getElementById('brigada-brigadista-modal'));
    modal.show();
}

function fecharModalBrigadista() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('brigada-brigadista-modal'));
    if (modal) modal.hide();
    document.getElementById('brigada-brigadista-form').reset();
    document.getElementById('brigada-brigadista-id').value = '';
}

// ========== MÓDULO 2: SIMULADOS ==========

function renderizarListaSimulados() {
    const tbody = document.getElementById('brigada-simulados-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    simulados.forEach(simulado => {
        const data = simulado.data?.toDate ? simulado.data.toDate() : new Date(simulado.data);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(data)}</td>
            <td>${simulado.tipo || '-'}</td>
            <td>${simulado.tempoEvacuacao || '-'} min</td>
            <td>${simulado.avaliacao || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarSimulado('${simulado.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirSimulado('${simulado.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarSimulado(dados) {
    try {
        if (dados.id) {
            await db.collection('brigada_simulados').doc(dados.id).update(dados);
            mostrarMensagem('Simulado atualizado com sucesso!', 'success');
        } else {
            await db.collection('brigada_simulados').add(dados);
            mostrarMensagem('Simulado cadastrado com sucesso!', 'success');
        }
        
        await carregarDadosBrigada();
        fecharModalSimulado();
    } catch (error) {
        console.error("Erro ao salvar simulado:", error);
        mostrarMensagem('Erro ao salvar simulado: ' + error.message, 'error');
    }
}

function abrirModalSimulado() {
    const modal = new bootstrap.Modal(document.getElementById('brigada-simulado-modal'));
    modal.show();
}

function fecharModalSimulado() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('brigada-simulado-modal'));
    if (modal) modal.hide();
    document.getElementById('brigada-simulado-form').reset();
    document.getElementById('brigada-simulado-id').value = '';
}

// ========== MÓDULO 3: ESCALA ==========

// ========== MÓDULO 4: OCORRÊNCIAS ==========

function renderizarListaOcorrencias() {
    const tbody = document.getElementById('brigada-ocorrencias-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    ocorrencias.forEach(ocorrencia => {
        const data = ocorrencia.data?.toDate ? ocorrencia.data.toDate() : new Date(ocorrencia.data);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(data)}</td>
            <td>${ocorrencia.tipo || '-'}</td>
            <td>${ocorrencia.local || '-'}</td>
            <td>${ocorrencia.responsavel || '-'}</td>
            <td>${ocorrencia.status || 'Aberta'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarOcorrencia('${ocorrencia.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirOcorrencia('${ocorrencia.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarOcorrencia(dados) {
    try {
        if (dados.id) {
            await db.collection('brigada_ocorrencias').doc(dados.id).update(dados);
            mostrarMensagem('Ocorrência atualizada com sucesso!', 'success');
        } else {
            await db.collection('brigada_ocorrencias').add(dados);
            mostrarMensagem('Ocorrência cadastrada com sucesso!', 'success');
        }
        
        await carregarDadosBrigada();
        fecharModalOcorrencia();
    } catch (error) {
        console.error("Erro ao salvar ocorrência:", error);
        mostrarMensagem('Erro ao salvar ocorrência: ' + error.message, 'error');
    }
}

async function editarOcorrencia(id) {
    const ocorrencia = ocorrencias.find(o => o.id === id);
    if (!ocorrencia) return;
    
    document.getElementById('brigada-ocorrencia-id').value = ocorrencia.id;
    document.getElementById('brigada-ocorrencia-tipo').value = ocorrencia.tipo || '';
    document.getElementById('brigada-ocorrencia-local').value = ocorrencia.local || '';
    document.getElementById('brigada-ocorrencia-descricao').value = ocorrencia.descricao || '';
    document.getElementById('brigada-ocorrencia-responsavel').value = ocorrencia.responsavel || '';
    document.getElementById('brigada-ocorrencia-status').value = ocorrencia.status || 'Aberta';
    document.getElementById('brigada-ocorrencia-data').value = ocorrencia.data ? new Date(ocorrencia.data.toDate()).toISOString().split('T')[0] : '';
    
    abrirModalOcorrencia();
}

function abrirModalOcorrencia() {
    const modal = new bootstrap.Modal(document.getElementById('brigada-ocorrencia-modal'));
    modal.show();
}

function fecharModalOcorrencia() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('brigada-ocorrencia-modal'));
    if (modal) modal.hide();
    document.getElementById('brigada-ocorrencia-form').reset();
    document.getElementById('brigada-ocorrencia-id').value = '';
}

// ========== CONFIGURAR FILTROS ==========

function configurarFiltrosBrigada() {
    const filtroTurno = document.getElementById('brigada-filtro-turno');
    if (filtroTurno) {
        filtroTurno.addEventListener('change', () => {
            const turno = filtroTurno.value;
            const filtrados = turno ? brigadistas.filter(b => b.turno === turno) : brigadistas;
            renderizarListaBrigadistasFiltrada(filtrados);
        });
    }
}

function renderizarListaBrigadistasFiltrada(lista) {
    const tbody = document.getElementById('brigada-brigadistas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    lista.forEach(brigadista => {
        const statusBadge = brigadista.status === 'Ativo' 
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-secondary">Inativo</span>';
        
        const funcaoBadge = getFuncaoBadge(brigadista.funcao);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${brigadista.nome}</td>
            <td>${brigadista.setor || '-'}</td>
            <td>${brigadista.turno || '-'}</td>
            <td>${funcaoBadge}</td>
            <td>${brigadista.dataCurso ? formatarData(brigadista.dataCurso) : '-'}</td>
            <td>${brigadista.validadeCurso ? formatarData(brigadista.validadeCurso) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarBrigadista('${brigadista.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirBrigadista('${brigadista.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ========== EXPORTAR ==========

window.inicializarBrigadaIncendio = inicializarBrigadaIncendio;
window.carregarDadosBrigada = carregarDadosBrigada;
window.salvarBrigadista = salvarBrigadista;
window.editarBrigadista = editarBrigadista;
window.excluirBrigadista = excluirBrigadista;
window.salvarSimulado = salvarSimulado;
window.salvarOcorrencia = salvarOcorrencia;
window.editarOcorrencia = editarOcorrencia;
window.abrirModalBrigadista = abrirModalBrigadista;
window.fecharModalBrigadista = fecharModalBrigadista;
window.abrirModalSimulado = abrirModalSimulado;
window.fecharModalSimulado = fecharModalSimulado;
window.abrirModalOcorrencia = abrirModalOcorrencia;
window.fecharModalOcorrencia = fecharModalOcorrencia;

