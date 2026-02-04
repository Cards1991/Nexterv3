// js/painel-demitidos.js

document.addEventListener('DOMContentLoaded', () => {
    let dadosCarregados = false;
    let demitidosCache = [];

    const renderTabelaDemitidos = (demitidos) => {
        const tabelaContainer = document.getElementById('tabela-demitidos-container');
        if (!demitidos || demitidos.length === 0) {
            tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum funcionário demitido encontrado para os filtros aplicados.</td></tr>';
            return;
        }

        tabelaContainer.innerHTML = demitidos.map(demitido => `
            <tr data-id="${demitido.id}">
                <td>${demitido.nome || 'Nome não encontrado'}</td>
                <td>${demitido.empresaNome || 'N/A'}</td>
                <td>${demitido.setor || 'N/A'}</td>
                <td>${demitido.data.toDate().toLocaleDateString()}</td>
                <td>${demitido.motivo || 'Não especificado'}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-info" title="Visualizar" onclick="visualizarDemissao('${demitido.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-warning" title="Alterar" onclick="alterarDemissao('${demitido.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger" title="Excluir" onclick="excluirDemissao('${demitido.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    const filtrarDemitidos = () => {
        const termoBusca = document.getElementById('busca-demitidos').value.toLowerCase();
        const filtrados = demitidosCache.filter(d => 
            (d.nome && d.nome.toLowerCase().includes(termoBusca)) || 
            (d.cpf && d.cpf.includes(termoBusca))
        );
        renderTabelaDemitidos(filtrados);
    };

    // Declara a função primeiro
    const carregarPainelDemitidos = async () => {
        console.log("Carregando painel de demitidos do Firebase...");
        const tabelaContainer = document.getElementById('tabela-demitidos-container');
        
        if (!tabelaContainer) {
            console.error("Container da tabela não encontrado!");
            return;
        }

        tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Carregando demitidos...</td></tr>';

        try {
            // 1. Buscar todas as movimentações de demissão
            console.log("Buscando movimentações de demissão...");
            
            const [movimentacoesSnap, empresasSnap] = await Promise.all([
                db.collection('movimentacoes').where('tipo', '==', 'demissao').orderBy('data', 'desc').get(),
                db.collection('empresas').get()
            ]);

            const empresasMap = new Map();
            empresasSnap.forEach(doc => empresasMap.set(doc.id, doc.data().nome));
            
            console.log(`Encontradas ${movimentacoesSnap.size} movimentações de demissão`);
            
            if (movimentacoesSnap.empty) {
                tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum funcionário demitido encontrado.</td></tr>';
                demitidosCache = [];
                return;
            }

            // 2. Mapear os IDs dos funcionários demitidos
            const funcionarioIds = movimentacoesSnap.docs.map(doc => {
                const data = doc.data();
                return data.funcionarioId;
            }).filter(id => id);

            // 3. Buscar os dados desses funcionários
            if (funcionarioIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < funcionarioIds.length; i += 10) {
                    chunks.push(funcionarioIds.slice(i, i + 10));
                }

                const promises = chunks.map(chunk => 
                    db.collection('funcionarios').where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get()
                );

                const allFuncsSnap = await Promise.all(promises);
                const funcionariosSnap = { docs: allFuncsSnap.flatMap(snap => snap.docs) };
                
                funcionariosMap = new Map(funcionariosSnap.docs.map(doc => {
                    return [doc.id, doc.data()];
                }));
            }
            // 4. Combinar os dados e renderizar
            demitidosCache = movimentacoesSnap.docs.map(doc => {
                const mov = doc.data();
                const func = funcionariosMap.get(mov.funcionarioId) || {};
                
                const empresaId = mov.empresaId || func.empresaId;
                const empresaNome = empresasMap.get(empresaId) || 'N/A';
                const nome = mov.funcionarioNome || func.nome || 'Funcionário não encontrado';
                const setor = mov.setor || func.setor || 'N/A';

                return { 
                    id: doc.id, 
                    ...mov, 
                    ...func,
                    nome,
                    empresaNome,
                    setor
                };
            });

            filtrarDemitidos();
            
        } catch (error) {
            console.error("Erro ao carregar painel de demitidos:", error);
            tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Falha ao carregar dados. Verifique o console.</td></tr>';
        } finally {
            dadosCarregados = true;
        }
    };

    // Agora sim, adiciona os event listeners
    const buscaInput = document.getElementById('busca-demitidos');
    const btnBusca = document.getElementById('btn-busca-demitidos');

    if (btnBusca) {
        btnBusca.addEventListener('click', carregarPainelDemitidos);
    }
    if (buscaInput) {
        buscaInput.addEventListener('input', filtrarDemitidos);
    }

    // Funções de ação
    window.visualizarDemissao = async (id) => {
        try {
            const doc = await db.collection('movimentacoes').doc(id).get();
            if (!doc.exists) {
                mostrarMensagem("Registro de demissão não encontrado.", "error");
                return;
            }
            const demissao = doc.data();

            // Busca os dados do funcionário para complementar as informações
            let funcionario = { nome: demissao.funcionarioNome || 'Não encontrado', setor: 'N/A' };
            if (demissao.funcionarioId) {
                const funcDoc = await db.collection('funcionarios').doc(demissao.funcionarioId).get();
                if (funcDoc.exists) {
                    funcionario = funcDoc.data();
                }
            }

            let empresaNome = 'N/A';
            const empresaId = demissao.empresaId || funcionario.empresaId;
            if (empresaId) {
                const empDoc = await db.collection('empresas').doc(empresaId).get();
                if (empDoc.exists) {
                    empresaNome = empDoc.data().nome;
                }
            }

            const corpoModal = `
                <p><strong>Funcionário:</strong> ${funcionario.nome}</p>
                <p><strong>Empresa:</strong> ${empresaNome}</p>
                <p><strong>Setor:</strong> ${demissao.setor || funcionario.setor || 'N/A'}</p>
                <hr>
                <p><strong>Data da Demissão:</strong> ${demissao.data.toDate().toLocaleDateString()}</p>
                <p><strong>Tipo de Demissão:</strong> ${demissao.motivo || 'Não especificado'}</p>
                <p><strong>Aviso Prévio:</strong> ${demissao.avisoPrevio || 'Não especificado'}</p>
                <p><strong>Motivo Detalhado:</strong></p>
                <p class="p-2 bg-light rounded">${demissao.detalhes || 'Não informado'}</p>
            `;
            abrirModalGenerico("Detalhes da Demissão", corpoModal);
        } catch (error) {
            console.error("Erro ao visualizar demissão:", error);
            mostrarMensagem("Falha ao carregar os detalhes da demissão.", "error");
        }
    };

    window.alterarDemissao = async (id) => {
        try {
            const doc = await db.collection('movimentacoes').doc(id).get();
            if (!doc.exists) {
                mostrarMensagem("Registro não encontrado.", "error");
                return;
            }
            const data = doc.data();
            
            // Alternar para a seção de demissão
            showSection('demissao');
            
            // Aguarda o carregamento dos dados iniciais da tela de demissão para garantir que o select exista
            if (window.movimentacoesManager) {
                await window.movimentacoesManager.carregarDadosIniciais();
            }

            // Popula os campos imediatamente após o carregamento
                const form = document.getElementById('form-demissao');
                if (!form) return;

                // Lidar com Select de Funcionário (adicionar opção se faltar, pois demitidos não aparecem por padrão)
                const selectFunc = document.getElementById('demissao-funcionario');
                if (selectFunc) {
                    let option = selectFunc.querySelector(`option[value="${data.funcionarioId}"]`);
                    if (!option) {
                        const funcDoc = await db.collection('funcionarios').doc(data.funcionarioId).get();
                        if (funcDoc.exists) {
                            const funcData = funcDoc.data();
                            option = document.createElement('option');
                            option.value = data.funcionarioId;
                            option.text = funcData.nome;
                            selectFunc.add(option);
                        }
                    }
                    selectFunc.value = data.funcionarioId;
                    selectFunc.dispatchEvent(new Event('change'));
                }

                // Popular outros campos
                if (data.data) {
                    const dateStr = data.data.toDate().toISOString().split('T')[0];
                    document.getElementById('demissao-data').value = dateStr;
                }
                document.getElementById('demissao-tipo').value = data.motivo || '';
                document.getElementById('demissao-aviso-previo').value = data.avisoPrevio || '';
                document.getElementById('demissao-motivo').value = data.motivoDetalhado || '';
                document.getElementById('demissao-observacoes').value = data.detalhes || '';
                
                const avisoSelect = document.getElementById('demissao-aviso-previo');
                if (avisoSelect) avisoSelect.dispatchEvent(new Event('change'));
                if (data.motivoDispensaAviso) {
                    document.getElementById('demissao-motivo-dispensa-aviso').value = data.motivoDispensaAviso;
                }
                
                // Checkbox reposição
                const funcDoc = await db.collection('funcionarios').doc(data.funcionarioId).get();
                if (funcDoc.exists) {
                     document.getElementById('demissao-reposicao').checked = funcDoc.data().necessitaReposicao || false;
                }

                // Habilitar botão de gerar financeiro
                const btnCalcular = document.getElementById('btn-calcular-rescisao');
                if (btnCalcular) {
                    btnCalcular.disabled = false;
                }

                // Alterar botão para Atualizar
                const btnRegistrar = document.querySelector('#form-demissao .btn-danger');
                if (btnRegistrar) {
                    // Salva o onclick original se ainda não foi salvo
                    if (!btnRegistrar.dataset.originalOnclick) {
                        btnRegistrar.dataset.originalOnclick = btnRegistrar.getAttribute('onclick');
                    }
                    
                    btnRegistrar.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
                    btnRegistrar.onclick = (e) => {
                        e.preventDefault();
                        atualizarRegistroDemissao(id);
                    };
                    
                    // Adicionar botão de Cancelar Edição se não existir
                    let btnCancel = document.getElementById('btn-cancelar-edicao-demissao');
                    if (!btnCancel) {
                        btnCancel = document.createElement('button');
                        btnCancel.id = 'btn-cancelar-edicao-demissao';
                        btnCancel.className = 'btn btn-secondary ms-2';
                        btnCancel.innerHTML = 'Cancelar Edição';
                        btnCancel.onclick = () => {
                            form.reset();
                            btnRegistrar.innerHTML = '<i class="fas fa-user-slash"></i> Confirmar e Registrar Demissão';
                            // Restaura a função original
                            btnRegistrar.onclick = () => window.movimentacoesManager.registrarDemissao();
                            
                            btnCancel.remove();
                            document.getElementById('demissao-info-funcionario').style.display = 'none';
                            showSection('painel-demitidos');
                        };
                        btnRegistrar.parentNode.appendChild(btnCancel);
                    }
                }

                mostrarMensagem("Modo de edição ativado.", "info");

        } catch (error) {
            console.error("Erro ao preparar edição:", error);
            mostrarMensagem("Erro ao carregar dados.", "error");
        }
    };

    window.atualizarRegistroDemissao = async (id) => {
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const data = document.getElementById('demissao-data').value;
        const tipoDemissao = document.getElementById('demissao-tipo').value;
        const avisoPrevio = document.getElementById('demissao-aviso-previo').value;
        const motivo = document.getElementById('demissao-motivo').value;
        const observacoes = document.getElementById('demissao-observacoes').value;
        const necessitaReposicao = document.getElementById('demissao-reposicao').checked;
        const motivoDispensaAviso = document.getElementById('demissao-motivo-dispensa-aviso').value;

        if (!funcionarioId || !data || !tipoDemissao || !motivo) {
            mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
            return;
        }

        try {
            const updateData = {
                data: new Date(data.replace(/-/g, '/')),
                motivo: tipoDemissao,
                motivoDetalhado: motivo,
                detalhes: observacoes,
                avisoPrevio: avisoPrevio,
                motivoDispensaAviso: avisoPrevio === 'Dispensado' ? motivoDispensaAviso : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('movimentacoes').doc(id).update(updateData);
            
            await db.collection('funcionarios').doc(funcionarioId).update({
                necessitaReposicao: necessitaReposicao
            });

            mostrarMensagem("Registro de demissão atualizado com sucesso!", "success");
            
            // Resetar UI
            document.getElementById('form-demissao').reset();
            const btnRegistrar = document.querySelector('#form-demissao .btn-danger');
            if (btnRegistrar) {
                btnRegistrar.innerHTML = '<i class="fas fa-user-slash"></i> Confirmar e Registrar Demissão';
                btnRegistrar.onclick = () => window.movimentacoesManager.registrarDemissao();
            }
            const btnCancel = document.getElementById('btn-cancelar-edicao-demissao');
            if (btnCancel) btnCancel.remove();
            document.getElementById('demissao-info-funcionario').style.display = 'none';

            showSection('painel-demitidos');
            
        } catch (error) {
            console.error("Erro ao atualizar demissão:", error);
            mostrarMensagem("Erro ao atualizar registro.", "error");
        }
    };

    window.excluirDemissao = async (id) => {
        if (confirm(`Tem certeza que deseja excluir o registro de demissão ID: ${id}? Esta ação não pode ser desfeita.`)) {
            try {
                // 1. Obter o registro da movimentação para pegar o funcionarioId
                const movimentacaoDoc = await db.collection('movimentacoes').doc(id).get();
                if (!movimentacaoDoc.exists) {
                    mostrarMensagem('Registro de demissão não encontrado.', 'error');
                    return;
                }
                const funcionarioId = movimentacaoDoc.data().funcionarioId;

                // 2. Excluir o registro da movimentação
                await db.collection('movimentacoes').doc(id).delete();
                mostrarMensagem('Registro de demissão excluído com sucesso!', 'success');

                // 3. Reverter o status do funcionário para 'Ativo'
                if (funcionarioId) {
                    await db.collection('funcionarios').doc(funcionarioId).update({
                        status: 'Ativo',
                        ultimaMovimentacao: null // Limpa a última movimentação se for a demissão
                    });
                    mostrarMensagem('Status do funcionário revertido para Ativo.', 'info');
                }

                // 4. Recarregar a tabela do painel
                carregarPainelDemitidos();
            } catch (error) {
                console.error("Erro ao excluir registro de demissão:", error);
                mostrarMensagem('Falha ao excluir o registro.', 'error');
            }
        }
    };

    // Adiciona um observador para carregar os dados quando a seção se tornar visível
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const painel = mutation.target; // A seção #painel-demitidos
                if (!painel.classList.contains('d-none')) {
                    // Se a seção ficou visível, carrega os dados.
                    carregarPainelDemitidos();
                } else {
                    // Se a seção ficou oculta, reseta o flag para recarregar na próxima vez.
                    dadosCarregados = false;
                }
            }
        });
    });

    const painelDemitidosSection = document.getElementById('painel-demitidos');
    if (painelDemitidosSection) {
        observer.observe(painelDemitidosSection, { attributes: true });
    }

    // Carrega inicialmente se a seção já estiver visível
    if (painelDemitidosSection && !painelDemitidosSection.classList.contains('d-none')) {
        carregarPainelDemitidos();
    }
});