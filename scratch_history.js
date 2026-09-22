const admin = require('firebase-admin'); 
const serviceAccount = require('./serviceAccountKey.json'); 
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); 
const db = admin.firestore(); 
async function check() { 
    const snapshot = await db.collection('funcionarios').where('cpf', '==', '97260096934').get(); 
    if (snapshot.empty) { 
        console.log('Não encontrado'); 
        return; 
    } 
    const func = snapshot.docs[0].data(); 
    console.log("Nome:", func.nome);
    console.log("Histórico Salarial:", JSON.stringify(func.historicoSalarial, null, 2)); 
} 
check().catch(console.error);
