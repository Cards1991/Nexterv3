async function carregarSelectEmpresas(selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        const empresasSnapshot = await db.collection('empresas').orderBy('nome').get();
        
        select.innerHTML = '<option value="">Selecione uma empresa</option>';
        empresasSnapshot.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

async function carregarSetoresPorEmpresa(empresaId, selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        if (!empresaId) {
            select.innerHTML = '<option value="">Selecione um setor</option>';
            return;
        }

        const setoresSnap = await db.collection('setores')
            .where('empresaId', '==', empresaId)
            .get();

        const setoresDocs = setoresSnap.docs.sort((a, b) => {
            const descA = a.data().descricao || '';
            const descB = b.data().descricao || '';
            return descA.localeCompare(descB);
        });

        select.innerHTML = '<option value="">Selecione um setor</option>';
        setoresDocs.forEach(doc => {
            const desc = doc.data().descricao;
            select.innerHTML += `<option value="${desc}">${desc}</option>`;
        });
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
    }
}

class MovimentacoesManager {
    constructor() {
        this.graficoMensal = null;
        this.graficoSetor = null;
        this.graficoMotivos = null;
        this.init();
    }

    init() {
        // Define as datas padrão para o mês atual
        const filtroInicioInput = document.getElementById('mov-filtro-inicio');
        const filtroFimInput = document.getElementById('mov-filtro-fim');

        if(filtroInicioInput && filtroFimInput) {
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            filtroInicioInput.value = primeiroDia.toISOString().split('T')[0];
            filtroFimInput.value = ultimoDia.toISOString().split('T')[0];
        }
        
        this.bindEvents();
        // Removido carregamento automático para evitar erro de permissão antes do login.
        // O app.js chamará carregarDadosIniciais() quando a seção for exibida.
    }

    bindEvents() {
        // Adicionar listener para o botão calcular
        document.getElementById('btn-calcular-rescisao')?.addEventListener('click', () => {
            this.calcularRescisao();
        });
    }

    checkAndEnableButton() {
        const selectDemissao = document.getElementById('demissao-funcionario');
        const dataDemissaoInput = document.getElementById('demissao-data');
        const btnCalcular = document.getElementById('btn-calcular-rescisao');
        
        if (btnCalcular) {
            btnCalcular.disabled = !(selectDemissao.value && dataDemissaoInput.value);
        }
    }

    async carregarDadosIniciais() {
        try {
            await Promise.all([
                this.carregarSelectsMovimentacao(),
                this.carregarHistoricoMovimentacoes(),
                this.carregarDashboardMovimentacoes(),
                this.carregarGraficosMovimentacoes()
            ]);
        } catch (error) {
            console.error('Erro ao carregar dados de movimentações:', error);
            this.mostrarMensagem('Erro ao carregar dados de movimentações', 'error');
        }
    }

    async carregarSelectsMovimentacao() {
        try {
            const [funcionariosSnapshot, empresasSnapshot] = await Promise.all([
                db.collection('funcionarios')
                    .where('status', '==', 'Ativo')
                    .orderBy('nome').get(),
                db.collection('empresas').get()
            ]);

            __funcionarios_ativos_cache = funcionariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const empresasMap = new Map(empresasSnapshot.docs.map(doc => [doc.id, doc.data().nome]));

            // Configurar select de demissão
            const selectDemissao = document.getElementById('demissao-funcionario');
            const infoContainer = document.getElementById('demissao-info-funcionario');
            const dataDemissaoInput = document.getElementById('demissao-data');

            if (selectDemissao) {
                selectDemissao.innerHTML = '<option value="">Selecione um funcionário</option>';
                __funcionarios_ativos_cache.forEach(func => {
                    selectDemissao.innerHTML += `<option value="${func.id}">${func.nome}</option>`;
                });

                selectDemissao.addEventListener('change', () => {
                    const funcId = selectDemissao.value;
                    this.checkAndEnableButton();

                    if (!funcId) {
                        if (infoContainer) infoContainer.style.display = 'none';
                        return;
                    }
                    const func = __funcionarios_ativos_cache.find(f => f.id === funcId);
                    if (infoContainer && func) {
                        infoContainer.innerHTML = `
                            <strong>Empresa:</strong> ${empresasMap.get(func.empresaId) || 'N/A'} <br>
                            <strong>Setor:</strong> ${func.setor || 'N/A'} <br>
                            <strong>Cargo:</strong> ${func.cargo || 'N/A'}
                        `;
                        infoContainer.style.display = 'block';
                    }
                });

                if (dataDemissaoInput) {
                    dataDemissaoInput.addEventListener('change', () => this.checkAndEnableButton());
                }

                // Listener para o campo de aviso prévio
                const avisoPrevioSelect = document.getElementById('demissao-aviso-previo');
                const motivoDispensaContainer = document.getElementById('container-motivo-dispensa-aviso');
                if (avisoPrevioSelect && motivoDispensaContainer) {
                    avisoPrevioSelect.addEventListener('change', () => {
                        motivoDispensaContainer.classList.toggle('d-none', avisoPrevioSelect.value !== 'Dispensado');
                        if (avisoPrevioSelect.value !== 'Dispensado') {
                            document.getElementById('demissao-motivo-dispensa-aviso').value = '';
                        }
                    });
                }
            }

            // Carregar empresas para o formulário de admissão
            const empresaAdmissaoSelect = document.getElementById('empresa-funcionario-admissao');
            const setorAdmissaoSelect = document.getElementById('setor-funcionario-admissao');
            if (empresaAdmissaoSelect) {
                await carregarSelectEmpresas('empresa-funcionario-admissao');
                empresaAdmissaoSelect.addEventListener('change', async () => {
                    await carregarSetoresPorEmpresa(empresaAdmissaoSelect.value, 'setor-funcionario-admissao');
                    await this.carregarFuncoesPorEmpresa(empresaAdmissaoSelect.value, 'cargo-funcionario-admissao');
                });
            }

            if (setorAdmissaoSelect) {
                setorAdmissaoSelect.addEventListener('change', async () => {
                    const setorDesc = setorAdmissaoSelect.value;
                    const empresaId = empresaAdmissaoSelect.value;
                    const liderSelect = document.getElementById('lider-funcionario-admissao');

                    if (!setorDesc || !empresaId || !liderSelect) return;

                    try {
                        const setorSnap = await db.collection('setores').where('empresaId', '==', empresaId).where('descricao', '==', setorDesc).limit(1).get();
                        if (!setorSnap.empty) {
                            liderSelect.value = setorSnap.docs[0].data().gerenteId || '';
                        }
                    } catch (error) {
                        console.error("Erro ao buscar líder do setor para admissão:", error);
                    }
                });
            }

            // Carregar líderes para o formulário de admissão
            const liderAdmissaoSelect = document.getElementById('lider-funcionario-admissao');
            if (liderAdmissaoSelect) {
                await this.carregarSelectLideres('lider-funcionario-admissao');
            }

        } catch (error) {
            console.error('Erro ao carregar selects:', error);
            this.mostrarMensagem('Erro ao carregar dados dos selects', 'error');
        }
    }

    async carregarFuncoesPorEmpresa(empresaId, selectId) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;
            
            select.innerHTML = '<option value="">Selecione um cargo</option>';
            select.disabled = true;

            if (!empresaId) {
                select.innerHTML = '<option value="">Selecione a empresa primeiro</option>';
                return;
            }
            
            const empresaDoc = await db.collection('empresas').doc(empresaId).get();
            if (!empresaDoc.exists) return;

            const empresa = empresaDoc.data();
            
