// ============================
// 🎯 FUNÇÕES PRINCIPAIS DO APP
// ============================

// Lista de todas as seções disponíveis no sistema
const TODAS_SECOES = [ 
    'dashboard', 'empresas', 'funcionarios', 'afastamentos', 'atestados','admissao','demissao', 'painel-demitidos',
    'faltas', 'movimentacoes', 'alteracao-funcao', 'transferencia', 'dp-calculos', 'relatorios', 'financeiro', 'agenda', 'iso-manutencao',
    'analise-rescisao', 'admin-usuarios', 'dashboard-manutencao', 'compliance-denuncia', 'analise-pessoas', 'gerenciar-avaliacoes', 'frota-dashboard', 
    'frota-veiculos', 'frota-motoristas', 'frota-utilizacao',
    'juridico-dashboard', 'juridico-processos', 'juridico-clientes', 'juridico-automacao', 'juridico-financeiro', 'juridico-documentos',
    'iso-maquinas', 'iso-organograma', 'iso-swot',
    'controle-disciplinar', 'iso-avaliacao-colaboradores', 'iso-mecanicos', 'iso-manutencao', 'iso-temperatura-injetoras', 'estoque-epi', 'consumo-epi', 'analise-custos'
];

let currentUserPermissions = {};

// Função showSection
function showSection(sectionName) {
    console.log('Mostrando seção:', sectionName);
    
    // Esconder todas as seções
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.add('d-none');
    });

    // Adiciona/remove classe especial para a página de denúncia
    if (sectionName === 'compliance-denuncia') {
        document.body.classList.add('denuncia-ativa');
    } else {
        document.body.classList.remove('denuncia-ativa');
    }
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.remove('d-none');
        targetSection.classList.add('fade-in');
        
        // Carregar dados específicos da seção
        carregarDadosSecao(sectionName);
    } else {
        console.error('Seção não encontrada:', sectionName);
    }
    
    // Atualizar menu ativo
    atualizarMenuAtivo(sectionName);
}

// Atualizar menu ativo
function atualizarMenuAtivo(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    // Primeiro, remove 'active' de todos os links
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Adiciona 'active' ao link da seção atual
    const activeLink = document.querySelector(`.nav-link[data-target="${activeSection}"]`);
    if (activeLink) {
        activeLink.classList.add('active');

        // Se o link ativo está dentro de um submenu, abre e ativa o pai
        const parentCollapse = activeLink.closest('.collapse');
        if (parentCollapse) {
            const parentCollapseInstance = new bootstrap.Collapse(parentCollapse, { toggle: false });
            parentCollapseInstance.show();
            const parentLink = document.querySelector(`a[href="#${parentCollapse.id}"]`);
            if (parentLink) {
                parentLink.classList.add('active');
            }
        }
    }
}

