const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const EscavadorProcessSearchService = require('../../backend-services/EscavadorProcessSearchService');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    // Requires FIREBASE_SERVICE_ACCOUNT in Vercel environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT não configurado. Utilizando inicialização default (funciona se Application Default Credentials estiverem configuradas).");
      initializeApp();
    }
  } catch (error) {
    console.error("Erro ao inicializar Firebase Admin:", error);
  }
}

const db = getApps().length ? getFirestore() : null;

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
  
  // Usando variável de ambiente Vercel OU o token fixo como fallback
  const token = process.env.ESCAVADOR_API_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMWFkZGU3OWNjOGQ3OTlhNjc2MzE0ZmI1ZjdkZGZmY2VmMDliZmI0YjhjZDRlNDRlNWY2NmEwMzM3YmM1MTAwMjViZWJhNDA5M2FjNjQ4MjMiLCJpYXQiOjE3ODgzNzI2NDEuNTM3MzU4LCJuYmYiOjE3ODgzNzI2NDEuNTM3MzYsImV4cCI6MTgxOTk0MDM5OS41MzU4OTgsInN1YiI6IjQxMjQzNzYiLCJzY29wZXMiOlsiYWNlc3Nhcl9hcGlfcGFnYSIsImFjZXNzYXJfYXBpX3BsYXlncm91bmQiXX0.Tv1aXtEQBEX_WSESRPoA7lTHzGA8evUkLP_jVCOxrgqWsqMKJZ2Q_eVm2LTck_d4-HEjWhzMkvwe329wYaSCM0vOZPQl8UoMosQ5tWNXSnru4H0neD2XnBfDALyXx6ZP-aZRxyrEz2EL0iFINR_pYZOHcYNrqkgMWW8HUlxiI3_aMevRCZ3dOslDvtw0c3ZaucZ3Im2LztAoegFWNId686EFRNmWm6NdLkQwKr3-HuKOBxp5i8RpIAtvANyCyjSysqyIvM8Vf3DUGCOhEEu4S0uNJ7qbY350TVHyBZfYcgFT2WGasVJSho3XfVWJWrYPxNma9sEJuaLIy3fx1FXCacSOS5FIWG5DRsVEQtUJG74iTzWMJ6FG20NJeBREMsU2K-zTCNM85POtt0qj2cKZky_ENDtBL4WfDnHMjVQRMCIwTW8uV2hbkY122fSwUjAZfNtbyHtfLfJXtWvKJqkOoXxY8fWQrVzw7N--HmxeykARPgheT2Cbj9IW5eV-KiBzFZfBuBdzEMco5AWugPsRgAtZQ6bUszz3fNUL1AA7pCm7wmFXjmeZTNpE9Seu_j1DjfFMWxmWdOFCB1psZN3IwPm6JOl7pqZzCeZZtzH5mWthDIvWvnoN1uRnOQ6vmt5tGSKKXh4rEUet8lH8roYf5QFHPIQcPMnDzMt3uczd8mk";

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
    if (cpfRaw) {
      personData = { cpf: cpfRaw, nome: nomeRaw || '' };
    } else {
      return res.status(404).json({ status: 'API_ERROR', error: 'Candidato não encontrado no sistema e CPF não fornecido.' });
    }
  }

  if (!personData.cpf) {
    return res.status(400).json({ status: 'API_ERROR', error: 'CPF é obrigatório para a pesquisa.' });
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
    return res.status(500).json({ status: 'API_ERROR', error: error.stack || error.message || 'Erro interno no servidor.' });
  }
}