            if (empresa.funcoes && empresa.funcoes.length > 0) {
                select.disabled = false;
                empresa.funcoes.forEach(funcao => {
                    select.innerHTML += `<option value="${funcao}">${funcao}</option>`;
                });
            }
        } catch (error) {
            console.error('Erro ao carregar funções:', error);
        }
    }

    async carregarSelectLideres(selectId) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;

            select.innerHTML = '<option value="">Sem líder</option>';

            // Usa o cache de funcionários ativos já carregado
            if (__funcionarios_ativos_cache) {
                __funcionarios_ativos_cache.forEach(func => {
                    const option = document.createElement('option');
                    option.value = func.id;
                    option.textContent = func.nome;
                    select.appendChild(option);
                });
            } else {
                 const funcionariosSnapshot = await db.collection('funcionarios')
                    .where('status', '==', 'Ativo')
                    .orderBy('nome').get();
                 funcionariosSnapshot.forEach(doc => {
                    const func = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = func.nome;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar líderes:', error);
        }
    }

    async enviarRescisaoParaFinanceiro(funcionario, dataDemissao) {
        console.log(">>> [DEBUG] Iniciando integração financeira da rescisão...");
        console.log("Funcionário:", funcionario.nome, "ID:", funcionario.id);

        const elTotalLiquido = document.getElementById('rescisao-total-liquido');
        const elFgts = document.getElementById('rescisao-fgts-valor');
        const elMulta = document.getElementById('rescisao-multa-rescisoria');

        if (!elTotalLiquido) {
            console.error(">>> [DEBUG] ERRO: Elemento 'rescisao-total-liquido' não encontrado no DOM.");
            return;
        }

        // 1. Valor Líquido da Rescisão (Corrigido replace para remover todos os pontos de milhar)
        const valorLiquidoTexto = elTotalLiquido.textContent;
        console.log(">>> [DEBUG] Texto Valor Líquido:", valorLiquidoTexto);
        
        // Ajuste para ler corretamente o formato do toFixed(2) (ex: "R$ 1884.09") ou formato BR
        let valorLiquido = 0;
        if (valorLiquidoTexto.includes(',') && valorLiquidoTexto.includes('.')) {
             valorLiquido = parseFloat(valorLiquidoTexto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
        } else {
             // Formato padrão JS/toFixed (ponto é decimal)
             valorLiquido = parseFloat(valorLiquidoTexto.replace('R$', '').replace(',', '').trim());
        }
        console.log(">>> [DEBUG] Valor Líquido Numérico:", valorLiquido);

        // 2. Valor FGTS
        const valorFGTS = parseFloat(elFgts ? elFgts.value : 0) || 0;
        console.log(">>> [DEBUG] Valor FGTS:", valorFGTS);

        // 3. Valor Multa Rescisória
        const valorMulta = parseFloat(elMulta ? elMulta.value : 0) || 0;
        console.log(">>> [DEBUG] Valor Multa:", valorMulta);

        const batch = db.batch();
        const dataVencimento = new Date(dataDemissao.replace(/-/g, '\/'));
        let lancamentosCount = 0;

        if (valorLiquido > 0) {
            const refLiquido = db.collection('lancamentos_financeiros').doc();
            const dadosLiquido = {
                empresaId: funcionario.empresaId,
                funcionarioId: funcionario.id,
                funcionarioNome: funcionario.nome,
                origem: 'FOPAG',
                subdivisao: 'Rescisões',
                setor: funcionario.setor,
                dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
                dataVencimento: dataVencimento,
                valor: valorLiquido,
                status: 'Pendente',
                motivo: `Valor Liquido da rescisão - ${funcionario.nome}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            console.log(">>> [DEBUG] Preparando lançamento Líquido:", dadosLiquido);
            batch.set(refLiquido, dadosLiquido);
            lancamentosCount++;
        }

        if (valorFGTS > 0) {
            const refFGTS = db.collection('lancamentos_financeiros').doc();
            const dadosFGTS = {
                empresaId: funcionario.empresaId,
                funcionarioId: funcionario.id,
                funcionarioNome: funcionario.nome,
                origem: 'FOPAG',
                subdivisao: 'Encargos',
                setor: funcionario.setor,
                dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
                dataVencimento: dataVencimento,
                valor: valorFGTS,
                status: 'Pendente',
                motivo: `FGTS Rescisório - ${funcionario.nome}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            console.log(">>> [DEBUG] Preparando lançamento FGTS:", dadosFGTS);
            batch.set(refFGTS, dadosFGTS);
            lancamentosCount++;
        }

        if (valorMulta > 0) {
            const refMulta = db.collection('lancamentos_financeiros').doc();
            const dadosMulta = {
                empresaId: funcionario.empresaId,
                funcionarioId: funcionario.id,
                funcionarioNome: funcionario.nome,
                origem: 'FOPAG',
                subdivisao: 'Encargos',
                setor: funcionario.setor,
                dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
                dataVencimento: dataVencimento,
                valor: valorMulta,
                status: 'Pendente',
                motivo: `Multa Rescisória - ${funcionario.nome}`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            console.log(">>> [DEBUG] Preparando lançamento Multa:", dadosMulta);
            batch.set(refMulta, dadosMulta);
            lancamentosCount++;
        }

        if (lancamentosCount > 0) {
            console.log(`>>> [DEBUG] Enviando batch com ${lancamentosCount} lançamentos...`);
            await batch.commit();
            console.log(">>> [DEBUG] Integração financeira concluída com sucesso.");
        } else {
            console.warn(">>> [DEBUG] Nenhum valor > 0 para lançar no financeiro.");
        }
    }

    resetarFormularioDemissao() {
        const form = document.getElementById('form-demissao');
        if (form) form.reset();
        
        const btnRegistrar = document.querySelector('#form-demissao .btn-danger');
        if (btnRegistrar) {
            btnRegistrar.innerHTML = '<i class="fas fa-user-slash"></i> Confirmar e Registrar Demissão';
            // Garante que o onclick aponte para a função correta
            btnRegistrar.onclick = () => this.registrarDemissao();
        }
        
        const btnCancel = document.getElementById('btn-cancelar-edicao-demissao');
        if (btnCancel) btnCancel.remove();
        
        const infoContainer = document.getElementById('demissao-info-funcionario');
        if (infoContainer) infoContainer.style.display = 'none';
    }

    async registrarDemissao() {
        console.log("Iniciando registro de demissão...");
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const data = document.getElementById('demissao-data').value;
        const tipoDemissao = document.getElementById('demissao-tipo').value;
        const avisoPrevio = document.getElementById('demissao-aviso-previo').value;
        const motivo = document.getElementById('demissao-motivo').value;
        const observacoes = document.getElementById('demissao-observacoes').value;
        const necessitaReposicao = document.getElementById('demissao-reposicao').checked;
        const motivoDispensaAviso = document.getElementById('demissao-motivo-dispensa-aviso').value;

        if (!funcionarioId || !data || !tipoDemissao || !motivo) {
            this.mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
            return;
        }

        try {
            const user = firebase.auth().currentUser;
            
            // Garante que o cache de funcionários esteja carregado
            if (!__funcionarios_ativos_cache || __funcionarios_ativos_cache.length === 0) {
                await this.carregarSelectsMovimentacao();
            }

            const funcionario = __funcionarios_ativos_cache.find(f => f.id === funcionarioId);

            if (!funcionario) {
                this.mostrarMensagem("Funcionário não encontrado.", "error");
                return;
            }

            const movimentacaoData = {
                funcionarioId: funcionarioId,
                funcionarioNome: funcionario.nome,
                empresaId: funcionario.empresaId,
                setor: funcionario.setor,
                cargo: funcionario.cargo,
                tipo: 'demissao',
                data: new Date(data.replace(/-/g, '/')),
                motivo: tipoDemissao,
                motivoDetalhado: motivo,
                detalhes: observacoes,
                avisoPrevio: avisoPrevio,
                motivoDispensaAviso: avisoPrevio === 'Dispensado' ? motivoDispensaAviso : null,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                registradoPor: user ? user.uid : null,
                status: 'Concluído'
            };

            const movimentacaoRef = await db.collection('movimentacoes').add(movimentacaoData);

            await db.collection('funcionarios').doc(funcionarioId).update({
                status: 'Inativo',
                necessitaReposicao: necessitaReposicao,
                ultimaMovimentacao: movimentacaoData.data
            });

            // --- AUTOMAÇÃO: Criar solicitação de reposição automaticamente ---
            if (necessitaReposicao) {
                try {
                    const reposicaoData = {
                        funcionarioId: funcionarioId,
                        funcionarioNome: funcionario.nome,
                        empresaId: funcionario.empresaId,
                        setor: funcionario.setor,
                        cargo: funcionario.cargo,
                        observacoes: 'Reposição automática gerada por demissão.',
                        status: 'pendente',
                        abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
                        createdByUid: user ? user.uid : null
                    };
                    await db.collection('reposicoes').add(reposicaoData);
                    this.mostrarMensagem("Solicitação de reposição gerada automaticamente.", "info");
                } catch (repoError) {
                    console.error("Erro ao gerar reposição automática:", repoError);
                    this.mostrarMensagem("Erro ao gerar reposição automática.", "warning");
                }
            }
            // ----------------------------------------------------------------

            this.mostrarMensagem("Demissão registrada com sucesso!", "success");
            
            // Resetar formulário
            const formDemissao = document.getElementById('form-demissao');
            if (formDemissao) formDemissao.reset();
            
            const infoContainer = document.getElementById('demissao-info-funcionario');
            if (infoContainer) infoContainer.style.display = 'none';

            // Se for pedido de demissão, abre o modal de entrevista
            if (tipoDemissao === 'Pedido de Demissão') {
                this.abrirModalAuditoriaRescisao(movimentacaoRef.id, funcionario.nome);
            }

            await this.carregarDadosIniciais();

        } catch (error) {
            console.error("Erro ao registrar demissão:", error);
            this.mostrarMensagem("Falha ao registrar a demissão.", "error");
        }
    }

    async lancarRescisaoFinanceiro() {
        console.log(">>> [DEBUG] Iniciando lançamento financeiro manual...");
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const dataDemissao = document.getElementById('demissao-data').value;

        if (!funcionarioId || !dataDemissao) {
            this.mostrarMensagem("Funcionário ou data da demissão não encontrados no formulário principal.", "error");
            return;
        }

        let funcionario = __funcionarios_ativos_cache.find(f => f.id === funcionarioId);
        if (!funcionario) {
            // Tenta buscar no banco caso seja um funcionário já inativo
            const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (!funcDoc.exists) {
                this.mostrarMensagem("Funcionário não encontrado para o lançamento financeiro.", "error");
                return;
            }
            funcionario = {id: funcDoc.id, ...funcDoc.data()};
        }

        try {
            await this.enviarRescisaoParaFinanceiro(funcionario, dataDemissao);
            
            // Mantém o modal aberto conforme solicitado
            // const modal = bootstrap.Modal.getInstance(document.getElementById('calculoRescisaoModal'));
            // if (modal) modal.hide();

            this.mostrarMensagem("Lançamento financeiro da rescisão enviado com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao lançar rescisão no financeiro:", error);
            this.mostrarMensagem("Falha ao enviar para o financeiro.", "error");
        }
    }

    async calcularRescisao() {
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const dataDemissaoStr = document.getElementById('demissao-data').value;

        if (!funcionarioId || !dataDemissaoStr) {
            this.mostrarMensagem("Selecione um funcionário e a data da demissão para calcular.", "warning");
            return;
        }

        try {
            const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (!funcionarioDoc.exists) {
                this.mostrarMensagem("Funcionário não encontrado.", "error");
                return;
            }

            const funcionario = funcionarioDoc.data();
            const dataDemissao = new Date(dataDemissaoStr.replace(/-/g, '\/'));
            const dataAdmissao = funcionario.dataAdmissao.toDate();
            const salario = funcionario.salario || 0;

            // Cálculos Prévios (simplificados)
            const diasTrabalhadosMes = dataDemissao.getDate();
            const saldoSalario = (salario / 30) * diasTrabalhadosMes;

            const mesesTrabalhadosAno = dataDemissao.getMonth() + 1;
            const decimoTerceiroProporcional = (salario / 12) * mesesTrabalhadosAno;

            const umDozeAvosFerias = salario / 12;
            const feriasProporcionais = umDozeAvosFerias * mesesTrabalhadosAno;
            const tercoFeriasProporcionais = feriasProporcionais / 3;

            // Cálculo de Férias Vencidas
            const tempoDeCasaMs = dataDemissao.getTime() - dataAdmissao.getTime();
            const tempoDeCasaMeses = tempoDeCasaMs / (1000 * 60 * 60 * 24 * 30.44);
            
            let feriasVencidas = 0;
            if (tempoDeCasaMeses > 12) {
                feriasVencidas = salario; // Simplificação: um salário se tiver mais de 1 ano
            }
            const tercoFeriasVencidas = feriasVencidas / 3;

            // Soma de todas as verbas
            const totalVerbas = saldoSalario + decimoTerceiroProporcional + feriasVencidas + tercoFeriasVencidas + feriasProporcionais + tercoFeriasProporcionais;

            // Descontos (simplificados)
            const inss = totalVerbas * 0.075; // Alíquota mínima
            const irrf = 0; // Simplificado

            const totalDescontos = inss + irrf;
            const totalLiquido = totalVerbas - totalDescontos;

            // Preencher modal
            document.getElementById('rescisao-funcionario-nome').textContent = funcionario.nome;
            document.getElementById('rescisao-saldo-salario').value = saldoSalario.toFixed(2);
            document.getElementById('rescisao-ferias-vencidas').value = feriasVencidas.toFixed(2);
            document.getElementById('rescisao-media-ferias-vencidas').value = "0.00";
            // O terço será calculado automaticamente na função atualizarTotaisRescisao
            document.getElementById('rescisao-ferias-proporcionais').value = feriasProporcionais.toFixed(2);
            document.getElementById('rescisao-media-ferias-proporcionais').value = "0.00";
            // O terço será calculado automaticamente
            document.getElementById('rescisao-horas-extras').value = "0.00";
            document.getElementById('rescisao-dsr-horas-extras').value = "0.00";
            document.getElementById('rescisao-media-horas').value = "0.00";
            document.getElementById('rescisao-13-salario').value = decimoTerceiroProporcional.toFixed(2);
            document.getElementById('rescisao-indenizacao').value = "0.00";

            // Descontos
            document.getElementById('rescisao-desconto-faltas').value = "0.00";
            document.getElementById('rescisao-desconto-dsr').value = "0.00";
            document.getElementById('rescisao-inss').value = inss.toFixed(2);
            document.getElementById('rescisao-desconto-farmacia').value = "0.00";
            document.getElementById('rescisao-irrf').value = irrf.toFixed(2);
            document.getElementById('rescisao-desconto-inss-13').value = "0.00";
            document.getElementById('rescisao-desconto-aviso').value = "0.00";
            document.getElementById('rescisao-desconto-vales').value = "0.00";
            document.getElementById('rescisao-desconto-consulta').value = "0.00";
            document.getElementById('rescisao-desconto-consignado').value = "0.00";
            document.getElementById('rescisao-desconto-dif-salarial').value = "0.00";
            document.getElementById('rescisao-desconto-outros').value = "0.00";
            document.getElementById('rescisao-desconto-dif-salarial').value = "0.00";
            document.getElementById('rescisao-desconto-outros').value = "0.00";

            // Extras
            document.getElementById('rescisao-fgts-valor').value = "0.00";
            document.getElementById('rescisao-multa-rescisoria').value = "0.00";

            // Totalizadores
            this.atualizarTotaisRescisao();

            const modal = new bootstrap.Modal(document.getElementById('calculoRescisaoModal'));
            modal.show();

        } catch (error) {
            console.error("Erro ao calcular rescisão:", error);
            this.mostrarMensagem("Falha ao calcular a rescisão.", "error");
        }
    }

    atualizarTotaisRescisao() {
        // Adicionar event listeners para os inputs
        document.querySelectorAll('#form-calculo-rescisao input').forEach(input => {
            input.addEventListener('input', () => this.calcularTotaisRescisao());
        });
        this.calcularTotaisRescisao();
    }

    calcularTotaisRescisao() {
        // Cálculo automático dos terços
        const feriasVencidas = parseFloat(document.getElementById('rescisao-ferias-vencidas').value) || 0;
        const mediaFeriasVencidas = parseFloat(document.getElementById('rescisao-media-ferias-vencidas').value) || 0;
        const tercoVencidas = (feriasVencidas + mediaFeriasVencidas) / 3;
        document.getElementById('rescisao-terco-ferias-vencidas').value = tercoVencidas.toFixed(2);

        const feriasProp = parseFloat(document.getElementById('rescisao-ferias-proporcionais').value) || 0;
        const mediaFeriasProp = parseFloat(document.getElementById('rescisao-media-ferias-proporcionais').value) || 0;
        const tercoProp = (feriasProp + mediaFeriasProp) / 3;
        document.getElementById('rescisao-terco-ferias-proporcionais').value = tercoProp.toFixed(2);

        // Soma dos Proventos
        let verbas = 0;
        document.querySelectorAll('#form-calculo-rescisao .verba').forEach(el => {
            verbas += parseFloat(el.value) || 0;
        });

        // Soma dos Descontos
        let descontos = 0;
        document.querySelectorAll('#form-calculo-rescisao .desconto').forEach(el => {
            descontos += parseFloat(el.value) || 0;
        });

        document.getElementById('rescisao-total-verbas').textContent = `R$ ${verbas.toFixed(2)}`;
        document.getElementById('rescisao-total-descontos').textContent = `R$ ${descontos.toFixed(2)}`;
        document.getElementById('rescisao-total-liquido').textContent = `R$ ${(verbas - descontos).toFixed(2)}`;
    }

    imprimirTermoRescisao() {
        const nomeFuncionario = document.getElementById('rescisao-funcionario-nome').textContent;
        const dataDemissao = document.getElementById('demissao-data').value;
        const tipoDemissao = document.getElementById('demissao-tipo').value;

        let html = `<h2>Termo de Rescisão de Contrato de Trabalho</h2>`;
        html += `<p><strong>Funcionário:</strong> ${nomeFuncionario}</p>`;
        html += `<p><strong>Data de Desligamento:</strong> ${new Date(dataDemissao.replace(/-/g, '\/')).toLocaleDateString('pt-BR')}</p>`;
        html += `<p><strong>Tipo:</strong> ${tipoDemissao}</p><hr>`;
        html += `<h4>Verbas Rescisórias</h4>`;
        html += `<ul>`;
        document.querySelectorAll('#form-calculo-rescisao .verba').forEach(input => {
            html += `<li>${input.previousElementSibling.textContent}: <strong>R$ ${parseFloat(input.value).toFixed(2)}</strong></li>`;
        });
        html += `</ul><p><strong>Total Verbas: ${document.getElementById('rescisao-total-verbas').textContent}</strong></p>`;
        html += `<h4>Descontos</h4>`;
        html += `<ul>`;
        document.querySelectorAll('#form-calculo-rescisao .desconto').forEach(input => {
            html += `<li>${input.previousElementSibling.textContent}: <strong>R$ ${parseFloat(input.value).toFixed(2)}</strong></li>`;
        });
        html += `</ul><p><strong>Total Descontos: ${document.getElementById('rescisao-total-descontos').textContent}</strong></p>`;
        html += `<hr><h3>Valor Líquido a Receber: ${document.getElementById('rescisao-total-liquido').textContent}</h3>`;

        openPrintWindow(html, { title: 'Termo de Rescisão' });
    }

    async registrarAdmissao() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                this.mostrarMensagem('Usuário não autenticado', 'error');
                return;
            }

            const nome = document.getElementById('nome-funcionario-admissao').value;
            const empresaId = document.getElementById('empresa-funcionario-admissao').value;
            const setor = document.getElementById('setor-funcionario-admissao').value;
            const cargo = document.getElementById('cargo-funcionario-admissao').value;
            const dataAdmissao = document.getElementById('data-admissao').value;
            const salario = document.getElementById('salario-funcionario-admissao').value;
            const liderId = document.getElementById('lider-funcionario-admissao').value;

            if (!nome || !empresaId || !setor || !cargo || !dataAdmissao) {
                this.mostrarMensagem('Preencha todos os campos obrigatórios', 'warning');
                return;
            }

            // Criar funcionário
            const funcionarioData = {
                nome: nome,
                empresaId: empresaId,
                setor: setor,
                cargo: cargo,
                salario: salario ? parseFloat(salario) : null,
                dataAdmissao: new Date(dataAdmissao + 'T00:00:00'),
                status: 'Ativo',
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
                criadoPor: user.uid,
                liderId: liderId || null
            };

            const funcionarioRef = await db.collection('funcionarios').add(funcionarioData);

            // Registrar movimentação de admissão
            const movimentacaoData = {
                funcionarioId: funcionarioRef.id,
                funcionarioNome: nome,
                empresaId: empresaId,
                setor: setor,
                cargo: cargo,
                tipo: 'admissao',
                data: new Date(dataAdmissao + 'T00:00:00'),
                motivo: 'Admissão',
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                registradoPor: user.uid,
                status: 'Concluído'
            };

            await db.collection('movimentacoes').add(movimentacaoData);

            this.mostrarMensagem('Admissão registrada com sucesso!', 'success');
            
            // Resetar formulário
            const formAdmissao = document.getElementById('form-admissao');
            if (formAdmissao) formAdmissao.reset();
            
            // Recarregar dados
            await this.carregarDadosIniciais();

        } catch (error) {
            console.error('Erro ao registrar admissão:', error);
            this.mostrarMensagem('Erro ao registrar admissão', 'error');
        }
    }

    async carregarHistoricoMovimentacoes() {
        try {
            const container = document.getElementById('tabela-movimentacoes');
            if (!container) return;

            container.innerHTML = this.createLoadingRow(6);

            const reposicoesSnapshot = await db.collection('reposicoes')
                .orderBy('abertaEm', 'desc')
                .limit(50)
                .get();

            if (reposicoesSnapshot.empty) {
                container.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma reposição registrada</td></tr>';
                return;
            }

            container.innerHTML = '';
            reposicoesSnapshot.forEach(doc => {
                const rep = doc.data();
                const dataObj = rep.abertaEm?.toDate ? rep.abertaEm.toDate() : new Date(rep.abertaEm);

                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = this.createHistoricoRow(doc.id, rep, dataObj);
                container.appendChild(row);
            });

        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            const container = document.getElementById('tabela-movimentacoes');
            if (container) {
                container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar histórico</td></tr>';
            }
        }
    }

    createHistoricoRow(id, reposicao, data) {
        const statusBadge = reposicao.status === 'preenchida'
            ? '<span class="badge bg-success">Preenchida</span>'
            : reposicao.status === 'cancelada'
            ? '<span class="badge bg-secondary">Cancelada</span>'
            : '<span class="badge bg-warning text-dark">Pendente</span>';

        return `
            <td>${this.formatarData(data)}</td>
            <td>
                <div class="d-flex flex-column">
                    <strong>${reposicao.funcionarioNome || 'N/A'}</strong>
                    <small class="text-muted">${reposicao.cargo || ''}</small>
                </div>
            </td>
            <td>${reposicao.setor || '-'}</td>
            <td>${statusBadge}</td>
            <td>${reposicao.observacoes || '-'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-danger" onclick="movimentacoesManager.excluirReposicao('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    }

    async excluirMovimentacao(movimentacaoId, funcionarioId, tipo) {
        if (!confirm('Tem certeza que deseja excluir esta movimentação? O status do funcionário será revertido.')) {
            return;
        }

        try {
            // Excluir movimentação
            await db.collection('movimentacoes').doc(movimentacaoId).delete();

            // Reverter status do funcionário
            if (funcionarioId) {
                const novoStatus = tipo === 'demissao' ? 'Ativo' : 'Inativo';
                await db.collection('funcionarios').doc(funcionarioId).update({
                    status: novoStatus,
                    ultimaMovimentacao: null
                });
            }

            this.mostrarMensagem('Movimentação excluída com sucesso!', 'success');

            // Recarregar dados
            await Promise.all([
                this.carregarHistoricoMovimentacoes(),
                this.carregarDashboardMovimentacoes(),
                this.carregarGraficosMovimentacoes()
            ]);

        } catch (error) {
            console.error('Erro ao excluir movimentação:', error);
            this.mostrarMensagem('Erro ao excluir movimentação', 'error');
        }
    }

    async excluirReposicao(reposicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta reposição?')) {
            return;
        }

        try {
            // Excluir reposição
            await db.collection('reposicoes').doc(reposicaoId).delete();

            this.mostrarMensagem('Reposição excluída com sucesso!', 'success');

            // Recarregar dados
            await this.carregarHistoricoMovimentacoes();

        } catch (error) {
            console.error('Erro ao excluir reposição:', error);
            this.mostrarMensagem('Erro ao excluir reposição', 'error');
        }
    }

    async carregarDashboardMovimentacoes() {
        try {
            const hoje = new Date();
            const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

            const [
                admissoesMes,
                demissoesMes,
                totalFuncionarios
            ] = await Promise.all([
                this.contarMovimentacoesPorPeriodo('admissao', inicioMes, fimMes),
                this.contarMovimentacoesPorPeriodo('demissao', inicioMes, fimMes),
                this.contarTotalFuncionarios()
            ]);

            // Atualizar métricas
            this.atualizarMetrica('mov-admissoes-mes', admissoesMes);
            this.atualizarMetrica('mov-demissoes-mes', demissoesMes);
            this.atualizarMetrica('mov-total-funcionarios', totalFuncionarios);

            // Calcular taxa de rotatividade
            const taxaRotatividade = totalFuncionarios > 0 
                ? ((demissoesMes / totalFuncionarios) * 100).toFixed(1)
                : '0.0';
            
            this.atualizarMetrica('mov-taxa-rotatividade', taxaRotatividade + '%');

        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    }

    async carregarGraficosMovimentacoes() {
        try {
            await Promise.all([
                this.criarGraficoMovimentacoesMensal(),
                this.criarGraficoMovimentacoesSetor(),
                this.criarGraficoMotivosDemissao()
            ]);
        } catch (error) {
            console.error('Erro ao carregar gráficos:', error);
        }
    }

    async criarGraficoMovimentacoesMensal() {
        const ctx = document.getElementById('grafico-movimentacoes-mensal');
        if (!ctx) return;

        // Destruir gráfico anterior se existir
        if (this.graficoMensal) {
            this.graficoMensal.destroy();
        }

        // Dados dos últimos 6 meses
        const meses = [];
        const admissoes = [];
        const demissoes = [];

        for (let i = 5; i >= 0; i--) {
            const data = new Date();
            data.setMonth(data.getMonth() - i);
            const mes = data.toLocaleDateString('pt-BR', { month: 'short' });
            meses.push(mes);

            const inicioMes = new Date(data.getFullYear(), data.getMonth(), 1);
            const fimMes = new Date(data.getFullYear(), data.getMonth() + 1, 0);

            const [adm, dem] = await Promise.all([
                this.contarMovimentacoesPorPeriodo('admissao', inicioMes, fimMes),
                this.contarMovimentacoesPorPeriodo('demissao', inicioMes, fimMes)
            ]);

            admissoes.push(adm);
            demissoes.push(dem);
        }

        this.graficoMensal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Admissões',
                        data: admissoes,
                        borderColor: '#4361ee',
                        backgroundColor: 'rgba(67, 97, 238, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Demissões',
                        data: demissoes,
                        borderColor: '#f72585',
                        backgroundColor: 'rgba(247, 37, 133, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Movimentações Mensais'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async criarGraficoMovimentacoesSetor() {
        const ctx = document.getElementById('grafico-movimentacoes-setor');
        if (!ctx) return;

        // Destruir gráfico anterior se existir
        if (this.graficoSetor) {
            this.graficoSetor.destroy();
        }

        // Agrupar movimentações por setor
        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .where('data', '>=', new Date(new Date().getFullYear(), 0, 1))
            .get();

        const setores = {};
        movimentacoesSnapshot.forEach(doc => {
            const mov = doc.data();
            const setor = mov.setor || 'Não informado';
            
            if (!setores[setor]) {
                setores[setor] = { admissoes: 0, demissoes: 0 };
            }
            
            if (mov.tipo === 'admissao') {
                setores[setor].admissoes++;
            } else {
                setores[setor].demissoes++;
            }
        });

        const labels = Object.keys(setores);
        const admissoesData = labels.map(setor => setores[setor].admissoes);
        const demissoesData = labels.map(setor => setores[setor].demissoes);

        this.graficoSetor = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Admissões',
                        data: admissoesData,
                        backgroundColor: 'rgba(67, 97, 238, 0.8)',
                    },
                    {
                        label: 'Demissões',
                        data: demissoesData,
                        backgroundColor: 'rgba(247, 37, 133, 0.8)',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Movimentações por Setor'
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    async criarGraficoMotivosDemissao() {
        const ctx = document.getElementById('grafico-motivos-demissao');
        if (!ctx) return;

        // Destruir gráfico anterior se existir
        if (this.graficoMotivos) {
            this.graficoMotivos.destroy();
        }

        const demissoesSnapshot = await db.collection('movimentacoes')
            .where('tipo', '==', 'demissao')
            .where('data', '>=', new Date(new Date().getFullYear(), 0, 1))
            .get();

        const motivos = {};
        demissoesSnapshot.forEach(doc => {
            const motivo = doc.data().motivo || 'Não informado';
            motivos[motivo] = (motivos[motivo] || 0) + 1;
        });

        const labels = Object.keys(motivos);
        const data = Object.values(motivos);

        this.graficoMotivos = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4361ee', '#3a0ca3', '#7209b7', '#f72585',
                        '#4cc9f0', '#4895ef', '#560bad', '#b5179e'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Motivos de Demissão'
                    }
                }
            }
        });
    }

    async filtrarMovimentacoes() {
        try {
            const empresaFiltro = document.getElementById('mov-filtro-empresa')?.value;
            const setorFiltro = document.getElementById('mov-filtro-setor')?.value;
            const statusFiltro = document.getElementById('mov-filtro-status')?.value;

            let query = db.collection('reposicoes').orderBy('abertaEm', 'desc');

            // Aplicar filtros no servidor quando possível
            if (empresaFiltro) {
                query = query.where('empresaId', '==', empresaFiltro);
            }

            const reposicoesSnapshot = await query.limit(50).get();
            const container = document.getElementById('tabela-movimentacoes');

            if (!container) return;

            container.innerHTML = '';

            // Filtrar no cliente para status e setor (quando não foi possível no servidor)
            const docsFiltrados = reposicoesSnapshot.docs.filter(doc => {
                const data = doc.data();

                // Filtro de Status
                if (statusFiltro && statusFiltro !== 'ambos') {
                    const status = data.status || 'pendente';
                    if (status !== statusFiltro) return false;
                }

                // Filtro de Setor (se não foi aplicado no servidor)
                if (setorFiltro && data.setor !== setorFiltro) return false;

                return true;
            });

            if (docsFiltrados.length === 0) {
                container.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma reposição encontrada</td></tr>';
                return;
            }

            docsFiltrados.forEach(doc => {
                const rep = doc.data();
                const dataObj = rep.abertaEm?.toDate ? rep.abertaEm.toDate() : new Date(rep.abertaEm);

                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = this.createHistoricoRow(doc.id, rep, dataObj);
                container.appendChild(row);
            });

        } catch (error) {
            console.error('Erro ao filtrar reposições:', error);
            this.mostrarMensagem('Erro ao filtrar reposições', 'error');
        }
    }

    abrirModalAuditoriaRescisao(movimentacaoId, nomeFuncionario) {
        // Implementar abertura do modal de auditoria
        console.log(`Abrir modal de auditoria para ${nomeFuncionario}, movimentação: ${movimentacaoId}`);
        // Exemplo: $('#modal-auditoria-rescisao').modal('show');
    }

    // Métodos utilitários
    async contarMovimentacoesPorPeriodo(tipo, dataInicio, dataFim) {
        const snapshot = await db.collection('movimentacoes')
            .where('tipo', '==', tipo)
            .where('data', '>=', dataInicio)
            .where('data', '<=', dataFim)
            .get();
        return snapshot.size;
    }

    async contarTotalFuncionarios() {
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();
        return snapshot.size;
    }

    formatarData(data) {
        return new Date(data).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    atualizarMetrica(elementId, valor) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = valor;
        }
    }

    createLoadingRow(colspan) {
        return `
            <tr>
                <td colspan="${colspan}" class="text-center">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span class="ms-2">Carregando...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    mostrarMensagem(mensagem, tipo = 'info') {
        // Sistema de notificações simplificado
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${tipo} fade-in`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getIconeMensagem(tipo)}"></i>
                <span>${mensagem}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    getIconeMensagem(tipo) {
        const icones = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icones[tipo] || 'info-circle';
    }
}

// DECLARAR a variável global
let __funcionarios_ativos_cache = [];

// Inicializar gerenciador de movimentações
const movimentacoesManager = new MovimentacoesManager();

// Exportar para uso global
window.movimentacoesManager = movimentacoesManager;

// Funções para abrir modais de solicitação, agora parte deste módulo
async function abrirNovaReposicaoModal() {
    try {
        // Resetar formulário
        const form = document.getElementById('form-reposicao-nova');
        if (form) form.reset();
        
        // Limpar ID de edição
        document.getElementById('rep-solicitacao-id').value = '';

        // Popular o select de funcionários demitidos
        const selectFuncionario = document.getElementById('rep-nova-funcionario');
        selectFuncionario.innerHTML = '<option value="">Selecione um funcionário (opcional)</option>';
        
        // Buscar reposições já existentes para evitar duplicidade
        const reposicoesSnap = await db.collection('reposicoes').get();
        const funcionariosComReposicao = new Set();
        reposicoesSnap.forEach(doc => {
            const data = doc.data();
            if (data.funcionarioId) {
                funcionariosComReposicao.add(data.funcionarioId);
            }
        });

        // Filtra funcionários demitidos e que necessitam de reposição
        const funcSnap = await db.collection('funcionarios').where('status', '==', 'Inativo').orderBy('nome').get();
        funcSnap.forEach(doc => {
            const funcionario = doc.data();
            // Filtro em memória para garantir compatibilidade se o campo não existir em registros antigos
            // E verifica se já não existe solicitação para este funcionário
            if (funcionario.necessitaReposicao === true && !funcionariosComReposicao.has(doc.id)) {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${funcionario.nome}`;
                // Armazena dados para preenchimento automático
                option.dataset.empresaId = funcionario.empresaId;
                option.dataset.setor = funcionario.setor;
                option.dataset.cargo = funcionario.cargo;
                selectFuncionario.appendChild(option);
            }
        });

        // Popular empresas
        await carregarSelectEmpresas('rep-nova-empresa');
        // Resetar selects de setor e cargo
        document.getElementById('rep-nova-setor').innerHTML = '<option value="">Selecione a empresa</option>';
        document.getElementById('rep-nova-cargo').value = '';

        // Listener para preenchimento automático
        selectFuncionario.addEventListener('change', async function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption && selectedOption.value) {
                document.getElementById('rep-nova-empresa').value = selectedOption.dataset.empresaId;
                await carregarSetoresPorEmpresa(selectedOption.dataset.empresaId, 'rep-nova-setor');
                document.getElementById('rep-nova-setor').value = selectedOption.dataset.setor;
                document.getElementById('rep-nova-cargo').value = selectedOption.dataset.cargo;
            }
        });

        // Resetar título e botão para modo de criação
        const modalEl = document.getElementById('reposicaoNovaModal');
        if (modalEl) {
            modalEl.querySelector('.modal-title').textContent = 'Nova Solicitação de Reposição';
            const btn = modalEl.querySelector('.modal-footer .btn-primary');
            if (btn) {
                btn.textContent = 'Abrir Solicitação';
                btn.setAttribute('onclick', 'criarReposicaoManual()');
            }
        }
        
        const modal = new bootstrap.Modal(document.getElementById('reposicaoNovaModal'));
        modal.show();
    } catch (error) {
        console.error("Erro ao abrir modal de reposição:", error);
        mostrarMensagem("Erro ao preparar solicitação de reposição.", "error");
    }
}
window.abrirNovaReposicaoModal = abrirNovaReposicaoModal;

