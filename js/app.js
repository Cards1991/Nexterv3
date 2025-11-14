// ============================
// 🎯 FUNÇÕES PRINCIPAIS DO APP
// ============================

// Lista de todas as seções disponíveis no sistema
const TODAS_SECOES = [ 
    'dashboard', 'empresas', 'funcionarios', 'afastamentos', 'atestados', 
    'faltas', 'movimentacoes', 'alteracao-funcao', 'dp-calculos', 'relatorios', 'financeiro', 
    'analise-rescisao', 'admin-usuarios', 'dashboard-manutencao', 'iso-maquinas', 'iso-organograma', 'iso-swot', 'controle-disciplinar',
    'iso-mecanicos', 'iso-manutencao', 'iso-temperatura-injetoras'
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
                await carregarEmpresas();
                break;
            case 'funcionarios':
                await carregarFuncionarios();
                break;
            case 'movimentacoes':
                await carregarMovimentacoes();
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
            case 'relatorios':
                if (typeof carregarRelatorios === 'function') {
                    await carregarRelatorios();
                }
                break;
            case 'financeiro':
                if (typeof inicializarFinanceiro === 'function') {
                    await inicializarFinanceiro();
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
            case 'iso-swot':
                if (typeof inicializarSwot === 'function') {
                    await inicializarSwot();
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
        
        // Carregar últimas movimentações
        await carregarUltimasMovimentacoes();
        
        // Carregar reposições pendentes
        await carregarReposicoesPendentes();
        
        // Carregar métricas de saúde ocupacional
        await carregarMetricasSaudeOcupacional();
        
        // Carregar contagens de solicitações abertas
        await carregarSolicitacoesAbertas();
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
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

// Carregar reposições pendentes
async function carregarReposicoesPendentes() {
    try {
        const contagemEl = document.getElementById('reposicoes-pendentes-contagem');
        const listaEl = document.getElementById('reposicoes-pendentes-list');
        
        if (!contagemEl || !listaEl) return;
        
        const reposicoesSnapshot = await db.collection('reposicoes')
            .where('status', '==', 'pendente')
            .orderBy('abertaEm', 'desc')
            .get();
            
        const totalPendentes = reposicoesSnapshot.size;
        contagemEl.textContent = totalPendentes;
        
        listaEl.innerHTML = '';
        
        if (reposicoesSnapshot.empty) {
            listaEl.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma reposição pendente</td></tr>';
            return;
        }
        
        reposicoesSnapshot.forEach(doc => {
            const reposicao = doc.data();
            const abertaEm = reposicao.abertaEm?.toDate ? reposicao.abertaEm.toDate() : new Date();
            const tempoAberto = calcularDiferencaTempo(abertaEm);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${reposicao.funcionarioNome || 'Funcionário não especificado'}</td>
                <td><small class="text-muted">${tempoAberto}</small></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-success" onclick="abrirBaixaReposicao('${doc.id}', '${reposicao.empresaId || ''}')">
                        <i class="fas fa-check"></i>
                    </button>
                </td>
            `;
            listaEl.appendChild(row);
        });
        
    } catch (error) {
        console.error('Erro ao carregar reposições pendentes:', error);
    }
}

// Carregar métricas de saúde ocupacional
async function carregarMetricasSaudeOcupacional() {
    try {
        const hoje = new Date();
        
        // Afastamentos ativos
        const afastamentosSnapshot = await db.collection('afastamentos')
            .where('status', '==', 'Ativo')
            .get();
        document.getElementById('afastamentos-ativos').textContent = afastamentosSnapshot.size;
        
        // Atestados do mês
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const atestadosSnapshot = await db.collection('atestados')
            .where('data_atestado', '>=', inicioMes)
            .get();
        document.getElementById('atestados-mes').textContent = atestadosSnapshot.size;
        
    } catch (error) {
        console.error('Erro ao carregar métricas de saúde:', error);
    }
}

// Carregar solicitações abertas
async function carregarSolicitacoesAbertas() {
    try {
        // Reposições abertas
        const reposicoesSnapshot = await db.collection('reposicoes')
            .where('status', '==', 'pendente')
            .get();
        document.getElementById('reposicoes-abertas').textContent = reposicoesSnapshot.size;
        
        // Contratações abertas
        const contratacoesSnapshot = await db.collection('contratacoes')
            .where('status', '==', 'pendente')
            .get();
        document.getElementById('contratacoes-abertas').textContent = contratacoesSnapshot.size;
        
    } catch (error) {
        console.error('Erro ao carregar solicitações abertas:', error);
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
    const diferenca = agora - new Date(data);
    const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
    
    if (dias === 0) return 'Hoje';
    if (dias === 1) return '1 dia';
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

            // Configurar sidebar toggle
            const sidebarToggle = document.getElementById('sidebarToggle');
            if (sidebarToggle) {
                sidebarToggle.addEventListener('click', function() {
                    document.getElementById('sidebar').classList.toggle('show');
                    document.body.classList.toggle('sidebar-open');
                });
            }
            
            // Carregar dados iniciais
            await carregarDadosDashboard();
            
        } else {
            // Redirecionar para login se não estiver autenticado
            window.location.href = 'login.html';
        }
    });
});
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
    currentUserPermissions.secoesPermitidas.forEach(secao => {
        const link = navContainer.querySelector(`a[data-target="${secao}"]`);
        if (link) {
            // Pega o .nav-item mais próximo do link
            const navItemDoLink = link.closest('.nav-item');
            if (navItemDoLink) navItemDoLink.style.display = 'block';

            // Se o item está em um submenu, mostra também o menu pai
            const parentCollapse = link.closest('.collapse');
            if (parentCollapse) {
                // Pega o .nav-item que contém o menu pai (ex: o <li> de "ISO 9001")
                const parentNavItem = parentCollapse.closest('.nav-item');
                if (parentNavItem) parentNavItem.style.display = 'block';
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
    // Modal de empresa
    const empresaModal = document.getElementById('empresaModal');
    if (empresaModal) {
        empresaModal.addEventListener('show.bs.modal', function(event) {
            // Verifica se o modal foi acionado pelo botão "Nova Empresa"
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && relatedTarget.getAttribute('data-bs-target') === '#empresaModal') {
                document.getElementById('form-empresa').reset();
                document.querySelector('#empresaModal .modal-title').textContent = 'Nova Empresa';
                const salvarBtn = this.querySelector('.btn-primary');
                salvarBtn.textContent = 'Salvar Empresa';
                salvarBtn.onclick = salvarEmpresa;
            }
        });
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