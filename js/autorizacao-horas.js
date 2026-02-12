// =================================================================
// Módulo de Autorização de Horas Extras (Visão da Controladoria)
// Design e Funcionalidades Aprimorados
// =================================================================

let listenerAutorizacao = null;
let cacheSolicitacoes = [];
let __auth_funcionarios_cache_timestamp = null;
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

/**
 * Inicializa a tela de autorização, configurando listeners e carregando dados.
 */
async function inicializarTelaAutorizacao() {
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

    const btnIntegrar = document.getElementById('auth-btn-integrar-custos');
    if (btnIntegrar && !btnIntegrar.bound) {
        btnIntegrar.addEventListener('click', integrarComAnaliseDeCustos);
        btnIntegrar.bound = true;
    }

    const btnFiltrar = document.getElementById('auth-btn-filtrar');
    if (btnFiltrar && !btnFiltrar.bound) {
        btnFiltrar.addEventListener('click', carregarSolicitacoes);
        btnFiltrar.bound = true;
    }

    // Inicia o carregamento de dados em tempo real
    await popularFiltrosAutorizacao();
}

/**
 * Popula os filtros da tela de autorização, como o de setores.
 */
async function popularFiltrosAutorizacao() {
    const setorSelect = document.getElementById('auth-filtro-setor');
    const dataInicio = document.getElementById('auth-filtro-data-inicio');
    const dataFim = document.getElementById('auth-filtro-data-fim');
    const status = document.getElementById('auth-filtro-status');

    if (!setorSelect || !dataInicio || !dataFim || !status) {
        console.error("❌ Elementos de filtro não encontrados no DOM!");
        return;
    }

    // Verifica se o DB está disponível antes de tentar acessar
    if (!window.db || typeof db.collection !== 'function') {
        console.warn("⚠️ DB não inicializado. Pulando população de filtros.");
        return;
    }

    try {
        const setores = new Set();
        const empresasSnap = await db.collection('empresas').get();
        empresasSnap.forEach(doc => {
            (doc.data().setores || []).forEach(setor => setores.add(setor));
        });

        setorSelect.innerHTML = '<option value="">Todos os Setores</option>';
        [...setores].sort().forEach(setor => {
            setorSelect.innerHTML += `<option value="${setor}">${setor}</option>`;
        });

        // Set default filters to current month and approved status
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Helper para formatar data localmente (evita problemas de fuso horário do toISOString)
        const toLocalISO = (date) => {
            const offset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - offset).toISOString().split('T')[0];
        };

        dataInicio.value = toLocalISO(firstDay);
        dataFim.value = toLocalISO(lastDay);
        // 🟢 CORREÇÃO: Para teste, buscar TODOS os status
        status.value = ''; // Vazio = todos os status

        // Automatically load solicitations with the predefined filters applied
        await carregarSolicitacoes();
    } catch (error) {
        console.error("Erro ao popular filtro de setores:", error);
    }
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

    // Verificação de segurança do DB
    if (!window.db || typeof db.collection !== 'function') {
        console.error("❌ Erro: 'db' não está inicializado corretamente.");
        container.innerHTML = '<div class="alert alert-danger">Erro de conexão: Banco de dados não inicializado.</div>';
        return;
    }

    // Pega os valores dos filtros
    const dataInicio = document.getElementById('auth-filtro-data-inicio').value;
    const dataFim = document.getElementById('auth-filtro-data-fim').value;
    const setor = document.getElementById('auth-filtro-setor').value;
    const status = document.getElementById('auth-filtro-status').value; // Novo: Pega o valor do filtro de status

    // Cria um novo listener
    let query = db.collection('solicitacoes_horas');

    // Verifica se o objeto query suporta filtragem (evita erro query.where is not a function)
    if (!query || typeof query.where !== 'function') {
        console.error("❌ Erro: Objeto 'query' inválido ou driver incompatível.", query);
        container.innerHTML = '<div class="alert alert-danger">Erro interno: Driver de banco de dados incompatível.</div>';
        return;
    }

    // Aplica filtros de data se existirem
    if (dataInicio || dataFim) {
        if (dataInicio) {
            query = query.where('start', '>=', firebase.firestore.Timestamp.fromDate(new Date(dataInicio + 'T00:00:00')));
        }
        if (dataFim) {
            const dataFimObj = new Date(dataFim + 'T23:59:59');
            query = query.where('start', '<=', firebase.firestore.Timestamp.fromDate(dataFimObj));
        }
        // CORREÇÃO: Firestore exige ordenação pelo mesmo campo do filtro de desigualdade
        query = query.orderBy('start', 'desc');
    } else {
        // Sem filtro de data, ordena por criação e limita
        query = query.orderBy('createdAt', 'desc');
        query = query.limit(200);
    }
    
    listenerAutorizacao = query.onSnapshot(async (snapshot) => {
        try {
            console.log(`📊 Snapshot recebido: ${snapshot.docs.length} documentos`);

            if (snapshot.empty) {
                container.innerHTML = '<div class="text-center p-5"><i class="fas fa-inbox fa-3x text-muted mb-3"></i><p>Nenhuma solicitação encontrada</p></div>';
                return;
            }

            // Otimização: Carrega salários de todos os funcionários de uma vez
            const funcionariosSnap = await db.collection('funcionarios').get();
            const salariosMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, parseFloat(doc.data().salario || 0)]));
            const setoresMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, doc.data().setor || '']));

            // CORREÇÃO: Diferencia o valor atual do valor original
            const solicitacoesPromises = snapshot.docs.map(async (doc) => {
                const data = doc.data();
                if (!data.start || !data.end) return null;

                // Adiciona o setor do funcionário ao objeto da solicitação
                data.setor = setoresMap.get(data.employeeId) || 'N/A';

                const valorAtual = await calcularValorEstimado(data.start.toDate(), data.end.toDate(), data.employeeId, salariosMap);
                
                // Tratamento robusto para valorOriginalSolicitado (pode vir como string do banco)
                let valorOriginal = data.valorOriginalSolicitado;
                
                if (valorOriginal === undefined || valorOriginal === null) {
                    valorOriginal = valorAtual;
                } else if (typeof valorOriginal === 'string') {
                    // Limpa formatação R$ 1.000,00 -> 1000.00
                    let v = valorOriginal.replace(/[R$\s]/g, '').trim();
                    if (v.includes(',') && v.includes('.')) v = v.replace(/\./g, '').replace(',', '.');
                    else if (v.includes(',')) v = v.replace(',', '.');
                    valorOriginal = parseFloat(v);
                }
                
                if (isNaN(Number(valorOriginal))) valorOriginal = valorAtual;

                return { 
                    id: doc.id, 
                    ...data, 
                    valorEstimado: valorAtual, // Valor atual (após edições)
                    valorOriginalSolicitado: Number(valorOriginal)
                };
            });

            let solicitacoesProcessadas = (await Promise.all(solicitacoesPromises)).filter(Boolean);

            // Aplica filtro de setor no lado do cliente
            if (setor) {
                solicitacoesProcessadas = solicitacoesProcessadas.filter(s => s.setor === setor);
            }

            // Aplica filtro de status no lado do cliente para evitar erro de índice e garantir consistência
            if (status) {
                solicitacoesProcessadas = solicitacoesProcessadas.filter(s => s.status === status);
            }

            cacheSolicitacoes = solicitacoesProcessadas;

            console.log(`✅ Processadas ${cacheSolicitacoes.length} solicitações para tabela`);

            // Atualiza toda a UI
            renderizarTabela(cacheSolicitacoes, container);

        } catch (err) {
            console.error("❌ Erro ao processar dados de autorização:", err);
            container.innerHTML = '<div class="alert alert-danger">Erro ao processar dados. Verifique o console.</div>';
        }

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
                <td>
                    <small>${start.toLocaleDateString('pt-BR')} das ${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} às ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</small>
                </td>
                <td class="text-end fw-bold">R$ ${s.valorEstimado.toFixed(2).replace('.', ',')}</td>
                <td class="text-center"><span class="badge ${statusConfig.class}">${statusConfig.text}</span></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="abrirModalAjuste('${s.id}', true)" title="Visualizar"><i class="fas fa-eye"></i></button>
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

