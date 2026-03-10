// =================================================================
// Módulo de Chamados de Manutenção (Separado para evitar erros de persistência)
// =================================================================
console.log("Carregando módulo de chamados de manutenção...");

let __chamados_cache = [];
let __chamados_listener = null;

/**
 * Inicializa a tela de chamados de manutenção.
 */
async function inicializarChamadosManutencao() {
    console.log("Inicializando tela de chamados de manutenção...");
    
    // Configurar datas padrão (Hoje) nos filtros
    const hoje = new Date().toISOString().split('T')[0];
    const inicioInput = document.getElementById('chamados-filtro-data-inicio');
    const fimInput = document.getElementById('chamados-filtro-data-fim');
    if (inicioInput && !inicioInput.value) inicioInput.value = hoje;
    if (fimInput && !fimInput.value) fimInput.value = hoje;

    // Configurar listeners dos botões
    const btnNovo = document.getElementById('btn-novo-chamado');
    if (btnNovo && !btnNovo.bound) {
        btnNovo.addEventListener('click', abrirModalNovoChamado);
        btnNovo.bound = true;
    }
    
    const btnFiltrar = document.getElementById('chamados-btn-filtrar');
    if (btnFiltrar && !btnFiltrar.bound) {
        btnFiltrar.addEventListener('click', renderChamados);
        btnFiltrar.bound = true;
    }

    // Adicionar listener para o formulário de chamado
    const formChamado = document.getElementById('form-chamado-manutencao');
    if (formChamado && !formChamado.bound) {
        formChamado.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            await salvarNovoChamado();
        });
        formChamado.bound = true;
    }

    await renderChamados();
}

/**
 * Renderiza a lista de chamados de manutenção.
 */
