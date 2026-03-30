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
        const snapshot = await db.collection('setores').get();
        __PRODUCAO_CONFIG.setores = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(s => s.controlaProducao === true);
        
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

    // Cálculo Simbólico de Bônus (Exemplo: R$ 500 se meta batida + R$ 10 por % extra)
    let bonusPrevisao = 0;
    if (eficiencia >= 95) {
        bonusPrevisao = 500 + (eficiencia > 100 ? (eficiencia - 100) * 50 : 0);
    }
    document.getElementById('kpi-producao-bonus').innerText = `R$ ${bonusPrevisao.toFixed(2)}`;
    
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
        const metaAtual = __PRODUCAO_CONFIG.metas.find(m => m.setorId === s.id)?.metaValue || 0;
        container.innerHTML += `
            <div class="col-md-6 mb-3">
                <label class="form-label small fw-bold">${s.descricao}</label>
                <div class="input-group">
                    <input type="number" class="form-control input-meta-setor" 
                           data-setor-id="${s.id}" data-setor-nome="${s.descricao}" 
                           value="${metaAtual}" placeholder="Meta semanal...">
                    <span class="input-group-text">Unid</span>
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
        
        // Usar ID composto para evitar duplicados na mesma semana
        const metaId = `meta_${semana}_${setorId}`;
        promises.push(db.collection('producao_metas').doc(metaId).set({
            semana: semana,
            setorId: setorId,
            setorNome: input.dataset.setorNome,
            metaValue: metaValue,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }));
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
    
    dataInput.value = new Date().toISOString().split('T')[0];
    
    // Carregar Setores se necessário
    if (__PRODUCAO_CONFIG.setores.length === 0) await carregarSectoresProducao();
    
    renderizarListaSetoresLancamento();
    await verificarLancamentosExistentes();
}

function renderizarListaSetoresLancamento() {
    const tbody = document.getElementById('lista-setores-lancamento');
    if (!tbody) return;
    
    tbody.innerHTML = __PRODUCAO_CONFIG.setores.map(s => `
        <tr data-setor-id="${s.id}" data-setor-nome="${s.descricao}">
            <td class="ps-3 fw-bold">${s.descricao}</td>
            <td class="text-center text-muted small">--</td>
            <td class="text-center">
                <input type="number" class="form-control input-producao-lote" 
                       placeholder="0" data-setor-id="${s.id}">
            </td>
            <td><span class="badge bg-secondary opacity-50">Pendente</span></td>
            <td class="text-end pe-3">
                <input type="text" class="form-control form-control-sm input-obs-lote" 
                       placeholder="obs...">
            </td>
        </tr>
    `).join('');
}

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
            }
        });
        
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
        if (perc >= 100) bonus = 500 + ((perc - 100) * 50);
        else if (perc >= 95) bonus = 250;
        
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
                            <small class="text-muted d-block mb-1">PROVISÃO DE BÔNUS</small>
                            <div class="h4 text-primary fw-bold mb-0">R$ ${bonus.toFixed(2)}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-primary w-100 mt-3" onclick="verDetalheBonus('${id}')">Ver Detalhes</button>
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

async function processarLeitura(codigo) {
    const feedback = document.getElementById('feedback-leitura');
    const somOk = document.getElementById('som-ok');
    const somErro = document.getElementById('som-erro');
    const msg = document.getElementById('mensagem-scanner');
    
    if (msg) msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando código...';
    
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
            alert("Código não cadastrado na grade: " + codigo);
            if (__html5QrCode) __html5QrCode.resume();
            if (msgLeitura) msgLeitura.innerHTML = 'Posicione o código no centro do quadrado.';
            return;
        }
        
        const p = docProd.data();
        document.getElementById('sc-produto-nome').innerText = p.descricao;
        document.getElementById('sc-produto-tamanho').innerText = `Tamanho: ${p.tamanho}`;
        
        // Alterna visual para confirmação
        divScanner.classList.add('d-none');
        divConfirmacao.classList.remove('d-none');
        
    } catch (e) {
        console.error("Erro ao buscar produto:", e);
        if (__html5QrCode) __html5QrCode.resume();
    }
}

window.salvarLeituraConfirmada = async () => {
    if (!__ultimoCodigoCapturado) return;
    
    // Processa o salvamento (mesma função da estação de leitura)
    await processarLeitura(__ultimoCodigoCapturado);
    
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
    const s = __PRODUCAO_CONFIG.setores.find(s => s.id === setorId);
    const el = document.getElementById('detalhe-bonus-gestor');
    if (el) el.innerText = s?.descricao || 'Setor';
    const modalEl = document.getElementById('modalDetalheBonus');
    if (modalEl) new bootstrap.Modal(modalEl).show();
};

window.configurarRegrasBonus = () => {
    alert("Configuração de Regras:\n\n1. Meta Batida (100%): R$ 500,00\n2. Bônus Extra: R$ 50,00 por cada 1% acima da meta.\n3. Elegibilidade: Mínimo 95% de média mensal.\n\nFuncionalidade de edição em desenvolvimento.");
};

window.aprovarBonusLote = async () => {
    if (confirm("Deseja aprovar todos os bônus pendentes do mês selecionado?")) {
        mostrarMensagem('Bônus aprovados para pagamento!', 'success');
    }
};

