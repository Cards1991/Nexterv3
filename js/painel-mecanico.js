/**
 * Lógica do Painel do Mecânico (Portado para Desktop)
 */
// Variável global para o filtro atual
if (typeof window.__filtro_mecanico_atual === 'undefined') {
    window.__filtro_mecanico_atual = 'meus';
}
async function inicializarPainelMecanico() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Cleanup de listener antigo para evitar vazamento de memória
    if (window.__unsubscribe_mecanico) {
        window.__unsubscribe_mecanico();
        window.__unsubscribe_mecanico = null;
    }

    document.getElementById('mecanico-user-info').textContent = `Mecânico: ${user.displayName || user.email}`;

    // Configurar Cliques nos Filtros
    document.querySelectorAll('.filter-tabs-mecanico .filter-tab-mecanico').forEach(tab => {
        tab.onclick = function() {
            document.querySelector('.filter-tab-mecanico.active').classList.remove('active');
            this.classList.add('active');
            window.__filtro_mecanico_atual = this.dataset.filter;
            carregarChamadosMecanico();
        };
    });

    carregarChamadosMecanico();
}

function carregarChamadosMecanico() {
    // Cache usado pelos modais (Detalhes / Finalizar)
    window.__chamados_cache = [];

    const container = document.getElementById('lista-chamados-mecanico');
    const user = firebase.auth().currentUser;
    if (!user) return; // Garante que o usuário esteja logado

    container.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Sincronizando seus chamados...</p></div>';

    // Usamos onSnapshot para ser "formarápida" (tempo real)
    window.__unsubscribe_mecanico = db.collection('manutencao_chamados')
        .orderBy('dataAbertura', 'desc')
        .limit(100)
        .onSnapshot(snap => {
            let chamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // ✅ Sincroniza o cache global para que os botões "Ver" e "Finalizar" funcionem
            window.__chamados_cache = chamados;
            
            // Atualizar Stats Globais (Visíveis para o mecânico)
            document.getElementById('mec-stat-abertos').textContent = chamados.filter(c => c.status === 'Aberto' && c.mecanicoResponsavelId === user.uid).length;
            document.getElementById('mec-stat-andamento').textContent = chamados.filter(c => c.status === 'Em Andamento').length;
            document.getElementById('mec-stat-urgentes').textContent = chamados.filter(c => (c.prioridade === 'Urgente' || c.maquinaParada) && c.status !== 'Concluído').length;

            // FILTRAGEM: Apenas designados ao mecânico logado (UID)
            const filtro = window.__filtro_mecanico_atual || 'meus';
            if (filtro === 'meus') {
                // Traz apenas o que é dele e não está concluído
                chamados = chamados.filter(c => c.mecanicoResponsavelId === user.uid && c.status !== 'Concluído');
            } else if (filtro === 'abertos') {
                // Traz o que está disponível para qualquer um pegar (sem responsável)
                chamados = chamados.filter(c => c.status === 'Aberto');
            } else if (filtro === 'concluidos') {
                // Histórico dele
                chamados = chamados.filter(c => c.mecanicoResponsavelId === user.uid && c.status === 'Concluído');
            }

            if (chamados.length === 0) {
                container.innerHTML = '<div class="col-12 text-center p-5 text-muted"><i class="fas fa-check-circle fa-3x mb-3 opacity-25"></i><p>Nenhum chamado nesta categoria.</p></div>';
                return;
            }

            container.innerHTML = chamados.map(c => {
                return buildChamadoCard(c, user.uid);
            }).join('');
        }, error => {
            console.error("Erro no listener:", error);
            container.innerHTML = '<div class="alert alert-danger">Erro de conexão.</div>';
        });
}
/**
 * Constrói o HTML para um card de chamado de manutenção.
 * @param {object} c - Dados do chamado.
 * @param {string} currentUserId - UID do usuário logado para verificar responsabilidade.
 * @returns {string} HTML do card.
 */
