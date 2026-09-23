const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    try {
        const res = await conn.query("SELECT EMPRESA_CODIGO, FUNCIONARIO_CODIGO, FUNCIONARIO_NOME, FUNCIONARIO_SITUACAO, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%09355621922%'");
        console.log('09355621922 records:', res);
    } catch (e) {
        console.error(e);
    }
    await conn.close();
}
run();
