// ============================
// 🎯 FUNÇÕES PRINCIPAIS DO APP
// ============================

// Lista de todas as seções disponíveis no sistema (MODIFICADO)
const TODAS_SECOES = [ 
    'empresas', 'funcionarios', 'afastamentos', 'atestados','admissao','demissao', 'painel-demitidos',
    'faltas', 'movimentacoes', 'alteracao-funcao', 'transferencia', 'dp-calculos', 'relatorios', 'financeiro', 'agenda', 'iso-manutencao',
    'analise-rescisao', 'analise-atestados', 'admin-usuarios', 'dashboard-manutencao', 'compliance-denuncia', 'analise-pessoas', 'gerenciar-avaliacoes', 'frota-dashboard', 'dp-horas-extras', 'dp-horas-extras-lancamento', 'saude-psicossocial', 'cid-manager',
    'frota-veiculos', 'frota-motoristas', 'frota-utilizacao', 'frota-destinos', 'frota-tabelas-frete',
    'juridico-dashboard', 'juridico-processos', 'juridico-clientes', 'juridico-automacao', 'juridico-financeiro', 'juridico-documentos', 'dp-horas-solicitacao',
    'control-horas-autorizacao', 'juridico-analise-cpf',
    'iso-maquinas', 'iso-organograma', 'iso-swot', 'setores', 'controle-cestas',
    'controle-disciplinar', 'iso-avaliacao-colaboradores', 'iso-mecanicos', 'iso-manutencao', 'iso-temperatura-injetoras', 'estoque-epi', 'consumo-epi', 'epi-compras', 'analise-epi', 'analise-custos', 'ocorrencias'
, 'dashboard-faltas', 'dashboard-atividades', 'gestao-sumidos', 'analise-lotacao', 'treinamento', 'avaliacao-experiencia', 'historico-colaborador'];

let currentUserPermissions = {};

