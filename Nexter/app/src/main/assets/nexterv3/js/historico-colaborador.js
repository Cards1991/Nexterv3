let historicoColaboradoresCache = [];
let historicoSelecionadoId = null;
let historicoCompletoCache = [];

async function inicializarHistoricoColaborador() {
    const filtroInput = document.getElementById('filtro-historico-colaborador');
    if (filtroInput) {
        filtroInput.addEventListener('input', () => renderizarListaColaboradores(filtroInput.value));
    }
    await carregarColaboradoresParaHistorico();
}

async function carregarColaboradoresParaHistorico() {
    const listaContainer = document.getElementById('lista-colaboradores-historico');
    if (!listaContainer) return;
    listaContainer.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        historicoColaboradoresCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarListaColaboradores();
    } catch (error) {
        console.error("Erro ao carregar colaboradores: ", error);
        listaContainer.innerHTML = '<div class="text-center p-3 text-danger">Erro ao carregar colaboradores.</div>';
    }
}

function renderizarListaColaboradores(filtro = '') {
    const listaContainer = document.getElementById('lista-colaboradores-historico');
    if (!listaContainer) return;

    const filtroLower = filtro.toLowerCase();
    const colaboradoresFiltrados = historicoColaboradoresCache.filter(c => c.nome && c.nome.toLowerCase().includes(filtroLower));

    if (colaboradoresFiltrados.length === 0) {
        listaContainer.innerHTML = '<div class="text-center p-3 text-muted">Nenhum colaborador encontrado.</div>';
        return;
    }

    listaContainer.innerHTML = colaboradoresFiltrados.map(c => `
        <a href="#" class="list-group-item list-group-item-action" data-id="${c.id}" onclick="selecionarColaboradorHistorico('${c.id}', this)">
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${c.nome}</h6>
            </div>
            <small class="text-muted">${c.cargo || 'Cargo não informado'}</small>
        </a>
    `).join('');
}

