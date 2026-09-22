const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const funcResult = await conn.query(`SELECT FUNCIONARIO_CODIGO, EMPRESA_CODIGO, FUNCIONARIO_DATA_ADMISSAO, FUNCIONARIO_DATA_DEMISSAO, FUNCIONARIO_CPF FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '10106266985'`);
        console.log("CPFs encontrados:", funcResult);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
