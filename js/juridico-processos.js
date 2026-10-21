// ========================================
// Módulo: Jurídico - Gestão de Processos
// ========================================

const PEDIDOS_POR_TIPO_ACAO = {
    'Trabalhista': [
        'Saldo de Salário',
        'Aviso Prévio',
        'Férias Proporcionais',
        '13º Salário Proporcional',
        'Multa 40%',
        'Seguro Desemprego Substitutivo',
        'Férias Vencidas',
        '13º Salário Vencido',
        'Multa Artigo 477',
        'FGTS em Atraso',
        'Consignado em Atraso',
        'Horas Extras',
        'Insalubridade',
        'Periculosidade',
        'Desvio de Função',
        'Assédio Moral',
        'Dano Moral',
        'Verbas Rescisórias',
        'Salário por Fora',
        'Honorários Advocatícios',
        'Outros'
    ],
    'Cível': [
        'Indenização por Danos Materiais',
        'Indenização por Danos Morais',
        'Obrigação de Fazer',
        'Revisão de Contrato',
        'Busca e Apreensão',
        'Cobrança / Execução',
        'Outros'
    ],
    'Consumidor': [
        'Produto com Defeito',
        'Cobrança Indevida',
        'Publicidade Enganosa',
        'Direito de Arrependimento',
        'Danos Morais',
        'Outros'
    ],
    'Tributário': [
        'Repetição de Indébito',
        'Mandado de Segurança',
        'Execução Fiscal',
        'Anulação de Débito Fiscal',
        'Outros'
    ]
};

function gerarIdPedido(pedido) {
    if (!pedido) return 'ped_' + Math.random().toString(36).substr(2, 6);
    return 'ped_' + String(pedido)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
}

