const odbc = require('odbc');

async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        
        console.log('--- TABLES STARTING WITH E ---');
        const tables = await conn.tables(null, null, 'E%', 'TABLE');
        console.log(tables.map(t => t.TABLE_NAME));
        
        console.log('--- TABLES STARTING WITH S ---');
        const tablesS = await conn.tables(null, null, 'S%', 'TABLE');
        console.log(tablesS.map(t => t.TABLE_NAME));

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
