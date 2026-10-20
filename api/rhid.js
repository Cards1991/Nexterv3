const fs = require('fs');
const path = require('path');
const sessionFile = path.join(__dirname, '..', '.rhid_session.json');

const getStoredToken = () => {
    try {
        if (fs.existsSync(sessionFile)) {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            if (data.token && data.expiresAt > Date.now()) {
                return data.token;
            }
        }
    } catch (e) {}
    return null;
};

const saveStoredToken = (token) => {
    try {
        fs.writeFileSync(sessionFile, JSON.stringify({
            token,
            expiresAt: Date.now() + 60 * 60 * 1000
        }), 'utf8');
    } catch (e) {}
};

let cachedRhidToken = null;
let tokenExpiresAt = 0;
let cachedDevices = null;
let devicesExpiresAt = 0;

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

    if (typeof req.body === 'string') {
        try { req.body = JSON.parse(req.body); } catch(e) {}
    }
    const reqBody = req.body || {};
    const reqQuery = req.query || {};

    let action = (req.method === 'POST' ? reqBody.action : (reqQuery.action || reqBody.action));
    if (!action) {
        if (req.method === 'DELETE') action = 'deletePerson';
        else if (req.method === 'PATCH') action = 'patchPerson';
        else if (reqBody.action) action = reqBody.action;
        else if (reqQuery.action) action = reqQuery.action;
    }

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
        // Função auxiliar para Login com cache de sessão persistente para evitar Rate Limit (HTTP 429)
        const loginToRhid = async (forceRefresh = false) => {
            if (!forceRefresh) {
                const stored = getStoredToken();
                if (stored) {
                    cachedRhidToken = stored;
                    return stored;
                }
                if (cachedRhidToken && Date.now() < tokenExpiresAt) {
                    return cachedRhidToken;
                }
            }

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
                // Se der 429 e tivermos um token armazenado, tenta reutilizá-lo
                const fallbackToken = getStoredToken() || cachedRhidToken;
                if (fallbackToken && loginRes.status === 429) {
                    console.warn('[RHID API] Usando token em cache após 429 do login.');
                    return fallbackToken;
                }
                throw new Error(`Falha no login (HTTP ${loginRes.status}): ${errText}`);
            }

            const loginData = await loginRes.json();
            if (!loginData.accessToken) {
                throw new Error('Token não retornado pela API.');
            }

            cachedRhidToken = loginData.accessToken;
            tokenExpiresAt = Date.now() + 60 * 60 * 1000;
            saveStoredToken(cachedRhidToken);
            return cachedRhidToken;
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

                    // ENRIQUECIMENTO REAL-TIME: Se alguma pessoa (ex: Cargo de Confiança, Gerência ou Visitante sem escala CLT)
                    // tiver listAfdtManutencao vazia, busca as marcações físicas diretamente no AFD dos relógios REP da Control iD
                    const hasEmptyPunches = apurDataComb.some(item => !item.listAfdtManutencao || item.listAfdtManutencao.length === 0);
                    if (hasEmptyPunches) {
                        try {
                            if (!cachedDevices || Date.now() > devicesExpiresAt) {
                                const devRes = await fetch(`${RHID_API_BASE}/device?start=0&length=100`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (devRes.ok) {
                                    const devData = await devRes.json();
                                    cachedDevices = devData.records || [];
                                    devicesExpiresAt = Date.now() + 30 * 60 * 1000;
                                }
                            }

                            if (cachedDevices && cachedDevices.length > 0) {
                                const parseAfd = (text, devName) => {
                                    let clean = text;
                                    if (clean.startsWith('"') && clean.endsWith('"')) {
                                        try { clean = JSON.parse(clean); } catch(e) {}
                                    }
                                    const lines = clean.split(/\r?\n/);
                                    const punches = [];
                                    for (const line of lines) {
                                        // Registro Tipo 3 Portaria 1510 / Portaria 671:
                                        // 0-8: NSR | 9: Tipo '3' | 10-17: DDMMAAAA | 18-21: HHMM | 22-33: PIS
                                        if (line.length >= 34 && line.charAt(9) === '3') {
                                            const nsr = line.substring(0, 9);
                                            const dia = line.substring(10, 12);
                                            const mes = line.substring(12, 14);
                                            const ano = line.substring(14, 18);
                                            const hora = line.substring(18, 20);
                                            const min = line.substring(20, 22);
                                            const pis = line.substring(22, 34).replace(/^0+/, '');
                                            punches.push({
                                                nsr,
                                                date: `${ano}-${mes}-${dia}`,
                                                time: `${hora}:${min}`,
                                                pis,
                                                device: devName
                                            });
                                        }
                                    }
                                    return punches;
                                };

                                const afdPromises = cachedDevices.map(async (d) => {
                                    try {
                                        const url = `${RHID_API_BASE}/report/afd/download?idEquipamento=${d.id}&dataIni=${startDate}&dataFinal=${endDate}`;
                                        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                                        if (res.ok) {
                                            const txt = await res.text();
                                            return parseAfd(txt, d.name);
                                        }
                                    } catch(e) {}
                                    return [];
                                });

                                const afdResults = await Promise.all(afdPromises);
                                const allAfdPunches = afdResults.flat();

                                for (const item of apurDataComb) {
                                    if (!item.listAfdtManutencao || item.listAfdtManutencao.length === 0) {
                                        const itemPis = String(item.pis || '').replace(/\D/g, '').replace(/^0+/, '');
                                        const itemReg = String(item.registration || item.code || '').replace(/\D/g, '');

                                        const matched = allAfdPunches.filter(p => {
                                            const itemDate = item.date ? item.date.split('T')[0] : (item.dateTimeStr || '');
                                            const dateMatches = !itemDate || p.date === itemDate;
                                            const pisMatches = itemPis && p.pis === itemPis;
                                            const regMatches = itemReg && p.pis.includes(itemReg);
                                            return dateMatches && (pisMatches || regMatches);
                                        });

                                        // Deduplica marcações no mesmo minuto
                                        const uniquePunches = [];
                                        const seenTimes = new Set();
                                        for (const p of matched) {
                                            if (!seenTimes.has(p.time)) {
                                                seenTimes.add(p.time);
                                                uniquePunches.push(p);
                                            }
                                        }

                                        if (uniquePunches.length > 0) {
                                            item.listAfdtManutencao = uniquePunches.map(p => ({
                                                hora: p.time,
                                                strHora: p.time,
                                                dateTime: `${p.date}T${p.time}:00`,
                                                date: `${p.date}T00:00:00`,
                                                idDevice: p.device,
                                                origem: `Leitor REP (${p.device})`,
                                                idAfd: parseInt(p.nsr, 10),
                                                pis: p.pis
                                            }));
                                        }
                                    }
                                }
                            }
                        } catch (afdErr) {
                            console.warn('[RHID API] Aviso ao enriquecer com AFD dos relógios:', afdErr.message);
                        }
                    }

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
                    const personRes = await fetch(`${RHID_API_BASE}/person?start=0&length=100`, {
                        headers: { 
                            'Authorization': 'Bearer ' + token,
                            'Accept': 'application/json'
                        }
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

            case 'importAllRhidPersons':
                try {
                    const { mode } = req.body || {}; // 'active_only' (default), 'all' ou 'managers_only'
                    const token = await loginToRhid();
                    
                    let start = 0;
                    const length = 100;
                    let allPersons = [];
                    
                    // Busca paginada completa no endpoint person
                    while (true) {
                        const personRes = await fetch(`${RHID_API_BASE}/person?start=${start}&length=${length}`, {
                            headers: { 
                                'Authorization': 'Bearer ' + token,
                                'Accept': 'application/json'
                            }
                        });
                        if (!personRes.ok) break;
                        const personData = await personRes.json();
                        const records = personData.records || [];
                        if (records.length === 0) break;
                        allPersons.push(...records);
                        start += length;
                        const totalRecords = personData.totalRecords || personData.total || 0;
                        if (totalRecords > 0 && allPersons.length >= totalRecords) break;
                    }

                    // Formatação rica e segura dos cadastros
                    const formatted = allPersons.map(p => {
                        const cpfClean = p.cpf ? String(p.cpf).replace(/\D/g, '') : '';
                        const cpfPad = cpfClean ? cpfClean.padStart(11, '0') : '';
                        const cpfFmt = cpfPad ? cpfPad.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
                        const isManager = !p.admissionDate || p.registration === '17101991' || (p.name && (p.name.toUpperCase().includes('GERENTE') || p.name.toUpperCase().includes('DIRETOR') || p.name.toUpperCase().includes('COORDENADOR') || p.name.toUpperCase().includes('SUPERVISOR')));
                        const regStr = p.registration && String(p.registration).trim();
                        const codFinal = (regStr && regStr !== '0') ? regStr : (p.code && String(p.code) !== '0' ? String(p.code) : String(p.id));

                        return {
                            rhidPersonId: String(p.id),
                            nome: p.name ? p.name.trim() : 'Sem Nome',
                            codigo: codFinal,
                            codigoRep: p.pis ? String(p.pis).replace(/\D/g, '') : '',
                            cpf: cpfFmt,
                            cpfLimpo: cpfPad || cpfClean,
                            categoria: isManager ? 'Cargo de Confiança / Gerência' : 'Colaborador / RHiD',
                            horarioInicio: '08:00',
                            horarioFim: '18:00',
                            horarioPrevisto: '08:00 às 18:00',
                            status: p.status === 0 ? 'Ativo' : 'Inativo',
                            statusRhid: p.status, // 0 = Ativo, 1 = Inativo
                            empresa: 'Calçados Crival',
                            temAdmissaoClt: !!p.admissionDate,
                            dataAdmissao: p.admissionDate || null,
                            isManager: isManager
                        };
                    });

                    let filtered = formatted;
                    if (mode === 'managers_only') {
                        filtered = formatted.filter(p => p.isManager || !p.temAdmissaoClt);
                    } else if (mode === 'all') {
                        filtered = formatted;
                    } else {
                        // Modo padrão: active_only (todos com status ativo no RHiD)
                        filtered = formatted.filter(p => p.statusRhid === 0);
                    }

                    return res.status(200).json({
                        success: true,
                        count: filtered.length,
                        totalDisponiveis: formatted.length,
                        totalAtivos: formatted.filter(p => p.statusRhid === 0).length,
                        data: filtered
                    });
                } catch (impErr) {
                    console.error('[RHID API] Erro ao importar pessoas do RHiD:', impErr);
                    return res.status(500).json({ success: false, message: 'Erro ao importar cadastros do RHiD.', details: impErr.message });
                }

            case 'deletePerson':
                try {
                    let { id, idPerson, rhidPersonId, ids, idPersons, cpf, registration, code, query } = reqBody;
                    if (!id && !idPerson && !rhidPersonId && !cpf && !query && reqQuery) {
                        id = reqQuery.id || reqQuery.idPerson || reqQuery.rhidPersonId;
                        cpf = reqQuery.cpf;
                        query = reqQuery.query;
                    }

                    const token = await loginToRhid();

                    // 1. Coleta lista de IDs alvos
                    let targetIds = [];
                    if (Array.isArray(ids) && ids.length > 0) targetIds.push(...ids);
                    if (Array.isArray(idPersons) && idPersons.length > 0) targetIds.push(...idPersons);
                    
                    const singleId = id || idPerson || rhidPersonId;
                    if (singleId && !targetIds.includes(singleId)) {
                        targetIds.push(singleId);
                    }

                    // 2. Se nenhum ID direto foi informado, usa a lógica de busca/matching por CPF, matrícula ou query
                    if (targetIds.length === 0 && (cpf || registration || code || query)) {
                        const termoBusca = cpf || registration || code || query;
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
                                const cd = String(p.code !== undefined ? p.code : '').replace(/\D/g, '');
                                const name = String(p.name || '').toLowerCase();
                                
                                let matchCpf = false;
                                if (qClean && cpfRaw) {
                                    if (qClean.length >= 10) {
                                        matchCpf = (cpfPad === qCleanPad || cpfNoZeros === qCleanNoZeros);
                                    } else {
                                        matchCpf = cpfRaw.includes(qClean) || cpfPad.includes(qClean);
                                    }
                                }
                                const matchReg = qClean && reg && (reg === qClean || reg.includes(qClean));
                                const matchCode = qClean && cd && (cd === qClean || cd.includes(qClean));
                                const matchName = qLower && name.includes(qLower);

                                return matchCpf || matchReg || matchCode || matchName;
                            });

                            if (matches.length > 0) {
                                targetIds = matches.map(m => m.id);
                            }
                        }
                    }

                    if (targetIds.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Nenhum ID de colaborador ou identificador válido (CPF/matrícula) encontrado para exclusão.'
                        });
                    }

                    // 3. Executa a exclusão de cada ID no endpoint DELETE /person/{id}
                    const deleteResults = [];
                    for (const rawId of targetIds) {
                        const personId = parseInt(rawId, 10);
                        if (isNaN(personId)) {
                            deleteResults.push({ id: rawId, success: false, message: 'ID numérico inválido' });
                            continue;
                        }

                        const delRes = await fetch(`${RHID_API_BASE}/person/${personId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        const resText = await delRes.text();
                        if (delRes.ok || delRes.status === 200 || delRes.status === 204) {
                            deleteResults.push({ id: personId, success: true, message: 'Excluído com sucesso da nuvem RHiD' });
                        } else {
                            deleteResults.push({ 
                                id: personId, 
                                success: false, 
                                status: delRes.status, 
                                message: resText || 'Erro ao excluir da nuvem RHiD' 
                            });
                        }
                    }

                    const anySuccess = deleteResults.some(r => r.success);
                    const totalSucesso = deleteResults.filter(r => r.success).length;

                    return res.status(anySuccess ? 200 : 400).json({
                        success: anySuccess,
                        message: anySuccess 
                            ? `Exclusão processada no RHiD com sucesso (${totalSucesso}/${deleteResults.length} excluído(s)).` 
                            : 'Não foi possível excluir o colaborador na nuvem RHiD.',
                        totalSucesso,
                        totalSolicitado: deleteResults.length,
                        results: deleteResults
                    });

                } catch (delErr) {
                    console.error('[RHID API] Erro ao excluir pessoa:', delErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Erro interno ao excluir pessoa no RHiD.',
                        details: delErr.message
                    });
                }

            case 'patchPerson':
                try {
                    let { listPerson, person } = reqBody;
                    const token = await loginToRhid();

                    // Se enviou person individual em vez de listPerson
                    let itemsToPatch = [];
                    if (Array.isArray(listPerson)) {
                        itemsToPatch = [...listPerson];
                    } else if (person && typeof person === 'object') {
                        itemsToPatch = [person];
                    } else if (reqBody && (reqBody.id || reqBody.rhidPersonId || reqBody.cpf || reqBody.nome || reqBody.name)) {
                        itemsToPatch = [{ ...reqBody }];
                    }

                    if (itemsToPatch.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Nenhum dado de pessoa informado para atualização (PATCH).'
                        });
                    }

                    // Se algum item não tiver ID numérico mas tiver CPF ou matrícula, auto-resolve usando a mesma busca
                    let fullPersonListCache = null;
                    for (const item of itemsToPatch) {
                        if (!item.id && (item.rhidPersonId || item.idPerson)) {
                            item.id = parseInt(item.rhidPersonId || item.idPerson, 10);
                        }

                        if (!item.id && (item.cpf || item.registration || item.code || item.query || item.nome)) {
                            if (!fullPersonListCache) {
                                const pRes = await fetch(`${RHID_API_BASE}/person`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (pRes.ok) {
                                    const pData = await pRes.json();
                                    fullPersonListCache = pData.records || [];
                                } else {
                                    fullPersonListCache = [];
                                }
                            }

                            const termo = item.cpf || item.registration || item.code || item.query || item.nome;
                            const qClean = String(termo).replace(/\D/g, '');
                            const qCleanPad = qClean ? qClean.padStart(11, '0') : '';
                            const qCleanNoZeros = qClean ? qClean.replace(/^0+/, '') : '';
                            const qLower = String(termo).toLowerCase().trim();

                            const match = fullPersonListCache.find(p => {
                                const cpfRaw = String(p.cpf || '').replace(/\D/g, '');
                                const cpfPad = cpfRaw ? cpfRaw.padStart(11, '0') : '';
                                const cpfNoZeros = cpfRaw ? cpfRaw.replace(/^0+/, '') : '';
                                const reg = String(p.registration || '').replace(/\D/g, '');
                                const cd = String(p.code !== undefined ? p.code : '').replace(/\D/g, '');
                                const name = String(p.name || '').toLowerCase();

                                let matchCpf = false;
                                if (qClean && cpfRaw) {
                                    if (qClean.length >= 10) {
                                        matchCpf = (cpfPad === qCleanPad || cpfNoZeros === qCleanNoZeros);
                                    } else {
                                        matchCpf = cpfRaw.includes(qClean) || cpfPad.includes(qClean);
                                    }
                                }
                                const matchReg = qClean && reg && (reg === qClean || reg.includes(qClean));
                                const matchCode = qClean && cd && (cd === qClean || cd.includes(qClean));
                                const matchName = qLower && name.includes(qLower);

                                return matchCpf || matchReg || matchCode || matchName;
                            });

                            if (match) {
                                item.id = match.id;
                            }
                        }
                    }

                    // Sanitização e formatação estrita conforme PersonDTO da API RHiD
                    const sanitizedList = itemsToPatch
                        .filter(item => item && item.id && !isNaN(parseInt(item.id, 10)))
                        .map(item => {
                            const dto = {
                                id: parseInt(item.id, 10)
                            };

                            if (item.name !== undefined && item.name !== null) {
                                dto.name = String(item.name).trim();
                            } else if (item.nome !== undefined && item.nome !== null) {
                                dto.name = String(item.nome).trim();
                            }

                            if (item.cpf !== undefined && item.cpf !== null && item.cpf !== '') {
                                const cpfDigits = String(item.cpf).replace(/\D/g, '');
                                if (cpfDigits) dto.cpf = parseInt(cpfDigits, 10);
                            }

                            if (item.pis !== undefined && item.pis !== null && item.pis !== '') {
                                const pisDigits = String(item.pis).replace(/\D/g, '');
                                if (pisDigits) dto.pis = parseInt(pisDigits, 10);
                            } else if (item.codigoRep !== undefined && item.codigoRep !== null && item.codigoRep !== '') {
                                const pisDigits = String(item.codigoRep).replace(/\D/g, '');
                                if (pisDigits) dto.pis = parseInt(pisDigits, 10);
                            }

                            if (item.registration !== undefined && item.registration !== null) {
                                dto.registration = String(item.registration).trim();
                            } else if (item.codigo !== undefined && item.codigo !== null) {
                                dto.registration = String(item.codigo).trim();
                            }

                            if (item.code !== undefined && item.code !== null && item.code !== '') {
                                const cdNum = parseInt(String(item.code).replace(/\D/g, ''), 10);
                                if (!isNaN(cdNum)) dto.code = cdNum;
                            }

                            if (item.status !== undefined && item.status !== null) {
                                if (typeof item.status === 'string') {
                                    dto.status = (item.status.toLowerCase() === 'ativo' || item.status.toLowerCase() === 'active') ? 0 : 1;
                                } else {
                                    dto.status = parseInt(item.status, 10);
                                }
                            }

                            if (item.admissionDate !== undefined) {
                                dto.admissionDate = item.admissionDate || null;
                            }

                            if (item.idDepartment !== undefined && item.idDepartment !== null) {
                                dto.idDepartment = parseInt(item.idDepartment, 10);
                            }

                            if (item.idCompany !== undefined && item.idCompany !== null) {
                                dto.idCompany = parseInt(item.idCompany, 10);
                            }

                            if (item.rfid !== undefined && item.rfid !== null) {
                                dto.rfid = parseInt(item.rfid, 10);
                            }

                            if (item.barCode !== undefined && item.barCode !== null) {
                                dto.barCode = parseInt(item.barCode, 10);
                            }

                            if (item.isAdmin !== undefined && item.isAdmin !== null) {
                                dto.isAdmin = !!item.isAdmin;
                            }

                            if (item.photo !== undefined) {
                                dto.photo = item.photo;
                            }

                            return dto;
                        });

                    if (sanitizedList.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Nenhum registro continha um ID válido após resolução para envio do PATCH no RHiD.'
                        });
                    }

                    // A API do RHiD permite até 100 itens por lote no PATCH /person
                    const CHUNK_SIZE = 100;
                    const patchResponses = [];

                    for (let i = 0; i < sanitizedList.length; i += CHUNK_SIZE) {
                        const chunk = sanitizedList.slice(i, i + CHUNK_SIZE);
                        const patchRes = await fetch(`${RHID_API_BASE}/person`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(chunk)
                        });

                        const patchText = await patchRes.text();
                        if (patchRes.ok || patchRes.status === 200) {
                            patchResponses.push({ success: true, count: chunk.length, chunk });
                        } else {
                            patchResponses.push({ success: false, status: patchRes.status, message: patchText, chunk });
                        }
                    }

                    const anySuccess = patchResponses.some(r => r.success);
                    const totalUpdated = patchResponses.filter(r => r.success).reduce((acc, r) => acc + r.count, 0);

                    return res.status(anySuccess ? 200 : 400).json({
                        success: anySuccess,
                        message: anySuccess 
                            ? `Pessoa(s) atualizada(s) com sucesso no RHiD (${totalUpdated} alterada(s)).` 
                            : 'Falha ao atualizar pessoa(s) no RHiD.',
                        totalUpdated,
                        data: sanitizedList,
                        details: patchResponses
                    });

                } catch (patchErr) {
                    console.error('[RHID API] Erro no PATCH person:', patchErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Erro interno ao processar PATCH de pessoa(s) no RHiD.',
                        details: patchErr.message
                    });
                }

            default:
                return res.status(404).json({ success: false, message: 'Ação desconhecida.' });
        }

    } catch (error) {
        console.error('[RHID API] Erro na função serverless:', error);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.', details: error.message });
    }
};
