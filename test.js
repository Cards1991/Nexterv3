const odbc = require('odbc');
async function test() {
    const conn = await odbc.connect('DSN=Teorema');
    const movResult = await conn.query("SELECT FIRST 1 * FROM MOVIMENTO_MENSAL");
    console.log(Object.keys(movResult[0]));
    await conn.close();
}
test();
