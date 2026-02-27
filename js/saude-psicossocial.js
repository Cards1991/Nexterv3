// ========================================
// Módulo: Gestão de Saúde Psicossocial - VERSÃO FINAL CORRIGIDA
// ========================================

// Namespace único para evitar conflitos
var SaudePsicossocial = SaudePsicossocial || {};

// ========================================
// VARIÁVEIS DE ESTADO
// ========================================

SaudePsicossocial.state = {
    chart: null,
    carregando: false,
    cache: {
        casos: [],
        atestados: []
    },
    usuariosCache: null,
    modoEdicao: false,
    casoEditando: null,
    indiceEditando: null
};

// ========================================
// FUNÇÕES DE FORMATAÇÃO
// ========================================

SaudePsicossocial.formatarDuracaoConsolidada = function(totalDias) {
    if (!totalDias && totalDias !== 0) return '0 dias';
    if (totalDias > 0 && totalDias < 1) {
        const totalHoras = totalDias * 8;
        const horas = Math.floor(totalHoras);
        const minutos = Math.round((totalHoras - horas) * 60);
        return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')} horas`;
    }
    return Number.isInteger(totalDias) ? `${totalDias} dia(s)` : `${totalDias.toFixed(2).replace('.', ',')} dias`;
};

SaudePsicossocial.formatarDuracaoAtestado = function(atestado) {
    if (atestado.duracaoTipo === 'horas') return `${atestado.duracaoValor} horas`;
    const d = atestado.dias || 0;
    return Number.isInteger(d) ? `${d} dia(s)` : `${d.toFixed(2).replace('.', ',')} dia(s)`;
};

SaudePsicossocial.formatarData = function(data) {
    if (!data) return 'N/A';
    try {
        // CORREÇÃO: Verifica se é Timestamp do Firebase
        if (data && typeof data.toDate === 'function') {
            return data.toDate().toLocaleDateString('pt-BR');
        }
        // Se já for Date ou string
        const d = new Date(data);
        return isNaN(d.getTime()) ? 'Data inválida' : d.toLocaleDateString('pt-BR');
    } catch {
        return 'Erro';
    }
};

SaudePsicossocial.formatarDataHora = function(data) {
    if (!data) return 'N/A';
    try {
        if (data && typeof data.toDate === 'function') {
            return data.toDate().toLocaleString('pt-BR');
        }
        const d = new Date(data);
        return isNaN(d.getTime()) ? 'Data inválida' : d.toLocaleString('pt-BR');
    } catch {
        return 'Erro';
    }
};

SaudePsicossocial.formatarDataParaInput = function(data) {
    if (!data) return '';
    try {
        if (data && typeof data.toDate === 'function') {
            data = data.toDate();
        }
        const d = new Date(data);
        return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch {
        return '';
    }
};

SaudePsicossocial.converterParaDate = function(data) {
    if (!data) return null;
    if (data && typeof data.toDate === 'function') {
        return data.toDate();
    }
    if (data instanceof Date) return data;
    return new Date(data);
};

SaudePsicossocial.escapeHTML = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

SaudePsicossocial.mostrarMensagem = function(texto, tipo) {
    console.log(`[${tipo}] ${texto}`);
    if (typeof window.mostrarMensagem === 'function') {
        window.mostrarMensagem(texto, tipo);
    } else if (typeof window.toast === 'function') {
        window.toast(texto, tipo);
    } else {
        alert(`${tipo.toUpperCase()}: ${texto}`);
    }
};

// ========================================
// INICIALIZAÇÃO
// ========================================

SaudePsicossocial.inicializar = async function() {
    console.log("Inicializando Gestão de Saúde Psicossocial...");
    await SaudePsicossocial.carregarDados();
};

// ========================================
// CARREGAMENTO DE DADOS
// ========================================

SaudePsicossocial.carregarDados = async function() {
    if (SaudePsicossocial.state.carregando) return;
    
    const tbody = document.getElementById('tabela-casos-psicossociais');
    if (!tbody) return;

    SaudePsicossocial.state.carregando = true;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const dataLimite = new Date();
        dataLimite.setFullYear(dataLimite.getFullYear() - 1);
        
        const snapshot = await db.collection('atestados')
            .where('data_atestado', '>=', dataLimite)
            .orderBy('data_atestado', 'asc')
            .get();

        const atestados = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(a => a.cid?.toUpperCase().match(/^F|^Z65/));

        SaudePsicossocial.state.cache.atestados = atestados;

        const casosMap = new Map();
        atestados.forEach(atestado => {
            const funcId = atestado.funcionarioId;
            if (!funcId) return;
            
            if (!casosMap.has(funcId)) {
                casosMap.set(funcId, {
                    idCaso: atestado.id,
                    funcionarioId: funcId,
                    nome: atestado.colaborador_nome || 'N/A',
                    setor: atestado.setor || 'N/I',
                    atestados: [],
                    totalDias: 0
                });
            }
            
            const caso = casosMap.get(funcId);
            caso.atestados.push(atestado);
            caso.totalDias += (atestado.dias || 0);
        });

        SaudePsicossocial.state.cache.casos = Array.from(casosMap.values());

        SaudePsicossocial.renderizarTabela();
        SaudePsicossocial.renderizarMetricas();
        SaudePsicossocial.renderizarGrafico();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        SaudePsicossocial.mostrarMensagem("Erro ao carregar dados: " + error.message, "error");
    } finally {
        SaudePsicossocial.state.carregando = false;
    }
};

