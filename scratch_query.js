const fetch = require('node-fetch');
async function run() {
    require('dotenv').config();
    const RHID_EMAIL = process.env.RHID_EMAIL;
    const RHID_PASSWORD = process.env.RHID_PASSWORD;
    const RHID_DOMAIN = process.env.RHID_DOMAIN || 'crival';
    const RHID_SYSTEM = process.env.RHID_SYSTEM || 'rhid';
    
    if (!RHID_EMAIL) return console.error("NO ENV VARS");
    const RHID_API_BASE = 'https://rhid.com.br/v2/api.svc';

    try {
        const loginRes = await fetch(`${RHID_API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: RHID_EMAIL, password: RHID_PASSWORD, domain: RHID_DOMAIN, system: RHID_SYSTEM })
        });
        const loginData = await loginRes.json();
        const token = loginData.accessToken;
        
        let foundPerson = null;
        let skip = 0;
        let hasMore = true;
        const targetCpf = '69656312953';

        while(hasMore && skip < 5000) { // increased limit to 5000
            const personRes = await fetch(`${RHID_API_BASE}/person?skip=${skip}&limit=100`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!personRes.ok) break;
            const personData = await personRes.json();
            const personsBatch = personData.records || personData.persons || personData.data || personData || [];
            if (!personsBatch || personsBatch.length === 0) break;
            
            // EXACT MATCH FOR CPF
            const p = personsBatch.find(p => p.cpf && String(p.cpf).replace(/\D/g, '').padStart(11, '0') === targetCpf.padStart(11, '0'));
            if (p) {
                foundPerson = p;
                break;
            }
            skip += 100;
        }

        if (!foundPerson) {
             console.log("Pessoa com CPF " + targetCpf + " não encontrada na base do RHiD (buscou até " + skip + " registros).");
             return;
        }

        console.log("================== PERSON ==================");
        console.log(JSON.stringify(foundPerson, null, 2));

        const hojeObj = new Date();
        const y = hojeObj.getFullYear();
        const m = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const d = String(hojeObj.getDate()).padStart(2, '0');
        const hoje = `${y}-${m}-${d}`;
        // Try to fetch apuracao
        const endpoint = `${RHID_API_BASE}/apuracao_ponto?dataIni=${hoje}&dataFinal=${hoje}&idPerson=${foundPerson.id}`;
        const apurRes = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        let data = await apurRes.text();
        console.log("================== APURACAO RAW (HOJE) ==================");
        try {
            const jsonApuracao = JSON.parse(data);
            console.log(JSON.stringify(jsonApuracao, null, 2));
        } catch(e) {
            console.log(data);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}
run();
