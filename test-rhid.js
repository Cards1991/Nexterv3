const fetch = require('node-fetch'); // May not be needed in Node 22, global fetch is available

async function run() {
    require('dotenv').config();
    const RHID_EMAIL = process.env.RHID_EMAIL;
    const RHID_PASSWORD = process.env.RHID_PASSWORD;
    const RHID_DOMAIN = process.env.RHID_DOMAIN || 'crival';
    const RHID_SYSTEM = process.env.RHID_SYSTEM || 'rhid';
    
    if (!RHID_EMAIL) {
        console.error("NO ENV VARS");
        return;
    }

    const RHID_API_BASE = 'https://rhid.com.br/v2/api.svc';

    try {
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
        
        const loginData = await loginRes.json();
        const token = loginData.accessToken;
        
        console.log("Logged in. Token:", token ? "OK" : "NO");

        // get the person id for cpf 10106266985
        // Wait, I don't know the person id. Let me fetch by name or fetch apuracao directly if we know id
        // The user didn't give idPerson. I can query /person for all and find the CPF!
        
        const personRes = await fetch(`${RHID_API_BASE}/person?skip=0&limit=1000`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const personData = await personRes.json();
        const persons = personData.records || personData.persons || personData.data || personData || [];
        
        let targetPerson = null;
        for (const p of persons) {
            if (p.cpf && String(p.cpf).replace(/\D/g, '') === '10106266985') {
                targetPerson = p;
                break;
            }
        }
        
        if (!targetPerson) {
            console.error("CPF 10106266985 not found in RHiD!");
            return;
        }
        
        console.log("Found person id:", targetPerson.id);
        
        // Fetch apuracao
        const hojeObj = new Date();
        const y = hojeObj.getFullYear();
        const m = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const d = String(hojeObj.getDate()).padStart(2, '0');
        const hoje = `${y}-${m}-${d}`;
        
        const endpoint = `${RHID_API_BASE}/apuracao_ponto?dataIni=${hoje}&dataFinal=${hoje}&idPerson=${targetPerson.id}`;
        const apurRes = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        let data = await apurRes.json();
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        
        console.log("================== APURACAO RAW ==================");
        console.log(JSON.stringify(parsedData, null, 2));
        
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
