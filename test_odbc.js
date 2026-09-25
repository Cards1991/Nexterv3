const odbc = require('odbc');

async function test() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const result = await conn.query('SELECT * FROM FUNCIONARIOS'); // Algumas databases ODBC não suportam LIMIT, então usamos fetch() manual se der, ou SELECT TOP 1
        console.log("Colunas da tabela FUNCIONARIOS:");
        if (result.length > 0) {
            console.log(Object.keys(result[0]).filter(k => k.includes('SAL')));
        } else {
            console.log("Sem dados");
        }
    } catch (e) {
        console.error("Erro:", e);
    } finally {
        if (conn) await conn.close();
    }
}
test();