function buildChamadoCard(c, currentUserId) {
    const abertura = c.dataAbertura?.toDate ? c.dataAbertura.toDate().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '--';

    const statusBadgeClass = c.status === 'Aberto'
        ? 'bg-danger'
        : c.status === 'Em Andamento'
        ? 'bg-info'
        : 'bg-success';
    const statusBadgeText = c.status;

    const prioCls = c.prioridade === 'Urgente' ? 'prio-urgente' : c.prioridade === 'Prioritário' ? 'prio-prioritario' : 'prio-normal';
    const prioBadge = `<span class="badge-prioridade ${prioCls}">${c.prioridade || 'Normal'}</span>`;

    const cardClass = c.prioridade === 'Urgente' ? 'mecanico-card urgente' : c.maquinaParada ? 'mecanico-card parada' : 'mecanico-card';

    const paradaAlert = (c.maquinaParada && c.status !== 'Concluído')
        ? `<div class="card-parada-alert"><i class="fas fa-exclamation-triangle"></i> Máquina parada — atendimento urgente!</div>` : '';

    // Tempo de parada em andamento
    let tempoParada = '';
    if (c.maquinaParada && c.status !== 'Concluído' && c.paradaInicioTimestamp) {
        const inicio = c.paradaInicioTimestamp.toDate();
        const diff = new Date() - inicio;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        tempoParada = `<span><i class="fas fa-stopwatch"></i> Parado: ${h}h ${m}m</span>`;
    } else if (c.tempoParada) {
        tempoParada = `<span><i class="fas fa-stopwatch"></i> ${c.tempoParada}</span>`;
    }

    // Botões de ação
    let actions = `<button class="btn-action btn-detalhe" onclick="abrirModalDetalhes('${c.id}')"><i class="fas fa-eye"></i> Ver</button>`;
    if (c.status === 'Aberto' && (!c.mecanicoResponsavelId || c.mecanicoResponsavelId === currentUserId)) {
        actions += `<button class="btn-action btn-iniciar" onclick="abrirModalIniciarAtendimento('${c.id}')"><i class="fas fa-play-circle"></i> Iniciar</button>`;
    } else if (c.status === 'Em Andamento' && c.mecanicoResponsavelId === currentUserId) {
        actions += `<button class="btn-action btn-finalizar" onclick="abrirModalFinalizarChamado('${c.id}')"><i class="fas fa-check-circle"></i> Finalizar</button>`;
    }

    return `
        <div class="col-md-6 col-xl-4 mb-3 animate__animated animate__fadeIn">
            <div class="${cardClass}">
                <div class="card-header-row">
                    <div>
                        <div class="maquina-nome">${c.maquinaNome || c.maquinaId || 'Máquina'}</div>
                        <div class="maquina-setor">${abertura}</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                        <span class="mecanico-badge-status ${statusBadgeClass}">${statusBadgeText}</span>
                        ${prioBadge}
                    </div>
                </div>
                <div class="card-motivo"><i class="fas fa-tools" style="color:var(--cor-muted);margin-right:6px;"></i>${c.motivo || '-'}</div>
                ${paradaAlert}
                <div class="card-meta">
                    <span><i class="fas fa-calendar"></i> ${abertura}</span>
                    ${tempoParada}
                    ${c.origem ? `<span><i class="fas fa-qrcode"></i> ${c.origem}</span>` : ''}
                </div>
                <div class="card-actions">${actions}</div>
            </div>
        </div>`;
}

/**
 * Abre o modal para iniciar o atendimento de um chamado.
 * @param {string} chamadoId - ID do chamado a ser iniciado.
 */
function abrirModalIniciarAtendimento(chamadoId) {
    let modalEl = document.getElementById('modalMecanicoIniciar');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalMecanicoIniciar';
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-play-circle me-2"></i>Iniciar Atendimento</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="iniciar-id">
                        <div class="mb-3">
                            <label class="form-label">Observações Iniciais</label>
                            <textarea class="form-control" id="iniciar-obs" rows="3" placeholder="Ex: Buscando ferramentas, aguardando peça..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-confirmar-iniciar" onclick="confirmarInicioAtendimentoMecanico()">
                            Confirmar Início
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    document.getElementById('iniciar-id').value = chamadoId;
    document.getElementById('iniciar-obs').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalMecanicoIniciar'));
    modal.show();
}

/**
 * Confirma o início do atendimento, atualizando o status do chamado no Firestore.
 */
