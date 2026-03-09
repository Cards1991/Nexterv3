// =================================================================
// Dashboard de Análise de Atestados
// =================================================================

let chartAtestEvolucao = null;
let chartAtestTipo = null;
let chartAtestSetores = null;
let chartAtestColaboradores = null;

async function inicializarAnaliseAtestados() {
    console.log("Inicializando Dashboard de Análise de Atestados...");

    // Configurar datas padrão (Mês atual) se estiverem vazias
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const elInicio = document.getElementById('dash-atest-inicio');
    const elFim = document.getElementById('dash-atest-fim');

    if (elInicio && !elInicio.value) elInicio.value = inicioMes.toISOString().split('T')[0];
    if (elFim && !elFim.value) elFim.value = fimMes.toISOString().split('T')[0];

    // Popular filtros
    await popularFiltrosDashboardAtestados();

    // Carregar dados
    await carregarDashboardAtestados();
}

async function popularFiltrosDashboardAtestados() {
    // Setores
    const setorSelect = document.getElementById('dash-atest-setor');
    if (setorSelect && setorSelect.options.length <= 1) {
        try {
            const setoresSnap = await db.collection('setores').orderBy('descricao').get();
            setoresSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.data().descricao;
                opt.textContent = doc.data().descricao;
                setorSelect.appendChild(opt);
            });
        } catch (e) { console.error("Erro ao carregar setores", e); }
    }

    // Colaboradores
    const colabSelect = document.getElementById('dash-atest-colaborador');
    if (colabSelect && colabSelect.options.length <= 1) {
        try {
            const funcSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
            funcSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().nome;
                colabSelect.appendChild(opt);
            });
        } catch (e) { console.error("Erro ao carregar colaboradores", e); }
    }
}