// Carregar dados específicos da seção
async function carregarDadosSecao(sectionName) {
    try {
        switch(sectionName) {
            case 'dashboard':
                await carregarDadosDashboard();
                break;
            case 'empresas':
                if (typeof carregarEmpresas === 'function') {
                    await carregarEmpresas();
                }
                break;
            case 'funcionarios':
                await carregarFuncionarios();
                break;
            case 'movimentacoes':
                if (window.movimentacoesManager) await window.movimentacoesManager.carregarDadosIniciais();
                break;
            case 'admissao':
            case 'demissao':
                if (window.movimentacoesManager) await window.movimentacoesManager.carregarDadosIniciais();
                break;
            case 'afastamentos':
                await carregarAfastamentos();
                break;
            case 'atestados':
                if (typeof inicializarAtestados === 'function') {
                    await inicializarAtestados();
                }
                break;
            case 'faltas':
                if (typeof inicializarFaltas === 'function') {
                    await inicializarFaltas();
                }
                break;
            case 'alteracao-funcao':
                if (typeof inicializarAlteracaoFuncao === 'function') {
                    await inicializarAlteracaoFuncao();
                }
                break;
            case 'transferencia':
                if (typeof inicializarTransferencia === 'function') {
                    await inicializarTransferencia();
                }
                break;
            case 'relatorios':
                if (typeof carregarRelatorios === 'function') {
                    await carregarRelatorios();
                }
                break;
            case 'financeiro':
                if (typeof inicializarFinanceiro === 'function') {
                    if (typeof inicializarFiltrosFinanceiro === 'function') {
                        inicializarFiltrosFinanceiro();
                    }
                    await inicializarFinanceiro();
                }
                break;
            case 'agenda':
                await carregarAgenda();
                break;
            case 'admin-usuarios':
                if (typeof inicializarAdmin === 'function') {
                    await inicializarAdmin();
                }
                break;
            case 'analise-rescisao':
                if (typeof inicializarAnaliseRescisao === 'function') {
                    await inicializarAnaliseRescisao();
                }
                break;
            case 'iso-manutencao':
                if (typeof inicializarManutencao === 'function') {
                    await inicializarManutencao();
                }
                break;
            case 'dashboard-manutencao':
                if (typeof inicializarDashboardManutencao === 'function') {
                    await inicializarDashboardManutencao();
                }
                break;
            case 'iso-maquinas':
                if (typeof inicializarMaquinas === 'function') {
                    await inicializarMaquinas();
                }
                break;
            case 'iso-mecanicos':
                if (typeof inicializarMecanicos === 'function') {
                    await inicializarMecanicos();
                }
                break;
            case 'iso-organograma':
                if (typeof inicializarOrganograma === 'function') {
                    await inicializarOrganograma();
                }
                break;
            case 'dp-calculos':
                if (typeof inicializarCalculos === 'function') {
                    await inicializarCalculos();
                }
                break;
            case 'iso-swot':
                if (typeof inicializarSwot === 'function') {
                    await inicializarSwot();
                }
                break;
            case 'estoque-epi':
                // Lógica para carregar dados da seção de Estoque de EPI (se houver)
                break;
            case 'consumo-epi':
                // Lógica para carregar dados da seção de Consumo de EPI (se houver)
                break;
             case 'analise-custos':
                // Lógica para carregar dados da seção de Análise de Custos (se houver)
                if (typeof inicializarAnaliseCustos === 'function') {
                    await inicializarAnaliseCustos();
                }
                break;
            case 'controle-disciplinar':
                if (typeof carregarDadosDisciplinares === 'function') {
                    await carregarDadosDisciplinares();
                }
                break;
            case 'iso-temperatura-injetoras':
                // Lógica para carregar dados da seção de Temperatura de Injetoras (se houver)
                break;
            case 'iso-avaliacao-colaboradores':
                if (typeof inicializarAvaliacaoColaboradores === 'function') {
                    await inicializarAvaliacaoColaboradores();
                }
                break;
            case 'gerenciar-avaliacoes':
                if (typeof inicializarGerenciarAvaliacoes === 'function') {
                    await inicializarGerenciarAvaliacoes();
                }
                break;
            case 'analise-pessoas':
                if (typeof inicializarAnalisePessoas === 'function') {
                    await inicializarAnalisePessoas();
                }
                break;
            // Casos para o novo Módulo Jurídico (placeholders)
            case 'juridico-dashboard':
                if (typeof inicializarDashboardJuridico === 'function') {
                    await inicializarDashboardJuridico();
                }
                break;
            case 'juridico-processos':
                if (typeof inicializarGestaoProcessos === 'function') {
                    await inicializarGestaoProcessos();
                }
                break;
            case 'juridico-clientes':
                if (typeof inicializarGestaoClientes === 'function') {
                    await inicializarGestaoClientes();
                }
                break;
            case 'frota-dashboard':
            case 'frota-veiculos':
            case 'frota-motoristas':
            case 'frota-utilizacao':
                if (typeof inicializarControleFrota === 'function') {
                    await inicializarControleFrota(sectionName);
                } else {
                    console.error('A função inicializarControleFrota não foi encontrada. Verifique se o script js/frota-controle.js está carregado.');
                }
                break;
            case 'juridico-automacao':
                if (typeof inicializarAutomacaoPecas === 'function') {
                    await inicializarAutomacaoPecas();
                }
                break;
            case 'juridico-financeiro':
                if (typeof inicializarFinanceiroJuridico === 'function') {
                    await inicializarFinanceiroJuridico();
                }
                break;
            case 'juridico-documentos':
                if (typeof inicializarDocumentosJuridicos === 'function') {
                    await inicializarDocumentosJuridicos();
                }
                break;
            case 'compliance-denuncia':
                // Nenhuma ação de carregamento de dados necessária por enquanto
                // Apenas exibe a seção estática.
                break;
        }
    } catch (error) {
        console.error(`Erro ao carregar seção ${sectionName}:`, error);
    }
}





