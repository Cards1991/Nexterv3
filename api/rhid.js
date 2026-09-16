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

                    while (hasMore) {
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

                        // O RHiD costuma retornar um array de objetos ou objeto com array dependendo da versão.
                        // Tratar como texto JSON bruto.
                        const personData = await personRes.json();
                        
                        // Assumindo que RHiD retorna { records: [...] }
                        const personsBatch = personData.records || personData.persons || personData.data || personData || [];
                        
                        if (!Array.isArray(personsBatch)) {
                             throw new Error('A resposta da API do RHiD não está no formato de array esperado.');
                        }

                        if (personsBatch.length > 0) {
                            allEmployees = allEmployees.concat(personsBatch);
                            skip += limit;
                        } else {
                            hasMore = false;
                        }
                        
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
                
            default:
                return res.status(404).json({ success: false, message: 'Ação desconhecida.' });
        }

    } catch (error) {
        console.error('[RHID API] Erro na função serverless:', error);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor.', details: error.message });
    }
};
