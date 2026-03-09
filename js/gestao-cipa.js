// =================================================================
// Sistema de Gestão de CIPA (NR-5)
// =================================================================

let cipaMembros = [];
let cipaEleicoes = [];
let cipaTreinamentos = [];
let cipaReunioes = [];
let cipaAcoes = [];
let chartCipaEvolucao = null;
let chartCipaSetores = null;
let chartCipaAcoes = null;

// Inicializar sistema CIPA
async function inicializarGestaoCipa() {
    console.log("Inicializando Gestão de CIPA...");
    
    // Configurar abas
    const tabs = document.querySelectorAll('#cipa-tabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(() => carregarDadosCipaPorAba(tab.dataset.tab), 100);
        });
    });
    
    // Carregar dados iniciais
    await carregarDadosCipa();
    
    // Verificar alertas de mandato
    verificarAlertasMandato();
    
    // Configurar listeners de filtros
    configurarFiltrosCipa();
}

async function carregarDadosCipa() {
    try {
        // Carregar membros
        const membrosSnap = await db.collection('cipa_membros').get();
        cipaMembros = membrosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar eleições
        const eleicoesSnap = await db.collection('cipa_eleicoes').get();
        cipaEleicoes = eleicoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar treinamentos
        const treinamentosSnap = await db.collection('cipa_treinamentos').get();
        cipaTreinamentos = treinamentosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar reuniões
        const reunioesSnap = await db.collection('cipa_reunioes').orderBy('data', 'desc').get();
        cipaReunioes = reunioesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carregar ações
        const acoesSnap = await db.collection('cipa_acoes').orderBy('prazo', 'asc').get();
        cipaAcoes = acoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Renderizar dashboard
        renderizarDashboardCipa();
        
        // Renderizar listas
        renderizarListaMembros();
        renderizarListaEleicoes();
        renderizarListaTreinamentos();
        renderizarListaReunioes();
        renderizarKanbanAcoes();
        
    } catch (error) {
        console.error("Erro ao carregar dados CIPA:", error);
    }
}

async function carregarDadosCipaPorAba(aba) {
    await carregarDadosCipa();
}

// Renderizar Dashboard
function renderizarDashboardCipa() {
    // KPIs
    const totalMembros = cipaMembros.filter(m => m.status === 'Ativo').length;
    const totalTitulares = cipaMembros.filter(m => m.tipo === 'Titular' && m.status === 'Ativo').length;
    const totalSuplentes = cipaMembros.filter(m => m.tipo === 'Suplente' && m.status === 'Ativo').length;
    
    // Calcular reuniões do ano
    const anoAtual = new Date().getFullYear();
    const reunioesAno = cipaReunioes.filter(r => {
        const data = r.data?.toDate ? r.data.toDate() : new Date(r.data);
        return data.getFullYear() === anoAtual;
    });
    
    // Calcular ações
    const acoesPendentes = cipaAcoes.filter(a => a.status === 'Pendente').length;
    const acoesAndamento = cipaAcoes.filter(a => a.status === 'Em Andamento').length;
    const acoesConcluidas = cipaAcoes.filter(a => a.status === 'Concluído').length;
    
    // Atualizar KPIs
    atualizarElemento('kpi-cipa-membros', totalMembros);
    atualizarElemento('kpi-cipa-titulares', totalTitulares);
    atualizarElemento('kpi-cipa-suplentes', totalSuplentes);
    atualizarElemento('kpi-cipa-reunioes', reunioesAno.length);
    atualizarElemento('kpi-cipa-acoes-pendentes', acoesPendentes);
    atualizarElemento('kpi-cipa-acoes-andamento', acoesAndamento);
    atualizarElemento('kpi-cipa-acoes-concluidas', acoesConcluidas);
    
    // Renderizar gráfico de ações
    renderizarGraficoAcoesCipa();
}

function atualizarElemento(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
}

