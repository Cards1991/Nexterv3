const nexterAITools = {
    // Declarações (Schema) das ferramentas para enviar ao Gemini
    schemas: [
        {
            name: "consultarQuadroFuncionarios",
            description: "Retorna o total de funcionários ativos divididos por setor e empresa. Use para responder sobre quantos funcionários a empresa tem.",
            parameters: {
                type: "object",
                properties: {}
            }
        },
        {
            name: "consultarFaltas",
            description: "Consulta o total de faltas. Pode filtrar por setor e por uma data exata ou mês.",
            parameters: {
                type: "object",
                properties: {
                    data: {
                        type: "string",
                        description: "Data no formato 'YYYY-MM-DD' (ex: 2026-09-15) ou mês 'YYYY-MM' (ex: 2026-09). Se omitido, consultará todo o histórico.",
                    },
                    setor: {
                        type: "string",
                        description: "Nome exato do setor. Se omitido, traz o total de todos os setores.",
                    }
                }
            }
        },
        {
            name: "consultarHorasExtras",
            description: "Consulta as solicitações de horas extras realizadas ou autorizadas.",
            parameters: {
                type: "object",
                properties: {
                    data: {
                        type: "string",
                        description: "Data no formato 'YYYY-MM-DD' (ex: 2026-09-15) ou mês 'YYYY-MM' (ex: 2026-09).",
                    },
                    status: {
                        type: "string",
                        description: "Status da solicitação ('aprovado', 'pendente', 'rejeitado', 'cancelado'). Por padrão, a IA deve buscar por 'aprovado' se o usuário perguntar sobre horas autorizadas."
                    }
                }
            }
        },
        {
            name: "consultarAbsenteismo",
            description: "Consulta o índice de absenteísmo baseado nas faltas e horas previstas de um mês.",
            parameters: {
                type: "object",
                properties: {
                    anoMes: {
                        type: "string",
                        description: "Mês e ano no formato 'YYYY-MM'. Ex: '2026-08'. Obrigatório.",
                    }
                },
                required: ["anoMes"]
            }
        },
        {
            name: "consultarFuncionario",
            description: "Busca a ficha cadastral e os dados individuais de um funcionário específico pelo nome ou CPF.",
            parameters: {
                type: "object",
                properties: {
                    termoBusca: {
                        type: "string",
                        description: "Nome, parte do nome, ou CPF do funcionário. Ex: 'Carlos Silva' ou '12345678900'."
                    }
                },
                required: ["termoBusca"]
            }
        },
        {
            name: "gerarRelatorioPDF",
            description: "Gera e inicia o download de um relatório em PDF na máquina do usuário contendo o conteúdo HTML/Markdown fornecido.",
            parameters: {
                type: "object",
                properties: {
                    titulo: {
                        type: "string",
                        description: "Título do relatório que aparecerá no cabeçalho e nome do arquivo."
                    },
                    conteudoHTML: {
                        type: "string",
                        description: "O conteúdo principal do relatório formatado em HTML (use tabelas, tags <b>, <p>, etc)."
                    }
                },
                required: ["titulo", "conteudoHTML"]
            }
        },
        {
            name: "salvarPreferenciaUsuario",
            description: "Salva uma preferência de visualização ou formatação de respostas do usuário logado (ex: 'sempre gerar tabelas', 'falar de forma mais técnica').",
            parameters: {
                type: "object",
                properties: {
                    instrucao: {
                        type: "string",
                        description: "A instrução comportamental exata que a IA deverá seguir nas próximas interações (ex: 'Exibir os dados sempre em formato de tabela')."
                    }
                },
                required: ["instrucao"]
            }
        },
        {
            name: "consultarDemissoes",
            description: "Consulta demissões (turnover). Retorna a categoriaDemissao padronizada em 4 índices: 'Pedido de demissão', 'Dispensa', 'Acordo P.F.', 'Acordo Legal'. Use esses índices para contagem.",
            parameters: {
                type: "object",
                properties: {
                    mesAno: {
                        type: "string",
                        description: "Opcional. Mês e ano no formato 'YYYY-MM' para filtrar desligamentos de um período específico. Ex: '2026-08'."
                    }
                }
            }
        },
        {
            name: "consultarRecrutamento",
            description: "Consulta o módulo de Recursos Humanos focado em vagas de emprego e candidatos no processo de recrutamento.",
            parameters: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        description: "Filtro de status da vaga: 'aberta', 'fechada' ou 'todas'. Por padrão, assume 'aberta'."
                    }
                }
            }
        },
        {
            name: "consultarExperiencia",
            description: "Consulta os colaboradores ativos que estão no período de experiência (até 90 dias de admissão) e calcula as datas de vencimento de 45 e 90 dias.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    ],

    // Funções executoras
    executors: {
        consultarQuadroFuncionarios: async (args) => {
            try {
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
                let total = snapshot.size;
                let porSetor = {};
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const s = data.setor || 'Sem Setor';
                    porSetor[s] = (porSetor[s] || 0) + 1;
                });
                
                return JSON.stringify({ 
                    status: "sucesso",
                    dados: {
                        total_ativos: total, 
                        distribuicao_por_setor: porSetor 
                    }
                });
            } catch (error) {
                console.error("Erro no consultarQuadroFuncionarios:", error);
                return JSON.stringify({ erro: "Você não tem permissão para ler funcionários ou ocorreu falha técnica." });
            }
        },
        
        consultarFaltas: async (args) => {
            try {
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                let query = db.collection('faltas');
                if (args.setor) {
                    query = query.where('setor', '==', args.setor);
                }
                const snapshot = await query.get();
                
                let total = 0;
                let detalhado = {};
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if(!data.data) return;
                    
                    const dataFalta = data.data.toDate ? data.data.toDate() : new Date(data.data);
                    const docAnoMes = `${dataFalta.getFullYear()}-${String(dataFalta.getMonth() + 1).padStart(2, '0')}`;
                    const docDataCompleta = `${docAnoMes}-${String(dataFalta.getDate()).padStart(2, '0')}`;
                    
                    if (args.data) {
                        if (args.data.length === 7 && args.data !== docAnoMes) return; // Filtro de Mês
                        if (args.data.length === 10 && args.data !== docDataCompleta) return; // Filtro de Dia Exato
                    } else if (args.anoMes && args.anoMes !== docAnoMes) {
                        return; // Retrocompatibilidade caso a IA ainda use anoMes
                    }
                    
                    total++;
                    const funcName = data.funcionarioNome || 'Desconhecido';
                    detalhado[funcName] = (detalhado[funcName] || 0) + 1;
                });
                
                // Top 5 faltantes
                const topFaltantes = Object.entries(detalhado)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(item => ({ funcionario: item[0], qtde: item[1] }));
                
                return JSON.stringify({ 
                    status: "sucesso",
                    parametros_usados: args,
                    dados: {
                        total_faltas: total,
                        principais_faltantes: topFaltantes
                    }
                });
            } catch (error) {
                console.error("Erro no consultarFaltas:", error);
                return JSON.stringify({ erro: "Você não tem permissão para acessar faltas ou ocorreu falha técnica." });
            }
        },

        consultarHorasExtras: async (args) => {
            try {
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                let query = db.collection('overtime');
                
                // Tratar a data de fechamento se informada (26 do mes anterior ate 25 do atual)
                let dataInicioFechamento = null;
                let dataFimFechamento = null;
                let isoInicio = "";
                let isoFim = "";
                
                if (args.data && args.data.length === 7) {
                    const partes = args.data.split('-');
                    const ano = parseInt(partes[0]);
                    const mes = parseInt(partes[1]) - 1; // 0-indexed
                    
                    dataInicioFechamento = new Date(ano, mes - 1, 26, 0, 0, 0);
                    dataFimFechamento = new Date(ano, mes, 25, 23, 59, 59);
                    
                    isoInicio = dataInicioFechamento.toISOString().split('T')[0];
                    isoFim = dataFimFechamento.toISOString().split('T')[0];
                    
                    query = query.where('date', '>=', isoInicio).where('date', '<=', isoFim);
                } else if (args.data && args.data.length === 10) {
                    query = query.where('date', '==', args.data);
                }
                
                // Filtro de Status
                const statusFiltro = args.status || 'aprovado';
                
                const snapshot = await query.get();
                let totalHoras = 0;
                let valorTotal = 0;
                let valorPorFora = 0;
                let valorFolha = 0;
                let porFuncionario = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    if (statusFiltro === 'aprovado') {
                        if (data.status === 'pendente' || data.status === 'rejeitado' || data.status === 'cancelado') return;
                    } else if (data.status !== statusFiltro) {
                        return;
                    }
                    
                    const horas = parseFloat(data.hours) || 0;
                    const valorDinheiro = (parseFloat(data.overtimePay) || 0) + (parseFloat(data.dsr) || 0);
                    const forma = data.formaPagamento || 'por-fora';
                    
                    if (horas > 0) {
                        totalHoras += horas;
                        valorTotal += valorDinheiro;
                        
                        if (forma === 'por-fora') valorPorFora += valorDinheiro;
                        else valorFolha += valorDinheiro;

                        const funcName = data.employeeName || 'Desconhecido';
                        if (!porFuncionario[funcName]) {
                            porFuncionario[funcName] = { horas: 0, valor: 0 };
                        }
                        porFuncionario[funcName].horas += horas;
                        porFuncionario[funcName].valor += valorDinheiro;
                    }
                });

                const topColaboradores = Object.entries(porFuncionario)
                    .sort((a, b) => b[1].valor - a[1].valor)
                    .slice(0, 10)
                    .map(item => ({ 
                        funcionario: item[0], 
                        horas: item[1].horas.toFixed(2),
                        valor_reais: item[1].valor.toFixed(2)
                    }));
                
                return JSON.stringify({
                    status: "sucesso",
                    parametros_usados: args,
                    periodo_fechamento_considerado: dataInicioFechamento ? `${dataInicioFechamento.toLocaleDateString('pt-BR')} até ${dataFimFechamento.toLocaleDateString('pt-BR')}` : 'Não especificado',
                    dados: {
                        total_horas_extras: totalHoras.toFixed(2),
                        valor_total_a_pagar_reais: valorTotal.toFixed(2),
                        valor_total_por_fora: valorPorFora.toFixed(2),
                        valor_total_na_folha: valorFolha.toFixed(2),
                        status_filtrado: statusFiltro,
                        principais_colaboradores: topColaboradores
                    }
                });
            } catch (error) {
                console.error("Erro no consultarHorasExtras:", error);
                return JSON.stringify({ erro: "Falha técnica ao consultar horas extras." });
            }
        },
        
        consultarAbsenteismo: async (args) => {
            try {
                if (!args.anoMes) return JSON.stringify({ erro: "É necessário especificar o mês (anoMes)." });
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                let fSnapshot = await db.collection('faltas').get();
                let faltasTotal = 0;
                
                fSnapshot.forEach(doc => {
                    if(!doc.data().data) return;
                    const dataFalta = doc.data().data.toDate ? doc.data().data.toDate() : new Date(doc.data().data);
                    const docAnoMes = `${dataFalta.getFullYear()}-${String(dataFalta.getMonth() + 1).padStart(2, '0')}`;
                    if (args.anoMes === docAnoMes) faltasTotal++;
                });

                const funcSnapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
                const totalFunc = funcSnapshot.size;
                
                // Cálculo estimado MVP
                const horasPrevistas = totalFunc * 220; 
                const horasFaltadas = faltasTotal * 8; 
                
                let indice = 0;
                if(horasPrevistas > 0) {
                    indice = ((horasFaltadas / horasPrevistas) * 100).toFixed(2);
                }

                return JSON.stringify({
                    status: "sucesso",
                    dados: {
                        periodo: args.anoMes,
                        faltas_ocorrencias: faltasTotal,
                        horas_perdidas_estimadas: horasFaltadas,
                        horas_previstas: horasPrevistas,
                        indice_absenteismo_percentual: parseFloat(indice)
                    }
                });
            } catch (error) {
                console.error("Erro no consultarAbsenteismo:", error);
                return JSON.stringify({ erro: "Falha técnica ao calcular absenteísmo." });
            }
        },

        consultarFuncionario: async (args) => {
            try {
                if (!args.termoBusca) return JSON.stringify({ erro: "É necessário informar o nome ou CPF do funcionário." });
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                const termo = args.termoBusca.toLowerCase();
                // O Firebase não tem LIKE nativo robusto, então buscamos a coleção toda e filtramos para maior flexibilidade
                const snapshot = await db.collection('funcionarios').get();
                
                let encontrados = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const nome = (data.nome || "").toLowerCase();
                    const cpf = data.cpf || "";
                    const email = (data.email || "").toLowerCase();
                    
                        if (nome.includes(termo) || cpf.includes(termo) || email.includes(termo)) {
                            encontrados.push({
                                id: doc.id,
                                nome: data.nome,
                                cpf: data.cpf,
                                rg: data.rg || 'Não informado',
                                pis: data.pis || 'Não informado',
                                matricula: data.matricula || 'Não informada',
                                telefone: data.telefone || 'Não informado',
                                cargo: data.cargo || 'Não informado',
                                setor: data.setor || 'Não informado',
                                status: data.status,
                                dataAdmissao: data.dataAdmissao || 'Não informada',
                                dataDemissao: data.dataDemissao || null,
                                tipoContrato: data.tipoContrato || 'Não informado',
                                salarioAtual: data.salario || 'Não informado',
                                salarioPorFora: data.salarioPorFora || 'Não informado',
                                sexo: data.sexo || 'Não informado',
                                isMecanico: data.isMecanico ? true : false
                            });
                        }
                });
                
                if (encontrados.length === 0) {
                    return JSON.stringify({ status: "sucesso", dados: "Nenhum funcionário encontrado com o nome ou CPF informado." });
                }
                
                // Limitar a 5 resultados para não estourar limite e buscar histórico
                const resultados = encontrados.slice(0, 5);
                
                for (let func of resultados) {
                    try {
                        // Busca histórico de faltas e atestados
                        const faltasSnap = await db.collection('faltas').where('funcionarioNome', '==', func.nome).get();
                        let atestados = 0;
                        let faltasInjustificadas = 0;
                        
                        faltasSnap.forEach(fdoc => {
                            const d = fdoc.data();
                            const just = (d.justificativa || '').toLowerCase();
                            if (just.includes('atestado') || just.includes('médico') || just.includes('medico')) {
                                atestados++;
                            } else {
                                faltasInjustificadas++;
                            }
                        });
                        
                        func.historico_faltas_injustificadas = faltasInjustificadas;
                        func.historico_atestados = atestados;
                        
                        // Busca histórico de horas extras aprovadas
                        const horasSnap = await db.collection('solicitacoes_horas')
                            .where('employeeName', '==', func.nome)
                            .where('status', '==', 'aprovado').get();
                            
                        let horasTotais = 0;
                        horasSnap.forEach(hdoc => {
                            const d = hdoc.data();
                            if(d.start && d.end) {
                                const start = d.start.toDate ? d.start.toDate() : new Date(d.start);
                                const end = d.end.toDate ? d.end.toDate() : new Date(d.end);
                                horasTotais += (end - start) / (1000 * 60 * 60);
                            }
                        });
                        func.historico_total_horas_extras = horasTotais.toFixed(2);
                        
                        // Busca histórico de EPIs
                        const epiSnap = await db.collection('epi_consumo').where('funcionarioId', '==', func.id).get();
                        let totalEpis = 0;
                        let episLista = [];
                        epiSnap.forEach(edoc => {
                            const d = edoc.data();
                            totalEpis += parseInt(d.quantidade || 1);
                            episLista.push(`${d.quantidade || 1}x ${d.epiDescricao || 'EPI não especificado'}`);
                        });
                        func.historico_epis_entregues = totalEpis;
                        func.lista_epis_entregues = episLista.slice(0, 5).join(', ') + (episLista.length > 5 ? '...' : '');

                        // Busca histórico de Alterações de Função / Salário
                        const altSnap = await db.collection('alteracoes_funcao').where('funcionarioId', '==', func.id).orderBy('data_alteracao', 'desc').limit(3).get();
                        let alteracoes = [];
                        altSnap.forEach(adoc => {
                            const d = adoc.data();
                            const dtStr = d.data_alteracao ? (d.data_alteracao.toDate ? d.data_alteracao.toDate().toLocaleDateString('pt-BR') : new Date(d.data_alteracao).toLocaleDateString('pt-BR')) : 'N/A';
                            alteracoes.push(`Em ${dtStr}: De ${d.cargo_anterior || 'N/A'} para ${d.novo_cargo || 'N/A'} (Motivo: ${d.motivo || 'N/A'})`);
                        });
                        func.historico_alteracoes = alteracoes;

                    } catch (e) {
                        console.warn("Erro ao buscar histórico extra do funcionário", e);
                    }
                }
                
                return JSON.stringify({
                    status: "sucesso",
                    quantidade_encontrada: encontrados.length,
                    dados: resultados,
                    nota: encontrados.length > 5 ? "Mostrando os 5 primeiros com histórico. Peça para refinar a busca se necessário." : ""
                });
            } catch (error) {
                console.error("Erro no consultarFuncionario:", error);
                return JSON.stringify({ erro: "Falha técnica ao consultar dados cadastrais." });
            }
        },

        consultarDemissoes: async (args) => {
            try {
                const mesAno = args.mesAno; // Formato YYYY-MM (opcional)
                
                let query = db.collection('funcionarios').where('status', '==', 'Inativo');
                const snap = await query.get();
                
                let demissoes = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    let inclui = true;
                    let dataObj = null;
                    if (data.dataDesligamento) dataObj = data.dataDesligamento.toDate ? data.dataDesligamento.toDate() : new Date(data.dataDesligamento);
                    else if (data.dataDemissao) dataObj = data.dataDemissao.toDate ? data.dataDemissao.toDate() : new Date(data.dataDemissao);
                    else if (data.ultimaMovimentacao) dataObj = data.ultimaMovimentacao.toDate ? data.ultimaMovimentacao.toDate() : new Date(data.ultimaMovimentacao);
                    
                    let dataDemissaoISO = '';
                    let formattedDate = 'N/A';
                    if (dataObj && !isNaN(dataObj.getTime())) {
                        dataDemissaoISO = dataObj.toISOString().split('T')[0];
                        formattedDate = dataObj.toLocaleDateString('pt-BR');
                    }

                    if (mesAno) {
                        // Se tem filtro de mes, e não achamos data ou a data não começa com o mes, não inclui
                        if (!dataDemissaoISO || !dataDemissaoISO.startsWith(mesAno)) inclui = false;
                    }
                    
                    if (inclui) {
                        demissoes.push({
                            id: doc.id,
                            nome: data.nome,
                            setor: data.setor || 'N/A',
                            dataDemissao: formattedDate,
                            tipoDemissao: data.tipoDemissao || data.motivoDesligamento || 'Não informado'
                        });
                    }
                });
                
                // Busca motivos nas entrevistas e fallback de movimentações
                for (let d of demissoes) {
                    try {
                        const entSnap = await db.collection('entrevista_desligamento').where('funcionarioId', '==', d.id).limit(1).get();
                        if (!entSnap.empty) {
                            d.motivoSecundarioEntrevista = entSnap.docs[0].data().motivoPrincipal || 'Não informado';
                        }
                    } catch(e) {}
                    
                    if (d.tipoDemissao === 'Não informado' || d.tipoDemissao === '-') {
                        try {
                            const movSnap = await db.collection('movimentacoes').where('funcionarioId', '==', d.id).where('tipo', '==', 'demissao').limit(1).get();
                            if (!movSnap.empty) {
                                d.tipoDemissao = movSnap.docs[0].data().motivo || movSnap.docs[0].data().tipoDemissao || 'Não informado';
                            }
                        } catch (e) {}
                    }
                    
                    // Categorização da demissão para facilitar a análise da IA
                    const tipoLower = (d.tipoDemissao || '').toLowerCase();
                    if (tipoLower.includes('pedido') || tipoLower.includes('t.a.c. empregado') || tipoLower.includes('t.a.c - empregado') || tipoLower.includes('tac empregado')) {
                        d.categoriaDemissao = 'Pedido de demissão';
                    } else if (tipoLower.includes('sem justa causa') || tipoLower.includes('por justa causa') || tipoLower.includes('termino de contrato') || tipoLower.includes('término de contrato') || tipoLower.includes('t.a.c. empresa') || tipoLower.includes('t.a.c - empresa') || tipoLower.includes('tac empresa') || tipoLower.includes('dispensa')) {
                        d.categoriaDemissao = 'Dispensa';
                    } else if (tipoLower.includes('acordo p.f') || tipoLower.includes('acordo pf')) {
                        d.categoriaDemissao = 'Acordo P.F.';
                    } else if (tipoLower.includes('acordo legal')) {
                        d.categoriaDemissao = 'Acordo Legal';
                    } else {
                        d.categoriaDemissao = 'Outros';
                    }
                }
                
                return JSON.stringify({
                    status: "sucesso",
                    total: demissoes.length,
                    demissoes: demissoes
                });
            } catch (error) {
                console.error("Erro no consultarDemissoes:", error);
                return JSON.stringify({ erro: "Falha técnica ao consultar demissões." });
            }
        },

        consultarRecrutamento: async (args) => {
            try {
                const statusFiltro = args.status || 'aberta'; // 'aberta' ou 'fechada' ou 'todas'
                const snapVagas = await db.collection('vagas').get();
                
                let vagas = [];
                snapVagas.forEach(doc => {
                    const data = doc.data();
                    const s = (data.status || 'aberta').toLowerCase();
                    if (statusFiltro === 'todas' || s === statusFiltro) {
                        vagas.push({
                            id: doc.id,
                            titulo: data.titulo || data.cargo || 'Vaga',
                            setor: data.setor || 'N/A',
                            status: s,
                            dataAbertura: data.dataAbertura || 'N/A'
                        });
                    }
                });
                
                // Busca candidatos
                for (let v of vagas) {
                    try {
                        const cSnap = await db.collection('candidatos').where('vagaId', '==', v.id).get();
                        v.totalCandidatos = cSnap.size;
                    } catch(e) { v.totalCandidatos = 0; }
                }
                
                return JSON.stringify({
                    status: "sucesso",
                    totalVagas: vagas.length,
                    vagas: vagas
                });
            } catch (error) {
                console.error("Erro no consultarRecrutamento:", error);
                return JSON.stringify({ erro: "Falha técnica ao consultar recrutamento." });
            }
        },

        consultarExperiencia: async (args) => {
            try {
                if (!window.db) throw new Error("Banco de dados indisponível.");
                
                const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0); // Zera horas para comparação precisa
                
                let emExperiencia = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.dataAdmissao) return; // Se não tiver data de admissão, pula
                    
                    let dataAdmissao;
                    if (data.dataAdmissao.toDate) {
                        dataAdmissao = data.dataAdmissao.toDate();
                    } else {
                        // Trata data no formato YYYY-MM-DD para evitar fuso horário errado
                        const parts = data.dataAdmissao.split('-');
                        if (parts.length === 3) {
                            dataAdmissao = new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0);
                        } else {
                            dataAdmissao = new Date(data.dataAdmissao);
                        }
                    }
                    
                    dataAdmissao.setHours(0, 0, 0, 0);
                    
                    // Calcula dias trabalhados
                    const diffTime = Math.abs(hoje - dataAdmissao);
                    const diasTrabalhados = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diasTrabalhados <= 90) {
                        // Calcula vencimento 45 e 90 dias
                        const vencimento45 = new Date(dataAdmissao);
                        vencimento45.setDate(dataAdmissao.getDate() + 44);
                        
                        const vencimento90 = new Date(vencimento45);
                        vencimento90.setDate(vencimento45.getDate() + 45);
                        
                        emExperiencia.push({
                            id: doc.id,
                            nome: data.nome,
                            setor: data.setor || 'N/A',
                            dataAdmissao: dataAdmissao.toLocaleDateString('pt-BR'),
                            diasTrabalhados: diasTrabalhados,
                            vencimento45: vencimento45.toLocaleDateString('pt-BR'),
                            vencimento90: vencimento90.toLocaleDateString('pt-BR'),
                            statusAtual: diasTrabalhados <= 45 ? '1º Período (Até 45 dias)' : '2º Período (Até 90 dias)'
                        });
                    }
                });
                
                // Ordenar pelos que estão mais próximos do vencimento
                emExperiencia.sort((a, b) => b.diasTrabalhados - a.diasTrabalhados);
                
                return JSON.stringify({
                    status: "sucesso",
                    totalEmExperiencia: emExperiencia.length,
                    lista: emExperiencia
                });
            } catch (error) {
                console.error("Erro no consultarExperiencia:", error);
                return JSON.stringify({ erro: "Falha técnica ao consultar contratos de experiência." });
            }
        },

        gerarRelatorioPDF: async (args) => {
            try {
                if (typeof html2pdf === 'undefined') {
                    return JSON.stringify({ erro: "Biblioteca html2pdf não encontrada na página." });
                }

                // Cria um container invisível temporário para o relatório com design premium (Estilo Tailwind/Moderno)
                const container = document.createElement('div');
                container.style.padding = '40px';
                container.style.fontFamily = "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                container.style.color = '#1f2937'; // gray-800
                container.style.backgroundColor = '#ffffff';
                
                const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
                
                // Monta o cabeçalho padrão com UI/UX moderno
                let htmlContent = `
                    <div style="border-bottom: 3px solid #3b82f6; margin-bottom: 30px; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            <h1 style="color: #111827; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Nexter <span style="color: #3b82f6;">AI</span></h1>
                            <h2 style="color: #4b5563; margin: 8px 0 0 0; font-size: 18px; font-weight: 500;">${args.titulo || 'Relatório Analítico'}</h2>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-size: 13px; color: #6b7280; margin: 0; font-weight: 500;">DATA DO RELATÓRIO</p>
                            <p style="font-size: 14px; color: #1f2937; margin: 2px 0 0 0; font-weight: 600;">${dataHoje}</p>
                        </div>
                    </div>
                    <div style="line-height: 1.6; font-size: 15px; color: #374151;">
                        ${args.conteudoHTML}
                    </div>
                    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                        <p style="font-size: 12px; color: #9ca3af; margin: 0;">Documento gerado automaticamente pela Inteligência Artificial do Nexter.</p>
                    </div>
                `;
                
                container.innerHTML = htmlContent;
                
                // Adiciona injeção de CSS para formatar as tabelas e o Dashboard que a IA gerar
                const style = document.createElement('style');
                style.innerHTML = `
                    /* Dashboard Cards (Flexbox) */
                    .dashboard-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px; }
                    .card { flex: 1; min-width: 150px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center; }
                    .card-title { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
                    .card-value { font-size: 28px; color: #0f172a; font-weight: 800; margin: 0; }
                    .card-icon { font-size: 24px; margin-bottom: 15px; opacity: 0.8; }
                    .card.blue { border-top: 4px solid #3b82f6; }
                    .card.red { border-top: 4px solid #ef4444; }
                    .card.yellow { border-top: 4px solid #f59e0b; }
                    .card.green { border-top: 4px solid #10b981; }

                    /* Tabelas */
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                    th { background-color: #f3f4f6; color: #374151; font-weight: 600; text-align: left; padding: 12px 16px; border-bottom: 2px solid #e5e7eb; font-size: 14px; }
                    td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #4b5563; font-size: 14px; }
                    tr:nth-child(even) td { background-color: #f9fafb; }
                    
                    /* Textos Gerais */
                    h1, h2, h3, h4 { color: #111827; margin-top: 24px; margin-bottom: 12px; }
                    p { margin-bottom: 16px; }
                    strong { color: #111827; }
                `;
                container.appendChild(style);
                
                document.body.appendChild(container);
                
                const opt = {
                    margin:       1,
                    filename:     `${(args.titulo || 'relatorio').replace(/ /g, '_')}_${dataHoje.replace(/\//g, '-')}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                // Gera o PDF (assíncrono) - Tenta abrir na tela ("explodir") e usa download como fallback
                html2pdf().set(opt).from(container).outputPdf('bloburl').then((pdfUrl) => {
                    const newWindow = window.open(pdfUrl, '_blank');
                    
                    // Se o navegador bloquear o popup (nova aba), fazemos o download forçado
                    if (!newWindow) {
                        const a = document.createElement('a');
                        a.href = pdfUrl;
                        a.download = opt.filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                    
                    // Remove o container temporário invisível da tela principal
                    if (document.body.contains(container)) {
                        document.body.removeChild(container);
                    }
                });

                return JSON.stringify({ status: "sucesso", mensagem: "O PDF foi gerado com sucesso e aberto na tela do usuário." });
            } catch (error) {
                console.error("Erro ao gerar PDF:", error);
                return JSON.stringify({ erro: "Ocorreu um erro técnico ao gerar o PDF." });
            }
        },

        salvarPreferenciaUsuario: async (args) => {
            try {
                if (!window.db || !window.firebase) return JSON.stringify({ erro: "Banco de dados indisponível." });
                
                const user = firebase.auth().currentUser;
                if (!user) return JSON.stringify({ erro: "Nenhum usuário logado." });
                
                if (!args.instrucao) return JSON.stringify({ erro: "Instrução de preferência vazia." });
                
                const prefsRef = db.collection('ai_user_preferences').doc(user.uid);
                
                // Pega as prefs atuais se houver
                const doc = await prefsRef.get();
                let preferences = [];
                if (doc.exists && doc.data().preferences) {
                    preferences = doc.data().preferences;
                }
                
                // Adiciona a nova
                preferences.push({
                    instrucao: args.instrucao,
                    adicionadoEm: new Date().toISOString()
                });
                
                await prefsRef.set({
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    preferences: preferences
                }, { merge: true });
                
                return JSON.stringify({ status: "sucesso", mensagem: "A preferência foi salva com sucesso e será aplicada nas próximas conversas." });
            } catch (error) {
                console.error("Erro ao salvar preferencia:", error);
                return JSON.stringify({ erro: "Falha técnica ao salvar preferência no banco." });
            }
        }
    }
};
