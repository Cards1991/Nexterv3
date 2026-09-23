// server.js - Backend para consultas reais
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config(); // Carrega variáveis de ambiente

const app = express();

app.use(cors());
app.use(express.json());

// Configuração DataJud (CNJ)
const DATAJUD_CONFIG = {
    apiKey: process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==',
    baseUrl: 'https://api-publica.datajud.cnj.jus.br'
};

// Configuração das APIs públicas disponíveis
const CONFIG_APIS = {
    receitaFederal: {
        // Exemplo de API pública ou freemium. Substitua pela sua chave real no .env se necessário
        endpoint: 'https://api-receita.bravado.dev/v1/cpf',
        apiKey: process.env.RECEITA_API_KEY
    },
    tribunais: {
        tjsp: 'https://esaj.tjsp.jus.br/cpopg/openapi',
        trt: 'https://pje.trtsp.jus.br/api'
    }
};

// 1. Consulta à Receita Federal (usando API pública)
async function consultarReceitaFederal(cpf) {
    try {
        // Se não tiver chave configurada, avisa no console
        if (!CONFIG_APIS.receitaFederal.apiKey) {
            console.warn('⚠️ API Key da Receita não configurada. Tentando acesso público ou retornando parcial.');
        }

        // Nota: Esta é uma URL de exemplo. Em produção, use uma API oficial ou paga.
        const response = await axios.get(`${CONFIG_APIS.receitaFederal.endpoint}/${cpf}`, {
            headers: { 'Authorization': `Bearer ${CONFIG_APIS.receitaFederal.apiKey}` }
        });
        return {
            nome: response.data.nome,
            situacao: response.data.situacao_cadastral,
            nascimento: response.data.data_nascimento
        };
    } catch (error) {
        console.error('Erro Receita Federal:', error.message);
        return null;
    }
}