// Carregar dados do dashboard
async function carregarDadosDashboard() {
    try {
        console.log('Carregando dashboard...');
        
        // Carregar funcionários
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const totalFuncionarios = funcionariosSnapshot.size;
        
        // Calcular admissões e demissões do mês
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        
        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .where('data', '>=', inicioMes)
            .where('data', '<=', fimMes)
            .get();
            
        let admissoesMes = 0;
        let demissoesMes = 0;
        
        movimentacoesSnapshot.forEach(doc => {
            const mov = doc.data();
            if (mov.tipo === 'admissao') {
                admissoesMes++;
            } else if (mov.tipo === 'demissao') {
                demissoesMes++;
            }
        });
        
        // Calcular taxa de rotatividade
        const taxaRotatividade = totalFuncionarios > 0 ? 
            ((demissoesMes / totalFuncionarios) * 100).toFixed(1) : 0;
        
        // Atualizar elementos do DOM
        document.getElementById('total-funcionarios').textContent = totalFuncionarios;
        document.getElementById('admissoes-mes').textContent = admissoesMes;
        document.getElementById('demissoes-mes').textContent = demissoesMes;
        document.getElementById('taxa-rotatividade').textContent = taxaRotatividade + '%';
        
        // Carregar métricas para Dashboards de Manutenção
        await carregarMetricasManutencaoDashboard();

        // Carregar métricas para Dashboards de Controladoria
        await carregarMetricasControladoriaDashboard();

        // Gerar análise de IA para o dashboard
        await gerarAnaliseIADashboard(admissoesMes, demissoesMes, taxaRotatividade);
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// Carregar últimas movimentações no dashboard
async function carregarUltimasMovimentacoesDashboard() {
    try {
        const filtroStatus = document.getElementById('mov-filtro-status')?.value;
        const tbody = document.getElementById('ultimas-movimentacoes');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

        // Se estiver na tela de movimentações e o filtro for 'preenchida', não mostra nada aqui
        // pois a lógica de preenchidas está nas outras tabelas.
        if (filtroStatus === 'preenchida') {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Filtro "Preenchidas" ativo. Veja as listas abaixo.</td></tr>';
            return;
        }
        
        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .orderBy('data', 'desc')
            .limit(5)
            .get();
            
        tbody.innerHTML = '';
        
        if (movimentacoesSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma movimentação recente</td></tr>';
            return;
        }
        
        // Buscar nomes dos funcionários
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const funcionariosMap = {};
        funcionariosSnapshot.forEach(doc => {
            funcionariosMap[doc.id] = doc.data().nome;
        });
        
        movimentacoesSnapshot.forEach(doc => {
            const mov = doc.data();
            const nomeFuncionario = mov.funcionarioNome || funcionariosMap[mov.funcionarioId] || 'Funcionário não encontrado';
            const tipoTexto = mov.tipo === 'admissao' ? 'Admissão' : 'Demissão';
            const tipoClasse = mov.tipo === 'admissao' ? 'text-success' : 'text-danger';
            
            const dataObj = mov.data?.toDate ? mov.data.toDate() : mov.data;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nomeFuncionario}</td>
                <td><span class="${tipoClasse}">${tipoTexto}</span></td>
                <td>${formatarData(dataObj)}</td>
                <td>${mov.motivo || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar últimas movimentações:', error);
    }
}

// Carregar últimas movimentações no dashboard
async function carregarUltimasMovimentacoes() {
    try {
        const tbody = document.getElementById('ultimas-movimentacoes');
        if (!tbody) return;
        
        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .orderBy('data', 'desc')
            .limit(5)
            .get();
            
        tbody.innerHTML = '';
        
        if (movimentacoesSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma movimentação recente</td></tr>';
            return;
        }
        
        // Buscar nomes dos funcionários
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const funcionariosMap = {};
        funcionariosSnapshot.forEach(doc => {
            funcionariosMap[doc.id] = doc.data().nome;
        });
        
        movimentacoesSnapshot.forEach(doc => {
            const mov = doc.data();
            const nomeFuncionario = mov.funcionarioNome || funcionariosMap[mov.funcionarioId] || 'Funcionário não encontrado';
            const tipoTexto = mov.tipo === 'admissao' ? 'Admissão' : 'Demissão';
            const tipoClasse = mov.tipo === 'admissao' ? 'text-success' : 'text-danger';
            
            const dataObj = mov.data?.toDate ? mov.data.toDate() : mov.data;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nomeFuncionario}</td>
                <td><span class="${tipoClasse}">${tipoTexto}</span></td>
                <td>${formatarData(dataObj)}</td>
                <td>${mov.motivo || '-'}</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Erro ao carregar últimas movimentações:', error);
    }
}

// Carregar métricas de saúde ocupacional
async function carregarMetricasSaudeOcupacional() {
    try {
        const afastamentosEl = document.getElementById('afastamentos-ativos');
        const atestadosEl = document.getElementById('atestados-mes');

        // Se os elementos não existirem na página atual, não faz nada.
        if (!afastamentosEl || !atestadosEl) {
            return;
        }

        const hoje = new Date();
        
        // Afastamentos ativos
        const afastamentosSnapshot = await db.collection('afastamentos').where('status', '==', 'Ativo').get();
        afastamentosEl.textContent = afastamentosSnapshot.size;
        
        // Atestados do mês
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const atestadosSnapshot = await db.collection('atestados').where('data_atestado', '>=', inicioMes).get();
        atestadosEl.textContent = atestadosSnapshot.size;
        
    } catch (error) {
        console.error('Erro ao carregar métricas de saúde:', error);
    }
}

// Carregar métricas para Dashboards de Manutenção
async function carregarMetricasManutencaoDashboard() {
    try {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

        // Chamados concluídos no mês
        const chamadosConcluidosSnap = await db.collection('manutencao_chamados')
            .where('status', '==', 'Concluído')
            .where('dataEncerramento', '>=', inicioMes)
            .where('dataEncerramento', '<=', fimMes)
            .get();
        document.getElementById('dash-manut-total-chamados').textContent = chamadosConcluidosSnap.size;

        // Chamados abertos (total)
        const chamadosAbertosSnap = await db.collection('manutencao_chamados')
            .where('status', 'in', ['Aberto', 'Em Andamento'])
            .get();
        document.getElementById('dash-manut-chamados-abertos').textContent = chamadosAbertosSnap.size;

        // Máquinas críticas
        const maquinasCriticasSnap = await db.collection('maquinas')
            .where('isCritica', '==', true)
            .get();
        document.getElementById('dash-manut-maquinas-criticas').textContent = maquinasCriticasSnap.size;

    } catch (error) {
        console.error('Erro ao carregar métricas de manutenção para o dashboard:', error);
    }
}

// Carregar métricas para Dashboards de Controladoria
async function carregarMetricasControladoriaDashboard() {
    try {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

        // Total de lançamentos financeiros no mês
        const lancamentosSnap = await db.collection('lancamentos_financeiros')
            .where('dataVencimento', '>=', inicioMes)
            .where('dataVencimento', '<=', fimMes)
            .get();
        document.getElementById('dash-control-total-lancamentos').textContent = lancamentosSnap.size;

        // Custo total de funcionários (soma dos custos totais de cada funcionário)
        const funcionariosSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        let custoTotalFuncionarios = 0;
        funcionariosSnap.forEach(doc => {
            custoTotalFuncionarios += doc.data().custoTotal || 0;
        });
        document.getElementById('dash-control-custo-total-funcionarios').textContent = `R$ ${custoTotalFuncionarios.toFixed(2).replace('.', ',')}`;

        // Folhas calculadas no mês (placeholder, pois não há coleção para isso ainda)
        // document.getElementById('dash-control-folhas-calculadas').textContent = '0';

    } catch (error) {
        console.error('Erro ao carregar métricas de controladoria para o dashboard:', error);
    }
}

// ============================
// 🤖 MÓDULO DE ANÁLISE COM IA
// ============================

async function gerarAnaliseIADashboard(admissoes, demissoes, turnover) {
    const container = document.getElementById('ai-analysis-text');
    if (!container) return;

    container.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando tendências...';

    // Simula um pequeno delay, como se estivesse consultando uma API de IA
    setTimeout(() => {
        let analise = '';
        const saldo = admissoes - demissoes;

        if (saldo > 0) {
            analise = `<strong>Tendência de Crescimento:</strong> O saldo de movimentações é positivo em <strong>${saldo}</strong>. A empresa está em fase de expansão.`;
        } else if (saldo < 0) {
            analise = `<strong>Tendência de Redução:</strong> O saldo de movimentações é negativo em <strong>${Math.abs(saldo)}</strong>. Houve mais desligamentos do que contratações.`;
        } else {
            analise = `<strong>Tendência de Estabilidade:</strong> O número de admissões e demissões está equilibrado.`;
        }

        if (turnover > 5) { // Exemplo de limiar para turnover alto
            analise += ` <span class="text-warning"><strong>Ponto de Atenção:</strong> A taxa de rotatividade de <strong>${turnover}%</strong> é considerada alta. Recomenda-se investigar as causas na seção "Análise de Rescisões".</span>`;
        } else if (demissoes > 0) {
            analise += ` A taxa de rotatividade de <strong>${turnover}%</strong> está dentro de um nível saudável.`;
        }

        container.innerHTML = analise;

    }, 1000);
}

async function inicializarMovimentacoesDashboard() {
    // Preenche os filtros de empresa e setor
    await carregarSelectEmpresas('mov-filtro-empresa');
    const empresaFiltro = document.getElementById('mov-filtro-empresa');
    
    empresaFiltro.addEventListener('change', () => {
        carregarSetoresPorEmpresa(empresaFiltro.value, 'mov-filtro-setor');
    });

    // Carrega os dados iniciais
    await carregarDashboardMovimentacoes();
}

/**
 * Abre uma nova janela para impressão com o conteúdo fornecido.
 * @param {string} content - O conteúdo HTML a ser impresso.
 * @param {object} options - Opções para a janela de impressão.
 * @param {boolean} [options.autoPrint=false] - Se deve chamar a impressão automaticamente.
 * @param {string} [options.name='printWindow'] - O nome da nova janela.
 */
function openPrintWindow(content, options = {}) {
    const { autoPrint = false, name = 'printWindow', specs = 'width=800,height=600' } = options;
    
    const printWindow = window.open('', name, specs);
    printWindow.document.write(content);
    printWindow.document.close();

    if (autoPrint) {
        printWindow.focus();
        printWindow.print();
    }
}
async function carregarDashboardMovimentacoes() {
    try {
        const filtroStatus = document.getElementById('mov-filtro-status').value || 'pendente';
        const filtroEmpresa = document.getElementById('mov-filtro-empresa').value;
        const filtroSetor = document.getElementById('mov-filtro-setor').value;

        let reposicoesQuery = db.collection('reposicoes').where('status', '==', filtroStatus);
        let contratacoesQuery = db.collection('contratacoes').where('status', '==', filtroStatus);

        if (filtroEmpresa) {
            reposicoesQuery = reposicoesQuery.where('empresaId', '==', filtroEmpresa);
            contratacoesQuery = contratacoesQuery.where('empresaId', '==', filtroEmpresa);
        }
        if (filtroSetor) {
            reposicoesQuery = reposicoesQuery.where('setor', '==', filtroSetor);
            contratacoesQuery = contratacoesQuery.where('setor', '==', filtroSetor);
        }

        const [reposicoesSnap, contratacoesSnap] = await Promise.all([
            reposicoesQuery.orderBy('abertaEm', 'desc').get(),
            contratacoesQuery.orderBy('abertaEm', 'desc').get()
        ]);

        // Para os cards, sempre contamos as pendentes, independente do filtro
        const [reposicoesPendentesSnap, contratacoesPendentesSnap] = await Promise.all([
            db.collection('reposicoes').where('status', '==', 'pendente').get(),
            db.collection('contratacoes').where('status', '==', 'pendente').get()
        ]);

        const totalReposicoesPendentes = reposicoesPendentesSnap.size;

        // Soma a quantidade de vagas de cada solicitação de contratação
        let totalVagasContratacao = 0;
        contratacoesPendentesSnap.forEach(doc => {
            totalVagasContratacao += doc.data().quantidade || 1;
        });

        // Atualizar cards do dashboard
        document.getElementById('mov-total-solicitacoes').textContent = totalReposicoesPendentes + totalVagasContratacao;
        document.getElementById('mov-reposicoes-pendentes').textContent = totalReposicoesPendentes;
        document.getElementById('mov-contratacoes-pendentes').textContent = totalVagasContratacao;

        // Popular lista de reposições pendentes
        document.getElementById('header-tempo-reposicao').textContent = filtroStatus === 'pendente' ? 'Tempo Aberto' : 'Data Preenchimento';
        const listaReposicoesEl = document.getElementById('reposicoes-pendentes-list');
        if (listaReposicoesEl) {
            if (reposicoesSnap.empty) {
                listaReposicoesEl.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Nenhuma reposição ${filtroStatus}</td></tr>`;
            } else {
                listaReposicoesEl.innerHTML = '';
                reposicoesSnap.forEach(doc => {
                    const reposicao = doc.data();
                    const abertaEm = reposicao.abertaEm?.toDate ? reposicao.abertaEm.toDate() : new Date();
                    const tempoAberto = filtroStatus === 'pendente' ? calcularDiferencaTempo(abertaEm) : formatarData(reposicao.preenchidaEm?.toDate());

                    let acoesBtn = ''; // Declaração da variável fora do if
                    if (filtroStatus === 'pendente') { // Ações apenas para status pendente
                        acoesBtn = `
                        <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); visualizarSolicitacao('${doc.id}', 'reposicao')" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); preencherVaga('${doc.id}', 'reposicao')" title="Preencher Vaga"><i class="fas fa-user-check"></i></button>
                        <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editarSolicitacao('${doc.id}', 'reposicao')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); excluirSolicitacao('${doc.id}', 'reposicao')" title="Excluir"><i class="fas fa-trash"></i></button>
                    `;
                    }
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${reposicao.cargo} <br><small class="text-muted">(${reposicao.funcionarioNome})</small></td>
                        <td><small class="text-muted">${tempoAberto}</small></td>
                        <td class="text-end text-nowrap">
                            <div class="btn-group" role="group">
                                ${acoesBtn}
                            </div>
                        </td>
                    `;
                    listaReposicoesEl.appendChild(row);
                });
            }
        }

        // Popular lista de contratações pendentes
        document.getElementById('header-tempo-contratacao').textContent = filtroStatus === 'pendente' ? 'Tempo Aberto' : 'Data Preenchimento';
        const listaContratacoesEl = document.getElementById('contratacoes-pendentes-list');
        if (listaContratacoesEl) {
            if (contratacoesSnap.empty) {
                listaContratacoesEl.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Nenhuma contratação ${filtroStatus}</td></tr>`;
            } else {
                listaContratacoesEl.innerHTML = '';
                for (const doc of contratacoesSnap.docs) {
                    const contratacao = doc.data();
                    const abertaEm = contratacao.abertaEm; // Passa o timestamp diretamente
                    const tempoAberto = filtroStatus === 'pendente' ? calcularDiferencaTempo(abertaEm) : formatarData(contratacao.preenchidaEm?.toDate());

                    let acoesBtn = '';
                    if (filtroStatus === 'pendente') {
                        acoesBtn = `
                        <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); visualizarSolicitacao('${doc.id}', 'contratacao')" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); preencherVaga('${doc.id}', 'contratacao')" title="Preencher Vaga"><i class="fas fa-user-check"></i></button>
                        <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editarSolicitacao('${doc.id}', 'contratacao')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); excluirSolicitacao('${doc.id}', 'contratacao')" title="Excluir"><i class="fas fa-trash"></i></button>
                    `;
                    }

                    // Aguarda o cálculo do custo estimado e multiplica pela quantidade
                    const custoEstimado = await calcularCustoEstimadoContratacao(parseFloat(contratacao.salario || 0), contratacao.empresaId);

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${contratacao.cargo} (${contratacao.quantidade || 1} vaga/s) <br><small class="text-muted">(${contratacao.setor})</small></td>
                        <td><small class="text-muted">${tempoAberto}</small></td>
                        <td class="d-none d-lg-table-cell text-end">R$ ${custoEstimado.toFixed(2)}</td>
                        <td class="text-end text-nowrap">
                            <div class="btn-group" role="group">${acoesBtn}</div>
                         </td>
                    `;
                    listaContratacoesEl.appendChild(row);
                }
            }
        }
        
        // Renderiza o novo gráfico de movimentações por setor
        await renderizarGraficoMovimentacoesPorSetor(reposicoesPendentesSnap, contratacoesPendentesSnap);

    } catch (error) {
        console.error('Erro ao carregar dashboard de movimentações:', error);
    }
}

