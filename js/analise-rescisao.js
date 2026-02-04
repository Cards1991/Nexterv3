// Seção Análise de Rescisões

let chartsRescisao = {};

async function inicializarAnaliseRescisao() {
    try {
        // Buscar dados de demissões (Movimentações)
        const demissoesSnap = await db.collection('movimentacoes')
            .where('tipo', '==', 'demissao')
            .get();

        if (demissoesSnap.empty) {
            // Se não houver dados, não faz nada ou mostra aviso
            return;
        }

        // Coletar IDs dos funcionários para buscar dados complementares (como sexo)
        const funcionarioIds = demissoesSnap.docs.map(doc => doc.data().funcionarioId).filter(id => id);
        const funcionariosMap = new Map();
        
        // Buscar todos os funcionários para mapear nomes de gerentes
        const allFuncionariosSnap = await db.collection('funcionarios').get();
        const allFuncionariosMap = new Map();
        allFuncionariosSnap.forEach(doc => allFuncionariosMap.set(doc.id, doc.data().nome));

        const setoresSnap = await db.collection('setores').get();
        const setoresMap = new Map();
        setoresSnap.forEach(doc => {
            const setorData = doc.data();
            let gerenteNome = 'Gerente não definido';
            if (setorData.gerenteId) gerenteNome = allFuncionariosMap.get(setorData.gerenteId) || 'Gerente não encontrado';
            else if (setorData.gerenteResponsavel) gerenteNome = setorData.gerenteResponsavel;
            // Chave é a descrição do setor, valor é o nome do gerente
            setoresMap.set(setorData.descricao, gerenteNome);
        });


        // Buscar dados dos funcionários em lotes (chunks de 10)
        if (funcionarioIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < funcionarioIds.length; i += 10) {
                chunks.push(funcionarioIds.slice(i, i + 10));
            }
            
            for (const chunk of chunks) {
                const funcsSnap = await db.collection('funcionarios')
                    .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                    .get();
                funcsSnap.forEach(doc => {
                    funcionariosMap.set(doc.id, doc.data());
                });
            }
        }

        // Combinar dados
        const dadosCompletos = demissoesSnap.docs.map(doc => {
            const mov = doc.data();
            const func = funcionariosMap.get(mov.funcionarioId) || {};
            return {
                ...mov,
                sexo: func.sexo || 'Não Informado',
                setor: func.setor || 'Não Informado',
                dataDemissao: mov.data ? (mov.data.toDate ? mov.data.toDate() : new Date(mov.data)) : null
            };
        });

        // Aplicar filtros se houver (implementação futura dos botões de filtro)
        // Por enquanto usa todos os dados
        
        atualizarKPIsRescisao(dadosCompletos);
        gerarGraficosRescisao(dadosCompletos);
        gerarAnaliseSetores(dadosCompletos);
        gerarRankingLideranca(dadosCompletos, setoresMap);

    } catch (e) {
        console.error("Erro ao inicializar análise de rescisões:", e);
    }
}

