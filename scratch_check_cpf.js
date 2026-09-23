const odbc = require('odbc');
async function run() {
    const conn = await odbc.connect('DSN=Teorema');
    const res = await conn.query("SELECT FUNCIONARIO_NOME, FUNCIONARIO_SITUACAO, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%13595648960%'");
    console.log('13595648960:', res);
    
    const res2 = await conn.query("SELECT FUNCIONARIO_NOME, FUNCIONARIO_SITUACAO, SECAO_CODIGO, SETOR_CODIGO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%11258614952%'");
    console.log('11258614952:', res2);
    await conn.close();
}
run();
