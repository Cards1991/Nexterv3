// =================================================================
// Painel de Demitidos - Lógica de Controle
// =================================================================

async function inicializarPainelDemitidos() {
    console.log("Inicializando Painel de Demitidos...");
    
    // Configurar filtros de data e botões
    const btnFiltrar = document.getElementById('btn-filtrar-demitidos');
    const btnLimpar = document.getElementById('btn-limpar-filtros-demitidos');

    if (btnFiltrar && !btnFiltrar.dataset.listener) {
        btnFiltrar.addEventListener('click', carregarPainelDemitidos);
        btnFiltrar.dataset.listener = 'true';
    }

    if (btnLimpar && !btnLimpar.dataset.listener) {
        btnLimpar.addEventListener('click', () => {
            document.getElementById('filtro-demitidos-data-inicio').value = '';
            document.getElementById('filtro-demitidos-data-fim').value = '';
            document.getElementById('busca-demitidos').value = '';
            carregarPainelDemitidos();
        });
        btnLimpar.dataset.listener = 'true';
    }

    // Configurar busca
    const btnBusca = document.getElementById('btn-busca-demitidos');
    const inputBusca = document.getElementById('busca-demitidos');
    
    if (btnBusca && !btnBusca.dataset.listener) {
        btnBusca.addEventListener('click', carregarPainelDemitidos);
        btnBusca.dataset.listener = 'true';
    }
    
    if (inputBusca && !inputBusca.dataset.listener) {
        inputBusca.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') carregarPainelDemitidos();
        });
        inputBusca.dataset.listener = 'true';
    }

    await carregarPainelDemitidos();
}