let graficoReposicoesInstance = null;
let graficoContratacoesInstance = null;

async function renderizarGraficoMovimentacoesPorSetor(reposicoesSnap, contratacoesSnap) {
    const ctxReposicoes = document.getElementById('grafico-reposicoes-setor')?.getContext('2d');
    const ctxContratacoes = document.getElementById('grafico-contratacoes-setor')?.getContext('2d');

    if (!ctxReposicoes || !ctxContratacoes) return;

    const dadosSetores = {};

    reposicoesSnap.forEach(doc => {
        const setor = doc.data().setor || 'Não definido';
        if (!dadosSetores[setor]) dadosSetores[setor] = { reposicoes: 0, contratacoes: 0 };
        dadosSetores[setor].reposicoes++;
    });

    contratacoesSnap.forEach(doc => {
        const setor = doc.data().setor || 'Não definido';
        if (!dadosSetores[setor]) dadosSetores[setor] = { reposicoes: 0, contratacoes: 0 };
        dadosSetores[setor].contratacoes += (doc.data().quantidade || 1);
    });

    const labels = Object.keys(dadosSetores);
    const dataReposicoes = labels.map(setor => dadosSetores[setor].reposicoes);
    const dataContratacoes = labels.map(setor => dadosSetores[setor].contratacoes);

    // Destruir gráficos antigos
    if (graficoReposicoesInstance) graficoReposicoesInstance.destroy();
    if (graficoContratacoesInstance) graficoContratacoesInstance.destroy();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: { grid: { display: false } },
            y: { grid: { display: false }, beginAtZero: true }
        }
    };

    // Gráfico de Reposições
    graficoReposicoesInstance = new Chart(ctxReposicoes, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Reposições Pendentes',
                data: dataReposicoes,
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: chartOptions
    });

    // Gráfico de Contratações
    graficoContratacoesInstance = new Chart(ctxContratacoes, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vagas de Contratação',
                data: dataContratacoes,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: chartOptions
    });
}

