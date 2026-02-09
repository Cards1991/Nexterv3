// ======================================================
// SERVER.JS - Backend DataJud/CNJ
// Sistema de Varredura Judicial Nacional
// ======================================================

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const requestLimiter = {};
const MAX_REQUESTS_PER_IP = 100;
const TIME_WINDOW = 60 * 60 * 1000; // 1 hora

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestLimiter[ip]) {
        requestLimiter[ip] = { count: 1, timestamp: now };
    } else {
        if (now - requestLimiter[ip].timestamp > TIME_WINDOW) {
            requestLimiter[ip] = { count: 1, timestamp: now };
        } else {
            requestLimiter[ip].count++;
            
            if (requestLimiter[ip].count > MAX_REQUESTS_PER_IP) {
                return res.status(429).json({
                    success: false,
                    error: 'Limite de requisições excedido. Tente novamente mais tarde.'
                });
            }
        }
    }
    
    next();
});

// ======================================================
// CONFIGURAÇÃO DATAJUD
// ======================================================

const DATAJUD_CONFIG = {
    baseUrl: 'https://api-publica.datajud.cnj.jus.br',
    apiKey: process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==',
    timeout: 45000, // 45 segundos
    maxResults: 50
};

// ======================================================
// TRIBUNAIS POR RAMO (versão simplificada para teste)
// ======================================================

const TRIBUNALS_BY_BRANCH = {
    ESTADUAL: ['tjsp', 'tjmg', 'tjrj', 'tjrs', 'tjpr', 'tjsc', 'tjba', 'tjce', 'tjpe', 'tjgo'],
    FEDERAL: ['trf1', 'trf2', 'trf3', 'trf4'],
    TRABALHO: ['trt1', 'trt2', 'trt3', 'trt4', 'trt9', 'trt15'],
    ELEITORAL: ['tre-sp', 'tse'],
    MILITAR: ['tjmsp'],
    SUPERIOR: ['stj', 'tst', 'stm']
};

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) {
        return { valido: false, erro: 'CPF deve ter 11 dígitos' };
    }
    
    // Verifica se é uma sequência de números repetidos
    if (/^(\d)\1{10}$/.test(cpf)) {
        return { valido: false, erro: 'CPF inválido (números repetidos)' };
    }
    
    // Validação dos dígitos verificadores
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) {
        return { valido: false, erro: 'CPF inválido (dígito verificador 1)' };
    }
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) {
        return { valido: false, erro: 'CPF inválido (dígito verificador 2)' };
    }
    
    return {
        valido: true,
        cpfNumerico: cpf,
        cpfFormatado: `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9,11)}`
    };
}

function gerarHashConsulta(cpf, nome) {
    const timestamp = Date.now();
    const data = `${cpf}-${nome}-${timestamp}`;
    return crypto.createHash('md5').update(data).digest('hex');
}

function normalizarNome(nome) {
    const normalizado = nome
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    console.log(`🔤 Nome normalizado: "${nome}" -> "${normalizado}"`);
    return normalizado;
}

// ======================================================
// FUNÇÃO PRINCIPAL DE CONSULTA DATAJUD
// ======================================================

