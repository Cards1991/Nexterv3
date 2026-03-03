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
    const kpiIds = ['ind-kpi-admissoes', 'ind-kpi-demissoes', 'ind-kpi-experiencia', 'ind-custo-rescisao', 'ind-kpi-total-funcionarios', 'ind-kpi-exp-aprovadas', 'ind-kpi-exp-reprovadas', 'ind-kpi-horas-extras'];
    kpiIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });

    try {
        // Datas para Horas Extras (26 do mês anterior a 25 do mês atual)
        const dataInicioHE = new Date(ano, mes - 2, 26);
        const dataFimHE = new Date(ano, mes - 1, 25);
        
        const toISODate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        const startHEStr = toISODate(dataInicioHE);
        const endHEStr = toISODate(dataFimHE);

        // Busca todos os dados necessários em paralelo para otimização
        const [
            movimentacoesSnap,
            todosFuncionariosSnap,
            faltasSnap,
            avaliacoesExpSnap,
            overtimeSnap
        ] = await Promise.all([
            db.collection('movimentacoes').where('data', '>=', dataInicio).where('data', '<=', dataFim).get(),
            db.collection('funcionarios').get(), // Busca TODOS para reconstrução histórica
            db.collection('faltas').where('data', '>=', dataInicio).where('data', '<=', dataFim).get(),
            db.collection('avaliacoes_experiencia').where('dataAvaliacao', '>=', dataInicio).where('dataAvaliacao', '<=', dataFim).get(),
            db.collection('overtime').where('date', '>=', startHEStr).where('date', '<=', endHEStr).get()
        ]);

        const movimentacoes = movimentacoesSnap.docs.map(doc => doc.data());
        const todosFuncionarios = todosFuncionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const faltas = faltasSnap.docs.map(doc => doc.data());
        const avaliacoesExp = avaliacoesExpSnap.docs.map(doc => doc.data());
        const overtimeDocs = overtimeSnap.docs.map(doc => doc.data());

        // 1. Total de admissões no mês
        const admissoes = todosFuncionarios.filter(f => {
            if (!f.dataAdmissao) return false;
            const dataAdm = f.dataAdmissao.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
            return dataAdm >= dataInicio && dataAdm <= dataFim;
        }).length;
        document.getElementById('ind-kpi-admissoes').textContent = admissoes;

        // 2. Total de Demissões no mês
        const demissoes = movimentacoes.filter(m => m.tipo === 'demissao');
        document.getElementById('ind-kpi-demissoes').textContent = demissoes.length;

        // Lógica de Reconstrução Histórica: Quem estava ativo no final do mês do filtro?
        const funcionariosAtivos = todosFuncionarios.filter(f => {
            const dataAdmissao = f.dataAdmissao ? (f.dataAdmissao.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao)) : null;
            
            // 1. Se não tem admissão ou foi admitido DEPOIS do mês do filtro, não conta.
            if (!dataAdmissao || dataAdmissao > dataFim) return false;

            // 2. Se está inativo HOJE, verificamos QUANDO saiu.
            if (f.status === 'Inativo') {
                const dataDemissao = f.ultimaMovimentacao ? (f.ultimaMovimentacao.toDate ? f.ultimaMovimentacao.toDate() : new Date(f.ultimaMovimentacao)) : null;
                // Se foi demitido ANTES ou DURANTE o mês do filtro, não conta como ativo no final do mês.
                if (dataDemissao && dataDemissao <= dataFim) return false;
            }
            return true;
        });

        // 3. Total de funcionários em experiência (Baseado na data do filtro)
        const dataCorteExp = new Date(dataFim); // Usa a data do filtro, não "hoje"
        dataCorteExp.setDate(dataCorteExp.getDate() - 90);
        
        const emExperiencia = funcionariosAtivos.filter(f => {
            const dataAdmissao = f.dataAdmissao?.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
            return dataAdmissao >= dataCorteExp;
        }).length;
        document.getElementById('ind-kpi-experiencia').textContent = emExperiencia;

        // NOVO: Total de Funcionários
        const totalFuncionarios = funcionariosAtivos.length;
        const elTotalFunc = document.getElementById('ind-kpi-total-funcionarios');
        if (elTotalFunc) elTotalFunc.textContent = totalFuncionarios;

        // NOVO: Experiências Aprovadas no mês
        const expAprovadas = avaliacoesExp.filter(a => a.resultado === 'Aprovado').length;
        const elExpAprov = document.getElementById('ind-kpi-exp-aprovadas');
        if (elExpAprov) elExpAprov.textContent = expAprovadas;

        // NOVO: Experiências Não Aprovadas no mês
        const expReprovadas = avaliacoesExp.filter(a => a.resultado === 'Reprovado' || a.resultado === 'Desligamento').length;
        const elExpReprov = document.getElementById('ind-kpi-exp-reprovadas');
        if (elExpReprov) elExpReprov.textContent = expReprovadas;

        // NOVO: Total de Horas Extras (Período 26 a 25)
        const totalHorasExtras = overtimeDocs.reduce((acc, d) => acc + (parseFloat(d.hours) || 0), 0);
        const elHorasExtras = document.getElementById('ind-kpi-horas-extras');
        if (elHorasExtras) elHorasExtras.textContent = totalHorasExtras.toFixed(2);

        // 4. Custo de Rescisão com filtro
        await calcularCustoRescisao(demissoes);

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
async function calcularCustoRescisao(demissoes) {
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

    // Identificar funcionários demitidos (filtrados por motivo se necessário)
    let demissoesConsideradas = demissoes;
    if (motivoFiltro) {
        demissoesConsideradas = demissoes.filter(d => d.motivo === motivoFiltro);
    }
    
    // Obtém IDs únicos dos demitidos para buscar seus lançamentos financeiros
    const idsDemitidos = [...new Set(demissoesConsideradas.map(d => d.funcionarioId).filter(id => id))];

    if (idsDemitidos.length === 0) {
        custoEl.textContent = 'R$ 0,00';
        return;
    }

    // Busca lançamentos financeiros específicos para os funcionários demitidos
    // Divide em lotes de 10 para respeitar o limite do operador 'in' do Firestore
    let totalCusto = 0;
    const chunks = [];
    for (let i = 0; i < idsDemitidos.length; i += 10) {
        chunks.push(idsDemitidos.slice(i, i + 10));
    }

    const promises = chunks.map(chunk => 
        db.collection('lancamentos_financeiros').where('funcionarioId', 'in', chunk).get()
    );

    const snapshots = await Promise.all(promises);
    
    snapshots.forEach(snap => {
        snap.forEach(doc => {
            const l = doc.data();
            // Garante que estamos pegando apenas custos gerados pela folha de pagamento
            if (l.origem !== 'FOPAG') return;

            // Verifica se é verba rescisória
            const isRescisao = l.subdivisao === 'Rescisões';
            const isEncargoRescisorio = l.subdivisao === 'Encargos' && (l.motivo && (l.motivo.includes('Rescis') || l.motivo.includes('rescis')));

            if (isRescisao || isEncargoRescisorio) {
                totalCusto += (parseFloat(l.valor) || 0);
            }
        });
    });

    custoEl.textContent = `R$ ${totalCusto.toFixed(2).replace('.', ',')}`;
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