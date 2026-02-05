// Gerenciamento do Dashboard de Análise de Manutenção
let chartRankingMaquinas = null;
let chartTiposManutencao = null;

// Inicializa o dashboard
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

// Processa os dados do dashboard
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
        // Busca chamados concluídos no período
        const snap = await db.collection('manutencao_chamados')
            .where('status', '==', 'Concluído')
            .where('dataEncerramento', '>=', dataInicio)
            .where('dataEncerramento', '<=', dataFim)
            .get();

        const chamados = snap.docs.map(doc => doc.data());

        // Busca chamados abertos/em andamento
        const openSnap = await db.collection('manutencao_chamados')
            .where('status', 'in', ['Aberto', 'Em Andamento'])
            .get();
        const openChamados = openSnap.docs.map(doc => doc.data());
        const urgentChamados = openChamados.filter(c => c.prioridade === 'Urgente' || c.prioridade === 'Alta');

        // Renderiza os componentes do dashboard
        renderizarMetricas(chamados, openChamados.length, urgentChamados.length);
        renderizarGraficoRanking(chamados);
        renderizarGraficoTipos(chamados);
        gerarAnaliseIaManutencao(chamados);

    } catch (error) {
        console.error("Erro ao processar dados do dashboard de manutenção:", error);
        mostrarMensagem("Erro ao carregar dados do dashboard.", "error");
    }
}

// Função auxiliar para parse do tempo de parada
function parseTempoParada(tempoParada) {
    if (!tempoParada) return 0;
    
    let minutos = 0;
    const matchHoras = tempoParada.match(/(\d+)h/);
    const matchMinutos = tempoParada.match(/(\d+)m/);
    
    if (matchHoras) minutos += parseInt(matchHoras[1]) * 60;
    if (matchMinutos) minutos += parseInt(matchMinutos[1]);
    
    return minutos;
}

// Renderiza as métricas do dashboard
function renderizarMetricas(chamados, totalAbertos, totalUrgentes) {
    const container = document.getElementById('dash-manut-metricas');
    
    if (!container) {
        console.error('Elemento dash-manut-metricas não encontrado');
        return;
    }

    if (!Array.isArray(chamados)) {
        console.error('chamados não é um array');
        return;
    }

    const totalChamados = chamados.length;
    
    // Calcula o tempo total de parada
    let tempoTotalParadaMinutos = 0;
    chamados.forEach(c => {
        tempoTotalParadaMinutos += parseTempoParada(c.tempoParada);
    });

    // Calcula o tempo médio de parada
    const tempoMedioMinutos = totalChamados > 0 ? (tempoTotalParadaMinutos / totalChamados) : 0;

    // Formata o tempo para exibição
    const formatarTempo = (minutos) => {
        const h = Math.floor(minutos / 60);
        const m = Math.round(minutos % 60);
        if (h > 0 && m > 0) {
            return `${h}h ${m}m`;
        } else if (h > 0) {
            return `${h}h`;
        } else {
            return `${m}m`;
        }
    };

    // Renderiza as métricas
    container.innerHTML = `
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-warning text-dark">
                <div class="card-body text-center">
                    <i class="fas fa-exclamation-circle fa-2x opacity-50 mb-2"></i>
                    <div class="number display-6 fw-bold">${totalAbertos}</div>
                    <div class="label text-uppercase small">Chamados em Aberto</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-danger text-white">
                <div class="card-body text-center">
                    <i class="fas fa-fire fa-2x opacity-50 mb-2"></i>
                    <div class="number display-6 fw-bold">${totalUrgentes}</div>
                    <div class="label text-uppercase small">Chamados Urgentes</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-info text-white">
                <div class="card-body text-center">
                    <i class="fas fa-tools fa-2x opacity-50 mb-2"></i>
                    <div class="number display-6 fw-bold">${totalChamados}</div>
                    <div class="label text-uppercase small">Total Concluídos</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-success text-white">
                <div class="card-body text-center">
                    <i class="fas fa-clock fa-2x opacity-50 mb-2"></i>
                    <div class="number display-6 fw-bold">${formatarTempo(tempoMedioMinutos)}</div>
                    <div class="label text-uppercase small">Tempo Médio de Parada</div>
                </div>
            </div>
        </div>
    `;
}