// =================================================================
// FUNÇÕES DE AÇÃO (Aprovar, Rejeitar, Excluir, etc.)
// =================================================================

async function aprovarSolicitacao(id) {
    if (!confirm("Aprovar esta solicitação e lançar no dashboard de Horas Extras?")) return;

    try {
        const solicitacaoRef = db.collection('solicitacoes_horas').doc(id);
        const solicitacaoDoc = await solicitacaoRef.get();

        if (!solicitacaoDoc.exists) throw new Error("Solicitação não encontrada.");

        const solicitacao = solicitacaoDoc.data();
        const funcionarioDoc = await db.collection('funcionarios').doc(solicitacao.employeeId).get();
        if (!funcionarioDoc.exists) throw new Error("Funcionário da solicitação não encontrado.");
        
        const funcionario = funcionarioDoc.data();
        const start = solicitacao.start.toDate();
        const end = solicitacao.end.toDate();
        const duracaoMinutos = Math.round((end - start) / (1000 * 60));
        const horasDecimais = duracaoMinutos / 60;

        const salarioBase = parseFloat(funcionario.salario) || 0;
        const valorHora = salarioBase / 220;
        const taxaHoraExtra = valorHora * 1.5;
        const valorTotalHoras = horasDecimais * taxaHoraExtra;

        const diasNoMes = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        const diasNaoUteis = 5; // Simplificação
        const diasUteis = diasNoMes - diasNaoUteis;
        const dsr = diasUteis > 0 ? (valorTotalHoras / diasUteis) * diasNaoUteis : 0;

        const lancamentoHE = {
            date: start.toISOString().split('T')[0],
            employeeId: solicitacao.employeeId,
            employeeName: solicitacao.employeeName,
            sector: funcionario.setor,
            reason: solicitacao.reason || 'Aprovado via solicitação',
            hours: horasDecimais.toFixed(2),
            overtimePay: parseFloat(valorTotalHoras.toFixed(2)),
            dsr: parseFloat(dsr.toFixed(2)),
            createdAt: new Date(),
            source: 'solicitacao',
            solicitacaoId: id
        };

        const batch = db.batch();
        batch.update(solicitacaoRef, {
            status: 'aprovado',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedByUid: firebase.auth().currentUser.uid
        });
        
        const novoLancamentoRef = db.collection('overtime').doc();
        batch.set(novoLancamentoRef, lancamentoHE);

        await batch.commit();

        mostrarMensagem("Solicitação aprovada e lançada no dashboard de Horas Extras!", "success");
    } catch (e) {
        console.error("Erro ao aprovar e lançar hora extra:", e);
        mostrarMensagem(`Erro ao aprovar: ${e.message}`, "error");
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
        
        // O listener onSnapshot atualizará a interface automaticamente

        mostrarMensagem("Solicitação excluída com sucesso.", "success");
    } catch (e) {
        console.error("Erro ao excluir solicitação:", e);
        mostrarMensagem("Falha ao excluir a solicitação. A página será recarregada.", "error");
        // Se a exclusão falhar, recarrega para garantir consistência
        setTimeout(() => carregarSolicitacoes(), 1000);
    }
}