async function carregarPainelDemitidos() {
    const tbody = document.getElementById('tabela-demitidos-container');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const termoBusca = document.getElementById('busca-demitidos')?.value.toLowerCase().trim();
    const dataInicioFiltro = document.getElementById('filtro-demitidos-data-inicio')?.value;
    const dataFimFiltro = document.getElementById('filtro-demitidos-data-fim')?.value;

    try {
        // Carregamento paralelo de dados necessários para preencher as lacunas
        const [funcionariosSnap, empresasSnap, movimentacoesSnap, financeirosSnap] = await Promise.all([
            db.collection('funcionarios').where('status', '==', 'Inativo').orderBy('nome').get(),
            db.collection('empresas').get(),
            db.collection('movimentacoes').where('tipo', '==', 'demissao').get(),
            db.collection('lancamentos_financeiros').where('subdivisao', '==', 'Rescisões').get()
        ]);

        if (funcionariosSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum funcionário desligado encontrado.</td></tr>';
            return;
        }

        // Mapeamento de Empresas (ID -> Nome)
        const empresasMap = {};
        empresasSnap.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
        });

        // Mapeamento de Demissões (para pegar data e motivo se faltar no cadastro)
        const demissoesMap = {};
        movimentacoesSnap.forEach(doc => {
            const mov = doc.data();
            if (mov.funcionarioId) {
                const dataMov = mov.data ? (mov.data.toDate ? mov.data.toDate() : new Date(mov.data)) : new Date(0);
                // Se houver múltiplas, pega a mais recente
                if (!demissoesMap[mov.funcionarioId] || dataMov > demissoesMap[mov.funcionarioId].dataObj) {
                    demissoesMap[mov.funcionarioId] = {
                        dataObj: dataMov,
                        motivo: mov.motivo || mov.tipoDemissao,
                        dataStr: dataMov.toLocaleDateString('pt-BR'),
                        dataISO: dataMov.toISOString().split('T')[0]
                    };
                }
            }
        });

        // Mapeamento de Custos Lançados (FuncionarioID -> Valor Total)
        const custosMap = {};
        financeirosSnap.forEach(doc => {
            const fin = doc.data();
            if (fin.funcionarioId) {
                custosMap[fin.funcionarioId] = (custosMap[fin.funcionarioId] || 0) + (parseFloat(fin.valor) || 0);
            }
        });

        let html = '';
        funcionariosSnap.forEach(doc => {
            const f = doc.data();
            
            // Filtro de busca em memória (Firestore não faz 'contains' nativo facilmente)
            if (termoBusca && !f.nome.toLowerCase().includes(termoBusca) && !f.cpf.includes(termoBusca)) {
                return;
            }

            // Resolução de Dados
            const empresaNome = empresasMap[f.empresaId] || f.empresa || '-';
            
            let dataDemissao = '-';
            let dataDemissaoISO = '';
            let tipoDemissao = f.tipoDemissao || f.motivoDesligamento || '-';

            // Tenta obter data de desligamento de vários campos possíveis
            let dataObj = null;
            if (f.dataDesligamento) dataObj = f.dataDesligamento.toDate ? f.dataDesligamento.toDate() : new Date(f.dataDesligamento);
            else if (f.dataDemissao) dataObj = f.dataDemissao.toDate ? f.dataDemissao.toDate() : new Date(f.dataDemissao);
            else if (f.ultimaMovimentacao) dataObj = f.ultimaMovimentacao.toDate ? f.ultimaMovimentacao.toDate() : new Date(f.ultimaMovimentacao);

            if (dataObj && !isNaN(dataObj.getTime())) {
                dataDemissao = dataObj.toLocaleDateString('pt-BR');
                dataDemissaoISO = dataObj.toISOString().split('T')[0];
            } else if (demissoesMap[doc.id]) {
                // Fallback para dados da movimentação se não estiver no funcionário
                dataDemissao = demissoesMap[doc.id].dataStr;
                dataDemissaoISO = demissoesMap[doc.id].dataISO;
                if (motivo === '-') motivo = demissoesMap[doc.id].motivo || '-';
            }

            // Aplica filtro de data em memória
            if (dataInicioFiltro && (!dataDemissaoISO || dataDemissaoISO < dataInicioFiltro)) {
                return;
            }
            if (dataFimFiltro && (!dataDemissaoISO || dataDemissaoISO > dataFimFiltro)) {
                return;
            }

            // Verifica se já tem custo lançado
            const custoLancado = custosMap[doc.id];
            console.log(`[DEBUG] Funcionário: ${f.nome}, Custo Lançado: ${custoLancado}`);
            let btnAcao = '';
            let btnCancelar = '';
            let btnEditar = '';

            if (custoLancado !== undefined) {
                btnAcao = `
                    <button class="btn btn-sm btn-info text-white" onclick="visualizarCustoRescisao('${f.nome}', ${custoLancado})" title="Visualizar Valor Lançado">
                        <i class="fas fa-eye"></i> Ver Custo
                    </button>
                `;
                // Se o custo já foi lançado, não pode cancelar a demissão, então o botão fica desabilitado
                btnCancelar = `
                    <button class="btn btn-sm btn-outline-warning me-2" disabled title="Não é possível cancelar uma demissão com custo já lançado.">
                        <i class="fas fa-undo"></i>
                    </button>
                `;
            } else {
                btnAcao = `
                    <button class="btn btn-sm btn-outline-success" onclick="abrirModalCustoRescisao('${doc.id}', '${f.nome}', '${dataDemissaoISO}')" title="Lançar Custo Rescisório">
                        <i class="fas fa-dollar-sign"></i> Lançar Custo
                    </button>
                `;
                btnCancelar = `
                    <button class="btn btn-sm btn-outline-warning me-2" onclick="cancelarDemissao('${doc.id}', '${f.nome}')" title="Cancelar Demissão">
                        <i class="fas fa-undo"></i>
                    </button>
                `;
            }
            btnEditar = `
                <button class="btn btn-sm btn-outline-primary me-2" onclick="abrirModalEditarDemissao('${doc.id}', '${f.nome}')" title="Editar Demissão">
                    <i class="fas fa-edit"></i>
                </button>
            `;
            console.log(`[DEBUG] Botão Cancelar HTML para ${f.nome}: ${btnCancelar}`);

            html += `
                <tr>
                    <td>
                        <div class="fw-bold">${f.nome}</div>
                        <small class="text-muted">${f.cpf || ''}</small>
                    </td>
                    <td>${empresaNome}</td>
                    <td>${f.setor || '-'}</td>
                    <td>${dataDemissao}</td>
                    <td>${tipoDemissao}</td>
                    <td class="text-end">
                        ${btnEditar}
                        ${btnCancelar}
                        ${btnAcao}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado para a busca.</td></tr>';

    } catch (error) {
        console.error("Erro ao carregar demitidos:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function cancelarDemissao(id, nome) {
    if (!confirm(`Tem certeza que deseja cancelar a demissão de ${nome}?\n\nEsta ação irá reativar o funcionário no sistema.`)) {
        return;
    }

    try {
        const funcRef = db.collection('funcionarios').doc(id);

        await funcRef.update({
            status: 'Ativo',
            dataDesligamento: firebase.firestore.FieldValue.delete(),
            motivoDesligamento: firebase.firestore.FieldValue.delete(),
            dataDemissao: firebase.firestore.FieldValue.delete(),
            tipoDemissao: firebase.firestore.FieldValue.delete()
        });

        // Opcional: Remover a movimentação de demissão correspondente
        const movimentacaoQuery = await db.collection('movimentacoes')
            .where('funcionarioId', '==', id)
            .where('tipo', '==', 'demissao')
            .get();
        
        if (!movimentacaoQuery.empty) {
            const batch = db.batch();
            movimentacaoQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        alert(`${nome} foi reativado(a) com sucesso!`);
        carregarPainelDemitidos();

    } catch (error) {
        console.error("Erro ao cancelar demissão:", error);
        alert("Ocorreu um erro ao tentar reativar o funcionário.");
    }
}

function abrirModalCustoRescisao(id, nome, dataDemissao) {
    document.getElementById('custo-rescisao-func-id').value = id;
    document.getElementById('custo-rescisao-nome').value = nome;
    document.getElementById('custo-rescisao-valor').value = '';
    
    if (dataDemissao) {
        document.getElementById('custo-rescisao-data').value = dataDemissao;
    } else {
        document.getElementById('custo-rescisao-data').valueAsDate = new Date();
    }
    
    new bootstrap.Modal(document.getElementById('modalCustoRescisao')).show();
}

async function salvarCustoRescisao() {
    const id = document.getElementById('custo-rescisao-func-id').value;
    const nome = document.getElementById('custo-rescisao-nome').value;
    const valor = parseFloat(document.getElementById('custo-rescisao-valor').value);
    const data = document.getElementById('custo-rescisao-data').value;

    if (!id || isNaN(valor) || !data) {
        alert("Por favor, preencha o valor e a data corretamente.");
        return;
    }

    try {
        await registrarCustoFinanceiro(id, nome, valor, data);

        alert("Custo rescisório lançado com sucesso!");
        bootstrap.Modal.getInstance(document.getElementById('modalCustoRescisao')).hide();
        
    } catch (e) {
        console.error("Erro ao salvar custo:", e);
        alert("Erro ao salvar o lançamento.");
    }
}

// Função auxiliar reutilizável para salvar no banco
async function registrarCustoFinanceiro(id, nome, valor, dataString) {
    await db.collection('lancamentos_financeiros').add({
        funcionarioId: id,
        funcionarioNome: nome, // Adicionado para facilitar leitura
        valor: valor,
        dataVencimento: new Date(dataString + 'T12:00:00'),
        origem: 'FOPAG',
        contaOrigem: 'FOPAG',
        subdivisao: 'Rescisões',
        processo: 'Rescisão',
        descricao: `Rescisão Contratual - ${nome}`,
        tipo: 'Despesa',
        status: 'Realizado',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function visualizarCustoRescisao(nome, valor) {
    if (typeof abrirModalGenerico === 'function') {
        abrirModalGenerico('Custo Rescisório Lançado', `
            <div class="text-center p-3">
                <h5>${nome}</h5>
                <p class="text-muted mb-1">Valor total lançado no financeiro:</p>
                <h2 class="text-success fw-bold">R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            </div>
        `);
    } else {
        alert(`Custo Rescisório - ${nome}\nValor: R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    }
}

