// Variáveis globais do módulo
let __setoresData = [];
let __setoresJaVinculados = new Set();
let __macroSetorEmEdicaoId = null;
let __setoresDoMacroAtual = [];
let __listaSetoresContainer = null;
let __empresasMap = new Map();

// FUNÇÃO: Limpa selecões de checkboxes
function limparSelecoes() {
    document.querySelectorAll('.setor-checkbox').forEach(cb => cb.checked = false);
}

// FUNÇÃO: Carrega empresas para uso global
async function carregarEmpresasGlobal() {
    __empresasMap.clear();
    try {
        const empresasSnap = await db.collection('empresas').orderBy('nome').get();
        empresasSnap.forEach(doc => {
            __empresasMap.set(doc.id, doc.data().nome);
        });
        console.log(`Carregadas ${__empresasMap.size} empresas`);
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }
}

// FUNÇÃO: Carrega todos os setores já vinculados
async function carregarSetoresJaVinculados(excluirMacroId = null) {
    __setoresJaVinculados.clear();
    try {
        const macroSetoresSnap = await db.collection('macro_setores').get();
        macroSetoresSnap.forEach(doc => {
            if (excluirMacroId && doc.id === excluirMacroId) return;
            const macroSetor = doc.data();
            if (macroSetor.setoresIds && Array.isArray(macroSetor.setoresIds)) {
                macroSetor.setoresIds.forEach(setorId => {
                    __setoresJaVinculados.add(setorId);
                });
            }
        });
        console.log(`Setores já vinculados: ${__setoresJaVinculados.size}`);
    } catch (error) {
        console.error("Erro ao carregar setores já vinculados:", error);
    }
}

