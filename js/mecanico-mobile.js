/**
 * mecanico-mobile.js
 * Painel mobile dedicado ao mecânico responsável.
 * Fluxo: Login → exibe apenas chamados onde mecanicoResponsavelId === uid do usuário logado.
 */

let _unsubscribe = null;
let _todosOsMeusChamados = [];
let _filtroAtivo = 'ativos'; // 'ativos' | 'todos' | 'concluidos'
let _currentUser = null;
let _currentUserNome = '';

// ============================================================
// BOOTSTRAP: espera Firebase mobile pronto
// ============================================================
document.addEventListener('firebaseMobileReady', () => {
    if (!firebase.apps.length || typeof auth === 'undefined') {
        mostrarToast('Erro crítico de conexão. Recarregue a página.', 'error');
        return;
    }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                await user.getIdToken(true);
                _currentUser = user;

                // Verificar se é mecânico via coleção 'usuarios'
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                const isMecanico = userDoc.exists && (userDoc.data().isMecanico || false);
                const isMecanicoAdmin = userDoc.exists && (userDoc.data().isMecanicoAdmin || false);

                // Busca nome real: tenta doc 'funcionarios' cujo ID = UID do Auth
                // (padrão do sistema: funcionários promovidos a mecânico mantêm o mesmo doc ID)
                try {
                    const funcDoc = await db.collection('funcionarios').doc(user.uid).get();
                    if (funcDoc.exists) {
                        _currentUserNome = funcDoc.data().nome || user.displayName || user.email;
                    } else {
                        // Fallback: busca por campo uid (mecânicos criados manualmente com add())
                        const funcSnap = await db.collection('funcionarios')
                            .where('isMecanico', '==', true).get();
                        const match = funcSnap.docs.find(d => d.data().email === user.email || d.data().uid === user.uid);
                        _currentUserNome = match ? match.data().nome : (user.displayName || user.email);
                    }
                } catch (e) {
                    _currentUserNome = user.displayName || user.email;
                }

                if (!isMecanico && !isMecanicoAdmin) {
                    mostrarToast('Acesso restrito a mecânicos.', 'error');
                    setTimeout(() => auth.signOut(), 2000);
                    return;
                }

                mostrarApp();
            } catch (e) {
                console.error('Erro de autenticação:', e);
                mostrarToast('Erro de autenticação. Faça login novamente.', 'error');
                auth.signOut();
            }
        } else {
            _currentUser = null;
            if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
            mostrarLogin();
        }
    });

    // LOGIN FORM
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;
        const btn = document.getElementById('btn-login');
        const erro = document.getElementById('login-erro');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        erro.classList.add('d-none');

        try {
            await auth.signInWithEmailAndPassword(email, senha);
        } catch (err) {
            console.error('Login falhou:', err);
            erro.textContent = 'E-mail ou senha inválidos.';
            erro.classList.remove('d-none');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    });

    // LOGOUT
    document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

    // FILTRO TABS
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            _filtroAtivo = tab.dataset.filter;
            renderizarChamados();
        });
    });

    // AÇÃO: Iniciar atendimento
    document.getElementById('btn-confirmar-iniciar').addEventListener('click', confirmarInicioAtendimento);

    // AÇÃO: Finalizar chamado
    document.getElementById('btn-confirmar-finalizar').addEventListener('click', confirmarFinalizarChamado);

    // Fechar sheet clicando fora
    document.querySelectorAll('.sheet-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) fecharSheet(overlay.id);
        });
    });
});

// ============================================================
// UI: Login / App
// ============================================================
function mostrarLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
}

function mostrarApp() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';

    // Preencher topbar
    const nome = _currentUserNome;
    document.getElementById('user-nome').textContent = nome;
    document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();

    inicializarChamados();
}

// ============================================================
// CHAMADOS: listener em tempo real
// ============================================================
function inicializarChamados() {
    if (_unsubscribe) _unsubscribe();

    const lista = document.getElementById('lista-chamados');
    lista.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin me-2"></i> Carregando seus chamados...</div>';

    _unsubscribe = db.collection('manutencao_chamados')
        .where('mecanicoResponsavelId', '==', _currentUser.uid)
        .orderBy('dataAbertura', 'desc')
        .onSnapshot(snap => {
            _todosOsMeusChamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            atualizarStats();
            renderizarChamados();
        }, err => {
            console.error('Erro ao carregar chamados:', err);
            lista.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar chamados.<br>Verifique sua conexão.</p></div>';
        });
}

function atualizarStats() {
    const abertos  = _todosOsMeusChamados.filter(c => c.status === 'Aberto').length;
    const andamento = _todosOsMeusChamados.filter(c => c.status === 'Em Andamento').length;
    const urgentes = _todosOsMeusChamados.filter(c => c.prioridade === 'Urgente' && c.status !== 'Concluído').length;
    document.getElementById('stat-abertos').textContent = abertos;
    document.getElementById('stat-andamento').textContent = andamento;
    document.getElementById('stat-urgentes').textContent = urgentes;
}

