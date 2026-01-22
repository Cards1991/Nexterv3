// js/custos.js

let custosCharts = {}; // Para armazenar instâncias de gráficos

async function inicializarAnaliseCustos() {
    console.log('Inicializando seção de Análise de Custos.');
    
    // Limpar gráficos anteriores de forma segura
    Object.values(custosCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (e) { console.warn('Erro ao destruir gráfico:', e); }
        }
    });
    custosCharts = {};

    // Configurar filtros de data para o mês atual
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    document.getElementById('custos-filtro-inicio').value = primeiroDiaMes;
    document.getElementById('custos-filtro-fim').value = ultimoDiaMes;

    // Popular filtros de empresa e setor
    await preencherFiltrosCustos();

    // Adicionar event listener para o botão de aplicar filtros
    const formFiltro = document.getElementById('custos-filter-form');
    if (formFiltro) {
        formFiltro.removeEventListener('submit', carregarDadosAnaliseCustos); // Evita múltiplos listeners
        formFiltro.addEventListener('submit', (e) => { e.preventDefault(); carregarDadosAnaliseCustos(); });
    }

    // Carregar dados iniciais
    await carregarDadosAnaliseCustos();
}

async function preencherFiltrosCustos() {
    const empresaSelect = document.getElementById('custos-filtro-empresa');
    const setorSelect = document.getElementById('custos-filtro-setor');
    const processoSelect = document.getElementById('custos-filtro-processo');

    // Popular Empresas
    empresaSelect.innerHTML = '<option value="">Todas</option>';
    const empresas = await getEmpresasCache();
    for (const id in empresas) {
        empresaSelect.innerHTML += `<option value="${id}">${empresas[id]}</option>`;
    }

    // Popular Setores (de todas as empresas)
    setorSelect.innerHTML = '<option value="">Todos</option>';
    const setores = new Set();
    const empresasSnap = await db.collection('empresas').get();
    empresasSnap.forEach(doc => {
        (doc.data().setores || []).forEach(s => setores.add(s));
    });
    [...setores].sort().forEach(s => setorSelect.innerHTML += `<option value="${s}">${s}</option>`);

    // Popular Processos (Subdivisões)
    processoSelect.innerHTML = '<option value="">Todos</option>';
    const processos = new Set();
    Object.values(subdivisoesPorOrigem).flat().forEach(p => processos.add(p));
    [...processos].sort().forEach(p => processoSelect.innerHTML += `<option value="${p}">${p}</option>`);
}

async function carregarDadosAnaliseCustos() {
    const tbody = document.getElementById('tabela-custos-detalhes');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="12" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando dados...</td></tr>';

    try {
        const filtroInicio = document.getElementById('custos-filtro-inicio').value;
        const filtroFim = document.getElementById('custos-filtro-fim').value;
        const filtroEmpresa = document.getElementById('custos-filtro-empresa').value;
        const filtroSetor = document.getElementById('custos-filtro-setor').value;
        const filtroProcesso = document.getElementById('custos-filtro-processo').value;

        let custosQuery = db.collection('lancamentos_financeiros');

        if (filtroInicio) {
            const dataInicio = new Date(filtroInicio);
            dataInicio.setHours(0, 0, 0, 0);
            custosQuery = custosQuery.where('dataVencimento', '>=', dataInicio);
        }
        if (filtroFim) {
            const dataFimObj = new Date(filtroFim);
            dataFimObj.setHours(23, 59, 59, 999);
            custosQuery = custosQuery.where('dataVencimento', '<=', dataFimObj);
        }
        if (filtroEmpresa) {
            custosQuery = custosQuery.where('empresaId', '==', filtroEmpresa);
        }
        if (filtroSetor) {
            custosQuery = custosQuery.where('setor', '==', filtroSetor);
        }
        if (filtroProcesso) {
            custosQuery = custosQuery.where('subdivisao', '==', filtroProcesso);
        }

        const custosSnap = await custosQuery.orderBy('dataVencimento', 'desc').get();
        const lancamentos = custosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderizarKPIsCustos(lancamentos);
        renderizarTabelaCustos(lancamentos);
        renderizarGraficosCustos(lancamentos);

    } catch (error) {
        console.error("Erro ao carregar dados de análise de custos:", error);
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger">Erro ao carregar dados de custos. Verifique os índices do Firestore.</td></tr>';
        mostrarMensagem("Erro ao carregar análise de custos.", "error");
    }
}

