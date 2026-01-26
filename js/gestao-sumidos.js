// ========================================
// Módulo: Gestão de Sumidos (Absenteísmo Crítico)
// ========================================

async function inicializarGestaoSumidos() {
    console.log("Inicializando Gestão de Sumidos...");
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
                                <th>Tempo Desaparecido (Automático)</th>
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

            html += `
                <tr>
                    <td class="ps-4 fw-bold">${caso.nome}</td>
                    <td>${dataAdmissao ? dataAdmissao.toLocaleDateString('pt-BR') : '-'}</td>
                    <td>${caso.setor || '-'}</td>
                    <td>${dataUltimoPonto ? dataUltimoPonto.toLocaleDateString('pt-BR') : '-'}</td>
                    <td><span class="badge ${badgeClass} fs-6">${tempoDesaparecido} dias</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary" onclick="iniciarTratamentoSumido('${doc.id}', '${caso.nome}')">
                            <i class="fas fa-file-contract me-1"></i> Iniciar Tratamento
                        </button>
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

function iniciarTratamentoSumido(id, nome) {
    // Placeholder para a funcionalidade de tratamento
    alert(`Iniciando protocolo de abandono de emprego para: ${nome}.\n\n(Funcionalidade de envio de telegramas e controle de prazos será implementada na próxima etapa).`);
}