function renderizarGraficoAcoesCipa() {
    const ctx = document.getElementById('chart-cipa-acoes')?.getContext('2d');
    if (!ctx) return;
    
    const pendentes = cipaAcoes.filter(a => a.status === 'Pendente').length;
    const andamento = cipaAcoes.filter(a => a.status === 'Em Andamento').length;
    const concluidas = cipaAcoes.filter(a => a.status === 'Concluído').length;
    
    if (chartCipaAcoes) chartCipaAcoes.destroy();
    
    chartCipaAcoes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pendentes', 'Em Andamento', 'Concluídas'],
            datasets: [{
                data: [pendentes, andamento, concluidas],
                backgroundColor: ['#dc3545', '#ffc107', '#198754']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Verificar alertas de mandato
function verificarAlertasMandato() {
    const hoje = new Date();
    const diasAlerta = 60;
    
    const membrosAlertar = cipaMembros.filter(m => {
        if (m.status !== 'Ativo' || !m.dataFimMandato) return false;
        
        const dataFim = m.dataFimMandato.toDate ? m.dataFimMandato.toDate() : new Date(m.dataFimMandato);
        const diffDias = Math.ceil((dataFim - hoje) / (1000 * 60 * 60 * 24));
        
        return diffDias > 0 && diffDias <= diasAlerta;
    });
    
    if (membrosAlertar.length > 0) {
        const container = document.getElementById('cipa-alertas-mandato');
        if (container) {
            container.classList.remove('d-none');
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Atenção!</strong> ${membrosAlertar.length} membro(s) com mandato terminando em breve:
                    ${membrosAlertar.map(m => `<br>- ${m.nome} (${m.tipo}) - Término: ${formatarData(m.dataFimMandato)}`).join('')}
                </div>
            `;
        }
    }
}

// ========== MÓDULO 1: MEMBROS ==========

function renderizarListaMembros() {
    const tbody = document.getElementById('cipa-membros-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cipaMembros.forEach(membro => {
        const dataInicio = membro.dataInicioMandato?.toDate ? membro.dataInicioMandato.toDate() : new Date(membro.dataInicioMandato);
        const dataFim = membro.dataFimMandato?.toDate ? membro.dataFimMandato.toDate() : new Date(membro.dataFimMandato);
        
        const statusBadge = membro.status === 'Ativo' 
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-secondary">Inativo</span>';
        
        const tipoBadge = getTipoBadge(membro.tipo);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${membro.nome}</td>
            <td>${membro.matricula || '-'}</td>
            <td>${membro.setor || '-'}</td>
            <td>${membro.cargo || '-'}</td>
            <td>${tipoBadge}</td>
            <td>${formatarData(dataInicio)}</td>
            <td>${formatarData(dataFim)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarMembroCipa('${membro.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirMembroCipa('${membro.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getTipoBadge(tipo) {
    const cores = {
        'Titular': 'bg-primary',
        'Suplente': 'bg-info',
        'Presidente': 'bg-warning',
        'Vice-presidente': 'bg-warning',
        'Designado': 'bg-secondary'
    };
    return `<span class="badge ${cores[tipo] || 'bg-secondary'}">${tipo}</span>`;
}

// Salvar membro
async function salvarMembroCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_membros').doc(dados.id).update(dados);
            mostrarMensagem('Membro atualizado com sucesso!', 'success');
        } else {
            await db.collection('cipa_membros').add(dados);
            mostrarMensagem('Membro cadastrado com sucesso!', 'success');
        }
        
        await carregarDadosCipa();
        fecharModalCipa();
    } catch (error) {
        console.error("Erro ao salvar membro:", error);
        mostrarMensagem('Erro ao salvar membro: ' + error.message, 'error');
    }
}

async function editarMembroCipa(id) {
    const membro = cipaMembros.find(m => m.id === id);
    if (!membro) return;
    
    document.getElementById('cipa-membro-id').value = membro.id;
    document.getElementById('cipa-membro-nome').value = membro.nome;
    document.getElementById('cipa-membro-matricula').value = membro.matricula || '';
    document.getElementById('cipa-membro-setor').value = membro.setor || '';
    document.getElementById('cipa-membro-cargo').value = membro.cargo || '';
    document.getElementById('cipa-membro-tipo').value = membro.tipo || 'Titular';
    document.getElementById('cipa-membro-inicio').value = membro.dataInicioMandato ? new Date(membro.dataInicioMandato.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-membro-fim').value = membro.dataFimMandato ? new Date(membro.dataFimMandato.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-membro-status').value = membro.status || 'Ativo';
    
    abrirModalCipa();
}

async function excluirMembroCipa(id) {
    if (!confirm('Tem certeza que deseja excluir este membro?')) return;
    
    try {
        await db.collection('cipa_membros').doc(id).delete();
        mostrarMensagem('Membro excluído com sucesso!', 'success');
        await carregarDadosCipa();
    } catch (error) {
        console.error("Erro ao excluir membro:", error);
        mostrarMensagem('Erro ao excluir membro!', 'error');
    }
}

function abrirModalCipa() {
    const modal = new bootstrap.Modal(document.getElementById('cipa-membro-modal'));
    modal.show();
}

function fecharModalCipa() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('cipa-membro-modal'));
    if (modal) modal.hide();
    
    document.getElementById('cipa-membro-form').reset();
    document.getElementById('cipa-membro-id').value = '';
}

// ========== MÓDULO 2: PROCESSO ELEITORAL ==========

function renderizarListaEleicoes() {
    const tbody = document.getElementById('cipa-eleicoes-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cipaEleicoes.forEach(eleicao => {
        const dataAbertura = eleicao.dataAbertura?.toDate ? eleicao.dataAbertura.toDate() : new Date(eleicao.dataAbertura);
        
        const statusBadge = eleicao.status === 'Concluída'
            ? '<span class="badge bg-success">Concluída</span>'
            : '<span class="badge bg-warning">Em Andamento</span>';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(dataAbertura)}</td>
            <td>${eleicao.ano || '-'}</td>
            <td>${eleicao.editalPublicado ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-danger"></i>'}</td>
            <td>${eleicao.totalCandidatos || 0}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarEleicaoCipa('${eleicao.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirEleicaoCipa('${eleicao.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarEleicaoCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_eleicoes').doc(dados.id).update(dados);
            mostrarMensagem('Eleição atualizada com sucesso!', 'success');
        } else {
            await db.collection('cipa_eleicoes').add(dados);
            mostrarMensagem('Eleição cadastrada com sucesso!', 'success');
        }
        
        await carregarDadosCipa();
        fecharModalEleicaoCipa();
    } catch (error) {
        console.error("Erro ao salvar eleição:", error);
        mostrarMensagem('Erro ao salvar eleição: ' + error.message, 'error');
    }
}

async function editarEleicaoCipa(id) {
    const eleicao = cipaEleicoes.find(e => e.id === id);
    if (!eleicao) return;
    
    document.getElementById('cipa-eleicao-id').value = eleicao.id;
    document.getElementById('cipa-eleicao-ano').value = eleicao.ano || '';
    document.getElementById('cipa-eleicao-data').value = eleicao.dataAbertura ? new Date(eleicao.dataAbertura.toDate()).toISOString().split('T')[0] : '';
    document.getElementById('cipa-eleicao-edital').checked = eleicao.editalPublicado || false;
    document.getElementById('cipa-eleicao-inscricao-inicio').value = eleicao.periodoInscricao?.inicio || '';
    document.getElementById('cipa-eleicao-inscricao-fim').value = eleicao.periodoInscricao?.fim || '';
    document.getElementById('cipa-eleicao-candidatos').value = eleicao.totalCandidatos || 0;
    document.getElementById('cipa-eleicao-status').value = eleicao.status || 'Em Andamento';
    
    abrirModalEleicaoCipa();
}

function abrirModalEleicaoCipa() {
    const modal = new bootstrap.Modal(document.getElementById('cipa-eleicao-modal'));
    modal.show();
}

function fecharModalEleicaoCipa() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('cipa-eleicao-modal'));
    if (modal) modal.hide();
    
    document.getElementById('cipa-eleicao-form').reset();
    document.getElementById('cipa-eleicao-id').value = '';
}

// ========== MÓDULO 3: TREINAMENTO ==========

function renderizarListaTreinamentos() {
    const tbody = document.getElementById('cipa-treinamentos-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const hoje = new Date();
    const diasAlerta = 30;
    
    cipaTreinamentos.forEach(treinamento => {
        const dataCurso = treinamento.dataCurso?.toDate ? treinamento.dataCurso.toDate() : new Date(treinamento.dataCurso);
        const validade = treinamento.validade ? new Date(treinamento.validade) : null;
        
        let statusBadge = '<span class="badge bg-secondary">Sem validade</span>';
        if (validade) {
            const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
            if (diffDias < 0) {
                statusBadge = '<span class="badge bg-danger">Vencido</span>';
            } else if (diffDias <= diasAlerta) {
                statusBadge = '<span class="badge bg-warning">Próximo vencimento</span>';
            } else {
                statusBadge = '<span class="badge bg-success">Em dia</span>';
            }
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${treinamento.participante || '-'}</td>
            <td>${treinamento.curso || '-'}</td>
            <td>${treinamento.cargaHoraria || '-'}h</td>
            <td>${treinamento.instrutor || '-'}</td>
            <td>${formatarData(dataCurso)}</td>
            <td>${validade ? formatarData(validade) : '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarTreinamentoCipa('${treinamento.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirTreinamentoCipa('${treinamento.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarTreinamentoCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_treinamentos').doc(dados.id).update(dados);
            mostrarMensagem('Treinamento atualizado com sucesso!', 'success');
        } else {
            await db.collection('cipa_treinamentos').add(dados);
            mostrarMensagem('Treinamento cadastrado com sucesso!', 'success');
        }
        
        await carregarDadosCipa();
        fecharModalTreinamentoCipa();
    } catch (error) {
        console.error("Erro ao salvar treinamento:", error);
        mostrarMensagem('Erro ao salvar treinamento: ' + error.message, 'error');
    }
}

function abrirModalTreinamentoCipa() {
    const modal = new bootstrap.Modal(document.getElementById('cipa-treinamento-modal'));
    modal.show();
}

function fecharModalTreinamentoCipa() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('cipa-treinamento-modal'));
    if (modal) modal.hide();
    
    document.getElementById('cipa-treinamento-form').reset();
    document.getElementById('cipa-treinamento-id').value = '';
}

// ========== MÓDULO 4: REUNIÕES ==========

function renderizarListaReunioes() {
    const tbody = document.getElementById('cipa-reunioes-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    cipaReunioes.forEach(reuniao => {
        const data = reuniao.data?.toDate ? reuniao.data.toDate() : new Date(reuniao.data);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(data)}</td>
            <td>${reuniao.pauta || '-'}</td>
            <td>${reuniao.participantes?.length || 0}</td>
            <td>${reuniao.ata ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-muted"></i>'}</td>
            <td>${reuniao.planoAcao ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-muted"></i>'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarReuniaoCipa('${reuniao.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirReuniaoCipa('${reuniao.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function salvarReuniaoCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_reunioes').doc(dados.id).update(dados);
            mostrarMensagem('Reunião atualizada com sucesso!', 'success');
        } else {
            await db.collection('cipa_reunioes').add(dados);
            mostrarMensagem('Reunião cadastrada com sucesso!', 'success');
        }
        
        await carregarDadosCipa();
        fecharModalReuniaoCipa();
    } catch (error) {
        console.error("Erro ao salvar reunião:", error);
        mostrarMensagem('Erro ao salvar reunião: ' + error.message, 'error');
    }
}

function abrirModalReuniaoCipa() {
    const modal = new bootstrap.Modal(document.getElementById('cipa-reuniao-modal'));
    modal.show();
}

function fecharModalReuniaoCipa() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('cipa-reuniao-modal'));
    if (modal) modal.hide();
    
    document.getElementById('cipa-reuniao-form').reset();
    document.getElementById('cipa-reuniao-id').value = '';
}

// ========== MÓDULO 5: PLANO DE AÇÃO (KANBAN) ==========

function renderizarKanbanAcoes() {
    const colunas = {
        'Pendente': document.getElementById('kanban-pendente'),
        'Em Andamento': document.getElementById('kanban-andamento'),
        'Concluído': document.getElementById('kanban-concluido')
    };
    
    Object.values(colunas).forEach(col => {
        if (col) col.innerHTML = '';
    });
    
    cipaAcoes.forEach(acao => {
        const coluna = colunas[acao.status];
        if (!coluna) return;
        
        const prioridadeCor = {
            'Alta': 'border-danger',
            'Média': 'border-warning',
            'Baixa': 'border-info'
        };
        
        const prioridade = acao.prioridade || 'Média';
        
        const card = document.createElement('div');
        card.className = `card mb-2 ${prioridadeCor[prioridade]} border-start border-4`;
        card.style.cursor = 'pointer';
        card.onclick = () => editarAcaoCipa(acao.id);
        
        card.innerHTML = `
            <div class="card-body p-2">
                <h6 class="card-title mb-1">${acao.titulo}</h6>
                <small class="text-muted d-block">${acao.setor || 'Setor não informado'}</small>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="badge bg-secondary">${prioridade}</span>
                    <small class="text-muted">${acao.prazo ? formatarData(acao.prazo) : 'Sem prazo'}</small>
                </div>
            </div>
        `;
        
        coluna.appendChild(card);
    });
}

async function salvarAcaoCipa(dados) {
    try {
        if (dados.id) {
            await db.collection('cipa_acoes').doc(dados.id).update(dados);
            mostrarMensagem('Ação atualizada com sucesso!', 'success');
        } else {
            await db.collection('cipa_acoes').add(dados);
            mostrarMensagem('Ação cadastrada com sucesso!', 'success');
        }
        
        await carregarDadosCipa();
        fecharModalAcaoCipa();
    } catch (error) {
        console.error("Erro ao salvar ação:", error);
        mostrarMensagem('Erro ao salvar ação: ' + error.message, 'error');
    }
}

async function editarAcaoCipa(id) {
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
    
    abrirModalAcaoCipa();
}

function abrirModalAcaoCipa() {
    const modal = new bootstrap.Modal(document.getElementById('cipa-acao-modal'));
    modal.show();
}

function fecharModalAcaoCipa() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('cipa-acao-modal'));
    if (modal) modal.hide();
    
    document.getElementById('cipa-acao-form').reset();
    document.getElementById('cipa-acao-id').value = '';
}

// ========== CONFIGURAR FILTROS ==========

function configurarFiltrosCipa() {
    // Filtro de membros por status
    const filtroStatus = document.getElementById('cipa-filtro-status');
    if (filtroStatus) {
        filtroStatus.addEventListener('change', () => {
            const status = filtroStatus.value;
            const filtrados = status ? cipaMembros.filter(m => m.status === status) : cipaMembros;
            renderizarListaMembrosFiltrada(filtrados);
        });
    }
}

function renderizarListaMembrosFiltrada(membros) {
    const tbody = document.getElementById('cipa-membros-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    membros.forEach(membro => {
        const dataInicio = membro.dataInicioMandato?.toDate ? membro.dataInicioMandato.toDate() : new Date(membro.dataInicioMandato);
        const dataFim = membro.dataFimMandato?.toDate ? membro.dataFimMandato.toDate() : new Date(membro.dataFimMandato);
        
        const statusBadge = membro.status === 'Ativo' 
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-secondary">Inativo</span>';
        
        const tipoBadge = getTipoBadge(membro.tipo);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${membro.nome}</td>
            <td>${membro.matricula || '-'}</td>
            <td>${membro.setor || '-'}</td>
            <td>${membro.cargo || '-'}</td>
            <td>${tipoBadge}</td>
            <td>${formatarData(dataInicio)}</td>
            <td>${formatarData(dataFim)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editarMembroCipa('${membro.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirMembroCipa('${membro.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ========== EXPORTAR FUNÇÕES ==========

window.inicializarGestaoCipa = inicializarGestaoGestaoCipa;
window.carregarDadosCipa = carregarDadosCipa;
window.salvarMembroCipa = salvarMembroCipa;
window.editarMembroCipa = editarMembroCipa;
window.excluirMembroCipa = excluirMembroCipa;
window.salvarEleicaoCipa = salvarEleicaoCipa;
window.editarEleicaoCipa = editarEleicaoCipa;
window.salvarTreinamentoCipa = salvarTreinamentoCipa;
window.salvarReuniaoCipa = salvarReuniaoCipa;
window.salvarAcaoCipa = salvarAcaoCipa;
window.editarAcaoCipa = editarAcaoCipa;
window.abrirModalCipa = abrirModalCipa;
window.fecharModalCipa = fecharModalCipa;
window.abrirModalEleicaoCipa = abrirModalEleicaoCipa;
window.fecharModalEleicaoCipa = fecharModalEleicaoCipa;
window.abrirModalTreinamentoCipa = abrirModalTreinamentoCipa;
window.fecharModalTreinamentoCipa = fecharModalTreinamentoCipa;
window.abrirModalReuniaoCipa = abrirModalReuniaoCipa;
window.fecharModalReuniaoCipa = fecharModalReuniaoCipa;
window.abrirModalAcaoCipa = abrirModalAcaoCipa;
window.fecharModalAcaoCipa = fecharModalAcaoCipa;