function renderizarKPIsCustos(lancamentos) {
    const totalPagar = lancamentos.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
    const totalJuros = lancamentos.reduce((acc, l) => acc + parseFloat(l.juros || 0), 0);
    const despesasRH = lancamentos.filter(l => l.origem === 'FOPAG' || l.origem === 'DESPESAS COM M.O.').reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
    
    // Cálculos mais complexos (placeholders por enquanto)
    const projecao = totalPagar * 1.05; // Simples projeção de 5%
    const valores = lancamentos.map(l => parseFloat(l.valor || 0));
    const media = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    const desvioPadrao = valores.length > 0 ? Math.sqrt(valores.map(x => Math.pow(x - media, 2)).reduce((a, b) => a + b) / valores.length) : 0;

    document.getElementById('custos-kpi-total-pagar').textContent = `R$ ${totalPagar.toFixed(2).replace('.', ',')}`;
    document.getElementById('custos-kpi-total-juros').textContent = `R$ ${totalJuros.toFixed(2).replace('.', ',')}`;
    document.getElementById('custos-kpi-despesas-rh').textContent = `R$ ${despesasRH.toFixed(2).replace('.', ',')}`;
    document.getElementById('custos-kpi-projecao').textContent = `R$ ${projecao.toFixed(2).replace('.', ',')}`;
    document.getElementById('custos-kpi-desvio-padrao').textContent = `R$ ${desvioPadrao.toFixed(2).replace('.', ',')}`;
    document.getElementById('custos-kpi-media-mensal').textContent = `R$ ${media.toFixed(2).replace('.', ',')}`;
}

async function renderizarTabelaCustos(lancamentos) {
    const tbody = document.getElementById('tabela-custos-detalhes');
    if (!tbody) return;

    if (lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhum lançamento encontrado com os filtros aplicados.</td></tr>';
        return;
    }

    const empresasMap = await getEmpresasCache();

    tbody.innerHTML = lancamentos.map(l => `
        <tr>
            <td><input type="checkbox" class="form-check-input print-checkbox" value="${l.id}"></td>
            <td><span class="badge ${l.status === 'Pago' ? 'bg-success' : 'bg-warning'}">${l.status || 'Pendente'}</span></td>
            <td>${l.origem || '-'}</td>
            <td>${l.subdivisao || '-'}</td>
            <td>${l.motivo || '-'}</td>
            <td class="text-end">R$ ${(l.valor || 0).toFixed(2).replace('.', ',')}</td>
            <td class="text-end">R$ ${(l.juros || 0).toFixed(2).replace('.', ',')}</td>
            <td class="text-end fw-bold">R$ ${((l.valor || 0) + (l.juros || 0)).toFixed(2).replace('.', ',')}</td>
            <td>${l.dataVencimento ? formatarData(l.dataVencimento.toDate()) : '-'}</td>
            <td>${empresasMap[l.empresaId] || 'N/A'}</td>
            <td>${l.setor || 'N/A'}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-primary" onclick="abrirModalLancamentoFinanceiro('${l.id}')"><i class="fas fa-edit"></i></button></td>
        </tr>
    `).join('');
}

