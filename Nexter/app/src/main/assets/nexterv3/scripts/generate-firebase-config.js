// scripts/generate-firebase-config.js
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Carrega variáveis do .env se existir localmente

console.log('=== Generating Firebase Configuration ===');

// Verifica se é ambiente Vercel
const isVercel = process.env.VERCEL === '1';

// Configurações do Firebase (usar variáveis de ambiente no Vercel)
const firebaseConfig = {
  apiKey: isVercel ? process.env.FIREBASE_API_KEY : 'local-dev-key',
  authDomain: isVercel ? process.env.FIREBASE_AUTH_DOMAIN : 'local-dev.firebaseapp.com',
  projectId: isVercel ? process.env.FIREBASE_PROJECT_ID : 'local-dev-project',
  storageBucket: isVercel ? process.env.FIREBASE_STORAGE_BUCKET : 'local-dev.appspot.com',
  messagingSenderId: isVercel ? process.env.FIREBASE_MESSAGING_SENDER_ID : '123456789',
  appId: isVercel ? process.env.FIREBASE_APP_ID : '1:123456789:web:abcdef'
};

// Cria um arquivo de configuração para uso no frontend
const configContent = `// Auto-generated Firebase configuration
window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig, null, 2)};
console.log('Firebase config loaded from build');
`;

// Escreve na pasta js para ser carregado pelo index.html
try {
  fs.writeFileSync(
    path.join(__dirname, '..', 'js', 'env-loader.js'),
    configContent
  );
  console.log('✓ Firebase config written to js/env-loader.js');
} catch (err) {
  console.error('⚠️ Could not write config file:', err);
}

console.log('=== Firebase Configuration Complete ===');