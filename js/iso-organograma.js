// Gerenciamento do Organograma Administrativo - ISO 9001

async function inicializarOrganograma() {
    try {
        await carregarOrganograma();
        const btnNovo = document.getElementById('btn-adicionar-membro-organograma');
        if (btnNovo && !btnNovo.__bound) {
            btnNovo.addEventListener('click', () => abrirModalMembroOrganograma(null));
            btnNovo.__bound = true;
        }

        const btnImprimir = document.getElementById('btn-imprimir-organograma');
        if (btnImprimir && !btnImprimir.__bound) {
            btnImprimir.addEventListener('click', imprimirOrganograma);
            btnImprimir.__bound = true;
        }
        
        // Adicionar listener para redimensionamento da tela
        window.addEventListener('resize', debounce(async () => {
            await carregarOrganograma();
        }, 250));
        
    } catch (e) {
        console.error("Erro ao inicializar organograma:", e);
        mostrarMensagem("Erro ao carregar o organograma.", "error");
    }
}

// Função debounce para otimizar o redimensionamento
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function carregarOrganograma() {
    const container = document.getElementById('organograma-container');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando estrutura...</div>';

    try {
        const snap = await db.collection('organograma').orderBy('nome').get();
        const membros = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (membros.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Nenhum membro cadastrado no organograma. Comece adicionando um membro.</p>';
            return;
        }

        const arvore = construirArvore(membros);
        container.innerHTML = renderizarDiagramaOrganograma(arvore);

        // Ajustar o organograma após renderização
        setTimeout(ajustarOrganogramaResponsivo, 100);

        // Habilitar funcionalidade de arrastar (panning)
        const draggableContainer = document.querySelector('.organograma-container');
        if (draggableContainer) {
            let isDown = false;
            let startX;
            let scrollLeft;

            draggableContainer.addEventListener('mousedown', (e) => {
                if (e.target.closest('button, a, select')) return;
                isDown = true;
                draggableContainer.classList.add('active-drag');
                startX = e.pageX - draggableContainer.offsetLeft;
                scrollLeft = draggableContainer.scrollLeft;
            });
            draggableContainer.addEventListener('mouseleave', () => { isDown = false; draggableContainer.classList.remove('active-drag'); });
            draggableContainer.addEventListener('mouseup', () => { isDown = false; draggableContainer.classList.remove('active-drag'); });
            draggableContainer.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                draggableContainer.scrollLeft = scrollLeft - (e.pageX - draggableContainer.offsetLeft - startX);
            });
        }

    } catch (error) {
        console.error("Erro ao carregar organograma:", error);
        container.innerHTML = '<p class="text-center text-danger">Falha ao carregar a estrutura do organograma.</p>';
    }
}

function construirArvore(lista) {
    const mapa = {};
    const raizes = [];

    lista.forEach(membro => {
        mapa[membro.id] = { ...membro, children: [] };
    });

    lista.forEach(membro => {
        if (membro.parentId && mapa[membro.parentId]) {
            mapa[membro.parentId].children.push(mapa[membro.id]);
        } else {
            raizes.push(mapa[membro.id]);
        }
    });

    return raizes;
}

function renderizarDiagramaOrganograma(nodes) {
    if (!nodes || nodes.length === 0) return '';

    let html = `
        <div class="organograma-wrapper">
            <div class="organograma-container">
                <div class="organograma-tree">
                    ${nodes.map(node => renderizarNo(node, 0)).join('')}
                </div>
            </div>
            <div class="organograma-controls">
                <button class="btn btn-sm btn-outline-secondary" onclick="zoomOut()" title="Zoom Out">
                    <i class="fas fa-search-minus"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="zoomReset()" title="Reset Zoom">
                    <i class="fas fa-search"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="zoomIn()" title="Zoom In">
                    <i class="fas fa-search-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="toggleView()" title="Alternar Visualização">
                    <i class="fas fa-mobile-alt"></i>
                </button>
            </div>
        </div>
    `;
    
    return html;
}

function renderizarNo(node, nivel) {
    const hasChildren = node.children && node.children.length > 0;
    const isMobile = window.innerWidth < 768;
    
    let html = `
        <div class="organograma-node nivel-${nivel} ${hasChildren ? 'has-children' : ''} ${isMobile ? 'mobile-view' : ''}">
            <div class="node-content">
                <div class="node-card">
                    <div class="node-info">
                        <div class="node-name">${node.nome}</div>
                        <div class="node-position">${node.cargo}</div>
                    </div>
                    <div class="node-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalMembroOrganograma('${node.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirMembroOrganograma('${node.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
    `;

    if (hasChildren) {
        html += `
            <div class="node-children">
                ${node.children.map(child => renderizarNo(child, nivel + 1)).join('')}
            </div>
        `;
    }

    html += '</div>';
    return html;
}