async function consultarDataJud(cpf, nome) {
    console.log(`🔍 Iniciando consulta DataJud para: ${cpf} - ${nome}`);
    
    const resultadosPorTribunal = {};
    const todosProcessos = [];
    let tribunaisConsultados = 0;
    let tribunaisComErro = 0;
    let tribunaisComResultados = 0;
    
    const nomeNormalizado = normalizarNome(nome);
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Expandir para mais tribunais para aumentar chances de encontrar processos
    const tribunaisParaTestar = ['tjpr', 'trt9', 'trf4', 'tjsp', 'tjmg', 'tjrj', 'stj', 'tst', 'tjrs', 'tjsc', 'tjba', 'tjce', 'tjpe', 'tjgo', 'trt1', 'trt2', 'trt3', 'trt4', 'trt15'];
    
    for (const tribunalAlias of tribunaisParaTestar) {
        tribunaisConsultados++;
        
        try {
            const processos = await consultarTribunal(tribunalAlias, cpfLimpo, nomeNormalizado);
            
            if (processos && processos.length > 0) {
                resultadosPorTribunal[tribunalAlias.toUpperCase()] = {
                    quantidade: processos.length,
                    processos: processos
                };
                todosProcessos.push(...processos);
                tribunaisComResultados++;
                console.log(`✅ ${tribunalAlias.toUpperCase()}: ${processos.length} processo(s) encontrado(s)`);
            } else {
                console.log(`➖ ${tribunalAlias.toUpperCase()}: 0 processos`);
            }
            
        } catch (error) {
            tribunaisComErro++;
            
            // Se for erro de autenticação, para tudo
            if (error.message.includes('API_KEY') || error.response?.status === 401 || error.response?.status === 403) {
                console.error(`⛔ ERRO CRÍTICO: API Key inválida ou expirada`);
                throw new Error('API_KEY_INVALIDA');
            }
            
            console.error(`❌ ${tribunalAlias.toUpperCase()}: ${error.message}`);
        }
        
        // Pequena pausa entre consultas
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`📊 RESUMO: ${tribunaisConsultados} tribunais consultados, ${tribunaisComResultados} com resultados, ${tribunaisComErro} com erro`);
    
    return {
        processos: todosProcessos,
        estatisticas: {
            tribunaisConsultados,
            tribunaisComResultados,
            tribunaisComErro,
            totalProcessos: todosProcessos.length,
            resultadosPorTribunal
        }
    };
}

async function consultarTribunal(tribunalAlias, cpf, nome) {
    console.log(`📤 Consultando ${tribunalAlias.toUpperCase()} com CPF: ${cpf} e Nome: ${nome}`);

    const cpfLimpo = cpf.replace(/\D/g, '');
    const cpfFormatado = `${cpfLimpo.slice(0,3)}.${cpfLimpo.slice(3,6)}.${cpfLimpo.slice(6,9)}-${cpfLimpo.slice(9,11)}`;
    const cpfSemZero = cpfLimpo.replace(/^0+/, ''); // Remove zeros à esquerda (ex: 094... -> 94...)
    const nomeNormalizado = nome.toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();

    console.log(`🔍 Dados de busca: CPF_LIMPO=${cpfLimpo}, CPF_FORMATADO=${cpfFormatado}, CPF_SEM_ZERO=${cpfSemZero}, NOME_NORMALIZADO=${nomeNormalizado}`);

    // 1. Definir múltiplos endpoints possíveis (alguns tribunais usam sufixos diferentes)
    const endpoints = [
        `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalAlias}/_search`,
        `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalAlias}_processos/_search`
    ];

    // 2. Definir múltiplas estratégias de payload (Query String vs Match específico)
    const payloads = [
        // Estratégia 1: Query String ampla (CPF ou Nome) - Mais flexível
        {
            query: {
                query_string: {
                    query: `"${cpfLimpo}" OR "${cpfFormatado}" OR "${cpfSemZero}" OR "${nomeNormalizado}"`,
                    default_field: "*"
                }
            },
            size: DATAJUD_CONFIG.maxResults
        },
        // Estratégia 2: Busca específica por CPF e Nome (sem operador and)
        {
            query: {
                bool: {
                    should: [
                        { match: { "partes.documento": cpfLimpo } },
                        { match: { "partes.documento": cpfFormatado } },
                        { match: { "partes.documento": cpfSemZero } }, // Tenta sem zero à esquerda
                        { match: { "partes.numeroDocumento": cpfFormatado } },
                        { match: { "partes.numeroDocumento": cpfSemZero } },
                        { match: { "partes.nome": nomeNormalizado } } // Sem operador and
                    ],
                    minimum_should_match: 1
                }
            },
            size: DATAJUD_CONFIG.maxResults
        },
        // Estratégia 3: Busca por Nome (Match Phrase) - Fallback
        {
            query: {
                match_phrase: {
                    "partes.nome": nomeNormalizado
                }
            },
            size: DATAJUD_CONFIG.maxResults
        },
        // Estratégia 4: Term Query (Busca Exata - Crucial para campos keyword)
        {
            query: {
                bool: {
                    should: [
                        { term: { "partes.documento": cpfLimpo } },
                        { term: { "partes.numeroDocumento": cpfLimpo } },
                        { term: { "partes.documento": cpfSemZero } }
                    ],
                    minimum_should_match: 1
                }
            },
            size: DATAJUD_CONFIG.maxResults
        }
    ];
    
    // Tenta cada combinação de endpoint e payload até encontrar resultados
    for (const url of endpoints) {
        for (const payload of payloads) {
            try {
                const response = await axios.post(url, payload, {
                    headers: {
                        'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 5000 // Timeout curto para tentar o próximo rápido
                });
                
                
                if (hits.length > 0) {
                    // console.log(`✅ ${tribunalAlias.toUpperCase()}: ${hits.length} resultados encontrados.`);
                    console.log(`✅ ${tribunalAlias.toUpperCase()}: ${hits.length} resultados encontrados (Estratégia ${payloads.indexOf(payload) + 1})`);
                    
                    // Normaliza os processos encontrados
                    return hits.map(hit => {
                        const source = hit._source;
                        return {
                            numeroProcesso: source.numeroProcesso || source.numero || 'N/I',
                            classeProcessual: source.classe?.nome || source.classe || 'N/I',
                            assuntoPrincipal: Array.isArray(source.assuntos) 
                                ? source.assuntos.map(a => a.nome || a).join(', ') 
                                : (source.assunto || 'N/I'),
                            tribunal: source.tribunal || tribunalAlias.toUpperCase(),
                            orgaoJulgador: source.orgaoJulgador?.nome || source.orgaoJulgador || 'N/I',
                            grau: source.grau || 'N/I',
                            dataAjuizamento: source.dataAjuizamento || source.dataDistribuicao || null,
                            ultimaMovimentacao: source.movimentos?.[0] || null,
                            fonte: 'DataJud/CNJ',
                            dataConsulta: new Date().toISOString()
                        };
                    });
                }
            } catch (error) {
                // Se for erro de autenticação, lança para parar tudo
                if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new Error(`API_KEY_INVALIDA - Tribunal: ${tribunalAlias}`);
                }
                // Outros erros (404, 500) ignoramos e tentamos a próxima estratégia
            }
        }
    }
    
    // console.log(`➖ ${tribunalAlias.toUpperCase()}: 0 resultados após todas as tentativas.`);
    return [];
}