function atualizarKPIsRescisao(dados) {
    const container = document.getElementById('analise-rescisao-kpis');
    if (!container) return;

    const total = dados.length;
    
    // Calcular turnover simplificado (apenas demissões no período)
    // Para turnover real precisaria do total de ativos médio
    
    // Motivo mais comum
    const motivos = contarOcorrencias(dados, 'motivo');
    const motivoPrincipal = Object.entries(motivos).sort((a,b) => b[1] - a[1])[0];

    container.innerHTML = `
        <div class="col-md-4">
            <div class="card stat-card bg-danger text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">Total de Desligamentos</h6>
                            <h2 class="mb-0">${total}</h2>
                        </div>
                        <i class="fas fa-user-minus fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card stat-card bg-warning text-dark h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">Principal Motivo</h6>
                            <h4 class="mb-0">${motivoPrincipal ? motivoPrincipal[0] : '-'}</h4>
                            <small>${motivoPrincipal ? motivoPrincipal[1] : 0} ocorrências</small>
                        </div>
                        <i class="fas fa-exclamation-circle fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card stat-card bg-info text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">Análise IA</h6>
                            <small>Dados carregados do Painel de Demitidos</small>
                        </div>
                        <i class="fas fa-robot fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function gerarGraficosRescisao(dados) {
    // 1. Evolução Mensal
    const dadosMensais = {};
    dados.forEach(d => {
        if (d.dataDemissao) {
            const mesAno = d.dataDemissao.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            dadosMensais[mesAno] = (dadosMensais[mesAno] || 0) + 1;
        }
    });
    
    // Ordenar cronologicamente (simplificado)
    const labelsMensal = Object.keys(dadosMensais); // Idealmente ordenar por data
    const valuesMensal = Object.values(dadosMensais);

    renderizarGrafico('grafico-evolucao-rescisao', 'line', labelsMensal, valuesMensal, 'Evolução Mensal', {});

    // 2. Por Gênero
    const dadosGenero = contarOcorrencias(dados, 'sexo');
    const labelsGenero = Object.keys(dadosGenero);
    const valuesGenero = Object.values(dadosGenero);

    // Cores personalizadas para gênero
    const coresGenero = labelsGenero.map(label => {
        if (label.toLowerCase().includes('masculino')) return '#4e73df'; // Azul
        if (label.toLowerCase().includes('feminino')) return '#f72585'; // Rosa
        return '#858796'; // Cinza para 'Não Informado'
    });

    // Opções personalizadas para a legenda com contagem
    const optionsGenero = {
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    generateLabels: function(chart) {
                        const data = chart.data;
                        if (data.labels.length && data.datasets.length) {
                            return data.labels.map((label, i) => {
                                const meta = chart.getDatasetMeta(0);
                                const style = meta.controller.getStyle(i);
                                const value = data.datasets[0].data[i];
                                return {
                                    text: `${label}: ${value}`, // Adiciona a contagem ao label
                                    fillStyle: style.backgroundColor,
                                    strokeStyle: style.borderColor,
                                    lineWidth: style.borderWidth,
                                    hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                }
            }
        }
    };

    renderizarGrafico('grafico-genero-rescisao', 'doughnut', labelsGenero, valuesGenero, 'Gênero', { customColors: coresGenero, customOptions: optionsGenero });

    // 3. Por Tipo (Motivo Macro)
    const dadosTipo = contarOcorrencias(dados, 'motivo');
    renderizarGrafico('grafico-tipo-rescisao', 'bar', Object.keys(dadosTipo), Object.values(dadosTipo), 'Tipo de Demissão', {});

    // 4. Por Motivo Detalhado
    const dadosMotivo = contarOcorrencias(dados, 'motivoDetalhado');
    const sortedMotivos = Object.entries(dadosMotivo)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3); // Pega apenas os 3 principais

    // Reordenar para formato de pódio: 2º, 1º, 3º
    let podiumData = [];
    if (sortedMotivos.length === 3) {
        podiumData = [sortedMotivos[1], sortedMotivos[0], sortedMotivos[2]]; // [2nd, 1st, 3rd]
    } else if (sortedMotivos.length === 2) {
        podiumData = [sortedMotivos[1], sortedMotivos[0]]; // [2nd, 1st]
    } else {
        podiumData = sortedMotivos;
    }

    const valuesMotivo = podiumData.map(item => item[1]);

    // Cores do pódio e labels com medalhas
    let coresPodium = [];
    let labelsMotivo = [];
    const medalhas = ['🥇', '🥈', '🥉'];

    if (podiumData.length === 3) {
        coresPodium = ['#C0C0C0', '#FFD700', '#CD7F32']; // Prata, Ouro, Bronze
        labelsMotivo = [
            `${medalhas[1]} ${podiumData[0][0]}`, // 2º lugar
            `${medalhas[0]} ${podiumData[1][0]}`, // 1º lugar
            `${medalhas[2]} ${podiumData[2][0]}`  // 3º lugar
        ];
    } else if (podiumData.length === 2) {
        coresPodium = ['#C0C0C0', '#FFD700']; // Prata, Ouro
        labelsMotivo = [`${medalhas[1]} ${podiumData[0][0]}`, `${medalhas[0]} ${podiumData[1][0]}`];
    } else if (podiumData.length === 1) {
        coresPodium = ['#FFD700']; // Ouro
        labelsMotivo = [`${medalhas[0]} ${podiumData[0][0]}`];
    }

    // Opções customizadas para o gráfico de pódio (UX/UI)
    const podiumOptions = {
        plugins: {
            legend: { display: false },
            tooltip: { 
                callbacks: { label: (ctx) => ` ${ctx.parsed.y} ocorrências` },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 10,
                cornerRadius: 8
            }
        },
        scales: {
            x: { 
                grid: { display: false },
                ticks: { font: { size: 14, weight: 'bold' } } // Aumenta fonte dos labels com medalhas
            },
            y: { 
                grid: { display: false }, 
                ticks: { stepSize: 1, precision: 0 },
                display: false // Oculta eixo Y para visual mais limpo
            }
        },
        layout: {
            padding: { top: 20, bottom: 10 }
        }
    };

    // Estilo das barras para parecerem blocos de pódio
    const podiumDatasetOptions = {
        borderRadius: { topLeft: 15, topRight: 15 },
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8
    };

    // Plugin para desenhar #1, #2, #3 no meio das barras
    const podiumLabelsPlugin = {
        id: 'podiumLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            
            let ranks = [];
            if (meta.data.length === 3) ranks = ['#2', '#1', '#3'];
            else if (meta.data.length === 2) ranks = ['#2', '#1'];
            else if (meta.data.length === 1) ranks = ['#1'];

            ctx.save();
            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;

            meta.data.forEach((bar, index) => {
                if (index < ranks.length) {
                    const text = ranks[index];
                    // Posiciona no centro geométrico da barra
                    const x = bar.x;
                    const y = bar.y + (bar.base - bar.y) / 2;
                    ctx.fillText(text, x, y);
                }
            });
            ctx.restore();
        }
    };

    renderizarGrafico('grafico-motivo-rescisao', 'bar', labelsMotivo, valuesMotivo, 'Principais Motivos', { 
        horizontal: false, 
        customColors: coresPodium, 
        customOptions: podiumOptions,
        customDatasetOptions: podiumDatasetOptions,
        customPlugins: [podiumLabelsPlugin]
    });
}

function gerarAnaliseSetores(dados) {
    const container = document.getElementById('analise-rescisao-setores');
    if (!container) return;

    const dadosSetor = contarOcorrencias(dados, 'setor');
    const sortedSetores = Object.entries(dadosSetor).sort((a,b) => b[1] - a[1]);

    let html = '<ul class="list-group list-group-flush">';
    sortedSetores.forEach(([setor, qtd]) => {
        const percentual = ((qtd / dados.length) * 100).toFixed(1);
        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${setor || 'Não Informado'}
                <span>
                    <span class="badge bg-primary rounded-pill me-2">${qtd}</span>
                    <small class="text-muted">${percentual}%</small>
                </span>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function gerarRankingLideranca(dados, setoresMap) {
    const container = document.getElementById('analise-rescisao-lideranca');
    if (!container) return;

    const demissoesPorGerente = {};

    // Filtra apenas por "Pedido de Demissão"
    const pedidosDeDemissao = dados.filter(d => d.motivo === 'Pedido de Demissão');

    pedidosDeDemissao.forEach(demissao => {
        const setor = demissao.setor;
        if (setor && setoresMap.has(setor)) {
            const gerente = setoresMap.get(setor);
            demissoesPorGerente[gerente] = (demissoesPorGerente[gerente] || 0) + 1;
        }
    });

    const ranking = Object.entries(demissoesPorGerente).sort((a, b) => b[1] - a[1]);

    if (ranking.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Nenhum pedido de demissão encontrado para análise de liderança.</p>';
        return;
    }

    let html = '<ul class="list-group list-group-flush">';
    ranking.forEach(([gerente, qtd], index) => {
        const medalhas = ['🥇', '🥈', '🥉'];
        const posicao = index < 3 ? `<span class="fs-4 me-3">${medalhas[index]}</span>` : `<span class="me-3" style="min-width: 28px; display: inline-block; text-align: center;">#${index + 1}</span>`;

        html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">${posicao} <div class="fw-bold">${gerente}</div></div>
                <span class="badge bg-danger rounded-pill fs-6">${qtd}</span></li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function renderizarGrafico(canvasId, type, labels, data, label, config = {}) {
    const { horizontal = false, customColors = null, customOptions = {}, customDatasetOptions = {}, customPlugins = [] } = config;
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (chartsRescisao[canvasId]) {
        chartsRescisao[canvasId].destroy();
    }

    const defaultColors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'];
    const backgroundColors = customColors || (type === 'line' ? 'rgba(78, 115, 223, 0.05)' : defaultColors);

    const chartOptions = {
        indexAxis: horizontal ? 'y' : 'x',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: { display: type === 'doughnut' }
        },
        scales: type !== 'doughnut' ? {
            y: { 
                beginAtZero: true, 
                ticks: { precision: 0 },
                grid: { display: false } 
            },
            x: {
                grid: { display: false }
            }
        } : {},
        ...customOptions
    };

    chartsRescisao[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: type === 'line' ? '#4e73df' : undefined,
                borderWidth: 1,
                fill: type === 'line',
                ...customDatasetOptions
            }]
        },
        options: chartOptions,
        plugins: customPlugins
    });
}

