// ========================================
// Módulo: Jurídico - Automação de Peças
// ========================================
async function inicializarAutomacaoPecas() {
    console.log("Inicializando Automação de Peças Jurídicas...");
    // Lógica para carregar processos no select, etc.
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

    try {
        // Substitua 'URL_DO_SEU_BACKEND' pela URL real da sua API
        const response = await fetch('URL_DO_SEU_BACKEND/api/juridico/gerar-peca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            throw new Error('Falha ao gerar a peça jurídica.');
        }

        const data = await response.json();
        originalGeneratedText = data.textoGerado; // Salva o texto original

        // Habilita o modo de edição no editor
        editor.contentEditable = "true";
        editor.innerHTML = originalGeneratedText;

    } catch (error) {
        console.error("Erro ao gerar peça com IA:", error);
        editor.innerHTML = '<p class="text-danger">Ocorreu um erro ao gerar a peça. Tente novamente.</p>';
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

    try {
        // Envia o feedback para o backend
        const response = await fetch('URL_DO_SEU_BACKEND/api/juridico/feedback', {
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