const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT * FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%11258614952%'");
    console.log(res);
    await conn.close();
}
run();
