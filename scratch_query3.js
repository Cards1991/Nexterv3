const odbc = require('odbc');
async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        console.log('--- COLUMNS ---');
        const cols = await conn.columns(null, null, 'FUNCIONARIOS', null);
        const colNames = cols.map(c => c.COLUMN_NAME);
        console.log(colNames.filter(c => c.includes('DATA')));
    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
