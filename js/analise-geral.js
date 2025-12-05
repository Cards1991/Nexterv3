// ========================================
// Módulo: Análise Geral (People Analytics)
// ========================================

let chartsGerais = {}; // Armazena instâncias dos gráficos para destruí-los depois

async function inicializarAnaliseGeral() {
    const container = document.getElementById('dashboard-analise-geral');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Analisando dados gerais da empresa...</p></div>';

    try {
        const [funcionariosSnap, movimentacoesSnap] = await Promise.all([
            db.collection('funcionarios').get(),
            db.collection('movimentacoes').get()
        ]);

        const todosFuncionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const movimentacoes = movimentacoesSnap.docs.map(doc => doc.data());

        if (todosFuncionarios.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Nenhum funcionário encontrado para análise.</p>';
            return;
        }

        const funcionariosAtivos = todosFuncionarios.filter(f => f.status === 'Ativo');

        // --- 1. Calcular Métricas ---
        const idadeMedia = calcularIdadeMedia(funcionariosAtivos);
        const salarioMedio = calcularSalarioMedio(funcionariosAtivos);
        const tempoMedioEmpresa = calcularTempoMedioEmpresa(funcionariosAtivos);
        const turnoverRate = calcularTurnover(todosFuncionarios, movimentacoes);
        const totalAtivos = funcionariosAtivos.length;
        const totalDesligados = todosFuncionarios.length - totalAtivos;

        // --- 2. Renderizar KPIs ---
        renderizarKPIs(totalAtivos, idadeMedia, tempoMedioEmpresa, salarioMedio, turnoverRate, totalDesligados);

        // --- 3. Calcular e Renderizar Gráficos e Tabelas ---
        renderizarGraficoPizza('grafico-geral-genero', 'Distribuição por Gênero', calcularDistribuicao(funcionariosAtivos, 'sexo'));
        renderizarGraficoBarras('grafico-geral-setor', 'Distribuição por Setor', calcularDistribuicao(funcionariosAtivos, 'setor'));
        renderizarGraficoPizza('grafico-geral-cargos', 'Proporção de Cargos', calcularDistribuicao(funcionariosAtivos, 'cargo'));
        renderizarTabelaRanking('tabela-geral-ranking-tempo', calcularRankingTempoEmpresa(funcionariosAtivos));
        renderizarTabelaSalarios('tabela-geral-top-salarios', calcularTopSalarios(funcionariosAtivos, 10));
        renderizarTabelaSalarios('tabela-geral-bottom-salarios', calcularBottomSalarios(funcionariosAtivos, 10));

        // --- 4. Insights e Outras Análises ---
        gerarInsightsEstrategicos(turnoverRate, idadeMedia, salarioMedio);
        renderizarOutrasAnalises(movimentacoes);

    } catch (error) {
        console.error("Erro ao gerar dashboard de análise geral:", error);
        container.innerHTML = '<p class="text-center text-danger">Falha ao carregar o dashboard de Análise Geral.</p>';
    }
}

function renderizarKPIs(total, idade, tempo, salario, turnover, desligados) {
    const container = document.getElementById('analise-geral-kpis');
    container.innerHTML = `
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-users text-primary"></i><div class="number">${total}</div><div class="label">Funcionários Ativos</div></div></div></div>
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-birthday-cake text-info"></i><div class="number">${idade.toFixed(1)}</div><div class="label">Idade Média</div></div></div></div>
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-business-time text-success"></i><div class="number">${tempo}</div><div class="label">Tempo Médio</div></div></div></div>
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-money-bill-wave text-warning"></i><div class="number">R$ ${salario.toFixed(2).replace('.', ',')}</div><div class="label">Salário Médio</div></div></div></div>
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-exchange-alt text-danger"></i><div class="number">${turnover.toFixed(1)}%</div><div class="label">Turnover (12m)</div></div></div></div>
        <div class="col-md-4 col-lg-2"><div class="card stat-card"><div class="card-body"><i class="fas fa-user-check text-secondary"></i><div class="number">${total} / ${desligados}</div><div class="label">Ativos / Desligados</div></div></div></div>
    `;
}

