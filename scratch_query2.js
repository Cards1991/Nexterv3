const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        console.log('--- FUNCIONARIOS ---');
        const funcs = await conn.query("SELECT FUNCIONARIO_CODIGO, FUNCIONARIO_NOME, FUNCIONARIO_DATA_CONTRATO, FUNCIONARIO_DATA_DEMISSAO FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '97260096934'");
        console.log(funcs);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
