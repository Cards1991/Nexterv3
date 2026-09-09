module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { cpf, data, turbo } = req.method === 'POST' ? req.body : req.query;

  if (!cpf) {
    return res.status(400).json({ error: 'CPF é obrigatório.' });
  }

  const cleanCpf = cpf.replace(/\D/g, '');
  const token = '214312030idUEkpCDXn386933872';
  
  let apiUrl = `http://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cleanCpf}&token=${token}`;
  
  if (data) {
    // If date has slashes, it should be url encoded
    apiUrl += `&data=${encodeURIComponent(data)}`;
  }
  
  if (turbo === 'true' || turbo === true) {
    apiUrl += '&turbo=1';
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const resultText = await response.text();
    let resultJson;
    try {
        resultJson = JSON.parse(resultText);
    } catch (e) {
        return res.status(500).json({ error: 'Erro ao analisar resposta da API do Hub.', raw: resultText });
    }

    return res.status(200).json(resultJson);

  } catch (error) {
    console.error('Erro ao consultar Hub do Desenvolvedor:', error);
    return res.status(500).json({ error: 'Falha na comunicação com a API externa.' });
  }
};
