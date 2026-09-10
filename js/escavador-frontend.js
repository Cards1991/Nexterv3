window.frontendEscavadorSearch = async function(cpf, nome, mode = 'AUTO') {
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMWFkZGU3OWNjOGQ3OTlhNjc2MzE0ZmI1ZjdkZGZmY2VmMDliZmI0YjhjZDRlNDRlNWY2NmEwMzM3YmM1MTAwMjViZWJhNDA5M2FjNjQ4MjMiLCJpYXQiOjE3ODgzNzI2NDEuNTM3MzU4LCJuYmYiOjE3ODgzNzI2NDEuNTM3MzYsImV4cCI6MTgxOTk0MDM5OS41MzU4OTgsInN1YiI6IjQxMjQzNzYiLCJzY29wZXMiOlsiYWNlc3Nhcl9hcGlfcGFnYSIsImFjZXNzYXJfYXBpX3BsYXlncm91bmQiXX0.Tv1aXtEQBEX_WSESRPoA7lTHzGA8evUkLP_jVCOxrgqWsqMKJZ2Q_eVm2LTck_d4-HEjWhzMkvwe329wYaSCM0vOZPQl8UoMosQ5tWNXSnru4H0neD2XnBfDALyXx6ZP-aZRxyrEz2EL0iFINR_pYZOHcYNrqkgMWW8HUlxiI3_aMevRCZ3dOslDvtw0c3ZaucZ3Im2LztAoegFWNId686EFRNmWm6NdLkQwKr3-HuKOBxp5i8RpIAtvANyCyjSysqyIvM8Vf3DUGCOhEEu4S0uNJ7qbY350TVHyBZfYcgFT2WGasVJSho3XfVWJWrYPxNma9sEJuaLIy3fx1FXCacSOS5FIWG5DRsVEQtUJG74iTzWMJ6FG20NJeBREMsU2K-zTCNM85POtt0qj2cKZky_ENDtBL4WfDnHMjVQRMCIwTW8uV2hbkY122fSwUjAZfNtbyHtfLfJXtWvKJqkOoXxY8fWQrVzw7N--HmxeykARPgheT2Cbj9IW5eV-KiBzFZfBuBdzEMco5AWugPsRgAtZQ6bUszz3fNUL1AA7pCm7wmFXjmeZTNpE9Seu_j1DjfFMWxmWdOFCB1psZN3IwPm6JOl7pqZzCeZZtzH5mWthDIvWvnoN1uRnOQ6vmt5tGSKKXh4rEUet8lH8roYf5QFHPIQcPMnDzMt3uczd8mk";
    
    cpf = cpf.replace(/\D/g, '');
    let nomeNorm = nome ? nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ') : '';
    
    let url = `https://api.escavador.com/api/v2/envolvido/processos?async=0`;
    if (mode === 'NAME_ONLY' && nomeNorm) {
        url += `&nome=${encodeURIComponent(nomeNorm)}`;
    } else {
        url += `&cpf_cnpj=${cpf}`;
        if (mode === 'HOMONIMOS_ONLY') {
            url += `&incluir_homonimos=1`;
        } else {
            url += `&incluir_homonimos=0`;
        }
    }
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            return { status: 'API_ERROR', message: 'Erro na API do Escavador (' + response.status + ')' };
        }

        const data = await response.json();
        
        let allItems = [];
        if (data.items && data.items.length > 0) {
            allItems = data.items;
        }

        if (allItems.length === 0) {
            return { status: 'SUCCESS_NO_RESULTS' };
        }

        let summary = { total: allItems.length, confirmed: 0, highConfidence: 0, possible: 0, homonyms: 0 };
        let processedItems = [];

        allItems.forEach(proc => {
            let score = 50;
            let matchReason = proc.match_documento_por || 'MATCH_APENAS_NOMINAL';

            if (matchReason === 'DOCUMENTO_TRIBUNAL') score += 100;
            else if (matchReason === 'DOCUMENTO_TRIBUNAL_OUTRA_FONTE') score += 98;
            else if (matchReason === 'NOME_EXATO_UNICO') score += 95;
            else if (matchReason === 'NOME_EXATO_MUNICIPIO') score += 92;
            else if (matchReason === 'NOME_EXATO_ESTADO') score += 90;
            else if (matchReason === 'MESMO_ADVOGADO_OUTRO_PROCESSO') score += 88;

            const nomeNormProc = proc.titulo_polo_ativo?.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (nomeNormProc && nomeNorm && nomeNormProc.includes(nomeNorm)) score += 10;
            if (score > 100) score = 100;

            let classificacao = 'HOMONIMO_BAIXA_CONFIANCA';
            let badgeText = 'Possível homônimo';

            if (score >= 95) { classificacao = 'CONFIRMADO'; badgeText = 'CPF confirmado'; summary.confirmed++; }
            else if (score >= 80) { classificacao = 'ALTA_PROBABILIDADE'; badgeText = 'Alta correspondência'; summary.highConfidence++; }
            else if (score >= 60) { classificacao = 'POSSIVEL_CORRESPONDENCIA'; badgeText = 'Verificar identidade'; summary.possible++; }
            else { summary.homonyms++; }

            processedItems.push({
                ...proc,
                score,
                classificacao,
                badgeText
            });
        });

        processedItems.sort((a, b) => b.score - a.score);

        return {
            status: 'SUCCESS_WITH_RESULTS',
            summary,
            processes: processedItems
        };

    } catch (e) {
        console.error("Frontend Escavador Fetch Error:", e);
        return { status: 'API_ERROR', message: e.message };
    }
};

