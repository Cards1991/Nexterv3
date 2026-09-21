const odbc = require('odbc');
const fs = require('fs');

async function checkEventos() {
    try {
        const conn = await odbc.connect('DSN=Teorema');
        const q = `SELECT FIRST 5 * FROM EVENTOS`;
        const res = await conn.query(q);
        console.log('Sample EVENTOS:', res);
        
        const colsResult = await conn.query(`SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'EVENTOS'`);
        const columns = colsResult.map(c => c['RDB$FIELD_NAME'].trim());
        console.log('Columns in EVENTOS:', columns.join(', '));
        
        await conn.close();
    } catch (e) {
        console.error(e);
    }
}
checkEventos();
