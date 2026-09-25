const express = require('express');
const cors = require('cors');
const koffi = require('koffi');
const odbc = require('odbc');

const app = express();
const PORT = 3000;

// Habilita CORS para permitir que seu site na Vercel acesse este servidor local.
app.use(cors());
app.use(express.json());

let controlID;
let isDllLoaded = false;

try {
    // Carrega a DLL. Certifique-se que o caminho está correto.
    // Usamos 'stdcall' que é o padrão para a maioria das DLLs do Windows.
    const lib = koffi.load('./dlls/ControlID.dll');
    console.log('✅ DLL ControlID.dll carregada com sucesso.');

    // =======================================================================
    // TODO: VERIFIQUE A DOCUMENTAÇÃO DA DLL PARA AS ASSINATURAS CORRETAS!
    // Os exemplos abaixo são suposições baseadas nos nomes das funções.
    // O formato é: koffi.func('NomeDaFuncaoNaDLL', 'tipo_retorno', ['tipo_param1', 'tipo_param2']);
    // =======================================================================

    controlID = {
        // Exemplo: int Conectar(const char* ip, int porta);
        Conectar: lib.func('stdcall', 'Conectar', 'int', ['string', 'int']),

        // Exemplo: char* CapturarDigital(); -> Retorna um ponteiro para string (template)
        CapturarDigital: lib.func('stdcall', 'CapturarDigital', 'string', []),

        // Exemplo: int Identificar(const char* template); -> Retorna o ID do usuário
        Identificar: lib.func('stdcall', 'Identificar', 'int', ['string']),

        // Exemplo: char* ListarUsuarios(); -> Retorna um JSON como string
        ListarUsuarios: lib.func('stdcall', 'ListarUsuarios', 'string', []),

        // Exemplo: int AdicionarUsuario(const char* nome, const char* template);
        AdicionarUsuario: lib.func('stdcall', 'AdicionarUsuario', 'int', ['string', 'string']),

        // Exemplo: void Desconectar();
        Desconectar: lib.func('stdcall', 'Desconectar', 'void', [])
    };

    isDllLoaded = true;
    console.log('✅ Funções da DLL mapeadas.');

} catch (error) {
    console.error('❌ ERRO CRÍTICO: Não foi possível carregar a DLL "ControlID.dll".');
    console.error('Verifique se a DLL está na pasta "dlls" e se a arquitetura (32/64 bits) do Node.js é compatível com a da DLL.');
    console.error(error);
}

// --- ENDPOINTS DA API ---

// GET /status: Verifica a conexão com o leitor
app.get('/status', (req, res) => {
    if (!isDllLoaded) {
        return res.status(500).json({ status: 'offline', message: 'DLL não carregada.' });
    }
    try {
        // Tenta conectar e desconectar para verificar o status
        const result = controlID.Conectar('192.168.254.187', 443);
        if (result === 0) { // Supondo que 0 significa sucesso
            controlID.Desconectar();
            res.json({ status: 'online', message: 'Leitor ControlID conectado.' });
        } else {
            res.status(503).json({ status: 'error', message: `Falha ao conectar ao leitor. Código: ${result}` });
        }
    } catch (e) {
        res.status(500).json({ status: 'error', message: `Erro na DLL: ${e.message}` });
    }
});

// POST /capturar-digital: Inicia a captura e retorna o template
app.post('/capturar-digital', (req, res) => {
    if (!isDllLoaded) return res.status(500).json({ error: 'DLL não carregada.' });

    console.log('➡️ Recebida requisição para /capturar-digital');
    try {
        // A função CapturarDigital pode ser síncrona (bloqueante) ou assíncrona.
        // Assumindo que ela é bloqueante e retorna o template diretamente.
        const templateBase64 = controlID.CapturarDigital();

        if (templateBase64 && templateBase64.length > 10) {
            console.log(`✅ Digital capturada. Template: ${templateBase64.substring(0, 30)}...`);
            res.json({ success: true, template: templateBase64 });
        } else {
            console.log('❌ Captura falhou ou foi cancelada no leitor.');
            res.status(400).json({ success: false, message: 'Captura falhou ou foi cancelada.' });
        }
    } catch (e) {
        console.error('❌ Erro durante a captura:', e);
        res.status(500).json({ success: false, error: `Erro na DLL: ${e.message}` });
    }
});