async function imprimirOrganograma() {
    const container = document.getElementById('organograma-container');
    if (!container) {
        mostrarMensagem("Conteúdo do organograma não encontrado.", "error");
        return;
    }

    const conteudoOriginal = container.innerHTML;
    const titulo = "Organograma Administrativo";

    // Remove os botões de ação para a impressão
    const cloneParaImpressao = container.cloneNode(true);
    cloneParaImpressao.querySelectorAll('.node-actions').forEach(el => el.remove());
    cloneParaImpressao.querySelectorAll('.organograma-controls').forEach(el => el.remove());

    const conteudoImpressao = cloneParaImpressao.innerHTML;

    const htmlParaImprimir = `
        <html>
            <head>
                <title>${titulo}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                ${organogramaCSS}
                <style>
                    @page { size: A4 landscape; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .organograma-container { border: none; background: none; }
                </style>
            </head>
            <body>
                <h2 class="text-center mb-4">${titulo}</h2>
                ${conteudoImpressao}
            </body>
        </html>
    `;

    openPrintWindow(htmlParaImprimir, { autoPrint: true, name: '_blank' });
}

// Funções de controle do organograma
function zoomIn() {
    const tree = document.querySelector('.organograma-tree');
    const currentScale = parseFloat(tree.style.transform?.replace('scale(', '') || 1);
    tree.style.transform = `scale(${Math.min(currentScale + 0.1, 2)})`;
}

function zoomOut() {
    const tree = document.querySelector('.organograma-tree');
    const currentScale = parseFloat(tree.style.transform?.replace('scale(', '') || 1);
    tree.style.transform = `scale(${Math.max(currentScale - 0.1, 0.5)})`;
}

function zoomReset() {
    const tree = document.querySelector('.organograma-tree');
    tree.style.transform = 'scale(1)';
}

function toggleView() {
    const tree = document.querySelector('.organograma-tree');
    tree.classList.toggle('mobile-compact');
}

function ajustarOrganogramaResponsivo() {
    const container = document.querySelector('.organograma-container');
    const nodes = document.querySelectorAll('.organograma-node');
    
    // Reset de estilos
    nodes.forEach(node => {
        node.style.flex = '1';
    });
    
    // Ajustar para telas muito pequenas
    if (window.innerWidth < 576) {
        container.style.overflowX = 'auto';
        container.style.padding = '10px';
    } else {
        container.style.overflowX = 'visible';
        container.style.padding = '20px';
    }
}

