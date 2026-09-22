const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const res = await conn.query("SELECT FUNCIONARIO_CODIGO, FUNCIONARIO_NOME, FUNCIONARIO_SALARIO FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '97260096934'");
        console.log(res);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
