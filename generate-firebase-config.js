const fs = require('fs');
const path = require('path');

// --- PASSO 1: DEFINIR DIRETÓRIOS ---
const outputDir = path.join(__dirname, 'public');
const configPath = path.join(outputDir, 'js', 'firebase-config.js');

// --- PASSO 2: GERAR O ARQUIVO DE CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfigContent = `
// Este arquivo é gerado automaticamente durante o build. NÃO EDITE MANUALMENTE.
const firebaseConfig = {
    apiKey: "${process.env.VITE_FIREBASE_API_KEY}",
    authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN}",
    projectId: "${process.env.VITE_FIREBASE_PROJECT_ID}",
    storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${process.env.VITE_FIREBASE_APP_ID}",
    measurementId: "${process.env.VITE_FIREBASE_MEASUREMENT_ID}"
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

// --- PASSO 3: CRIAR A PASTA 'public' E COPIAR OS ARQUIVOS ---
try {
    // Cria a pasta 'public' se não existir
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Lista de arquivos e pastas a serem copiados para 'public'
    const filesToCopy = [
        'index.html',
        'login.html',
        'manutencao-mobile.html',
        'css',
        'js',
        'assets'
    ];

    // Função para copiar recursivamente
    const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();
        if (isDirectory) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            fs.readdirSync(src).forEach(childItemName => {
                // Ignora o próprio script de build e o firebase-config.js original
                if (childItemName !== 'generate-firebase-config.js' && childItemName !== 'firebase-config.js') {
                    copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
                }
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };

    console.log("Iniciando cópia de arquivos para o diretório 'public'...");
    filesToCopy.forEach(item => {
        copyRecursiveSync(path.join(__dirname, item), path.join(outputDir, item));
    });
    console.log("Arquivos do projeto copiados com sucesso.");

    // Escreve o arquivo de configuração do Firebase DENTRO da pasta 'public/js'
    fs.writeFileSync(configPath, firebaseConfigContent.trim());
    console.log('Arquivo firebase-config.js gerado com sucesso dentro de public/js!');
} catch (error) {
    console.error('Erro durante o processo de build:', error);
    process.exit(1); // Encerra o processo com erro
}
