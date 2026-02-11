// =========================================================
// Módulo Mobile de Abertura de Chamados (Via QR Code)
// =========================================================

let db;
let auth;

/**
 * Inicializa o ambiente mobile, conecta ao Firebase e prepara o formulário.
 */
async function inicializarMobile() {
    try {
        // Verifica se o Firebase foi carregado pelo HTML
        if (typeof firebase === 'undefined') {
            throw new Error("Firebase SDK não encontrado.");
        }

        // Garante a inicialização do app
        if (!firebase.apps.length) {
            if (window.__FIREBASE_CONFIG__) {
                firebase.initializeApp(window.__FIREBASE_CONFIG__);
            } else {
                throw new Error("Configuração do Firebase ausente.");
            }
        }

        // Inicializa serviços
        auth = firebase.auth();
        db = firebase.firestore();

        console.log("✅ Mobile: Firebase inicializado.");

        // Aguarda autenticação anônima
        await autenticarUsuario();
        configurarFormulario();

    } catch (error) {
        console.error("Erro crítico:", error);
        alert("Erro ao carregar sistema: " + error.message);
        document.body.innerHTML = `<div class="p-4 text-center text-danger"><h3>Erro de Conexão</h3><p>${error.message}</p></div>`;
    }
}

/**
 * Realiza autenticação anônima
 */
async function autenticarUsuario() {
    return new Promise((resolve, reject) => {
        // Verifica se já está autenticado
        const user = auth.currentUser;
        if (user) {
            console.log("✅ Usuário já autenticado:", user.uid);
            resolve(user);
            return;
        }

        // Tenta autenticar anonimamente
        console.log("🔑 Realizando login anônimo...");
        auth.signInAnonymously()
            .then((userCredential) => {
                console.log("✅ Login anônimo realizado:", userCredential.user.uid);
                resolve(userCredential.user);
            })
            .catch((error) => {
                console.error("⚠️ Erro no login anônimo:", error);
                
                // Se o login anônimo não estiver habilitado, tenta continuar sem autenticação
                if (error.code === 'auth/operation-not-allowed') {
                    alert("Atenção: Login Anônimo não está ativado. Ative em Authentication > Sign-in method.");
                    resolve(null);
                } else {
                    reject(error);
                }
            });
    });
}

/**
 * Configura a lógica do formulário, lendo parâmetros da URL (QR Code).
 */
function configurarFormulario() {
    // 1. Captura o parâmetro 'maquina' da URL
    const urlParams = new URLSearchParams(window.location.search);
    const maquinaId = urlParams.get('maquina');

    // Elementos da tela
    const maquinaInput = document.getElementById('mobile-maquina-id');
    const motivoInput = document.getElementById('mobile-motivo');
    const paradaCheck = document.getElementById('mobile-maquina-parada');
    const salvarBtn = document.getElementById('btn-salvar-chamado-mobile');

    // 2. Preenchimento automático se veio pelo QR Code
    if (maquinaId) {
        maquinaInput.value = maquinaId;
        maquinaInput.readOnly = true;
        maquinaInput.classList.add('bg-light');
    } else {
        maquinaInput.placeholder = "Digite o código da máquina";
    }

    // 3. Evento de Envio
    salvarBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        const maquina = maquinaInput.value.trim();
        const motivo = motivoInput.value.trim();
        const isParada = paradaCheck.checked;

        if (!maquina) {
            alert("Erro: Máquina não identificada. Por favor, escaneie o QR Code novamente.");
            return;
        }

        if (!motivo) {
            alert("Por favor, descreva o motivo do problema.");
            motivoInput.focus();
            return;
        }

        // Feedback visual
        const textoOriginal = salvarBtn.innerHTML;
        salvarBtn.disabled = true;
        salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            // Verifica autenticação antes de salvar
            const user = auth.currentUser;
            const userUid = user ? user.uid : 'anonimo-sem-auth';

            const chamadoData = {
                maquinaId: maquina,
                motivo: motivo,
                maquinaParada: isParada,
                status: 'Aberto',
                prioridade: isParada ? 'Urgente' : 'Normal',
                dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
                origem: 'Mobile/QRCode',
                usuarioId: userUid,
                
                // Campos adicionais para melhor rastreamento
                observacoes: 'Aberto via Mobile',
                dataEncerramento: null,
                tempoParada: null,
                tipoManutencao: null,
                observacoesMecanico: null,
            };

            console.log("📤 Enviando chamado:", chamadoData);
            
            // Tenta salvar no Firestore
            const docRef = await db.collection('manutencao_chamados').add(chamadoData);
            console.log("✅ Chamado criado com ID:", docRef.id);

            // Sucesso: Esconde formulário e mostra mensagem
            document.getElementById('form-container').classList.add('d-none');
            document.getElementById('success-message').classList.remove('d-none');

        } catch (error) {
            console.error("Erro ao salvar:", error);
            
            // Mensagens de erro mais específicas
            if (error.code === 'permission-denied') {
                alert("Permissão negada. Verifique as regras de segurança do Firestore.");
            } else if (error.code === 'unavailable') {
                alert("Serviço indisponível. Verifique sua conexão com a internet.");
            } else {
                alert("Erro ao enviar chamado: " + error.message);
            }
            
            salvarBtn.disabled = false;
            salvarBtn.innerHTML = textoOriginal;
        }
    });
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    inicializarMobile();
});