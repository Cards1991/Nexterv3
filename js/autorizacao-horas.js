// =================================================================
// Módulo de Autorização de Horas Extras (Visão da Controladoria)
// Design e Funcionalidades Aprimorados
// =================================================================

let listenerAutorizacao = null;
let cacheSolicitacoes = [];
let chartAutorizacao = null;

/**
 * Inicializa a tela de autorização, configurando listeners e carregando dados.
 */
function inicializarTelaAutorizacao() {
    console.log("🔧 Inicializando tela de autorização...");

    // Configura eventos de clique para os botões de ação da tela
    const formAjuste = document.getElementById('form-ajuste-solicitacao');
    if (formAjuste && !formAjuste.bound) {
        formAjuste.addEventListener('submit', (e) => {
            e.preventDefault();
            salvarAjusteSolicitacao();
        });
        formAjuste.bound = true;
    }

    const btnImprimir = document.getElementById('auth-btn-imprimir');
    if (btnImprimir && !btnImprimir.bound) {
        btnImprimir.addEventListener('click', imprimirTabelaAutorizacao);
        btnImprimir.bound = true;
    }

    const btnExportar = document.getElementById('auth-btn-exportar');
    if (btnExportar && !btnExportar.bound) {
        btnExportar.addEventListener('click', exportarTabelaAutorizacao);
        btnExportar.bound = true;
    }

    // Inicia o carregamento de dados em tempo real
    carregarSolicitacoes();
}

/**
 * Carrega as solicitações do Firestore em tempo real.
 */
async function carregarSolicitacoes() {
    console.log("📥 Carregando solicitações...");
    const container = document.getElementById('auth-solicitacoes-table');
    if (!container) {
        console.error("❌ Container 'auth-solicitacoes-table' não encontrado!");
        return;
    }

    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-2">Carregando...</p></div>';

    // Cancela o listener anterior para evitar duplicações
    if (listenerAutorizacao) listenerAutorizacao();

    // Cria um novo listener
    listenerAutorizacao = db.collection('solicitacoes_horas')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .onSnapshot(async (snapshot) => {
            console.log(`📊 Snapshot recebido: ${snapshot.docs.length} documentos`);

            if (snapshot.empty) {
                container.innerHTML = '<div class="text-center p-5"><i class="fas fa-inbox fa-3x text-muted mb-3"></i><p>Nenhuma solicitação encontrada</p></div>';
                atualizarKPIs([]);
                renderizarGrafico([]);
                return;
            }

            // Otimização: Carrega salários de todos os funcionários de uma vez
            const funcionariosSnap = await db.collection('funcionarios').get();
            const salariosMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, parseFloat(doc.data().salario || 0)]));

            const solicitacoesPromises = snapshot.docs.map(async (doc) => {
                const data = doc.data();
                if (!data.start || !data.end) return null;
                const valorEstimado = await calcularValorEstimado(data.start.toDate(), data.end.toDate(), data.employeeId, salariosMap);
                return { id: doc.id, ...data, valorEstimado };
            });

            cacheSolicitacoes = (await Promise.all(solicitacoesPromises)).filter(Boolean);

            console.log(`✅ Processadas ${cacheSolicitacoes.length} solicitações válidas`);

            // Atualiza toda a UI
            atualizarKPIs(cacheSolicitacoes);
            renderizarTabela(cacheSolicitacoes, container);
            renderizarGrafico(cacheSolicitacoes);

        }, (error) => {
            console.error("❌ Erro no listener do Firestore:", error);
            container.innerHTML = '<div class="alert alert-danger">Erro ao conectar com o banco de dados.</div>';
        });
}

/**
 * Renderiza a tabela de solicitações com um design aprimorado.
 */
