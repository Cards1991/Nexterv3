const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de configuração do Firebase na pasta 'js'
const configPath = path.join(__dirname, 'js', 'firebase-config.js');

// Conteúdo do arquivo que será gerado, usando as variáveis de ambiente
const firebaseConfigContent = `
// Este arquivo é gerado automaticamente durante o build. NÃO EDITE MANUALMENTE.
const firebaseConfig = {
    apiKey: "${process.env.REACT_APP_FIREBASE_API_KEY}",
    authDomain: "${process.env.REACT_APP_FIREBASE_AUTH_DOMAIN}",
    projectId: "${process.env.REACT_APP_FIREBASE_PROJECT_ID}",
    storageBucket: "${process.env.REACT_APP_FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${process.env.REACT_APP_FIREBASE_APP_ID}"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Instâncias dos serviços
const db = firebase.firestore();
const auth = firebase.auth();
const timestamp = firebase.firestore.FieldValue.serverTimestamp;

console.log('Firebase configurado com sucesso a partir das variáveis de ambiente.');
`;

// Escreve o conteúdo no arquivo
try {
    fs.writeFileSync(configPath, firebaseConfigContent.trim());
    console.log('Arquivo firebase-config.js gerado com sucesso!');
} catch (error) {
    console.error('Erro ao gerar o arquivo firebase-config.js:', error);
    process.exit(1); // Encerra o processo com erro
}