function renderizarGraficosCustos(lancamentos) {
    // Gráfico de Barras por Processo
    const custosPorProcesso = lancamentos.reduce((acc, l) => {
        const processo = l.subdivisao || 'Não Classificado';
        acc[processo] = (acc[processo] || 0) + parseFloat(l.valor || 0);
        return acc;
    }, {});
    renderizarGraficoCustos('custos-processo-bar-chart', 'bar', 'Custos por Processo', custosPorProcesso);

    // Gráfico de Linha de Evolução
    const custosPorDia = lancamentos.reduce((acc, l) => {
        const data = l.dataVencimento.toDate().toISOString().split('T')[0];
        acc[data] = (acc[data] || 0) + parseFloat(l.valor || 0);
        return acc;
    }, {});
    renderizarGraficoCustos('custos-evolucao-chart', 'line', 'Evolução de Custos no Período', custosPorDia);

    // Gráfico Comparativo Mensal (requer nova busca de dados)
    renderizarGraficoComparativoMensal();
}

async function renderizarGraficoComparativoMensal() {
    const hoje = new Date();
    const labels = [];
    const dataAnoAtual = [];
    const dataAnoAnterior = [];

    for (let i = 0; i < 12; i++) {
        const mes = new Date(hoje.getFullYear(), i, 1);
        labels.push(mes.toLocaleString('pt-BR', { month: 'short' }));

        const inicioMesAtual = new Date(hoje.getFullYear(), i, 1);
        const fimMesAtual = new Date(hoje.getFullYear(), i + 1, 0, 23, 59, 59);
        const inicioMesAnterior = new Date(hoje.getFullYear() - 1, i, 1);
        const fimMesAnterior = new Date(hoje.getFullYear() - 1, i + 1, 0, 23, 59, 59);

        const [snapAtual, snapAnterior] = await Promise.all([
            db.collection('lancamentos_financeiros').where('dataVencimento', '>=', inicioMesAtual).where('dataVencimento', '<=', fimMesAtual).get(),
            db.collection('lancamentos_financeiros').where('dataVencimento', '>=', inicioMesAnterior).where('dataVencimento', '<=', fimMesAnterior).get()
        ]);

        dataAnoAtual.push(snapAtual.docs.reduce((acc, doc) => acc + parseFloat(doc.data().valor || 0), 0));
        dataAnoAnterior.push(snapAnterior.docs.reduce((acc, doc) => acc + parseFloat(doc.data().valor || 0), 0));
    }

    const ctx = document.getElementById('custos-comparativo-mensal-chart')?.getContext('2d');
    if (!ctx) return;

    if (custosCharts['custos-comparativo-mensal-chart']) {
        custosCharts['custos-comparativo-mensal-chart'].destroy();
    }

    custosCharts['custos-comparativo-mensal-chart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Ano Anterior (${hoje.getFullYear() - 1})`,
                    data: dataAnoAnterior,
                    backgroundColor: 'rgba(173, 181, 189, 0.7)',
                    borderColor: 'rgba(173, 181, 189, 1)',
                    borderWidth: 1
                },
                {
                    label: `Ano Atual (${hoje.getFullYear()})`,
                    data: dataAnoAtual,
                    backgroundColor: 'rgba(67, 97, 238, 0.7)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderizarGraficoCustos(canvasId, tipo, titulo, dados) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (custosCharts[canvasId]) custosCharts[canvasId].destroy();

    custosCharts[canvasId] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: Object.keys(dados),
            datasets: [{
                label: 'Valor (R$)',
                data: Object.values(dados),
                backgroundColor: tipo === 'line' ? 'rgba(67, 97, 238, 0.1)' : 'rgba(67, 97, 238, 0.7)',
                borderColor: '#4361ee',
                borderWidth: 2,
                fill: tipo === 'line',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: titulo } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function getEmpresasCache() {
    const empresasSnap = await db.collection('empresas').get();
    const empresasMap = {};
    empresasSnap.forEach(doc => {
        empresasMap[doc.id] = doc.data().nome;
    });
    return empresasMap;
}