// FUNÇÃO: Renderiza a lista de setores
function renderizarListaSetores(setores) {
    if (!__listaSetoresContainer) {
        __listaSetoresContainer = document.getElementById('lista-setores-container');
    }
    if (!__listaSetoresContainer) return;

    if (!setores || setores.length === 0) {
        __listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
        return;
    }

    let html = '';
    setores.forEach(setor => {
        const checkboxId = `setor-${setor.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const disabledAttr = setor.disabled ? 'disabled' : '';
        const checkedAttr = setor.jaVinculadoEste ? 'checked' : '';

        html += `
            <div class="form-check setor-item mb-1 ${setor.opacityClass}" data-id="${setor.id}">
                <input class="form-check-input setor-checkbox" type="checkbox" value="${setor.id}" id="${checkboxId}" ${disabledAttr} ${checkedAttr}>
                <label class="form-check-label" for="${checkboxId}">
                    ${setor.displayText}
                </label>
            </div>
        `;
    });

    __listaSetoresContainer.innerHTML = html;
}

// FUNÇÃO: Carrega empresas para o modal de novo setor
async function carregarEmpresasParaModalNovoSetor() {
    const select = document.getElementById('novo-setor-empresa');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando...</option>';

    try {
        const snapshot = await db.collection('empresas').orderBy('nome').get();
        if (snapshot.empty) {
            select.innerHTML = '<option value="">Nenhuma empresa cadastrada</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione...</option>';
        snapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// FUNÇÃO: Salvar novo setor - Versão simplificada e robusta
async function salvarNovoSetor() {
    const nomeInput = document.getElementById('novo-setor-nome');
    const btnSalvar = document.getElementById('btn-salvar-novo-setor');
    const empresaSelect = document.getElementById('novo-setor-empresa');

    if (!nomeInput || !btnSalvar || !empresaSelect) {
        console.error("Elementos do modal não encontrados");
        return;
    }

    // Usa a empresa selecionada no modal. Se nenhuma for selecionada, o valor será null.
    const empresaId = empresaSelect.value || null;
    const nome = nomeInput.value.trim();

    if (!nome) {
        alert('Por favor, preencha o nome do setor.');
        return;
    }

    btnSalvar.disabled = true;
    const textoOriginal = btnSalvar.textContent;
    btnSalvar.textContent = 'Salvando...';

    try {
        // Verifica se já existe (apenas se tiver empresa selecionada)
        if (empresaId) {
            const existenteQuery = await db.collection('setores')
                .where('empresaId', '==', empresaId)
                .where('descricao', '==', nome)
                .get();

            if (!existenteQuery.empty) {
                alert('Já existe um setor com este nome para a empresa selecionada.');
                btnSalvar.disabled = false;
                btnSalvar.textContent = textoOriginal;
                return;
            }
        }

        // Cria o novo setor
        await db.collection('setores').add({
            descricao: nome,
            empresaId: empresaId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Limpa os campos
        nomeInput.value = '';

        // Recarrega a lista de setores
        if (typeof window.carregarSetoresDisponiveis === 'function') {
            await window.carregarSetoresDisponiveis();
        }

        alert('Setor criado com sucesso!');

        // Fechar modal usando Bootstrap
        const modalEl = document.getElementById('modal-novo-setor');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            } else {
                // Se não houver instância, cria uma temporária para fechar
                const tempModal = new bootstrap.Modal(modalEl);
                tempModal.hide();
            }
        }

    } catch (error) {
        console.error("Erro ao criar setor:", error);
        alert('Erro ao criar o setor: ' + error.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = textoOriginal;
    }
}

// FUNÇÃO: Carrega setores disponíveis
async function carregarSetoresDisponiveis() {
    const listaSetoresContainer = document.getElementById('lista-setores-container');
    const filtroEmpresaSelect = document.getElementById('filtro-empresa-setores');

    if (!listaSetoresContainer) return;

    const empresaId = filtroEmpresaSelect ? filtroEmpresaSelect.value : '';

    listaSetoresContainer.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-spinner fa-spin"></i> Carregando setores...</div>';

    try {
        // Busca todos os setores
        const setoresSnap = await db.collection('setores').get();

        let setoresArray = [];
        setoresSnap.forEach(doc => {
            setoresArray.push({ id: doc.id, data: doc.data() });
        });

        // Filtra por empresa
        if (empresaId) {
            setoresArray = setoresArray.filter(s => s.data.empresaId === empresaId);
        }

        // Ordena
        setoresArray.sort((a, b) => {
            const descA = a.data.descricao || '';
            const descB = b.data.descricao || '';
            return descA.localeCompare(descB);
        });

        __setoresData = [];

        if (setoresArray.length === 0) {
            listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
            return;
        }

        setoresArray.forEach(item => {
            const setor = item.data;
            const nomeEmpresa = __empresasMap.get(setor.empresaId) || 'Empresa não encontrada';
            const jaVinculadoOutro = __setoresJaVinculados.has(item.id);
            const jaVinculadoEste = __setoresDoMacroAtual.includes(item.id);

            let displayText = `${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`;
            let disabled = jaVinculadoOutro;
            let opacityClass = jaVinculadoOutro ? 'opacity-50' : '';

            if (jaVinculadoEste) {
                displayText += ' <span class="badge bg-primary">Vinculado a este macro</span>';
            } else if (jaVinculadoOutro) {
                displayText += ' <span class="badge bg-secondary">Já vinculado a outro macro</span>';
            }

            __setoresData.push({
                id: item.id,
                descricao: setor.descricao || 'Sem descrição',
                empresaId: setor.empresaId,
                empresaNome: nomeEmpresa,
                jaVinculadoOutro: jaVinculadoOutro,
                jaVinculadoEste: jaVinculadoEste,
                displayText: displayText,
                disabled: disabled,
                opacityClass: opacityClass
            });
        });

        console.log(`Carregados ${__setoresData.length} setores`);
        renderizarListaSetores(__setoresData);

    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        listaSetoresContainer.innerHTML = '<div class="text-danger p-2">Erro ao carregar setores</div>';
    }
}

// Função principal de inicialização
async function inicializarSetorMacro() {
    console.log("Inicializando Setor Macro...");

    const listaSetoresContainer = document.getElementById('lista-setores-container');
    __listaSetoresContainer = listaSetoresContainer;

    const searchInput = document.getElementById('search-setores-disponiveis');
    const filtroEmpresaSelect = document.getElementById('filtro-empresa-setores');
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const listaMacroSetoresDiv = document.getElementById('lista-macro-setores');

    if (nomeMacroSetorInput && !document.getElementById('macro-setor-id')) {
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'macro-setor-id';
        document.body.appendChild(hiddenInput);
    }

    if (!listaSetoresContainer || !searchInput || !filtroEmpresaSelect || !btnSalvar || !nomeMacroSetorInput || !listaMacroSetoresDiv) {
        console.log("Aguardando elementos...");
        return;
    }

    // 1. Carregar empresas
    await carregarEmpresasGlobal();

    // 2. Carregar setores já vinculados
    await carregarSetoresJaVinculados();

    // 3. Popular select de empresas
    filtroEmpresaSelect.innerHTML = '<option value="">Todas as empresas</option>';
    __empresasMap.forEach((nome, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = nome;
        filtroEmpresaSelect.appendChild(option);
    });

    // 4. Carregar empresas para modal
    await carregarEmpresasParaModalNovoSetor();

    // 5. Configurar botão salvar novo setor
    const btnSalvarNovoSetor = document.getElementById('btn-salvar-novo-setor');
    if (btnSalvarNovoSetor) {
        // Remove eventos antigos clonando
        btnSalvarNovoSetor.replaceWith(btnSalvarNovoSetor.cloneNode(true));
        document.getElementById('btn-salvar-novo-setor').addEventListener('click', salvarNovoSetor);
    }

    // 6. Carregar setores
    await carregarSetoresDisponiveis();

    // 7. Configurar busca
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

    // 8. Carregar macros
    await carregarMacroSetores();

    // 9. Filtro empresa
    filtroEmpresaSelect.addEventListener('change', () => {
        carregarSetoresDisponiveis();
    });

    // 10. Botão salvar macro
    const newBtnSalvar = btnSalvar.cloneNode(true);
    btnSalvar.parentNode.replaceChild(newBtnSalvar, btnSalvar);

    newBtnSalvar.addEventListener('click', async () => {
        const docId = document.getElementById('macro-setor-id').value;
        const nome = nomeMacroSetorInput.value.trim();
        const checkboxes = document.querySelectorAll('.setor-checkbox:checked:not(:disabled)');
        const setoresSelecionados = Array.from(checkboxes).map(cb => cb.value);

        if (!nome) {
            alert('Por favor, preencha o nome do macro setor.');
            return;
        }

        if (setoresSelecionados.length === 0) {
            alert('Selecione pelo menos um setor.');
            return;
        }

        newBtnSalvar.disabled = true;
        newBtnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

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
            document.getElementById('macro-setor-id').value = '';
            limparSelecoes();
            filtroEmpresaSelect.value = '';

            const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao-macro');
            if (btnCancelarEdicao) btnCancelarEdicao.remove();

            __macroSetorEmEdicaoId = null;
            __setoresDoMacroAtual = [];

            await carregarSetoresJaVinculados();
            await carregarSetoresDisponiveis();
            await carregarMacroSetores();

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert('Erro ao salvar o Setor Macro.');
        } finally {
            newBtnSalvar.disabled = false;
            newBtnSalvar.textContent = 'Salvar Setor Macro';
        }
    });

    // 11. Botão novo macro setor (cria diretamente)
    const btnNovoMacroSetor = document.getElementById('btn-novo-macro-setor');
    if (btnNovoMacroSetor) {
        btnNovoMacroSetor.addEventListener('click', async () => {
            const nome = nomeMacroSetorInput.value.trim();
            
            if (!nome) {
                alert('Por favor, preencha o nome do setor macro.');
                nomeMacroSetorInput.focus();
                return;
            }

            btnNovoMacroSetor.disabled = true;
            const textoOriginal = btnNovoMacroSetor.innerHTML;
            btnNovoMacroSetor.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

            try {
                // Cria o novo setor macro sem vincular setores
                await db.collection('macro_setores').add({
                    nome: nome,
                    setoresIds: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert('Setor Macro criado com sucesso! Você pode editá-lo depois para adicionar setores.');

                // Limpa os campos
                nomeMacroSetorInput.value = '';

                // Recarrega a lista de macros
                await carregarMacroSetores();

            } catch (error) {
                console.error("Erro ao criar setor macro:", error);
                alert('Erro ao criar o Setor Macro: ' + error.message);
            } finally {
                btnNovoMacroSetor.disabled = false;
                btnNovoMacroSetor.innerHTML = textoOriginal;
            }
        });
    }

    console.log("Setor Macro inicializado!");
}

// FUNÇÃO: Carrega macro setores existentes
async function carregarMacroSetores() {
    const listaMacroSetoresDiv = document.getElementById('lista-macro-setores');
    if (!listaMacroSetoresDiv) return;

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
                    <td><a href="javascript:void(0)" onclick="editarMacroSetor('${doc.id}')" class="text-primary text-decoration-none fw-bold">${macroSetor.nome}</a></td>
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

// FUNÇÃO: Exclui macro setor
async function excluirMacroSetor(docId) {
    if (confirm('Tem certeza que deseja excluir este Setor Macro?')) {
        try {
            await db.collection('macro_setores').doc(docId).delete();
            if (typeof showSection === 'function') {
                showSection('setor-macro');
            }
            alert('Setor Macro excluído com sucesso!');
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert('Erro ao excluir o Setor Macro.');
        }
    }
}

// FUNÇÃO: Editar macro setor
async function editarMacroSetor(docId) {
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const hiddenIdInput = document.getElementById('macro-setor-id');
    const filtroEmpresaSelect = document.getElementById('filtro-empresa-setores');

    try {
        const doc = await db.collection('macro_setores').doc(docId).get();
        if (!doc.exists) {
            alert('Setor Macro não encontrado.');
            return;
        }
        const macroSetor = doc.data();

        __macroSetorEmEdicaoId = docId;
        __setoresDoMacroAtual = macroSetor.setoresIds || [];
        console.log("Setores deste macro:", __setoresDoMacroAtual);

        await carregarSetoresJaVinculados(docId);

        // Busca setores e processa
        const setoresSnap = await db.collection('setores').get();

        let setoresArray = [];
        setoresSnap.forEach(d => setoresArray.push({ id: d.id, data: d.data() }));

        setoresArray.sort((a, b) => (a.data.descricao || '').localeCompare(b.data.descricao || ''));

        __setoresData = [];
        setoresArray.forEach(item => {
            const setor = item.data;
            const nomeEmpresa = __empresasMap.get(setor.empresaId) || 'Empresa não encontrada';

            const jaVinculadoOutro = __setoresJaVinculados.has(item.id);
            const jaVinculadoEste = __setoresDoMacroAtual.includes(item.id);

            let displayText = `${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`;
            let disabled = jaVinculadoOutro;
            let opacityClass = jaVinculadoOutro ? 'opacity-50' : '';

            if (jaVinculadoEste) {
                displayText += ' <span class="badge bg-primary">Vinculado a este macro</span>';
            } else if (jaVinculadoOutro) {
                displayText += ' <span class="badge bg-secondary">Já vinculado a outro macro</span>';
            }

            __setoresData.push({
                id: item.id,
                descricao: setor.descricao || 'Sem descrição',
                empresaId: setor.empresaId,
                empresaNome: nomeEmpresa,
                jaVinculadoOutro: jaVinculadoOutro,
                jaVinculadoEste: jaVinculadoEste,
                displayText: displayText,
                disabled: disabled,
                opacityClass: opacityClass
            });
        });

        if (filtroEmpresaSelect) filtroEmpresaSelect.value = '';
        renderizarListaSetores(__setoresData);

        nomeMacroSetorInput.value = macroSetor.nome;
        if (hiddenIdInput) hiddenIdInput.value = docId;

        btnSalvar.textContent = 'Atualizar Setor Macro';

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

                __macroSetorEmEdicaoId = null;
                __setoresDoMacroAtual = [];

                carregarSetoresJaVinculados();
                carregarSetoresDisponiveis();
            };
            btnSalvar.parentNode.insertBefore(btnCancelar, btnSalvar.nextSibling);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Erro ao carregar macro setor para edição:", error);
        alert('Erro ao carregar dados para edição.');
    }
}

// Exporta as funções
window.inicializarSetorMacro = inicializarSetorMacro;
window.excluirMacroSetor = excluirMacroSetor;
window.editarMacroSetor = editarMacroSetor;
window.renderizarListaSetores = renderizarListaSetores;
window.carregarSetoresJaVinculados = carregarSetoresJaVinculados;
window.carregarSetoresDisponiveis = carregarSetoresDisponiveis;
window.salvarNovoSetor = salvarNovoSetor;
