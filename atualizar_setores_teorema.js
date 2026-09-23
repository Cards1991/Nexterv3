const odbc = require('odbc');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Mapeamento inverso (Código -> Nome) baseado nos 33 setores oficiais
const SETORES_CODIGOS = {
    137: "ACABAMENTO BIDENSIDADE",
    149: "ACABAMENTO MONODENSIDADE",
    150: "ADMINISTRATIVO",
    151: "AFASTADOS",
    152: "ALMOXARIFADO",
    153: "CAMERAS",
    154: "COMERCIAL",
    157: "CORTE",
    158: "COSTURA FECHAMENTO",
    159: "COSTURA ORISOL",
    160: "CURTUME",
    162: "CUSTOS",
    163: "DIFERENCIADO",
    164: "DIVISORA",
    166: "EXPEDICAO",
    167: "EXTERNOS",
    168: "GERENTE DE PRODUÇÃO",
    169: "INJETORA BIDENSIDADE",
    170: "INJETORA MONODENSIDADE",
    171: "JOVEM APRENDIZ",
    172: "MANUTENCAO",
    173: "MARKETING",
    174: "MONTAGEM BIDENSIDADE",
    175: "MONTAGEM INFINITY",
    176: "MONTAGEM MONO",
    177: "PREPARACAO P.U.",
    178: "PVC",
    180: "PVC - NOITE",
    182: "SESMT",
    183: "SUMIDOS",
    184: "TRANSPORTE",
    185: "VIGIAS",
    186: "ZELADOR"
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function syncSetores() {
    let conn;
    try {
        console.log('🚀 Conectando ao Banco de Dados TEOREMA (ODBC)...');
        conn = await odbc.connect('DSN=Teorema');
        
        console.log('📥 Buscando funcionários no Teorema...');
        // Busca o CPF e os possíveis campos de código de seção/setor
        const query = 'SELECT FUNCIONARIO_CPF, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF IS NOT NULL';
        const teoremaEmps = await conn.query(query);

        const teoremaMap = {};
        teoremaEmps.forEach(emp => {
            const cpf = emp.FUNCIONARIO_CPF;
            // Usa o SECAO_CODIGO, se não existir tenta o SETOR_CODIGO
            const codigoTeorema = emp.SECAO_CODIGO || emp.SETOR_CODIGO; 
            
            if (cpf && codigoTeorema) {
                const cpfLimpo = String(cpf).replace(/\D/g, '');
                teoremaMap[cpfLimpo] = parseInt(codigoTeorema, 10);
            }
        });

        console.log(`✅ Carregados ${Object.keys(teoremaMap).length} CPFs válidos do Teorema com código de seção.`);

        console.log('📥 Buscando funcionários no Nexter (Firebase)...');
        const nexterSnap = await db.collection('funcionarios').get();
        let batch = db.batch();
        let ops = 0;
        let totalUpdated = 0;
        let semSetorCorrespondente = 0;

        for (const doc of nexterSnap.docs) {
            const data = doc.data();
            if (!data.cpf) continue;
            
            const cpfLp = String(data.cpf).replace(/\D/g, '');
            const codigo = teoremaMap[cpfLp];

            if (codigo) {
                const novoSetorNome = SETORES_CODIGOS[codigo];
                
                if (novoSetorNome) {
                    // Só atualiza no Firebase se for diferente do que já está lá (evita updates desnecessários)
                    if (data.setor !== novoSetorNome) {
                        batch.update(doc.ref, { setor: novoSetorNome });
                        ops++;
                        totalUpdated++;

                        // Commit em lotes para evitar estourar o limite de 500 do Firestore
                        if (ops >= 400) {
                            await batch.commit();
                            batch = db.batch();
                            ops = 0;
                            console.log(`⏳ Atualizados ${totalUpdated} funcionários...`);
                        }
                    }
                } else {
                    // O Teorema retornou um código que não está na lista dos 33 oficiais
                    semSetorCorrespondente++;
                }
            }
        }

        // Commita o resto
        if (ops > 0) {
            await batch.commit();
        }

        console.log('----------------------------------------------------');
        console.log(`🎉 SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!`);
        console.log(`✅ ${totalUpdated} funcionários tiveram o setor atualizado no Nexter para o padrão dos 33 setores.`);
        if (semSetorCorrespondente > 0) {
            console.log(`⚠️ ${semSetorCorrespondente} funcionários têm códigos no Teorema que não fazem parte da lista dos 33 (precisam ser checados lá).`);
        }
        console.log('----------------------------------------------------');
        
    } catch (err) {
        console.error('❌ ERRO NA SINCRONIZAÇÃO:', err);
    } finally {
        if (conn) {
            await conn.close();
            console.log('Conexão com Teorema encerrada.');
        }
    }
}

syncSetores();
