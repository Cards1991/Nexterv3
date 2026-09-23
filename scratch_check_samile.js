const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT EMPRESA_CODIGO, FUNCIONARIO_CODIGO, FUNCIONARIO_SITUACAO, FUNCIONARIO_DATA_ADMISSAO, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%11258614952%'");
    console.log('11258614952 records:', res);
    await conn.close();
}
run();
