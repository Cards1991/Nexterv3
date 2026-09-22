const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        console.log('--- FUNCIONARIOS ---');
        const funcs = await conn.query("SELECT FUNCIONARIO_CODIGO, FUNCIONARIO_NOME, FUNCIONARIO_DATA_CONTRATO FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '97260096934'");
        console.log(funcs);
        if (funcs.length > 0) {
            console.log('--- EVOLUCAO_SALARIAL ---');
            const cods = funcs.map(f => `'${f.FUNCIONARIO_CODIGO}'`).join(',');
            const evols = await conn.query(`SELECT FUNCIONARIO_CODIGO, EVOLUCAO_DATA, EVOLUCAO_VALOR_ATUAL FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO IN (${cods}) ORDER BY EVOLUCAO_DATA DESC`);
            console.log(evols);
            
            console.log('--- TRANSFERENCIAS ---');
            const trans = await conn.query(`SELECT TRANSFERENCIA_FUNCIONARIO_DE, TRANSFERENCIA_FUNCIONARIO_PARA FROM TRANSFERENCIAS WHERE TRANSFERENCIA_FUNCIONARIO_DE IN (${cods}) OR TRANSFERENCIA_FUNCIONARIO_PARA IN (${cods})`);
            console.log(trans);
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
