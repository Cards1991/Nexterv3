const odbc = require('odbc');

async function test() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const columns = await conn.columns(null, null, 'FUNCIONARIOS', null);
        console.log("Todas as colunas:");
        console.log(columns.map(c => c.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error("Erro:", e);
    } finally {
        if (conn) await conn.close();
        process.exit(0);
    }
}
test();
