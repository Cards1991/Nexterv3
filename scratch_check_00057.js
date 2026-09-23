const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT FUNCIONARIO_NOME, FUNCIONARIO_CPF, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE EMPRESA_CODIGO = '0032' AND FUNCIONARIO_CODIGO = '00057'");
    console.log('00057:', res);
    await conn.close();
}
run();
