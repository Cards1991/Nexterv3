// js/painel-demitidos.js

document.addEventListener('DOMContentLoaded', () => {
    let dadosCarregados = false;

    // Declara a função primeiro
    const carregarPainelDemitidos = async () => {
        console.log("Carregando painel de demitidos do Firebase...");
        const tabelaContainer = document.getElementById('tabela-demitidos-container');
        const termoBusca = document.getElementById('busca-demitidos').value.toLowerCase();
        
        if (!tabelaContainer) {
            console.error("Container da tabela não encontrado!");
            return;
        }

        tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Carregando demitidos...</td></tr>';

        try {
            // 1. Buscar todas as movimentações de demissão
            console.log("Buscando movimentações de demissão...");
            const movimentacoesSnap = await db.collection('movimentacoes').where('tipo', '==', 'demissao').orderBy('data', 'desc').get();
            
            console.log(`Encontradas ${movimentacoesSnap.size} movimentações de demissão`);
            
            if (movimentacoesSnap.empty) {
                tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum funcionário demitido encontrado.</td></tr>';
                return;
            }

            // 2. Mapear os IDs dos funcionários demitidos
            const funcionarioIds = movimentacoesSnap.docs.map(doc => {
                const data = doc.data();
                console.log(`Movimentação ${doc.id}:`, data);
                return data.funcionarioId;
            }).filter(id => id);

            console.log("IDs de funcionários encontrados:", funcionarioIds);

            let funcionariosMap = new Map();

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
                    console.log(`Funcionário ${doc.id}:`, doc.data());
                    return [doc.id, doc.data()];
                }));
            }

            // 4. Combinar os dados e renderizar
            const demitidos = movimentacoesSnap.docs.map(doc => {
                const mov = doc.data();
                const func = funcionariosMap.get(mov.funcionarioId) || {
                    nome: mov.funcionarioNome || 'Funcionário não encontrado', 
                    empresaNome: 'N/A', 
                    setor: 'N/A' 
                };
                return { 
                    id: doc.id, 
                    ...mov, 
                    ...func 
                };
            }).filter(d => 
                d.nome.toLowerCase().includes(termoBusca) || 
                (d.cpf && d.cpf.includes(termoBusca))
            );

            console.log("Demitidos processados:", demitidos);
            renderTabelaDemitidos(demitidos);
            
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
        buscaInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                carregarPainelDemitidos();
            }
        });
    }

    const renderTabelaDemitidos = (demitidos) => {
        const tabelaContainer = document.getElementById('tabela-demitidos-container');
        if (!demitidos || demitidos.length === 0) {
            tabelaContainer.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum funcionário demitido encontrado para os filtros aplicados.</td></tr>';
            return;
        }

        tabelaContainer.innerHTML = demitidos.map(demitido => `
            <tr data-id="${demitido.id}">
                <td>${demitido.nome || 'Nome não encontrado'}</td>
                <td>${demitido.empresaNome || 'N/A'} / ${demitido.setor || 'N/A'}</td>
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
            let funcionario = { nome: demissao.funcionarioNome || 'Não encontrado', empresaNome: 'N/A', setor: 'N/A' };
            if (demissao.funcionarioId) {
                const funcDoc = await db.collection('funcionarios').doc(demissao.funcionarioId).get();
                if (funcDoc.exists) {
                    funcionario = funcDoc.data();
                }
            }

            const corpoModal = `
                <p><strong>Funcionário:</strong> ${funcionario.nome}</p>
                <p><strong>Empresa:</strong> ${demissao.empresaNome || 'N/A'}</p>
                <p><strong>Setor:</strong> ${demissao.setor || 'N/A'}</p>
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

    window.alterarDemissao = (id) => {
        alert(`Alterando registro de demissão ID: ${id}. Isso pode reabrir a tela de demissão com os dados preenchidos.`);
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