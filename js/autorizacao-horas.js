// =================================================================
// Módulo de Autorização de Horas Extras (Visão da Controladoria)
// Design e Funcionalidades Aprimorados
// =================================================================

let listenerAutorizacao = null;
let cacheSolicitacoes = [];
let __auth_funcionarios_cache = null;
let __auth_funcionarios_cache_timestamp = null;
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// Cache para dados de setores, gerentes e macros
let __auth_setores_cache = null;
let __auth_macro_setores_cache = null;
let __auth_funcionarios_map = null;

/**
 * Carrega dados auxiliares (setores, gerentes, macros) para o módulo de autorização
 */
async function carregarDadosAuxiliaresAuth() {
    if (__auth_setores_cache && __auth_macro_setores_cache && __auth_funcionarios_map) {
        return; // Dados já em cache
    }
    
    try {
        // Carrega setores
        const setoresSnap = await db.collection('setores').get();
        __auth_setores_cache = new Map();
        setoresSnap.forEach(doc => {
            const data = doc.data();
            __auth_setores_cache.set(data.descricao, {
                id: doc.id,
                descricao: data.descricao,
                gerenteId: data.gerenteId || null,
                empresaId: data.empresaId
            });
        });
        
        // Carrega macro setores
        const macroSetoresSnap = await db.collection('macro_setores').get();
        __auth_macro_setores_cache = new Map();
        // Mapeia cada setorId ao nome do macro setor
        macroSetoresSnap.forEach(doc => {
            const macroData = doc.data();
            const setoresIds = macroData.setoresIds || [];
            setoresIds.forEach(setorId => {
                __auth_macro_setores_cache.set(setorId, macroData.nome);
            });
        });
        
        // Carrega funcionários para obter nomes de gerentes
        const funcionariosSnap = await db.collection('funcionarios').get();
        __auth_funcionarios_map = new Map();
        funcionariosSnap.forEach(doc => {
            __auth_funcionarios_map.set(doc.id, doc.data().nome);
        });
        
        console.log("Dados auxiliares carregados para autorização de HE");
    } catch (error) {
        console.error("Erro ao carregar dados auxiliares:", error);
    }
}

/**
 * Obtém o nome do gerente responsável por um setor
 */
function obterNomeGerenteSetor(setorNome) {
    if (!setorNome || !__auth_setores_cache) return 'N/A';
    
    const setor = __auth_setores_cache.get(setorNome);
    if (!setor || !setor.gerenteId) return 'N/A';
    
    return __auth_funcionarios_map?.get(setor.gerenteId) || 'N/A';
}

/**
 * Obtém o nome do setor macro para um setor
 */
