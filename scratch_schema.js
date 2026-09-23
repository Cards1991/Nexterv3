const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const empCols = await conn.columns(null, null, 'EMPRESAS', null);
        console.log('EMPRESAS:', empCols.map(c => c.COLUMN_NAME));
        
        const secCols = await conn.columns(null, null, 'SECOES', null);
        console.log('SECOES:', secCols.map(c => c.COLUMN_NAME));
        
        const resSec = await conn.query("SELECT FIRST 5 * FROM SECOES");
        console.log('SECOES DATA:', resSec);

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