// CSS responsivo completo
const organogramaCSS = `
<style>
.organograma-wrapper {
    position: relative;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
}

.organograma-container {
    width: 100%;
    overflow-x: auto;
    overflow-y: visible;
    padding: 20px;
    min-height: 400px;
    background: #f8f9fa;
    border-radius: 10px;
    border: 1px solid #e9ecef;
    cursor: grab;
}

.organograma-container.active-drag {
    cursor: grabbing;
}

.organograma-tree {
    display: flex;
    justify-content: center;
    min-width: min-content;
    transition: transform 0.3s ease;
    transform-origin: center top;
    padding: 20px 0;
}

.organograma-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    margin: 0 15px;
    min-width: 200px;
}

/* Estrutura do organograma para desktop */
.organograma-tree:not(.mobile-compact) .organograma-node {
    flex-direction: column;
}

.organograma-tree:not(.mobile-compact) .node-children {
    display: flex;
    margin-top: 60px;
    position: relative;
}

/* Linhas de conexão para desktop */
.organograma-tree:not(.mobile-compact) .node-children::before {
    content: '';
    position: absolute;
    top: -30px;
    left: 50%;
    width: 2px;
    height: 30px;
    background: #dee2e6;
    transform: translateX(-50%);
}

.organograma-tree:not(.mobile-compact) .has-children > .node-content::after {
    content: '';
    position: absolute;
    bottom: -30px;
    left: 50%;
    width: 2px;
    height: 30px;
    background: #dee2e6;
    transform: translateX(-50%);
}

.organograma-tree:not(.mobile-compact) .node-children .organograma-node:not(:only-child)::before {
    content: '';
    position: absolute;
    top: -30px;
    height: 2px;
    background: #dee2e6;
}

.organograma-tree:not(.mobile-compact) .node-children .organograma-node:first-child::before {
    left: 50%;
    right: 0;
}

.organograma-tree:not(.mobile-compact) .node-children .organograma-node:last-child::before {
    left: 0;
    right: 50%;
}

.organograma-tree:not(.mobile-compact) .node-children .organograma-node:not(:first-child):not(:last-child)::before {
    left: 0;
    right: 0;
}

/* Modo mobile compact */
.organograma-tree.mobile-compact .organograma-node {
    flex-direction: row;
    align-items: flex-start;
    margin: 10px 0;
    min-width: 100%;
}

.organograma-tree.mobile-compact .node-children {
    margin-left: 30px;
    margin-top: 0;
    position: relative;
    border-left: 2px solid #dee2e6;
    padding-left: 15px;
}

.organograma-tree.mobile-compact .node-content {
    margin-bottom: 10px;
}

/* Cartão do nó */
.node-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 12px;
    min-width: 180px;
    max-width: 250px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    position: relative;
    z-index: 2;
    transition: all 0.3s ease;
}

.node-card:hover {
    border-color: #007bff;
    box-shadow: 0 4px 12px rgba(0,123,255,0.2);
    transform: translateY(-2px);
}

.node-info {
    text-align: center;
    margin-bottom: 8px;
}

.node-name {
    font-weight: bold;
    font-size: 13px;
    color: #333;
    margin-bottom: 4px;
    line-height: 1.2;
}

.node-position {
    font-size: 11px;
    color: #6c757d;
    line-height: 1.2;
}

.node-actions {
    display: flex;
    gap: 4px;
    justify-content: center;
    flex-wrap: wrap;
}

.node-actions .btn {
    padding: 2px 6px;
    font-size: 10px;
}

/* Cores por nível */
.nivel-0 .node-card {
    border-color: #007bff;
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
}

.nivel-0 .node-name,
.nivel-0 .node-position {
    color: white;
}

.nivel-1 .node-card {
    border-color: #28a745;
    background: linear-gradient(135deg, #28a745, #1e7e34);
    color: white;
}

.nivel-2 .node-card {
    border-color: #ffc107;
    background: linear-gradient(135deg, #ffc107, #e0a800);
    color: #212529;
}

.nivel-3 .node-card {
    border-color: #6f42c1;
    background: linear-gradient(135deg, #6f42c1, #5a2d91);
    color: white;
}

.nivel-4 .node-card {
    border-color: #fd7e14;
    background: linear-gradient(135deg, #fd7e14, #e55a00);
    color: white;
}

/* Controles */
.organograma-controls {
    position: sticky;
    bottom: 20px;
    left: 20px;
    display: flex;
    gap: 5px;
    margin-top: 10px;
    flex-wrap: wrap;
    background: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 1000;
}

.organograma-controls .btn {
    padding: 4px 8px;
    font-size: 12px;
}

/* Responsividade avançada */
@media (max-width: 1200px) {
    .node-card {
        min-width: 160px;
        padding: 10px;
    }
    
    .node-name {
        font-size: 12px;
    }
    
    .node-position {
        font-size: 10px;
    }
}

@media (max-width: 992px) {
    .organograma-node {
        margin: 0 10px;
        min-width: 150px;
    }
    
    .node-card {
        min-width: 140px;
    }
}

@media (max-width: 768px) {
    .organograma-container {
        padding: 10px;
        overflow-x: auto;
    }
    
    .organograma-tree {
        padding: 10px 0;
        min-width: max-content;
    }
    
    .organograma-node {
        margin: 0 8px;
        min-width: 130px;
    }
    
    .node-card {
        min-width: 120px;
        padding: 8px;
    }
    
    .node-name {
        font-size: 11px;
    }
    
    .node-position {
        font-size: 9px;
    }
    
    .node-actions {
        flex-direction: column;
        align-items: center;
    }
    
    .node-actions .btn {
        width: 100%;
        margin: 1px 0;
    }
}

@media (max-width: 576px) {
    .organograma-wrapper {
        padding: 5px;
    }
    
    .organograma-container {
        padding: 5px;
        border-radius: 5px;
    }
    
    .organograma-tree {
        padding: 5px 0;
    }
    
    .organograma-node {
        margin: 0 5px;
        min-width: 110px;
    }
    
    .node-card {
        min-width: 100px;
        padding: 6px;
    }
    
    .node-name {
        font-size: 10px;
    }
    
    .node-position {
        font-size: 8px;
    }
    
    .organograma-controls {
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        justify-content: center;
    }
}

/* Scrollbar personalizada */
.organograma-container::-webkit-scrollbar {
    display: block;
    height: 12px;
}

.organograma-container::-webkit-scrollbar-track {
    background: #e9ecef;
    border-radius: 10px;
}

.organograma-container::-webkit-scrollbar-thumb {
    background-color: #adb5bd;
    border-radius: 10px;
    border: 3px solid #e9ecef;
}
.organograma-container {
    scrollbar-width: thin;
    scrollbar-color: #adb5bd #e9ecef;
}

/* Animações */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.organograma-node {
    animation: fadeIn 0.3s ease-out;
}
</style>
`;

