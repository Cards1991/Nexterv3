// ========================================
// Módulo: Controle Disciplinar
// Descrição: Gerenciamento de controle disciplinar de funcionários
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Módulo Controle Disciplinar carregado');
    
    // Adiciona o evento de clique ao botão para abrir o modal de novo registro
    const btnNovoRegistro = document.getElementById('btn-novo-registro-disciplinar');
    if (btnNovoRegistro) {
        btnNovoRegistro.addEventListener('click', () => abrirModalNovoRegistroDisciplinar());
    }
});

// Função para carregar dados de controle disciplinar
function carregarDadosDisciplinares() {
    console.log('Carregando dados de controle disciplinar...');
    // TODO: Implementar lógica de carregamento dos dados
}

// Função para abrir modal de novo registro
async function abrirModalNovoRegistroDisciplinar(id = null) {
    console.log('Abrindo modal para novo registro disciplinar');
    const modal = new bootstrap.Modal(document.getElementById('registroDisciplinarModal'));
    const form = document.getElementById('form-registro-disciplinar');
    form.reset();
    document.getElementById('registro-disciplinar-id').value = '';

    // Preencher select de funcionários
    const selectFuncionario = document.getElementById('disciplinar-funcionario');
    selectFuncionario.innerHTML = '<option value="">Carregando...</option>';

    try {
        const funcionariosSnapshot = await db.collection('funcionarios').where('status', '==', 'ativo').orderBy('nome').get();
        selectFuncionario.innerHTML = '<option value="">Selecione o funcionário</option>';
        funcionariosSnapshot.forEach(doc => {
            const funcionario = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = funcionario.nome;
            selectFuncionario.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar funcionários: ", error);
        selectFuncionario.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarMensagem('Falha ao carregar a lista de funcionários.', 'error');
    }

    // TODO: Implementar lógica para carregar dados se for edição (id != null)

    modal.show();
}

// Função para salvar novo registro
async function salvarRegistroDisciplinar() {
    const registroId = document.getElementById('registro-disciplinar-id').value;
    const funcionarioSelect = document.getElementById('disciplinar-funcionario');
    const funcionarioId = funcionarioSelect.value;
    const funcionarioNome = funcionarioSelect.options[funcionarioSelect.selectedIndex].text;
    const dataOcorrencia = document.getElementById('disciplinar-data').value;
    const medidaAplicada = document.getElementById('disciplinar-tipo').value;
    const descricao = document.getElementById('disciplinar-ocorrencia').value;

    // Validação
    if (!funcionarioId || !dataOcorrencia || !medidaAplicada || !descricao) {
        mostrarMensagem('Por favor, preencha todos os campos do formulário.', 'warning');
        return;
    }

    const registroData = {
        funcionarioId,
        funcionarioNome,
        dataOcorrencia: new Date(dataOcorrencia.replace(/-/g, '\/')),
        medidaAplicada,
        descricao,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
        if (registroId) {
            // Atualizar registro existente
            await db.collection('registros_disciplinares').doc(registroId).update(registroData);
            mostrarMensagem('Registro disciplinar atualizado com sucesso!', 'success');
        } else {
            // Criar novo registro
            registroData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('registros_disciplinares').add(registroData);
            mostrarMensagem('Registro disciplinar salvo com sucesso!', 'success');
        }

        bootstrap.Modal.getInstance(document.getElementById('registroDisciplinarModal')).hide();
        await carregarDadosDisciplinares(); // Atualiza a tabela
    } catch (error) {
        console.error("Erro ao salvar registro disciplinar: ", error);
        mostrarMensagem('Falha ao salvar o registro disciplinar.', 'error');
    }
}

// Função para editar registro
function editarRegistroDisciplinar(id) {
    console.log('Editando registro disciplinar:', id);
    // TODO: Implementar lógica de edição
}

// Função para deletar registro
function deletarRegistroDisciplinar(id) {
    console.log('Deletando registro disciplinar:', id);
    // TODO: Implementar lógica de deleção
}

// Função para exportar relatório
function exportarRelatorioDisciplinar() {
    console.log('Exportando relatório de controle disciplinar');
    // TODO: Implementar lógica de exportação
}
