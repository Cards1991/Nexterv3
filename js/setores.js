// js/setores.js

async function inicializarSetores() {
    await carregarSetores();
}

async function carregarSetores() {
    const tbody = document.getElementById('tabela-setores');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const [setoresSnap, empresasSnap, funcionariosSnap] = await Promise.all([
            db.collection('setores').orderBy('descricao').get(),
            db.collection('empresas').get(),
            db.collection('funcionarios').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
        const funcionariosMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, doc.data().nome]));

        if (setoresSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum setor cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        setoresSnap.forEach(doc => {
            const setor = doc.data();
            const empresaNome = empresasMap.get(setor.empresaId) || 'N/A';
            const gerenteNome = funcionariosMap.get(setor.gerenteId) || 'N/A';
            const dataCriacao = setor.createdAt?.toDate ? setor.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';

            const row = `
                <tr>
                    <td>${setor.descricao}</td>
                    <td>${empresaNome}</td>
                    <td>${gerenteNome}</td>
                    <td class="text-center">${setor.qtdIdeal || 0}</td>
                    <td>${dataCriacao}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalSetor('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirSetor('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar setores.</td></tr>';
    }
}

async function abrirModalSetor(setorId = null) {
    const modalEl = document.getElementById('setorModal');
    const form = document.getElementById('form-setor');
    form.reset();
    document.getElementById('setor-id').value = setorId || '';
    document.querySelector('#setorModal .modal-title').textContent = setorId ? 'Editar Setor' : 'Novo Setor';

    // Popular selects
    const empresaSelect = document.getElementById('setor-empresa');
    const gerenteSelect = document.getElementById('setor-gerente');
    
    empresaSelect.innerHTML = '<option value="">Carregando...</option>';
    gerenteSelect.innerHTML = '<option value="">Carregando...</option>';

    const [empresasSnap, funcionariosSnap] = await Promise.all([
        db.collection('empresas').orderBy('nome').get(),
        db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get()
    ]);

    empresaSelect.innerHTML = '<option value="">Selecione uma empresa</option>';
    empresasSnap.forEach(doc => {
        empresaSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    gerenteSelect.innerHTML = '<option value="">Nenhum</option>';
    funcionariosSnap.forEach(doc => {
        gerenteSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    if (setorId) {
        const doc = await db.collection('setores').doc(setorId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('setor-empresa').value = data.empresaId;
            document.getElementById('setor-descricao').value = data.descricao;
            document.getElementById('setor-gerente').value = data.gerenteId || '';
            document.getElementById('setor-qtd-ideal').value = data.qtdIdeal || '';
            document.getElementById('setor-observacao').value = data.observacao || '';
        }
    }

    new bootstrap.Modal(modalEl).show();
}

async function salvarSetor() {
    const setorId = document.getElementById('setor-id').value;
    const dados = {
        empresaId: document.getElementById('setor-empresa').value,
        descricao: document.getElementById('setor-descricao').value.trim(),
        gerenteId: document.getElementById('setor-gerente').value || null,
        qtdIdeal: parseInt(document.getElementById('setor-qtd-ideal').value) || 0,
        observacao: document.getElementById('setor-observacao').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.empresaId || !dados.descricao) {
        mostrarMensagem("Empresa e Descrição são obrigatórios.", "warning");
        return;
    }

    try {
        if (setorId) {
            await db.collection('setores').doc(setorId).update(dados);
            mostrarMensagem("Setor atualizado com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('setores').add(dados);
            mostrarMensagem("Setor cadastrado com sucesso!", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById('setorModal')).hide();
        await carregarSetores();
    } catch (error) {
        console.error("Erro ao salvar setor:", error);
        mostrarMensagem("Erro ao salvar o setor.", "error");
    }
}

async function excluirSetor(setorId) {
    if (!confirm("Tem certeza que deseja excluir este setor? Funcionários neste setor não serão excluídos, mas precisarão ser realocados.")) return;

    try {
        await db.collection('setores').doc(setorId).delete();
        mostrarMensagem("Setor excluído com sucesso.", "info");
        await carregarSetores();
    } catch (error) {
        console.error("Erro ao excluir setor:", error);
        mostrarMensagem("Erro ao excluir o setor.", "error");
    }
}