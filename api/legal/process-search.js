const admin = require('firebase-admin');
const EscavadorProcessSearchService = require('./EscavadorProcessSearchService');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Requires FIREBASE_SERVICE_ACCOUNT in Vercel environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT não configurado. Utilizando inicialização default (funciona se Application Default Credentials estiverem configuradas).");
      admin.initializeApp();
    }
  } catch (error) {
    console.error("Erro ao inicializar Firebase Admin:", error);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'API_ERROR', error: 'Method Not Allowed' });
  }

  const { personId, mode = 'AUTO', collection = 'candidatos', cpfRaw, nomeRaw } = req.body || {};
  const token = process.env.ESCAVADOR_API_TOKEN;

  if (!token) {
    return res.status(500).json({ status: 'API_ERROR', error: 'ESCAVADOR_API_TOKEN não configurado no servidor.' });
  }

  let personData = null;

  try {
    if (personId && db) {
      const doc = await db.collection(collection).doc(personId).get();
      if (doc.exists) {
        personData = doc.data();
      } else {
        // Fallback for finding in 'funcionarios' if not found in 'candidatos'
        const funcDoc = await db.collection('funcionarios').doc(personId).get();
        if (funcDoc.exists) personData = funcDoc.data();
      }
    }
  } catch (err) {
    console.error("Erro ao buscar dados no Firestore:", err);
  }

  // If personData not found from DB, try to use provided raw data if allowed (or fail)
  if (!personData) {
    if (cpfRaw && nomeRaw) {
      personData = { cpf: cpfRaw, nome: nomeRaw };
    } else {
      return res.status(404).json({ status: 'API_ERROR', error: 'Pessoa não encontrada e dados não fornecidos.' });
    }
  }

  if (!personData.cpf || !personData.nome) {
    return res.status(400).json({ status: 'API_ERROR', error: 'CPF e Nome são obrigatórios para a pesquisa.' });
  }

  try {
    const service = new EscavadorProcessSearchService(token, db);
    const result = await service.runSearch(personId, personData, mode);
    
    // Determine appropriate HTTP status
    let httpStatus = 200;
    if (result.status === 'AUTH_ERROR') httpStatus = 401;
    else if (result.status === 'NO_CREDIT') httpStatus = 402;
    else if (result.status === 'RATE_LIMIT') httpStatus = 429;
    else if (result.status === 'API_ERROR') httpStatus = 500;

    return res.status(httpStatus).json(result);
  } catch (error) {
    console.error("Erro fatal no endpoint process-search:", error);
    return res.status(500).json({ status: 'API_ERROR', error: 'Erro interno no servidor.' });
  }
}