// ========================================
// RENDERIZAÇÃO
// ========================================

SaudePsicossocial.renderizarTabela = function() {
    const tbody = document.getElementById('tabela-casos-psicossociais');
    if (!tbody) return;

    const casos = SaudePsicossocial.state.cache.casos;

    if (!casos.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum caso psicossocial encontrado</td></tr>';
        return;
    }

    casos.sort((a, b) => {
        const aDate = a.atestados[0]?.data_atestado ? SaudePsicossocial.converterParaDate(a.atestados[0].data_atestado) : new Date(0);
        const bDate = b.atestados[0]?.data_atestado ? SaudePsicossocial.converterParaDate(b.atestados[0].data_atestado) : new Date(0);
        return bDate - aDate;
    });

    tbody.innerHTML = casos.map(c => {
        const primeiro = c.atestados[0];
        const estagio = primeiro?.investigacaoPsicossocial?.estagio || 'Não iniciado';
        
        const badgeClass = {
            'Não iniciado': 'bg-secondary',
            'Análise Inicial': 'bg-warning text-dark',
            'Conversa Agendada': 'bg-warning text-dark',
            'Conversado com Funcionário': 'bg-info text-dark',
            'Plano de Ação Definido': 'bg-info text-dark',
            'Caso Encerrado': 'bg-success'
        }[estagio] || 'bg-secondary';

        return `
            <tr>
                <td>
                    <div class="fw-bold">${c.nome} <span class="badge bg-primary ms-1">${c.atestados.length}</span></div>
                    <small class="text-muted"><i class="fas fa-sitemap me-1"></i>${c.setor}</small>
                </td>
                <td><span class="badge bg-danger">${primeiro?.cid || 'N/A'}</span></td>
                <td>${SaudePsicossocial.formatarData(primeiro?.data_atestado)}</td>
                <td>${SaudePsicossocial.formatarDuracaoConsolidada(c.totalDias)}</td>
                <td><span class="badge ${badgeClass}">${estagio}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-primary" onclick="SaudePsicossocial.abrirModal('${c.idCaso}')">
                        <i class="fas fa-clipboard-check"></i> Acompanhar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

SaudePsicossocial.renderizarMetricas = function() {
    const total = document.getElementById('psico-kpi-total-casos');
    const abertos = document.getElementById('psico-kpi-casos-abertos');
    const media = document.getElementById('psico-kpi-media-dias');
    
    if (total && abertos && media) {
        const numAbertos = SaudePsicossocial.state.cache.casos.filter(c => 
            c.atestados[0]?.investigacaoPsicossocial?.estagio !== 'Caso Encerrado'
        ).length;
        
        const totalDias = SaudePsicossocial.state.cache.atestados.reduce((acc, a) => acc + (a.dias || 0), 0);
        const mediaDias = SaudePsicossocial.state.cache.atestados.length ? (totalDias / SaudePsicossocial.state.cache.atestados.length).toFixed(1) : '0.0';
        
        total.textContent = SaudePsicossocial.state.cache.casos.length;
        abertos.textContent = numAbertos;
        media.textContent = mediaDias;
    }
};

SaudePsicossocial.renderizarGrafico = function() {
    const canvas = document.getElementById('grafico-tendencia-psicossocial');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hoje = new Date();
    const meses = {};
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses[d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })] = 0;
    }

    const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    
    SaudePsicossocial.state.cache.atestados.forEach(a => {
        const data = SaudePsicossocial.converterParaDate(a.data_atestado);
        if (data && data >= seisMesesAtras) {
            const chave = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            if (chave in meses) meses[chave]++;
        }
    });

    if (SaudePsicossocial.state.chart) {
        SaudePsicossocial.state.chart.destroy();
    }

    SaudePsicossocial.state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(meses),
            datasets: [{
                label: 'Casos Psicossociais',
                data: Object.values(meses),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220,53,69,0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
};

// ========================================
// MODAL
// ========================================

SaudePsicossocial.abrirModal = async function(casoId) {
    const modalEl = document.getElementById('acompanhamentoPsicossocialModal');
    if (!modalEl) return;

    const caso = SaudePsicossocial.state.cache.casos.find(c => c.idCaso === casoId);
    if (!caso) {
        SaudePsicossocial.mostrarMensagem("Caso não encontrado", "error");
        return;
    }

    const atestado = caso.atestados[0];
    const investigacao = atestado.investigacaoPsicossocial || {};

    SaudePsicossocial.state.modoEdicao = false;
    SaudePsicossocial.state.casoEditando = null;
    SaudePsicossocial.state.indiceEditando = null;

    document.getElementById('psico-atestado-id').value = casoId;
    document.getElementById('psico-nome-funcionario').textContent = caso.nome;
    document.getElementById('psico-cid-atestado').textContent = atestado.cid || 'N/A';
    document.getElementById('psico-estagio').value = investigacao.estagio || 'Análise Inicial';
    document.getElementById('psico-observacoes').value = '';
    document.getElementById('psico-data-evento').value = '';
    document.getElementById('psico-observacoes-internas').value = '';

    await SaudePsicossocial.carregarUsuarios();

    const selectUser = document.getElementById('psico-atribuir-para');
    if (investigacao.atribuidoParaId) {
        selectUser.value = investigacao.atribuidoParaId;
    }

    const estagioSelect = document.getElementById('psico-estagio');
    const dataContainer = document.getElementById('psico-data-evento-container');
    
    const toggleData = function() {
        const show = ['Conversa Agendada', 'Conversado com Funcionário', 'Plano de Ação Definido', 'Caso Encerrado'].includes(estagioSelect.value);
        dataContainer.style.display = show ? 'block' : 'none';
    };
    
    estagioSelect.onchange = toggleData;
    toggleData();

    SaudePsicossocial.renderizarHistorico(casoId, caso, investigacao);

    const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
    btnSalvar.textContent = 'Salvar Acompanhamento';
    btnSalvar.onclick = SaudePsicossocial.salvarAcompanhamento;
    btnSalvar.disabled = false;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

SaudePsicossocial.carregarUsuarios = async function() {
    if (SaudePsicossocial.state.usuariosCache) return;
    
    try {
        const snapshot = await db.collection('usuarios').orderBy('nome').get();
        SaudePsicossocial.state.usuariosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const select = document.getElementById('psico-atribuir-para');
        if (select && select.options.length <= 1) {
            SaudePsicossocial.state.usuariosCache.forEach(u => {
                if (u.nome) {
                    select.innerHTML += `<option value="${u.id}">${u.nome}</option>`;
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
    }
};

// CORREÇÃO: Função principal que estava causando o erro
SaudePsicossocial.renderizarHistorico = function(casoId, caso, investigacao) {
    const container = document.getElementById('psico-historico-container');
    if (!container) return;
    
    // Atestados
    const atestados = caso.atestados.map(a => {
        const dataAtestado = SaudePsicossocial.converterParaDate(a.data_atestado);
        return {
            tipo: 'atestado',
            data: dataAtestado,
            html: `
                <div class="d-flex align-items-start w-100">
                    <i class="fas fa-file-medical text-danger me-2 mt-1"></i>
                    <div>
                        Atestado de ${SaudePsicossocial.formatarDuracaoAtestado(a)} (CID: ${a.cid})
                    </div>
                </div>
            `
        };
    });

    // Acompanhamentos - CORREÇÃO AQUI!
    const acompanhamentos = (investigacao.historico || []).map((item, idx) => {
        // Converte a data corretamente
        let dataItem = null;
        if (item.data) {
            dataItem = SaudePsicossocial.converterParaDate(item.data);
        }
        
        return {
            tipo: 'acompanhamento',
            data: dataItem || new Date(),
            index: idx,
            html: `
                <div class="d-flex align-items-start w-100">
                    <i class="fas fa-clipboard-check text-primary me-2 mt-1"></i>
                    <div class="flex-grow-1">
                        <strong>${item.estagio}:</strong> ${SaudePsicossocial.escapeHTML(item.observacoes)}
                        ${item.dataEvento ? `<br><span class="badge bg-info mt-1">Data: ${SaudePsicossocial.formatarData(item.dataEvento)}</span>` : ''}
                        <br><small class="text-muted">Por: ${item.responsavelNome || 'Usuário'}</small>
                    </div>
                    <div class="ms-2">
                        <button class="btn btn-sm btn-outline-secondary py-0 px-1 me-1" onclick="SaudePsicossocial.editarHistorico('${casoId}', ${idx})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="SaudePsicossocial.excluirHistorico('${casoId}', ${idx})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `
        };
    });

    // Combina e ordena
    const todos = [...atestados, ...acompanhamentos]
        .filter(item => item.data) // Remove itens sem data
        .sort((a, b) => {
            if (!a.data) return 1;
            if (!b.data) return -1;
            return b.data - a.data;
        });

    if (todos.length) {
        container.innerHTML = todos.map(t => `
            <div class="p-2 border-bottom">
                ${t.html}
                <small class="text-muted d-block mt-1">${t.data ? t.data.toLocaleString('pt-BR') : 'Data não disponível'}</small>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-muted small p-2 text-center">Nenhum registro no histórico</p>';
    }
};

// ========================================
// OPERAÇÕES DE ESCRITA
// ========================================

SaudePsicossocial.salvarAcompanhamento = async function() {
    const btn = document.getElementById('btn-salvar-acompanhamento');
    if (btn.disabled) return;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const atestadoId = document.getElementById('psico-atestado-id').value;
        const estagio = document.getElementById('psico-estagio').value;
        const obs = document.getElementById('psico-observacoes').value.trim();
        const obsInternas = document.getElementById('psico-observacoes-internas').value.trim();
        const dataEventoStr = document.getElementById('psico-data-evento').value;
        const atribuidoId = document.getElementById('psico-atribuir-para').value;
        
        if (!obs) throw new Error("Observações são obrigatórias");

        let dataEvento = null;
        if (dataEventoStr) {
            const [ano, mes, dia] = dataEventoStr.split('-').map(Number);
            dataEvento = new Date(ano, mes - 1, dia);
        }

        const atestadoRef = db.collection('atestados').doc(atestadoId);
        const atestadoDoc = await atestadoRef.get();
        
        if (!atestadoDoc.exists) throw new Error("Atestado não encontrado");

        const investigacao = atestadoDoc.data().investigacaoPsicossocial || {};
        const historico = investigacao.historico || [];

        const user = firebase.auth().currentUser;
        const responsavelNome = user?.displayName || user?.email || 'Usuário';

        const novoRegistro = {
            estagio,
            observacoes: obs,
            observacoesInternas: obsInternas,
            dataEvento,
            data: new Date(), // ← Isso é Date, não Timestamp
            responsavelUid: user?.uid,
            responsavelNome
        };

        historico.push(novoRegistro);

        let atribuidoNome = null;
        if (atribuidoId) {
            const select = document.getElementById('psico-atribuir-para');
            const option = select.selectedOptions[0];
            atribuidoNome = option?.text || null;
        }

        await atestadoRef.update({
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.atribuidoParaId': atribuidoId || null,
            'investigacaoPsicossocial.atribuidoParaNome': atribuidoNome,
            'investigacaoPsicossocial.historico': historico,
            'investigacaoPsicossocial.ultimaAtualizacao': new Date()
        });

        const caso = SaudePsicossocial.state.cache.casos.find(c => c.idCaso === atestadoId);
        if (caso) {
            caso.atestados[0].investigacaoPsicossocial = {
                ...caso.atestados[0].investigacaoPsicossocial,
                estagio,
                historico
            };
        }

        if (caso) {
            SaudePsicossocial.renderizarHistorico(atestadoId, caso, { estagio, historico });
        }

        document.getElementById('psico-observacoes').value = '';
        document.getElementById('psico-data-evento').value = '';
        document.getElementById('psico-observacoes-internas').value = '';

        SaudePsicossocial.mostrarMensagem("Acompanhamento salvo com sucesso!", "success");
        SaudePsicossocial.renderizarTabela();
        SaudePsicossocial.renderizarMetricas();

    } catch (error) {
        console.error("Erro ao salvar:", error);
        SaudePsicossocial.mostrarMensagem(`Erro: ${error.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar Acompanhamento';
    }
};

SaudePsicossocial.editarHistorico = async function(casoId, index) {
    try {
        const atestadoRef = db.collection('atestados').doc(casoId);
        const doc = await atestadoRef.get();
        
        if (!doc.exists) {
            SaudePsicossocial.mostrarMensagem("Registro não encontrado", "error");
            return;
        }

        const item = doc.data().investigacaoPsicossocial?.historico?.[index];
        if (!item) {
            SaudePsicossocial.mostrarMensagem("Item do histórico não encontrado", "error");
            return;
        }

        document.getElementById('psico-estagio').value = item.estagio;
        document.getElementById('psico-observacoes').value = item.observacoes;
        document.getElementById('psico-observacoes-internas').value = item.observacoesInternas || '';
        document.getElementById('psico-data-evento').value = item.dataEvento ? SaudePsicossocial.formatarDataParaInput(item.dataEvento) : '';

        SaudePsicossocial.state.modoEdicao = true;
        SaudePsicossocial.state.casoEditando = casoId;
        SaudePsicossocial.state.indiceEditando = index;

        const btn = document.getElementById('btn-salvar-acompanhamento');
        btn.textContent = 'Atualizar Registro';
        btn.onclick = SaudePsicossocial.atualizarHistorico;

        document.getElementById('psico-estagio').dispatchEvent(new Event('change'));

        SaudePsicossocial.mostrarMensagem("Editando registro...", "info");

    } catch (error) {
        console.error("Erro ao editar:", error);
        SaudePsicossocial.mostrarMensagem("Erro ao carregar registro para edição", "error");
    }
};

SaudePsicossocial.atualizarHistorico = async function() {
    const btn = document.getElementById('btn-salvar-acompanhamento');
    if (btn.disabled) return;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';

    try {
        const casoId = SaudePsicossocial.state.casoEditando;
        const index = SaudePsicossocial.state.indiceEditando;
        
        if (!casoId || index === null) {
            throw new Error("Modo de edição não está ativo");
        }

        const estagio = document.getElementById('psico-estagio').value;
        const obs = document.getElementById('psico-observacoes').value.trim();
        const obsInternas = document.getElementById('psico-observacoes-internas').value.trim();
        const dataEventoStr = document.getElementById('psico-data-evento').value;

        if (!obs) throw new Error("Observações são obrigatórias");

        const atestadoRef = db.collection('atestados').doc(casoId);
        const doc = await atestadoRef.get();
        
        if (!doc.exists) throw new Error("Registro não encontrado");

        const investigacao = doc.data().investigacaoPsicossocial || {};
        const historico = [...(investigacao.historico || [])];

        if (index >= historico.length) throw new Error("Registro não encontrado no histórico");

        let dataEvento = null;
        if (dataEventoStr) {
            const [ano, mes, dia] = dataEventoStr.split('-').map(Number);
            dataEvento = new Date(ano, mes - 1, dia);
        }

        const user = firebase.auth().currentUser;
        const responsavelNome = user?.displayName || user?.email || 'Usuário';

        historico[index] = {
            ...historico[index],
            estagio,
            observacoes: obs,
            observacoesInternas: obsInternas,
            dataEvento: dataEvento || historico[index].dataEvento,
            data: new Date(), // ← Data da atualização
            responsavelUid: user?.uid,
            responsavelNome
        };

        await atestadoRef.update({
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.historico': historico
        });

        const caso = SaudePsicossocial.state.cache.casos.find(c => c.idCaso === casoId);
        if (caso) {
            caso.atestados[0].investigacaoPsicossocial = { 
                ...caso.atestados[0].investigacaoPsicossocial,
                estagio, 
                historico 
            };
        }

        if (caso) {
            SaudePsicossocial.renderizarHistorico(casoId, caso, { estagio, historico });
        }

        SaudePsicossocial.state.modoEdicao = false;
        SaudePsicossocial.state.casoEditando = null;
        SaudePsicossocial.state.indiceEditando = null;

        document.getElementById('psico-observacoes').value = '';
        document.getElementById('psico-data-evento').value = '';
        document.getElementById('psico-observacoes-internas').value = '';

        btn.textContent = 'Salvar Acompanhamento';
        btn.onclick = SaudePsicossocial.salvarAcompanhamento;

        SaudePsicossocial.mostrarMensagem("Registro atualizado com sucesso!", "success");
        SaudePsicossocial.renderizarTabela();

    } catch (error) {
        console.error("Erro ao atualizar:", error);
        SaudePsicossocial.mostrarMensagem(`Erro: ${error.message}`, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar Acompanhamento';
    }
};

SaudePsicossocial.excluirHistorico = async function(casoId, index) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    try {
        const atestadoRef = db.collection('atestados').doc(casoId);
        const doc = await atestadoRef.get();
        
        if (!doc.exists) {
            SaudePsicossocial.mostrarMensagem("Registro não encontrado", "error");
            return;
        }

        const investigacao = doc.data().investigacaoPsicossocial || {};
        const historico = (investigacao.historico || []).filter((_, i) => i !== index);

        await atestadoRef.update({
            'investigacaoPsicossocial.historico': historico
        });

        const caso = SaudePsicossocial.state.cache.casos.find(c => c.idCaso === casoId);
        if (caso) {
            caso.atestados[0].investigacaoPsicossocial.historico = historico;
            SaudePsicossocial.renderizarHistorico(casoId, caso, caso.atestados[0].investigacaoPsicossocial);
        }

        SaudePsicossocial.mostrarMensagem("Registro excluído com sucesso!", "success");

        // Fechar o modal após a exclusão bem-sucedida
        const modal = bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal'));
        if (modal) modal.hide();

        if (SaudePsicossocial.state.modoEdicao &&
            SaudePsicossocial.state.casoEditando === casoId &&
            SaudePsicossocial.state.indiceEditando === index) {

            SaudePsicossocial.state.modoEdicao = false;
            SaudePsicossocial.state.casoEditando = null;
            SaudePsicossocial.state.indiceEditando = null;

            document.getElementById('psico-observacoes').value = '';
            document.getElementById('psico-data-evento').value = '';
            document.getElementById('psico-observacoes-internas').value = '';

            const btn = document.getElementById('btn-salvar-acompanhamento');
            btn.textContent = 'Salvar Acompanhamento';
            btn.onclick = SaudePsicossocial.salvarAcompanhamento;
        }

    } catch (error) {
        console.error("Erro ao excluir:", error);
        SaudePsicossocial.mostrarMensagem("Erro ao excluir registro", "error");
    }
};

// ========================================
// IMPRESSÃO
// ========================================

SaudePsicossocial.imprimirHistorico = async function() {
    const casoId = document.getElementById('psico-atestado-id')?.value;
    const incluirInternas = document.getElementById('check-imprimir-internas')?.checked;

    if (!casoId) {
        SaudePsicossocial.mostrarMensagem("Nenhum caso selecionado", "warning");
        return;
    }

    const caso = SaudePsicossocial.state.cache.casos.find(c => c.idCaso === casoId);
    if (!caso) {
        SaudePsicossocial.mostrarMensagem("Dados do caso não encontrados", "error");
        return;
    }

    document.body.style.cursor = 'wait';

    try {
        // Buscar dados do funcionário para Idade e Tempo de Casa
        let funcData = { nascimento: null, admissao: null };
        if (caso.funcionarioId) {
            try {
                const funcDoc = await db.collection('funcionarios').doc(caso.funcionarioId).get();
                if (funcDoc.exists) {
                    funcData = funcDoc.data();
                }
            } catch (e) {
                console.error("Erro ao buscar dados do funcionário:", e);
            }
        }

        const primeiroAtestado = caso.atestados[0];
        const investigacao = primeiroAtestado.investigacaoPsicossocial || {};
        const colaboradorNome = caso.nome || 'Não identificado';
        const setor = caso.setor || 'Não informado';

        // Calcular Idade
        let idade = 'N/A';
        if (funcData.nascimento) {
            const nasc = new Date(funcData.nascimento);
            const hoje = new Date();
            let age = hoje.getFullYear() - nasc.getFullYear();
            const m = hoje.getMonth() - nasc.getMonth();
            if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
                age--;
            }
            idade = `${age} anos`;
        }

        // Calcular Tempo de Empresa
        let tempoCasa = 'N/A';
        if (funcData.admissao) {
            const adm = new Date(funcData.admissao);
            const hoje = new Date();
            let anos = hoje.getFullYear() - adm.getFullYear();
            let meses = hoje.getMonth() - adm.getMonth();
            if (meses < 0) {
                anos--;
                meses += 12;
            }
            tempoCasa = anos > 0 ? `${anos} anos e ${meses} meses` : `${meses} meses`;
        }

        // Preparar Itens do Histórico
        const historicoAtestados = caso.atestados.map(a => ({
            data: SaudePsicossocial.converterParaDate(a.data_atestado),
            tipo: 'Atestado',
            detalhes: `Atestado de ${SaudePsicossocial.formatarDuracaoAtestado(a)} (CID: ${a.cid || 'N/A'})`,
            autor: 'Sistema'
        }));

        const historicoAcompanhamento = (investigacao.historico || []).map(item => {
            let detalhes = item.observacoes || '';
            // Limpeza de texto
            detalhes = detalhes.replace(/<[^>]*>?/gm, ''); 

            if (incluirInternas && item.observacoesInternas && item.observacoesInternas.trim().length > 1) {
                detalhes += `<br><span class="obs-interna"><strong>Obs. Interna:</strong> ${item.observacoesInternas}</span>`;
            }
            return {
                data: SaudePsicossocial.converterParaDate(item.data),
                tipo: item.estagio,
                detalhes: detalhes,
                autor: item.responsavelNome || 'Usuário'
            };
        });

        const historicoCompleto = [...historicoAtestados, ...historicoAcompanhamento]
            .filter(item => item.data)
            .sort((a, b) => b.data - a.data); // Mais recente primeiro

        // Gerar HTML
        let historicoHtml = '';
        if (historicoCompleto.length === 0) {
            historicoHtml = '<p class="text-center text-muted">Nenhum registro histórico encontrado.</p>';
        } else {
            historicoCompleto.forEach(item => {
                const dataFormatada = item.data.toLocaleString('pt-BR');
                historicoHtml += `
                    <div class="timeline-item">
                        <div class="timeline-marker"></div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <span class="timeline-title">${item.tipo}</span>
                                <span class="timeline-date">${dataFormatada}</span>
                            </div>
                            <div class="timeline-body">
                                ${item.detalhes}
                            </div>
                            <div class="timeline-footer">
                                Registrado por: ${item.autor}
                            </div>
                        </div>
                    </div>`;
            });
        }

        const conteudoHtml = `
            <html>
            <head>
                <title>Relatório Psicossocial - ${colaboradorNome}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff; color: #333; padding: 40px; }
                    .header { border-bottom: 2px solid #0d6efd; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                    .logo-text { font-size: 24px; font-weight: bold; color: #0d6efd; text-transform: uppercase; }
                    .report-title { font-size: 18px; color: #555; }
                    
                    .info-section { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e9ecef; }
                    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                    .info-item label { display: block; font-size: 12px; text-transform: uppercase; color: #6c757d; font-weight: 600; margin-bottom: 4px; }
                    .info-item div { font-size: 16px; font-weight: 500; color: #212529; }

                    .timeline { position: relative; padding-left: 20px; }
                    .timeline-item { position: relative; margin-bottom: 25px; }
                    .timeline-marker { position: absolute; left: -26px; top: 5px; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 3px solid #0d6efd; z-index: 2; }
                    .timeline::before { content: ''; position: absolute; left: 0; top: 5px; bottom: 0; width: 2px; background: #e9ecef; z-index: 1; }
                    
                    .timeline-content { padding-bottom: 10px; }
                    .timeline-header { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: baseline; }
                    .timeline-title { font-weight: 700; font-size: 16px; color: #0d6efd; }
                    .timeline-date { font-size: 13px; color: #6c757d; font-weight: 500; }
                    .timeline-body { font-size: 14px; line-height: 1.5; color: #495057; }
                    .timeline-footer { font-size: 12px; color: #adb5bd; margin-top: 6px; font-style: italic; }
                    
                    .obs-interna { display: block; margin-top: 8px; padding: 8px; background-color: #fff3cd; border-left: 3px solid #ffc107; color: #856404; font-size: 13px; border-radius: 4px; }

                    .footer { margin-top: 50px; border-top: 1px solid #dee2e6; padding-top: 20px; text-align: center; font-size: 12px; color: #adb5bd; }
                    
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        .info-section { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact; }
                        .obs-interna { background-color: #fff3cd !important; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-text">Gestão de Saúde</div>
                    <div class="report-title">Histórico Psicossocial</div>
                </div>

                <div class="info-section">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Colaborador</label>
                            <div>${colaboradorNome}</div>
                        </div>
                        <div class="info-item">
                            <label>Setor</label>
                            <div>${setor}</div>
                        </div>
                        <div class="info-item">
                            <label>Idade</label>
                            <div>${idade}</div>
                        </div>
                        <div class="info-item">
                            <label>Tempo de Empresa</label>
                            <div>${tempoCasa}</div>
                        </div>
                        <div class="info-item">
                            <label>CID Inicial</label>
                            <div>${primeiroAtestado.cid || '-'}</div>
                        </div>
                        <div class="info-item">
                            <label>Total de Dias Afastado</label>
                            <div>${SaudePsicossocial.formatarDuracaoConsolidada(caso.totalDias)}</div>
                        </div>
                    </div>
                </div>

                <h5 class="mb-4" style="color: #495057; font-weight: 600;">Linha do Tempo</h5>
                <div class="timeline">
                    ${historicoHtml}
                </div>

                <div class="footer">
                    Documento confidencial gerado em ${new Date().toLocaleString('pt-BR')} pelo Sistema Nexter.
                </div>
                
                <script>
                    window.onload = function() { setTimeout(function() { window.print(); }, 500); }
                </script>
            </body>
            </html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(conteudoHtml);
        printWindow.document.close();

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        SaudePsicossocial.mostrarMensagem("Erro ao gerar relatório: " + error.message, "error");
    } finally {
        document.body.style.cursor = 'default';
    }
};

// ========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    if (typeof db !== 'undefined') {
        SaudePsicossocial.inicializar();
    } else {
        console.log("Aguardando Firebase...");
        setTimeout(() => {
            if (typeof db !== 'undefined') {
                SaudePsicossocial.inicializar();
            }
        }, 1000);
    }
});

// Expõe funções necessárias globalmente
window.SaudePsicossocial = SaudePsicossocial;

// Função global para impressão do histórico (usada pelo botão no HTML do modal de Saúde Psicossocial)
window.SaudePsicossocialImprimirHistorico = function() {
    SaudePsicossocial.imprimirHistorico();
};
