// ========================================
// Módulo: Análise de Pessoas (People Analytics)
// ========================================
let chartsPessoas = {}; // Armazena instâncias dos gráficos para destruí-los depois

// Função para limpar todos os gráficos
function limparGraficosPessoas() {
    Object.values(chartsPessoas).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    chartsPessoas = {};
}

async function inicializarAnalisePessoas() {
    const container = document.getElementById('dashboard-analise-pessoas');
    if (!container) return;

    // Limpa gráficos anteriores antes de criar novos
    limparGraficosPessoas();

    // Mostra um spinner enquanto os dados são carregados e a estrutura é montada
    container.innerHTML = `
        <div class="text-center p-5">
            <i class="fas fa-spinner fa-spin fa-3x"></i>
            <p class="mt-3">Analisando dados de pessoas...</p>
        </div>
    `;

    try {
        const [funcionariosSnap, empresasSnap, movimentacoesSnap] = await Promise.all([
            db.collection('funcionarios').get(), // Busca funcionários
            db.collection('empresas').get(),     // Busca empresas para mapear nomes e IDs
            db.collection('movimentacoes').get()
        ]);

        const todosFuncionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const movimentacoes = movimentacoesSnap.docs.map(doc => doc.data());

        if (todosFuncionarios.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Nenhum funcionário encontrado para análise.</p>';
            return;
        }

        // Mapeia os nomes das empresas para facilitar a exibição
        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));

        // Após buscar os dados, constrói a estrutura HTML do dashboard
        // ESTA SEÇÃO FOI COMPLETAMENTE REESTILIZADA
        // O HTML é inserido aqui para que os elementos existam antes do JS tentar preenchê-los
        container.innerHTML = `
            <!-- Linha 1: KPIs Principais -->
            <div class="row mb-4" id="analise-pessoas-kpis"></div>

            <!-- Linha 2: Insights da IA e KPIs Secundários -->
            <div class="row">
                <!-- Coluna Esquerda: Insights -->
                <div class="col-lg-8 mb-4">
                    <div class="card ai-analysis h-100 border-primary">
                        <div class="card-header bg-gradient-primary text-white">
                            <h5 class="mb-0"><i class="fas fa-robot"></i> Insights Estratégicos e Sugestões</h5>
                        </div>
                        <div class="card-body" id="analise-pessoas-insights-ia">
                            <p class="text-muted">Aguardando dados para gerar insights...</p>
                        </div>
                    </div>
                </div>
                <!-- Coluna Direita: KPIs Secundários -->
                <div class="col-lg-4 mb-4">
                    <div class="row">
                        <div class="col-12 mb-4">
                            <div class="card stat-card h-100 bg-gradient-danger text-white">
                                <div class="card-body">
                                    <i class="fas fa-exchange-alt fa-2x opacity-50"></i>
                                    <div class="number" id="kpi-turnover">0%</div>
                                    <div class="label">Turnover (12m)</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="card stat-card h-100 bg-gradient-secondary text-white">
                                <div class="card-body">
                                    <i class="fas fa-user-check fa-2x opacity-50"></i>
                                    <div class="number" id="kpi-ativos-desligados">0 / 0</div>
                                    <div class="label">Ativos / Desligados</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Linha 3: Gráficos Demográficos -->
            <div class="row">
                <div class="col-lg-7 mb-4">
                    <div class="card h-100"><div class="card-header">Distribuição por Empresa</div><div class="card-body position-relative" style="height: 350px;"><canvas id="grafico-pessoas-empresa"></canvas></div></div>
                </div>
                <div class="col-lg-5 mb-4">
                    <div class="card h-100"><div class="card-header">Distribuição por Gênero</div><div class="card-body position-relative" style="height: 350px;"><canvas id="grafico-pessoas-genero"></canvas></div></div>
                </div>
            </div>

            <!-- Linha 4: Gráfico de Cargos -->
            <div class="row">
                <div class="col-12 mb-4">
                    <div class="card"><div class="card-header">Proporção de Cargos</div><div class="card-body position-relative" style="height: 400px;"><canvas id="grafico-pessoas-cargos"></canvas></div></div>
                </div>
            </div>

            <!-- Linha 5: Tabelas de Ranking -->
            <div class="row" id="tabelas-analise-pessoas">
                <div class="col-lg-12 mb-4">
                    <div class="card h-100">
                        <div class="card-header">Ranking de Tempo de Empresa</div>
                        <div class="card-body table-responsive" style="max-height: 400px;"><table class="table table-sm table-hover"><thead class="table-light sticky-top"><tr><th>Funcionário</th><th>Tempo de Casa</th></tr></thead><tbody id="tabela-pessoas-ranking-tempo"></tbody></table></div>
                    </div>
                </div>
                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header">Top 10 Maiores Salários</div>
                        <div class="card-body table-responsive" style="max-height: 400px;"><table class="table table-sm table-hover"><thead class="table-light sticky-top"><tr><th>Funcionário</th><th>Salário</th></tr></thead><tbody id="tabela-pessoas-top-salarios"></tbody></table></div>
                    </div>
                </div>
                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header">Top 10 Menores Salários</div>
                        <div class="card-body table-responsive" style="max-height: 400px;"><table class="table table-sm table-hover"><thead class="table-light sticky-top"><tr><th>Funcionário</th><th>Salário</th></tr></thead><tbody id="tabela-pessoas-bottom-salarios"></tbody></table></div>
                    </div>
                </div>
            </div>

            <!-- Outras Análises -->
            <div id="analise-pessoas-outros"></div>
        `;

        // Adiciona o nome da empresa aos funcionários para o cálculo de distribuição
        const funcionariosComEmpresaNome = todosFuncionarios.map(f => ({
            ...f,
            empresaNome: empresasMap.get(f.empresaId) || 'Sem Empresa'
        }));

        const funcionariosAtivos = funcionariosComEmpresaNome.filter(f => f.status === 'Ativo');

        // --- 1. Calcular Métricas ---
        const idadeMedia = calcularIdadeMedia(funcionariosAtivos);
        const salarioMedio = calcularSalarioMedio(funcionariosAtivos);
        const tempoMedioEmpresa = calcularTempoMedioEmpresa(funcionariosAtivos);
        const turnoverRate = calcularTurnover(funcionariosComEmpresaNome, movimentacoes);
        const totalAtivos = funcionariosAtivos.length;
        const totalDesligados = todosFuncionarios.length - totalAtivos;

        // --- 2. Renderizar KPIs ---
        renderizarKPIsPessoas(totalAtivos, idadeMedia, tempoMedioEmpresa, salarioMedio);
        renderizarKPIsSecundarios(turnoverRate, totalAtivos, totalDesligados);

        // --- 3. Calcular e Renderizar Gráficos e Tabelas --- (sem delay, pois o HTML já foi inserido)
        const dadosGenero = calcularDistribuicao(funcionariosAtivos, 'sexo');            
        const dadosEmpresa = calcularDistribuicao(funcionariosAtivos, 'empresaNome');
        const dadosCargo = calcularDistribuicao(funcionariosAtivos, 'cargo');            

        renderizarGraficoPizza('grafico-pessoas-genero', 'Distribuição por Gênero', dadosGenero);
        renderizarGraficoBarras('grafico-pessoas-empresa', 'Distribuição por Empresa', dadosEmpresa);
        renderizarGraficoPizza('grafico-pessoas-cargos', 'Proporção de Cargos', dadosCargo);
            renderizarTabelaRanking('tabela-pessoas-ranking-tempo', calcularRankingTempoEmpresa(funcionariosAtivos)); // Reativado
            renderizarTabelaSalarios('tabela-pessoas-top-salarios', calcularTopSalarios(funcionariosAtivos, 10));
            renderizarTabelaSalarios('tabela-pessoas-bottom-salarios', calcularBottomSalarios(funcionariosAtivos, 10));
            
            // --- 4. Insights, Inconsistências e Outras Análises ---
            gerarInsightsEstrategicos(turnoverRate, idadeMedia, salarioMedio);
            sinalizarInconsistencias(todosFuncionarios);
            renderizarOutrasAnalises(movimentacoes, funcionariosAtivos); // Passa funcionáriosAtivos para análises futuras

    } catch (error) {
        console.error("Erro ao gerar dashboard de análise de pessoas:", error);
        container.innerHTML = '<p class="text-center text-danger">Falha ao carregar o dashboard de Análise de Pessoas.</p>';
    }
}

