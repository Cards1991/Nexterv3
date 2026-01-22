// scripts/generate-firebase-config.js
const fs = require('fs');
const path = require('path');

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
const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} else {
  console.error('Firebase SDK not loaded');
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}`;

// Escreve em um arquivo público (opcional)
try {
  fs.writeFileSync(
    path.join(__dirname, '..', 'public', 'firebase-config.js'),
    configContent
  );
  console.log('✓ Firebase config written to public/firebase-config.js');
} catch (err) {
  console.log('⚠️ Could not write to public folder, continuing...');
}

console.log('=== Firebase Configuration Complete ===');