async function abrirModalEditarDemissao(funcId, nome) {
    try {
        // Busca a movimentação de demissão do funcionário
        const movSnap = await db.collection('movimentacoes')
            .where('funcionarioId', '==', funcId)
            .where('tipo', '==', 'demissao')
            .orderBy('data', 'desc')
            .limit(1)
            .get();

        if (movSnap.empty) {
            alert('Registro de demissão não encontrado na tabela de movimentações. Verifique se o registro existe.');
            return;
        }

        const movDoc = movSnap.docs[0];
        const mov = movDoc.data();

        // Preenche o modal
        document.getElementById('edit-demissao-func-id').value = funcId;
        document.getElementById('edit-demissao-mov-id').value = movDoc.id;
        document.getElementById('edit-demissao-nome').value = nome;
        
        if (mov.data) {
            const dataObj = mov.data.toDate ? mov.data.toDate() : new Date(mov.data);
            document.getElementById('edit-demissao-data').value = dataObj.toISOString().split('T')[0];
        }

        document.getElementById('edit-demissao-tipo').value = mov.motivo || ''; // O campo 'motivo' armazena o TIPO da demissão
        document.getElementById('edit-demissao-motivo').value = mov.motivoDetalhado || ''; // O campo 'motivoDetalhado' armazena o MOTIVO real
        document.getElementById('edit-demissao-aviso').value = mov.avisoPrevio || '';
        document.getElementById('edit-demissao-obs').value = mov.detalhes || '';

        // Carregar valor rescisão atual (soma de lancamentos_financeiros)
        const financeirosSnap = await db.collection('lancamentos_financeiros')
            .where('funcionarioId', '==', funcId)
            .where('subdivisao', '==', 'Rescisões')
            .get();
        
        let totalRescisao = 0;
        financeirosSnap.forEach(doc => {
            totalRescisao += parseFloat(doc.data().valor) || 0;
        });
        document.getElementById('edit-demissao-valor-rescisao').value = totalRescisao.toFixed(2);

        new bootstrap.Modal(document.getElementById('modalEditarDemissao')).show();


    } catch (error) {
        console.error("Erro ao carregar demissão para edição:", error);
        alert("Erro ao carregar dados.");
    }
}

