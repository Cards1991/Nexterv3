// Gerenciamento de empresas
let empresas = [];

// Carregar empresas
async function carregarEmpresas() {
    try {
        const tbody = document.getElementById('tabela-empresas');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const empresasSnapshot = await db.collection('empresas').get();
        empresas = [];

        if (empresasSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma empresa cadastrada</td></tr>';
            return;
        }

        // Contar funcionários por empresa
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const contagemFuncionarios = {};
        funcionariosSnapshot.forEach(doc => {
            const func = doc.data();
            if (func.empresaId) {
                contagemFuncionarios[func.empresaId] = (contagemFuncionarios[func.empresaId] || 0) + 1;
            }
        });

        tbody.innerHTML = '';
        empresasSnapshot.forEach(doc => {
            const empresa = { id: doc.id, ...doc.data() };
            empresas.push(empresa);

            const numFuncionarios = contagemFuncionarios[doc.id] || 0;
            const setores = Array.isArray(empresa.setores) && empresa.setores.length ? 
                empresa.setores.join(', ') : 'Nenhum setor cadastrado';
            const numFuncoes = Array.isArray(empresa.funcoes) ? empresa.funcoes.length : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${empresa.nome}</td>
                <td>${empresa.cnpj || 'Não informado'}</td>
                <td>${setores}</td>
                <td><span class="badge bg-primary">${numFuncionarios}</span></td>
                <td><span class="badge bg-info">${numFuncoes}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editarEmpresa('${doc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirEmpresa('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        mostrarMensagem('Erro ao carregar empresas', 'error');
    }
}

// Salvar empresa
async function salvarEmpresa() {
    try {
        const nome = document.getElementById('nome-empresa').value;
        const cnpj = document.getElementById('cnpj-empresa').value;
        const setoresText = document.getElementById('setores-empresa').value;
        const funcoesText = document.getElementById('funcoes-empresa').value;
        const pagaFGTS = document.getElementById('paga-fgts-empresa').checked;
        const pagaSindicato = document.getElementById('paga-sindicato-empresa').checked;

        if (!nome) {
            mostrarMensagem('Preencha o nome da empresa', 'warning');
            return;
        }

        const setores = setoresText.split(',').map(s => s.trim()).filter(s => s);
        const funcoes = funcoesText.split(',').map(f => f.trim()).filter(f => f);
        const user = firebase.auth().currentUser;

        const empresaData = {
            nome: nome,
            cnpj: cnpj,
            pagaFGTS: pagaFGTS,
            pagaSindicato: pagaSindicato,
            setores: setores,
            funcoes: funcoes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),            
            createdByUid: user ? user.uid : null
        };

        await db.collection('empresas').add(empresaData);

        // Fechar modal e limpar formulário
        const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
        modal.hide();
        document.getElementById('form-empresa').reset();

        // Recarregar lista
        carregarEmpresas();
        mostrarMensagem('Empresa cadastrada com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar empresa:', error);
        mostrarMensagem('Erro ao salvar empresa', 'error');
    }
}

// Editar empresa
async function editarEmpresa(empresaId) {
    const empresa = empresas.find(e => e.id === empresaId);
    if (empresa) {
        // Preencher modal com dados da empresa
        document.getElementById('nome-empresa').value = empresa.nome;
        document.getElementById('cnpj-empresa').value = empresa.cnpj || '';
        document.getElementById('setores-empresa').value = Array.isArray(empresa.setores) ? empresa.setores.join(', ') : '';
        document.getElementById('funcoes-empresa').value = Array.isArray(empresa.funcoes) ? empresa.funcoes.join(', ') : '';
        document.getElementById('paga-fgts-empresa').checked = empresa.pagaFGTS === true;
        document.getElementById('paga-sindicato-empresa').checked = empresa.pagaSindicato === true;

        // Garante que o título do modal esteja correto para edição
        const modalTitle = document.querySelector('#empresaModal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Empresa';

        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('empresaModal'));
        modal.show();

        // Alterar comportamento do botão salvar
        const salvarBtn = document.querySelector('#empresaModal .btn-primary');
        salvarBtn.textContent = 'Atualizar Empresa';
        salvarBtn.onclick = function() { atualizarEmpresa(empresaId); };
    }
}

// Atualizar empresa
async function atualizarEmpresa(empresaId) {
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        const nome = document.getElementById('nome-empresa').value;
        const cnpj = document.getElementById('cnpj-empresa').value;
        const setoresText = document.getElementById('setores-empresa').value;
        const funcoesText = document.getElementById('funcoes-empresa').value;
        const pagaFGTS = document.getElementById('paga-fgts-empresa').checked;
        const pagaSindicato = document.getElementById('paga-sindicato-empresa').checked;
        const setores = setoresText.split(',').map(s => s.trim()).filter(s => s);
        const funcoes = funcoesText.split(',').map(f => f.trim()).filter(f => f);
        const user = firebase.auth().currentUser;

        const updateData = {
            nome: nome,
            cnpj: cnpj,
            setores: setores,
            funcoes: funcoes,
            pagaFGTS: pagaFGTS,
            pagaSindicato: pagaSindicato,
            updatedAt: timestamp(),
            updatedByUid: user ? user.uid : null
        };

        await db.collection('empresas').doc(empresaId).update(updateData);

        // Fechar modal e resetar
        const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
        modal.hide();
        document.getElementById('form-empresa').reset();

        // Restaurar comportamento do botão
        const salvarBtn = document.querySelector('#empresaModal .btn-primary');
        salvarBtn.textContent = 'Salvar Empresa';
        salvarBtn.onclick = salvarEmpresa;

        // Recarregar lista
        carregarEmpresas();
        mostrarMensagem('Empresa atualizada com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        mostrarMensagem('Erro ao atualizar empresa', 'error');
    }
}

// Excluir empresa
async function excluirEmpresa(empresaId) {
    if (!confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        // Verificar se existem funcionários vinculados
        const funcionariosSnapshot = await db.collection('funcionarios')
            .where('empresaId', '==', empresaId)
            .get();

        if (!funcionariosSnapshot.empty) {
            mostrarMensagem('Não é possível excluir empresa com funcionários vinculados', 'warning');
            return;
        }

        await db.collection('empresas').doc(empresaId).delete();
        carregarEmpresas();
        mostrarMensagem('Empresa excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir empresa:', error);
        mostrarMensagem('Erro ao excluir empresa', 'error');
    }
}

// Carregar empresas para selects
async function carregarSelectEmpresas(selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione uma empresa</option>';
        const empresasSnapshot = await db.collection('empresas').orderBy('nome').get();
        
        empresasSnapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas no select:', error);
    }
}