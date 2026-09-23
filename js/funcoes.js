// Gerenciamento de FunÃ§Ãµes (Cargos)

async function inicializarFuncoes() {
    await carregarSelectEmpresas('filtro-empresa-funcoes');
    await carregarFuncoes();
}

async function carregarFuncoes() {
    const tabela = document.getElementById('tabela-funcoes');
    if (!tabela) return;

    tabela.innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fas fa-spinner fa-spin text-primary me-2"></i> Carregando funÃ§Ãµes...</td></tr>';

    try {
        let query = db.collection('funcoes').orderBy('nome');
        const snapshot = await query.get();
        tabela.innerHTML = '';

        if (snapshot.empty) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-5 text-muted">
                        <i class="fas fa-inbox fa-3x mb-3 text-light"></i><br>
                        Nenhuma funÃ§Ã£o cadastrada.
                    </td>
                </tr>
            `;
            return;
        }

        // Ordenar no cliente caso o where impeÃ§a o orderBy
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
        console.error('Erro ao carregar funÃ§Ãµes:', error);
        tabela.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-danger">Erro ao carregar funÃ§Ãµes.</td></tr>';
    }
}

async function abrirModalFuncao() {
    document.getElementById('form-funcao').reset();
    document.getElementById('funcao-id').value = '';
    document.getElementById('funcao-sal-inicial').value = '';
    document.getElementById('funcao-bonus-inicial').value = '';
    document.getElementById('funcao-sal-3m').value = '';
    document.getElementById('funcao-sal-6m').value = '';
    document.getElementById('funcao-sal-8m').value = '';
    document.getElementById('funcao-sal-14m').value = '';
    document.getElementById('funcao-bonus-1a').value = '';
    document.getElementById('funcaoModalTitle').textContent = 'Nova FunÃ§Ã£o';
    document.getElementById('btn-salvar-funcao').textContent = 'Salvar FunÃ§Ã£o';

    const modal = new bootstrap.Modal(document.getElementById('funcaoModal'));
    modal.show();
}

async function editarFuncao(id) {
    try {
        const doc = await db.collection('funcoes').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem('FunÃ§Ã£o nÃ£o encontrada', 'error');
            return;
        }

        const funcao = doc.data();
        
        document.getElementById('funcao-id').value = doc.id;
        document.getElementById('funcao-nome').value = funcao.nome;

        document.getElementById('funcao-sal-inicial').value = funcao.inicial || '';
        document.getElementById('funcao-bonus-inicial').value = funcao.bonus || '';
        document.getElementById('funcao-sal-3m').value = funcao.m3 || '';
        document.getElementById('funcao-sal-6m').value = funcao.m6 || '';
        document.getElementById('funcao-sal-8m').value = funcao.m8 || '';
        document.getElementById('funcao-sal-14m').value = funcao.m14 || '';
        document.getElementById('funcao-bonus-1a').value = funcao.bonus_1ano || '';

        document.getElementById('funcaoModalTitle').textContent = 'Editar FunÃ§Ã£o';
        document.getElementById('btn-salvar-funcao').textContent = 'Atualizar FunÃ§Ã£o';

        const modal = new bootstrap.Modal(document.getElementById('funcaoModal'));
        modal.show();

    } catch (error) {
        console.error('Erro ao editar funÃ§Ã£o:', error);
        mostrarMensagem('Erro ao carregar dados', 'error');
    }
}

async function salvarFuncao() {
    const id = document.getElementById('funcao-id').value;
    const nome = document.getElementById('funcao-nome').value.trim();

    if (!nome) {
        mostrarMensagem('Preencha os campos obrigatÃ³rios (*)', 'warning');
        return;
    }

    const btn = document.getElementById('btn-salvar-funcao');
    const originalText = btn.textContent;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        const funcaoData = {
            nome: nome,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await db.collection('funcoes').doc(id).update(funcaoData);
            mostrarMensagem('FunÃ§Ã£o atualizada com sucesso!', 'success');
        } else {
            funcaoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('funcoes').add(funcaoData);
            mostrarMensagem('FunÃ§Ã£o cadastrada com sucesso!', 'success');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('funcaoModal'));
        if (modal) modal.hide();

        carregarFuncoes();

    } catch (error) {
        console.error('Erro ao salvar funÃ§Ã£o:', error);
        mostrarMensagem('Erro ao salvar', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function excluirFuncao(id, nome) {
    if (confirm(`Tem certeza que deseja excluir a funÃ§Ã£o "${nome}"?\nFuncionÃ¡rios associados a ela poderÃ£o ficar sem funÃ§Ã£o selecionada.`)) {
        try {
            await db.collection('funcoes').doc(id).delete();
            mostrarMensagem('FunÃ§Ã£o excluÃ­da com sucesso!', 'success');
            carregarFuncoes();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            mostrarMensagem('Erro ao excluir funÃ§Ã£o', 'error');
        }
    }
}

// MigraÃ§Ã£o temporÃ¡ria de funÃ§Ãµes antigas (array em empresas) para a nova collection
async function migrarFuncoesAntigas() {
    if(!confirm("Esta aÃ§Ã£o vai analisar todas as empresas e criar as funÃ§Ãµes individuais no novo banco de dados. Deseja continuar?")) {
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
                    // Verifica se jÃ¡ existe para evitar duplicidade
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
            mostrarMensagem(`${funcoesMigradas} funÃ§Ãµes antigas foram migradas com sucesso!`, 'success');
            carregarFuncoes();
        } else {
            mostrarMensagem('Nenhuma funÃ§Ã£o nova para migrar. Todas jÃ¡ estÃ£o atualizadas.', 'info');
        }

    } catch(e) {
        console.error("Erro na migraÃ§Ã£o:", e);
        mostrarMensagem('Erro ao realizar a migraÃ§Ã£o.', 'error');
    } finally {
        if(btn) {
            btn.innerHTML = '<i class="fas fa-magic"></i> Migrar FunÃ§Ãµes Antigas';
            btn.disabled = false;
        }
    }
}

const FUNCOES_OFICIAIS = [
    'Aux. Escritório', 'Mecânico', 'Injetador', 'Montadeira', 'Fulão', 'Vendedor',
    'Aux Mecânico', 'Strobel', 'Fechador de pedidos', 'Preparo do PU', 'Balancim',
    'OPERADOR DE CALDEIRA', 'Operador de empilhadeira', 'Operador de automatizada',
    'Matriz (Abrir/Fechar)', 'Refilador', 'Costura fechamento', 'Operador de maquinas - 1 Agulha',
    'Operador de Maquinas - Zig Zag', 'Operador de Maquinas - Pecinha', 'Almoxarife',
    'Conformadeira', 'Robô', 'OPERADOR DE MÁQUINAS - PRENSAGEM DE COURO',
    'OPERADOR DE MÁQUINAS - PRENSA A VÁCUO', 'Rebaixadeira', 'Lixadeira', 'Suporte Comercial',
    'OPERADOR DE MÁQUINAS - BALÇA', 'OPERADOR DE MÁQUINAS - TRATAMENTO DE ÁGUA', 'Lixador de Solas',
    'Conferencia', 'Carimbadeira', 'Batedor de Bico', 'Vestidor de Cabedais',
    'OPERADOR DE MÁQUINAS- TINTA', 'OPERADOR DE MÁQUINAS - MOLIÇA', 'OPERADOR DE MÁQUINA - LACA',
    'OPERADOR DE MÁQUINA - MEDIDORA', 'Chanfradeira', 'Máquina de Ilhóes', 'Carregador de caminhão',
    'Lavador de Veículos', 'Lustrador de Calçados', 'Empacotador', 'Máquina de selar embalagens',
    'Auxiliar de acabamento', 'Auxiliar de Corte', 'PCP da Costura', 'Aplicador de cola',
    'Auxiliar de Costura', 'Encaixotador', 'Organizador de estoque', 'Desmoldador',
    'Auxiliar de Injeção', 'Zelador', 'PCP da montagem', 'Auxiliar de montagem',
    'Motorista', 'Motorista Carreta', 'AUXILIAR DE PRODUÇÃO', 'OPERADOR DE MÁQUINAS - SECADOR DE VARAL',
    'OPERADOR DE MÁQUINAS - PRENSA A VÁCUO (AUXILIAR)', 'Recorte', 'Auxiliar de Pintura'
];

window.popularFuncoesOficiais = async function() {
    if (!confirm('ATENÇÃO: Você está prestes a popular o banco com as 67 funções oficiais da lista. Deseja continuar?')) return;
    
    try {
        console.log('Populando 67 funções...');
        const btn = document.querySelector('button[onclick="popularFuncoesOficiais()"]');
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Populando...';
        
        const snapshot = await db.collection('funcoes').get();
        if (!snapshot.empty) {
            console.log(`Deletando ${snapshot.size} funções antigas...`);
            let deleteBatch = db.batch();
            let deleteOps = 0;
            for (const doc of snapshot.docs) {
                deleteBatch.delete(doc.ref);
                deleteOps++;
                if (deleteOps === 400) {
                    await deleteBatch.commit();
                    deleteBatch = db.batch();
                    deleteOps = 0;
                }
            }
            if (deleteOps > 0) {
                await deleteBatch.commit();
            }
        }

        console.log('Populando 67 funções oficiais...');
        let batch = db.batch();
        let ops = 0;
        let lotesCompletos = 0;

        for (const nome of FUNCOES_OFICIAIS) {
            const newRef = db.collection('funcoes').doc();
            batch.set(newRef, {
                nome: nome,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            ops++;

            if (ops === 400) {
                await batch.commit();
                lotesCompletos++;
                batch = db.batch();
                ops = 0;
            }
        }
        
        if (ops > 0) {
            await batch.commit();
        }

        alert('Sucesso! As funções oficiais foram inseridas na base de dados global.');
        window.location.reload();
    } catch (e) {
        console.error('Erro ao popular funções:', e);
        alert('Erro ao popular funções: ' + e.message);
    }
};