// Função showSection
function showSection(sectionName) {
    
    // Esconder todas as seções
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.add('d-none');
    });

    // CORREÇÃO REFORÇADA: Remove backdrops de modais que possam ter ficado presos e reseta o body
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

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

        // Chama a função de inicialização específica para a seção
        if (sectionName === 'dp-horas-extras-lancamento' && typeof window.inicializarLancamentoHorasExtras === 'function') {
            window.inicializarLancamentoHorasExtras();
        }
    } else {
        return; // Sai da função se a seção não for encontrada
    }
    // Carregar dados específicos da seção DEPOIS de torná-la visível
    carregarDadosSecao(sectionName);
    
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
            case 'empresas':
                if (typeof carregarEmpresas === 'function') {
                    await carregarEmpresas();
                }
                break;
            case 'setores':
                if (typeof inicializarSetores === 'function') {
                    await inicializarSetores();
                }
                break;
            case 'analise-lotacao':
                if (typeof carregarDashboardSetores === 'function') {
                    await carregarDashboardSetores();
                }
                break;
            case 'treinamento':
                if (typeof inicializarTreinamento === 'function') {
                    await inicializarTreinamento();
                }
                break;
            case 'avaliacao-experiencia':
                if (typeof inicializarAvaliacaoExperiencia === 'function') {
                    await inicializarAvaliacaoExperiencia();
                }
                break;
            case 'funcionarios':
                await carregarFuncionarios();
                break;
            case 'movimentacoes':
                if (window.movimentacoesManager) await window.movimentacoesManager.carregarDadosIniciais();
                if (typeof inicializarMovimentacoesDashboard === 'function') await inicializarMovimentacoesDashboard();
                break;
            case 'admissao':
            case 'demissao':
                if (window.movimentacoesManager) {
                    if (sectionName === 'demissao') window.movimentacoesManager.resetarFormularioDemissao();
                    await window.movimentacoesManager.carregarDadosIniciais();
                }
                if (typeof configurarListenerDemissao === 'function') {
                    configurarListenerDemissao();
                }
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
            case 'dashboard-faltas':
                if (typeof inicializarDashboardFaltas === 'function') {
                    await inicializarDashboardFaltas();
                }
                if (typeof renderizarGraficoEvolucaoFaltas === 'function') {
                    await renderizarGraficoEvolucaoFaltas();
                }
                break;
            case 'dashboard-atividades':
                if (typeof inicializarDashboardAtividades === 'function') {
                    await inicializarDashboardAtividades();
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
                if (typeof carregarAgenda === 'function') {
                    await carregarAgenda();
                }
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
            case 'controle-cestas':
                if (typeof inicializarControleCestas === 'function') {
                    await inicializarControleCestas();
                }
                break;
            case 'dp-horas-extras':
                if (typeof inicializarHorasExtras === 'function') {
                    await inicializarHorasExtras();
                }
                break;
            case 'dp-horas-extras-lancamento':
                if (typeof inicializarLancamentoHorasExtras === 'function') {
                    await inicializarLancamentoHorasExtras();
                }
                break;
            case 'iso-swot':
                if (typeof inicializarSwot === 'function') {
                    await inicializarSwot();
                }
                break;
            case 'estoque-epi':
                if (typeof inicializarEstoqueEPI === 'function') await inicializarEstoqueEPI();
                break;
            case 'consumo-epi':
                if (typeof inicializarConsumoEPI === 'function') await inicializarConsumoEPI();
                break;
            case 'epi-compras':
                if (typeof inicializarComprasEPI === 'function') await inicializarComprasEPI();
                break;
            case 'analise-epi':
                if (typeof carregarDashboardConsumoEPI === 'function') {
                    await carregarDashboardConsumoEPI();
                }
                break;
             case 'analise-custos':
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
            case 'analise-atestados':
                if (typeof inicializarAnaliseAtestados === 'function') {
                    await inicializarAnaliseAtestados();
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
            case 'frota-destinos':
            case 'frota-tabelas-frete':
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
            case 'juridico-analise-cpf':
                if (typeof inicializarAnaliseCPF === 'function') {
                    await inicializarAnaliseCPF();
                }
                break;
            case 'compliance-denuncia':
                // Nenhuma ação de carregamento de dados necessária por enquanto
                // Apenas exibe a seção estática.
                break;
            case 'compliance-fazer-relato':
                // Também não precisa de carregamento de dados, apenas exibe.
                // A lógica de habilitação dos botões já está no inicializador.
                break;
            case 'dp-horas-solicitacao':
                if (typeof inicializarTelaSolicitacao === 'function') {
                    await inicializarTelaSolicitacao();
                }
                break;
            case 'control-horas-autorizacao':
                if (typeof inicializarTelaAutorizacao === 'function') {
                    await inicializarTelaAutorizacao();
                }
                break;            case 'saude-psicossocial':
                if (typeof inicializarSaudePsicossocial === 'function') {
                    await inicializarSaudePsicossocial();
                }
                break;
            case 'cid-manager':
                if (typeof inicializarCidManager === 'function') {
                    await inicializarCidManager();
                }
                break;
            case 'gestao-sumidos':
                if (typeof inicializarGestaoSumidos === 'function') {
                    await inicializarGestaoSumidos();
                }
                break;
            case 'ocorrencias':
                if (typeof inicializarOcorrencias === 'function') {
                    await inicializarOcorrencias();
                }
                break;
            case 'historico-colaborador':
                if (typeof inicializarHistoricoColaborador === 'function') {
                    await inicializarHistoricoColaborador();
                }
                break;
            case 'historico-colaborador':
                if (typeof inicializarHistoricoColaborador === 'function') {
                    await inicializarHistoricoColaborador();
                }
                break;
        }
    } catch (error) {
        console.error(`Erro ao carregar seção ${sectionName}:`, error);
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

    // Define as datas padrão para o mês atual
    const filtroInicioInput = document.getElementById('mov-filtro-inicio');
    const filtroFimInput = document.getElementById('mov-filtro-fim');

    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    filtroInicioInput.value = primeiroDia.toISOString().split('T')[0];
    filtroFimInput.value = ultimoDia.toISOString().split('T')[0];

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
        const filtroInicio = document.getElementById('mov-filtro-inicio')?.value;
        const filtroFim = document.getElementById('mov-filtro-fim')?.value;

        // --- Query para as listas (respeita o filtro de status) ---
        // CORREÇÃO: Simplifica a query para evitar erro de índice. Filtros de status, empresa e setor serão aplicados no cliente.
        let reposicoesQuery = db.collection('reposicoes');
        let contratacoesQuery = db.collection('contratacoes');

        if (filtroInicio) {
            const dataInicio = new Date(filtroInicio + 'T00:00:00');
            reposicoesQuery = reposicoesQuery.where('abertaEm', '>=', dataInicio);
            contratacoesQuery = contratacoesQuery.where('abertaEm', '>=', dataInicio);
        }
        if (filtroFim) {
            const dataFim = new Date(filtroFim + 'T23:59:59');
            reposicoesQuery = reposicoesQuery.where('abertaEm', '<=', dataFim);
            contratacoesQuery = contratacoesQuery.where('abertaEm', '<=', dataFim);
        }

        const [
            reposicoesSnap, 
            contratacoesSnap
        ] = await Promise.all([
            reposicoesQuery.orderBy('abertaEm', 'desc').get(),
            contratacoesQuery.orderBy('abertaEm', 'desc').get()
        ]);

        // --- Filtro no lado do cliente para evitar erro de índice ---
        const reposicoesDocs = reposicoesSnap.docs;
        const contratacoesDocs = contratacoesSnap.docs;

        const clientSideFilter = (doc, statusEsperado) => {
            const data = doc.data();
            const statusAtual = data.status || 'pendente'; // Assume 'pendente' se o status não existir
            if (statusEsperado && statusAtual !== statusEsperado) return false;
            if (filtroEmpresa && data.empresaId !== filtroEmpresa) return false;
            if (filtroSetor && data.setor !== filtroSetor) return false;
            return true;
        };

        const reposicoesFiltradas = reposicoesDocs.filter(doc => clientSideFilter(doc, filtroStatus));
        const contratacoesFiltradas = contratacoesDocs.filter(doc => clientSideFilter(doc, filtroStatus));
        
        const reposicoesPendentesFiltradas = reposicoesDocs.filter(doc => clientSideFilter(doc, 'pendente'));
        const contratacoesPendentesFiltradas = contratacoesDocs.filter(doc => clientSideFilter(doc, 'pendente'));

        const totalReposicoesPendentes = reposicoesPendentesFiltradas.length;

        // Soma a quantidade de vagas de cada solicitação de contratação
        let totalVagasContratacao = 0;
        contratacoesPendentesFiltradas.forEach(doc => {
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
            if (reposicoesFiltradas.length === 0) {
                listaReposicoesEl.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Nenhuma reposição ${filtroStatus}</td></tr>`;
            } else {
                listaReposicoesEl.innerHTML = '';
                reposicoesFiltradas.forEach(doc => {
                    const reposicao = doc.data();
                    const abertaEm = reposicao.abertaEm?.toDate ? reposicao.abertaEm.toDate() : new Date();
                    const statusAtual = reposicao.status || 'pendente';
                    const tempoAberto = filtroStatus === 'pendente' ? calcularDiferencaTempo(abertaEm) : formatarData(reposicao.preenchidaEm?.toDate());

                    // Status Badge e Informações de Preenchimento
                    const statusLabel = statusAtual === 'preenchida' ? 'Preenchido' : 'Em Aberto';
                    const statusClass = statusAtual === 'preenchida' ? 'bg-success' : 'bg-warning text-dark';
                    const statusBadge = `<span class="badge ${statusClass} ms-2">${statusLabel}</span>`;

                    let filledByInfo = '';
                    if (statusAtual === 'preenchida' && reposicao.funcionarioPreenchimentoNome) {
                        filledByInfo = `<div class="small text-success mt-1"><i class="fas fa-check-circle"></i> Preenchida por: <strong>${reposicao.funcionarioPreenchimentoNome}</strong></div>`;
                    }

                    // Botões de Preencher e Editar (agora na coluna de ações)
                    let btnPreencherInline = '';
                    
                    let acoesBtn = `
                                                <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); visualizarSolicitacao('${doc.id}', 'reposicao')" title="Visualizar"><i class="fas fa-eye"></i></button>
                                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); preencherVaga('${doc.id}', 'reposicao')" title="Preencher Vaga"><i class="fas fa-user-check"></i></button>
                                            `;
                        
                                            acoesBtn += `<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); excluirSolicitacao('${doc.id}', 'reposicao')" title="Excluir"><i class="fas fa-trash"></i></button>`;
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    ${reposicao.cargo} <small class="text-muted">(${reposicao.funcionarioNome})</small>
                                    ${filledByInfo}
                                </div>
                                ${btnPreencherInline}
                            </div>
                        </td>
                        <td class="text-center">${statusBadge}</td>
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
            if (contratacoesFiltradas.length === 0) {
                listaContratacoesEl.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Nenhuma contratação ${filtroStatus}</td></tr>`;
            } else {
                listaContratacoesEl.innerHTML = '';
                for (const doc of contratacoesFiltradas) {
                    const contratacao = doc.data();
                    const abertaEm = contratacao.abertaEm; // Passa o timestamp diretamente
                    const tempoAberto = filtroStatus === 'pendente' ? calcularDiferencaTempo(abertaEm) : formatarData(contratacao.preenchidaEm?.toDate());

                    let acoesBtn = '';
                    acoesBtn = `
                        <button class="btn btn-sm btn-outline-info" onclick="event.stopPropagation(); visualizarSolicitacao('${doc.id}', 'contratacao')" title="Visualizar"><i class="fas fa-eye"></i></button>
                        ${filtroStatus === 'pendente' ? `<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); preencherVaga('${doc.id}', 'contratacao')" title="Preencher Vaga"><i class="fas fa-user-check"></i></button>` : ''}
                        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); excluirSolicitacao('${doc.id}', 'contratacao')" title="Excluir"><i class="fas fa-trash"></i></button>
                    `;

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
        await renderizarGraficoMovimentacoesPorSetor(reposicoesPendentesFiltradas, contratacoesPendentesFiltradas);

    } catch (error) {
    }
}

let graficoReposicoesInstance = null;
let graficoContratacoesInstance = null;

async function renderizarGraficoMovimentacoesPorSetor(reposicoes, contratacoes) {
    const ctxReposicoes = document.getElementById('grafico-reposicoes-setor')?.getContext('2d');
    const ctxContratacoes = document.getElementById('grafico-contratacoes-setor')?.getContext('2d');

    if (!ctxReposicoes || !ctxContratacoes) return;

    const dadosSetores = {};

    reposicoes.forEach(doc => {
        const setor = doc.data().setor || 'Não definido';
        if (!dadosSetores[setor]) dadosSetores[setor] = { reposicoes: 0, contratacoes: 0 };
        dadosSetores[setor].reposicoes++;
    });

    contratacoes.forEach(doc => {
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
    if (confirm('Deseja realmente sair do sistema?')) {
        firebase.auth().signOut().then(() => {
            // Limpar dados locais
            localStorage.clear();
            sessionStorage.clear();
            // Redirecionar para login
            window.location.href = 'login.html';
        }).catch(error => {
            mostrarMensagem('Erro ao sair do sistema: ' + error.message, 'error');
        });
    }
}

// ========================================
// Módulo: Canal de Denúncia
// ========================================

function inicializarCanalDenuncia() {
    const btnFazerRelato = document.getElementById('btn-fazer-relato');
    if (btnFazerRelato) {
        btnFazerRelato.addEventListener('click', () => {
            showSection('compliance-fazer-relato');
        });
    }

    const checkConcordancia = document.getElementById('check-concordancia-relato');
    if (checkConcordancia) {
        checkConcordancia.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.getElementById('btn-concordo-termos').disabled = !isChecked;
            document.getElementById('btn-nao-concordo-termos').disabled = !isChecked;
        });
    }
}

// Adiciona a inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
    inicializarCanalDenuncia();
    configurarSidebarToggle();
});

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
    
    // Event delegation para garantir que os cliques sejam capturados
    document.addEventListener('click', function(e) {
        // Verificar se o clique foi no botão de sair
        if (e.target.id === 'btn-sair' || e.target.closest('#btn-sair')) {
            e.preventDefault();
            sair();
        }
        
        // Verificar se o clique foi no botão de configurações
        if (e.target.id === 'btn-configuracoes' || e.target.closest('#btn-configuracoes')) {
            e.preventDefault();
            mostrarMensagem("A tela de configurações ainda será implementada.", "info");
        }
    });
    
    // Também adicionar os event listeners diretamente (backup)
    setTimeout(() => {
        const btnSair = document.getElementById('btn-sair');
        const btnConfig = document.getElementById('btn-configuracoes');
        
        
        if (btnSair) {
            btnSair.addEventListener('click', function(e) {
                e.preventDefault();
                sair();
            });
        }
        
        if (btnConfig) {
            btnConfig.addEventListener('click', function(e) {
                e.preventDefault();
                mostrarMensagem("A tela de configurações ainda será implementada.", "info");
            });
        }
    }, 1000);
}

// Garante que a função de visualização da agenda esteja sempre disponível
window.visualizarEvento = window.visualizarEvento || function() { };

// ============================
// 🎯 INICIALIZAÇÃO DO APP - CORRIGIDA
// ============================

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    
    // Inicializar modais
    inicializarModais();
    
    // Verificar autenticação
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {

            // Torna a aplicação visível para evitar "flash" da tela
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.style.display = 'flex';
            }
            
            // Buscar permissões do usuário
            const userDocRef = db.collection('usuarios').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                currentUserPermissions = userDoc.data().permissoes || {};
                currentUserPermissions.nome = userDoc.data().nome; // Adiciona o nome ao objeto de permissões
            } else {
                // Por padrão, novos usuários terão acesso a agenda, saúde psicossocial, atestados e afastamentos.
                currentUserPermissions = { isAdmin: false, secoesPermitidas: ['agenda', 'saude-psicossocial', 'atestados', 'afastamentos'], restricaoSetor: null };
                await userDocRef.set({
                    email: user.email,
                    nome: user.displayName || user.email.split('@')[0],
                    permissoes: currentUserPermissions
                }, { merge: true });
            }

            if (currentUserPermissions.isAdmin) { // Se o usuário é admin
                const todasAsSecoesAdmin = [...new Set(TODAS_SECOES.concat(['admin-usuarios']))];

                // Verifica se as permissões do admin no Firestore estão atualizadas
                // Se não estiverem, atualiza o documento do usuário no Firestore
                if (JSON.stringify(currentUserPermissions.secoesPermitidas.sort()) !== JSON.stringify(todasAsSecoesAdmin.sort())) {
                    currentUserPermissions.secoesPermitidas = todasAsSecoesAdmin; // Atualiza em memória
                    await userDocRef.update({ 'permissoes.secoesPermitidas': todasAsSecoesAdmin }); // Atualiza no Firestore
                } else {
                    currentUserPermissions.secoesPermitidas = todasAsSecoesAdmin; // Apenas atualiza em memória
                }
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

            // Carregar dados iniciais
            await carregarLogoEmpresa();

        } else {
            // Redirecionar para login se não estiver autenticado
            // Verifica se já não está na página de login para evitar loops
            if (!window.location.href.includes('login.html')) {
                 window.location.replace('login.html');
            }
        }
    });
});

// Verificar se Firebase está carregado (movido para o início do script)
if (typeof firebase === 'undefined') {
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
    }
}
// Inicializar navegação
function inicializarNavegacao() {
    // Verificar se as permissões foram carregadas antes de tentar construir o menu
    if (!currentUserPermissions || !currentUserPermissions.secoesPermitidas) {
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
            // CORREÇÃO: Loop para suportar múltiplos níveis de aninhamento (ex: DP -> Cálculos -> Solicitação)
            let parentCollapse = link.closest('.collapse');
            while (parentCollapse) {
                // Encontra o link <a> que controla (abre/fecha) o submenu.
                const toggleLink = navContainer.querySelector(`a[data-bs-toggle="collapse"][href="#${parentCollapse.id}"]`);
                if (toggleLink) {
                    // Torna o <li> do menu pai visível.
                    const parentNavItem = toggleLink.closest('.nav-item');
                    if (parentNavItem) parentNavItem.style.display = 'block';
                    
                    // Busca o próximo collapse pai (se houver) para continuar subindo na hierarquia
                    parentCollapse = toggleLink.closest('.collapse');
                } else {
                    break;
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

    // Determinar a seção inicial com base nas permissões
    let secaoInicial = 'agenda';

    // Se o usuário não tem permissão para ver a agenda, redireciona para a primeira seção que ele tem acesso
    if (currentUserPermissions.secoesPermitidas && !currentUserPermissions.secoesPermitidas.includes('agenda')) {
        const primeiraSecaoValida = currentUserPermissions.secoesPermitidas.find(secao => TODAS_SECOES.includes(secao));
        if (primeiraSecaoValida) {
            secaoInicial = primeiraSecaoValida;
        }
    }

    // Mostrar seção inicial
    showSection(secaoInicial);
}

// Inicializar modais
function inicializarModais() {

    // Modal de funcionário
    const funcionarioModal = document.getElementById('funcionarioModal');
    if (funcionarioModal) {
        funcionarioModal.addEventListener('show.bs.modal', function(event) {
            // Verifica se o modal foi acionado pelo botão "Novo Funcionário"
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && relatedTarget.getAttribute('data-bs-target') === '#funcionarioModal') {
                document.getElementById('form-funcionario').reset();
                // Limpa o ID armazenado para evitar conflito com biometria de outro funcionário
                const form = document.getElementById('form-funcionario');
                if (form) delete form.dataset.funcionarioId;

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

        // Listener para carregar setores quando a empresa é selecionada no modal de funcionário
        const empresaSelect = document.getElementById('empresa-funcionario');
        if (empresaSelect) {
            empresaSelect.addEventListener('change', function() {
                carregarSetoresPorEmpresa(this.value, 'setor-funcionario');
            });
        }
    }
}

// Configurar Toggle do Menu Lateral e Fechamento ao Clicar Fora
function configurarSidebarToggle() {
    const mobileToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    // Configuração para Mobile
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique no botão feche o menu imediatamente
            sidebar.classList.toggle('show');
        });
    }

    // Fechar sidebar ao clicar em qualquer outro lugar (Mobile)
    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('show')) {
            // Se o clique não foi no menu nem no botão de abrir
            if (!sidebar.contains(e.target) && (!mobileToggle || !mobileToggle.contains(e.target))) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// ========================================
// FUNÇÕES GLOBAIS DE CARREGAMENTO DE DADOS
// ========================================

async function carregarSelectEmpresas(selectId, empresaSelecionadaId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Carregando...</option>';

    try {
        const snapshot = await db.collection('empresas').orderBy('nome').get();
        
        if (snapshot.empty) {
            select.innerHTML = '<option value="">Nenhuma empresa cadastrada</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione...</option>';
        
        snapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            if (empresaSelecionadaId && empresaSelecionadaId === doc.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Se houver uma empresa selecionada, dispara o evento change para carregar os setores
        if (empresaSelecionadaId) {
            select.dispatchEvent(new Event('change'));
        }

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function carregarSetoresPorEmpresa(empresaId, selectId, setorSelecionado = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    if (!empresaId) {
        select.innerHTML = '<option value="">Selecione a empresa primeiro</option>';
        return;
    }

    select.innerHTML = '<option value="">Carregando...</option>';

    try {        
        // CORREÇÃO: Removido orderBy('descricao') para evitar erro de índice composto. Ordenação feita em memória.
        const setoresSnapshot = await db.collection('setores')
            .where('empresaId', '==', empresaId)
            .get();

        if (setoresSnapshot.empty) {
            select.innerHTML = '<option value="">Nenhum setor cadastrado</option>';
            return;
        }

        select.innerHTML = '<option value="">Selecione...</option>';
        
        const setoresDocs = setoresSnapshot.docs.sort((a, b) => {
            const descA = a.data().descricao || '';
            const descB = b.data().descricao || '';
            return descA.localeCompare(descB);
        });

        setoresDocs.forEach(doc => {
            const setor = doc.data().descricao;
            const option = document.createElement('option');
            option.value = setor;
            option.textContent = setor;
            if (setorSelecionado && setorSelecionado === setor) {
                option.selected = true;
            }
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// Exportar para o window para garantir acesso global
window.carregarSelectEmpresas = carregarSelectEmpresas;
window.carregarSetoresPorEmpresa = carregarSetoresPorEmpresa;


// Função para configurar o preenchimento automático na tela de demissão
function configurarListenerDemissao() {
    const select = document.getElementById('demissao-funcionario');
    if (select && !select.dataset.listenerAdded) {
        select.addEventListener('change', async function() {
            const funcId = this.value;
            const setorInput = document.getElementById('demissao-setor');
            const gerenteInput = document.getElementById('demissao-gerente');
            
            if (!funcId) {
                if(setorInput) setorInput.value = '';
                if(gerenteInput) gerenteInput.value = '';
                return;
            }
            
            try {
                const doc = await db.collection('funcionarios').doc(funcId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if(setorInput) setorInput.value = data.setor || '';
                    
                    if(gerenteInput) {
                        if (data.liderId) {
                            const liderDoc = await db.collection('funcionarios').doc(data.liderId).get();
                            gerenteInput.value = liderDoc.exists ? liderDoc.data().nome : 'Não encontrado';
                        } else {
                            gerenteInput.value = 'Não informado';
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao carregar detalhes do funcionário para demissão:", error);
            }
        });
        select.dataset.listenerAdded = 'true';
    }
}
window.configurarListenerDemissao = configurarListenerDemissao;