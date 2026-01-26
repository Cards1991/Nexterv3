// ========================================
// Módulo: Jurídico - Dashboard
// ========================================

let juridicoPerformanceChart = null; // Variável para guardar a instância do gráfico
let juridicoCargaChart = null;

async function inicializarDashboardJuridico() {
    console.log("Inicializando Dashboard Jurídico...");

    try {
        const processosSnap = await db.collection('processos_juridicos').get();
        const processos = processosSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        // 1. Métricas Principais
        const ativos = processos.filter(p => p.status === 'Ativo');

        // 2. Tabela de Processos Críticos (Risco Alto)
        const criticos = ativos.filter(p => p.riscoGeral === 'Alto').slice(0, 5);
        const tbodyCriticos = document.getElementById('jur-dash-processos-criticos');
        tbodyCriticos.innerHTML = '';
        
        if (criticos.length === 0) {
            tbodyCriticos.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum processo crítico identificado.</td></tr>';
        } else {
            criticos.forEach(p => {
                const dataPrazo = p.dataConciliacao ? (p.dataConciliacao.toDate ? p.dataConciliacao.toDate() : new Date(p.dataConciliacao)) : null;
                const prazoStr = dataPrazo ? dataPrazo.toLocaleDateString('pt-BR') : 'Sem prazo';
                
                tbodyCriticos.innerHTML += `
                    <tr>
                        <td>${p.numeroProcesso || 'N/A'}</td>
                        <td>${p.cliente || 'N/A'}</td>
                        <td><span class="badge bg-danger">Alto</span></td>
                        <td>${prazoStr}</td>
                        <td>R$ ${(p.valorCausa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                `;
            });
        }

        // 3. Gráfico de Performance (Por Tipo de Ação)
        const tipos = {};
        ativos.forEach(p => {
            const tipo = p.tipoAcao || 'Outros';
            tipos[tipo] = (tipos[tipo] || 0) + 1;
        });
        
        renderizarGraficoPerformance(tipos);
        
        // 4. Gráfico de Carga de Trabalho (Processos por Mês de Distribuição)
        const carga = {};
        ativos.forEach(p => {
            if (p.dataDistribuicao) {
                const data = p.dataDistribuicao.toDate ? p.dataDistribuicao.toDate() : new Date(p.dataDistribuicao);
                const mes = data.toLocaleString('pt-BR', { month: 'short' });
                carga[mes] = (carga[mes] || 0) + 1;
            }
        });
        renderizarGraficoCarga(carga);

        // 5. Popular Autopilot (Alertas)
        populateAutopilot(ativos);

        // 6. Popular Insights IA
        populateInsights(processos);

    } catch (error) {
        console.error("Erro ao carregar dashboard jurídico:", error);
    }
}