async function renderChamados() {
    const container = document.getElementById('chamados-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando chamados...</div>';

    try {
        // Pega os valores dos filtros
        const dataInicio = document.getElementById('chamados-filtro-data-inicio')?.value;
        const dataFim = document.getElementById('chamados-filtro-data-fim')?.value;
        const status = document.getElementById('chamados-filtro-status')?.value;
        const maquinaId = document.getElementById('chamados-filtro-maquina')?.value;

        // Query base - ordenada por data de abertura
        let query = db.collection('manutencao_chamados')
            .orderBy('dataAbertura', 'desc')
            .limit(500);

        const snap = await query.get();
        let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtragem local por data
        if (dataInicio) {
            const dtIni = new Date(dataInicio + 'T00:00:00');
            docs = docs.filter(c => c.dataAbertura && c.dataAbertura.toDate() >= dtIni);
        }
        if (dataFim) {
            const dtFim = new Date(dataFim + 'T23:59:59');
            docs = docs.filter(c => c.dataAbertura && c.dataAbertura.toDate() <= dtFim);
        }

        // Filtragem por status
        if (status) {
            docs = docs.filter(c => c.status === status);
        }

        // Filtragem por máquina
        if (maquinaId) {
            docs = docs.filter(c => c.maquinaId === maquinaId);
        }

        __chamados_cache = docs;

        if (docs.length === 0) {
            container.innerHTML = '<p class="text-muted text-center mt-4">Nenhum chamado encontrado.</p>';
            return;
        }

        // Agrupar por status
        const abertos = docs.filter(c => c.status === 'Aberto' || c.status === 'Em Andamento');
        const concluidos = docs.filter(c => c.status === 'Concluído');
        const cancelados = docs.filter(c => c.status === 'Cancelado');

        let html = '';

        // Cards de resumo
        html += `
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <h3 class="text-primary">${abertos.length}</h3>
                            <p class="mb-0">Abertos/Em Andamento</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-success">
                        <div class="card-body text-center">
                            <h3 class="text-success">${concluidos.length}</h3>
                            <p class="mb-0">Concluídos</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card border-secondary">
                        <div class="card-body text-center">
                            <h3 class="text-secondary">${cancelados.length}</h3>
                            <p class="mb-0">Cancelados</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Tabela de chamados
        html += `
            <div class="table-responsive">
                <table class="table table-sm table-hover align-middle">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th>Status</th>
                            <th>Data</th>
                            <th>Máquina</th>
                            <th>Motivo</th>
                            <th>Prioridade</th>
                            <th>Solicitante</th>
                            <th class="text-end">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        docs.forEach(c => {
            const statusBadge = {
                'Aberto': 'bg-primary',
                'Em Andamento': 'bg-warning text-dark',
                'Concluído': 'bg-success',
                'Cancelado': 'bg-secondary'
            }[c.status] || 'bg-light';

            const prioridadeBadge = c.prioridade === 'Urgente' ? 'bg-danger' : 'bg-info text-dark';
            
            const dataAbertura = c.dataAbertura ? c.dataAbertura.toDate().toLocaleString('pt-BR') : '-';
            const maquinaNome = c.maquinaNome || c.maquinaId || '-';

            html += `
                <tr>
                    <td><span class="badge ${statusBadge}">${c.status || 'Aberto'}</span></td>
                    <td><small>${dataAbertura}</small></td>
                    <td>${maquinaNome}</td>
                    <td>${c.motivo || '-'}</td>
                    <td><span class="badge ${prioridadeBadge}">${c.prioridade || 'Normal'}</span></td>
                    <td>${c.createdByNome || '-'}</td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="visualizarChamado('${c.id}')" title="Visualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${c.status === 'Aberto' ? `
                            <button class="btn btn-outline-warning" onclick="iniciarChamado('${c.id}')" title="Iniciar">
                                <i class="fas fa-play"></i>
                            </button>
                            ` : ''}
                            ${c.status !== 'Concluído' && c.status !== 'Cancelado' ? `
                            <button class="btn btn-outline-success" onclick="concluirChamado('${c.id}')" title="Concluir">
                                <i class="fas fa-check"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao renderizar chamados:", err);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar chamados.</div>';
    }
}

/**
 * Abre o modal para criar um novo chamado.
 */
async function abrirModalNovoChamado() {
    const modalId = 'chamadoManutencaoModal';
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
        console.error("Elemento do modal de chamado não encontrado.");
        return;
    }
    
    // Reseta o formulário
    document.getElementById('form-chamado-manutencao').reset();
    document.getElementById('chamado-id').value = '';
    
    // Preenche a data atual
    const now = new Date();
    document.getElementById('chamado-data').value = now.toISOString().split('T')[0];

    // Restaura título e botão padrão
    modalEl.querySelector('.modal-title').innerHTML = '<i class="fas fa-tools me-2"></i>Novo Chamado de Manutenção';
    modalEl.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-paper-plane me-1"></i> Abrir Chamado';

    // Carregar lista de máquinas
    await popularSelectMaquinas();

    // Mostra o modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Popula o select de máquinas.
 */
async function popularSelectMaquinas() {
    const select = document.getElementById('chamados-maquina');
    if (!select) return;

    // Evita repopular se já tiver opções carregadas
    if (select.options.length > 1) return;

    try {
        const maquinasSnap = await db.collection('maquinas').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione uma máquina</option>';
        
        maquinasSnap.forEach(doc => {
            const maquina = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = maquina.nome || doc.id;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar máquinas:", error);
    }
}

/**
 * Salva um novo chamado de manutenção.
 */
async function salvarNovoChamado() {
    const user = firebase.auth().currentUser;
    if (!user) {
        mostrarMensagem('Sessão expirada. Faça login novamente.', 'error');
        return;
    }

    const chamadoId = document.getElementById('chamado-id').value;
    const maquinaId = document.getElementById('chamados-maquina').value;
    const maquinaNome = document.getElementById('chamados-maquina').options[document.getElementById('chamados-maquina').selectedIndex]?.text;
    const motivo = document.getElementById('chamados-motivo').value;
    const observacoes = document.getElementById('chamados-observacoes').value;
    const maquinaParada = document.getElementById('chamados-maquina-parada')?.checked || false;

    if (!maquinaId || !motivo) {
        mostrarMensagem('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    try {
        const data = {
            maquinaId,
            maquinaNome: maquinaNome || maquinaId,
            motivo,
            observacoes: observacoes || '',
            maquinaParada,
            prioridade: maquinaParada ? 'Urgente' : 'Normal',
            status: 'Aberto',
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user.uid,
            createdByNome: user.displayName || user.email
        };

        if (chamadoId) {
            // Atualização
            data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('manutencao_chamados').doc(chamadoId).update(data);
            mostrarMensagem('Chamado atualizado com sucesso!', 'success');
        } else {
            // Criação
            await db.collection('manutencao_chamados').add(data);
            mostrarMensagem('Chamado aberto com sucesso!', 'success');
        }

        bootstrap.Modal.getInstance(document.getElementById('chamadoManutencaoModal')).hide();
        await renderChamados();

    } catch (err) {
        console.error('Erro ao salvar chamado:', err);
        mostrarMensagem('Falha ao salvar o chamado.', 'error');
    }
}

/**
 * Visualiza os detalhes de um chamado.
 */
async function visualizarChamado(id) {
    try {
        const doc = await db.collection('manutencao_chamados').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Chamado não encontrado.", "error");
            return;
        }
        
        const c = doc.data();
        
        const detalhesHtml = `
            <div class="mb-3">
                <strong>Status:</strong> <span class="badge bg-primary">${c.status}</span><br>
                <strong>Prioridade:</strong> <span class="badge ${c.prioridade === 'Urgente' ? 'bg-danger' : 'bg-info'}">${c.prioridade}</span>
            </div>
            <div class="mb-3">
                <strong>Máquina:</strong> ${c.maquinaNome || c.maquinaId}<br>
                <strong>Data de Abertura:</strong> ${c.dataAbertura ? c.dataAbertura.toDate().toLocaleString('pt-BR') : '-'}
            </div>
            <div class="mb-3">
                <strong>Motivo:</strong><br>${c.motivo}
            </div>
            ${c.observacoes ? `
            <div class="mb-3">
                <strong>Observações:</strong><br>${c.observacoes}
            </div>
            ` : ''}
            <div class="mb-3">
                <strong>Solicitante:</strong> ${c.createdByNome || '-'}
            </div>
            ${c.dataEncerramento ? `
            <div class="mb-3">
                <strong>Data de Encerramento:</strong> ${c.dataEncerramento.toDate().toLocaleString('pt-BR')}
            </div>
            ` : ''}
        `;

        abrirModalGenerico('Detalhes do Chamado', detalhesHtml);

    } catch (err) {
        console.error("Erro ao visualizar chamado:", err);
        mostrarMensagem("Erro ao carregar dados.", "error");
    }
}

/**
 * Inicia um chamado (muda status para Em Andamento).
 */
async function iniciarChamado(id) {
    if (!confirm("Deseja iniciar o atendimento deste chamado?")) return;

    try {
        await db.collection('manutencao_chamados').doc(id).update({
            status: 'Em Andamento',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Chamado iniciado.", "success");
        await renderChamados();
    } catch (err) {
        console.error("Erro ao iniciar chamado:", err);
        mostrarMensagem("Falha ao iniciar o chamado.", "error");
    }
}

/**
 * Conclui um chamado.
 */
async function concluirChamado(id) {
    if (!confirm("Deseja marcar este chamado como concluído?")) return;

    try {
        await db.collection('manutencao_chamados').doc(id).update({
            status: 'Concluído',
            dataEncerramento: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Chamado concluído.", "success");
        await renderChamados();
    } catch (err) {
        console.error("Erro ao concluir chamado:", err);
        mostrarMensagem("Falha ao concluir o chamado.", "error");
    }
}

// Função genérica para abrir modais
function abrirModalGenerico(titulo, corpo) {
    const modalId = 'modalGenerico';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title" id="modalGenericoTitulo"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body" id="modalGenericoCorpo"></div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('modalGenericoTitulo').textContent = titulo;
    document.getElementById('modalGenericoCorpo').innerHTML = corpo;
    new bootstrap.Modal(modalEl).show();
}

// Exporta funções para o escopo global
window.inicializarChamadosManutencao = inicializarChamadosManutencao;
window.abrirModalNovoChamado = abrirModalNovoChamado;
window.salvarNovoChamado = salvarNovoChamado;
window.visualizarChamado = visualizarChamado;
window.iniciarChamado = iniciarChamado;
window.concluirChamado = concluirChamado;
window.renderChamados = renderChamados;

