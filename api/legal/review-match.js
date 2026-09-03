const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { personId, numeroCnj, decision, reviewedBy, comment } = req.body;

  if (!personId || !numeroCnj || !decision) {
    return res.status(400).json({ success: false, error: 'Parâmetros obrigatórios ausentes.' });
  }

  if (!db) {
    return res.status(500).json({ success: false, error: 'Banco de dados não configurado.' });
  }

  try {
    const reviewData = {
      personId,
      numeroCnj,
      decision, // 'CONFIRMED' or 'HOMONYM'
      reviewedBy: reviewedBy || 'Sistema',
      reviewedAt: new Date(),
      comment: comment || ''
    };

    // Save or update review in ProcessPersonReview collection
    const reviewId = `${personId}_${numeroCnj.replace(/\D/g, '')}`;
    await db.collection('ProcessPersonReview').doc(reviewId).set(reviewData, { merge: true });

    return res.status(200).json({ success: true, message: 'Revisão salva com sucesso.' });
  } catch (error) {
    console.error("Erro ao salvar revisão:", error);
    return res.status(500).json({ success: false, error: 'Erro interno ao salvar revisão.' });
  }
}
