const odbc = require('odbc');
const fs = require('fs');

async function extrairColaborador() {
    console.log('--- INICIANDO EXTRAÇÃO DO COLABORADOR DO TEOREMA ---');
    let conn;
    try {
        console.log('Conectando ao Teorema (ODBC)...');
        conn = await odbc.connect('DSN=Teorema');
        console.log('Conexão bem-sucedida!');

        const cpfAlvo = '09942495940'; // CPF limpo
        
        console.log('Buscando cadastros associados ao CPF...');
        // Buscar TODOS os cadastros deste funcionário (pode haver mais de um devido a transferências)
        const funcResult = await conn.query(`SELECT * FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '${cpfAlvo}'`);
        
        if (funcResult.length === 0) {
            console.error('Funcionario nao encontrado.');
            return;
        }

        console.log(`Encontrados ${funcResult.length} registros para o CPF ${cpfAlvo}. Agrupando histórico...`);

        // Vamos usar o registro mais recente (maior código ou último status ativo) para o cabeçalho base
        const funcBase = funcResult.reduce((prev, current) => {
            return (prev.FUNCIONARIO_CODIGO > current.FUNCIONARIO_CODIGO) ? prev : current;
        });

        const dadosCompletos = {
            funcionario: {
                nome: funcBase.FUNCIONARIO_NOME ? funcBase.FUNCIONARIO_NOME.trim() : '',
                matricula: funcBase.FUNCIONARIO_MATRICULA || funcBase.FUNCIONARIO_CODIGO,
                cpf: funcBase.FUNCIONARIO_CPF ? funcBase.FUNCIONARIO_CPF.trim() : '',
                dataAdmissao: funcBase.FUNCIONARIO_DATA_ADMISSAO || null,
                empresaId: funcBase.EMPRESA_CODIGO || '',
                setor: funcBase.SETOR_CODIGO || '',
                cargo: funcBase.CARGO_CODIGO || '',
                status: funcBase.FUNCIONARIO_DATA_DEMISSAO ? 'Inativo' : 'Ativo',
                origem: 'Teorema'
            },
            movimentacoes: [],
            ferias: [],
            salarios: []
        };

        // Iterar sobre todos os códigos encontrados
        // Filtra para manter apenas o 00124 conforme solicitação do usuário para remover o lixo do 00167
        const funcValidos = funcResult.filter(f => f.FUNCIONARIO_CODIGO === '00124');
        if (funcValidos.length === 0) {
            console.log('Nenhum cadastro 00124 encontrado.');
            funcValidos.push(funcResult[0]); // fallback
        }

        for (let func of funcValidos) {
            const codFuncionario = func.FUNCIONARIO_CODIGO;
            console.log(`\nProcessando histórico do Código: ${codFuncionario} (Empresa: ${func.EMPRESA_CODIGO})`);

            // Extrair movimentações mensais (legado + atual)
            const movResult1 = await conn.query(`SELECT MOVIMENTO_ANO as ANO, MOVIMENTO_MES as MES, EVENTO_CODIGO, MOVIMENTO_VALOR as VALOR, MOVIMENTO_REFERENCIA as REFERENCIA, '0' as TIPO, 'V' as NATUREZA FROM MOVIMENTO_MENSAL WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
            
            const movResult2 = await conn.query(`
                SELECT ms.MOVIMENTO_ANO as ANO, ms.MOVIMENTO_MES as MES, dt.EVENTO_CODIGO, dt.MOVIMENTO_VALOR as VALOR, dt.MOVIMENTO_REFERENCIA as REFERENCIA, 
                ms.MOVIMENTO_TIPO as TIPO, ms.MOVIMENTO_BASE_INSS as BASE_INSS, ms.MOVIMENTO_BASE_FGTS as BASE_FGTS, ms.MOVIMENTO_VALOR_FGTS as FGTS_MES, ms.MOVIMENTO_BASE_IRRF as BASE_IRRF,
                dt.EVENTO_NATUREZA as NATUREZA
                FROM MOVIMENTO_FUNCIONARIO_MS ms
                JOIN MOVIMENTO_FUNCIONARIO_DT dt ON ms.TRANSACAO = dt.TRANSACAO
                WHERE ms.FUNCIONARIO_CODIGO = '${codFuncionario}'
            `);
            
            const movResult = [...movResult1, ...movResult2];
            console.log(`- Movimentações da folha brutas: ${movResult.length}`);
            
            const dataAdmissaoStr = func.FUNCIONARIO_DATA_CONTRATO || func.FUNCIONARIO_DATA_ADMISSAO;
            const dataAdmissao = dataAdmissaoStr ? new Date(dataAdmissaoStr) : new Date('1900-01-01');
            const admAno = dataAdmissao.getFullYear();
            const admMes = dataAdmissao.getMonth() + 1;

            const movsMapeadas = movResult.map(m => {
                return {
                    ano: m.ANO,
                    mes: m.MES,
                    verbaCodigo: m.EVENTO_CODIGO,
                    valor: m.VALOR || 0,
                    referencia: m.REFERENCIA || '',
                    tipoCalculo: m.TIPO || '1',
                    baseINSS: m.BASE_INSS || 0,
                    baseFGTS: m.BASE_FGTS || 0,
                    fgtsMes: m.FGTS_MES || 0,
                    baseIRRF: m.BASE_IRRF || 0,
                    natureza: m.NATUREZA || 'V',
                    origem: 'Teorema',
                    codigoFonte: codFuncionario
                };
            }).filter(m => {
                if (!m.ano || !m.mes) return true;
                return Number(m.ano) > admAno || (Number(m.ano) === admAno && Number(m.mes) >= admMes);
            });
            dadosCompletos.movimentacoes.push(...movsMapeadas);

            // Extrair histórico de férias
            const feriasResult = await conn.query(`SELECT * FROM FUNCIONARIOS_FERIAS WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
            console.log(`- Registros de férias: ${feriasResult.length}`);
            
            const feriasMapeadas = feriasResult.map(f => ({
                dataInicio: f.FERIAS_AQUISITIVO_INI || f.FERIAS_INICIO,
                dataFim: f.FERIAS_AQUISITIVO_FIM || f.FERIAS_FIM,
                diasGozados: f.FERIAS_DIAS_FERIAS || f.DIAS_GOZADOS || 0,
                origem: 'Teorema',
                codigoFonte: codFuncionario
            })).filter(f => {
                if (!f.dataInicio) return true;
                const d = new Date(f.dataInicio);
                return d >= dataAdmissao;
            });
            dadosCompletos.ferias.push(...feriasMapeadas);

            // Extrair evolução salarial
            const salResult = await conn.query(`SELECT * FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
            console.log(`- Registros salariais: ${salResult.length}`);
            
            const salMapeados = salResult.map(s => {
                return {
                    data: s.EVOLUCAO_DATA,
                    salario: s.EVOLUCAO_VALOR_ATUAL,
                    motivo: s.EVOLUCAO_MOTIVO || '',
                    origem: 'Teorema',
                    codigoFonte: codFuncionario
                };
            }).filter(s => {
                if (!s.data) return true;
                const d = new Date(s.data);
                return d >= dataAdmissao;
            });
            dadosCompletos.salarios.push(...salMapeados);
        }

        // --- DEDUPLICAÇÃO DE SALÁRIOS ---
        // É comum ERPs antigos terem várias linhas na EVOLUCAO_SALARIAL para a mesma data (ex: recalculo) ou devido a múltiplos códigos (transferência).
        // Vamos agrupar por Data e pegar sempre o ÚLTIMO valor (maior valor ou o que foi inserido por último).
        const salariosUnicosMap = new Map();
        
        dadosCompletos.salarios.forEach(s => {
            if (!s.data) return;
            const dataStr = s.data instanceof Date ? s.data.toISOString().split('T')[0] : String(s.data).split('T')[0];
            
            if (!salariosUnicosMap.has(dataStr)) {
                salariosUnicosMap.set(dataStr, s);
            } else {
                // Se já existe pra essa data, vamos priorizar o maior salário (ou se for o mesmo, ignora)
                const existente = salariosUnicosMap.get(dataStr);
                if (Number(s.salario) > Number(existente.salario)) {
                    salariosUnicosMap.set(dataStr, s);
                }
            }
        });
        
        // Ordena por data
        let salariosOrdenados = Array.from(salariosUnicosMap.values()).sort((a, b) => new Date(a.data) - new Date(b.data));
        
        // Remove repetições sequenciais (se o salário não mudou em relação ao anterior, remove)
        let salariosFinais = [];
        let ultimoSalario = null;
        for (let i = 0; i < salariosOrdenados.length; i++) {
            const s = salariosOrdenados[i];
            if (Number(s.salario) !== ultimoSalario) {
                salariosFinais.push(s);
                ultimoSalario = Number(s.salario);
            }
        }
        
        dadosCompletos.salarios = salariosFinais;

        // --- DEDUPLICAÇÃO DE FÉRIAS ---
        const feriasUnicas = new Map();
        dadosCompletos.ferias.forEach(f => {
            if(!f.dataInicio) return;
            const dataStr = f.dataInicio instanceof Date ? f.dataInicio.toISOString().split('T')[0] : String(f.dataInicio).split('T')[0];
            feriasUnicas.set(dataStr, f); // Sobrescreve duplicatas com a mesma data de início
        });
        dadosCompletos.ferias = Array.from(feriasUnicas.values());

        // --- DEDUPLICAÇÃO DE MOVIMENTAÇÕES (Folha) ---
        // Agrupar por Mês/Ano/Verba para evitar que a mesma rubrica apareça duplicada se estava nos dois cadastros
        const movsUnicas = new Map();
        dadosCompletos.movimentacoes.forEach(m => {
            if (!m.mes || !m.ano || !m.verbaCodigo) return;
            const chave = `${m.ano}-${m.mes}-${m.verbaCodigo}`;
            // Mantém a que tiver valor (caso uma venha zerada e a outra não) ou apenas a última
            const existente = movsUnicas.get(chave);
            if (!existente || Number(m.valor) > Number(existente.valor)) {
                movsUnicas.set(chave, m);
            }
        });
        dadosCompletos.movimentacoes = Array.from(movsUnicas.values());

        fs.writeFileSync('colaborador_teorema.json', JSON.stringify(dadosCompletos, null, 2));
        console.log(`\n✅ SUCESSO! Total consolidado: ${dadosCompletos.movimentacoes.length} movs | ${dadosCompletos.ferias.length} férias | ${dadosCompletos.salarios.length} salários.`);
        console.log(`Dados extraídos e salvos no arquivo 'colaborador_teorema.json'.`);
        
    } catch (error) {
        console.error('Erro durante a extração:', error);
    } finally {
        if (conn) {
            await conn.close();
        }
    }
}

extrairColaborador();
