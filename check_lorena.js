const odbc = require('odbc');

async function test() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        const cpfAlvo = '09942495940';
        
        // Find all records for this CPF
        const funcResult = await conn.query(`SELECT * FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '${cpfAlvo}'`);
        
        console.log("Registros de Funcionário encontrados para o CPF:");
        console.log(funcResult);

        for (const f of funcResult) {
            const cod = f.FUNCIONARIO_CODIGO;
            console.log(`\nVerificando Código: ${cod}`);
            
            const salResult = await conn.query(`SELECT * FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO = '${cod}'`);
            console.log(`- Salários encontrados: ${salResult.length}`);
            if (salResult.length > 0) console.log(salResult.slice(-2));

            const movResult = await conn.query(`SELECT COUNT(*) as QTD FROM MOVIMENTO_MENSAL WHERE FUNCIONARIO_CODIGO = '${cod}'`);
            console.log(`- Movimentações folha encontradas:`, movResult[0].QTD);
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
test();
