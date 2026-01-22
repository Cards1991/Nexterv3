// Gerenciamento do Painel Financeiro
const subdivisoesPorOrigem = {
    'FOPAG': ['Folha', 'Rescisões', 'Férias', 'Adiantamento', 'Bônus', 'Horas P.F.'],
    'IMPOSTOS': ['FGTS', 'Darf', 'Multa Rescisória'],
    'DESPESAS COM M.O.': ['SESMT', 'Mensalidades', 'V.R.', 'Cesta Básica', 'Reclamatórias', 'Treinamento', 'Provisão']
};

async function inicializarFinanceiro() {
    configurarFiltrosFinanceiro();
    await carregarLancamentosFinanceiros();
    document.getElementById('btn-fin-filtrar').addEventListener('click', carregarLancamentosFinanceiros);
    const selectAllCheckbox = document.getElementById('fin-print-select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('.print-checkbox').forEach(checkbox => checkbox.checked = e.target.checked);
        });
    }
}

function configurarFiltrosFinanceiro() {
    const origemSelect = document.getElementById('fin-filtro-origem');
    const subdivisaoSelect = document.getElementById('fin-filtro-subdivisao');

    origemSelect.addEventListener('change', () => {
        const origem = origemSelect.value;
        subdivisaoSelect.innerHTML = '<option value="">Todas</option>';
        if (origem && subdivisoesPorOrigem[origem]) {
            subdivisoesPorOrigem[origem].forEach(sub => {
                const option = document.createElement('option');
                option.value = sub;
                option.textContent = sub;
                subdivisaoSelect.appendChild(option);
            });
        }
    });
}

