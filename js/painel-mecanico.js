/**
 * Lógica do Painel do Mecânico (Portado para Desktop)
 */

let __filtro_mecanico_atual = 'meus';

async function inicializarPainelMecanico() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    document.getElementById('mecanico-user-info').textContent = `Mecânico: ${user.displayName || user.email}`;

    // Configurar Cliques nos Filtros
    document.querySelectorAll('.filter-tab-mecanico').forEach(tab => {
        tab.onclick = function() {
            document.querySelector('.filter-tab-mecanico.active').classList.remove('active');
            this.classList.add('active');
            __filtro_mecanico_atual = this.dataset.filter;
            carregarChamadosMecanico();
        };
    });

    await carregarChamadosMecanico();
}

async function carregarChamadosMecanico() {
    const container = document.getElementById('lista-chamados-mecanico');
    const user = firebase.auth().currentUser;
    
    try {
        const snap = await db.collection('manutencao_chamados')
            .orderBy('dataAbertura', 'desc')
            .limit(50)
            .get();

        let chamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Atualizar Stats
        document.getElementById('mec-stat-abertos').textContent = chamados.filter(c => c.status === 'Aberto').length;
        document.getElementById('mec-stat-andamento').textContent = chamados.filter(c => c.status === 'Em Andamento').length;
        document.getElementById('mec-stat-urgentes').textContent = chamados.filter(c => c.prioridade === 'Urgente' && c.status !== 'Concluído').length;

        // Filtragem Local
        if (__filtro_mecanico_atual === 'meus') {
            chamados = chamados.filter(c => c.mecanicoResponsavelId === user.uid && c.status !== 'Concluído');
        } else if (__filtro_mecanico_atual === 'abertos') {
            chamados = chamados.filter(c => c.status === 'Aberto');
        } else if (__filtro_mecanico_atual === 'concluidos') {
            chamados = chamados.filter(c => c.status === 'Concluído');
        }

        if (chamados.length === 0) {
            container.innerHTML = '<div class="col-12 text-center p-4 text-muted">Nenhum chamado encontrado nesta categoria.</div>';
            return;
        }

        container.innerHTML = chamados.map(c => {
            const isUrgente = c.prioridade === 'Urgente' || c.maquinaParada;
            return `
                <div class="col-md-6 col-xl-4 mb-3">
                    <div class="mecanico-card ${isUrgente ? 'urgente' : ''}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="mb-0 text-white">${c.maquinaNome || 'Máquina s/ Nome'}</h5>
                            <span class="mecanico-badge-status ${c.status === 'Aberto' ? 'bg-danger' : (c.status === 'Em Andamento' ? 'bg-info' : 'bg-success')}">
                                ${c.status}
                            </span>
                        </div>
                        <p class="small mb-2 text-muted"><i class="fas fa-map-marker-alt me-1"></i> ID: ${c.maquinaId}</p>
                        <div class="bg-dark p-2 rounded mb-3" style="background: rgba(0,0,0,0.2) !important;">
                            <strong class="small d-block text-accent">MOTIVO:</strong>
                            <span class="small">${c.motivo}</span>
                        </div>
                        <div class="d-flex gap-2">
                            ${c.status === 'Aberto' ? `
                                <button class="btn btn-primary btn-sm w-100 mecanico-btn-action" onclick="iniciarAtendimentoMecanico('${c.id}')">
                                    <i class="fas fa-play me-1"></i> INICIAR
                                </button>
                            ` : ''}
                            ${c.status === 'Em Andamento' ? `
                                <button class="btn btn-success btn-sm w-100 mecanico-btn-action" onclick="abrirModalFinalizar('${c.id}')">
                                    <i class="fas fa-check me-1"></i> FINALIZAR
                                </button>
                            ` : ''}
                            <button class="btn btn-outline-light btn-sm w-auto" onclick="imprimirChamado('${c.id}')">
                                <i class="fas fa-print"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Erro no painel do mecânico:", error);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar chamados.</div>';
    }
}

async function iniciarAtendimentoMecanico(id) {
    const user = firebase.auth().currentUser;
    if (!confirm("Deseja assumir o atendimento desta máquina?")) return;

    try {
        await db.collection('manutencao_chamados').doc(id).update({
            status: 'Em Andamento',
            mecanicoResponsavelId: user.uid,
            mecanicoResponsavelNome: user.displayName || user.email,
            atendimentoIniciadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Atendimento iniciado com sucesso!", "success");
        carregarChamadosMecanico();
    } catch (e) {
        mostrarMensagem("Erro ao iniciar atendimento.", "error");
    }
}

// Exportar para o escopo global do app.js
window.inicializarPainelMecanico = inicializarPainelMecanico;