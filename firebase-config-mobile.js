// js/firebase-config-mobile.js

// Garante que as configurações do Firebase carregadas pelo env-loader.js estejam disponíveis
if (window.__FIREBASE_CONFIG__) {
    // Inicializa o Firebase APENAS se ainda não foi inicializado.
    if (!firebase.apps.length) {
        console.log("🚀 Inicializando Firebase para o módulo mobile...");
        firebase.initializeApp(window.__FIREBASE_CONFIG__);
    }

    // Define a persistência de autenticação como 'session' para este contexto.
    // Isso significa que o login só é mantido enquanto a aba do navegador estiver aberta.
    // Resolve o conflito de persistência com a aplicação principal.
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            console.log("✅ Persistência de autenticação definida como 'session' para o módulo mobile.");
            // Inicializa as variáveis globais após a configuração da persistência
            window.db = firebase.firestore();
            window.auth = firebase.auth();

            // Dispara um evento customizado para notificar que a inicialização mobile está completa.
            document.dispatchEvent(new CustomEvent('firebaseMobileReady'));
        })
        .catch((error) => {
            console.error("❌ Erro ao definir a persistência de autenticação:", error);
        });

} else {
    console.error("❌ Falha ao carregar as configurações do Firebase. O arquivo env-loader.js pode estar ausente ou com erro.");
    document.body.innerHTML = "<h1>Erro Crítico: Configuração do Firebase não encontrada.</h1>";
}