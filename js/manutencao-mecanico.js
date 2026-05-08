// Meus Chamados - Mecânico Mobile View
window.meusChamados = [];
window.unsubscribeMeusChamados = null;

async function inicializarMeusChamados() {
    const user = firebase.auth().currentUser;
    if (!user) {
        mostrarMensagem("Usuário não autenticado", "error");
        return;
    }

    // Verificar se é mecânico
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
    if (!userDoc.exists || !userDoc.data().isMecanico) {
        mostrarMensagem("Acesso restrito a mecânicos", "error");
        return;
    }

    await atualizarMeusChamados();
}

async function atualizarMeusChamados() {
    if (window.unsubscribeMeusChamados) window.unsubscribeMeusChamados();

    const tbody = document.getElementById('tabela-meus-chamados');
    const totalBadge = document.getElementById('total-meus-chamados');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const user = firebase.auth().currentUser;

        // Listener principal (ideal): por mecanicoResponsavelId
        window.unsubscribeMeusChamados = db.collection('manutencao_chamados')
            .where('mecanicoResponsavelId', '==', user.uid)
            .onSnapshot(async snap => {
                let chamadosList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                chamadosList.sort((a, b) => (b.dataAbertura?.toMillis() || 0) - (a.dataAbertura?.toMillis() || 0));
                window.meusChamados = chamadosList;

                // Fallback: alguns chamados podem ter designação gravada por nome
                // (garante que o mecânico veja os designados a ele mesmo se o ID estiver divergente)
                if (window.meusChamados.length === 0) {
                    try {
                        const displayName = user.displayName || '';

                        // Busca por nome do responsável (caso o campo esteja preenchido)
                        const fallbackSnap = await db.collection('manutencao_chamados')
                            .where('mecanicoResponsavelNome', '==', displayName)
                            .limit(200)
                            .get();

                        let fallbackList = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        fallbackList.sort((a, b) => (b.dataAbertura?.toMillis() || 0) - (a.dataAbertura?.toMillis() || 0));
                        window.meusChamados = fallbackList;
                    } catch (fallbackErr) {
                        console.warn('Fallback por mecanicoResponsavelNome falhou:', fallbackErr);
                    }
                }


                totalBadge.textContent = window.meusChamados.length;
                await renderizarTabelaMeusChamados();
                renderizarMetricasMecanico();
            });
    } catch (error) {
        console.error("Erro:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar chamados</td></tr>';
  async function renderizarTabelaMeusChamados() {
    const container = document.getElementById('lista-cards-chamados');
    if (!container) return;
    
    if (window.meusChamados.length === 0) {
        container.innerHTML = `
            <div class="text-center p-4">
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <h5 class="text-muted">Nenhum chamado pendente</h5>
                <p class="text-muted small">Você não tem chamados atribuídos no momento.</p>
            </div>
        `;
        return;
    }

    let html = '';
    for (const chamado of window.meusChamados) {
        const prioridadeClass = chamado.prioridade === 'Urgente' ? 'bg-danger' : chamado.prioridade === 'Prioritário' ? 'bg-warning text-dark' : 'bg-info';
        const statusClass = chamado.status === 'Aberto' ? 'bg-warning text-dark' : chamado.status === 'Em Andamento' ? 'bg-info' : 'bg-success';
        
        let tempoParada = chamado.tempoParada || '-';
        if (chamado.maquinaParada && chamado.status !== 'Concluído' && chamado.paradaInicioTimestamp) {
            const inicio = chamado.paradaInicioTimestamp.toDate();
            const agora = new Date();
            const diff = agora - inicio;
            const horas = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            tempoParada = `${horas}h ${mins}m`;
        }

        html += `
            <div class="card chamado-card ${chamado.maquinaParada ? 'border-warning' : ''}">
                <div class="chamado-card-header">
                    <div>
                        <h6 class="m-0 fw-bold">${chamado.maquinaNome}</h6>
                        <small class="text-muted">${chamado.dataAbertura?.toDate().toLocaleDateString('pt-BR')} às ${chamado.dataAbertura?.toDate().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</small>
                    </div>
                    <div>
                        <span class="badge badge-status ${statusClass}">${chamado.status}</span>
                    </div>
                </div>
                <div class="chamado-card-body">
                    <div class="row">
                        <div class="col-12 mb-2">
                            <div class="info-label">Motivo</div>
                            <div class="info-value"><i class="fas fa-tools text-muted me-2"></i>${chamado.motivo}</div>
                        </div>
                        <div class="col-6">
                            <div class="info-label">Prioridade</div>
                            <div class="info-value"><span class="badge ${prioridadeClass}">${chamado.prioridade || 'Normal'}</span></div>
                        </div>
                        <div class="col-6">
                            <div class="info-label">Tempo Parada</div>
                            <div class="info-value ${chamado.maquinaParada ? 'text-danger fw-bold' : ''}">${tempoParada}</div>
                        </div>
                    </div>
                </div>
                <div class="chamado-card-footer bg-white">
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirDetalhesChamado('${chamado.id}')" title="Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="enviarWhatsAppChamado('${chamado.id}')" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    ${chamado.status !== 'Concluído' ? `
                        <button class="btn btn-sm btn-success px-4" onclick="abrirModalFinalizarMec('${chamado.id}', '${chamado.maquinaId}')">
                            <i class="fas fa-check me-1"></i> Finalizar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}TML = html;
}

async function renderizarMetricasMecanico() {
    const container = document.getElementById('metricas-mecanico');
    const abertos = window.meusChamados.filter(c => c.status === 'Aberto').length;
    const andamento = window.meusChamados.filter(c => c.status === 'Em Andamento').length;
    const paradas = window.meusChamados.filter(c => c.maquinaParada).length;
    const urgente = window.meusChamados.filter(c => c.prioridade === 'Urgente').length;

    container.innerHTML = `
        <div class="col-md-3 mb-3">
            <div class="card text-center border-left-primary">
                <div class="card-body">
                    <h5 class="card-title">${abertos}</h5>
                    <p class="card-text">Abertos</p>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card text-center border-left-info">
                <div class="card-body">
                    <h5 class="card-title">${andamento}</h5>
                    <p class="card-text">Em Andamento</p>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card text-center border-left-warning">
                <div class="card-body">
                    <h5 class="card-title">${paradas}</h5>
                    <p class="card-text">Paradas</p>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-3">
            <div class="card text-center border-left-danger">
                <div class="card-body">
                    <h5 class="card-title">${urgente}</h5>
                    <p class="card-text">Urgentes</p>
                </div>
            </div>
        </div>
    `;
}

async function abrirDetalhesChamado(chamadoId) {
    const chamado = window.meusChamados.find(c => c.id === chamadoId);
    if (!chamado) return;

    mostrarMensagem(`Detalhes do chamado ${chamado.id.substring(0,8)}:\nMáquina: ${chamado.maquinaNome}\nMotivo: ${chamado.motivo}\nStatus: ${chamado.status}`);
    // Modal full details could be added here
}

async function abrirModalFinalizarMec(chamadoId, maquinaId) {
    document.getElementById('finalizar-mec-id').value = chamadoId;
    document.getElementById('finalizar-mec-maquina-id').value = maquinaId;
    document.getElementById('finalizar-mec-tipo').value = '';
    document.getElementById('finalizar-mec-obs').value = '';

    const selectMotivo = document.getElementById('finalizar-mec-motivo');
    selectMotivo.innerHTML = '<option value="">Carregando...</option>';

    try {
        const maqDoc = await db.collection('maquinas').doc(maquinaId).get();
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
    } catch (e) {
        console.error('Erro ao buscar motivos', e);
        selectMotivo.innerHTML = '<option value="Outro">Erro ao carregar motivos</option>';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalFinalizarChamadoMec'));
    modal.show();
}

async function confirmarFinalizarMeuChamado() {
    const chamadoId = document.getElementById('finalizar-mec-id').value;
    const tipo = document.getElementById('finalizar-mec-tipo').value;
    const motivo = document.getElementById('finalizar-mec-motivo').value;
    const obs = document.getElementById('finalizar-mec-obs').value;

    if (!tipo || !motivo || !obs) {
        mostrarMensagem('Preencha todos os campos obrigatórios!', 'warning');
        return;
    }

    const chamado = window.meusChamados.find(c => c.id === chamadoId);
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
            encerradoPor: firebase.auth().currentUser.uid,
            encerradoPorNome: firebase.auth().currentUser.displayName || firebase.auth().currentUser.email
        });

        mostrarMensagem("Chamado finalizado com sucesso!", "success");
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalFinalizarChamadoMec'));
        if (modal) modal.hide();
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i> Salvar e Finalizar';

    } catch (error) {
        console.error("Erro ao finalizar chamado:", error);
        mostrarMensagem("Erro ao finalizar chamado.", "error");
        
        const btn = document.querySelector('#modalFinalizarChamadoMec .btn-success');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i> Salvar e Finalizar';
    }
}

