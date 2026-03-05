// =========================================================
// Módulo Mobile de Abertura de Chamados (Via QR Code)
// Versão com Login Obrigatório
// =========================================================

let db;
let auth;
let currentUser = null;
let isLoggedIn = false;

/**
 * Carrega dinamicamente os scripts do Firebase SDK
 * Usa versão 8.x para manter compatibilidade com o HTML
 */
async function carregarFirebaseSDK() {
    // Verificar se já está carregado
    if (typeof firebase !== 'undefined') {
        console.log("✅ Firebase SDK já carregado");
        return;
    }

    console.log("📦 Carregando Firebase SDK dinamicamente...");

    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Garante execução em ordem
            script.onload = () => {
                console.log(`📦 Script carregado: ${src}`);
                resolve();
            };
            script.onerror = () => reject(new Error(`Falha ao carregar script: ${src}`));
            document.head.appendChild(script);
        });
    };

    try {
        // Usar versão 8.x para manter compatibilidade (mesma do HTML)
        await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
        await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
        await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js');
        
        // Aguardar inicialização interna
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (typeof firebase === 'undefined') {
            throw new Error("Firebase não ficou disponível após carregamento");
        }
        console.log("✅ Todos os scripts Firebase carregados com sucesso");
    } catch (error) {
        console.error("❌ Erro ao carregar scripts:", error);
        throw error;
    }
}

/**
 * Inicializa o ambiente mobile
 */
async function inicializarMobile() {
    try {
        console.log("📱 Inicializando módulo mobile...");

        // 1. Carregar Firebase SDK dinamicamente se necessário
        await carregarFirebaseSDK();

        // 2. Verificar se Firebase SDK está disponível
        if (typeof firebase === 'undefined') {
            console.error("❌ Firebase SDK não carregado");
            throw new Error("Firebase SDK não encontrado.");
        }

        console.log("✅ Firebase SDK carregado");

        // 3. Inicializar Firebase App se necessário
        if (!firebase.apps.length) {
            if (!window.__FIREBASE_CONFIG__) {
                console.error("❌ Configuração do Firebase não encontrada");
                throw new Error("Configuração do Firebase não encontrada.");
            }
            firebase.initializeApp(window.__FIREBASE_CONFIG__);
            console.log("🚀 Firebase inicializado com sucesso!");
        }

        // 4. Inicializar serviços
        auth = firebase.auth();
        db = firebase.firestore();

        console.log("✅ Serviços Firebase inicializados");

        // 5. Configurar observador de autenticação
        configurarObservadorAuth();

        // 6. Mostrar tela de login primeiro
        mostrarTelaLogin();

    } catch (error) {
        console.error("❌ Erro crítico na inicialização:", error);
        mostrarErroCritico(error);
    }
}

/**
 * Configura o observador de estado de autenticação
 */
function configurarObservadorAuth() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("✅ Usuário autenticado:", user.uid);
            currentUser = user;
            isLoggedIn = true;
            
            // Verificar se o usuário é válido no sistema
            verificarUsuarioValido(user);
        } else {
            console.log("🔒 Usuário não autenticado");
            currentUser = null;
            isLoggedIn = false;
            mostrarTelaLogin();
        }
    });
}

/**
 * Verifica se o usuário existe nas coleções do sistema
 */
async function verificarUsuarioValido(user) {
    const loadingSpinner = document.getElementById('loading-spinner');
    
    try {
        // Verificar nas coleções 'usuarios' e 'funcionarios'
        const usuarioDoc = await db.collection('usuarios').doc(user.uid).get();
        const funcionarioDoc = await db.collection('funcionarios').doc(user.uid).get();
        
        if (!usuarioDoc.exists && !funcionarioDoc.exists) {
            // Usuário não encontrado - fazer logout
            if (loadingSpinner) loadingSpinner.classList.add('d-none');
            await auth.signOut();
            mostrarAlertaLogin("Acesso Negado", "Você não está cadastrado no sistema. Entre em contato com o administrador.", "danger");
            return false;
        }
        
        // Usuário válido - mostrar formulário
        // Garante que o spinner suma antes de mostrar o formulário
        if (loadingSpinner) loadingSpinner.classList.add('d-none');
        mostrarFormulario();
        return true;
    } catch (error) {
        console.error("❌ Erro ao verificar usuário:", error);
        // Garante que o spinner suma e mostra o erro
        if (loadingSpinner) loadingSpinner.classList.add('d-none');
        mostrarAlertaLogin("Erro", "Falha ao verificar permissões: " + error.message, "danger");
        return false;
    }
}