// --- Funções de Cálculo (reutilizadas e adaptadas) ---

function calcularIdadeMedia(funcionarios) {
    const idades = funcionarios.map(f => {
        if (!f.dataNascimento) return null;
        const hoje = new Date();
        const nascimento = f.dataNascimento.toDate ? f.dataNascimento.toDate() : new Date(f.dataNascimento);
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const m = hoje.getMonth() - nascimento.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
        return idade;
    }).filter(idade => idade !== null && !isNaN(idade));
    return idades.length > 0 ? idades.reduce((a, b) => a + b, 0) / idades.length : 0;
}

function calcularSalarioMedio(funcionarios) {
    const salarios = funcionarios.map(f => parseFloat(f.salario || 0)).filter(s => !isNaN(s) && s > 0);
    return salarios.length > 0 ? salarios.reduce((a, b) => a + b, 0) / salarios.length : 0;
}

function calcularTempoMedioEmpresa(funcionarios) {
    const tempos = funcionarios.map(f => {
        if (!f.dataAdmissao) return null;
        const hoje = new Date();
        const admissao = f.dataAdmissao.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
        return (hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24);
    }).filter(tempo => tempo !== null && !isNaN(tempo));

    if (tempos.length === 0) return '0m';
    const mediaDias = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    const anos = Math.floor(mediaDias / 365.25);
    const meses = Math.floor((mediaDias % 365.25) / 30.44);
    let resultado = '';
    if (anos > 0) resultado += `${anos}a `;
    if (meses > 0) resultado += `${meses}m`;
    return resultado.trim() || '0m';
}

function calcularTurnover(todosFuncionarios, movimentacoes) {
    const hoje = new Date();
    const dozeMesesAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
    
    const funcionariosNoInicio = todosFuncionarios.filter(f => (f.dataAdmissao?.toDate() || new Date(f.dataAdmissao)) < dozeMesesAtras).length;
    const funcionariosNoFim = todosFuncionarios.filter(f => f.status === 'Ativo').length;
    const mediaFuncionarios = (funcionariosNoInicio + funcionariosNoFim) / 2;

    const demissoesNoPeriodo = movimentacoes.filter(mov => mov.tipo === 'demissao' && (mov.data?.toDate() || new Date(mov.data)) >= dozeMesesAtras).length;

    if (mediaFuncionarios === 0) return 0;
    return (demissoesNoPeriodo / mediaFuncionarios) * 100;
}

function calcularDistribuicao(array, chave) {
    return array.reduce((acc, obj) => {
        const valor = obj[chave] || 'Não informado';
        acc[valor] = (acc[valor] || 0) + 1;
        return acc;
    }, {});
}

