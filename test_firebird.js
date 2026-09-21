const Firebird = require('node-firebird');
const options = {};
options.host = '192.168.254.83';
options.port = 3050;
options.database = 'E:\\Teorema\\Windados\\TEOREMA40_CRIVAL.FDB';
options.user = 'SYSDBA';
options.password = 'masterkey';
options.lowercase_keys = false; 
options.role = null;            
options.pageSize = 4096;

Firebird.attach(options, function(err, db) {
    if (err) {
        console.error('Connection error:', err);
        return;
    }
    db.query('SELECT FIRST 10 RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL', function(err, result) {
        if (err) {
            console.error('Query error:', err);
        } else {
            console.log('Tables:', result);
        }
        db.detach();
    });
});
