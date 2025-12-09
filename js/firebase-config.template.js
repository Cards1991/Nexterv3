// js/firebase-config.template.js

// ATENÇÃO: Este é um arquivo de modelo.
// As chaves serão substituídas pelas variáveis de ambiente durante o deploy.

const firebaseConfig = {
    apiKey: "__REACT_APP_FIREBASE_API_KEY__",
    authDomain: "__REACT_APP_FIREBASE_AUTH_DOMAIN__",
    projectId: "__REACT_APP_FIREBASE_PROJECT_ID__",
    storageBucket: "__REACT_APP_FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__REACT_APP_FIREBASE_MESSAGING_SENDER_ID__",
    appId: "__REACT_APP_FIREBASE_APP_ID__"
};

// Inicializa o Firebase
let db;
let auth;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("Firebase inicializado com sucesso.");
} catch (error) {
    console.error("Erro ao inicializar o Firebase:", error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center; font-family: sans-serif;"><h1>Erro Crítico</h1><p>A conexão com o banco de dados falhou. Verifique as configurações do Firebase.</p></div>`;
}