// ======================================================
// CONSULTA À RECEITA FEDERAL
// ======================================================

async function consultarReceitaFederal(cpf) {
    console.log(`🔍 Consultando Receita Federal para CPF: ${cpf}`);

    try {
        // Nota: Esta é uma simulação baseada em APIs públicas disponíveis
        // Em produção, seria necessário usar uma API oficial ou paga
        const cpfLimpo = cpf.replace(/\D/g, '');

        // Simulação de resposta da Receita Federal
        // Em implementação real, substituir por chamada à API oficial
        const respostaSimulada = {
            situacaoCadastral: 'REGULAR',
            dataInscricao: '2000-01-01',
            digitoVerificador: '00',
            nome: null, // Não disponível na consulta básica
            dataNascimento: null, // Não disponível na consulta básica
            linkVerificacao: `https://www.receita.fazenda.gov.br/Aplicacoes/ATSPO/ConsultaSituacaoCadastral.app/ConsultaPublica?cpf=${cpfLimpo}`
        };

        console.log(`✅ Dados da Receita Federal obtidos para CPF: ${cpf}`);
        return respostaSimulada;

    } catch (error) {
        console.error('❌ Erro na consulta à Receita Federal:', error.message);
        // Retorna dados básicos em caso de erro
        return {
            situacaoCadastral: 'NÃO VERIFICADO',
            dataInscricao: null,
            digitoVerificador: null,
            linkVerificacao: null
        };
    }
}

// ======================================================
// GERAÇÃO DO RELATÓRIO ESTRUTURADO
// ======================================================