async function carregarDashboardAtestados() {
    // VERIFICAÇÃO DE SEGURANÇA: Se os elementos não existem, para a execução
    if (!document.getElementById('kpi-atest-total')) {
        console.warn("Dashboard de atestados não está visível ou elementos não carregados.");
        return;
    }

    try {
        // Usar cache global se disponível (do módulo atestados.js), senão buscar
        let atestados = [];
        if (typeof __atestados_cache !== 'undefined' && __atestados_cache.length > 0) {
            atestados = __atestados_cache;
        } else {
            const snap = await db.collection('atestados').get();
            atestados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Filtros
        const inicioVal = document.getElementById('dash-atest-inicio')?.value;
        const fimVal = document.getElementById('dash-atest-fim')?.value;
        const setorVal = document.getElementById('dash-atest-setor')?.value;
        const colabVal = document.getElementById('dash-atest-colaborador')?.value;

        const inicio = inicioVal ? new Date(inicioVal + 'T00:00:00') : null;
        const fim = fimVal ? new Date(fimVal + 'T23:59:59') : null;

        const filtrados = atestados.filter(a => {
            // Tratamento seguro de data
            let dataAtestado = null;
            if (a.data_atestado) {
                if (a.data_atestado.toDate) dataAtestado = a.data_atestado.toDate();
                else if (a.data_atestado instanceof Date) dataAtestado = a.data_atestado;
                else dataAtestado = new Date(a.data_atestado);
            }
            
            if (!dataAtestado) return false;
            if (inicio && dataAtestado < inicio) return false;
            if (fim && dataAtestado > fim) return false;
            if (setorVal && a.setor !== setorVal) return false;
            if (colabVal && a.funcionarioId !== colabVal) return false;
            
            return true;
        });

        await atualizarKPIs(filtrados);
        renderizarGraficosAtestados(filtrados);
        
        // Atualizar mapa corporal se o módulo estiver carregado (body-map-3d.js)
        // Dispara um evento customizado que o módulo 3D pode ouvir
        const event = new CustomEvent('dadosAtestadosAtualizados', { detail: filtrados });
        document.dispatchEvent(event);

    } catch (error) {
        console.error("Erro ao carregar dashboard de atestados:", error);
    }
}

async function atualizarKPIs(dados) {
    const total = dados.length;
    const dias = dados.reduce((acc, curr) => acc + (parseInt(curr.dias) || 0), 0);
    const media = total > 0 ? (dias / total).toFixed(1) : '0.0';
    
    // Custo (usando função global de atestados.js se disponível)
    let custo = 0;
    if (typeof calcularCustoAtestados === 'function') {
        custo = await calcularCustoAtestados(dados);
    }

    // Verificação de nulidade ROBUSTA antes de atribuir
    // Try-catch para cada elemento individualmente para evitar que um erro pare os outros
    try {
        const elTotal = document.getElementById('kpi-atest-total');
        if (elTotal) elTotal.textContent = total;
    } catch (e) { console.warn("Erro ao atualizar kpi-atest-total", e); }

    try {
        const elDias = document.getElementById('kpi-atest-dias');
        if (elDias) elDias.textContent = dias;
    } catch (e) { console.warn("Erro ao atualizar kpi-atest-dias", e); }

    try {
        const elCusto = document.getElementById('kpi-atest-custo');
        if (elCusto) elCusto.textContent = `R$ ${custo.toFixed(2).replace('.', ',')}`;
    } catch (e) { console.warn("Erro ao atualizar kpi-atest-custo", e); }

    try {
        const elMedia = document.getElementById('kpi-atest-media');
        if (elMedia) elMedia.textContent = media;
    } catch (e) { console.warn("Erro ao atualizar kpi-atest-media", e); }
}

function renderizarGraficosAtestados(dados) {
    if (typeof Chart === 'undefined') return;

    // 1. Evolução Mensal
    const ctxEvolucao = document.getElementById('chart-atest-evolucao')?.getContext('2d');
    if (ctxEvolucao) {
        const porMes = {};
        dados.forEach(d => {
            const data = d.data_atestado?.toDate ? d.data_atestado.toDate() : new Date(d.data_atestado);
            const mes = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            porMes[mes] = (porMes[mes] || 0) + 1;
        });

        if (chartAtestEvolucao) chartAtestEvolucao.destroy();
        chartAtestEvolucao = new Chart(ctxEvolucao, {
            type: 'line',
            data: {
                labels: Object.keys(porMes),
                datasets: [{
                    label: 'Qtd. Atestados',
                    data: Object.values(porMes),
                    borderColor: '#0d6efd',
                    tension: 0.3,
                    fill: true,
                    backgroundColor: 'rgba(13, 110, 253, 0.1)'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. Distribuição por Tipo
    const ctxTipo = document.getElementById('chart-atest-tipo')?.getContext('2d');
    if (ctxTipo) {
        const porTipo = {};
        dados.forEach(d => {
            const tipo = d.tipo || 'Outros';
            porTipo[tipo] = (porTipo[tipo] || 0) + 1;
        });

        if (chartAtestTipo) chartAtestTipo.destroy();
        chartAtestTipo = new Chart(ctxTipo, {
            type: 'doughnut',
            data: {
                labels: Object.keys(porTipo),
                datasets: [{
                    data: Object.values(porTipo),
                    backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. Top Setores (Dias Perdidos)
    const ctxSetores = document.getElementById('chart-atest-setores')?.getContext('2d');
    if (ctxSetores) {
        const porSetor = {};
        dados.forEach(d => {
            const setor = d.setor || 'N/A';
            porSetor[setor] = (porSetor[setor] || 0) + (parseInt(d.dias) || 0);
        });

        const sortedSetores = Object.entries(porSetor).sort((a, b) => b[1] - a[1]).slice(0, 5);

        if (chartAtestSetores) chartAtestSetores.destroy();
        chartAtestSetores = new Chart(ctxSetores, {
            type: 'bar',
            data: {
                labels: sortedSetores.map(i => i[0]),
                datasets: [{
                    label: 'Dias Perdidos',
                    data: sortedSetores.map(i => i[1]),
                    backgroundColor: '#f6c23e'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
        });
    }
}

// Exportar funções para o escopo global
window.inicializarAnaliseAtestados = inicializarAnaliseAtestados;
window.carregarDashboardAtestados = carregarDashboardAtestados;