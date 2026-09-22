const odbc = require('odbc');

async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const trans = await conn.query("SELECT * FROM TRANSFERENCIAS WHERE FUNCIONARIO_CODIGO = '01216' OR EMPRESA_CODIGO = '0017'");
        console.log('TRANSFERENCIAS:', trans.slice(0, 5));
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
