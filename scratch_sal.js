const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const res = await conn.query("SELECT EVOLUCAO_DATA, EVOLUCAO_VALOR_ATUAL, EVOLUCAO_MOTIVO FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO = '00040' AND EVOLUCAO_DATA >= '2024-01-01' ORDER BY EVOLUCAO_DATA DESC");
        console.log(res);
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