// Adicionar CSS ao documento
if (!document.querySelector('#organograma-css')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'organograma-css';
    styleEl.textContent = organogramaCSS;
    document.head.appendChild(styleEl);
}

// As funções restantes permanecem as mesmas...
async function abrirModalMembroOrganograma(membroId = null) {
    const modalId = 'organogramaModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Membro do Organograma</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <form id="form-organograma">
                            <input type="hidden" id="organograma-membro-id">
                            <div class="mb-3"><label class="form-label">Nome</label><input type="text" class="form-control" id="organograma-nome" required></div>
                            <div class="mb-3"><label class="form-label">Cargo</label><input type="text" class="form-control" id="organograma-cargo" required></div>
                            <div class="mb-3"><label class="form-label">Subordinado a (Líder)</label><select class="form-select" id="organograma-parent"></select></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarMembroOrganograma()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const form = document.getElementById('form-organograma');
    form.reset();
    document.getElementById('organograma-membro-id').value = membroId || '';
    document.querySelector(`#${modalId} .modal-title`).textContent = membroId ? 'Editar Membro' : 'Adicionar Membro';

    // Popular o select de líderes
    const parentSelect = document.getElementById('organograma-parent');
    parentSelect.innerHTML = '<option value="">-- Ninguém (Nível Superior) --</option>';
    const snap = await db.collection('organograma').orderBy('nome').get();
    snap.forEach(doc => {
        // Um membro não pode ser subordinado a si mesmo
        if (doc.id !== membroId) {
            parentSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome} (${doc.data().cargo})</option>`;
        }
    });

    if (membroId) {
        const doc = await db.collection('organograma').doc(membroId).get();
        const data = doc.data();
        document.getElementById('organograma-nome').value = data.nome;
        document.getElementById('organograma-cargo').value = data.cargo;
        document.getElementById('organograma-parent').value = data.parentId || '';
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function salvarMembroOrganograma() {
    const membroId = document.getElementById('organograma-membro-id').value;
    const dados = {
        nome: document.getElementById('organograma-nome').value.trim(),
        cargo: document.getElementById('organograma-cargo').value.trim(),
        parentId: document.getElementById('organograma-parent').value || null
    };

    if (!dados.nome || !dados.cargo) {
        mostrarMensagem("Nome e Cargo são obrigatórios.", "warning");
        return;
    }

    try {
        if (membroId) {
            await db.collection('organograma').doc(membroId).update(dados);
            mostrarMensagem("Membro atualizado com sucesso!", "success");
        } else {
            await db.collection('organograma').add(dados);
            mostrarMensagem("Membro adicionado com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('organogramaModal')).hide();
        await carregarOrganograma();

    } catch (error) {
        console.error("Erro ao salvar membro do organograma:", error);
        mostrarMensagem("Erro ao salvar os dados.", "error");
    }
}

async function excluirMembroOrganograma(membroId) {
    // Verificar se este membro é pai de alguém
    const filhosSnap = await db.collection('organograma').where('parentId', '==', membroId).limit(1).get();
    if (!filhosSnap.empty) {
        mostrarMensagem("Não é possível excluir. Este membro possui outros membros subordinados a ele.", "error");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir este membro do organograma?")) {
        return;
    }

    try {
        await db.collection('organograma').doc(membroId).delete();
        mostrarMensagem("Membro excluído com sucesso.", "info");
        await carregarOrganograma();
    } catch (error) {
        console.error("Erro ao excluir membro:", error);
        mostrarMensagem("Erro ao excluir o membro.", "error");
    }
}