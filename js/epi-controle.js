// ========================================
// Módulo: Controle de EPI (Estoque e Consumo)
// ========================================

let itensEntregaAtual = []; // Array para armazenar os itens da entrega atual
let validacaoBiometricaAtual = null; // Armazena dados da validação se ocorrer

// Função auxiliar para carregar funcionários ativos
async function carregarSelectFuncionariosAtivos(selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .orderBy('nome')
            .get();

        select.innerHTML = '<option value="">Selecione o Colaborador</option>';

        snapshot.forEach(doc => {
            const func = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${func.nome} ${func.sobrenome || ''}${func.matricula ? ' - ' + func.matricula : ''}`.trim();
            option.dataset.setor = func.setor || '';
            option.dataset.empresaId = func.empresaId || '';
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar funcionários:", error);
        if (document.getElementById(selectId)) {
            document.getElementById(selectId).innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
}

// ========================================
// ESTOQUE DE EPI
// ========================================

async function carregarEstoqueEPI() {
    const tbody = document.getElementById('tabela-estoque-epi');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando estoque...</td></tr>';

    try {
        const termoBusca = document.getElementById('busca-epi')?.value.toLowerCase() || '';
        const filtroSemCusto = document.getElementById('filtro-epi-sem-custo')?.checked;
        const snapshot = await db.collection('epi_estoque').orderBy('descricao').get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum EPI cadastrado.</td></tr>';
            return;
        }

        let html = '';
        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        snapshot.forEach(doc => {
            const epi = doc.data();

            // Filtro de busca local
            if (termoBusca && !epi.descricao.toLowerCase().includes(termoBusca) && !epi.ca.includes(termoBusca)) {
                return;
            }

            // Filtro de Custo Zerado/Em Branco
            if (filtroSemCusto && epi.custo > 0) {
                return;
            }

            // Filtrar lotes substituídos para evitar confusão
            if (epi.status === 'Substituido') return;

            const validadeCA = epi.validadeCA ? new Date(epi.validadeCA.replace(/-/g, '\/')) : null;
            const estoqueAtual = parseInt(epi.quantidade) || 0;
            const estoqueMinimo = parseInt(epi.estoqueMinimo) || 0;

            // Definição de Status e Alertas
            let statusBadge = '<span class="badge bg-success">Normal</span>';
            let rowClass = '';

            if (estoqueAtual <= estoqueMinimo) {
                statusBadge = '<span class="badge bg-danger">Estoque Baixo</span>';
                rowClass = 'table-warning';
            }

            if (validadeCA && validadeCA < hoje) {
                statusBadge += ' <span class="badge bg-dark">CA Vencido</span>';
                rowClass = 'table-danger';
            } else if (validadeCA) {
                const diasParaVencer = Math.ceil((validadeCA - hoje) / (1000 * 60 * 60 * 24));
                if (diasParaVencer <= 30) {
                    statusBadge += ' <span class="badge bg-warning text-dark">CA Vence em breve</span>';
                }
            }

            html += `
                <tr class="${rowClass}">
                    <td><strong>${epi.descricao}</strong></td>
                    <td>${epi.ca}</td>
                    <td>${validadeCA ? validadeCA.toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td>${epi.fornecedor || '-'}</td>
                    <td class="text-center fs-6">
                        <strong>${estoqueAtual}</strong> 
                        <small class="text-muted">/ Min: ${estoqueMinimo}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalEPI('${doc.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirEPI('${doc.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="7" class="text-center text-muted">Nenhum EPI encontrado com o termo pesquisado.</td></tr>';

    } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function abrirModalEPI(epiId = null) {
    const modalEl = document.getElementById('modalNovoEPI');
    const form = document.getElementById('form-epi');
    if (!modalEl || !form) return;

    form.reset();
    document.getElementById('epi-id').value = epiId || '';
    document.getElementById('modalEPITitulo').textContent = epiId ? 'Editar EPI' : 'Novo EPI';

    // O campo de quantidade é sempre somente leitura, pois o estoque é gerenciado por entradas/saídas
    document.getElementById('epi-quantidade').readOnly = true;
    document.getElementById('epi-quantidade').classList.add('bg-light');
    document.getElementById('epi-quantidade').title = 'O estoque é gerenciado através de entradas e saídas. Não edite diretamente.';

    if (epiId) {
        try {
            const doc = await db.collection('epi_estoque').doc(epiId).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('epi-descricao').value = data.descricao;
                document.getElementById('epi-classe').value = data.classe || '';
                toggleModeloEPI(); // Atualiza visibilidade do modelo
                document.getElementById('epi-modelo').value = data.modelo || '';

                document.getElementById('epi-ca').value = data.ca;
                document.getElementById('epi-validade').value = data.validadeCA;
                document.getElementById('epi-fornecedor').value = data.fornecedor;
                document.getElementById('epi-lote').value = data.lote || '';
                document.getElementById('epi-unidade').value = data.unidade || 'Unidade';
                document.getElementById('epi-quantidade').value = data.quantidade;
                document.getElementById('epi-minimo').value = data.estoqueMinimo;
                document.getElementById('epi-ideal').value = data.estoqueIdeal || 0;
                document.getElementById('epi-custo').value = data.custo || 0;
            }
        } catch (error) {
            console.error("Erro ao carregar EPI:", error);
            mostrarMensagem("Erro ao carregar dados do EPI.", "error");
            return;
        }
    } else {
        // Para novos EPIs, iniciar com quantidade 0
        document.getElementById('epi-quantidade').value = 0;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    // Identificação biométrica automática ao abrir o modal
    setTimeout(() => {
        identificarPorBiometria();
    }, 500); // Pequeno delay para garantir que o modal esteja totalmente carregado
}

function toggleModeloEPI() {
    const classe = document.getElementById('epi-classe').value;
    const containerModelo = document.getElementById('container-epi-modelo');
    if (classe === 'Calçados') {
        containerModelo.style.display = 'block';
    } else {
        containerModelo.style.display = 'none';
        document.getElementById('epi-modelo').value = '';
    }
}

async function salvarEPI() {
    const id = document.getElementById('epi-id').value;
    const classe = document.getElementById('epi-classe').value;
    const modelo = document.getElementById('epi-modelo').value;

    const dados = {
        descricao: document.getElementById('epi-descricao').value.trim(),
        classe: classe,
        modelo: classe === 'Calçados' ? modelo : null,
        ca: document.getElementById('epi-ca').value.trim(),
        validadeCA: document.getElementById('epi-validade').value,
        fornecedor: document.getElementById('epi-fornecedor').value.trim(),
        lote: document.getElementById('epi-lote').value.trim(),
        unidade: document.getElementById('epi-unidade').value,
        estoqueMinimo: parseInt(document.getElementById('epi-minimo').value) || 0,
        estoqueIdeal: parseInt(document.getElementById('epi-ideal').value) || 0,
        custo: parseFloat(document.getElementById('epi-custo').value) || 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Para EPIs existentes, não atualizar a quantidade (estoque gerenciado por entradas/saídas)
    if (!id) {
        dados.quantidade = parseInt(document.getElementById('epi-quantidade').value) || 0;
    }

    if (classe === 'Calçados' && !modelo) {
        mostrarMensagem("Para a classe Calçados, o Modelo é obrigatório.", "warning");
        return;
    }

    if (!dados.descricao || !dados.ca || !dados.validadeCA) {
        mostrarMensagem("Preencha os campos obrigatórios (Descrição, CA, Validade).", "warning");
        return;
    }

    try {
        if (id) {
            await db.collection('epi_estoque').doc(id).update(dados);
            mostrarMensagem("EPI atualizado com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('epi_estoque').add(dados);
            mostrarMensagem("EPI cadastrado com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('modalNovoEPI')).hide();
        carregarEstoqueEPI();
    } catch (error) {
        console.error("Erro ao salvar EPI:", error);
        mostrarMensagem("Erro ao salvar EPI.", "error");
    }
}

async function excluirEPI(id) {
    if (!confirm("Tem certeza que deseja excluir este EPI? O histórico de consumo será mantido, mas o item sairá do estoque.")) return;
    
    try {
        await db.collection('epi_estoque').doc(id).delete();
        mostrarMensagem("EPI excluído com sucesso.", "success");
        carregarEstoqueEPI();
    } catch (error) {
        console.error("Erro ao excluir EPI:", error);
        mostrarMensagem("Erro ao excluir EPI.", "error");
    }
}

// --- ENTRADA DE ESTOQUE ---

async function abrirModalEntradaEstoque() {
    const modalEl = document.getElementById('modalEntradaEstoque');
    const form = document.getElementById('form-entrada-estoque');
    if (!modalEl || !form) return;

    form.reset();
    document.getElementById('entrada-data').valueAsDate = new Date();
    document.getElementById('container-rastreio-epi').style.display = 'none';

    // Carregar EPIs no select
    const select = document.getElementById('entrada-epi-select');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const snap = await db.collection('epi_estoque').orderBy('descricao').get();
        select.innerHTML = '<option value="">Selecione o EPI</option>';
        snap.forEach(doc => {
            const epi = doc.data();
            // Filtrar lotes substituídos para evitar confusão
            if (epi.status === 'Substituido') return;
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${epi.descricao} (CA: ${epi.ca}) - Saldo Atual: ${epi.quantidade || 0}`;
            // Armazena dados para verificação de rastreio
            option.dataset.classe = epi.classe || '';
            option.dataset.modelo = epi.modelo || '';
            select.appendChild(option);
        });
    } catch (e) {
        console.error(e);
    }

    new bootstrap.Modal(modalEl).show();
}

function verificarRastreioEPI() {
    const select = document.getElementById('entrada-epi-select');
    const container = document.getElementById('container-rastreio-epi');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption) {
        const classe = selectedOption.dataset.classe;
        const modelo = selectedOption.dataset.modelo;
        
        // Habilita rastreio se for Calçado Bidensidade ou Infinity
        if (classe === 'Calçados' && (modelo === 'Bidensidade' || modelo === 'Infinity')) {
            container.style.display = 'block';
            atualizarChaveRastreio();
        } else {
            container.style.display = 'none';
        }
    }
}

function atualizarChaveRastreio() {
    const data = document.getElementById('entrada-data').value.replace(/-/g, '');
    const pedido = document.getElementById('entrada-pedido').value.trim();
    const chave = `${data}${pedido ? '-' + pedido : ''}`;
    document.getElementById('entrada-chave-rastreio').value = chave;
}

async function salvarEntradaEstoque() {
    const epiId = document.getElementById('entrada-epi-select').value;
    const qtd = parseInt(document.getElementById('entrada-quantidade').value) || 0;
    const custo = parseFloat(document.getElementById('entrada-custo').value) || 0;
    
    if (!epiId || qtd <= 0) {
        mostrarMensagem("Selecione um EPI e uma quantidade válida.", "warning");
        return;
    }

    const dadosEntrada = {
        epiId: epiId,
        origem: document.getElementById('entrada-origem').value,
        numeroPedido: document.getElementById('entrada-pedido').value,
        dataEntrada: new Date(document.getElementById('entrada-data').value.replace(/-/g, '/')),
        quantidade: qtd,
        custoTotal: custo,
        assinaturaEnvio: document.getElementById('entrada-assinatura-envio').value,
        assinaturaRecebimento: document.getElementById('entrada-assinatura-recebimento').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Dados de Rastreio
    const containerRastreio = document.getElementById('container-rastreio-epi');
    if (containerRastreio.style.display !== 'none') {
        dadosEntrada.rastreio = {
            chave: document.getElementById('entrada-chave-rastreio').value,
            motivo: document.getElementById('entrada-motivo-rastreio').value
        };
    }

    try {
        const batch = db.batch();
        // 1. Salvar registro de entrada
        const entradaRef = db.collection('epi_entradas').doc();
        batch.set(entradaRef, dadosEntrada);

        // 2. Atualizar estoque
        const epiRef = db.collection('epi_estoque').doc(epiId);
        batch.update(epiRef, {
            quantidade: firebase.firestore.FieldValue.increment(qtd),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        
        mostrarMensagem("Entrada registrada com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('modalEntradaEstoque')).hide();
        carregarEstoqueEPI();
    } catch (e) {
        console.error("Erro ao salvar entrada:", e);
        mostrarMensagem("Erro ao registrar entrada.", "error");
    }
}

// ========================================
// CONSUMO DE EPI
// ========================================

async function carregarHistoricoConsumoEPI() {
    const tbody = document.getElementById('tabela-consumo-epi');
    const container = document.getElementById('container-historico-consumo-epi');
    if (!tbody) return;

    // Make container fixed height with scrollbar
    if (container) {
        container.style.maxHeight = '600px';
        container.style.overflowY = 'auto';
    }

    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando histórico...</td></tr>';

    const dataInicio = document.getElementById('filtro-consumo-inicio').value;
    const dataFim = document.getElementById('filtro-consumo-fim').value;
    const filtroNome = document.getElementById('filtro-consumo-nome')?.value.toLowerCase().trim() || '';

    try {
        let query = db.collection('epi_consumo').orderBy('dataEntrega', 'desc');

        if (dataInicio) query = query.where('dataEntrega', '>=', new Date(dataInicio + 'T00:00:00'));
        if (dataFim) query = query.where('dataEntrega', '<=', new Date(dataFim + 'T23:59:59'));

        const snapshot = await query.limit(200).get(); // Increased limit for better filtering

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum registro de consumo no período.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const consumo = doc.data();
            const dataEntrega = consumo.dataEntrega?.toDate ? consumo.dataEntrega.toDate() : new Date(consumo.dataEntrega);

            // Apply name filter
            if (filtroNome && !consumo.funcionarioNome.toLowerCase().includes(filtroNome)) {
                return;
            }

            html += `
                <tr>
                    <td>${dataEntrega.toLocaleDateString('pt-BR')}</td>
                    <td>${consumo.funcionarioNome}</td>
                    <td>${consumo.epiDescricao}</td>
                    <td>${consumo.epiCA}</td>
                    <td><span class="badge bg-primary rounded-pill">${consumo.quantidade}</span></td>
                    <td><small class="text-muted">${consumo.responsavelNome || 'Sistema'}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-warning" onclick="atualizarCustoConsumoIndividual('${doc.id}')" title="Atualizar Custo com Valor Atual do Estoque">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary" onclick="editarConsumoEPI('${doc.id}')" title="Editar Registro">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="devolverItemEPI('${doc.id}', ${consumo.quantidade}, '${consumo.epiDescricao}')" title="Devolver/Estornar">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirConsumoEPI('${doc.id}')" title="Excluir Registro">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        if (!html) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum registro encontrado com o filtro aplicado.</td></tr>';
        } else {
            tbody.innerHTML = html;
        }

    } catch (error) {
        console.error("Erro ao carregar histórico de consumo:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar histórico.</td></tr>';
    }
}

async function editarConsumoEPI(id) {
    const modalId = 'modalEditarConsumoEPI';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Registro de Consumo</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="edit-consumo-id">
                        <div class="mb-3">
                            <label class="form-label">Data da Entrega</label>
                            <input type="date" class="form-control" id="edit-consumo-data">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Custo Unitário (R$)</label>
                            <input type="number" step="0.01" class="form-control" id="edit-consumo-custo">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Motivo</label>
                            <select class="form-select" id="edit-consumo-motivo">
                                <option value="Admissão">Admissão</option>
                                <option value="Prazo de Troca">Prazo de Troca</option>
                                <option value="Perda">Perda</option>
                                <option value="EPI Danificado">EPI Danificado</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                        <div class="alert alert-warning small">
                            <i class="fas fa-exclamation-triangle"></i> Alterar a quantidade requer estorno e nova entrega para manter a integridade do estoque. Use a função "Devolver/Estornar" se precisar alterar quantidades.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEdicaoConsumoEPI()">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    try {
        const doc = await db.collection('epi_consumo').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }
        const data = doc.data();
        
        document.getElementById('edit-consumo-id').value = id;
        document.getElementById('edit-consumo-data').value = data.dataEntrega.toDate().toISOString().split('T')[0];
        document.getElementById('edit-consumo-custo').value = data.custoUnitario || 0;
        document.getElementById('edit-consumo-motivo').value = data.motivo;

        new bootstrap.Modal(modalEl).show();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao carregar dados.", "error");
    }
}

async function salvarEdicaoConsumoEPI() {
    const id = document.getElementById('edit-consumo-id').value;
    const novaData = document.getElementById('edit-consumo-data').value;
    const novoCusto = parseFloat(document.getElementById('edit-consumo-custo').value) || 0;
    const novoMotivo = document.getElementById('edit-consumo-motivo').value;

    try {
        await db.collection('epi_consumo').doc(id).update({
            dataEntrega: new Date(novaData.replace(/-/g, '\/')),
            custoUnitario: novoCusto,
            motivo: novoMotivo
        });
        mostrarMensagem("Registro atualizado com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('modalEditarConsumoEPI')).hide();
        carregarHistoricoConsumoEPI();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao salvar.", "error");
    }
}

async function atualizarCustoConsumoIndividual(id) {
    try {
        const docRef = db.collection('epi_consumo').doc(id);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }
        
        const consumo = docSnap.data();
        const epiId = consumo.epiId;
        
        if (!epiId) {
            mostrarMensagem("ID do EPI não encontrado no registro.", "error");
            return;
        }
        
        const epiDoc = await db.collection('epi_estoque').doc(epiId).get();
        
        if (!epiDoc.exists) {
            mostrarMensagem("Cadastro do EPI não encontrado.", "error");
            return;
        }
        
        const custoAtual = parseFloat(epiDoc.data().custo) || 0;
        
        await docRef.update({ custoUnitario: custoAtual });
        
        mostrarMensagem(`Custo atualizado para R$ ${custoAtual.toFixed(2)}`, "success");
        carregarHistoricoConsumoEPI();
        if (typeof carregarDashboardConsumoEPI === 'function') carregarDashboardConsumoEPI();
        
    } catch (error) {
        console.error("Erro ao atualizar custo individual:", error);
        mostrarMensagem("Erro ao atualizar custo.", "error");
    }
}

async function abrirModalConsumoEPI() {
    // Verificar se o modal existe no HTML
    let modalEl = document.getElementById('modalConsumoEPI');
    
    // Se o modal não existir, criá-lo dinamicamente
    if (!modalEl) {
        const modalHTML = `
            <div class="modal fade" id="modalConsumoEPI" tabindex="-1" aria-labelledby="modalConsumoEPILabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="modalConsumoEPILabel"><i class="fas fa-hard-hat me-2"></i> Registrar Entrega de EPI</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-consumo-epi">
                                <!-- Dados Gerais -->
                                <div class="mb-3">
                                    <label for="consumo-funcionario" class="form-label">Colaborador *</label>
                                    <select class="form-select" id="consumo-funcionario" required></select>
                                    <div class="d-grid mt-2">
                                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="identificarPorBiometria()"><i class="fas fa-fingerprint"></i> Identificar por Digital</button>
                                    </div>
                                </div>
                                <div class="row g-3 mb-4 align-items-end">
                                    <div class="col-md-4">
                                        <label for="consumo-data" class="form-label">Data Entrega *</label>
                                        <input type="date" class="form-control" id="consumo-data" required>
                                    </div>
                                    <div class="col-md-8">
                                        <label for="consumo-responsavel" class="form-label">Responsável</label>
                                        <input type="text" class="form-control bg-light" id="consumo-responsavel" readonly>
                                    </div>
                                </div>
                                
                                <hr>
                                
                                <!-- Adicionar Item -->
                                <div class="card bg-light mb-4">
                                    <div class="card-body">
                                        <h6 class="card-title mb-3 text-primary"><i class="fas fa-plus-circle"></i> Adicionar Item</h6>
                                        <div class="mb-3">
                                            <label for="consumo-epi-select" class="form-label">EPI / Equipamento</label>
                                            <select class="form-select" id="consumo-epi-select"></select>
                                        </div>
                                        <div class="row g-3 align-items-end">
                                            <div class="col-md-3">
                                                <label for="consumo-quantidade" class="form-label">Quantidade</label>
                                                <input type="number" class="form-control" id="consumo-quantidade" value="1" min="1">
                                            </div>
                                            <div class="col-md-6">
                                                <label for="consumo-motivo" class="form-label">Motivo</label>
                                                <select class="form-select" id="consumo-motivo">
                                                    <option value="Admissão">Admissão</option>
                                                    <option value="Prazo de Troca">Prazo de Troca</option>
                                                    <option value="Perda">Perda</option>
                                                    <option value="EPI Danificado">EPI Danificado</option>
                                                    <option value="Outros">Outros</option>
                                                </select>
                                            </div>
                                            <div class="col-md-3">
                                                <button type="button" class="btn btn-success w-100 shadow-sm fw-bold" style="height: 38px;" onclick="adicionarItemEPI()">
                                                    <i class="fas fa-plus-circle me-2"></i> INCLUIR ITEM
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Lista de Itens -->
                                <div class="card">
                                    <div class="card-header d-flex justify-content-between align-items-center">
                                        <span>Itens Selecionados</span>
                                        <span class="badge bg-secondary">Total: <span id="total-itens-epi">0</span></span>
                                    </div>
                                    <div class="table-responsive">
                                        <table class="table table-hover mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th>Descrição</th>
                                                    <th>CA</th>
                                                    <th>Lote</th>
                                                    <th class="text-center">Qtd</th>
                                                    <th>Motivo</th>
                                                    <th class="text-end">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody id="tabela-itens-entrega">
                                                <tr><td colspan="6" class="text-center text-muted">Nenhum item adicionado.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarEntregaEPI()">
                                <i class="fas fa-save"></i> Registrar e Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar o modal ao body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalEl = document.getElementById('modalConsumoEPI');
    }

    // Resetar estado
    itensEntregaAtual = [];
    validacaoBiometricaAtual = null;
    atualizarTabelaItensEntrega();
    calcularTotalItens();

    document.getElementById('form-consumo-epi').reset();
    document.getElementById('consumo-data').valueAsDate = new Date();

    // Definir responsável (usuário logado)
    const currentUser = firebase.auth().currentUser;
    let responsavelNome = 'Usuário Atual';
    if (currentUser) {
        responsavelNome = currentUser.displayName || currentUser.email || 'Usuário Logado';
    }
    document.getElementById('consumo-responsavel').value = responsavelNome;

    // Carregar Funcionários
    const funcSelect = document.getElementById('consumo-funcionario');
    funcSelect.innerHTML = '<option value="">Carregando...</option>';
    await carregarSelectFuncionariosAtivos('consumo-funcionario');

    // Carregar EPIs com saldo > 0
    const epiSelect = document.getElementById('consumo-epi-select');
    epiSelect.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const snapshot = await db.collection('epi_estoque')
            .orderBy('descricao')
            .get();

        epiSelect.innerHTML = '<option value="">Selecione o EPI</option>';
        
        snapshot.forEach(doc => {
            const epi = doc.data();
            if (epi.quantidade > 0) {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${epi.descricao} (CA: ${epi.ca}) - Saldo: ${epi.quantidade}`;
                option.dataset.saldo = epi.quantidade;
                option.dataset.descricao = epi.descricao;
                option.dataset.ca = epi.ca;
                option.dataset.lote = epi.lote || '';
                option.dataset.custo = epi.custo || 0;
                epiSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Erro ao carregar EPIs para consumo:", error);
        epiSelect.innerHTML = '<option value="">Erro ao carregar EPIs</option>';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function adicionarItemEPI() {
    const epiSelect = document.getElementById('consumo-epi-select');
    const quantidade = parseInt(document.getElementById('consumo-quantidade').value);
    const motivo = document.getElementById('consumo-motivo').value.trim();

    if (!epiSelect.value || !quantidade || quantidade <= 0) {
        mostrarMensagem("Selecione um EPI e uma quantidade válida.", "warning");
        return;
    }

    const selectedOption = epiSelect.options[epiSelect.selectedIndex];
    const saldoAtual = parseInt(selectedOption.dataset.saldo);

    // Verificar se já existe na lista para somar quantidade e validar saldo total
    const itemExistente = itensEntregaAtual.find(i => i.epiId === epiSelect.value);
    const qtdTotal = (itemExistente ? itemExistente.quantidade : 0) + quantidade;

    if (qtdTotal > saldoAtual) {
        mostrarMensagem(`Quantidade indisponível! Saldo atual: ${saldoAtual}`, "error");
        return;
    }

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        // Atualiza motivo se fornecido, senão mantém o anterior
        if (motivo) itemExistente.motivo = motivo; 
    } else {
        itensEntregaAtual.push({
            epiId: epiSelect.value,
            descricao: selectedOption.dataset.descricao,
            ca: selectedOption.dataset.ca,
            lote: selectedOption.dataset.lote,
            custo: parseFloat(selectedOption.dataset.custo) || 0,
            quantidade: quantidade,
            motivo: motivo || 'Entrega de Rotina'
        });
    }

    // Resetar campos de item
    document.getElementById('consumo-quantidade').value = 1;
    document.getElementById('consumo-motivo').value = 'Admissão';
    epiSelect.value = '';
    
    atualizarTabelaItensEntrega();
    calcularTotalItens();
}

function removerItemEPI(index) {
    itensEntregaAtual.splice(index, 1);
    atualizarTabelaItensEntrega();
    calcularTotalItens();
}

function atualizarTabelaItensEntrega() {
    const tbody = document.getElementById('tabela-itens-entrega');
    if (!tbody) return;

    if (itensEntregaAtual.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fas fa-box-open fa-2x mb-2 d-block opacity-25"></i>
                    Nenhum item adicionado ainda.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = itensEntregaAtual.map((item, index) => `
        <tr>
            <td>${item.descricao}</td>
            <td>${item.ca}</td>
            <td>${item.lote || '-'}</td>
            <td class="text-center">${item.quantidade}</td>
            <td>${item.motivo}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" onclick="removerItemEPI(${index})" title="Remover">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function calcularTotalItens() {
    const totalElement = document.getElementById('total-itens-epi');
    if (totalElement) {
        const total = itensEntregaAtual.reduce((sum, item) => sum + (item.quantidade || 0), 0);
        totalElement.textContent = total.toLocaleString('pt-BR');
    }
}

async function salvarEntregaEPI() {
    const funcSelect = document.getElementById('consumo-funcionario');
    const dataEntrega = document.getElementById('consumo-data').value;
    const responsavel = document.getElementById('consumo-responsavel').value;

    if (!funcSelect.value || !dataEntrega) {
        mostrarMensagem("Preencha o Colaborador e a Data de Recebimento.", "warning");
        return;
    }

    if (itensEntregaAtual.length === 0) {
        mostrarMensagem("Adicione pelo menos um EPI à lista.", "warning");
        return;
    }

    const funcionarioNome = funcSelect.options[funcSelect.selectedIndex].text;
    const setorFuncionario = funcSelect.options[funcSelect.selectedIndex].dataset.setor || '';
    const empresaIdFuncionario = funcSelect.options[funcSelect.selectedIndex].dataset.empresaId || '';

    const entregaId = 'ENT-' + Date.now().toString(36).toUpperCase(); // ID Identificador simples

    try {
        const batch = db.batch();
        const dataObj = new Date(dataEntrega.replace(/-/g, '\/'));
        
        // Processar cada item
        itensEntregaAtual.forEach(item => {
            // 1. Registrar Consumo Individual (para histórico e rastreabilidade)
            const consumoRef = db.collection('epi_consumo').doc();
            batch.set(consumoRef, {
                entregaId: entregaId,
                epiId: item.epiId,
                epiDescricao: item.descricao,
                epiCA: item.ca,
                lote: item.lote,
                motivo: item.motivo,
                funcionarioId: funcSelect.value,
                funcionarioNome: funcionarioNome,
                setor: setorFuncionario,
                empresaId: empresaIdFuncionario,
                custoUnitario: item.custo,
                quantidade: item.quantidade,
                dataEntrega: dataObj,
                responsavelNome: responsavel,
                responsavelUid: firebase.auth().currentUser?.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (validacaoBiometricaAtual) {
                // Adiciona metadados da biometria se houver
                batch.update(consumoRef, { validacaoBiometrica: validacaoBiometricaAtual });
            }

            // 2. Atualizar Estoque (Baixa)
            const estoqueRef = db.collection('epi_estoque').doc(item.epiId);
            batch.update(estoqueRef, {
                quantidade: firebase.firestore.FieldValue.increment(-item.quantidade),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        mostrarMensagem("Entrega de EPI registrada com sucesso!", "success");
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConsumoEPI'));
        if (modal) modal.hide();
        
        // Gerar e Imprimir Relatório
        imprimirRelatorioEntrega(entregaId, funcionarioNome, dataEntrega, responsavel, itensEntregaAtual, validacaoBiometricaAtual);

        // Atualiza as telas
        carregarHistoricoConsumoEPI();
        carregarEstoqueEPI();
        carregarDashboardConsumoEPI();

    } catch (error) {
        console.error("Erro ao registrar consumo:", error);
        mostrarMensagem("Erro ao registrar consumo.", "error");
    }
}

function imprimirRelatorioEntrega(id, funcionario, data, responsavel, itens, biometria = null) {
    const totalItens = itens.reduce((sum, item) => sum + (item.quantidade || 0), 0);
    
    const itensHtml = itens.map(item => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.descricao}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.ca}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.lote || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantidade}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${item.motivo}</td>
        </tr>
    `).join('');

    let assinaturaColaboradorHtml = `
        <div class="sig-line"></div>
        <p>Assinatura do Colaborador</p>
        <p style="font-size: 11px; margin-top: 5px;">Nome: ${funcionario.split(' - ')[0]}</p>`;

    if (biometria) {
        assinaturaColaboradorHtml = `
            <div style="border: 2px solid #28a745; padding: 10px; border-radius: 5px; color: #28a745;">
                <h4 style="margin:0;">VALIDADO POR BIOMETRIA</h4>
                <p style="margin:5px 0 0 0; font-size:10px;">ID: ${biometria.deviceId || 'Android'}</p>
                <p style="margin:0; font-size:10px;">Data/Hora: ${biometria.timestamp}</p>
            </div>
            <p style="margin-top:5px;"><strong>${funcionario.split(' - ')[0]}</strong></p>
        `;
    }

    const conteudo = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Guia de Entrega de EPI - ${id}</title>
            <style>
                @page { margin: 20mm; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    line-height: 1.4;
                    color: #333;
                    max-width: 210mm;
                    margin: 0 auto;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 3px double #333;
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 22px; 
                    color: #2c3e50;
                }
                .header h2 { 
                    margin: 5px 0; 
                    font-size: 16px; 
                    color: #7f8c8d;
                }
                .info-box { 
                    background: #f8f9fa; 
                    padding: 15px; 
                    border-radius: 8px; 
                    margin-bottom: 25px;
                    border: 1px solid #dee2e6;
                }
                .info-row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 8px;
                }
                .info-label { 
                    font-weight: bold; 
                    color: #2c3e50;
                }
                .info-value { 
                    color: #34495e;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 30px;
                    font-size: 12px;
                }
                th { 
                    background-color: #2c3e50; 
                    color: white; 
                    padding: 10px; 
                    text-align: left;
                    font-weight: bold;
                }
                td { 
                    padding: 8px; 
                    border: 1px solid #ddd; 
                }
                .total-row {
                    background-color: #ecf0f1;
                    font-weight: bold;
                }
                .declaracao { 
                    margin-top: 30px; 
                    padding: 15px; 
                    background: #f8f9fa;
                    border-left: 4px solid #3498db;
                    font-size: 12px;
                    text-align: justify;
                }
                .signatures { 
                    margin-top: 60px; 
                    display: flex; 
                    justify-content: space-between;
                }
                .sig-box { 
                    width: 45%; 
                    text-align: center;
                }
                .sig-line { 
                    border-top: 1px solid #333; 
                    padding-top: 5px; 
                    margin-top: 40px;
                }
                .company-logo { 
                    text-align: center;
                    margin-bottom: 10px;
                }
                .company-logo img { 
                    max-height: 60px;
                }
                .footer { 
                    margin-top: 30px; 
                    text-align: center; 
                    font-size: 10px; 
                    color: #7f8c8d;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                }
                .badge { 
                    background-color: #3498db; 
                    color: white; 
                    padding: 4px 8px; 
                    border-radius: 4px; 
                    font-size: 11px;
                }
            </style>
        </head>
        <body>
            <div class="company-logo">
                <h3 style="margin: 0; color: #2c3e50;">Sistema de Gestão - Nexter</h3>
            </div>
            
            <div class="header">
                <h1>GUIA DE ENTREGA DE EPI</h1>
                <h2>Identificador: <span class="badge">${id}</span></h2>
            </div>

            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">Colaborador:</span>
                    <span class="info-value">${funcionario}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Data da Entrega:</span>
                    <span class="info-value">${new Date(data).toLocaleDateString('pt-BR')}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Responsável pela Entrega:</span>
                    <span class="info-value">${responsavel}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Total de Itens:</span>
                    <span class="info-value" style="font-size: 16px; font-weight: bold;">${totalItens}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Descrição do EPI</th>
                        <th width="15%">Nº CA</th>
                        <th width="10%">Lote</th>
                        <th width="10%">Quantidade</th>
                        <th>Motivo da Entrega</th>
                    </tr>
                </thead>
                <tbody>
                    ${itensHtml}
                    <tr class="total-row">
                        <td colspan="3" style="text-align: right; font-weight: bold;">TOTAL:</td>
                        <td style="text-align: center; font-weight: bold;">${totalItens}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <div class="declaracao">
                <p><strong>DECLARAÇÃO DE RECEBIMENTO:</strong></p>
                <p>Declaro, para os devidos fins, que recebi os Equipamentos de Proteção Individual (EPIs) relacionados acima, em perfeito estado de conservação e funcionamento. Comprometo-me a utilizá-los apenas para as finalidades a que se destinam, conforme determina a NR-6, zelando por sua guarda, conservação e higienização adequadas. Estou ciente de que sou responsável pela reposição dos EPIs em caso de perda, extravio ou dano causado por mau uso.</p>
            </div>

            <div class="signatures">
                <div class="sig-box">
                    ${assinaturaColaboradorHtml}
                </div>
                <div class="sig-box">
                    <div class="sig-line"></div>
                    <p>Assinatura do Responsável</p>
                    <p style="font-size: 11px; margin-top: 5px;">Nome: ${responsavel}</p>
                </div>
            </div>

            <div class="footer">
                <p>Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')} | Via: Original</p>
            </div>

            <script>
                // Auto-print
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                }
            </script>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(conteudo);
    printWindow.document.close();
}

async function excluirConsumoEPI(consumoId) {
    if (!confirm("Tem certeza que deseja excluir este registro de consumo? O item será devolvido ao estoque.")) {
        return;
    }

    try {
        const consumoRef = db.collection('epi_consumo').doc(consumoId);
        const doc = await consumoRef.get();
        
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }

        const dados = doc.data();
        const epiId = dados.epiId;
        const qtd = dados.quantidade;

        if (!epiId || !qtd) {
            await consumoRef.delete();
            mostrarMensagem("Registro de consumo excluído (sem impacto no estoque).", "success");
            carregarHistoricoConsumoEPI();
            carregarDashboardConsumoEPI();
            return;
        }

        const batch = db.batch();

        const estoqueRef = db.collection('epi_estoque').doc(epiId);
        
        const estoqueDoc = await estoqueRef.get();
        if(estoqueDoc.exists) {
            batch.update(estoqueRef, {
                quantidade: firebase.firestore.FieldValue.increment(qtd)
            });
        }

        batch.delete(consumoRef);

        await batch.commit();

        if(estoqueDoc.exists) {
            mostrarMensagem(`Registro excluído e ${qtd} item(ns) devolvido(s) ao estoque.`, "success");
        } else {
            mostrarMensagem("Registro de consumo excluído. O item de estoque original não foi encontrado.", "warning");
        }
        
        carregarHistoricoConsumoEPI();
        carregarEstoqueEPI();
        carregarDashboardConsumoEPI();

    } catch (error) {
        console.error("Erro ao excluir registro de consumo:", error);
        mostrarMensagem("Erro ao processar a exclusão.", "error");
    }
}

async function devolverItemEPI(consumoId, qtdAtual, descricao) {
    const qtdDevolver = prompt(`Devolução de EPI: ${descricao}\nQuantidade atual registrada: ${qtdAtual}\n\nDigite a quantidade a devolver (para excluir o registro, digite ${qtdAtual}):`);
    
    if (qtdDevolver === null) return; // Cancelado
    
    const qtd = parseInt(qtdDevolver);
    if (isNaN(qtd) || qtd <= 0 || qtd > qtdAtual) {
        mostrarMensagem("Quantidade inválida.", "warning");
        return;
    }

    try {
        const consumoRef = db.collection('epi_consumo').doc(consumoId);
        const doc = await consumoRef.get();
        
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }

        const dados = doc.data();
        const epiId = dados.epiId;
        const batch = db.batch();

        // 1. Atualizar Estoque (Devolução)
        const estoqueRef = db.collection('epi_estoque').doc(epiId);
        batch.update(estoqueRef, {
            quantidade: firebase.firestore.FieldValue.increment(qtd)
        });

        // 2. Atualizar ou Excluir Registro de Consumo
        if (qtd === qtdAtual) {
            // Devolução total -> Excluir registro
            batch.delete(consumoRef);
        } else {
            // Devolução parcial -> Atualizar quantidade
            batch.update(consumoRef, {
                quantidade: firebase.firestore.FieldValue.increment(-qtd)
            });
        }

        await batch.commit();
        mostrarMensagem(`Devolução de ${qtd} item(ns) realizada com sucesso. Estoque atualizado.`, "success");
        
        carregarHistoricoConsumoEPI();
        carregarEstoqueEPI();
        carregarDashboardConsumoEPI();

    } catch (error) {
        console.error("Erro ao devolver EPI:", error);
        mostrarMensagem("Erro ao processar devolução.", "error");
    }
}

let chartEpiSetor = null;
let chartEpiCusto = null;

async function carregarDashboardConsumoEPI() {
    let inicio = document.getElementById('dash-epi-inicio').value;
    let fim = document.getElementById('dash-epi-fim').value;
    const empresa = document.getElementById('dash-epi-empresa').value;
    const setor = document.getElementById('dash-epi-setor').value;

    // Definir padrão mês atual se vazio
    if (!inicio || !fim) {
        const hoje = new Date();
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
        document.getElementById('dash-epi-inicio').value = inicio;
        document.getElementById('dash-epi-fim').value = fim;
    }

    let query = db.collection('epi_consumo');

    if (inicio) query = query.where('dataEntrega', '>=', new Date(inicio + 'T00:00:00'));
    if (fim) query = query.where('dataEntrega', '<=', new Date(fim + 'T23:59:59'));
    if (empresa) query = query.where('empresaId', '==', empresa);
    if (setor) query = query.where('setor', '==', setor);

    try {
        const snapshot = await query.get();
        
        let totalItens = 0;
        let totalValor = 0;
        const funcionariosSet = new Set();
        const porSetor = {};
        const porMes = {};
        const rankingColaboradores = {};

        snapshot.forEach(doc => {
            const d = doc.data();
            const qtd = d.quantidade || 0;
            const custo = (d.custoUnitario || 0) * qtd;
            
            totalItens += qtd;
            totalValor += custo;
            if (d.funcionarioId) funcionariosSet.add(d.funcionarioId);

            // Agrupar por Setor
            // CORREÇÃO: Agrupando por custo em vez de quantidade
            const s = d.setor || 'Não Definido';
            porSetor[s] = (porSetor[s] || 0) + custo;

            // Agrupar por Mês (Custo)
            const mesKey = d.dataEntrega.toDate().toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            porMes[mesKey] = (porMes[mesKey] || 0) + custo;

            // Ranking Colaboradores
            const nome = d.funcionarioNome || 'Desconhecido';
            if (!rankingColaboradores[nome]) rankingColaboradores[nome] = { qtd: 0, custo: 0 };
            rankingColaboradores[nome].qtd += qtd;
            rankingColaboradores[nome].custo += custo;
        });

        // --- Lógica de Tempo de Reposição (Lead Time) ---
        // Busca compras concluídas no período
        // CORREÇÃO: Filtro de data em memória para evitar erro de índice composto
        const comprasSnap = await db.collection('epi_compras')
            .where('status', '==', 'Concluido')
            .get();

        let somaDias = 0;
        let totalCompras = 0;
        const demoraPorItem = {};

        const dataInicioObj = new Date(inicio + 'T00:00:00');
        const dataFimObj = new Date(fim + 'T23:59:59');

        comprasSnap.forEach(doc => {
            const c = doc.data();
            
            // Filtro de data em memória
            if (!c.updatedAt) return;
            const dataUpdate = c.updatedAt.toDate();
            if (dataUpdate < dataInicioObj || dataUpdate > dataFimObj) return;

            if (c.dataSolicitacao && c.updatedAt) {
                const dtSol = c.dataSolicitacao.toDate();
                const dtConc = c.updatedAt.toDate();
                const diffTime = Math.abs(dtConc - dtSol);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                somaDias += diffDays;
                totalCompras++;

                // Atribuir demora aos itens da compra
                c.itens.forEach(item => {
                    const key = item.descricao;
                    if (!demoraPorItem[key]) demoraPorItem[key] = { totalDias: 0, count: 0 };
                    demoraPorItem[key].totalDias += diffDays;
                    demoraPorItem[key].count++;
                });
            }
        });

        const tempoMedio = totalCompras > 0 ? (somaDias / totalCompras).toFixed(1) : '-';

        // Atualizar KPIs
        document.getElementById('kpi-epi-total-itens').textContent = totalItens;
        document.getElementById('kpi-epi-valor-total').textContent = `R$ ${totalValor.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-epi-tempo-reposicao').textContent = tempoMedio !== '-' ? `${tempoMedio} dias` : '-';

        // Renderizar Ranking Colaboradores
        const rankingColabSorted = Object.entries(rankingColaboradores)
            .sort(([,a], [,b]) => b.qtd - a.qtd)
            .slice(0, 5);
        
        document.getElementById('ranking-epi-colaboradores').innerHTML = rankingColabSorted.map(([nome, dados]) => `
            <tr>
                <td>${nome}</td>
                <td class="text-center">${dados.qtd}</td>
                <td class="text-end">R$ ${dados.custo.toFixed(2).replace('.', ',')}</td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="text-center text-muted">Sem dados</td></tr>';

        // Renderizar Ranking Demora
        const rankingDemoraSorted = Object.entries(demoraPorItem)
            .map(([item, dados]) => ({ item, media: dados.totalDias / dados.count }))
            .sort((a, b) => b.media - a.media)
            .slice(0, 5);

        document.getElementById('ranking-epi-demora').innerHTML = rankingDemoraSorted.map(r => `
            <tr>
                <td>${r.item}</td>
                <td class="text-center"><span class="badge bg-warning text-dark">${r.media.toFixed(1)} dias</span></td>
            </tr>
        `).join('') || '<tr><td colspan="2" class="text-center text-muted">Sem dados de compras concluídas</td></tr>';

        // Gráfico Setor (por Custo)
        const ctxSetor = document.getElementById('chart-epi-setor').getContext('2d');
        if (chartEpiSetor) chartEpiSetor.destroy();
        
        // Ordenar dados para melhor visualização
        const sortedPorSetor = Object.entries(porSetor).sort(([,a],[,b]) => b-a);

        // Adicionar scrollbar ao container do gráfico e altura dinâmica
        const canvasSetor = document.getElementById('chart-epi-setor');
        const containerSetor = canvasSetor.parentElement;
        containerSetor.style.maxHeight = '400px';
        containerSetor.style.overflowY = 'auto';
        canvasSetor.height = sortedPorSetor.length * 30; // Altura dinâmica para permitir scrollbar

        chartEpiSetor = new Chart(ctxSetor, {
            type: 'bar',
            data: {
                labels: sortedPorSetor.map(item => item[0]),
                datasets: [{
                    label: 'Custo (R$)',
                    data: sortedPorSetor.map(item => item[1]),
                    backgroundColor: '#4361ee',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // Gráfico de barras horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: false }, // Título já está no card-header
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Custo: R$ ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true, // Começa no zero
                        grid: { display: false }, // Remove linhas de grade X
                        border: { display: false }, // Remove borda do eixo X
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value;
                            }
                        }
                    },
                    y: {
                        grid: { display: false }, // Remove linhas de grade Y
                        border: { display: false } // Remove borda do eixo Y
                    }
                }
            }
        });

        // Gráfico Custo Mensal (Evolução)
        const ctxCusto = document.getElementById('chart-epi-custo-mensal').getContext('2d');
        if (chartEpiCusto) chartEpiCusto.destroy();

        // Ordenar os meses para garantir a ordem cronológica
        const sortedPorMes = Object.entries(porMes).sort((a, b) => {
            const meses = { 'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11 };
            const [mesAStr, anoA] = a[0].split('/');
            const [mesBStr, anoB] = b[0].split('/');
            const dataA = new Date(`20${anoA}`, meses[mesAStr.toLowerCase()]);
            const dataB = new Date(`20${anoB}`, meses[mesBStr.toLowerCase()]);
            return dataA - dataB;
        });

        chartEpiCusto = new Chart(ctxCusto, {
            type: 'line',
            data: {
                labels: sortedPorMes.map(item => item[0]),
                datasets: [{
                    label: 'Custo (R$)',
                    data: sortedPorMes.map(item => item[1]),
                    borderColor: '#f72585',
                    backgroundColor: 'rgba(247, 37, 133, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: false }, // Título já está no card-header
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true, // Começa no zero
                        grid: { display: false }, // Remove linhas de grade Y
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Erro dashboard EPI:", error);
    }
}

async function gerarSolicitacaoCompraEPI() {
    try {
        const snapshot = await db.collection('epi_estoque').get();
        const itensParaCompra = [];

        snapshot.forEach(doc => {
            const epi = doc.data();
            const estoqueAtual = parseInt(epi.quantidade) || 0;
            const estoqueMinimo = parseInt(epi.estoqueMinimo) || 0;
            const estoqueIdeal = parseInt(epi.estoqueIdeal) || 0;

            // Ignora itens que já foram substituídos por novos lotes
            if (epi.status === 'Substituido') return;

            if (estoqueAtual <= estoqueMinimo) {
                // Sugestão: Diferença entre Ideal e Mínimo (conforme solicitado)
                const sugestao = estoqueIdeal > 0 ? (estoqueIdeal - estoqueMinimo) : (estoqueMinimo * 2);
                itensParaCompra.push({
                    descricao: epi.descricao,
                    ca: epi.ca,
                    fornecedor: epi.fornecedor || '-',
                    atual: estoqueAtual,
                    minimo: estoqueMinimo,
                    sugerido: sugestao > 0 ? sugestao : 1
                });
            }
        });

        // Salvar a solicitação no banco de dados
        const user = firebase.auth().currentUser;
        const solicitacao = {
            id: 'SOL-' + Date.now().toString(36).toUpperCase(),
            dataSolicitacao: firebase.firestore.FieldValue.serverTimestamp(),
            solicitanteUid: user ? user.uid : 'sistema',
            solicitanteNome: user ? (user.displayName || user.email) : 'Sistema',
            status: 'Aberto',
            itens: itensParaCompra.map(i => ({
                descricao: i.descricao,
                ca: i.ca,
                fornecedor: i.fornecedor,
                atual: i.atual,
                minimo: i.minimo,
                sugerido: i.sugerido,
                recebido: 0
            }))
        };

        await db.collection('epi_compras').add(solicitacao);

        if (itensParaCompra.length === 0) {
            mostrarMensagem("Nenhum item atingiu o estoque mínimo.", "info");
            return;
        }

        const linhasHtml = itensParaCompra.map(item => `
            <tr>
                <td>${item.descricao}</td>
                <td class="text-center">${item.ca}</td>
                <td>${item.fornecedor}</td>
                <td class="text-center text-danger fw-bold">${item.atual}</td>
                <td class="text-center">${item.minimo}</td>
                <td class="text-center fw-bold bg-light">${item.sugerido}</td>
            </tr>
        `).join('');

        const conteudo = `
            <html>
            <head>
                <title>Solicitação de Compra de EPI</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; }
                    .header { border-bottom: 2px solid #0d6efd; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { color: #0d6efd; font-weight: 700; margin: 0; font-size: 28px; }
                    .meta-info { text-align: right; font-size: 14px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
                    th { background-color: #f8f9fa; color: #495057; font-weight: 600; text-transform: uppercase; padding: 12px; border-bottom: 2px solid #dee2e6; }
                    td { padding: 12px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
                    .footer { margin-top: 50px; border-top: 1px solid #dee2e6; padding-top: 20px; font-size: 12px; color: #999; text-align: center; }
                    .badge-priority { background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                </style>
            </head><body>
            
            <div class="header">
                <div>
                    <h1>Solicitação de Compra</h1>
                    <p class="mb-0 text-muted">Reposição de Estoque Mínimo - EPI</p>
                </div>
                <div class="meta-info">
                    <p class="mb-1"><strong>ID:</strong> ${solicitacao.id}</p>
                    <p class="mb-1"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <p class="mb-0"><strong>Solicitante:</strong> ${solicitacao.solicitanteNome}</p>
                </div>
            </div>

            <div class="alert alert-light border mb-4">
                <i class="fas fa-info-circle"></i> Os itens listados abaixo atingiram o nível crítico de estoque e necessitam de reposição imediata.
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Descrição do Item</th>
                        <th class="text-center">CA</th>
                        <th>Fornecedor Preferencial</th>
                        <th class="text-center">Estoque Atual</th>
                        <th class="text-center">Mínimo</th>
                        <th class="text-center">Qtd. Sugerida</th>
                    </tr>
                </thead>
                <tbody>${linhasHtml}</tbody>
            </table>

            <div class="row mt-5">
                <div class="col-6">
                    <div style="border-top: 1px solid #000; width: 80%; padding-top: 5px;">Assinatura do Solicitante</div>
                </div>
                <div class="col-6 text-end">
                    <div style="border-top: 1px solid #000; width: 80%; margin-left: auto; padding-top: 5px;">Aprovação da Diretoria</div>
                </div>
            </div>

            <div class="footer">
                Documento gerado automaticamente pelo Sistema Nexter v3.0
            </div>

            </body></html>
        `;
        openPrintWindow(conteudo, { autoPrint: true });
        mostrarMensagem("Solicitação de compra gerada e salva com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao gerar solicitação:", error);
        mostrarMensagem("Erro ao gerar relatório.", "error");
    }
}

// ========================================
// MÓDULO DE COMPRAS DE EPI
// ========================================

async function inicializarComprasEPI() {
    const tbody = document.getElementById('tabela-compras-epi');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando solicitações...</td></tr>';

    try {
        const snapshot = await db.collection('epi_compras').orderBy('dataSolicitacao', 'desc').get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma solicitação de compra encontrada.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const compra = doc.data();
            const data = compra.dataSolicitacao?.toDate ? compra.dataSolicitacao.toDate() : new Date();
            
            let statusBadge = 'bg-secondary';
            if (compra.status === 'Aberto') statusBadge = 'bg-warning text-dark';
            if (compra.status === 'Parcial') statusBadge = 'bg-info text-white';
            if (compra.status === 'Concluido') statusBadge = 'bg-success';

            html += `
                <tr>
                    <td><strong>${compra.id}</strong></td>
                    <td>${data.toLocaleDateString('pt-BR')}</td>
                    <td>${compra.solicitanteNome}</td>
                    <td><span class="badge ${statusBadge}">${compra.status}</span></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="visualizarCompra('${doc.id}')" title="Visualizar"><i class="fas fa-eye"></i></button>
                            ${compra.status !== 'Concluido' ? `
                                <button class="btn btn-success" onclick="baixarCompraTotal('${doc.id}')" title="Baixar Total"><i class="fas fa-check-double"></i></button>
                                <button class="btn btn-info" onclick="baixarCompraParcial('${doc.id}')" title="Baixar Parcial"><i class="fas fa-box-open"></i></button>
                            ` : ''}
                            <button class="btn btn-outline-danger" onclick="excluirCompraEPI('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    } catch (error) {
        console.error("Erro ao carregar compras:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function visualizarCompra(docId) {
    try {
        const doc = await db.collection('epi_compras').doc(docId).get();
        if (!doc.exists) return;
        const compra = doc.data();

        const itensHtml = compra.itens.map(item => `
            <tr>
                <td>${item.descricao}</td>
                <td>${item.ca}</td>
                <td class="text-center">${item.sugerido}</td>
                <td class="text-center">${item.recebido || 0}</td>
                <td class="text-center">${item.sugerido - (item.recebido || 0)}</td>
            </tr>
        `).join('');

        const conteudo = `
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr><th>Item</th><th>CA</th><th>Solicitado</th><th>Recebido</th><th>Pendente</th></tr>
                    </thead>
                    <tbody>${itensHtml}</tbody>
                </table>
            </div>
        `;
        abrirModalGenerico(`Detalhes da Solicitação ${compra.id}`, conteudo);
    } catch (error) {
        console.error(error);
        mostrarMensagem("Erro ao visualizar.", "error");
    }
}

async function baixarCompraTotal(docId) {
    abrirModalRecebimentoCompra(docId, 'total');
}

async function baixarCompraParcial(docId) {
    abrirModalRecebimentoCompra(docId, 'parcial');
}

async function abrirModalRecebimentoCompra(docId, tipo) {
    try {
        const doc = await db.collection('epi_compras').doc(docId).get();
        if (!doc.exists) return;
        const compra = doc.data();

        let html = `
            <form id="form-recebimento-compra">
                <div class="row g-3 mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Nota Fiscal</label>
                        <input type="text" class="form-control" id="rec-nota-fiscal" required placeholder="Nº da NF">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Lote Geral (Opcional)</label>
                        <input type="text" class="form-control" id="rec-lote-geral" placeholder="Lote para todos os itens">
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm table-bordered align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>Item</th>
                                <th style="width: 80px;">Pendente</th>
                                <th style="width: 100px;">Receber</th>
                                <th style="width: 120px;">Custo Unit. (R$)</th>
                                <th style="width: 120px;">Lote Específico</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        compra.itens.forEach((item, index) => {
            const pendente = item.sugerido - (item.recebido || 0);
            if (pendente > 0) {
                const valorPadrao = tipo === 'total' ? pendente : 0;
                html += `
                    <tr>
                        <td>
                            ${item.descricao}<br>
                            <small class="text-muted">CA: ${item.ca}</small>
                        </td>
                        <td class="text-center bg-light">${pendente}</td>
                        <td>
                            <input type="number" class="form-control form-control-sm input-receber-qtd" 
                                data-index="${index}" data-descricao="${item.descricao}" data-ca="${item.ca}" data-fornecedor="${item.fornecedor || ''}"
                                value="${valorPadrao}" min="0" max="${pendente}">
                        </td>
                        <td>
                            <input type="number" class="form-control form-control-sm input-receber-custo" step="0.01" placeholder="0,00">
                        </td>
                        <td>
                            <input type="text" class="form-control form-control-sm input-receber-lote" placeholder="Lote">
                        </td>
                    </tr>
                `;
            }
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <div class="alert alert-info small">
                    <i class="fas fa-info-circle"></i> Ao confirmar, novos itens de estoque serão criados com os custos e lotes informados.
                </div>
                <button type="button" class="btn btn-success w-100 fw-bold" onclick="processarRecebimentoCompra('${docId}')">
                    <i class="fas fa-box-open me-2"></i> Confirmar Recebimento e Gerar Estoque
                </button>
            </form>
        `;

        abrirModalGenerico(`Recebimento de Compra - ${compra.id}`, html);

    } catch (error) {
        console.error("Erro ao abrir modal de recebimento:", error);
        mostrarMensagem("Erro ao carregar dados da compra.", "error");
    }
}

window.processarRecebimentoCompra = async function(docId) {
    try {
        const notaFiscal = document.getElementById('rec-nota-fiscal').value.trim();
        const loteGeral = document.getElementById('rec-lote-geral').value.trim();
        const inputsQtd = document.querySelectorAll('.input-receber-qtd');
        const inputsCusto = document.querySelectorAll('.input-receber-custo');
        const inputsLote = document.querySelectorAll('.input-receber-lote');

        if (!notaFiscal) {
            mostrarMensagem("Informe o número da Nota Fiscal.", "warning");
            return;
        }

        const compraRef = db.collection('epi_compras').doc(docId);
        const doc = await compraRef.get();
        const compra = doc.data();
        const batch = db.batch();
        
        let algumRecebimento = false;
        let tudoConcluido = true;
        const novosItens = [...compra.itens];

        // Iterar sobre os inputs
        for (let i = 0; i < inputsQtd.length; i++) {
            const input = inputsQtd[i];
            const qtd = parseInt(input.value) || 0;
            const index = parseInt(input.dataset.index);
            const custo = parseFloat(inputsCusto[i].value) || 0;
            const loteItem = inputsLote[i].value.trim() || loteGeral;
            
            if (qtd > 0) {
                algumRecebimento = true;
                novosItens[index].recebido = (novosItens[index].recebido || 0) + qtd;
                
                // CRIAR NOVO EPI NO ESTOQUE (Lote Específico)
                const novoEpiRef = db.collection('epi_estoque').doc();
                batch.set(novoEpiRef, {
                    descricao: input.dataset.descricao,
                    ca: input.dataset.ca,
                    fornecedor: input.dataset.fornecedor,
                    quantidade: qtd,
                    custo: custo,
                    lote: loteItem,
                    notaFiscal: notaFiscal,
                    unidade: 'Unidade', // Padrão, ou poderia vir da compra se tivesse
                    estoqueMinimo: 0, // Novo lote não precisa ter mínimo, o controle é global ou manual
                    compraOrigemId: docId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // ATUALIZAR LOTES ANTIGOS PARA "SUBSTITUIDO"
                // Busca itens no estoque com mesmo CA e Descrição que não sejam o novo lote
                // e marca como substituídos para não gerarem novas compras duplicadas
                const oldLotsQuery = await db.collection('epi_estoque')
                    .where('ca', '==', input.dataset.ca)
                    .where('descricao', '==', input.dataset.descricao)
                    .get();

                oldLotsQuery.forEach(oldDoc => {
                    // Não altera o documento que acabamos de criar (embora o ID ainda não esteja disponível aqui facilmente, 
                    // a query é feita antes do commit, mas o novo doc está no batch. O Firestore lida bem, mas por segurança
                    // verificamos se não é um lote recém criado se tivéssemos o ID. Como é batch, o novo doc não existe na query ainda).
                    // Apenas marcamos os existentes.
                    if (oldDoc.data().status !== 'Substituido') {
                        batch.update(oldDoc.ref, { 
                            status: 'Substituido',
                            obs: `Substituído por compra NF ${notaFiscal} em ${new Date().toLocaleDateString()}`
                        });
                    }
                });
            }
            
            if (novosItens[index].recebido < novosItens[index].sugerido) {
                tudoConcluido = false;
            }
        }

        if (!algumRecebimento) {
            mostrarMensagem("Nenhuma quantidade informada.", "warning");
            return;
        }

        batch.update(compraRef, {
            itens: novosItens,
            status: tudoConcluido ? 'Concluido' : 'Parcial',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        mostrarMensagem("Recebimento registrado e novos lotes criados no estoque!", "success");
        
        // Fechar modal genérico (assumindo bootstrap)
        const modalEl = document.getElementById('modalGenerico');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        inicializarComprasEPI();
        carregarEstoqueEPI();

    } catch (error) {
        console.error("Erro no recebimento:", error);
        mostrarMensagem("Erro ao processar.", "error");
    }
};

async function excluirCompraEPI(id) {
    if (!confirm("Tem certeza que deseja excluir esta solicitação de compra?")) return;
    try {
        await db.collection('epi_compras').doc(id).delete();
        mostrarMensagem("Solicitação excluída com sucesso.", "success");
        inicializarComprasEPI();
    } catch (error) {
        console.error("Erro ao excluir solicitação:", error);
        mostrarMensagem("Erro ao excluir solicitação.", "error");
    }
}

async function reprocessarCustosEPI() {
    if (!confirm("Esta ação buscará todos os registros de consumo com custo R$ 0,00 e tentará atualizar com o custo atual do cadastro de EPI.\n\nDeseja continuar?")) return;

    try {
        mostrarMensagem("Buscando registros com custo zerado...", "info");

        // 1. Carregar Estoque para obter custos atuais
        const estoqueSnap = await db.collection('epi_estoque').get();
        const custosAtuais = {};
        estoqueSnap.forEach(doc => {
            const data = doc.data();
            custosAtuais[doc.id] = parseFloat(data.custo) || 0;
        });

        // 2. Buscar consumos com custo 0
        const consumosSnap = await db.collection('epi_consumo').where('custoUnitario', '==', 0).get();
        
        if (consumosSnap.empty) {
            mostrarMensagem("Nenhum registro com custo zerado encontrado.", "info");
            return;
        }

        const batch = db.batch();
        let count = 0;

        consumosSnap.forEach(doc => {
            const consumo = doc.data();
            const epiId = consumo.epiId;
            const novoCusto = custosAtuais[epiId];

            if (novoCusto && novoCusto > 0) {
                batch.update(doc.ref, { custoUnitario: novoCusto });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            mostrarMensagem(`${count} registros atualizados com sucesso!`, "success");
            carregarHistoricoConsumoEPI();
            if (typeof carregarDashboardConsumoEPI === 'function') carregarDashboardConsumoEPI();
        } else {
            mostrarMensagem("Registros encontrados, mas os EPIs correspondentes ainda estão sem custo no cadastro.", "warning");
        }

    } catch (error) {
        console.error("Erro ao reprocessar custos:", error);
        mostrarMensagem("Erro ao processar atualização.", "error");
    }
}

// ========================================
// INICIALIZAÇÃO DOS MÓDULOS
// ========================================

async function inicializarEstoqueEPI() {
    console.log("Inicializando Estoque de EPI...");
    await carregarEstoqueEPI();
}

async function inicializarConsumoEPI() {
    console.log("Inicializando Consumo de EPI...");
    // Define data padrão para o filtro (mês atual)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const filtroInicio = document.getElementById('filtro-consumo-inicio');
    const filtroFim = document.getElementById('filtro-consumo-fim');
    
    if (filtroInicio && !filtroInicio.value) filtroInicio.value = inicioMes;
    if (filtroFim && !filtroFim.value) filtroFim.value = fimMes;

    await carregarHistoricoConsumoEPI();
    
    // Preencher filtros do dashboard
    await carregarSelectEmpresas('dash-epi-empresa');
    // Setores podem ser carregados dinamicamente ou todos de uma vez
    // carregarDashboardConsumoEPI(); // Opcional: carregar ao iniciar
}

// ========================================
// EXPORTAÇÃO DE FUNÇÕES PARA O ESCOPO GLOBAL
// ========================================

// Certifique-se de que todas as funções estejam disponíveis globalmente
window.carregarSelectFuncionariosAtivos = carregarSelectFuncionariosAtivos;
window.carregarEstoqueEPI = carregarEstoqueEPI;
window.abrirModalEPI = abrirModalEPI;
window.salvarEPI = salvarEPI;
window.toggleModeloEPI = toggleModeloEPI;
window.abrirModalEntradaEstoque = abrirModalEntradaEstoque;
window.salvarEntradaEstoque = salvarEntradaEstoque;
window.verificarRastreioEPI = verificarRastreioEPI;
window.atualizarChaveRastreio = atualizarChaveRastreio;
window.excluirEPI = excluirEPI;
window.carregarHistoricoConsumoEPI = carregarHistoricoConsumoEPI;
window.abrirModalConsumoEPI = abrirModalConsumoEPI;
window.salvarEntregaEPI = salvarEntregaEPI;
window.adicionarItemEPI = adicionarItemEPI;
window.removerItemEPI = removerItemEPI;
window.atualizarTabelaItensEntrega = atualizarTabelaItensEntrega;
window.calcularTotalItens = calcularTotalItens;
window.excluirConsumoEPI = excluirConsumoEPI;
window.devolverItemEPI = devolverItemEPI;
window.carregarDashboardConsumoEPI = carregarDashboardConsumoEPI;
window.gerarSolicitacaoCompraEPI = gerarSolicitacaoCompraEPI;
window.inicializarComprasEPI = inicializarComprasEPI;
window.visualizarCompra = visualizarCompra;
window.baixarCompraTotal = baixarCompraTotal;
window.baixarCompraParcial = baixarCompraParcial;
window.imprimirRelatorioEntrega = imprimirRelatorioEntrega;
window.excluirCompraEPI = excluirCompraEPI;
window.inicializarEstoqueEPI = inicializarEstoqueEPI;
window.inicializarConsumoEPI = inicializarConsumoEPI;
window.reprocessarCustosEPI = reprocessarCustosEPI;
window.atualizarCustoConsumoIndividual = atualizarCustoConsumoIndividual;

// --- Integração Biometria Android ---

function identificarPorBiometria() {
    if (typeof AndroidBiometria !== 'undefined') {
        mostrarMensagem("Aguardando leitura biométrica...", "info");
        AndroidBiometria.autenticarBiometria();
    } else {
        mostrarMensagem("Funcionalidade disponível apenas no App Android.", "warning");
    }
}

window.onBiometriaIdentificada = function(funcionarioId) {
    const select = document.getElementById('consumo-funcionario');
    if (select) {
        select.value = funcionarioId;
        // Dispara evento de change se houver listeners
        select.dispatchEvent(new Event('change'));
        mostrarMensagem("Colaborador identificado!", "success");
        
        // Armazena dados da validação para o comprovante
        validacaoBiometricaAtual = {
            timestamp: new Date().toLocaleString('pt-BR'),
            deviceId: 'Android-App', // Poderia vir do Android também
            metodo: 'Impressão Digital'
        };
    } else {
        mostrarMensagem("Colaborador não encontrado na lista ativa.", "error");
    }
};

// Inicializar automaticamente quando a seção for carregada
document.addEventListener('DOMContentLoaded', function() {
    // Observar mudanças nas seções
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                
                // Se a seção de estoque EPI ficou visível
                if (target.id === 'estoque-epi' && !target.classList.contains('d-none')) {
                    inicializarEstoqueEPI();
                }
                
                // Se a seção de consumo EPI ficou visível
                if (target.id === 'consumo-epi' && !target.classList.contains('d-none')) {
                    // A inicialização agora é chamada pelo app.js, então apenas recarregamos o dashboard
                    // que redesenha os gráficos com as novas configurações.
                    if (typeof carregarDashboardConsumoEPI === 'function') {
                        carregarDashboardConsumoEPI();
                    } else {
                        inicializarConsumoEPI();
                    }
                }

                // Se a seção de compras EPI ficou visível
                if (target.id === 'epi-compras' && !target.classList.contains('d-none')) {
                    inicializarComprasEPI();
                }
            }
        });
    });
    
    // Observar todas as seções de conteúdo
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(function(section) {
        observer.observe(section, { attributes: true });
    });
});

console.log("Módulo de Controle de EPI carregado!");