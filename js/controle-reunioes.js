// =================================================================
// Módulo: Controle de Reuniões
// =================================================================

// Estado global do módulo
let __reunioes_cache = [];
let __reunioes_charts = {};
let __reunioes_usuarios_cache = [];

/**
 * Ponto de entrada principal para o módulo de Controle de Reuniões.
 */
async function inicializarControleReunioes() {
    console.log("Inicializando Controle de Reuniões...");
    await carregarCacheDeUsuarios();
    await carregarDadosReunioes();
    configurarFiltrosReunioes();
}

/**
 * Carrega e armazena em cache a lista de usuários para preencher selects.
 */
async function carregarCacheDeUsuarios() {
    if (__reunioes_usuarios_cache.length > 0) return;
    try {
        const snapshot = await db.collection('usuarios').orderBy('nome').get();
        __reunioes_usuarios_cache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erro ao carregar usuários para o cache:", error);
    }
}

/**
 * Configura os listeners para os filtros da tela de histórico.
 */
function configurarFiltrosReunioes() {
    const btnFiltrar = document.getElementById('reunioes-btn-filtrar');
    if (btnFiltrar && !btnFiltrar.dataset.listener) {
        btnFiltrar.addEventListener('click', carregarDadosReunioes);
        btnFiltrar.dataset.listener = 'true';
    }
}

/**
 * Carrega os dados das reuniões do Firestore e atualiza a UI.
 */