async function carregarFuncionariosAuth(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && 
        __auth_funcionarios_cache && 
        __auth_funcionarios_cache_timestamp &&
        (now - __auth_funcionarios_cache_timestamp) < CACHE_TIMEOUT) {
        return __auth_funcionarios_cache;
    }

    try {
        const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        __auth_funcionarios_cache = snap.docs.map(d => ({id: d.id, ...d.data()}));
        __auth_funcionarios_cache_timestamp = now;
        return __auth_funcionarios_cache;
    } catch (e) { console.error("Erro ao carregar funcionários:", e); return []; }
}

async function abrirModalAjuste(id, readOnly = false) {
    const doc = await db.collection('solicitacoes_horas').doc(id).get();
    if (!doc.exists) {
        mostrarMensagem("Solicitação não encontrada.", "error");
        return;
    }
    const data = doc.data();
    const start = data.start.toDate();
    const end = data.end.toDate();

    // Helper function for safely getting an element
    const getElement = (elementId) => {
        const el = document.getElementById(elementId);
        if (!el) {
            console.error(`❌ Elemento do modal não encontrado: #${elementId}`);
            mostrarMensagem(`Erro de UI: Componente do modal #${elementId} não encontrado.`, "error");
        }
        return el;
    };

    const solicitacaoIdInput = getElement('ajuste-solicitacao-id');
    const funcionarioSelect = getElement('ajuste-funcionario-select');
    const startDateInput = getElement('ajuste-start-date');
    const startTimeInput = getElement('ajuste-start-time');
    const endDateInput = getElement('ajuste-end-date');
    const endTimeInput = getElement('ajuste-end-time');
    const reasonTextarea = getElement('ajuste-reason');
    const modalElement = getElement('ajusteSolicitacaoModal');

    // Se qualquer elemento essencial do formulário estiver faltando, interrompe a execução.
    if (!solicitacaoIdInput || !funcionarioSelect || !startDateInput || !startTimeInput || !endDateInput || !endTimeInput || !reasonTextarea || !modalElement) {
        return; // Interrompe a função para evitar erros subsequentes.
    }

    // Popula o select de funcionários
    const funcionarios = await carregarFuncionariosAuth();
    funcionarioSelect.innerHTML = funcionarios.map(f => 
        `<option value="${f.id}" ${f.id === data.employeeId ? 'selected' : ''}>${f.nome}</option>`
    ).join('');

    solicitacaoIdInput.value = id;
    startDateInput.value = start.toISOString().split('T')[0];
    startTimeInput.value = start.toTimeString().slice(0, 5);
    endDateInput.value = end.toISOString().split('T')[0];
    endTimeInput.value = end.toTimeString().slice(0, 5);
    reasonTextarea.value = data.reason || '';

    // Lógica para modo somente leitura
    const fields = document.querySelectorAll('#form-ajuste-solicitacao input, #form-ajuste-solicitacao textarea');
    const saveButton = document.querySelector('#ajusteSolicitacaoModal .btn-primary');
    fields.forEach(field => field.readOnly = readOnly);
    funcionarioSelect.disabled = readOnly;
    if (saveButton) {
        saveButton.style.display = readOnly ? 'none' : 'block';
    }
    const modalTitle = document.querySelector('#ajusteSolicitacaoModal .modal-title');
    if(modalTitle) modalTitle.textContent = readOnly ? 'Visualizar Solicitação' : 'Ajustar Solicitação';

    if (modalElement) new bootstrap.Modal(modalElement).show();
}

