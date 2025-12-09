// Este arquivo é para DESENVOLVIMENTO LOCAL.
// Em produção (Vercel), este arquivo é GERADO AUTOMATICAMENTE pelo script 'generate-firebase-config.js'.

const firebaseConfig = {
    apiKey: "AIzaSyCLr3ogjIwFQP43lhhgr_zCoO3d1XOc9ag", // Substitua pela sua API Key real
    authDomain: "sys-rh-d5f0d.firebaseapp.com",
    projectId: "sys-rh-d5f0d",
    storageBucket: "sys-rh-d5f0d.appspot.com", // Corrigido para .appspot.com
    messagingSenderId: "918840358373",
    appId: "1:918840358373:web:81725ece352c347a3a6b0c",
    measurementId: "G-R7NX79FCH5"
};

console.log('🔧 Firebase Config (Local Dev) carregada:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    hasApiKey: !!firebaseConfig.apiKey
});

// Inicializar Firebase (versão compatibilidade v8)
if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado com sucesso (Local Dev)');
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase (Local Dev):', error);
    }
}

// Instâncias dos serviços (disponibilizadas globalmente para compatibilidade com outros scripts)
const db = firebase.firestore();
const auth = firebase.auth();
const timestamp = firebase.firestore.FieldValue.serverTimestamp;

// Habilitar persistência offline (opcional, pode ser removido se causar problemas em navegadores antigos)
if (db) {
    db.enablePersistence()
        .then(() => console.log('✅ Persistência offline habilitada (Local Dev)'))
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistência já ativa em outra aba (Local Dev)');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Browser não suporta persistência offline (Local Dev)');
            } else {
                console.error('❌ Erro ao habilitar persistência (Local Dev):', err);
            }
        });
}

// Exporta as instâncias para que outros módulos possam importá-las (se usarem ES Modules)
// Para scripts carregados via <script>, elas estarão em window.db, window.auth, etc.
// Isso é para compatibilidade com a estrutura atual que usa variáveis globais.
window.db = db;
window.auth = auth;
window.timestamp = timestamp;
window.firebase = firebase; // Exporta o objeto firebase completo também