async function confirmarInicioAtendimentoMecanico() {
    const iniciarIdEl = document.getElementById('iniciar-id');
    const iniciarObsEl = document.getElementById('iniciar-obs');
    const btn = document.getElementById('btn-confirmar-iniciar');

    // Evita crash quando o modal não está presente (ex: carregamento dinâmico/rota diferente)
    // Observação: o modal deveria existir em `views/painel-mecanico.html`. Ainda assim, não podemos falhar com null.
    if (!iniciarIdEl || !iniciarObsEl) {
        console.warn('[PainelMecanico] Elementos do modal iniciar não encontrados.');
        // Sem o modal, não é possível executar o update do chamado.
        return;
    }

    if (!btn) {
        mostrarMensagem('Botão de confirmação não encontrado. Recarregue e tente novamente.', 'warning');
        return;
    }

    const chamadoId = iniciarIdEl.value;
    const obs = (iniciarObsEl.value || '').trim();
    const user = firebase.auth().currentUser;

    if (!chamadoId) {
        mostrarMensagem('Chamado inválido (ID não encontrado).', 'warning');
        return;
    }
    if (!user) {
        mostrarMensagem('Você precisa estar logado para iniciar o atendimento.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';


    try {
        await db.collection('manutencao_chamados').doc(chamadoId).update({
            status: 'Em Andamento',
            mecanicoResponsavelId: user.uid,
            mecanicoResponsavelNome: user.displayName || user.email,
            atendimentoIniciadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            observacoesInicio: obs // Salva a observação inicial
        });
        mostrarMensagem("Atendimento iniciado com sucesso!", "success");
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalMecanicoIniciar'));
        if (modal) modal.hide();
        carregarChamadosMecanico(); // Recarrega a lista para atualizar o card
    } catch (e) {
        mostrarMensagem("Erro ao iniciar atendimento.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play-circle"></i> Confirmar Início';
    }
}

/**
 * Abre o modal para finalizar um chamado.
 * @param {string} chamadoId - ID do chamado a ser finalizado.
 */
async function abrirModalFinalizarChamado(chamadoId) {
    let modalEl = document.getElementById('modalMecanicoFinalizar');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalMecanicoFinalizar';
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title"><i class="fas fa-check-circle me-2"></i>Finalizar Chamado</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="finalizar-id">
                        <input type="hidden" id="finalizar-maquina-id">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Tipo de Manutenção *</label>
                                <select class="form-select" id="finalizar-tipo" required>
                                    <option value="">Selecione...</option>
                                    <option>Corretiva</option><option>Preventiva</option><option>Ajuste</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Motivo Constatado *</label>
                                <select class="form-select" id="finalizar-motivo" required></select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Serviço Realizado *</label>
                            <textarea class="form-control" id="finalizar-obs" rows="3" required></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Peças Utilizadas</label>
                            <input type="text" class="form-control" id="finalizar-pecas">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" id="btn-confirmar-finalizar" onclick="confirmarFinalizarChamado()">Finalizar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }

    document.getElementById('finalizar-id').value = chamadoId;
    const chamado = __chamados_cache.find(c => c.id === chamadoId);
    if (!chamado) return;

    document.getElementById('finalizar-maquina-id').value = chamado.maquinaId;
    document.getElementById('finalizar-tipo').value = '';
    document.getElementById('finalizar-obs').value = '';
    document.getElementById('finalizar-pecas').value = '';

    // Carregar motivos da máquina
    const motivoSel = document.getElementById('finalizar-motivo');
    motivoSel.innerHTML = '<option value="">Carregando motivos...</option>';
    try {
        const maqDoc = await db.collection('maquinas').doc(chamado.maquinaId).get();
        if (maqDoc.exists) {
            const motivos = maqDoc.data().motivos || [];
            if (motivos.length > 0) {
                motivoSel.innerHTML = '<option value="">Selecione o motivo...</option>';
                motivos.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m; opt.textContent = m;
                    motivoSel.appendChild(opt);
                });
                const outro = document.createElement('option');
                outro.value = '__outro__'; outro.textContent = 'Outro (descrever nas observações)';
                motivoSel.appendChild(outro);
            } else {
                motivoSel.innerHTML = '<option value="__outro__">Sem motivos cadastrados — descreva nas observações</option>';
            }
        } else {
            motivoSel.innerHTML = '<option value="__outro__">Máquina não encontrada — descreva nas observações</option>';
        }
    } catch (e) {
        motivoSel.innerHTML = '<option value="__outro__">Erro ao carregar — descreva nas observações</option>';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalMecanicoFinalizar'));
    modal.show();
}

/**
 * Confirma a finalização do chamado, atualizando o status e registrando os detalhes.
 */
async function confirmarFinalizarChamado() {
    const chamadoId = document.getElementById('finalizar-id').value;
    const tipo = document.getElementById('finalizar-tipo').value;
    const obs = document.getElementById('finalizar-obs').value.trim();
    const pecas = document.getElementById('finalizar-pecas').value.trim();
    const motivoVal = document.getElementById('finalizar-motivo').value;
    const motivoManutencao = (motivoVal && motivoVal !== '__outro__') ? motivoVal : null;
    const user = firebase.auth().currentUser;
    const btn = document.getElementById('btn-confirmar-finalizar');

    if (!tipo) { mostrarMensagem('Selecione o tipo de manutenção.', 'warning'); return; }
    if (!motivoManutencao) { mostrarMensagem('Selecione o motivo da manutenção.', 'warning'); return; }
    if (!obs) { mostrarMensagem('Descreva o serviço realizado.', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';

    try {
        const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
        const chamadoData = chamadoDoc.data();
        const dataEncerramento = new Date();
        let tempoParada = null;

        if (chamadoData.paradaInicioTimestamp) {
            const inicio = chamadoData.paradaInicioTimestamp.toDate();
            const diffMs = dataEncerramento - inicio;
            const h = Math.floor(diffMs / 3600000);
            const m = Math.floor((diffMs % 3600000) / 60000);
            tempoParada = `${h}h ${m}m`;
        }

        await db.collection('manutencao_chamados').doc(chamadoId).update({
            status: 'Concluído',
            maquinaParada: false,
            dataEncerramento,
            tempoParada,
            tipoManutencao: tipo,
            motivoManutencao,
            observacoesMecanico: obs,
            pecasUtilizadas: pecas,
            encerradoPor: user.uid,
            encerradoPorNome: user.displayName || user.email
        });

        mostrarMensagem('Chamado finalizado com sucesso! ✅', 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalMecanicoFinalizar'));
        if (modal) modal.hide();
        carregarChamadosMecanico(); // Recarrega a lista para atualizar o card
    } catch (e) {
        console.error('Erro ao finalizar:', e);
        mostrarMensagem('Erro ao finalizar chamado. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Finalizar Chamado';
    }
}

/**
 * Abre o modal para visualizar os detalhes de um chamado.
 * @param {string} chamadoId - ID do chamado a ser visualizado.
 */
function abrirModalDetalhes(chamadoId) {
    let modalEl = document.getElementById('modalMecanicoDetalhes');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalMecanicoDetalhes';
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Chamado</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }

    const c = __chamados_cache.find(x => x.id === chamadoId);
    if (!c) return;

    const abertura = c.dataAbertura?.toDate ? c.dataAbertura.toDate().toLocaleString('pt-BR') : '--';
    const encerramento = c.dataEncerramento?.toDate ? c.dataEncerramento.toDate().toLocaleString('pt-BR') : 'Pendente';

    const detalheContent = document.getElementById('modalMecanicoDetalhes').querySelector('.modal-body');
    if (detalheContent) {
        detalheContent.innerHTML = `
            <div class="row mb-2">
                <div class="col-md-6"><p class="mb-1"><strong>Máquina:</strong> ${c.maquinaNome || '--'}</p></div>
                <div class="col-md-6"><p class="mb-1"><strong>ID Máquina:</strong> ${c.maquinaId || '--'}</p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Status:</strong> <span class="mecanico-badge-status ${c.status === 'Aberto' ? 'bg-danger' : (c.status === 'Em Andamento' ? 'bg-info' : 'bg-success')}">${c.status || '--'}</span></p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Prioridade:</strong> <span class="badge-prioridade ${c.prioridade === 'Urgente' ? 'prio-urgente' : c.prioridade === 'Prioritário' ? 'prio-prioritario' : 'prio-normal'}">${c.prioridade || 'Normal'}</span></p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Abertura:</strong> ${abertura}</p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Encerramento:</strong> ${encerramento}</p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Tempo de Parada:</strong> ${c.tempoParada || 'N/A'}</p></div>
                <div class="col-md-6"><p class="mb-1"><strong>Tipo Manutenção:</strong> ${c.tipoManutencao || 'N/A'}</p></div>
            </div>
            <hr>
            <p class="mb-1"><strong>Motivo da Abertura:</strong> ${c.motivo || '--'}</p>
            <p class="mb-1"><strong>Observações Iniciais:</strong> ${c.observacoes || 'N/A'}</p>
            <p class="mb-1"><strong>Serviço Realizado:</strong> ${c.observacoesMecanico || 'N/A'}</p>
            <p class="mb-1"><strong>Peças Utilizadas:</strong> ${c.pecasUtilizadas || 'N/A'}</p>
            <hr>
            <p class="mb-1 small text-muted"><strong>Solicitante:</strong> ${c.createdByNome || 'N/A'}</p>
            <p class="mb-1 small text-muted"><strong>Mecânico Responsável:</strong> ${c.mecanicoResponsavelNome || 'N/A'}</p>
            <p class="mb-0 small text-muted"><strong>ID Chamado:</strong> ${c.id}</p>
        `;
    }
    const modal = new bootstrap.Modal(document.getElementById('modalMecanicoDetalhes'));
    modal.show();
}

// Expor para o escopo global do app.js
window.inicializarPainelMecanico = inicializarPainelMecanico;
window.abrirModalIniciarAtendimento = abrirModalIniciarAtendimento;
window.confirmarInicioAtendimentoMecanico = confirmarInicioAtendimentoMecanico;
window.abrirModalFinalizarChamado = abrirModalFinalizarChamado;
window.confirmarFinalizarChamado = confirmarFinalizarChamado;
window.abrirModalDetalhes = abrirModalDetalhes;