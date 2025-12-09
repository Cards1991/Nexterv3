let dashboardFaltasCarregado = false;

/**
 * Inicializa o dashboard de faltas, carregando os dados se ainda não tiverem sido carregados.
 */
async function inicializarDashboardFaltas() {
    if (dashboardFaltasCarregado) return;
    
    // Obter a instância do Firestore
    const db = obterFirestore(); // Você precisa criar essa função
    
    console.log('Dashboard de Faltas visível. Carregando dados...');
    await carregarDashboardFaltas(db);
    dashboardFaltasCarregado = true;
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
                setor: data.setor || 'Não definido'
            });
        });

        // 2. Buscar todas as faltas
        const faltasSnapshot = await db.collection('faltas').get();
        const faltas = faltasSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));

        // 3. Processar os dados para o ranking e KPIs
        const contagemFaltas = {};
        let faltasMesAtual = 0;
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

        faltas.forEach(falta => {
            const idFuncionario = falta.funcionarioId;
            if (idFuncionario) {
                // Contagem para o ranking
                contagemFaltas[idFuncionario] = (contagemFaltas[idFuncionario] || 0) + 1;

                // Contagem para o KPI de faltas no mês
                if (falta.data) {
                    try {
                        const dataFalta = falta.data.toDate ? falta.data.toDate() : new Date(falta.data);
                        if (!isNaN(dataFalta) && 
                            dataFalta >= primeiroDiaMes && 
                            dataFalta <= ultimoDiaMes) {
                            faltasMesAtual++;
                        }
                    } catch (e) {
                        console.warn('Data de falta inválida:', falta.data);
                    }
                }
            }
        });

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
        renderizarKPIs(faltas.length, faltasMesAtual);
        renderizarRanking(rankingArray, rankingContainer);

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
 * @param {number} faltasMes - O número de faltas no mês atual.
 */
function renderizarKPIs(totalFaltas, faltasMes) {
    const kpiTotalEl = document.getElementById('kpi-total-faltas');
    const kpiMesEl = document.getElementById('kpi-faltas-mes');

    if (kpiTotalEl) kpiTotalEl.textContent = totalFaltas.toLocaleString('pt-BR');
    if (kpiMesEl) kpiMesEl.textContent = faltasMes.toLocaleString('pt-BR');
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