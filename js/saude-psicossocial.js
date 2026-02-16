// ========================================
// Módulo: Gestão de Saúde Psicossocial
// Autor: Gemini Code Assist
// ========================================

let modoEdicaoAtivo = false;
let casoIdEditando = null;
let indiceEditando = null;
let psicoChartInstancePsico = null;

async function inicializarSaudePsicossocial() {
    console.log("Inicializando Gestão de Saúde Psicossocial...");
    await carregarDadosPsicossociais();
}

let __casos_psico_cache = [];
let __todos_atestados_psico_cache = [];


/**
 * Carrega todos os atestados com CIDs psicossociais e renderiza a seção.
 */
async function carregarDadosPsicossociais() {
    const tbody = document.getElementById('tabela-casos-psicossociais');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando casos...</td></tr>';

    try {
        // Busca todos os atestados
        const atestadosSnap = await db.collection('atestados').orderBy('data_atestado', 'asc').get();

        // Filtra no lado do cliente para CIDs psicossociais
        __todos_atestados_psico_cache = atestadosSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(atestado => isCidPsicossocial(atestado.cid));

        // Agrupa os atestados por funcionário para criar "casos"
        const casosPorFuncionario = __todos_atestados_psico_cache.reduce((acc, atestado) => {
            const funcId = atestado.funcionarioId;
            if (!funcId) return acc; // Ignora atestados sem ID de funcionário
            if (!acc[funcId]) {
                acc[funcId] = {
                    idCaso: atestado.id, // O ID do primeiro atestado se torna o ID do caso
                    funcionarioId: funcId,
                    colaborador_nome: atestado.colaborador_nome,
                    primeiroAtestado: atestado.data_atestado,
                    ultimoAtestado: atestado.data_atestado,
                    totalDias: 0,
                    atestados: []
                };
            }
            acc[funcId].atestados.push(atestado);
            acc[funcId].ultimoAtestado = atestado.data_atestado;
            acc[funcId].totalDias += (atestado.dias || 0);
            return acc;
        }, {});

        __casos_psico_cache = Object.values(casosPorFuncionario);

        if (__casos_psico_cache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum caso psicossocial registrado.</td></tr>';
            renderizarMetricasPsicossociais([], []);
            renderizarGraficoTendencia(__todos_atestados_psico_cache);
            return;
        }

        renderizarTabelaPsicossocial(tbody, __casos_psico_cache);
        renderizarMetricasPsicossociais(__casos_psico_cache, __todos_atestados_psico_cache);
        renderizarGraficoTendencia(__todos_atestados_psico_cache);

    } catch (error) {
        console.error("Erro ao carregar dados psicossociais:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

/**
 * Renderiza a tabela com os casos psicossociais.
 * @param {HTMLElement} tbody - O corpo da tabela.
 * @param {Array} casos - A lista de casos a serem exibidos.
 */
function renderizarTabelaPsicossocial(tbody, casos) {
    tbody.innerHTML = '';
    // Ordena os casos pelo atestado mais recente
    casos.sort((a, b) => b.ultimoAtestado.seconds - a.ultimoAtestado.seconds);

    casos.forEach(casoConsolidado => {
        const primeiroAtestado = casoConsolidado.atestados[0];
        const estagio = primeiroAtestado.investigacaoPsicossocial?.estagio || 'Não iniciado';
        let corBadge = 'bg-secondary';
        if (estagio === 'Análise Inicial' || estagio === 'Conversa Agendada') corBadge = 'bg-warning text-dark';
        if (estagio === 'Conversado com Funcionário' || estagio === 'Plano de Ação Definido') corBadge = 'bg-info text-dark';
        if (estagio === 'Caso Encerrado') corBadge = 'bg-success';

        const row = `
            <tr>
                <td>
                    <div class="fw-bold">${casoConsolidado.colaborador_nome || 'N/A'} <span class="badge bg-primary ms-1">${casoConsolidado.atestados.length}</span></div>
                    <small class="text-muted"><i class="fas fa-sitemap me-1"></i>${primeiroAtestado.setor || 'Setor não informado'}</small>
                </td>
                <td><span class="badge bg-danger">${casoConsolidado.atestados[casoConsolidado.atestados.length - 1].cid || 'N/A'}</span></td>
                <td>${formatarData(casoConsolidado.primeiroAtestado)}</td>
                <td>${casoConsolidado.totalDias}</td>
                <td><span class="badge ${corBadge}">${estagio}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-primary" onclick="abrirModalAcompanhamentoPsicossocial('${casoConsolidado.idCaso}')" title="Iniciar/Ver Acompanhamento">
                        <i class="fas fa-clipboard-check"></i> Acompanhar
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

/**
 * Calcula e renderiza os KPIs (indicadores) da seção.
 * @param {Array} casos - A lista de casos.
 * @param {Array} todosAtestados - A lista de todos os atestados psicossociais.
 */
function renderizarMetricasPsicossociais(casos, todosAtestados) {
    const totalCasosEl = document.getElementById('psico-kpi-total-casos');
    const casosAbertosEl = document.getElementById('psico-kpi-casos-abertos');
    const mediaDiasEl = document.getElementById('psico-kpi-media-dias');

    if (!totalCasosEl || !casosAbertosEl || !mediaDiasEl) return;

    const totalCasos = todosAtestados.length;
    const casosAbertos = casos.filter(c => {
        const primeiroAtestado = c.atestados[0];
        return primeiroAtestado.investigacaoPsicossocial?.estagio !== 'Caso Encerrado';
    }).length;
    
    const totalDias = todosAtestados.reduce((acc, atestado) => acc + (atestado.dias || 0), 0);
    const mediaDias = totalCasos > 0 ? (totalDias / totalCasos).toFixed(1) : '0.0';

    totalCasosEl.textContent = casos.length; // Mostra o número de colaboradores únicos
    casosAbertosEl.textContent = casosAbertos;
    mediaDiasEl.textContent = mediaDias;
}

/**
 * Renderiza o gráfico de tendência de casos ao longo do tempo.
 * @param {Array} casos - A lista de casos.
 */
function renderizarGraficoTendencia(casos) {
    const ctx = document.getElementById('grafico-tendencia-psicossocial')?.getContext('2d');
    if (!ctx) return;

    // Agrupar casos por mês nos últimos 6 meses
    const dadosPorMes = {};
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const chave = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        dadosPorMes[chave] = 0;
    }

    casos.forEach(caso => {
        const dataAtestado = caso.data_atestado?.toDate ? caso.data_atestado.toDate() : new Date(caso.data_atestado);
        const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
        
        if (dataAtestado >= seisMesesAtras) {
            const chave = dataAtestado.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            if (dadosPorMes.hasOwnProperty(chave)) {
                dadosPorMes[chave]++;
            }
        }
    });

    const labels = Object.keys(dadosPorMes);
    const data = Object.values(dadosPorMes);

    if (psicoChartInstancePsico) {
        psicoChartInstancePsico.destroy();
    }

    psicoChartInstancePsico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Casos Psicossociais',
                data: data,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Garante que o eixo Y mostre apenas números inteiros
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Função auxiliar para verificar se um CID é psicossocial.
 * @param {string} cid - O código CID.
 * @returns {boolean}
 */
function isCidPsicossocial(cid) {
    if (!cid) return false;
    const cidUpper = cid.toUpperCase().trim();
    return cidUpper.startsWith('F') || cidUpper.startsWith('Z65');
}

// Função auxiliar para formatar data (pode ser movida para utils.js se necessário)
function formatarData(data) {
    if (!data) return 'N/A';
    const dateObj = data.toDate ? data.toDate() : new Date(data);
    return dateObj.toLocaleDateString('pt-BR');
}

/**
 * Abre o modal de acompanhamento psicossocial para um caso específico (agrupado por funcionário).
 * @param {string} casoId O ID do primeiro atestado que iniciou o caso.
 */
async function abrirModalAcompanhamentoPsicossocial(casoId) {
    const modalEl = document.getElementById('acompanhamentoPsicossocialModal');
    if (!modalEl) return;

    // Resetar modo de edição
    modoEdicaoAtivo = false;
    casoIdEditando = null;
    indiceEditando = null;

    // Encontra o caso consolidado no cache
    const casoConsolidado = __casos_psico_cache.find(c => c.idCaso === casoId);
    if (!casoConsolidado) {
        mostrarMensagem("Caso não encontrado no cache. Tente recarregar a página.", "error");
        return;
    }

    const primeiroAtestado = casoConsolidado.atestados[0];
    const investigacao = primeiroAtestado.investigacaoPsicossocial || {};

    // Preenche os dados no modal
    document.getElementById('psico-atestado-id').value = casoId; // O ID do caso é o ID do primeiro atestado
    document.getElementById('psico-nome-funcionario').textContent = casoConsolidado.colaborador_nome;
    document.getElementById('psico-cid-atestado').textContent = primeiroAtestado.cid;

    // Popula o select de atribuição
    await popularSelectUsuariosPsico('psico-atribuir-para');

    // Limpa o formulário para uma nova entrada
    document.getElementById('psico-observacoes').value = '';
    document.getElementById('psico-data-evento').value = '';
    document.getElementById('psico-observacoes-internas').value = '';
    document.getElementById('psico-atribuir-para').value = investigacao.atribuidoParaId || '';
    document.getElementById('psico-estagio').value = investigacao.estagio || 'Análise Inicial';

    // Configurar botão de salvar para modo normal
    const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvar Acompanhamento';
        btnSalvar.onclick = salvarAcompanhamentoPsicossocial;
    }

    // Adiciona listener para mostrar/ocultar campo de data
    const estagioSelect = document.getElementById('psico-estagio');
    const dataContainer = document.getElementById('psico-data-evento-container');
    estagioSelect.onchange = () => {
        const show = ['Conversa Agendada', 'Conversado com Funcionário', 'Plano de Ação Definido', 'Caso Encerrado'].includes(estagioSelect.value);
        dataContainer.style.display = show ? 'block' : 'none';
    };
    estagioSelect.dispatchEvent(new Event('change')); // Dispara para verificar o estado inicial

    // Constrói o histórico consolidado
    await carregarHistoricoNoModal(casoId, casoConsolidado, investigacao);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Carrega o histórico no modal
 */
async function carregarHistoricoNoModal(casoId, casoConsolidado, investigacao) {
    const historicoContainer = document.getElementById('psico-historico-container');
    historicoContainer.innerHTML = '<p class="text-muted small">Carregando histórico...</p>';

    // 1. Adiciona todos os atestados do caso ao histórico
    const historicoAtestados = casoConsolidado.atestados.map(atestado => ({
        tipo: 'atestado',
        data: atestado.data_atestado.toDate(),
        texto: `Atestado de ${atestado.dias} dia(s) recebido (CID: ${atestado.cid}).`
    }));

    // 2. Adiciona as anotações de acompanhamento
    const historicoAcompanhamento = (investigacao.historico || []).map((item, index) => ({
        tipo: 'acompanhamento',
        data: item.data.toDate(),
        texto: `<strong>${item.estagio}:</strong> ${escapeHTML(item.observacoes)} <br>
                ${item.dataEvento ? `<span class="badge bg-info text-dark mt-1">Data do Evento: ${formatarData(item.dataEvento)}</span><br>` : ''}
                <small class="text-muted">Por: ${item.responsavelNome || 'Usuário'}</small>`,
        index: index
    }));

    // 3. Combina, ordena e renderiza
    const historicoCompleto = [...historicoAtestados, ...historicoAcompanhamento].sort((a, b) => b.data - a.data);

    if (historicoCompleto.length > 0) {
        historicoContainer.innerHTML = historicoCompleto.map(item => {
            const corIcone = item.tipo === 'atestado' ? 'text-danger' : 'text-primary';
            const icone = item.tipo === 'atestado' ? 'fa-file-medical' : 'fa-clipboard-check';
            let actionsHtml = '';

            // Adiciona botões apenas para itens de acompanhamento
            if (item.tipo === 'acompanhamento') {
                actionsHtml = `
                    <div class="ms-auto btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary py-0 px-1" onclick="event.stopPropagation(); editarHistoricoPsicossocial('${casoId}', ${item.index})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger py-0 px-1" onclick="event.stopPropagation(); excluirHistoricoPsicossocial('${casoId}', ${item.index})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }

            return `
                <div class="p-2 border-bottom d-flex align-items-start">
                    <div class="me-3 pt-1"><i class="fas ${icone} ${corIcone}"></i></div>
                    <div>
                        <p class="mb-1">${item.texto}</p>
                        <small class="text-muted">${item.data.toLocaleString('pt-BR')}</small>
                    </div>
                    ${actionsHtml}
                </div>
            `;
        }).join('');
    } else {
        historicoContainer.innerHTML = '<p class="text-muted small">Nenhum registro no histórico.</p>';
    }
}

/**
 * Escapa HTML para evitar XSS
 * @param {string} text Texto a ser escapado
 * @returns {string} Texto escapado
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Salva os dados do formulário de acompanhamento psicossocial no documento do atestado.
 */
async function salvarAcompanhamentoPsicossocial() {
    // Prevenir clique duplo
    const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
    if (btnSalvar.disabled) return;
    
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const atestadoId = document.getElementById('psico-atestado-id').value;
    const estagio = document.getElementById('psico-estagio').value;
    const observacoes = document.getElementById('psico-observacoes').value.trim();
    const atribuidoParaSelect = document.getElementById('psico-atribuir-para');
    const atribuidoParaId = atribuidoParaSelect.value;
    const atribuidoParaNome = atribuidoParaId ? atribuidoParaSelect.options[atribuidoParaSelect.selectedIndex].text : null;
    const dataEvento = document.getElementById('psico-data-evento').value;
    const observacoesInternas = document.getElementById('psico-observacoes-internas').value.trim();

    if (!atestadoId || !observacoes) {
        mostrarMensagem("As observações são obrigatórias para salvar um novo registro no histórico.", "warning");
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar Acompanhamento';
        return;
    }

    // CORREÇÃO: Usa a data da conversa como data principal do registro, se aplicável.
    const dataPrincipalRegistro = ['Conversa Agendada', 'Conversado com Funcionário', 'Plano de Ação Definido', 'Caso Encerrado'].includes(estagio) && dataEvento 
                                  ? new Date(dataEvento.replace(/-/g, '\/')) 
                                  : new Date();

    const novoRegistroHistorico = {
        estagio: estagio,
        observacoes: observacoes,
        dataEvento: ['Conversa Agendada', 'Conversado com Funcionário', 'Plano de Ação Definido', 'Caso Encerrado'].includes(estagio) && dataEvento ? new Date(dataEvento.replace(/-/g, '\/')) : null,
        observacoesInternas: observacoesInternas, // Salva o novo campo
        data: dataPrincipalRegistro,
        responsavelUid: firebase.auth().currentUser?.uid,
        responsavelNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email
    };

    try {
        await db.collection('atestados').doc(atestadoId).update({
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.atribuidoParaId': atribuidoParaId || null,
            'investigacaoPsicossocial.atribuidoParaNome': atribuidoParaNome || null,
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayUnion(novoRegistroHistorico),
            'investigacaoPsicossocial.ultimaAtualizacao': firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Acompanhamento salvo com sucesso!", "success");

        if (atribuidoParaId) {
            const caso = __casos_psico_cache.find(c => c.idCaso === atestadoId);
            const agendaTask = {
                assunto: `Acompanhamento Psicossocial: ${caso.colaborador_nome}`,
                data: new Date(),
                tipo: 'Follow-up',
                descricao: `Realizar acompanhamento psicossocial referente ao CID ${caso.atestados[0].cid}. Observações: ${observacoes}`,
                status: 'Aberto',
                atribuidoParaId: atribuidoParaId,
                atribuidoParaNome: atribuidoParaNome,
                criadoPor: firebase.auth().currentUser?.uid,
                criadoPorNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('agenda_atividades').add(agendaTask);
            mostrarMensagem(`Tarefa de acompanhamento atribuída a ${atribuidoParaNome} na agenda.`, "info");
        }

        // Limpa o campo de observações
        document.getElementById('psico-observacoes').value = '';
        document.getElementById('psico-data-evento').value = '';
        document.getElementById('psico-observacoes-internas').value = '';
        
        // Recarrega o histórico no modal
        const casoConsolidado = __casos_psico_cache.find(c => c.idCaso === atestadoId);
        if (casoConsolidado) {
            // Busca dados atualizados do Firestore para garantir consistência
            const atestadoDoc = await db.collection('atestados').doc(atestadoId).get();
            if (atestadoDoc.exists) {
                const investigacao = atestadoDoc.data().investigacaoPsicossocial || {};
                await carregarHistoricoNoModal(atestadoId, casoConsolidado, investigacao);
            }
        }

    } catch (error) {
        console.error("Erro ao salvar acompanhamento:", error);
        mostrarMensagem("Erro ao salvar acompanhamento.", "error");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar Acompanhamento';
    }
}

/**
 * Popula um select com a lista de usuários do sistema.
 * @param {string} selectId O ID do elemento select.
 */
async function popularSelectUsuariosPsico(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
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
        console.error("Erro ao carregar usuários para atribuição:", error);
    }
}

/**
 * Preenche o formulário para editar um registro específico do histórico.
 * @param {string} casoId O ID do atestado que iniciou o caso.
 * @param {number} index O índice do registro no array de histórico original.
 */
async function editarHistoricoPsicossocial(casoId, index) {
    try {
        modoEdicaoAtivo = true;
        casoIdEditando = casoId;
        indiceEditando = index;

        // Busca os dados mais recentes diretamente do Firestore para garantir consistência
        const atestadoDoc = await db.collection('atestados').doc(casoId).get();
        if (!atestadoDoc.exists) {
            mostrarMensagem("Registro de atestado não encontrado.", "error");
            return;
        }

        const investigacao = atestadoDoc.data().investigacaoPsicossocial || {};
        const historicoItem = investigacao.historico?.[index];

        if (!historicoItem) {
            mostrarMensagem("Registro do histórico não encontrado para edição.", "error");
            return;
        }

        // Preenche os campos do formulário
        document.getElementById('psico-estagio').value = historicoItem.estagio;
        document.getElementById('psico-observacoes').value = historicoItem.observacoes;
        document.getElementById('psico-data-evento').value = historicoItem.dataEvento ? formatarDataParaInput(historicoItem.dataEvento) : '';
        document.getElementById('psico-observacoes-internas').value = historicoItem.observacoesInternas || ''; // Carrega o novo campo

        // Altera o botão de salvar para atualizar
        const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
        if (btnSalvar) {
            btnSalvar.textContent = 'Atualizar Registro';
            btnSalvar.onclick = () => atualizarRegistroHistorico(casoId, index);
        }

        // Garante que o campo de data seja exibido se necessário
        document.getElementById('psico-estagio').dispatchEvent(new Event('change'));

        mostrarMensagem("Modo de edição ativado. Altere os dados e clique em 'Atualizar Registro'.", "info");
    } catch (error) {
        console.error("Erro ao preparar edição do histórico:", error);
        mostrarMensagem("Falha ao carregar dados para edição.", "error");
    }
}

/**
 * Atualiza um registro específico no histórico de acompanhamento.
 */
async function atualizarRegistroHistorico(casoId, index) {
    // Prevenir clique duplo
    const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
    if (btnSalvar.disabled) return;
    
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';

    const observacoes = document.getElementById('psico-observacoes').value.trim();
    const estagio = document.getElementById('psico-estagio').value;
    const dataEvento = document.getElementById('psico-data-evento').value;
    const observacoesInternas = document.getElementById('psico-observacoes-internas').value.trim();
    
    if (!observacoes) {
        mostrarMensagem("As observações são obrigatórias.", "warning");
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Atualizar Registro';
        return;
    }
    
    try {
        const atestadoRef = db.collection('atestados').doc(casoIdEditando);
        const atestadoDoc = await atestadoRef.get();
        const investigacao = atestadoDoc.data().investigacaoPsicossocial || {};
        const historicoCompleto = investigacao.historico || [];
        
        if (indiceEditando < 0 || indiceEditando >= historicoCompleto.length) {
            mostrarMensagem("Índice do histórico inválido.", "error");
            return;
        }
        
        // Cria uma cópia do item antigo para remoção
        const itemAntigo = { ...historicoCompleto[indiceEditando] };
        
        // Cria o novo item atualizado
        const itemAtualizado = {
            estagio: estagio,
            observacoes: observacoes,
            dataEvento: ['Conversa Agendada', 'Conversado com Funcionário', 'Plano de Ação Definido', 'Caso Encerrado'].includes(estagio) && dataEvento ? new Date(dataEvento.replace(/-/g, '\/')) : itemAntigo.dataEvento,
            observacoesInternas: observacoesInternas, // Salva o novo campo na atualização
            data: new Date(),
            responsavelUid: firebase.auth().currentUser?.uid,
            responsavelNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email
        };

        // Atualiza o array de histórico diretamente
        historicoCompleto[index] = itemAtualizado;

        await atestadoRef.update({
            'investigacaoPsicossocial.historico': historicoCompleto,
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.ultimaAtualizacao': firebase.firestore.FieldValue.serverTimestamp()
        });
        
        mostrarMensagem("Registro do histórico atualizado!", "success");
        
        // Volta ao modo normal
        modoEdicaoAtivo = false;
        casoIdEditando = null;
        indiceEditando = null;
        
        // Restaura o botão de salvar
        btnSalvar.textContent = 'Salvar Acompanhamento';
        btnSalvar.onclick = salvarAcompanhamentoPsicossocial;
        
        // Limpa o campo de observações
        document.getElementById('psico-observacoes').value = '';
        document.getElementById('psico-data-evento').value = '';
        document.getElementById('psico-observacoes-internas').value = '';
        
        // Atualiza o histórico no modal
        const casoConsolidado = __casos_psico_cache.find(c => c.idCaso === casoId);
        if (casoConsolidado) {
            // Busca dados atualizados
            const atestadoAtualizado = await db.collection('atestados').doc(casoId).get();
            if (atestadoAtualizado.exists) {
                const investigacaoAtualizada = atestadoAtualizado.data().investigacaoPsicossocial || {};
                await carregarHistoricoNoModal(casoIdEditando, casoConsolidado, investigacaoAtualizada);
            }
        }
        
    } catch (error) {
        console.error("Erro ao atualizar histórico:", error);
        mostrarMensagem("Falha ao atualizar o histórico.", "error");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar Acompanhamento';
    }
}

/**
 * Exclui um registro específico do histórico de acompanhamento.
 * @param {string} casoId O ID do atestado que iniciou o caso.
 * @param {number} index O índice do registro a ser excluído.
 */
async function excluirHistoricoPsicossocial(casoId, index) {
    if (!confirm("Tem certeza que deseja excluir este registro do histórico?")) return;

    try {
        const atestadoRef = db.collection('atestados').doc(casoId);
        const atestadoDoc = await atestadoRef.get();
        
        if (!atestadoDoc.exists) {
            mostrarMensagem("Atestado não encontrado.", "error");
            return;
        }
        
        const investigacao = atestadoDoc.data().investigacaoPsicossocial || {};
        const historicoCompleto = investigacao.historico || [];
        
        if (index < 0 || index >= historicoCompleto.length) {
            mostrarMensagem("Índice do histórico inválido.", "error");
            return;
        }
        
        const itemParaRemover = historicoCompleto[index];
        
        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemParaRemover)
        });

        mostrarMensagem("Registro do histórico excluído.", "success");
        
        // Atualiza o histórico no modal
        const casoConsolidado = __casos_psico_cache.find(c => c.idCaso === casoId);
        if (casoConsolidado) {
            // Busca dados atualizados
            const atestadoAtualizado = await db.collection('atestados').doc(casoId).get();
            if (atestadoAtualizado.exists) {
                const investigacaoAtualizada = atestadoAtualizado.data().investigacaoPsicossocial || {};
                await carregarHistoricoNoModal(casoId, casoConsolidado, investigacaoAtualizada);
            }
        }
        
        // Se estava em modo de edição, cancela a edição
        if (modoEdicaoAtivo && casoIdEditando === casoId) {
            modoEdicaoAtivo = false;
            casoIdEditando = null;
            indiceEditando = null;            document.getElementById('psico-observacoes-internas').value = '';
            document.getElementById('psico-observacoes').value = '';
            document.getElementById('psico-data-evento').value = '';
            
            const btnSalvar = document.getElementById('btn-salvar-acompanhamento');
            if (btnSalvar) {
                btnSalvar.textContent = 'Salvar Acompanhamento';
                btnSalvar.onclick = salvarAcompanhamentoPsicossocial;
            }
        }
        
    } catch (error) {
        console.error("Erro ao excluir registro do histórico:", error);
        mostrarMensagem("Falha ao excluir o registro.", "error");
    }
}

function imprimirHistoricoPsicossocial() {
    const casoId = document.getElementById('psico-atestado-id').value;
    if (!casoId) {
        mostrarMensagem("Nenhum caso selecionado para impressão.", "warning");
        return;
    }

    const caso = __casos_psico_cache.find(c => c.idCaso === casoId);
    if (!caso) {
        mostrarMensagem("Dados do caso não encontrados no cache.", "error");
        return;
    }

    const primeiroAtestado = caso.atestados[0];
    const investigacao = primeiroAtestado.investigacaoPsicossocial || {};

    // Combina atestados e acompanhamentos para um histórico completo
    const historicoAtestados = caso.atestados.map(atestado => ({
        tipo: 'atestado',
        data: atestado.data_atestado.toDate(),
        texto: `Atestado de ${atestado.dias} dia(s) recebido (CID: ${atestado.cid}).`
    }));

    const historicoAcompanhamento = (investigacao.historico || []).map(item => ({
        tipo: 'acompanhamento',
        data: item.data.toDate(),
        estagio: item.estagio,
        observacoes: item.observacoes,
        texto: `<strong>${item.estagio}:</strong> ${escapeHTML(item.observacoes)}`,
        dataConversa: item.dataConversa ? item.dataConversa.toDate() : null,
        responsavel: item.responsavelNome
    }));

    const historicoCompleto = [...historicoAtestados, ...historicoAcompanhamento]
        .sort((a, b) => a.data - b.data); // Ordena em ordem cronológica

    let historicoHtml = '';
    if (historicoCompleto.length > 0) {
        historicoCompleto.forEach(item => {
            historicoHtml += `
                <div class="timeline-item">
                    <div class="timeline-date">${item.data.toLocaleDateString('pt-BR')}</div>
                    <div class="timeline-content">
                        ${item.tipo === 'acompanhamento' ? `<h5>${item.estagio}</h5><p>${item.observacoes}</p>` : `<p>${item.texto}</p>`}
                        ${item.dataEvento ? `<p><small class="text-info">Data do Evento: ${item.dataEvento.toLocaleDateString('pt-BR')}</small></p>` : ''}
                        ${item.responsavel ? `<small class="text-muted">Registrado por: ${item.responsavel}</small>` : ''}
                    </div>
                </div>
            `;
        });
    } else {
        historicoHtml = '<p class="text-muted">Nenhum registro de acompanhamento encontrado.</p>';
    }

    const conteudo = `
        <html>
        <head>
            <title>Histórico de Acompanhamento Psicossocial</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <style> body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; } .report-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; } .report-header h2 { font-weight: 700; color: #0d6efd; } .timeline-item { display: flex; margin-bottom: 1.5rem; } .timeline-date { min-width: 100px; text-align: right; padding-right: 1rem; border-right: 2px solid #dee2e6; font-weight: bold; } .timeline-content { padding-left: 1rem; } .signature-area { margin-top: 80px; text-align: center; } </style>
        </head>
        <body>
            <div class="report-header"><h2>Histórico de Acompanhamento Psicossocial</h2></div>
            <p><strong>Funcionário:</strong> ${caso.colaborador_nome}</p>
            <p><strong>Atestado Inicial (CID):</strong> ${primeiroAtestado.cid}</p>
            <hr>
            ${historicoHtml}
            <div class="signature-area"><p>___________________________</p><p>Assinatura do Responsável RH</p></div>
        </body>
        </html>`;

    openPrintWindow(conteudo, { autoPrint: true });
}