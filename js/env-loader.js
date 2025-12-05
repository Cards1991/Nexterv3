// env-loader.js - Carrega variáveis de ambiente
// ============================================

(function() {
    // Configurações específicas para produção/vercel
    window.__FIREBASE_CONFIG__ = {
        apiKey: "AIzaSyCLr3ogjIwFQP43lhhgr_zCoO3d1XOc9ag",
        authDomain: "sys-rh-d5f0d.firebaseapp.com",
        projectId: "sys-rh-d5f0d",
        storageBucket: "sys-rh-d5f0d.appspot.com", // ✅ IMPORTANTE
        messagingSenderId: "918840358373",
        appId: "1:918840358373:web:81725ece352c347a3a6b0c",
        measurementId: "G-R7NX79FCH5"
    };
    console.log('📦 Variáveis de ambiente carregadas para:', window.location.hostname);
})();