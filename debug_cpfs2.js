const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const funcResult = await conn.query(`SELECT * FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '10106266985'`);
        console.log(funcResult.map(x => ({cod: x.FUNCIONARIO_CODIGO, emp: x.EMPRESA_CODIGO, dem: x.FUNCIONARIO_DATA_DEMISSAO, cont: x.FUNCIONARIO_DATA_CONTRATO, status: x.STATUS})));
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
