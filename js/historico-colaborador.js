// js/historico-colaborador.js - v1.1 (Printing implemented)

let __colaboradores_cache = [];
let __all_history_cache = {}; // Cache para o histórico de cada colaborador
let __current_funcionario_id = null;

document.addEventListener('DOMContentLoaded', () => {
    // A inicialização agora é chamada a partir do app.js quando a seção é exibida
});

/**
 * Ponto de entrada principal para a funcionalidade de Histórico do Colaborador.
 * Chamado pelo app.js quando a aba é selecionada.
 */
async function inicializarHistoricoColaborador() {
    console.log(">>> [DEBUG] Inicializando Histórico do Colaborador...");
    const btnImprimir = document.getElementById('btn-imprimir-historico');
    if (btnImprimir) {
        console.log(">>> [DEBUG] Botão de impressão encontrado no DOM.");
    } else {
        console.error(">>> [DEBUG] Botão de impressão NÃO encontrado no DOM!");
    }
    setupEventListeners();
    await fetchAndRenderCollaborators();
}

/**
 * Configura os event listeners para a página.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-colaborador');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.dataset.listenerAttached = 'true';
    }
}

/**
 * Busca todos os colaboradores (ativos e inativos) do Firestore e os renderiza na lista.
 */
async function fetchAndRenderCollaborators() {
    const listContainer = document.getElementById('colaboradores-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p class="text-center text-muted">Carregando colaboradores...</p>';

    try {
        const snapshot = await db.collection('funcionarios').get();
        let collaborators = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort collaborators by name client-side
        collaborators.sort((a, b) => a.nome.localeCompare(b.nome));

        __colaboradores_cache = collaborators;

        if (__colaboradores_cache.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-muted">Nenhum colaborador encontrado.</p>';
            return;
        }
        
        renderCollaboratorList(__colaboradores_cache);

    } catch (error) {
        console.error("Erro ao buscar colaboradores:", error);
        listContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar colaboradores.</p>';
    }
}

/**
 * Renderiza a lista de colaboradores na UI.
 * @param {Array} collaborators - A lista de colaboradores a ser renderizada.
 */
function renderCollaboratorList(collaborators) {
    const listContainer = document.getElementById('colaboradores-list');
    if (!listContainer) return;

    listContainer.innerHTML = collaborators.map(colab => {
        const statusClass = colab.status === 'Ativo' ? 'bg-success' : 'bg-danger';
        const inicial = colab.nome.charAt(0).toUpperCase();
        
        return `
            <a href="#" class="list-group-item list-group-item-action border-0 mb-2 rounded shadow-sm py-3 px-3 collaborator-item" data-id="${colab.id}">
                <div class="d-flex align-items-center">
                    <div class="avatar-circle me-3 bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--bs-primary-border-subtle);">
                        ${inicial}
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="mb-0 text-truncate fw-bold" title="${colab.nome}">${colab.nome}</h6>
                            <span class="badge ${statusClass} rounded-pill" style="font-size: 0.65rem;">${colab.status}</span>
                        </div>
                        <div class="text-muted small text-truncate">
                            <i class="fas fa-briefcase me-1 opacity-50"></i> ${colab.cargo || 'Cargo não informado'}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }).join('');

    // Adiciona event listeners a cada item da lista
    listContainer.querySelectorAll('.list-group-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedId = item.dataset.id;
            
            // Remove a classe 'active' de todos os outros itens
            listContainer.querySelectorAll('.list-group-item').forEach(i => i.classList.remove('active'));
            // Adiciona a classe 'active' ao item clicado
            item.classList.add('active');

            showCollaboratorHistory(selectedId);
        });
    });
}

/**
 * Filtra a lista de colaboradores com base no texto de pesquisa.
 */
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filtered = __colaboradores_cache.filter(colab => 
        colab.nome.toLowerCase().includes(searchTerm)
    );
    renderCollaboratorList(filtered);
}

/**
 * Busca e exibe o histórico completo de um colaborador.
 * @param {string} funcionarioId - O ID do colaborador.
 */
async function showCollaboratorHistory(funcionarioId) {
    const timelineContainer = document.getElementById('historico-timeline');
    const header = document.getElementById('historico-header');
    
    if (!timelineContainer || !header) return;

    const colaborador = __colaboradores_cache.find(c => c.id === funcionarioId);
    if (colaborador) {
        header.innerHTML = `<i class="fas fa-history me-2"></i>Histórico de ${colaborador.nome}`;
    }

    __current_funcionario_id = funcionarioId;
    const btnImprimir = document.getElementById('btn-imprimir-historico');
    if (btnImprimir) btnImprimir.disabled = false;

    timelineContainer.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando histórico...</span></div></div>';

    // Verifica o cache primeiro
    if (__all_history_cache[funcionarioId]) {
        renderTimeline(__all_history_cache[funcionarioId]);
        return;
    }

    try {
        const sortedHistory = await getCollaboratorHistoryData(funcionarioId);
        renderDashboard(sortedHistory);
        renderTimeline(sortedHistory);
    } catch (error) {
        console.error("Erro ao buscar histórico do colaborador:", error);
        timelineContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar o histórico.</p>';
    }
}

/**
 * Busca os dados de histórico de um colaborador no Firestore.
 */
async function getCollaboratorHistoryData(funcionarioId) {
    if (__all_history_cache[funcionarioId]) {
        return __all_history_cache[funcionarioId];
    }

    const collections = {
        atestados: 'atestados',
        faltas: 'faltas',
        disciplinar: 'registros_disciplinares',
        alteracoes: 'alteracoes_funcao',
        epi: 'epi_consumo',
        avaliacoes: 'avaliacoes_colaboradores',
        movimentacoes: 'movimentacoes'
    };

    const ocorrenciasPromise = db.collection('ocorrencias_saude').where('colaboradorId', '==', funcionarioId).get();
    const otherPromises = Object.values(collections).map(col => 
        db.collection(col).where('funcionarioId', '==', funcionarioId).get()
    );

    const [
        ocorrenciasSnap, atestadosSnap, faltasSnap, disciplinarSnap, 
        alteracoesSnap, epiSnap, avaliacoesSnap, movimentacoesSnap
    ] = await Promise.all([ocorrenciasPromise, ...otherPromises]);

    let combinedHistory = [];

    // Ocorrências
    ocorrenciasSnap.forEach(doc => {
        const data = doc.data();
        combinedHistory.push({
            date: (data.data || data.dataOcorrencia)?.toDate(),
            type: 'Ocorrência', category: 'Ocorrência',
            icon: 'fa-exclamation-circle', color: 'info',
            description: data.descricao || `Tipo: ${data.tipo}`
        });
    });
    
    // Atestados
    atestadosSnap.forEach(doc => {
        const data = doc.data();
        const isAccident = data.tipo && data.tipo.toLowerCase().includes('acidente');
        combinedHistory.push({
            date: (data.data_atestado)?.toDate(),
            type: isAccident ? 'Acidente (Atestado)' : 'Atestado', category: 'Atestado',
            icon: isAccident ? 'fa-user-injured' : 'fa-file-medical-alt', color: isAccident ? 'danger' : 'warning',
            description: `<strong>${data.tipo}</strong>: ${data.dias || data.duracaoValor || ''} ${data.duracaoTipo || 'dias'}. ${data.cid ? `CID: ${data.cid}` : ''}`
        });
    });

    // Faltas
    const faltasPorDia = new Map();
    faltasSnap.forEach(doc => {
        const data = doc.data();
        const dateObj = data.data?.toDate();
        if (!dateObj) return;
        
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        if (!faltasPorDia.has(dateStr)) {
            faltasPorDia.set(dateStr, {
                date: dateObj, type: 'Falta', category: 'Falta',
                icon: 'fa-calendar-times', color: 'danger',
                isJustificada: !!(data.justificada === true || (data.justificativa && data.justificativa !== '' && data.justificativa !== 'Não informado')),
                justificativas: new Set(data.justificativa && data.justificativa !== 'Não informado' ? [data.justificativa] : [])
            });
        } else {
            const f = faltasPorDia.get(dateStr);
            if (data.justificada === true) f.isJustificada = true;
            if (data.justificativa && data.justificativa !== 'Não informado') {
                f.justificativas.add(data.justificativa);
                f.isJustificada = true;
            }
        }
    });

    faltasPorDia.forEach(falta => {
        let justificativasStr = Array.from(falta.justificativas).join(', ');
        let tipo = falta.type;
        
        if (falta.isJustificada && justificativasStr) {
            tipo = justificativasStr;
            falta.color = 'warning'; falta.icon = 'fa-calendar-check';
        } else if (falta.isJustificada) {
            tipo = 'Falta Justificada';
            falta.color = 'warning'; falta.icon = 'fa-calendar-check';
        }
        
        combinedHistory.push({
            ...falta, type: tipo,
            description: falta.isJustificada ? `Falta justificada. Motivo: ${justificativasStr || 'Não especificado'}` : `Falta injustificada / Não informado`
        });
    });

    // Medidas Disciplinares
    disciplinarSnap.forEach(doc => {
        const data = doc.data();
        combinedHistory.push({
            date: (data.dataOcorrencia)?.toDate(),
            type: 'Medida Disciplinar', category: 'Medida Disciplinar',
            icon: 'fa-gavel', color: 'primary',
            description: `<strong>${data.medidaAplicada}</strong>: ${data.descricao}`
        });
    });
    
    // Alterações de Função
    alteracoesSnap.forEach(doc => {
         const data = doc.data();
         combinedHistory.push({
            date: (data.data_alteracao)?.toDate(),
            type: 'Promoção/Alteração',
            icon: 'fa-level-up-alt', color: 'success',
            description: `De <strong>${data.cargo_anterior}</strong> para <strong>${data.novo_cargo}</strong>. Motivo: ${data.motivo}`
         });
    });

    // Entregas de EPI
    epiSnap.forEach(doc => {
        const data = doc.data();
        combinedHistory.push({
            date: (data.dataEntrega)?.toDate(),
            type: 'Entrega de EPI',
            icon: 'fa-hard-hat', color: 'secondary',
            description: `Recebeu ${data.quantidade || 1}x <strong>${data.epiDescricao || 'EPI não especificado'}</strong>. Motivo: ${data.motivo || 'N/A'}`
        });
    });

    // Avaliações ISO
    avaliacoesSnap.forEach(doc => {
        const data = doc.data();
        combinedHistory.push({
            date: (data.dataAvaliacao)?.toDate(),
            type: 'Avaliação ISO',
            icon: 'fa-star', color: 'purple',
            description: `Recebeu nota <strong>${data.nota}</strong>. Avaliador: ${data.avaliadorEmail || 'N/A'}.`
        });
    });

    // Movimentações
    movimentacoesSnap.forEach(doc => {
        const data = doc.data();
        if (data.tipo === 'demissao') {
            combinedHistory.push({
                date: (data.data)?.toDate(),
                type: 'Rescisão / Desligamento',
                icon: 'fa-user-slash', color: 'danger',
                description: `<strong>${data.motivo}</strong>: ${data.motivoDetalhado || ''}. ${data.detalhes ? `<br><small class="text-muted">Observações: ${data.detalhes}</small>` : ''}`
            });
        } else if (data.tipo === 'admissao') {
            combinedHistory.push({
                date: (data.data)?.toDate(),
                type: 'Admissão',
                icon: 'fa-user-plus', color: 'success',
                description: `<strong>Admissão registrada</strong> no setor <strong>${data.setor}</strong> como <strong>${data.cargo}</strong>.`
            });
        }
    });

    const sortedHistory = combinedHistory
        .filter(item => item.date && !isNaN(item.date))
        .sort((a, b) => b.date - a.date);

    __all_history_cache[funcionarioId] = sortedHistory;
    return sortedHistory;
}

/**
 * Renderiza o dashboard resumo do histórico do colaborador.
 * @param {Array} history - O array de histórico ordenado.
 */
function renderDashboard(history) {
    const dashboardContainer = document.getElementById('historico-dashboard');
    if (!dashboardContainer) return;

    if (history.length === 0) {
        dashboardContainer.classList.add('d-none');
        return;
    }

    dashboardContainer.innerHTML = generateDashboardHTML(history);
    dashboardContainer.classList.remove('d-none');
}

function generateDashboardHTML(history) {
    let atestados = 0, faltas = 0, faltasJustificadas = 0, medidas = 0, ocorrencias = 0;
    history.forEach(item => {
        if (item.category === 'Atestado' || item.type === 'Atestado' || item.type === 'Acidente (Atestado)') atestados++;
        if (item.category === 'Falta' || item.type === 'Falta') {
            if (item.isJustificada) faltasJustificadas++;
            else faltas++;
        }
        if (item.category === 'Medida Disciplinar' || item.type === 'Medida Disciplinar') medidas++;
        if (item.category === 'Ocorrência' || item.type === 'Ocorrência') ocorrencias++;
    });

    return `
        <div class="col-md col-sm-6 mb-3">
            <div class="card border-0 shadow-sm bg-warning bg-opacity-10 h-100" style="transition: transform 0.2s; border-radius: 12px;">
                <div class="card-body text-center p-3">
                    <i class="fas fa-file-medical-alt text-warning fa-2x mb-2"></i>
                    <h4 class="mb-0 text-dark fw-bold">${atestados}</h4>
                    <span class="small text-muted fw-semibold">Atestados</span>
                </div>
            </div>
        </div>
        <div class="col-md col-sm-6 mb-3">
            <div class="card border-0 shadow-sm bg-danger bg-opacity-10 h-100" style="transition: transform 0.2s; border-radius: 12px;">
                <div class="card-body text-center p-3">
                    <i class="fas fa-calendar-times text-danger fa-2x mb-2"></i>
                    <h4 class="mb-0 text-dark fw-bold">${faltas}</h4>
                    <span class="small text-muted fw-semibold">Faltas</span>
                </div>
            </div>
        </div>
        <div class="col-md col-sm-6 mb-3">
            <div class="card border-0 shadow-sm h-100" style="background-color: rgba(253, 126, 20, 0.1) !important; transition: transform 0.2s; border-radius: 12px;">
                <div class="card-body text-center p-3">
                    <i class="fas fa-calendar-check fa-2x mb-2" style="color: #fd7e14;"></i>
                    <h4 class="mb-0 text-dark fw-bold">${faltasJustificadas}</h4>
                    <span class="small text-muted fw-semibold">Faltas Justif.</span>
                </div>
            </div>
        </div>
        <div class="col-md col-sm-6 mb-3">
            <div class="card border-0 shadow-sm bg-primary bg-opacity-10 h-100" style="transition: transform 0.2s; border-radius: 12px;">
                <div class="card-body text-center p-3">
                    <i class="fas fa-gavel text-primary fa-2x mb-2"></i>
                    <h4 class="mb-0 text-dark fw-bold">${medidas}</h4>
                    <span class="small text-muted fw-semibold">Medidas Discipl.</span>
                </div>
            </div>
        </div>
        <div class="col-md col-sm-6 mb-3">
            <div class="card border-0 shadow-sm bg-info bg-opacity-10 h-100" style="transition: transform 0.2s; border-radius: 12px;">
                <div class="card-body text-center p-3">
                    <i class="fas fa-exclamation-circle text-info fa-2x mb-2"></i>
                    <h4 class="mb-0 text-dark fw-bold">${ocorrencias}</h4>
                    <span class="small text-muted fw-semibold">Ocorrências</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderiza o array de histórico em formato de timeline na UI.
 * @param {Array} history - O array de histórico ordenado.
 */
function renderTimeline(history) {
    const timelineContainer = document.getElementById('historico-timeline');
    if (!timelineContainer) return;

    if (history.length === 0) {
        timelineContainer.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fas fa-box-open fa-2x"></i>
                <p class="mt-2">Nenhum registro histórico encontrado para este colaborador.</p>
            </div>
        `;
        return;
    }

    timelineContainer.innerHTML = generateTimelineHTML(history);
}

function generateTimelineHTML(history) {
    if (history.length === 0) {
        return `
            <div class="text-center text-muted mt-5 p-4 bg-light rounded-4 border border-dashed">
                <i class="fas fa-box-open fa-3x mb-3 text-secondary opacity-50"></i>
                <h5>Histórico Vazio</h5>
                <p class="mb-0">Nenhum registro histórico encontrado para este colaborador.</p>
            </div>
        `;
    }

    return history.map(item => `
        <div class="timeline-item mb-4 position-relative" style="padding-left: 55px;">
            <div class="timeline-marker bg-${item.color} shadow-sm position-absolute" style="left: 0; top: 5px; width: 40px; height: 40px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; z-index: 1; border: 3px solid white;">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="timeline-card border-0 shadow-sm" style="background: white; border-radius: 12px; overflow: hidden; transition: transform 0.2s ease;">
                <div class="card-body p-0">
                    <div class="d-flex justify-content-between align-items-center px-4 py-3 bg-light rounded-top border-bottom">
                        <span class="badge bg-${item.color} bg-opacity-10 text-${item.color} fw-bold border border-${item.color} border-opacity-25 px-3 py-2 rounded-pill shadow-sm">
                            ${item.type}
                        </span>
                        <span class="text-muted small fw-bold">
                            <i class="far fa-calendar-alt me-1"></i> ${item.date.toLocaleDateString('pt-BR')}
                        </span>
                    </div>
                    <div class="p-4">
                        <div class="timeline-description text-dark" style="font-size: 1.05rem; line-height: 1.5;">
                            ${item.description}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Exibe o histórico do colaborador em um modal explosivo.
 */
async function showCollaboratorHistoryModal(funcionarioId) {
    const modalId = 'modal-explode-historico';
    let modalEl = document.getElementById(modalId);
    
    if (!modalEl) {
        const html = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true" style="backdrop-filter: blur(5px);">
                <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content border-0 shadow-lg" style="border-radius: 20px; overflow: hidden;">
                        <div class="modal-header text-white border-0 py-3 px-4" style="background: linear-gradient(135deg, #4361ee, #3f37c9);">
                            <h4 class="modal-title fw-bold d-flex align-items-center m-0" id="${modalId}-title">
                                <i class="fas fa-history me-3 fs-3 text-white-50"></i> <span id="${modalId}-title-text">Histórico do Colaborador</span>
                            </h4>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4 bg-light" id="${modalId}-body">
                            <div class="text-center p-5">
                                <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                                    <span class="visually-hidden">Carregando...</span>
                                </div>
                                <h5 class="mt-4 text-muted fw-semibold">Buscando histórico completo...</h5>
                            </div>
                        </div>
                        <div class="modal-footer border-0 bg-white px-4 py-3 shadow-sm" style="border-top: 1px solid #eee !important;">
                            <button type="button" class="btn btn-secondary px-4 py-2 rounded-pill fw-semibold" data-bs-dismiss="modal">Fechar Visualização</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById(modalId);
    }
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    let nome = 'Colaborador';
    if (__colaboradores_cache && __colaboradores_cache.length > 0) {
        const colab = __colaboradores_cache.find(c => c.id === funcionarioId);
        if (colab) nome = colab.nome;
    }
    if (nome === 'Colaborador') {
        try {
            const doc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (doc.exists) nome = doc.data().nome;
        } catch(e){}
    }

    document.getElementById(`${modalId}-title-text`).innerHTML = `Histórico Completo: ${nome}`;

    try {
        const history = await getCollaboratorHistoryData(funcionarioId);
        const dashHtml = generateDashboardHTML(history);
        const timelineHtml = generateTimelineHTML(history);

        document.getElementById(`${modalId}-body`).innerHTML = `
            <div class="row mb-4 gx-3">
                ${dashHtml}
            </div>
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden mt-2">
                <div class="card-body p-4 bg-white">
                    <div class="timeline position-relative" style="margin-left: 20px;">
                        <div class="timeline-line position-absolute" style="top: 0; bottom: 0; left: 20px; width: 2px; background: #e9ecef;"></div>
                        ${timelineHtml}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        document.getElementById(`${modalId}-body`).innerHTML = `
            <div class="alert alert-danger border-0 shadow-sm rounded-4 p-4 text-center">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger opacity-75"></i>
                <h5>Ops, erro ao carregar o histórico</h5>
                <p class="mb-0 text-muted">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Imprime o histórico do colaborador selecionado com um layout profissional.
 */
function imprimirHistoricoColaborador() {
    if (!__current_funcionario_id || !__all_history_cache[__current_funcionario_id]) {
        alert("Selecione um colaborador e aguarde o carregamento do histórico.");
        return;
    }

    const funcionario = __colaboradores_cache.find(f => f.id === __current_funcionario_id);
    const history = __all_history_cache[__current_funcionario_id];

    if (!funcionario) return;

    let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                
                @page {
                    size: A4;
                    margin: 15mm 15mm 15mm 15mm;
                }

                body {
                    font-family: 'Inter', sans-serif;
                    color: #1a1a1a;
                    line-height: 1.4;
                    margin: 0;
                    padding: 0;
                    background-color: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                .print-container {
                    width: 100%;
                    max-width: 180mm; /* A4 width (210mm) - margins (30mm) */
                    margin: 0 auto;
                }

                .print-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    border-bottom: 2px solid #4361ee;
                    padding-bottom: 10px;
                    margin-bottom: 25px;
                }
                
                .brand-title {
                    font-size: 24px;
                    font-weight: 800;
                    color: #4361ee;
                    margin: 0;
                    line-height: 1;
                }
                
                .report-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #444;
                    margin: 4px 0 0 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .employee-card {
                    background-color: #fcfcfc;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 25px;
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 10px;
                    border: 1px solid #eee;
                }
                
                .info-group {
                    margin-bottom: 2px;
                }
                
                .info-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: #999;
                    text-transform: uppercase;
                    display: block;
                }
                
                .info-value {
                    font-size: 13px;
                    font-weight: 600;
                    color: #222;
                }
                
                .history-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    table-layout: fixed;
                }
                
                .history-table th {
                    background-color: #f8f9fa;
                    color: #4361ee;
                    text-align: left;
                    padding: 10px 12px;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #4361ee;
                }
                
                .history-table td {
                    padding: 10px 12px;
                    border-bottom: 1px dotted #ddd;
                    font-size: 12px;
                    vertical-align: top;
                    word-wrap: break-word;
                }
                
                .type-badge {
                    font-weight: 700;
                    color: #333;
                }
                
                .date-col {
                    white-space: nowrap;
                    font-weight: 600;
                    color: #4361ee;
                }
                
                .footer {
                    position: fixed;
                    bottom: 0;
                    width: 100%;
                    max-width: 180mm;
                    text-align: center;
                    font-size: 10px;
                    color: #aaa;
                    border-top: 1px solid #eee;
                    padding-top: 10px;
                    background: white;
                }
                
                @media print {
                    .no-print { display: none; }
                    .history-table tr { page-break-inside: avoid; }
                    .employee-card { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                <div class="print-header">
                    <div>
                        <h1 class="brand-title">NEXTER</h1>
                        <p class="report-title">Histórico Funcional do Colaborador</p>
                    </div>
                    <div style="text-align: right; color: #666; font-size: 11px;">
                        <strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}
                    </div>
                </div>

                <div class="employee-card">
                    <div class="info-group">
                        <span class="info-label">Nome Completo</span>
                        <span class="info-value" style="font-size: 16px; color: #4361ee;">${funcionario.nome}</span>
                    </div>
                    <div class="info-group" style="text-align: right;">
                        <span class="info-label">CPF</span>
                        <span class="info-value">${funcionario.cpf || 'Não informado'}</span>
                    </div>
                    <div class="info-group">
                        <span class="info-label">Cargo Atual</span>
                        <span class="info-value">${funcionario.cargo || 'Não informado'}</span>
                    </div>
                    <div class="info-group" style="text-align: right;">
                        <span class="info-label">Status</span>
                        <span class="info-value" style="color: ${funcionario.status === 'Ativo' ? '#1a936f' : '#c1121f'}">${funcionario.status}</span>
                    </div>
                </div>

                <table class="history-table">
                    <thead>
                        <tr>
                            <th style="width: 75px;">Data</th>
                            <th style="width: 160px;">Tipo de Registro</th>
                            <th>Descrição dos Fatos e Observações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    history.forEach(item => {
        html += `
            <tr>
                <td class="date-col">${item.date.toLocaleDateString('pt-BR')}</td>
                <td class="type-badge">${item.type}</td>
                <td>${item.description.replace(/<[^>]*>?/gm, ' ')}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>

                <div class="footer">
                    Este documento é para fins de consulta interna de RH. Gerado pelo sistema Nexter v3.0 em ${new Date().toLocaleDateString('pt-BR')}.
                </div>
            </div>
        </body>
        </html>
    `;

    // Tenta usar a função global se existir, senão usa window.print
    if (typeof openPrintWindow === 'function') {
        openPrintWindow(html, { title: `Histórico - ${funcionario.nome}` });
    } else {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Pequeno delay para garantir carregamento de estilos/fontes
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
}

// Garante que as funções estejam no escopo global para serem chamadas pelo app.js e pelos eventos
window.inicializarHistoricoColaborador = inicializarHistoricoColaborador;
window.imprimirHistoricoColaborador = imprimirHistoricoColaborador;
window.showCollaboratorHistory = showCollaboratorHistory;
window.showCollaboratorHistoryModal = showCollaboratorHistoryModal;

// Adiciona um pouco de estilo para a timeline e lista
const hcStyle = document.createElement('style');
hcStyle.innerHTML = `
.collaborator-item {
    transition: all 0.2s ease;
    border-left: 4px solid transparent !important;
}
.collaborator-item:hover {
    transform: translateX(5px);
    background-color: var(--bs-light) !important;
}
.collaborator-item.active {
    background-color: var(--bs-primary-bg-subtle) !important;
    border-left-color: var(--bs-primary) !important;
    z-index: 2;
}
.timeline {
    position: relative;
    padding: 20px 0;
    margin-left: 20px;
}
.timeline::before {
    content: '';
    position: absolute;
    top: 0;
    left: 20px;
    height: 100%;
    width: 2px;
    background: #e9ecef;
}
.timeline-item {
    position: relative;
    padding-left: 55px;
}
.timeline-marker {
    position: absolute;
    left: 0;
    top: 5px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    border: 3px solid white;
}
.timeline-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s ease;
}
.timeline-card:hover {
    transform: translateY(-2px);
}
.bg-purple { background-color: #6f42c1 !important; }
.text-purple { color: #6f42c1 !important; }
.border-purple { border-color: rgba(111, 66, 193, 0.25) !important; }

/* Custom Scrollbar */
#colaboradores-list::-webkit-scrollbar,
#historico-container-body::-webkit-scrollbar {
    width: 6px;
}
#colaboradores-list::-webkit-scrollbar-thumb,
#historico-container-body::-webkit-scrollbar-thumb {
    background: #dee2e6;
    border-radius: 10px;
}
#colaboradores-list::-webkit-scrollbar-track,
#historico-container-body::-webkit-scrollbar-track {
    background: transparent;
}
`;
document.head.appendChild(hcStyle);
