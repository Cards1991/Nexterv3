// Gerenciamento de Solicitações (Reposição e Contratação)

document.addEventListener('DOMContentLoaded', function() {
    // Configurar listener para o select de empresa no modal de reposição
    const repEmpresaSelect = document.getElementById('rep-nova-empresa');
    if (repEmpresaSelect) {
        repEmpresaSelect.addEventListener('change', () => carregarSetoresPorEmpresa(repEmpresaSelect.value, 'rep-nova-setor'));
    }

    // Configurar listener para o select de empresa no modal de contratação
    const contrEmpresaSelect = document.getElementById('contr-empresa');
    if (contrEmpresaSelect) {
        contrEmpresaSelect.addEventListener('change', () => carregarSetoresPorEmpresa(contrEmpresaSelect.value, 'contr-setor'));
    }
});

// Função para abrir o modal de nova reposição
async function abrirNovaReposicaoModal() {
    try {
        document.getElementById('form-reposicao-nova').reset();

        // Popular o select de funcionários demitidos
        const selectFuncionario = document.getElementById('rep-nova-funcionario');
        selectFuncionario.innerHTML = '<option value="">Selecione um funcionário (opcional)</option>';
        
        const funcSnap = await db.collection('funcionarios').where('status', '==', 'Inativo').orderBy('nome').get();
        funcSnap.forEach(doc => {
            const funcionario = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${funcionario.nome}`;
            selectFuncionario.appendChild(option);
        });

        // Popular empresas
        await carregarSelectEmpresas('rep-nova-empresa');
        
        const modal = new bootstrap.Modal(document.getElementById('reposicaoNovaModal'));
        modal.show();
    } catch (error) {
        console.error("Erro ao abrir modal de reposição:", error);
        mostrarMensagem("Erro ao preparar solicitação de reposição.", "error");
    }
}

// Função para abrir o modal de nova contratação
async function abrirNovaContratacaoModal() {
    try {
        document.getElementById('form-contratacao-nova').reset();
        
        // Popular empresas
        await carregarSelectEmpresas('contr-empresa');
        
        const modal = new bootstrap.Modal(document.getElementById('contratacaoNovaModal'));
        modal.show();
    } catch (error) {
        console.error("Erro ao abrir modal de contratação:", error);
        mostrarMensagem("Erro ao preparar solicitação de contratação.", "error");
    }
}

// Função para criar uma solicitação de reposição
async function criarReposicaoManual() {
    try {
        const funcionarioId = document.getElementById('rep-nova-funcionario').value;
        const funcionarioNome = document.getElementById('rep-nova-funcionario').options[document.getElementById('rep-nova-funcionario').selectedIndex].text;
        const empresaId = document.getElementById('rep-nova-empresa').value;
        const setor = document.getElementById('rep-nova-setor').value;
        const cargo = document.getElementById('rep-nova-cargo').value;

        if (!empresaId || !setor || !cargo) {
            mostrarMensagem("Empresa, Setor e Cargo são obrigatórios.", "warning");
            return;
        }

        await db.collection('reposicoes').add({
            funcionarioId: funcionarioId || null,
            funcionarioNome: funcionarioId ? funcionarioNome : 'N/A',
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            status: 'pendente',
            abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid
        });

        mostrarMensagem("Solicitação de reposição aberta com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('reposicaoNovaModal')).hide();
        await carregarDadosDashboard(); // Atualiza o dashboard

    } catch (error) {
        console.error("Erro ao criar solicitação de reposição:", error);
        mostrarMensagem("Falha ao criar solicitação.", "error");
    }
}

// Função para criar uma solicitação de contratação
async function criarContratacaoManual() {
    try {
        const empresaId = document.getElementById('contr-empresa').value;
        const setor = document.getElementById('contr-setor').value;
        const cargo = document.getElementById('contr-cargo').value;
        const observacoes = document.getElementById('contr-observacoes').value;

        if (!empresaId || !setor || !cargo) {
            mostrarMensagem("Empresa, Setor e Cargo são obrigatórios.", "warning");
            return;
        }

        await db.collection('contratacoes').add({
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            observacoes: observacoes,
            status: 'pendente',
            abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid
        });

        mostrarMensagem("Solicitação de contratação aberta com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('contratacaoNovaModal')).hide();
        await carregarDadosDashboard(); // Atualiza o dashboard

    } catch (error) {
        console.error("Erro ao criar solicitação de contratação:", error);
        mostrarMensagem("Falha ao criar solicitação.", "error");
    }
}