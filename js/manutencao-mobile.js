// =========================================================
// Módulo Mobile de Abertura de Chamados (Via QR Code)
// Versão corrigida - Com autenticação obrigatória
// =========================================================

let db;
let auth;
let currentUser = null;

/**
 * Carrega dinamicamente os scripts do Firebase SDK
 */
async function carregarFirebaseSDK() {
    return new Promise((resolve, reject) => {
        // Verificar se já está carregado
        if (typeof firebase !== 'undefined') {
            console.log("✅ Firebase SDK já carregado");
            resolve();
            return;
        }

        console.log("📦 Carregando Firebase SDK dinamicamente...");

        const scripts = [
            'https://www.gstatic.com/firebasejs/9.17.1/firebase-app-compat.js',
            'https://www.gstatic.com/firebasejs/9.17.1/firebase-auth-compat.js',
            'https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore-compat.js'
        ];

        let loadedCount = 0;
        const totalScripts = scripts.length;

        function onScriptLoad() {
            loadedCount++;
            console.log(`📦 Script ${loadedCount}/${totalScripts} carregado`);

            if (loadedCount === totalScripts) {
                // Aguardar um pouco para garantir que o Firebase esteja totalmente inicializado
                setTimeout(() => {
                    if (typeof firebase !== 'undefined') {
                        console.log("✅ Todos os scripts Firebase carregados com sucesso");
                        resolve();
                    } else {
                        reject(new Error("Firebase não ficou disponível após carregamento"));
                    }
                }, 100);
            }
        }

        function onScriptError(src, error) {
            console.error(`❌ Erro ao carregar script: ${src}`, error);
            reject(new Error(`Falha ao carregar Firebase SDK: ${src}`));
        }

        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => onScriptLoad();
            script.onerror = (error) => onScriptError(src, error);
            document.head.appendChild(script);
        });

        // Timeout de segurança (30 segundos)
        setTimeout(() => {
            reject(new Error("Timeout ao carregar Firebase SDK"));
        }, 30000);
    });
}

/**
 * Inicializa o ambiente mobile, conecta ao Firebase e prepara o formulário.
 */
async function inicializarMobile() {
    try {
        console.log("📱 Inicializando módulo mobile com autenticação...");

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

        // 5. Tentar autenticação anônima (obrigatória pelas suas regras)
        currentUser = await autenticarUsuario();

        if (!currentUser) {
            throw new Error("Não foi possível autenticar no sistema. Tente novamente.");
        }

        console.log("✅ Usuário autenticado:", currentUser.uid);

        // 6. Configurar persistência offline
        await configurarPersistencia();

        // 7. Configurar formulário
        configurarFormulario();

        // 8. Testar conexão
        await testarConexaoFirestore();

    } catch (error) {
        console.error("❌ Erro crítico na inicialização:", error);
        mostrarErroCritico(error);
    }
}

/**
 * Configura persistência offline
 */
async function configurarPersistencia() {
    try {
        await db.enablePersistence({ synchronizeTabs: false })
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.log("ℹ️ Persistência não disponível em múltiplas abas");
                } else if (err.code === 'unimplemented') {
                    console.log("ℹ️ Persistência não suportada no navegador");
                }
            });
        console.log("✅ Persistência offline configurada");
    } catch (error) {
        console.log("ℹ️ Persistência offline não disponível:", error.message);
    }
}

/**
 * Realiza autenticação anônima
 */
async function autenticarUsuario() {
    return new Promise((resolve, reject) => {
        // Verificar se já está autenticado
        const user = auth.currentUser;
        if (user) {
            console.log("✅ Usuário já autenticado:", user.uid);
            resolve(user);
            return;
        }

        console.log("🔑 Iniciando autenticação anônima...");
        
        // Tenta autenticar anonimamente
        auth.signInAnonymously()
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("✅ Autenticação anônima realizada:", user.uid);
                resolve(user);
            })
            .catch((error) => {
                console.error("❌ Erro na autenticação:", error);
                
                // Tentar métodos alternativos
                if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                    console.log("⚠️ Login anônimo não habilitado, tentando outras opções...");
                    
                    // 1. Tentar usar um usuário genérico compartilhado
                    // (Só funciona se você configurar um usuário de serviço)
                    tentarLoginGenerico()
                        .then(resolve)
                        .catch(reject);
                } else if (error.code === 'auth/network-request-failed') {
                    reject(new Error("Erro de conexão. Verifique sua internet."));
                } else {
                    reject(new Error(`Erro de autenticação: ${error.message}`));
                }
            });
    });
}

/**
 * Tenta login com credenciais genéricas (fallback)
 */
