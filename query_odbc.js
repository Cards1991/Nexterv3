const odbc = require('odbc');

async function connectToDatabase() {
    try {
        const connection = await odbc.connect('DSN=Teorema');
        console.log('Connected to Teorema!');
        
        // Let's get the list of tables
        const result = await connection.query(`SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0`);
        const tables = result.map(r => r['RDB$RELATION_NAME'].trim());
        
        console.log('Found', tables.length, 'tables.');
        
        // Find tables that might be related to employees or persons
        const targetTables = tables.filter(t => t.includes('FUNC') || t.includes('COLAB') || t.includes('PESSOA') || t.includes('EMPREGADO') || t.includes('MOV') || t.includes('EVENT') || t.includes('FOLHA') || t.includes('SALAR'));
        console.log('Interesting tables:', targetTables);
        
        await connection.close();
    } catch (error) {
        console.error('Error connecting to database:', error);
    }
}

connectToDatabase();