function renderizarGraficoPerformance(dados) {
    const ctx = document.getElementById('jur-dash-grafico-performance')?.getContext('2d');
    if (!ctx) return;

    if (juridicoPerformanceChart) juridicoPerformanceChart.destroy();

    juridicoPerformanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dados),
            datasets: [{
                data: Object.values(dados),
                backgroundColor: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#3a0ca3'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderizarGraficoCarga(dados) {
    const ctx = document.getElementById('jur-dash-grafico-carga')?.getContext('2d');
    if (!ctx) return;

    if (juridicoCargaChart) juridicoCargaChart.destroy();

    juridicoCargaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(dados),
            datasets: [{
                label: 'Novos Processos',
                data: Object.values(dados),
                backgroundColor: '#4361ee',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function populateAutopilot(ativos) {
    const container = document.getElementById('jur-dash-autopilot-container');
    if (!container) return;

    const hoje = new Date();
    const tresDias = new Date();
    tresDias.setDate(hoje.getDate() + 3);

    const alertas = [];

    ativos.forEach(p => {
        // Verificar prazos próximos (3 dias)
        const dataC = p.dataConciliacao ? (p.dataConciliacao.toDate ? p.dataConciliacao.toDate() : new Date(p.dataConciliacao)) : null;
        const dataI = p.dataInstrucao ? (p.dataInstrucao.toDate ? p.dataInstrucao.toDate() : new Date(p.dataInstrucao)) : null;

        if (dataC && dataC >= hoje && dataC <= tresDias) {
            alertas.push({ tipo: 'prazo', msg: `Audiência de Conciliação em breve: ${p.numeroProcesso || 'S/N'}`, id: p.id });
        }
        if (dataI && dataI >= hoje && dataI <= tresDias) {
            alertas.push({ tipo: 'prazo', msg: `Audiência de Instrução em breve: ${p.numeroProcesso || 'S/N'}`, id: p.id });
        }

        // Verificar alto risco
        if (p.riscoGeral === 'Alto') {
            alertas.push({ tipo: 'risco', msg: `Processo de Alto Risco requer atenção: ${p.numeroProcesso || 'S/N'}`, id: p.id });
        }
    });

    if (alertas.length === 0) {
        container.innerHTML = '<p class="text-muted text-center my-3"><i class="fas fa-check-circle text-success me-2"></i> Nenhuma ação prioritária no momento.</p>';
        return;
    }

    let html = '<ul class="list-group list-group-flush">';
    alertas.slice(0, 5).forEach(alerta => {
        const icon = alerta.tipo === 'prazo' ? 'fa-clock text-warning' : 'fa-exclamation-circle text-danger';
        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                <div><i class="fas ${icon} me-2"></i> ${alerta.msg}</div>
                <button class="btn btn-sm btn-outline-primary" onclick="visualizarProcessoCompacto('${alerta.id}')"><i class="fas fa-eye"></i></button>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function populateInsights(processos) {
    const container = document.getElementById('jur-dash-insights-ia');
    if (!container) return;

    const ativos = processos.filter(p => p.status === 'Ativo');
    const total = ativos.length;

    if (total === 0) {
        container.innerHTML = '<p class="text-muted">Sem dados suficientes para insights.</p>';
        return;
    }

    // 1. Análise de Valores e Risco
    let totalValorCausa = 0;
    let totalValorRiscoAlto = 0;
    const impactoPorPedido = {};

    ativos.forEach(p => {
        totalValorCausa += (parseFloat(p.valorCausa) || 0);
        
        if (p.pedidos && Array.isArray(p.pedidos)) {
            p.pedidos.forEach(item => {
                const valorItem = parseFloat(item.valor) || 0;
                if (item.risco === 'Alto') {
                    totalValorRiscoAlto += valorItem;
                    // Agrupa por nome do pedido
                    impactoPorPedido[item.pedido] = (impactoPorPedido[item.pedido] || 0) + valorItem;
                }
            });
        }
    });

    // Top 3 ofensores (pedidos com maior valor em risco alto)
    const topOfensores = Object.entries(impactoPorPedido)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    // 2. Análise de Tipos (existente)
    const porTipo = {};
    ativos.forEach(p => {
        const tipo = p.tipoAcao || 'Outros';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    const tipoDominante = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];

    // Construção do HTML
    let html = '<ul class="list-unstyled mb-0">';
    
    // Valor Total da Carteira
    html += `<li class="mb-3"><div class="d-flex align-items-center mb-1"><i class="fas fa-wallet text-primary me-2"></i> <strong>Valor da Carteira Ativa:</strong></div><span class="h5 text-dark">R$ ${totalValorCausa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></li>`;

    // Exposição ao Risco
    const percRisco = totalValorCausa > 0 ? ((totalValorRiscoAlto / totalValorCausa) * 100).toFixed(1) : 0;
    html += `<li class="mb-3"><div class="d-flex align-items-center mb-1"><i class="fas fa-chart-line text-danger me-2"></i> <strong>Exposição ao Risco (Alto):</strong></div><span class="h6 text-danger">R$ ${totalValorRiscoAlto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span><small class="text-muted ms-2">(${percRisco}% do total)</small></li>`;

    // Top Ofensores
    if (topOfensores.length > 0) {
        html += `<li class="mb-3"><div class="d-flex align-items-center mb-1"><i class="fas fa-bullseye text-warning me-2"></i> <strong>Maiores Impactos de Risco:</strong></div><ul class="ps-3 small text-muted">`;
        topOfensores.forEach(([pedido, valor]) => {
            html += `<li>${pedido}: R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</li>`;
        });
        html += `</ul></li>`;
    }

    // Tipo Dominante
    if (tipoDominante) {
        html += `<li class="mb-2"><i class="fas fa-lightbulb text-info me-2"></i> A maior demanda é <strong>${tipoDominante[0]}</strong> (${((tipoDominante[1]/total)*100).toFixed(0)}% dos casos).</li>`;
    }
    
    html += '</ul>';
    container.innerHTML = html;
}