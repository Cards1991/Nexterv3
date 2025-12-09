// ========================================
// Módulo: Jurídico - Gestão de Processos
// ========================================

const PEDIDOS_POR_TIPO_ACAO = {
    'Trabalhista': ['Horas Extras', 'Insalubridade', 'Periculosidade', 'Desvio de função', 'Assédio', 'Dano Moral', 'Verbas Rescisórias', 'Salário por Fora', 'Honorários Advocatícios', 'Depósito de fgts em atraso', 'Outros'],
    'Cível': ['Indenização por Danos Materiais', 'Obrigação de Fazer', 'Revisão de Contrato', 'Busca e Apreensão'],
    'Consumidor': ['Produto com Defeito', 'Cobrança Indevida', 'Publicidade Enganosa', 'Direito de Arrependimento'],
    'Tributário': ['Repetição de Indébito', 'Mandado de Segurança', 'Execução Fiscal'],
    // Adicione outros tipos de ação e seus pedidos aqui
};

async function inicializarGestaoProcessos() {
    await carregarProcessosJuridicos();
    document.getElementById('jur-tipo-acao')?.addEventListener('change', atualizarPedidosDoProcesso);
    document.getElementById('btn-filtrar-processos')?.addEventListener('click', carregarProcessosJuridicos);
    document.getElementById('jur-pedidos-container')?.addEventListener('input', calcularValorCausaAutomatico);
}

function atualizarPedidosDoProcesso() {
    const tipoAcao = document.getElementById('jur-tipo-acao').value;
    const container = document.getElementById('jur-pedidos-container');
    const pedidos = PEDIDOS_POR_TIPO_ACAO[tipoAcao] || [];

    if (pedidos.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum pedido pré-definido para este tipo de ação.</p>';
        document.getElementById('jur-valor-causa').value = ''; // Limpa o valor da causa
        return;
    }

    container.innerHTML = pedidos.map(pedido => `
        <div class="row g-3 align-items-center mb-3 border-bottom pb-3">
            <div class="col-lg-3 col-md-12">
                <div class="form-check">
                    <input class="form-check-input pedido-checkbox" type="checkbox" value="${pedido}" id="pedido-${pedido.replace(/\s+/g, '')}">
                    <label class="form-check-label" for="pedido-${pedido.replace(/\s+/g, '')}">${pedido}</label>
                </div>
            </div>
            <div class="col-lg-3 col-md-4">
                <div class="input-group input-group-sm">
                    <span class="input-group-text">R$</span>
                    <input type="number" class="form-control valor-pedido" id="valor-${pedido.replace(/\s+/g, '')}" placeholder="Valor">
                </div>
            </div>
            <div class="col-lg-3 col-md-4">
                <select class="form-select form-select-sm risco-pedido" id="risco-${pedido.replace(/\s+/g, '')}">
                    <option value="Baixo">Risco Baixo</option>
                    <option value="Médio" selected>Risco Médio</option>
                    <option value="Alto">Risco Alto</option>
                </select>
            </div>
            <div class="col-lg-3 col-md-4">
                <select class="form-select form-select-sm avaliacao-prova" id="avaliacao-${pedido.replace(/\s+/g, '')}" title="Avaliação da Prova">
                    <option value="Ruim">Prova Ruim</option>
                    <option value="Media" selected>Prova Média</option>
                    <option value="Boa">Prova Boa</option>
                </select>
            </div>
        </div>
    `).join('');

    calcularValorCausaAutomatico(); // Calcula o valor inicial ao carregar os pedidos
}

function calcularValorCausaAutomatico() {
    const container = document.getElementById('jur-pedidos-container');
    let valorTotal = 0;
    container.querySelectorAll('.pedido-checkbox:checked').forEach(checkbox => {
        const pedidoId = checkbox.value.replace(/\s+/g, '');
        const valorInput = document.getElementById(`valor-${pedidoId}`);
        if (valorInput) {
            valorTotal += parseFloat(valorInput.value) || 0;
        }
    });

    document.getElementById('jur-valor-causa').value = valorTotal > 0 ? valorTotal.toFixed(2) : '';
}

