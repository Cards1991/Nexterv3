const odbc = require('odbc');
async function run() {
    const c = await odbc.connect('DSN=Teorema');
    const res = await c.query("SELECT * FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO = '00124' AND EVOLUCAO_DATA >= '2025-11-12' ORDER BY EVOLUCAO_DATA ASC");
    console.log(res);
    
    // Check if there's a table for motives
    const tCols = await c.query("SELECT r.RDB$RELATION_NAME FROM RDB$RELATIONS r WHERE r.RDB$SYSTEM_FLAG=0 AND r.RDB$RELATION_NAME LIKE '%MOTIVO%'");
    console.log(tCols.map(t => t.RDB$RELATION_NAME.trim()));

    await c.close();
}
run();