async function carregarLancamentosFinanceiros() {
    const tbody = document.getElementById('tabela-financeiro');
    const totalEl = document.getElementById('fin-total-valor');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Carregando...</td></tr>';

    try {
        let query = db.collection('lancamentos_financeiros');

        const origem = document.getElementById('fin-filtro-origem').value;
        const subdivisao = document.getElementById('fin-filtro-subdivisao').value;
        const inicio = document.getElementById('fin-filtro-inicio').value;
        const fim = document.getElementById('fin-filtro-fim').value;

        if (origem) query = query.where('origem', '==', origem);
        if (subdivisao) query = query.where('subdivisao', '==', subdivisao);
        if (inicio) {
            // Garante que a data de início comece à meia-noite
            query = query.where('dataVencimento', '>=', new Date(inicio.replace(/-/g, '\/')));
        }
        if (fim) {
            // Garante que a data de fim inclua o dia inteiro
            const dataFim = new Date(fim.replace(/-/g, '\/'));
            dataFim.setHours(23, 59, 59, 999);
            query = query.where('dataVencimento', '<=', dataFim);
        }

        const snapshot = await query.orderBy('dataVencimento', 'desc').get();

        // Carregar empresas para mapeamento
        const empresasSnapshot = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnapshot.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
        });

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum lançamento encontrado.</td></tr>';
            totalEl.textContent = 'Total: R$ 0,00';
            return;
        }

        let valorTotal = 0;
        tbody.innerHTML = '';
        for (const doc of snapshot.docs) {
            const lancamento = doc.data();
            valorTotal += lancamento.valor || 0;

            const vencimento = lancamento.dataVencimento.toDate();
            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            let statusBadge;
            if (lancamento.status === 'Pago' || lancamento.status === 'pago') {
                statusBadge = '<span class="badge bg-success">Pago</span>';
            } else if (vencimento < hoje) {
                statusBadge = '<span class="badge bg-danger">Vencido</span>';
            } else {
                statusBadge = '<span class="badge bg-warning text-dark">Pendente</span>';
            }

            const nomeEmpresa = empresasMap[lancamento.empresaId] || 'N/A';

            const row = `
                <tr data-id="${doc.id}">
                    <td><input type="checkbox" class="form-check-input print-checkbox" value="${doc.id}"></td>
                    <td>${formatarData(vencimento)}</td>
                    <td>${nomeEmpresa}</td>
                    <td>${lancamento.funcionarioNome || 'N/A'}</td>
                    <td>${lancamento.origem}</td>
                    <td>${lancamento.subdivisao}</td>
                    <td class="text-end">${(lancamento.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="text-truncate" style="max-width: 150px;" title="${lancamento.motivo || ''}">${lancamento.motivo || '-'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info" onclick="abrirModalLancamentoFinanceiro('${doc.id}', null, true)"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="abrirModalLancamentoFinanceiro('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirLancamentoFinanceiro('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        }

        totalEl.textContent = `Total: R$ ${valorTotal.toFixed(2).replace('.', ',')}`;

    } catch (error) {
        console.error("Erro ao carregar lançamentos financeiros:", error);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function abrirModalLancamentoFinanceiro(lancamentoId = null, dadosPadrao = {}, readOnly = false) {
    const modalId = 'lancamentoFinanceiroModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Lançamento Financeiro</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-lancamento-financeiro">
                            <input type="hidden" id="lancamento-id">
                            <div class="row">
                                <div class="col-md-6 mb-3"><label class="form-label">Empresa</label><select class="form-select" id="fin-empresa" required></select></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Funcionário (Opcional)</label><select class="form-select" id="fin-funcionario"></select></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Setor</label><select class="form-select" id="fin-setor" required></select></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Origem</label><select class="form-select" id="fin-origem" required></select></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Subdivisão</label><select class="form-select" id="fin-subdivisao" required></select></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Data de Envio</label><input type="date" class="form-control" id="fin-data-envio" required></div>
                                <div class="col-md-4 mb-3"><label class="form-label">Valor Total (R$)</label><input type="number" step="0.01" class="form-control" id="fin-valor" required></div>
                                <div class="col-md-2 mb-3"><label class="form-label">Parcelas</label><input type="number" min="1" value="1" class="form-control" id="fin-parcelas" oninput="gerarCamposVencimento(this.value, true)"></div>
                                <div class="col-md-6 mb-3"><label class="form-label">Status</label><select class="form-select" id="fin-status"><option>Pendente</option><option>Pago</option></select></div>
                                <!-- Container para os vencimentos dinâmicos -->
                                <div id="vencimentos-container" class="row g-3 p-2"></div>
                                <div class="col-12 mb-3"><label class="form-label">Motivo/Observação</label><textarea class="form-control" id="fin-motivo" rows="2"></textarea></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-info" id="btn-imprimir-programacao" style="display: none;">
                            <i class="fas fa-print"></i> Imprimir Programação
                        </button>
                        <button type="button" class="btn btn-primary" onclick="salvarLancamentoFinanceiro()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const form = document.getElementById('form-lancamento-financeiro');
    form.reset();
    document.getElementById('lancamento-id').value = lancamentoId || '';

    const empresaSelect = document.getElementById('fin-empresa');
    // Popular selects
    await carregarSelectEmpresas('fin-empresa');
    await carregarSelectFuncionariosAtivos('fin-funcionario', true); // Incluir inativos

    const origemSelect = document.getElementById('fin-origem');
    const subdivisaoSelect = document.getElementById('fin-subdivisao');
    const funcionarioSelect = document.getElementById('fin-funcionario');
    origemSelect.innerHTML = '<option value="">Selecione</option>';
    Object.keys(subdivisoesPorOrigem).forEach(o => origemSelect.innerHTML += `<option>${o}</option>`);

    origemSelect.onchange = () => {
        const origem = origemSelect.value;
        subdivisaoSelect.innerHTML = '<option value="">Selecione</option>';
        if (origem && subdivisoesPorOrigem[origem]) {
            subdivisoesPorOrigem[origem].forEach(s => subdivisaoSelect.innerHTML += `<option>${s}</option>`);
        }
    };

    // Evento para filtrar funcionários e setores ao selecionar uma empresa
    empresaSelect.onchange = async () => {
        const empresaId = empresaSelect.value;
        await carregarSelectFuncionariosAtivos('fin-funcionario', true, empresaId); // Filtra funcionários
        await carregarSetoresPorEmpresa(empresaId, 'fin-setor'); // Carrega setores
        document.getElementById('fin-setor').disabled = false;
    };

    // Evento para preencher setor ao selecionar funcionário
    funcionarioSelect.onchange = async () => {
        const funcId = funcionarioSelect.value;
        const setorSelect = document.getElementById('fin-setor'); // O select de setores

        if (funcId) {
            // Se um funcionário é selecionado, preenche e desabilita os campos
            try {
                const funcDoc = await db.collection('funcionarios').doc(funcId).get();
                if (funcDoc.exists) {
                    const funcData = funcDoc.data();
                    
                    // 1. Define o valor da empresa e desabilita
                    empresaSelect.value = funcData.empresaId;
                    empresaSelect.disabled = true;

                    // 2. Carrega os setores DAQUELA empresa
                    await carregarSetoresPorEmpresa(funcData.empresaId, 'fin-setor');

                    // 3. Define o valor do setor e desabilita
                    setorSelect.value = funcData.setor;
                    setorSelect.disabled = true;
                }

            } catch (error) {
                console.error("Erro ao buscar dados do funcionário:", error);
            }
        } else {
            // Se nenhum funcionário é selecionado, habilita os campos para preenchimento manual
            empresaSelect.disabled = false;
            setorSelect.disabled = false;
            // Recarrega os setores com base na empresa que estiver selecionada
            await carregarSetoresPorEmpresa('fin-setor', empresaSelect.value);
            setorSelect.value = ''; // Limpa a seleção do setor
        }
    };

    if (lancamentoId) {
        const doc = await db.collection('lancamentos_financeiros').doc(lancamentoId).get();
        const data = doc.data();
        document.getElementById('fin-empresa').value = data.empresaId;
        document.getElementById('fin-funcionario').value = data.funcionarioId;
        document.getElementById('fin-data-envio').valueAsDate = data.dataEnvio.toDate();
        document.getElementById('fin-valor').value = data.valor;
        document.getElementById('fin-status').value = data.status;
        document.getElementById('fin-parcelas').value = 1; // Edição não suporta alterar parcelamento
        document.getElementById('fin-parcelas').disabled = true;
        document.getElementById('fin-motivo').value = data.motivo;

        await carregarSetoresPorEmpresa('fin-setor', data.empresaId);
        document.getElementById('fin-setor').value = data.setor;
        document.getElementById('fin-origem').value = data.origem;
        await origemSelect.onchange();
        document.getElementById('fin-subdivisao').value = data.subdivisao;
    } else {
        // Preencher com dados padrão (ex: vindo de uma demissão)
        document.getElementById('fin-parcelas').value = 1;
        document.getElementById('fin-empresa').value = dadosPadrao.empresaId || '';
        document.getElementById('fin-funcionario').value = dadosPadrao.funcionarioId || '';
        document.getElementById('fin-motivo').value = dadosPadrao.motivo || '';
        document.getElementById('fin-origem').value = dadosPadrao.origem || '';
        origemSelect.dispatchEvent(new Event('change'));
        setTimeout(() => {
            document.getElementById('fin-subdivisao').value = dadosPadrao.subdivisao || '';
        }, 100);
        document.getElementById('fin-data-envio').valueAsDate = new Date();
        document.getElementById('fin-parcelas').disabled = false;
    }

    // Lógica para modo somente leitura
    const formFields = form.querySelectorAll('input, select, textarea');
    const saveButton = modalEl.querySelector('.modal-footer .btn-primary');
    const printButton = modalEl.querySelector('#btn-imprimir-programacao');

    if (readOnly) {
        modalEl.querySelector('.modal-title').textContent = 'Visualizar Lançamento';
        formFields.forEach(field => field.disabled = true);
        saveButton.style.display = 'none';
        printButton.style.display = 'inline-block';

        // Adiciona o evento de clique para impressão
        printButton.onclick = async () => {
            const doc = await db.collection('lancamentos_financeiros').doc(lancamentoId).get();
            const empresaDoc = await db.collection('empresas').doc(doc.data().empresaId).get();
            const nomeEmpresa = empresaDoc.exists ? empresaDoc.data().nome : 'N/A';
            imprimirProgramacaoFinanceira({ ...doc.data(), id: doc.id, nomeEmpresa });
        };
    } else {
        modalEl.querySelector('.modal-title').textContent = lancamentoId ? 'Editar Lançamento' : 'Novo Lançamento';
        formFields.forEach(field => field.disabled = false);
        // Garante que o campo de parcelas esteja habilitado para novos lançamentos
        document.getElementById('fin-parcelas').disabled = !!lancamentoId;
        saveButton.style.display = 'inline-block';
        printButton.style.display = 'none';
    }

    // Gera o campo de vencimento inicial
    gerarCamposVencimento(document.getElementById('fin-parcelas').value);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarLancamentoFinanceiro() {
    const lancamentoId = document.getElementById('lancamento-id').value;
    const funcionarioSelect = document.getElementById('fin-funcionario');
    const parcelas = parseInt(document.getElementById('fin-parcelas').value) || 1;

    const data = {
        empresaId: document.getElementById('fin-empresa').value,
        funcionarioId: funcionarioSelect.value,
        funcionarioNome: funcionarioSelect.value ? funcionarioSelect.options[funcionarioSelect.selectedIndex].text : null,
        origem: document.getElementById('fin-origem').value,
        setor: document.getElementById('fin-setor').value,
        subdivisao: document.getElementById('fin-subdivisao').value,
        dataEnvio: new Date(document.getElementById('fin-data-envio').value.replace(/-/g, '\/')),
        valor: parseFloat(document.getElementById('fin-valor').value),
        status: document.getElementById('fin-status').value,
        motivo: document.getElementById('fin-motivo').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.empresaId || !data.origem || !data.subdivisao || !data.valor) {
        mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
        return;
    }

    try {
        if (lancamentoId) {
            // Modo de edição: atualiza apenas o lançamento único, sem lógica de parcelamento.
            await db.collection('lancamentos_financeiros').doc(lancamentoId).update(data);
            mostrarMensagem("Lançamento atualizado com sucesso!", "success");
        } else {
            // Modo de criação: lida com parcelas.
            const valorParcela = data.valor / parcelas;
            const motivoOriginal = data.motivo;

            const batch = db.batch();
            const todasAsParcelas = []; // Array para guardar os dados de todas as parcelas


            for (let i = 0; i < parcelas; i++) {
                const vencimentoInput = document.getElementById(`vencimento-parcela-${i + 1}`);
                if (!vencimentoInput || !vencimentoInput.value) {
                    throw new Error(`A data de vencimento da parcela ${i + 1} não foi informada.`);
                }

                const docRef = db.collection('lancamentos_financeiros').doc(); // Cria uma referência com ID automático
                const dadosParcela = { ...data };

                // Ajusta os dados para a parcela atual
                const dataVencimentoParcela = new Date(vencimentoInput.value.replace(/-/g, '\/'));

                dadosParcela.valor = parseFloat(valorParcela.toFixed(2));
                dadosParcela.dataVencimento = dataVencimentoParcela;
                dadosParcela.motivo = parcelas > 1 ? `${motivoOriginal} (${i + 1}/${parcelas})` : motivoOriginal;
                dadosParcela.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                
                // Adiciona os dados da parcela (com seu ID) ao array
                todasAsParcelas.push({ ...dadosParcela, id: docRef.id });
                batch.set(docRef, dadosParcela);
            }

            await batch.commit();

            const mensagem = parcelas > 1 ? `${parcelas} parcelas foram salvas com sucesso!` : "Lançamento salvo com sucesso!";
            mostrarMensagem(mensagem, "success");

            // Itera sobre todas as parcelas salvas e gera um relatório para cada uma
            for (const parcela of todasAsParcelas) {
                const empresaDoc = await db.collection('empresas').doc(parcela.empresaId).get();
                const nomeEmpresa = empresaDoc.exists ? empresaDoc.data().nome : 'N/A';
                imprimirProgramacaoFinanceira({ ...parcela, nomeEmpresa });
            }
        }

        bootstrap.Modal.getInstance(document.getElementById('lancamentoFinanceiroModal')).hide();
        if (document.getElementById('financeiro').classList.contains('d-none') === false) {
            await carregarLancamentosFinanceiros();
        }

        // Atualiza o painel de análise de custos
        if (typeof inicializarAnaliseCustos === 'function') {
            await inicializarAnaliseCustos();
        }

    } catch (error) {
        console.error("Erro ao salvar lançamento:", error);
        mostrarMensagem("Erro ao salvar lançamento.", "error");
    }
}

function gerarCamposVencimento(numeroDeParcelas, sugerirData = false) {
    const container = document.getElementById('vencimentos-container');
    if (!container) return;

    const parcelas = parseInt(numeroDeParcelas) || 1;
    container.innerHTML = ''; // Limpa o container

    const dataBase = new Date();

    for (let i = 1; i <= parcelas; i++) {
        let dataFormatada = '';
        if (sugerirData) {
            const dataSugerida = new Date(dataBase);
            dataSugerida.setMonth(dataBase.getMonth() + (i - 1));
            dataFormatada = dataSugerida.toISOString().split('T')[0];
        }

        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
            <label class="form-label">Venc. Parcela ${i}</label>
            <input type="date" class="form-control form-control-sm" id="vencimento-parcela-${i}" value="${dataFormatada}" required>
        `;
        container.appendChild(col);
    }
}