function renderizarKPIsPessoas(total, idade, tempo, salario) {
    const container = document.getElementById('analise-pessoas-kpis');
    if (!container) return;
    
    container.innerHTML = `
        <div class="col-lg-3 col-md-6 mb-4">
            <div class="card stat-card h-100 bg-gradient-primary text-white">
                <div class="card-body">
                    <i class="fas fa-users fa-2x opacity-50"></i>
                    <div class="number">${total}</div>
                    <div class="label">Funcionários Ativos</div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-4">
            <div class="card stat-card h-100 bg-gradient-info text-white">
                <div class="card-body">
                    <i class="fas fa-birthday-cake fa-2x opacity-50"></i>
                    <div class="number">${idade.toFixed(1)}</div>
                    <div class="label">Idade Média</div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-4">
            <div class="card stat-card h-100 bg-gradient-success text-white">
                <div class="card-body">
                    <i class="fas fa-business-time fa-2x opacity-50"></i>
                    <div class="number">${tempo}</div>
                    <div class="label">Tempo Médio de Casa</div>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-4">
            <div class="card stat-card h-100 bg-gradient-warning text-white">
                <div class="card-body">
                    <i class="fas fa-money-bill-wave fa-2x opacity-50"></i>
                    <div class="number">R$ ${salario.toFixed(2).replace('.', ',')}</div>
                    <div class="label">Salário Médio</div>
                </div>
            </div>
        </div>
    `;
}