function calcularRankingTempoEmpresa(funcionarios) {
    return funcionarios.filter(f => f.dataAdmissao).map(f => {
        const hoje = new Date();
        const admissao = f.dataAdmissao.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
        const diffMs = hoje.getTime() - admissao.getTime();
        const anos = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
        const meses = Math.floor((diffMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
        return { nome: f.nome, tempoEmDias: diffMs, tempoFormatado: `${anos > 0 ? anos + 'a ' : ''}${meses}m` };
    }).sort((a, b) => b.tempoEmDias - a.tempoEmDias);
}

function calcularTopSalarios(funcionarios, count) {
    return funcionarios.filter(f => f.salario && !isNaN(f.salario)).sort((a, b) => b.salario - a.salario).slice(0, count).map(f => ({ nome: f.nome, salario: f.salario }));
}

function calcularBottomSalarios(funcionarios, count) {
    return funcionarios.filter(f => f.salario && !isNaN(f.salario) && f.salario > 0).sort((a, b) => a.salario - b.salario).slice(0, count).map(f => ({ nome: f.nome, salario: f.salario }));
}

// --- Funções de Renderização (reutilizadas e adaptadas) ---

function renderizarGraficoPizza(canvasId, titulo, dados) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartsGerais[canvasId]) chartsGerais[canvasId].destroy();

    chartsGerais[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(dados), datasets: [{ data: Object.values(dados), backgroundColor: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#adb5bd', '#2ec4b6'], hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
    });
}

function renderizarGraficoBarras(canvasId, titulo, dados) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (chartsGerais[canvasId]) chartsGerais[canvasId].destroy();

    chartsGerais[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(dados), datasets: [{ label: 'Nº de Funcionários', data: Object.values(dados), backgroundColor: 'rgba(67, 97, 238, 0.7)' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderizarTabelaRanking(tableId, data) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.innerHTML = data.length > 0 ? data.map(item => `<tr><td>${item.nome}</td><td>${item.tempoFormatado}</td></tr>`).join('') : '<tr><td colspan="2" class="text-center text-muted">N/A</td></tr>';
}

function renderizarTabelaSalarios(tableId, data) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.innerHTML = data.length > 0 ? data.map(item => `<tr><td>${item.nome}</td><td>R$ ${item.salario.toFixed(2).replace('.', ',')}</td></tr>`).join('') : '<tr><td colspan="2" class="text-center text-muted">N/A</td></tr>';
}

function renderizarOutrasAnalises(movimentacoes) {
    const container = document.getElementById('analise-geral-outros');
    const motivosDesligamento = calcularDistribuicao(movimentacoes.filter(m => m.tipo === 'demissao'), 'motivo');
    const sortedMotivos = Object.entries(motivosDesligamento).sort(([, a], [, b]) => b - a);

    let html = '<div class="row"><div class="col-lg-12 mb-4"><div class="card h-100"><div class="card-header">Mapa de Calor por Motivo de Desligamento</div><div class="card-body">';
    if (sortedMotivos.length > 0) {
        html += '<ul class="list-group list-group-flush">';
        sortedMotivos.forEach(([motivo, count]) => {
            html += `<li class="list-group-item d-flex justify-content-between align-items-center">${motivo}<span class="badge bg-danger rounded-pill">${count}</span></li>`;
        });
        html += '</ul>';
    } else {
        html += '<p class="text-muted">Nenhum motivo de desligamento registrado no período.</p>';
    }
    html += '</div></div></div></div>';
    container.innerHTML = html;
}

// --- Insights ---

function gerarInsightsEstrategicos(turnoverRate, idadeMedia, salarioMedio) {
    const container = document.getElementById('analise-geral-insights-ia');
    if (!container) return;

    let insightsHTML = '<ul>';

    if (turnoverRate > 15) {
        insightsHTML += `<li class="text-danger"><strong>Alerta de Turnover:</strong> A taxa de ${turnoverRate.toFixed(1)}% está alta. Investigue os motivos de desligamento.</li>`;
    } else {
        insightsHTML += `<li class="text-success"><strong>Retenção Saudável:</strong> A taxa de turnover de ${turnoverRate.toFixed(1)}% está em um nível saudável.</li>`;
    }

    if (idadeMedia > 45) {
        insightsHTML += `<li class="text-warning"><strong>Perfil Etário Sênior:</strong> A idade média de ${idadeMedia.toFixed(1)} anos indica uma força de trabalho experiente. Planeje a sucessão e a transferência de conhecimento.</li>`;
    } else if (idadeMedia < 28) {
        insightsHTML += `<li class="text-info"><strong>Perfil Etário Jovem:</strong> A idade média de ${idadeMedia.toFixed(1)} anos sugere dinamismo. Invista em desenvolvimento de lideranças.</li>`;
    }

    insightsHTML += `<li><strong>Remuneração:</strong> O salário médio de R$ ${salarioMedio.toFixed(2).replace('.', ',')} serve como um benchmark interno. Compare com o mercado para garantir competitividade.</li>`;

    insightsHTML += '</ul>';
    container.innerHTML = insightsHTML;
}