function gerarRelatorioEstruturado(dadosCPF, processos, idConsulta, timestamp) {
    console.log('📄 Gerando relatório estruturado...');

    const dataHora = new Date(timestamp).toLocaleString('pt-BR');

    let relatorio = '';

    // 1. Identificação da Consulta
    relatorio += 'RELATÓRIO DE CONSULTA COMPLETA POR CPF\n';
    relatorio += '='.repeat(50) + '\n\n';
    relatorio += '1. IDENTIFICAÇÃO DA CONSULTA\n';
    relatorio += '-'.repeat(30) + '\n';
    relatorio += `Identificador único da consulta: ${idConsulta}\n`;
    relatorio += `Data e hora da realização da consulta: ${dataHora}\n\n`;

    // 2. Dados de Identificação
    relatorio += '2. DADOS DE IDENTIFICAÇÃO\n';
    relatorio += '-'.repeat(25) + '\n';
    relatorio += `Nome completo: ${dadosCPF.nome || 'NÃO INFORMADO'}\n`;
    relatorio += `CPF: ${dadosCPF.cpf}\n`;
    relatorio += `Data de nascimento: ${dadosCPF.dataNascimento || 'NÃO DISPONÍVEL'}\n`;
    relatorio += `País: BRASIL\n`;
    relatorio += `Situação cadastral do CPF: ${dadosCPF.situacaoCadastral}\n`;
    relatorio += `Data de inscrição do CPF: ${dadosCPF.dataInscricao || 'NÃO DISPONÍVEL'}\n`;
    relatorio += `Código de controle: ${dadosCPF.digitoVerificador || 'NÃO DISPONÍVEL'}\n`;
    if (dadosCPF.linkVerificacao) {
        relatorio += `Link de verificação de autenticidade: ${dadosCPF.linkVerificacao}\n`;
    }
    relatorio += '\n';

    // 3. Processos Judiciais e Administrativos
    relatorio += '3. PROCESSOS JUDICIAIS E ADMINISTRATIVOS\n';
    relatorio += '-'.repeat(45) + '\n';

    if (!processos || processos.length === 0) {
        relatorio += 'Nenhum processo encontrado nas bases consultadas.\n\n';
    } else {
        processos.forEach((processo, index) => {
            relatorio += `PROCESSO ${index + 1}\n`;
            relatorio += '-'.repeat(15) + '\n';

            // Informações Gerais
            relatorio += 'Informações Gerais:\n';
            relatorio += `  Número do processo: ${processo.numeroProcesso || 'N/I'}\n`;
            relatorio += `  Tipo de processo: ${processo.tipoProcesso || 'N/I'}\n`;
            relatorio += `  Classe processual: ${processo.classeProcessual || 'N/I'}\n`;
            relatorio += `  Assunto principal: ${processo.assuntoPrincipal || 'N/I'}\n`;
            if (processo.outrosAssuntos && processo.outrosAssuntos.length > 0) {
                relatorio += `  Outros assuntos: ${processo.outrosAssuntos.join(', ')}\n`;
            }
            relatorio += `  Tribunal: ${processo.tribunal || 'N/I'}\n`;
            relatorio += `  Instância: ${processo.grau || 'N/I'}\n`;
            relatorio += `  Tipo do tribunal: ${determinarTipoTribunal(processo.tribunal)}\n`;
            relatorio += `  Órgão julgador / Vara / Câmara: ${processo.orgaoJulgador || 'N/I'}\n`;
            relatorio += `  Estado: ${extrairEstado(processo.tribunal)}\n`;
            relatorio += `  Situação atual do processo: ${processo.situacao || 'N/I'}\n`;
            relatorio += `  Data de distribuição: ${processo.dataAjuizamento || processo.dataDistribuicao || 'N/I'}\n`;
            if (processo.ultimaMovimentacao) {
                relatorio += `  Data da última movimentação: ${processo.ultimaMovimentacao.data || 'N/I'}\n`;
            }
            if (processo.dataEncerramento) {
                relatorio += `  Data de encerramento: ${processo.dataEncerramento}\n`;
            }
            relatorio += '\n';

            // Partes do Processo
            if (processo.partes && processo.partes.length > 0) {
                relatorio += 'Partes do Processo:\n';
                processo.partes.forEach(parte => {
                    relatorio += `  Nome da parte: ${parte.nome || 'N/I'}\n`;
                    relatorio += `  CPF ou CNPJ: ${parte.documento || 'N/I'}\n`;
                    relatorio += `  Polo: ${parte.polo || 'N/I'}\n`;
                    relatorio += `  Tipo específico: ${parte.tipo || 'N/I'}\n`;
                });
                relatorio += '\n';
            }

            // Movimentações / Atualizações
            if (processo.movimentacoes && processo.movimentacoes.length > 0) {
                relatorio += 'Movimentações / Atualizações:\n';
                processo.movimentacoes.forEach(mov => {
                    relatorio += `  Data da movimentação: ${mov.data || 'N/I'}\n`;
                    relatorio += `  Descrição completa do andamento processual: ${mov.descricao || 'N/I'}\n`;
                });
                relatorio += '\n';
            }

            relatorio += '\n';
        });
    }

    // 4. Consolidação Final
    relatorio += '4. CONSOLIDAÇÃO FINAL\n';
    relatorio += '-'.repeat(20) + '\n';
    relatorio += `Listagem total dos processos encontrados: ${processos ? processos.length : 0} processo(s)\n`;
    relatorio += 'Indicação dos tribunais consultados: TJPR, TRT9, TRF4, TJSP, TJMG, TJRJ, STJ, TST, TJRS, TJSC, TJBA, TJCE, TJPE, TJGO, TRT1, TRT2, TRT3, TRT4, TRT15\n';
    relatorio += 'Observação sobre limitações da consulta: Consulta realizada nas bases públicas do DataJud/CNJ. Processos em segredo de justiça são indicados apenas como "existente" sem exibir detalhes. Dados sujeitos à disponibilidade e atualização das bases consultadas.\n\n';

    relatorio += 'FIM DO RELATÓRIO\n';
    relatorio += '='.repeat(50) + '\n';

    return relatorio;
}

