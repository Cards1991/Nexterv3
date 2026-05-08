// ============================
// 🎯 FUNÇÕES PRINCIPAIS DO APP
// ============================

// Lista de todas as seções disponíveis no sistema
const TODAS_SECOES = [
    'empresas', 'funcionarios', 'afastamentos', 'atestados', 'admissao', 'demissao', 'painel-demitidos',
    'faltas', 'movimentacoes', 'alteracao-funcao', 'transferencia', 'dp-calculos', 'relatorios', 'financeiro', 'agenda', 'iso-manutencao', 'chamados-manutencao',
    'analise-rescisao', 'analise-atestados', 'admin-usuarios', 'dashboard-manutencao', 'compliance-denuncia', 'analise-pessoas', 'gerenciar-avaliacoes', 'frota-dashboard', 'dp-horas-extras', 'dp-horas-extras-lancamento', 'saude-psicossocial', 'cid-manager', 'indicadores-direcao', 'controle-reunioes',
    'frota-veiculos', 'frota-motoristas', 'frota-utilizacao', 'frota-destinos', 'frota-tabelas-frete',
    'juridico-dashboard', 'juridico-processos', 'juridico-clientes', 'juridico-automacao', 'juridico-financeiro', 'juridico-documentos', 'dp-horas-solicitacao',
    'control-horas-autorizacao', 'juridico-analise-cpf',
    'iso-maquinas', 'iso-organograma', 'iso-swot', 'setores', 'setor-macro', 'controle-cestas',
    'iso-mecanicos', 'iso-manutencao', 'cadastro-mecanicos',
    'dashboard-faltas', 'dashboard-atividades', 'gestao-sumidos', 'analise-lotacao', 'treinamento', 'avaliacao-experiencia', 'controle-usuario-master', 'ponto-pf', 'ocorrencias', 'historico-colaborador', 'manutencao-mecanico',
    'gestao-cipa', 'brigada-incendio', 'controle-extintores',
    'ponto-eletronico', 'estoque-epi', 'consumo-epi', 'epi-compras', 'cadastro-epis', 'entrega-epis', 'analise-epi', 'controle-disciplinar',
    'producao-gestao', 'producao-lancamento', 'producao-bonus', 'producao-produtos', 'producao-leitura'
];

let currentUserPermissions = {};

// Variável para rastrear a seção atual
window.secaoAtual = null;

// Função showSection
async function showSection(sectionName) {
    // Aplica visibilidade baseada em papel
    if (typeof window.toggleRoleElements === 'function') {
        window.toggleRoleElements();
    }

    // Cleanup da seção anterior
    if (window.secaoAtual && window.secaoAtual !== sectionName) {
        try {
            switch (secaoAtual) {
                case 'controle-usuario-master':
                    if (typeof limparControleUsuarioMaster === 'function') limparControleUsuarioMaster();
                    break;
                case 'iso-manutencao':
                    if (typeof limparListenerManutencao === 'function') limparListenerManutencao();
                    break;
                case 'control-horas-autorizacao':
                    if (typeof limparListenerAutorizacao === 'function') limparListenerAutorizacao();
                    break;
                case 'manutencao-mecanico':
                    if (window.unsubscribeMeusChamados) {
                        window.unsubscribeMeusChamados();
                        window.unsubscribeMeusChamados = null;
                    }
                    break;
            }
        } catch (cleanupError) {
            console.warn(`Erro no cleanup da seção ${window.secaoAtual}:`, cleanupError);
        }
    }

    // Atualiza a seção atual
    window.secaoAtual = sectionName;

    // Esconder todas as seções estáticas do index
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.add('d-none');
    });

    // 🔴 IMPORTANTE: NÃO manipular modais aqui! Cada módulo gerencia seus próprios modais
    // Apenas reset básico do body, sem tocar em modais
    // 🛠️ CORREÇÃO: Limpeza de overlays remanescentes (dark screen) que podem ocorrer
    // ao trocar de seção sem fechar corretamente um modal ou por erro do Bootstrap.
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.body.classList.remove('modal-open');
    
    // Remove qualquer fundo escuro (backdrop) preso na tela
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());

    // Adiciona/remove classe especial para a página de denúncia
    if (sectionName === 'compliance-denuncia') {
        document.body.classList.add('denuncia-ativa');
    } else {
        document.body.classList.remove('denuncia-ativa');
    }

    // Oculta container dinâmico se já existir (evita conteúdo "por trás")
    const containerDinamico = document.getElementById('dynamic-content');
    if (containerDinamico) {
        containerDinamico.classList.add('d-none');
        containerDinamico.innerHTML = '';
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

        // Carregar scripts necessários para a seção
        if (typeof ScriptLoader !== 'undefined') {
            await ScriptLoader.loadForSection(sectionName);
        }

        // Carregar dados específicos da seção
        await carregarDadosSecao(sectionName);
    } else {
        // Tenta buscar a View dinâmica
        let mainContent = document.getElementById('dynamic-content');
        if (!mainContent) {
            mainContent = document.createElement('section');
            mainContent.id = 'dynamic-content';
            mainContent.className = 'content-section fade-in';
            document.querySelector('.content-wrapper').appendChild(mainContent);
        }

        mainContent.classList.remove('d-none');
        mainContent.innerHTML = '<div class="text-center mt-5"><i class="fas fa-spinner fa-spin fa-3x text-primary"></i><p class="mt-2 text-muted">Carregando módulo...</p></div>';

        try {
            // Carregar scripts necessários para a seção
            if (typeof ScriptLoader !== 'undefined') {
                await ScriptLoader.loadForSection(sectionName);
            }

            const resposta = await fetch(`views/${sectionName}.html`);
            if (!resposta.ok) {
                mainContent.innerHTML = '<div class="alert alert-danger mt-5">Tela não encontrada ou não migrada.</div>';
            } else {
                const html = await resposta.text();
                mainContent.innerHTML = html;

                if (sectionName === 'dp-horas-extras-lancamento' && typeof window.inicializarLancamentoHorasExtras === 'function') {
                    window.inicializarLancamentoHorasExtras();
                }

                await carregarDadosSecao(sectionName);
            }
        } catch (error) {
            console.error('Erro no fetch da seção:', error);
            mainContent.innerHTML = '<div class="alert alert-danger mt-5">Erro de conexão ao carregar a tela.</div>';
        }
    }

    // Atualizar menu ativo
    atualizarMenuAtivo(sectionName);
}