// Filtra as movimentações quando o botão de filtro é clicado
function filtrarMovimentacoes() {
    carregarDashboardMovimentacoes();
}


// ============================
// 🛠️ FUNÇÕES UTILITÁRIAS
// ============================

// Formatar data
function formatarData(date) {
    if (!date) return '-';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

// Calcular diferença de tempo
function calcularDiferencaTempo(data) {
    const agora = new Date();
    const dataObj = data?.toDate ? data.toDate() : new Date(data); // Garante que é um objeto Date

    // Zera as horas para comparar apenas os dias
    agora.setHours(0, 0, 0, 0);
    dataObj.setHours(0, 0, 0, 0);

    const diferencaMs = agora.getTime() - dataObj.getTime();
    const dias = Math.round(diferencaMs / (1000 * 60 * 60 * 24)); // Arredonda para lidar com pequenas diferenças

    if (dias === 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    if (dias < 0) { // Data no futuro
        const diasFuturo = Math.abs(dias);
        if (diasFuturo === 1) return 'Amanhã';
        return `Em ${diasFuturo} dias`;
    }
    if (dias < 30) return `${dias} dias`;

    const meses = Math.floor(dias / 30);
    if (meses === 1) return '1 mês';
    if (meses < 12) return `${meses} meses`;

    const anos = Math.floor(meses / 12);
    return anos === 1 ? '1 ano' : `${anos} anos`;
}

// Mostrar mensagem
function mostrarMensagem(mensagem, tipo = 'success') {
    // Remover mensagens existentes
    const mensagensExistentes = document.querySelectorAll('.alert-toast');
    mensagensExistentes.forEach(msg => msg.remove());
    
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-success';
    
    const toast = document.createElement('div');
    toast.className = `alert-toast alert ${alertClass} alert-dismissible fade show`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

// Sair do sistema - FUNÇÃO CORRIGIDA
function sair() {
    console.log('Função sair() executada');
    if (confirm('Deseja realmente sair do sistema?')) {
        firebase.auth().signOut().then(() => {
            console.log('Usuário deslogado com sucesso');
            // Limpar dados locais
            localStorage.clear();
            sessionStorage.clear();
            // Redirecionar para login
            window.location.href = 'login.html';
        }).catch(error => {
            console.error('Erro ao sair:', error);
            mostrarMensagem('Erro ao sair do sistema: ' + error.message, 'error');
        });
    }
}

// Função genérica para abrir um modal com título e corpo customizados
function abrirModalGenerico(titulo, corpo) {
    const modalId = 'modalGenerico';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title" id="modalGenericoTitulo"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body" id="modalGenericoCorpo"></div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('modalGenericoTitulo').textContent = titulo;
    document.getElementById('modalGenericoCorpo').innerHTML = corpo;
    new bootstrap.Modal(modalEl).show();
}

// ============================
// 🎯 CONFIGURAÇÃO DO MENU DE USUÁRIO - CORRIGIDA
// ============================

// Configurar menu de usuário com event delegation
function configurarMenuUsuario() {
    console.log('Configurando menu de usuário...');
    
    // Event delegation para garantir que os cliques sejam capturados
    document.addEventListener('click', function(e) {
        // Verificar se o clique foi no botão de sair
        if (e.target.id === 'btn-sair' || e.target.closest('#btn-sair')) {
            e.preventDefault();
            console.log('Botão sair clicado via delegation');
            sair();
        }
        
        // Verificar se o clique foi no botão de configurações
        if (e.target.id === 'btn-configuracoes' || e.target.closest('#btn-configuracoes')) {
            e.preventDefault();
            console.log('Botão configurações clicado via delegation');
            mostrarMensagem("A tela de configurações ainda será implementada.", "info");
        }
    });
    
    // Também adicionar os event listeners diretamente (backup)
    setTimeout(() => {
        const btnSair = document.getElementById('btn-sair');
        const btnConfig = document.getElementById('btn-configuracoes');
        
        console.log('Procurando botões:', {
            btnSair: !!btnSair,
            btnConfig: !!btnConfig
        });
        
        if (btnSair) {
            btnSair.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Botão sair clicado (listener direto)');
                sair();
            });
        }
        
        if (btnConfig) {
            btnConfig.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Botão configurações clicado (listener direto)');
                mostrarMensagem("A tela de configurações ainda será implementada.", "info");
            });
        }
    }, 1000);
}