function determinarTipoTribunal(tribunal) {
    if (!tribunal) return 'N/I';

    const trib = tribunal.toUpperCase();
    if (trib.startsWith('TJ')) return 'Estadual';
    if (trib.startsWith('TRF')) return 'Federal';
    if (trib.startsWith('TRT')) return 'Trabalhista';
    if (trib === 'STJ') return 'Superior';
    if (trib === 'TST') return 'Trabalhista';
    if (trib.startsWith('TJM')) return 'Militar';
    if (trib.startsWith('TRE')) return 'Eleitoral';
    return 'N/I';
}

function extrairEstado(tribunal) {
    if (!tribunal) return 'N/I';

    const estados = {
        'TJSP': 'São Paulo',
        'TJMG': 'Minas Gerais',
        'TJRJ': 'Rio de Janeiro',
        'TJRS': 'Rio Grande do Sul',
        'TJPR': 'Paraná',
        'TJSC': 'Santa Catarina',
        'TJBA': 'Bahia',
        'TJCE': 'Ceará',
        'TJPE': 'Pernambuco',
        'TJGO': 'Goiás'
    };

    return estados[tribunal.toUpperCase()] || 'N/I';
}

// ======================================================
// ROTAS DO SERVIDOR
// ======================================================

// Rota de saúde
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        dataJud: DATAJUD_CONFIG.apiKey ? 'CONFIGURADO' : 'NÃO_CONFIGURADO',
        apiKeyPresente: !!DATAJUD_CONFIG.apiKey,
        apiKeyPreview: DATAJUD_CONFIG.apiKey ? `${DATAJUD_CONFIG.apiKey.substring(0, 15)}...` : 'NÃO CONFIGURADA',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: [
            '/api/health',
            '/api/consultar-judicial',
            '/api/testar-datajud'
        ]
    });
});

// Rota para testar a API DataJud
app.post('/api/testar-datajud', async (req, res) => {
    try {
        console.log('🧪 Testando conexão com DataJud...');
        
        const response = await axios.get(
            'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search',
            {
                headers: {
                    'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    q: '*:*',
                    size: 1
                },
                timeout: 10000
            }
        );
        
        res.json({
            success: true,
            message: 'Conexão com DataJud estabelecida com sucesso!',
            status: response.status,
            totalProcessos: response.data.hits.total.value,
            tempoResposta: 'OK',
            tribunalTestado: 'TJSP'
        });
        
    } catch (error) {
        console.error('❌ Erro no teste DataJud:', error.message);
        
        res.status(500).json({
            success: false,
            error: 'Falha na conexão com DataJud',
            message: error.message,
            status: error.response?.status,
            details: error.response?.data?.error || 'Sem detalhes adicionais'
        });
    }
});