async function enviarWhatsAppChamado(chamadoId) {
    const chamado = window.meusChamados.find(c => c.id === chamadoId);
    if (!chamado) return;

    const msg = `Chamado ${chamado.id.substring(0,8)} - ${chamado.maquinaNome}\nStatus: ${chamado.status}\nMotivo: ${chamado.motivo}`;
    const userDoc = await db.collection('usuarios').doc(firebase.auth().currentUser.uid).get();
    const tel = userDoc.data().telefone;
    if (tel) {
        const link = `whatsapp://send?phone=${formatarTelefoneWhatsApp(tel)}&text=${encodeURIComponent(msg)}`;
        window.open(link, '_blank');
    }
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (window.unsubscribeMeusChamados) window.unsubscribeMeusChamados();
});

// Auto init
document.addEventListener('DOMContentLoaded', inicializarMeusChamados);

// Export para o escopo global
window.inicializarMeusChamados = inicializarMeusChamados;
window.atualizarMeusChamados = atualizarMeusChamados;
window.abrirDetalhesChamado = abrirDetalhesChamado;
window.abrirModalFinalizarMec = abrirModalFinalizarMec;
window.confirmarFinalizarMeuChamado = confirmarFinalizarMeuChamado;
window.enviarWhatsAppChamado = enviarWhatsAppChamado;
