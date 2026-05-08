// =================================================================
// Módulo de Chamados de Manutenção (Separado para evitar erros de persistência)
// =================================================================
console.log("Carregando módulo de gestão de chamados de manutenção...");

let __chamados_manutencao_cache = []; // Cache para a tela de gestão de chamados
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

        __chamados_manutencao_cache = docs;

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

        // Tabela de chamados (convertido para CARDS mobile-friendly)
        html += '<div class="row g-3">';

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
                <div class="col-md-6 col-lg-4">
                    <div class="card chamado-card h-100 ${c.maquinaParada ? 'border-warning' : ''}">
                        <div class="card-header-custom">
                            <div>
                                <h6 class="m-0 fw-bold text-truncate" style="max-width: 180px;">${maquinaNome}</h6>
                                <small class="text-muted"><i class="fas fa-clock me-1"></i>${dataAbertura}</small>
                            </div>
                            <div>
                                <span class="badge ${statusBadge}">${c.status || 'Aberto'}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-12 mb-2">
                                    <div class="info-label">Motivo</div>
                                    <div class="info-value"><i class="fas fa-tools text-muted me-2"></i>${c.motivo || '-'}</div>
                                </div>
                                <div class="col-6 mb-2">
                                    <div class="info-label">Prioridade</div>
                                    <div class="info-value"><span class="badge ${prioridadeBadge}">${c.prioridade || 'Normal'}</span></div>
                                </div>
                                <div class="col-6 mb-2">
                                    <div class="info-label">Solicitante</div>
                                    <div class="info-value text-truncate">${c.createdByNome || '-'}</div>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer bg-white border-top-0 d-flex justify-content-end gap-2 pt-0 pb-3">
                            <button class="btn btn-sm btn-outline-primary" onclick="visualizarChamado('${c.id}')" title="Visualizar">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${c.status === 'Aberto' ? `
                            <button class="btn btn-sm btn-outline-warning" onclick="iniciarChamado('${c.id}')" title="Iniciar">
                                <i class="fas fa-play"></i> Iniciar
                            </button>
                            ` : ''}
                            ${c.status !== 'Concluído' && c.status !== 'Cancelado' ? `
                            <button class="btn btn-sm btn-success px-3" onclick="concluirChamado('${c.id}')" title="Concluir">
                                <i class="fas fa-check me-1"></i> Concluir
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
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
    
    // Limpa os motivos frequentes da abertura anterior
    const motivosContainer = document.getElementById('chamados-motivos-frequentes');
    if (motivosContainer) motivosContainer.innerHTML = '';
    
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

    try {
        const maquinasSnap = await db.collection('maquinas').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione uma máquina</option>';
        
        maquinasSnap.forEach(doc => {
            const maquina = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = maquina.nome || doc.id;
            // Armazena os motivos como atributo data para uso no onchange
            option.dataset.motivos = JSON.stringify(maquina.motivos || []);
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar máquinas:", error);
    }
}

/**
 * Exibe os motivos frequentes da máquina selecionada.
 * Chamada via onchange no select de máquinas.
 */
function exibirMotivosFrequentes(selectEl) {
    const motivosContainer = document.getElementById('chamados-motivos-frequentes');
    if (!motivosContainer) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    let motivos = [];
    try {
        motivos = selectedOption ? JSON.parse(selectedOption.dataset.motivos || '[]') : [];
    } catch(e) { motivos = []; }

    if (motivos.length > 0) {
        let html = '<div class="d-flex flex-wrap gap-2 mb-1">';
        motivos.forEach(motivo => {
            // Usa data-motivo para evitar problemas com aspas no onclick
            html += `<button type="button" class="btn btn-sm btn-outline-secondary" data-motivo="${motivo.replace(/"/g, '&quot;')}" onclick="document.getElementById('chamados-motivo').value=this.dataset.motivo">${motivo}</button>`;
        });
        html += '</div><small class="text-muted">Clique para preencher o motivo automaticamente.</small>';
        motivosContainer.innerHTML = html;
    } else {
        motivosContainer.innerHTML = '<small class="text-muted fst-italic">Nenhum motivo frequente cadastrado para esta máquina.</small>';
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
    const motivo = document.getElementById('chamados-motivo').value;
    const observacoes = document.getElementById('chamados-observacoes').value;
    const maquinaParada = document.getElementById('chamados-maquina-parada')?.checked || false;

    if (!maquinaId || !motivo) {
        mostrarMensagem('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    try {
        // Garante que o nome da máquina seja buscado do banco de dados para evitar salvar o ID no lugar do nome.
        let maquinaNomeFinal = maquinaId; // Fallback para o ID
        if (maquinaId) {
            try {
                const maquinaDoc = await db.collection('maquinas').doc(maquinaId).get();
                if (maquinaDoc.exists && maquinaDoc.data().nome) {
                    maquinaNomeFinal = maquinaDoc.data().nome;
                }
            } catch (dbError) {
                console.error("Erro ao buscar nome da máquina, usando ID como fallback:", dbError);
            }
        }

        const data = {
            maquinaId,
            maquinaNome: maquinaNomeFinal,
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
 * Conclui um chamado (abre o modal).
 */
async function concluirChamado(id) {
    const chamado = __chamados_manutencao_cache.find(c => c.id === id);
    if (!chamado) {
        mostrarMensagem("Chamado não encontrado no cache.", "error");
        return;
    }

    document.getElementById('finalizar-mec-id').value = id;
    document.getElementById('finalizar-mec-maquina-id').value = chamado.maquinaId || '';
    document.getElementById('finalizar-mec-tipo').value = '';
    document.getElementById('finalizar-mec-obs').value = '';

    const selectMotivo = document.getElementById('finalizar-mec-motivo');
    selectMotivo.innerHTML = '<option value="">Carregando...</option>';

    try {
        if (chamado.maquinaId) {
            const maqDoc = await db.collection('maquinas').doc(chamado.maquinaId).get();
            if (maqDoc.exists && maqDoc.data().motivos && maqDoc.data().motivos.length > 0) {
                let options = '<option value="">Selecione o motivo...</option>';
                maqDoc.data().motivos.forEach(m => {
                    options += `<option value="${m}">${m}</option>`;
                });
                options += '<option value="Outro">Outro (descrever nas observações)</option>';
                selectMotivo.innerHTML = options;
            } else {
                selectMotivo.innerHTML = '<option value="Outro">Sem motivos cadastrados (descreva abaixo)</option>';
                selectMotivo.value = 'Outro';
            }
        } else {
            selectMotivo.innerHTML = '<option value="Outro">Máquina não informada (descreva abaixo)</option>';
            selectMotivo.value = 'Outro';
        }
    } catch (e) {
        console.error('Erro ao buscar motivos', e);
        selectMotivo.innerHTML = '<option value="Outro">Erro ao carregar motivos</option>';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalFinalizarChamadoMec'));
    modal.show();
}

/**
 * Confirma a conclusão de um chamado via Modal.
 */
async function confirmarConcluirChamado() {
    const chamadoId = document.getElementById('finalizar-mec-id').value;
    const tipo = document.getElementById('finalizar-mec-tipo').value;
    const motivo = document.getElementById('finalizar-mec-motivo').value;
    const obs = document.getElementById('finalizar-mec-obs').value;

    if (!tipo || !motivo || !obs) {
        mostrarMensagem('Preencha todos os campos obrigatórios!', 'warning');
        return;
    }

    const chamado = __chamados_manutencao_cache.find(c => c.id === chamadoId);
    if (!chamado) return;

    try {
        const dataEncerramento = new Date();
        let tempoParada = null;

        if (chamado.paradaInicioTimestamp) {
            const inicio = chamado.paradaInicioTimestamp.toDate();
            const diffMs = dataEncerramento - inicio;
            const horas = Math.floor(diffMs / 3600000);
            const mins = Math.floor((diffMs % 3600000) / 60000);
            tempoParada = `${horas}h ${mins}m`;
        }

        const btn = document.querySelector('#modalFinalizarChamadoMec .btn-success');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

        await db.collection('manutencao_chamados').doc(chamadoId).update({
            status: 'Concluído',
            maquinaParada: false,
            dataEncerramento: dataEncerramento,
            tempoParada: tempoParada,
            tipoManutencao: tipo,
            motivoManutencao: motivo,
            observacoesMecanico: obs,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Chamado concluído.", "success");
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinalizarChamadoMec'));
        if (modal) modal.hide();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i> Salvar e Finalizar';

        await renderChamados();
    } catch (err) {
        console.error("Erro ao concluir chamado:", err);
        mostrarMensagem("Falha ao concluir o chamado.", "error");
        
        const btn = document.querySelector('#modalFinalizarChamadoMec .btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save me-2"></i> Salvar e Finalizar';
        }
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
window.confirmarConcluirChamado = confirmarConcluirChamado;
window.renderChamados = renderChamados;
window.exibirMotivosFrequentes = exibirMotivosFrequentes;