/**
 * Mostra a tela de login
 */
function mostrarTelaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const formContainer = document.getElementById('form-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    if (loadingSpinner) loadingSpinner.classList.add('d-none');
    if (loginScreen) loginScreen.classList.remove('d-none');
    if (formContainer) formContainer.classList.add('d-none');
}

/**
 * Mostra o formulário (após login bem-sucedido)
 */
function mostrarFormulario() {
    console.log("🔄 Mostrando formulário...");
    
    const loginScreen = document.getElementById('login-screen');
    const formContainer = document.getElementById('form-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Forçar ocultação do spinner de todas as formas possíveis
    if (loadingSpinner) {
        loadingSpinner.classList.add('d-none');
        loadingSpinner.style.display = 'none';
        loadingSpinner.style.visibility = 'hidden';
    }
    
    if (loginScreen) loginScreen.classList.add('d-none');
    if (formContainer) {
        formContainer.classList.remove('d-none');
        
        // Configurar formulário após login (com proteção contra erros)
        try {
            configurarFormulario();
        } catch (e) {
            console.error("Erro ao configurar formulário:", e);
        }
        
        // Testar conexão
        testarConexaoFirestore();
    }
    
    console.log("✅ Formulário mostrado");
}

/**
 * Realiza login com email e senha
 */
async function fazerLogin() {
    const emailInput = document.getElementById('login-email');
    const senhaInput = document.getElementById('login-senha');
    const loginBtn = document.getElementById('btn-fazer-login');
    
    const email = emailInput.value.trim();
    const senha = senhaInput.value;
    
    if (!email || !senha) {
        mostrarAlertaLogin("Atenção", "Preencha o email e a senha para continuar.", "warning");
        return;
    }
    
    // Feedback visual
    const textoOriginal = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Entrando...';
    
    try {
        console.log("🔐 Tentando login com email:", email);
        
        // Realizar login com email e senha
        const userCredential = await auth.signInWithEmailAndPassword(email, senha);
        console.log("✅ Login realizado:", userCredential.user.uid);
        
        // Limpar campos
        emailInput.value = '';
        senhaInput.value = '';
        
    } catch (error) {
        console.error("❌ Erro no login:", error);
        
        let mensagem = "Erro ao fazer login.";
        
        if (error.code === 'auth/user-not-found') {
            mensagem = "Usuário não encontrado. Verifique o email.";
        } else if (error.code === 'auth/wrong-password') {
            mensagem = "Senha incorreta.";
        } else if (error.code === 'auth/invalid-email') {
            mensagem = "Email inválido.";
        } else if (error.code === 'auth/user-disabled') {
            mensagem = "Usuário desabilitado. Entre em contato com o administrador.";
        } else if (error.code === 'auth/too-many-requests') {
            mensagem = "Muitas tentativas. Tente novamente mais tarde.";
        } else if (error.code === 'auth/network-request-failed') {
            mensagem = "Erro de conexão. Verifique sua internet.";
        } else {
            mensagem = error.message;
        }
        
        mostrarAlertaLogin("Erro", mensagem, "danger");
        
        // Restaurar botão
        loginBtn.disabled = false;
        loginBtn.innerHTML = textoOriginal;
    }
}

/**
 * Realiza logout
 */
async function fazerLogout() {
    try {
        await auth.signOut();
        console.log("✅ Logout realizado");
        mostrarTelaLogin();
    } catch (error) {
        console.error("❌ Erro ao fazer logout:", error);
    }
}

/**
 * Mostra alerta na tela de login
 */
function mostrarAlertaLogin(titulo, mensagem, tipo = 'info') {
    const container = document.getElementById('login-alerts');
    if (!container) return;
    
    // Remover alertas anteriores
    container.innerHTML = '';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <strong>${titulo}</strong> ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alertDiv);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

/**
 * Testa a conexão com o Firestore
 */
async function testarConexaoFirestore() {
    try {
        const testRef = db.collection('configuracoes').doc('teste');
        await testRef.get({ source: 'cache' }).catch(() => {});
        console.log("✅ Conexão com Firestore OK");
        return true;
    } catch (error) {
        console.error("❌ Erro de conexão Firestore:", error);
        return false;
    }
}

/**
 * Configura a lógica do formulário
 */
function configurarFormulario() {
    console.log("⚙️ Configurando formulário...");
    
    const formConfigurado = document.getElementById('formulario-configurado');
    
    // Verificar se já foi configurado pelo valor, não só pela existência
    if (formConfigurado && formConfigurado.value === 'true') {
        console.log("⚙️ Formulário já foi configurado, pulando...");
        return;
    }
    
    if (window._mobileFormConfigured) {
        console.log("⚙️ Formulário já foi configurado (flag global), pulando...");
        return;
    }
    
    // Marcar como configurado
    if (formConfigurado) {
        formConfigurado.value = 'true';
    }
    window._mobileFormConfigured = true;
    
    // 1. Capturar parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const maquinaId = urlParams.get('maquina');
    const prioridadeParam = urlParams.get('prioridade');
    
    console.log("📋 Parâmetros da URL:", { maquinaId, prioridadeParam });

    // 2. Elementos do formulário
    const maquinaInput = document.getElementById('mobile-maquina-id');
    const motivoInput = document.getElementById('mobile-motivo');
    const paradaCheck = document.getElementById('mobile-maquina-parada');
    const prioridadeSelect = document.getElementById('mobile-prioridade');
    const salvarBtn = document.getElementById('btn-salvar-chamado-mobile');

    if (!maquinaInput || !motivoInput || !salvarBtn) {
        console.error("❌ Elementos do formulário não encontrados no DOM.");
        return;
    }

    // 3. Preencher máquina se veio pelo QR Code
    if (maquinaId) {
        maquinaInput.value = maquinaId;
        maquinaInput.readOnly = true;
        maquinaInput.classList.add('bg-light', 'text-dark');
        
        // Buscar informações da máquina
        buscarInformacoesMaquina(maquinaId);
    }

    // 4. Definir prioridade
    if (prioridadeParam && prioridadeSelect) {
        prioridadeSelect.value = prioridadeParam;
    }

    // 5. Configurar validação
    configurarValidacao(motivoInput);

    // 6. Configurar envio
    configurarEnvio(salvarBtn, maquinaInput, motivoInput, paradaCheck, prioridadeSelect);
    
    console.log("✅ Formulário configurado");
}

/**
 * Configura validação do campo motivo
 */
function configurarValidacao(motivoInput) {
    motivoInput.addEventListener('input', function() {
        const motivo = this.value.trim();
        const motivoCounter = document.getElementById('motivo-counter');
        
        if (motivoCounter) {
            motivoCounter.textContent = `${motivo.length}/500`;
            
            if (motivo.length < 10) {
                motivoCounter.className = 'char-counter text-danger';
            } else if (motivo.length > 500) {
                motivoCounter.className = 'char-counter text-danger';
            } else {
                motivoCounter.className = 'char-counter text-success';
            }
        }
    });
}

/**
 * Configura evento de envio do formulário
 */
function configurarEnvio(salvarBtn, maquinaInput, motivoInput, paradaCheck, prioridadeSelect) {
    salvarBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const maquina = maquinaInput.value.trim();
        const motivo = motivoInput.value.trim();
        const isParada = paradaCheck.checked;
        const prioridade = prioridadeSelect ? prioridadeSelect.value : 'Normal';

        console.log("📤 Validando dados:", { maquina, motivo, isParada, prioridade });

        // Validações
        if (!maquina) {
            mostrarAlerta("Erro", "Máquina não identificada. Escaneie o QR Code novamente.", "danger");
            return;
        }

        if (!motivo) {
            mostrarAlerta("Atenção", "Descreva o motivo do problema.", "warning");
            motivoInput.focus();
            return;
        }

        if (motivo.length < 10) {
            mostrarAlerta("Atenção", "Descreva o problema com mais detalhes (mínimo 10 caracteres).", "warning");
            motivoInput.focus();
            return;
        }

        // Enviar dados
        await enviarChamado(maquina, motivo, isParada, prioridade, salvarBtn);
    });
}