// Garante que a função de visualização da agenda esteja sempre disponível
window.visualizarEvento = window.visualizarEvento || function() { console.error("visualizarEvento não carregada"); };

// ============================
// 🎯 INICIALIZAÇÃO DO APP - CORRIGIDA
// ============================

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando Sistema RH...');
    
    // Inicializar modais
    inicializarModais();
    
    // Verificar autenticação
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Usuário logado:', user.email);
            
            // Buscar permissões do usuário
            const userDocRef = db.collection('usuarios').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                currentUserPermissions = userDoc.data().permissoes || {};
                currentUserPermissions.nome = userDoc.data().nome; // Adiciona o nome ao objeto de permissões
            } else {
                // Se o usuário não existe na coleção, cria um registro básico sem permissões
                currentUserPermissions = { isAdmin: false, secoesPermitidas: ['dashboard'], restricaoSetor: null };
                await userDocRef.set({
                    email: user.email,
                    nome: user.displayName || user.email.split('@')[0],
                    permissoes: currentUserPermissions
                }, { merge: true });
            }

            // Se for admin, tem acesso a tudo
            if (currentUserPermissions.isAdmin === true) {
                const todasAsSecoesAdmin = [...new Set(TODAS_SECOES.concat(['admin-usuarios']))];
                currentUserPermissions.secoesPermitidas = todasAsSecoesAdmin;

                // Garante que as permissões de admin sejam salvas no banco de dados
                await userDocRef.set({
                    permissoes: currentUserPermissions
                }, { merge: true });
            }

            // Atualizar nome do usuário na barra de navegação
            const userDisplayNameEl = document.getElementById('user-display-name');
            if (userDisplayNameEl) {
                userDisplayNameEl.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUserPermissions.nome || user.email}`;
            }

            // Configurar navegação
            inicializarNavegacao();
            
            // Configurar botões do menu de usuário
            const btnSair = document.getElementById('btn-sair');
            if (btnSair) {
                btnSair.addEventListener('click', (e) => { e.preventDefault(); sair(); });
            }

            const sidebarToggle = document.getElementById('sidebarToggle');
            if (sidebarToggle) {
                sidebarToggle.addEventListener('click', function() {
                    document.getElementById('sidebar').classList.toggle('show');
                    document.body.classList.toggle('sidebar-open');
                });
            }

            // Carregar dados iniciais
            await carregarDadosDashboard();
            await carregarLogoEmpresa();

            // Garante que a agenda seja carregada apenas após a autenticação
            if (typeof carregarAgenda === 'function') {
                await carregarAgenda();
            }

        } else {
            // Redirecionar para login se não estiver autenticado
            window.location.href = 'login.html';
        }
    });
});

// Verificar se Firebase está carregado (movido para o início do script)
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase não carregado!');
    document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h2>Erro de Configuração</h2>
            <p>Firebase não foi carregado corretamente.</p>
            <button onclick="location.reload()">Recarregar</button>
        </div>
    `;
    // Interrompe a execução do script se o Firebase não estiver carregado
    throw new Error("Firebase SDK não está carregado. A aplicação não pode continuar.");
}




