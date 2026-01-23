// ========================================
// Módulo: Controle de EPI (Estoque e Consumo)
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
                    <td>${epi.fornecedor || '-'}${epi.lote ? ` <br><small class="text-muted">Lote: ${epi.lote}</small>` : ''}</td>
                    <td class="text-center fs-6">
                        <strong>${estoqueAtual}</strong> 
                        <small class="text-muted">/ Min: ${estoqueMinimo}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirModalEPI('${doc.id}')" title="Editar">
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

function abrirModalEPI(epiId = null) {
    const modalEl = document.getElementById('modalNovoEPI');
    const form = document.getElementById('form-epi');
    if (!modalEl || !form) return;

    form.reset();
    document.getElementById('epi-id').value = epiId || '';
    document.getElementById('modalEPITitulo').textContent = epiId ? 'Editar EPI' : 'Novo EPI';

    // Preencher dados se for edição
    if (epiId) {
        db.collection('epi_estoque').doc(epiId).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    document.getElementById('epi-descricao').value = data.descricao || '';
                    document.getElementById('epi-ca').value = data.ca || '';
                    document.getElementById('epi-validade').value = data.validadeCA || '';
                    document.getElementById('epi-fornecedor').value = data.fornecedor || '';
                    document.getElementById('epi-lote').value = data.lote || '';
                    document.getElementById('epi-quantidade').value = data.quantidade || 0;
                    document.getElementById('epi-minimo').value = data.estoqueMinimo || 0;
                }
            })
            .catch(error => {
                console.error("Erro ao carregar EPI:", error);
                mostrarMensagem("Erro ao carregar dados do EPI.", "error");
            });
    }

    if (typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        console.error("Bootstrap não encontrado ou não carregado.");
    }
}

