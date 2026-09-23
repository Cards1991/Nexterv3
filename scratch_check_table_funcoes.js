const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    try {
        const res = await conn.query("SELECT FIRST 1 * FROM FUNCOES");
        console.log(res);
    } catch (e) {
        console.error(e);
    }
    await conn.close();
}
run();
