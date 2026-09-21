const odbc = require('odbc');

async function exploreFuncionarios() {
    try {
        const connection = await odbc.connect('DSN=Teorema');
        
        // 1. Get columns of FUNCIONARIOS
        const colsResult = await connection.query(`
            SELECT r.RDB$FIELD_NAME 
            FROM RDB$RELATION_FIELDS r
            WHERE r.RDB$RELATION_NAME = 'FUNCIONARIOS'
        `);
        const columns = colsResult.map(c => c['RDB$FIELD_NAME'].trim());
        console.log('Columns in FUNCIONARIOS:', columns.join(', '));
        
        // Find which column might hold CPF
        const cpfCol = columns.find(c => c.includes('CPF') || c.includes('CGC') || c.includes('CNPJ') || c.includes('DOC'));
        console.log('Possible CPF column:', cpfCol);
        
        // 2. Query the employee
        // Let's try to query just SELECT * FROM FUNCIONARIOS where some field matches
        // But first let's just get the first row to see how CPF is formatted (with punctuation or without)
        const sample = await connection.query(`SELECT FIRST 1 * FROM FUNCIONARIOS`);
        console.log('Sample row:', sample);
        
        // Search for the specific CPF. It might be formatted as '099.424.959-40' or '09942495940'
        let query = `SELECT * FROM FUNCIONARIOS WHERE ${cpfCol ? cpfCol + " IN ('099.424.959-40', '09942495940')" : '1=0'}`;
        // If we don't know the CPF column, we can search all string columns
        if (!cpfCol) {
            query = `SELECT * FROM FUNCIONARIOS WHERE ` + columns.map(c => `CAST("${c}" AS VARCHAR(100)) LIKE '%099.424.959-40%' OR CAST("${c}" AS VARCHAR(100)) LIKE '%09942495940%'`).join(' OR ');
        }
        
        console.log('Executing query:', query);
        const employee = await connection.query(query);
        console.log('Found employee:', employee);
        
        await connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

exploreFuncionarios();