// Renderiza o gráfico de ranking de máquinas
function renderizarGraficoRanking(chamados) {
    const canvas = document.getElementById('grafico-ranking-maquinas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Agrupa chamados por máquina
    const contagemPorMaquina = chamados.reduce((acc, c) => {
        if (c.maquinaId) {
            acc[c.maquinaId] = (acc[c.maquinaId] || 0) + 1;
        }
        return acc;
    }, {});

    // Ordena e pega as top 7
    const sorted = Object.entries(contagemPorMaquina)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 7);
    
    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);

    // Destrói gráfico anterior se existir
    if (chartRankingMaquinas) {
        chartRankingMaquinas.destroy();
    }

    // Cria novo gráfico
    chartRankingMaquinas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Chamados',
                data: data,
                backgroundColor: 'rgba(67, 97, 238, 0.7)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: false 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Chamados: ${context.parsed.x}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Número de Chamados'
                    }
                },
                y: {
                    ticks: {
                        autoSkip: false
                    }
                }
            }
        }
    });
}

// Renderiza o gráfico de tipos de manutenção
function renderizarGraficoTipos(chamados) {
    const canvas = document.getElementById('grafico-tipos-manutencao');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Agrupa por tipo de manutenção
    const contagemPorTipo = chamados.reduce((acc, c) => {
        const tipo = c.tipoManutencao || 'Não Classificado';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(contagemPorTipo);
    const data = Object.values(contagemPorTipo);

    // Paleta de cores
    const cores = ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#e63946', '#adb5bd', '#2a9d8f', '#e9c46a'];

    // Destrói gráfico anterior se existir
    if (chartTiposManutencao) {
        chartTiposManutencao.destroy();
    }

    // Cria novo gráfico
    chartTiposManutencao = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: labels.map((_, i) => cores[i % cores.length]),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.parsed / total) * 100);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Gera análise IA com base nos dados
function gerarAnaliseIaManutencao(chamados) {
    const container = document.getElementById('dash-manut-analise-ia');
    if (!container) return;

    if (!Array.isArray(chamados) || chamados.length === 0) {
        container.innerHTML = '<p class="text-muted">Sem dados suficientes para gerar uma análise neste período.</p>';
        return;
    }

    // 1. Encontrar a máquina com mais problemas
    const contagemPorMaquina = chamados.reduce((acc, c) => {
        if (c.maquinaId) {
            acc[c.maquinaId] = (acc[c.maquinaId] || 0) + 1;
        }
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

    // 3. Calcular tempo total de parada
    const tempoTotalParadaMinutos = chamados.reduce((acc, c) => {
        return acc + parseTempoParada(c.tempoParada);
    }, 0);

    // 4. Calcular tempo médio de resolução (se houver datas)
    let tempoMedioResolucaoMinutos = 0;
    const chamadosComDatas = chamados.filter(c => c.dataAbertura && c.dataEncerramento);
    if (chamadosComDatas.length > 0) {
        const totalTempoResolucao = chamadosComDatas.reduce((acc, c) => {
            const inicio = c.dataAbertura.toDate ? c.dataAbertura.toDate() : new Date(c.dataAbertura);
            const fim = c.dataEncerramento.toDate ? c.dataEncerramento.toDate() : new Date(c.dataEncerramento);
            return acc + (fim - inicio);
        }, 0);
        
        tempoMedioResolucaoMinutos = totalTempoResolucao / (chamadosComDatas.length * 60000); // minutos
    }

    // Gera a análise HTML
    let analiseHTML = '<div class="analise-ia">';
    
    if (maquinaMaisProblematica) {
        const porcentagem = Math.round((maquinaMaisProblematica[1] / chamados.length) * 100);
        analiseHTML += `
            <div class="analise-item mb-3">
                <div class="d-flex align-items-center mb-1">
                    <span class="badge bg-warning me-2">⚠️</span>
                    <h6 class="mb-0">Ponto de Atenção</h6>
                </div>
                <p class="mb-0">A máquina <strong>${maquinaMaisProblematica[0]}</strong> foi a que mais apresentou problemas, com <strong>${maquinaMaisProblematica[1]} chamados (${porcentagem}%)</strong> no período. Recomenda-se uma análise técnica aprofundada.</p>
            </div>`;
    }

    if (tipoMaisComum) {
        const porcentagem = Math.round((tipoMaisComum[1] / chamados.length) * 100);
        analiseHTML += `
            <div class="analise-item mb-3">
                <div class="d-flex align-items-center mb-1">
                    <span class="badge bg-info me-2">📊</span>
                    <h6 class="mb-0">Tendência de Serviço</h6>
                </div>
                <p class="mb-0">O tipo de manutenção mais comum foi <strong>"${tipoMaisComum[0]}"</strong>, correspondendo a <strong>${tipoMaisComum[1]} chamados (${porcentagem}%)</strong>.`;
        
        if (tipoMaisComum[0] === 'Corretiva' && porcentagem > 50) {
            analiseHTML += ` <span class="text-danger">Alto índice de manutenções corretivas pode indicar falhas no plano preventivo.</span>`;
        } else if (tipoMaisComum[0] === 'Preventiva') {
            analiseHTML += ` Bom sinal! A manutenção preventiva está sendo realizada.`;
        }
        
        analiseHTML += `</p></div>`;
    }

    // Análise de tempo
    const tempoTotalHoras = tempoTotalParadaMinutos / 60;
    analiseHTML += `
        <div class="analise-item mb-3">
            <div class="d-flex align-items-center mb-1">
                <span class="badge bg-danger me-2">⏱️</span>
                <h6 class="mb-0">Impacto na Produção</h6>
            </div>
            <p class="mb-0">Tempo total de parada: <strong>${Math.round(tempoTotalHoras * 10) / 10}h</strong>`;
    
    if (tempoTotalHoras > 8) {
        analiseHTML += ` <span class="text-warning">(Alto impacto - considere otimizar tempo de resposta)</span>`;
    } else if (tempoTotalHoras > 0) {
        analiseHTML += ` <span class="text-success">(Impacto controlado)</span>`;
    }
    
    if (tempoMedioResolucaoMinutos > 0) {
        const horasMedias = Math.floor(tempoMedioResolucaoMinutos / 60);
        const minutosMedios = Math.round(tempoMedioResolucaoMinutos % 60);
        analiseHTML += `<br>Tempo médio de resolução: <strong>${horasMedias > 0 ? horasMedias + 'h ' : ''}${minutosMedios}m</strong>`;
    }
    
    analiseHTML += `</p></div>`;

    // Recomendação geral
    analiseHTML += `
        <div class="analise-item">
            <div class="d-flex align-items-center mb-1">
                <span class="badge bg-success me-2">💡</span>
                <h6 class="mb-0">Recomendação</h6>
            </div>
            <p class="mb-0">${gerarRecomendacao(chamados, tempoTotalHoras)}</p>
        </div>`;

    analiseHTML += '</div>';
    container.innerHTML = analiseHTML;
}

// Função auxiliar para gerar recomendações
function gerarRecomendacao(chamados, tempoTotalHoras) {
    const totalChamados = chamados.length;
    
    if (totalChamados === 0) {
        return "Sem dados para análise.";
    }
    
    const chamadosCorretivos = chamados.filter(c => c.tipoManutencao === 'Corretiva').length;
    const porcentagemCorretivos = (chamadosCorretivos / totalChamados) * 100;
    
    let recomendacoes = [];
    
    if (porcentagemCorretivos > 60) {
        recomendacoes.push("Revise e intensifique o plano de manutenção preventiva");
    }
    
    if (tempoTotalHoras > 20) {
        recomendacoes.push("Otimize o tempo de resposta das equipes de manutenção");
    }
    
    if (totalChamados > 10) {
        recomendacoes.push("Considere treinamento específico para os tipos de falhas mais frequentes");
    }
    
    if (recomendacoes.length === 0) {
        return "Os indicadores estão dentro dos parâmetros esperados. Mantenha o bom trabalho!";
    }
    
    return recomendacoes.join(". ") + ".";
}

// Adiciona estilos CSS para a análise
function adicionarEstilosAnalise() {
    if (!document.querySelector('#estilos-analise-manutencao')) {
        const style = document.createElement('style');
        style.id = 'estilos-analise-manutencao';
        style.textContent = `
            .analise-ia {
                font-size: 0.95rem;
            }
            .analise-item {
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #4361ee;
            }
            .analise-item h6 {
                color: #495057;
            }
            .stat-card {
                transition: transform 0.3s ease;
                border: none;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .stat-card:hover {
                transform: translateY(-5px);
            }
            .stat-card .number {
                font-weight: 700;
                margin: 8px 0;
            }
            .stat-card .label {
                font-size: 0.85rem;
                letter-spacing: 0.5px;
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }
}

// Inicializa estilos quando o script carrega
document.addEventListener('DOMContentLoaded', function() {
    adicionarEstilosAnalise();
    
    // Inicializa o dashboard se o elemento existir
    if (document.getElementById('dash-manut-filtro-mes')) {
        inicializarDashboardManutencao();
    }
});