// server.js
const express = require('express');
const cors = require('cors');
const koffi = require('koffi');

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


app.listen(PORT, '127.0.0.1', () => {
    console.log(`================================================`);
    console.log(`🚀 Servidor-Ponte ControlID rodando em http://localhost:${PORT}`);
    console.log(`================================================`);
    if (!isDllLoaded) {
        console.log('🔴 ATENÇÃO: A DLL não foi carregada. A API não funcionará.');
    }
});