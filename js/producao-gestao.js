/**
 * js/producao-gestao.js
 * Módulo de Controle de Produção, Metas e Bônus de Gestores
 */

let __PRODUCAO_CONFIG = {
    setores: [],
    lancamentos: [],
    metas: []
};

// 1. Inicializador Principal (Controlador de Rotas Internas)
async function inicializarProducaoMetas(secaoNome) {
    const secao = secaoNome || window.secaoAtual || 'producao-gestao';
    console.log("🚀 Inicializando Módulo de Produção e Metas (" + secao + ")...");
    
    // 1. Carregar Setores (Comum a todas as subseções)
    await carregarSectoresProducao();
    
    // 2. Roteamento de Inicialização Específica
    if (secao === 'producao-gestao') {
        preencherFiltroSemana();
        await carregarDashboardProducao();
    } else if (secao === 'producao-lancamento') {
        await inicializarLancamentoLote();
    } else if (secao === 'producao-bonus') {
        await inicializarGestaoBonus();
    } else if (secao === 'producao-produtos') {
        await inicializarListaProdutos();
    } else if (secao === 'producao-leitura') {
        await inicializarEstacaoLeitura();
    }
}

// 2. Carregamento de Dados (Firestore)
async function carregarSectoresProducao() {
    try {
        const snapshot = await db.collection('setores').get({ source: 'server' });
        __PRODUCAO_CONFIG.setores = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }));
            // .filter(s => s.controlaProducao === true); // Comentado para trazer todos os setores conforme solicitado

        
        // Preencher select de setores nos filtros e modais
        const selectFiltro = document.getElementById('filtro-producao-setor');
        const selectModal = document.getElementById('lp-setor');
        
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="">Todos os Setores</option>';
            __PRODUCAO_CONFIG.setores.forEach(s => {
                selectFiltro.innerHTML += `<option value="${s.id}">${s.descricao}</option>`;
            });
        }
        
        if (selectModal) {
            selectModal.innerHTML = '<option value="">Selecione o Setor...</option>';
            __PRODUCAO_CONFIG.setores.forEach(s => {
                selectModal.innerHTML += `<option value="${s.id}" data-nome="${s.descricao}">${s.descricao}</option>`;
            });
        }
        
    } catch (e) {
        console.error("Erro ao carregar setores:", e);
    }
}

async function carregarDashboardProducao() {
    const elSemana = document.getElementById('filtro-producao-semana');
    const elSetor = document.getElementById('filtro-producao-setor');
    
    if (!elSemana || !elSetor) {
        console.warn("Elementos do Dashboard de Produção não encontrados no DOM.");
        return;
    }

    const semana = elSemana.value;
    const setorId = elSetor.value;
    
    try {
        // 1. Carregar Metas da Semana Selecionada
        const metasSnap = await db.collection('producao_metas')
            .where('semana', '==', semana)
            .get();
        __PRODUCAO_CONFIG.metas = metasSnap.docs.map(d => d.data());
        
        // 2. Carregar Lançamentos
        let query = db.collection('producao_lancamentos').where('semana', '==', semana);
        if (setorId) query = query.where('setorId', '==', setorId);
        
        const lancSnap = await query.get();
        __PRODUCAO_CONFIG.lancamentos = lancSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // 3. Processar e Renderizar
        processarDadosDashboard();
        renderizarTabelaHistorico();
        renderizarListaSetores();
        
    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
    }
}

// 3. Processamento de Lógica e Cálculos
function processarDadosDashboard() {
    let totalProducao = 0;
    let totalMeta = 0;
    
    __PRODUCAO_CONFIG.lancamentos.forEach(l => totalProducao += parseInt(l.quantidade || 0));
    __PRODUCAO_CONFIG.metas.forEach(m => totalMeta += parseInt(m.metaValue || 0));
    
    const eficiencia = totalMeta > 0 ? (totalProducao / totalMeta) * 100 : 0;
    
    // Atualizar HTML KPIs
    document.getElementById('kpi-producao-real').innerText = totalProducao.toLocaleString();
    document.getElementById('kpi-producao-meta').innerText = totalMeta.toLocaleString();
    document.getElementById('kpi-producao-percentual-meta').innerText = `${eficiencia.toFixed(1)}% alcançado`;
    document.getElementById('kpi-producao-eficiencia').innerText = `${eficiencia.toFixed(1)}%`;
    
    const progress = document.getElementById('progress-producao-eficiencia');
    if (progress) {
        progress.style.width = `${Math.min(eficiencia, 100)}%`;
        const card = document.getElementById('card-producao-eficiencia');
        if (eficiencia >= 100) card.className = 'card p-3 border-0 shadow-sm bg-success text-white';
        else if (eficiencia >= 80) card.className = 'card p-3 border-0 shadow-sm bg-warning text-dark';
        else card.className = 'card p-3 border-0 shadow-sm bg-danger text-white';
    }

    // Cálculo de Bônus baseado nas Regras (Novos campos bonusValue)
    let bonusTotalProvisionado = 0;
    __PRODUCAO_CONFIG.metas.forEach(m => {
        const prodSetor = __PRODUCAO_CONFIG.lancamentos
            .filter(l => l.setorId === m.setorId)
            .reduce((a, b) => a + b.quantidade, 0);
        
        const percSetor = m.metaValue > 0 ? (prodSetor / m.metaValue) * 100 : 0;
        if (percSetor >= 100) {
            bonusTotalProvisionado += (m.bonusValue || 0);
        } else if (percSetor >= 95) {
            bonusTotalProvisionado += (m.bonusValue || 0) * 0.5; // Exemplo: 50% se bater 95%
        }
    });

    const bonusEl = document.getElementById('kpi-producao-bonus');
    if (bonusEl) bonusEl.innerText = `R$ ${bonusTotalProvisionado.toFixed(2)}`;
    
    renderizarGraficoEvolucao();
}

// 4. Modais e Formulários
window.abrirModalLancamentoProducao = () => {
    const modalEl = document.getElementById('modalLancamentoProducao');
    if (!modalEl) return;
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form = document.getElementById('form-producao-lancamento');
    const select = document.getElementById('lp-setor');
    
    if (form) form.reset();
    if (document.getElementById('lp-data')) {
        document.getElementById('lp-data').value = new Date().toISOString().split('T')[0];
    }
    
    if (select) {
        select.innerHTML = '<option value="">Selecione o Setor...</option>';
        __PRODUCAO_CONFIG.setores.forEach(s => {
            select.innerHTML += `<option value="${s.id}" data-nome="${s.descricao}">${s.descricao}</option>`;
        });
    }
    
    modal.show();
};

