// Declara db no escopo global do arquivo
let db;
let firebaseInitialized = false;

// Configuração de fallback caso o arquivo externo falhe
const firebaseConfigFallback = {
    apiKey: "AIzaSyCLr3ogjIwFQP43lhhgr_zCoO3d1XOc9ag",
    authDomain: "sys-rh-d5f0d.firebaseapp.com",
    projectId: "sys-rh-d5f0d",
    storageBucket: "sys-rh-d5f0d.appspot.com",
    messagingSenderId: "918840358373",
    appId: "1:918840358373:web:81725ece352c347a3a6b0c",
    measurementId: "G-R7NX79FCH5"
};

// Função para inicializar Firebase
function initializeFirebase() {
    try {
        // Tenta usar window.db primeiro (se já foi definido externamente)
        if (window.db) {
            db = window.db;
            firebaseInitialized = true;
            console.log("Firestore obtido de window.db");
            return true;
        }
        
        // Verifica se firebase está disponível
        if (typeof firebase === 'undefined') {
            console.log("Firebase não carregado. Tentando carregar...");
            
            // Se não estiver disponível, tenta carregar dinamicamente
            if (!window._firebaseLoading) {
                window._firebaseLoading = true;
                loadFirebaseScripts();
            }
            return false;
        }
        
        // Inicializa o Firebase se necessário
        if (!firebase.apps || firebase.apps.length === 0) {
            console.log("Inicializando Firebase...");
            firebase.initializeApp(window.__FIREBASE_CONFIG__ || firebaseConfigFallback);
        }
        
        // Obtém a instância do Firestore
        const app = firebase.apps[0];
        if (app) {
            db = firebase.firestore(app);
            firebaseInitialized = true;
            console.log("Firestore inicializado com sucesso");
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        return false;
    }
}

// Função para carregar scripts do Firebase dinamicamente
function loadFirebaseScripts() {
    const scripts = [
        'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
        'https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js'
    ];
    
    let loaded = 0;
    
    scripts.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            loaded++;
            if (loaded === scripts.length) {
                console.log("Firebase scripts carregados");
                // Tenta inicializar novamente após carregar scripts
                if (initializeFirebase()) {
                    setupForm();
                }
            }
        };
        script.onerror = () => {
            console.error(`Falha ao carregar script: ${src}`);
        };
        document.head.appendChild(script);
    });
}

// Função para configurar o formulário
function setupForm() {
    if (!firebaseInitialized || !db) {
        console.error("Firestore não inicializado corretamente.");
        showConnectionError();
        return;
    }

    // Pega o nome da máquina da URL
    const urlParams = new URLSearchParams(window.location.search);
    const maquinaId = urlParams.get('maquina');

    const maquinaInput = document.getElementById('mobile-maquina-id');
    const motivoTextarea = document.getElementById('mobile-motivo');
    const salvarBtn = document.getElementById('btn-salvar-chamado-mobile');

    if (maquinaId) {
        maquinaInput.value = maquinaId;
    } else {
        maquinaInput.value = "Máquina não identificada!";
        maquinaInput.classList.add('is-invalid');
        salvarBtn.disabled = true;
    }

    salvarBtn.addEventListener('click', async () => {
        const motivo = motivoTextarea.value.trim();

        if (!maquinaId || !motivo) {
            alert("A máquina deve ser identificada e o motivo deve ser preenchido.");
            return;
        }

        // Verifica novamente se db está definido antes de usar
        if (!db) {
            alert("Erro de conexão com o banco de dados. Tente novamente.");
            return;
        }

        // Desabilitar botão para evitar cliques duplos
        salvarBtn.disabled = true;
        salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const chamadoData = {
                maquinaId: maquinaId,
                motivo: motivo,
                observacoes: 'Aberto via Celular',
                maquinaParada: document.getElementById('mobile-maquina-parada').checked,
                status: 'Aberto',
                dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
                dataEncerramento: null,
                tempoParada: null,
                tipoManutencao: null,
                observacoesMecanico: null,
            };

            await db.collection('manutencao_chamados').add(chamadoData);

            // Mostrar mensagem de sucesso
            document.getElementById('form-container').classList.add('d-none');
            document.getElementById('success-message').classList.remove('d-none');

        } catch (error) {
            console.error("Erro ao abrir chamado via mobile:", error);
            alert("Ocorreu um erro ao tentar abrir o chamado. Tente novamente.");
            salvarBtn.disabled = false;
            salvarBtn.innerHTML = '<i class="fas fa-save"></i> Abrir Chamado';
        }
    });
}

// Função para mostrar erro de conexão
function showConnectionError() {
    alert("Erro de conexão com o banco de dados. Verifique sua conexão.");
    
    // Desativa todos os controles do formulário
    const controls = document.querySelectorAll('input, textarea, button');
    controls.forEach(control => {
        control.disabled = true;
    });
}

// Inicialização principal
document.addEventListener('DOMContentLoaded', function() {
    // Tenta inicializar o Firebase
    if (initializeFirebase()) {
        // Se inicializou imediatamente, configura o formulário
        setupForm();
    } else if (typeof firebase === 'undefined') {
        // Se Firebase não está carregado, tenta carregar scripts
        console.log("Firebase não encontrado. Iniciando carregamento...");
        loadFirebaseScripts();
    } else {
        // Outro caso de erro
        showConnectionError();
    }
});

// Adiciona um fallback: tenta novamente após alguns segundos
setTimeout(() => {
    if (!firebaseInitialized && typeof firebase !== 'undefined') {
        console.log("Tentando inicialização tardia do Firebase...");
        if (initializeFirebase()) {
            setupForm();
        }
    }
}, 3000);