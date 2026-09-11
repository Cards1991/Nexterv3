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

// Instâncias dos gráficos
let chartEvolucao = null;
let chartFinanceiro = null;
let chartStatus = null;

async function inicializarGestaoProcessos() {
    await carregarProcessosJuridicos();
    document.getElementById('jur-tipo-acao')?.addEventListener('change', atualizarPedidosDoProcesso);
    document.getElementById('btn-filtrar-processos')?.addEventListener('click', carregarProcessosJuridicos);
    document.getElementById('jur-pedidos-container')?.addEventListener('input', calcularValorCausaAutomatico);
    document.getElementById('jur-pedidos-container')?.addEventListener('change', calcularValorCausaAutomatico);
    
    document.getElementById('jur-status')?.addEventListener('change', toggleAbaEncerramento);
    document.getElementById('jur-resultado-processo')?.addEventListener('change', toggleValoresEncerramento);
}

function toggleAbaEncerramento() {
    const status = document.getElementById('jur-status').value;
    const navItem = document.getElementById('nav-item-encerramento');
    if (status === 'Finalizado') {
        navItem.style.display = 'block';
    } else {
        navItem.style.display = 'none';
    }
}

function toggleValoresEncerramento() {
    const resultado = document.getElementById('jur-resultado-processo').value;
    const bloco = document.getElementById('bloco-valores-encerramento');
    if (resultado === 'Acordo') {
        bloco.style.display = 'block';
    } else {
        bloco.style.display = 'none';
    }
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
                    <input type="text" inputmode="decimal" class="form-control valor-pedido" id="valor-${pedido.replace(/\s+/g, '')}" placeholder="Valor">
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
        if (valorInput && valorInput.value) {
            valorTotal += parseFloat(valorInput.value.replace(',', '.')) || 0;
        }
    });

    document.getElementById('jur-valor-causa').value = valorTotal > 0 ? valorTotal.toFixed(2) : '';
}

