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
            const dataAdmissao = caso.dataAdmissao ? caso.dataAdmissao.toDate() : null;
            
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
                    <td class="text-end pe-4">
                        <div class="btn-group">
                            ${btnWhatsapp}
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
    const criticos = casos.filter(c => {
        const data = c.dataUltimoPonto?.toDate ? c.dataUltimoPonto.toDate() : new Date(c.dataUltimoPonto);
        const diff = (new Date() - data) / (1000 * 60 * 60 * 24);
        return diff > 30;
    }).length;
    
    const emTratamento = casos.filter(c => c.tratamento && (c.tratamento.whatsapp || c.tratamento.ar)).length;
    const justaCausa = casos.filter(c => c.tratamento && c.tratamento.justaCausaExecutada).length;

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
            <div class="card bg-danger text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Abandono (>30 dias)</h6><h2 class="mb-0">${criticos}</h2></div>
                        <i class="fas fa-exclamation-triangle fa-2x opacity-50"></i>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card bg-dark text-white h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div><h6 class="mb-0">Justa Causa Executada</h6><h2 class="mb-0">${justaCausa}</h2></div>
                        <i class="fas fa-gavel fa-2x opacity-50"></i>
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
                            <h5 class="modal-title"><i class="fas fa-file-contract me-2"></i>Tratamento de Abandono de Emprego</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="tratamento-id">
                            <h5 id="tratamento-nome-funcionario" class="mb-3"></h5>
                            
                            <div class="card mb-3">
                                <div class="card-header bg-light">Etapas do Processo</div>
                                <div class="card-body">
                                    <div class="row g-3 align-items-center mb-2">
                                        <div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="check-whatsapp"><label class="form-check-label" for="check-whatsapp">Comunicado via WhatsApp</label></div></div>
                                        <div class="col-md-6"><input type="date" class="form-control form-control-sm" id="data-whatsapp"></div>
                                    </div>
                                    <div class="row g-3 align-items-center mb-2">
                                        <div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="check-ar"><label class="form-check-label" for="check-ar">Comunicado via A.R.</label></div></div>
                                        <div class="col-md-6"><input type="date" class="form-control form-control-sm" id="data-ar"></div>
                                    </div>
                                    <div class="row g-3 align-items-center mb-2">
                                        <div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="check-pedido-demissao"><label class="form-check-label" for="check-pedido-demissao">Pedido de Demissão</label></div></div>
                                        <div class="col-md-6"><input type="date" class="form-control form-control-sm" id="data-pedido-demissao"></div>
                                    </div>
                                    <hr>
                                    <div class="row g-3 align-items-center mb-2">
                                        <div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="check-inicio-jc" onchange="toggleAdvogadoField()"><label class="form-check-label" for="check-inicio-jc">Iniciado a Justa Causa</label></div></div>
                                        <div class="col-md-6"><input type="date" class="form-control form-control-sm" id="data-inicio-jc"></div>
                                    </div>
                                    <div class="row g-3 align-items-center mb-2">
                                        <div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" id="check-executa-jc" onchange="toggleAdvogadoField()"><label class="form-check-label" for="check-executa-jc">Justa Causa Executada</label></div></div>
                                        <div class="col-md-6"><input type="date" class="form-control form-control-sm" id="data-executa-jc"></div>
                                    </div>
                                    <div id="container-advogado" style="display:none;" class="mt-3 p-3 bg-light border rounded">
                                        <label class="form-label fw-bold"><i class="fas fa-gavel"></i> Advogado do Parecer</label>
                                        <input type="text" class="form-control" id="advogado-parecer" placeholder="Nome do Advogado responsável">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                            <button type="button" class="btn btn-info" onclick="imprimirHistoricoSumido()"><i class="fas fa-print"></i> Imprimir Histórico</button>
                            <button type="button" class="btn btn-primary" onclick="salvarTratamento()">Salvar</button>
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
        const t = data.tratamento || {};

        document.getElementById('tratamento-id').value = id;
        document.getElementById('tratamento-nome-funcionario').textContent = data.nome;

        document.getElementById('check-whatsapp').checked = !!t.whatsapp;
        document.getElementById('data-whatsapp').value = t.dataWhatsapp || '';
        document.getElementById('check-ar').checked = !!t.ar;
        document.getElementById('data-ar').value = t.dataAr || '';
        
        document.getElementById('check-pedido-demissao').checked = !!t.pedidoDemissao;
        document.getElementById('data-pedido-demissao').value = t.dataPedidoDemissao || '';

        document.getElementById('check-inicio-jc').checked = !!t.inicioJustaCausa;
        document.getElementById('data-inicio-jc').value = t.dataInicioJustaCausa || '';
        document.getElementById('check-executa-jc').checked = !!t.justaCausaExecutada;
        document.getElementById('data-executa-jc').value = t.dataJustaCausaExecutada || '';
        
        document.getElementById('advogado-parecer').value = t.advogadoParecer || '';

        toggleAdvogadoField(); // Atualiza visibilidade do campo advogado

        new bootstrap.Modal(modalEl).show();
    } catch (e) {
        console.error("Erro ao abrir modal:", e);
    }
}