async function salvarEPI() {
    const id = document.getElementById('epi-id').value;
    const dados = {
        descricao: document.getElementById('epi-descricao').value.trim(),
        ca: document.getElementById('epi-ca').value.trim(),
        validadeCA: document.getElementById('epi-validade').value,
        fornecedor: document.getElementById('epi-fornecedor').value.trim(),
        lote: document.getElementById('epi-lote').value.trim(),
        quantidade: parseInt(document.getElementById('epi-quantidade').value) || 0,
        estoqueMinimo: parseInt(document.getElementById('epi-minimo').value) || 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Validação dos campos obrigatórios
    if (!dados.descricao) {
        mostrarMensagem("A descrição do EPI é obrigatória.", "warning");
        document.getElementById('epi-descricao').focus();
        return;
    }
    if (!dados.ca) {
        mostrarMensagem("O CA (Certificado de Aprovação) é obrigatório.", "warning");
        document.getElementById('epi-ca').focus();
        return;
    }
    if (!dados.validadeCA) {
        mostrarMensagem("A validade do CA é obrigatória.", "warning");
        document.getElementById('epi-validade').focus();
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

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNovoEPI'));
        modal.hide();
        await carregarEstoqueEPI();
    } catch (error) {
        console.error("Erro ao salvar EPI:", error);
        mostrarMensagem("Erro ao salvar EPI. Verifique sua conexão.", "error");
    }
}

async function excluirEPI(id) {
    if (!confirm("Tem certeza que deseja excluir este EPI? O histórico de consumo será mantido, mas o item sairá do estoque.")) return;
    
    try {
        await db.collection('epi_estoque').doc(id).delete();
        mostrarMensagem("EPI excluído com sucesso.", "success");
        await carregarEstoqueEPI();
    } catch (error) {
        console.error("Erro ao excluir EPI:", error);
        mostrarMensagem("Erro ao excluir EPI.", "error");
    }
}

// ========================================
// CONSUMO DE EPI
// ========================================

async function carregarHistoricoConsumoEPI() {
    const tbody = document.getElementById('tabela-consumo-epi');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando histórico...</td></tr>';

    const dataInicio = document.getElementById('filtro-consumo-inicio')?.value;
    const dataFim = document.getElementById('filtro-consumo-fim')?.value;

    try {
        let query = db.collection('epi_consumo').orderBy('dataEntrega', 'desc');

        if (dataInicio) {
            const inicioDate = new Date(dataInicio + 'T00:00:00');
            query = query.where('dataEntrega', '>=', inicioDate);
        }
        
        if (dataFim) {
            const fimDate = new Date(dataFim + 'T23:59:59');
            query = query.where('dataEntrega', '<=', fimDate);
        }

        const snapshot = await query.limit(100).get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum registro de consumo no período.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const consumo = doc.data();
            let dataEntrega;
            
            if (consumo.dataEntrega?.toDate) {
                dataEntrega = consumo.dataEntrega.toDate();
            } else if (consumo.dataEntrega instanceof Date) {
                dataEntrega = consumo.dataEntrega;
            } else {
                dataEntrega = new Date(consumo.dataEntrega);
            }

            html += `
                <tr>
                    <td>${dataEntrega.toLocaleDateString('pt-BR')}</td>
                    <td>${consumo.funcionarioNome || 'N/A'}</td>
                    <td>${consumo.epiDescricao || 'N/A'}</td>
                    <td>${consumo.epiCA || 'N/A'}</td>
                    <td><span class="badge bg-primary rounded-pill">${consumo.quantidade || 0}</span></td>
                    <td><small class="text-muted">${consumo.responsavelNome || 'Sistema'}</small></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar histórico de consumo:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar histórico.</td></tr>';
    }
}

async function abrirModalConsumoEPI() {
    const modalEl = document.getElementById('modalConsumoEPI');
    if (!modalEl) return;

    const form = document.getElementById('form-consumo-epi');
    if (form) form.reset();
    
    const consumoData = document.getElementById('consumo-data');
    if (consumoData) consumoData.valueAsDate = new Date();

    // Carregar Funcionários
    const funcSelect = document.getElementById('consumo-funcionario');
    if (funcSelect) {
        funcSelect.innerHTML = '<option value="">Carregando...</option>';
        await carregarSelectFuncionariosAtivos('consumo-funcionario');
    }

    // Carregar EPIs com saldo > 0
    const epiSelect = document.getElementById('consumo-epi-select');
    if (epiSelect) {
        epiSelect.innerHTML = '<option value="">Carregando...</option>';
        
        try {
            const snapshot = await db.collection('epi_estoque').where('quantidade', '>', 0).orderBy('descricao').get();
            epiSelect.innerHTML = '<option value="">Selecione o EPI</option>';
            
            snapshot.forEach(doc => {
                const epi = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${epi.descricao} (CA: ${epi.ca}) - Saldo: ${epi.quantidade}`;
                option.dataset.saldo = epi.quantidade;
                option.dataset.descricao = epi.descricao;
                option.dataset.ca = epi.ca;
                epiSelect.appendChild(option);
            });
            
            // Atualizar quantidade máxima quando EPI for selecionado
            epiSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const saldo = parseInt(selectedOption.dataset.saldo) || 0;
                const quantidadeInput = document.getElementById('consumo-quantidade');
                if (quantidadeInput) {
                    quantidadeInput.max = saldo;
                    quantidadeInput.value = Math.min(1, saldo);
                }
            });
            
        } catch (error) {
            console.error("Erro ao carregar EPIs para consumo:", error);
            epiSelect.innerHTML = '<option value="">Erro ao carregar EPIs</option>';
        }
    }

    if (typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } else {
        console.error("Bootstrap não encontrado ou não carregado.");
    }
}