async function salvarEdicaoDemissao() {
    const movId = document.getElementById('edit-demissao-mov-id').value;
    const funcId = document.getElementById('edit-demissao-func-id').value;
    const data = document.getElementById('edit-demissao-data').value;
    const tipo = document.getElementById('edit-demissao-tipo').value;
    const motivo = document.getElementById('edit-demissao-motivo').value;
    const aviso = document.getElementById('edit-demissao-aviso').value;
    const obs = document.getElementById('edit-demissao-obs').value;

    if (!movId || !funcId || !data || !tipo) {
        alert("Preencha os campos obrigatórios (Data e Tipo).");
        return;
    }

    try {
        const dataObj = new Date(data + 'T00:00:00');
        const timestamp = firebase.firestore.Timestamp.fromDate(dataObj);

        const batch = db.batch();

        // 1. Atualizar Movimentação
        const movRef = db.collection('movimentacoes').doc(movId);
        batch.update(movRef, {
            data: timestamp,
            motivo: tipo, // Armazena o tipo de demissão
            motivoDetalhado: motivo,
            avisoPrevio: aviso,
            detalhes: obs
        });

        // 2. Atualizar Funcionário (para manter consistência nos dados redundantes)
        const funcRef = db.collection('funcionarios').doc(funcId);
        batch.update(funcRef, {
            dataDesligamento: timestamp,
            dataDemissao: timestamp,
            motivoDesligamento: motivo,
            tipoDemissao: tipo,
            ultimaMovimentacao: timestamp
        });

        // 3. Atualizar/criar lançamento financeiro de rescisão
        const valorRescisao = parseFloat(document.getElementById('edit-demissao-valor-rescisao').value) || 0;

        // Deletar lançamentos existentes
        const rescisoesQuery = await db.collection('lancamentos_financeiros')
            .where('funcionarioId', '==', funcId)
            .where('subdivisao', '==', 'Rescisões').get();
        
        rescisoesQuery.docs.forEach(doc => batch.delete(doc.ref));

        // Criar novo lançamento se valor > 0
        if (valorRescisao > 0) {
            const nomeFunc = document.getElementById('edit-demissao-nome').value;
            const financRef = db.collection('lancamentos_financeiros').doc();
            batch.set(financRef, {
                funcionarioId: funcId,
                funcionarioNome: nomeFunc,
                valor: valorRescisao,
                dataVencimento: timestamp,
                origem: 'FOPAG',
                contaOrigem: 'FOPAG',
                subdivisao: 'Rescisões',
                processo: 'Rescisão',
                descricao: `Rescisão - ${nomeFunc}`,
                tipo: 'Despesa',
                status: 'Realizado',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();


        alert("Demissão atualizada com sucesso!");
        bootstrap.Modal.getInstance(document.getElementById('modalEditarDemissao')).hide();
        carregarPainelDemitidos();

    } catch (error) {
        console.error("Erro ao salvar edição:", error);
        alert("Erro ao salvar alterações: " + error.message);
    }
}

// --- Funções de Importação ---

function abrirModalImportacaoCustos() {
    document.getElementById('importacao-arquivo').value = '';
    document.getElementById('importacao-resultado').style.display = 'none';
    document.getElementById('importacao-resultado').innerHTML = '';
    document.getElementById('importacao-data-competencia').valueAsDate = new Date();
    new bootstrap.Modal(document.getElementById('modalImportacaoCustos')).show();
}

async function processarImportacaoCustos() {
    const fileInput = document.getElementById('importacao-arquivo');
    const dataCompetencia = document.getElementById('importacao-data-competencia').value;
    const resultadoDiv = document.getElementById('importacao-resultado');

    if (!fileInput.files.length || !dataCompetencia) {
        alert("Selecione um arquivo e a data de competência.");
        return;
    }

    // Carregar biblioteca XLSX se não existir
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    resultadoDiv.style.display = 'block';
    resultadoDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Processando...</div>';

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                resultadoDiv.innerHTML = '<div class="alert alert-warning">Planilha vazia.</div>';
                return;
            }

            // Buscar todos os funcionários para mapear CPF -> ID
            // Otimização: Buscar apenas campos necessários
            const funcionariosSnap = await db.collection('funcionarios').get();
            const mapaFuncionarios = {}; // CPF -> {id, nome, dataDesligamento}
            
            funcionariosSnap.forEach(doc => {
                const f = doc.data();
                if (f.cpf) {
                    const cpfLimpo = f.cpf.replace(/\D/g, '');
                    
                    let dataDesligamento = null;
                    if (f.dataDesligamento) dataDesligamento = f.dataDesligamento.toDate ? f.dataDesligamento.toDate() : new Date(f.dataDesligamento);
                    else if (f.dataDemissao) dataDesligamento = f.dataDemissao.toDate ? f.dataDemissao.toDate() : new Date(f.dataDemissao);

                    mapaFuncionarios[cpfLimpo] = { 
                        id: doc.id, 
                        nome: f.nome,
                        dataDesligamento: (dataDesligamento && !isNaN(dataDesligamento.getTime())) ? dataDesligamento : null
                    };
                }
            });

            let sucessos = 0;
            let erros = 0;
            let logErros = [];

            for (const row of jsonData) {
                // Estratégia robusta para encontrar colunas ignorando case e espaços
                const keys = Object.keys(row);
                
                // Busca CPF (procura chave que seja 'CPF' ignorando espaços/case)
                const keyCpf = keys.find(k => k && k.trim().toUpperCase() === 'CPF');
                const cpf = keyCpf ? row[keyCpf] : null;

                // Busca Valor (procura chaves comuns)
                let valor = null;
                const termosValor = ['LIQUIDO', 'LÍQUIDO', 'VALOR', 'CUSTO', 'TOTAL'];
                
                // 1. Tenta match exato (trimado)
                let keyValor = keys.find(k => k && termosValor.includes(k.trim().toUpperCase()));
                // 2. Se não achar, tenta match parcial (contém o termo)
                if (!keyValor) {
                    keyValor = keys.find(k => k && termosValor.some(termo => k.trim().toUpperCase().includes(termo)));
                }
                if (keyValor) valor = row[keyValor];
                
                if (!cpf) continue; // Pula linhas sem CPF

                const cpfLimpo = String(cpf).replace(/\D/g, '');
                const funcionario = mapaFuncionarios[cpfLimpo];

                if (funcionario) {
                    // Trata valor (pode vir como string com vírgula ou número)
                    let valorNumerico = 0;
                    if (typeof valor === 'string') {
                        valorNumerico = parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                    } else {
                        valorNumerico = parseFloat(valor);
                    }

                    // Define a data: prioridade para a data de desligamento do funcionário
                    let dataLancamento = dataCompetencia;
                    if (funcionario.dataDesligamento) {
                        dataLancamento = funcionario.dataDesligamento.toISOString().split('T')[0];
                    }

                    if (!isNaN(valorNumerico) && valorNumerico > 0) {
                        await registrarCustoFinanceiro(funcionario.id, funcionario.nome, valorNumerico, dataLancamento);
                        sucessos++;
                    } else {
                        erros++;
                        logErros.push(`Valor inválido para ${funcionario.nome}`);
                    }
                } else {
                    erros++;
                    logErros.push(`CPF não encontrado: ${cpf}`);
                }
            }

            let htmlResultado = `<div class="alert alert-success"><strong>${sucessos}</strong> lançamentos importados com sucesso!</div>`;
            
            if (erros > 0) {
                htmlResultado += `<div class="alert alert-warning"><strong>${erros}</strong> erros encontrados:<br><small>${logErros.slice(0, 5).join('<br>')}${logErros.length > 5 ? '<br>...' : ''}</small></div>`;
            }

            resultadoDiv.innerHTML = htmlResultado;

        } catch (error) {
            console.error("Erro na importação:", error);
            resultadoDiv.innerHTML = `<div class="alert alert-danger">Erro ao processar arquivo: ${error.message}</div>`;
        }
    };

    reader.readAsArrayBuffer(file);
}

// Exportar funções
window.inicializarPainelDemitidos = inicializarPainelDemitidos;
window.abrirModalCustoRescisao = abrirModalCustoRescisao;
window.salvarCustoRescisao = salvarCustoRescisao;
window.abrirModalImportacaoCustos = abrirModalImportacaoCustos;
window.processarImportacaoCustos = processarImportacaoCustos;
window.visualizarCustoRescisao = visualizarCustoRescisao;
window.cancelarDemissao = cancelarDemissao;
window.abrirModalEditarDemissao = abrirModalEditarDemissao;
window.salvarEdicaoDemissao = salvarEdicaoDemissao;