function renderizarChamados() {
    const lista = document.getElementById('lista-chamados');

    let chamados = [..._todosOsMeusChamados];
    if (_filtroAtivo === 'ativos') {
        chamados = chamados.filter(c => c.status !== 'Concluído');
    } else if (_filtroAtivo === 'concluidos') {
        chamados = chamados.filter(c => c.status === 'Concluído');
    }

    // Ordenar: urgentes + parados primeiro
    const prioVal = { 'Urgente': 0, 'Prioritário': 1, 'Normal': 2 };
    chamados.sort((a, b) => {
        if (a.maquinaParada && !b.maquinaParada) return -1;
        if (!a.maquinaParada && b.maquinaParada) return 1;
        return (prioVal[a.prioridade] ?? 2) - (prioVal[b.prioridade] ?? 2);
    });

    if (chamados.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-double"></i>
                <p>Nenhum chamado ${_filtroAtivo === 'ativos' ? 'ativo' : _filtroAtivo === 'concluidos' ? 'concluído' : ''} atribuído a você.</p>
            </div>`;
        return;
    }

    lista.innerHTML = chamados.map(c => buildChamadoCard(c)).join('');
}

function buildChamadoCard(c) {
    const abertura = c.dataAbertura?.toDate ? c.dataAbertura.toDate().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '--';

    const statusBadge = c.status === 'Aberto'
        ? '<span class="badge-status badge-aberto">Aberto</span>'
        : c.status === 'Em Andamento'
        ? '<span class="badge-status badge-andamento">Em Andamento</span>'
        : '<span class="badge-status badge-concluido">Concluído</span>';

    const prioCls = c.prioridade === 'Urgente' ? 'prio-urgente' : c.prioridade === 'Prioritário' ? 'prio-prioritario' : 'prio-normal';
    const prioBadge = `<span class="badge-prioridade ${prioCls}">${c.prioridade || 'Normal'}</span>`;

    const cardClass = c.prioridade === 'Urgente' ? 'chamado-card urgente' : c.maquinaParada ? 'chamado-card parada' : 'chamado-card';

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
    let actions = `<button class="btn-action btn-detalhe" onclick="abrirDetalhes('${c.id}')"><i class="fas fa-eye"></i> Ver</button>`;
    if (c.status === 'Aberto') {
        actions += `<button class="btn-action btn-iniciar" onclick="abrirSheetIniciar('${c.id}')"><i class="fas fa-play-circle"></i> Iniciar</button>`;
    } else if (c.status === 'Em Andamento') {
        actions += `<button class="btn-action btn-finalizar" onclick="abrirSheetFinalizar('${c.id}','${c.maquinaId}')"><i class="fas fa-check-circle"></i> Finalizar</button>`;
    }

    return `
        <div class="${cardClass}">
            <div class="card-header-row">
                <div>
                    <div class="maquina-nome">${c.maquinaNome || c.maquinaId || 'Máquina'}</div>
                    <div class="maquina-setor">${abertura}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                    ${statusBadge}
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
        </div>`;
}

// ============================================================
// SHEETS
// ============================================================
function fecharSheet(id) {
    document.getElementById(id).classList.remove('open');
}

// --- DETALHES ---
function abrirDetalhes(chamadoId) {
    const c = _todosOsMeusChamados.find(x => x.id === chamadoId);
    if (!c) return;

    const abertura = c.dataAbertura?.toDate ? c.dataAbertura.toDate().toLocaleString('pt-BR') : '--';
    const encerramento = c.dataEncerramento?.toDate ? c.dataEncerramento.toDate().toLocaleString('pt-BR') : 'Pendente';

    document.getElementById('detalhe-content').innerHTML = `
        <div class="detail-row"><span class="detail-label">Máquina</span><span class="detail-value">${c.maquinaNome || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Motivo Abertura</span><span class="detail-value">${c.motivo || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${c.status || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Prioridade</span><span class="detail-value">${c.prioridade || 'Normal'}</span></div>
        <div class="detail-row"><span class="detail-label">Abertura</span><span class="detail-value">${abertura}</span></div>
        <div class="detail-row"><span class="detail-label">Encerramento</span><span class="detail-value">${encerramento}</span></div>
        ${c.tempoParada ? `<div class="detail-row"><span class="detail-label">Tempo de Parada</span><span class="detail-value">${c.tempoParada}</span></div>` : ''}
        ${c.tipoManutencao ? `<div class="detail-row"><span class="detail-label">Tipo Manutenção</span><span class="detail-value">${c.tipoManutencao}</span></div>` : ''}
        ${c.motivoManutencao ? `<div class="detail-row"><span class="detail-label">Motivo Manutenção</span><span class="detail-value">${c.motivoManutencao}</span></div>` : ''}
        ${c.observacoes ? `<div class="detail-row"><span class="detail-label">Observações</span><span class="detail-value" style="max-width:70%">${c.observacoes}</span></div>` : ''}
        ${c.observacoesMecanico ? `<div class="detail-row"><span class="detail-label">Serviço realizado</span><span class="detail-value" style="max-width:70%">${c.observacoesMecanico}</span></div>` : ''}
        ${c.pecasUtilizadas ? `<div class="detail-row"><span class="detail-label">Peças Utilizadas</span><span class="detail-value" style="max-width:70%">${c.pecasUtilizadas}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Origem</span><span class="detail-value">${c.origem || 'Sistema'}</span></div>
        <div class="detail-row"><span class="detail-label">ID Chamado</span><span class="detail-value" style="font-size:0.75rem;color:var(--cor-muted)">${c.id}</span></div>
    `;
    document.getElementById('sheet-detalhes').classList.add('open');
}

// --- INICIAR ---
function abrirSheetIniciar(chamadoId) {
    document.getElementById('iniciar-id').value = chamadoId;
    document.getElementById('iniciar-obs').value = '';
    document.getElementById('sheet-iniciar').classList.add('open');
}

async function confirmarInicioAtendimento() {
    const chamadoId = document.getElementById('iniciar-id').value;
    const obs = document.getElementById('iniciar-obs').value.trim();
    const btn = document.getElementById('btn-confirmar-iniciar');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    try {
        const updateData = {
            status: 'Em Andamento',
            atendimentoIniciadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            mecanicoResponsavelId: _currentUser.uid,
            mecanicoResponsavelNome: _currentUserNome
        };
        if (obs) updateData.observacoesInicio = obs;

        await db.collection('manutencao_chamados').doc(chamadoId).update(updateData);
        mostrarToast('Atendimento iniciado!', 'success');
        fecharSheet('sheet-iniciar');
    } catch (e) {
        console.error('Erro ao iniciar:', e);
        mostrarToast('Erro ao iniciar atendimento.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play-circle"></i> Confirmar Início';
    }
}

// --- FINALIZAR ---
async function abrirSheetFinalizar(chamadoId, maquinaId) {
    document.getElementById('finalizar-id').value = chamadoId;
    document.getElementById('finalizar-maquina-id').value = maquinaId;
    document.getElementById('finalizar-tipo').value = '';
    document.getElementById('finalizar-obs').value = '';

    // Carregar motivos da máquina
    const motivoSel = document.getElementById('finalizar-motivo');
    motivoSel.innerHTML = '<option value="">Carregando motivos...</option>';
    try {
        if (maquinaId) {
            const maqDoc = await db.collection('maquinas').doc(maquinaId).get();
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
        } else {
            motivoSel.innerHTML = '<option value="__outro__">Sem máquina — descreva nas observações</option>';
        }
    } catch (e) {
        motivoSel.innerHTML = '<option value="__outro__">Erro ao carregar — descreva nas observações</option>';
    }

    document.getElementById('sheet-finalizar').classList.add('open');
}

async function confirmarFinalizarChamado() {
    const chamadoId = document.getElementById('finalizar-id').value;
    const tipo = document.getElementById('finalizar-tipo').value;
    const obs = document.getElementById('finalizar-obs').value.trim();
    const motivoVal = document.getElementById('finalizar-motivo').value;
    const motivo = (motivoVal && motivoVal !== '__outro__') ? motivoVal : null;
    const btn = document.getElementById('btn-confirmar-finalizar');

    if (!tipo) { mostrarToast('Selecione o tipo de manutenção.', 'warning'); return; }
    if (!motivo) { mostrarToast('Selecione o motivo da manutenção.', 'warning'); return; }
    if (!obs) { mostrarToast('Descreva o serviço realizado.', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';

    try {
        // Buscar chamado para calcular tempo de parada
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
            motivoManutencao: motivo,
            observacoesMecanico: obs,
            mecanicoResponsavelId: _currentUser.uid,
            mecanicoResponsavelNome: _currentUserNome,
            encerradoPor: _currentUser.uid,
            encerradoPorNome: _currentUserNome,
            encerradoVia: 'mobile'
        });

        mostrarToast('Chamado finalizado com sucesso! ✅', 'success');
        fecharSheet('sheet-finalizar');
    } catch (e) {
        console.error('Erro ao finalizar:', e);
        mostrarToast('Erro ao finalizar chamado. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Finalizar Chamado';
    }
}

// ============================================================
// TOAST
// ============================================================
function mostrarToast(msg, tipo = 'info') {
    const toast = document.getElementById('feedback-toast');
    toast.className = `toast-${tipo}`;
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// Cleanup ao fechar
window.addEventListener('beforeunload', () => {
    if (_unsubscribe) _unsubscribe();
});