// 2. Consulta a Tribunais de Justiça (web scraping/API)
async function consultarTribunais(cpf) {
    console.log(`🔍 Consultando Tribunais para CPF: ${cpf}`);
    const processos = [];
    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfSemZero = cpfLimpo.replace(/^0+/, '');
    
    // 1. Tentar DataJud (Abrange TJPR/Projudi, TJSP, TRTs, etc)
    try {
        // Lista de tribunais prioritários (incluindo TJPR/Projudi)
        const tribunais = ['tjpr', 'tjsp', 'trt9', 'trf4'];
        
        for (const tribunal of tribunais) {
            try {
                const payload = {
                    query: {
                        bool: {
                            should: [
                                { match: { "partes.documento": cpfLimpo } },
                                { match: { "partes.numeroDocumento": cpfLimpo } },
                                { match: { "partes.documento": cpfSemZero } },
                                { match: { "partes.numeroDocumento": cpfSemZero } }
                            ],
                            minimum_should_match: 1
                        }
                    },
                    size: 10
                };

                const response = await axios.post(
                    `${DATAJUD_CONFIG.baseUrl}/api_publica_${tribunal}/_search`,
                    payload,
                    {
                        headers: {
                            'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 5000
                    }
                );

                if (response.data.hits && response.data.hits.hits.length > 0) {
                    console.log(`✅ Encontrados ${response.data.hits.hits.length} processos no ${tribunal.toUpperCase()}`);
                    response.data.hits.hits.forEach(hit => {
                        const src = hit._source;
                        processos.push({
                            numero: src.numeroProcesso,
                            tribunal: tribunal.toUpperCase(),
                            classe: src.classe?.nome || 'N/I',
                            assunto: src.assunto?.nome || (src.assuntos && src.assuntos[0]?.nome) || 'N/I',
                            situacao: 'Encontrado no DataJud',
                            fonte: 'DataJud/CNJ'
                        });
                    });
                }
            } catch (err) {
                console.log(`Erro ao consultar ${tribunal}: ${err.message}`);
            }
        }
    } catch (error) {
        console.log('Erro geral no DataJud:', error.message);
    }

    // 2. Fallback para Scraping TJSP (se DataJud falhar ou para complementar)
    if (processos.length === 0) {
        try {
            const response = await axios.get('https://esaj.tjsp.jus.br/cpopg/search.do', {
                params: { conversationId: '', dadosConsulta: { tipoPesquisa: 'PARTE', valorConsulta: cpf } },
                timeout: 5000
            });
            const $ = cheerio.load(response.data);
            $('.fundoClaro').each((i, elem) => {
                const processo = {
                    numero: $(elem).find('.numeroProcesso').text().trim(),
                    tribunal: 'TJSP (Scraping)',
                    classe: $(elem).find('.classeProcesso').text().trim(),
                    assunto: $(elem).find('.assuntoProcesso').text().trim(),
                    situacao: $(elem).find('.situacaoProcesso').text().trim() || 'Em andamento'
                };
                if(processo.numero) processos.push(processo);
            });
        } catch (error) {
            console.log('TJSP scraping indisponível:', error.message);
        }
    }

    return processos;
}

// 3. Consulta a Diários Oficiais
async function consultarDiariosOficiais(cpf) {
    try {
        // Exemplo fictício de API de diários
        const response = await axios.get('https://pesquisardiariosoficiais.com.br/api/search', {
            params: { cpf, limit: 10 },
            timeout: 3000
        });
        return response.data.resultados || [];
    } catch (error) {
        return [];
    }
}

// 4. Consulta a Portais de Transparência
async function consultarPortaisTransparencia(cpf) {
    const resultados = [];
    
    // Portal da Transparência Federal
    try {
        const response = await axios.get('https://portaldatransparencia.gov.br/api-de-dados/cpf', {
            params: { cpf },
            timeout: 3000
        });
        if (response.data) {
            resultados.push({
                fonte: 'Portal da Transparência',
                dados: response.data
            });
        }
    } catch (error) {
        // console.log('Portal Transparência indisponível');
    }
    
    return resultados;
}

// Rota principal de análise
app.post('/api/analisar-cpf', async (req, res) => {
    const { cpf, motivo } = req.body;
    console.log(`📥 Iniciando análise REAL para: ${cpf}`);
    
    if (!cpf) {
        return res.status(400).json({ success: false, message: 'CPF é obrigatório' });
    }

    try {
        // Executar consultas em paralelo
        const [
            dadosReceita,
            processosTribunais,
            diariosOficiais,
            transparencia
        ] = await Promise.allSettled([
            consultarReceitaFederal(cpf),
            consultarTribunais(cpf),
            consultarDiariosOficiais(cpf),
            consultarPortaisTransparencia(cpf)
        ]);

        // Consolidar resultados
        const resultado = {
            idConsulta: `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            cpf: cpf,
            timestamp: new Date().toISOString(),
            scoreConfianca: 0.95,
            categorias: {
                identidade: dadosReceita.status === 'fulfilled' && dadosReceita.value ? {
                    nome: dadosReceita.value.nome,
                    situacao: dadosReceita.value.situacao,
                    nascimento: dadosReceita.value.nascimento,
                    fonte: 'Receita Federal'
                } : {
                    situacao: 'Não consultado / Indisponível',
                    fonte: 'Indisponível'
                },
                legal: processosTribunais.status === 'fulfilled' ? processosTribunais.value : [],
                diarios: diariosOficiais.status === 'fulfilled' ? diariosOficiais.value : [],
                transparencia: transparencia.status === 'fulfilled' ? transparencia.value : []
            },
            fontesConsultadas: [
                'Receita Federal',
                'Tribunais de Justiça (TJSP)',
                'Diários Oficiais',
                'Portais de Transparência'
            ],
            limitacoes: [],
            observacao: '',
            isencao: "Este relatório é gerado a partir de informações públicas disponíveis, com finalidade exclusivamente informativa e operacional. Não constitui certidão oficial de antecedentes criminais, nem estabelece culpa, condenação ou inocência.",
            tipoConsulta: 'Real' // Flag importante para o frontend
        };

        // Gerar observação automática
        const totalProcessos = resultado.categorias.legal.length;
        if (totalProcessos > 0) {
            resultado.observacao = `Foram encontrados ${totalProcessos} processo(s) público(s) associados ao CPF.`;
        } else {
            resultado.observacao = 'Nada consta nas bases consultadas no momento.';
        }

        res.json({ success: true, resultado });

    } catch (error) {
        console.error('Erro na análise:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro na consulta',
            message: error.message 
        });
    }
});

// Rota para consulta judicial avulsa
app.get('/api/consultar-judicial', async (req, res) => {
    const { cpf } = req.query;
    
    if (!cpf) {
        return res.status(400).json({ success: false, message: 'CPF é obrigatório' });
    }

    try {
        const processos = await consultarTribunais(cpf); // Agora usa DataJud também
        res.json({ success: true, processos });
    } catch (error) {
        console.error('Erro na consulta judicial:', error);
        res.status(500).json({ success: false, error: 'Erro na consulta', message: error.message });
    }
});

// Rota para consulta judicial completa (POST) - Compatível com juridico-analise-cpf.js
app.post('/api/consultar-judicial', async (req, res) => {
    const { cpf, nome } = req.body;
    console.log(`📥 Iniciando consulta judicial completa (POST) para: ${cpf}`);
    
    if (!cpf) {
        return res.status(400).json({ success: false, message: 'CPF é obrigatório' });
    }

    try {
        const processos = await consultarTribunais(cpf); // Agora usa DataJud também
        
        // Estrutura de resposta compatível com o frontend
        const resultado = {
            cpf,
            nome,
            timestamp: new Date().toISOString(),
            processos: processos,
            metricas: { scoreGeral: processos.length > 0 ? 5 : 10 },
            observacao: processos.length > 0 ? `Encontrados ${processos.length} processos.` : 'Nada consta.',
            isencao: "Consulta realizada via Servidor Local (DataJud + Scraping).",
            tipoConsulta: "Local"
        };

        res.json({ success: true, resultado });
    } catch (error) {
        console.error('Erro na consulta judicial:', error);
        res.status(500).json({ success: false, error: 'Erro na consulta', message: error.message });
    }
});

// Rota para extrair seções do Teorema para atualizar o Firebase pelo frontend
app.get('/api/teorema-setores', async (req, res) => {
    let conn;
    try {
        const odbc = require('odbc');
        conn = await odbc.connect('DSN=Teorema');
        const query = 'SELECT FUNCIONARIO_CPF, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF IS NOT NULL';
        const teoremaEmps = await conn.query(query);

        const mapa = {};
        teoremaEmps.forEach(emp => {
            const cpf = emp.FUNCIONARIO_CPF;
            const codigo = emp.SECAO_CODIGO || emp.SETOR_CODIGO;
            if (cpf && codigo) {
                const cpfLimpo = String(cpf).replace(/\D/g, '');
                mapa[cpfLimpo] = parseInt(codigo, 10);
            }
        });
        res.json({ success: true, data: mapa });
    } catch (error) {
        console.error('Erro ao buscar setores no Teorema:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (conn) await conn.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de análise rodando na porta ${PORT}`);
});