function toggleAdvogadoField() {
    const jcInicio = document.getElementById('check-inicio-jc').checked;
    const jcExecuta = document.getElementById('check-executa-jc').checked;
    const container = document.getElementById('container-advogado');
    if (container) {
        container.style.display = (jcInicio || jcExecuta) ? 'block' : 'none';
    }
}
window.toggleAdvogadoField = toggleAdvogadoField;

async function salvarTratamento() {
    const id = document.getElementById('tratamento-id').value;
    const tratamento = {
        whatsapp: document.getElementById('check-whatsapp').checked,
        dataWhatsapp: document.getElementById('data-whatsapp').value,
        ar: document.getElementById('check-ar').checked,
        dataAr: document.getElementById('data-ar').value,
        pedidoDemissao: document.getElementById('check-pedido-demissao').checked,
        dataPedidoDemissao: document.getElementById('data-pedido-demissao').value,
        inicioJustaCausa: document.getElementById('check-inicio-jc').checked,
        dataInicioJustaCausa: document.getElementById('data-inicio-jc').value,
        justaCausaExecutada: document.getElementById('check-executa-jc').checked,
        dataJustaCausaExecutada: document.getElementById('data-executa-jc').value,
        advogadoParecer: document.getElementById('advogado-parecer').value
    };

    try {
        await db.collection('casos_sumidos').doc(id).update({ tratamento, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        mostrarMensagem("Tratamento atualizado!", "success");
        bootstrap.Modal.getInstance(document.getElementById('modalTratamentoSumido')).hide();
        carregarListaSumidos();
    } catch (e) {
        console.error("Erro ao salvar:", e);
        mostrarMensagem("Erro ao salvar.", "error");
    }
}

async function imprimirHistoricoSumido() {
    const id = document.getElementById('tratamento-id').value;
    try {
        const doc = await db.collection('casos_sumidos').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        const t = data.tratamento || {};
        const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
        const chk = (v) => v ? '<span style="color:green; font-weight:bold;">✔ Realizado</span>' : '<span style="color:#999;">Pendente</span>';

        const html = `
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
                    .advogado-box { margin-top: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; background-color: #fff3cd; }
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
                </div>

                <h5 class="mb-3">Cronograma de Ações</h5>
                <table class="table-custom">
                    <thead><tr><th>Etapa</th><th>Status</th><th>Data de Registro</th></tr></thead>
                    <tbody>
                        <tr><td>Comunicado via WhatsApp</td><td>${chk(t.whatsapp)}</td><td>${fmt(t.dataWhatsapp)}</td></tr>
                        <tr><td>Comunicado via A.R.</td><td>${chk(t.ar)}</td><td>${fmt(t.dataAr)}</td></tr>
                        <tr><td>Pedido de Demissão</td><td>${chk(t.pedidoDemissao)}</td><td>${fmt(t.dataPedidoDemissao)}</td></tr>
                        <tr><td>Início de Justa Causa</td><td>${chk(t.inicioJustaCausa)}</td><td>${fmt(t.dataInicioJustaCausa)}</td></tr>
                        <tr><td>Justa Causa Executada</td><td>${chk(t.justaCausaExecutada)}</td><td>${fmt(t.dataJustaCausaExecutada)}</td></tr>
                    </tbody>
                </table>

                ${(t.inicioJustaCausa || t.justaCausaExecutada) && t.advogadoParecer ? `
                <div class="advogado-box">
                    <strong><i class="fas fa-gavel"></i> Parecer Jurídico:</strong><br>
                    Advogado Responsável: <strong>${t.advogadoParecer}</strong>
                </div>` : ''}

                <div class="footer">
                    <p>Documento gerado eletronicamente pelo Sistema Nexter em ${new Date().toLocaleString('pt-BR')}.</p>
                </div>
            </body>
            </html>`;
        
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        // win.print(); // Optional auto-print
    } catch (e) { console.error(e); }
}