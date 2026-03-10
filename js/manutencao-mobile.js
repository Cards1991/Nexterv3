// Aguarda o evento 'firebaseMobileReady' que é disparado pelo firebase-config-mobile.js
// Isso garante que o Firebase e suas variáveis globais (db, auth) estejam totalmente
// inicializados antes que este script tente usá-los.
document.addEventListener('firebaseMobileReady', () => {
    // Verifica se é a página mobile pelo ID ou parâmetro
    const isMobilePage = document.getElementById('chamado-maquina-id') !== null;
    
    if (!isMobilePage) {
        return;
    }

    // Garante que o Firebase está pronto
    if (typeof firebase === 'undefined' || !firebase.apps.length || typeof auth === 'undefined') {
        console.error("Firebase não inicializado corretamente.");
        mostrarMensagemMobile("Erro crítico de conexão. Recarregue a página.", "danger");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    // CORREÇÃO: Aceita tanto 'maquinaId' quanto 'maquina' (legado)
    // Adicionado .trim() para remover espaços em branco acidentais do QR Code.
    const maquinaIdRaw = urlParams.get('maquinaId') || urlParams.get('maquina');
    const maquinaId = maquinaIdRaw ? maquinaIdRaw.trim() : null;
    
    // Se não tiver maquinaId, redireciona ou mostra erro
    if (!maquinaId || maquinaId.length === 0) {
        mostrarMensagemMobile("QR Code inválido. Máquina não identificada.", "danger");
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        return;
    }

    // Monitora o estado de autenticação
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Força a atualização do token para garantir que o estado de autenticação
                // seja propagado para todos os serviços do Firebase, incluindo o Firestore.
                // Isso ajuda a prevenir "race conditions" onde o Firestore faz uma requisição
                // antes de seu estado interno de autenticação ser atualizado.
                await user.getIdToken(true);

                // Usuário está logado, mostra o formulário de chamado
                document.getElementById('login-section').classList.add('d-none');
                document.getElementById('chamado-section').classList.remove('d-none');
                // Configura o formulário e carrega os dados da máquina APÓS o login
                document.getElementById('chamado-maquina-id').value = maquinaId;
                fetchMachineInfo(maquinaId);
                adicionarBotaoSair(user);
            } catch (tokenError) {
                console.error("Erro ao atualizar token de autenticação:", tokenError);
                mostrarMensagemMobile("Erro de autenticação. Por favor, faça login novamente.", "danger");
                auth.signOut(); // Força o logout se o token não puder ser atualizado
            }
        } else {
            // Usuário não está logado, mostra a tela de login
            document.getElementById('login-section').classList.remove('d-none');
            document.getElementById('chamado-section').classList.add('d-none');
        }
    });

    // Listener para o formulário de login
    const formLogin = document.getElementById('form-login-manutencao');
    if (formLogin) {
        formLogin.addEventListener('submit', handleLogin);
    }

    // Listener para o formulário de chamado
    const formChamado = document.getElementById('form-chamado-manutencao');
    if (formChamado) {
        formChamado.addEventListener('submit', salvarChamadoMobile);
    }
});

function adicionarBotaoSair(user) {
    const container = document.querySelector('#chamado-section .login-card');
    // Evita duplicar o botão
    if (container && !document.getElementById('user-info-mobile')) {
        const userInfo = document.createElement('div');
        userInfo.id = 'user-info-mobile';
        userInfo.className = 'text-center mb-3 pb-3 border-bottom';
        userInfo.innerHTML = `
            <small class="text-muted d-block mb-1">Logado como: <strong>${user.email}</strong></small>
            <button class="btn btn-sm btn-outline-danger" onclick="firebase.auth().signOut()">
                <i class="fas fa-sign-out-alt"></i> Sair
            </button>
        `;
        // Insere antes do formulário
        const form = document.getElementById('form-chamado-manutencao');
        container.insertBefore(userInfo, form);
    }
}