/**
 * Envia o chamado para o Firestore
 */
async function enviarChamado(maquina, motivo, isParada, prioridade, salvarBtn) {
    // Feedback visual
    const textoOriginal = salvarBtn.innerHTML;
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';

    try {
        // Verificar se está autenticado
        if (!auth.currentUser) {
            mostrarAlerta("Erro", "Sessão expirada. Faça login novamente.", "danger");
            mostrarTelaLogin();
            return;
        }

        // Obter dados do usuário
        const usuarioDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
        const funcionarioDoc = await db.collection('funcionarios').doc(auth.currentUser.uid).get();
        
        let usuarioData = usuarioDoc.exists ? usuarioDoc.data() : null;
        let funcionarioData = funcionarioDoc.exists ? funcionarioData : null;
        
        // Se não encontrou em usuarios, usa os dados de funcionarios
        if (!usuarioData && funcionarioData) {
            usuarioData = {
                nome: funcionarioData.nome || 'Funcionário Mobile',
                email: funcionarioData.email || ''
            };
        }
        
        // Preparar dados do chamado
        const chamadoData = {
            maquinaId: maquina,
            motivo: motivo,
            maquinaParada: isParada,
            status: 'Aberto',
            prioridade: isParada ? 'Urgente' : prioridade,
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            origem: 'Mobile/QRCode',
            usuarioId: auth.currentUser.uid,
            usuarioNome: usuarioData?.nome || 'Operador Mobile',
            emailUsuario: usuarioData?.email || '',
            observacoes: 'Aberto via Mobile QR Code',
            dataEncerramento: null,
            tempoParada: null,
            tipoManutencao: null,
            observacoesMecanico: null,
            localizacao: window.location.href,
            userAgent: navigator.userAgent.substring(0, 200),
            criadoEm: new Date().toISOString(),
            criadoVia: 'QR Code Scanner',
            notificacaoEnviada: false
        };

        console.log("📤 Enviando chamado:", chamadoData);
        
        // Salvar no Firestore
        const docRef = await db.collection('manutencao_chamados').add(chamadoData);
        console.log("✅ Chamado criado com ID:", docRef.id);

        // Sucesso
        mostrarSucesso(docRef.id, maquina);

    } catch (error) {
        console.error("❌ Erro ao salvar:", error);
        
        // Restaurar botão
        salvarBtn.disabled = false;
        salvarBtn.innerHTML = textoOriginal;
        
        // Mensagens de erro específicas
        let mensagem = "Erro ao enviar chamado. ";
        
        if (error.code === 'permission-denied') {
            mensagem = "Permissão negada. Você precisa estar autenticado.";
        } else if (error.code === 'unavailable') {
            mensagem = "Serviço indisponível. Verifique sua conexão.";
        } else if (error.message.includes('autenticado') || error.code === 'unauthenticated') {
            mensagem = "Sessão expirada. Faça login novamente.";
            setTimeout(() => mostrarTelaLogin(), 2000);
        } else {
            mensagem += error.message;
        }
        
        mostrarAlerta("Erro", mensagem, "danger");
    }
}

