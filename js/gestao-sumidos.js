// ========================================
// Módulo: Gestão de Sumidos (Absenteísmo Crítico)
// ========================================

let whatsappConfigSumidos = {
    telefone: '',
    ativo: true
};

async function carregarConfiguracaoWhatsApp() {
    try {
        const doc = await db.collection('configuracoes').doc('whatsapp').get();
        if (doc.exists) {
            const data = doc.data();
            whatsappConfigSumidos.telefone = data.telefone || '';
            whatsappConfigSumidos.ativo = data.ativo !== false;
        }
    } catch (e) {
        console.error("Erro ao carregar config WhatsApp:", e);
    }
}

async function inicializarGestaoSumidos() {
    console.log("Inicializando Gestão de Sumidos...");
    await carregarConfiguracaoWhatsApp();
    const container = document.getElementById('gestao-sumidos');
    if (!container) return;

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="page-title mb-0">Gestão de Sumidos (Absenteísmo Crítico)</h2>
                <p class="text-muted mb-0">Monitoramento de colaboradores com ausência prolongada não justificada.</p>
            </div>
            <button class="btn btn-danger" onclick="abrirModalNovoSumido()">
                <i class="fas fa-user-clock me-2"></i> Registrar Novo Caso
            </button>
        </div>
        
        <!-- Dashboard Section -->
        <div class="row mb-4" id="sumidos-dashboard">
            <!-- KPIs will be injected here -->
        </div>
        
        <div class="card shadow-sm border-0">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th class="ps-4">Nome</th>
                                <th>Data de Admissão</th>
                                <th>Setor</th>
                                <th>Data do Último Registro de Ponto</th>
                                <th>Tempo Desaparecido</th>
                                <th>Status</th>
                                <th class="text-end pe-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="tabela-sumidos">
                            <tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Carregando casos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    await carregarListaSumidos();
}