function contarOcorrencias(array, chave) {
    return array.reduce((acc, obj) => {
        const valor = obj[chave] || 'Não Informado';
        if (valor) {
            acc[valor] = (acc[valor] || 0) + 1;
        }
        return acc;
    }, {});
}

// Mantém a função de salvar entrevista para não quebrar o modal, 
// mas o dashboard agora usa dados de movimentações.
async function salvarDadosEntrevista() {
    try {
        const movimentacaoId = document.getElementById('entrevista-movimentacao-id').value;
        if (!movimentacaoId) {
            mostrarMensagem('ID da movimentação não encontrado.', 'error');
            return;
        }

        const entrevistaData = {
            movimentacaoId: movimentacaoId,
            motivoDesligamento: document.getElementById('entrevista-motivo').value,
            avaliacaoExperiencia: document.getElementById('entrevista-experiencia').value,
            pontosPositivos: document.getElementById('entrevista-pontos-positivos').value,
            principaisDesafios: document.getElementById('entrevista-desafios').value,
            sugestaoMelhora: document.getElementById('entrevista-melhorias').value,
            sentiuApoiado: document.querySelector('input[name="entrevista-apoio"]:checked')?.value || null,
            recomendariaEmpresa: document.querySelector('input[name="entrevista-recomenda"]:checked')?.value || null,
            interesseRetornar: document.querySelector('input[name="entrevista-retorno"]:checked')?.value || null,
            dataPreenchimento: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid
        };

        // Validação simples
        if (!entrevistaData.motivoDesligamento || !entrevistaData.avaliacaoExperiencia) {
            mostrarMensagem('Preencha "Motivo do desligamento" e "Avaliação da experiência".', 'warning');
            return;
        }

        await db.collection('entrevistas_demissionais').add(entrevistaData);

        mostrarMensagem('Entrevista demissional salva com sucesso!', 'success');

        const modalEl = document.getElementById('entrevistaDemissionalModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) {
            modal.hide();
        }

        // Atualiza a análise se a seção estiver visível
        if (!document.getElementById('analise-rescisao').classList.contains('d-none')) {
            await inicializarAnaliseRescisao();
        }

    } catch (e) {
        console.error("Erro ao salvar entrevista demissional:", e);
        mostrarMensagem("Falha ao salvar a entrevista.", "error");
    }
}

// Exportar funções
window.inicializarAnaliseRescisao = inicializarAnaliseRescisao;
window.salvarDadosEntrevista = salvarDadosEntrevista;