async function carregarProcessosJuridicos() {
    const tbody = document.getElementById('tabela-processos-juridicos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando processos...</td></tr>';
    
    try {
        let query = db.collection('processos_juridicos');
        
        const filtroStatus = document.getElementById('jur-filtro-status').value;
        const filtroRisco = document.getElementById('jur-filtro-risco').value;
        const filtroTipo = document.getElementById('jur-filtro-tipo').value;

        if (filtroStatus) query = query.where('status', '==', filtroStatus);
        if (filtroRisco) query = query.where('riscoGeral', '==', filtroRisco);
        if (filtroTipo) query = query.where('tipoAcao', '==', filtroTipo);

        const snapshot = await query.orderBy('dataDistribuicao', 'desc').get();
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum processo cadastrado.</td></tr>';
            atualizarMetricasJuridicas([]);
            return;
        }

        const processos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        tbody.innerHTML = '';
        processos.forEach(proc => {
            let riscoClass = '';
            switch (proc.riscoGeral) { // Usa o risco geral calculado
                case 'Alto': riscoClass = 'bg-danger'; break;
                case 'Médio': riscoClass = 'bg-warning text-dark'; break;
                case 'Baixo': riscoClass = 'bg-success'; break;
                default: riscoClass = 'bg-secondary';
            }

            let statusClass = '';
            switch (proc.status) {
                case 'Ativo': statusClass = 'bg-primary'; break;
                case 'Finalizado': statusClass = 'bg-success'; break;
                default: statusClass = 'bg-secondary';
            }

            const row = `
                <tr>
                    <td class="fw-bold">${proc.numeroProcesso || '-'}</td>
                    <td>${proc.cliente || '-'}</td>
                    <td>${proc.parteContraria || '-'}</td>
                    <td><span class="badge bg-info text-dark">${proc.tipoAcao || '-'}</span></td>
                    <td><span class="badge ${riscoClass}">${proc.riscoGeral || 'N/A'}</span></td>
                    <td><span class="badge ${statusClass}">${proc.status || '-'}</span></td>
                    <td>${proc.dataConciliacao ? formatarData(proc.dataConciliacao.toDate()) : 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info" onclick="abrirModalAnaliseRiscoIA('${proc.id}')" title="Análise de Risco (IA)"><i class="fas fa-brain"></i></button>
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalProcesso('${proc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirProcessoJuridico('${proc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        atualizarMetricasJuridicas(processos);

    } catch (error) {
        console.error("Erro ao carregar processos jurídicos:", error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro ao carregar processos.</td></tr>';
    }
}

function atualizarMetricasJuridicas(processos) {
    const ativos = processos.filter(p => p.status === 'Ativo');
    const riscoAlto = ativos.filter(p => p.riscoGeral === 'Alto');
    
    document.getElementById('jur-total-processos').textContent = ativos.length;
    document.getElementById('jur-risco-alto').textContent = riscoAlto.length;
    // Placeholders para outras métricas
    document.getElementById('jur-prazos-mes').textContent = 0;
    document.getElementById('jur-finalizados-mes').textContent = 0;
}

async function abrirModalProcesso(processoId = null) {
    const modalEl = document.getElementById('processoJuridicoModal');
    const modalTitle = document.getElementById('processoJuridicoModalTitle');
    const form = document.getElementById('form-processo-juridico');
    form.reset();
    document.getElementById('jur-processo-id').value = processoId || '';
    document.getElementById('jur-pedidos-container').innerHTML = '<p class="text-muted">Selecione um "Tipo de Ação" para ver os pedidos.</p>';
    document.getElementById('jur-historico-container').innerHTML = '<p class="text-muted">Nenhuma alteração registrada.</p>';

    // Resetar e popular select de clientes
    const clienteSelect = document.getElementById('jur-cliente');
    clienteSelect.innerHTML = '<option value="">Carregando...</option>';
    const clientesSnap = await db.collection('clientes_juridicos').orderBy('nomeFantasia').get();
    clienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
    clientesSnap.forEach(doc => {
        clienteSelect.innerHTML += `<option value="${doc.data().nomeFantasia}">${doc.data().nomeFantasia}</option>`;
    });

    if (processoId) {
        modalTitle.textContent = 'Editar Processo';
        const doc = await db.collection('processos_juridicos').doc(processoId).get();
        if (doc.exists) {
            const data = doc.data();
            window.__processo_original = data; // Salva os dados originais para o log

            document.getElementById('jur-numero-processo').value = data.numeroProcesso;
            document.getElementById('jur-data-distribuicao').value = formatarDataParaInput(data.dataDistribuicao);
            document.getElementById('jur-cliente').value = data.cliente;
            document.getElementById('jur-parte-contraria').value = data.parteContraria;
            document.getElementById('jur-tipo-acao').value = data.tipoAcao;
            document.getElementById('jur-status').value = data.status;
            document.getElementById('jur-descricao').value = data.descricao;
            document.getElementById('jur-valor-causa').value = data.valorCausa || '';
            document.getElementById('jur-data-conciliacao').value = data.dataConciliacao ? formatarDataParaInput(data.dataConciliacao, true) : '';
            document.getElementById('jur-data-instrucao').value = data.dataInstrucao ? formatarDataParaInput(data.dataInstrucao, true) : '';

            // Preenche a nova aba de Análise
            document.getElementById('jur-analise-pontos').value = data.analise?.pontos || '';
            document.getElementById('jur-analise-testemunhas').value = data.analise?.testemunhas || '';
            document.getElementById('jur-analise-documentos').value = data.analise?.documentos || '';


            // Popula os pedidos
            atualizarPedidosDoProcesso();
            if (data.pedidos && Array.isArray(data.pedidos)) {
                data.pedidos.forEach(p => {
                    const pedidoId = p.pedido.replace(/\s+/g, '');
                    const chk = document.getElementById(`pedido-${pedidoId}`);
                    const val = document.getElementById(`valor-${pedidoId}`);
                    const rsk = document.getElementById(`risco-${pedidoId}`);
                    const avl = document.getElementById(`avaliacao-${pedidoId}`); // Carrega avaliação da prova
                    if (avl && p.avaliacaoProva) {
                        avl.value = p.avaliacaoProva;
                    }
                    if (chk) chk.checked = true;
                    if (val) val.value = p.valor;
                    if (rsk) rsk.value = p.risco;
                });
            }

            // Carrega o histórico
            carregarHistoricoProcesso(processoId);
        }
    } else {
        modalTitle.textContent = 'Novo Processo';
        window.__processo_original = null;
    }

    // Garante que a primeira aba esteja ativa
    new bootstrap.Tab(document.getElementById('processo-dados-tab')).show();
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarProcessoJuridico() {
    const processoId = document.getElementById('jur-processo-id').value;

    // Coletar pedidos
    const pedidos = [];
    const container = document.getElementById('jur-pedidos-container');
    container.querySelectorAll('.form-check-input:checked').forEach(chk => {
        const pedidoId = chk.value.replace(/\s+/g, '');
        pedidos.push({
            pedido: chk.value,
            valor: parseFloat(document.getElementById(`valor-${pedidoId}`).value) || 0,
            risco: document.getElementById(`risco-${pedidoId}`).value,
            avaliacaoProva: document.getElementById(`avaliacao-${pedidoId}`).value
        });
    });

    // Calcular risco geral
    let riscoGeral = 'Baixo';
    // O risco geral sobe para 'Alto' se algum pedido tiver risco 'Alto' OU se tiver risco 'Médio' com prova 'Ruim'
    if (pedidos.some(p => p.risco === 'Alto' || (p.risco === 'Médio' && p.avaliacaoProva === 'Ruim'))) riscoGeral = 'Alto';
    else if (pedidos.some(p => p.risco === 'Médio')) riscoGeral = 'Médio';

    const dados = {
        numeroProcesso: document.getElementById('jur-numero-processo').value,
        dataDistribuicao: new Date(document.getElementById('jur-data-distribuicao').value.replace(/-/g, '\/')),
        cliente: document.getElementById('jur-cliente').value,
        parteContraria: document.getElementById('jur-parte-contraria').value,
        tipoAcao: document.getElementById('jur-tipo-acao').value,
        status: document.getElementById('jur-status').value,
        descricao: document.getElementById('jur-descricao').value,
        valorCausa: parseFloat(document.getElementById('jur-valor-causa').value) || 0,
        dataConciliacao: document.getElementById('jur-data-conciliacao').value ? new Date(document.getElementById('jur-data-conciliacao').value) : null,
        dataInstrucao: document.getElementById('jur-data-instrucao').value ? new Date(document.getElementById('jur-data-instrucao').value) : null,
        pedidos: pedidos,
        riscoGeral: riscoGeral,
        analise: {
            pontos: document.getElementById('jur-analise-pontos').value.trim(),
            testemunhas: document.getElementById('jur-analise-testemunhas').value.trim(),
            documentos: document.getElementById('jur-analise-documentos').value.trim()
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.numeroProcesso || !dados.cliente || !dados.parteContraria || !dados.tipoAcao) {
        mostrarMensagem("Preencha os campos obrigatórios.", "warning");
        return;
    }

    try {
        if (processoId) {
            const log = gerarLogDeAlteracoes(window.__processo_original, dados);
            await db.collection('processos_juridicos').doc(processoId).update(dados);
            if (log) {
                await db.collection('processos_juridicos').doc(processoId).collection('historico').add(log);
            }
            mostrarMensagem("Processo atualizado com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('processos_juridicos').add(dados);
            mostrarMensagem("Processo cadastrado com sucesso!", "success");
            const log = { alteracao: 'Processo criado.', usuario: firebase.auth().currentUser.email, data: new Date() };
            await db.collection('processos_juridicos').doc(docRef.id).collection('historico').add(log);
        }

        bootstrap.Modal.getInstance(document.getElementById('processoJuridicoModal')).hide();
        await carregarProcessosJuridicos();

    } catch (error) {
        console.error("Erro ao salvar processo:", error);
        mostrarMensagem("Erro ao salvar o processo.", "error");
    }
}

async function excluirProcessoJuridico(processoId) {
    if (!confirm("Tem certeza que deseja excluir este processo? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await db.collection('processos_juridicos').doc(processoId).delete();
        mostrarMensagem("Processo excluído com sucesso.", "success");
        await carregarProcessosJuridicos();
    } catch (error) {
        console.error("Erro ao excluir processo:", error);
        mostrarMensagem("Falha ao excluir o processo.", "error");
    }
}

function gerarLogDeAlteracoes(dadosAntigos, dadosNovos) {
    if (!dadosAntigos) return null;
    let alteracoes = [];
    const camposSimples = {
        status: 'Status',
        riscoGeral: 'Risco geral',
        valorCausa: 'Valor da causa',
        descricao: 'Objeto da ação',
        parteContraria: 'Parte contrária'
    };

    // Compara campos simples (string, number)
    for (const campo in camposSimples) {
        if (String(dadosAntigos[campo] || '') !== String(dadosNovos[campo] || '')) {
            alteracoes.push(`${camposSimples[campo]} alterado de "${dadosAntigos[campo] || 'vazio'}" para "${dadosNovos[campo] || 'vazio'}".`);
        }
    }

    // Compara datas
    const camposData = {
        dataConciliacao: 'Data de conciliação',
        dataInstrucao: 'Data de instrução'
    };
    for (const campo in camposData) {
        const dataAntiga = dadosAntigos[campo] ? dadosAntigos[campo].seconds : null;
        const dataNova = dadosNovos[campo] ? new Date(dadosNovos[campo]).getTime() / 1000 : null;
        if (dataAntiga !== dataNova) {
            alteracoes.push(`${camposData[campo]} alterada.`);
        }
    }

    // Compara pedidos (uma forma simplificada, apenas detecta se houve mudança)
    const pedidosAntigosStr = JSON.stringify(dadosAntigos.pedidos?.map(p => ({ p: p.pedido, v: p.valor, r: p.risco })) || []);
    const pedidosNovosStr = JSON.stringify(dadosNovos.pedidos?.map(p => ({ p: p.pedido, v: p.valor, r: p.risco })) || []);
    if (pedidosAntigosStr !== pedidosNovosStr) {
        alteracoes.push('Pedidos da ação foram alterados.');
    }
    
    if (dadosAntigos.status !== dadosNovos.status) {
        alteracoes.push(`Status alterado de "${dadosAntigos.status}" para "${dadosNovos.status}".`);
    }
    if (dadosAntigos.riscoGeral !== dadosNovos.riscoGeral) {
        alteracoes.push(`Risco geral alterado de "${dadosAntigos.riscoGeral}" para "${dadosNovos.riscoGeral}".`);
    }

    if (alteracoes.length === 0) return null;

    return {
        alteracao: alteracoes.join(' '),
        usuario: firebase.auth().currentUser.email,
        data: new Date()
    };
}

async function carregarHistoricoProcesso(processoId) {
    const container = document.getElementById('jur-historico-container');
    container.innerHTML = '<p class="text-muted">Carregando histórico...</p>';
    const historicoSnap = await db.collection('processos_juridicos').doc(processoId).collection('historico').orderBy('data', 'asc').get();

    if (historicoSnap.empty) {
        container.innerHTML = '<p class="text-muted">Nenhuma alteração registrada.</p>';
        return;
    }

    container.innerHTML = '<ul class="list-group list-group-flush">';
    historicoSnap.forEach(doc => {
        const hist = doc.data();
        container.innerHTML += `<li class="list-group-item"><small class="text-muted">${formatarData(hist.data.toDate(), true)} por ${hist.usuario}</small><br>${hist.alteracao}</li>`;
    });
    container.innerHTML += '</ul>';
}

function formatarDataParaInput(timestamp, comTempo = false) {
    if (!timestamp) return '';
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    if (comTempo) {
        const horas = String(data.getHours()).padStart(2, '0');
        const minutos = String(data.getMinutes()).padStart(2, '0');
        return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
    }
    return `${ano}-${mes}-${dia}`;
}

async function abrirModalAnaliseRiscoIA(processoId) {
    const modalEl = document.getElementById('analiseRiscoModal');
    const modalBody = document.getElementById('analise-risco-modal-body');
    const modal = new bootstrap.Modal(modalEl);
    
    // Reset para o estado de loading
    modalBody.innerHTML = `
        <div class="text-center p-5">
            <i class="fas fa-spinner fa-spin fa-3x mb-3"></i>
            <p>Aguarde, a IA está analisando os documentos e o histórico do processo...</p>
        </div>`;
    modal.show();

    try {
        const processoDoc = await db.collection('processos_juridicos').doc(processoId).get();
        if (!processoDoc.exists) {
            modalBody.innerHTML = '<p class="text-danger">Processo não encontrado.</p>';
            return;
        }
        const processo = processoDoc.data();

        // Simulação de chamada de IA e processamento
        setTimeout(() => {
            // O resultado da IA seria injetado aqui.
            // Agora, usamos os dados reais que o usuário inseriu.
            let pontosFortesHTML = processo.analise?.pontos ? `<li class="list-group-item">${processo.analise.pontos}</li>` : '<li class="list-group-item text-muted">Nenhuma análise sobre controles de ponto informada.</li>';
            let testemunhasHTML = processo.analise?.testemunhas ? `<li class="list-group-item">${processo.analise.testemunhas}</li>` : '<li class="list-group-item text-muted">Nenhuma análise sobre testemunhas informada.</li>';
            let documentosHTML = processo.analise?.documentos ? `<li class="list-group-item">${processo.analise.documentos}</li>` : '<li class="list-group-item text-muted">Nenhuma análise sobre documentos informada.</li>';

            modalBody.innerHTML = `
                <h5><i class="fas fa-balance-scale-right text-danger"></i> Matriz de Risco (Exemplo)</h5>
                <table class="table table-bordered table-sm">
                    <thead><tr class="table-light"><th>Pedido</th><th>Probabilidade de Perda</th><th>Impacto Financeiro</th><th>Classificação</th></tr></thead>
                    <tbody>
                        ${processo.pedidos?.map(p => `<tr><td>${p.pedido}</td><td>${p.risco}</td><td>R$ ${p.valor.toFixed(2)}</td><td><span class="badge bg-warning text-dark">${p.risco}</span></td></tr>`).join('') || '<tr><td colspan="4">Nenhum pedido informado.</td></tr>'}
                    </tbody>
                </table>

                <h5 class="mt-4"><i class="fas fa-file-alt text-primary"></i> Análise de Provas (Informado pelo Advogado)</h5>
                <ul class="list-group mb-4">
                    <li class="list-group-item list-group-item-secondary"><strong>Controles de Ponto:</strong></li>
                    ${pontosFortesHTML}
                    <li class="list-group-item list-group-item-secondary"><strong>Testemunhas:</strong></li>
                    ${testemunhasHTML}
                    <li class="list-group-item list-group-item-secondary"><strong>Documentos e E-mails:</strong></li>
                    ${documentosHTML}
                </ul>

                <h5 class="mt-4"><i class="fas fa-search-dollar text-primary"></i> Estimativa Consolidada (Exemplo)</h5>
                <p>A estimativa de perda total para este processo é de <strong>R$ ${processo.valorCausa?.toFixed(2) || '0.00'}</strong>, com um risco geral de <strong>${processo.riscoGeral}</strong>.</p>
            `;
        }, 1500); // Simula o tempo de processamento da IA
    } catch (error) {
        console.error("Erro ao carregar dados para análise de risco:", error);
        modalBody.innerHTML = '<p class="text-danger">Ocorreu um erro ao carregar os dados do processo.</p>';
    }
}

function imprimirAnaliseRisco() {
    mostrarMensagem("Funcionalidade de impressão do relatório de análise será implementada em breve.", "info");
}