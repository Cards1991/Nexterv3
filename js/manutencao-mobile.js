// =========================================================
// Módulo Mobile de Abertura de Chamados (Via QR Code)
// Versão com Login Obrigatório e Carregamento Dinâmico
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
        window.db = db; // Expor para funções legadas
        console.log("✅ Serviços Firebase inicializados");

        // 5. Configurar observador de autenticação
        configurarObservadorAuth();

    } catch (error) {
        console.error("❌ Erro crítico na inicialização:", error);
        alert("Erro ao inicializar sistema: " + error.message);
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
            inicializarPaginaChamado();
        } else {
            console.log("🔒 Usuário não autenticado");
            currentUser = null;
            isLoggedIn = false;
            mostrarTelaLogin();
        }
    });
}

function mostrarTelaLogin() {
    console.log("Redirecionando para login...");
    const redirectUrl = window.location.href;
    window.location.href = `login.html?redirect_url=${encodeURIComponent(redirectUrl)}`;
}

// =========================================================
// Lógica da Aplicação
// =========================================================

function inicializarPaginaChamado() {
    const urlParams = new URLSearchParams(window.location.search);
    const maquinaCodigo = urlParams.get('maquina');

    if (!maquinaCodigo) {
        alert("Código da máquina (parâmetro 'maquina') não encontrado na URL.");
        return;
    }

    carregarDadosMaquina(maquinaCodigo);
    popularMecanicos();
    configurarCamposCondicionais();
}

async function carregarDadosMaquina(codigo) {
    const nomeInput = document.getElementById('chamado-maquina-nome');
    const idInput = document.getElementById('chamado-maquina-id');
    
    if (!nomeInput || !idInput) return;

    try {
        const querySnapshot = await db.collection('maquinas').where('codigo', '==', codigo).limit(1).get();
        if (querySnapshot.empty) {
            alert("Máquina não encontrada no sistema.");
            nomeInput.value = "Máquina Inválida";
            return;
        }
        const maquinaDoc = querySnapshot.docs[0];
        const maquinaData = maquinaDoc.data();
        
        nomeInput.value = maquinaData.nome || "Nome não cadastrado";
        idInput.value = maquinaDoc.id; // Armazena o ID do documento

    } catch (error) {
        console.error("Erro ao buscar dados da máquina:", error);
        alert("Erro ao carregar dados da máquina.");
    }
}

async function popularMecanicos() {
    const mecanicoSelect = document.getElementById('chamado-mecanico-abertura');
    if (!mecanicoSelect) return;

    mecanicoSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
        const mecanicosSnap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();
        
        mecanicoSelect.innerHTML = '<option value="">Selecione se souber quem atenderá</option>';
        mecanicosSnap.forEach(doc => {
            const f = doc.data();
            mecanicoSelect.innerHTML += `<option value="${doc.id}">${f.nome}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar mecânicos:", error);
        mecanicoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function configurarCamposCondicionais() {
    const tipoManutencaoSelect = document.getElementById('chamado-tipo-manutencao');
    const mesContainer = document.getElementById('chamado-mes-container');
    const mesSelect = document.getElementById('chamado-mes-referencia');

    if (tipoManutencaoSelect && mesContainer && mesSelect) {
        tipoManutencaoSelect.addEventListener('change', function() {
            if (this.value === 'Preventiva Mensal') {
                mesContainer.style.display = 'block';
                mesSelect.required = true;
                const mesAtual = new Date().getMonth() + 1;
                mesSelect.value = mesAtual.toString();
            } else {
                mesContainer.style.display = 'none';
                mesSelect.required = false;
                mesSelect.value = '';
            }
        });
    }
}

async function salvarChamadoMobile() {
    const maquinaId = document.getElementById('chamado-maquina-id')?.value;
    const maquinaNome = document.getElementById('chamado-maquina-nome')?.value; // Usado para notificação
    const motivo = document.getElementById('chamado-motivo')?.value;
    const observacoes = document.getElementById('chamado-obs')?.value;
    const maquinaParada = document.getElementById('chamado-maquina-parada')?.checked || false;
    const prioridade = document.getElementById('chamado-prioridade')?.value || 'Normal';
    const tipoManutencao = document.getElementById('chamado-tipo-manutencao')?.value;
    const mesReferencia = document.getElementById('chamado-mes-referencia')?.value;
    
    const mecanicoSelect = document.getElementById('chamado-mecanico-abertura');
    const mecanicoId = mecanicoSelect?.value;
    const mecanicoNome = mecanicoSelect && mecanicoSelect.selectedIndex > 0 ? mecanicoSelect.options[mecanicoSelect.selectedIndex].text : null;
    
    // Validações
    if (!maquinaId) {
        alert("Máquina inválida. Não é possível abrir o chamado.");
        return;
    }
    if (!motivo || !tipoManutencao) {
        alert("Selecione o tipo de manutenção e descreva o motivo.");
        return;
    }
    if (tipoManutencao === 'Preventiva Mensal' && !mesReferencia) {
        alert("Selecione o mês de referência para manutenção preventiva.");
        return;
    }

    const btnSalvar = document.querySelector('button[onclick="salvarChamadoMobile()"]');
    const textoOriginal = btnSalvar ? btnSalvar.innerHTML : '';

    try {
        if (btnSalvar) {
            btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btnSalvar.disabled = true;
        }

        const chamadoData = {
            maquinaId: maquinaId,
            maquinaNome: maquinaNome, // Adicionando nome da máquina para facilitar
            motivo: motivo,
            observacoes: observacoes,
            maquinaParada: maquinaParada,
            prioridade: prioridade,
            tipoManutencao: tipoManutencao,
            mesReferencia: tipoManutencao === 'Preventiva Mensal' ? mesReferencia : null,
            paradaInicioTimestamp: maquinaParada ? firebase.firestore.FieldValue.serverTimestamp() : null,
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'Aberto',
            createdByNome: currentUser ? (currentUser.displayName || currentUser.email) : 'Abertura via QR Code',
            createdByUid: currentUser ? currentUser.uid : null,
            notificacaoEnviada: false,
            mecanicoResponsavelId: mecanicoId || null,
            mecanicoResponsavelNome: mecanicoNome || null,
            dataEncerramento: null,
            tempoParada: null,
            pecasUtilizadas: null
        };
        
        // Salva no Firestore
        await db.collection('manutencao_chamados').add(chamadoData);

        alert("Chamado de manutenção aberto com sucesso!");
        
        // Redireciona ou limpa o formulário
        window.location.href = 'index.html?section=iso-manutencao'; // Volta para a tela principal

    } catch (error) {
        console.error("Erro ao salvar chamado:", error);
        alert("Erro ao salvar chamado: " + error.message);
    } finally {
        if (btnSalvar) {
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.disabled = false;
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', inicializarMobile);
