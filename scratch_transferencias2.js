const odbc = require('odbc');

async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        
        // 1. Get all codes for this CPF
        const funcResult = await conn.query("SELECT FUNCIONARIO_CODIGO, EMPRESA_CODIGO, FUNCIONARIO_DATA_ADMISSAO FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '10106266985'");
        console.log('ALL CODES FOR CPF:', funcResult);
        
        const codes = funcResult.map(f => `'${f.FUNCIONARIO_CODIGO}'`).join(',');
        
        // 2. Get transfers for these codes
        const trans = await conn.query(`SELECT * FROM TRANSFERENCIAS WHERE TRANSFERENCIA_FUNCIONARIO_DE IN (${codes}) OR TRANSFERENCIA_FUNCIONARIO_PARA IN (${codes})`);
        console.log('TRANSFERS INVOLVING THESE CODES:', trans);
        
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
