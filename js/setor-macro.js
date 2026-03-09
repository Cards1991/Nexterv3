// js/setor-macro.js

document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === "undefined") {
        console.error("Firebase DB not initialized");
        return;
    }

    const setoresDisponiveisSelect = document.getElementById('setores-disponiveis');
    const btnSalvar = document.getElementById('btn-salvar-macro-setor');
    const nomeMacroSetorInput = document.getElementById('macro-setor-nome');
    const listaMacroSetoresDiv = document.getElementById('lista-macro-setores');

    // Função para carregar setores no select
    async function carregarSetoresDisponiveis() {
        try {
            const setoresSnap = await db.collection('setores').orderBy('descricao').get();
            setoresDisponiveisSelect.innerHTML = ''; // Limpa o select
            setoresSnap.forEach(doc => {
                const setor = doc.data();
                const option = new Option(`${setor.descricao} (Empresa: ${setor.empresaId})`, doc.id);
                setoresDisponiveisSelect.add(option);
            });
        } catch (error) {
            console.error("Erro ao carregar setores:", error);
            setoresDisponiveisSelect.innerHTML = '<option>Erro ao carregar</option>';
        }
    }

    // Função para carregar e exibir os macro setores existentes
    async function carregarMacroSetores() {
        try {
            const macroSetoresSnap = await db.collection('macro_setores').orderBy('nome').get();
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
            
            // Usar Promise.all para buscar os nomes dos setores
            const promises = macroSetoresSnap.docs.map(async doc => {
                const macroSetor = doc.data();
                const setoresVinculadosIds = macroSetor.setoresIds || [];

                const setoresPromises = setoresVinculadosIds.map(id => db.collection('setores').doc(id).get());
                const setoresDocs = await Promise.all(setoresPromises);
                const nomesSetores = setoresDocs.map(setorDoc => setorDoc.exists ? setorDoc.data().descricao : 'Setor não encontrado').join(', ');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${macroSetor.nome}</td>
                    <td>${nomesSetores}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger" data-id="${doc.id}">Excluir</button>
                    </td>
                `;
                return tr;
            });

            const rows = await Promise.all(promises);
            rows.forEach(row => tbody.appendChild(row));

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
        const setoresSelecionados = Array.from(setoresDisponiveisSelect.selectedOptions).map(option => option.value);

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
            setoresDisponiveisSelect.selectedIndex = -1;
            
            await carregarMacroSetores(); // Recarrega a lista
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
                    await carregarMacroSetores(); // Recarrega a lista
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
});
