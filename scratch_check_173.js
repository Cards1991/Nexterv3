const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT FUNCIONARIO_NOME, FUNCIONARIO_CPF, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE SECAO_CODIGO = '173' OR SETOR_CODIGO = '173'");
    console.log('Quem está no 173:', res);
    await conn.close();
}
run();