async function registrarConsumoEPI() {
    const epiSelect = document.getElementById('consumo-epi-select');
    const funcSelect = document.getElementById('consumo-funcionario');
    const quantidadeInput = document.getElementById('consumo-quantidade');
    const dataEntregaInput = document.getElementById('consumo-data');

    if (!epiSelect || !funcSelect || !quantidadeInput || !dataEntregaInput) {
        mostrarMensagem("Elementos do formulário não encontrados.", "error");
        return;
    }

    const epiId = epiSelect.value;
    const funcionarioId = funcSelect.value;
    const quantidade = parseInt(quantidadeInput.value);
    const dataEntrega = dataEntregaInput.value;

    if (!epiId || !funcionarioId || !quantidade || !dataEntrega) {
        mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
        return;
    }

    const selectedOption = epiSelect.options[epiSelect.selectedIndex];
    const saldoAtual = parseInt(selectedOption.dataset.saldo) || 0;
    const epiDescricao = selectedOption.dataset.descricao || '';
    const epiCA = selectedOption.dataset.ca || '';
    const funcionarioNome = funcSelect.options[funcSelect.selectedIndex].text || '';

    if (quantidade > saldoAtual) {
        mostrarMensagem(`Quantidade indisponível! Saldo atual: ${saldoAtual}`, "error");
        return;
    }

    if (quantidade <= 0) {
        mostrarMensagem("A quantidade deve ser maior que zero.", "warning");
        return;
    }

    try {
        const batch = db.batch();
        
        // 1. Registrar Consumo
        const consumoRef = db.collection('epi_consumo').doc();
        batch.set(consumoRef, {
            epiId: epiId,
            epiDescricao: epiDescricao,
            epiCA: epiCA,
            funcionarioId: funcionarioId,
            funcionarioNome: funcionarioNome,
            quantidade: quantidade,
            dataEntrega: new Date(dataEntrega.replace(/-/g, '/')),
            responsavelUid: firebase.auth().currentUser?.uid,
            responsavelNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Atualizar Estoque (Baixa)
        const estoqueRef = db.collection('epi_estoque').doc(epiId);
        batch.update(estoqueRef, {
            quantidade: firebase.firestore.FieldValue.increment(-quantidade),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        mostrarMensagem("Entrega de EPI registrada com sucesso!", "success");
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalConsumoEPI'));
        if (modal) modal.hide();
        
        // Atualiza as telas
        await carregarHistoricoConsumoEPI();
        await carregarEstoqueEPI();

    } catch (error) {
        console.error("Erro ao registrar consumo:", error);
        mostrarMensagem("Erro ao registrar consumo.", "error");
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function mostrarMensagem(texto, tipo = 'info') {
    // Você precisa implementar esta função ou usar a que já existe
    // Exemplo simples usando alert ou um toast do Bootstrap
    if (typeof toastr !== 'undefined') {
        toastr[tipo === 'success' ? 'success' : tipo === 'warning' ? 'warning' : tipo === 'error' ? 'error' : 'info'](texto);
    } else {
        alert(texto);
    }
}

async function carregarSelectFuncionariosAtivos(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'ativo')
            .orderBy('nome')
            .get();

        select.innerHTML = '<option value="">Selecione o funcionário</option>';
        
        snapshot.forEach(doc => {
            const funcionario = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = funcionario.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar funcionários:", error);
        select.innerHTML = '<option value="">Erro ao carregar funcionários</option>';
    }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

// Adicionar event listeners quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Configurar botão "Novo Consumo"
    const btnNovoConsumo = document.getElementById('btn-novo-consumo');
    if (btnNovoConsumo) {
        btnNovoConsumo.addEventListener('click', abrirModalConsumoEPI);
    }

    // Configurar formulário de EPI
    const formEPI = document.getElementById('form-epi');
    if (formEPI) {
        formEPI.addEventListener('submit', function(e) {
            e.preventDefault();
            salvarEPI();
        });
    }

    // Configurar formulário de consumo
    const formConsumoEPI = document.getElementById('form-consumo-epi');
    if (formConsumoEPI) {
        formConsumoEPI.addEventListener('submit', function(e) {
            e.preventDefault();
            registrarConsumoEPI();
        });
    }

    // Configurar busca de EPI
    const buscaEPI = document.getElementById('busca-epi');
    if (buscaEPI) {
        buscaEPI.addEventListener('input', carregarEstoqueEPI);
    }

    // Configurar filtros de consumo
    const filtroInicio = document.getElementById('filtro-consumo-inicio');
    const filtroFim = document.getElementById('filtro-consumo-fim');
    
    if (filtroInicio) filtroInicio.addEventListener('change', carregarHistoricoConsumoEPI);
    if (filtroFim) filtroFim.addEventListener('change', carregarHistoricoConsumoEPI);
});

// Exportar funções para uso global (se necessário)
window.carregarEstoqueEPI = carregarEstoqueEPI;
window.carregarHistoricoConsumoEPI = carregarHistoricoConsumoEPI;
window.abrirModalEPI = abrirModalEPI;
window.abrirModalConsumoEPI = abrirModalConsumoEPI;
window.salvarEPI = salvarEPI;
window.registrarConsumoEPI = registrarConsumoEPI;
window.excluirEPI = excluirEPI;