try { require('dotenv').config(); } catch (e) {}

module.exports = async function handler(req, res) {
    // Configuração de CORS
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

    const { action } = req.method === 'POST' ? req.body : req.query;

    if (!action) {
        return res.status(400).json({ success: false, message: 'Ação não especificada.' });
    }

    // Lê os Secrets do ambiente Vercel (ou arquivo .env local)
    const RHID_EMAIL = process.env.RHID_EMAIL;
    const RHID_PASSWORD = process.env.RHID_PASSWORD;
    const RHID_DOMAIN = process.env.RHID_DOMAIN || 'crival';
    const RHID_SYSTEM = process.env.RHID_SYSTEM || 'rhid';

    if (!RHID_EMAIL || !RHID_PASSWORD) {
        return res.status(500).json({ 
            success: false, 
            message: 'Variáveis de ambiente do RHiD não configuradas no servidor.' 
        });
    }

    const RHID_API_BASE = 'https://rhid.com.br/v2/api.svc';

    try {
        // Função auxiliar para Login
        const loginToRhid = async () => {
            const loginRes = await fetch(`${RHID_API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: RHID_EMAIL,
                    password: RHID_PASSWORD,
                    domain: RHID_DOMAIN,
                    system: RHID_SYSTEM
                })
            });

            if (!loginRes.ok) {
                const errText = await loginRes.text();
                throw new Error(`Falha no login (HTTP ${loginRes.status}): ${errText}`);
            }

            const loginData = await loginRes.json();
            if (!loginData.accessToken) {
                throw new Error('Token não retornado pela API.');
            }
            return loginData.accessToken;
        };

        // Roteador de Ações
        switch (action) {
            case 'testConnection':
                try {
                    await loginToRhid();
                    return res.status(200).json({ 
                        success: true, 
                        message: 'Conexão com RHiD realizada com sucesso.' 
                    });
                } catch (connError) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Não foi possível conectar ao RHiD.', 
                        details: connError.message 
                    });
                }

            case 'syncEmployees':
                try {
                    const token = await loginToRhid();
                    
                    // Inicializa array para armazenar todos os funcionários
                    let allEmployees = [];
                    let skip = 0;
                    const limit = 100; // Máximo permitido costuma ser 100 por requisição
                    let hasMore = true;
                    let pageCount = 0;
                    const seenIds = new Set();

                    while (hasMore && pageCount < 50) {
                        pageCount++;
                        const personRes = await fetch(`${RHID_API_BASE}/person?skip=${skip}&limit=${limit}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (!personRes.ok) {
                            const errText = await personRes.text();
                            throw new Error(`Falha ao buscar funcionários (HTTP ${personRes.status}): ${errText}`);
                        }

                        // Tratar como texto JSON bruto.
                        const personData = await personRes.json();
                        
                        // Assumindo que RHiD retorna { records: [...] }
                        const personsBatch = personData.records || personData.persons || personData.data || personData || [];
                        
                        if (!Array.isArray(personsBatch)) {
                             throw new Error('A resposta da API do RHiD não está no formato de array esperado.');
                        }

                        let fetchedNew = false;
                        for (const p of personsBatch) {
                            if (!seenIds.has(p.id)) {
                                seenIds.add(p.id);
                                allEmployees.push(p);
                                fetchedNew = true;
                            }
                        }

                        // Se não retornou nenhum registro novo nesta página, significa que a paginação travou ou acabou
                        if (!fetchedNew) {
                            hasMore = false;
                            break;
                        }

                        skip += limit;
                        
                        // Se a quantidade retornada for menor que o limite, não há mais páginas
                        if (personsBatch.length < limit) {
                            hasMore = false;
                        }
                    }

                    return res.status(200).json({ 
                        success: true, 
                        message: `Sincronização concluída. ${allEmployees.length} funcionários encontrados.`,
                        data: allEmployees
                    });

                } catch (syncError) {
                    console.error('[RHID API] Erro ao sincronizar:', syncError);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Erro ao buscar funcionários no RHiD.', 
                        details: syncError.message 
                    });
                }

            case 'syncApuration':
                try {
                    // Agora recebe um array de idPersons ou CPF/query direto
                    let { startDate, endDate, idPersons, cpf, query } = req.body;
                    if (!startDate || !endDate) {
                        return res.status(400).json({ success: false, message: 'Data de início e fim são obrigatórias.' });
                    }

                    const token = await loginToRhid();

                    // Se não passou idPersons mas passou CPF ou query, tenta resolver o ID automaticamente
                    if ((!idPersons || !Array.isArray(idPersons) || idPersons.length === 0) && (cpf || query)) {
                        const termoBusca = cpf || query;
                        const personRes = await fetch(`${RHID_API_BASE}/person`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (personRes.ok) {
                            const personData = await personRes.json();
                            const list = personData.records || [];
                            const qClean = String(termoBusca).replace(/\D/g, '');
                            const qCleanPad = qClean ? qClean.padStart(11, '0') : '';
                            const qCleanNoZeros = qClean ? qClean.replace(/^0+/, '') : '';
                            const qLower = String(termoBusca).toLowerCase().trim();

                            const matches = list.filter(p => {
                                const cpfRaw = String(p.cpf || '').replace(/\D/g, '');
                                const cpfPad = cpfRaw ? cpfRaw.padStart(11, '0') : '';
                                const cpfNoZeros = cpfRaw ? cpfRaw.replace(/^0+/, '') : '';
                                const reg = String(p.registration || '').replace(/\D/g, '');
                                const code = String(p.code !== undefined ? p.code : '').replace(/\D/g, '');
                                const name = String(p.name || '').toLowerCase();
                                
                                let matchCpf = false;
                                if (qClean && cpfRaw) {
                                    if (qClean.length >= 10) {
                                        matchCpf = (cpfPad === qCleanPad || cpfNoZeros === qCleanNoZeros);
                                    } else {
                                        matchCpf = cpfRaw.includes(qClean) || cpfPad.includes(qClean);
                                    }
                                }

                                let matchReg = false;
                                if (qClean && reg) {
                                    matchReg = (reg === qClean || reg.includes(qClean));
                                }

                                let matchCode = false;
                                if (qClean && code) {
                                    matchCode = (code === qClean || code.includes(qClean));
                                }

                                const matchName = qLower && name.includes(qLower);

                                return matchCpf || matchReg || matchCode || matchName;
                            });

                            if (matches.length > 0) {
                                idPersons = matches.map(m => m.id);
                            }
                        }
                    }
                    
                    // Se ainda não tiver idPersons, retorna erro amigável
                    if (!idPersons || !Array.isArray(idPersons) || idPersons.length === 0) {
                        return res.status(400).json({ 
                            success: false, 
                            message: 'Nenhum funcionário ou visitante encontrado para apuração. Verifique o CPF ou selecione um visitante.' 
                        });
                    }

                    // Faz chamadas concorrentes para o RHiD usando Promise.all
                    let apurDataComb = [];
                    const fetchPromises = idPersons.map(async (idPerson) => {
                        const endpoint = `${RHID_API_BASE}/apuracao_ponto?dataIni=${startDate}&dataFinal=${endDate}&idPerson=${idPerson}`;
                        const apurRes = await fetch(endpoint, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (apurRes.ok) {
                            const data = await apurRes.json();
                            // Se vier string jsonificada (como o Control iD costuma mandar em apuracao_ponto)
                            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                            return parsedData;
                        } else {
                            console.warn(`[RHID] Erro ao buscar pessoa ${idPerson}: ${apurRes.status}`);
                            return []; // Retorna vazio se der erro pra essa pessoa
                        }
                    });

                    const results = await Promise.all(fetchPromises);
                    
                    // results é um array de arrays (um array para cada pessoa). Vamos juntar tudo (flat)
                    apurDataComb = results.flat();

                    return res.status(200).json({ 
                        success: true, 
                        message: `Apuração recebida com sucesso.`,
                        data: apurDataComb,
                        rawData: apurDataComb // Mantendo para compatibilidade
                    });

                } catch (apurError) {
                    console.error('[RHID API] Erro na apuração:', apurError);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Erro interno ao buscar apuração.', 
                        details: apurError.message 
                    });
                }

            case 'findPerson':
                try {
                    const { query } = req.body;
                    if (!query) {
                        return res.status(400).json({ success: false, message: 'Termo de busca obrigatório.' });
                    }
                    const token = await loginToRhid();
                    const personRes = await fetch(`${RHID_API_BASE}/person`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const personData = await personRes.json();
                    const list = personData.records || [];
                    
                    const qClean = String(query).replace(/\D/g, '');
                    const qCleanPad = qClean ? qClean.padStart(11, '0') : '';
                    const qCleanNoZeros = qClean ? qClean.replace(/^0+/, '') : '';
                    const qLower = String(query).toLowerCase().trim();

                    const matches = list.filter(p => {
                        const cpfRaw = String(p.cpf || '').replace(/\D/g, '');
                        const cpfPad = cpfRaw ? cpfRaw.padStart(11, '0') : '';
                        const cpfNoZeros = cpfRaw ? cpfRaw.replace(/^0+/, '') : '';
                        const reg = String(p.registration || '').replace(/\D/g, '');
                        const code = String(p.code !== undefined ? p.code : '').replace(/\D/g, '');
                        const name = String(p.name || '').toLowerCase();
                        const pis = String(p.pis || '').replace(/\D/g, '');
                        
                        let matchCpf = false;
                        if (qClean && cpfRaw) {
                            if (qClean.length >= 10) {
                                matchCpf = (cpfPad === qCleanPad || cpfNoZeros === qCleanNoZeros);
                            } else {
                                matchCpf = cpfRaw.includes(qClean) || cpfPad.includes(qClean);
                            }
                        }

                        let matchReg = false;
                        if (qClean && reg) {
                            matchReg = (reg === qClean || reg.includes(qClean));
                        }

                        let matchCode = false;
                        if (qClean && code) {
                            matchCode = (code === qClean || code.includes(qClean));
                        }

                        const matchPis = qClean && pis && (pis === qClean || pis.includes(qClean));
                        const matchName = qLower && name.includes(qLower);

                        return matchCpf || matchReg || matchCode || matchPis || matchName;
                    });

                    // Adiciona formatação do CPF para conveniência do frontend
                    matches.forEach(p => {
                        if (p.cpf) {
                            const cpfPad = String(p.cpf).replace(/\D/g, '').padStart(11, '0');
                            p.cpfFormatted = cpfPad.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                        }
                    });

                    return res.status(200).json({
                        success: true,
                        count: matches.length,
                        data: matches
                    });
                } catch (findErr) {
                    console.error('[RHID API] Erro ao buscar pessoa:', findErr);
                    return res.status(500).json({ success: false, message: 'Erro na busca de pessoa.', details: findErr.message });
                }

            case 'syncVisitors':
                try {
                    const token = await loginToRhid();
                    const personRes = await fetch(`${RHID_API_BASE}/person`, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const personData = await personRes.json();
                    const list = personData.records || [];

                    // Visitantes são tipicamente pessoas com data de admissão nula, código/matrícula de crachá temporário, ou nome de visitante
                    const visitors = list.filter(p => {
                        const hasNoAdmission = !p.admissionDate;
                        const hasRegistration = p.registration && String(p.registration).trim().length > 0;
                        const nameHasVisitor = p.name && p.name.toUpperCase().includes('VISITANTE');
                        const isKnownCode = p.registration === '17101991' || String(p.code) === '17101991';
                        return isKnownCode || hasNoAdmission || hasRegistration || nameHasVisitor;
                    });

                    return res.status(200).json({
                        success: true,
                        count: visitors.length,
                        data: visitors
                    });
                } catch (vErr) {
                    console.error('[RHID API] Erro ao sincronizar visitantes:', vErr);
                    return res.status(500).json({ success: false, message: 'Erro ao buscar visitantes.', details: vErr.message });
                }
                
            default:
                return res.status(404).json({ success: false, message: 'Ação desconhecida.' });
        }

    } catch (error) {
        console.error('[RHID API] Erro na função serverless:', error);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.', details: error.message });
    }
};
