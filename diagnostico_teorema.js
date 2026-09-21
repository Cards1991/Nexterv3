const odbc = require('odbc');
const fs = require('fs');

async function runDiagnostico() {
    let report = '';
    const log = (msg) => { console.log(msg); report += msg + '\n'; };
    
    try {
        const conn = await odbc.connect('DSN=Teorema');
        log('--- DIAGNÓSTICO TEOREMA ---');
        
        // Let's do a wider search for the CPF
        let query = `SELECT * FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF LIKE '%099%' AND FUNCIONARIO_CPF LIKE '%424%' AND FUNCIONARIO_CPF LIKE '%959%'`;
        
        const emp = await conn.query(query);
        
        if (emp.length === 0) {
            log('Colaborador não encontrado com LIKE. Buscando todos os CPFs para checar...');
            const allCpf = await conn.query('SELECT FUNCIONARIO_CODIGO, FUNCIONARIO_NOME, FUNCIONARIO_CPF FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF IS NOT NULL');
            const found = allCpf.find(f => String(f.FUNCIONARIO_CPF).replace(/\D/g, '') === '09942495940');
            if (!found) {
                log('Definitivamente não encontrado no banco.');
                return;
            } else {
                log('Encontrado ignorando máscara: ' + JSON.stringify(found));
                query = `SELECT * FROM FUNCIONARIOS WHERE FUNCIONARIO_CODIGO = ${found.FUNCIONARIO_CODIGO}`;
                const refetch = await conn.query(query);
                emp.push(refetch[0]);
            }
        }
        
        const f = emp[0];
        const codigo = f.FUNCIONARIO_CODIGO;
        
        log(`\n## COLABORADOR ENCONTRADO`);
        log(`Nome: ${f.FUNCIONARIO_NOME || f.NOME || f.NOME_FUNCIONARIO}`);
        log(`CPF: ${f.FUNCIONARIO_CPF}`);
        log(`Código: ${codigo}`);
        log(`Matrícula: ${f.FUNCIONARIO_MATRICULA || f.MATRICULA || f.FUNCIONARIO_CODIGO}`);
        log(`Empresa: ${f.EMPRESA_CODIGO || f.FUNCIONARIO_EMPRESA || 'N/A'}`);
        log(`Admissão: ${f.FUNCIONARIO_DATA_ADMISSAO || f.FUNCIONARIO_ADMISSAO || 'N/A'}`);
        log(`Desligamento: ${f.FUNCIONARIO_DATA_DEMISSAO || f.FUNCIONARIO_DEMISSAO || 'N/A'}`);
        log(`Cargo: ${f.CARGO_CODIGO || f.FUNCIONARIO_CARGO || 'N/A'}`);
        log(`Setor: ${f.SETOR_CODIGO || f.FUNCIONARIO_SETOR || 'N/A'}`);
        log(`Situação: ${f.FUNCIONARIO_SITUACAO || f.SITUACAO || 'N/A'}`);
        
        // Check historical tables
        log(`\n## TABELAS E RELACIONAMENTOS MAPEADOS`);
        log(`Tabela de funcionário: FUNCIONARIOS`);
        log(`Chave primária presumida: FUNCIONARIO_CODIGO = ${codigo}`);
        
        const checkTable = async (tableName) => {
            try {
                // Find column linking to FUNCIONARIO
                const tCols = await conn.query(`SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = '${tableName}'`);
                const cols = tCols.map(c => c['RDB$FIELD_NAME'].trim());
                const linkCol = cols.find(c => c === 'FUNCIONARIO_CODIGO' || c.includes('FUNCIONARIO'));
                if (linkCol) {
                    const q = `SELECT * FROM ${tableName} WHERE ${linkCol} = ${codigo}`;
                    const res = await conn.query(q);
                    return { table: tableName, count: res.length, col: linkCol, rows: res };
                }
            } catch (e) {}
            return null;
        };
        
        const t1 = await checkTable('MOVIMENTO_MENSAL');
        const t2 = await checkTable('MOVIMENTO_FUNCIONARIO_MS');
        const t3 = await checkTable('EVOLUCAO_SALARIAL');
        const t4 = await checkTable('FUNCIONARIOS_FERIAS');
        
        log(`Tabela de movimentos: ${t1 && t1.count > 0 ? t1.table : (t2 && t2.count > 0 ? t2.table : 'N/A')}`);
        log(`Tabela de eventos: EVENTOS`);
        log(`Tabela de salários: ${t3 && t3.count > 0 ? t3.table : 'N/A'}`);
        
        let movs = t1 && t1.count > 0 ? t1.rows : (t2 && t2.count > 0 ? t2.rows : []);
        
        log(`\n## HISTÓRICO ENCONTRADO`);
        if (movs.length > 0) {
            // Figure out competency columns
            const firstMov = movs[0];
            const mesCol = Object.keys(firstMov).find(k => k.includes('MES'));
            const anoCol = Object.keys(firstMov).find(k => k.includes('ANO'));
            const eventoCol = Object.keys(firstMov).find(k => k.includes('EVENTO'));
            const valorCol = Object.keys(firstMov).find(k => k.includes('VALOR'));
            const refCol = Object.keys(firstMov).find(k => k.includes('REFERENCIA'));
            
            // Get event names
            const evMap = {};
            try {
                const events = await conn.query(`SELECT * FROM EVENTOS`);
                events.forEach(e => { evMap[e.EVENTO_CODIGO] = e.EVENTO_DESCRICAO || e.EVENTO_NOME; });
            } catch (e) {}
            
            const periods = new Set();
            movs.forEach(m => {
                if (mesCol && anoCol) {
                    periods.add(`${String(m[mesCol]).padStart(2, '0')}/${m[anoCol]}`);
                }
            });
            const pArr = Array.from(periods).sort();
            
            log(`Período inicial: ${pArr[0] || 'N/A'}`);
            log(`Período final: ${pArr[pArr.length - 1] || 'N/A'}`);
            log(`Quantidade de competências: ${pArr.length}`);
            log(`Quantidade de movimentações: ${movs.length}`);
            
            log(`\n## MOVIMENTAÇÕES (Amostra)`);
            log(`Competência | Evento | Descrição | Referência | Valor`);
            movs.slice(0, 15).forEach(m => {
                const comp = mesCol && anoCol ? `${String(m[mesCol]).padStart(2, '0')}/${m[anoCol]}` : 'N/A';
                const ev = m[eventoCol] || 'N/A';
                const desc = evMap[ev] || 'N/A';
                const ref = refCol ? m[refCol] : '-';
                const val = valorCol ? m[valorCol] : '-';
                log(`${comp} | ${ev} | ${desc} | ${ref} | R$ ${val}`);
            });
        } else {
            log(`Nenhuma movimentação encontrada.`);
        }
        
        log(`\n### CONSULTA SQL BASE`);
        log(query);
        
        fs.writeFileSync('diagnostico_colaborador.txt', report);
        console.log('Salvo em diagnostico_colaborador.txt');
        await conn.close();
    } catch (error) {
        console.error('Error:', error);
    }
}
runDiagnostico();
