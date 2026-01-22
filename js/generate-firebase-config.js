// generate-firebase-config.js
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID, 
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Verifica se todas as variáveis necessárias estão presentes
const requiredVars = ['apiKey', 'projectId', 'appId'];
const missingVars = requiredVars.filter(varName => !firebaseConfig[varName]);

if (missingVars.length > 0) {
    console.error('❌ Variáveis de ambiente do Firebase faltando:', missingVars);
    process.exit(1);
}

const configContent = `
// firebase-config.js - GERADO AUTOMATICAMENTE PELO VERCEL 
// ======================================================

const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Instâncias dos serviços (disponibilizadas globalmente para compatibilidade) 
window.db = firebase.firestore();
window.auth = firebase.auth();
window.timestamp = firebase.firestore.FieldValue.serverTimestamp;

// Habilitar persistência offline
if (window.db) {
    window.db.enablePersistence()
        .then(() => console.log('✅ Persistência offline habilitada (Produção)')) 
        .catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistência já ativa em outra aba (Produção)');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Browser não suporta persistência offline (Produção)');
            } else {
                console.error('❌ Erro ao habilitar persistência (Produção):', err);
            }
        });
}
 
console.log('🚀 Firebase configurado para produção');
`;

// Escreve o arquivo 
fs.writeFileSync(
    path.join(__dirname, 'js', 'firebase-config.js'),
    configContent.trim()
);

console.log('✅ firebase-config.js gerado com sucesso');