// Atualizar menu ativo
function atualizarMenuAtivo(activeSection) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`.nav-link[data-target="${activeSection}"]`);
    if (activeLink) {
        activeLink.classList.add('active');

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
        switch (sectionName) {
            case 'empresas':
                if (typeof carregarEmpresas === 'function') await carregarEmpresas();
                break;
            case 'setores':
                if (typeof inicializarSetores === 'function') await inicializarSetores();
                break;
            case 'analise-lotacao':
                if (typeof carregarDashboardSetores === 'function') await carregarDashboardSetores();
                break;
            case 'treinamento':
                if (typeof inicializarTreinamento === 'function') await inicializarTreinamento();
                break;
            case 'avaliacao-experiencia':
                if (typeof inicializarAvaliacaoExperiencia === 'function') await inicializarAvaliacaoExperiencia(currentUserPermissions);
                break;
            case 'manutencao-mecanico':
                if (typeof inicializarMeusChamados === 'function') await inicializarMeusChamados();
                break;
            case 'funcionarios':
                if (typeof inicializarFuncionarios === 'function') {
                    await inicializarFuncionarios();
                } else if (typeof carregarFuncionarios === 'function') {
                    await carregarFuncionarios();
                }
                break;
            case 'movimentacoes':
                if (window.movimentacoesManager) await window.movimentacoesManager.carregarDadosIniciais();
                if (typeof inicializarMovimentacoesDashboard === 'function') await inicializarMovimentacoesDashboard();
                break;
            case 'painel-demitidos':
                if (typeof inicializarPainelDemitidos === 'function') await inicializarPainelDemitidos();
                break;
            case 'admissao':
            case 'demissao':
                if (window.movimentacoesManager) {
                    if (sectionName === 'demissao') window.movimentacoesManager.resetarFormularioDemissao();
                    await window.movimentacoesManager.carregarDadosIniciais();
                }
                if (typeof configurarListenerDemissao === 'function') configurarListenerDemissao();
                break;
            case 'atestados':
                if (typeof inicializarAtestados === 'function') await inicializarAtestados();
                break;
            case 'ocorrencias':
                if (typeof inicializarOcorrencias === 'function') await inicializarOcorrencias();
                break;
            case 'producao-gestao':
            case 'producao-lancamento':
            case 'producao-bonus':
            case 'producao-produtos':
            case 'producao-leitura':
                if (typeof inicializarProducaoMetas === 'function') await inicializarProducaoMetas(sectionName);
                break;
            case 'faltas':
                if (typeof inicializarFaltas === 'function') await inicializarFaltas();
                break;
            case 'dashboard-faltas':
                if (typeof inicializarDashboardFaltas === 'function') await inicializarDashboardFaltas();
                if (typeof renderizarGraficoEvolucaoFaltas === 'function') await renderizarGraficoEvolucaoFaltas();
                break;
            case 'dashboard-atividades':
                if (typeof inicializarDashboardAtividades === 'function') await inicializarDashboardAtividades();
                break;
            case 'alteracao-funcao':
                if (typeof inicializarAlteracaoFuncao === 'function') await inicializarAlteracaoFuncao();
                break;
            case 'transferencia':
                if (typeof inicializarTransferencia === 'function') await inicializarTransferencia();
                break;
            case 'relatorios':
                if (typeof carregarRelatorios === 'function') await carregarRelatorios();
                break;
            case 'financeiro':
                if (typeof inicializarFinanceiro === 'function') {
                    if (typeof inicializarFiltrosFinanceiro === 'function') inicializarFiltrosFinanceiro();
                    await inicializarFinanceiro();
                }
                break;
            case 'agenda':
                if (typeof inicializarAgenda === 'function') {
                    await inicializarAgenda();
                } else if (typeof carregarAgenda === 'function') {
                    await carregarAgenda();
                }
                break;
            case 'admin-usuarios':
                if (typeof inicializarAdmin === 'function') await inicializarAdmin();
                break;
            case 'analise-rescisao':
                if (typeof inicializarAnaliseRescisao === 'function') await inicializarAnaliseRescisao();
                break;
            case 'iso-manutencao':
                if (typeof inicializarManutencao === 'function') await inicializarManutencao();
                break;
            case 'dashboard-manutencao':
                if (typeof inicializarDashboardManutencao === 'function') await inicializarDashboardManutencao();
                break;
            case 'iso-maquinas':
                if (typeof inicializarModuloMaquinas === 'function') {
                    await inicializarModuloMaquinas(db);
                }
                break;
            case 'manutencao-mecanico':
                if (typeof inicializarMeusChamados === 'function') await inicializarMeusChamados();
                break;
            case 'ponto-eletronico':
                if (typeof inicializarPontoEletronico === 'function') inicializarPontoEletronico();
                break;
            case 'iso-mecanicos':
            case 'cadastro-mecanicos':
                if (typeof inicializarCadastroMecanicos === 'function') await inicializarCadastroMecanicos();
                break;
            case 'iso-organograma':
                if (typeof inicializarOrganograma === 'function') await inicializarOrganograma();
                break;
            case 'dp-calculos':
                if (typeof inicializarCalculos === 'function') await inicializarCalculos();
                break;
            case 'controle-cestas':
                if (typeof inicializarControleCestas === 'function') await inicializarControleCestas();
                break;
            case 'controle-disciplinar':
                if (typeof inicializarControleDisciplinar === 'function') await inicializarControleDisciplinar();
                break;
            case 'dp-horas-extras':
                if (typeof inicializarHorasExtras === 'function') await inicializarHorasExtras();
                break;
            case 'dp-horas-extras-lancamento':
                if (typeof inicializarLancamentoHorasExtras === 'function') await inicializarLancamentoHorasExtras();
                break;
            case 'iso-swot':
                if (typeof inicializarSwot === 'function') await inicializarSwot();
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
            case 'cadastro-epis':
                if (typeof inicializarEstoqueEPI === 'function') inicializarEstoqueEPI();
                break;
            case 'entrega-epis':
                if (typeof carregarSelectFuncionariosAtivos === 'function') {
                    carregarSelectFuncionariosAtivos('entrega-funcionario-select');
                }
                break;
            case 'analise-epi':
                if (typeof carregarDashboardConsumoEPI === 'function') await carregarDashboardConsumoEPI();
                break;
            case 'analise-custos':
                if (typeof inicializarAnaliseCustos === 'function') await inicializarAnaliseCustos();
                break;
            case 'iso-avaliacao-colaboradores':
                if (typeof inicializarAvaliacaoColaboradores === 'function') await inicializarAvaliacaoColaboradores();
                break;
            case 'gerenciar-avaliacoes':
                if (typeof inicializarGerenciarAvaliacoes === 'function') await inicializarGerenciarAvaliacoes();
                break;
            case 'analise-pessoas':
                if (typeof inicializarAnalisePessoas === 'function') await inicializarAnalisePessoas(currentUserPermissions);
                break;
            case 'analise-atestados':
                if (typeof inicializarAnaliseAtestados === 'function') await inicializarAnaliseAtestados();
                break;
            case 'juridico-dashboard':
                if (typeof inicializarDashboardJuridico === 'function') await inicializarDashboardJuridico();
                break;
            case 'juridico-processos':
                if (typeof inicializarGestaoProcessos === 'function') await inicializarGestaoProcessos();
                break;
            case 'juridico-clientes':
                if (typeof inicializarGestaoClientes === 'function') await inicializarGestaoClientes();
                break;
            case 'frota-dashboard':
            case 'frota-veiculos':
            case 'frota-motoristas':
            case 'frota-utilizacao':
            case 'frota-destinos':
            case 'frota-tabelas-frete':
                if (typeof inicializarControleFrota === 'function') {
                    await inicializarControleFrota(sectionName);
                }
                break;
            case 'juridico-automacao':
                if (typeof inicializarAutomacaoPecas === 'function') await inicializarAutomacaoPecas();
                break;
            case 'juridico-financeiro':
                if (typeof inicializarFinanceiroJuridico === 'function') await inicializarFinanceiroJuridico();
                break;
            case 'juridico-documentos':
                if (typeof inicializarDocumentosJuridicos === 'function') await inicializarDocumentosJuridicos();
                break;
            case 'juridico-analise-cpf':
                if (typeof inicializarAnaliseCPF === 'function') await inicializarAnaliseCPF();
                break;
            case 'compliance-denuncia':
                break;
            case 'compliance-fazer-relato':
                break;
            case 'dp-horas-solicitacao':
                if (typeof inicializarTelaSolicitacao === 'function') await inicializarTelaSolicitacao();
                break;
            case 'control-horas-autorizacao':
                if (typeof inicializarTelaAutorizacao === 'function') await inicializarTelaAutorizacao();
                break;
            case 'saude-psicossocial':
                if (typeof inicializarSaudePsicossocial === 'function') {
                    await inicializarSaudePsicossocial();
                } else if (typeof SaudePsicossocial !== 'undefined' && typeof SaudePsicossocial.inicializar === 'function') {
                    await SaudePsicossocial.inicializar();
                }
                break;
            case 'cid-manager':
                if (typeof inicializarCidManager === 'function') await inicializarCidManager();
                break;
            case 'gestao-sumidos':
                if (typeof inicializarGestaoSumidos === 'function') await inicializarGestaoSumidos();
                break;
            case 'historico-colaborador':
                if (typeof inicializarHistoricoColaborador === 'function') await inicializarHistoricoColaborador();
                break;
            case 'indicadores-direcao':
                if (typeof inicializarIndicadoresDirecao === 'function') await inicializarIndicadoresDirecao();
                break;
            case 'controle-usuario-master':
                if (typeof inicializarControleUsuarioMaster === 'function') await inicializarControleUsuarioMaster();
                break;
            case 'ponto-pf':
                if (typeof inicializarPontoPF === 'function') inicializarPontoPF();
                break;
            case 'afastamentos':
                if (typeof inicializarAfastamentos === 'function') inicializarAfastamentos();
                break;
            case 'gestao-cipa':
                if (typeof inicializarGestaoCipa === 'function') await inicializarGestaoCipa();
                break;
            case 'brigada-incendio':
                if (typeof inicializarBrigadaIncendio === 'function') await inicializarBrigadaIncendio();
                break;
            case 'controle-extintores':
                if (typeof inicializarControleExtintores === 'function') await inicializarControleExtintores();
                break;
            case 'setor-macro':
                if (typeof inicializarSetorMacro === 'function') inicializarSetorMacro();
                break;
            case 'chamados-manutencao':
                if (typeof inicializarChamadosManutencao === 'function') await inicializarChamadosManutencao();
                break;
            case 'controle-reunioes':
                if (typeof inicializarControleReunioes === 'function') await inicializarControleReunioes();
                break;
        }
    } catch (error) {
        console.error(`Erro ao carregar dados da seção ${sectionName}:`, error);
    }
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
    const dataObj = data?.toDate ? data.toDate() : new Date(data);

    agora.setHours(0, 0, 0, 0);
    dataObj.setHours(0, 0, 0, 0);

    const diferencaMs = agora.getTime() - dataObj.getTime();
    const dias = Math.round(diferencaMs / (1000 * 60 * 60 * 24));

    if (dias === 0) return 'Hoje';
    if (dias === 1) return '1 dia';
    if (dias < 0) {
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

// Mostrar mensagem (toast)
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

// Sair do sistema
function sair() {
    if (confirm('Deseja realmente sair do sistema?')) {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            sessionStorage.clear();
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

// Adiciona a inicialização ao carregar as views
document.addEventListener('viewsLoaded', () => {
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
// 🎯 CONFIGURAÇÃO DO MENU DE USUÁRIO
// ============================

// Configurar menu de usuário com event delegation
function configurarMenuUsuario() {
    document.addEventListener('click', function (e) {
        if (e.target.id === 'btn-sair' || e.target.closest('#btn-sair')) {
            e.preventDefault();
            sair();
        }

        if (e.target.id === 'btn-configuracoes' || e.target.closest('#btn-configuracoes')) {
            e.preventDefault();
            mostrarMensagem("A tela de configurações ainda será implementada.", "info");
        }
    });
}

window.visualizarEvento = window.visualizarEvento || function () { };

// ============================
// 🎯 INICIALIZAÇÃO DO APP
// ============================

// Inicializar quando as views estiverem carregadas
document.addEventListener('viewsLoaded', function () {
    // Inicializar modais
    inicializarModais();

    // Verificar autenticação
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Se tínhamos um redirect agendado por estado null, cancela
            if (window.__BBX_LOGIN_REDIRECT_TIMEOUT__) {
                clearTimeout(window.__BBX_LOGIN_REDIRECT_TIMEOUT__);
                window.__BBX_LOGIN_REDIRECT_TIMEOUT__ = null;
            }

            // Garantia extra: marca como logado agora
            window.__BBX_AUTH_USER_PRESENT__ = true;

            // Se tínhamos um redirect agendado, cancela imediatamente
            if (window.__BBX_LOGIN_REDIRECT_TIMEOUT__) {
                clearTimeout(window.__BBX_LOGIN_REDIRECT_TIMEOUT__);
                window.__BBX_LOGIN_REDIRECT_TIMEOUT__ = null;
            }


            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.style.display = 'flex';
            }


            const userDocRef = db.collection('usuarios').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                currentUserPermissions = userDoc.data().permissoes || {};
                currentUserPermissions.nome = userDoc.data().nome;
                currentUserPermissions.funcionarioId = userDoc.data().funcionarioId;
                window.currentUserPermissions = currentUserPermissions;
                console.log('User permissions:', currentUserPermissions);
                
                // Garante que o mecânico tenha permissão para o próprio painel
                if (currentUserPermissions.isMecanico && !currentUserPermissions.secoesPermitidas.includes('manutencao-mecanico')) {
                    currentUserPermissions.secoesPermitidas.push('manutencao-mecanico');
                    await userDocRef.update({ 'permissoes.secoesPermitidas': firebase.firestore.FieldValue.arrayUnion('manutencao-mecanico') });
                }
            } else {
                currentUserPermissions = { 
                    isAdmin: false, 
                    isMecanico: false, 
                    isMecanicoAdmin: false, 
                    hasIsoAccess: true, 
                    secoesPermitidas: ['agenda', 'saude-psicossocial', 'atestados', 'afastamentos', 'iso-manutencao', 'iso-maquinas', 'iso-organograma', 'iso-swot', 'manutencao-mecanico'], 
                    restricaoSetor: null 
                };
                window.currentUserPermissions = currentUserPermissions;
                await userDocRef.set({
                    email: user.email,
                    nome: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
                    permissoes: currentUserPermissions
                }, { merge: true });
            }

            if (currentUserPermissions.isAdmin) {
                const todasAsSecoesAdmin = [...new Set(TODAS_SECOES.concat(['admin-usuarios']))];
                if (JSON.stringify(currentUserPermissions.secoesPermitidas?.sort()) !== JSON.stringify(todasAsSecoesAdmin.sort())) {
                    currentUserPermissions.secoesPermitidas = todasAsSecoesAdmin;
                    await userDocRef.update({ 'permissoes.secoesPermitidas': todasAsSecoesAdmin });
                } else {
                    currentUserPermissions.secoesPermitidas = todasAsSecoesAdmin;
                }
            }

            const userDisplayNameEl = document.getElementById('user-display-name');
            if (userDisplayNameEl) {
                userDisplayNameEl.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUserPermissions.nome || user.email}`;
            }

            if (typeof UserStatusManager !== 'undefined') {
                UserStatusManager.startKeepAlive(user);
            }

            inicializarNavegacao();

            if (typeof window.toggleRoleElements === 'function') {
                window.toggleRoleElements();
            }

            const btnSair = document.getElementById('btn-sair');
            if (btnSair) {
                btnSair.addEventListener('click', (e) => { e.preventDefault(); sair(); });
            }

            await carregarLogoEmpresa();

        } else {
            // Quando o Firebase retorna user=null (momento de reconexão/refresh), não redirecionar imediatamente.
            // Aguarda um curto período e re-checa o currentUser.
            const ms = 3000; // Aumentado para 3s para evitar o "flash" e volta ao login
            if (window.__BBX_LOGIN_REDIRECT_TIMEOUT__) {
                clearTimeout(window.__BBX_LOGIN_REDIRECT_TIMEOUT__);
            }

            if (window.__BBX_AUTH_USER_PRESENT__) return; // Se já logou uma vez, não expulsa por oscilação

            window.__BBX_LOGIN_REDIRECT_TIMEOUT__ = setTimeout(() => {
                try {
                    const currentUser = firebase.auth().currentUser;
                    if (currentUser) {
                        // Recuperou sessão, não redireciona.
                        return;
                    }

                    if (!window.location.href.includes('login.html')) {
                        window.location.replace('login.html');
                    }
                } catch (e) {
                    // Se algo der errado na checagem, não ficamos em loop.
                    if (!window.location.href.includes('login.html')) {
                        window.location.replace('login.html');
                    }
                }
            }, ms);
        }
    });
});

// Verificar se Firebase está carregado
if (typeof firebase === 'undefined') {
    document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h2>Erro de Configuração</h2>
            <p>Firebase não foi carregado corretamente.</p>
            <button onclick="location.reload()">Recarregar</button>
        </div>
    `;
    throw new Error("Firebase SDK não está carregado. A aplicação não pode continuar.");
}

// Carregar e exibir o logo da empresa
async function carregarLogoEmpresa() {
    const logoEl = document.getElementById('sidebar-logo');
    if (!logoEl) {
        console.warn('⚠️ Elemento #sidebar-logo não encontrado.');
        return;
    }

    try {
        const snapshot = await db.collection('empresas').where('logoUrl', '!=', '').limit(1).get();
        if (!snapshot.empty) {
            const empresa = snapshot.docs[0].data();
            const logoFilename = empresa.logoUrl;
            if (logoFilename) {
                // Tenta carregar de assets/logos/ ou assets/
                const possiblePaths = [
                    `assets/logos/${logoFilename}`,
                    `assets/${logoFilename}`,
                    logoFilename // se for uma URL completa
                ];
                
                // Por padrão, usa o primeiro, mas vamos validar se necessário
                // Para simplificar, vamos usar o que parece mais provável dado o list_dir
                logoEl.src = logoFilename.startsWith('http') ? logoFilename : `assets/${logoFilename}`;
                
                logoEl.onerror = () => {
                    if (logoEl.src.includes('assets/')) {
                        logoEl.src = `assets/logos/${logoFilename}`;
                    }
                };
            }
        } else {
            // Fallback para logo padrão se existir
            logoEl.src = 'assets/LOGO.png';
        }
    } catch (error) {
        console.error('Erro ao carregar logo:', error);
    }
}

// Inicializar navegação
function inicializarNavegacao() {
    if (!currentUserPermissions || !currentUserPermissions.secoesPermitidas) {
        return;
    }

    const navContainer = document.getElementById('sidebar');

    navContainer.querySelectorAll('.nav-item').forEach(item => item.style.display = 'none');

    currentUserPermissions.secoesPermitidas?.forEach(secao => {
        const link = navContainer.querySelector(`a[data-target="${secao}"]`);
        if (link) {
            const navItemDoLink = link.closest('.nav-item');
            if (navItemDoLink) navItemDoLink.style.display = 'block';

            let parentCollapse = link.closest('.collapse');
            while (parentCollapse) {
                const toggleLink = navContainer.querySelector(`a[data-bs-toggle="collapse"][href="#${parentCollapse.id}"]`);
                if (toggleLink) {
                    const parentNavItem = toggleLink.closest('.nav-item');
                    if (parentNavItem) parentNavItem.style.display = 'block';
                    parentCollapse = toggleLink.closest('.collapse');
                } else {
                    break;
                }
            }
        }
    });

    navContainer.querySelectorAll('a[data-target]').forEach(link => {
        link.addEventListener('click', function (e) {
            const targetSection = this.getAttribute('data-target');
            const isExternal = this.getAttribute('target') === '_blank';

            // Permissão extra para mecânico admin (gerente de manutenção de mecânicos)
            const isMecanicoAdmin = currentUserPermissions?.isMecanicoAdmin;
            const allowMecanicoAdminISO = isMecanicoAdmin && (targetSection === 'iso-manutencao' || targetSection === 'manutencao-mecanico' || targetSection.startsWith('iso-'));

            // Verifica permissão
            if (currentUserPermissions.secoesPermitidas.includes(targetSection) || allowMecanicoAdminISO) {
                if (isExternal) {
                    // Se for link externo (ex: Portal Mobile), deixa o navegador abrir a aba
                    return;
                }
                
                // Se for seção interna, previne o comportamento padrão e carrega
                e.preventDefault();
                showSection(targetSection);
            } else {
                e.preventDefault();
                mostrarMensagem('Você não tem permissão para acessar esta seção.', 'error');
            }
        });
    });

    const btnSairSidebar = document.getElementById('btn-sair-sidebar');
    if (btnSairSidebar) {
        btnSairSidebar.style.display = 'block';
        btnSairSidebar.addEventListener('click', (e) => { e.preventDefault(); sair(); });
    }

    let secaoInicial = 'agenda';

    // Se for mecânico normal (não admin), a tela inicial DEVE ser o painel integrado "Meus Chamados"
    if (currentUserPermissions.isMecanico && !currentUserPermissions.isAdmin) {
        secaoInicial = 'manutencao-mecanico';
    }

    if (currentUserPermissions.secoesPermitidas && !currentUserPermissions.secoesPermitidas.includes('agenda')) {
        const primeiraSecaoValida = currentUserPermissions.secoesPermitidas.find(secao => TODAS_SECOES.includes(secao));
        if (primeiraSecaoValida) {
            secaoInicial = primeiraSecaoValida;
        }
    }

    showSection(secaoInicial);
}

// Inicializar modais
function inicializarModais() {
    const funcionarioModal = document.getElementById('funcionarioModal');
    if (funcionarioModal) {
        funcionarioModal.addEventListener('show.bs.modal', function (event) {
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && relatedTarget.getAttribute('data-bs-target') === '#funcionarioModal') {
                document.getElementById('form-funcionario').reset();
                const form = document.getElementById('form-funcionario');
                if (form) delete form.dataset.funcionarioId;

                document.querySelector('#funcionarioModal .modal-title').textContent = 'Novo Funcionário';
                const salvarBtn = this.querySelector('.btn-primary');
                salvarBtn.textContent = 'Salvar Funcionário';
                salvarBtn.onclick = salvarFuncionario;

                carregarSelectEmpresas('empresa-funcionario');
                document.getElementById('setor-funcionario').innerHTML = '<option value="">Selecione a empresa primeiro</option>';
                document.getElementById('cargo-funcionario').innerHTML = '<option value="">Selecione a empresa primeiro</option>';

                if (typeof inicializarModalFuncionario === 'function') {
                    inicializarModalFuncionario();
                }

                const identificacaoTabContent = document.getElementById('identificacao');
                if (identificacaoTabContent && !document.getElementById('pis-funcionario')) {
                    const cpfInput = document.getElementById('cpf-funcionario');
                    if (cpfInput) {
                        const pisHtml = `
                            <div class="col-md-6 mb-3">
                                <label for="pis-funcionario" class="form-label">PIS</label>
                                <input type="text" class="form-control" id="pis-funcionario" placeholder="Número do PIS">
                            </div>
                        `;
                        const controlePontoHtml = `
                            <div class="col-md-6 mb-3 form-check form-switch d-flex align-items-center">
                                <input class="form-check-input" type="checkbox" id="controle-ponto-eletronico-funcionario">
                                <label class="form-check-label ms-2" for="controle-ponto-eletronico-funcionario">Controle de Ponto Eletrônico</label>
                            </div>
                        `;
                        cpfInput.closest('.row').insertAdjacentHTML('beforeend', pisHtml);
                        cpfInput.closest('.row').insertAdjacentHTML('beforeend', controlePontoHtml);
                    }
                }
            }
        });
    }
}

// Configurar Toggle do Menu Lateral e Fechamento ao Clicar Fora
function configurarSidebarToggle() {
    const mobileToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('show')) {
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

// Exportar para o window
window.carregarSelectEmpresas = carregarSelectEmpresas;
window.carregarSetoresPorEmpresa = carregarSetoresPorEmpresa;

// Função para configurar o preenchimento automático na tela de demissão
function configurarListenerDemissao() {
    const select = document.getElementById('demissao-funcionario');
    if (select && !select.dataset.listenerAdded) {
        select.addEventListener('change', async function () {
            const funcId = this.value;
            const setorInput = document.getElementById('demissao-setor');
            const gerenteInput = document.getElementById('demissao-gerente');

            if (!funcId) {
                if (setorInput) setorInput.value = '';
                if (gerenteInput) gerenteInput.value = '';
                return;
            }

            try {
                const doc = await db.collection('funcionarios').doc(funcId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (setorInput) setorInput.value = data.setor || '';

                    if (gerenteInput) {
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

// =========================================================
// 👑 CONTROLE USUÁRIO MASTER (Funcionalidades Adicionais)
// =========================================================

let chartEvolucaoTarefas = null;
let unsubscribeTarefasMaster = null;
let unsubscribeUsuariosOnlineMaster = null;
let controleUsuarioMasterInicializado = false;

function limparControleUsuarioMaster() {
    if (unsubscribeTarefasMaster) {
        unsubscribeTarefasMaster();
        unsubscribeTarefasMaster = null;
    }

    if (unsubscribeUsuariosOnlineMaster) {
        unsubscribeUsuariosOnlineMaster();
        unsubscribeUsuariosOnlineMaster = null;
    }

    if (chartEvolucaoTarefas) {
        chartEvolucaoTarefas.destroy();
        chartEvolucaoTarefas = null;
    }
}

async function inicializarControleUsuarioMaster() {
    const container = document.getElementById('controle-usuario-master');
    if (!container) return;

    if (controleUsuarioMasterInicializado) {
        limparControleUsuarioMaster();
    }

    controleUsuarioMasterInicializado = true;

    container.innerHTML = `
        <h2 class="page-title">Controle Usuário Master</h2>
        <div class="card">
            <div class="card-body">
                <div id="master-panel-content">
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div class="card h-100 border-primary">
                                <div class="card-header bg-primary text-white"><i class="fas fa-users"></i> Usuários Online</div>
                                <div class="card-body p-0">
                                    <ul class="list-group list-group-flush" id="lista-usuarios-online-master" style="max-height: 300px; overflow-y: auto;">
                                        <li class="list-group-item text-center text-muted">Carregando...</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div class="card h-100">
                                <div class="card-header"><i class="fas fa-chart-line"></i> Evolução de Tarefas em Tempo Real</div>
                                <div class="card-body">
                                    <canvas id="grafico-evolucao-tarefas-master" style="height: 300px;"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="alertas-tarefas-master" class="alert alert-info d-none">
                        <i class="fas fa-info-circle"></i> Aguardando atividades...
                    </div>
                </div>
            </div>
        </div>
    `;

    limparControleUsuarioMaster();
    iniciarMonitoramentoUsuariosOnlineMaster();
    iniciarMonitoramentoTarefasMaster();
}

function iniciarMonitoramentoUsuariosOnlineMaster() {
    const lista = document.getElementById('lista-usuarios-online-master');
    if (!lista) return;

    if (unsubscribeUsuariosOnlineMaster) {
        unsubscribeUsuariosOnlineMaster();
    }

    const limiteTempo = 30;

    unsubscribeUsuariosOnlineMaster = db.collection('user_status')
        .orderBy('last_seen', 'desc')
        .onSnapshot(snapshot => {
            let html = '';
            let onlineCount = 0;
            const agora = new Date();

            snapshot.forEach(doc => {
                const user = doc.data();
                const lastSeenDate = user.last_seen ? user.last_seen.toDate() : new Date(0);
                const diffMinutes = (agora - lastSeenDate) / 1000 / 60;
                const isOnline = diffMinutes < limiteTempo;

                if (isOnline) {
                    onlineCount++;
                    const horaFormatada = lastSeenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    html += `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span>
                                <i class="fas fa-circle text-success small me-2"></i> ${user.displayName || user.email || 'Usuário'}
                            </span>
                            <span class="badge bg-light text-dark" title="Visto às ${horaFormatada}">Online</span>
                        </li>
                    `;
                }
            });

            if (onlineCount === 0) {
                html = '<li class="list-group-item text-center text-muted">Nenhum usuário online no momento.</li>';
            }
            lista.innerHTML = html;
        }, error => {
            console.error("Erro ao ouvir status de usuários:", error);
            lista.innerHTML = '<li class="list-group-item text-center text-danger">Erro ao carregar usuários.</li>';
        });
}

function iniciarMonitoramentoTarefasMaster() {
    const ctx = document.getElementById('grafico-evolucao-tarefas-master')?.getContext('2d');
    if (!ctx) return;

    if (chartEvolucaoTarefas) {
        chartEvolucaoTarefas.destroy();
        chartEvolucaoTarefas = null;
    }

    chartEvolucaoTarefas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Tarefas Iniciadas', data: [], borderColor: '#0d6efd', tension: 0.4 },
                { label: 'Tarefas Concluídas', data: [], borderColor: '#198754', tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 } }
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (unsubscribeTarefasMaster) {
        unsubscribeTarefasMaster();
    }

    unsubscribeTarefasMaster = db.collection('agenda_atividades')
        .where('data', '>=', hoje)
        .onSnapshot(snapshot => {
            const iniciadas = snapshot.docs.filter(d => d.data().status === 'Em Andamento').length;
            const concluidas = snapshot.docs.filter(d => d.data().status === 'Concluído').length;

            const agora = new Date().toLocaleTimeString();

            if (chartEvolucaoTarefas && chartEvolucaoTarefas.data) {
                if (chartEvolucaoTarefas.data.labels.length > 10) {
                    chartEvolucaoTarefas.data.labels.shift();
                    chartEvolucaoTarefas.data.datasets[0].data.shift();
                    chartEvolucaoTarefas.data.datasets[1].data.shift();
                }

                chartEvolucaoTarefas.data.labels.push(agora);
                chartEvolucaoTarefas.data.datasets[0].data.push(iniciadas);
                chartEvolucaoTarefas.data.datasets[1].data.push(concluidas);
                chartEvolucaoTarefas.update();
            }

            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const data = change.doc.data();
                    const alertaDiv = document.getElementById('alertas-tarefas-master');
                    if (alertaDiv) {
                        alertaDiv.classList.remove('d-none');
                        let msg = '';
                        if (data.status === 'Em Andamento') {
                            msg = `<i class="fas fa-play text-primary"></i> <strong>${data.atribuidoParaNome || 'Usuário'}</strong> iniciou: "${data.titulo || 'Tarefa'}"`;
                        } else if (data.status === 'Concluído') {
                            msg = `<i class="fas fa-check text-success"></i> <strong>${data.atribuidoParaNome || 'Usuário'}</strong> concluiu: "${data.titulo || 'Tarefa'}"`;
                        }

                        if (msg) {
                            alertaDiv.innerHTML = msg;
                            alertaDiv.classList.add('bg-light');
                            setTimeout(() => alertaDiv.classList.remove('bg-light'), 500);
                        }
                    }
                }
            });
        });
}

// Exportar para global
window.inicializarControleUsuarioMaster = inicializarControleUsuarioMaster;
window.limparControleUsuarioMaster = limparControleUsuarioMaster;
window.mostrarMensagem = mostrarMensagem;
window.formatarData = formatarData;
window.calcularDiferencaTempo = calcularDiferencaTempo;
window.sair = sair;
window.abrirModalGenerico = abrirModalGenerico;
window.showSection = showSection;