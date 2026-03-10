// js/setor-macro.js

// Flag para evitar múltiplas inicializações
let setorMacroInicializado = false;

// MutationObserver para detectar quando a view setor-macro é inserida no DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                if (node.id === 'dynamic-content' || (node.querySelector && node.querySelector('#lista-setores-container'))) {
                    if (!setorMacroInicializado) {
                        console.log("View setor-macro detectada via MutationObserver!");
                        setTimeout(() => inicializarSetorMacro(), 100);
                        setorMacroInicializado = true;
                    }
                }
            }
        });
    });
});

// Inicia o observer no body
observer.observe(document.body, { 
    childList: true, 
    subtree: true 
});

document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === "undefined") {
        console.error("Firebase DB not initialized");
        return;
    }

    const listaSetoresContainer = document.getElementById('lista-setores-container');
    if (listaSetoresContainer) {
        inicializarSetorMacro();
    }
});

// Função principal de inicialização do Setor Macro
async function inicializarSetorMacro() {
    console.log("Inicializando Setor Macro...");
    
    const listaSetoresContainer = document.getElementById('lista-setores-container');
    const searchInput = document.getElementById('search-setores-disponiveis');
    const filtroEmpresaSelect = document.getElementById('filtro-empresa-setores');
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const listaMacroSetoresDiv = document.getElementById('lista-macro-setores');
    
    // Verifica se todos os elementos necessários existem
    if (!listaSetoresContainer || !searchInput || !filtroEmpresaSelect || !btnSalvar || !nomeMacroSetorInput || !listaMacroSetoresDiv) {
        console.log("Aguardando elementos do Setor Macro...", {
            listaSetoresContainer: !!listaSetoresContainer,
            searchInput: !!searchInput,
            filtroEmpresaSelect: !!filtroEmpresaSelect,
            btnSalvar: !!btnSalvar,
            nomeMacroSetorInput: !!nomeMacroSetorInput,
            listaMacroSetoresDiv: !!listaMacroSetoresDiv
        });
        return;
    }

    // Variáveis globais do módulo
    let setoresData = [];
    let empresasMap = new Map();

    // FUNÇÃO: Carrega empresas para o filtro
    async function carregarEmpresasParaFiltro() {
        console.log("Carregando empresas para o filtro...");
        
        try {
            const empresasSnap = await db.collection('empresas').orderBy('nome').get();
            
            // Limpa o select e adiciona a opção "Todas"
            filtroEmpresaSelect.innerHTML = '<option value="">Todas as empresas</option>';
            
            // Limpa e recria o mapa de empresas
            empresasMap.clear();
            
            if (empresasSnap.empty) {
                console.warn("Nenhuma empresa encontrada");
                return;
            }
            
            empresasSnap.forEach(doc => {
                const empresa = doc.data();
                empresasMap.set(doc.id, empresa.nome);
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = empresa.nome;
                filtroEmpresaSelect.appendChild(option);
            });
            
            console.log(`Carregadas ${empresasMap.size} empresas`);
            
        } catch (error) {
            console.error("Erro ao carregar empresas:", error);
            filtroEmpresaSelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    }

    // FUNÇÃO: Carrega setores
    async function carregarSetoresDisponiveis() {
        const empresaId = filtroEmpresaSelect.value;
        console.log(`Carregando setores para empresa: ${empresaId || 'TODAS'}`);
        
        listaSetoresContainer.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-spinner fa-spin"></i> Carregando setores...</div>';

        try {
            let query = db.collection('setores');
            
            if (empresaId) {
                query = query.where('empresaId', '==', empresaId);
            }
            
            const setoresSnap = await query.orderBy('descricao').get();

            setoresData = [];
            
            if (setoresSnap.empty) {
                listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
                return;
            }
            
            setoresSnap.forEach(doc => {
                const setor = doc.data();
                const nomeEmpresa = empresasMap.get(setor.empresaId) || 'Empresa não encontrada';
                
                setoresData.push({
                    id: doc.id,
                    descricao: setor.descricao || 'Sem descrição',
                    empresaId: setor.empresaId,
                    empresaNome: nomeEmpresa,
                    displayText: `${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`
                });
            });

            console.log(`Carregados ${setoresData.length} setores`);
            renderizarListaSetores(setoresData);

        } catch (error) {
            console.error("Erro ao carregar setores:", error);
            listaSetoresContainer.innerHTML = '<div class="text-danger p-2">Erro ao carregar setores. Verifique o console.</div>';
        }
    }

    // FUNÇÃO: Renderiza a lista de setores
// FUNÇÃO: Renderiza a lista de setores com checkboxes
function renderizarListaSetores(setores) {
    if (setores.length === 0) {
        listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
        return;
    }

    let html = '';
    setores.forEach(setor => {
        // CORREÇÃO: Garantir que o id seja único e o label esteja associado corretamente
        const checkboxId = `setor-${setor.id.replace(/[^a-zA-Z0-9]/g, '-')}`; // Remove caracteres especiais do ID
        
        html += `
            <div class="form-check setor-item mb-1" data-id="${setor.id}">
                <input class="form-check-input setor-checkbox" type="checkbox" value="${setor.id}" id="${checkboxId}">
                <label class="form-check-label" for="${checkboxId}">
                    ${setor.displayText}
                </label>
            </div>
        `;
    });

    listaSetoresContainer.innerHTML = html;
}

    // FUNÇÃO: Configura o listener de busca
    function configurarListenerBusca() {
        const searchInput = document.getElementById('search-setores-disponiveis');
        if (!searchInput) return;
        
        // Remove listeners antigos clonando o elemento
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', (e) => {
            const termoBusca = e.target.value.toLowerCase().trim();
            
            if (!termoBusca) {
                renderizarListaSetores(setoresData);
                return;
            }

            const setoresFiltrados = setoresData.filter(setor => 
                setor.descricao.toLowerCase().includes(termoBusca) ||
                setor.empresaNome.toLowerCase().includes(termoBusca)
            );

            renderizarListaSetores(setoresFiltrados);
        });
    }

    // FUNÇÃO: Obtém setores selecionados
    function getSetoresSelecionados() {
        const checkboxes = document.querySelectorAll('.setor-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // FUNÇÃO: Limpa seleções
    function limparSelecoes() {
        const checkboxes = document.querySelectorAll('.setor-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        
        const searchInput = document.getElementById('search-setores-disponiveis');
        if (searchInput) searchInput.value = '';
        
        renderizarListaSetores(setoresData);
    }

    // FUNÇÃO: Carrega macro setores existentes
    async function carregarMacroSetores() {
        console.log("Carregando macro setores...");
        
        listaMacroSetoresDiv.innerHTML = '<p class="text-muted">Carregando...</p>';
        
        try {
            const [empresasSnap, setoresSnap, macroSetoresSnap] = await Promise.all([
                db.collection('empresas').get(),
                db.collection('setores').get(),
                db.collection('macro_setores').orderBy('nome').get()
            ]);

            const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
            const setoresMap = new Map(setoresSnap.docs.map(doc => [doc.id, doc.data()]));

            if (macroSetoresSnap.empty) {
                listaMacroSetoresDiv.innerHTML = '<p class="text-muted">Nenhum setor macro cadastrado.</p>';
                return;
            }

            let html = '<table class="table table-hover"><thead><tr><th>Nome</th><th>Setores Vinculados</th><th class="text-end">Ações</th></tr></thead><tbody>';
            
            macroSetoresSnap.forEach(doc => {
                const macroSetor = doc.data();
                const setoresVinculadosIds = macroSetor.setoresIds || [];

                const nomesSetores = setoresVinculadosIds.map(id => {
                    const setor = setoresMap.get(id);
                    if (!setor) return '<span class="text-danger">Setor não encontrado</span>';
                    const nomeEmpresa = empresasMap.get(setor.empresaId) || 'Empresa desconhecida';
                    return `• ${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`;
                }).join('<br>') || 'Nenhum setor vinculado';

                html += `
                    <tr>
                        <td>${macroSetor.nome}</td>
                        <td>${nomesSetores}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-danger excluir-macro" data-id="${doc.id}">Excluir</button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            listaMacroSetoresDiv.innerHTML = html;

        } catch (error) {
            console.error("Erro ao carregar macro setores:", error);
            listaMacroSetoresDiv.innerHTML = '<p class="text-danger">Erro ao carregar os macro setores.</p>';
        }
    }

    // FUNÇÃO: Salva macro setor
    async function salvarMacroSetor() {
        const nome = nomeMacroSetorInput.value.trim();
        const setoresSelecionados = getSetoresSelecionados();

        if (!nome) {
            alert('Por favor, preencha o nome do macro setor.');
            return;
        }

        if (setoresSelecionados.length === 0) {
            alert('Selecione pelo menos um setor.');
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            await db.collection('macro_setores').add({
                nome: nome,
                setoresIds: setoresSelecionados,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            nomeMacroSetorInput.value = '';
            limparSelecoes();
            filtroEmpresaSelect.value = '';
            
            await carregarSetoresDisponiveis();
            await carregarMacroSetores();
            
            alert('Setor Macro salvo com sucesso!');

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert('Erro ao salvar o Setor Macro.');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Setor Macro';
        }
    }

    // FUNÇÃO: Exclui macro setor
    async function excluirMacroSetor(event) {
        if (event.target.classList.contains('excluir-macro')) {
            const docId = event.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este Setor Macro?')) {
                try {
                    await db.collection('macro_setores').doc(docId).delete();
                    await carregarMacroSetores();
                    alert('Setor Macro excluído com sucesso!');
                } catch (error) {
                    console.error("Erro ao excluir:", error);
                    alert('Erro ao excluir o Setor Macro.');
                }
            }
        }
    }

    // INICIALIZAÇÃO PRINCIPAL
    console.log("Iniciando carregamento dos dados...");
    
    // Carrega empresas primeiro
    await carregarEmpresasParaFiltro();
    
    // Depois carrega os setores
    await carregarSetoresDisponiveis();
    
    // Configura o listener de busca
    configurarListenerBusca();
    
    // Carrega os macros existentes
    await carregarMacroSetores();
    
    // Configura o listener do filtro de empresa
    filtroEmpresaSelect.addEventListener('change', () => {
        carregarSetoresDisponiveis();
    });
    
    // Configura os listeners dos botões
    btnSalvar.addEventListener('click', salvarMacroSetor);
    listaMacroSetoresDiv.addEventListener('click', excluirMacroSetor);
    
    console.log("Setor Macro inicializado com sucesso!");
}

// Exporta a função para o escopo global
window.inicializarSetorMacro = inicializarSetorMacro;