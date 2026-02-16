// js/auto-correction-agent.js
// Módulo para o Agente de Correção Automática

// Expor o agente em um objeto global para ser acessado por outros módulos
window.AutoCorrectionAgent = {
    
    /**
     * Inicia a detecção de inconsistências nos dados do Firestore.
     * Exemplo: Encontrar funcionários sem setor definido.
     */
    async detectInconsistencies() {
        console.log("[AutoCorrectionAgent] Iniciando detecção de inconsistências...");
        if (!db) {
            console.error("Firestore (db) não está disponível.");
            return;
        }

        try {
            // Exemplo: Buscar funcionários onde o campo 'setor' está vazio ou não existe
            const funcionariosRef = db.collection('funcionarios');
            const snapshotSemSetor = await funcionariosRef.where('setor', '==', '').get();
            const snapshotNuloSetor = await funcionariosRef.where('setor', '==', null).get();

            const funcionariosProblematicos = [];
            snapshotSemSetor.forEach(doc => funcionariosProblematicos.push({ id: doc.id, ...doc.data() }));
            snapshotNuloSetor.forEach(doc => {
                // Evitar duplicados se a consulta retornar o mesmo doc
                if (!funcionariosProblematicos.some(f => f.id === doc.id)) {
                    funcionariosProblematicos.push({ id: doc.id, ...doc.data() });
                }
            });


            if (funcionariosProblematicos.length === 0) {
                console.log("[AutoCorrectionAgent] Nenhuma inconsistência de 'setor' encontrada.");
                return;
            }

            console.log(`[AutoCorrectionAgent] ${funcionariosProblematicos.length} funcionários com setor faltando encontrados.`);

            for (const func of funcionariosProblematicos) {
                await this.createPendencia({
                    tipo: 'CADASTRO_INCOMPLETO',
                    idRegistro: func.id,
                    colecao: 'funcionarios',
                    campoFaltando: 'setor',
                    descricao: `Funcionário '${func.nome}' (CPF: ${func.cpf || 'N/A'}) está sem setor definido.`
                });
            }

        } catch (error) {
            console.error("[AutoCorrectionAgent] Erro ao detectar inconsistências:", error);
        }
    },

    /**
     * Cria um novo registro de pendência no Firestore se ainda não existir um igual.
     * @param {object} pendenciaData - Os dados para a nova pendência.
     */
    async createPendencia(pendenciaData) {
        if (!db) return;
        
        const pendenciasRef = db.collection('pendenciasSistema');

        // Verifica se já existe uma pendência similar para evitar duplicatas
        const q = pendenciasRef
            .where('idRegistro', '==', pendenciaData.idRegistro)
            .where('campoFaltando', '==', pendenciaData.campoFaltando)
            .where('status', '==', 'pendente');
        
        const snapshot = await q.get();

        if (snapshot.empty) {
            const novaPendencia = {
                ...pendenciaData,
                status: 'pendente',
                scoreConfianca: null,
                dataDeteccao: firebase.firestore.FieldValue.serverTimestamp(),
                resolucao: null
            };
            await pendenciasRef.add(novaPendencia);
            console.log(`[AutoCorrectionAgent] Nova pendência criada para o registro ${pendenciaData.idRegistro}.`);
        } else {
            console.log(`[AutoCorrectionAgent] Pendência para o registro ${pendenciaData.idRegistro} já existe.`);
        }
    },

    /**
     * Inicia o ciclo de correções, lendo as pendências e tentando resolvê-las.
     */
    async runCorrectionCycle() {
        console.log("[AutoCorrectionAgent] Iniciando ciclo de correções...");
        if (!db) return;

        const pendenciasRef = db.collection('pendenciasSistema').where('status', '==', 'pendente');
        const snapshot = await pendenciasRef.get();

        if (snapshot.empty) {
            console.log("[AutoCorrectionAgent] Nenhuma pendência para processar.");
            return;
        }

        // Mock de uma planilha de dados externos
        const planilhaExterna = [
            { nome_completo: "João da Silva", cpf_parcial: "123.456.789", setor_correto: "Costura" },
            { nome_completo: "Maria Oliveira", cpf_parcial: "987.654.321", setor_correto: "Acabamento" }
        ];

        for (const doc of snapshot.docs) {
            const pendencia = { id: doc.id, ...doc.data() };
            
            // Pega os dados do funcionário com problema
            const funcDoc = await db.collection(pendencia.colecao).doc(pendencia.idRegistro).get();
            if (!funcDoc.exists) continue;
            
            const funcionario = funcDoc.data();

            // Tenta encontrar uma correspondência na planilha externa
            const match = this.findMatchInSpreadsheet(funcionario, planilhaExterna);

            if (match) {
                const score = this.calculateConfidenceScore(funcionario, match);
                
                if (score > 90) {
                    // Confiança alta: atualiza automaticamente
                    await this.applyCorrection(pendencia, match.valorCorreto, score);
                } else if (score > 60) {
                    // Confiança média: envia para revisão humana
                    await db.collection('pendenciasSistema').doc(pendencia.id).update({
                        status: 'revisao_humana',
                        scoreConfianca: score,
                        resolucao: {
                            sugestao: match.valorCorreto,
                            fonte: 'Planilha Externa de Setores'
                        }
                    });
                }
            }
        }
    },

    /**
     * Simula a busca por uma correspondência em uma fonte de dados externa.
     * @param {object} funcionario - O registro do funcionário com dados faltando.
     * @param {Array} spreadsheet - O array de dados simulando a planilha.
     */
    findMatchInSpreadsheet(funcionario, spreadsheet) {
        const nomeFuncionario = funcionario.nome.toLowerCase();
        
        for (const row of spreadsheet) {
            if (nomeFuncionario === row.nome_completo.toLowerCase()) {
                return {
                    fonte: 'Planilha Externa',
                    valorCorreto: row.setor_correto,
                    // Adicionar mais dados se necessário para o cálculo de score
                };
            }
        }
        return null;
    },

    /**
     * Calcula um score de confiança para a correspondência encontrada.
     */
    calculateConfidenceScore(funcionario, match) {
        // Lógica de score (exemplo simples)
        let score = 0;
        if (match) {
            // Se encontrou por nome, já é um bom começo
            score += 95;
        }
        // Poderia adicionar mais verificações aqui (CPF parcial, data de nasc, etc.)
        return score;
    },

    /**
     * Aplica a correção no Firestore e registra o log.
     * @param {object} pendencia - O objeto da pendência.
     * @param {string} valorCorrigido - O novo valor para o campo.
     * @param {number} score - O score de confiança da correção.
     */
    async applyCorrection(pendencia, valorCorrigido, score) {
        if (!db) return;
        
        try {
            // 1. Atualiza o registro original
            const docRef = db.collection(pendencia.colecao).doc(pendencia.idRegistro);
            const updateData = {};
            updateData[pendencia.campoFaltando] = valorCorrigido;
            await docRef.update(updateData);

            // 2. Atualiza o status da pendência
            await db.collection('pendenciasSistema').doc(pendencia.id).update({
                status: 'corrigido_auto',
                scoreConfianca: score,
                resolucao: {
                    valorAplicado: valorCorrigido,
                    fonte: 'Planilha Externa (simulado)'
                },
                dataResolucao: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Registra o log da operação
            await this.logCorrection({
                acao: 'UPDATE',
                colecao: pendencia.colecao,
                registroId: pendencia.idRegistro,
                campo: pendencia.campoFaltando,
                valorAntigo: '', // Estava vazio
                valorNovo: valorCorrigido,
                scoreConfianca: score,
                fonte: 'AutoCorrectionAgent'
            });

            console.log(`[AutoCorrectionAgent] Registro ${pendencia.idRegistro} corrigido com sucesso!`);

        } catch (error) {
            console.error(`[AutoCorrectionAgent] Erro ao aplicar correção para ${pendencia.idRegistro}:`, error);
        }
    },

    /**
     * Registra um log de atividade do sistema na coleção 'logsSistema'.
     * @param {object} logData - Os dados do log.
     */
    async logCorrection(logData) {
        if (!db) return;

        const log = {
            ...logData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            agente: 'AutoCorrectionAgent/v1.0'
        };
        await db.collection('logsSistema').add(log);
    }
};

console.log("Módulo de Agente Autocorretivo carregado e inicializado.");