async function carregarProcessosJuridicos() {
    const tbody = document.getElementById('tabela-processos-juridico');
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
        const processosFiltrados = processos;
        
        tbody.innerHTML = '';
        // Renderiza os gráficos antes de popular a tabela
        renderizarGraficosProcessos(processosFiltrados);

        processosFiltrados.forEach(proc => {
            let riscoClass = '';
            switch (proc.riscoGeral) {
                case 'Alto': riscoClass = 'bg-danger'; break;
                case 'Médio': riscoClass = 'bg-warning text-dark'; break;
                case 'Baixo': riscoClass = 'bg-success'; break;
                default: riscoClass = 'bg-secondary';
            }

            let statusClass = '';
            let styleLine = '';
            switch (proc.status) {
                case 'Ativo': statusClass = 'bg-primary'; break;
                case 'Finalizado': 
                    statusClass = 'bg-success'; 
                    styleLine = 'background-color: #f0fdf4; opacity: 0.8;';
                    break;
                case 'Arquivado':
                    statusClass = 'bg-secondary';
                    styleLine = 'background-color: #f8f9fa; opacity: 0.6;';
                    break;
                default: statusClass = 'bg-secondary';
            }
            
            // Exibir valor final do acordo se for finalizado
            let valorExibir = `R$ ${(proc.valorCausa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            let riscoExibir = `<div class="fw-bold text-${riscoClass.replace('bg-', '')}">${proc.riscoGeral || 'N/A'}</div>`;
            if (proc.status === 'Finalizado' && proc.encerramento?.resultado === 'Acordo') {
                valorExibir = `<span class="text-success fw-bold" title="Valor do Acordo Fechado"><i class="fas fa-handshake"></i> R$ ${(proc.encerramento.valorFinal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>`;
                riscoExibir = `<div class="fw-bold text-success">Resolvido (Acordo)</div>`;
            } else if (proc.status === 'Finalizado') {
                riscoExibir = `<div class="fw-bold text-secondary">Resolvido (${proc.encerramento?.resultado || 'S/N'})</div>`;
            }

            const row = `
                <tr style="${styleLine}">
                    <td>
                        <div class="fw-bold text-dark">${proc.numeroProcesso || '-'}</div>
                        <span class="badge bg-light text-dark border">${proc.tipoAcao || '-'}</span>
                    </td>
                    <td>
                        <div class="fw-bold">${proc.funcionarioNome || proc.cliente || '-'}</div>
                    </td>
                    <td>
                        <div class="fw-bold"><span class="badge ${statusClass}">${proc.status || '-'}</span></div>
                        <small class="text-muted"><i class="fas fa-briefcase"></i> ${proc.escritorio || proc.parteContraria || '-'}</small>
                    </td>
                    <td>
                        ${riscoExibir}
                        <small class="text-muted">${valorExibir}</small>
                    </td>
                    <td>
                        <span class="badge border border-secondary text-secondary bg-white"><i class="far fa-calendar-alt"></i> ${proc.dataConciliacao ? formatarData(proc.dataConciliacao.toDate()) : 'Sem prazo'}</span>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-light border" onclick="visualizarProcessoCompacto('${proc.id}')" title="Visualizar Resumo"><i class="fas fa-eye text-primary"></i></button>
                        <button class="btn btn-sm btn-light border" onclick="abrirModalAnaliseRiscoIA('${proc.id}')" title="Análise de Risco (IA)"><i class="fas fa-brain text-info"></i></button>
                        <button class="btn btn-sm btn-light border" onclick="abrirModalProcesso('${proc.id}')" title="Editar"><i class="fas fa-edit text-secondary"></i></button>
                        <button class="btn btn-sm btn-light border" onclick="excluirProcessoJuridico('${proc.id}')" title="Excluir"><i class="fas fa-trash text-danger"></i></button>
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
    
    const elTotal = document.getElementById('jur-total-processos');
    const elRisco = document.getElementById('jur-risco-alto');
    const elPrazos = document.getElementById('jur-prazos-mes');
    const elFinalizados = document.getElementById('jur-finalizados-mes');

    if (elTotal) elTotal.textContent = ativos.length;
    if (elRisco) elRisco.textContent = riscoAlto.length;
    if (elPrazos) elPrazos.textContent = 0;
    if (elFinalizados) elFinalizados.textContent = 0;
}

function renderizarGraficosProcessos(processos) {
    if (chartEvolucao) chartEvolucao.destroy();
    if (chartFinanceiro) chartFinanceiro.destroy();
    if (chartStatus) chartStatus.destroy();

    // 1. Gráfico de Status (Donut)
    const ctxStatus = document.getElementById('chart-jur-status');
    if (ctxStatus) {
        const counts = { Ativo: 0, Arquivado: 0, Suspenso: 0, Finalizado: 0 };
        processos.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
        
        chartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: ['#0d6efd', '#6c757d', '#ffc107', '#198754'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    }

    // 2. Gráfico Financeiro (Barras - Acordos)
    const ctxFinanceiro = document.getElementById('chart-jur-financeiro');
    if (ctxFinanceiro) {
        let totalPedido = 0, totalTeto = 0, totalFinal = 0;
        let qtdAcordos = 0;
        
        processos.forEach(p => {
            if (p.status === 'Finalizado' && p.encerramento?.resultado === 'Acordo') {
                totalPedido += (p.encerramento.valorPedido || 0);
                totalTeto += (p.encerramento.valorTeto || 0);
                totalFinal += (p.encerramento.valorFinal || 0);
                qtdAcordos++;
            }
        });
        
        // Se não houver acordos, mostra zerado
        chartFinanceiro = new Chart(ctxFinanceiro, {
            type: 'bar',
            data: {
                labels: ['Valores (Acordos)'],
                datasets: [
                    { label: 'Pedido (Autora)', data: [totalPedido], backgroundColor: '#dc3545', borderRadius: 4 },
                    { label: 'Teto (Direção)', data: [totalTeto], backgroundColor: '#ffc107', borderRadius: 4 },
                    { label: 'Fechado (Final)', data: [totalFinal], backgroundColor: '#198754', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: { callbacks: { label: function(context) { return 'R$ ' + context.raw.toLocaleString('pt-BR', {minimumFractionDigits: 2}); } } }
                },
                scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return 'R$ ' + value; } } } }
            }
        });
    }

    // 3. Gráfico de Evolução (Linha) - Distribuição vs Encerramento nos últimos 6 meses
    const ctxEvolucao = document.getElementById('chart-jur-evolucao');
    if (ctxEvolucao) {
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const hoje = new Date();
        const labels = [];
        const entradas = [0, 0, 0, 0, 0, 0];
        const saidas = [0, 0, 0, 0, 0, 0];
        
        // Prepara os últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            let d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            labels.push(mesesNomes[d.getMonth()] + '/' + d.getFullYear().toString().substring(2));
        }

        processos.forEach(p => {
            // Entrada
            if (p.dataDistribuicao) {
                try {
                    let data = p.dataDistribuicao.toDate ? p.dataDistribuicao.toDate() : new Date(p.dataDistribuicao + 'T12:00:00');
                    for (let i = 0; i < 6; i++) {
                        let ref = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
                        if (data.getMonth() === ref.getMonth() && data.getFullYear() === ref.getFullYear()) { entradas[i]++; }
                    }
                } catch(e) {}
            }
            // Saída
            if (p.status === 'Finalizado' && p.updatedAt) {
                try {
                    let data = p.updatedAt.toDate ? p.updatedAt.toDate() : new Date(); // Aproximação
                    for (let i = 0; i < 6; i++) {
                        let ref = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
                        if (data.getMonth() === ref.getMonth() && data.getFullYear() === ref.getFullYear()) { saidas[i]++; }
                    }
                } catch(e) {}
            }
        });

        chartEvolucao = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Entradas', data: entradas, borderColor: '#0d6efd', backgroundColor: '#0d6efd', tension: 0.3, fill: false },
                    { label: 'Finalizados', data: saidas, borderColor: '#198754', backgroundColor: '#198754', tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }
}

let __cacheFuncionariosHTML = null;

async function abrirModalProcesso(processoId = null) {
    const modalEl = document.getElementById('processoJuridicoModal');
    const modalTitle = document.getElementById('processoJuridicoModalTitle');
    const form = document.getElementById('form-processo-juridico');
    form.reset();
    document.getElementById('jur-processo-id').value = processoId || '';
    document.getElementById('jur-pedidos-container').innerHTML = '<p class="text-muted">Selecione um "Tipo de Ação" para ver os pedidos.</p>';
    document.getElementById('jur-historico-container').innerHTML = '<p class="text-muted">Nenhuma alteração registrada.</p>';

    // Resetar e popular select de funcionários (com cache e concatenação rápida)
    const funcionarioSelect = document.getElementById('jur-funcionario');
    if (!__cacheFuncionariosHTML) {
        funcionarioSelect.innerHTML = '<option value="">Carregando...</option>';
        try {
            const funcSnap = await db.collection('funcionarios').orderBy('nome').get();
            let html = '<option value="">Selecione um funcionário/reclamante</option>';
            funcSnap.forEach(doc => {
                const nome = doc.data().nome;
                html += `<option value="${nome}">${nome}</option>`;
            });
            __cacheFuncionariosHTML = html;
        } catch (e) {
            console.error("Erro ao carregar funcionários", e);
            funcionarioSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    
    // Aplica o HTML otimizado de uma vez
    if (__cacheFuncionariosHTML) {
        funcionarioSelect.innerHTML = __cacheFuncionariosHTML;
    }

    if (processoId) {
        modalTitle.textContent = 'Editar Processo';
        const doc = await db.collection('processos_juridicos').doc(processoId).get();
        if (doc.exists) {
            const data = doc.data();
            window.__processo_original = data; // Salva os dados originais para o log

            document.getElementById('jur-numero-processo').value = data.numeroProcesso;
            document.getElementById('jur-data-distribuicao').value = formatarDataParaInput(data.dataDistribuicao);
            
            // Tratamento para garantir compatibilidade com registros antigos
            let funcNome = data.funcionarioNome || data.cliente || '';
            const funcSelect = document.getElementById('jur-funcionario');
            
            // Se o nome não existir no select (mesmo com cache), adiciona ele
            if (funcNome && !__cacheFuncionariosHTML.includes(`value="${funcNome}"`)) {
                funcSelect.innerHTML += `<option value="${funcNome}">${funcNome} (Histórico)</option>`;
            }
            funcSelect.value = funcNome;
            document.getElementById('jur-escritorio').value = data.escritorio || data.parteContraria || '';
            
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
            
            // Preenche a aba Encerramento
            document.getElementById('jur-resultado-processo').value = data.encerramento?.resultado || '';
            document.getElementById('jur-valor-pedido-acordo').value = data.encerramento?.valorPedido || '';
            document.getElementById('jur-valor-teto-acordo').value = data.encerramento?.valorTeto || '';
            document.getElementById('jur-valor-final-acordo').value = data.encerramento?.valorFinal || '';
            document.getElementById('jur-obs-encerramento').value = data.encerramento?.observacoes || '';


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

    // Atualizar visibilidade das abas de acordo e status
    toggleAbaEncerramento();
    toggleValoresEncerramento();

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
        const valorInput = document.getElementById(`valor-${pedidoId}`);
        pedidos.push({
            pedido: chk.value,
            valor: parseFloat(valorInput.value.replace(',', '.')) || 0,
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
        funcionarioNome: document.getElementById('jur-funcionario').value,
        cliente: document.getElementById('jur-funcionario').value, // Compatibilidade com dados antigos
        escritorio: document.getElementById('jur-escritorio').value,
        parteContraria: document.getElementById('jur-escritorio').value, // Compatibilidade
        tipoAcao: document.getElementById('jur-tipo-acao').value,
        status: document.getElementById('jur-status').value,
        descricao: document.getElementById('jur-descricao').value.trim(),
        valorCausa: parseFloat(document.getElementById('jur-valor-causa').value.replace(',', '.')) || 0,
        dataConciliacao: document.getElementById('jur-data-conciliacao').value ? new Date(document.getElementById('jur-data-conciliacao').value) : null,
        dataInstrucao: document.getElementById('jur-data-instrucao').value ? new Date(document.getElementById('jur-data-instrucao').value) : null,
        pedidos: pedidos,
        riscoGeral: riscoGeral,
        analise: {
            pontos: document.getElementById('jur-analise-pontos').value.trim(),
            testemunhas: document.getElementById('jur-analise-testemunhas').value.trim(),
            documentos: document.getElementById('jur-analise-documentos').value.trim()
        },
        encerramento: {
            resultado: document.getElementById('jur-resultado-processo').value,
            valorPedido: parseFloat(document.getElementById('jur-valor-pedido-acordo').value.replace(',', '.')) || 0,
            valorTeto: parseFloat(document.getElementById('jur-valor-teto-acordo').value.replace(',', '.')) || 0,
            valorFinal: parseFloat(document.getElementById('jur-valor-final-acordo').value.replace(',', '.')) || 0,
            observacoes: document.getElementById('jur-obs-encerramento').value.trim()
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.numeroProcesso || !dados.funcionarioNome || !dados.tipoAcao) {
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
            await syncAgendaJuridica(processoId, dados);
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('processos_juridicos').add(dados);
            mostrarMensagem("Processo cadastrado com sucesso!", "success");
            const log = { alteracao: 'Processo criado.', usuario: firebase.auth().currentUser.email, data: new Date() };
            await db.collection('processos_juridicos').doc(docRef.id).collection('historico').add(log);
            await syncAgendaJuridica(docRef.id, dados);
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
        
        // Excluir também da agenda
        const snap = await db.collection('agenda_atividades').where('referenciaId', '==', processoId).get();
        const batch = db.batch();
        snap.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        mostrarMensagem("Processo excluído com sucesso.", "success");
        await carregarProcessosJuridicos();
    } catch (error) {
        console.error("Erro ao excluir processo:", error);
        mostrarMensagem("Falha ao excluir o processo.", "error");
    }
}

async function syncAgendaJuridica(processoId, dadosProcesso) {
    try {
        const userId = firebase.auth().currentUser.uid;
        const userNome = firebase.auth().currentUser.displayName || firebase.auth().currentUser.email;
        
        const syncEvento = async (tipo, dataEvento) => {
            const snap = await db.collection('agenda_atividades')
                                 .where('moduloOrigem', '==', 'Jurídico')
                                 .where('referenciaId', '==', processoId)
                                 .where('tipoEvento', '==', tipo)
                                 .get();
                                 
            if (dataEvento) {
                const eventoData = {
                    titulo: `${tipo} - Processo ${dadosProcesso.numeroProcesso}`,
                    descricao: `Processo Trabalhista / Cível: ${dadosProcesso.numeroProcesso}\\nReclamante/Autor: ${dadosProcesso.funcionarioNome}`,
                    data: dataEvento,
                    status: 'Pendente',
                    moduloOrigem: 'Jurídico',
                    referenciaId: processoId,
                    tipoEvento: tipo,
                    atribuidoParaId: userId,
                    atribuidoParaNome: userNome,
                    criadoPor: userId,
                    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (snap.empty) {
                    await db.collection('agenda_atividades').add(eventoData);
                } else {
                    await db.collection('agenda_atividades').doc(snap.docs[0].id).update(eventoData);
                }
            } else {
                if (!snap.empty) {
                    await db.collection('agenda_atividades').doc(snap.docs[0].id).delete();
                }
            }
        };
        
        await syncEvento('Audiência Conciliação', dadosProcesso.dataConciliacao);
        await syncEvento('Audiência Instrução', dadosProcesso.dataInstrucao);
        
    } catch (error) {
        console.error("Erro ao sincronizar com agenda:", error);
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
                        ${processo.pedidos?.map(p => `<tr><td>${p.pedido}</td><td>${p.risco}</td><td>R$ ${(p.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td><span class="badge bg-warning text-dark">${p.risco}</span></td></tr>`).join('') || '<tr><td colspan="4">Nenhum pedido informado.</td></tr>'}
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
                <p>A estimativa de perda total para este processo é de <strong>R$ ${(processo.valorCausa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>, com um risco geral de <strong>${processo.riscoGeral}</strong>.</p>
            `;
        }, 1500); // Simula o tempo de processamento da IA
    } catch (error) {
        console.error("Erro ao carregar dados para análise de risco:", error);
        modalBody.innerHTML = '<p class="text-danger">Ocorreu um erro ao carregar os dados do processo.</p>';
    }
}

/**
 * Abre um modal com uma visualização compacta dos detalhes do processo.
 * @param {string} processoId O ID do processo no Firestore.
 */
async function visualizarProcessoCompacto(processoId) {
    try {
        const doc = await db.collection('processos_juridicos').doc(processoId).get();
        if (!doc.exists) {
            mostrarMensagem("Processo não encontrado.", "error");
            return;
        }
        const proc = doc.data();

        const getRiskClass = (risco) => {
            switch (risco) {
                case 'Alto': return 'bg-danger';
                case 'Médio': return 'bg-warning text-dark';
                case 'Baixo': return 'bg-success';
                default: return 'bg-secondary';
            }
        };

        const getStatusClass = (status) => {
            switch (status) {
                case 'Ativo': return 'bg-primary';
                case 'Finalizado': return 'bg-success';
                default: return 'bg-secondary';
            }
        };

        let corpoModal = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <small class="text-muted">Nº do Processo</small>
                    <p class="fw-bold fs-5 mb-0">${proc.numeroProcesso || 'Não informado'}</p>
                </div>
                <div class="text-end">
                    <small class="text-muted d-block">Status Atual</small>
                    <span class="badge ${getStatusClass(proc.status)} fs-6">${proc.status || 'N/A'}</span>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3"><small class="text-muted">Reclamante / Autor</small><p>${proc.funcionarioNome || proc.cliente || 'N/A'}</p></div>
                <div class="col-md-6 mb-3"><small class="text-muted">Escritório / Advogado</small><p>${proc.escritorio || proc.parteContraria || 'N/A'}</p></div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3"><small class="text-muted">Tipo de Ação</small><p><span class="badge bg-info text-dark">${proc.tipoAcao || 'N/A'}</span></p></div>
                <div class="col-md-6 mb-3"><small class="text-muted">Risco Geral</small><p><span class="badge ${getRiskClass(proc.riscoGeral)}">${proc.riscoGeral || 'N/A'}</span></p></div>
            </div>
            <hr>
            <h6>Objeto da Ação</h6>
            <p>${proc.descricao || 'Não informado'}</p>
            <h6>Pedidos</h6>
        `;

        if (proc.pedidos && proc.pedidos.length > 0) {
            corpoModal += '<ul class="list-group list-group-flush">';
            proc.pedidos.forEach(p => {
                corpoModal += `<li class="list-group-item d-flex justify-content-between align-items-center">
                                ${p.pedido}
                                <span class="badge bg-primary rounded-pill">R$ ${(p.valor || 0).toFixed(2)}</span>
                               </li>`;
            });
            corpoModal += '</ul>';
        } else {
            corpoModal += '<p class="text-muted">Nenhum pedido registrado.</p>';
        }

        corpoModal += `<h6 class="mt-3">Valor Total da Causa</h6><p class="fs-5 fw-bold text-success">R$ ${(proc.valorCausa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>`;

        abrirModalGenerico(`Resumo do Processo: ${proc.numeroProcesso}`, corpoModal);

    } catch (error) {
        console.error("Erro ao visualizar processo:", error);
        mostrarMensagem("Falha ao carregar detalhes do processo.", "error");
    }
}

function imprimirAnaliseRisco() {
    mostrarMensagem("Funcionalidade de impressão do relatório de análise será implementada em breve.", "info");
}