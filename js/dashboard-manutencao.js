// Gerenciamento do Dashboard de Análise de Manutenção
let chartRankingMaquinas = null;
let chartTiposManutencao = null;

async function inicializarDashboardManutencao() {
    const filtroMesInput = document.getElementById('dash-manut-filtro-mes');
    const hoje = new Date();
    filtroMesInput.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const btnAplicar = document.getElementById('btn-dash-manut-aplicar');
    if (btnAplicar && !btnAplicar.__bound) {
        btnAplicar.addEventListener('click', processarDadosDashboardManutencao);
        btnAplicar.__bound = true;
    }

    await processarDadosDashboardManutencao();
}

async function processarDadosDashboardManutencao() {
    const filtroMesInput = document.getElementById('dash-manut-filtro-mes').value;
    if (!filtroMesInput) {
        mostrarMensagem("Por favor, selecione um período (Mês/Ano).", "warning");
        return;
    }

    const [ano, mes] = filtroMesInput.split('-').map(Number);
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    try {
        const snap = await db.collection('manutencao_chamados')
            .where('status', '==', 'Concluído')
            .where('dataEncerramento', '>=', dataInicio)
            .where('dataEncerramento', '<=', dataFim)
            .get();

        const chamados = snap.docs.map(doc => doc.data());

        renderizarMetricas(chamados);
        renderizarGraficoRanking(chamados);
        renderizarGraficoTipos(chamados);
        gerarAnaliseIaManutencao(chamados);

    } catch (error) {
        console.error("Erro ao processar dados do dashboard de manutenção:", error);
        mostrarMensagem("Erro ao carregar dados do dashboard.", "error");
    }
}

function renderizarMetricas(chamados) {
    const container = document.getElementById('dash-manut-metricas');
    if (!container) return;

    const totalChamados = chamados.length;
    
    let tempoTotalParadaMinutos = 0;
    chamados.forEach(c => {
        if (c.tempoParada) {
            const partes = c.tempoParada.match(/(\d+)h|(\d+)m/g) || [];
            partes.forEach(p => {
                if (p.includes('h')) {
                    tempoTotalParadaMinutos += parseInt(p) * 60;
                } else if (p.includes('m')) {
                    tempoTotalParadaMinutos += parseInt(p);
                }
            });
        }
    });

    const tempoMedioMinutos = totalChamados > 0 ? (tempoTotalParadaMinutos / totalChamados) : 0;

    const formatarTempo = (minutos) => {
        const h = Math.floor(minutos / 60);
        const m = Math.round(minutos % 60);
        return `${h > 0 ? h + 'h ' : ''}${m}m`;
    };

    container.innerHTML = `
        <div class="col-md-4 mb-4"><div class="card stat-card"><div class="card-body"><i class="fas fa-tools text-primary"></i><div class="number">${totalChamados}</div><div class="label">Chamados Concluídos</div></div></div></div>
        <div class="col-md-4 mb-4"><div class="card stat-card"><div class="card-body"><i class="fas fa-clock text-danger"></i><div class="number">${formatarTempo(tempoTotalParadaMinutos)}</div><div class="label">Tempo Total de Parada</div></div></div></div>
        <div class="col-md-4 mb-4"><div class="card stat-card"><div class="card-body"><i class="fas fa-hourglass-half text-warning"></i><div class="number">${formatarTempo(tempoMedioMinutos)}</div><div class="label">Tempo Médio por Chamado</div></div></div></div>
    `;
}

function renderizarGraficoRanking(chamados) {
    const ctx = document.getElementById('grafico-ranking-maquinas')?.getContext('2d');
    if (!ctx) return;

    const contagemPorMaquina = chamados.reduce((acc, c) => {
        acc[c.maquinaId] = (acc[c.maquinaId] || 0) + 1;
        return acc;
    }, {});

    const sorted = Object.entries(contagemPorMaquina).sort(([, a], [, b]) => b - a).slice(0, 7);
    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);

    if (chartRankingMaquinas) chartRankingMaquinas.destroy();

    chartRankingMaquinas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Chamados',
                data: data,
                backgroundColor: 'rgba(67, 97, 238, 0.7)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderizarGraficoTipos(chamados) {
    const ctx = document.getElementById('grafico-tipos-manutencao')?.getContext('2d');
    if (!ctx) return;

    const contagemPorTipo = chamados.reduce((acc, c) => {
        const tipo = c.tipoManutencao || 'Não Classificado';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(contagemPorTipo);
    const data = Object.values(contagemPorTipo);

    if (chartTiposManutencao) chartTiposManutencao.destroy();

    chartTiposManutencao = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#e63946', '#adb5bd'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function gerarAnaliseIaManutencao(chamados) {
    const container = document.getElementById('dash-manut-analise-ia');
    if (!container) return;

    if (chamados.length === 0) {
        container.innerHTML = '<p class="text-muted">Sem dados suficientes para gerar uma análise neste período.</p>';
        return;
    }

    // 1. Encontrar a máquina com mais problemas
    const contagemPorMaquina = chamados.reduce((acc, c) => {
        acc[c.maquinaId] = (acc[c.maquinaId] || 0) + 1;
        return acc;
    }, {});
    const maquinaMaisProblematica = Object.entries(contagemPorMaquina).sort(([, a], [, b]) => b - a)[0];

    // 2. Encontrar o tipo de manutenção mais comum
    const contagemPorTipo = chamados.reduce((acc, c) => {
        const tipo = c.tipoManutencao || 'Não Classificado';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});
    const tipoMaisComum = Object.entries(contagemPorTipo).sort(([, a], [, b]) => b - a)[0];

    let analiseHTML = '<ul>';

    if (maquinaMaisProblematica) {
        analiseHTML += `<li><strong>Ponto de Atenção:</strong> A máquina <strong>${maquinaMaisProblematica[0]}</strong> foi a que mais apresentou problemas, com <strong>${maquinaMaisProblematica[1]}</strong> chamados no período. Recomenda-se uma análise aprofundada de suas condições ou a programação de uma manutenção preventiva mais rigorosa.</li>`;
    }

    if (tipoMaisComum) {
        analiseHTML += `<li><strong>Tendência de Serviço:</strong> O tipo de manutenção mais comum foi <strong>"${tipoMaisComum[0]}"</strong>, correspondendo a <strong>${tipoMaisComum[1]}</strong> chamados.`;
        if (tipoMaisComum[0] === 'Corretiva') {
            analiseHTML += ` Um alto índice de manutenções corretivas pode indicar falha no plano de manutenção preventiva.`;
        }
        analiseHTML += `</li>`;
    }

    const tempoTotalParadaMinutos = chamados.reduce((acc, c) => {
        if (c.tempoParada) {
            const horas = (c.tempoParada.match(/(\d+)h/) || [0,0])[1];
            const minutos = (c.tempoParada.match(/(\d+)m/) || [0,0])[1];
            return acc + (parseInt(horas) * 60) + parseInt(minutos);
        }
        return acc;
    }, 0);

    if (tempoTotalParadaMinutos > 480) { // Mais de 8 horas
        analiseHTML += `<li><strong>Impacto na Produção:</strong> O tempo total de parada das máquinas neste período foi significativo. Avalie se o tempo de resposta e de reparo pode ser otimizado para minimizar perdas.</li>`;
    }

    analiseHTML += '</ul>';
    container.innerHTML = analiseHTML;
}