// api/nexter-ai.js

// Usa a versão nativa do fetch no Node 18+
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { messages, tools, userContext } = req.body;
        // Chave configurada via Vercel ou Fallback temporário adicionado conforme solicitado
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("GEMINI_API_KEY não configurada na Vercel.");
            return res.status(500).json({ error: "Chave da API do Gemini não configurada no servidor." });
        }

        // Modelo a ser usado
        const model = "gemini-flash-latest";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Prepara o payload para o Gemini
        // Convertemos as mensagens do formato padrão para o formato do Gemini
        const geminiContents = messages.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: msg.name,
                            response: { result: msg.content }
                        }
                    }]
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
        const finalContext = userContext ? userContext : "Usuário não identificado.";
        
        // Adiciona instrução do sistema (System Prompt)
        const systemInstruction = {
            parts: [{ text: `Você é o NEXTER AI, um assistente inteligente de RH integrado ao sistema Nexter. A data de hoje é ${strHoje}. ${finalContext}\n\nSeu objetivo é analisar dados de RH e responder de forma clara. Você NÃO DEVE inventar dados. Sempre utilize as ferramentas (tools) fornecidas. Se o usuário pedir um PDF, VOCÊ DEVE OBRIGATORIAMENTE chamar a ferramenta "gerarRelatorioPDF". Ao criar o conteúdo HTML para o PDF, INICIE SEMPRE COM UM DASHBOARD VISUAL DE INDICADORES: use CSS Flexbox inline para criar "cards" (caixas com bordas arredondadas, fundo claro, números grandes e chamativos) para os totais principais ANTES das tabelas detalhadas, de forma a ficar parecido com o sistema Nexter. Ao relatar faltas históricas, lembre-se que o sistema registra faltas por TURNO (manhã/tarde). Então 6 faltas no banco de dados podem significar 3 dias inteiros de ausência. Explique isso ao usuário. Formate respostas de texto em Markdown.` }]
        };

        const payload = {
            systemInstruction: systemInstruction,
            contents: geminiContents,
            tools: [{ functionDeclarations: tools }],
            generationConfig: {
                temperature: 0.2
            }
        };

        // Faz a chamada à API do Gemini
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro da API do Gemini:", errorText);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        
        // Verifica se a resposta foi barrada ou falhou
        const candidate = data.candidates?.[0];
        if (!candidate) {
            return res.status(500).json({ error: "Resposta inesperada da API." });
        }

        // Verifica se a IA decidiu chamar uma ferramenta
        const parts = candidate.content.parts;
        const functionCallPart = parts.find(p => p.functionCall);

        if (functionCallPart) {
            // A IA quer usar uma ferramenta local
            return res.json({
                type: 'tool_calls',
                tool_calls: [{
                    id: "call_" + Math.random().toString(36).substring(7),
                    function: {
                        name: functionCallPart.functionCall.name,
                        arguments: JSON.stringify(functionCallPart.functionCall.args || {})
                    },
                    rawPart: functionCallPart
                }]
            });
        }

        // Se não for chamada de ferramenta, retorna o texto
        const textPart = parts.find(p => p.text);
        if (textPart) {
            return res.status(200).json({
                type: 'text',
                content: textPart.text
            });
        }

        return res.status(500).json({ error: "A IA não retornou uma resposta compreensível." });

    } catch (error) {
        console.error("Erro interno na API Nexter AI:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
}
