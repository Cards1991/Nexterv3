
class MovimentacoesManager {
    constructor() {
        this.graficoMensal = null;
        this.graficoSetor = null;
        this.graficoMotivos = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.carregarDadosIniciais();
    }

    bindEvents() {
        // Adicionar listener para o botão calcular
        document.getElementById('btn-calcular-rescisao')?.addEventListener('click', () => {
            this.calcularRescisao();
        });
    }

    // ADICIONAR ESTE MÉTODO
    checkAndEnableButton() {
        const selectDemissao = document.getElementById('demissao-funcionario');
        const dataDemissaoInput = document.getElementById('demissao-data');
        const btnCalcular = document.getElementById('btn-calcular-rescisao');
        
        if (btnCalcular) {
            btnCalcular.disabled = !(selectDemissao.value && dataDemissaoInput.value);
        }
    }

    init() {
        this.bindEvents();
        this.carregarDadosIniciais();
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
                    if (infoContainer && func) { // CORRIGIDO
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
            }

            // Carregar empresas para o formulário de admissão
            const empresaAdmissaoSelect = document.getElementById('empresa-funcionario-admissao');
            if (empresaAdmissaoSelect) {
                await this.carregarSelectEmpresas('empresa-funcionario-admissao');
                empresaAdmissaoSelect.addEventListener('change', async () => {
                    await this.carregarSetoresPorEmpresa(empresaAdmissaoSelect.value, 'setor-funcionario-admissao');
                    await this.carregarFuncoesPorEmpresa(empresaAdmissaoSelect.value, 'cargo-funcionario-admissao');
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

    async carregarSelectEmpresas(selectId) {
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

    async carregarSetoresPorEmpresa(empresaId, selectId) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;

            if (!empresaId) {
                select.innerHTML = '<option value="">Selecione um setor</option>';
                return;
            }

            const setoresSnapshot = await db.collection('setores')
                .where('empresaId', '==', empresaId)
                .orderBy('nome')
                .get();

            select.innerHTML = '<option value="">Selecione um setor</option>';
            setoresSnapshot.forEach(doc => {
                select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome}</option>`;
            });
        } catch (error) {
            console.error('Erro ao carregar setores:', error);
        }
    }

    async carregarFuncoesPorEmpresa(empresaId, selectId) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;

            if (!empresaId) {
                select.innerHTML = '<option value="">Selecione um cargo</option>';
                return;
            }

            const funcoesSnapshot = await db.collection('funcoes')
                .where('empresaId', '==', empresaId)
                .orderBy('nome')
                .get();

            select.innerHTML = '<option value="">Selecione um cargo</option>';
            funcoesSnapshot.forEach(doc => {
                select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome}</option>`;
            });
        } catch (error) {
            console.error('Erro ao carregar funções:', error);
        }
    }

    async carregarSelectLideres(selectId) {
        try {
            const select = document.getElementById(selectId);
            if (!select) return;

            const lideresSnapshot = await db.collection('funcionarios')
                .where('status', '==', 'Ativo')
                .where('cargo', 'in', ['Gerente', 'Supervisor', 'Coordenador', 'Líder'])
                .orderBy('nome')
                .get();

            select.innerHTML = '<option value="">Selecione um líder</option>';
            lideresSnapshot.forEach(doc => {
                const data = doc.data();
                select.innerHTML += `<option value="${doc.id}">${data.nome} - ${data.cargo}</option>`;
            });
        } catch (error) {
            console.error('Erro ao carregar líderes:', error);
        }
    }

    async enviarRescisaoParaFinanceiro(funcionario, dataDemissao) {
        const valorLiquidoTexto = document.getElementById('rescisao-total-liquido').textContent;
        const valorLiquido = parseFloat(valorLiquidoTexto.replace('R$', '').replace('.', '').replace(',', '.').trim());

        if (!valorLiquido || valorLiquido <= 0) {
            this.mostrarMensagem("Valor líquido da rescisão não calculado ou zerado. Lançamento financeiro não gerado.", "warning");
            return;
        }

        const lancamentoFinanceiro = {
            empresaId: funcionario.empresaId,
            funcionarioId: funcionario.id,
            funcionarioNome: funcionario.nome,
            origem: 'FOPAG',
            subdivisao: 'Rescisões',
            setor: funcionario.setor,
            dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
            dataVencimento: new Date(dataDemissao.replace(/-/g, '\/')),
            valor: valorLiquido,
            status: 'Pendente',
            motivo: `Pagamento de Rescisão - ${funcionario.nome}`,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('lancamentos_financeiros').add(lancamentoFinanceiro);
    }

    async registrarDemissao() {
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const data = document.getElementById('demissao-data').value;
        const tipoDemissao = document.getElementById('demissao-tipo').value;
        const avisoPrevio = document.getElementById('demissao-aviso-previo').value;
        const motivo = document.getElementById('demissao-motivo').value;

        if (!funcionarioId || !data || !tipoDemissao || !motivo) {
            this.mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
            return;
        }

        try {
            const user = firebase.auth().currentUser;
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
                detalhes: motivo,
                avisoPrevio: avisoPrevio,
                dataRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                registradoPor: user ? user.uid : null,
                status: 'Concluído'
            };

            const movimentacaoRef = await db.collection('movimentacoes').add(movimentacaoData);

            await db.collection('funcionarios').doc(funcionarioId).update({
                status: 'Demitido',
                ultimaMovimentacao: movimentacaoData.data
            });

            // Envia o valor líquido para o financeiro
            await this.enviarRescisaoParaFinanceiro({ id: funcionarioId, ...funcionario }, data);

            this.mostrarMensagem("Demissão registrada e enviada ao financeiro com sucesso!", "success");
            
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

    async calcularRescisao() {
        const funcionarioId = document.getElementById('demissao-funcionario').value;
        const dataDemissaoStr = document.getElementById('demissao-data').value;

        if (!funcionarioId || !dataDemissaoStr) {
            this.mostrarMensagem("Selecione um funcionário e a data da demissão para calcular.", "warning"); // CORRIGIDO
            return;
        }

        try {
            const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (!funcionarioDoc.exists) {
                this.mostrarMensagem("Funcionário não encontrado.", "error"); // CORRIGIDO
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
            document.getElementById('rescisao-aviso-previo').value = "0.00";
            document.getElementById('rescisao-13-proporcional').value = decimoTerceiroProporcional.toFixed(2);
            document.getElementById('rescisao-ferias-vencidas').value = feriasVencidas.toFixed(2);
            document.getElementById('rescisao-terco-ferias-vencidas').value = tercoFeriasVencidas.toFixed(2);
            document.getElementById('rescisao-ferias-proporcionais').value = feriasProporcionais.toFixed(2);
            document.getElementById('rescisao-terco-ferias').value = tercoFeriasProporcionais.toFixed(2);
            document.getElementById('rescisao-inss').value = inss.toFixed(2);
            document.getElementById('rescisao-irrf').value = irrf.toFixed(2);
            document.getElementById('rescisao-desconto-aviso').value = "0.00";
            document.getElementById('rescisao-desconto-dsr').value = "0.00";
            document.getElementById('rescisao-desconto-farmacia').value = "0.00";
            document.getElementById('rescisao-desconto-vales').value = "0.00";
            document.getElementById('rescisao-outros-descontos').value = "0.00";

            // Totalizadores
            this.atualizarTotaisRescisao();

            const modal = new bootstrap.Modal(document.getElementById('calculoRescisaoModal'));
            modal.show(); // CORRIGIDO

        } catch (error) {
            console.error("Erro ao calcular rescisão:", error);
            this.mostrarMensagem("Falha ao calcular a rescisão.", "error"); // CORRIGIDO
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
        const verbas = [
            'rescisao-saldo-salario', 'rescisao-aviso-previo', 'rescisao-13-proporcional',
            'rescisao-ferias-vencidas', 'rescisao-terco-ferias-vencidas', 'rescisao-ferias-proporcionais',
            'rescisao-terco-ferias'
        ].reduce((acc, id) => acc + (parseFloat(document.getElementById(id).value) || 0), 0);

        const descontos = [
            'rescisao-inss', 'rescisao-irrf', 'rescisao-desconto-aviso'
        ].reduce((acc, id) => acc + (parseFloat(document.getElementById(id).value) || 0), 0);

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

            const movimentacoesSnapshot = await db.collection('movimentacoes')
                .orderBy('data', 'desc')
                .limit(50)
                .get();

            if (movimentacoesSnapshot.empty) {
                container.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação registrada</td></tr>';
                return;
            }

            container.innerHTML = '';
            movimentacoesSnapshot.forEach(doc => {
                const mov = doc.data();
                const dataObj = mov.data?.toDate ? mov.data.toDate() : new Date(mov.data);
                
                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = this.createHistoricoRow(doc.id, mov, dataObj);
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

    createHistoricoRow(id, movimentacao, data) {
        const tipoBadge = movimentacao.tipo === 'admissao' 
            ? '<span class="badge badge-success">Admissão</span>'
            : '<span class="badge badge-danger">Demissão</span>';

        return `
            <td>${this.formatarData(data)}</td>
            <td>
                <div class="d-flex flex-column">
                    <strong>${movimentacao.funcionarioNome}</strong>
                    <small class="text-muted">${movimentacao.cargo || ''}</small>
                </div>
            </td>
            <td>${movimentacao.setor || '-'}</td>
            <td>${tipoBadge}</td>
            <td>${movimentacao.motivo}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-danger" onclick="movimentacoesManager.excluirMovimentacao('${id}', '${movimentacao.funcionarioId}', '${movimentacao.tipo}')">
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

            let query = db.collection('movimentacoes').orderBy('data', 'desc');

            if (empresaFiltro) {
                query = query.where('empresaId', '==', empresaFiltro);
            }

            if (setorFiltro) {
                query = query.where('setor', '==', setorFiltro);
            }

            if (statusFiltro) {
                query = query.where('tipo', '==', statusFiltro);
            }

            const movimentacoesSnapshot = await query.limit(50).get();
            const container = document.getElementById('tabela-movimentacoes');
            
            if (!container) return;

            container.innerHTML = '';
            
            if (movimentacoesSnapshot.empty) {
                container.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação encontrada</td></tr>';
                return;
            }

            movimentacoesSnapshot.forEach(doc => {
                const mov = doc.data();
                const dataObj = mov.data?.toDate ? mov.data.toDate() : new Date(mov.data);
                
                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = this.createHistoricoRow(doc.id, mov, dataObj);
                container.appendChild(row);
            });

        } catch (error) {
            console.error('Erro ao filtrar movimentações:', error);
            this.mostrarMensagem('Erro ao filtrar movimentações', 'error');
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