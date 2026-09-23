const odbc = require('odbc');

async function run() {
    let conn;
    try {
        conn = await odbc.connect('DSN=Teorema');
        
        // As empresas solicitadas
        const codigos = ['0017', '0018', '0020', '0025', '0026', '0028', '0029', '0030', '0031', '0032', '0033', '0034', '0035', '0036'];
        const inClause = codigos.map(c => `'${c}'`).join(',');

        console.log('--- EMPRESAS ---');
        const empresas = await conn.query(`SELECT EMPRESA_CODIGO, EMPRESA_NOME, EMPRESA_CNPJ FROM EMPRESAS WHERE EMPRESA_CODIGO IN (${inClause})`);
        console.log(empresas);
        
        console.log('--- SECOES (SETORES) USADOS ---');
        // Usar um DISTINCT para pegar as combinações de empresa e seção que realmente existem/têm funcionários
        const query = `
            SELECT DISTINCT f.EMPRESA_CODIGO, f.SECAO_CODIGO, s.SECAO_DESCRICAO 
            FROM FUNCIONARIOS f 
            JOIN SECOES s ON f.SECAO_CODIGO = s.SECAO_CODIGO 
            WHERE f.EMPRESA_CODIGO IN (${inClause})
            ORDER BY f.EMPRESA_CODIGO, s.SECAO_DESCRICAO
        `;
        const setores = await conn.query(query);
        console.log(`Total setores encontrados: ${setores.length}`);
        if(setores.length > 0) {
            console.log(setores[0]);
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (conn) await conn.close();
    }
}
run();