async function fetchMachineInfo(maquinaId) {
    // Adicionado log para depuração
    console.log(`[DEBUG] Buscando no Firestore: collection='maquinas', doc='${maquinaId}'`);
    try {
        const maquinaDoc = await db.collection('maquinas').doc(maquinaId).get();
        if (maquinaDoc.exists) {
            console.log("[DEBUG] Máquina encontrada:", maquinaDoc.data());
            document.getElementById('chamado-maquina-nome').value = maquinaDoc.data().nome || 'Nome não encontrado';
        } else {
            console.warn(`[DEBUG] Documento com ID '${maquinaId}' não foi encontrado na coleção 'maquinas'. Verifique se o ID no QR Code corresponde exatamente ao ID do documento no Firebase.`);
            document.getElementById('chamado-maquina-nome').value = 'Máquina não encontrada';
            mostrarMensagemMobile("Máquina não encontrada no sistema.", "danger");
        }
    } catch (error) {
        // Este erro agora é mais provável de ser um problema de rede ou configuração do Firebase, não de permissões de regra.
        console.error("Erro ao buscar informação da máquina:", error);
        mostrarMensagemMobile("Erro ao carregar dados da máquina.", "danger");
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-manutencao-email').value;
    const password = document.getElementById('login-manutencao-senha').value;
    const errorDiv = document.getElementById('login-manutencao-erro');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // O onAuthStateChanged vai cuidar de mostrar o formulário correto
        errorDiv.classList.add('d-none');
    } catch (error) {
        console.error("Erro de login:", error);
        errorDiv.textContent = "E-mail ou senha inválidos.";
        errorDiv.classList.remove('d-none');
    }
}

async function salvarChamadoMobile(event) {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        mostrarMensagemMobile("Sessão expirada. Faça login novamente.", "danger");
        return;
    }

    const maquinaId = document.getElementById('chamado-maquina-id').value;
    const maquinaNome = document.getElementById('chamado-maquina-nome').value;
    const motivo = document.getElementById('chamado-motivo').value;
    const observacoes = document.getElementById('chamado-obs').value;
    const maquinaParada = document.getElementById('chamado-maquina-parada').checked;

    if (!maquinaId || !motivo) {
        mostrarMensagemMobile("O motivo da manutenção é obrigatório.", "warning");
        return;
    }

    const btn = event.submitter;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abrindo...';

    try {
        const chamadoData = {
            maquinaId,
            maquinaNome,
            motivo,
            observacoes,
            maquinaParada,
            prioridade: maquinaParada ? 'Urgente' : 'Normal', // Prioridade automática
            status: 'Aberto',
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user.uid,
            createdByNome: user.displayName || user.email,
            origem: 'QR Code' // Identifica a origem do chamado
        };

        if (maquinaParada) {
            chamadoData.paradaInicioTimestamp = firebase.firestore.FieldValue.serverTimestamp();
        }

        await db.collection('manutencao_chamados').add(chamadoData);

        document.getElementById('chamado-section').innerHTML = `
            <div class="text-center p-4">
                <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                <h4>Chamado Aberto com Sucesso!</h4>
                <p>A equipe de manutenção já foi notificada.</p>
                <p class="text-muted small">Você já pode fechar esta página.</p>
            </div>
        `;

    } catch (error) {
        console.error("Erro ao salvar chamado:", error);
        mostrarMensagemMobile("Erro ao abrir o chamado. Tente novamente.", "danger");
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Abrir Chamado';
    }
}

function mostrarMensagemMobile(mensagem, tipo = 'info') {
    const container = document.getElementById('feedback-container');
    if (!container) return;

    const alertId = `alert-${Date.now()}`;
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', alertHtml);

    setTimeout(() => {
        const alertEl = document.getElementById(alertId);
        if (alertEl) {
            bootstrap.Alert.getOrCreateInstance(alertEl).close();
        }
    }, 5000);
}