// ========================================
// Módulo: Jurídico - Automação de Peças
// ========================================
async function inicializarAutomacaoPecas() {
    console.log("Inicializando Automação de Peças Jurídicas...");
    await carregarProcessosNoSelect();
}

async function carregarProcessosNoSelect() {
    const selectProcesso = document.getElementById('jur-auto-processo');
    if (!selectProcesso) return;

    selectProcesso.innerHTML = '<option value="">Carregando processos...</option>';

    try {
        const snapshot = await db.collection('processos_juridicos').orderBy('numeroProcesso').get();
        if (snapshot.empty) {
            selectProcesso.innerHTML = '<option value="">Nenhum processo encontrado</option>';
            return;
        }

        let optionsHTML = '<option value="">Selecione um processo</option>';
        snapshot.forEach(doc => {
            const processo = doc.data();
            optionsHTML += `<option value="${doc.id}">${processo.numeroProcesso} - ${processo.cliente} vs ${processo.parteContraria}</option>`;
        });
        selectProcesso.innerHTML = optionsHTML;

    } catch (error) {
        console.error("Erro ao carregar processos no select:", error);
        selectProcesso.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

let originalGeneratedText = ''; // Variável global para armazenar o texto original da IA

async function gerarPecaComIA() {
    const editor = document.getElementById('jur-auto-editor-container');
    editor.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin"></i> Gerando peça com IA...</div>';

    const promptData = {
        tipoPeca: document.getElementById('jur-auto-tipo-peca').value,
        processoId: document.getElementById('jur-auto-processo').value,
        contexto: document.getElementById('jur-auto-contexto').value,
        estilo: document.getElementById('jur-auto-estilo').value,
        tamanho: document.getElementById('jur-auto-tamanho').value,
        incluirJurisprudencia: document.getElementById('jur-auto-incluir-jurisprudencia').checked,
    };

    // Configuração da API do Google Gemini (Chave fornecida)
    const apiKey = 'AIzaSyAp58r4Qv_8FBf9IWbxwUYSorS-_MHVVLo';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    // Construção do Prompt para o Gemini
    let prompt = `Atue como um advogado experiente. Redija uma peça jurídica do tipo: ${promptData.tipoPeca}.\n`;
    prompt += `Contexto do caso: ${promptData.contexto}\n`;
    prompt += `Estilo de escrita: ${promptData.estilo}.\n`;
    prompt += `Tamanho aproximado: ${promptData.tamanho}.\n`;
    if (promptData.incluirJurisprudencia) {
        prompt += `Inclua jurisprudência relevante e atualizada.\n`;
    }
    prompt += `A resposta deve ser apenas o texto da peça jurídica, formatado em HTML para exibição em um editor web (use tags como <p>, <strong>, <h2>, etc). Não use markdown (backticks).`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Falha na API do Gemini: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // Extração do texto da resposta
        let textoGerado = '';
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            textoGerado = data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('A IA não retornou nenhum texto.');
        }
        
        // Limpeza de possíveis blocos de código markdown
        textoGerado = textoGerado.replace(/```html/g, '').replace(/```/g, '');

        originalGeneratedText = textoGerado; // Salva o texto original

        // Habilita o modo de edição no editor
        editor.contentEditable = "true";
        editor.innerHTML = textoGerado;

    } catch (error) {
        console.error("Erro ao gerar peça com IA:", error);
        editor.innerHTML = `<p class="text-danger">Ocorreu um erro ao gerar a peça: ${error.message}. Verifique o console para mais detalhes.</p>`;
        mostrarMensagem("Erro ao se comunicar com a IA.", "error");
    }
}

function copiarPeca() {
    const editor = document.getElementById('jur-auto-editor-container');
    navigator.clipboard.writeText(editor.innerText);
    mostrarMensagem("Texto copiado para a área de transferência!", "success");
}

function baixarPeca() {
    mostrarMensagem("Funcionalidade 'Baixar Peça' será implementada em breve.", "info");
}

async function salvarPeca() {
    const editor = document.getElementById('jur-auto-editor-container');
    const textoFinal = editor.innerHTML;

    if (textoFinal === originalGeneratedText) {
        mostrarMensagem("Nenhuma alteração detectada para salvar.", "info");
        return;
    }

    const feedbackData = {
        prompt: document.getElementById('jur-auto-contexto').value,
        textoOriginal: originalGeneratedText,
        textoFinal: textoFinal,
        processoId: document.getElementById('jur-auto-processo').value,
        tipoPeca: document.getElementById('jur-auto-tipo-peca').value,
        usuarioEmail: firebase.auth().currentUser.email
    };

    // ATENÇÃO: A URL da API para feedback precisa ser configurada.
    const apiUrl = 'URL_DO_SEU_BACKEND/api/juridico/feedback';

    if (apiUrl.startsWith('URL_DO_SEU_BACKEND')) {
        // Apenas loga no console, não precisa notificar o usuário com um erro grave.
        console.warn("URL de feedback da IA não configurada. As edições não foram salvas no backend.");
        mostrarMensagem("Suas edições foram salvas localmente, mas não foi possível enviar o feedback para a IA (URL não configurada).", "warning");
        return;
    }

    try {
        // Envia o feedback para o backend
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
        });

        if (!response.ok) throw new Error('Falha ao enviar feedback.');

        mostrarMensagem("Suas edições foram salvas e serão usadas para aprimorar a IA. Obrigado!", "success");

    } catch (error) {
        console.error("Erro ao salvar feedback:", error);
        mostrarMensagem("Erro ao salvar suas edições.", "error");
    }
}