function renderizarKPIsSecundarios(turnover, totalAtivos, totalDesligados) {
    const turnoverEl = document.getElementById('kpi-turnover');
    const ativosDesligadosEl = document.getElementById('kpi-ativos-desligados');

    if (turnoverEl) turnoverEl.textContent = `${turnover.toFixed(1)}%`;
    if (ativosDesligadosEl) ativosDesligadosEl.textContent = `${totalAtivos} / ${totalDesligados}`;
}

// --- Funções de Cálculo ---

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
    
    const funcionariosNoInicio = todosFuncionarios.filter(f => {
        const dataAdmissao = f.dataAdmissao?.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao);
        return dataAdmissao < dozeMesesAtras;
    }).length;
    
    const funcionariosNoFim = todosFuncionarios.filter(f => f.status === 'Ativo').length;
    const mediaFuncionarios = (funcionariosNoInicio + funcionariosNoFim) / 2;

    const demissoesNoPeriodo = movimentacoes.filter(mov => {
        if (mov.tipo !== 'demissao') return false;
        const dataMov = mov.data?.toDate ? mov.data.toDate() : new Date(mov.data);
        return dataMov >= dozeMesesAtras;
    }).length;

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
        return { 
            nome: f.nome, 
            tempoEmDias: diffMs, 
            tempoFormatado: `${anos > 0 ? anos + 'a ' : ''}${meses}m` 
        };
    }).sort((a, b) => b.tempoEmDias - a.tempoEmDias);
}

function calcularTopSalarios(funcionarios, count) {
    return funcionarios
        .filter(f => f.salario && !isNaN(f.salario))
        .sort((a, b) => b.salario - a.salario)
        .slice(0, count)
        .map(f => ({ nome: f.nome, salario: f.salario }));
}

function calcularBottomSalarios(funcionarios, count) {
    return funcionarios
        .filter(f => f.salario && !isNaN(f.salario) && f.salario > 0)
        .sort((a, b) => a.salario - b.salario)
        .slice(0, count)
        .map(f => ({ nome: f.nome, salario: f.salario }));
}

// --- Funções de Renderização ---