async function abrirNovaContratacaoModal() {
    try {
        // Resetar formulário
        const form = document.getElementById('form-contratacao-nova');
        if (form) form.reset();
        
        // Limpar ID de edição
        document.getElementById('contr-solicitacao-id').value = '';
        
        // Popular empresas
        await carregarSelectEmpresas('contr-empresa');
        // Resetar selects de setor e cargo
        document.getElementById('contr-setor').innerHTML = '<option value="">Selecione a empresa</option>';
        document.getElementById('contr-cargo').innerHTML = '<option value="">Selecione a empresa</option>';

        // Configurar listener para carregar setores e cargos
        const empSelect = document.getElementById('contr-empresa');
        empSelect.onchange = async function() {
             await carregarSetoresPorEmpresa(this.value, 'contr-setor');
             if (window.movimentacoesManager) {
                await window.movimentacoesManager.carregarFuncoesPorEmpresa(this.value, 'contr-cargo');
             }
        };
        
        // Resetar título e botão
        const modalEl = document.getElementById('contratacaoNovaModal');
        if (modalEl) {
            modalEl.querySelector('.modal-title').textContent = 'Nova Solicitação de Contratação';
            const btn = modalEl.querySelector('.modal-footer .btn-primary');
            if (btn) {
                btn.textContent = 'Abrir Solicitação';
                btn.setAttribute('onclick', 'criarContratacaoManual()');
            }
        }
        
        const modal = new bootstrap.Modal(document.getElementById('contratacaoNovaModal'));
        modal.show();
    } catch (error) {
        console.error("Erro ao abrir modal de contratação:", error);
        mostrarMensagem("Erro ao preparar solicitação de contratação.", "error");
    }
}
window.abrirNovaContratacaoModal = abrirNovaContratacaoModal;

