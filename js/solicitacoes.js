// Gerenciamento de Solicitações (Reposição e Contratação)

document.addEventListener('DOMContentLoaded', function() {
    // Configurar listener para o select de empresa no modal de reposição
    const repEmpresaSelect = document.getElementById('rep-nova-empresa');
    if (repEmpresaSelect) {
        repEmpresaSelect.addEventListener('change', () => {
            carregarSetoresPorEmpresa(repEmpresaSelect.value, 'rep-nova-setor');
            carregarFuncoesPorEmpresa(repEmpresaSelect.value, 'rep-nova-cargo'); // Adicionado para carregar cargos
        });
    }

    // Configurar listener para o select de empresa no modal de contratação
    const contrEmpresaSelect = document.getElementById('contr-empresa');
    if (contrEmpresaSelect) {
        contrEmpresaSelect.addEventListener('change', () => {
            carregarSetoresPorEmpresa(contrEmpresaSelect.value, 'contr-setor');
            carregarFuncoesPorEmpresa(contrEmpresaSelect.value, 'contr-cargo');
        });
    }
});

// Função para abrir o modal de nova reposição
async function abrirNovaReposicaoModal() {
    try {
        document.getElementById('form-reposicao-nova').reset();

        // Popular o select de funcionários demitidos
        const selectFuncionario = document.getElementById('rep-nova-funcionario');
        selectFuncionario.innerHTML = '<option value="">Selecione um funcionário (opcional)</option>';
        
        const funcSnap = await db.collection('funcionarios').where('status', '==', 'Demitido').orderBy('nome').get();
        funcSnap.forEach(doc => {
            const funcionario = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${funcionario.nome}`;
            selectFuncionario.appendChild(option);
        });

        // Popular empresas
        await carregarSelectEmpresas('rep-nova-empresa');
        // Resetar selects de setor e cargo
        document.getElementById('rep-nova-setor').innerHTML = '<option value="">Selecione a empresa</option>';
        document.getElementById('rep-nova-cargo').innerHTML = '<option value="">Selecione a empresa</option>';
        
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
        // Resetar selects de setor e cargo
        document.getElementById('contr-setor').innerHTML = '<option value="">Selecione a empresa</option>';
        document.getElementById('contr-cargo').innerHTML = '<option value="">Selecione a empresa</option>';

        
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
        await carregarDashboardMovimentacoes(); // CORRIGIDO: Atualiza o dashboard de movimentações

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
        const salario = document.getElementById('contr-salario').value;
        const turno = document.getElementById('contr-turno').value;
        const quantidade = parseInt(document.getElementById('contr-quantidade').value) || 1;
        const observacoes = document.getElementById('contr-observacoes').value;
        const solicitacaoId = document.getElementById('contr-solicitacao-id').value; // Para edição

        if (!empresaId || !setor || !cargo) {
            mostrarMensagem("Empresa, Setor e Cargo são obrigatórios.", "warning");
            return;
        }

        const dados = {
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            salario: salario,
            turno: turno,
            // O custo estimado não é salvo aqui, é calculado dinamicamente na exibição
            quantidade: quantidade,
            observacoes: observacoes,
            status: 'pendente',
            abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid
        };

        if (solicitacaoId) {
            await db.collection('contratacoes').doc(solicitacaoId).update(dados);
            mostrarMensagem("Solicitação de contratação atualizada com sucesso!", "success");
        } else {
            await db.collection('contratacoes').add(dados);
            mostrarMensagem("Solicitação de contratação aberta com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('contratacaoNovaModal')).hide();
        await carregarDashboardMovimentacoes(); // Atualiza o dashboard de movimentações

    } catch (error) {
        console.error("Erro ao criar solicitação de contratação:", error);
        mostrarMensagem("Falha ao criar solicitação.", "error");
    }
}

async function preencherVaga(solicitacaoId, tipo) {
    try {
        const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
        const docRef = db.collection(colecao).doc(solicitacaoId);
        const doc = await docRef.get();

        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        } else {
            // Marca a solicitação como preenchida
            await docRef.update({ status: 'preenchida', preenchidaEm: firebase.firestore.FieldValue.serverTimestamp() });
        }

        const solicitacao = doc.data();

        // Mudar para a seção de admissão
        showSection('admissao');

        // Aguardar um momento para a seção carregar e preencher os dados
        setTimeout(async () => {
            document.getElementById('empresa-funcionario-admissao').value = solicitacao.empresaId;
            
            // Disparar eventos para carregar setores e cargos
            await carregarSetoresPorEmpresa(solicitacao.empresaId, 'setor-funcionario-admissao');
            document.getElementById('setor-funcionario-admissao').value = solicitacao.setor;
            
            await carregarFuncoesPorEmpresa(solicitacao.empresaId, 'cargo-funcionario-admissao');
            document.getElementById('cargo-funcionario-admissao').value = solicitacao.cargo;
        }, 500); // Delay para garantir que a UI está pronta
    } catch (error) {
        console.error("Erro ao tentar preencher vaga:", error);
        mostrarMensagem("Ocorreu um erro ao preparar o formulário de admissão.", "error");
    }
}

async function editarSolicitacao(solicitacaoId, tipo) {
    const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
    const modalId = tipo === 'reposicao' ? 'reposicaoNovaModal' : 'contratacaoNovaModal';
    
    const doc = await db.collection(colecao).doc(solicitacaoId).get();
    if (!doc.exists) {
        mostrarMensagem("Solicitação não encontrada.", "error");
        return;
    }
    const data = doc.data();

    if (tipo === 'contratacao') {
        await abrirNovaContratacaoModal(); // Abre e popula os selects
        setTimeout(() => {
            document.getElementById('contr-solicitacao-id').value = solicitacaoId;
            document.getElementById('contr-empresa').value = data.empresaId;
            document.getElementById('contr-empresa').dispatchEvent(new Event('change')); // Força o carregamento dos dependentes
            setTimeout(() => { // Delay para garantir que setor/cargo foram carregados
                document.getElementById('contr-setor').value = data.setor;
                document.getElementById('contr-cargo').value = data.cargo;
            }, 300);
            document.getElementById('contr-turno').value = data.turno || 'Dia';
            document.getElementById('contr-salario').value = data.salario || '';
            document.getElementById('contr-quantidade').value = data.quantidade || 1;
            document.getElementById('contr-observacoes').value = data.observacoes || '';
        }, 300);
    } else {
        // Lógica similar para reposição, se necessário
        mostrarMensagem("Edição para reposição ainda não implementada.", "info");
    }
}

async function excluirSolicitacao(solicitacaoId, tipo) {
    const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
    if (!confirm(`Tem certeza que deseja excluir esta solicitação de ${tipo}?`)) {
        return;
    }
    try {
        await db.collection(colecao).doc(solicitacaoId).delete();
        mostrarMensagem("Solicitação excluída com sucesso.", "success");
        await carregarDashboardMovimentacoes();
    } catch (error) {
        console.error("Erro ao excluir solicitação:", error);
        mostrarMensagem("Falha ao excluir a solicitação.", "error");
    }
}

async function visualizarSolicitacao(solicitacaoId, tipo) {
    event.stopPropagation();

    const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
    try {
        const doc = await db.collection(colecao).doc(solicitacaoId).get();
        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        }
        const data = doc.data();
        const empresaDoc = await db.collection('empresas').doc(data.empresaId).get();
        const nomeEmpresa = empresaDoc.exists ? empresaDoc.data().nome : 'N/A';

        let corpoHtml = `
            <p><strong>Empresa:</strong> ${nomeEmpresa}</p>
            <p><strong>Setor:</strong> ${data.setor}</p>
            <p><strong>Cargo:</strong> ${data.cargo}</p>
        `;

        if (tipo === 'contratacao') {
            corpoHtml += `
                <p><strong>Salário Proposto:</strong> R$ ${parseFloat(data.salario || 0).toFixed(2)}</p>
                <p><strong>Quantidade de Vagas:</strong> ${data.quantidade || 1}</p>
                <p><strong>Turno:</strong> ${data.turno || 'N/A'}</p>
                <p><strong>Observações:</strong> ${data.observacoes || 'Nenhuma'}</p>
            `;
        } else { // reposicao
            corpoHtml += `<p><strong>Funcionário Desligado:</strong> ${data.funcionarioNome || 'N/A'}</p>`;
        }

        abrirModalGenerico(`Detalhes da Solicitação de ${tipo}`, corpoHtml);

    } catch (error) {
        console.error("Erro ao visualizar solicitação:", error);
        mostrarMensagem("Erro ao carregar detalhes da solicitação.", "error");
    }
}

// Função para calcular o custo estimado de uma contratação (similar ao funcionário, mas sem benefícios específicos)
async function calcularCustoEstimadoContratacao(salario, empresaId) {
    if (!salario || !empresaId) return 0;

    const fgts = salario * 0.08;
    const provisaoFerias = salario / 12;
    const tercoFerias = provisaoFerias / 3;
    const fgtsSobreFerias = provisaoFerias * 0.08;
    const provisao13 = salario / 12;
    const fgtsSobre13 = provisao13 * 0.08;

    let custoSindicato = 0;
    let custoPatronal = 0;
    let custoRat = 0;
    let custoIncra = 0;
    // custoValeRefeicao não é aplicável aqui, pois é uma estimativa antes da contratação e benefícios específicos do funcionário.

    try {
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (empresaDoc.exists) {
            const empresaData = empresaDoc.data();
            const baseCalculoContribuicoes = salario + provisaoFerias + provisao13;

            if (empresaData.pagaSindicato === true) {
                custoSindicato = baseCalculoContribuicoes * 0.008; // 0.8%
            }
            if (empresaData.pagaContribuicaoPatronal === true) {
                custoPatronal = baseCalculoContribuicoes * 0.20; // 20%

                // Calcula o RAT apenas se a contribuição patronal estiver ativa
                if (empresaData.rat && empresaData.rat > 0) {
                    const percentualRat = (empresaData.rat * 2) / 100;
                    custoRat = salario * percentualRat;
                }
                // Calcula o INCRA (0.2%) apenas se a contribuição patronal estiver ativa
                custoIncra = salario * 0.002;
            }
        }
    } catch (error) {
        console.error("Erro ao buscar dados da empresa para cálculo de custo de contratação:", error);
    }

    const custoTotal = salario + fgts + provisaoFerias + tercoFerias + fgtsSobreFerias + provisao13 + fgtsSobre13 + custoSindicato + custoPatronal + custoRat + custoIncra;
    return parseFloat(custoTotal.toFixed(2));
}