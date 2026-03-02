// js/indicadores-direcao.js

let indCharts = {};

/**
 * Inicializa o Dashboard de Indicadores da Direção.
 * Configura os filtros e dispara o carregamento inicial dos dados.
 */
async function inicializarIndicadoresDirecao() {
    console.log("Inicializando Dashboard de Indicadores da Direção...");

    const filtroMes = document.getElementById('ind-filtro-mes');
    if (filtroMes && !filtroMes.value) {
        const hoje = new Date();
        filtroMes.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    }

    const btnFiltrar = document.getElementById('btn-filtrar-indicadores');
    if (btnFiltrar && !btnFiltrar.dataset.listener) {
        btnFiltrar.addEventListener('click', carregarDadosIndicadores);
        btnFiltrar.dataset.listener = 'true';
    }
    
    const filtroMotivo = document.getElementById('ind-filtro-motivo-rescisao');
    if(filtroMotivo && !filtroMotivo.dataset.listener) {
        filtroMotivo.addEventListener('change', carregarDadosIndicadores);
        filtroMotivo.dataset.listener = 'true';
    }

    await carregarDadosIndicadores();
}

/**
 * Carrega todos os dados necessários para o dashboard, processa e renderiza os componentes.
 */
async function carregarDadosIndicadores() {
    const filtroMesEl = document.getElementById('ind-filtro-mes');
    if (!filtroMesEl || !filtroMesEl.value) {
        mostrarMensagem("Selecione um Mês/Ano de referência.", "warning");
        return;
    }

    const [ano, mes] = filtroMesEl.value.split('-').map(Number);
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    // Exibe estado de carregamento
    const kpiIds = ['ind-kpi-admissoes', 'ind-kpi-demissoes', 'ind-kpi-experiencia', 'ind-custo-rescisao'];
    kpiIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });

    try {
        // Busca todos os dados necessários em paralelo para otimização
        const [
            movimentacoesSnap,
            funcionariosAtivosSnap,
            faltasSnap,
            lancamentosRescisaoSnap
        ] = await Promise.all([
            db.collection('movimentacoes').where('data', '>=', dataInicio).where('data', '<=', dataFim).get(),
            db.collection('funcionarios').where('status', '==', 'Ativo').get(),
            db.collection('faltas').where('data', '>=', dataInicio).where('data', '<=', dataFim).get(),
            db.collection('lancamentos_financeiros').where('subdivisao', '==', 'Rescisão').where('dataVencimento', '>=', dataInicio).where('dataVencimento', '<=', dataFim).get()
        ]);

        const movimentacoes = movimentacoesSnap.docs.map(doc => doc.data());
        const funcionariosAtivos = funcionariosAtivosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const faltas = faltasSnap.docs.map(doc => doc.data());
        const lancamentosRescisao = lancamentosRescisaoSnap.docs.map(doc => doc.data());

        // 1. Total de admissões no mês
        const admissoes = movimentacoes.filter(m => m.tipo === 'admissao').length;
        document.getElementById('ind-kpi-admissoes').textContent = admissoes;

        // 2. Total de Demissões no mês
        const demissoes = movimentacoes.filter(m => m.tipo === 'demissao');
        document.getElementById('ind-kpi-demissoes').textContent = demissoes.length;

        // 3. Total de funcionários em experiência
        const hoje = new Date();
        const dataCorteExp = new Date();
        dataCorteExp.setDate(hoje.getDate() - 90);
        const emExperiencia = funcionariosAtivos.filter(f => {
            const dataAdmissao = f.dataAdmissao?.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
            return dataAdmissao >= dataCorteExp;
        }).length;
        document.getElementById('ind-kpi-experiencia').textContent = emExperiencia;

        // 4. Custo de Rescisão com filtro
        await calcularCustoRescisao(demissoes, lancamentosRescisao);

        // 5. Total de funcionários por setor
        const funcPorSetor = funcionariosAtivos.reduce((acc, func) => {
            const setor = func.setor || 'Não Definido';
            acc[setor] = (acc[setor] || 0) + 1;
            return acc;
        }, {});
        renderizarGraficoIndicadores('ind-chart-func-setor', 'doughnut', 'Funcionários por Setor', funcPorSetor);

        // 6. Total de Faltas por setor
        const funcionariosMap = new Map(funcionariosAtivos.map(f => [f.id, f]));
        const faltasPorSetor = faltas.reduce((acc, falta) => {
            const func = funcionariosMap.get(falta.funcionarioId);
            const setor = func ? (func.setor || 'Não Definido') : 'Desconhecido';
            acc[setor] = (acc[setor] || 0) + 1;
            return acc;
        }, {});
        renderizarGraficoIndicadores('ind-chart-faltas-setor', 'bar', 'Faltas por Setor', faltasPorSetor);

    } catch (error) {
        console.error("Erro ao carregar dados dos indicadores:", error);
        mostrarMensagem("Erro ao carregar o dashboard. Verifique o console.", "error");
    }
}

/**
 * Calcula e exibe o custo de rescisão, populando e aplicando o filtro de motivo.
 */
async function calcularCustoRescisao(demissoes, lancamentosRescisao) {
    const filtroMotivoEl = document.getElementById('ind-filtro-motivo-rescisao');
    const custoEl = document.getElementById('ind-custo-rescisao');
    
    // Popula o filtro de motivos com base nas demissões do período
    const motivosUnicos = [...new Set(demissoes.map(d => d.motivo).filter(Boolean))];
    const valorAtualFiltro = filtroMotivoEl.value;
    filtroMotivoEl.innerHTML = '<option value="">Todos os Motivos</option>';
    motivosUnicos.forEach(motivo => {
        filtroMotivoEl.innerHTML += `<option value="${motivo}">${motivo}</option>`;
    });
    filtroMotivoEl.value = valorAtualFiltro;

    const motivoFiltro = filtroMotivoEl.value;
    
    // Filtra as demissões pelo motivo selecionado
    const demissoesFiltradas = motivoFiltro ? demissoes.filter(d => d.motivo === motivoFiltro) : demissoes;
    const idsDemitidosFiltrados = new Set(demissoesFiltradas.map(d => d.funcionarioId));
    
    // Calcula o custo total somando os lançamentos financeiros dos funcionários demitidos e filtrados
    const custoTotal = lancamentosRescisao
        .filter(l => idsDemitidosFiltrados.has(l.funcionarioId))
        .reduce((acc, l) => acc + (l.valor || 0), 0);

    custoEl.textContent = `R$ ${custoTotal.toFixed(2).replace('.', ',')}`;
}

/**
 * Renderiza um gráfico usando Chart.js.
 */
function renderizarGraficoIndicadores(canvasId, type, label, data) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (indCharts[canvasId]) {
        indCharts[canvasId].destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    indCharts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: [
                    '#4361ee', '#f72585', '#4cc9f0', '#7209b7', '#3a0ca3',
                    '#ff9f1c', '#2ec4b6', '#e71d36', '#adb5bd', '#2b2d42',
                    '#f94144', '#f3722c', '#f8961e', '#f9c74f', '#90be6d', '#43aa8b', '#577590'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: type === 'doughnut' ? 'right' : 'top',
                    display: type === 'doughnut'
                }
            },
            scales: type === 'bar' ? { y: { beginAtZero: true } } : {}
        }
    });
}

// Exporta a função de inicialização para ser chamada pelo app.js
window.inicializarIndicadoresDirecao = inicializarIndicadoresDirecao;