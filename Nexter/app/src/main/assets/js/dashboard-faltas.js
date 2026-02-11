let dashboardFaltasCarregado = false;
let chartFaltasSexo = null;
let chartFaltasSetor = null;
let __dados_dashboard_faltas_cache = { faltas: [], funcionariosMap: new Map() };

/**
 * Inicializa o dashboard de faltas, carregando os dados se ainda não tiverem sido carregados.
 */
async function inicializarDashboardFaltas() {
    // Obter a instância do Firestore
    const db = obterFirestore(); // Você precisa criar essa função
    
    if (!dashboardFaltasCarregado) {
        await inicializarFiltrosDashboardFaltas(db);
        
        const btnFiltrar = document.getElementById('btn-filtrar-dashboard-faltas');
        if (btnFiltrar) {
            btnFiltrar.addEventListener('click', () => carregarDashboardFaltas(db));
        }
        const btnExportar = document.getElementById('btn-exportar-dashboard-faltas');
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarDashboardFaltasExcel);
        }
        dashboardFaltasCarregado = true;
    }
    
    console.log('Dashboard de Faltas visível. Carregando dados...');
    await carregarDashboardFaltas(db);
}

async function inicializarFiltrosDashboardFaltas(db) {
    // Datas padrão (mês atual)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const dataInicioEl = document.getElementById('dash-faltas-data-inicio');
    const dataFimEl = document.getElementById('dash-faltas-data-fim');
    
    if (dataInicioEl && !dataInicioEl.value) dataInicioEl.value = inicioMes;
    if (dataFimEl && !dataFimEl.value) dataFimEl.value = fimMes;

    // Popular setores
    const setorSelect = document.getElementById('dash-faltas-setor');
    if (setorSelect) {
        setorSelect.innerHTML = '<option value="">Todos</option>';
        try {
            const empresasSnap = await db.collection('empresas').get();
            const setores = new Set();
            empresasSnap.forEach(doc => {
                (doc.data().setores || []).forEach(s => setores.add(s));
            });
            [...setores].sort().forEach(s => {
                setorSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        } catch (e) {
            console.error("Erro ao carregar setores:", e);
        }
    }
}

// Função para obter a instância do Firestore
function obterFirestore() {
    // Se você tem uma instância global, ajuste conforme sua implementação
    return firebase.firestore();
}

/**
 * Carrega e renderiza todos os componentes do dashboard de faltas.
 * @param {firebase.firestore.Firestore} db - A instância do Firestore.
 */
async function carregarDashboardFaltas(db) {
    const rankingContainer = document.getElementById('ranking-funcionarios-faltas');
    if (!rankingContainer) {
        console.error("Elemento 'ranking-funcionarios-faltas' não encontrado.");
        return;
    }

    rankingContainer.innerHTML = `<div class="list-group-item text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando ranking...</div>`;

    try {
        // 1. Buscar todos os funcionários para mapear IDs para nomes
        const funcionariosSnapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo') // Filtra apenas funcionários ativos
            .get();
        
        const funcionariosMap = new Map();
        funcionariosSnapshot.forEach(doc => {
            const data = doc.data();
            funcionariosMap.set(doc.id, {
                nome: data.nome || 'Nome não informado',
                empresa: data.empresa || 'Não definida',
                setor: data.setor || 'Não definido',
                sexo: data.sexo || 'Não informado'
            });
        });

        // 2. Buscar faltas com filtro de data
        let query = db.collection('faltas');
        
        const dataInicio = document.getElementById('dash-faltas-data-inicio')?.value;
        const dataFim = document.getElementById('dash-faltas-data-fim')?.value;
        const setorFiltro = document.getElementById('dash-faltas-setor')?.value;
        const sexoFiltro = document.getElementById('dash-faltas-sexo')?.value;
        const periodoFiltro = document.getElementById('dash-faltas-periodo')?.value;

        if (dataInicio) {
            // Força a data para o início do dia no horário local (evita problema de UTC)
            const di = new Date(dataInicio + 'T00:00:00');
            query = query.where('data', '>=', di);
        }
        if (dataFim) {
            // Força a data para o final do dia no horário local
            const df = new Date(dataFim + 'T23:59:59.999');
            query = query.where('data', '<=', df);
        }

        const faltasSnapshot = await query.get();
        const faltas = faltasSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));

        // Atualizar cache para exportação
        __dados_dashboard_faltas_cache = { faltas, funcionariosMap };

        // 3. Processar os dados para o ranking e KPIs
        const contagemFaltas = {};
        let totalFaltasFiltradas = 0;
        const funcionariosComFalta = new Set();
        const funcionariosPorSexo = {}; // Contará funcionários únicos por sexo
        const faltasPorSetor = {}; // Contará o total de faltas por setor
        const faltasFiltradas = []; // Array para armazenar faltas após filtros

        faltas.forEach(falta => {
            const idFuncionario = falta.funcionarioId;
            const funcionario = funcionariosMap.get(idFuncionario);

            if (idFuncionario && funcionario) {
                // Aplicar filtros de Setor e Sexo (em memória)
                if (setorFiltro && funcionario.setor !== setorFiltro) return;
                if (sexoFiltro && funcionario.sexo !== sexoFiltro) return;
                if (periodoFiltro && falta.periodo !== periodoFiltro) return;

                // Adiciona à lista de faltas filtradas para o gráfico de evolução
                faltasFiltradas.push(falta);

                // Contagem para o ranking
                contagemFaltas[idFuncionario] = (contagemFaltas[idFuncionario] || 0) + 1;
                
                // Contagem para KPIs
                totalFaltasFiltradas++;
                funcionariosComFalta.add(idFuncionario);

                // Contagem por Sexo
                const sexo = funcionario.sexo || 'Não Informado'; // Agrupa como 'Não Informado' se não houver sexo
                if (!funcionariosPorSexo[sexo]) {
                    funcionariosPorSexo[sexo] = new Set();
                }
                funcionariosPorSexo[sexo].add(idFuncionario);

                // Contagem por Setor
                const setor = funcionario.setor || 'Não Definido';
                faltasPorSetor[setor] = (faltasPorSetor[setor] || 0) + 1;
            }
        });
        
        // Converter os Sets de funcionários por sexo em contagens numéricas
        const contagemFuncionariosPorSexo = {};
        for (const sexo in funcionariosPorSexo) {
            contagemFuncionariosPorSexo[sexo] = funcionariosPorSexo[sexo].size;
        }
        
        // 4. Montar e ordenar o ranking
        const rankingArray = Object.entries(contagemFaltas)
            .map(([funcionarioId, totalFaltas]) => {
                const funcionario = funcionariosMap.get(funcionarioId) || {
                    nome: 'Funcionário Desconhecido',
                    empresa: 'Não definida',
                    setor: 'Não definido'
                };
                return {
                    funcionarioId,
                    nome: funcionario.nome,
                    empresa: funcionario.empresa,
                    setor: funcionario.setor,
                    totalFaltas
                };
            })
            .sort((a, b) => b.totalFaltas - a.totalFaltas);

        // 5. Renderizar o dashboard
        renderizarKPIs(totalFaltasFiltradas, funcionariosComFalta.size);
        renderizarRanking(rankingArray, rankingContainer);
        renderizarGraficoSexo(contagemFuncionariosPorSexo);
        renderizarGraficoSetor(faltasPorSetor);
        renderizarGraficoEvolucaoFaltas(faltasFiltradas);

    } catch (error) {
        console.error('Erro ao carregar dashboard de faltas:', error);
        rankingContainer.innerHTML = `
            <div class="list-group-item text-center p-4 text-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Erro ao carregar dados: ${error.message}
            </div>
        `;
    }
}

