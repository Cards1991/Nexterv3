const odbc = require('odbc');
async function run() {
    let conn;
    try {
        const cpfAlvo = '10106266985';
        conn = await odbc.connect('DSN=Teorema');
        const funcResult = await conn.query(`SELECT * FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '${cpfAlvo}'`);
        const funcBase = funcResult.reduce((prev, current) => {
            return (prev.FUNCIONARIO_CODIGO > current.FUNCIONARIO_CODIGO) ? prev : current;
        });
        const activeCode = funcBase.FUNCIONARIO_CODIGO;
        let chain = [activeCode];
        const transResult = await conn.query(`SELECT TRANSFERENCIA_FUNCIONARIO_DE, TRANSFERENCIA_FUNCIONARIO_PARA FROM TRANSFERENCIAS`);
        let transferMap = {};
        for (let t of transResult) {
            transferMap[t.TRANSFERENCIA_FUNCIONARIO_PARA] = t.TRANSFERENCIA_FUNCIONARIO_DE;
        }
        let currentIter = activeCode;
        while (transferMap[currentIter]) {
            let prevCode = transferMap[currentIter];
            if (!chain.includes(prevCode)) {
                chain.push(prevCode);
                currentIter = prevCode;
            } else {
                break;
            }
        }
        const inClauseCodes = chain.map(c => `'${c}'`).join(',');
        
        console.log("TESTING MOVMENSAL1");
        await conn.query(`SELECT MOVIMENTO_ANO as ANO, MOVIMENTO_MES as MES, EVENTO_CODIGO, MOVIMENTO_VALOR as VALOR, MOVIMENTO_REFERENCIA as REFERENCIA, '0' as TIPO, 'V' as NATUREZA, FUNCIONARIO_CODIGO as COD_FONTE FROM MOVIMENTO_MENSAL WHERE FUNCIONARIO_CODIGO IN (${inClauseCodes})`);
        
        console.log("TESTING MOVMENSAL2");
        await conn.query(`
            SELECT ms.MOVIMENTO_ANO as ANO, ms.MOVIMENTO_MES as MES, dt.EVENTO_CODIGO, dt.MOVIMENTO_VALOR as VALOR, dt.MOVIMENTO_REFERENCIA as REFERENCIA, 
            ms.MOVIMENTO_TIPO as TIPO, ms.MOVIMENTO_BASE_INSS as BASE_INSS, ms.MOVIMENTO_BASE_FGTS as BASE_FGTS, ms.MOVIMENTO_VALOR_FGTS as FGTS_MES, ms.MOVIMENTO_BASE_IRRF as BASE_IRRF,
            dt.EVENTO_NATUREZA as NATUREZA, ms.FUNCIONARIO_CODIGO as COD_FONTE
            FROM MOVIMENTO_FUNCIONARIO_MS ms
            JOIN MOVIMENTO_FUNCIONARIO_DT dt ON ms.TRANSACAO = dt.TRANSACAO
            WHERE ms.FUNCIONARIO_CODIGO IN (${inClauseCodes})
        `);
        
        console.log("TESTING FERIAS");
        await conn.query(`SELECT *, FUNCIONARIO_CODIGO as COD_FONTE FROM FUNCIONARIOS_FERIAS WHERE FUNCIONARIO_CODIGO IN (${inClauseCodes})`);
        
        console.log("TESTING SALARIOS");
        await conn.query(`SELECT *, FUNCIONARIO_CODIGO as COD_FONTE FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO IN (${inClauseCodes})`);

        console.log("ALL SUCCESS!");
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