/**
 * Busca informações da máquina
 */
async function buscarInformacoesMaquina(maquinaId) {
    if (!maquinaId) return;
    
    // Garantir que db está disponível
    if (!db) {
        console.warn("⚠️ Firestore não disponível para buscar máquina");
        return;
    }
    
    try {
        console.log("🔍 Buscando máquina:", maquinaId);
        
        // Primeiro tenta buscar por ID do documento
        const docRef = await db.collection('maquinas').doc(maquinaId).get();
        
        if (docRef.exists) {
            const maquinaData = docRef.data();
            exibirInfoMaquina(maquinaData, maquinaId);
            return;
        }
        
        // Se não encontrou por ID, tenta por código
        const maquinaRef = db.collection('maquinas').where('codigo', '==', maquinaId).limit(1);
        const snapshot = await maquinaRef.get();
        
        if (!snapshot.empty) {
            const maquinaData = snapshot.docs[0].data();
            exibirInfoMaquina(maquinaData, maquinaId);
        } else {
            console.log("ℹ️ Máquina não encontrada no banco de dados:", maquinaId);
            // Ainda mostra o código no campo
            const infoDiv = document.getElementById('maquina-info');
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <div class="alert alert-warning mb-3">
                        <h6 class="mb-1"><i class="fas fa-exclamation-triangle"></i> Código: ${maquinaId}</h6>
                        <p class="mb-0 small">Máquina não encontrada no cadastro. O chamado será criado com este código.</p>
                    </div>
                `;
                infoDiv.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.error("❌ Erro ao buscar máquina:", error);
        // Não mostra erro crítico, apenas logs
    }
}

/**
 * Exibe as informações da máquina no formulário
 */
function exibirInfoMaquina(maquinaData, maquinaId) {
    const infoDiv = document.getElementById('maquina-info');
    if (!infoDiv) return;
    
    const nome = maquinaData.nome || maquinaData.nomeMaquina || maquinaId;
    const descricao = maquinaData.descricao || maquinaData.descricaoMaquina || '';
    const localizacao = maquinaData.localizacao || maquinaData.setor || '';
    const patrimonio = maquinaData.patrimonio || '';
    
    infoDiv.innerHTML = `
        <div class="alert alert-info mb-3">
            <h6 class="mb-1"><i class="fas fa-industry"></i> ${nome}</h6>
            ${patrimonio ? `<p class="mb-1 small"><i class="fas fa-barcode"></i> Patrimônio: ${patrimonio}</p>` : ''}
            ${descricao ? `<p class="mb-1 small">${descricao}</p>` : ''}
            ${localizacao ? `<p class="mb-0 small"><i class="fas fa-map-marker-alt"></i> ${localizacao}</p>` : ''}
        </div>
    `;
    infoDiv.classList.remove('d-none');
    console.log("✅ Informações da máquina carregadas:", nome);
}

/**
 * Mostra alerta
 */
function mostrarAlerta(titulo, mensagem, tipo = 'info') {
    // Remover alertas anteriores
    const alertasAnteriores = document.querySelectorAll('.mobile-alert');
    alertasAnteriores.forEach(alerta => alerta.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} mobile-alert mt-3 animate__animated animate__fadeIn`;
    alertDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="mb-1">
                    <i class="fas fa-${tipo === 'danger' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i> 
                    ${titulo}
                </h6>
                <p class="mb-0">${mensagem}</p>
            </div>
            <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.insertBefore(alertDiv, formContainer.firstChild);
        
        // Remover após 5 segundos
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.classList.add('animate__fadeOut');
                setTimeout(() => alertDiv.remove(), 300);
            }
        }, 5000);
    }
}

