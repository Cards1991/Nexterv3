const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT * FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%11258614952%'");
    
    // Print all non-null fields to see what could be '173'
    for (const key in res[0]) {
        if (res[0][key] === '173' || res[0][key] === 173 || res[0][key] === '173  ') {
            console.log("MATCH:", key, res[0][key]);
        }
    }
    
    // Just print keys ending in CODIGO
    for (const key in res[0]) {
        if (key.includes('CODIGO')) {
            console.log(key, ":", res[0][key]);
        }
    }
    await conn.close();
}
run();
