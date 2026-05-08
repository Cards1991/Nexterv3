// js/ai-assistant.js
// Módulo para o Assistente de IA e Chat Inteligente

document.addEventListener('viewsLoaded', () => {
    console.log("🤖 Inicializando Assistente de IA após carregamento das views...");

    const chatFab = document.getElementById('ai-chat-fab');
    const chatWindow = document.getElementById('ai-chat-window');
    const closeButton = document.getElementById('ai-chat-close');
    const sendButton = document.getElementById('ai-chat-send');
    const chatInput = document.getElementById('ai-chat-input');
    const chatBody = document.getElementById('ai-chat-body');

    if (!chatFab || !chatWindow || !closeButton || !sendButton || !chatInput || !chatBody) {
        // Silenciosamente ignora se os elementos não existirem na página atual
        return;
    }

    const toggleChatWindow = () => {
        chatWindow.classList.toggle('open');
    };

    const sendMessage = () => {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;

        // Adiciona a mensagem do usuário à interface
        appendMessage(messageText, 'user');
        chatInput.value = '';

        // Simula o envio para o backend e recebe uma resposta
        showTypingIndicator();
        setTimeout(() => {
            const commandResponse = processUserCommand(messageText);
            removeTypingIndicator();
            appendMessage(commandResponse, 'assistant');
        }, 1500);
    };

    const appendMessage = (text, sender) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = text; 

        messageDiv.appendChild(bubble);
        chatBody.appendChild(messageDiv);
        chatBody.scrollTop = chatBody.scrollHeight; 
    };

    const showTypingIndicator = () => {
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'chat-message assistant';
        typingIndicator.innerHTML = `
            <div class="message-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        chatBody.appendChild(typingIndicator);
        chatBody.scrollTop = chatBody.scrollHeight;
    };

    const removeTypingIndicator = () => {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    };

    const processUserCommand = (command) => {
        const lowerCaseCommand = command.toLowerCase();
        if (lowerCaseCommand.includes('inconsistências') || lowerCaseCommand.includes('analise')) {
            return "Iniciando análise de inconsistências cadastrais... <br>Acesse a seção 'Análise de Pendências' para ver os resultados.";
        } else if (lowerCaseCommand.includes('corrija')) {
            return "Ok, iniciando o agente de autocorreção. <br>As correções de alta confiança serão aplicadas automaticamente. As demais irão para revisão humana.";
        } else if (lowerCaseCommand.includes('riscos de demissão')) {
            return "Analisando dados de turnover e desempenho... <br>O relatório de riscos de demissão está sendo gerado na seção 'Análise de Rescisão'.";
        } else if (lowerCaseCommand.includes('ações')) {
            return "Com base nos dados atuais, sugiro as seguintes ações: <br>1. Revisar as <strong>3 pendências</strong> de cadastro com score de confiança médio. <br>2. Acompanhar o funcionário <strong>João Silva</strong>, que apresenta alto risco de turnover.";
        }

        return "Desculpe, não entendi o comando. Tente algo como 'analise inconsistências' ou 'mostre os riscos de demissão'.";
    };

    // Event Listeners
    chatFab.addEventListener('click', toggleChatWindow);
    closeButton.addEventListener('click', toggleChatWindow);
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Adicionar estilos para o indicador de digitação (se ainda não existirem)
    if (!document.getElementById('ai-chat-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-chat-styles';
        style.innerHTML = `
            .typing-dot {
                height: 8px;
                width: 8px;
                background-color: #999;
                border-radius: 50%;
                display: inline-block;
                animation: wave 1.3s linear infinite;
                margin: 0 2px;
            }
            .typing-dot:nth-child(2) { animation-delay: -1.1s; }
            .typing-dot:nth-child(3) { animation-delay: -0.9s; }
            @keyframes wave {
                0%, 60%, 100% { transform: initial; }
                30% { transform: translateY(-8px); }
            }
        `;
        document.head.appendChild(style);
    }
});