async function carregarDadosReunioes() {
    const tbody = document.getElementById('tabela-historico-reunioes');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando reuniões...</td></tr>';

    try {
        // Aplicação de filtros
        const dataInicio = document.getElementById('reunioes-filtro-data')?.value;
        const responsavel = document.getElementById('reunioes-filtro-responsavel')?.value;
        const tipo = document.getElementById('reunioes-filtro-tipo')?.value;

        let query = db.collection('reunioes');

        if (dataInicio) {
            query = query.where('data', '>=', new Date(dataInicio));
        }
        if (responsavel) {
            query = query.where('responsavelId', '==', responsavel);
        }
        if (tipo) {
            query = query.where('tipo', '==', tipo);
        }

        const snapshot = await query.orderBy('data', 'desc').get();
        __reunioes_cache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderizarHistoricoReunioes(__reunioes_cache);
        renderizarDashboardReunioes(__reunioes_cache);

    } catch (error) {
        console.error("Erro ao carregar reuniões:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

/**
 * Renderiza a tabela de histórico de reuniões.
 * @param {Array} reunioes - Lista de reuniões a serem exibidas.
 */
function renderizarHistoricoReunioes(reunioes) {
    const tbody = document.getElementById('tabela-historico-reunioes');
    if (reunioes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma reunião encontrada.</td></tr>';
        return;
    }

    tbody.innerHTML = reunioes.map(reuniao => {
        const dataReuniao = reuniao.data?.toDate ? reuniao.data.toDate().toLocaleDateString('pt-BR') : 'N/A';
        const status = reuniao.finalizada ? '<span class="badge bg-success">Finalizada</span>' : '<span class="badge bg-warning text-dark">Em Aberto</span>';
        return `
            <tr>
                <td>${dataReuniao}</td>
                <td>${reuniao.titulo || 'N/A'}</td>
                <td>${reuniao.responsavelNome || 'N/A'}</td>
                <td>${status}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info" onclick="visualizarReuniao('${reuniao.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirModalReuniao('${reuniao.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirReuniao('${reuniao.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Renderiza os KPIs e gráficos do dashboard.
 * @param {Array} reunioes - Lista de reuniões para análise.
 */
function renderizarDashboardReunioes(reunioes) {
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();

    const reunioesMes = reunioes.filter(r => {
        const data = r.data?.toDate();
        return data && data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
    }).length;

    // Lógica para tarefas (precisaria buscar a subcoleção de tarefas de cada reunião)
    // Por simplicidade, vamos deixar como 0 por enquanto.
    const tarefasAbertas = 0;
    const tarefasAtrasadas = 0;

    document.getElementById('reunioes-kpi-mes').textContent = reunioesMes;
    document.getElementById('reunioes-kpi-tarefas-abertas').textContent = tarefasAbertas;
    document.getElementById('reunioes-kpi-tarefas-atrasadas').textContent = tarefasAtrasadas;

    // Gráfico de reuniões por tipo
    const porTipo = reunioes.reduce((acc, r) => {
        const tipo = r.tipo || 'Outro';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});
    renderizarGraficoReunioes('reunioes-chart-tipo', 'doughnut', porTipo, 'Reuniões por Tipo');
}

/**
 * Função genérica para renderizar um gráfico.
 */
function renderizarGraficoReunioes(canvasId, tipoGrafico, dados, titulo) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (__reunioes_charts[canvasId]) {
        __reunioes_charts[canvasId].destroy();
    }

    __reunioes_charts[canvasId] = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: Object.keys(dados),
            datasets: [{
                label: titulo,
                data: Object.values(dados),
                backgroundColor: ['#0d6efd', '#6f42c1', '#20c997', '#ffc107', '#fd7e14'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: tipoGrafico === 'doughnut' ? 'right' : 'top',
                }
            }
        }
    });
}

/**
 * Abre o modal para criar ou editar uma reunião.
 * @param {string|null} reuniaoId - O ID da reunião para editar, ou null para criar uma nova.
 */
async function abrirModalReuniao(reuniaoId = null) {
    const modalEl = document.getElementById('reuniaoModal');
    const form = document.getElementById('form-reuniao');
    form.reset();
    document.getElementById('reuniao-id').value = reuniaoId || '';

    // Popula select de responsáveis
    const respSelect = document.getElementById('reuniao-responsavel');
    respSelect.innerHTML = '<option value="">Selecione...</option>';
    __reunioes_usuarios_cache.forEach(user => {
        respSelect.innerHTML += `<option value="${user.id}" data-nome="${user.nome}">${user.nome}</option>`;
    });

    if (reuniaoId) {
        // Modo Edição
        const reuniao = __reunioes_cache.find(r => r.id === reuniaoId);
        if (reuniao) {
            document.getElementById('reuniao-titulo').value = reuniao.titulo;
            document.getElementById('reuniao-data').value = reuniao.data?.toDate().toISOString().split('T')[0];
            document.getElementById('reuniao-hora-inicio').value = reuniao.horaInicio;
            document.getElementById('reuniao-hora-fim').value = reuniao.horaFim;
            document.getElementById('reuniao-local').value = reuniao.local;
            document.getElementById('reuniao-tipo').value = reuniao.tipo;
            respSelect.value = reuniao.responsavelId;
            document.getElementById('reuniao-pauta').value = reuniao.pauta;
            document.getElementById('reuniao-ata').value = reuniao.ata || '';
        }
    } else {
        // Modo Criação
        document.getElementById('reuniao-data').valueAsDate = new Date();
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Salva os dados da reunião (criação ou atualização).
 */
async function salvarReuniao() {
    const reuniaoId = document.getElementById('reuniao-id').value;
    const respSelect = document.getElementById('reuniao-responsavel');

    const dados = {
        titulo: document.getElementById('reuniao-titulo').value,
        data: new Date(document.getElementById('reuniao-data').value),
        horaInicio: document.getElementById('reuniao-hora-inicio').value,
        horaFim: document.getElementById('reuniao-hora-fim').value,
        local: document.getElementById('reuniao-local').value,
        tipo: document.getElementById('reuniao-tipo').value,
        responsavelId: respSelect.value,
        responsavelNome: respSelect.options[respSelect.selectedIndex].dataset.nome,
        pauta: document.getElementById('reuniao-pauta').value,
        ata: document.getElementById('reuniao-ata').value,
        finalizada: document.getElementById('reuniao-finalizada')?.checked || false,
    };

    if (!dados.titulo || !dados.data || !dados.responsavelId) {
        mostrarMensagem("Título, Data e Responsável são obrigatórios.", "warning");
        return;
    }

    try {
        if (reuniaoId) {
            await db.collection('reunioes').doc(reuniaoId).update(dados);
            mostrarMensagem("Reunião atualizada com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('reunioes').add(dados);
            mostrarMensagem("Reunião registrada com sucesso!", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById('reuniaoModal')).hide();
        await carregarDadosReunioes();
    } catch (error) {
        console.error("Erro ao salvar reunião:", error);
        mostrarMensagem("Erro ao salvar reunião.", "error");
    }
}

/**
 * Exclui uma reunião do Firestore.
 * @param {string} reuniaoId - O ID da reunião a ser excluída.
 */
async function excluirReuniao(reuniaoId) {
    if (!confirm("Tem certeza que deseja excluir esta reunião e todas as suas tarefas?")) return;

    try {
        // Excluir subcoleção de tarefas (se houver)
        const tarefasSnap = await db.collection('reunioes').doc(reuniaoId).collection('tarefas').get();
        const batch = db.batch();
        tarefasSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Excluir o documento principal da reunião
        await db.collection('reunioes').doc(reuniaoId).delete();

        mostrarMensagem("Reunião excluída com sucesso!", "success");
        await carregarDadosReunioes();
    } catch (error) {
        console.error("Erro ao excluir reunião:", error);
        mostrarMensagem("Erro ao excluir reunião.", "error");
    }
}

/**
 * Visualiza os detalhes de uma reunião. Reutiliza o modal de edição.
 * @param {string} reuniaoId - O ID da reunião para visualizar.
 */
function visualizarReuniao(reuniaoId) {
    abrirModalReuniao(reuniaoId);
}

// Exportar funções para o escopo global
window.inicializarControleReunioes = inicializarControleReunioes;
window.abrirModalReuniao = abrirModalReuniao;
window.salvarReuniao = salvarReuniao;
window.excluirReuniao = excluirReuniao;
window.visualizarReuniao = visualizarReuniao;
// ... outras funções que precisam ser chamadas pelo HTML