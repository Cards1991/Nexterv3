// ========================================
// Módulo: Jurídico - Gestão de Clientes
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const tipoPessoaRadios = document.querySelectorAll('input[name="jur-tipo-pessoa"]');
    tipoPessoaRadios.forEach(radio => {
        radio.addEventListener('change', toggleCamposCliente);
    });
});

function toggleCamposCliente() {
    const tipo = document.querySelector('input[name="jur-tipo-pessoa"]:checked').value;
    const razaoSocialField = document.getElementById('campo-razao-social');
    const nomeFantasiaLabel = document.getElementById('label-nome-fantasia');
    const cnpjCpfLabel = document.getElementById('label-cnpj-cpf');

    if (tipo === 'PJ') {
        razaoSocialField.style.display = 'block';
        nomeFantasiaLabel.textContent = 'Nome Fantasia';
        cnpjCpfLabel.textContent = 'CNPJ';
    } else { // PF
        razaoSocialField.style.display = 'none';
        nomeFantasiaLabel.textContent = 'Nome Completo';
        cnpjCpfLabel.textContent = 'CPF';
    }
}

async function inicializarGestaoClientes() {
    await carregarClientesJuridicos();
    // Limpa o container de top clientes
    const topClientesContainer = document.getElementById('jur-cli-top-clientes');
    if (topClientesContainer) topClientesContainer.innerHTML = '<p class="text-muted text-center">Carregando análise de clientes...</p>';
    // Futuramente, chamar a função que carrega os top clientes aqui
}

async function carregarClientesJuridicos() {
    const tbody = document.getElementById('tabela-clientes-juridicos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando clientes...</td></tr>';

    try {
        const snapshot = await db.collection('clientes_juridicos').orderBy('nomeFantasia').get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum cliente cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const cliente = doc.data();
            const row = `
                <tr>
                    <td>${cliente.nomeFantasia || '-'}</td>
                    <td>${cliente.razaoSocial || 'N/A'}</td>
                    <td>${cliente.cnpjCpf || '-'}</td>
                    <td>${cliente.email || cliente.telefone || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalClienteJuridico('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirClienteJuridico('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar clientes jurídicos:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar clientes.</td></tr>';
    }
}

async function abrirModalClienteJuridico(clienteId = null) {
    const modalEl = document.getElementById('clienteJuridicoModal');
    const modalTitle = document.getElementById('clienteJuridicoModalTitle');
    const form = document.getElementById('form-cliente-juridico');
    form.reset();
    document.getElementById('jur-cliente-id').value = clienteId || '';

    if (clienteId) {
        modalTitle.textContent = 'Editar Cliente';
        const doc = await db.collection('clientes_juridicos').doc(clienteId).get();
        if (doc.exists) {
            const data = doc.data();
            document.querySelector(`input[name="jur-tipo-pessoa"][value="${data.tipoPessoa}"]`).checked = true;
            document.getElementById('jur-cliente-razao-social').value = data.razaoSocial || '';
            document.getElementById('jur-cliente-nome-fantasia').value = data.nomeFantasia || '';
            document.getElementById('jur-cliente-cnpj-cpf').value = data.cnpjCpf || '';
            document.getElementById('jur-cliente-ie').value = data.ie || '';
            document.getElementById('jur-cliente-contato').value = data.contato || '';
            document.getElementById('jur-cliente-email').value = data.email || '';
            document.getElementById('jur-cliente-telefone').value = data.telefone || '';
            document.getElementById('jur-cliente-cep').value = data.cep || '';
            document.getElementById('jur-cliente-endereco').value = data.endereco || '';
            document.getElementById('jur-cliente-numero').value = data.numero || '';
            document.getElementById('jur-cliente-complemento').value = data.complemento || '';
            document.getElementById('jur-cliente-cidade').value = data.cidade || '';
            document.getElementById('jur-cliente-estado').value = data.estado || '';
        }
    } else {
        modalTitle.textContent = 'Novo Cliente';
        document.getElementById('jur-pessoa-juridica').checked = true;
    }

    toggleCamposCliente();
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarClienteJuridico() {
    const clienteId = document.getElementById('jur-cliente-id').value;
    const dados = {
        tipoPessoa: document.querySelector('input[name="jur-tipo-pessoa"]:checked').value,
        razaoSocial: document.getElementById('jur-cliente-razao-social').value,
        nomeFantasia: document.getElementById('jur-cliente-nome-fantasia').value,
        cnpjCpf: document.getElementById('jur-cliente-cnpj-cpf').value,
        ie: document.getElementById('jur-cliente-ie').value,
        contato: document.getElementById('jur-cliente-contato').value,
        email: document.getElementById('jur-cliente-email').value,
        telefone: document.getElementById('jur-cliente-telefone').value,
        cep: document.getElementById('jur-cliente-cep').value,
        endereco: document.getElementById('jur-cliente-endereco').value,
        numero: document.getElementById('jur-cliente-numero').value,
        complemento: document.getElementById('jur-cliente-complemento').value,
        cidade: document.getElementById('jur-cliente-cidade').value,
        estado: document.getElementById('jur-cliente-estado').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.nomeFantasia || !dados.cnpjCpf) {
        mostrarMensagem("Nome e CNPJ/CPF são obrigatórios.", "warning");
        return;
    }

    try {
        if (clienteId) {
            await db.collection('clientes_juridicos').doc(clienteId).update(dados);
            mostrarMensagem("Cliente atualizado com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('clientes_juridicos').add(dados);
            mostrarMensagem("Cliente cadastrado com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('clienteJuridicoModal')).hide();
        await carregarClientesJuridicos();

    } catch (error) {
        console.error("Erro ao salvar cliente:", error);
        mostrarMensagem("Erro ao salvar o cliente.", "error");
    }
}

async function excluirClienteJuridico(clienteId) {
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await db.collection('clientes_juridicos').doc(clienteId).delete();
        mostrarMensagem("Cliente excluído com sucesso.", "success");
        await carregarClientesJuridicos();
    } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        mostrarMensagem("Falha ao excluir o cliente.", "error");
    }
}