function parseValorMonetario(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (!s) return 0;
    s = s.replace(/R\$\s?/gi, '').trim();
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Converte valores variados (Timestamp Firestore, { seconds }, Date, string) com segurança para Date
function converterParaDate(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    if (typeof valor.toDate === 'function') {
        try {
            const d = valor.toDate();
            if (d instanceof Date && !isNaN(d.getTime())) return d;
        } catch (e) {}
    }
    if (valor.seconds !== undefined && typeof valor.seconds === 'number') {
        return new Date(valor.seconds * 1000);
    }
    if (typeof valor === 'string' || typeof valor === 'number') {
        try {
            const d = new Date(valor);
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Formata data e hora no padrão brasileiro (DD/MM/AAAA às HH:MM ou apenas DD/MM/AAAA)
function formatarDataHoraBR(valor) {
    const d = converterParaDate(valor);
    if (!d) return '-';
    const dataStr = d.toLocaleDateString('pt-BR');
    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');
    if (horas !== '00' || minutos !== '00') {
        return `${dataStr} às ${horas}:${minutos}`;
    }
    return dataStr;
}

// Gera o HTML da coluna "Próx. Audiência/Prazo" com suporte a Conciliação e Instrução
function formatarPrazoAudienciaTabela(proc) {
    const dConc = converterParaDate(proc.dataConciliacao);
    const dInst = converterParaDate(proc.dataInstrucao);
    const dAud = converterParaDate(proc.dataAudiencia);

    if (!dConc && !dInst && !dAud) {
        return `<span class="badge border border-secondary text-secondary bg-white"><i class="far fa-calendar-alt me-1"></i> Sem prazo</span>`;
    }

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);

    // Se possui tanto Conciliação quanto Instrução
    if (dConc && dInst) {
        const concPassou = dConc < hoje;
        const instPassou = dInst < hoje;
        return `
            <div class="d-flex flex-column gap-1" style="min-width: 175px;">
                <span class="badge ${concPassou ? 'bg-light text-muted border text-decoration-line-through' : 'border border-primary text-primary bg-white'} text-start" title="Audiência de Conciliação ${concPassou ? '(Realizada)' : '(Agendada)'}">
                    <i class="fas fa-handshake me-1 ${concPassou ? 'text-muted' : 'text-primary'}"></i> Conc: ${formatarDataHoraBR(dConc)}
                </span>
                <span class="badge ${instPassou ? 'bg-light text-muted border text-decoration-line-through' : 'bg-primary text-white shadow-sm'} text-start" title="Audiência de Instrução ${instPassou ? '(Realizada)' : '(Agendada)'}">
                    <i class="fas fa-gavel me-1 ${instPassou ? 'text-muted' : 'text-warning'}"></i> Inst: ${formatarDataHoraBR(dInst)}
                </span>
            </div>
        `;
    }

    // Se possui apenas Audiência de Instrução
    if (dInst) {
        const instPassou = dInst < hoje;
        return `
            <span class="badge ${instPassou ? 'bg-light text-muted border text-decoration-line-through' : 'bg-primary text-white shadow-sm'}" title="Audiência de Instrução ${instPassou ? '(Realizada)' : '(Agendada)'}">
                <i class="fas fa-gavel me-1 ${instPassou ? 'text-muted' : 'text-warning'}"></i> Inst: ${formatarDataHoraBR(dInst)}
            </span>
        `;
    }

    // Se possui apenas Audiência de Conciliação
    if (dConc) {
        const concPassou = dConc < hoje;
        return `
            <span class="badge ${concPassou ? 'bg-light text-muted border text-decoration-line-through' : 'border border-primary text-primary bg-white'}" title="Audiência de Conciliação ${concPassou ? '(Realizada)' : '(Agendada)'}">
                <i class="fas fa-handshake me-1 ${concPassou ? 'text-muted' : 'text-primary'}"></i> Conc: ${formatarDataHoraBR(dConc)}
            </span>
        `;
    }

    // Fallback para audiência legada
    if (dAud) {
        const audPassou = dAud < hoje;
        return `
            <span class="badge ${audPassou ? 'bg-light text-muted border' : 'bg-info text-dark shadow-sm'}" title="Audiência ${audPassou ? '(Realizada)' : '(Agendada)'}">
                <i class="far fa-calendar-alt me-1"></i> ${formatarDataHoraBR(dAud)}
            </span>
        `;
    }
}

// Instâncias dos gráficos
let chartEvolucao = null;
let chartFinanceiro = null;
let chartStatus = null;

async function inicializarGestaoProcessos() {
    await carregarProcessosJuridicos();
    document.getElementById('jur-tipo-acao')?.addEventListener('change', () => {
        atualizarCampoAutorPorTipoAcao();
        atualizarPedidosDoProcesso();
    });
    document.getElementById('btn-filtrar-processos')?.addEventListener('click', carregarProcessosJuridicos);
    document.getElementById('jur-busca-processo')?.addEventListener('input', carregarProcessosJuridicos);
    document.getElementById('jur-pedidos-container')?.addEventListener('input', calcularValorCausaAutomatico);
    document.getElementById('jur-pedidos-container')?.addEventListener('change', calcularValorCausaAutomatico);
    
    document.getElementById('jur-status')?.addEventListener('change', toggleAbaEncerramento);
    document.getElementById('jur-resultado-processo')?.addEventListener('change', toggleValoresEncerramento);
}

function atualizarCampoAutorPorTipoAcao() {
    const tipoAcao = document.getElementById('jur-tipo-acao')?.value || '';
    const containerSelect = document.getElementById('container-jur-funcionario-select');
    const containerTexto = document.getElementById('container-jur-autor-texto');
    const selectFunc = document.getElementById('jur-funcionario');
    const inputTexto = document.getElementById('jur-autor-texto');

    const isTrabalhista = (tipoAcao === 'Trabalhista');

    if (isTrabalhista) {
        if (containerSelect) containerSelect.style.display = 'block';
        if (containerTexto) containerTexto.style.display = 'none';
        if (selectFunc) selectFunc.required = true;
        if (inputTexto) {
            inputTexto.required = false;
            if (inputTexto.value && selectFunc && !selectFunc.value) {
                const optMatch = Array.from(selectFunc.options).find(opt => opt.value.toLowerCase() === inputTexto.value.toLowerCase());
                if (optMatch) selectFunc.value = optMatch.value;
            }
        }
    } else {
        if (containerSelect) containerSelect.style.display = 'none';
        if (containerTexto) containerTexto.style.display = 'block';
        if (selectFunc) selectFunc.required = false;
        if (inputTexto) {
            inputTexto.required = true;
            if (selectFunc && selectFunc.value && !inputTexto.value) {
                inputTexto.value = selectFunc.value;
            }
        }
    }
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
    const tipoAcao = document.getElementById('jur-tipo-acao')?.value || '';
    const container = document.getElementById('jur-pedidos-container');
    if (!container) return;

    const pedidos = PEDIDOS_POR_TIPO_ACAO[tipoAcao] || [];

    if (pedidos.length === 0) {
        container.innerHTML = '<div class="alert alert-light border text-center text-muted py-3">Selecione um "Tipo de Ação" para carregar as opções de pedidos e análise de risco.</div>';
        const valorCausaEl = document.getElementById('jur-valor-causa');
        if (valorCausaEl) valorCausaEl.value = '';
        return;
    }

    let html = `
        <div class="card border-0 bg-light mb-3 p-3 shadow-sm rounded-3">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div class="d-flex align-items-center gap-3 flex-wrap">
                    <div>
                        <span class="text-muted small d-block">Soma Total dos Pedidos:</span>
                        <span class="fs-5 fw-bold text-success" id="jur-pedidos-soma-display">R$ 0,00</span>
                    </div>
                    <div class="border-start ps-3">
                        <span class="text-muted small d-block">Pedidos Ativos:</span>
                        <span class="badge bg-primary fs-6" id="jur-pedidos-qtd-badge">0 verba(s)</span>
                    </div>
                    <div class="border-start ps-3">
                        <span class="text-muted small d-block">Risco Consolidado:</span>
                        <span class="badge bg-secondary fs-6" id="jur-pedidos-risco-badge">Baixo</span>
                    </div>
                </div>
                <div class="d-flex gap-1">
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="marcarTodosPedidos(true)" title="Selecionar todos">
                        <i class="far fa-check-square me-1"></i> Todos
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="marcarTodosPedidos(false)" title="Limpar seleção">
                        <i class="far fa-square me-1"></i> Limpar
                    </button>
                </div>
            </div>
        </div>

        <div class="table-responsive border rounded-3 bg-white" style="max-height: 480px; overflow-y: auto;">
            <table class="table table-hover align-middle mb-0" style="font-size: 0.88rem;">
                <thead class="table-light sticky-top shadow-sm" style="z-index: 2;">
                    <tr>
                        <th style="width: 34%;">Verba / Pedido Reclamado</th>
                        <th style="width: 26%;">Valor Estimado / Pleiteado</th>
                        <th style="width: 20%;">Risco de Perda</th>
                        <th style="width: 20%;">Robustez da Prova</th>
                    </tr>
                </thead>
                <tbody id="jur-pedidos-tbody">
    `;

    pedidos.forEach(pedido => {
        const id = gerarIdPedido(pedido);
        html += `
            <tr id="row-${id}" class="pedido-row transition-all">
                <td>
                    <div class="form-check m-0">
                        <input class="form-check-input pedido-checkbox" type="checkbox" value="${pedido}" id="pedido-${id}" onchange="aoAlternarCheckboxPedido('${id}')">
                        <label class="form-check-label fw-semibold text-dark user-select-none cursor-pointer" for="pedido-${id}">
                            ${pedido}
                        </label>
                    </div>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-light text-muted">R$</span>
                        <input type="text" inputmode="decimal" class="form-control valor-pedido" id="valor-${id}" placeholder="0,00" oninput="aoDigitarValorPedido('${id}')">
                    </div>
                </td>
                <td>
                    <select class="form-select form-select-sm risco-pedido" id="risco-${id}" onchange="calcularValorCausaAutomatico()">
                        <option value="Baixo">Baixo (Remoto)</option>
                        <option value="Médio" selected>Médio (Possível)</option>
                        <option value="Alto">Alto (Provável)</option>
                    </select>
                </td>
                <td>
                    <select class="form-select form-select-sm avaliacao-prova" id="avaliacao-${id}" title="Avaliação da Prova pela Empresa" onchange="calcularValorCausaAutomatico()">
                        <option value="Ruim">Prova Fraca / Ruim</option>
                        <option value="Media" selected>Prova Razoável</option>
                        <option value="Boa">Prova Robusta / Boa</option>
                    </select>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-2 px-1">
            <small class="text-muted"><i class="fas fa-info-circle me-1"></i> Digitar um valor marca automaticamente o pedido correspondente.</small>
            <button type="button" class="btn btn-sm btn-link text-decoration-none" onclick="solicitarAdicionarPedidoCustomizado()">
                <i class="fas fa-plus me-1"></i> Adicionar outra verba
            </button>
        </div>
    `;

    container.innerHTML = html;
    calcularValorCausaAutomatico();
}

function aoAlternarCheckboxPedido(id) {
    const chk = document.getElementById(`pedido-${id}`);
    const row = document.getElementById(`row-${id}`);
    const valorInput = document.getElementById(`valor-${id}`);
    if (chk && row) {
        if (chk.checked) {
            row.style.backgroundColor = '#f0fdf4';
            if (valorInput && !valorInput.value) {
                valorInput.focus();
            }
        } else {
            row.style.backgroundColor = '';
        }
    }
    calcularValorCausaAutomatico();
}

function aoDigitarValorPedido(id) {
    const chk = document.getElementById(`pedido-${id}`);
    const row = document.getElementById(`row-${id}`);
    const valorInput = document.getElementById(`valor-${id}`);
    if (valorInput && valorInput.value.trim() !== '') {
        const val = parseValorMonetario(valorInput.value);
        if (val > 0 && chk && !chk.checked) {
            chk.checked = true;
            if (row) row.style.backgroundColor = '#f0fdf4';
        }
    }
    calcularValorCausaAutomatico();
}

function marcarTodosPedidos(marcar) {
    const container = document.getElementById('jur-pedidos-container');
    if (!container) return;
    container.querySelectorAll('.pedido-checkbox').forEach(chk => {
        chk.checked = marcar;
        const row = chk.closest('tr');
        if (row) row.style.backgroundColor = marcar ? '#f0fdf4' : '';
    });
    calcularValorCausaAutomatico();
}

function solicitarAdicionarPedidoCustomizado() {
    const nome = prompt("Digite o nome da verba ou pedido a ser incluído:");
    if (!nome || !nome.trim()) return;
    adicionarLinhaPedidoCustomizado(nome.trim(), true);
}

function adicionarLinhaPedidoCustomizado(pedidoNome, focar = false) {
    const tbody = document.getElementById('jur-pedidos-tbody');
    if (!tbody) return;
    const id = gerarIdPedido(pedidoNome);
    if (document.getElementById(`pedido-${id}`)) return;

    const tr = document.createElement('tr');
    tr.id = `row-${id}`;
    tr.className = 'pedido-row transition-all';
    tr.style.backgroundColor = '#f0fdf4';
    tr.innerHTML = `
        <td>
            <div class="form-check m-0">
                <input class="form-check-input pedido-checkbox" type="checkbox" value="${pedidoNome}" id="pedido-${id}" checked onchange="aoAlternarCheckboxPedido('${id}')">
                <label class="form-check-label fw-semibold text-primary user-select-none cursor-pointer" for="pedido-${id}">
                    ${pedidoNome} <span class="badge bg-light text-secondary border small">Personalizado</span>
                </label>
            </div>
        </td>
        <td>
            <div class="input-group input-group-sm">
                <span class="input-group-text bg-light text-muted">R$</span>
                <input type="text" inputmode="decimal" class="form-control valor-pedido" id="valor-${id}" placeholder="0,00" oninput="aoDigitarValorPedido('${id}')">
            </div>
        </td>
        <td>
            <select class="form-select form-select-sm risco-pedido" id="risco-${id}" onchange="calcularValorCausaAutomatico()">
                <option value="Baixo">Baixo (Remoto)</option>
                <option value="Médio" selected>Médio (Possível)</option>
                <option value="Alto">Alto (Provável)</option>
            </select>
        </td>
        <td>
            <select class="form-select form-select-sm avaliacao-prova" id="avaliacao-${id}" title="Avaliação da Prova pela Empresa" onchange="calcularValorCausaAutomatico()">
                <option value="Ruim">Prova Fraca / Ruim</option>
                <option value="Media" selected>Prova Razoável</option>
                <option value="Boa">Prova Robusta / Boa</option>
            </select>
        </td>
    `;
    tbody.appendChild(tr);
    calcularValorCausaAutomatico();
    if (focar) {
        document.getElementById(`valor-${id}`)?.focus();
    }
}

function calcularValorCausaAutomatico() {
    const container = document.getElementById('jur-pedidos-container');
    if (!container) return;
    
    let valorTotal = 0;
    let qtdSelecionados = 0;
    let temRiscoAlto = false;
    let temRiscoMedio = false;

    container.querySelectorAll('.pedido-checkbox').forEach(chk => {
        const id = chk.id.replace('pedido-', '');
        const row = document.getElementById(`row-${id}`);
        const valorInput = document.getElementById(`valor-${id}`);
        const riscoSelect = document.getElementById(`risco-${id}`);
        const avaliacaoSelect = document.getElementById(`avaliacao-${id}`);

        if (chk.checked) {
            qtdSelecionados++;
            if (row) row.style.backgroundColor = '#f0fdf4';
            if (valorInput && valorInput.value) {
                const val = parseValorMonetario(valorInput.value);
                valorTotal += val;
            }
            const risco = riscoSelect?.value || 'Médio';
            const prova = avaliacaoSelect?.value || 'Media';
            if (risco === 'Alto' || (risco === 'Médio' && prova === 'Ruim')) {
                temRiscoAlto = true;
            } else if (risco === 'Médio') {
                temRiscoMedio = true;
            }
        } else {
            if (row) row.style.backgroundColor = '';
        }
    });

    const valorCausaEl = document.getElementById('jur-valor-causa');
    if (valorCausaEl) {
        valorCausaEl.value = valorTotal > 0 ? valorTotal.toFixed(2) : '';
    }

    const somaDisplay = document.getElementById('jur-pedidos-soma-display');
    if (somaDisplay) {
        somaDisplay.textContent = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    const qtdBadge = document.getElementById('jur-pedidos-qtd-badge');
    if (qtdBadge) {
        qtdBadge.textContent = `${qtdSelecionados} verba(s)`;
    }

    const riscoBadge = document.getElementById('jur-pedidos-risco-badge');
    if (riscoBadge) {
        if (temRiscoAlto) {
            riscoBadge.textContent = 'Alto';
            riscoBadge.className = 'badge bg-danger fs-6';
        } else if (temRiscoMedio) {
            riscoBadge.textContent = 'Médio';
            riscoBadge.className = 'badge bg-warning text-dark fs-6';
        } else {
            riscoBadge.textContent = 'Baixo';
            riscoBadge.className = 'badge bg-success fs-6';
        }
    }
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
        const termoBusca = (document.getElementById('jur-busca-processo')?.value || '').toLowerCase().trim();
        let processosFiltrados = processos;
        if (termoBusca) {
            processosFiltrados = processos.filter(proc => {
                const num = (proc.numeroProcesso || '').toLowerCase();
                const autor = (proc.funcionarioNome || proc.cliente || proc.autor || '').toLowerCase();
                const esc = (proc.escritorio || proc.parteContraria || '').toLowerCase();
                return num.includes(termoBusca) || autor.includes(termoBusca) || esc.includes(termoBusca);
            });
        }
        
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
                        <div class="fw-bold">${proc.funcionarioNome || proc.cliente || proc.autor || '-'}</div>
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
                        ${formatarPrazoAudienciaTabela(proc)}
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

    // Limpar explicitamente campos das abas que ficam fora do form-processo-juridico
    const elDataConc = document.getElementById('jur-data-conciliacao');
    if (elDataConc) elDataConc.value = '';
    const elDataInst = document.getElementById('jur-data-instrucao');
    if (elDataInst) elDataInst.value = '';

    const elAnalisePontos = document.getElementById('jur-analise-pontos');
    if (elAnalisePontos) elAnalisePontos.value = '';
    const elAnaliseTestemunhas = document.getElementById('jur-analise-testemunhas');
    if (elAnaliseTestemunhas) elAnaliseTestemunhas.value = '';
    const elAnaliseDocumentos = document.getElementById('jur-analise-documentos');
    if (elAnaliseDocumentos) elAnaliseDocumentos.value = '';

    const elResultado = document.getElementById('jur-resultado-processo');
    if (elResultado) elResultado.value = '';
    const elValorPedido = document.getElementById('jur-valor-pedido-acordo');
    if (elValorPedido) elValorPedido.value = '';
    const elValorTeto = document.getElementById('jur-valor-teto-acordo');
    if (elValorTeto) elValorTeto.value = '';
    const elValorFinal = document.getElementById('jur-valor-final-acordo');
    if (elValorFinal) elValorFinal.value = '';
    const elObs = document.getElementById('jur-obs-encerramento');
    if (elObs) elObs.value = '';

    // Limpar campo de autor em texto livre
    const inputTexto = document.getElementById('jur-autor-texto');
    if (inputTexto) inputTexto.value = '';

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

            document.getElementById('jur-numero-processo').value = data.numeroProcesso || '';
            document.getElementById('jur-data-distribuicao').value = formatarDataParaInput(data.dataDistribuicao);
            
            const tipoAcao = data.tipoAcao || 'Trabalhista';
            document.getElementById('jur-tipo-acao').value = tipoAcao;
            atualizarCampoAutorPorTipoAcao();

            // Tratamento para garantir compatibilidade com registros antigos
            let autorNome = data.funcionarioNome || data.cliente || data.autor || '';
            
            if (tipoAcao === 'Trabalhista') {
                const funcSelect = document.getElementById('jur-funcionario');
                // Se o nome não existir no select (mesmo com cache), adiciona ele
                if (autorNome && !__cacheFuncionariosHTML.includes(`value="${autorNome}"`)) {
                    funcSelect.innerHTML += `<option value="${autorNome}">${autorNome} (Histórico)</option>`;
                }
                funcSelect.value = autorNome;
                if (inputTexto) inputTexto.value = '';
            } else {
                if (inputTexto) inputTexto.value = autorNome;
                if (funcionarioSelect) funcionarioSelect.value = '';
            }
            document.getElementById('jur-escritorio').value = data.escritorio || data.parteContraria || '';
            
            document.getElementById('jur-status').value = data.status || 'Ativo';
            document.getElementById('jur-descricao').value = data.descricao || '';
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
                    if (!p.pedido) return;
                    let id = gerarIdPedido(p.pedido);
                    let chk = document.getElementById(`pedido-${id}`);
                    if (!chk) {
                        adicionarLinhaPedidoCustomizado(p.pedido);
                        id = gerarIdPedido(p.pedido);
                        chk = document.getElementById(`pedido-${id}`);
                    }
                    if (chk) chk.checked = true;
                    const val = document.getElementById(`valor-${id}`);
                    if (val && p.valor !== undefined && p.valor !== null && p.valor !== '') {
                        val.value = Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    const rsk = document.getElementById(`risco-${id}`);
                    if (rsk && p.risco) rsk.value = p.risco;
                    const avl = document.getElementById(`avaliacao-${id}`);
                    if (avl && p.avaliacaoProva) avl.value = p.avaliacaoProva;
                });
            }
            calcularValorCausaAutomatico();

            // Carrega o histórico
            carregarHistoricoProcesso(processoId);
        }
    } else {
        modalTitle.textContent = 'Novo Processo';
        window.__processo_original = null;
        document.getElementById('jur-tipo-acao').value = 'Trabalhista';
        atualizarCampoAutorPorTipoAcao();
        atualizarPedidosDoProcesso();
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
    container.querySelectorAll('.pedido-checkbox:checked').forEach(chk => {
        const pedidoNome = chk.value;
        const id = gerarIdPedido(pedidoNome);
        const valorInput = document.getElementById(`valor-${id}`);
        const riscoSelect = document.getElementById(`risco-${id}`);
        const avaliacaoSelect = document.getElementById(`avaliacao-${id}`);
        pedidos.push({
            pedido: pedidoNome,
            valor: parseValorMonetario(valorInput?.value),
            risco: riscoSelect?.value || 'Médio',
            avaliacaoProva: avaliacaoSelect?.value || 'Media'
        });
    });

    // Calcular risco geral
    let riscoGeral = 'Baixo';
    // O risco geral sobe para 'Alto' se algum pedido tiver risco 'Alto' OU se tiver risco 'Médio' com prova 'Ruim'
    if (pedidos.some(p => p.risco === 'Alto' || (p.risco === 'Médio' && p.avaliacaoProva === 'Ruim'))) riscoGeral = 'Alto';
    else if (pedidos.some(p => p.risco === 'Médio')) riscoGeral = 'Médio';

    // Determina o nome do autor (selecionado do dropdown se Trabalhista, ou texto livre se Cível/Outro)
    const tipoAcao = document.getElementById('jur-tipo-acao')?.value || '';
    const autorNome = (tipoAcao === 'Trabalhista' 
        ? document.getElementById('jur-funcionario')?.value 
        : document.getElementById('jur-autor-texto')?.value) || '';

    const dados = {
        numeroProcesso: document.getElementById('jur-numero-processo').value.trim(),
        dataDistribuicao: new Date(document.getElementById('jur-data-distribuicao').value.replace(/-/g, '\/')),
        funcionarioNome: autorNome.trim(),
        cliente: autorNome.trim(), // Compatibilidade com dados antigos
        autor: autorNome.trim(),
        escritorio: document.getElementById('jur-escritorio').value.trim(),
        parteContraria: document.getElementById('jur-escritorio').value.trim(), // Compatibilidade
        tipoAcao: tipoAcao,
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

    if (!dados.numeroProcesso) {
        mostrarMensagem("Informe o número do processo.", "warning");
        return;
    }
    if (!dados.tipoAcao) {
        mostrarMensagem("Selecione o tipo de ação.", "warning");
        return;
    }
    if (!dados.funcionarioNome) {
        mostrarMensagem(tipoAcao === 'Trabalhista' ? "Selecione o funcionário autor / reclamante." : "Informe o nome do autor / requerente.", "warning");
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
            const usuarioEmail = firebase.auth().currentUser?.email || 'Sistema';
            const log = { alteracao: 'Processo criado.', usuario: usuarioEmail, data: new Date() };
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
        const user = firebase.auth().currentUser;
        const userId = user ? user.uid : 'sistema';
        const userNome = user ? (user.displayName || user.email || 'Sistema') : 'Sistema';
        
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
        parteContraria: 'Parte contrária',
        funcionarioNome: 'Reclamante / Autor',
        tipoAcao: 'Tipo de ação'
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
        const dAntiga = converterParaDate(dadosAntigos[campo]);
        const dNova = converterParaDate(dadosNovos[campo]);
        const tAntiga = dAntiga ? Math.floor(dAntiga.getTime() / 1000) : null;
        const tNova = dNova ? Math.floor(dNova.getTime() / 1000) : null;
        if (tAntiga !== tNova) {
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
    const data = converterParaDate(timestamp);
    if (!data) return '';
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
    try {
        const modalEl = document.getElementById('analiseRiscoModal');
        const modalBody = document.getElementById('analise-risco-modal-body');
        const modal = new bootstrap.Modal(modalEl);
        
        modalBody.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-robot fa-bounce fa-3x mb-3 text-primary"></i>
                <h5 class="fw-bold text-dark">Jarvis está analisando o processo...</h5>
                <p class="text-muted">Examinando os pedidos, cruzando verbas com a robustez probatória e aplicando diretrizes da CLT/TST.</p>
            </div>`;
        modal.show();

        const processoDoc = await db.collection('processos_juridicos').doc(processoId).get();
        if (!processoDoc.exists) {
            modalBody.innerHTML = '<div class="alert alert-danger">Processo não encontrado.</div>';
            return;
        }
        const proc = processoDoc.data();
        await executarParecerJarvis(proc, modalBody);
    } catch (error) {
        console.error("Erro ao abrir análise de risco do Jarvis:", error);
        mostrarMensagem("Falha ao abrir análise do Jarvis.", "error");
    }
}

function solicitarAnaliseJarvisRapida() {
    const container = document.getElementById('jur-pedidos-container');
    if (!container) return;

    const pedidos = [];
    container.querySelectorAll('.pedido-checkbox:checked').forEach(chk => {
        const pedidoNome = chk.value;
        const id = gerarIdPedido(pedidoNome);
        const valorInput = document.getElementById(`valor-${id}`);
        const riscoSelect = document.getElementById(`risco-${id}`);
        const avaliacaoSelect = document.getElementById(`avaliacao-${id}`);
        pedidos.push({
            pedido: pedidoNome,
            valor: parseValorMonetario(valorInput?.value),
            risco: riscoSelect?.value || 'Médio',
            avaliacaoProva: avaliacaoSelect?.value || 'Media'
        });
    });

    if (pedidos.length === 0) {
        mostrarMensagem("Marque pelo menos um pedido ou verba para o Jarvis analisar.", "warning");
        return;
    }

    const modalEl = document.getElementById('analiseRiscoModal');
    const modalBody = document.getElementById('analise-risco-modal-body');
    const modal = new bootstrap.Modal(modalEl);

    modalBody.innerHTML = `
        <div class="text-center p-5">
            <i class="fas fa-robot fa-bounce fa-3x mb-3 text-primary"></i>
            <h5 class="fw-bold text-dark">Jarvis examinando pedidos em tempo real...</h5>
            <p class="text-muted">Calculando probabilidade de condenação e recomendação financeira.</p>
        </div>`;
    modal.show();

    const dadosAtuais = {
        numeroProcesso: document.getElementById('jur-numero-processo')?.value || 'Novo Processo (Em Cadastro)',
        funcionarioNome: (document.getElementById('jur-tipo-acao')?.value === 'Trabalhista' ? document.getElementById('jur-funcionario')?.value : document.getElementById('jur-autor-texto')?.value) || 'Autor / Reclamante',
        tipoAcao: document.getElementById('jur-tipo-acao')?.value || 'Trabalhista',
        valorCausa: parseFloat(document.getElementById('jur-valor-causa')?.value) || 0,
        pedidos: pedidos,
        analise: {
            pontos: document.getElementById('jur-analise-pontos')?.value || '',
            testemunhas: document.getElementById('jur-analise-testemunhas')?.value || '',
            documentos: document.getElementById('jur-analise-documentos')?.value || ''
        }
    };

    executarParecerJarvis(dadosAtuais, modalBody);
}

async function executarParecerJarvis(dadosProcesso, modalBody) {
    const pedidos = dadosProcesso.pedidos || [];
    let valorTotal = dadosProcesso.valorCausa || 0;
    if (valorTotal === 0 && pedidos.length > 0) {
        valorTotal = pedidos.reduce((acc, p) => acc + (p.valor || 0), 0);
    }

    let valorAlto = 0, valorMedio = 0, valorBaixo = 0;
    pedidos.forEach(p => {
        const v = p.valor || 0;
        if (p.risco === 'Alto') valorAlto += v;
        else if (p.risco === 'Médio') valorMedio += v;
        else valorBaixo += v;
    });

    // Ponderação com robustez da prova
    let perdaProvavel = (valorAlto * 0.85) + (valorMedio * 0.45) + (valorBaixo * 0.15);
    const provaPontos = (dadosProcesso.analise?.pontos || '').toLowerCase();
    if (provaPontos.includes('britanico') || provaPontos.includes('britânico') || provaPontos.includes('sem assinatura') || provaPontos.includes('falha')) {
        perdaProvavel += (valorTotal * 0.10); // Risco agravado por falha em cartões de ponto (Súmula 338 TST)
    }

    if (perdaProvavel > valorTotal) perdaProvavel = valorTotal;
    const tetoAcordo = Math.max(perdaProvavel * 0.70, valorTotal * 0.20);
    const propostaInicial = tetoAcordo * 0.60;
    const economiaPotencial = Math.max(0, valorTotal - tetoAcordo);

    // Tentar chamada com IA Gemini / Nexter AI
    let textoAnaliseIA = null;
    try {
        const promptIA = `Você é o Jarvis, assistente executivo sênior de Direito do Trabalho e Gestão de Passivo Trabalhista do Sistema Nexter.
Analise detalhadamente o processo abaixo e gere um parecer estratégico executivo em Markdown:

DADOS DO PROCESSO:
- Nº do Processo: ${dadosProcesso.numeroProcesso || 'Não informado'}
- Reclamante / Autor: ${dadosProcesso.funcionarioNome || dadosProcesso.cliente || 'Não informado'}
- Tipo de Ação: ${dadosProcesso.tipoAcao || 'Trabalhista'}
- Valor Total Reclamado: R$ ${valorTotal.toFixed(2)}

PEDIDOS / VERBAS RECLAMADAS:
${pedidos.map(p => `- ${p.pedido}: R$ ${(p.valor || 0).toFixed(2)} | Risco da Empresa: ${p.risco} | Prova da Empresa: ${p.avaliacaoProva}`).join('\n')}

SITUAÇÃO DAS PROVAS:
- Controles de Ponto: ${dadosProcesso.analise?.pontos || 'Nenhuma ressalva anotada'}
- Testemunhas: ${dadosProcesso.analise?.testemunhas || 'Nenhuma ressalva anotada'}
- Documentos e Recibos: ${dadosProcesso.analise?.documentos || 'Nenhuma ressalva anotada'}

ESTRUTURE SUA RESPOSTA EM:
1. DIAGNÓSTICO GERAL DE RISCO (Classificação e vulnerabilidades principais).
2. ANÁLISE CRÍTICA DAS VERBAS MAIS SENSÍVEIS (Horas extras, verbas rescisórias, multas 477/467, FGTS, etc. e como as provas afetam cada uma).
3. ESTRATÉGIA RECOMENDADA PARA AUDIÊNCIA & NEGOCIAÇÃO DE ACORDO (Valor de entrada, teto limite sugerido e argumentos táticos).`;

        const resp = await fetch('/api/nexter-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: promptIA }],
                tools: [],
                userContext: "Módulo Jurídico Nexter - Jarvis AI"
            })
        });

        if (resp.ok) {
            const data = await resp.json();
            if (data.type === 'text' && data.content) {
                textoAnaliseIA = data.content;
            }
        }
    } catch (e) {
        console.warn("Jarvis API externa indisponível, usando motor preditivo interno:", e);
    }

    // Se o backend de IA respondeu com texto, formatamos
    let blocoIAFormatado = '';
    if (textoAnaliseIA) {
        let formatado = textoAnaliseIA
            .replace(/### (.*?)\n/g, '<h6 class="fw-bold text-dark mt-3 mb-2"><i class="fas fa-chevron-right text-primary me-2"></i>$1</h6>')
            .replace(/## (.*?)\n/g, '<h5 class="fw-bold text-primary border-bottom pb-2 mt-4 mb-3"><i class="fas fa-gavel me-2"></i>$1</h5>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '<p class="mb-2">')
            .replace(/\n- /g, '<br>&bull; ');
        blocoIAFormatado = `
            <div class="card border-0 shadow-sm p-4 mb-4 rounded-3 bg-white border-start border-4 border-primary">
                <div class="d-flex align-items-center mb-3">
                    <span class="badge bg-primary me-2"><i class="fas fa-brain"></i> Inteligência Generativa</span>
                    <span class="text-muted small">Parecer emitido em tempo real</span>
                </div>
                <div class="text-secondary" style="line-height: 1.6;">
                    ${formatado}
                </div>
            </div>
        `;
    }

    // Monta o relatório executivo completo do Jarvis
    modalBody.innerHTML = `
        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="card border-0 bg-primary bg-opacity-10 text-primary p-3 rounded-3 h-100 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="small text-muted fw-bold d-block text-uppercase">Causa Pleiteada</span>
                            <span class="fs-4 fw-bold">R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <i class="fas fa-file-invoice-dollar fs-3 opacity-50"></i>
                    </div>
                    <small class="text-muted mt-2 d-block">${pedidos.length} verba(s) reclamada(s)</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 bg-danger bg-opacity-10 text-danger p-3 rounded-3 h-100 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="small text-muted fw-bold d-block text-uppercase">Perda Provável</span>
                            <span class="fs-4 fw-bold">R$ ${perdaProvavel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <i class="fas fa-exclamation-triangle fs-3 opacity-50"></i>
                    </div>
                    <small class="text-muted mt-2 d-block">Provisão contábil recomendada</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 bg-success bg-opacity-10 text-success p-3 rounded-3 h-100 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="small text-muted fw-bold d-block text-uppercase">Teto Sugerido Acordo</span>
                            <span class="fs-4 fw-bold">R$ ${tetoAcordo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <i class="fas fa-handshake fs-3 opacity-50"></i>
                    </div>
                    <small class="text-muted mt-2 d-block">Proposta inicial: R$ ${propostaInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-0 bg-info bg-opacity-10 text-info p-3 rounded-3 h-100 shadow-sm">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="small text-muted fw-bold d-block text-uppercase">Economia Estimada</span>
                            <span class="fs-4 fw-bold">R$ ${economiaPotencial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <i class="fas fa-piggy-bank fs-3 opacity-50"></i>
                    </div>
                    <small class="text-muted mt-2 d-block">Caso feche no teto recomendado</small>
                </div>
            </div>
        </div>

        ${blocoIAFormatado}

        <!-- Matriz de Risco das Verbas -->
        <div class="card border-0 shadow-sm mb-4 rounded-3 overflow-hidden">
            <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                <h6 class="mb-0 fw-bold text-dark"><i class="fas fa-table-list text-primary me-2"></i>Matriz de Verbas e Probabilidade de Perda</h6>
                <span class="badge bg-light text-dark border">${pedidos.length} itens avaliados</span>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" style="font-size: 0.88rem;">
                    <thead class="table-light">
                        <tr>
                            <th>Verba Pleiteada</th>
                            <th>Valor Reclamado</th>
                            <th>Risco Declarado</th>
                            <th>Avaliação de Prova</th>
                            <th>Parecer Tático do Jarvis</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(p => {
                            let badgeRisco = 'bg-secondary';
                            if (p.risco === 'Alto') badgeRisco = 'bg-danger';
                            else if (p.risco === 'Médio') badgeRisco = 'bg-warning text-dark';
                            else if (p.risco === 'Baixo') badgeRisco = 'bg-success';

                            let badgeProva = 'bg-light text-secondary border';
                            if (p.avaliacaoProva === 'Boa') badgeProva = 'bg-success bg-opacity-10 text-success border-success';
                            else if (p.avaliacaoProva === 'Ruim') badgeProva = 'bg-danger bg-opacity-10 text-danger border-danger';

                            // Análise heurística tática do Jarvis para cada verba
                            let conselho = 'Avaliar na instrução.';
                            const pedLower = p.pedido.toLowerCase();
                            if (pedLower.includes('saldo de sal')) conselho = 'Verba incontroversa. Quitar no TRCT para evitar multa art. 467 CLT.';
                            else if (pedLower.includes('aviso')) conselho = 'Verificar se houve dispensa imotivada e se o cumprimento foi trabalhado/indenizado.';
                            else if (pedLower.includes('ferias') || pedLower.includes('férias')) conselho = 'Juntar comprovantes de gozo e recibos com assinatura prévia (art. 145 CLT).';
                            else if (pedLower.includes('13')) conselho = 'Comprovar quitação com folha de pagamento de novembro e dezembro.';
                            else if (pedLower.includes('477')) conselho = 'Inaplicável se rescisão paga até o 10º dia do término (art. 477 §6º CLT).';
                            else if (pedLower.includes('fgts')) conselho = 'Emitir extrato analítico da CEF comprovando depósitos regulares.';
                            else if (pedLower.includes('horas extra')) conselho = p.avaliacaoProva === 'Ruim' ? 'Atenção máxima: Cartões falhos geram presunção de veracidade (Súmula 338 TST).' : 'Apresentar espelhos de ponto válidos e demonstrativo de compensação.';
                            else if (pedLower.includes('insalubridade') || pedLower.includes('periculosidade')) conselho = 'Imprescindível LTCAT/PPRA e fichas de entrega de EPI com CA válido.';
                            else if (pedLower.includes('consignado')) conselho = 'Conferir se os descontos em folha foram repassados à instituição bancária.';

                            return `
                                <tr>
                                    <td class="fw-semibold text-dark">${p.pedido}</td>
                                    <td class="fw-bold">R$ ${(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td><span class="badge ${badgeRisco}">${p.risco}</span></td>
                                    <td><span class="badge ${badgeProva}">${p.avaliacaoProva === 'Boa' ? 'Robusta' : (p.avaliacaoProva === 'Ruim' ? 'Fraca' : 'Razoável')}</span></td>
                                    <td><small class="text-muted"><i class="fas fa-lightbulb text-warning me-1"></i>${conselho}</small></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Diagnóstico das Provas Cadastradas -->
        <div class="card border-0 shadow-sm p-4 rounded-3 bg-white mb-3">
            <h6 class="fw-bold text-dark mb-3"><i class="fas fa-folder-open text-primary me-2"></i>Status das Provas da Empresa</h6>
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="p-3 border rounded-3 bg-light h-100">
                        <strong class="text-dark small d-block mb-1"><i class="fas fa-clock text-info me-1"></i> Controles de Ponto:</strong>
                        <p class="mb-0 text-muted small">${dadosProcesso.analise?.pontos ? dadosProcesso.analise.pontos : 'Não informado pelo advogado/RH.'}</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 border rounded-3 bg-light h-100">
                        <strong class="text-dark small d-block mb-1"><i class="fas fa-users text-warning me-1"></i> Testemunhas:</strong>
                        <p class="mb-0 text-muted small">${dadosProcesso.analise?.testemunhas ? dadosProcesso.analise.testemunhas : 'Não informado pelo advogado/RH.'}</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="p-3 border rounded-3 bg-light h-100">
                        <strong class="text-dark small d-block mb-1"><i class="fas fa-file-contract text-success me-1"></i> Documentos & Recibos:</strong>
                        <p class="mb-0 text-muted small">${dadosProcesso.analise?.documentos ? dadosProcesso.analise.documentos : 'Não informado pelo advogado/RH.'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
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
                <div class="col-md-6 mb-3"><small class="text-muted">Reclamante / Autor</small><p>${proc.funcionarioNome || proc.cliente || proc.autor || 'N/A'}</p></div>
                <div class="col-md-6 mb-3"><small class="text-muted">Escritório / Advogado</small><p>${proc.escritorio || proc.parteContraria || 'N/A'}</p></div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3"><small class="text-muted">Tipo de Ação</small><p><span class="badge bg-info text-dark">${proc.tipoAcao || 'N/A'}</span></p></div>
                <div class="col-md-6 mb-3"><small class="text-muted">Risco Geral</small><p><span class="badge ${getRiskClass(proc.riscoGeral)}">${proc.riscoGeral || 'N/A'}</span></p></div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <small class="text-muted"><i class="fas fa-handshake me-1 text-primary"></i> Audiência de Conciliação</small>
                    <p class="fw-bold mb-0">${proc.dataConciliacao ? formatarDataHoraBR(proc.dataConciliacao) : '<span class="text-muted fw-normal">Não agendada</span>'}</p>
                </div>
                <div class="col-md-6 mb-3">
                    <small class="text-muted"><i class="fas fa-gavel me-1 text-warning"></i> Audiência de Instrução</small>
                    <p class="fw-bold mb-0">${proc.dataInstrucao ? formatarDataHoraBR(proc.dataInstrucao) : '<span class="text-muted fw-normal">Não agendada</span>'}</p>
                </div>
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
    const conteudo = document.getElementById('analise-risco-modal-body')?.innerHTML;
    if (!conteudo) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Análise de Risco - Jarvis AI</title>
            <meta charset="utf-8">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { padding: 30px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body>
            <div class="mb-4 text-center border-bottom pb-3">
                <h3 class="fw-bold">Nexter AI &bull; Parecer de Risco Trabalhista e Prevenção de Passivo</h3>
                <p class="text-muted small mb-0">Emitido pelo Jarvis em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            ${conteudo}
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

window.atualizarCampoAutorPorTipoAcao = atualizarCampoAutorPorTipoAcao;
window.abrirModalProcesso = abrirModalProcesso;
window.salvarProcessoJuridico = salvarProcessoJuridico;
window.excluirProcessoJuridico = excluirProcessoJuridico;
window.carregarProcessosJuridicos = carregarProcessosJuridicos;
window.abrirModalAnaliseRiscoIA = abrirModalAnaliseRiscoIA;
window.solicitarAnaliseJarvisRapida = solicitarAnaliseJarvisRapida;
window.calcularValorCausaAutomatico = calcularValorCausaAutomatico;
window.aoAlternarCheckboxPedido = aoAlternarCheckboxPedido;
window.aoDigitarValorPedido = aoDigitarValorPedido;
window.marcarTodosPedidos = marcarTodosPedidos;
window.solicitarAdicionarPedidoCustomizado = solicitarAdicionarPedidoCustomizado;
window.imprimirAnaliseRisco = imprimirAnaliseRisco;
window.converterParaDate = converterParaDate;
window.formatarDataHoraBR = formatarDataHoraBR;
window.formatarPrazoAudienciaTabela = formatarPrazoAudienciaTabela;