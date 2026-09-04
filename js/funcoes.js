// Gerenciamento de Funções (Cargos)

async function inicializarFuncoes() {
    await carregarSelectEmpresas('filtro-empresa-funcoes');
    await carregarFuncoes();
}

async function carregarFuncoes() {
    const tabela = document.getElementById('tabela-funcoes');
    if (!tabela) return;

    tabela.innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fas fa-spinner fa-spin text-primary me-2"></i> Carregando funções...</td></tr>';

    try {
        const filtroEmpresa = document.getElementById('filtro-empresa-funcoes')?.value;
        
        let query = db.collection('funcoes').orderBy('nome');
        
        if (filtroEmpresa) {
            query = db.collection('funcoes').where('empresaId', '==', filtroEmpresa);
        }

        const snapshot = await query.get();
        tabela.innerHTML = '';

        if (snapshot.empty) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5 text-muted">
                        <i class="fas fa-inbox fa-3x mb-3 text-light"></i><br>
                        Nenhuma função cadastrada${filtroEmpresa ? ' para esta empresa' : ''}.
                    </td>
                </tr>
            `;
            return;
        }

        // Ordenar no cliente caso o where impeça o orderBy
        const funcoes = [];
        snapshot.forEach(doc => funcoes.push({ id: doc.id, ...doc.data() }));
        funcoes.sort((a, b) => a.nome.localeCompare(b.nome));

        funcoes.forEach(funcao => {
            const tr = document.createElement('tr');
            
            let dataCriacao = '-';
            if (funcao.createdAt) {
                const date = funcao.createdAt.toDate();
                dataCriacao = date.toLocaleDateString('pt-BR');
            }

            tr.innerHTML = `
                <td class="ps-4 fw-medium text-dark">${funcao.nome}</td>
                <td><span class="badge bg-secondary">${funcao.empresaNome || 'Não informada'}</span></td>
                <td><small class="text-muted">${dataCriacao}</small></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editarFuncao('${funcao.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirFuncao('${funcao.id}', '${funcao.nome}')" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tabela.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro ao carregar funções:', error);
        tabela.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erro ao carregar funções.</td></tr>';
    }
}

async function abrirModalFuncao() {
    document.getElementById('form-funcao').reset();
    document.getElementById('funcao-id').value = '';
    document.getElementById('funcao-empresa-nome').value = '';
    
    document.getElementById('funcaoModalTitle').textContent = 'Nova Função';
    document.getElementById('btn-salvar-funcao').textContent = 'Salvar Função';
    
    await carregarSelectEmpresas('funcao-empresa-id');
    
    const filtroAtual = document.getElementById('filtro-empresa-funcoes')?.value;
    if(filtroAtual) {
        document.getElementById('funcao-empresa-id').value = filtroAtual;
    }

    const modal = new bootstrap.Modal(document.getElementById('funcaoModal'));
    modal.show();
}

async function editarFuncao(id) {
    try {
        const doc = await db.collection('funcoes').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem('Função não encontrada', 'error');
            return;
        }

        const funcao = doc.data();
        
        await carregarSelectEmpresas('funcao-empresa-id');

        document.getElementById('funcao-id').value = doc.id;
        document.getElementById('funcao-nome').value = funcao.nome;
        document.getElementById('funcao-empresa-id').value = funcao.empresaId;
        document.getElementById('funcao-empresa-nome').value = funcao.empresaNome || '';

        document.getElementById('funcaoModalTitle').textContent = 'Editar Função';
        document.getElementById('btn-salvar-funcao').textContent = 'Atualizar Função';

        const modal = new bootstrap.Modal(document.getElementById('funcaoModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao editar função:', error);
        mostrarMensagem('Erro ao carregar dados', 'error');
    }
}

async function salvarFuncao() {
    const id = document.getElementById('funcao-id').value;
    const nome = document.getElementById('funcao-nome').value.trim();
    const empresaSelect = document.getElementById('funcao-empresa-id');
    const empresaId = empresaSelect.value;
    const empresaNome = empresaSelect.options[empresaSelect.selectedIndex]?.text || '';

    if (!nome || !empresaId) {
        mostrarMensagem('Preencha os campos obrigatórios (*)', 'warning');
        return;
    }

    const btn = document.getElementById('btn-salvar-funcao');
    const originalText = btn.textContent;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        const funcaoData = {
            nome: nome,
            empresaId: empresaId,
            empresaNome: empresaNome,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await db.collection('funcoes').doc(id).update(funcaoData);
            mostrarMensagem('Função atualizada com sucesso!', 'success');
        } else {
            funcaoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('funcoes').add(funcaoData);
            mostrarMensagem('Função cadastrada com sucesso!', 'success');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('funcaoModal'));
        if (modal) modal.hide();

        carregarFuncoes();

    } catch (error) {
        console.error('Erro ao salvar função:', error);
        mostrarMensagem('Erro ao salvar', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function excluirFuncao(id, nome) {
    if (confirm(`Tem certeza que deseja excluir a função "${nome}"?\nFuncionários associados a ela poderão ficar sem função selecionada.`)) {
        try {
            await db.collection('funcoes').doc(id).delete();
            mostrarMensagem('Função excluída com sucesso!', 'success');
            carregarFuncoes();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            mostrarMensagem('Erro ao excluir função', 'error');
        }
    }
}

// Migração temporária de funções antigas (array em empresas) para a nova collection
async function migrarFuncoesAntigas() {
    if(!confirm("Esta ação vai analisar todas as empresas e criar as funções individuais no novo banco de dados. Deseja continuar?")) {
        return;
    }

    const btn = document.getElementById('btn-migrar-funcoes');
    if(btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Migrando...';
        btn.disabled = true;
    }

    try {
        const empresasSnapshot = await db.collection('empresas').get();
        let funcoesMigradas = 0;

        for (const doc of empresasSnapshot.docs) {
            const empresa = doc.data();
            const empresaId = doc.id;
            const empresaNome = empresa.nome;

            if (empresa.funcoes && Array.isArray(empresa.funcoes) && empresa.funcoes.length > 0) {
                for (const nomeFuncao of empresa.funcoes) {
                    // Verifica se já existe para evitar duplicidade
                    const check = await db.collection('funcoes')
                        .where('empresaId', '==', empresaId)
                        .where('nome', '==', nomeFuncao)
                        .get();

                    if(check.empty) {
                        await db.collection('funcoes').add({
                            nome: nomeFuncao,
                            empresaId: empresaId,
                            empresaNome: empresaNome,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            isMigrated: true
                        });
                        funcoesMigradas++;
                    }
                }
            }
        }

        if(funcoesMigradas > 0) {
            mostrarMensagem(`${funcoesMigradas} funções antigas foram migradas com sucesso!`, 'success');
            carregarFuncoes();
        } else {
            mostrarMensagem('Nenhuma função nova para migrar. Todas já estão atualizadas.', 'info');
        }

    } catch(e) {
        console.error("Erro na migração:", e);
        mostrarMensagem('Erro ao realizar a migração.', 'error');
    } finally {
        if(btn) {
            btn.innerHTML = '<i class="fas fa-magic"></i> Migrar Funções Antigas';
            btn.disabled = false;
        }
    }
}