// Carregar e exibir o logo da empresa
async function carregarLogoEmpresa() {
    const logoEl = document.getElementById('sidebar-logo');
    if (!logoEl) return;

    try {
        // Pega a primeira empresa da lista que tenha um logo definido (o campo ainda se chama logoUrl no DB)        
        const snapshot = await db.collection('empresas').where('logoUrl', '!=', '').limit(1).get();
        if (!snapshot.empty) {
            const empresa = snapshot.docs[0].data();
            const logoFilename = empresa.logoUrl; // O campo no DB ainda é logoUrl, mas contém o nome do arquivo
            if (logoFilename) {
                // Monta o caminho relativo para o arquivo de logo
                logoEl.src = `assets/logos/${logoFilename}`;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar logo da empresa:", error);
    }
}
// Inicializar navegação
function inicializarNavegacao() {
    // Verificar se as permissões foram carregadas antes de tentar construir o menu
    if (!currentUserPermissions || !currentUserPermissions.secoesPermitidas) {
        console.warn('Permissões do usuário ainda não foram carregadas. A navegação não será inicializada agora.');
        // Você pode opcionalmente mostrar um estado de "carregando" no menu aqui
        return;
    }

    const navContainer = document.getElementById('sidebar');

    // Esconde todos os itens de menu e sub-itens
    navContainer.querySelectorAll('.nav-item').forEach(item => item.style.display = 'none');

    // Mostra os itens permitidos
    currentUserPermissions.secoesPermitidas?.forEach(secao => {
        const link = navContainer.querySelector(`a[data-target="${secao}"]`);
        if (link) {
            // Torna o <li> do próprio link visível
            const navItemDoLink = link.closest('.nav-item');
            if (navItemDoLink) navItemDoLink.style.display = 'block';

            // Se o link está dentro de um submenu (um 'div.collapse'),
            // precisamos garantir que o menu pai também esteja visível.
            const parentCollapse = link.closest('.collapse');
            if (parentCollapse) {
                // Encontra o link <a> que controla (abre/fecha) o submenu.
                const toggleLink = navContainer.querySelector(`a[data-bs-toggle="collapse"][href="#${parentCollapse.id}"]`);
                if (toggleLink) {
                    // Torna o <li> do menu pai visível.
                    toggleLink.closest('.nav-item').style.display = 'block';
                }
            }
        }
    });

    // Adiciona o evento de clique a todos os links com data-target
    navContainer.querySelectorAll('a[data-target]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-target');
            // A verificação de permissão já foi feita para exibir o link, então podemos chamar diretamente
            if (currentUserPermissions.secoesPermitidas.includes(targetSection)) {
                showSection(targetSection);
            } else {
                mostrarMensagem('Você não tem permissão para acessar esta seção.', 'error');
            }
        });
    });

    // Adicionar evento de clique para o novo botão de sair na sidebar
    const btnSairSidebar = document.getElementById('btn-sair-sidebar');
    if (btnSairSidebar) {
        btnSairSidebar.style.display = 'block'; // Garante que o botão de sair sempre apareça
        btnSairSidebar.addEventListener('click', (e) => { e.preventDefault(); sair(); });
    }

    // Mostrar dashboard por padrão
    showSection('dashboard');
}

