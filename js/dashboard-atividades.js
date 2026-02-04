// ========================================
// Dashboard de Atividades da Equipe
// ========================================

let chartAtividadesStatus = null;
let chartAtividadesResponsavel = null;
let dashAtivModo = 'equipe'; // 'equipe' ou 'pessoal'

function alternarModoDashboardAtividades(modo) {
    dashAtivModo = modo;
    carregarDadosDashboardAtividades();
}

async function inicializarDashboardAtividades() {
    console.log("Inicializando Dashboard de Atividades...");
    
    // Configurar datas padrão (Mês atual)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const inputInicio = document.getElementById('dash-ativ-data-inicio');
    const inputFim = document.getElementById('dash-ativ-data-fim');
    
    if (inputInicio && !inputInicio.value) inputInicio.value = inicioMes.toISOString().split('T')[0];
    if (inputFim && !inputFim.value) inputFim.value = fimMes.toISOString().split('T')[0];

    await popularFiltroUsuariosDashboard();
    await carregarDadosDashboardAtividades();
}

async function carregarDadosDashboardAtividades() {
    const container = document.getElementById('tabela-dashboard-atividades');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Carregando atividades...</td></tr>';

    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) return;
        const filtroUsuarioId = document.getElementById('dash-ativ-filtro-usuario')?.value;
        const dataInicioVal = document.getElementById('dash-ativ-data-inicio')?.value;
        const dataFimVal = document.getElementById('dash-ativ-data-fim')?.value;

        const dataInicio = dataInicioVal ? new Date(dataInicioVal + 'T00:00:00') : null;
        const dataFim = dataFimVal ? new Date(dataFimVal + 'T23:59:59') : null;

        let snapshot;
        let atividades = [];

        if (dashAtivModo === 'equipe') {
            // MODO EQUIPE: Atividades que EU criei e atribuí a OUTROS
            snapshot = await db.collection('agenda_atividades')
                .where('criadoPor', '==', currentUser.uid)
                .get();
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.atribuidoParaId && data.atribuidoParaId !== currentUser.uid) {
                    atividades.push({ id: doc.id, ...data });
                }
            });
        } else {
            // MODO PESSOAL: Atividades atribuídas a MIM (seja por mim mesmo ou por outros)
            const atividadesMap = new Map();

            // 1. Tarefas explicitamente atribuídas a mim
            const snapExplicit = await db.collection('agenda_atividades')
                .where('atribuidoParaId', '==', currentUser.uid)
                .get();
            snapExplicit.forEach(doc => atividadesMap.set(doc.id, { id: doc.id, ...doc.data() }));
            
            // 2. Tarefas criadas por mim sem atribuição (null) - assume-se auto-atribuição
            const snapImplicit = await db.collection('agenda_atividades')
                .where('criadoPor', '==', currentUser.uid)
                .where('atribuidoParaId', '==', null)
                .get();
            snapImplicit.forEach(doc => atividadesMap.set(doc.id, { id: doc.id, ...doc.data() }));

            atividades = Array.from(atividadesMap.values());
        }

        // --- Lógica de Alerta de Pendências Anteriores ---
        // Verifica pendências anteriores ao mês atual (independente do filtro de data visual)
        const hoje = new Date();
        const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const pendenciasAnteriores = [];

        atividades.forEach(a => {
            // Se tiver filtro de usuário, respeita para o alerta também
            if (filtroUsuarioId && a.atribuidoParaId !== filtroUsuarioId) return;

            const dataAtiv = a.data?.toDate ? a.data.toDate() : new Date(a.data);
            if ((a.status === 'Aberto' || a.status === 'Pendente') && dataAtiv < inicioMesAtual) {
                pendenciasAnteriores.push(a);
            }
        });

        // --- Filtragem para Exibição (Tabela e Gráficos) ---
        let atividadesFiltradas = atividades;

        // Aplicar filtro por usuário (se selecionado)
        if (filtroUsuarioId) {
            atividadesFiltradas = atividadesFiltradas.filter(a => a.atribuidoParaId === filtroUsuarioId);
        }

        // Aplicar filtro por data
        if (dataInicio && dataFim) {
            atividadesFiltradas = atividadesFiltradas.filter(a => {
                const dataAtiv = a.data?.toDate ? a.data.toDate() : new Date(a.data);
                return dataAtiv >= dataInicio && dataAtiv <= dataFim;
            });
        }

        // Ordenar por data (mais recentes primeiro ou por prazo)
        atividadesFiltradas.sort((a, b) => {
            const dataA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
            const dataB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
            return dataA - dataB;
        });

        atualizarKPIsAtividades(atividadesFiltradas);
        renderizarGraficosAtividades(atividadesFiltradas);
        renderizarDashboardModerno(atividadesFiltradas, container, pendenciasAnteriores);

    } catch (error) {
        console.error("Erro ao carregar dashboard de atividades:", error);
        container.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Erro ao carregar dados.</td></tr>';
    }
}