function obterNomeMacroSetor(setorNome) {
    if (!setorNome || !__auth_setores_cache) return 'Sem Macro';
    
    const setor = __auth_setores_cache.get(setorNome);
    if (!setor) return 'Sem Macro';
    
    const macroNome = __auth_macro_setores_cache?.get(setor.id);
    return macroNome || 'Sem Macro';
}

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

    const btnHolerite = document.getElementById('auth-btn-holerite');
    if (btnHolerite && !btnHolerite.bound) {
        btnHolerite.addEventListener('click', imprimirHoleritesHE);
        btnHolerite.bound = true;
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

    const btnReprocessarTudo = document.getElementById('auth-btn-reprocessar-tudo');
    if (btnReprocessarTudo && !btnReprocessarTudo.bound) {
        btnReprocessarTudo.addEventListener('click', reprocessarTudoVisivel);
        btnReprocessarTudo.bound = true;
    }

    // Adiciona listeners para atualizar automaticamente ao mudar filtros
    ['auth-filtro-funcionario', 'auth-filtro-setor', 'auth-filtro-status', 'auth-filtro-pagamento'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.bound) {
            el.addEventListener('change', carregarSolicitacoes);
            el.bound = true;
        }
    });

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

        // Popula filtro de setores
        setorSelect.innerHTML = '<option value="">Todos os Setores</option>';
        [...setores].sort().forEach(setor => {
            setorSelect.innerHTML += `<option value="${setor}">${setor}</option>`;
        });

        // Popula filtro de funcionários
        const funcionarioSelect = document.getElementById('auth-filtro-funcionario');
        if (funcionarioSelect) {
            const funcionarios = await carregarFuncionariosAuth();
            funcionarioSelect.innerHTML = '<option value="">Todos os Funcionários</option>';
            funcionarios.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(f => {
                funcionarioSelect.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
            });
        }

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

    // Carrega dados auxiliares (setores, gerentes, macros)
    await carregarDadosAuxiliaresAuth();

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
    const funcionarioId = document.getElementById('auth-filtro-funcionario')?.value; // Novo: Filtro por funcionário
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

                // Adiciona o nome do gerente responsável (solicitante)
                data.gerenteResponsavel = obterNomeGerenteSetor(data.setor);
                
                // Adiciona o setor macro
                data.setorMacro = obterNomeMacroSetor(data.setor);

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

            // Aplica filtro de funcionário no lado do cliente
            if (funcionarioId) {
                solicitacoesProcessadas = solicitacoesProcessadas.filter(s => s.employeeId === funcionarioId);
            }

            // Aplica filtro de status no lado do cliente para evitar erro de índice e garantir consistência
            if (status) {
                solicitacoesProcessadas = solicitacoesProcessadas.filter(s => s.status === status);
            }

            // Aplica filtro de pagamento no lado do cliente
            const pagamento = document.getElementById('auth-filtro-pagamento').value;
            if (pagamento) {
                solicitacoesProcessadas = solicitacoesProcessadas.filter(s => s.formaPagamento === pagamento);
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
                        <th>Setor</th>
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
                <td>${s.setor || 'N/A'}</td>
                <td>
                    <small>${start.toLocaleDateString('pt-BR')} das ${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} às ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</small>
                </td>
                <td class="text-end fw-bold">R$ ${s.valorEstimado.toFixed(2).replace('.', ',')}</td>
                <td class="text-center"><span class="badge ${statusConfig.class}">${statusConfig.text}</span></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="abrirModalAjuste('${s.id}', true)" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-outline-primary" onclick="reprocessarUmaSolicitacao('${s.id}')" title="Recalcular"><i class="fas fa-sync"></i></button>
                        <button class="btn btn-outline-primary" onclick="abrirModalAjuste('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        ${s.status === 'pendente' ? `
                            <button class="btn btn-success" onclick="aprovarSolicitacao('${s.id}')" title="Aprovar"><i class="fas fa-check"></i></button>
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
        const totalHorasReais = duracaoMinutos / 60;
        const horasFakeDecimais = trueDecimalToFakeDecimal(totalHorasReais);

        const salarioBase = parseFloat(funcionario.salario) || 0;
        const valorHora = salarioBase / 220;
        const taxaHoraExtra = valorHora * 1.5;
        const valorTotalHoras = horasFakeDecimais * taxaHoraExtra;

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
            hours: horasFakeDecimais,
            overtimePay: parseFloat(valorTotalHoras.toFixed(2)),
            dsr: parseFloat(dsr.toFixed(2)),
            createdAt: new Date(),
            source: 'solicitacao',
            solicitacaoId: id,
            formaPagamento: solicitacao.formaPagamento || 'por-fora'
        };

        const batch = db.batch();
        batch.update(solicitacaoRef, {
            status: 'aprovado',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedByUid: firebase.auth().currentUser.uid,
            formaPagamento: solicitacao.formaPagamento || 'por-fora'
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

    // Carrega dados auxiliares para obter o setor
    await carregarDadosAuxiliaresAuth();

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
    const setorInput = getElement('ajuste-setor');
    const startDateInput = getElement('ajuste-start-date');
    const startTimeInput = getElement('ajuste-start-time');
    const endDateInput = getElement('ajuste-end-date');
    const endTimeInput = getElement('ajuste-end-time');
    const reasonTextarea = getElement('ajuste-reason');
    const modalElement = getElement('ajusteSolicitacaoModal');

    // Se qualquer elemento essencial do formulário estiver faltando, interrompe a execução.
    if (!solicitacaoIdInput || !funcionarioSelect || !setorInput || !startDateInput || !startTimeInput || !endDateInput || !endTimeInput || !reasonTextarea || !modalElement) {
        return; // Interrompe a função para evitar erros subsequentes.
    }

    // Carrega funcionários para o select
    const funcionarios = await carregarFuncionariosAuth();
    
    // Popula o select de funcionários incluindo dados do setor
    const funcionariosComSetor = await Promise.all(funcionarios.map(async (f) => {
        // Tenta obter o setor do funcionário a partir do cache de setores
        let setorNome = '';
        if (__auth_setores_cache) {
            for (const [descricao, setorData] of __auth_setores_cache) {
                // O setor pode estar em diferentes campos, tentamos buscar pelo ID
            }
        }
        return { ...f };
    }));
    
    // Precisamos buscar o setor do funcionário selecionado
    const funcDoc = await db.collection('funcionarios').doc(data.employeeId).get();
    const setorFuncionario = funcDoc.exists ? (funcDoc.data().setor || '') : '';
    
    // Preenche o select
    funcionarioSelect.innerHTML = funcionarios.map(f => 
        `<option value="${f.id}" data-setor="${f.setor || ''}" ${f.id === data.employeeId ? 'selected' : ''}>${f.nome}</option>`
    ).join('');

    // Preenche o campo Setor (lendo do funcionário diretamente)
    setorInput.value = setorFuncionario;

    solicitacaoIdInput.value = id;
    startDateInput.value = start.toISOString().split('T')[0];
    startTimeInput.value = start.toTimeString().slice(0, 5);
    endDateInput.value = end.toISOString().split('T')[0];
    endTimeInput.value = end.toTimeString().slice(0, 5);
    reasonTextarea.value = data.reason || '';

    // Preenche forma de pagamento
    const formaPagamentoSelect = getElement('ajuste-forma-pagamento');
    if (formaPagamentoSelect) {
        formaPagamentoSelect.value = data.formaPagamento || 'por-fora';
    }

    // Adiciona listener para atualizar setor quando mudar o funcionário
    if (!readOnly) {
        const previousHandler = funcionarioSelect._changeHandler;
        if (previousHandler) {
            funcionarioSelect.removeEventListener('change', previousHandler);
        }
        
        const changeHandler = async (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const novoSetor = selectedOption.dataset.setor || '';
            setorInput.value = novoSetor;
        };
        
        changeHandler._isCustomHandler = true;
        funcionarioSelect.addEventListener('change', changeHandler);
        funcionarioSelect._changeHandler = changeHandler;
    }

    // Lógica para modo somente leitura
    const fields = document.querySelectorAll('#form-ajuste-solicitacao input, #form-ajuste-solicitacao textarea');
    const saveButton = document.querySelector('#ajusteSolicitacaoModal .btn-primary');
    fields.forEach(field => field.readOnly = readOnly);
    if (setorInput) setorInput.readOnly = true; // Setor é sempre somente leitura
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
            formaPagamento: document.getElementById('ajuste-forma-pagamento').value || 'por-fora',
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

        if (salario <= 0 || isNaN(salario)) {
            // Se não houver salário, não retorna erro mas loga
            return 0;
        }

        const valorHora = salario / 220;
        const totalHorasReais = duracaoMinutos / 60;
        const horasFakeDecimais = trueDecimalToFakeDecimal(totalHorasReais);
        const valorExtra = horasFakeDecimais * (valorHora * 1.5);
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
    if (!tabela) {
        mostrarMensagem("Tabela não encontrada para impressão.", "warning");
        return;
    }

    // Obter dados do cache para incluir informações extras
    const dados = cacheSolicitacoes || [];
    
    if (dados.length === 0) {
        mostrarMensagem("Não há dados para imprimir.", "warning");
        return;
    }
    
    // Data atual formatada
    const dataAtual = new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Obter filtros ativos para exibir no relatório
    const filtroStatus = document.getElementById('auth-filtro-status')?.value || 'Todos';
    const filtroSetor = document.getElementById('auth-filtro-setor')?.value || 'Todos';
    const filtroDataInicio = document.getElementById('auth-filtro-data-inicio')?.value || '';
    const filtroDataFim = document.getElementById('auth-filtro-data-fim')?.value || '';
    
    const periodoFormatado = filtroDataInicio && filtroDataFim 
        ? `${filtroDataInicio} a ${filtroDataFim}` 
        : 'Período não especificado';

    // Ordenar dados por setor macro
    dados.sort((a, b) => {
        const macroA = a.setorMacro || 'Sem Macro';
        const macroB = b.setorMacro || 'Sem Macro';
        if (macroA !== macroB) return macroA.localeCompare(macroB);
        return (a.setor || '').localeCompare(b.setor || '');
    });

    // Calcular totais
    const totalGeral = dados.reduce((acc, s) => acc + (s.valorEstimado || 0), 0);
    const totalAprovadas = dados.filter(s => s.status === 'aprovado').reduce((acc, s) => acc + (s.valorEstimado || 0), 0);
    const totalPendentes = dados.filter(s => s.status === 'pendente').reduce((acc, s) => acc + (s.valorEstimado || 0), 0);
    const totalRejeitadas = dados.filter(s => s.status === 'rejeitado').reduce((acc, s) => acc + (s.valorEstimado || 0), 0);

    // Agrupar por setor macro
    const dadosPorMacro = {};
    dados.forEach(s => {
        const macro = s.setorMacro || 'Sem Macro';
        if (!dadosPorMacro[macro]) {
            dadosPorMacro[macro] = {
                total: 0,
                solicitacoes: []
            };
        }
        dadosPorMacro[macro].solicitacoes.push(s);
        dadosPorMacro[macro].total += (s.valorEstimado || 0);
    });

    // Gerar HTML da tabela com solicitante e separação por macro setor
    let htmlTabela = '';
    
    // Cabeçalho da tabela
    htmlTabela += `
        <thead style="background-color: #2c3e50; color: white;">
            <tr>
                <th style="padding: 12px; text-align: left;">Data</th>
                <th style="padding: 12px; text-align: left;">Funcionário</th>
                <th style="padding: 12px; text-align: left;">Setor</th>
                <th style="padding: 12px; text-align: left;">Solicitante</th>
                <th style="padding: 12px; text-align: left;">Período</th>
                <th style="padding: 12px; text-align: left;">Motivo</th>
                <th style="padding: 12px; text-align: center;">Status</th>
                <th style="padding: 12px; text-align: right;">Valor</th>
            </tr>
        </thead>
        <tbody>`;

    // Gerar linhas por setor macro
    Object.keys(dadosPorMacro).sort().forEach(macroNome => {
        const macroData = dadosPorMacro[macroNome];
        
        // Linha de cabeçalho do setor macro
        htmlTabela += `
            <tr style="background-color: #e9ecef; font-weight: bold;">
                <td colspan="7" style="padding: 12px; border-top: 2px solid #2c3e50;">
                    <i class="fas fa-layer-group me-2"></i>${macroNome}
                </td>
                <td style="padding: 12px; text-align: right; border-top: 2px solid #2c3e50; font-weight: bold;">
                    R$ ${macroData.total.toFixed(2).replace('.', ',')}
                </td>
            </tr>`;
        
        // Linhas de solicitações
        macroData.solicitacoes.forEach(s => {
            const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
            const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
            const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
            
            const statusConfig = {
                'pendente': { class: '#ffc107', text: 'Pendente', color: '#856404' },
                'aprovado': { class: '#28a745', text: 'Aprovado', color: '#155724' },
                'rejeitado': { class: '#dc3545', text: 'Rejeitado', color: '#721c24' },
                'cancelado': { class: '#6c757d', text: 'Cancelado', color: '#383d41' }
            }[s.status] || { class: '#6c757d', text: s.status, color: '#383d41' };

            const motivo = s.reason || 'Não especificado';
            const solicitante = s.gerenteResponsavel || 'N/A';
            
            htmlTabela += `
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 10px;">${createdAt.toLocaleDateString('pt-BR')}</td>
                    <td style="padding: 10px;"><strong>${s.employeeName || 'N/A'}</strong></td>
                    <td style="padding: 10px;">${s.setor || 'N/A'}</td>
                    <td style="padding: 10px;">${solicitante}</td>
                    <td style="padding: 10px;">
                        ${start.toLocaleDateString('pt-BR')} das ${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} às ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td style="padding: 10px; max-width: 200px;">${motivo}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background-color: ${statusConfig.class}; color: ${statusConfig.color}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                            ${statusConfig.text}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">R$ ${(s.valorEstimado || 0).toFixed(2).replace('.', ',')}</td>
                </tr>`;
        });
    });

    htmlTabela += `
        </tbody>
        <tfoot style="background-color: #f8f9fa; font-weight: bold;">
            <tr>
                <td colspan="7" style="padding: 12px; text-align: right;">Total Geral:</td>
                <td style="padding: 12px; text-align: right; font-size: 14px;">R$ ${totalGeral.toFixed(2).replace('.', ',')}</td>
            </tr>
        </tfoot>`;

    const conteudo = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Autorização de Horas Extras</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
            <style>
                @page { size: landscape; margin: 0.5cm; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 20px; 
                    color: #333;
                    font-size: 12px;
                }
                .header-report {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 3px solid #2c3e50;
                }
                .header-report h1 {
                    color: #2c3e50;
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }
                .header-report .logo {
                    font-size: 28px;
                    color: #2c3e50;
                }
                .info-filtros {
                    background: linear-gradient(to right, #f8f9fa, #e9ecef);
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border-left: 4px solid #2c3e50;
                }
                .info-filtros .label {
                    font-weight: 600;
                    color: #495057;
                }
                .info-filtros .value {
                    color: #2c3e50;
                }
                .resumo-cards {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    gap: 15px;
                }
                .resumo-card {
                    flex: 1;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .resumo-card.aprovado { background: linear-gradient(135deg, #d4edda, #c3e6cb); border: 1px solid #28a745; }
                .resumo-card.pendente { background: linear-gradient(135deg, #fff3cd, #ffeeba); border: 1px solid #ffc107; }
                .resumo-card.rejeitado { background: linear-gradient(135deg, #f8d7da, #f5c6cb); border: 1px solid #dc3545; }
                .resumo-card.geral { background: linear-gradient(135deg, #e2e3e5, #d6d8db); border: 1px solid #6c757d; }
                .resumo-card .valor { font-size: 18px; font-weight: bold; }
                .resumo-card .titulo { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
                
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 11px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .table thead th {
                    background-color: #2c3e50 !important;
                    color: white !important;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                }
                .table tbody tr:hover {
                    background-color: #f8f9fa;
                }
                .footer-report {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 2px solid #dee2e6;
                    text-align: center;
                    color: #6c757d;
                    font-size: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header-report">
                <div>
                    <h1><i class="fas fa-clock"></i> Relatório de Autorização de Horas Extras</h1>
                    <p style="margin: 5px 0 0 0; color: #6c757d;">Nexter - Sistema de Gestão de RH</p>
                </div>
                <div class="logo">
                    <i class="fas fa-building"></i>
                </div>
            </div>

            <div class="info-filtros">
                <div class="row">
                    <div class="col-md-3">
                        <span class="label">Data de Emissão:</span>
                        <span class="value">${dataAtual}</span>
                    </div>
                    <div class="col-md-3">
                        <span class="label">Período:</span>
                        <span class="value">${periodoFormatado}</span>
                    </div>
                    <div class="col-md-3">
                        <span class="label">Setor:</span>
                        <span class="value">${filtroSetor}</span>
                    </div>
                    <div class="col-md-3">
                        <span class="label">Status:</span>
                        <span class="value">${filtroStatus === 'pendente' ? 'Pendente' : filtroStatus === 'aprovado' ? 'Aprovado' : filtroStatus === 'rejeitado' ? 'Rejeitado' : 'Todos'}</span>
                    </div>
                </div>
            </div>

            <div class="resumo-cards">
                <div class="resumo-card aprovado">
                    <div class="titulo">Aprovadas</div>
                    <div class="valor">R$ ${totalAprovadas.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="resumo-card pendente">
                    <div class="titulo">Pendentes</div>
                    <div class="valor">R$ ${totalPendentes.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="resumo-card rejeitado">
                    <div class="titulo">Rejeitadas</div>
                    <div class="valor">R$ ${totalRejeitadas.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="resumo-card geral">
                    <div class="titulo">Total Geral</div>
                    <div class="valor">R$ ${totalGeral.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>

            <table class="table table-bordered table-striped">
                ${htmlTabela}
            </table>

            <div class="footer-report">
                <p>Relatório gerado automaticamente pelo Sistema Nexter em ${dataAtual}</p>
                <p>Total de registros: ${dados.length}</p>
            </div>
        </body>
        </html>`;

    openPrintWindow(conteudo, { autoPrint: true });
}

function exportarTabelaAutorizacao() {
    if (!cacheSolicitacoes || cacheSolicitacoes.length === 0) {
        mostrarMensagem("Não há dados para exportar. Por favor, filtre as solicitações primeiro.", "warning");
        return;
    }

    // 1. Preparar os dados para a planilha, incluindo a forma de pagamento
    const dadosExportacao = cacheSolicitacoes.map(s => {
        const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
        const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
        const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
        const duracao = Math.max(0, (end - start) / 3600000); // Diferença em horas decimais
        const horasFakeDecimais = trueDecimalToFakeDecimal(duracao);

        return {
            "Data Solicitação": createdAt.toLocaleDateString('pt-BR'),
            "Funcionário": s.employeeName || 'N/A',
            "Setor": s.setor || 'N/A',
            "Período": `${start.toLocaleDateString('pt-BR')} ${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`,
            "Horas": fakeDecimalToHHmm(horasFakeDecimais),
            "Horas Decimais": Number(horasFakeDecimais.toFixed(2)),
            "Motivo": s.reason || 'Não especificado',
            "Valor Estimado": s.valorEstimado || 0,
            "Status": s.status,
            "Forma de Pagamento": s.formaPagamento === 'folha' ? 'Folha' : 'Por Fora'
        };
    });

    // 2. Preparar os dados de resumo por colaborador (Horas Acumuladas)
    const resumoMap = {};
    cacheSolicitacoes.forEach(s => {
        const id = s.employeeId || s.employeeName;
        const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
        const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
        const duracaoHoras = Math.max(0, (end - start) / 3600000); // 1000 * 60 * 60
        const horasFakeDecimais = trueDecimalToFakeDecimal(duracaoHoras);

        if (!resumoMap[id]) {
            resumoMap[id] = {
                "Colaborador": s.employeeName || 'N/A',
                "Setor": s.setor || 'N/A',
                "Total Horas Acumuladas": 0,
                "Total Valor Estimado": 0,
                "Qtd. Solicitações": 0
            };
        }
        resumoMap[id]["Total Horas Acumuladas"] += horasFakeDecimais;
        resumoMap[id]["Total Valor Estimado"] += (s.valorEstimado || 0);
        resumoMap[id]["Qtd. Solicitações"] += 1;
    });

    // Arredondar para evitar problemas de ponto flutuante antes de ordenar
    Object.values(resumoMap).forEach(r => {
        r["Total Horas Acumuladas"] = Number(r["Total Horas Acumuladas"].toFixed(2));
    });

    const dadosResumo = Object.values(resumoMap).sort((a, b) => b["Total Horas Acumuladas"] - a["Total Horas Acumuladas"]);

    // 3. Calcular totais gerais para as linhas de rodapé
    const totalGeral = cacheSolicitacoes.reduce((acc, s) => acc + (s.valorEstimado || 0), 0);
    const totalHorasGeral = Number(Object.values(resumoMap).reduce((acc, r) => acc + r["Total Horas Acumuladas"], 0).toFixed(2));

    // 4. Criar o workbook e as planilhas
    const wb = XLSX.utils.book_new();

    // --- Aba 1: Resumo por Colaborador (Horas Acumuladas) ---
    const wsResumo = XLSX.utils.json_to_sheet(dadosResumo);
    XLSX.utils.sheet_add_aoa(wsResumo, [[]], { origin: -1 });
    XLSX.utils.sheet_add_aoa(wsResumo, [["TOTAL GERAL:", "", totalHorasGeral, totalGeral]], { origin: -1 });

    // Formatação na Aba de Resumo
    const rangeResumo = XLSX.utils.decode_range(wsResumo['!ref']);
    for (let R = 1; R <= rangeResumo.e.r; ++R) {
        // Coluna C (Índice 2): Horas Acumuladas
        const cellH = wsResumo[XLSX.utils.encode_cell({c: 2, r: R})];
        if (cellH && typeof cellH.v === 'number') cellH.z = '0.00';
        
        // Coluna D (Índice 3): Valor Total
        const cellV = wsResumo[XLSX.utils.encode_cell({c: 3, r: R})];
        if (cellV && typeof cellV.v === 'number') cellV.z = 'R$ #,##0.00';
    }
    wsResumo['!cols'] = [ { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 } ];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por Colaborador");

    // --- Aba 2: Lista Detalhada (Registro a Registro) ---
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    XLSX.utils.sheet_add_aoa(ws, [[]], { origin: -1 });
    XLSX.utils.sheet_add_aoa(ws, [["", "", "", "", "", "TOTAL GERAL:", totalGeral]], { origin: -1 });
    
    // Formatação de Moeda na Aba de Detalhes (Agora na Coluna G - Índice 6 devido à nova coluna 'Horas')
    const rangeWs = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= rangeWs.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({c: 6, r: R})];
        if (cell && typeof cell.v === 'number') cell.z = 'R$ #,##0.00';
    }
    ws['!cols'] = [ { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 20 } ];
    XLSX.utils.book_append_sheet(wb, ws, "Lista Detalhada");

    // 5. Salvar o arquivo final
    XLSX.writeFile(wb, "Relatorio_Autorizacoes_HE.xlsx");
    mostrarMensagem("Exportado para Excel com sucesso!", "success");
}

// Adiciona a dependência do XLSX (SheetJS) se não existir
if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
    document.head.appendChild(script);
}

/**
 * Gera e imprime recibos (holerites) de horas extras acumuladas por colaborador.
 */
async function imprimirHoleritesHE() {
    if (!cacheSolicitacoes || cacheSolicitacoes.length === 0) {
        mostrarMensagem("Não há solicitações filtradas para gerar holerites.", "warning");
        return;
    }

    // Filtrar apenas solicitações aprovadas, a menos que o usuário queira todas
    let solicitacoesParaProcessar = cacheSolicitacoes.filter(s => s.status === 'aprovado');
    
    if (solicitacoesParaProcessar.length === 0) {
        if (confirm("Não há solicitações APROVADAS no período. Deseja imprimir holerites de todas as solicitações visíveis (pendentes + aprovadas)?")) {
            solicitacoesParaProcessar = cacheSolicitacoes;
        } else {
            return;
        }
    }

    const dataPagamentoFiltro = document.getElementById('auth-filtro-data-pagamento')?.value;
    const dataPagamentoFormatada = dataPagamentoFiltro 
        ? new Date(dataPagamentoFiltro + 'T12:00:00').toLocaleDateString('pt-BR') 
        : '___/___/____';

    mostrarMensagem("Gerando holerites e extratos...", "info");

    // 1. Agrupar solicitações por funcionário
    const colaboradoresMap = {};
    
    // Precisamos dos salários para calcular HE e DSR separadamente se não estiverem no doc
    const funcionariosSnap = await db.collection('funcionarios').get();
    const infoFuncionarios = {};
    funcionariosSnap.forEach(doc => {
        const data = doc.data();
        infoFuncionarios[doc.id] = {
            nome: data.nome,
            setor: data.setor,
            salario: parseFloat(data.salario || 0),
            matricula: data.matricula || '---'
        };
    });

    solicitacoesParaProcessar.forEach(s => {
        const empId = s.employeeId;
        if (!colaboradoresMap[empId]) {
            colaboradoresMap[empId] = {
                id: empId,
                nome: s.employeeName || (infoFuncionarios[empId]?.nome || 'Desconhecido'),
                setor: s.setor || (infoFuncionarios[empId]?.setor || 'N/A'),
                matricula: infoFuncionarios[empId]?.matricula || '---',
                totalMinutos: 0,
                totalFakeDecimais: 0,
                totalHE: 0,
                totalDSR: 0,
                totalGeral: 0,
                qtdSolicitacoes: 0,
                detalhes: []
            };
        }

        const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
        const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
        const duracaoMinutos = Math.max(0, (end - start) / (1000 * 60));
        
        // Recalcular componentes para precisão no holerite
        const salario = infoFuncionarios[empId]?.salario || 0;
        const valorHora = salario / 220;
        const totalHorasReais = duracaoMinutos / 60;
        const horasFakeDecimais = trueDecimalToFakeDecimal(totalHorasReais);
        const valorExtra = horasFakeDecimais * (valorHora * 1.5);
        const dsr = valorExtra / 6; // Mantendo a lógica simplificada do sistema

        colaboradoresMap[empId].totalMinutos += duracaoMinutos;
        colaboradoresMap[empId].totalFakeDecimais += horasFakeDecimais;
        colaboradoresMap[empId].totalHE += valorExtra;
        colaboradoresMap[empId].totalDSR += dsr;
        colaboradoresMap[empId].totalGeral += (valorExtra + dsr);
        colaboradoresMap[empId].qtdSolicitacoes++;
        colaboradoresMap[empId].detalhes.push({
            data: start.toLocaleDateString('pt-BR'),
            horas: fakeDecimalToHHmm(horasFakeDecimais),
            horasDecimais: horasFakeDecimais.toFixed(2),
            periodo: `${start.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`,
            motivo: s.reason || 'S/ Motivo',
            valorHE: valorExtra.toFixed(2),
            valorDSR: dsr.toFixed(2),
            valorTotal: (valorExtra + dsr).toFixed(2)
        });
    });

    const listaColaboradores = Object.values(colaboradoresMap).sort((a, b) => a.nome.localeCompare(b.nome));
    
    // 2. Gerar o HTML para a janela de impressão
    const dataEmissao = new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', month: 'long', year: 'numeric' 
    });

    const filtroDataInicio = document.getElementById('auth-filtro-data-inicio')?.value || '';
    const filtroDataFim = document.getElementById('auth-filtro-data-fim')?.value || '';
    const periodoStr = filtroDataInicio && filtroDataFim 
        ? `Período: ${filtroDataInicio.split('-').reverse().join('/')} a ${filtroDataFim.split('-').reverse().join('/')}`
        : 'Período Acumulado';

    let htmlHolerites = '';

    listaColaboradores.forEach((c) => {
        const totalHorasFake = Number(c.totalFakeDecimais.toFixed(2));
        const totalHorasFormatado = fakeDecimalToHHmm(totalHorasFake);
        
        // Ordenar detalhes por data
        c.detalhes.sort((a, b) => {
            const dateA = a.data.split('/').reverse().join('');
            const dateB = b.data.split('/').reverse().join('');
            return dateA.localeCompare(dateB);
        });

        htmlHolerites += `
        <div class="holerite-container">
            <div class="holerite-box">
                <!-- CABEÇALHO -->
                <div class="header-recibo">
                    <div class="empresa-info">
                        <h2 class="m-0">CALÇADOS CRIVAL</h2>
                        <p class="m-0 text-muted" style="font-size: 10px;">CNPJ: 00.320.320/0001-32 | TEL: (32) 3232-3232</p>
                        <p class="m-0 text-muted" style="font-size: 10px;">SISTEMA NEXTER - GESTÃO DE RECURSOS HUMANOS</p>
                    </div>
                    <div class="recibo-tipo">
                        <div class="recibo-titulo">RECIBO DE PAGAMENTO</div>
                        <div class="recibo-sub">HORAS EXTRAS ACUMULADAS</div>
                    </div>
                </div>

                <!-- DADOS DO COLABORADOR -->
                <div class="secao-dados mb-3">
                    <div class="row g-0">
                        <div class="col-6 border-end border-dark p-2">
                            <label>COLABORADOR</label>
                            <div class="info-val fw-bold">${c.nome}</div>
                        </div>
                        <div class="col-3 border-end border-dark p-2">
                            <label>MATRÍCULA</label>
                            <div class="info-val">${c.matricula}</div>
                        </div>
                        <div class="col-3 p-2">
                            <label>SETOR</label>
                            <div class="info-val">${c.setor}</div>
                        </div>
                    </div>
                    <div class="row g-0 border-top border-dark">
                        <div class="col-6 border-end border-dark p-2">
                            <label>PAGAMENTO REFERENTE A</label>
                            <div class="info-val">${periodoStr}</div>
                        </div>
                        <div class="col-3 border-end border-dark p-2">
                            <label>DATA PAGTO (EST.)</label>
                            <div class="info-val">${new Date().toLocaleDateString('pt-BR')}</div>
                        </div>
                        <div class="col-3 p-2 text-center">
                            <label>VIA</label>
                            <div class="info-val">ORIGINAL</div>
                        </div>
                    </div>
                </div>

                <!-- TABELA DE VENCIMENTOS -->
                <table class="tabela-holerite w-100 mb-3">
                    <thead>
                        <tr>
                            <th style="width: 10%;">CÓD.</th>
                            <th style="width: 50%;">DESCRIÇÃO DA VERBA</th>
                            <th style="width: 15%; text-align: center;">REF.</th>
                            <th style="width: 25%; text-align: right;">VENCIMENTOS</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="text-center">0020</td>
                            <td>HORA EXTRA 50% ACUMULADA</td>
                            <td class="text-center">${totalHorasFormatado}</td>
                            <td class="text-end">R$ ${c.totalHE.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td class="text-center">0050</td>
                            <td>DSR S/ HORA EXTRA</td>
                            <td class="text-center">1/6</td>
                            <td class="text-end">R$ ${c.totalDSR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        ${new Array(4).fill('<tr><td class="empty-cell">&nbsp;</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>').join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-end fw-bold p-2">TOTAL BRUTO:</td>
                            <td class="text-end fw-bold p-2">R$ ${c.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr class="liquid-row">
                            <td colspan="3" class="text-end liquid-label">LÍQUIDO A RECEBER:</td>
                            <td class="text-end liquid-val">R$ ${c.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>

                <!-- ASSINATURA -->
                <div class="secao-assinatura">
                    <div class="declaracao">
                        Declaro ter recebido a importância líquida discriminada neste recibo, referente ao pagamento das horas extras acima descritas.
                    </div>
                    <div class="assinatura-box">
                        <div class="campo-data">_____/_____/_________</div>
                        <div class="campo-assinatura">Assinatura do Colaborador</div>
                    </div>
                </div>
            </div>

            <!-- EXTRATO DETALHADO -->
            <div class="extrato-box mt-4">
                <div class="extrato-header">
                    EXTRATO DETALHADO DE HORAS EXTRAS (ANEXO)
                </div>
                <table class="tabela-extrato">
                    <thead>
                        <tr>
                            <th>DATA</th>
                            <th>PERÍODO</th>
                            <th class="text-center">HORAS</th>
                            <th class="text-end">VLR. HE</th>
                            <th class="text-end">DSR</th>
                            <th class="text-end">TOTAL</th>
                            <th>MOTIVO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${c.detalhes.map(d => `
                        <tr>
                            <td>${d.data}</td>
                            <td><small>${d.periodo}</small></td>
                            <td class="text-center fw-bold">${d.horas}</td>
                            <td class="text-end">R$ ${d.valorHE.replace('.', ',')}</td>
                            <td class="text-end">R$ ${d.valorDSR.replace('.', ',')}</td>
                            <td class="text-end fw-bold">R$ ${d.valorTotal.replace('.', ',')}</td>
                            <td><small>${d.motivo}</small></td>
                        </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-end fw-bold">TOTAIS:</td>
                            <td class="text-center fw-bold">${totalHorasFormatado}</td>
                            <td class="text-end fw-bold">R$ ${c.totalHE.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td class="text-end fw-bold">R$ ${c.totalDSR.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td class="text-end fw-bold">R$ ${c.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                <div class="print-footer">
                    <span>Emitido em ${dataEmissao} - Sistema Nexter</span>
                    <span class="ps-3 border-start text-muted">ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                </div>
            </div>
        </div>`;
    });

    const fullHTML = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Recibos de Horas Extras</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            @media print {
                body { padding: 0 !important; background: white !important; }
                .no-print { display: none !important; }
                .holerite-container { page-break-after: always; padding: 0 !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
                @page { size: A4; margin: 1cm; }
            }
            
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #eee; padding: 40px 0; color: #000; }
            
            .holerite-container { 
                background: #fff; 
                width: 210mm; 
                min-height: 290mm;
                margin: 0 auto 40px auto; 
                padding: 1.5cm; 
                box-shadow: 0 0 20px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
            }

            .holerite-box { border: 2px solid #000; padding: 15px; margin-bottom: 20px; }
            
            .header-recibo { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
            .empresa-info h2 { font-size: 24px; font-weight: 800; color: #000; margin-bottom: 3px !important; }
            
            .recibo-tipo { text-align: right; }
            .recibo-titulo { font-size: 20px; font-weight: 800; line-height: 1; margin-bottom: 2px; }
            .recibo-sub { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #444; }

            .secao-dados { border: 1.5px solid #000; background: #fff; }
            .secao-dados label { font-size: 9px; font-weight: 800; color: #000; display: block; margin-bottom: 1px; text-transform: uppercase; }
            .info-val { font-size: 13px; color: #000; }

            .tabela-holerite { border-collapse: collapse; border: 1.5px solid #000; }
            .tabela-holerite th { border: 1px solid #000; background: #f2f2f2; padding: 8px; font-size: 10px; font-weight: 800; }
            .tabela-holerite td { border: 1px solid #000; padding: 6px 10px; font-size: 12px; vertical-align: middle; }
            .tabela-holerite .empty-cell { height: 25px; }
            
            .liquid-row td { background: #f0f0f0 !important; border-top: 3px solid #000 !important; }
            .liquid-label { font-size: 16px; font-weight: 800; padding: 12px !important; }
            .liquid-val { font-size: 24px; font-weight: 900; padding: 12px !important; border-left: 2px solid #000 !important; }

            .secao-assinatura { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; }
            .declaracao { width: 60%; font-size: 10px; line-height: 1.3; font-style: italic; color: #333; }
            .assinatura-box { width: 35%; text-align: center; }
            .campo-data { margin-bottom: 20px; font-size: 12px; font-weight: 600; }
            .campo-assinatura { border-top: 1.5px solid #000; padding-top: 5px; font-size: 11px; font-weight: 800; text-transform: uppercase; }

            .extrato-box { border: 1.5px dashed #000; padding: 15px; background: #fdfdfd; flex-grow: 1; }
            .extrato-header { text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px; }
            
            .tabela-extrato { width: 100%; border-collapse: collapse; font-size: 11px; }
            .tabela-extrato th { background: #f2f2f2; border: 1px solid #000; padding: 6px; font-weight: 800; text-transform: uppercase; }
            .tabela-extrato td { border: 1px solid #000; padding: 5px 8px; }
            .tabela-extrato tfoot td { background: #f2f2f2; border-top: 2.5px solid #000; padding: 8px; }

            .print-footer { margin-top: 15px; font-size: 9px; font-style: italic; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #eee; padding-top: 5px; }
        </style>
    </head>
    <body onload="window.print();">
        <div class="no-print p-4 text-center bg-primary text-white mb-4">
            <h4><i class="fas fa-print"></i> Visualização de Holerites</h4>
            <p class="m-0">Cada página A4 contém o Holerite e o Extrato de um colaborador.</p>
        </div>
        ${htmlHolerites}
    </body>
    </html>`;

    openPrintWindow(fullHTML);
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
window.imprimirHoleritesHE = imprimirHoleritesHE;

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
    if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        
        if (options.autoPrint) {
            printWindow.onload = () => {
                printWindow.print();
                printWindow.onafterprint = () => printWindow.close();
            };
        }
    }
}

// Função de limpeza para remover o listener ao sair da tela
function limparListenerAutorizacao() {
    if (listenerAutorizacao) {
        listenerAutorizacao();
        listenerAutorizacao = null;
        console.log("Listener de autorização de horas removido.");
    }
}

// Exporta funções auxiliares
/**
 * Reprocessa uma solicitação de horas extras, recalculando valores e 
 * garantindo que campos como 'formaPagamento' e 'valorOriginalSolicitado' 
 * estejam preenchidos corretamente.
 */
async function reprocessarUmaSolicitacao(id) {
    try {
        const solRef = db.collection('solicitacoes_horas').doc(id);
        const solDoc = await solRef.get();
        if (!solDoc.exists) return;

        const s = solDoc.data();
        const funcDoc = await db.collection('funcionarios').doc(s.employeeId).get();
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado", "error");
            return;
        }
        const func = funcDoc.data();

        // Datas da solicitação
        const start = s.start.toDate();
        const end = s.end.toDate();
        
        // 1. Recalcular valor estimado usando a lógica atualizada
        const valorEstimado = await calcularValorEstimado(start, end, s.employeeId);

        // 2. Preparar dados de atualização (Reprocessamento)
        const updateData = {
            valorEstimado: valorEstimado,
            employeeName: func.nome || s.employeeName,
            setor: func.setor || s.setor || 'N/A',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 3. Persistir forma de pagamento se estiver em branco
        // Seguindo o padrão do modal de ajuste: default para 'por-fora'
        if (!s.formaPagamento) {
            updateData.formaPagamento = 'por-fora';
        }

        // 4. Garantir que o valor original esteja gravado para histórico
        if (s.valorOriginalSolicitado === undefined || s.valorOriginalSolicitado === null) {
            updateData.valorOriginalSolicitado = s.valorEstimado || valorEstimado;
        }

        // 5. Atualizar o documento da solicitação
        await solRef.update(updateData);

        // 6. Se a solicitação já estiver 'aprovada', atualizar também o registro no dashboard (overtime)
        if (s.status === 'aprovado') {
            const overtimeSnap = await db.collection('overtime')
                .where('solicitacaoId', '==', id)
                .limit(1)
                .get();
            
            if (!overtimeSnap.empty) {
                const otDoc = overtimeSnap.docs[0];
                
                // Recálculo completo para o lançamento final
                const duracaoMinutos = Math.round((end - start) / (1000 * 60));
                const totalHorasReais = duracaoMinutos / 60;
                const horasFakeDecimais = trueDecimalToFakeDecimal(totalHorasReais);
                
                const salarioBase = parseFloat(func.salario) || 0;
                const valorHora = salarioBase / 220;
                const taxaHoraExtra = valorHora * 1.5;
                const valorTotalHoras = horasFakeDecimais * taxaHoraExtra;
                
                const diasNoMes = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                const diasNaoUteis = 5; 
                const diasUteis = diasNoMes - diasNaoUteis;
                const dsr = (valorTotalHoras / (diasUteis || 25)) * diasNaoUteis;
                
                await otDoc.ref.update({
                    employeeName: func.nome,
                    sector: func.setor,
                    hours: horasFakeDecimais,
                    overtimePay: parseFloat(valorTotalHoras.toFixed(2)),
                    dsr: parseFloat(dsr.toFixed(2)),
                    formaPagamento: s.formaPagamento || updateData.formaPagamento,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        mostrarMensagem(`Solicitação de ${func.nome} reprocessada com sucesso!`, "success");

    } catch (error) {
        console.error("Erro ao reprocessar solicitação:", error);
        mostrarMensagem("Erro ao recalcular/reprocessar a solicitação.", "error");
    }
}

/**
 * Reprocessa todas as solicitações visíveis na listagem atual (bulk).
 */
async function reprocessarTudoVisivel() {
    if (!cacheSolicitacoes || cacheSolicitacoes.length === 0) {
        mostrarMensagem("Não há solicitações para reprocessar nos filtros atuais.", "warning");
        return;
    }

    if (!confirm(`Deseja reprocessar e recalcular as ${cacheSolicitacoes.length} solicitações visíveis? Esta ação corrigirá campos em branco e sincronizará nomes/setores.`)) {
        return;
    }

    mostrarMensagem(`Reprocessando ${cacheSolicitacoes.length} itens... Isso pode levar alguns segundos.`, "info");
    
    // Desativar botões para evitar cliques duplos
    const btn = document.getElementById('auth-btn-reprocessar-tudo');
    if (btn) btn.disabled = true;

    try {
        // Para evitar estresse no Firestore e limites de taxa, faremos em sequência curta
        // mas Idealmente poderíamos usar batch se não precisássemos ler funcionarios de cada uma.
        // Como o cache de funcionários é feito por doc.get() em loop, é melhor fazer um a um 
        // ou pré-carregar os funcionários. Para simplicidade e confiabilidade, faremos um loop.
        
        let count = 0;
        for (const sol of cacheSolicitacoes) {
            await reprocessarUmaSolicitacao(sol.id);
            count++;
        }

        mostrarMensagem(`${count} solicitações foram reprocessadas e atualizadas!`, "success");
    } catch (error) {
        console.error("Erro no reprocessamento em lote :", error);
        mostrarMensagem("Ocorreu um erro parcial durante o reprocessamento.", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.reprocessarUmaSolicitacao = reprocessarUmaSolicitacao;
window.carregarDadosAuxiliaresAuth = carregarDadosAuxiliaresAuth;
window.obterNomeGerenteSetor = obterNomeGerenteSetor;
window.obterNomeMacroSetor = obterNomeMacroSetor;