function renderizarGraficoPizza(canvasId, titulo, dados) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`Canvas ${canvasId} não encontrado`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Destrói gráfico anterior se existir
    if (chartsPessoas[canvasId]) {
        chartsPessoas[canvasId].destroy();
        delete chartsPessoas[canvasId];
    }

    // Verifica se há dados para mostrar
    const valores = Object.values(dados);
    const soma = valores.reduce((a, b) => a + b, 0);
    
    if (soma === 0) {
        canvas.style.display = 'none';
        const parent = canvas.parentElement;
        const message = document.createElement('p');
        message.className = 'text-muted text-center';
        message.textContent = 'Não há dados para exibir';
        parent.appendChild(message);
        return;
    }

    try {
        chartsPessoas[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: Object.keys(dados), 
                datasets: [{ 
                    data: valores, 
                    backgroundColor: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#adb5bd', '#2ec4b6', '#7209b7', '#3a0ca3', '#4a4e69'],
                    borderWidth: 1
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: titulo
                    }
                } 
            }
        });
    } catch (error) {
        console.error(`Erro ao criar gráfico ${canvasId}:`, error);
    }
}

function renderizarGraficoBarras(canvasId, titulo, dados) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`Canvas ${canvasId} não encontrado`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Destrói gráfico anterior se existir
    if (chartsPessoas[canvasId]) {
        chartsPessoas[canvasId].destroy();
        delete chartsPessoas[canvasId];
    }

    // Verifica se há dados para mostrar
    const labels = Object.keys(dados);
    const valores = Object.values(dados);
    const soma = valores.reduce((a, b) => a + b, 0);
    
    if (soma === 0) {
        canvas.style.display = 'none';
        const parent = canvas.parentElement;
        const message = document.createElement('p');
        message.className = 'text-muted text-center';
        message.textContent = 'Não há dados para exibir';
        parent.appendChild(message);
        return;
    }

    try {
        chartsPessoas[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Nº de Funcionários', 
                    data: valores, 
                    backgroundColor: [
                        'rgba(67, 97, 238, 0.7)',
                        'rgba(247, 37, 133, 0.7)',
                        'rgba(76, 201, 240, 0.7)',
                        'rgba(248, 150, 30, 0.7)',
                        'rgba(173, 181, 189, 0.7)',
                        'rgba(46, 196, 182, 0.7)',
                        'rgba(114, 9, 183, 0.7)',
                        'rgba(58, 12, 163, 0.7)'
                    ],
                    borderColor: [
                        'rgba(67, 97, 238, 1)',
                        'rgba(247, 37, 133, 1)',
                        'rgba(76, 201, 240, 1)',
                        'rgba(248, 150, 30, 1)',
                        'rgba(173, 181, 189, 1)',
                        'rgba(46, 196, 182, 1)',
                        'rgba(114, 9, 183, 1)',
                        'rgba(58, 12, 163, 1)'
                    ],
                    borderWidth: 1
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: false 
                    },
                    title: {
                        display: true,
                        text: titulo,
                        font: {
                            size: 16
                        }
                    }
                }, 
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Número de Funcionários'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Setores'
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            } 
        });
    } catch (error) {
        console.error(`Erro ao criar gráfico ${canvasId}:`, error);
    }
}

function renderizarTabelaRanking(tableId, data) {
    const tbody = document.getElementById(tableId);
    if (!tbody) { console.warn(`Tabela com id ${tableId} não encontrada.`); return; }
    tbody.innerHTML = data.length > 0 ? 
        data.map(item => `<tr><td>${item.nome}</td><td>${item.tempoFormatado}</td></tr>`).join('') : 
        '<tr><td colspan="2" class="text-center text-muted">N/A</td></tr>';
}

function renderizarTabelaSalarios(tableId, data) {
    const tbody = document.getElementById(tableId);
    if (!tbody) { console.warn(`Tabela com id ${tableId} não encontrada.`); return; }
    tbody.innerHTML = data.length > 0 ? 
        data.map(item => `<tr><td>${item.nome}</td><td>R$ ${item.salario.toFixed(2).replace('.', ',')}</td></tr>`).join('') : 
        '<tr><td colspan="2" class="text-center text-muted">N/A</td></tr>';
}

