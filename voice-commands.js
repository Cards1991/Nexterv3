document.addEventListener('DOMContentLoaded', () => {
    const btnVoiceCommand = document.getElementById('btn-voice-command');

    // Verifica se a API de reconhecimento de voz é suportada pelo navegador
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Seu navegador não suporta a Web Speech API. O comando de voz está desativado.");
        if (btnVoiceCommand) btnVoiceCommand.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR'; // Define o idioma para Português do Brasil
    recognition.interimResults = false; // Retorna apenas o resultado final
    recognition.maxAlternatives = 1; // Retorna apenas a transcrição mais provável

    let isListening = false;

    if (btnVoiceCommand) {
        btnVoiceCommand.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
                return;
            }
            try {
                recognition.start();
            } catch (error) {
                console.error("Erro ao iniciar o reconhecimento de voz:", error);
                alert("Não foi possível iniciar o comando de voz. Verifique as permissões do microfone.");
            }
        });
    }

    // Evento disparado quando o reconhecimento de voz começa
    recognition.onstart = () => {
        isListening = true;
        btnVoiceCommand.querySelector('i').classList.add('fa-beat');
        btnVoiceCommand.title = "Ouvindo... Clique para parar.";
    };

    // Evento disparado quando o reconhecimento de voz termina
    recognition.onend = () => {
        isListening = false;
        btnVoiceCommand.querySelector('i').classList.remove('fa-beat');
        btnVoiceCommand.title = "Comando de Voz";
    };

    // Evento para lidar com erros
    recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
    };

    // Evento principal: quando um resultado é obtido
    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();
        console.log('Comando recebido:', command);

        processCommand(command);
    };

    function processCommand(command) {
        // Mapeamento de comandos para funções existentes no seu sistema
        if (command.includes('dashboard') || command.includes('início')) {
            showSection('dashboard');
        } else if (command.includes('agenda')) {
            showSection('agenda');
        } else if (command.includes('funcionários')) {
            showSection('funcionarios');
        } else if (command.includes('admissão') || command.includes('admitir')) {
            showSection('admissao');
        } else if (command.includes('demissão') || command.includes('demitir')) {
            showSection('demissao');
        } else {
            console.log(`Comando "${command}" não reconhecido.`);
            // Opcional: usar text-to-speech para dar feedback ao usuário
        }
    }
});