/**
 * Renderiza os cartões de KPI no dashboard.
 * @param {number} totalFaltas - O número total de faltas.
 * @param {number} funcionariosUnicos - O número de funcionários únicos com faltas.
 */
function renderizarKPIs(totalFaltas, funcionariosUnicos) {
    const kpiTotalEl = document.getElementById('kpi-total-faltas');
    const kpiMesEl = document.getElementById('kpi-faltas-mes');

    if (kpiTotalEl) kpiTotalEl.textContent = totalFaltas.toLocaleString('pt-BR');
    if (kpiMesEl) kpiMesEl.textContent = funcionariosUnicos.toLocaleString('pt-BR');
}

/**
 * Renderiza a lista do ranking de funcionários com mais faltas.
 * @param {Array<Object>} ranking - O array de dados do ranking ordenado.
 * @param {HTMLElement} container - O elemento HTML onde o ranking será renderizado.
 */
function renderizarRanking(ranking, container) {
    container.innerHTML = '';

    if (ranking.length === 0) {
        container.innerHTML = `
            <div class="list-group-item text-center p-4 text-muted">
                <i class="fas fa-check-circle me-2"></i>
                Nenhuma falta registrada.
            </div>
        `;
        return;
    }

    // Limita o ranking aos top 10
    const topRanking = ranking.slice(0, 10);

    topRanking.forEach((item, index) => {
        const medalhas = ['🥇', '🥈', '🥉'];
        const posicao = index < 3 ? medalhas[index] : `#${index + 1}`;
        const classeCor = index < 3 ? 'fw-bold' : '';

        const itemEl = document.createElement('div');
        itemEl.className = 'list-group-item';
        itemEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <span class="${classeCor} me-3" style="min-width: 40px;">${posicao}</span>
                    <div>
                        <div class="fw-semibold">${item.nome}</div>
                        <small class="text-muted">${item.empresa} / ${item.setor}</small>
                    </div>
                </div>
                <span class="badge bg-danger rounded-pill px-3 py-2">
                    ${item.totalFaltas} ${item.totalFaltas === 1 ? 'falta' : 'faltas'}
                </span>
            </div>
        `;
        container.appendChild(itemEl);
    });

    // Adicionar rodapé com estatísticas
    if (ranking.length > 10) {
        const footerEl = document.createElement('div');
        footerEl.className = 'list-group-item text-center text-muted small';
        footerEl.textContent = `Mostrando top 10 de ${ranking.length} funcionários com faltas`;
        container.appendChild(footerEl);
    }
}

/**
 * Renderiza o gráfico de barras de faltas por sexo.
 * @param {Object} dados - Objeto com a contagem de faltas por sexo.
 */
function renderizarGraficoSexo(dados) {
    const ctx = document.getElementById('grafico-faltas-sexo')?.getContext('2d');
    if (!ctx) return;

    if (chartFaltasSexo) {
        chartFaltasSexo.destroy();
    }

    const labels = Object.keys(dados);
    const values = Object.values(dados);

    // Cores: Azul para Masculino, Rosa para Feminino
    const backgroundColors = labels.map(label => {
        const l = label.toLowerCase();
        if (l.includes('fem')) return '#FF69B4'; // Rosa
        if (l.includes('masc')) return '#36A2EB'; // Azul
        return '#CCCCCC'; // Cinza para outros
    });

    chartFaltasSexo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faltas',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                }
            }
        }
    });
}

/**
 * Renderiza o gráfico de barras horizontal de faltas por setor.
 * @param {Object} dados - Objeto com a contagem de faltas por setor.
 */
function renderizarGraficoSetor(dados) {
    const ctx = document.getElementById('grafico-faltas-setor')?.getContext('2d');
    if (!ctx) return;

    if (chartFaltasSetor) {
        chartFaltasSetor.destroy();
    }

    // Ordenar por valor decrescente
    const sortedEntries = Object.entries(dados).sort(([,a], [,b]) => b - a);
    const labels = sortedEntries.map(([k]) => k);
    const values = sortedEntries.map(([,v]) => v);

    // Ajuste dinâmico de altura para permitir rolagem se houver muitos setores
    const wrapper = document.getElementById('chart-wrapper-setor');
    if (wrapper) {
        // Define uma altura mínima de 30px por barra ou 100% do pai se for pouco
        const newHeight = Math.max(wrapper.parentElement.clientHeight, labels.length * 30);
        wrapper.style.height = `${newHeight}px`;
    }

    chartFaltasSetor = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faltas',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Torna o gráfico horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        stepSize: 1
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { autoSkip: false }
                }
            }
        }
    });
}

function exportarDashboardFaltasExcel() {
    const { faltas, funcionariosMap } = __dados_dashboard_faltas_cache;

    if (!faltas || faltas.length === 0) {
        mostrarMensagem('Não há dados para exportar.', 'warning');
        return;
    }

    // Adiciona a biblioteca XLSX se não existir
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
        script.onload = () => exportarDashboardFaltasExcel();
        document.head.appendChild(script);
        return;
    }

    // Processar dados para o resumo por setor
    const resumoSetor = {};
    let totalFuncionariosComFalta = 0;
    const funcionariosUnicosGeral = new Set();

    faltas.forEach(f => {
        const func = funcionariosMap.get(f.funcionarioId);
        const setor = func ? (func.setor || 'Não Definido') : 'Não Definido';
        
        if (!resumoSetor[setor]) {
            resumoSetor[setor] = {
                funcionariosUnicos: new Set(),
                totalFaltas: 0
            };
        }
        
        resumoSetor[setor].funcionariosUnicos.add(f.funcionarioId);
        resumoSetor[setor].totalFaltas++;
        funcionariosUnicosGeral.add(f.funcionarioId);
    });

    totalFuncionariosComFalta = funcionariosUnicosGeral.size;

    const dadosExportacao = Object.entries(resumoSetor).map(([setor, dados]) => {
        const qtdFuncionarios = dados.funcionariosUnicos.size;
        const representatividade = totalFuncionariosComFalta > 0 
            ? ((qtdFuncionarios / totalFuncionariosComFalta) * 100).toFixed(2) + '%' 
            : '0%';

        return {
            'Setor': setor,
            'Qtd. Funcionários com Faltas': qtdFuncionarios,
            'Total de Faltas': dados.totalFaltas,
            '% Representatividade (Funcionários)': representatividade
        };
    });

    // Ordenar por quantidade de funcionários com faltas (decrescente)
    dadosExportacao.sort((a, b) => b['Qtd. Funcionários com Faltas'] - a['Qtd. Funcionários com Faltas']);

    // Adicionar linha de total
    dadosExportacao.push({
        'Setor': 'TOTAL GERAL',
        'Qtd. Funcionários com Faltas': totalFuncionariosComFalta,
        'Total de Faltas': faltas.length,
        '% Representatividade (Funcionários)': '100%'
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    
    // Ajustar largura das colunas
    const wscols = [
        {wch: 30}, // Setor
        {wch: 25}, // Qtd. Funcionários
        {wch: 15}, // Total Faltas
        {wch: 30}  // % Representatividade
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Resumo Faltas por Setor");
    XLSX.writeFile(wb, "Dashboard_Faltas_Resumo.xlsx");
    mostrarMensagem('Exportação concluída com sucesso!', 'success');
}