async function excluirLancamentoFinanceiro(lancamentoId) {
    if (!confirm('Tem certeza que deseja excluir este lançamento financeiro?')) {
        return;
    }
    try {
        await db.collection('lancamentos_financeiros').doc(lancamentoId).delete();
        mostrarMensagem('Lançamento excluído com sucesso!', 'success');
        await carregarLancamentosFinanceiros();
    } catch (error) {
        console.error("Erro ao excluir lançamento:", error);
        mostrarMensagem('Erro ao excluir lançamento.', 'error');
    }
}

async function imprimirRelatorioFinanceiro() {
    try {
        const idsSelecionados = Array.from(document.querySelectorAll('.print-checkbox:checked')).map(cb => cb.value);

        if (idsSelecionados.length === 0) {
            mostrarMensagem("Selecione pelo menos um lançamento para imprimir.", "warning");
            return;
        }

        const promessas = idsSelecionados.map(id => db.collection('lancamentos_financeiros').doc(id).get());
        const docs = await Promise.all(promessas);
        const registros = docs.map(doc => doc.data());

        // Carregar empresas para mapeamento
        const empresasSnapshot = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnapshot.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
        });

        const valorTotal = registros.reduce((acc, cur) => acc + (cur.valor || 0), 0);

        const filtros = {
            origem: document.getElementById('fin-filtro-origem').value,
            subdivisao: document.getElementById('fin-filtro-subdivisao').value,
            inicio: document.getElementById('fin-filtro-inicio').value,
            fim: document.getElementById('fin-filtro-fim').value
        };

        // Monta o HTML para impressão
        let tabelaHTML = '';
        registros.forEach(lancamento => {
            const nomeEmpresa = empresasMap[lancamento.empresaId] || 'N/A';
            tabelaHTML += `
                <tr>
                    <td>${nomeEmpresa}</td>
                    <td>${formatarData(lancamento.dataVencimento.toDate())}</td>
                    <td>${lancamento.funcionarioNome || 'N/A'}</td>
                    <td>${lancamento.origem}</td>
                    <td>${lancamento.subdivisao}</td>
                    <td class="text-end">R$ ${(lancamento.valor || 0).toFixed(2).replace('.', ',')}</td>
                </tr>
            `;
        });

        const conteudo = `
            <html>
                <head>
                    <title>Relatório de Lançamentos Financeiros</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @page { size: landscape; }
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 25px; }
                        .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dee2e6; padding-bottom: 15px; margin-bottom: 20px; }
                        .report-header .logo { width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; }
                        .report-title { font-weight: 600; }
                        .filters-summary { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: .5rem; padding: 10px 15px; margin-bottom: 20px; font-size: 0.9rem; }
                        .table thead th { background-color: #f1f3f5; }
                        .table tfoot td { font-weight: bold; }
                        .assinatura { margin-top: 80px; text-align: center; }
                        @page { margin: 0; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <div class="d-flex align-items-center">
                            <div class="logo me-3"></div>
                            <div>
                                <h4 class="report-title mb-0">Relatório de Lançamentos Financeiros</h4>
                                <small class="text-muted">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</small>
                            </div>
                        </div>
                    </div>

                    <div class="filters-summary">
                        <strong>Filtros Aplicados:</strong> Origem: ${filtros.origem || 'Todas'} | Período: ${filtros.inicio ? formatarData(new Date(filtros.inicio)) : 'N/A'} a ${filtros.fim ? formatarData(new Date(filtros.fim)) : 'N/A'}
                    </div>

                    <table class="table table-bordered table-sm">
                        <thead><tr><th>Empresa</th><th>Vencimento</th><th>Funcionário</th><th>Origem</th><th>Subdivisão</th><th class="text-end">Valor</th></tr></thead>
                        <tbody>${tabelaHTML}</tbody>
                        <tfoot>
                            <tr class="table-light">
                                <td colspan="4" class="text-end">Total Geral</td>
                                <td class="text-end">R$ ${valorTotal.toFixed(2).replace('.', ',')}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="assinatura">
                        <p>_________________________________________</p>
                        <p><strong>Assinatura e Carimbo do Responsável</strong></p>
                    </div>
                </body>
            </html>
        `;

        openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });
    } catch (error) {
        console.error("Erro ao gerar relatório financeiro:", error);
        mostrarMensagem('Erro ao gerar relatório para impressão.', 'error');
    }
}