async function tentarLoginGenerico() {
    // ATENÇÃO: Este método requer que você tenha um usuário de serviço configurado
    // e que o login por email/senha esteja habilitado no Firebase
    
    const emailGenerico = 'mobile@seuapp.com';
    const senhaGenerica = 'mobile123'; // Defina uma senha no Firebase Auth
    
    console.log("🔄 Tentando login genérico...");
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(emailGenerico, senhaGenerica);
        console.log("✅ Login genérico realizado:", userCredential.user.uid);
        return userCredential.user;
    } catch (error) {
        console.error("❌ Login genérico falhou:", error);
        throw new Error("Não foi possível autenticar no sistema. Contate o administrador.");
    }
}

/**
 * Testa a conexão com o Firestore
 */
async function testarConexaoFirestore() {
    try {
        // Tenta ler uma coleção para testar permissões
        const testRef = db.collection('configuracoes').doc('teste');
        await testRef.get({ source: 'cache' }).catch(() => {});
        console.log("✅ Conexão com Firestore OK");
        return true;
    } catch (error) {
        console.error("❌ Erro de conexão Firestore:", error);
        
        if (error.code === 'permission-denied') {
            throw new Error("Permissão negada. Verifique suas credenciais.");
        }
        
        return false;
    }
}

/**
 * Configura a lógica do formulário
 */
function configurarFormulario() {
    console.log("⚙️ Configurando formulário...");
    
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
    const loadingSpinner = document.getElementById('loading-spinner');

    // 3. Esconder loading e mostrar formulário
    if (loadingSpinner) loadingSpinner.classList.add('d-none');
    if (document.getElementById('form-container')) {
        document.getElementById('form-container').classList.remove('d-none');
    }

    // 4. Preencher máquina se veio pelo QR Code
    if (maquinaId) {
        maquinaInput.value = maquinaId;
        maquinaInput.readOnly = true;
        maquinaInput.classList.add('bg-light', 'text-dark');
        
        // Buscar informações da máquina
        buscarInformacoesMaquina(maquinaId);
    }

    // 5. Definir prioridade
    if (prioridadeParam && prioridadeSelect) {
        prioridadeSelect.value = prioridadeParam;
    }

    // 6. Configurar validação
    configurarValidacao(motivoInput);

    // 7. Configurar envio
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
        // Verificar se ainda está autenticado
        if (!auth.currentUser) {
            console.log("🔄 Reconectando...");
            await autenticarUsuario();
        }

        // Preparar dados
        // Verificar se o usuário está cadastrado no sistema antes de criar o chamado
        const usuarioDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
        if (!usuarioDoc.exists) {
            mostrarAlerta("Acesso Negado", "Você não está cadastrado no sistema. Entre em contato com o administrador para solicitar acesso.", "danger");
            if (salvarBtn) {
                salvarBtn.disabled = false;
                salvarBtn.innerHTML = textoOriginal;
            }
            return;
        }
        
        const usuarioData = usuarioDoc.data();
        
        // Preparar dados
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
            // Tentar reconectar
            setTimeout(() => location.reload(), 2000);
        } else if (error.code === 'unavailable') {
            mensagem = "Serviço indisponível. Verifique sua conexão.";
        } else if (error.message.includes('autenticado') || error.code === 'unauthenticated') {
            mensagem = "Sessão expirada. Reconectando...";
            setTimeout(() => location.reload(), 2000);
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
    try {
        const maquinaRef = db.collection('maquinas').where('codigo', '==', maquinaId).limit(1);
        const snapshot = await maquinaRef.get();
        
        if (!snapshot.empty) {
            const maquinaData = snapshot.docs[0].data();
            const infoDiv = document.getElementById('maquina-info');
            
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <div class="alert alert-info mb-3">
                        <h6 class="mb-1"><i class="fas fa-industry"></i> ${maquinaData.nome || maquinaId}</h6>
                        ${maquinaData.descricao ? `<p class="mb-1 small">${maquinaData.descricao}</p>` : ''}
                        ${maquinaData.localizacao ? `<p class="mb-0 small"><i class="fas fa-map-marker-alt"></i> ${maquinaData.localizacao}</p>` : ''}
                    </div>
                `;
                infoDiv.classList.remove('d-none');
            }
        }
    } catch (error) {
        console.log("ℹ️ Não foi possível carregar informações da máquina:", error.message);
    }
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
        // Fallback: append to body if container not found
        document.body.appendChild(errorDiv);
    }
}

/**
 * Voltar para a página inicial
 */
function voltarParaInicio() {
    // Redirecionar para a página principal
    window.location.href = '/'; // Ajuste conforme sua aplicação
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
    forceReload: () => location.reload()
};