// Inicializar modais
function inicializarModais() {

// Inicializar a seção de análise de custos
async function inicializarAnaliseCustos() {
    console.log('Inicializando seção de Análise de Custos...');
    // Adicione aqui a lógica para carregar dados ou configurar a seção de análise de custos
}

    
    // Modal de funcionário
    const funcionarioModal = document.getElementById('funcionarioModal');
    if (funcionarioModal) {
        funcionarioModal.addEventListener('show.bs.modal', function(event) {
            // Verifica se o modal foi acionado pelo botão "Novo Funcionário"
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && relatedTarget.getAttribute('data-bs-target') === '#funcionarioModal') {
                document.getElementById('form-funcionario').reset();
                document.querySelector('#funcionarioModal .modal-title').textContent = 'Novo Funcionário';
                const salvarBtn = this.querySelector('.btn-primary');
                salvarBtn.textContent = 'Salvar Funcionário';
                salvarBtn.onclick = salvarFuncionario;

                // Carregar empresas no select e reseta os outros
                carregarSelectEmpresas('empresa-funcionario');
                document.getElementById('setor-funcionario').innerHTML = '<option value="">Selecione a empresa primeiro</option>';
                document.getElementById('cargo-funcionario').innerHTML = '<option value="">Selecione a empresa primeiro</option>';
            }
        });
    }
}