async function abrirModalProgramacaoFinanceira(dados) {
    const modalId = 'programacaoFinanceiraModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Programação Financeira</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="programacao-financeira-body">
                        <!-- Conteúdo será injetado aqui -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirProgramacaoFinanceira()"><i class="fas fa-print"></i> Imprimir</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const empresaDoc = await db.collection('empresas').doc(dados.empresaId).get();
    const nomeEmpresa = empresaDoc.exists ? empresaDoc.data().nome : 'N/A';

    const conteudoBody = `
        <div id="programacao-financeira-printable">
            <style>
                .prog-field { padding: 8px; border: 1px solid #dee2e6; border-radius: 6px; background-color: #f8f9fa; }
                .prog-label { font-weight: 600; font-size: .9rem; color: #6c757d; }
                .assinatura { margin-top: 80px; text-align: center; }
            </style>
            <div class="mb-3">
                <div class="prog-label">Empresa</div>
                <div class="prog-field" id="prog-empresa">${nomeEmpresa}</div>
            </div>
            <div class="mb-3">
                <div class="prog-label">Origem</div>
                <div class="prog-field" id="prog-origem">${dados.origem}</div>
            </div>
            <div class="mb-3">
                <div class="prog-label">Subdivisão</div>
                <div class="prog-field" id="prog-subdivisao">${dados.subdivisao}</div>
            </div>
            <div class="mb-3">
                <div class="prog-label">Data de Vencimento</div>
                <div class="prog-field" id="prog-vencimento">${formatarData(dados.dataVencimento)}</div>
            </div>
            <div class="assinatura">
                <p>_________________________________________</p>
                <p><strong>Assinatura e Carimbo</strong></p>
            </div>
        </div>
    `;

    document.getElementById('programacao-financeira-body').innerHTML = conteudoBody;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function imprimirProgramacaoFinanceira(dados) {
    const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Garante que a data seja um objeto Date do Javascript antes de formatar
    const dataVencimentoJS = dados.dataVencimento?.toDate ? dados.dataVencimento.toDate() : new Date(dados.dataVencimento);
    const dataVencFormatada = formatarData(dataVencimentoJS).replace(/\//g, '-');
    // Cria um título dinâmico para o documento
    const titulo = `Prog. Pagamento - ${dados.nomeEmpresa || 'Empresa'} - ${dataVencFormatada}`;

    const conteudoHtml = `
        <html>
            <head>
                <title>${titulo}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <style> 
                    @page { size: A5 portrait; margin: 1.5cm; } /* Define margens da página */
                    body { font-family: 'Segoe UI', system-ui, sans-serif; width: 100%; height: 100%; display: flex; flex-direction: column; }
                    .header-print { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .header-print h3 { font-weight: 700; color: #0d6efd; }
                    .field-group { margin-bottom: 1rem; }
                    .field-label { font-size: 0.8rem; color: #6c757d; font-weight: 600; display: block; margin-bottom: 0.25rem; text-transform: uppercase; }
                    .field-value { font-size: 1.1rem; background-color: #f8f9fa; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #e9ecef; }
                    .assinatura { margin-top: auto; padding-top: 80px; text-align: center; } /* Empurra a assinatura para o final da página */
                    .assinatura p { margin: 0; }
                </style>
            </head>
            <body>
                <div class="header-print"><h3>${titulo}</h3></div>
                <div class="row">
                    <div class="col-12 field-group"><div class="field-label">Empresa</div><div class="field-value">${dados.nomeEmpresa || 'N/A'}</div></div>
                    <div class="col-6 field-group"><div class="field-label">Origem</div><div class="field-value">${dados.origem || 'N/A'}</div></div>
                    <div class="col-6 field-group"><div class="field-label">Subdivisão</div><div class="field-value">${dados.subdivisao || 'N/A'}</div></div>
                    <div class="col-6 field-group"><div class="field-label">Data de Vencimento</div><div class="field-value">${formatarData(dataVencimentoJS)}</div></div>
                    <div class="col-6 field-group"><div class="field-label">Valor</div><div class="field-value">R$ ${dados.valor.toFixed(2).replace('.', ',')}</div></div>
                    <div class="col-12 field-group"><div class="field-label">Motivo / Observação</div><div class="field-value">${dados.motivo || 'Nenhuma observação.'}</div></div>
                </div>
                <div class="assinatura">
                    <p>_________________________________________</p>
                    <p><strong>Recursos Humanos</strong></p>
                </div>
            </body>
        </html>`;
    openPrintWindow(conteudoHtml, { autoPrint: true, name: '' });
}