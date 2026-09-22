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

        const codFuncionario = funcBase.FUNCIONARIO_CODIGO;
        
        // 1. Movimentações Mensais
        const movResult1 = await conn.query(`SELECT MOVIMENTO_ANO as ANO, MOVIMENTO_MES as MES, EVENTO_CODIGO, MOVIMENTO_VALOR as VALOR, MOVIMENTO_REFERENCIA as REFERENCIA, '0' as TIPO, 'V' as NATUREZA FROM MOVIMENTO_MENSAL WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
        const movResult2 = await conn.query(`
            SELECT ms.MOVIMENTO_ANO as ANO, ms.MOVIMENTO_MES as MES, dt.EVENTO_CODIGO, dt.MOVIMENTO_VALOR as VALOR, dt.MOVIMENTO_REFERENCIA as REFERENCIA, 
            ms.MOVIMENTO_TIPO as TIPO, ms.MOVIMENTO_BASE_INSS as BASE_INSS, ms.MOVIMENTO_BASE_FGTS as BASE_FGTS, ms.MOVIMENTO_VALOR_FGTS as FGTS_MES, ms.MOVIMENTO_BASE_IRRF as BASE_IRRF,
            dt.EVENTO_NATUREZA as NATUREZA
            FROM MOVIMENTO_FUNCIONARIO_MS ms
            JOIN MOVIMENTO_FUNCIONARIO_DT dt ON ms.TRANSACAO = dt.TRANSACAO
            WHERE ms.FUNCIONARIO_CODIGO = '${codFuncionario}'
        `);
        
        const dataAdmissaoStr = funcBase.FUNCIONARIO_DATA_CONTRATO || funcBase.FUNCIONARIO_DATA_ADMISSAO;
        const dataAdmissao = dataAdmissaoStr ? new Date(dataAdmissaoStr) : new Date('1900-01-01');
        const admAno = dataAdmissao.getFullYear();
        const admMes = dataAdmissao.getMonth() + 1;

        const movMapeadas = [...movResult1, ...movResult2].map(m => ({
            ano: String(m.ANO),
            mes: String(m.MES).padStart(2, '0'),
            verbaCodigo: m.EVENTO_CODIGO ? String(m.EVENTO_CODIGO).padStart(4, '0') : '',
            valor: m.VALOR || 0,
            referencia: m.REFERENCIA || '',
            origem: 'Teorema',
            codigoFonte: codFuncionario
        })).filter(m => {
            if (!m.ano || !m.mes) return true;
            return Number(m.ano) > admAno || (Number(m.ano) === admAno && Number(m.mes) >= admMes);
        });
        dadosCompletos.movimentacoes.push(...movMapeadas);

        // 2. Férias
        const feriasResult = await conn.query(`SELECT * FROM FUNCIONARIOS_FERIAS WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
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

        // 3. Salários
        const salResult = await conn.query(`SELECT * FROM EVOLUCAO_SALARIAL WHERE FUNCIONARIO_CODIGO = '${codFuncionario}'`);
        const salMapeados = salResult.map(s => ({
            data: s.EVOLUCAO_DATA,
            salario: s.EVOLUCAO_VALOR_ATUAL,
            motivo: s.EVOLUCAO_MOTIVO || '',
            origem: 'Teorema',
            codigoFonte: codFuncionario
        })).filter(s => {
            if (!s.data) return true;
            const d = new Date(s.data);
            return d >= dataAdmissao;
        });
        dadosCompletos.salarios.push(...salMapeados);

        // Retorna sucesso
        res.json({ success: true, dados: dadosCompletos });
        
    } catch (e) {
        console.error('Erro na extração mágica:', e);
        res.status(500).json({ error: `Erro na extração OBDC: ${e.message}` });
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