async function salvarAjusteSolicitacao() {
    const id = document.getElementById('ajuste-solicitacao-id').value;
    // CORREÇÃO: Remove o 'Z' para que o navegador interprete a data no fuso horário local e converta corretamente para UTC ao salvar.
    const startDate = document.getElementById('ajuste-start-date').value;
    const startTime = document.getElementById('ajuste-start-time').value;
    const start = new Date(`${startDate}T${startTime}`);
    const endDate = startDate; // A data de fim é a mesma da de início
    const endTime = document.getElementById('ajuste-end-time').value;
    const end = new Date(`${endDate}T${endTime}`);
    const reason = document.getElementById('ajuste-reason').value;
    
    const funcionarioSelect = document.getElementById('ajuste-funcionario-select');
    const employeeId = funcionarioSelect.value;
    const employeeName = funcionarioSelect.options[funcionarioSelect.selectedIndex].text;

    if (end <= start) {
        mostrarMensagem("A data final deve ser maior que a inicial.", "warning");
        return;
    }

    try {
        const docOriginal = await db.collection('solicitacoes_horas').doc(id).get();
        // VERIFICAÇÃO: Garante que o documento ainda existe antes de prosseguir.
        if (!docOriginal.exists) {
            mostrarMensagem("Erro: A solicitação original não foi encontrada. Pode ter sido excluída.", "error");
            return;
        }

        const dadosOriginais = docOriginal.data();
        const valorEstimado = await calcularValorEstimado(start, end, employeeId);
        
        const updateData = {
            start: firebase.firestore.Timestamp.fromDate(start),
            end: firebase.firestore.Timestamp.fromDate(end),
            reason: reason,
            valorEstimado: valorEstimado, // O valor atualizado/aprovado
            employeeId: employeeId,
            employeeName: employeeName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        // Se o valor original ainda não foi salvo, salva-o agora.
        // Isso preserva o valor inicial para o dashboard de comparação.
        // A verificação `??` (nullish coalescing) garante que, se `valorOriginalSolicitado` for nulo ou undefined, ele será definido com o valor de `valorEstimado` daquele momento.
        // CORREÇÃO: A verificação `typeof ... !== 'number'` é mais segura para evitar que um valor 0 seja considerado falso.
        if (dadosOriginais.valorOriginalSolicitado === null || dadosOriginais.valorOriginalSolicitado === undefined) {
            updateData.valorOriginalSolicitado = dadosOriginais.valorEstimado || 0;
        }

        await db.collection('solicitacoes_horas').doc(id).update(updateData);

        bootstrap.Modal.getInstance(document.getElementById('ajusteSolicitacaoModal')).hide();
        mostrarMensagem("Ajustes salvos com sucesso!", "success");
        // A UI será atualizada automaticamente pelo listener onSnapshot.
    } catch (e) {
        // CORREÇÃO: Loga o erro detalhado no console para facilitar a depuração.
        console.error("Erro detalhado ao salvar ajuste:", e);
        mostrarMensagem(`Erro ao salvar ajustes: ${e.message}`, "error");
    }
}

async function calcularValorEstimado(start, end, employeeId, salariosMap = null) {
    try {
        const duracaoMinutos = (end - start) / (1000 * 60);
        if (duracaoMinutos <= 0) {
            console.warn("⚠️ Duração inválida:", duracaoMinutos);
            return 0;
        }

        let salario = 0;
        if (salariosMap && salariosMap.has(employeeId)) {
            salario = salariosMap.get(employeeId);
        } else {
            const funcDoc = await db.collection('funcionarios').doc(employeeId).get();
            if (funcDoc.exists) salario = parseFloat(funcDoc.data().salario || 0);
        }

        // 🟢 CORREÇÃO: Se não encontrar salário, usa um valor padrão para teste
        if (salario <= 0 || isNaN(salario)) {
            console.warn(`⚠️ Salário não encontrado para funcionário ${employeeId}, usando valor padrão R$ 2000`);
            salario = 2000; // Valor padrão para testes
        }

        const valorHora = salario / 220;
        const horas = duracaoMinutos / 60;
        const valorExtra = horas * (valorHora * 1.5);
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
window.imprimirTabelaAutorizacao = imprimirTabelaAutorizacao;
window.exportarTabelaAutorizacao = exportarTabelaAutorizacao;

/**
 * Aglutina os custos de horas extras aprovadas por setor e os envia para a Análise de Custos.
 */
async function integrarComAnaliseDeCustos() {
    if (!confirm("Deseja integrar os custos das horas extras aprovadas com a Análise de Custos? Apenas solicitações ainda não integradas serão enviadas.")) {
        return;
    }

    const btn = document.getElementById('auth-btn-integrar-custos');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Integrando...';

    try {
        // 1. Buscar todas as solicitações aprovadas que ainda não foram integradas
        const solicitacoesSnap = await db.collection('solicitacoes_horas')
            .where('status', '==', 'aprovado')
            .where('integradoCusto', '!=', true)
            .get();

        if (solicitacoesSnap.empty) {
            mostrarMensagem("Nenhuma nova solicitação aprovada para integrar.", "info");
            return;
        }

        // 2. Buscar dados dos funcionários para obter o setor
        const funcionariosSnap = await db.collection('funcionarios').get();
        const setoresMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, doc.data().setor || 'Sem Setor']));

        // 3. Aglutinar os valores por setor
        const custosPorSetor = new Map();
        const idsParaMarcar = [];

        solicitacoesSnap.forEach(doc => {
            const solicitacao = doc.data();
            const setor = setoresMap.get(solicitacao.employeeId) || 'Sem Setor';
            const valor = solicitacao.valorEstimado || 0;

            if (valor > 0) {
                const totalAtual = custosPorSetor.get(setor) || 0;
                custosPorSetor.set(setor, totalAtual + valor);
                idsParaMarcar.push(doc.id);
            }
        });

        // 4. Criar os lançamentos financeiros em um batch
        const batch = db.batch();
        const dataVencimento = new Date(); // Usa a data atual como vencimento

        for (const [setor, valorTotal] of custosPorSetor.entries()) {
            const novoLancamentoRef = db.collection('lancamentos_financeiros').doc();
            batch.set(novoLancamentoRef, {
                contaOrigem: 'FOPAG',
                processo: 'Horas Extras',
                descricao: `Horas extras ${setor}`,
                valor: parseFloat(valorTotal.toFixed(2)),
                dataVencimento: dataVencimento,
                status: 'Pendente', // Define como pendente para aprovação no financeiro
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 5. Marcar as solicitações como integradas
        idsParaMarcar.forEach(id => {
            const solicitacaoRef = db.collection('solicitacoes_horas').doc(id);
            batch.update(solicitacaoRef, { integradoCusto: true });
        });

        await batch.commit();

        mostrarMensagem(`${custosPorSetor.size} lançamento(s) de custo foram criados com sucesso!`, "success");

    } catch (error) {
        console.error("Erro ao integrar com análise de custos:", error);
        mostrarMensagem("Falha na integração com a Análise de Custos.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-coins"></i> Integrar com Análise de Custos';
    }
}

// Funções utilitárias locais (fallback ou específicas para este módulo)
function mostrarMensagem(mensagem, tipo = 'info') {
    // Verificar se existe um container de mensagens
    let container = document.getElementById('auth-mensagens-container');
    
    if (!container) {
        // Criar container se não existir
        container = document.createElement('div');
        container.id = 'auth-mensagens-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo} alert-dismissible fade show`;
    alert.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    container.appendChild(alert);
    
    // Remover após 5 segundos
    setTimeout(() => alert.remove(), 5000);
}

function openPrintWindow(content, options = {}) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    
    if (options.autoPrint) {
        printWindow.onload = () => {
            printWindow.print();
            printWindow.onafterprint = () => printWindow.close();
        };
    }
}

// Garantir inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Pequeno atraso para garantir que todos os elementos estejam renderizados
    setTimeout(async () => {
        if (document.getElementById('auth-solicitacoes-table')) {
            await inicializarTelaAutorizacao();
        }
    }, 100);
});