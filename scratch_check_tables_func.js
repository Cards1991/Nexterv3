const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    try {
        const res = await conn.query("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 AND RDB$RELATION_NAME LIKE '%FUNC%'");
        console.log(res);
    } catch (e) {
        console.error(e);
    }
    await conn.close();
}
run();
