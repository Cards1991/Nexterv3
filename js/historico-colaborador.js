// js/historico-colaborador.js

let __colaboradores_cache = [];
let __all_history_cache = {}; // Cache para o histórico de cada colaborador

document.addEventListener('DOMContentLoaded', () => {
    // A inicialização agora é chamada a partir do app.js quando a seção é exibida
});

/**
 * Ponto de entrada principal para a funcionalidade de Histórico do Colaborador.
 * Chamado pelo app.js quando a aba é selecionada.
 */
async function inicializarHistoricoColaborador() {
    console.log("Inicializando Histórico do Colaborador...");
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
        const statusClass = colab.status === 'Ativo' ? 'text-success' : 'text-danger';
        const statusIcon = colab.status === 'Ativo' ? 'fa-check-circle' : 'fa-times-circle';

        return `
            <a href="#" class="list-group-item list-group-item-action" data-id="${colab.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${colab.nome}</h6>
                    <small><i class="fas ${statusIcon} ${statusClass}"></i> ${colab.status}</small>
                </div>
                <small class="text-muted">${colab.cargo || 'Cargo não informado'}</small>
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

    timelineContainer.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando histórico...</span></div></div>';

    // Verifica o cache primeiro
    if (__all_history_cache[funcionarioId]) {
        renderTimeline(__all_history_cache[funcionarioId]);
        return;
    }

    try {
        const collections = {
            atestados: 'atestados',
            faltas: 'faltas',
            disciplinar: 'registros_disciplinares',
            alteracoes: 'alteracoes_funcao',
            epi: 'epi_consumo',
            avaliacoes: 'avaliacoes_colaboradores'
        };

        // Query for occurrences separately due to different field name
        const ocorrenciasPromise = db.collection('ocorrencias_saude').where('colaboradorId', '==', funcionarioId).get();

        const otherPromises = Object.values(collections).map(col => 
            db.collection(col).where('funcionarioId', '==', funcionarioId).get()
        );

        const [
            ocorrenciasSnap,
            atestadosSnap, 
            faltasSnap, 
            disciplinarSnap, 
            alteracoesSnap,
            epiSnap,
            avaliacoesSnap
        ] = await Promise.all([ocorrenciasPromise, ...otherPromises]);

        let combinedHistory = [];

        // Processa Ocorrências
        ocorrenciasSnap.forEach(doc => {
            const data = doc.data();
            combinedHistory.push({
                date: (data.data || data.dataOcorrencia)?.toDate(),
                type: 'Ocorrência',
                icon: 'fa-exclamation-circle',
                color: 'info',
                description: data.descricao || `Tipo: ${data.tipo}`
            });
        });
        
        // Processa Atestados (e Acidentes que podem estar aqui)
        atestadosSnap.forEach(doc => {
            const data = doc.data();
            const isAccident = data.tipo && data.tipo.toLowerCase().includes('acidente');
            combinedHistory.push({
                date: (data.data_atestado)?.toDate(),
                type: isAccident ? 'Acidente (Atestado)' : 'Atestado',
                icon: isAccident ? 'fa-user-injured' : 'fa-file-medical-alt',
                color: isAccident ? 'danger' : 'warning',
                description: `<strong>${data.tipo}</strong>: ${data.dias || data.duracaoValor || ''} ${data.duracaoTipo || 'dias'}. ${data.cid ? `CID: ${data.cid}` : ''}`
            });
        });

        // Processa Faltas
        faltasSnap.forEach(doc => {
            const data = doc.data();
            combinedHistory.push({
                date: (data.data)?.toDate(),
                type: 'Falta',
                icon: 'fa-calendar-times',
                color: 'danger',
                description: `Justificativa: ${data.justificativa || 'Não informado'}`
            });
        });

        // Processa Medidas Disciplinares (Advertências)
        disciplinarSnap.forEach(doc => {
            const data = doc.data();
            combinedHistory.push({
                date: (data.dataOcorrencia)?.toDate(),
                type: 'Medida Disciplinar',
                icon: 'fa-gavel',
                color: 'primary',
                description: `<strong>${data.medidaAplicada}</strong>: ${data.descricao}`
            });
        });
        
        // Processa Alterações de Função
        alteracoesSnap.forEach(doc => {
             const data = doc.data();
             combinedHistory.push({
                date: (data.data_alteracao)?.toDate(),
                type: 'Promoção/Alteração',
                icon: 'fa-level-up-alt',
                color: 'success',
                description: `De <strong>${data.cargo_anterior}</strong> para <strong>${data.novo_cargo}</strong>. Motivo: ${data.motivo}`
             });
        });

        // Processa Entregas de EPI
        epiSnap.forEach(doc => {
            const data = doc.data();
            combinedHistory.push({
                date: (data.dataEntrega)?.toDate(),
                type: 'Entrega de EPI',
                icon: 'fa-hard-hat',
                color: 'secondary',
                description: `Recebeu ${data.quantidade || 1}x <strong>${data.epiDescricao || 'EPI não especificado'}</strong>. Motivo: ${data.motivo || 'N/A'}`
            });
        });

        // Processa Avaliações ISO
        avaliacoesSnap.forEach(doc => {
            const data = doc.data();
            combinedHistory.push({
                date: (data.dataAvaliacao)?.toDate(),
                type: 'Avaliação ISO',
                icon: 'fa-star',
                color: 'purple', // Custom color
                description: `Recebeu nota <strong>${data.nota}</strong>. Avaliador: ${data.avaliadorEmail || 'N/A'}.`
            });
        });


        // Filtra itens sem data e ordena
        const sortedHistory = combinedHistory
            .filter(item => item.date && !isNaN(item.date))
            .sort((a, b) => b.date - a.date);

        // Armazena no cache
        __all_history_cache[funcionarioId] = sortedHistory;
        
        renderTimeline(sortedHistory);

    } catch (error) {
        console.error("Erro ao buscar histórico do colaborador:", error);
        timelineContainer.innerHTML = '<p class="text-center text-danger">Erro ao carregar o histórico.</p>';
    }
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

    timelineContainer.innerHTML = history.map(item => `
        <div class="timeline-item">
            <div class="timeline-icon bg-${item.color}">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="timeline-content">
                <h5 class="timeline-title">${item.type}</h5>
                <p class="timeline-date">${item.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                <div class="timeline-description">
                    ${item.description}
                </div>
            </div>
        </div>
    `).join('');
}

// Garante que a função de inicialização esteja no escopo global para ser chamada pelo app.js
window.inicializarHistoricoColaborador = inicializarHistoricoColaborador;

// Adiciona um pouco de estilo para a timeline
const style = document.createElement('style');
style.innerHTML = `
.timeline {
    position: relative;
    padding: 20px 0;
}
.timeline::before {
    content: '';
    position: absolute;
    top: 0;
    left: 18px;
    height: 100%;
    width: 4px;
    background: #e9ecef;
}
.timeline-item {
    position: relative;
    margin-bottom: 20px;
    padding-left: 50px;
}
.timeline-icon {
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
}
.timeline-content {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    border-left: 3px solid;
}
.timeline-content .timeline-title {
    margin: 0 0 5px 0;
    font-size: 1rem;
    font-weight: 600;
}
.timeline-content .timeline-date {
    font-size: 0.8rem;
    color: #6c757d;
    margin-bottom: 10px;
}
.timeline-content .timeline-description {
    font-size: 0.9rem;
    line-height: 1.5;
}
.timeline-icon.bg-purple {
    background-color: #6f42c1;
}
.timeline-item .bg-purple .fa {
    color: white;
}
.timeline-content.border-purple {
    border-color: #6f42c1;
}
.timeline-item .bg-primary .fa, .timeline-item .bg-success .fa, .timeline-item .bg-info .fa, .timeline-item .bg-warning .fa, .timeline-item .bg-danger .fa {
    color: white;
}
.timeline-content { border-color: var(--bs-gray-300); }
.timeline-content.border-primary { border-color: var(--bs-primary); }
.timeline-content.border-success { border-color: var(--bs-success); }
.timeline-content.border-info { border-color: var(--bs-info); }
.timeline-content.border-warning { border-color: var(--bs-warning); }
.timeline-content.border-danger { border-color: var(--bs-danger); }
`;
document.head.appendChild(style);