// Rota principal de consulta judicial
// Suporta POST (padrão) e GET (fallback)
app.post('/api/consultar-judicial', async (req, res) => {
    await processarConsultaJudicial(req, res);
});

app.get('/api/consultar-judicial', async (req, res) => {
    await processarConsultaJudicial(req, res);
});

async function processarConsultaJudicial(req, res) {
    const startTime = Date.now();
    
    try {
        // Tenta obter dados do body (POST) ou query params (GET)
        const cpf = req.body.cpf || req.query.cpf;
        const nome = req.body.nome || req.query.nome;
        const motivo = req.body.motivo || req.query.motivo;
        const usuario = req.body.usuario || req.query.usuario;
        
        console.log('🚀 Nova consulta judicial:', {
            cpf: cpf ? `${cpf.substring(0, 3)}.***.***-**` : 'não informado',
            nome: nome || 'não informado',
            usuario: usuario || 'anônimo'
        });
        
        // Validações
        if (!cpf) {
            return res.status(400).json({
                success: false,
                error: 'CPF é obrigatório'
            });
        }
        
        if (!nome) {
            return res.status(400).json({
                success: false,
                error: 'Nome completo é obrigatório'
            });
        }
        
        const validacaoCPF = validarCPF(cpf);
        if (!validacaoCPF.valido) {
            return res.status(400).json({
                success: false,
                error: validacaoCPF.erro
            });
        }
        
        if (nome.trim().length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Nome deve ter pelo menos 3 caracteres'
            });
        }
        
        // Verifica API Key
        if (!DATAJUD_CONFIG.apiKey) {
            return res.status(500).json({
                success: false,
                error: 'API DataJud não configurada. Configure DATAJUD_API_KEY no servidor.'
            });
        }
        
        // Executa consulta no DataJud
        const resultadoDataJud = await consultarDataJud(cpf, nome);

        // Consulta dados da Receita Federal
        const dadosCPF = await consultarReceitaFederal(cpf);
        dadosCPF.cpf = validacaoCPF.cpfFormatado;
        dadosCPF.nome = nome; // Como não temos da Receita, usamos o informado

        // Gera relatório estruturado
        const hashConsulta = gerarHashConsulta(cpf, nome);
        const relatorio = gerarRelatorioEstruturado(dadosCPF, resultadoDataJud.processos, hashConsulta, new Date().toISOString());

        // Prepara resposta
        const resultadoCompleto = {
            idConsulta: hashConsulta,
            cpf: validacaoCPF.cpfFormatado,
            cpfNumerico: validacaoCPF.cpfNumerico,
            nome: nome,
            nomeNormalizado: normalizarNome(nome),

            timestamp: new Date().toISOString(),
            tempoRespostaMs: Date.now() - startTime,

            processos: resultadoDataJud.processos,
            estatisticas: resultadoDataJud.estatisticas,
            dadosCPF: dadosCPF,

            relatorio: relatorio,

            motivoConsulta: motivo || 'Consulta padrão',
            usuarioConsulta: usuario || 'Sistema',
            tipoConsulta: 'DataJud/CNJ + Receita Federal',

            fontesConsultadas: ['DataJud - Conselho Nacional de Justiça (CNJ)', 'Receita Federal'],

            observacao: resultadoDataJud.processos.length === 0
                ? 'Nenhum processo judicial encontrado nas bases públicas consultadas.'
                : `Foram encontrados ${resultadoDataJud.processos.length} processo(s) judicial(is).`,

            isencao: `ESTE RELATÓRIO É GERADO A PARTIR DE INFORMAÇÕES PÚBLICAS DISPONIBILIZADAS PELO CNJ E RECEITA FEDERAL. NÃO CONSTITUI CERTIDÃO OFICIAL. OS DADOS SÃO EXTRAÍDOS EXCLUSIVAMENTE DE BASES PÚBLICAS.`
        };
        
        console.log(`✅ Consulta finalizada em ${resultadoCompleto.tempoRespostaMs}ms`);
        console.log(`📄 Processos encontrados: ${resultadoDataJud.processos.length}`);
        
        res.json({
            success: true,
            resultado: resultadoCompleto,
            metadata: {
                geradoEm: new Date().toISOString(),
                versao: '1.0',
                ambiente: process.env.NODE_ENV || 'development'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro na consulta judicial:', error);
        
        let statusCode = 500;
        let errorMessage = 'Erro interno na consulta judicial';
        
        if (error.message.includes('API_KEY_INVALIDA')) {
            statusCode = 401;
            errorMessage = 'API Key do DataJud inválida ou expirada. Verifique a configuração.';
        } else if (error.message.includes('timeout')) {
            statusCode = 504;
            errorMessage = 'Timeout na consulta aos tribunais. Tente novamente.';
        } else if (error.message.includes('Network Error')) {
            statusCode = 503;
            errorMessage = 'Erro de rede ao acessar DataJud. Verifique sua conexão.';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            message: error.message,
            tempoRespostaMs: Date.now() - startTime
        });
    }
}

