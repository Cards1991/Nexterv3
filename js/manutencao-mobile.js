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
    console.log(`[DEBUG] Buscando no Firestore: collection='maquinas', id_ou_codigo='${maquinaId}'`);
    try {
        let machineData = null;
        let finalMaquinaId = maquinaId;

        // Primeiro tenta buscar por ID do documento
        const maquinaDoc = await db.collection('maquinas').doc(maquinaId).get();
        if (maquinaDoc.exists) {
            machineData = maquinaDoc.data();
        } else {
            // Se não encontrou por ID, tenta buscar pelo código
            const maquinaPorCodigoSnap = await db.collection('maquinas').where('codigo', '==', maquinaId).limit(1).get();
            if (!maquinaPorCodigoSnap.empty) {
                machineData = maquinaPorCodigoSnap.docs[0].data();
                finalMaquinaId = maquinaPorCodigoSnap.docs[0].id;
            }
        }

        if (machineData) {
            console.log("[DEBUG] Máquina encontrada:", machineData);
            document.getElementById('chamado-maquina-nome').value = machineData.nome || 'Nome não encontrado';
            document.getElementById('chamado-maquina-id').value = finalMaquinaId;

            // --- MOTIVOS FREQUENTES ---
            const motivos = machineData.motivos || [];
            const containerFrequentes = document.getElementById('container-motivos-frequentes');
            const containerSimples = document.getElementById('container-motivo-simples');
            const selectMotivo = document.getElementById('select-motivo-frequente');

            if (motivos.length > 0) {
                // Popular o select com os motivos cadastrados
                selectMotivo.innerHTML = '<option value="">Selecione um motivo...</option>';
                motivos.forEach(motivo => {
                    const opt = document.createElement('option');
                    opt.value = motivo;
                    opt.textContent = motivo;
                    selectMotivo.appendChild(opt);
                });
                // Adicionar opção de digitar manualmente
                const optOutro = document.createElement('option');
                optOutro.value = '__outro__';
                optOutro.textContent = 'Outro (descrever abaixo)...';
                selectMotivo.appendChild(optOutro);

                // Ao selecionar do dropdown, preenche o campo de texto
                selectMotivo.onchange = function() {
                    const inputMotivo = document.getElementById('chamado-motivo');
                    if (this.value && this.value !== '__outro__') {
                        inputMotivo.value = this.value;
                        inputMotivo.required = false; // já foi preenchido pelo select
                    } else {
                        inputMotivo.value = '';
                        inputMotivo.required = true;
                    }
                };

                // Mostrar container com select, esconder o simples
                containerFrequentes.style.display = 'block';
                containerSimples.style.display = 'none';
                document.getElementById('chamado-motivo-fallback').required = false;
            } else {
                // Sem motivos cadastrados: mostrar apenas campo de texto simples
                containerFrequentes.style.display = 'none';
                containerSimples.style.display = 'block';
            }
        } else {
            console.warn(`[DEBUG] Doc com ID/Código '${maquinaId}' não encontrado.`);
            document.getElementById('chamado-maquina-nome').value = 'Máquina não encontrada';
            mostrarMensagemMobile("Máquina não encontrada no sistema.", "danger");
        }
    } catch (error) {
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
    
    // Lê o motivo do campo correto (frequente ou simples)
    const containerFrequentes = document.getElementById('container-motivos-frequentes');
    let motivo = '';
    if (containerFrequentes && containerFrequentes.style.display !== 'none') {
        // Primeiro tenta o campo de texto (pode ter sido preenchido via select ou manualmente)
        motivo = document.getElementById('chamado-motivo').value.trim();
        // Se vazio, tenta o valor do select diretamente
        if (!motivo) {
            const sel = document.getElementById('select-motivo-frequente');
            if (sel && sel.value && sel.value !== '__outro__') motivo = sel.value;
        }
    } else {
        motivo = (document.getElementById('chamado-motivo-fallback')?.value || '').trim();
    }
    
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