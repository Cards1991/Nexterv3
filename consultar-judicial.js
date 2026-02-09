// api/consultar-judicial.js - Serverless Function para Vercel
const axios = require('axios');
const crypto = require('crypto');

// Configuração DataJud
const DATAJUD_CONFIG = {
  baseUrl: 'https://api-publica.datajud.cnj.jus.br',
  apiKey: process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==',
  timeout: 8000, // Timeout menor para Vercel
  maxResultsPerTribunal: 20
};

// Tribunais Essenciais (Reduzido para Vercel devido ao timeout de 10s do plano Hobby)
const TRIBUNALS_ESSENTIALS = {
  ESTADUAL: ['tjsp', 'tjmg', 'tjpr', 'tjrj', 'tjrs'],
  FEDERAL: ['trf1', 'trf2', 'trf3', 'trf4'],
  TRABALHO: ['trt1', 'trt2', 'trt3', 'trt4', 'trt9', 'trt15'],
  SUPERIOR: ['stj', 'tst']
};

export default async function handler(req, res) {
  // Configurar CORS
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
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { cpf, nome, motivo, usuario } = req.body;
  const startTime = Date.now();

  if (!cpf || !nome) {
    return res.status(400).json({ success: false, error: 'CPF e Nome são obrigatórios' });
  }

  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const nomeNormalizado = nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    const todosProcessos = [];
    const promises = [];

    // Dispara consultas em paralelo (limitado para não estourar memória/tempo)
    for (const [ramo, tribunais] of Object.entries(TRIBUNALS_ESSENTIALS)) {
      for (const tribunal of tribunais) {
        promises.push(consultarTribunal(tribunal, ramo, cpfLimpo, nomeNormalizado));
      }
    }

    // Aguarda todas as promessas (Promise.allSettled para não falhar tudo se um falhar)
    const resultados = await Promise.allSettled(promises);

    resultados.forEach(result => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        todosProcessos.push(...result.value);
      }
    });

    // Cálculo simplificado de score para Vercel
    const score = calcularScoreSimples(todosProcessos);

    const resultadoCompleto = {
      idConsulta: crypto.createHash('md5').update(`${cpf}-${Date.now()}`).digest('hex'),
      cpf: cpf,
      nome: nome,
      timestamp: new Date().toISOString(),
      tempoRespostaMs: Date.now() - startTime,
      processos: todosProcessos,
      metricas: {
        scoreGeral: score,
        quantidadePorClassificacao: {
          total: todosProcessos.length
        }
      },
      estatisticas: {
        tribunaisConsultados: promises.length,
        totalProcessos: todosProcessos.length
      },
      tipoConsulta: 'DataJud/Vercel (Essencial)',
      observacao: todosProcessos.length > 0 ? `Encontrados ${todosProcessos.length} processos nas bases essenciais.` : 'Nada consta nas bases essenciais.',
      isencao: "Consulta realizada em bases essenciais via Serverless. Para varredura completa, use o servidor local."
    };

    res.status(200).json({ success: true, resultado: resultadoCompleto });

  } catch (error) {
    console.error('Erro Vercel Function:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function consultarTribunal(tribunalAlias, ramo, cpf, nome) {
  const url = `${DATAJUD_CONFIG.baseUrl}/api_publica_${tribunalAlias}/_search`;
  
  const cpfLimpo = cpf.replace(/\D/g, '');
  const cpfFormatado = `${cpfLimpo.slice(0,3)}.${cpfLimpo.slice(3,6)}.${cpfLimpo.slice(6,9)}-${cpfLimpo.slice(9,11)}`;

    const payload = {
        query: {
            bool: {
                should: [
                    { match: { "partes.documento": cpfLimpo } },
                    { match: { "partes.documento": cpfFormatado } },
                    { match: { "partes.numeroDocumento": cpfLimpo } },
                    { match: { "partes.numeroDocumento": cpfFormatado } },
                    { match: { "partes.nome": { "query": nomeNormalizado, "operator": "and" } } }
                ],
                minimum_should_match: 1
            }
        },
        size: DATAJUD_CONFIG.maxResultsPerTribunal,
        _source: ["numeroProcesso", "classeProcessual", "assuntoPrincipal", "orgaoJulgador", "situacao", "dataDistribuicao", "grau"]
    };
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: DATAJUD_CONFIG.timeout
    });
    
    if (!response.data || !response.data.hits || !response.data.hits.hits) return [];
    
    return response.data.hits.hits.map(hit => ({
      numeroProcesso: hit._source.numeroProcesso,
      tribunal: tribunalAlias.toUpperCase(),
      classeProcessual: hit._source.classeProcessual?.nome || 'N/I',
      assuntoPrincipal: hit._source.assuntoPrincipal?.nome || 'N/I',
      situacao: hit._source.situacao || 'ATIVO',
      dataDistribuicao: hit._source.dataDistribuicao,
      grau: hit._source.grau,
      fonte: 'DataJud'
    }));
  } catch (error) {
    return [];
  }
}