async function carregarListaSumidos() {
    const tbody = document.getElementById('tabela-sumidos');
    if (!tbody) return;

    try {
        // Busca casos que não estão resolvidos (ou todos, dependendo da regra de negócio)
        const snapshot = await db.collection('casos_sumidos')
            .orderBy('dataUltimoPonto', 'asc')
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><i class="fas fa-check-circle fa-2x mb-3 text-success opacity-50"></i><br>Nenhum caso de abandono registrado.</td></tr>';
            return;
        }

        // Update Dashboard
        atualizarDashboardSumidos(snapshot.docs.map(doc => doc.data()));

        let html = '';
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        snapshot.forEach(doc => {
            const caso = doc.data();
            const dataUltimoPonto = caso.dataUltimoPonto ? caso.dataUltimoPonto.toDate() : null;
            const dataAdmissao = caso.dataAdmissao ? (caso.dataAdmissao.toDate ? caso.dataAdmissao.toDate() : new Date(caso.dataAdmissao)) : null;
            const status = caso.status || 'Em Aberto';

            let statusClass = 'bg-secondary';
            if (status === 'Em Tratamento') statusClass = 'bg-warning text-dark';
            if (status === 'Posse do Jurídico') statusClass = 'bg-info';
            if (status === 'Finalizado') statusClass = 'bg-success';

            
            let tempoDesaparecido = 0;
            if (dataUltimoPonto) {
                const diffTime = Math.abs(hoje - dataUltimoPonto);
                tempoDesaparecido = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
            }

            // Definição de cores baseada na gravidade (dias sumido)
            let badgeClass = 'bg-info text-dark';
            if (tempoDesaparecido > 30) badgeClass = 'bg-danger'; // Abandono de emprego (30 dias)
            else if (tempoDesaparecido > 15) badgeClass = 'bg-warning text-dark';

            let btnWhatsapp = '';
            if (tempoDesaparecido > 15) {
                btnWhatsapp = `<button class="btn btn-sm btn-success" onclick="enviarAlertaWhatsAppSumido('${caso.nome}', '${caso.setor || ''}', ${tempoDesaparecido}, '${dataUltimoPonto ? dataUltimoPonto.toLocaleDateString('pt-BR') : '-'}')" title="Enviar Alerta WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
            }

            html += `
                <tr>
                    <td class="ps-4 fw-bold">${caso.nome}</td>
                    <td>${dataAdmissao ? dataAdmissao.toLocaleDateString('pt-BR') : '-'}</td>
                    <td>${caso.setor || '-'}</td>
                    <td>${dataUltimoPonto ? dataUltimoPonto.toLocaleDateString('pt-BR') : '-'}</td>
                    <td><span class="badge ${badgeClass} fs-6">${tempoDesaparecido} dias</span></td>
                    <td><span class="badge ${statusClass}">${status}</span></td>
                    <td class="text-end pe-4">
                        <div class="btn-group">
                            ${btnWhatsapp}
                            <button class="btn btn-sm btn-outline-primary" onclick="window.abrirModalEditarSumido('${doc.id}')" title="Editar Caso">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary" onclick="abrirModalTratamento('${doc.id}')">
                                <i class="fas fa-file-contract me-1"></i> Tratamento
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirCasoSumido('${doc.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar sumidos:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function enviarAlertaWhatsAppSumido(nome, setor, dias, ultimoPonto) {
    if (!whatsappConfigSumidos.ativo || !whatsappConfigSumidos.telefone) {
        mostrarMensagem("WhatsApp não configurado ou desativado nas configurações gerais.", "warning");
        return;
    }
    
    const telefone = formatarTelefoneWhatsApp(whatsappConfigSumidos.telefone);
    const mensagem = `⚠️ *ALERTA DE ABSENTEÍSMO CRÍTICO* ⚠️\n\n` +
        `👤 *Colaborador:* ${nome}\n` +
        `🏢 *Setor:* ${setor}\n` +
        `📅 *Último Ponto:* ${ultimoPonto}\n` +
        `⏳ *Tempo de Ausência:* ${dias} dias\n\n` +
        `❗ *Status:* Superior a 15 dias.\n` +
        `👉 *Ação:* Verificar protocolo de abandono de emprego.`;
        
    const link = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, '_blank');
}

function atualizarDashboardSumidos(casos) {
    const dashboard = document.getElementById('sumidos-dashboard');
    if (!dashboard) return;

    const total = casos.length;
    const emTratamento = casos.filter(c => c.tratamento && (c.tratamento.whatsapp || c.tratamento.ar)).length;
    const casosFinalizados = casos.filter(c => c.status === 'Finalizado').length;
    const casosEmAberto = total - casosFinalizados;

    dashboard.innerHTML = `
        <div class="col-md-3 mb-3">
            <div class="card bg-primary text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Total de Casos</h6><h2 class="mb-0">${total}</h2></div>
                        <i class="fas fa-users fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card bg-info text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Casos em Aberto</h6><h2 class="mb-0">${casosEmAberto}</h2></div>
                        <i class="fas fa-folder-open fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card bg-warning text-dark h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Em Tratamento</h6><h2 class="mb-0">${emTratamento}</h2></div>
                        <i class="fas fa-comments fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card bg-success text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Casos Finalizados</h6><h2 class="mb-0">${casosFinalizados}</h2></div>
                        <i class="fas fa-check-circle fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function abrirModalNovoSumido() {
    let modalEl = document.getElementById('modalNovoSumido');
    if (!modalEl) {
        const modalHTML = `
            <div class="modal fade" id="modalNovoSumido" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title"><i class="fas fa-user-clock me-2"></i>Registrar Colaborador Sumido</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-novo-sumido">
                                <div class="mb-3">
                                    <label class="form-label">Colaborador</label>
                                    <select class="form-select" id="sumido-funcionario" required></select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Data do Último Registro de Ponto</label>
                                    <input type="date" class="form-control" id="sumido-ultimo-ponto" required>
                                    <div class="form-text">Data em que o colaborador bateu o ponto pela última vez.</div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" onclick="salvarNovoSumido()">Registrar Caso</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalEl = document.getElementById('modalNovoSumido');
    }

    // Carregar funcionários
    if (typeof carregarSelectFuncionariosAtivos === 'function') {
        await carregarSelectFuncionariosAtivos('sumido-funcionario');
    }

    document.getElementById('form-novo-sumido').reset();
    new bootstrap.Modal(modalEl).show();
}

async function salvarNovoSumido() {
    const funcSelect = document.getElementById('sumido-funcionario');
    const dataPonto = document.getElementById('sumido-ultimo-ponto').value;

    if (!funcSelect.value || !dataPonto) {
        alert("Preencha todos os campos.");
        return;
    }

    try {
        // Buscar dados completos do funcionário para salvar no registro (snapshot)
        const funcDoc = await db.collection('funcionarios').doc(funcSelect.value).get();
        const funcData = funcDoc.data();

        await db.collection('casos_sumidos').add({
            funcionarioId: funcSelect.value,
            nome: funcData.nome,
            dataAdmissao: funcData.dataAdmissao,
            setor: funcData.setor,
            dataUltimoPonto: new Date(dataPonto + 'T00:00:00'),
            status: 'Em Aberto',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNovoSumido'));
        modal.hide();
        
        mostrarMensagem("Caso registrado com sucesso!", "success");
        carregarListaSumidos();

    } catch (error) {
        console.error("Erro ao salvar:", error);
        mostrarMensagem("Erro ao registrar caso.", "error");
    }
}

async function abrirModalEditarSumido(id) {
    let modalEl = document.getElementById('modalEditarSumido');
    
    // Garante que o modal use a estrutura correta (select em vez de input) se já existir no DOM
    if (modalEl) {
        const setorInput = modalEl.querySelector('#edit-sumido-setor');
        if (setorInput && setorInput.tagName === 'INPUT') {
            modalEl.remove();
            modalEl = null;
        }
    }

    if (!modalEl) {
        const modalHTML = `
            <div class="modal fade" id="modalEditarSumido" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="fas fa-edit me-2"></i>Editar Caso</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="form-editar-sumido">
                                <input type="hidden" id="edit-sumido-id">
                                <div class="mb-3">
                                    <label class="form-label">Colaborador</label>
                                    <input type="text" class="form-control bg-light" id="edit-sumido-nome" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Data de Admissão</label>
                                    <input type="date" class="form-control" id="edit-sumido-admissao">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Setor</label>
                                    <select class="form-select" id="edit-sumido-setor"></select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Data do Último Ponto</label>
                                    <input type="date" class="form-control" id="edit-sumido-ultimo-ponto" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="window.salvarEdicaoSumido()">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalEl = document.getElementById('modalEditarSumido');
    }

    try {
        const doc = await db.collection('casos_sumidos').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();

        document.getElementById('edit-sumido-id').value = id;
        document.getElementById('edit-sumido-nome').value = data.nome;
        
        // Carregar setores baseados na empresa do funcionário
        const setorSelect = document.getElementById('edit-sumido-setor');
        setorSelect.innerHTML = '<option value="">Carregando...</option>';
        
        if (data.funcionarioId) {
            const funcDoc = await db.collection('funcionarios').doc(data.funcionarioId).get();
            if (funcDoc.exists && funcDoc.data().empresaId && window.carregarSetoresPorEmpresa) {
                await window.carregarSetoresPorEmpresa(funcDoc.data().empresaId, 'edit-sumido-setor', data.setor);
            } else {
                setorSelect.innerHTML = `<option value="${data.setor}" selected>${data.setor}</option>`;
            }
        } else {
             setorSelect.innerHTML = `<option value="${data.setor}" selected>${data.setor}</option>`;
        }
        
        // Tratamento seguro de datas para evitar RangeError
        if (data.dataAdmissao) {
            try {
                const dtAdm = data.dataAdmissao.toDate ? data.dataAdmissao.toDate() : new Date(data.dataAdmissao);
                if (!isNaN(dtAdm.getTime())) {
                    document.getElementById('edit-sumido-admissao').value = dtAdm.toISOString().split('T')[0];
                }
            } catch (e) { console.warn("Data admissão inválida", e); }
        } else {
            document.getElementById('edit-sumido-admissao').value = '';
        }
        
        if (data.dataUltimoPonto) {
            try {
                const dtPonto = data.dataUltimoPonto.toDate ? data.dataUltimoPonto.toDate() : new Date(data.dataUltimoPonto);
                if (!isNaN(dtPonto.getTime())) {
                    document.getElementById('edit-sumido-ultimo-ponto').value = dtPonto.toISOString().split('T')[0];
                }
            } catch (e) { console.warn("Data último ponto inválida", e); }
        } else {
            document.getElementById('edit-sumido-ultimo-ponto').value = '';
        }

        new bootstrap.Modal(modalEl).show();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao carregar dados.", "error");
    }
}

async function salvarEdicaoSumido() {
    const id = document.getElementById('edit-sumido-id').value;
    const setor = document.getElementById('edit-sumido-setor').value;
    const dataAdmissaoStr = document.getElementById('edit-sumido-admissao').value;
    const dataPontoStr = document.getElementById('edit-sumido-ultimo-ponto').value;

    if (!dataPontoStr) {
        mostrarMensagem("A data do último ponto é obrigatória.", "warning");
        return;
    }

    try {
        const updateData = {
            setor: setor,
            dataUltimoPonto: new Date(dataPontoStr + 'T00:00:00')
        };

        if (dataAdmissaoStr) {
            updateData.dataAdmissao = new Date(dataAdmissaoStr + 'T00:00:00');
        }

        await db.collection('casos_sumidos').doc(id).update(updateData);
        
        mostrarMensagem("Dados atualizados com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('modalEditarSumido')).hide();
        carregarListaSumidos();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao salvar alterações.", "error");
    }
}

async function excluirCasoSumido(id) {
    if (!confirm("Tem certeza que deseja excluir este caso?")) return;
    try {
        await db.collection('casos_sumidos').doc(id).delete();
        mostrarMensagem("Caso excluído com sucesso.", "success");
        carregarListaSumidos();
    } catch (e) {
        console.error("Erro ao excluir:", e);
        mostrarMensagem("Erro ao excluir caso.", "error");
    }
}

async function abrirModalTratamento(id) {
    let modalEl = document.getElementById('modalTratamentoSumido');
    if (!modalEl) {
        const modalHTML = `
            <div class="modal fade" id="modalTratamentoSumido" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                        <h5 class="modal-title"><i class="fas fa-history me-2"></i>Histórico e Tratamento do Caso</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="tratamento-id">
                            <h5 id="tratamento-nome-funcionario" class="mb-3"></h5>

                        <!-- Seção para adicionar nova ação -->
                        <div class="card bg-light border mb-4">
                            <div class="card-body">
                                <h6 class="card-title text-primary">Adicionar Nova Ação ao Histórico</h6>
                                <div class="row g-2">
                                    <div class="col-md-5">
                                        <label class="form-label small">Tipo da Ação</label>
                                        <select class="form-select form-select-sm" id="tratamento-acao-tipo">
                                            <option value="Contato WhatsApp">Contato WhatsApp</option>
                                            <option value="Envio de A.R.">Envio de A.R.</option>
                                            <option value="Parecer Jurídico">Parecer Jurídico</option>
                                            <option value="Finalização do Caso">Finalização do Caso</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                    </div>
                                    <div class="col-md-7">
                                        <label class="form-label small">Observação</label>
                                        <input type="text" class="form-control form-control-sm" id="tratamento-acao-obs" placeholder="Ex: Enviado telegrama para o endereço...">
                                    </div>
                                    <div class="col-md-12 mt-2">
                                        <label class="form-label small">Data da Ação</label>
                                        <input type="date" class="form-control form-control-sm" id="tratamento-acao-data">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Seção de Status e Histórico -->
                        <div class="row">
                            <div class="col-md-5">
                                <label class="form-label fw-bold">Atualizar Status Geral</label>
                                <select class="form-select" id="tratamento-status-geral">
                                    <option value="Em Aberto">Em Aberto</option>
                                    <option value="Em Tratamento">Em Tratamento</option>
                                    <option value="Posse do Jurídico">Posse do Jurídico</option>
                                    <option value="Finalizado">Finalizado</option>
                                </select>
                            </div>
                        </div>
                        
                        <hr>
                        <h6><i class="fas fa-history me-2"></i>Histórico de Tratamentos</h6>
                        <div id="tratamento-historico-container" class="list-group" style="max-height: 250px; overflow-y: auto;">
                            <!-- Histórico será inserido aqui -->
                        </div>
                        <div class="mt-2 text-end">
                            <button class="btn btn-sm btn-outline-secondary" onclick="imprimirHistoricoSumido()"><i class="fas fa-print"></i> Imprimir Histórico</button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarAcaoTratamento()">Salvar Ação e Status</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalEl = document.getElementById('modalTratamentoSumido');
    }

    try {
        const doc = await db.collection('casos_sumidos').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();

        document.getElementById('tratamento-id').value = id;
        document.getElementById('tratamento-nome-funcionario').textContent = data.nome;
        document.getElementById('tratamento-status-geral').value = data.status || 'Em Aberto';
        document.getElementById('tratamento-acao-data').valueAsDate = new Date(); // Data padrão hoje

        // Renderizar histórico
        const historicoContainer = document.getElementById('tratamento-historico-container');
        const historico = data.historicoTratamento || [];

        if (historico.length === 0) {
            historicoContainer.innerHTML = '<p class="text-muted small p-3">Nenhuma ação registrada no histórico.</p>';
        } else {
            historicoContainer.innerHTML = historico
                .sort((a, b) => b.data.seconds - a.data.seconds) // Ordena do mais recente para o mais antigo
                .map((item, index) => `
                    <div class="list-group-item list-group-item-action flex-column align-items-start">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1">${item.tipo}</h6>
                            <small>${item.data.toDate().toLocaleDateString('pt-BR')}</small>
                        </div>
                        <p class="mb-1">${item.observacao || 'Nenhuma observação.'}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">Por: ${item.responsavel || 'Sistema'}</small>
                            <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="excluirItemHistoricoSumido('${id}', ${index})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('');
        }

        new bootstrap.Modal(modalEl).show();
    } catch (e) {
        console.error("Erro ao abrir modal:", e);
    }
}

async function salvarAcaoTratamento() {
    const id = document.getElementById('tratamento-id').value;
    const statusGeral = document.getElementById('tratamento-status-geral').value;

    const tipoAcao = document.getElementById('tratamento-acao-tipo').value;
    const obsAcao = document.getElementById('tratamento-acao-obs').value;
    const dataAcaoStr = document.getElementById('tratamento-acao-data').value;
    const dataAcao = dataAcaoStr ? new Date(dataAcaoStr + 'T12:00:00') : new Date();

    // Só adiciona ao histórico se uma observação for feita
    if (obsAcao) {
        const novaAcao = {
            tipo: tipoAcao,
            observacao: obsAcao,
            data: dataAcao,
            responsavel: firebase.auth().currentUser?.displayName || 'Usuário'
        };

        try {
            await db.collection('casos_sumidos').doc(id).update({
                status: statusGeral,
                historicoTratamento: firebase.firestore.FieldValue.arrayUnion(novaAcao),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            mostrarMensagem("Ação registrada e status atualizado!", "success");
        } catch (e) {
            console.error("Erro ao salvar ação:", e);
            mostrarMensagem("Erro ao salvar ação.", "error");
            return;
        }
    } else {
        // Se não houver observação, apenas atualiza o status geral
        try {
            await db.collection('casos_sumidos').doc(id).update({
                status: statusGeral,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            mostrarMensagem("Status do caso atualizado!", "success");
        } catch (e) {
            console.error("Erro ao atualizar status:", e);
            mostrarMensagem("Erro ao atualizar status.", "error");
            return;
        }
    }

    bootstrap.Modal.getInstance(document.getElementById('modalTratamentoSumido')).hide();
    carregarListaSumidos();
}

async function excluirItemHistoricoSumido(docId, index) {
    if (!confirm("Excluir este item do histórico?")) return;
    
    try {
        const docRef = db.collection('casos_sumidos').doc(docId);
        const docSnap = await docRef.get();
        const historico = docSnap.data().historicoTratamento || [];
        
        // O índice passado é baseado na lista ordenada (desc), precisamos achar o item correto no array original
        // A melhor forma é ordenar o array original da mesma maneira antes de remover, ou usar um ID único.
        // Como não temos ID único no item, vamos remover pelo índice reverso ou recarregar e filtrar.
        // Simplificação: Ordenar o array original em memória (desc), remover pelo índice visual, e salvar.
        historico.sort((a, b) => b.data.seconds - a.data.seconds);
        historico.splice(index, 1);
        
        await docRef.update({ historicoTratamento: historico });
        abrirModalTratamento(docId); // Recarrega o modal
    } catch (e) { console.error(e); }
}

async function imprimirHistoricoSumido() {
    const id = document.getElementById('tratamento-id').value;
    try {
        const doc = await db.collection('casos_sumidos').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        const historico = data.historicoTratamento || [];

        const linhasHtml = historico.map(item => `
            <tr>
                <td>${item.data.toDate().toLocaleString('pt-BR')}</td>
                <td>${item.tipo}</td>
                <td>${item.observacao}</td>
                <td>${item.responsavel}</td>
            </tr>
        `).join('');

        const conteudo = `
            <html>
            <head>
                <title>Histórico - ${data.nome}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 1.5cm; }
                    body { font-family: 'Segoe UI', sans-serif; color: #333; }
                    .report-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 15px; margin-bottom: 30px; }
                    .report-header h2 { color: #0d6efd; font-weight: 700; margin: 0; }
                    .info-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
                    .table-custom { width: 100%; border-collapse: collapse; }
                    .table-custom th { background-color: #0d6efd; color: white; padding: 10px; text-align: left; }
                    .table-custom td { padding: 10px; border-bottom: 1px solid #dee2e6; }
                    .footer { margin-top: 50px; text-align: center; font-size: 0.8rem; color: #adb5bd; border-top: 1px solid #dee2e6; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h2>Relatório de Tratamento de Abandono</h2>
                    <p class="text-muted">Histórico de Ações e Procedimentos</p>
                </div>

                <div class="info-card">
                    <div class="row">
                        <div class="col-6"><strong>Colaborador:</strong><br> ${data.nome}</div>
                        <div class="col-6 text-end"><strong>Último Ponto:</strong><br> ${data.dataUltimoPonto ? data.dataUltimoPonto.toDate().toLocaleDateString('pt-BR') : 'N/A'}</div>
                    </div>
                    <div class="row mt-3 pt-3 border-top">
                        <div class="col-12"><strong>Situação Atual:</strong> ${data.status || 'Em Aberto'}</div>
                    </div>
                </div>

                <h5 class="mb-3">Cronograma de Ações</h5>
                <table class="table-custom">
                    <thead><tr><th>Data</th><th>Ação</th><th>Observação</th><th>Responsável</th></tr></thead>
                    <tbody>${linhasHtml}</tbody>
                </table>

                <div class="footer">
                    <p>Documento gerado eletronicamente pelo Sistema Nexter em ${new Date().toLocaleString('pt-BR')}.</p>
                </div>
            </body>
            </html>`;
        
        const win = window.open('', '_blank');
        win.document.write(conteudo);
        win.document.close();
    } catch (e) { console.error(e); }
}

// Exportar funções para o escopo global
window.abrirModalEditarSumido = abrirModalEditarSumido;
window.salvarEdicaoSumido = salvarEdicaoSumido;