function renderizarOutrasAnalises(movimentacoes, funcionarios) {
    const container = document.getElementById('analise-pessoas-outros');
    if (!container) return;
    
    let html = '';

    // Mapa de Calor de Desligamento
    const motivosDesligamento = calcularDistribuicao(movimentacoes.filter(m => m.tipo === 'demissao'), 'motivo');
    const sortedMotivos = Object.entries(motivosDesligamento).sort(([, a], [, b]) => b - a);
    html += '<div class="row"><div class="col-lg-12 mb-4"><div class="card h-100"><div class="card-header">Mapa de Calor por Motivo de Desligamento</div><div class="card-body">';
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

    // Distribuição Geográfica (Placeholder)
    html += '<div class="row"><div class="col-lg-12 mb-4"><div class="card h-100"><div class="card-header">Distribuição Geográfica</div><div class="card-body"><p class="text-muted">Dados de localização (cidade/estado) não disponíveis nos registros dos funcionários para análise.</p></div></div></div></div>';

    // Correlação (Placeholder)
    html += '<div class="row"><div class="col-lg-12 mb-4"><div class="card h-100"><div class="card-header">Correlação entre Salário, Idade e Tempo de Casa</div><div class="card-body"><p class="text-muted">Análise de correlação requer bibliotecas estatísticas e será implementada futuramente.</p></div></div></div></div>';

    container.innerHTML = html;
}

// --- Insights e Validações ---

function gerarInsightsEstrategicos(turnoverRate, idadeMedia, salarioMedio) {
    const container = document.getElementById('analise-pessoas-insights-ia');
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
    
    insightsHTML += '</ul><h6><i class="fas fa-lightbulb"></i> Sugestões de Novos Indicadores</h6><ul><li>Absenteísmo</li><li>Engajamento (eNPS)</li><li>Diversidade e Inclusão</li></ul>';

    container.innerHTML = insightsHTML;
}

function sinalizarInconsistencias(todosFuncionarios) {
    const container = document.getElementById('analise-pessoas-insights-ia');
    if (!container) return;

    let inconsistencias = [];
    todosFuncionarios.forEach(f => {
        if (!f.dataNascimento) inconsistencias.push(`Funcionário <strong>${f.nome}</strong> não possui Data de Nascimento.`);
        if (!f.dataAdmissao) inconsistencias.push(`Funcionário <strong>${f.nome}</strong> não possui Data de Admissão.`);
        if (!f.salario || isNaN(f.salario)) inconsistencias.push(`Funcionário <strong>${f.nome}</strong> possui Salário inválido.`);
        if (!f.setor) inconsistencias.push(`Funcionário <strong>${f.nome}</strong> não possui Setor informado.`);
        if (!f.cargo) inconsistencias.push(`Funcionário <strong>${f.nome}</strong> não possui Cargo informado.`);
    });

    // Pega apenas as 5 primeiras para não poluir a tela
    const amostraInconsistencias = [...new Set(inconsistencias)].slice(0, 5);

    if (amostraInconsistencias.length > 0) {
        let html = '<h6 class="mt-4 text-warning"><i class="fas fa-exclamation-triangle"></i> Sinalização de Dados Incompletos</h6><ul>';
        amostraInconsistencias.forEach(msg => {
            html += `<li>${msg}</li>`;
        });
        if (inconsistencias.length > 5) {
            html += `<li>E mais ${inconsistencias.length - 5} outros problemas...</li>`;
        }
        html += '</ul>';
        container.innerHTML += html;
    }
}

// Função auxiliar para debug - verifique se está sendo chamada
function debugGraficos() {
    console.log('Gráficos ativos:', Object.keys(chartsPessoas));
    Object.entries(chartsPessoas).forEach(([id, chart]) => {
        console.log(`Gráfico ${id}:`, chart ? 'Criado' : 'Não criado');
    });
}

// Exportar as funções para que possam ser chamadas em app.js
window.inicializarAnalisePessoas = inicializarAnalisePessoas;
window.limparGraficosPessoas = limparGraficosPessoas;
window.debugGraficos = debugGraficos;