async function selecionarColaboradorHistorico(colaboradorId, element) {
    historicoSelecionadoId = colaboradorId;
    historicoCompletoCache = [];

    if (element) {
        document.querySelectorAll('#lista-colaboradores-historico .list-group-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
    }

    const detalhesContainer = document.getElementById('container-detalhes-historico');
    detalhesContainer.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Carregando histórico...</p></div>';
    document.getElementById('btn-imprimir-historico').disabled = true;

    try {
        const [faltas, atestados, disciplina, ocorrencias, epis] = await Promise.all([
            db.collection('faltas').where('funcionarioId', '==', colaboradorId).get(),
            db.collection('atestados').where('funcionarioId', '==', colaboradorId).get(),
            db.collection('registros_disciplinares').where('funcionarioId', '==', colaboradorId).get(),
            db.collection('ocorrencias').where('colaboradorId', '==', colaboradorId).get(),
            db.collection('consumo_epi').where('funcionarioId', '==', colaboradorId).get()
        ]);

        let historicoCompleto = [];

        faltas.forEach(doc => {
            const item = doc.data();
            if (item.data && item.data.toDate) {
                historicoCompleto.push({
                    data: item.data.toDate(),
                    tipo: 'Falta',
                    descricao: `Falta no período da ${item.periodo}. Justificativa: ${item.justificativa || 'Nenhuma'}.`,
                    icon: 'fa-calendar-times',
                    color: 'danger'
                });
            }
        });

        atestados.forEach(doc => {
            const item = doc.data();
            if (item.data_atestado && item.data_atestado.toDate) {
                historicoCompleto.push({
                    data: item.data_atestado.toDate(),
                    tipo: 'Atestado',
                    descricao: `Atestado de ${item.dias || item.duracaoValor} ${item.duracaoTipo || 'dia(s)'} - CID: ${item.cid || 'N/A'}. Médico: ${item.medico || 'N/A'}.`,
                    icon: 'fa-file-medical',
                    color: 'warning'
                });
            }
        });

        disciplina.forEach(doc => {
            const item = doc.data();
            if (item.data && item.data.toDate) {
                historicoCompleto.push({
                    data: item.data.toDate(),
                    tipo: 'Controle Disciplinar',
                    descricao: `Medida: ${item.tipo}. Motivo: ${item.ocorrencia}`,
                    icon: 'fa-exclamation-triangle',
                    color: 'dark'
                });
            }
        });

        ocorrencias.forEach(doc => {
            const item = doc.data();
            if (item.data && item.data.toDate) {
                historicoCompleto.push({
                    data: item.data.toDate(),
                    tipo: 'Ocorrência de Saúde',
                    descricao: `Tipo: ${item.tipo}. Descrição: ${item.descricao}`,
                    icon: 'fa-heartbeat',
                    color: 'info'
                });
            }
        });

        epis.forEach(doc => {
            const item = doc.data();
            if (item.data && item.data.toDate) {
                historicoCompleto.push({
                    data: item.data.toDate(),
                    tipo: 'Entrega de EPI',
                    descricao: `Recebeu ${item.quantidade}x ${item.epiNome}. Responsável: ${item.responsavelNome || 'N/A'}.`,
                    icon: 'fa-hard-hat',
                    color: 'success'
                });
            }
        });

        historicoCompleto.sort((a, b) => a.data - b.data);
        historicoCompletoCache = historicoCompleto;

        renderizarTimelineHistorico(historicoCompleto);
        document.getElementById('btn-imprimir-historico').disabled = false;

    } catch (error) {
        console.error("Erro ao buscar histórico: ", error);
        detalhesContainer.innerHTML = '<div class="text-center p-5 text-danger">Erro ao carregar histórico.</div>';
    }
}

function renderizarTimelineHistorico(historico) {
    const detalhesContainer = document.getElementById('container-detalhes-historico');
    if (historico.length === 0) {
        detalhesContainer.innerHTML = '<div class="text-center text-muted p-5"><i class="fas fa-folder-open fa-3x mb-3"></i><h5>Nenhum registro encontrado para este colaborador.</h5></div>';
        return;
    }

    let timelineHTML = '<div class="timeline">';
    historico.forEach(item => {
        timelineHTML += `
            <div class="timeline-item">
                <div class="timeline-icon bg-${item.color}"><i class="fas ${item.icon}"></i></div>
                <div class="timeline-content">
                    <h6 class="mb-1">${item.tipo} <span class="text-muted small float-end">${item.data.toLocaleDateString('pt-BR')}</span></h6>
                    <p class="mb-0 small">${item.descricao}</p>
                </div>
            </div>
        `;
    });
    timelineHTML += '</div>';

    detalhesContainer.innerHTML = timelineHTML;
}

async function imprimirHistoricoColaborador() {
    if (!historicoSelecionadoId) {
        mostrarMensagem('Selecione um colaborador primeiro.', 'warning');
        return;
    }

    const colaborador = historicoColaboradoresCache.find(c => c.id === historicoSelecionadoId);
    const timelineContainer = document.getElementById('container-detalhes-historico');
    const timelineHTML = timelineContainer.innerHTML;

    const conteudo = `
        <html>
        <head>
            <title>Histórico - ${colaborador.nome}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                body { padding: 2rem; font-family: 'Segoe UI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
                .report-header { text-align: center; border-bottom: 2px solid #dee2e6; padding-bottom: 1rem; margin-bottom: 2rem; }
                .timeline { position: relative; padding-left: 1rem; }
                .timeline::before { content: ''; position: absolute; left: 12px; top: 5px; bottom: 5px; width: 2px; background: #e9ecef; }
                .timeline-item { position: relative; margin-bottom: 1.5rem; }
                .timeline-icon { position: absolute; left: 0; top: 0; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; }
                .timeline-content { margin-left: 3rem; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h2>Histórico do Colaborador</h2>
                <h4>${colaborador.nome}</h4>
                <p class="text-muted">${colaborador.cargo || ''} - ${colaborador.setor || ''}</p>
            </div>
            ${timelineHTML}
        </body>
        </html>
    `;

    openPrintWindow(conteudo, { autoPrint: true });
}