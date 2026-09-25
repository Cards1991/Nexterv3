let dashboardFaltasCarregado = false;
let chartFaltasMotivos = null;
let chartFaltasSetor = null;
let chartEvolucao = null;
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
        console.log(`[DashFaltas Func] Query ts: ${Date.now()}`);
        const funcionariosSnapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get({source: 'server'});
        
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
        let query = db.collection('faltas_diarias');
        
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

        console.log(`[DashFaltas] Query ts: ${Date.now()} - Filters: ${dataInicio} to ${dataFim}, setor: ${setorFiltro}`);
        const faltasSnapshot = await query.get({source: 'server'});
        const faltas = faltasSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));

        // Atualizar cache para exportação
        __dados_dashboard_faltas_cache = { faltas, funcionariosMap };

        // 3. Processar os dados para o ranking e KPIs, com deduplicação de faltas no mesmo dia.
        const contagemFaltas = {}; // Objeto para armazenar Sets de datas de falta por funcionário
        let totalFaltasFiltradas = 0;
        const funcionariosComFalta = new Set();
        let totalInjustificadas = 0;
        let infratoresRepeticao = 0;
        const faltasPorMotivo = {};

        faltas.forEach(falta => {
            const idFuncionario = falta.funcionarioId;
            const funcionario = funcionariosMap.get(idFuncionario);

            if (idFuncionario && funcionario) {
                if (setorFiltro && funcionario.setor !== setorFiltro) return;

                faltasFiltradas.push(falta);
                const dataFaltaStr = falta.data?.toDate().toDateString();
                if (!dataFaltaStr) return;

                const faltaKey = `${idFuncionario}_${dataFaltaStr}`;
                
                // Track motivos
                const mot = falta.motivo || 'Sem Motivo';
                faltasPorMotivo[mot] = (faltasPorMotivo[mot] || 0) + 1;
                
                if (mot.toLowerCase().includes('injustificada') || mot.toLowerCase().includes('esquecimento')) {
                    totalInjustificadas++;
                }

                if (!contagemFaltas[idFuncionario]) contagemFaltas[idFuncionario] = new Set();
                contagemFaltas[idFuncionario].add(dataFaltaStr);

                if (!diasFaltas.has(faltaKey)) {
                    diasFaltas.set(faltaKey, true);
                    totalFaltasFiltradas++;
                    funcionariosComFalta.add(idFuncionario);

                    const setor = funcionario.setor || 'Não Definido';
                    faltasPorSetor[setor] = (faltasPorSetor[setor] || 0) + 1;
                }
            }
        });
        
        // Calcular reincidentes
        for (const [fId, dias] of Object.entries(contagemFaltas)) {
            if (dias.size >= 2) infratoresRepeticao++;
        }
        
        const rankingArray = Object.entries(contagemFaltas)
            .map(([funcionarioId, datas]) => {
                const funcionario = funcionariosMap.get(funcionarioId) || { nome: 'Desconhecido', empresa: '', setor: '' };
                return {
                    funcionarioId, nome: funcionario.nome, empresa: funcionario.empresa, setor: funcionario.setor,
                    totalFaltas: datas.size 
                };
            })
            .sort((a, b) => b.totalFaltas - a.totalFaltas);

        // 5. Renderizar
        renderizarKPIs(totalFaltasFiltradas, funcionariosComFalta.size, totalInjustificadas, infratoresRepeticao);
        renderizarRanking(rankingArray, rankingContainer);
        renderizarGraficoMotivos(faltasPorMotivo);
        renderizarGraficoSetor(faltasPorSetor);
        renderizarTabelaFaltasDiarias(faltasFiltradas);
        renderizarGraficoEvolucao(faltasFiltradas);

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

