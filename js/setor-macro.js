// Variáveis globais do módulo
let __setoresData = [];

// FUNÇÃO: Limpa seleções de checkboxes
function limparSelecoes() {
    document.querySelectorAll('.setor-checkbox').forEach(cb => cb.checked = false);
}

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
    // Adiciona dinamicamente o campo oculto para o ID do macro setor em edição
    if (nomeMacroSetorInput && !document.getElementById('macro-setor-id')) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'macro-setor-id';
        nomeMacroSetorInput.form.appendChild(hiddenInput);
    }

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

            __setoresData = [];
            
            if (setoresSnap.empty) {
                listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
                return;
            }
            
            setoresSnap.forEach(doc => {
                const setor = doc.data();
                const nomeEmpresa = empresasMap.get(setor.empresaId) || 'Empresa não encontrada';
                
                __setoresData.push({
                    id: doc.id,
                    descricao: setor.descricao || 'Sem descrição',
                    empresaId: setor.empresaId,
                    empresaNome: nomeEmpresa,
                    displayText: `${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`
                });
            });

            console.log(`Carregados ${__setoresData.length} setores`);
            renderizarListaSetores(__setoresData);

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
                renderizarListaSetores(__setoresData);
                return;
            }

            const setoresFiltrados = __setoresData.filter(setor => 
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
                        <td><small>${nomesSetores}</small></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="editarMacroSetor('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirMacroSetor('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
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
        const docId = document.getElementById('macro-setor-id').value;
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
            const data = {
                nome: nome,
                setoresIds: setoresSelecionados,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (docId) {
                await db.collection('macro_setores').doc(docId).update(data);
                alert('Setor Macro atualizado com sucesso!');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('macro_setores').add(data);
                alert('Setor Macro salvo com sucesso!');
            }

            nomeMacroSetorInput.value = '';
            document.getElementById('macro-setor-id').value = ''; // Limpa o ID
            limparSelecoes();
            filtroEmpresaSelect.value = '';
            
            const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao-macro');
            if (btnCancelarEdicao) btnCancelarEdicao.remove();

            await carregarSetoresDisponiveis();
            await carregarMacroSetores();

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert('Erro ao salvar o Setor Macro.');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Setor Macro';
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
    
    console.log("Setor Macro inicializado com sucesso!");
}

// FUNÇÃO: Exclui macro setor (movida para o escopo global)
async function excluirMacroSetor(docId) {
    if (confirm('Tem certeza que deseja excluir este Setor Macro?')) {
        try {
            await db.collection('macro_setores').doc(docId).delete();
            // A função carregarMacroSetores não está no escopo global, então recarregamos a seção
            if (typeof showSection === 'function') {
                showSection('setor-macro');
            }
            mostrarMensagem('Setor Macro excluído com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert('Erro ao excluir o Setor Macro.');
        }
    }
}

// NOVA FUNÇÃO: Editar macro setor (movida para o escopo global)
async function editarMacroSetor(docId) {
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const hiddenIdInput = document.getElementById('macro-setor-id');

    try {
        const doc = await db.collection('macro_setores').doc(docId).get();
        if (!doc.exists) {
            alert('Setor Macro não encontrado.');
            return;
        }
        const macroSetor = doc.data();

        // Preenche o formulário
        nomeMacroSetorInput.value = macroSetor.nome;
        if (hiddenIdInput) hiddenIdInput.value = docId;

        // Limpa checkboxes anteriores
        limparSelecoes();

        // Marca os checkboxes correspondentes
        const setoresIds = macroSetor.setoresIds || [];
        setoresIds.forEach(setorId => {
            const checkbox = document.querySelector(`.setor-checkbox[value="${setorId}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Altera o botão para modo de edição
        btnSalvar.textContent = 'Atualizar Setor Macro';
        
        // Adiciona botão de cancelar edição se não existir
        if (!document.getElementById('btn-cancelar-edicao-macro')) {
            const btnCancelar = document.createElement('button');
            btnCancelar.type = 'button';
            btnCancelar.id = 'btn-cancelar-edicao-macro';
            btnCancelar.className = 'btn btn-secondary ms-2';
            btnCancelar.textContent = 'Cancelar Edição';
            btnCancelar.onclick = () => {
                nomeMacroSetorInput.value = '';
                if (hiddenIdInput) hiddenIdInput.value = '';
                limparSelecoes();
                btnSalvar.textContent = 'Salvar Setor Macro';
                btnCancelar.remove();
            };
            btnSalvar.parentNode.insertBefore(btnCancelar, btnSalvar.nextSibling);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Erro ao carregar macro setor para edição:", error);
        alert('Erro ao carregar dados para edição.');
    }
}

// Exporta a função para o escopo global
window.inicializarSetorMacro = inicializarSetorMacro;
window.excluirMacroSetor = excluirMacroSetor; // Exporta para o onclick
window.editarMacroSetor = editarMacroSetor; // Exporta para o onclick