/**
 * Mostra tela de sucesso
 */
function mostrarSucesso(chamadoId, maquinaId) {
    const formContainer = document.getElementById('form-container');
    const successDiv = document.getElementById('success-message');
    
    if (formContainer) formContainer.classList.add('d-none');
    if (successDiv) {
        successDiv.classList.remove('d-none');
        
        // Atualizar informações
        const idSpan = document.getElementById('chamado-id');
        const maquinaSpan = document.getElementById('chamado-maquina');
        const dataSpan = document.getElementById('chamado-data');
        
        if (idSpan) idSpan.textContent = chamadoId.substring(0, 8).toUpperCase();
        if (maquinaSpan) maquinaSpan.textContent = maquinaId;
        if (dataSpan) dataSpan.textContent = new Date().toLocaleString('pt-BR');
    }
}

/**
 * Mostra erro crítico
 */
function mostrarErroCritico(error) {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner && loadingSpinner.classList) {
        loadingSpinner.classList.add('d-none');
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-4';
    errorDiv.innerHTML = `
        <h5><i class="fas fa-exclamation-triangle"></i> Erro no Sistema</h5>
        <p class="mb-2"><strong>Mensagem:</strong> ${error.message}</p>

        <div class="mb-3">
            <h6>Soluções possíveis:</h6>
            <ul class="mb-2">
                <li>Verifique sua conexão com a internet</li>
                <li>Recarregue a página</li>
                <li>Contate o administrador do sistema</li>
            </ul>
        </div>

        <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">
                <i class="fas fa-redo"></i> Tentar Novamente
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="voltarParaInicio()">
                <i class="fas fa-home"></i> Voltar ao Início
            </button>
        </div>
    `;

    const container = document.querySelector('.container');
    if (container) {
        container.appendChild(errorDiv);
    } else {
        document.body.appendChild(errorDiv);
    }
}

