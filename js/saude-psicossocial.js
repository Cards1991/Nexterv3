// ========================================
// Módulo: Gestão de Saúde Psicossocial
// Autor: Gemini Code Assist
// ========================================

let psicoChartInstance = null;

async function inicializarSaudePsicossocial() {
    console.log("Inicializando Gestão de Saúde Psicossocial...");
    await carregarDadosPsicossociais();
}

let __casos_psico_cache = [];
let __todos_atestados_psico_cache = [];


/**
 * Carrega todos os atestados com CIDs psicossociais e renderiza a seção.
 */
async function carregarDadosPsicossociais() {
    const tbody = document.getElementById('tabela-casos-psicossociais');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando casos...</td></tr>';

    try {
        // Busca todos os atestados
        const atestadosSnap = await db.collection('atestados').orderBy('data_atestado', 'asc').get();

        // Filtra no lado do cliente para CIDs psicossociais
        __todos_atestados_psico_cache = atestadosSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(atestado => isCidPsicossocial(atestado.cid));

        // Agrupa os atestados por funcionário para criar "casos"
        const casosPorFuncionario = __todos_atestados_psico_cache.reduce((acc, atestado) => {
            const funcId = atestado.funcionarioId;
            if (!funcId) return acc; // Ignora atestados sem ID de funcionário
            if (!acc[funcId]) {
                acc[funcId] = {
                    idCaso: atestado.id, // O ID do primeiro atestado se torna o ID do caso
                    funcionarioId: funcId,
                    colaborador_nome: atestado.colaborador_nome,
                    primeiroAtestado: atestado.data_atestado,
                    ultimoAtestado: atestado.data_atestado,
                    totalDias: 0,
                    atestados: []
                };
            }
            acc[funcId].atestados.push(atestado);
            acc[funcId].ultimoAtestado = atestado.data_atestado;
            acc[funcId].totalDias += (atestado.dias || 0);
            return acc;
        }, {});

        __casos_psico_cache = Object.values(casosPorFuncionario);

        if (__casos_psico_cache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum caso psicossocial registrado.</td></tr>';
            renderizarMetricasPsicossociais([], []);
            renderizarGraficoTendencia(__todos_atestados_psico_cache);
            return;
        }

        renderizarTabelaPsicossocial(tbody, __casos_psico_cache);
        renderizarMetricasPsicossociais(__casos_psico_cache, __todos_atestados_psico_cache);
        renderizarGraficoTendencia(__todos_atestados_psico_cache);

    } catch (error) {
        console.error("Erro ao carregar dados psicossociais:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

/**
 * Renderiza a tabela com os casos psicossociais.
 * @param {HTMLElement} tbody - O corpo da tabela.
 * @param {Array} casos - A lista de casos a serem exibidos.
 */
function renderizarTabelaPsicossocial(tbody, casos) {
    tbody.innerHTML = '';
    // Ordena os casos pelo atestado mais recente
    casos.sort((a, b) => b.ultimoAtestado.seconds - a.ultimoAtestado.seconds);

    casos.forEach(casoConsolidado => {
        const primeiroAtestado = casoConsolidado.atestados[0];
        const estagio = primeiroAtestado.investigacaoPsicossocial?.estagio || 'Não iniciado';
        let corBadge = 'bg-secondary';
        if (estagio === 'Análise Inicial' || estagio === 'Conversa Agendada') corBadge = 'bg-warning text-dark';
        if (estagio === 'Conversado com Funcionário' || estagio === 'Plano de Ação Definido') corBadge = 'bg-info text-dark';
        if (estagio === 'Caso Encerrado') corBadge = 'bg-success';

        const row = `
            <tr>
                <td>${casoConsolidado.colaborador_nome || 'N/A'} <span class="badge bg-primary ms-2">${casoConsolidado.atestados.length} atestado(s)</span></td>
                <td><span class="badge bg-danger">${casoConsolidado.atestados[casoConsolidado.atestados.length - 1].cid || 'N/A'}</span></td>
                <td>${formatarData(casoConsolidado.primeiroAtestado)}</td>
                <td>${casoConsolidado.totalDias}</td>
                <td><span class="badge ${corBadge}">${estagio}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-primary" onclick="abrirModalAcompanhamentoPsicossocial('${casoConsolidado.idCaso}')" title="Iniciar/Ver Acompanhamento">
                        <i class="fas fa-clipboard-check"></i> Acompanhar
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

/**
 * Calcula e renderiza os KPIs (indicadores) da seção.
 * @param {Array} casos - A lista de casos.
 * @param {Array} todosAtestados - A lista de todos os atestados psicossociais.
 */
function renderizarMetricasPsicossociais(casos, todosAtestados) {
    const totalCasosEl = document.getElementById('psico-kpi-total-casos');
    const casosAbertosEl = document.getElementById('psico-kpi-casos-abertos');
    const mediaDiasEl = document.getElementById('psico-kpi-media-dias');

    if (!totalCasosEl || !casosAbertosEl || !mediaDiasEl) return;

    const totalCasos = todosAtestados.length;
    const casosAbertos = casos.filter(c => {
        const primeiroAtestado = c.atestados[0];
        return primeiroAtestado.investigacaoPsicossocial?.estagio !== 'Caso Encerrado';
    }).length;
    
    const totalDias = todosAtestados.reduce((acc, atestado) => acc + (atestado.dias || 0), 0);
    const mediaDias = totalCasos > 0 ? (totalDias / totalCasos).toFixed(1) : '0.0';

    totalCasosEl.textContent = casos.length; // Mostra o número de colaboradores únicos
    casosAbertosEl.textContent = casosAbertos;
    mediaDiasEl.textContent = mediaDias;
}

/**
 * Renderiza o gráfico de tendência de casos ao longo do tempo.
 * @param {Array} casos - A lista de casos.
 */
function renderizarGraficoTendencia(casos) {
    const ctx = document.getElementById('grafico-tendencia-psicossocial')?.getContext('2d');
    if (!ctx) return;

    // Agrupar casos por mês nos últimos 6 meses
    const dadosPorMes = {};
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const chave = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        dadosPorMes[chave] = 0;
    }

    casos.forEach(caso => {
        const dataAtestado = caso.data_atestado?.toDate ? caso.data_atestado.toDate() : new Date(caso.data_atestado);
        const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
        
        if (dataAtestado >= seisMesesAtras) {
            const chave = dataAtestado.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            if (dadosPorMes.hasOwnProperty(chave)) {
                dadosPorMes[chave]++;
            }
        }
    });

    const labels = Object.keys(dadosPorMes);
    const data = Object.values(dadosPorMes);

    if (psicoChartInstance) {
        psicoChartInstance.destroy();
    }

    psicoChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Casos Psicossociais',
                data: data,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Garante que o eixo Y mostre apenas números inteiros
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Função auxiliar para verificar se um CID é psicossocial.
 * @param {string} cid - O código CID.
 * @returns {boolean}
 */
function isCidPsicossocial(cid) {
    if (!cid) return false;
    const cidUpper = cid.toUpperCase().trim();
    return cidUpper.startsWith('F') || cidUpper.startsWith('Z65');
}

// Função auxiliar para formatar data (pode ser movida para utils.js se necessário)
function formatarData(data) {
    if (!data) return 'N/A';
    const dateObj = data.toDate ? data.toDate() : new Date(data);
    return dateObj.toLocaleDateString('pt-BR');
}

/**
 * Abre o modal de acompanhamento psicossocial para um caso específico (agrupado por funcionário).
 * @param {string} casoId O ID do primeiro atestado que iniciou o caso.
 */
async function abrirModalAcompanhamentoPsicossocial(casoId) {
    const modalEl = document.getElementById('acompanhamentoPsicossocialModal');
    if (!modalEl) return;

    // Encontra o caso consolidado no cache
    const casoConsolidado = __casos_psico_cache.find(c => c.idCaso === casoId);
    if (!casoConsolidado) {
        mostrarMensagem("Caso não encontrado no cache. Tente recarregar a página.", "error");
        return;
    }

    const primeiroAtestado = casoConsolidado.atestados[0];
    const investigacao = primeiroAtestado.investigacaoPsicossocial || {};

    // Preenche os dados no modal
    document.getElementById('psico-atestado-id').value = casoId; // O ID do caso é o ID do primeiro atestado
    document.getElementById('psico-nome-funcionario').textContent = casoConsolidado.colaborador_nome;
    document.getElementById('psico-cid-atestado').textContent = primeiroAtestado.cid;

    // Popula o select de atribuição
    await popularSelectUsuariosPsico('psico-atribuir-para');

    // Limpa o formulário para uma nova entrada
    document.getElementById('psico-observacoes').value = '';
    document.getElementById('psico-atribuir-para').value = investigacao.atribuidoParaId || '';
    document.getElementById('psico-estagio').value = investigacao.estagio || 'Análise Inicial';

    // Constrói o histórico consolidado
    const historicoContainer = document.getElementById('psico-historico-container');
    historicoContainer.innerHTML = '<p class="text-muted small">Carregando histórico...</p>';

    // 1. Adiciona todos os atestados do caso ao histórico
    const historicoAtestados = casoConsolidado.atestados.map(atestado => ({
        tipo: 'atestado',
        data: atestado.data_atestado.toDate(),
        texto: `Atestado de ${atestado.dias} dia(s) recebido (CID: ${atestado.cid}).`
    }));

    // 2. Adiciona as anotações de acompanhamento
    const historicoAcompanhamento = (investigacao.historico || []).map(item => ({
        tipo: 'acompanhamento',
        data: item.data.toDate(),
        texto: `<strong>${item.estagio}:</strong> ${escapeHTML(item.observacoes)} <br><small class="text-muted">Por: ${item.responsavelNome || 'Usuário'}</small>`
    }));

    // 3. Combina, ordena e renderiza
    const historicoCompleto = [...historicoAtestados, ...historicoAcompanhamento].sort((a, b) => b.data - a.data);

    if (historicoCompleto.length > 0) {
        historicoContainer.innerHTML = historicoCompleto.map(item => {
            const corIcone = item.tipo === 'atestado' ? 'text-danger' : 'text-primary';
            const icone = item.tipo === 'atestado' ? 'fa-file-medical' : 'fa-clipboard-check';
            return `
                <div class="p-2 border-bottom d-flex">
                    <div class="me-3 pt-1"><i class="fas ${icone} ${corIcone}"></i></div>
                    <div>
                        <p class="mb-1">${item.texto}</p>
                        <small class="text-muted">${item.data.toLocaleString('pt-BR')}</small>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        historicoContainer.innerHTML = '<p class="text-muted small">Nenhum registro no histórico.</p>';
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}