// GET /usuarios: Lista usuários do dispositivo
app.get('/usuarios', (req, res) => {
    if (!isDllLoaded) return res.status(500).json({ error: 'DLL não carregada.' });
    try {
        const usuariosJsonString = controlID.ListarUsuarios();
        res.json(JSON.parse(usuariosJsonString));
    } catch (e) {
        res.status(500).json({ error: `Erro na DLL: ${e.message}` });
    }
});

// POST /identificar: Identifica uma digital
app.post('/identificar', (req, res) => {
    if (!isDllLoaded) return res.status(500).json({ error: 'DLL não carregada.' });
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: 'Template é obrigatório.' });
    try {
        const usuarioId = controlID.Identificar(template);
        if (usuarioId > 0) {
            res.json({ success: true, id: usuarioId });
        } else {
            res.status(404).json({ success: false, message: 'Digital não encontrada.' });
        }
    } catch (e) {
        res.status(500).json({ error: `Erro na DLL: ${e.message}` });
    }
});

// ENDPOINT PARA SINCRONIZAÇÃO DE EMPRESAS E SETORES
app.get('/api/sync-estruturas', async (req, res) => {
    let conn;
    try {
        const codigos = ['0017', '0018', '0020', '0025', '0026', '0028', '0029', '0030', '0031', '0032', '0033', '0034', '0035', '0036'];
        const inClause = codigos.map(c => `'${c}'`).join(',');
        
        conn = await odbc.connect('DSN=Teorema');
        
        const empresasResult = await conn.query(`SELECT EMPRESA_CODIGO, EMPRESA_NOME, EMPRESA_CNPJ FROM EMPRESAS WHERE EMPRESA_CODIGO IN (${inClause})`);
        
        const setoresResult = await conn.query(`
            SELECT DISTINCT f.EMPRESA_CODIGO, f.SECAO_CODIGO, s.SECAO_DESCRICAO 
            FROM FUNCIONARIOS f 
            JOIN SECOES s ON f.SECAO_CODIGO = s.SECAO_CODIGO 
            WHERE f.EMPRESA_CODIGO IN (${inClause})
            ORDER BY f.EMPRESA_CODIGO, s.SECAO_DESCRICAO
        `);

        res.json({
            empresas: empresasResult,
            setores: setoresResult
        });
    } catch (e) {
        console.error('Erro na sincronizacao de estruturas:', e);
        res.status(500).json({ error: 'Erro ao buscar estruturas no Teorema' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /extrair-teorema/:cpf: Extrai histórico financeiro mágico direto do banco
app.get('/extrair-teorema/:cpf', async (req, res) => {
    let conn;
    try {
        const cpfAlvo = req.params.cpf.replace(/\D/g, '');
        console.log(`\n--- INTEGRAÇÃO MÁGICA TEOREMA ---`);
        console.log(`Buscando CPF: ${cpfAlvo}`);
        
        conn = await odbc.connect('DSN=Teorema');
        
        const funcResult = await conn.query(`SELECT * FROM FUNCIONARIOS WHERE REPLACE(REPLACE(FUNCIONARIO_CPF, '.', ''), '-', '') = '${cpfAlvo}'`);
        
        if (funcResult.length === 0) {
            return res.status(404).json({ error: 'Funcionário não encontrado no Teorema com este CPF.' });
        }

        const transResultAll = await conn.query(`SELECT TRANSFERENCIA_EMPRESA_DE, TRANSFERENCIA_FUNCIONARIO_DE, TRANSFERENCIA_EMPRESA_PARA, TRANSFERENCIA_FUNCIONARIO_PARA FROM TRANSFERENCIAS`);
        
        const validKeys = funcResult.map(f => `${f.EMPRESA_CODIGO}_${f.FUNCIONARIO_CODIGO}`);
        let forwardMap = {};
        let transferMap = {}; // Reverse map for later
        for (let t of transResultAll) {
            const keyDe = `${t.TRANSFERENCIA_EMPRESA_DE}_${t.TRANSFERENCIA_FUNCIONARIO_DE}`;
            const keyPara = `${t.TRANSFERENCIA_EMPRESA_PARA}_${t.TRANSFERENCIA_FUNCIONARIO_PARA}`;
            if (validKeys.includes(keyDe) && validKeys.includes(keyPara)) {
                forwardMap[keyDe] = keyPara;
                transferMap[keyPara] = keyDe;
            }
        }

        // Descobrir o registro mais recente ou ativo como ponto de partida
        let bestFunc = funcResult[0];
        const activeFuncs = funcResult.filter(f => !f.FUNCIONARIO_DATA_DEMISSAO);
        if (activeFuncs.length > 0) {
            bestFunc = activeFuncs.sort((a, b) => new Date(b.FUNCIONARIO_DATA_ADMISSAO || 0) - new Date(a.FUNCIONARIO_DATA_ADMISSAO || 0))[0];
        } else {
            bestFunc = funcResult.sort((a, b) => new Date(b.FUNCIONARIO_DATA_ADMISSAO || 0) - new Date(a.FUNCIONARIO_DATA_ADMISSAO || 0))[0];
        }

        let finalKey = `${bestFunc.EMPRESA_CODIGO}_${bestFunc.FUNCIONARIO_CODIGO}`;
        let traceCount = 0;
        while (forwardMap[finalKey] && traceCount < 50) {
            finalKey = forwardMap[finalKey];
            traceCount++;
        }
        
        const [activeEmpresa, activeCode] = finalKey.split('_');
        const funcBase = funcResult.find(f => f.FUNCIONARIO_CODIGO === activeCode && f.EMPRESA_CODIGO === activeEmpresa) || funcResult[0];

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

        let chain = [finalKey];
        
        let currentIter = finalKey;
        traceCount = 0;
        while (transferMap[currentIter] && traceCount < 50) {
            let prevKey = transferMap[currentIter];
            if (!chain.includes(prevKey)) {
                chain.push(prevKey);
                currentIter = prevKey;
            } else {
                break;
            }
            traceCount++;
        }
        
        // Montar a cláusula WHERE composta (EMPRESA_CODIGO = X AND FUNCIONARIO_CODIGO = Y)
        const whereClauseChain = chain.map(k => {
            const [e, f] = k.split('_');
            return `(EMPRESA_CODIGO = '${e}' AND FUNCIONARIO_CODIGO = '${f}')`;
        }).join(' OR ');

        console.log(`Cadeia de transferências detectada: ${chain.join(' <- ')}`);
        
        let earliestDate = new Date('2099-01-01');
        funcResult.forEach(f => {
            const key = `${f.EMPRESA_CODIGO}_${f.FUNCIONARIO_CODIGO}`;
            if (chain.includes(key)) {
                let dStr = f.FUNCIONARIO_DATA_CONTRATO || f.FUNCIONARIO_DATA_ADMISSAO;
                if (dStr) {
                    let d = new Date(dStr);
                    if (d < earliestDate) earliestDate = d;
                }
            }
        });
        if (earliestDate.getFullYear() === 2099) earliestDate = new Date('1900-01-01');
        
        const dataAdmissao = earliestDate;
        
        // Sobrescrever os dados do funcionário com a data de admissão original consolidada
        dadosCompletos.funcionario.dataAdmissao = dataAdmissao.toISOString().split('T')[0];
        if (funcBase.FUNCIONARIO_DATA_DEMISSAO) {
            dadosCompletos.funcionario.dataDemissao = funcBase.FUNCIONARIO_DATA_DEMISSAO;
        }

        const admAno = dataAdmissao.getFullYear();
        const admMes = dataAdmissao.getMonth() + 1;
        
        console.log(`Data de admissão original considerada: ${dataAdmissao.toISOString().split('T')[0]}`);

        // 1. Movimentações Mensais
        const movResult1 = await conn.query(`SELECT MOVIMENTO_ANO as ANO, MOVIMENTO_MES as MES, EVENTO_CODIGO, MOVIMENTO_VALOR as VALOR, MOVIMENTO_REFERENCIA as REFERENCIA, '0' as TIPO, 'V' as NATUREZA, FUNCIONARIO_CODIGO as COD_FONTE FROM MOVIMENTO_MENSAL WHERE (${whereClauseChain})`);
        const movResult2 = await conn.query(`
            SELECT ms.MOVIMENTO_ANO as ANO, ms.MOVIMENTO_MES as MES, dt.EVENTO_CODIGO, dt.MOVIMENTO_VALOR as VALOR, dt.MOVIMENTO_REFERENCIA as REFERENCIA, 
            ms.MOVIMENTO_TIPO as TIPO, ms.MOVIMENTO_BASE_INSS as BASE_INSS, ms.MOVIMENTO_BASE_FGTS as BASE_FGTS, ms.MOVIMENTO_VALOR_FGTS as FGTS_MES, ms.MOVIMENTO_BASE_IRRF as BASE_IRRF,
            dt.EVENTO_NATUREZA as NATUREZA, ms.FUNCIONARIO_CODIGO as COD_FONTE
            FROM MOVIMENTO_FUNCIONARIO_MS ms
            JOIN MOVIMENTO_FUNCIONARIO_DT dt ON ms.TRANSACAO = dt.TRANSACAO
            WHERE (${whereClauseChain.replace(/EMPRESA_CODIGO/g, 'ms.EMPRESA_CODIGO').replace(/FUNCIONARIO_CODIGO/g, 'ms.FUNCIONARIO_CODIGO')})
        `);

        const movMapeadas = [...movResult1, ...movResult2].map(m => ({
            ano: String(m.ANO),
            mes: String(m.MES).padStart(2, '0'),
            verbaCodigo: m.EVENTO_CODIGO ? String(m.EVENTO_CODIGO).padStart(4, '0') : '',
            valor: m.VALOR || 0,
            referencia: m.REFERENCIA || '',
            origem: 'Teorema',
            codigoFonte: m.COD_FONTE || activeCode
        })).filter(m => {
            if (!m.ano || !m.mes) return true;
            return Number(m.ano) > admAno || (Number(m.ano) === admAno && Number(m.mes) >= admMes);
        });
        dadosCompletos.movimentacoes.push(...movMapeadas);

        // 2. Férias
        const feriasResult = await conn.query(`SELECT * FROM FUNCIONARIOS_FERIAS WHERE (${whereClauseChain})`);
        const feriasMapeadas = feriasResult.map(f => ({
            dataInicio: f.FERIAS_AQUISITIVO_INI || f.FERIAS_INICIO,
            dataFim: f.FERIAS_AQUISITIVO_FIM || f.FERIAS_FIM,
            diasGozados: f.FERIAS_DIAS_FERIAS || f.DIAS_GOZADOS || 0,
            origem: 'Teorema',
            codigoFonte: f.FUNCIONARIO_CODIGO || activeCode
        })).filter(f => {
            if (!f.dataInicio) return true;
            const d = new Date(f.dataInicio);
            return d >= dataAdmissao;
        });
        dadosCompletos.ferias.push(...feriasMapeadas);

        // 3. Salários
        const salResult = await conn.query(`SELECT * FROM EVOLUCAO_SALARIAL WHERE (${whereClauseChain})`);
        const salMapeados = salResult.map(s => ({
            data: s.EVOLUCAO_DATA,
            salario: s.EVOLUCAO_VALOR_ATUAL,
            motivo: s.EVOLUCAO_MOTIVO || '',
            origem: 'Teorema',
            codigoFonte: s.FUNCIONARIO_CODIGO || activeCode
        })).filter(s => {
            if (!s.data) return true;
            const d = new Date(s.data);
            return d >= dataAdmissao;
        });
        dadosCompletos.salarios.push(...salMapeados);

        // --- DEDUPLICAÇÃO DE SALÁRIOS ---
        const salariosUnicosMap = new Map();
        dadosCompletos.salarios.forEach(s => {
            if (!s.data) return;
            const dataIso = typeof s.data === 'string' ? s.data.split('T')[0] : s.data.toISOString().split('T')[0];
            const dedupKey = `${dataIso}_${s.salario}`;
            
            // Manter salários diferentes na mesma data, remover apenas duplicatas idênticas (já que agora os dados estão filtrados por empresa corretamente)
            if (!salariosUnicosMap.has(dedupKey)) {
                salariosUnicosMap.set(dedupKey, s);
            }
        });
        
        let salariosOrdenados = Array.from(salariosUnicosMap.values()).sort((a, b) => new Date(b.data) - new Date(a.data));
        
        let salariosFinais = [];
        let ultimoSalario = null;
        for (let i = salariosOrdenados.length - 1; i >= 0; i--) { 
            const s = salariosOrdenados[i];
            if (Number(s.salario) !== ultimoSalario) {
                salariosFinais.push(s);
                ultimoSalario = Number(s.salario);
            }
        }
        dadosCompletos.salarios = salariosFinais.reverse();

        // --- DEDUPLICAÇÃO DE FÉRIAS ---
        const feriasUnicas = new Map();
        dadosCompletos.ferias.forEach(f => {
            if(!f.dataInicio) return;
            const dataStr = f.dataInicio instanceof Date ? f.dataInicio.toISOString().split('T')[0] : String(f.dataInicio).split('T')[0];
            feriasUnicas.set(dataStr, f);
        });
        dadosCompletos.ferias = Array.from(feriasUnicas.values());

        // --- DEDUPLICAÇÃO DE MOVIMENTAÇÕES (Folha) ---
        const movsUnicas = new Map();
        dadosCompletos.movimentacoes.forEach(m => {
            if (!m.mes || !m.ano || !m.verbaCodigo) return;
            const chave = `${m.ano}-${m.mes}-${m.verbaCodigo}`;
            const existente = movsUnicas.get(chave);
            if (!existente || Number(m.valor) > Number(existente.valor)) {
                movsUnicas.set(chave, m);
            }
        });
        dadosCompletos.movimentacoes = Array.from(movsUnicas.values());
        // Retorna sucesso
        res.json({ success: true, dados: dadosCompletos });
        
    } catch (e) {
        console.error('Erro na extração mágica:', e);
        res.status(500).json({ error: `Erro na extração OBDC: ${e.message}` });
    } finally {
        if (conn) await conn.close();
    }
});

// Rota para extrair seções do Teorema para atualizar o Firebase pelo frontend
app.get('/api/teorema-setores', async (req, res) => {
    let conn;
    try {
        const odbc = require('odbc');
        conn = await odbc.connect('DSN=Teorema');
        const queryFuncionarios = 'SELECT FUNCIONARIO_CPF, SECAO_CODIGO, SETOR_CODIGO, EMPRESA_CODIGO, FUNCIONARIO_SITUACAO FROM FUNCIONARIOS WHERE FUNCIONARIO_CPF IS NOT NULL';
        const teoremaEmps = await conn.query(queryFuncionarios);

        const mapa = {};
        teoremaEmps.forEach(emp => {
            const cpf = emp.FUNCIONARIO_CPF;
            const codigo = emp.SECAO_CODIGO || emp.SETOR_CODIGO;
            const empresaCodigo = emp.EMPRESA_CODIGO;
            const situacao = emp.FUNCIONARIO_SITUACAO;
            
            if (cpf && codigo) {
                const cpfLimpo = String(cpf).replace(/\D/g, '');
                
                // Se ainda não mapeou, mapeia.
                // Se já mapeou, MAS o novo registro NÃO é demitido ('99'), ele sobrescreve (prioriza o contrato atual, seja ativo '01' ou afastado '08').
                if (!mapa[cpfLimpo] || situacao !== '99') {
                    mapa[cpfLimpo] = {
                        setor: parseInt(codigo, 10),
                        empresaCodigo: empresaCodigo ? String(empresaCodigo).trim() : null
                    };
                }
            }
        });

        // Buscar CNPJs das empresas no Teorema para mapeamento dinâmico
        const queryEmpresas = 'SELECT EMPRESA_CODIGO, EMPRESA_CNPJ FROM EMPRESAS';
        const teoremaCnpjs = await conn.query(queryEmpresas);
        const empresasTeorema = {};
        teoremaCnpjs.forEach(emp => {
            if (emp.EMPRESA_CODIGO && emp.EMPRESA_CNPJ) {
                const cnpjLimpo = String(emp.EMPRESA_CNPJ).replace(/\D/g, '');
                empresasTeorema[String(emp.EMPRESA_CODIGO).trim()] = cnpjLimpo;
            }
        });

        res.json({ success: true, data: mapa, empresasTeorema: empresasTeorema });
    } catch (error) {
        console.error('Erro ao buscar setores no Teorema:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (conn) await conn.close();
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`================================================`);
    console.log(`🚀 Servidor-Ponte ControlID rodando em http://localhost:${PORT}`);
    console.log(`================================================`);
    if (!isDllLoaded) {
        console.log('🔴 ATENÇÃO: A DLL não foi carregada. A API não funcionará.');
    }
});