window.frontendEscavadorReceitaSearch = async function(cpf) {
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMWFkZGU3OWNjOGQ3OTlhNjc2MzE0ZmI1ZjdkZGZmY2VmMDliZmI0YjhjZDRlNDRlNWY2NmEwMzM3YmM1MTAwMjViZWJhNDA5M2FjNjQ4MjMiLCJpYXQiOjE3ODgzNzI2NDEuNTM3MzU4LCJuYmYiOjE3ODgzNzI2NDEuNTM3MzYsImV4cCI6MTgxOTk0MDM5OS41MzU4OTgsInN1YiI6IjQxMjQzNzYiLCJzY29wZXMiOlsiYWNlc3Nhcl9hcGlfcGFnYSIsImFjZXNzYXJfYXBpX3BsYXlncm91bmQiXX0.Tv1aXtEQBEX_WSESRPoA7lTHzGA8evUkLP_jVCOxrgqWsqMKJZ2Q_eVm2LTck_d4-HEjWhzMkvwe329wYaSCM0vOZPQl8UoMosQ5tWNXSnru4H0neD2XnBfDALyXx6ZP-aZRxyrEz2EL0iFINR_pYZOHcYNrqkgMWW8HUlxiI3_aMevRCZ3dOslDvtw0c3ZaucZ3Im2LztAoegFWNId686EFRNmWm6NdLkQwKr3-HuKOBxp5i8RpIAtvANyCyjSysqyIvM8Vf3DUGCOhEEu4S0uNJ7qbY350TVHyBZfYcgFT2WGasVJSho3XfVWJWrYPxNma9sEJuaLIy3fx1FXCacSOS5FIWG5DRsVEQtUJG74iTzWMJ6FG20NJeBREMsU2K-zTCNM85POtt0qj2cKZky_ENDtBL4WfDnHMjVQRMCIwTW8uV2hbkY122fSwUjAZfNtbyHtfLfJXtWvKJqkOoXxY8fWQrVzw7N--HmxeykARPgheT2Cbj9IW5eV-KiBzFZfBuBdzEMco5AWugPsRgAtZQ6bUszz3fNUL1AA7pCm7wmFXjmeZTNpE9Seu_j1DjfFMWxmWdOFCB1psZN3IwPm6JOl7pqZzCeZZtzH5mWthDIvWvnoN1uRnOQ6vmt5tGSKKXh4rEUet8lH8roYf5QFHPIQcPMnDzMt3uczd8mk";
    cpf = cpf.replace(/\D/g, '');
    let url = `https://api.escavador.com/api/v2/receita-federal/cpf/${cpf}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!response.ok) return { status: 'API_ERROR' };
        return { status: 'SUCCESS', data: await response.json() };
    } catch (e) {
        return { status: 'API_ERROR', message: e.message };
    }
};