/**
 * Voltar para a página inicial
 */
function voltarParaInicio() {
    window.location.href = '/';
}

// Adicionar estilos
function adicionarEstilosMobile() {
    if (!document.querySelector('#mobile-styles')) {
        const style = document.createElement('style');
        style.id = 'mobile-styles';
        style.textContent = `
            /* Estilos mobile */
            body { 
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                min-height: 100vh;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            }
            
            .card {
                border-radius: 16px;
                border: none;
                box-shadow: 0 8px 30px rgba(0,0,0,0.08);
                overflow: hidden;
                margin-bottom: 1.5rem;
            }
            
            .card-header {
                border-radius: 16px 16px 0 0 !important;
                padding: 1.25rem 1.5rem;
            }
            
            .btn {
                border-radius: 12px;
                padding: 1rem;
                font-weight: 600;
                transition: all 0.3s ease;
                border: none;
            }
            
            .btn-primary {
                background: linear-gradient(135deg, #4361ee 0%, #3a56d4 100%);
                box-shadow: 0 4px 15px rgba(67, 97, 238, 0.3);
            }
            
            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(67, 97, 238, 0.4);
            }
            
            .form-control, .form-select {
                border-radius: 10px;
                padding: 0.875rem 1rem;
                border: 2px solid #e9ecef;
                font-size: 1rem;
                transition: all 0.3s ease;
            }
            
            .form-control:focus, .form-select:focus {
                border-color: #4361ee;
                box-shadow: 0 0 0 0.25rem rgba(67, 97, 238, 0.1);
            }
            
            .form-check-input {
                width: 3em;
                height: 1.5em;
            }
            
            .form-check-input:checked {
                background-color: #4361ee;
                border-color: #4361ee;
            }
            
            /* Contador de caracteres */
            .char-counter {
                font-size: 0.875rem;
                margin-top: 0.5rem;
                font-weight: 500;
            }
            
            /* Tela de sucesso */
            .success-icon {
                font-size: 5rem;
                color: #28a745;
                margin-bottom: 1.5rem;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            /* Tela de Login */
            .login-icon {
                font-size: 4rem;
                color: #4361ee;
                margin-bottom: 1rem;
            }
            
            .brand-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: #4361ee;
                margin-bottom: 0.5rem;
            }
            
            .brand-subtitle {
                color: #6c757d;
                margin-bottom: 2rem;
            }
            
            /* Responsividade */
            @media (max-width: 768px) {
                .container {
                    padding: 1rem;
                }
                
                .card {
                    margin-bottom: 1rem;
                }
                
                .btn {
                    width: 100%;
                }
            }
            
            /* Animação de loading */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .animate-fade-in {
                animation: fadeIn 0.5s ease-out;
            }
        `;
        document.head.appendChild(style);
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log("📱 DOM carregado - inicializando...");
    
    // Adicionar estilos
    adicionarEstilosMobile();
    
    // Mostrar body
    document.body.style.display = 'block';
    
    // Inicializar módulo
    setTimeout(() => {
        inicializarMobile();
    }, 100);
});

// Exportar funções para debug
window.debugAuth = {
    getCurrentUser: () => auth?.currentUser,
    signOut: () => auth?.signOut(),
    forceReload: () => location.reload(),
    login: () => fazerLogin(),
    logout: () => fazerLogout()
};
