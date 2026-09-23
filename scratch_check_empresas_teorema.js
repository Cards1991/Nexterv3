const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    try {
        const res = await conn.query("SELECT EMPRESA_CODIGO, EMPRESA_CNPJ, EMPRESA_NOME FROM EMPRESAS");
        console.log('Empresas no Teorema:');
        res.forEach(e => console.log(`${e.EMPRESA_CODIGO} -> ${e.EMPRESA_NOME} (CNPJ: ${e.EMPRESA_CNPJ})`));
    } catch (e) {
        console.error(e);
    }
    await conn.close();
}
run();