async function criarReposicaoManual() {
    try {
        const solicitacaoId = document.getElementById('rep-solicitacao-id').value;
        const funcionarioId = document.getElementById('rep-nova-funcionario').value;
        const funcionarioNome = funcionarioId ? 
            document.getElementById('rep-nova-funcionario').options[document.getElementById('rep-nova-funcionario').selectedIndex].text : 
            '';
        const empresaId = document.getElementById('rep-nova-empresa').value;
        const setor = document.getElementById('rep-nova-setor').value;
        const cargo = document.getElementById('rep-nova-cargo').value;
        const observacoes = document.getElementById('rep-nova-observacoes').value;

        if (!empresaId || !setor || !cargo) {
            mostrarMensagem("Empresa, Setor e Cargo são obrigatórios.", "warning");
            return;
        }

        const dados = {
            funcionarioId: funcionarioId || null,
            funcionarioNome: funcionarioId ? funcionarioNome : 'N/A',
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            observacoes: observacoes,
            status: 'pendente',
            abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (solicitacaoId) {
            // Modo edição
            await db.collection('reposicoes').doc(solicitacaoId).update(dados);
            mostrarMensagem("Solicitação de reposição atualizada com sucesso!", "success");
        } else {
            // Modo criação
            await db.collection('reposicoes').add(dados);
            mostrarMensagem("Solicitação de reposição aberta com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('reposicaoNovaModal')).hide();
        
        if (typeof window.carregarDashboardMovimentacoes === 'function') {
            await window.carregarDashboardMovimentacoes();
        }

    } catch (error) {
        console.error("Erro ao criar/atualizar solicitação de reposição:", error);
        mostrarMensagem("Falha ao salvar solicitação.", "error");
    }
}
window.criarReposicaoManual = criarReposicaoManual;

async function criarContratacaoManual() {
    try {
        const empresaId = document.getElementById('contr-empresa').value;
        const setor = document.getElementById('contr-setor').value;
        const cargo = document.getElementById('contr-cargo').value;
        const salario = document.getElementById('contr-salario').value;
        const turno = document.getElementById('contr-turno').value;
        const quantidade = parseInt(document.getElementById('contr-quantidade').value) || 1;
        const observacoes = document.getElementById('contr-observacoes').value;
        const solicitacaoId = document.getElementById('contr-solicitacao-id').value; // Para edição

        if (!empresaId || !setor || !cargo) {
            mostrarMensagem("Empresa, Setor e Cargo são obrigatórios.", "warning");
            return;
        }

        const dados = {
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            salario: salario,
            turno: turno,
            quantidade: quantidade,
            observacoes: observacoes,
            status: 'pendente',
            abertaEm: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (solicitacaoId) {
            // Modo edição
            await db.collection('contratacoes').doc(solicitacaoId).update(dados);
            mostrarMensagem("Solicitação de contratação atualizada com sucesso!", "success");
        } else {
            // Modo criação
            await db.collection('contratacoes').add(dados);
            mostrarMensagem("Solicitação de contratação aberta com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('contratacaoNovaModal')).hide();
        
        if (typeof window.carregarDashboardMovimentacoes === 'function') {
            await window.carregarDashboardMovimentacoes();
        }

    } catch (error) {
        console.error("Erro ao criar solicitação de contratação:", error);
        mostrarMensagem("Falha ao criar solicitação.", "error");
    }
}
window.criarContratacaoManual = criarContratacaoManual;

async function preencherVaga(solicitacaoId, tipo) {
    const modalEl = document.getElementById('modalSelecionarColaboradorReposicao');
    if (!modalEl) {
        console.error("Modal não encontrado");
        return;
    }
    
    document.getElementById('reposicao-id-selecao').value = solicitacaoId;
    modalEl.dataset.tipoSolicitacao = tipo;
    
    const select = document.getElementById('select-colaborador-reposicao');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione o colaborador</option>';
        snap.forEach(doc => {
            const f = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = f.nome;
            select.appendChild(option);
        });
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao carregar colaboradores.", "error");
    }
}
window.preencherVaga = preencherVaga;

async function confirmarPreenchimentoVaga() {
    const modalEl = document.getElementById('modalSelecionarColaboradorReposicao');
    const solicitacaoId = document.getElementById('reposicao-id-selecao').value;
    const select = document.getElementById('select-colaborador-reposicao');
    const funcionarioId = select.value;
    const funcionarioNome = select.options[select.selectedIndex].text;
    const tipo = modalEl.dataset.tipoSolicitacao;
    
    if (!funcionarioId) {
        mostrarMensagem("Selecione um colaborador.", "warning");
        return;
    }
    
    try {
        const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
        const docRef = db.collection(colecao).doc(solicitacaoId);
        
        await docRef.update({ 
            status: 'preenchida', 
            preenchidaEm: firebase.firestore.FieldValue.serverTimestamp(),
            funcionarioPreenchimentoId: funcionarioId,
            funcionarioPreenchimentoNome: funcionarioNome
        });
        
        mostrarMensagem("Vaga preenchida com sucesso!", "success");
        bootstrap.Modal.getInstance(modalEl).hide();
        
        if (typeof window.carregarDashboardMovimentacoes === 'function') {
            await window.carregarDashboardMovimentacoes();
        }
        
    } catch (error) {
        console.error("Erro ao preencher vaga:", error);
        mostrarMensagem("Erro ao preencher vaga.", "error");
    }
}
window.confirmarPreenchimentoVaga = confirmarPreenchimentoVaga;

// FUNÇÃO ÚNICA DE EDIÇÃO - VERSÃO CORRIGIDA
async function editarSolicitacao(solicitacaoId, tipo) {
    console.log(`Iniciando edição: ID=${solicitacaoId}, Tipo=${tipo}`);
    
    // Limpeza e validação dos parâmetros
    const id = solicitacaoId ? String(solicitacaoId).trim() : '';
    const tipoLimpo = tipo ? String(tipo).trim().toLowerCase() : '';

    if (!id || id === 'undefined' || id === 'null') {
        mostrarMensagem("ID da solicitação inválido.", "error");
        return;
    }
    
    let colecao = '';
    let tipoFinal = tipoLimpo;

    // Se tipo não for informado, tenta descobrir
    if (!tipoFinal) {
        console.warn("Tipo não informado, tentando inferir...");
        try {
            const docRep = await db.collection('reposicoes').doc(id).get();
            if (docRep.exists) {
                tipoFinal = 'reposicao';
                colecao = 'reposicoes';
            } else {
                const docContr = await db.collection('contratacoes').doc(id).get();
                if (docContr.exists) {
                    tipoFinal = 'contratacao';
                    colecao = 'contratacoes';
                }
            }
        } catch(e) {
            console.error("Erro ao inferir tipo:", e);
        }
    } else {
        colecao = tipoFinal === 'reposicao' ? 'reposicoes' : 'contratacoes';
    }

    if (!tipoFinal || (tipoFinal !== 'reposicao' && tipoFinal !== 'contratacao')) {
        console.error(`Tipo de solicitação inválido ou não encontrado: ${tipo}`);
        mostrarMensagem("Tipo de solicitação inválido.", "error");
        return;
    }
    
    try {
        console.log(`Buscando documento em: ${colecao}/${id}`);
        const doc = await db.collection(colecao).doc(id).get();
        
        if (!doc.exists) {
            console.error(`Documento não encontrado: ${colecao}/${id}`);
            mostrarMensagem("Solicitação não encontrada no sistema.", "error");
            return;
        }
        
        const data = doc.data();
        console.log("Dados carregados:", data);

        if (tipoFinal === 'reposicao') {
            // Primeiro carregar os dados e só depois abrir o modal
            const modalEl = document.getElementById('reposicaoNovaModal');
            if (!modalEl) {
                mostrarMensagem("Modal de reposição não encontrado", "error");
                return;
            }
            
            // Preencher campos ANTES de abrir o modal
            const idInput = document.getElementById('rep-solicitacao-id');
            if (idInput) idInput.value = id;
            
            // Preencher empresa se existir
            if (data.empresaId) {
                const empSelect = document.getElementById('rep-nova-empresa');
                if (empSelect) {
                    // Primeiro carregar as empresas
                    await carregarSelectEmpresas('rep-nova-empresa');
                    empSelect.value = data.empresaId;
                    
                    // Carregar setores e cargos
                    await carregarSetoresPorEmpresa(data.empresaId, 'rep-nova-setor');
                    
                    const setorSelect = document.getElementById('rep-nova-setor');
                    if (setorSelect) setorSelect.value = data.setor || '';
                    
                    const cargoInput = document.getElementById('rep-nova-cargo');
                    if (cargoInput) cargoInput.value = data.cargo || '';
                }
            }
            
            // Preencher observações
            const obsInput = document.getElementById('rep-nova-observacoes');
            if (obsInput) obsInput.value = data.observacoes || '';
            
            // Lidar com funcionário
            const selectFunc = document.getElementById('rep-nova-funcionario');
            if (selectFunc && data.funcionarioId) {
                // Primeiro carregar funcionários
                selectFunc.innerHTML = '<option value="">Selecione um funcionário (opcional)</option>';
                try {
                    const funcSnap = await db.collection('funcionarios').where('status', '==', 'Inativo').orderBy('nome').get();
                    funcSnap.forEach(doc => {
                        const funcionario = doc.data();
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.textContent = funcionario.nome;
                        option.dataset.empresaId = funcionario.empresaId;
                        option.dataset.setor = funcionario.setor;
                        option.dataset.cargo = funcionario.cargo;
                        selectFunc.appendChild(option);
                    });
                    
                    // Agora selecionar o funcionário correto
                    selectFunc.value = data.funcionarioId;
                } catch (error) {
                    console.error("Erro ao carregar funcionários:", error);
                }
            }
            
            // Configurar título do modal
            const modalTitle = modalEl.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = 'Editar Solicitação de Reposição';
            
            const btnSalvar = modalEl.querySelector('.modal-footer .btn-primary');
            if (btnSalvar) {
                btnSalvar.textContent = 'Salvar Alterações';
                btnSalvar.onclick = () => criarReposicaoManual();
            }
            
            // Finalmente, abrir o modal
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

        } else if (tipoFinal === 'contratacao') {
            // Primeiro carregar os dados e só depois abrir o modal
            const modalEl = document.getElementById('contratacaoNovaModal');
            if (!modalEl) {
                mostrarMensagem("Modal de contratação não encontrado", "error");
                return;
            }
            
            const idInput = document.getElementById('contr-solicitacao-id');
            if (idInput) idInput.value = id;
            
            if (data.empresaId) {
                const empSelect = document.getElementById('contr-empresa');
                if (empSelect) {
                    // Primeiro carregar as empresas
                    await carregarSelectEmpresas('contr-empresa');
                    empSelect.value = data.empresaId;
                    
                    // Carregar setores e cargos
                    await carregarSetoresPorEmpresa(data.empresaId, 'contr-setor');
                    if (window.movimentacoesManager && typeof window.movimentacoesManager.carregarFuncoesPorEmpresa === 'function') {
                        await window.movimentacoesManager.carregarFuncoesPorEmpresa(data.empresaId, 'contr-cargo');
                    }
                    
                    const setorSelect = document.getElementById('contr-setor');
                    if (setorSelect) setorSelect.value = data.setor || '';
                    
                    const cargoSelect = document.getElementById('contr-cargo');
                    if (cargoSelect) cargoSelect.value = data.cargo || '';
                }
            }
            
            const salarioInput = document.getElementById('contr-salario');
            if (salarioInput) salarioInput.value = data.salario || '';
            
            const turnoSelect = document.getElementById('contr-turno');
            if (turnoSelect) turnoSelect.value = data.turno || 'Dia';
            
            const qtdInput = document.getElementById('contr-quantidade');
            if (qtdInput) qtdInput.value = data.quantidade || 1;
            
            const obsInput = document.getElementById('contr-observacoes');
            if (obsInput) obsInput.value = data.observacoes || '';
            
            // Configurar título do modal
            const modalTitle = modalEl.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = 'Editar Solicitação de Contratação';
            
            const btnSalvar = modalEl.querySelector('.modal-footer .btn-primary');
            if (btnSalvar) {
                btnSalvar.textContent = 'Salvar Alterações';
                btnSalvar.onclick = () => criarContratacaoManual();
            }
            
            // Finalmente, abrir o modal
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
        
    } catch (error) {
        console.error("Erro ao editar solicitação:", error);
        mostrarMensagem("Erro ao carregar dados da solicitação.", "error");
    }
}
window.editarSolicitacao = editarSolicitacao;

async function excluirSolicitacao(solicitacaoId, tipo) {
    const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
    if (!confirm(`Tem certeza que deseja excluir esta solicitação de ${tipo}?`)) {
        return;
    }
    try {
        await db.collection(colecao).doc(solicitacaoId).delete();
        mostrarMensagem("Solicitação excluída com sucesso.", "success");
        if (typeof window.carregarDashboardMovimentacoes === 'function') {
            await window.carregarDashboardMovimentacoes();
        }
    } catch (error) {
        console.error("Erro ao excluir solicitação:", error);
        mostrarMensagem("Falha ao excluir a solicitação.", "error");
    }
}
window.excluirSolicitacao = excluirSolicitacao;

async function visualizarSolicitacao(solicitacaoId, tipo) {
    const colecao = tipo === 'reposicao' ? 'reposicoes' : 'contratacoes';
    try {
        const doc = await db.collection(colecao).doc(solicitacaoId).get();
        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        }
        const data = doc.data();
        const empresaDoc = await db.collection('empresas').doc(data.empresaId).get();
        const nomeEmpresa = empresaDoc.exists ? empresaDoc.data().nome : 'N/A';

        const dataAbertura = data.abertaEm ? new Date(data.abertaEm.toDate()).toLocaleDateString('pt-BR') : 'N/A';

        let corpoHtml = `
            <div class="row mb-3">
                <div class="col-md-6">
                    <p class="mb-1"><strong>Empresa:</strong> ${nomeEmpresa}</p>
                    <p class="mb-1"><strong>Setor:</strong> ${data.setor}</p>
                    <p class="mb-1"><strong>Cargo:</strong> ${data.cargo}</p>
                </div>
                <div class="col-md-6">
                    <p class="mb-1"><strong>Data Abertura:</strong> ${dataAbertura}</p>
                    <p class="mb-1"><strong>Status Atual:</strong> <span class="badge bg-${data.status === 'preenchida' ? 'success' : (data.status === 'cancelada' ? 'secondary' : 'warning')}">${data.status || 'pendente'}</span></p>
                </div>
            </div>
        `;

        if (tipo === 'contratacao') {
            corpoHtml += `
                <div class="p-3 bg-light rounded mb-3">
                    <p class="mb-1"><strong>Salário Proposto:</strong> R$ ${parseFloat(data.salario || 0).toFixed(2)}</p>
                    <p class="mb-1"><strong>Quantidade de Vagas:</strong> ${data.quantidade || 1}</p>
                    <p class="mb-1"><strong>Turno:</strong> ${data.turno || 'N/A'}</p>
                    <p class="mb-0"><strong>Observações:</strong> ${data.observacoes || 'Nenhuma'}</p>
                </div>
            `;
        } else { // reposicao
            corpoHtml += `
                <div class="p-3 bg-light rounded mb-3">
                    <p class="mb-1"><strong>Funcionário Desligado:</strong> ${data.funcionarioNome || 'N/A'}</p>
                    <p class="mb-0"><strong>Observações:</strong> ${data.observacoes || 'Nenhuma'}</p>
                </div>
            `;
        }

        // Adicionar controles de edição e status
        corpoHtml += `
            <hr>
            <div class="row align-items-end">
                <div class="col-md-6">
                    <label class="form-label fw-bold small">Alterar Status:</label>
                    <select class="form-select form-select-sm" onchange="atualizarStatusSolicitacao('${solicitacaoId}', '${colecao}', this.value)">
                        <option value="pendente" ${data.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="preenchida" ${data.status === 'preenchida' ? 'selected' : ''}>Preenchida</option>
                        <option value="cancelada" ${data.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                    </select>
                </div>
                <div class="col-md-6 text-end">
                    <button class="btn btn-primary btn-sm w-100" onclick="fecharModalGenerico(); editarSolicitacao('${solicitacaoId}', '${tipo}')">
                        <i class="fas fa-edit me-2"></i> Editar Dados
                    </button>
                </div>
            </div>
        `;

        // Função auxiliar para abrir modal genérico (se não existir globalmente)
        if (typeof window.abrirModalGenerico !== 'function') {
             window.abrirModalGenerico = function(titulo, corpo) {
                const modalHtml = `
                <div class="modal fade" id="modalGenerico" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${titulo}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${corpo}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
                
                // Remove modal anterior se existir
                const modalAnterior = document.getElementById('modalGenerico');
                if (modalAnterior) modalAnterior.remove();
                
                // Adiciona novo modal
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                // Mostra o modal
                const modal = new bootstrap.Modal(document.getElementById('modalGenerico'));
                modal.show();
            }
        }
        
        window.abrirModalGenerico(`Detalhes da Solicitação de ${tipo}`, corpoHtml);

    } catch (error) {
        console.error("Erro ao visualizar solicitação:", error);
        mostrarMensagem("Erro ao carregar detalhes da solicitação.", "error");
    }
}
window.visualizarSolicitacao = visualizarSolicitacao;

async function atualizarStatusSolicitacao(id, colecao, novoStatus) {
    try {
        await db.collection(colecao).doc(id).update({
            status: novoStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Status atualizado com sucesso!", "success");
        
        // Atualiza o dashboard se a função estiver disponível
        if (typeof window.carregarDashboardMovimentacoes === 'function') {
            window.carregarDashboardMovimentacoes();
        }
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        mostrarMensagem("Erro ao atualizar status.", "error");
    }
}
window.atualizarStatusSolicitacao = atualizarStatusSolicitacao;

function fecharModalGenerico() {
    const modalEl = document.getElementById('modalGenerico');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}
window.fecharModalGenerico = fecharModalGenerico;

async function calcularCustoEstimadoContratacao(salario, empresaId) {
    if (!salario || !empresaId) return 0;

    const fgts = salario * 0.08;
    const provisaoFerias = salario / 12;
    const tercoFerias = provisaoFerias / 3;
    const fgtsSobreFerias = provisaoFerias * 0.08;
    const provisao13 = salario / 12;
    const fgtsSobre13 = provisao13 * 0.08;

    let custoSindicato = 0;
    let custoPatronal = 0;
    let custoRat = 0;
    let custoTerceiros = 0;

    try {
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (empresaDoc.exists) {
            const empresaData = empresaDoc.data();
            const impostos = empresaData.impostos || {};
            const baseCalculoContribuicoes = salario + provisaoFerias + provisao13;

            if (impostos.sindicato > 0) {
                custoSindicato = baseCalculoContribuicoes * (impostos.sindicato / 100);
            }
            if (impostos.patronal > 0) {
                custoPatronal = baseCalculoContribuicoes * (impostos.patronal / 100);
            }
            if (empresaData.rat > 0) {
                custoRat = baseCalculoContribuicoes * (empresaData.rat / 100);
            }
            if (impostos.terceiros > 0) {
                custoTerceiros = baseCalculoContribuicoes * (impostos.terceiros / 100);
            }
        }
    } catch (error) {
        console.error("Erro ao buscar dados da empresa para cálculo de custo de contratação:", error);
    }

    const custoTotal = salario + fgts + provisaoFerias + tercoFerias + fgtsSobreFerias + provisao13 + fgtsSobre13 + custoSindicato + custoPatronal + custoRat + custoTerceiros;
    return parseFloat((custoTotal || 0).toFixed(2));
}
window.calcularCustoEstimadoContratacao = calcularCustoEstimadoContratacao;

// Função de teste para verificar se um documento existe
async function testarSolicitacao(id) {
    try {
        console.log(`Testando solicitação: ${id}`);
        
        const reposicao = await db.collection('reposicoes').doc(id).get();
        const contratacao = await db.collection('contratacoes').doc(id).get();
        
        console.log('Resultado do teste:');
        console.log(`- Existe em reposicoes: ${reposicao.exists}`);
        console.log(`- Existe em contratacoes: ${contratacao.exists}`);
        
        if (reposicao.exists) {
            console.log('Dados da reposição:', reposicao.data());
        }
        if (contratacao.exists) {
            console.log('Dados da contratação:', contratacao.data());
        }
        
        return { reposicao: reposicao.exists, contratacao: contratacao.exists };
    } catch (error) {
        console.error('Erro no teste:', error);
        return null;
    }
}
window.testarSolicitacao = testarSolicitacao;

async function imprimirReposicoesPendentes() {
    try {
        const empresaFiltro = document.getElementById('mov-filtro-empresa')?.value;
        const setorFiltro = document.getElementById('mov-filtro-setor')?.value;
        const statusFiltro = document.getElementById('mov-filtro-status')?.value; // Captura o status do filtro
        const dataInicio = document.getElementById('mov-filtro-inicio')?.value;
        const dataFim = document.getElementById('mov-filtro-fim')?.value;

        let query = db.collection('reposicoes');

        // Filtro de data no servidor (aproveita índice simples de data)
        if (dataInicio) {
            query = query.where('abertaEm', '>=', new Date(dataInicio + 'T00:00:00'));
        }
        if (dataFim) {
            query = query.where('abertaEm', '<=', new Date(dataFim + 'T23:59:59'));
        }

        // Ordenação
        const snap = await query.orderBy('abertaEm', 'desc').get();

        // Filtragem no cliente para evitar erros de índice composto e suportar "ambos"
        const docsFiltrados = snap.docs.filter(doc => {
            const data = doc.data();
            
            // Filtro de Status
            if (statusFiltro) {
                const status = data.status || 'pendente';
                if (status !== statusFiltro) return false;
            }

            // Filtro de Empresa
            if (empresaFiltro && data.empresaId !== empresaFiltro) return false;

            // Filtro de Setor
            if (setorFiltro && data.setor !== setorFiltro) return false;

            return true;
        });

        if (docsFiltrados.length === 0) {
            mostrarMensagem("Nenhuma reposição encontrada para imprimir com os filtros atuais.", "info");
            return;
        }

        // Carregar nomes das empresas
        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnap.forEach(doc => empresasMap[doc.id] = doc.data().nome);

        let html = `
            <html>
            <head>
                <title>Relatório de Reposições</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    @page { size: landscape; margin: 1cm; }
                    body { font-family: 'Segoe UI', sans-serif; padding: 20px; font-size: 11px; color: #333; }
                    .header { border-bottom: 2px solid #0d6efd; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                    .header h2 { margin: 0; color: #0d6efd; font-weight: 700; font-size: 24px; }
                    .meta-info { text-align: right; font-size: 12px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                    th { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 10px; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 10px; color: #555; }
                    td { border: 1px solid #dee2e6; padding: 10px; vertical-align: middle; }
                    tr:nth-child(even) { background-color: #fcfcfc; }
                    .badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
                    .badge-pendente { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
                    .badge-preenchida { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .badge-cancelada { background-color: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }
                    .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Relatório de Reposições</h2>
                    <div class="meta-info">
                        <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
                        <div><strong>Filtro Status:</strong> ${statusFiltro ? statusFiltro.toUpperCase() : 'TODOS'}</div>
                        ${dataInicio ? `<div><strong>Período:</strong> ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : 'Hoje'}</div>` : ''}
                    </div>
                </div>
                
                <table class="table">
                    <thead>
                        <tr>
                            <th>Data Abertura</th>
                            <th>Empresa</th>
                            <th>Setor</th>
                            <th>Cargo</th>
                            <th>Colaborador Substituído</th>
                            <th>Novo Colaborador</th>
                            <th>Data Preenchimento</th>
                            <th>Status</th>
                            <th>Observações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        docsFiltrados.forEach(doc => {
            const data = doc.data();
            const dataAbertura = data.abertaEm ? new Date(data.abertaEm.toDate()).toLocaleDateString('pt-BR') : '-';
            const empresaNome = empresasMap[data.empresaId] || 'N/A';
            
            const status = data.status || 'pendente';
            const statusClass = `badge-${status}`;
            
            const dataPreenchimento = data.preenchidaEm ? new Date(data.preenchidaEm.toDate()).toLocaleDateString('pt-BR') : '-';
            const novoColaborador = data.funcionarioPreenchimentoNome || '-';

            html += `
                <tr>
                    <td>${dataAbertura}</td>
                    <td>${empresaNome}</td>
                    <td>${data.setor || '-'}</td>
                    <td>${data.cargo || '-'}</td>
                    <td>${data.funcionarioNome || '-'}</td>
                    <td><strong>${novoColaborador}</strong></td>
                    <td>${dataPreenchimento}</td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td>${data.observacoes || '-'}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                <div class="footer">Gerado pelo Sistema Nexter</div>
            </body>
            </html>
        `;

        openPrintWindow(html, { autoPrint: true });

    } catch (error) {
        console.error("Erro ao imprimir reposições:", error);
        mostrarMensagem("Erro ao gerar relatório.", "error");
    }
}
window.imprimirReposicoesPendentes = imprimirReposicoesPendentes;

// Função auxiliar para mostrar mensagens
function mostrarMensagem(mensagem, tipo = 'info') {
    // Sistema de notificações simplificado
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${tipo} fade-in`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getIconeMensagem(tipo)}"></i>
            <span>${mensagem}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function getIconeMensagem(tipo) {
    const icones = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icones[tipo] || 'info-circle';
}

// Função auxiliar para abrir janela de impressão
function openPrintWindow(html, options = {}) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        alert('Permita pop-ups para imprimir o documento.');
        return;
    }
    
    printWindow.document.open();
    printWindow.document.write(`
        <html>
        <head>
            <title>${options.title || 'Documento'}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${html}
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}