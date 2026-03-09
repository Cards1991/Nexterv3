// js/setor-macro.js

// Flag para evitar múltiplas inicializações
let setorMacroInicializado = false;

// MutationObserver para detectar quando a view setor-macro é inserida no DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
                // Verifica se é a view setor-macro ou contém os elementos necessários
                if (node.id === 'dynamic-content' || node.querySelector('#lista-setores-container')) {
                    if (!setorMacroInicializado) {
                        console.log("View setor-macro detectada via MutationObserver!");
                        setTimeout(inicializarSetorMacro, 100);
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

    // Verifica se os elementos já existem (caso a view esteja estática)
    const listaSetoresContainer = document.getElementById('lista-setores-container');
    if (listaSetoresContainer) {
        inicializarSetorMacro();
    }
});

// Função principal de inicialização do Setor Macro
function inicializarSetorMacro() {
    const listaSetoresContainer = document.getElementById('lista-setores-container');
    const searchInput = document.getElementById('search-setores-disponiveis');
    
    // Se os elementos não existirem ainda, não faz nada
    if (!listaSetoresContainer || !searchInput) {
        console.log("Aguardando elementos do Setor Macro...");
        return;
    }

    console.log("Inicializando Setor Macro...");
    
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const listaMacroSetoresDiv = document.getElementById('lista-macro-setores');

    // Array para armazenar os setores carregados
    let setoresData = [];

    // Função para carregar setores na lista com checkboxes
   async function carregarSetoresPorEmpresa(empresaId, selectId, setorSelecionado = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (!empresaId) {
        select.innerHTML = '<option value="">Selecione a empresa primeiro</option>';
        return;
    }

    select.innerHTML = '<option value="">Carregando...</option>';

    try {
        // Busca os setores da empresa selecionada
        const setoresSnapshot = await db.collection('setores')
            .where('empresaId', '==', empresaId)
            .get();

        if (setoresSnapshot.empty) {
            select.innerHTML = '<option value="">Nenhum setor cadastrado para esta empresa</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione um setor...</option>';

        // Ordena os setores por descrição
        const setoresDocs = setoresSnapshot.docs.sort((a, b) => {
            const descA = a.data().descricao || '';
            const descB = b.data().descricao || '';
            return descA.localeCompare(descB);
        });

        setoresDocs.forEach(doc => {
            const setor = doc.data();
            const option = document.createElement('option');
            
            // CORREÇÃO: Usar o ID do documento como value, não a descrição
            option.value = doc.id; // ANTES: setor.descricao
            option.textContent = setor.descricao;
            
            // Se houver um setor selecionado (ID do documento), marca como selected
            if (setorSelecionado && setorSelecionado === doc.id) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        select.innerHTML = '<option value="">Erro ao carregar setores</option>';
    }
}

    // Função para renderizar a lista de setores com checkboxes
    function renderizarListaSetores(setores) {
        if (setores.length === 0) {
            listaSetoresContainer.innerHTML = '<div class="text-muted p-2">Nenhum setor encontrado</div>';
            return;
        }

        let html = '';
        setores.forEach(setor => {
            html += `
                <div class="form-check setor-item" data-id="${setor.id}">
                    <input class="form-check-input setor-checkbox" type="checkbox" value="${setor.id}" id="setor-${setor.id}">
                    <label class="form-check-label" for="setor-${setor.id}">
                        ${setor.displayText}
                    </label>
                </div>
            `;
        });

        listaSetoresContainer.innerHTML = html;
    }

    // Função para obter os setores selecionados
    function getSetoresSelecionados() {
        const checkboxes = document.querySelectorAll('.setor-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Função para limpar as selections
    function limparSelecoes() {
        const checkboxes = document.querySelectorAll('.setor-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        if (searchInput) searchInput.value = '';
        renderizarListaSetores(setoresData);
    }

    // Função para carregar e exibir os macro setores existentes
    async function carregarMacroSetores() {
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

            const table = document.createElement('table');
            table.className = 'table table-hover';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Nome do Macro Setor</th>
                        <th>Setores Vinculados</th>
                        <th class="text-end">Ações</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;
            const tbody = table.querySelector('tbody');

            for (const doc of macroSetoresSnap.docs) {
                const macroSetor = doc.data();
                const setoresVinculadosIds = macroSetor.setoresIds || [];

                const nomesSetores = setoresVinculadosIds.map(id => {
                    const setor = setoresMap.get(id);
                    if (!setor) return '<span class="text-danger">Setor não encontrado</span>';
                    const nomeEmpresa = empresasMap.get(setor.empresaId) || 'Empresa desconhecida';
                    return `• ${setor.descricao} <small class="text-muted">(${nomeEmpresa})</small>`;
                }).join('<br>');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${macroSetor.nome}</td>
                    <td>${nomesSetores || 'Nenhum setor vinculado'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger" data-id="${doc.id}">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }

            listaMacroSetoresDiv.innerHTML = '';
            listaMacroSetoresDiv.appendChild(table);

        } catch (error) {
            console.error("Erro ao carregar macro setores:", error);
            listaMacroSetoresDiv.innerHTML = '<p class="text-danger">Erro ao carregar os macro setores.</p>';
        }
    }

    // Função para salvar o macro setor
    async function salvarMacroSetor() {
        const nome = nomeMacroSetorInput.value.trim();
        const setoresSelecionados = getSetoresSelecionados();

        if (!nome || setoresSelecionados.length === 0) {
            alert('Por favor, preencha o nome do macro setor e selecione pelo menos um setor.');
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
            
            await carregarMacroSetores();
            alert('Setor Macro salvo com sucesso!');

        } catch (error) {
            console.error("Erro ao salvar macro setor:", error);
            alert('Ocorreu um erro ao salvar o Setor Macro.');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Setor Macro';
        }
    }

    // Função para excluir o macro setor
    async function excluirMacroSetor(event) {
        if (event.target.classList.contains('btn-outline-danger')) {
            const docId = event.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este Setor Macro?')) {
                try {
                    await db.collection('macro_setores').doc(docId).delete();
                    await carregarMacroSetores();
                    alert('Setor Macro excluído com sucesso!');
                } catch (error) {
                    console.error("Erro ao excluir macro setor:", error);
                    alert('Ocorreu um erro ao excluir o Setor Macro.');
                }
            }
        }
    }

    // Adicionar Event Listeners
    btnSalvar.addEventListener('click', salvarMacroSetor);
    listaMacroSetoresDiv.addEventListener('click', excluirMacroSetor);

    // Inicialização
    carregarSetoresDisponiveis();
    carregarMacroSetores();
}

// Exportar a função de inicialização para o escopo global
window.inicializarSetorMacro = inicializarSetorMacro;

