// js/firebase-config-mobile.js

// Garante que as configurações do Firebase carregadas pelo env-loader.js estejam disponíveis
if (window.__FIREBASE_CONFIG__) {
    // Inicializa o Firebase APENAS se ainda não foi inicializado.
    if (!firebase.apps.length) {
        console.log("🚀 Inicializando Firebase para o módulo mobile...");
        firebase.initializeApp(window.__FIREBASE_CONFIG__);
    }

    // Removido o setPersistence(SESSION) para permitir o compartilhamento de sessão
    // com a aplicação principal (que usa LOCAL por padrão).
    window.db = firebase.firestore();
    window.auth = firebase.auth();

    // Dispara um evento customizado para notificar que a inicialização mobile está completa.
    document.dispatchEvent(new CustomEvent('firebaseMobileReady'));

} else {
    console.error("❌ Falha ao carregar as configurações do Firebase. O arquivo env-loader.js pode estar ausente ou com erro.");
    document.body.innerHTML = "<h1>Erro Crítico: Configuração do Firebase não encontrada.</h1>";
}