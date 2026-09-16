class NexterAIController {
    constructor() {
        this.conversationHistory = [];
        this.isRecording = false;
        this.recognition = null;
        
        this.setupSpeechRecognition();
        this.bindEvents();
    }

    bindEvents() {
        // Usa delegação de eventos para suportar views carregadas dinamicamente
        document.addEventListener('click', (e) => {
            // Chat Mode
            if (e.target.closest('#btn-send-message')) {
                this.sendMessage(false);
            }
            if (e.target.closest('#btn-voice-command')) {
                this.toggleVoiceRecording(false);
            }
            
            // Jarvis Mode
            if (e.target.closest('#jarvis-btn-send')) {
                this.sendMessage(true);
            }
            if (e.target.closest('#jarvis-btn-voice')) {
                this.toggleVoiceRecording(true);
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (e.target.id === 'ai-text-input') {
                    this.sendMessage(false);
                }
                if (e.target.id === 'jarvis-ai-input') {
                    this.sendMessage(true);
                }
            }
        });
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'pt-BR';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onstart = () => {
                this.isRecording = true;
                const btnVoice = document.getElementById('btn-voice-command');
                const jarvisBtnVoice = document.getElementById('jarvis-btn-voice');
                
                if (this.isJarvisModeActive && jarvisBtnVoice) {
                    jarvisBtnVoice.classList.add('voice-recording');
                    this.setJarvisStatus('Ouvindo...', true);
                } else if (btnVoice) {
                    btnVoice.classList.add('voice-recording');
                    this.setStatus('Ouvindo...', true);
                }
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (this.isJarvisModeActive) {
                    const jarvisInput = document.getElementById('jarvis-ai-input');
                    if (jarvisInput) jarvisInput.value = transcript;
                    this.sendMessage(true, transcript);
                } else {
                    const inputEl = document.getElementById('ai-text-input');
                    if (inputEl) inputEl.value = transcript;
                    this.sendMessage(false, transcript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Erro no reconhecimento de voz:', event.error);
                if (this.isJarvisModeActive) {
                    this.setJarvisStatus('Erro ao ouvir.', false);
                } else {
                    this.setStatus('Erro ao ouvir.', false);
                }
                this.stopRecording();
            };

            this.recognition.onend = () => {
                this.stopRecording();
            };
        } else {
            console.warn('Reconhecimento de voz não suportado neste navegador.');
        }
    }

    toggleVoiceRecording(isJarvis = false) {
        this.isJarvisModeActive = isJarvis;
        
        if (!this.recognition) {
            alert('Seu navegador não suporta comandos de voz.');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch(e) {
                console.error("Erro ao iniciar gravação", e);
            }
        }
    }

    stopRecording() {
        this.isRecording = false;
        const btnVoice = document.getElementById('btn-voice-command');
        const jarvisBtnVoice = document.getElementById('jarvis-btn-voice');
        const statusText = document.getElementById('ai-status-text');
        const jarvisMessage = document.getElementById('jarvis-message');
        
        if(btnVoice) btnVoice.classList.remove('voice-recording');
        if(jarvisBtnVoice) jarvisBtnVoice.classList.remove('voice-recording');
        
        if (statusText && statusText.innerText === 'Ouvindo...') {
            this.setStatus('Como posso ajudar hoje?', false);
        }
        if (jarvisMessage && jarvisMessage.innerHTML.includes('Ouvindo...')) {
            this.setJarvisStatus('Aguardando comando...', false);
        }
    }

    setStatus(text, isLoading) {
        const statusText = document.getElementById('ai-status-text');
        const statusIndicator = document.getElementById('ai-status-indicator');
        if(statusText) statusText.innerText = text;
        if(statusIndicator) {
            statusIndicator.style.display = isLoading ? 'block' : 'none';
        }
    }

    setJarvisStatus(text, isLoading) {
        const jarvisMessage = document.getElementById('jarvis-message');
        const jarvisLoader = document.getElementById('jarvis-ai-loader');
        if(jarvisMessage) jarvisMessage.innerHTML = text;
        if(jarvisLoader) {
            jarvisLoader.style.display = isLoading ? 'block' : 'none';
        }
    }

    async sendMessage(isJarvis = false, textInput = null) {
        const inputEl = document.getElementById(isJarvis ? 'jarvis-ai-input' : 'ai-text-input');
        
        let text = textInput;
        if (!text && inputEl) {
            text = inputEl.value.trim();
        }
        
        if (!text) return;

        // Limpar input
        if (inputEl) inputEl.value = '';

        // Adicionar na tela
        if (isJarvis) {
            this.setJarvisStatus(`<b>Você:</b> ${text}`, true);
        } else {
            this.appendMessage('user', text);
        }
        
        this.conversationHistory.push({ role: 'user', content: text });

        await this.processTurn(isJarvis);
    }

    async processTurn(isJarvis = false) {
        if (isJarvis) {
            this.setJarvisStatus('Analisando...', true);
        } else {
            this.setStatus('Analisando...', true);
        }

        try {
            const response = await this.callAIBackend(this.conversationHistory);
            
            if (response.type === 'text') {
                this.conversationHistory.push({ role: 'assistant', content: response.content });
                
                if (isJarvis) {
                    // Formatar texto simples para o Jarvis
                    let formatted = response.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
                    this.setJarvisStatus(formatted, false);
                } else {
                    this.appendMessage('assistant', response.content);
                    this.setStatus('Como posso ajudar hoje?', false);
                }
            } 
            else if (response.type === 'tool_calls') {
                if (isJarvis) this.setJarvisStatus('Consultando dados do Nexter...', true);
                else this.setStatus('Consultando dados do Nexter...', true);
                
                const toolCall = response.tool_calls[0];
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
                this.conversationHistory.push({
                    role: 'assistant',
                    tool_calls: [toolCall],
                    content: ""
                });

                // Executar ferramenta localmente
                if (nexterAITools.executors[functionName]) {
                    const result = await nexterAITools.executors[functionName](args);
                    
                    this.conversationHistory.push({
                        role: 'tool',
                        name: functionName,
                        content: result
                    });

                    if (isJarvis) this.setJarvisStatus('Gerando resposta...', true);
                    else this.setStatus('Gerando resposta...', true);
                    
                    await this.processTurn(isJarvis); 
                } else {
                    this.conversationHistory.push({
                        role: 'tool',
                        name: functionName,
                        content: JSON.stringify({ erro: "Ferramenta não implementada." })
                    });
                    await this.processTurn(isJarvis);
                }
            }
        } catch (error) {
            console.error('Erro ao processar turno:', error);
            if (isJarvis) {
                this.setJarvisStatus('Desculpe, ocorreu um erro técnico ao processar sua solicitação.', false);
            } else {
                this.appendMessage('assistant', 'Desculpe, ocorreu um erro técnico ao processar sua solicitação.');
                this.setStatus('Como posso ajudar hoje?', false);
            }
        }
    }

    async callAIBackend(messages) {
        // ------------------ CONTEXTO DE MACHINE LEARNING ------------------
        let contextoUsuario = "Usuário não identificado.";
        let stringPreferencias = "";
        
        try {
            if (window.firebase && window.db) {
                const user = firebase.auth().currentUser;
                if (user) {
                    contextoUsuario = `Nome do usuário logado: ${user.displayName || 'Desconhecido'} (Email: ${user.email}). Trate-o(a) pelo nome.`;
                    
                    // Busca preferências aprendidas
                    const prefsDoc = await db.collection('ai_user_preferences').doc(user.uid).get();
                    if (prefsDoc.exists && prefsDoc.data().preferences) {
                        const prefsArray = prefsDoc.data().preferences.map(p => p.instrucao);
                        if (prefsArray.length > 0) {
                            stringPreferencias = `\nPREFERÊNCIAS APRENDIDAS DESTE USUÁRIO (Siga-as estritamente):\n- ${prefsArray.join('\n- ')}`;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao carregar contexto de ML:", err);
        }
        // ------------------------------------------------------------------

        // 1. Tenta usar a Serverless Function da Vercel (Produção)
        try {
            const response = await fetch('/api/nexter-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    tools: nexterAITools.schemas,
                    userContext: `${contextoUsuario} ${stringPreferencias}`
                })
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.warn("Falha ao comunicar com a rota Vercel. Tentando fallback local...");
        }

        // 2. Fallback para Desenvolvimento Local (Live Server)
        // Como o Live Server (porta 5500) não roda Node.js e retorna erro 405 (Method Not Allowed) em chamadas POST,
        // faremos a requisição diretamente ao Gemini pelo frontend apenas para testes locais.
        console.warn("⚠️ AVISO: Usando chamada direta ao Gemini pelo Frontend (Modo Local).");
        const apiKey = localStorage.getItem('gemini_api_key') || "";
        const model = "gemini-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiContents = messages.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: "user",
                    parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
                };
            }
            if (msg.role === 'assistant' && msg.tool_calls) {
                return {
                    role: "model",
                    parts: msg.tool_calls.map(call => {
                        if (call.rawPart) return call.rawPart;
                        return {
                            functionCall: { name: call.function.name, args: JSON.parse(call.function.arguments) }
                        };
                    })
                };
            }
            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            };
        });

        const today = new Date();
        const strHoje = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const systemInstruction = {
            parts: [{ text: `Você é o NEXTER AI, um assistente inteligente de RH integrado ao sistema Nexter. A data de hoje é ${strHoje}. ${contextoUsuario} ${stringPreferencias}\n\nSeu objetivo é analisar dados de RH. REGRA DE OURO: Responda de forma EXTREMAMENTE direta e concisa. Se o usuário perguntar uma métrica específica (ex: "quantos pedidos de demissão", "quantas faltas", "valor de horas extras"), responda APENAS o número ou uma frase curta, SEM gerar panoramas, quebras ou tabelas adicionais. Só exiba tabelas ou detalhamentos se ele explicitamente pedir. Exceção: Se você consultar Horas Extras e houver valores separados ("valor_total_por_fora" e "valor_total_na_folha"), informe os dois valores na sua resposta curta (já que o Dashboard costuma filtrar apenas o valor Por Fora). Você NÃO DEVE inventar dados. Sempre utilize as ferramentas (tools) fornecidas. Se o usuário pedir um PDF, VOCÊ DEVE OBRIGATORIAMENTE chamar a ferramenta "gerarRelatorioPDF". Ao criar o conteúdo HTML para o PDF, INICIE SEMPRE COM UM DASHBOARD VISUAL DE INDICADORES: use CSS Flexbox inline para criar "cards" (caixas com bordas arredondadas, fundo claro, números grandes e chamativos) para os totais principais ANTES das tabelas detalhadas, de forma a ficar parecido com o sistema Nexter. Ao relatar faltas históricas, lembre-se que o sistema registra faltas por TURNO (manhã/tarde). Então 6 faltas no banco de dados podem significar 3 dias inteiros de ausência. Explique isso ao usuário. Formate respostas de texto em Markdown.` }]
        };

        const payload = {
            systemInstruction: systemInstruction,
            contents: geminiContents,
            tools: [{ functionDeclarations: nexterAITools.schemas }],
            generationConfig: { temperature: 0.2 }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error("Erro da API Gemini (Direta):", await res.text());
            throw new Error("Erro na API direta do Gemini.");
        }
        
        const data = await res.json();
        const candidate = data.candidates?.[0];
        
        if (!candidate) throw new Error("Resposta inválida da IA.");

        const parts = candidate.content.parts;
        const functionCallPart = parts.find(p => p.functionCall);

        if (functionCallPart) {
            return {
                type: 'tool_calls',
                tool_calls: [{
                    id: "call_" + Math.random().toString(36).substring(7),
                    function: {
                        name: functionCallPart.functionCall.name,
                        arguments: JSON.stringify(functionCallPart.functionCall.args || {})
                    },
                    rawPart: functionCallPart
                }]
            };
        }

        const textPart = parts.find(p => p.text);
        if (textPart) {
            return { type: 'text', content: textPart.text };
        }

        throw new Error("A IA não retornou uma resposta compreensível.");
    }

    appendMessage(role, text) {
        const chatContainer = document.getElementById('chat-messages-container');
        if (!chatContainer) return;

        const isUser = role === 'user';
        const icon = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        const alignClass = isUser ? 'flex-row-reverse' : '';
        const bgClass = isUser ? 'chat-message-user' : 'chat-message-ai border border-light';
        
        // Conversão super simples de Markdown para HTML (negrito, quebra de linha)
        let formattedText = text;
        if (!isUser) {
            formattedText = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }

        const msgHtml = `
            <div class="d-flex mb-4 ${alignClass}">
                <div class="${isUser ? 'ms-3' : 'me-3'}">
                    <div class="${isUser ? 'bg-secondary' : 'bg-primary'} text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" style="width: 40px; height: 40px;">
                        ${icon}
                    </div>
                </div>
                <div class="${bgClass} p-3 shadow-sm w-75 ai-response-content" style="border-radius: 15px;">
                    <p class="mb-0">${formattedText}</p>
                </div>
            </div>
        `;

        chatContainer.insertAdjacentHTML('beforeend', msgHtml);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chat-messages-container');
        if(chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    limparConversa() {
        this.conversationHistory = [];
        const chatContainer = document.getElementById('chat-messages-container');
        if(chatContainer) {
            // Remove tudo exceto a primeira mensagem (boas vindas)
            const children = Array.from(chatContainer.children);
            for (let i = 1; i < children.length; i++) {
                children[i].remove();
            }
        }
    }
}

// Inicializar quando a tela carregar
let nexterAI;
document.addEventListener('DOMContentLoaded', () => {
    // Como a navegação do sistema parece ser via SPA/jQuery hide/show ou fetch,
    // podemos precisar de um observer ou reinicializar. Mas por via das dúvidas:
    nexterAI = new NexterAIController();
});

// Expor globalmente se precisar ser recriado pela navegação do sistema
window.initNexterAI = () => {
    nexterAI = new NexterAIController();
};
