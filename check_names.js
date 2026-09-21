const odbc = require('odbc');
async function run() {
    const c = await odbc.connect('DSN=Teorema');
    const res = await c.query("SELECT FIRST 1 * FROM MOVIMENTO_FUNCIONARIO_DT");
    console.log(Object.keys(res[0]));
    await c.close();
}
run();