function renderizarTabela(solicitacoes, container) {
    let html = `
        <div class="table-responsive">
            <table class="table table-hover align-middle" id="tabela-autorizacao">
                <thead class="table-light">
                    <tr>
                        <th>Data</th>
                        <th>Funcionário</th>
                        <th>Período</th>
                        <th class="text-end">Valor Est.</th>
                        <th class="text-center">Status</th>
                        <th class="text-end">Ações</th>
                    </tr>
                </thead>
                <tbody>`;

    solicitacoes.forEach(s => {
        const start = s.start.toDate();
        const end = s.end.toDate();
        const createdAt = s.createdAt ? s.createdAt.toDate() : new Date();

        const statusConfig = {
            'pendente': { class: 'bg-warning text-dark', text: 'Pendente' },
            'aprovado': { class: 'bg-success', text: 'Aprovado' },
            'rejeitado': { class: 'bg-danger', text: 'Rejeitado' },
            'cancelado': { class: 'bg-secondary', text: 'Cancelado' }
        }[s.status] || { class: 'bg-light text-dark', text: s.status };

        html += `
            <tr id="auth-row-${s.id}">
                <td><small>${createdAt.toLocaleDateString('pt-BR')}</small></td>
                <td>
                    <div>${s.employeeName || 'N/A'}</div>
                    <small class="text-muted">${s.createdByName || ''}</small>
                </td>
                <td><small>${start.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} - ${end.toLocaleTimeString('pt-BR', { timeStyle: 'short' })}</small></td>
                <td class="text-end fw-bold">R$ ${s.valorEstimado.toFixed(2).replace('.', ',')}</td>
                <td class="text-center"><span class="badge ${statusConfig.class}">${statusConfig.text}</span></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        ${s.status === 'pendente' ? `
                            <button class="btn btn-success" onclick="aprovarSolicitacao('${s.id}')" title="Aprovar"><i class="fas fa-check"></i></button>
                            <button class="btn btn-primary" onclick="abrirModalAjuste('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-warning" onclick="rejeitarSolicitacao('${s.id}')" title="Rejeitar"><i class="fas fa-times"></i></button>
                        ` : ''}
                        <button class="btn btn-outline-danger" onclick="excluirSolicitacaoDeHoras('${s.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * Atualiza os cards de KPI (Indicadores Chave de Performance).
 */
function atualizarKPIs(solicitacoes) {
    const totalSolicitado = solicitacoes.filter(s => s.status !== 'cancelado').reduce((acc, s) => acc + s.valorEstimado, 0);
    const totalAprovado = solicitacoes.filter(s => s.status === 'aprovado').reduce((acc, s) => acc + s.valorEstimado, 0);
    const pendentes = solicitacoes.filter(s => s.status === 'pendente').length;

    document.getElementById('auth-total-solicitado').textContent = `R$ ${totalSolicitado.toFixed(2).replace('.', ',')}`;
    document.getElementById('auth-total-aprovado').textContent = `R$ ${totalAprovado.toFixed(2).replace('.', ',')}`;
    document.getElementById('auth-diferenca').textContent = `R$ ${(totalSolicitado - totalAprovado).toFixed(2).replace('.', ',')}`;
    document.getElementById('auth-pendentes').textContent = pendentes;
}

/**
 * Renderiza o gráfico de comparação de valores solicitados vs. aprovados.
 */
function renderizarGrafico(solicitacoes) {
    const ctx = document.getElementById('auth-chart-canvas')?.getContext('2d');
    if (!ctx) return;

    const dadosAgrupados = solicitacoes.reduce((acc, s) => {
        // CORREÇÃO: Verifica se createdAt existe antes de chamar toDate()
        if (!s.createdAt || !s.createdAt.toDate) return acc;
        const dia = s.createdAt.toDate().toISOString().split('T')[0];
        if (!acc[dia]) acc[dia] = { solicitado: 0, aprovado: 0 };
        if (s.status !== 'cancelado') acc[dia].solicitado += s.valorEstimado;
        if (s.status === 'aprovado') acc[dia].aprovado += s.valorEstimado;
        return acc;
    }, {});

    const labels = Object.keys(dadosAgrupados).sort();
    const dataSolicitado = labels.map(l => dadosAgrupados[l].solicitado);
    const dataAprovado = labels.map(l => dadosAgrupados[l].aprovado);

    if (chartAutorizacao) chartAutorizacao.destroy();

    chartAutorizacao = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => new Date(l).toLocaleDateString('pt-BR', { timeZone: 'UTC' })),
            datasets: [
                {
                    label: 'Valor Solicitado (R$)',
                    data: dataSolicitado,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Valor Aprovado (R$)',
                    data: dataAprovado,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: value => `R$ ${value}` } } }
        }
    });
}

// =================================================================
// FUNÇÕES DE AÇÃO (Aprovar, Rejeitar, Excluir, etc.)
// =================================================================

async function aprovarSolicitacao(id) {
    if (!confirm("Aprovar esta solicitação?")) return;
    try {
        await db.collection('solicitacoes_horas').doc(id).update({
            status: 'aprovado',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedByUid: firebase.auth().currentUser.uid
        });
        mostrarMensagem("Solicitação aprovada com sucesso!", "success");
    } catch (e) {
        mostrarMensagem("Erro ao aprovar.", "error");
    }
}

async function rejeitarSolicitacao(id) {
    const motivo = prompt("Digite o motivo da rejeição:");
    if (!motivo) return;
    try {
        await db.collection('solicitacoes_horas').doc(id).update({
            status: 'rejeitado',
            rejectionReason: motivo,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedByUid: firebase.auth().currentUser.uid
        });
        mostrarMensagem("Solicitação rejeitada.", "info");
    } catch (e) {
        mostrarMensagem("Erro ao rejeitar.", "error");
    }
}

async function excluirSolicitacaoDeHoras(id) {
    if (!confirm("Tem certeza que deseja EXCLUIR esta solicitação permanentemente?")) return;
    
    // Feedback visual imediato
    const linha = document.getElementById(`auth-row-${id}`);
    if (linha) {
        linha.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        linha.style.opacity = '0';
        linha.style.transform = 'translateX(-20px)';
        setTimeout(() => linha.remove(), 500);
    }

    try {
        await db.collection('solicitacoes_horas').doc(id).delete();
        
        // Remove do cache local e recalcula os KPIs
        cacheSolicitacoes = cacheSolicitacoes.filter(s => s.id !== id);
        atualizarKPIs(cacheSolicitacoes);
        renderizarGrafico(cacheSolicitacoes);

        mostrarMensagem("Solicitação excluída com sucesso.", "success");
    } catch (e) {
        console.error("Erro ao excluir solicitação:", e);
        mostrarMensagem("Falha ao excluir a solicitação. A página será recarregada.", "error");
        // Se a exclusão falhar, recarrega para garantir consistência
        setTimeout(() => carregarSolicitacoes(), 1000);
    }
}

async function abrirModalAjuste(id) {
    const doc = await db.collection('solicitacoes_horas').doc(id).get();
    if (!doc.exists) {
        mostrarMensagem("Solicitação não encontrada.", "error");
        return;
    }
    const data = doc.data();
    const start = data.start.toDate();
    const end = data.end.toDate();

    document.getElementById('ajuste-solicitacao-id').value = id;
    document.getElementById('ajuste-funcionario-nome').textContent = data.employeeName;
    document.getElementById('ajuste-start-date').value = start.toISOString().split('T')[0];
    document.getElementById('ajuste-start-time').value = start.toTimeString().slice(0, 5);
    document.getElementById('ajuste-end-date').value = end.toISOString().split('T')[0];
    document.getElementById('ajuste-end-time').value = end.toTimeString().slice(0, 5);
    document.getElementById('ajuste-reason').value = data.reason || '';

    new bootstrap.Modal(document.getElementById('ajusteSolicitacaoModal')).show();
}

async function salvarAjusteSolicitacao() {
    const id = document.getElementById('ajuste-solicitacao-id').value;
    const start = new Date(`${document.getElementById('ajuste-start-date').value}T${document.getElementById('ajuste-start-time').value}`);
    const end = new Date(`${document.getElementById('ajuste-end-date').value}T${document.getElementById('ajuste-end-time').value}`);
    const reason = document.getElementById('ajuste-reason').value;

    if (end <= start) {
        mostrarMensagem("A data final deve ser maior que a inicial.", "warning");
        return;
    }

    try {
        const docOriginal = await db.collection('solicitacoes_horas').doc(id).get();
        const valorEstimado = await calcularValorEstimado(start, end, docOriginal.data().employeeId);

        await db.collection('solicitacoes_horas').doc(id).update({
            start: firebase.firestore.Timestamp.fromDate(start),
            end: firebase.firestore.Timestamp.fromDate(end),
            reason: reason,
            valorEstimado: valorEstimado,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        bootstrap.Modal.getInstance(document.getElementById('ajusteSolicitacaoModal')).hide();
        mostrarMensagem("Ajustes salvos com sucesso!", "success");
    } catch (e) {
        mostrarMensagem("Erro ao salvar ajustes.", "error");
    }
}

async function calcularValorEstimado(start, end, employeeId, salariosMap = null) {
    try {
        const duracaoMinutos = (end - start) / (1000 * 60);
        if (duracaoMinutos <= 0) return 0;

        let salario = 0;
        if (salariosMap && salariosMap.has(employeeId)) {
            salario = salariosMap.get(employeeId);
        } else {
            const funcDoc = await db.collection('funcionarios').doc(employeeId).get();
            if (funcDoc.exists) salario = parseFloat(funcDoc.data().salario || 0);
        }

        if (salario <= 0) return 0;

        const valorHora = salario / 220;
        const valorExtra = (duracaoMinutos / 60) * (valorHora * 1.5); // Assumindo 50%
        const dsr = valorExtra / 6; // DSR simplificado

        return parseFloat((valorExtra + dsr).toFixed(2));
    } catch (error) {
        console.error("Erro no cálculo do valor estimado:", error);
        return 0;
    }
}

// --- FUNÇÕES DE EXPORTAÇÃO ---

function imprimirTabelaAutorizacao() {
    const tabela = document.getElementById('tabela-autorizacao');
    if (!tabela) return;

    const tabelaClone = tabela.cloneNode(true);
    Array.from(tabelaClone.querySelectorAll('tr')).forEach(row => row.deleteCell(-1)); // Remove coluna de ações

    const conteudo = `
        <html><head><title>Relatório de Autorizações</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>@page { size: landscape; } body { font-family: sans-serif; padding: 20px; }</style>
        </head><body><h2>Relatório de Autorização de Horas Extras</h2>${tabelaClone.outerHTML}</body></html>`;
    openPrintWindow(conteudo, { autoPrint: true });
}

function exportarTabelaAutorizacao() {
    const tabela = document.getElementById('tabela-autorizacao');
    if (!tabela) return;

    const tabelaClone = tabela.cloneNode(true);
    Array.from(tabelaClone.querySelectorAll('tr')).forEach(row => row.deleteCell(-1));

    const wb = XLSX.utils.table_to_book(tabelaClone, { sheet: "Autorizacoes" });
    XLSX.writeFile(wb, "Relatorio_Autorizacoes.xlsx");
    mostrarMensagem("Exportado para Excel com sucesso!", "success");
}

// Adiciona a dependência do XLSX (SheetJS) se não existir
if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
    document.head.appendChild(script);
}

// Exporta as funções para o escopo global para serem chamadas pelos `onclick`
window.inicializarTelaAutorizacao = inicializarTelaAutorizacao;
window.aprovarSolicitacao = aprovarSolicitacao;
window.rejeitarSolicitacao = rejeitarSolicitacao;
window.excluirSolicitacaoDeHoras = excluirSolicitacaoDeHoras; // Nome corrigido
window.abrirModalAjuste = abrirModalAjuste;
window.salvarAjusteSolicitacao = salvarAjusteSolicitacao;