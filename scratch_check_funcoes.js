const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    try {
        const res = await conn.query("SELECT FIRST 1 * FROM FUNCIONARIOS");
        if(res.length > 0) {
            console.log(Object.keys(res[0]).filter(k => k.includes('FUN') || k.includes('CARGO') || k.includes('CBO')));
        }
    } catch (e) {
        console.error(e);
    }
    await conn.close();
}
run();