window.abrirModalConfigMetas = async () => {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfigMetas'));
    const container = document.getElementById('config-metas-container');
    const semana = document.getElementById('filtro-producao-semana').value;
    
    container.innerHTML = '<div class="row gx-3">';
    
    __PRODUCAO_CONFIG.setores.forEach(s => {
        const metaDoc = __PRODUCAO_CONFIG.metas.find(m => m.setorId === s.id);
        const metaAtual = metaDoc?.metaValue || 0;
        const bonusAtual = metaDoc?.bonusValue || 0;
        
        container.innerHTML += `
            <div class="col-md-6 mb-3">
                <div class="card p-2 border-0 shadow-sm bg-light">
                    <label class="form-label small fw-bold mb-1">${s.descricao}</label>
                    <div class="row g-2">
                        <div class="col-7">
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control input-meta-setor" 
                                       data-setor-id="${s.id}" data-setor-nome="${s.descricao}" 
                                       value="${metaAtual}" placeholder="Meta Qtd...">
                                <span class="input-group-text bg-white">Pares</span>
                            </div>
                        </div>
                        <div class="col-5">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-white small">R$</span>
                                <input type="number" class="form-control input-bonus-setor" 
                                       data-setor-id="${s.id}" value="${bonusAtual}" placeholder="Bônus...">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML += '</div>';
    modal.show();
};

async function salvarMetasSemanais() {
    const semana = document.getElementById('filtro-producao-semana').value;
    const inputs = document.querySelectorAll('.input-meta-setor');
    const promises = [];
    
    inputs.forEach(input => {
        const setorId = input.dataset.setorId;
        const metaValue = parseInt(input.value) || 0;
        const bonusInput = document.querySelector(`.input-bonus-setor[data-setor-id="${setorId}"]`);
        const bonusValue = parseFloat(bonusInput?.value) || 0;
        
        // Usar ID composto para evitar duplicados na mesma semana
        const metaId = `meta_${semana}_${setorId}`;
        promises.push(db.collection('producao_metas').doc(metaId).set({
            semana: semana,
            setorId: setorId,
            setorNome: input.dataset.setorNome,
            metaValue: metaValue,
            bonusValue: bonusValue,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
    });
    
    try {
        await Promise.all(promises);
        bootstrap.Modal.getInstance(document.getElementById('modalConfigMetas')).hide();
        await carregarDashboardProducao();
        mostrarMensagem('Metas atualizadas para a semana ' + semana, 'success');
    } catch (e) {
        alert("Erro ao salvar metas: " + e.message);
    }
}

async function salvarLancamentoProducao(e) {
    if (e) e.preventDefault();
    const form = document.getElementById('form-producao-lancamento');
    const setorSelect = document.getElementById('lp-setor');
    
    const dados = {
        setorId: setorSelect.value,
        setorNome: setorSelect.options[setorSelect.selectedIndex].dataset.nome,
        data: document.getElementById('lp-data').value,
        turno: document.getElementById('lp-turno').value,
        quantidade: parseInt(document.getElementById('lp-quantidade').value) || 0,
        obs: document.getElementById('lp-obs').value,
        semana: converterDataParaSemanaISO(document.getElementById('lp-data').value),
        registradoEm: firebase.firestore.FieldValue.serverTimestamp(),
        registradoPor: auth.currentUser?.email || 'Sistema'
    };
    
    if (!dados.setorId || !dados.data || !dados.quantidade) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    try {
        await db.collection('producao_lancamentos').add(dados);
        bootstrap.Modal.getInstance(document.getElementById('modalLancamentoProducao')).hide();
        await carregarDashboardProducao();
        mostrarMensagem('Produção registrada!', 'success');
    } catch (e) {
        alert("Erro: " + e.message);
    }
}

// 5. Renderização (Tabelas e Gráficos)
let producaoChartInstance = null;

function renderizarGraficoEvolucao() {
    const ctx = document.getElementById('chart-producao-evolucao');
    if (!ctx) return;
    
    // Agrupar por dia na semana
    const dias = {};
    __PRODUCAO_CONFIG.lancamentos.forEach(l => {
        dias[l.data] = (dias[l.data] || 0) + l.quantidade;
    });
    
    const labels = Object.keys(dias).sort();
    const values = labels.map(l => dias[l]);
    
    if (producaoChartInstance) producaoChartInstance.destroy();
    
    producaoChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => l.split('-').reverse().slice(0, 2).join('/')),
            datasets: [{
                label: 'Produção Real',
                data: values,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderizarTabelaHistorico() {
    const tbody = document.getElementById('tabela-producao-corpo');
    if (!tbody) return;
    
    if (__PRODUCAO_CONFIG.lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum lançamento nesta semana.</td></tr>';
        return;
    }
    
    tbody.innerHTML = __PRODUCAO_CONFIG.lancamentos.map(l => {
        const metaSetor = __PRODUCAO_CONFIG.metas.find(m => m.setorId === l.setorId)?.metaValue || 0;
        const metaDiariaEst = metaSetor / 5; // Estimativa diária simplificada
        const perf = metaDiariaEst > 0 ? (l.quantidade / metaDiariaEst) * 100 : 0;
        
        return `
            <tr>
                <td class="ps-3 fw-bold">${l.data.split('-').reverse().join('/')}</td>
                <td>${l.setorNome} <br><small class="text-muted">${l.turno}</small></td>
                <td>${metaDiariaEst.toFixed(0)} <small>(est)</small></td>
                <td><span class="fw-bold text-primary">${l.quantidade}</span></td>
                <td>${(l.quantidade - metaDiariaEst).toFixed(0)}</td>
                <td><span class="badge ${perf >= 90 ? 'bg-success' : 'bg-danger'}">${perf.toFixed(0)}%</span></td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-light" onclick="excluirLancamentoProducao('${l.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderizarListaSetores() {
    const list = document.getElementById('lista-producao-setores');
    if (!list) return;
    
    list.innerHTML = __PRODUCAO_CONFIG.setores.map(s => {
        const meta = __PRODUCAO_CONFIG.metas.find(m => m.setorId === s.id)?.metaValue || 0;
        const prod = __PRODUCAO_CONFIG.lancamentos.filter(l => l.setorId === s.id).reduce((a, b) => a + b.quantidade, 0);
        const perc = meta > 0 ? (prod / meta) * 100 : 0;
        
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between small mb-1">
                    <span class="fw-bold">${s.descricao}</span>
                    <span>${prod} / ${meta}</span>
                </div>
                <div class="progress" style="height: 10px;">
                    <div class="progress-bar ${perc >= 100 ? 'bg-success' : 'bg-primary'}" style="width: ${Math.min(perc, 100)}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// 6. Utilitários
function preencherFiltroSemana() {
    const select = document.getElementById('filtro-producao-semana');
    if (!select) return;
    
    const hoje = new Date();
    select.innerHTML = '';
    
    for (let i = 0; i < 8; i++) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - (i * 7));
        const weekStr = converterDataParaSemanaISO(data);
        const option = document.createElement('option');
        option.value = weekStr;
        option.text = `Semana ${weekStr.split('-W')[1]} (${weekStr.split('-W')[0]})`;
        select.appendChild(option);
    }
}

function converterDataParaSemanaISO(dateStr) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const week = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return date.getFullYear() + "-W" + (week < 10 ? "0" + week : week);
}

// 7. Lançamento em Lote (Lançar Produção)
async function inicializarLancamentoLote() {
    const dataInput = document.getElementById('form-lp-data-lote');
    if (!dataInput) return;
    
    if (!dataInput.value) {
        dataInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Carregar Setores se necessário
    if (__PRODUCAO_CONFIG.setores.length === 0) await carregarSectoresProducao();
    
    await carregarFichasDia();
}

window.verificarLancamentosExistentes = async () => {
    await carregarFichasDia();
};

async function carregarFichasDia() {

    const tbody = document.getElementById('lista-fichas-dia');
    const cardsContainer = document.getElementById('lista-fichas-dia-cards');
    const data = document.getElementById('form-lp-data-lote')?.value;
    if (!data) return;

    const loadingRow = '<tr><td colspan="7" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Carregando fichas...</td></tr>';
    const loadingCards = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Carregando fichas...</div>';
    if (tbody) tbody.innerHTML = loadingRow;
    if (cardsContainer) cardsContainer.innerHTML = loadingCards;

    try {
        const snap = await db.collection('producao_fichas')
            .where('data', '==', data)
            .get();

        if (snap.empty) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Nenhuma ficha para esta data.</td></tr>';
            if (cardsContainer) cardsContainer.innerHTML = '<div class="text-center py-5 text-muted small"><i class="fas fa-inbox fa-2x mb-2 d-block opacity-50"></i>Nenhuma ficha para esta data.</div>';
            return;
        }

        let tableHtml = '';
        let cardsHtml = '';

        snap.forEach(doc => {
            const f = doc.data();
            const isConcluida = f.status === 'Concluída';
            const statusClass = f.status === 'Aberta' ? 'bg-primary' : (isConcluida ? 'bg-success' : 'bg-danger');
            const cardBorder = isConcluida ? 'concluida' : (f.status === 'Cancelada' ? 'cancelada' : '');
            const operador = f.colaboradores?.[0]?.nome || 'N/A';
            const maquina = f.maquinaCodigo || 'S/M';
            const setor = (f.setorNome || '').split('(')[0].trim();
            const dataFmt = (f.data || '').split('-').reverse().join('/');

            // ---- Linha da tabela (desktop) ----
            tableHtml += `
                <tr>
                    <td class="ps-3 fw-bold text-primary" style="font-size:0.8rem;">${f.id}</td>
                    <td>
                        <div class="fw-bold small">${maquina}</div>
                        <div class="text-muted" style="font-size:0.7rem;">${setor}</div>
                    </td>
                    <td><span class="badge bg-info text-white" style="font-size:0.7rem;"><i class="fas fa-user me-1"></i>${operador}</span></td>
                    <td class="text-center small">${dataFmt}</td>
                    <td class="text-center fw-bold text-success" style="font-size:1.1rem;">${f.totalProduzido || 0}</td>
                    <td class="text-center"><span class="badge ${statusClass}">${f.status}</span></td>
                    <td class="text-end pe-3">
                        <div class="d-flex gap-1 justify-content-end">
                            <button class="btn btn-outline-primary btn-sm" onclick="abrirAuditoriaComCodigo('${f.id}')" title="Lançar"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-dark btn-sm" onclick="visualizarFichaImpressa('${f.id}')" title="Imprimir"><i class="fas fa-print"></i></button>
                            <button class="btn btn-outline-danger btn-sm" onclick="excluirFichaProducao('${f.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;

            // ---- Card (mobile) ----
            cardsHtml += `
                <div class="ficha-card-mobile ${cardBorder}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <div class="ficha-maquina">${maquina} <span class="text-muted fw-normal" style="font-size:0.8rem;">${setor}</span></div>
                            <div class="ficha-operador"><i class="fas fa-user me-1 text-info"></i>${operador}</div>
                            <div class="ficha-id mt-1">${f.id}</div>
                        </div>
                        <div class="text-end">
                            <div class="ficha-total">${f.totalProduzido || 0}</div>
                            <div style="font-size:0.65rem;" class="text-muted">produzidos</div>
                            <span class="badge ${statusClass} mt-1">${f.status}</span>
                        </div>
                    </div>
                    <div class="ficha-acoes">
                        <button class="btn btn-primary btn-sm" onclick="abrirAuditoriaComCodigo('${f.id}')">
                            <i class="fas fa-eye me-1"></i>Lançar
                        </button>
                        <button class="btn btn-outline-dark btn-sm" onclick="visualizarFichaImpressa('${f.id}')">
                            <i class="fas fa-print me-1"></i>Imprimir
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="excluirFichaProducao('${f.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
        });

        if (tbody) tbody.innerHTML = tableHtml;
        if (cardsContainer) cardsContainer.innerHTML = cardsHtml;

    } catch (e) {
        console.error(e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar fichas.</td></tr>';
        if (cardsContainer) cardsContainer.innerHTML = '<div class="text-center text-danger p-3">Erro ao carregar fichas.</div>';
    }
}



window.visualizarFichaImpressa = async (fichaId) => {
    try {
        const doc = await db.collection('producao_fichas').doc(fichaId).get();
        if (doc.exists) imprimirViewFicha(doc.data());
    } catch (e) { alert(e.message); }
};

window.abrirAuditoriaComCodigo = (codigo) => {
    abrirPainelAuditoriaFicha();
    document.getElementById('af-codigo-ficha').value = codigo;
    buscarFichaAuditoria();
};

window.excluirFichaProducao = async (id) => {
    if (confirm(`Deseja realmente excluir a ficha ${id}? Isso removerá os registros de produção vinculados a ela.`)) {
        try {
            // 1. Remover lançamentos vinculados
            const lancs = await db.collection('producao_lancamentos').where('fichaId', '==', id).get();
            const batch = db.batch();
            lancs.forEach(doc => batch.delete(doc.ref));
            
            // 2. Remover a ficha
            batch.delete(db.collection('producao_fichas').doc(id));
            
            await batch.commit();
            mostrarMensagem("Ficha excluída com sucesso!", "success");
            await carregarFichasDia();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    }
};





window.verificarLancamentosExistentes = async () => {
    const data = document.getElementById('form-lp-data-lote').value;
    const turno = document.getElementById('form-lp-turno-lote').value;
    
    const snap = await db.collection('producao_lancamentos')
        .where('data', '==', data)
        .where('turno', '==', turno)
        .get();
    
    const lancamentos = snap.docs.map(d => d.data());
    const inputs = document.querySelectorAll('.input-producao-lote');
    
    inputs.forEach(input => {
        const lanc = lancamentos.find(l => l.setorId === input.dataset.setorId);
        if (lanc) {
            input.value = lanc.quantidade;
            input.parentElement.nextElementSibling.innerHTML = '<span class="badge bg-success">Gravado</span>';
            input.style.borderColor = "#198754";
        } else {
            input.value = "";
            input.parentElement.nextElementSibling.innerHTML = '<span class="badge bg-secondary opacity-50">Pendente</span>';
            input.style.borderColor = "";
        }
    });
};

window.salvarLoteProducao = async () => {
    const data = document.getElementById('form-lp-data-lote').value;
    const turno = document.getElementById('form-lp-turno-lote').value;
    const semana = converterDataParaSemanaISO(data);
    const inputs = document.querySelectorAll('.input-producao-lote');
    const promises = [];
    
    let count = 0;
    inputs.forEach(input => {
        const quantidade = parseInt(input.value) || 0;
        if (quantidade > 0) {
            const setorId = input.dataset.setorId;
            const tr = input.closest('tr');
            const setorNome = tr.dataset.setorNome;
            const obs = tr.querySelector('.input-obs-lote').value;
            
            // Usar ID único composto para evitar duplicados no mesmo turno/dia/setor
            const idDoc = `prod_${data}_${turno}_${setorId}`;
            promises.push(db.collection('producao_lancamentos').doc(idDoc).set({
                data, turno, semana, setorId, setorNome, quantidade, obs,
                registradoEm: firebase.firestore.FieldValue.serverTimestamp(),
                registradoPor: auth.currentUser?.email || 'Sistema'
            }, { merge: true }));
            count++;
        }
    });
    
    if (count === 0) return alert("Insira ao menos um valor de produção.");
    
    try {
        await Promise.all(promises);
        mostrarMensagem(`${count} lançamentos salvos com sucesso!`, 'success');
        await verificarLancamentosExistentes();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
};

// 8. Gestão de Bônus (Bônus Gestores)
let __ULTIMO_RESUMO_BONUS = {};

async function inicializarGestaoBonus() {
    const mesInput = document.getElementById('filtro-bonus-mes');
    if (!mesInput) return;
    
    mesInput.value = new Date().toISOString().slice(0, 7);
    await carregarDashboardBonus();
}

async function carregarDashboardBonus() {
    const mes = document.getElementById('filtro-bonus-mes').value;
    const dashboard = document.getElementById('painel-gestores-bonus');
    if (!dashboard) return;
    
    dashboard.innerHTML = '<div class="col-12 text-center py-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    try {
        // Carrega lançamentos do mês (simplificado: busca por string ISO inicial)
        const snapProd = await db.collection('producao_lancamentos')
            .where('data', '>=', `${mes}-01`)
            .where('data', '<=', `${mes}-31`)
            .get();
            
        const lancamentos = snapProd.docs.map(d => d.data());
        
        // Agrupar por Setor (Assumindo 1 Gestor por Setor para o MVP)
        const setoresResumo = {};
        lancamentos.forEach(l => {
            if (!setoresResumo[l.setorId]) {
                setoresResumo[l.setorId] = { nome: l.setorNome, real: 0, meta: 0, count: 0 };
            }
            setoresResumo[l.setorId].real += l.quantidade;
        });
        
        // Buscar Metas para esses setores no mês
        const snapMetas = await db.collection('producao_metas')
            .where('semana', '>=', `${mes}-W01`)
            .where('semana', '<=', `${mes}-W53`)
            .get();
            
        snapMetas.forEach(doc => {
            const m = doc.data();
            if (setoresResumo[m.setorId]) {
                setoresResumo[m.setorId].meta += m.metaValue;
                setoresResumo[m.setorId].bonusBase = m.bonusValue || 0;
            }
        });
        
        // Buscar Funcionários Elegíveis por Setor
        const snapFunc = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();
        
        const funcionarios = snapFunc.docs.map(d => ({ id: d.id, ...d.data() }));
        
        Object.keys(setoresResumo).forEach(setorId => {
            const s = setoresResumo[setorId];
            s.funcionarios = funcionarios.filter(f => 
                f.setor === s.nome && 
                f.beneficios?.elegivelBonusProducao === true
            );
        });
        
        __ULTIMO_RESUMO_BONUS = setoresResumo;
        renderizarCardsBonus(setoresResumo);
        renderizarTabelaBonus(setoresResumo, mes);
        
    } catch (e) {
        console.error("Erro dashboard bônus:", e);
    }
}

function renderizarCardsBonus(resumo) {
    const container = document.getElementById('painel-gestores-bonus');
    const html = Object.keys(resumo).map(id => {
        const s = resumo[id];
        const perc = s.meta > 0 ? (s.real / s.meta) * 100 : 0;
        let bonus = 0;
        if (perc >= 100) bonus = s.bonusBase || 500;
        else if (perc >= 95) bonus = (s.bonusBase || 500) * 0.5;
        
        const totalEquipe = s.funcionarios ? s.funcionarios.length : 0;
        
        return `
            <div class="col-md-4">
                <div class="card h-100 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h6 class="text-muted small fw-bold mb-0">SUPERVISOR / SETOR</h6>
                                <div class="h5 mb-0">${s.nome}</div>
                            </div>
                            <div class="badge ${perc >= 100 ? 'bg-success' : 'bg-warning text-dark'}">${perc.toFixed(1)}% Meta</div>
                        </div>
                        <div class="row text-center mb-3">
                            <div class="col-6 border-end">
                                <small class="text-muted d-block">PRODUÇÃO</small>
                                <span class="fw-bold">${s.real.toLocaleString()}</span>
                            </div>
                            <div class="col-6">
                                <small class="text-muted d-block">META MES</small>
                                <span class="fw-bold">${s.meta.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="bg-light p-3 rounded text-center">
                            <small class="text-muted d-block mb-1">PROVISÃO PARA O SETOR</small>
                            <div class="h4 text-primary fw-bold mb-0">R$ ${bonus.toFixed(2)}</div>
                            <small class="text-muted small">${totalEquipe} Colaboradores Elegíveis</small>
                        </div>
                        <button class="btn btn-sm btn-outline-primary w-100 mt-3" onclick="verDetalheBonus('${id}')">Ver Equipe e Detalhes</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html || '<div class="col-12 text-center text-muted py-5">Nenhum dado produtivo para o período.</div>';
}

function renderizarTabelaBonus(resumo, mes) {
    const tbody = document.getElementById('tabela-bonus-corpo');
    if (!tbody) return;
    
    tbody.innerHTML = Object.keys(resumo).map(id => {
        const s = resumo[id];
        const perc = s.meta > 0 ? (s.real / s.meta) * 100 : 0;
        let bonus = 0;
        if (perc >= 100) bonus = 500 + ((perc - 100) * 50);
        else if (perc >= 95) bonus = 250;
        
        return `
            <tr>
                <td class="ps-3"><i class="fas fa-user-circle text-muted me-2"></i>Responsável ${s.nome}</td>
                <td>${mes}</td>
                <td>${perc.toFixed(1)}%</td>
                <td>${perc >= 100 ? '<span class="text-success"><i class="fas fa-check"></i> Sim</span>' : '<span class="text-danger"><i class="fas fa-times"></i> Não</span>'}</td>
                <td class="fw-bold">R$ ${bonus.toFixed(2)}</td>
                <td><span class="badge ${bonus > 0 ? 'bg-warning text-dark' : 'bg-secondary'}">${bonus > 0 ? 'Pendente' : 'Inelegível'}</span></td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-light" title="Aprovar"><i class="fas fa-thumbs-up"></i></button>
                    <button class="btn btn-sm btn-light" title="Histórico"><i class="fas fa-history"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// 9. Cadastro de Grade/SKU (Grade de Produtos)
async function inicializarListaProdutos() {
    await carregarListaProdutos();
}

async function carregarListaProdutos() {
    const tbody = document.getElementById('lista-produtos-corpo');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i> Sincronizando grade...</td></tr>';
    
    try {
        const snap = await db.collection('producao_produtos').orderBy('descricao').get();
        const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum produto cadastrado.</td></tr>';
            return;
        }
        
        tbody.innerHTML = produtos.map(p => `
            <tr>
                <td class="ps-3"><code class="fs-6">${p.codigo}</code></td>
                <td class="fw-bold">${p.descricao}</td>
                <td><span class="badge bg-light text-dark px-3 mt-1">${p.tamanho}</span></td>
                <td class="small text-muted">${p.setorNome || '--'}</td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-light" onclick="excluirProduto('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Erro ao carregar produtos:", e);
    }
}

window.abrirModalNovoProduto = async () => {
    if (__PRODUCAO_CONFIG.setores.length === 0) await carregarSectoresProducao();
    
    const select = document.getElementById('p-setor');
    if (select) {
        select.innerHTML = '<option value="">Selecione o Setor...</option>';
        __PRODUCAO_CONFIG.setores.forEach(s => {
            select.innerHTML += `<option value="${s.id}" data-nome="${s.descricao}">${s.descricao}</option>`;
        });
    }
    
    document.getElementById('form-novo-produto').reset();
    
    // Gerar código automaticamente ao abrir o modal
    window.gerarCodigoAleatorio();
    
    new bootstrap.Modal(document.getElementById('modalNovoProduto')).show();
};

window.gerarCodigoAleatorio = () => {
    const rand = Math.floor(100000000000 + Math.random() * 900000000000);
    document.getElementById('p-codigo').value = rand;
};

window.salvarProduto = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    const sel = document.getElementById('p-setor');
    const dados = {
        descricao: document.getElementById('p-descricao').value,
        tamanho: document.getElementById('p-tamanho').value,
        codigo: document.getElementById('p-codigo').value.trim(),
        setorId: sel.value,
        setorNome: sel.options[sel.selectedIndex].dataset.nome
    };
    
    try {
        await db.collection('producao_produtos').doc(dados.codigo).set(dados);
        bootstrap.Modal.getInstance(document.getElementById('modalNovoProduto')).hide();
        mostrarMensagem('Produto cadastrado na grade!', 'success');
        await carregarListaProdutos();
    } catch (e) {
        alert("Erro ao salvar SKU: " + e.message);
    } finally {
        btn.disabled = false;
    }
};

window.excluirProduto = async (id) => {
    if (confirm("Deseja remover este produto da grade?")) {
        await db.collection('producao_produtos').doc(id).delete();
        await carregarListaProdutos();
    }
};

// 10. Estação de Leitura (Scanner Core)
let __SESSAO_LEITURAS = [];

async function inicializarEstacaoLeitura() {
    const dataDisplay = document.getElementById('scanner-data-atual');
    if (!dataDisplay) return;
    
    const hojeFormatted = new Date().toLocaleDateString('pt-BR');
    dataDisplay.innerText = hojeFormatted;
    
    // Auto-focus no campo de scanner a cada 2 segundos se ele perder o foco (apenas se o modal de câmera estiver fechado)
    const inputScanner = document.getElementById('scanner-input');
    const modalCamera = document.getElementById('modalCameraScanner');
    
    setInterval(() => {
        // Se o modal da câmera estiver aberto, não força foco no input principal
        const isModalOpen = modalCamera && modalCamera.classList.contains('show');
        if (inputScanner && document.activeElement !== inputScanner && !isModalOpen) {
            inputScanner.focus();
        }
    }, 2000);
    
    __SESSAO_LEITURAS = [];
    document.getElementById('lista-leituras-recentes').innerHTML = ' <li class="list-group-item text-center py-5 text-muted small">Nenhuma leitura nesta estação...</li>';
    document.getElementById('contador-sessao').innerText = '0 Itens';
}

window.aoScaneamento = async (e) => {
    if (e.key === 'Enter') {
        const codigo = e.target.value.trim();
        e.target.value = ""; // Limpa campo imediatamente
        
        if (!codigo) return;
        
        processarLeitura(codigo);
    }
};

async function processarLeitura(codigo, funcionarioId = null, funcionarioNome = null) {
    const feedback = document.getElementById('feedback-leitura');
    const somOk = document.getElementById('som-ok');
    const somErro = document.getElementById('som-erro');
    const msg = document.getElementById('mensagem-scanner');
    
    if (msg) msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando código...';
    
    // NOVO: Se for um código de FICHA (FCH-...), abre o painel de lançamento da ficha
    if (codigo.startsWith('FCH-')) {
        if (somOk) somOk.play().catch(e => {});
        window.abrirAuditoriaComCodigo(codigo);
        if (msg) msg.innerHTML = '<i class="fas fa-check-circle"></i> Ficha identificada!';
        return;
    }


    try {
        // 1. Buscar produto pelo código
        const docProd = await db.collection('producao_produtos').doc(codigo).get();

        
        if (!docProd.exists) {
            if (somErro) {
                somErro.play().catch(err => console.warn("Erro ao tocar som: ", err));
            }
            if (feedback) {
                feedback.innerHTML = `
                    <div class="card-body text-center py-5">
                        <div class="text-danger">
                            <i class="fas fa-times-circle mb-3 fa-4x animate__animated animate__shakeX"></i>
                            <h3 class="fw-bold mb-1">CÓDIGO NÃO CADASTRADO</h3>
                            <p class="mb-0 fs-5">${codigo}</p>
                        </div>
                    </div>
                `;
            }
            setTimeout(() => { if (msg) msg.innerHTML = '<i class="fas fa-check-circle"></i> Pronto para leitura'; }, 2000);
            return;
        }
        
        const produto = docProd.data();
        const data = new Date().toISOString().split('T')[0];
        const turno = document.getElementById('scanner-turno').value;
        const semana = converterDataParaSemanaISO(data);
        
        // 2. Incrementar Lançamento Geral do Dia/Turno/Setor
        const idDocTotal = `prod_${data}_${turno}_${produto.setorId}`;
        await db.collection('producao_lancamentos').doc(idDocTotal).set({
            quantidade: firebase.firestore.FieldValue.increment(1),
            data, turno, semana, 
            setorId: produto.setorId, 
            setorNome: produto.setorNome,
            ultimoRegistro: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // 3. Logar a Leitura Individual
        await db.collection('producao_leituras').add({
            codigo,
            produtoDesc: produto.descricao,
            tamanho: produto.tamanho,
            data,
            hora: new Date().toLocaleTimeString(),
            turno,
            setorId: produto.setorId,
            funcionarioId: funcionarioId || null,
            funcionarioNome: funcionarioNome || null,
            usuario: auth.currentUser?.email || 'Estação-Scanner'
        });
        
        // 4. Feedback Sucesso
        if (somOk) {
            somOk.play().catch(err => console.warn("Erro ao tocar som: ", err));
        }
        if (feedback) {
            feedback.classList.remove('scanned-highlight');
            void feedback.offsetWidth; // Trigger reflow
            feedback.classList.add('scanned-highlight');
            
            feedback.innerHTML = `
                <div class="card-body text-center py-4 bg-primary text-white">
                    <div class="small fw-bold text-white-50 mb-2">PRODUTO IDENTIFICADO (${produto.setorNome})</div>
                    <h2 class="fw-bold mb-1 text-glow animate__animated animate__pulse">${produto.descricao}</h2>
                    <div class="h4 mb-0 opacity-75">Tamanho: ${produto.tamanho}</div>
                    <div class="badge bg-white text-primary mt-2">+1 Registrado</div>
                </div>
            `;
        }
        
        // Atualizar lista recente
        __SESSAO_LEITURAS.unshift({
            nome: produto.descricao,
            tamanho: produto.tamanho,
            hora: new Date().toLocaleTimeString()
        });
        
        renderizarListaSessao();
        
        if (msg) {
            msg.innerHTML = '<i class="fas fa-check-circle"></i> Leitura processada!';
            setTimeout(() => { msg.innerHTML = '<i class="fas fa-check-circle"></i> Pronto para leitura'; }, 1000);
        }

    } catch (e) {
        console.error("Erro na leitura:", e);
        if (somErro) somErro.play();
    }
}

function renderizarListaSessao() {
    const list = document.getElementById('lista-leituras-recentes');
    if (!list) return;
    
    const contador = document.getElementById('contador-sessao');
    if (contador) contador.innerText = `${__SESSAO_LEITURAS.length} Itens`;
    
    list.innerHTML = __SESSAO_LEITURAS.slice(0, 10).map(l => `
        <li class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div>
                <div class="fw-bold">${l.nome}</div>
                <div class="small text-muted">Tamanho: ${l.tamanho}</div>
            </div>
            <div class="text-end">
                <div class="small fw-bold text-primary">${l.hora}</div>
                <div class="text-success small fw-bold">+1 Unid</div>
            </div>
        </li>
    `).join('');
}

// 11. Scanner por Câmera (Mobile)
let __html5QrCode = null;
let __ultimoCodigoCapturado = null;

window.abrirCameraScanner = () => {
    const modalEl = document.getElementById('modalCameraScanner');
    if (!modalEl) return;
    
    const divScanner = document.getElementById('reader-container');
    const divConfirmacao = document.getElementById('scanner-confirmacao');
    if(divScanner) divScanner.classList.remove('d-none');
    if(divConfirmacao) divConfirmacao.classList.add('d-none');
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    
    modalEl.addEventListener('shown.bs.modal', function () {
        if (__html5QrCode) {
            __html5QrCode.clear();
        }
        
        __html5QrCode = new Html5Qrcode("reader");
        const config = { 
            fps: 6, // Reduzido um pouco para economizar bateria e processamento em mobile
            qrbox: { width: 250, height: 120 },
            aspectRatio: 1.0
        };
        
        __html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            async (decodedText) => {
                // Ao capturar, pausa imediatamente e entra no fluxo de confirmação
                if (__html5QrCode.isScanning) {
                    await __html5QrCode.pause();
                }
                __ultimoCodigoCapturado = decodedText;
                
                // Feedback Sonoro de Captura (Opcional - Bipar antes de confirmar?)
                const somOk = document.getElementById('som-ok');
                if (somOk) somOk.play().catch(e => {});

                mostrarConfirmacaoLeitura(decodedText);
            },
            (errorMessage) => {}
        ).catch(err => {
            console.error("Erro ao iniciar câmera:", err);
            alert("Erro ao acessar câmera: " + err);
        });
    }, { once: true });
};

async function mostrarConfirmacaoLeitura(codigo) {
    const divScanner = document.getElementById('reader-container');
    const divConfirmacao = document.getElementById('scanner-confirmacao');
    const msgLeitura = document.getElementById('reader-msg');
    
    if (msgLeitura) msgLeitura.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Identificando produto...';
    
    try {
        const docProd = await db.collection('producao_produtos').doc(codigo).get();
        
        if (!docProd.exists) {
            console.warn("Produto não encontrado para o código:", codigo);
            alert("Código não cadastrado na grade: " + codigo);
            if (__html5QrCode) __html5QrCode.resume();
            if (msgLeitura) msgLeitura.innerHTML = 'Posicione o código no centro do quadrado.';
            return;
        }
        
        const p = docProd.data();
        console.log("Produto Identificado:", p);
        
        document.getElementById('sc-produto-nome').innerText = p.descricao;
        document.getElementById('sc-produto-tamanho').innerText = `Tamanho: ${p.tamanho}`;
        
        // 2. Buscar funcionários ativos e filtrar pelo setor do produto
        // Fazemos o filtro via JS para evitar problemas de índices no Firestore e ser mais flexível
        const funcSnapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();
        
        const select = document.getElementById('sc-funcionario-vincular');
        if (select) {
            select.innerHTML = '<option value="">Selecione o produtor...</option>';
            
            let encontrados = 0;
            funcSnapshot.forEach(doc => {
                const f = doc.data();
                // Compara o setor do funcionário com o setorNome do produto (case-insensitive)
                const setorFunc = (f.setor || "").toString().trim().toUpperCase();
                const setorProd = (p.setorNome || "").toString().trim().toUpperCase();
                
                if (setorFunc === setorProd && f.beneficios?.elegivelBonusProducao === true) {
                    select.innerHTML += `<option value="${doc.id}">${f.nome}</option>`;
                    encontrados++;
                }
            });
            
            console.log(`Encontrados ${encontrados} colaboradores para o setor ${p.setorNome}`);
            
            if (encontrados === 0) {
                select.innerHTML = `<option value="">Nenhum colaborador no setor ${p.setorNome || 'Desconhecido'}</option>`;
            }
        }
        
        if (msgLeitura) msgLeitura.innerHTML = '<i class="fas fa-check"></i> Produto Identificado';
        
        // Alterna visual para confirmação
        divScanner.classList.add('d-none');
        divConfirmacao.classList.remove('d-none');
        
    } catch (e) {
        console.error("Erro detalhado ao buscar dados:", e);
        alert("Erro ao processar dados da leitura. Verifique o console.");
        if (__html5QrCode) __html5QrCode.resume();
    }
}

window.salvarLeituraConfirmada = async () => {
    if (!__ultimoCodigoCapturado) return;
    
    // Pegar o funcionário selecionado
    const select = document.getElementById('sc-funcionario-vincular');
    const funcId = select?.value;
    const funcNome = select?.options[select.selectedIndex]?.text;
    
    if (!funcId) {
        alert("Por favor, selecione quem produziu este par.");
        return;
    }
    
    // Processa o salvamento (mesma função da estação de leitura, agora com vínculo)
    await processarLeitura(__ultimoCodigoCapturado, funcId, funcNome);
    
    // Retorna ao estado de leitura
    voltarAoScanner();
};

window.cancelarLeituraConfirmada = () => {
    voltarAoScanner();
};

function voltarAoScanner() {
    __ultimoCodigoCapturado = null;
    const divScanner = document.getElementById('reader-container');
    const divConfirmacao = document.getElementById('scanner-confirmacao');
    const msgLeitura = document.getElementById('reader-msg');
    
    divConfirmacao.classList.add('d-none');
    divScanner.classList.remove('d-none');
    if (msgLeitura) msgLeitura.innerHTML = 'Posicione o código no centro do quadrado.';
    
    if (__html5QrCode) {
        __html5QrCode.resume();
    }
}

window.pararCameraScanner = async () => {
    if (__html5QrCode) {
        try {
            if (__html5QrCode.isScanning) {
                await __html5QrCode.stop();
            }
            __html5QrCode.clear();
        } catch (err) {
            console.warn("Erro ao finalizar scanner:", err);
        }
    }
};

// Limpar ao fechar modal via backdrop ou ESC
document.addEventListener('DOMContentLoaded', () => {
    const modalScanner = document.getElementById('modalCameraScanner');
    if (modalScanner) {
        modalScanner.addEventListener('hidden.bs.modal', window.pararCameraScanner);
    }
});

// ========== EXPOSIÇÃO GLOBAL FINAL ==========
window.inicializarProducaoMetas = inicializarProducaoMetas;
window.carregarDashboardProducao = carregarDashboardProducao;
window.salvarMetasSemanais = salvarMetasSemanais;
window.salvarLancamentoProducao = salvarLancamentoProducao;
window.inicializarLancamentoLote = inicializarLancamentoLote;
window.inicializarGestaoBonus = inicializarGestaoBonus;
window.carregarDashboardBonus = carregarDashboardBonus;
window.inicializarListaProdutos = inicializarListaProdutos;
window.carregarListaProdutos = carregarListaProdutos;
window.inicializarEstacaoLeitura = inicializarEstacaoLeitura;
window.abrirCameraScanner = abrirCameraScanner;
window.pararCameraScanner = pararCameraScanner;

window.excluirLancamentoProducao = async (id) => {
    if (confirm("Deseja excluir este lançamento?")) {
        await db.collection('producao_lancamentos').doc(id).delete();
        if (document.getElementById('filtro-producao-semana')) {
            await carregarDashboardProducao();
        } else if (document.getElementById('form-lp-data-lote')) {
            await verificarLancamentosExistentes();
        }
        mostrarMensagem('Lançamento removido', 'warning');
    }
};

window.verDetalheBonus = (setorId) => {
    const s = __ULTIMO_RESUMO_BONUS[setorId];
    if (!s) return;
    
    document.getElementById('detalhe-bonus-gestor').innerText = s.nome;
    
    const tbody = document.getElementById('lista-equipe-elegivel-bonus');
    if (tbody) {
        if (!s.funcionarios || s.funcionarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum colaborador elegível neste setor.</td></tr>';
        } else {
            tbody.innerHTML = s.funcionarios.map(f => `
                <tr>
                    <td class="ps-2"><i class="fas fa-user-circle text-muted me-2"></i>${f.nome}</td>
                    <td>${f.cargo}</td>
                    <td class="text-end pe-2"><span class="badge bg-light text-primary">Sim</span></td>
                </tr>
            `).join('');
        }
    }
    
    const modalEl = document.getElementById('modalDetalheBonus');
    if (modalEl) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
};

window.configurarRegrasBonus = () => {
    alert("Configuração de Regras:\n\n1. Meta Batida (100%): R$ 500,00\n2. Bônus Extra: R$ 50,00 por cada 1% acima da meta.\n3. Elegibilidade: Mínimo 95% de média mensal.\n\nFuncionalidade de edição em desenvolvimento.");
};

window.aprovarBonusLote = async () => {
    if (confirm("Deseja aprovar todos os bônus pendentes do mês selecionado?")) {
        mostrarMensagem('Bônus aprovados para pagamento!', 'success');
    }
};

// ==========================================
// 11. GERADOR E AUDITORIA DE FICHA DE PRODUÇÃO
// ==========================================

let __FICHA_COLABORADORES = [];
let __FICHA_PRODUTOS = [];

window.abrirModalGerarFicha = async () => {
    // limpar estados
    __FICHA_COLABORADORES = [];
    __FICHA_PRODUTOS = [];
    
    document.getElementById('gf-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('gf-obs').value = '';
    document.getElementById('gf-lista-colaboradores').innerHTML = '<li class="list-group-item text-center py-3"><i class="fas fa-spinner fa-spin me-2"></i>Carregando máquinas...</li>';
    document.getElementById('gf-lista-produtos-busca').innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Digite referência ou nome...</li>';
    document.getElementById('gf-lista-produtos-selecionados').innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Nenhum selecionado</li>';
    
    // Forçar carregamento das máquinas e produtos (cache)
    console.log("Abrindo modal: Carregando máquinas e produtos...");
    await carregarMaquinasFicha();
    await carregarCacheProdutosFicha();
    atualizarContagemFicha();


    new bootstrap.Modal(document.getElementById('modalGerarFicha')).show();
};

let __CACHE_PRODUTOS_FICHA = [];

async function carregarCacheProdutosFicha() {
    try {
        const snap = await db.collection('producao_produtos').get();
        __CACHE_PRODUTOS_FICHA = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Cache de produtos carregado: ${__CACHE_PRODUTOS_FICHA.length} itens`);
    } catch (e) { 
        console.error("Erro ao carregar cache de produtos:", e);
    }
}


window.filtrarProdutosFicha = () => {
    const termo = document.getElementById('gf-busca-produto').value.toLowerCase().trim();
    const lista = document.getElementById('gf-lista-produtos-busca');
    
    if (!termo) {
        lista.innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Digite para buscar...</li>';
        return;
    }

    const filtrados = __CACHE_PRODUTOS_FICHA.filter(p => 
        (p.descricao || "").toLowerCase().includes(termo) || 
        (p.codigo || "").toLowerCase().includes(termo)
    ).slice(0, 10); // Limitar a 10 resultados para performance

    if (filtrados.length === 0) {
        lista.innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Nenhum produto encontrado</li>';
        return;
    }

    lista.innerHTML = filtrados.map(p => `
        <li class="list-group-item py-1 d-flex justify-content-between align-items-center">
            <div>
                <div class="small fw-bold">${p.descricao}</div>
                <div class="text-muted" style="font-size: 0.7rem;">Cod: ${p.codigo} | Tam: ${p.tamanho}</div>
            </div>
            <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="adicionarProdutoFicha('${p.codigo}', '${p.descricao}', '${p.tamanho}')">
                <i class="fas fa-plus"></i>
            </button>
        </li>
    `).join('');
};


window.filtrarMaquinasFicha = () => {
    const termo = document.getElementById('gf-busca-maquina').value.toLowerCase().trim();
    const itens = document.querySelectorAll('#gf-lista-colaboradores li');
    
    itens.forEach(item => {
        // Captura todo o texto visível e os atributos de dados para garantir a busca
        const texto = item.innerText.toLowerCase();
        const input = item.querySelector('input');
        const operador = input ? (input.dataset.operadorNome || "").toLowerCase() : "";
        const apelido = input ? (input.dataset.maquinaApelido || "").toLowerCase() : "";
        const codigo = input ? (input.dataset.maquinaCodigo || "").toLowerCase() : "";

        if (texto.includes(termo) || operador.includes(termo) || apelido.includes(termo) || codigo.includes(termo)) {
            item.style.setProperty('display', 'block', 'important');
        } else {
            item.style.setProperty('display', 'none', 'important');
        }
    });
};



// Função alternarModoGeracaoFicha removida pois agora é apenas por máquina


async function carregarMaquinasFicha() {
    try {
        const snap = await db.collection('maquinas').where('controlaProducao', '==', true).get();
        const lista = document.getElementById('gf-lista-colaboradores');
        
        if (snap.empty) {
            lista.innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Nenhuma máquina configurada para produção</li>';
            return;
        }

        lista.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            lista.innerHTML += `
                <li class="list-group-item py-1">
                    <div class="form-check">
                        <input class="form-check-input check-colab-ficha" type="checkbox" 
                               value="${doc.id}" 
                               data-tipo="maquina"
                               data-maquina-id="${doc.id}"
                               data-maquina-codigo="${m.codigo}"
                               data-maquina-apelido="${m.apelido || ''}"
                               data-operador-id="${m.operadorId || ''}"
                               data-operador-nome="${m.operadorNome && m.operadorNome !== 'Nenhum operador vinculado' ? m.operadorNome : 'S/ Operador'}"
                               data-setor-nome="${m.setor || 'N/A'}"
                               onchange="atualizarContagemFicha()">
                        <label class="form-check-label small w-100">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-bold text-primary">${m.codigo}</span>
                                <span class="badge bg-light text-dark border">${m.setor || 'S/ Setor'}</span>
                            </div>
                            <div class="text-dark">${m.nome} ${m.apelido ? `<small class="text-muted">(${m.apelido})</small>` : ''}</div>
                            <div class="mt-1">
                                <span class="badge bg-info text-white" style="font-size: 0.65rem;">
                                    <i class="fas fa-user me-1"></i>${m.operadorNome && m.operadorNome !== 'Nenhum operador vinculado' ? m.operadorNome : 'Não vinculado'}
                                </span>
                            </div>
                        </label>

                    </div>
                </li>
            `;
        });
    } catch (e) {
        console.error(e);
    }
}


window.adicionarProdutoFicha = (codigo, descricao, tamanho) => {
    if (!__FICHA_PRODUTOS.find(p => p.codigo === codigo)) {
        __FICHA_PRODUTOS.push({ codigo, descricao, tamanho });
        renderizarProdutosSelecionadosFicha();
        atualizarContagemFicha();
    }
};

window.removerProdutoFicha = (codigo) => {
    __FICHA_PRODUTOS = __FICHA_PRODUTOS.filter(p => p.codigo !== codigo);
    renderizarProdutosSelecionadosFicha();
    atualizarContagemFicha();
};

function renderizarProdutosSelecionadosFicha() {
    const lista = document.getElementById('gf-lista-produtos-selecionados');
    if (!lista) return;
    if (__FICHA_PRODUTOS.length === 0) {
        lista.innerHTML = '<li class="list-group-item text-center text-muted py-3 small">Nenhum selecionado</li>';
        return;
    }

    lista.innerHTML = __FICHA_PRODUTOS.map(p => `
        <li class="list-group-item py-1 d-flex justify-content-between align-items-center bg-light">
            <div>
                <div class="small fw-bold">${p.descricao}</div>
                <div class="text-muted" style="font-size: 0.6rem;">${p.codigo} | Tam: ${p.tamanho}</div>
            </div>
            <button class="btn btn-sm btn-link text-danger py-0" onclick="removerProdutoFicha('${p.codigo}')">
                <i class="fas fa-times"></i>
            </button>
        </li>
    `).join('');
}


window.atualizarContagemFicha = () => {
    const colabs = document.querySelectorAll('.check-colab-ficha:checked');
    document.getElementById('gf-contagem-selecionados').innerText = `${colabs.length} Colab. | ${__FICHA_PRODUTOS.length} Produtos`;
};

window.gerarSalvarFichaProducao = async () => {
    const data = document.getElementById('gf-data').value;
    const turno = 'Geral'; // Turno fixo/comercial conforme solicitado
    const obs = document.getElementById('gf-obs').value;
    const modo = 'maquina'; 
    
    if (!data) return alert("Informe a data.");
    
    const checksColab = document.querySelectorAll('.check-colab-ficha:checked');
    if (checksColab.length === 0) return alert("Selecione ao menos uma máquina.");

    if (__FICHA_PRODUTOS.length === 0) return alert("Adicione ao menos um produto.");

    try {
        const batch = db.batch();
        const idsGerados = [];

        if (true) { // Modo máquina é o único
            // Gerar UMA FICHA POR MÁQUINA
            checksColab.forEach(check => {
                const maquinaId = check.dataset.maquinaId;
                const maquinaCodigo = check.dataset.maquinaCodigo;
                const operadorId = check.dataset.operadorId;
                const operadorNome = check.dataset.operadorNome;
                const setorNome = check.dataset.setorNome;

                // ID mais robusto: FCH-COD-DATA-ALEAT
                const dataFicha = data.replace(/-/g, '').slice(4); // MMDD
                const idFicha = `FCH-${maquinaCodigo}-${dataFicha}-${Math.floor(1000 + Math.random() * 9000)}`;

                const ref = db.collection('producao_fichas').doc(idFicha);
                
                const dadosFicha = {
                    id: idFicha,
                    data, turno, obs,
                    setorId: 'MAQUINA_' + maquinaId,
                    setorNome: `${setorNome} (MÁQ: ${maquinaCodigo})`,
                    maquinaId,
                    maquinaCodigo,
                    maquinaApelido: check.dataset.maquinaApelido || '',
                    colaboradores: [{ id: operadorId, nome: operadorNome }],

                    produtos: __FICHA_PRODUTOS,
                    status: 'Aberta',
                    geradaEm: firebase.firestore.FieldValue.serverTimestamp(),
                    geradaPor: auth.currentUser?.email || 'Sistema'
                };
                
                batch.set(ref, dadosFicha);
                idsGerados.push(dadosFicha);
            });
        }


        await batch.commit();
        mostrarMensagem(`${idsGerados.length} ficha(s) gerada(s) com sucesso!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalGerarFicha')).hide();
        
        // Imprimir a(s) ficha(s)
        idsGerados.forEach(f => visualizarFichaImpressa(f));
        
        await carregarFichasDia();
    } catch (e) {
        alert("Erro ao gerar ficha: " + e.message);
    }
};

async function visualizarFichaImpressa(ficha) {
    let chamados = [];
    if (ficha.status === 'Concluída') {
        const snap = await db.collection('manutencao_chamados')
            .where('maquinaId', '==', ficha.maquinaId)
            .where('data', '==', ficha.data)
            .get();
        chamados = snap.docs.map(d => d.data());
    }
    imprimirViewFicha(ficha, chamados);
}

function imprimirViewFicha(ficha, chamados = []) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ficha.id}`;
    const logoSrc = document.getElementById('sidebar-logo')?.src || 'assets/LOGO.png';
    const colabPrincipal = ficha.colaboradores?.[0]?.nome || 'Colaborador não identificado';
    const dataFmt = (ficha.data || '').split('-').reverse().join('/');
    const isConcluida = ficha.status === 'Concluída';

    // =====================================================
    // BLOCO DE PRODUTOS — diferente para aberta/concluída
    // =====================================================
    let produtosHtml = '';
    if (isConcluida && ficha.detalhesLancamento) {
        // Agrupa quantidades por produto (pode haver múltiplos colaboradores)
        const totaisPorProd = {};
        Object.entries(ficha.detalhesLancamento).forEach(([key, qtd]) => {
            const partes = key.split('_');
            const prodCod = partes[partes.length - 1];
            totaisPorProd[prodCod] = (totaisPorProd[prodCod] || 0) + qtd;
        });

        ficha.produtos.forEach(p => {
            const qtd = totaisPorProd[p.codigo] || 0;
            produtosHtml += `
                <tr>
                    <td style="font-weight:800;">${p.codigo}</td>
                    <td>${p.descricao}</td>
                    <td style="text-align:center;font-weight:800;font-size:14px;">${p.tamanho}</td>
                    <td style="text-align:center;font-weight:900;font-size:16px;background:${qtd > 0 ? '#f0fff4' : '#fff'};color:${qtd > 0 ? '#198754' : '#999'};">${qtd > 0 ? qtd : '—'}</td>
                </tr>`;
        });
    } else {
        // Ficha em branco para preenchimento manual
        ficha.produtos.forEach(p => {
            produtosHtml += `
                <tr>
                    <td style="font-weight:800;">${p.codigo}</td>
                    <td>${p.descricao}</td>
                    <td style="text-align:center;font-weight:800;font-size:14px;">${p.tamanho}</td>
                    <td class="col-check"></td>
                </tr>`;
        });
    }

    // =====================================================
    // BLOCO DE MANUTENÇÃO
    // =====================================================
    let manutencaoHtml = '';
    if (isConcluida && chamados.length > 0) {
        // Ficha concluída: mostrar chamados reais
        manutencaoHtml = `
            <div class="downtime-section" style="border-color:#dc3545;">
                <div class="downtime-title" style="color:#dc3545;">⚠ Chamados de Manutenção na Data</div>
                <table style="font-size:10px;margin-bottom:0;">
                    <thead>
                        <tr>
                            <th>Motivo</th>
                            <th style="width:100px;">Status</th>
                            <th style="width:100px;">Tempo Parada</th>
                            <th style="width:120px;">Mecânico</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chamados.map(c => `
                            <tr>
                                <td>${c.motivo || c.motivoManutencao || '—'}</td>
                                <td style="text-align:center;font-weight:700;">${c.status}</td>
                                <td style="text-align:center;">${c.tempoParada || '—'}</td>
                                <td>${c.mecanico || c.createdByNome || '—'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } else {
        // Ficha em branco: espaço para anotação manual
        manutencaoHtml = `
            <div class="downtime-section">
                <div class="downtime-title">Registro de Parada de Máquina (Uso da Manutenção)</div>
                <div style="display:flex;gap:20px;">
                    <div style="flex:1;">
                        <span class="info-label">Tempo Total de Parada (minutos)</span>
                        <div style="height:25px;border-bottom:1px dashed #000;margin-top:5px;"></div>
                    </div>
                    <div style="flex:2;">
                        <span class="info-label">Motivo / Causa da Ocorrência</span>
                        <div style="height:25px;border-bottom:1px dashed #000;margin-top:5px;"></div>
                    </div>
                </div>
            </div>`;
    }

    // =====================================================
    // STATUS BADGE (apenas para concluída)
    // =====================================================
    const statusBanner = isConcluida ? `
        <div style="background:#198754;color:#fff;padding:5px 15px;text-align:right;font-size:11px;font-weight:800;margin-bottom:8px;border-radius:4px;">
            ✅ CONCLUÍDA — ${ficha.totalProduzido || 0} unidades produzidas
            ${ficha.concluidaEm ? ` | Encerrado em: ${new Date(ficha.concluidaEm.seconds * 1000).toLocaleString('pt-BR')}` : ''}
        </div>` : '';

    const html = `
        <html>
        <head>
            <title>Ficha ${ficha.id}${isConcluida ? ' — COMPROVANTE' : ''}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
                @page { size: A4 portrait; margin: 5mm; }
                body { font-family: 'Outfit', sans-serif; margin: 0; padding: 0; color: #000; font-size: 12px; }
                .container { padding: 10px; border: 2px solid #000; min-height: 98%; position: relative; }
                
                .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                .header-left { display: flex; gap: 15px; align-items: center; }
                .logo { height: 45px; }
                .ficha-info { text-align: right; }
                .ficha-title { font-size: 20px; font-weight: 800; margin: 0; }
                .ficha-id { font-size: 14px; font-weight: 600; background: #000; color: #fff; padding: 2px 10px; border-radius: 4px; display: inline-block; margin-top: 5px; }

                .colab-banner { background: #eee; padding: 8px 15px; font-size: 18px; font-weight: 800; text-transform: uppercase; border: 1px solid #000; margin-bottom: 10px; }
                
                .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 10px; }
                .info-item { border: 1px solid #ccc; padding: 5px; }
                .info-label { font-size: 9px; font-weight: 700; color: #555; text-transform: uppercase; display: block; }
                .info-value { font-size: 12px; font-weight: 600; }

                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                th { background: #f0f0f0; border: 1px solid #000; padding: 6px; font-size: 10px; text-transform: uppercase; }
                td { border: 1px solid #000; padding: 8px; font-size: 12px; }
                .col-check { width: 100px; height: 35px; }

                .footer { display: grid; grid-template-columns: 100px 1fr 1fr; gap: 20px; align-items: end; margin-top: 15px; }
                .qr-box img { width: 90px; height: 90px; border: 1px solid #eee; }
                .sig-box { border-top: 1px solid #000; text-align: center; font-size: 10px; font-weight: 700; padding-top: 5px; }
                
                .downtime-section { border: 1px solid #000; padding: 10px; margin-top: 10px; }
                .downtime-title { font-weight: 800; font-size: 11px; text-transform: uppercase; margin-bottom: 5px; color: #d63031; }

                @media print { .no-print { display: none; } }
                .btn-print { position: fixed; bottom: 20px; right: 20px; background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; font-weight: 800; cursor: pointer; }
            </style>
        </head>
        <body>
            <button class="btn-print no-print" onclick="window.print()">IMPRIMIR AGORA</button>
            <div class="container">
                <div class="header">
                    <div class="header-left">
                        <img src="${logoSrc}" class="logo">
                        <div>
                            <div style="font-weight:800;font-size:14px;">CONTROLE DE PRODUÇÃO</div>
                            <div style="font-size:10px;">Nexter ERP v3 | ISO 9001 Integration</div>
                        </div>
                    </div>
                    <div class="ficha-info">
                        <div class="ficha-title">${isConcluida ? 'COMPROVANTE' : 'FICHA TÉCNICA'}</div>
                        <div class="ficha-id">${ficha.id}</div>
                    </div>
                </div>

                ${statusBanner}

                <div class="colab-banner">${colabPrincipal}</div>

                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Máquina / Equipamento</span>
                        <span class="info-value">${ficha.maquinaCodigo || '—'} ${ficha.maquinaApelido ? `(${ficha.maquinaApelido})` : ''}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Setor</span>
                        <span class="info-value">${(ficha.setorNome || '').split('(')[0]}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data</span>
                        <span class="info-value">${dataFmt}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:120px;">Cód. Referência</th>
                            <th>Descrição do Produto</th>
                            <th style="width:60px;">Tam.</th>
                            <th style="width:120px;">${isConcluida ? 'Qtde Produzida' : 'Qtde (preencher)'}</th>
                        </tr>
                    </thead>
                    <tbody>${produtosHtml}</tbody>
                </table>

                ${manutencaoHtml}

                ${ficha.obs ? `<div style="margin-top:10px;font-size:10px;border:1px solid #eee;padding:5px;"><strong>OBSERVAÇÕES:</strong> ${ficha.obs}</div>` : ''}

                <div class="footer">
                    <div class="qr-box">
                        <img src="${qrUrl}">
                        <div style="font-size:7px;text-align:center;font-weight:800;">VALIDAÇÃO DIGITAL</div>
                    </div>
                    <div class="sig-box">${isConcluida ? `CONFERIDO POR: ${ficha.concluidaPor || '___________'}` : 'ASSINATURA DO OPERADOR'}</div>
                    <div class="sig-box">${isConcluida ? `TOTAL: ${ficha.totalProduzido || 0} UN.` : 'VISTO SUPERVISÃO'}</div>
                </div>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}




// --- AUDITORIA DA FICHA ---

let __FICHA_AUDITORIA_ATUAL = null;

window.abrirPainelAuditoriaFicha = () => {
    document.getElementById('af-codigo-ficha').value = '';
    document.getElementById('af-resultado-ficha').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('modalAuditoriaFicha')).show();
    setTimeout(() => { document.getElementById('af-codigo-ficha').focus(); }, 500);
};

window.abrirAuditoriaComCodigo = (codigo) => {
    window.abrirPainelAuditoriaFicha();
    const input = document.getElementById('af-codigo-ficha');
    if (input) {
        input.value = codigo;
        window.buscarFichaAuditoria();
    }
};

window.buscarFichaAuditoria = async () => {
    const input = document.getElementById('af-codigo-ficha');
    let codigo = input.value.trim().toUpperCase();
    if (!codigo) return;
    
    // Limpar resultados anteriores

    try {
        // 1. Tentar busca direta pelo ID do documento
        let docFicha = await db.collection('producao_fichas').doc(codigo).get();
        
        // 2. Se não encontrar, tentar busca por substring no ID (para quando digitam incompleto ou com erro de sufixo)
        if (!docFicha.exists) {
            const snap = await db.collection('producao_fichas')
                .where('id', '>=', codigo)
                .where('id', '<=', codigo + '\uf8ff')
                .limit(1).get();
            if (!snap.empty) docFicha = snap.docs[0];
        }

        // 3. Busca ainda mais flexível: se contiver o código no meio do ID
        if (!docFicha || !docFicha.exists) {
            const snap = await db.collection('producao_fichas').get(); // Cuidado com escala, mas útil para debug/pequenos volumes
            docFicha = snap.docs.find(d => d.id.includes(codigo));
        }

        if (!docFicha || !docFicha.exists) {
            alert("Ficha não encontrada: " + codigo + "\nVerifique se o código está correto.");
            return;
        }
        
        __FICHA_AUDITORIA_ATUAL = docFicha.data();
        renderizarFichaAuditoria();
        document.getElementById('af-resultado-ficha').classList.remove('d-none');
        input.value = ''; 
    } catch (e) {
        alert("Erro ao buscar ficha: " + e.message);
    }
};



function renderizarFichaAuditoria() {
    const f = __FICHA_AUDITORIA_ATUAL;
    document.getElementById('af-info-header').innerText = `Ficha: ${f.id} ${f.tipo === 'Substituta' ? '(SUBSTITUTA)' : ''}`;
    document.getElementById('af-info-setor').innerText = f.setorNome;
    document.getElementById('af-info-data').innerText = `${f.data.split('-').reverse().join('/')} - ${f.turno}`;
    document.getElementById('af-info-equipe').innerText = f.colaboradores.length + ' Colab.';
    
    const badge = document.getElementById('af-status');
    if (f.status === 'Aberta') {
        badge.className = 'badge bg-primary';
        badge.innerText = 'Aberta';
    } else {
        badge.className = 'badge bg-success';
        badge.innerText = 'Concluída';
    }
    
    // Renderizar Grid de Lançamento
    const headerRow = document.getElementById('af-header-produtos');
    const gridBody = document.getElementById('af-grid-colaboradores');
    
    // Header com produtos
    let headerHtml = '<th>Colaborador</th>';
    f.produtos.forEach(p => {
        headerHtml += `<th class="text-center small">${p.tamanho}<br><span style="font-size:0.6rem; font-weight:normal;">${p.codigo}</span></th>`;
    });
    headerRow.innerHTML = headerHtml;

    // Linhas com colaboradores
    let gridHtml = '';
    f.colaboradores.forEach(c => {
        const colabId = c.id || 'sem_id';
        gridHtml += `<tr><td class="fw-bold small">${c.nome}</td>`;
        f.produtos.forEach(p => {
            // Tenta buscar por ID ou pelo nome do colaborador (fallback)
            const valAnterior = f.detalhesLancamento?.[`${colabId}_${p.codigo}`] || 
                               f.detalhesLancamento?.[`${c.nome}_${p.codigo}`] || '';
            
            gridHtml += `
                <td>
                    <input type="number" class="form-control form-control-sm text-center input-grid-ficha" 
                           data-colab-id="${colabId}" 
                           data-colab-nome="${c.nome}"
                           data-prod-codigo="${p.codigo}"
                           value="${valAnterior}"
                           placeholder="0">
                </td>`;
        });
        gridHtml += `</tr>`;
    });

    gridBody.innerHTML = gridHtml;

}



window.salvarBaixaFicha = async () => {
    if (!__FICHA_AUDITORIA_ATUAL) return;

    // Buscar status ATUALIZADO do Firestore para evitar dados desatualizados em memória
    const docAtualizado = await db.collection('producao_fichas').doc(__FICHA_AUDITORIA_ATUAL.id).get();
    if (!docAtualizado.exists) return alert('Ficha não encontrada no banco de dados.');

    const statusAtual = docAtualizado.data().status || '';
    const f = { ...__FICHA_AUDITORIA_ATUAL, status: statusAtual };
    __FICHA_AUDITORIA_ATUAL = f;

    if (statusAtual === 'Concluída') {
        // Ficha já finalizada: perguntar antes de substituir
        const confirmar = confirm(
            `Esta ficha já foi concluída anteriormente.\n\nDeseja relançar e substituir os dados anteriores?`
        );
        if (!confirmar) return;
        new bootstrap.Modal(document.getElementById('modalMotivoSubstituicao')).show();
        return;
    }

    await executarSalvarBaixa(f);
};


async function executarSalvarBaixa(f, motivo = null) {
    const inputs = document.querySelectorAll('.input-grid-ficha');
    let totalLancado = 0;
    const detalhes = {};
    const promises = [];
    const semanaISO = converterDataParaSemanaISO(f.data);
    
    inputs.forEach(input => {
        const qtd = parseInt(input.value) || 0;
        const colabId = input.dataset.colabId;
        const colabNome = input.dataset.colabNome;
        const prodCodigo = input.dataset.prodCodigo;

        if (qtd > 0) {
            totalLancado += qtd;
            detalhes[`${colabId}_${prodCodigo}`] = qtd;

            const idDocLancamento = `prod_fch_${f.id}_${colabId}_${prodCodigo}`;
            promises.push(db.collection('producao_lancamentos').doc(idDocLancamento).set({
                fichaId: f.id,
                setorId: f.setorId,
                setorNome: f.setorNome,
                data: f.data,
                turno: f.turno,
                semana: semanaISO,
                quantidade: qtd,
                produtoCodigo: prodCodigo,
                colaboradorId: colabId,
                colaboradorNome: colabNome,
                tipo: f.tipo || 'Original',
                obs: motivo ? `SUBSTITUTA: ${motivo}` : `Lançamento via Ficha: ${f.id}`,
                registradoEm: firebase.firestore.FieldValue.serverTimestamp(),
                registradoPor: auth.currentUser?.email || 'Sistema'
            }));
        }
    });
    
    if (totalLancado === 0) return alert("Informe as quantidades produzidas.");

    // Se for uma substituição, precisamos estornar o estoque da ficha anterior? 
    // Por simplicidade neste fluxo, vamos apenas registrar o saldo da nova ficha.


    try {


        const updates = {
            status: 'Concluída',
            concluidaEm: firebase.firestore.FieldValue.serverTimestamp(),
            concluidaPor: auth.currentUser?.email || 'Sistema',
            totalProduzido: totalLancado,
            detalhesLancamento: detalhes
        };



        if (motivo) {
            updates.tipo = 'Substituta';
            updates.motivoSubstituicao = motivo;
            updates.fichaOriginalId = f.id;
        }

        promises.push(db.collection('producao_fichas').doc(f.id).update(updates));
        
        // --- CONTROLE DE ESTOQUE ---
        // Para cada produto lançado, atualizamos o estoque
        const prodCodigos = [...new Set(Array.from(inputs).map(i => i.dataset.prodCodigo))];
        for (const cod of prodCodigos) {
            let totalProd = 0;
            inputs.forEach(i => { if(i.dataset.prodCodigo === cod) totalProd += (parseInt(i.value) || 0); });
            
            if (totalProd > 0) {
                promises.push(registrarMovimentacaoEstoque(cod, totalProd, 'ENTRADA', f.id));
            }
        }

        
        await Promise.all(promises);
        bootstrap.Modal.getInstance(document.getElementById('modalAuditoriaFicha')).hide();
        if (motivo) {
            const msMod = bootstrap.Modal.getInstance(document.getElementById('modalMotivoSubstituicao'));
            if (msMod) msMod.hide();
        }

        // Atualizar a ficha em memória com os novos valores
        const fichaFinalizada = { ...f, status: 'Concluída', totalProduzido: totalLancado, detalhesLancamento: detalhes };
        await exibirResumoPosBaixa(fichaFinalizada, detalhes);

        await carregarFichasDia();

    } catch(e) {
        alert("Erro ao salvar: " + e.message);
    }
}

window.confirmarSubstituicaoFicha = async () => {
    const motivo = document.getElementById('ms-motivo').value.trim();
    if (!motivo) return alert("Informe o motivo da substituição.");
    await executarSalvarBaixa(__FICHA_AUDITORIA_ATUAL, motivo);
};

async function registrarMovimentacaoEstoque(codigo, qtd, tipo, fichaId) {
    try {
        const snapProd = await db.collection('producao_produtos').where('codigo', '==', codigo).limit(1).get();
        if (snapProd.empty) return;
        
        const prodDoc = snapProd.docs[0];
        const prodId = prodDoc.id;
        const p = prodDoc.data();

        const incremento = tipo === 'ENTRADA' ? qtd : -qtd;
        await db.collection('producao_produtos').doc(prodId).update({
            estoqueAtual: firebase.firestore.FieldValue.increment(incremento),
            ultimaMovimentacao: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('producao_estoque_movimentos').add({
            produtoId: prodId,
            produtoCodigo: codigo,
            produtoDesc: p.descricao,
            quantidade: qtd,
            tipo: tipo,
            origem: 'Produção',
            referenciaId: fichaId,
            data: new Date().toISOString().split('T')[0],
            registradoEm: firebase.firestore.FieldValue.serverTimestamp(),
            registradoPor: auth.currentUser?.email || 'Sistema'
        });
    } catch (e) {
        console.error("Erro no estoque:", e);
    }
}

// ================================================================
// LEITOR DE QR CODE (CÂMERA)
// ================================================================
let __qr_stream = null;

window.abrirLeitorQR = () => {
    let modal = document.getElementById('modalQRReader');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalQRReader';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-dark text-white py-2">
                        <h5 class="modal-title"><i class="fas fa-qrcode me-2"></i>Escanear QR Code</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-2 text-center">
                        <p class="small text-muted mb-2">Aponte a câmera para o QR Code da ficha</p>
                        <div style="position:relative; width:100%; max-width:360px; margin:0 auto;">
                            <video id="qr-video" style="width:100%; border-radius:8px; background:#000;" autoplay playsinline></video>
                            <canvas id="qr-canvas" style="display:none;"></canvas>
                            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border:3px solid #0d6efd;border-radius:8px;pointer-events:none;"></div>
                        </div>
                        <div id="qr-status" class="mt-2 small text-muted">Inicializando câmera...</div>
                    </div>
                    <div class="modal-footer py-2">
                        <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    modal.addEventListener('hidden.bs.modal', () => {
        if (__qr_stream) { __qr_stream.getTracks().forEach(t => t.stop()); __qr_stream = null; }
    }, { once: true });

    new bootstrap.Modal(modal).show();
    setTimeout(() => iniciarCameraQR(), 400);
};

async function iniciarCameraQR() {
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const status = document.getElementById('qr-status');
    if (!video) return;

    // Carregar jsQR dinamicamente se ainda não estiver na página
    if (!window.jsQR) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    try {
        __qr_stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = __qr_stream;
        await video.play();
        status.textContent = 'Câmera ativa. Aponte para o QR Code.';
        status.className = 'mt-2 small text-success';
        scanQRFrame(video, canvas, status);
    } catch (e) {
        status.textContent = 'Não foi possível acessar a câmera: ' + e.message;
        status.className = 'mt-2 small text-danger';
    }
}

function scanQRFrame(video, canvas, status) {
    if (!__qr_stream) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR ? window.jsQR(imageData.data, canvas.width, canvas.height) : null;

    if (code && code.data) {
        status.textContent = `✅ Lido: ${code.data}`;
        status.className = 'mt-2 small text-success fw-bold';

        // Parar câmera e fechar modal
        if (__qr_stream) { __qr_stream.getTracks().forEach(t => t.stop()); __qr_stream = null; }
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalQRReader'));
        if (modal) modal.hide();

        // Preencher o campo de código e buscar a ficha
        const input = document.getElementById('af-codigo-ficha');
        if (input) {
            input.value = code.data.trim();
            window.buscarFichaAuditoria();
        }
        return;
    }

    requestAnimationFrame(() => scanQRFrame(video, canvas, status));
}

// ================================================================
// RESUMO PÓS-BAIXA COM CHAMADOS DE MANUTENÇÃO
// ================================================================
async function exibirResumoPosBaixa(ficha, detalhes) {
    // Buscar chamados de manutenção da máquina na data da ficha
    let chamadosHtml = '';
    try {
        const snap = await db.collection('manutencao_chamados')
            .where('maquinaId', '==', ficha.maquinaId)
            .limit(10)
            .get();

        const fichaDate = new Date(ficha.data + 'T00:00:00');
        const chamadosDia = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => {
                if (!c.dataAbertura) return false;
                const cd = c.dataAbertura.toDate();
                return cd.toDateString() === fichaDate.toDateString();
            });

        if (chamadosDia.length > 0) {
            chamadosHtml = `<div class="mt-3 p-3 border border-warning rounded bg-warning bg-opacity-10">
                <h6 class="fw-bold text-warning mb-2"><i class="fas fa-tools me-2"></i>Chamados de Manutenção na Data</h6>`;

            chamadosDia.forEach(c => {
                const statusBadge = c.status === 'Concluído' ? 'bg-success' : (c.status === 'Em Andamento' ? 'bg-warning text-dark' : 'bg-danger');
                const tempoParadaTexto = c.tempoParada ? `<span class="badge bg-secondary ms-2"><i class="fas fa-clock me-1"></i>${c.tempoParada}</span>` : '';
                chamadosHtml += `
                    <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                        <div>
                            <span class="small fw-bold">${c.motivo || 'Sem motivo'}</span>
                            ${tempoParadaTexto}
                        </div>
                        <span class="badge ${statusBadge}">${c.status}</span>
                    </div>`;
            });

            chamadosHtml += '</div>';
        } else {
            chamadosHtml = `<div class="mt-3 p-2 bg-light rounded text-muted small text-center">
                <i class="fas fa-check-circle text-success me-1"></i>Nenhum chamado de manutenção registrado para esta máquina na data.
            </div>`;
        }
    } catch(e) {
        console.warn('Não foi possível carregar chamados de manutenção:', e);
        chamadosHtml = '';
    }

    // Montar resumo de produção por produto
    const prodResumo = {};
    Object.entries(detalhes).forEach(([key, qtd]) => {
        const [, prodCod] = key.split('_');
        prodResumo[prodCod] = (prodResumo[prodCod] || 0) + qtd;
    });

    let prodHtml = '';
    ficha.produtos.forEach(p => {
        const qtd = prodResumo[p.codigo] || 0;
        if (qtd > 0) {
            prodHtml += `<div class="d-flex justify-content-between py-1 border-bottom">
                <span class="small">${p.descricao} <span class="text-muted">(${p.codigo})</span></span>
                <span class="fw-bold text-success">${qtd}</span>
            </div>`;
        }
    });

    const operador = ficha.colaboradores?.[0]?.nome || 'N/A';
    const dataFmt = ficha.data.split('-').reverse().join('/');

    const bodyHtml = `
        <div class="text-center mb-3">
            <div class="display-6 fw-bold text-success">${ficha.totalProduzido}</div>
            <div class="text-muted small">unidades produzidas</div>
        </div>
        <div class="row g-2 mb-3">
            <div class="col-4 text-center bg-light rounded p-2">
                <div class="text-muted" style="font-size:0.65rem;">MÁQUINA</div>
                <div class="fw-bold small">${ficha.maquinaCodigo || 'N/A'}</div>
            </div>
            <div class="col-4 text-center bg-light rounded p-2">
                <div class="text-muted" style="font-size:0.65rem;">OPERADOR</div>
                <div class="fw-bold small">${operador}</div>
            </div>
            <div class="col-4 text-center bg-light rounded p-2">
                <div class="text-muted" style="font-size:0.65rem;">DATA</div>
                <div class="fw-bold small">${dataFmt}</div>
            </div>
        </div>
        <h6 class="fw-bold small text-muted">PRODUÇÃO POR PRODUTO</h6>
        ${prodHtml || '<div class="text-muted small text-center">Sem detalhes</div>'}
        ${chamadosHtml}`;

    let modal = document.getElementById('modalResumoPosBaixa');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalResumoPosBaixa';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
                <div class="modal-content border-0 shadow">
                    <div class="modal-header bg-success text-white py-2">
                        <h5 class="modal-title"><i class="fas fa-check-circle me-2"></i>Ficha Baixada com Sucesso</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="resumo-pos-baixa-body"></div>
                    <div class="modal-footer py-2">
                        <button class="btn btn-outline-dark btn-sm" onclick="visualizarFichaImpressa('${ficha.id}')">
                            <i class="fas fa-print me-1"></i>Imprimir Ficha
                        </button>
                        <button class="btn btn-success btn-sm" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    document.getElementById('resumo-pos-baixa-body').innerHTML = bodyHtml;
    new bootstrap.Modal(modal).show();
}