function atualizarKPIsAtividades(atividades) {
    const total = atividades.length;
    const concluidas = atividades.filter(a => a.status === 'Concluído').length;
    const pendentes = atividades.filter(a => a.status === 'Aberto' || a.status === 'Pendente').length;
    
    // Cálculo de atrasadas
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const atrasadas = atividades.filter(a => {
        const dataAtiv = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        return (a.status === 'Aberto' || a.status === 'Pendente') && dataAtiv < hoje;
    }).length;

    // Cálculo do Tempo Médio
    const tempoMedio = calcularMediaTempoResolucao(atividades);

    document.getElementById('dash-ativ-total').textContent = total;
    document.getElementById('dash-ativ-concluidas').textContent = concluidas;
    document.getElementById('dash-ativ-pendentes').textContent = pendentes;
    document.getElementById('dash-ativ-atrasadas').textContent = atrasadas;
    document.getElementById('dash-ativ-tempo-medio').textContent = tempoMedio;
}

function renderizarGraficosAtividades(atividades) {
    // 1. Gráfico de Status (Doughnut)
    const ctxStatus = document.getElementById('grafico-atividades-status')?.getContext('2d');
    if (ctxStatus) {
        const statusCounts = {};
        atividades.forEach(a => {
            const status = a.status || 'Aberto';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        if (chartAtividadesStatus) chartAtividadesStatus.destroy();

        chartAtividadesStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#ffc107', '#28a745', '#dc3545', '#17a2b8'], // Cores exemplo
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // 2. Gráfico por Responsável (Bar)
    const ctxResp = document.getElementById('grafico-atividades-responsavel')?.getContext('2d');
    if (ctxResp) {
        const respCounts = {};
        atividades.forEach(a => {
            const nome = a.atribuidoParaNome || 'Não Atribuído';
            respCounts[nome] = (respCounts[nome] || 0) + 1;
        });

        if (chartAtividadesResponsavel) chartAtividadesResponsavel.destroy();

        chartAtividadesResponsavel = new Chart(ctxResp, {
            type: 'bar',
            data: {
                labels: Object.keys(respCounts),
                datasets: [{
                    label: 'Tarefas Atribuídas',
                    data: Object.values(respCounts),
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function renderizarDashboardModerno(atividades, container, pendenciasAnteriores = []) {
    const alertasContainer = document.getElementById('dash-ativ-alertas');
    alertasContainer.innerHTML = '';

    if (atividades.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma atividade atribuída encontrada.</td></tr>';
        return;
    }

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    // Separar atividades atrasadas
    const atrasadas = atividades.filter(a => {
        const dataAtiv = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        dataAtiv.setHours(0,0,0,0);
        return (a.status === 'Aberto' || a.status === 'Pendente') && dataAtiv < hoje;
    });

    // Renderizar Alertas de Pendências do Mês Anterior (Prioridade)
    if (pendenciasAnteriores && pendenciasAnteriores.length > 0) {
        // Agrupar por usuário
        const pendenciasPorUsuario = {};
        pendenciasAnteriores.forEach(p => {
            const nome = p.atribuidoParaNome || 'Desconhecido';
            if (!pendenciasPorUsuario[nome]) pendenciasPorUsuario[nome] = 0;
            pendenciasPorUsuario[nome]++;
        });

        let htmlAlertas = '';
        for (const [usuario, count] of Object.entries(pendenciasPorUsuario)) {
            htmlAlertas += `<li><strong>${usuario}</strong> possui <strong>${count}</strong> atividade(s) pendente(s) de meses anteriores.</li>`;
        }

        alertasContainer.innerHTML += `
            <div class="alert alert-warning border-0 shadow-sm mb-3" role="alert" style="border-left: 5px solid #ffc107 !important;">
                <h5 class="alert-heading fw-bold"><i class="fas fa-history me-2"></i> Pendências de Meses Anteriores</h5>
                <ul class="mb-0 ps-3">${htmlAlertas}</ul>
            </div>
        `;
    }

    // Renderizar Alertas de Atraso do Período Atual (Topo)
    if (atrasadas.length > 0) {
        // Mostra apenas se não for redundante com o alerta anterior ou se quiser detalhar
        // Vamos mostrar um resumo simples para não poluir
        const countAtrasadas = atrasadas.length;
        
        // Se já mostramos pendências anteriores, subtraímos elas da contagem de "atraso atual" para não confundir, 
        // ou mostramos tudo. Aqui mostramos as atrasadas que estão na lista filtrada.
        
        alertasContainer.innerHTML += `
            <div class="alert alert-danger border-0 shadow-sm" role="alert" style="border-left: 5px solid #dc3545 !important;">
                <div class="d-flex align-items-center">
                    <i class="fas fa-fire fa-2x me-3 text-danger"></i>
                    <div>
                        <h5 class="alert-heading fw-bold mb-0">Atenção!</h5>
                        <p class="mb-0">Existem <strong>${countAtrasadas}</strong> atividades atrasadas no período selecionado.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Renderizar Tabela Principal
    let html = '';
    atividades.forEach(a => {
        const dataFormatada = a.data?.toDate ? a.data.toDate().toLocaleDateString('pt-BR') : new Date(a.data).toLocaleDateString('pt-BR');
        const dataAtiv = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        dataAtiv.setHours(0,0,0,0);
        const tempoDecorrido = calcularTempoDecorrido(a);
        
        let statusBadge = '<span class="badge bg-light text-dark border">Indefinido</span>';
        let rowClass = '';

        if (a.status === 'Concluído') {
            statusBadge = '<span class="badge bg-success-subtle text-success border border-success"><i class="fas fa-check me-1"></i> Concluído</span>';
        }
        else if (a.status === 'Aberto' || a.status === 'Pendente') {
            if (dataAtiv < hoje) {
                statusBadge = '<span class="badge bg-danger-subtle text-danger border border-danger"><i class="fas fa-exclamation-triangle me-1"></i> Atrasado</span>';
                rowClass = 'table-danger bg-opacity-10'; // Destacar linha levemente
            } else {
                statusBadge = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning"><i class="fas fa-clock me-1"></i> Pendente</span>';
            }
        }

        html += `
            <tr class="${rowClass}">
                <td class="ps-4">${statusBadge}</td>
                <td>
                    <div class="fw-bold text-dark">${a.assunto || a.titulo}</div>
                    <small class="text-muted">${a.tipo || '-'}</small>
                </td>
                <td><div class="d-flex align-items-center"><div class="avatar-circle bg-primary text-white me-2" style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;">${(a.atribuidoParaNome || 'U').charAt(0)}</div> ${a.atribuidoParaNome || '-'}</div></td>
                <td>${dataFormatada}</td>
                <td><small class="text-muted"><i class="fas fa-stopwatch me-1"></i> ${tempoDecorrido}</small></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-info" onclick="visualizarEvento('${a.id}', 'agenda_atividades')" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${!a.executionStartTime && a.status !== 'Concluído' ? `
                    <button class="btn btn-sm btn-outline-warning" onclick="iniciarAtividade('${a.id}')" title="Iniciar Execução">
                        <i class="fas fa-play"></i>
                    </button>` : ''}
                    <button class="btn btn-sm btn-outline-primary" onclick="editarEvento('${a.id}', 'agenda_atividades')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirAtividadeGestor('${a.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    ${a.status !== 'Concluído' ? `
                    <button class="btn btn-sm btn-outline-success" onclick="concluirAtividadeGestor('${a.id}')" title="Marcar como Concluído">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                </td>
            </tr>
        `;
    });
    container.innerHTML = html;
}

function calcularTempoDecorrido(atividade) {
    // Se tiver data de início de execução (novo modelo)
    if (atividade.executionStartTime) {
        const inicio = atividade.executionStartTime.toDate ? atividade.executionStartTime.toDate() : new Date(atividade.executionStartTime);
        let fim = new Date();
        
        if (atividade.status === 'Concluído') {
            if (atividade.concluidoEm) {
                fim = atividade.concluidoEm.toDate ? atividade.concluidoEm.toDate() : new Date(atividade.concluidoEm);
            }
        }
        
        let diffMs = fim - inicio;
        if (diffMs < 0) diffMs = 0;
        return formatarDuracao(diffMs);
    }

    // Se não foi iniciada e não está concluída
    if (atividade.status !== 'Concluído') {
        return 'Aguardando Início';
    }

    // Fallback para tarefas antigas concluídas (usa criadoEm)
    if (atividade.tempoResolucao) return atividade.tempoResolucao;
    if (atividade.criadoEm) {
        const inicio = atividade.criadoEm.toDate ? atividade.criadoEm.toDate() : new Date(atividade.criadoEm);
        let fim = atividade.concluidoEm ? (atividade.concluidoEm.toDate ? atividade.concluidoEm.toDate() : new Date(atividade.concluidoEm)) : new Date();
        let diffMs = fim - inicio;
        return formatarDuracao(diffMs);
    }

    return '-';
}

function formatarDuracao(diffMs) {
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    diffMs -= dias * (1000 * 60 * 60 * 24);
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    diffMs -= horas * (1000 * 60 * 60);
    const minutos = Math.floor(diffMs / (1000 * 60));

    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

function calcularMediaTempoResolucao(atividades) {
    const concluidas = atividades.filter(a => a.status === 'Concluído' && (a.executionStartTime || a.criadoEm) && a.concluidoEm);
    
    if (concluidas.length === 0) return '-';

    let totalMs = 0;
    concluidas.forEach(a => {
        // Prioriza executionStartTime, fallback para criadoEm
        const startProp = a.executionStartTime || a.criadoEm;
        const inicio = startProp.toDate ? startProp.toDate() : new Date(startProp);
        const fim = a.concluidoEm.toDate ? a.concluidoEm.toDate() : new Date(a.concluidoEm);
        totalMs += (fim - inicio);
    });

    const mediaMs = totalMs / concluidas.length;
    return formatarDuracao(mediaMs);
}

async function iniciarAtividade(id) {
    try {
        await db.collection('agenda_atividades').doc(id).update({
            status: 'Em Andamento',
            executionStartTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Atividade iniciada!", "success");
        carregarDadosDashboardAtividades();
    } catch (error) {
        console.error("Erro ao iniciar:", error);
        mostrarMensagem("Erro ao iniciar atividade.", "error");
    }
}

/* Funções antigas substituídas acima
function calcularTempoDecorrido(atividade) {
    if (!atividade.criadoEm) return '-';
    
    const inicio = atividade.criadoEm.toDate ? atividade.criadoEm.toDate() : new Date(atividade.criadoEm);
    let fim = new Date();
    
    if (atividade.status === 'Concluído') {
        if (atividade.concluidoEm) {
            fim = atividade.concluidoEm.toDate ? atividade.concluidoEm.toDate() : new Date(atividade.concluidoEm);
        } else if (atividade.tempoResolucao) {
            return atividade.tempoResolucao; // Usa o valor salvo se disponível
        }
    }
    
    let diffMs = fim - inicio;
    if (diffMs < 0) diffMs = 0;

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    diffMs -= dias * (1000 * 60 * 60 * 24);
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    diffMs -= horas * (1000 * 60 * 60);
    const minutos = Math.floor(diffMs / (1000 * 60));

    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}
*/

async function concluirAtividadeGestor(id) {
    if(!confirm("Deseja marcar esta atividade como concluída em nome do colaborador?")) return;
    
    try {
        await db.collection('agenda_atividades').doc(id).update({
            status: 'Concluído',
            concluidoEm: firebase.firestore.FieldValue.serverTimestamp(),
            concluidoPorGestor: true
        });
        mostrarMensagem("Atividade concluída com sucesso!", "success");
        carregarDadosDashboardAtividades();
    } catch (error) {
        console.error("Erro ao concluir:", error);
        mostrarMensagem("Erro ao atualizar atividade.", "error");
    }
}

async function excluirAtividadeGestor(id) {
    if(!confirm("Tem certeza que deseja excluir esta atividade?")) return;
    
    try {
        await db.collection('agenda_atividades').doc(id).delete();
        mostrarMensagem("Atividade excluída com sucesso!", "success");
        carregarDadosDashboardAtividades();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        mostrarMensagem("Erro ao excluir atividade.", "error");
    }
}

// Exportar função para o escopo global
window.alternarModoDashboardAtividades = alternarModoDashboardAtividades;
window.iniciarAtividade = iniciarAtividade;

async function popularFiltroUsuariosDashboard() {
    const select = document.getElementById('dash-ativ-filtro-usuario');
    if (!select) return;
    
    // Evita repopular se já tiver opções (exceto o default)
    if (select.options.length > 1) return;

    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        usersSnap.forEach(doc => {
            const user = doc.data();
            if (user.nome) {
                select.innerHTML += `<option value="${doc.id}">${user.nome}</option>`;
            }
        });
    } catch (error) {
        console.error("Erro ao carregar usuários para filtro:", error);
    }
}