function renderizarKPIs(totalFaltas, funcionariosUnicos, injsutificadas, taxa) {
    const kpiTotalEl = document.getElementById('kpi-total-faltas');
    const kpiMesEl = document.getElementById('kpi-faltas-mes');
    const kpiInjus = document.getElementById('kpi-faltas-injustificadas');
    const kpiTaxa = document.getElementById('kpi-taxa-repeticao');

    if (kpiTotalEl) kpiTotalEl.textContent = totalFaltas.toLocaleString('pt-BR');
    if (kpiMesEl) kpiMesEl.textContent = funcionariosUnicos.toLocaleString('pt-BR');
    if (kpiInjus) kpiInjus.textContent = injsutificadas.toLocaleString('pt-BR');
    if (kpiTaxa) kpiTaxa.textContent = taxa.toLocaleString('pt-BR');
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

        const badgeColor = index === 0 ? 'bg-danger' : (index === 1 ? 'bg-warning text-dark' : (index === 2 ? 'bg-info text-dark' : 'bg-secondary'));

        const itemEl = document.createElement('div');
        itemEl.className = 'list-group-item py-3 px-4 border-0 border-bottom';
        itemEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="d-flex align-items-center justify-content-center bg-light rounded-circle me-3 fw-bold" style="width: 40px; height: 40px; font-size: 1.1rem; color: #64748b;">
                        ${posicao}
                    </div>
                    <div>
                        <div class="fw-bold text-dark mb-1" style="font-size: 1rem;">${item.nome}</div>
                        <div class="text-muted small"><i class="fas fa-building me-1 opacity-50"></i> ${item.setor}</div>
                    </div>
                </div>
                <div class="text-center">
                    <span class="badge ${badgeColor} rounded-pill shadow-sm" style="font-size: 1rem; padding: 0.5em 1em;">
                        ${item.totalFaltas}
                    </span>
                    <div class="small text-muted mt-1" style="font-size: 0.7rem;">ocorrências</div>
                </div>
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

function renderizarGraficoMotivos(dados) {
    const ctx = document.getElementById('grafico-motivos')?.getContext('2d');
    if (!ctx) return;

    if (chartFaltasMotivos) chartFaltasMotivos.destroy();

    const labels = Object.keys(dados);
    const values = Object.values(dados);

    // Gradient colors
    const colors = [
        '#ef4444', // red
        '#f59e0b', // amber
        '#3b82f6', // blue
        '#8b5cf6', // violet
        '#10b981', // emerald
        '#64748b'  // slate
    ];

    chartFaltasMotivos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' }
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
                label: 'Ocorrências',
                data: values,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { stepSize: 1 } },
                y: { grid: { display: false, drawBorder: false } }
            }
        }
    });
}

function renderizarGraficoEvolucao(faltas) {
    const ctx = document.getElementById('grafico-evolucao-faltas-dia')?.getContext('2d');
    if(!ctx) return;
    if(chartEvolucao) chartEvolucao.destroy();
    
    // Group by date
    const counts = {};
    faltas.forEach(f => {
        const dStr = f.data?.toDate ? f.data.toDate().toLocaleDateString('pt-BR') : new Date(f.data).toLocaleDateString('pt-BR');
        counts[dStr] = (counts[dStr] || 0) + 1;
    });
    
    // Sort keys by date
    const sortedDates = Object.keys(counts).sort((a,b) => {
        const [da,ma,ya] = a.split('/');
        const [db,mb,yb] = b.split('/');
        return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
    });
    
    const values = sortedDates.map(d => counts[d]);
    
    // Create gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
    gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');

    chartEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Ocorrências Diárias',
                data: values,
                borderColor: '#4f46e5',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#4f46e5',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 // Curve
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [4, 4] }, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
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

function renderizarTabelaFaltasDiarias(faltas) {
    const tbody = document.getElementById('tabela-faltas-diarias-body');
    if (!tbody) return;
    
    if (!faltas || faltas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4"><i class="fas fa-check-circle fs-4 mb-2 d-block"></i> Nenhum registro encontrado.</td></tr>';
        return;
    }
    
    // Sort by date desc
    faltas.sort((a, b) => {
        const d1 = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        const d2 = b.data?.toDate ? b.data.toDate() : new Date(b.data);
        return d2 - d1;
    });

    tbody.innerHTML = faltas.map(f => {
        const dObj = f.data?.toDate ? f.data.toDate() : new Date(f.data);
        const dateStr = dObj.toLocaleDateString('pt-BR');
        
        return `
        <tr>
            <td class="ps-4 text-secondary fw-semibold">${dateStr}</td>
            <td>
                <div class="fw-bold text-dark">${f.funcionarioNome || 'N/I'}</div>
            </td>
            <td>
                <div class="d-inline-flex align-items-center bg-light text-secondary rounded-pill px-3 py-1 small fw-medium">
                    <i class="fas fa-building me-2 opacity-50"></i>${f.setor || 'N/I'}
                </div>
            </td>
            <td>
                <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1 rounded-pill" style="font-size: 0.75rem;">
                    ${f.motivo || 'N/I'}
                </span>
            </td>
            <td>
                <div class="text-muted text-truncate" style="max-width: 200px; font-size: 0.85rem;">
                    ${f.observacao || '<span class="opacity-50">Sem obs.</span>'}
                </div>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-light text-danger rounded-circle shadow-sm" onclick="excluirFaltaDiaria('${f.id}')" title="Excluir" style="width: 32px; height: 32px; padding: 0;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

window.excluirFaltaDiaria = async function(id) {
    if(!confirm('Deseja realmente remover este registro de falta?')) return;
    try {
        await firebase.firestore().collection('faltas_diarias').doc(id).delete();
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Registro removido com sucesso!', 'success');
        carregarDashboardFaltas(firebase.firestore());
    } catch(e) {
        console.error(e);
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao remover: ' + e.message, 'error');
    }
}