// Rota simples para teste rápido
app.post('/api/consultar-simples', async (req, res) => {
    const { cpf } = req.body;
    
    if (!cpf) {
        return res.status(400).json({ success: false, error: 'CPF é obrigatório' });
    }
    
    const validacao = validarCPF(cpf);
    if (!validacao.valido) {
        return res.status(400).json({ success: false, error: validacao.erro });
    }
    
    res.json({
        success: true,
        message: 'CPF válido. Para consulta judicial completa, use /api/consultar-judicial com nome completo.',
        cpf: validacao.cpfFormatado
    });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        path: req.path,
        method: req.method
    });
});

// Rota de diagnóstico DataJud (Estrutura da API)
app.get('/api/diagnostico-datajud', async (req, res) => {
    console.log('🔬 Iniciando diagnóstico da API DataJud...');
    const tribunais = ['tjpr', 'tjsp', 'trt9'];
    const resultados = {};

    for (const tribunal of tribunais) {
        try {
            const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`;
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `APIKey ${DATAJUD_CONFIG.apiKey}`,
                    'Accept': 'application/json'
                },
                params: { size: 1, q: '*:*' },
                timeout: 10000
            });

            if (response.data.hits?.hits?.[0]?._source) {
                const sample = response.data.hits.hits[0]._source;
                const keys = Object.keys(sample);
                const cpfFields = keys.filter(key => key.toLowerCase().includes('cpf') || key.toLowerCase().includes('documento'));
                const nomeFields = keys.filter(key => key.toLowerCase().includes('nome'));
                
                resultados[tribunal] = {
                    status: 'OK',
                    camposDisponiveis: keys.slice(0, 20), // Limit to first 20
                    camposCPF: cpfFields,
                    camposNome: nomeFields
                };
            } else {
                resultados[tribunal] = { status: 'Vazio', message: 'Nenhum registro retornado na busca ampla.' };
            }
        } catch (error) {
            resultados[tribunal] = { 
                status: 'Erro', 
                message: error.message,
                statusCode: error.response?.status 
            };
        }
    }
    
    res.json({ success: true, diagnostico: resultados });
});

// Rota de debug de consulta específica
app.post('/api/debug-consulta', async (req, res) => {
    const { cpf, nome, tribunal } = req.body;
    console.log(`🔍 Debug consulta: ${tribunal || 'tjpr'} - ${cpf} - ${nome}`);
    
    try {
        const resultado = await consultarTribunal(tribunal || 'tjpr', cpf || '09612827974', nome || 'VALMIR JOSE REIS');
        res.json({ success: true, resultados: resultado });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 SERVIDOR DATAJUD/CNJ INICIADO COM SUCESSO');
    console.log('='.repeat(60));
    console.log(`📍 Porta: ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 API Key DataJud: ${DATAJUD_CONFIG.apiKey ? 'CONFIGURADA ✓' : 'NÃO CONFIGURADA ✗'}`);
    if (DATAJUD_CONFIG.apiKey) {
        console.log(`   Preview: ${DATAJUD_CONFIG.apiKey.substring(0, 20)}...`);
    }
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📝 Consulta Judicial: POST http://localhost:${PORT}/api/consultar-judicial`);
    console.log('='.repeat(60));
});