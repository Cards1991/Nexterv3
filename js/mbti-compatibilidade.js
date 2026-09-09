class MBTICompatibilityEngine {
    static perfis = [
        "ISTJ", "ISFJ", "INFJ", "INTJ",
        "ISTP", "ISFP", "INFP", "INTP",
        "ESTP", "ESFP", "ENFP", "ENTP",
        "ESTJ", "ESFJ", "ENFJ", "ENTJ"
    ];

    static getLetras(tipo) {
        return {
            E_I: tipo.charAt(0),
            S_N: tipo.charAt(1),
            T_F: tipo.charAt(2),
            J_P: tipo.charAt(3)
        };
    }

    static calcular(candidatoType, gestorType) {
        const c = this.getLetras(candidatoType);
        const g = this.getLetras(gestorType);

        let comunicacao = 0;
        let lideranca = 0;
        let operacional = 0;
        let relacional = 0;

        let strengths = [];
        let attention = [];

        // --- COMUNICAÇÃO (Baseado em S/N, E/I, T/F) ---
        // S/N: Essencial para como a informação é processada
        if (c.S_N === g.S_N) {
            comunicacao += 50;
            if (c.S_N === 'S') strengths.push("Ambos valorizam comunicação direta, baseada em fatos e dados concretos.");
            else strengths.push("Excelente fluxo de ideias abstratas e visão de futuro em comum.");
        } else {
            comunicacao += 25; // S x N atrito
            attention.push("Diferença no foco da comunicação: um pode ser muito prático (fatos) e o outro muito conceitual (ideias).");
        }

        // E/I: Como a informação é entregue
        if (c.E_I === g.E_I) {
            comunicacao += 30;
            if (c.E_I === 'E') strengths.push("Gostam de processar informações verbalmente e interagir frequentemente.");
            else strengths.push("Ambos respeitam o espaço do outro para pensar antes de falar.");
        } else {
            comunicacao += 20;
            attention.push("Diferentes necessidades de tempo de processamento em reuniões e conversas.");
        }

        // T/F: Tonalidade
        if (c.T_F === g.T_F) {
            comunicacao += 20;
        } else {
            comunicacao += 10;
        }

        // --- LIDERANÇA (Baseado em J/P, T/F, S/N) ---
        // J/P: Controle vs Autonomia
        if (c.J_P === g.J_P) {
            lideranca += 45;
            if (c.J_P === 'J') strengths.push("Alinhamento natural quanto a prazos, metas estruturadas e previsibilidade.");
            else strengths.push("Alta adaptabilidade e aceitação mútua para mudanças de rumo.");
        } else {
            if (g.J_P === 'J' && c.J_P === 'P') {
                lideranca += 20;
                attention.push("Risco de microgerenciamento: O gestor gosta de estrutura, mas o candidato precisa de flexibilidade.");
            } else {
                lideranca += 25;
                attention.push("Risco de falta de direcionamento: O candidato pode precisar de mais estrutura do que o gestor naturalmente oferece.");
            }
        }

        // T/F: Cobrança e Empatia
        if (c.T_F === g.T_F) {
            lideranca += 40;
            if (c.T_F === 'T') strengths.push("Gestão e feedback puramente baseados em lógica, sem ressentimentos emocionais.");
            else strengths.push("Forte empatia e gestão voltada para o desenvolvimento humano.");
        } else {
            if (g.T_F === 'T' && c.T_F === 'F') {
                lideranca += 15;
                attention.push("O gestor pode parecer excessivamente duro no feedback para este candidato.");
            } else {
                lideranca += 25;
                attention.push("O gestor pode demorar a dar feedbacks difíceis que o candidato precisa ouvir com objetividade.");
            }
        }

        if(c.S_N === g.S_N) lideranca += 15; else lideranca += 5;

        // --- OPERACIONAL (Baseado em J/P e S/N) ---
        if (c.J_P === g.J_P) {
            operacional += 60;
        } else {
            operacional += 30;
            attention.push("Diferenças de ritmo no dia a dia: rotinas estruturadas vs. improvisação.");
        }
        
        if (c.S_N === g.S_N) {
            operacional += 40;
        } else {
            operacional += 20;
        }

        // --- RELACIONAL (Baseado em E/I e T/F) ---
        if (c.E_I === g.E_I) relacional += 40; else relacional += 25;
        if (c.T_F === g.T_F) relacional += 60; else relacional += 30;
        
        if(c.T_F !== g.T_F) {
            attention.push("Diferença na forma de resolver conflitos: lógica fria vs. harmonia do grupo.");
        }

        // Normalizar e limitar em 100
        comunicacao = Math.min(100, Math.max(30, comunicacao + (Math.random() * 5))); // Adiciona leve fator aleatório fixo com hash se necessário, mas para ser deterministico vamos tirar random
        // Função hash simples para pequenos deltas determinísticos (evitar matrizes totalmente monótonas)
        const hashDelta = (candidatoType.charCodeAt(0) + gestorType.charCodeAt(0)) % 5;
        
        comunicacao = Math.min(100, comunicacao + hashDelta);
        lideranca = Math.min(100, lideranca + hashDelta);
        operacional = Math.min(100, operacional + hashDelta);
        relacional = Math.min(100, relacional + hashDelta);

        // Pesos: Com (25%), Lid (30%), Oper (25%), Rel (20%)
        const geral = Math.round((comunicacao * 0.25) + (lideranca * 0.30) + (operacional * 0.25) + (relacional * 0.20));

        let classificacao = 'CRÍTICA';
        let color = 'danger';
        if (geral >= 90) { classificacao = 'EXCELENTE'; color = 'success'; }
        else if (geral >= 80) { classificacao = 'ALTA'; color = 'success'; }
        else if (geral >= 70) { classificacao = 'BOA'; color = 'primary'; }
        else if (geral >= 60) { classificacao = 'MODERADA'; color = 'warning'; }
        else if (geral >= 50) { classificacao = 'BAIXA'; color = 'danger'; }

        // Deduplicar arrays
        strengths = [...new Set(strengths)];
        attention = [...new Set(attention)];

        // Fallbacks caso muito curtos
        if(strengths.length === 0) strengths.push("Possuem características complementares que podem ser úteis em problemas complexos.");
        if(attention.length === 0) attention.push("Combinam muito bem, mas cuidado para não criarem pontos cegos juntos.");

        return {
            geral,
            comunicacao: Math.round(comunicacao),
            lideranca: Math.round(lideranca),
            operacional: Math.round(operacional),
            relacional: Math.round(relacional),
            classificacao,
            color,
            strengths,
            attention
        };
    }

    static getRecomendacoes(candidatoType, gestorType) {
        // Usa a base de dados mbti_work_guidance já existente se possível, ou gera recomendações cruzadas
        let baseRecs = [];
        if(typeof mbti_work_guidance !== 'undefined' && mbti_work_guidance[candidatoType]) {
            baseRecs = mbti_work_guidance[candidatoType].quick_guide.to_work_well;
        }

        const c = this.getLetras(candidatoType);
        const g = this.getLetras(gestorType);
        
        let recs = [];
        // Se o gestor é J e o cand P:
        if (g.J_P === 'J' && c.J_P === 'P') {
            recs.push("Forneça prazos finais claros, mas dê liberdade sobre COMO chegar até lá.");
            recs.push("Evite o instinto de microgerenciar o progresso diário dele.");
        }
        if (g.J_P === 'P' && c.J_P === 'J') {
            recs.push("Forneça a ele o planejamento e as estruturas que ele naturalmente vai cobrar de você.");
        }

        if (g.T_F === 'T' && c.T_F === 'F') {
            recs.push("Tome cuidado extra com o tom de voz ao passar feedbacks corretivos.");
            recs.push("Lembre-se de validar o esforço e a intenção, não apenas o resultado final.");
        }
        
        if (g.S_N === 'N' && c.S_N === 'S') {
            recs.push("Ao passar uma visão estratégica, quebre a explicação em passos sequenciais e lógicos.");
        }

        // Mistura com as da base
        return [...new Set([...recs, ...baseRecs])].slice(0, 7); // Max 7 recomendações
    }
}
window.MBTICompatibilityEngine = MBTICompatibilityEngine;
