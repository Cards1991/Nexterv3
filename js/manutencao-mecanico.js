// Meus Chamados - Mecânico Mobile View
let meusChamados = [];
let unsubscribeMeusChamados = null;

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
    if (unsubscribeMeusChamados) unsubscribeMeusChamados();

    const tbody = document.getElementById('tabela-meus-chamados');
    const totalBadge = document.getElementById('total-meus-chamados');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const user = firebase.auth().currentUser;
        unsubscribeMeusChamados = db.collection('manutencao_chamados')
            .where('mecanicoResponsavelId', '==', user.uid)
            .orderBy('dataAbertura', 'desc')
            .onSnapshot(async snap => {
                meusChamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                totalBadge.textContent = meusChamados.length;
                await renderizarTabelaMeusChamados();
                renderizarMetricasMecanico();
            });
    } catch (error) {
        console.error("Erro:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar chamados</td></tr>';
    }
}

async function renderizarTabelaMeusChamados() {
    const tbody = document.getElementById('tabela-meus-chamados');
    if (meusChamados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum chamado atribuído no momento.</td></tr>';
        return;
    }

    let html = '';
    for (const chamado of meusChamados) {
        const prioridadeClass = chamado.prioridade === 'Urgente' ? 'bg-danger' : chamado.prioridade === 'Prioritário' ? 'bg-warning text-dark' : 'bg-info';
        const statusClass = chamado.status === 'Aberto' ? 'bg-warning' : chamado.status === 'Em Andamento' ? 'bg-info' : 'bg-success';
        
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
            <tr class="${chamado.maquinaParada ? 'table-warning' : ''}">
                <td><strong>${chamado.maquinaNome}</strong></td>
                <td>${chamado.motivo}</td>
                <td><span class="badge ${prioridadeClass}">${chamado.prioridade || 'Normal'}</span></td>
                <td>${chamado.dataAbertura?.toDate().toLocaleDateString('pt-BR')}</td>
                <td><span class="badge ${statusClass}">${chamado.status}</span></td>
                <td>${tempoParada}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="abrirDetalhesChamado('${chamado.id}')" title="Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${chamado.status !== 'Concluído' ? `
                            <button class="btn btn-outline-success" onclick="finalizarMeuChamado('${chamado.id}')" title="Finalizar">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-info" onclick="enviarWhatsAppChamado('${chamado.id}')" title="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

async function renderizarMetricasMecanico() {
    const container = document.getElementById('metricas-mecanico');
    const abertos = meusChamados.filter(c => c.status === 'Aberto').length;
    const andamento = meusChamados.filter(c => c.status === 'Em Andamento').length;
    const paradas = meusChamados.filter(c => c.maquinaParada).length;
    const urgente = meusChamados.filter(c => c.prioridade === 'Urgente').length;

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
    const chamado = meusChamados.find(c => c.id === chamadoId);
    if (!chamado) return;

    mostrarMensagem(`Detalhes do chamado ${chamado.id.substring(0,8)}:\nMáquina: ${chamado.maquinaNome}\nMotivo: ${chamado.motivo}\nStatus: ${chamado.status}`);
    // Modal full details could be added here
}

async function finalizarMeuChamado(chamadoId) {
    const obs = prompt('Observações da conclusão (obrigatório):');
    if (!obs) return;

    try {
        const user = firebase.auth().currentUser;
        await db.collection('manutencao_chamados').doc(chamadoId).update({
            status: 'Concluído',
            dataEncerramento: firebase.firestore.FieldValue.serverTimestamp(),
            observacoesMecanico: obs,
            encerradoPor: user.uid,
            encerradoPorNome: user.displayName
        });
        mostrarMensagem('Chamado finalizado com sucesso!', 'success');
    } catch (error) {
        mostrarMensagem('Erro ao finalizar: ' + error.message, 'error');
    }
}

async function enviarWhatsAppChamado(chamadoId) {
    const chamado = meusChamados.find(c => c.id === chamadoId);
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
    if (unsubscribeMeusChamados) unsubscribeMeusChamados();
});

// Auto init
document.addEventListener('DOMContentLoaded', inicializarMeusChamados);
