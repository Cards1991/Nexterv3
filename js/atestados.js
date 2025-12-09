// Atestados - integração com Firestore + filtros e métricas
let __atestados_cache = [];
let __empresasCache = null;
let __initializedAtestados = false;
let __filterTimeout;

const CID_BODY_MAP_CONSOLIDADO = {
    'M54': 'back',      // Dorsalgia
    'M51': 'back',      // Outras dorsopatias
    'M75': 'shoulder',  // Lesões do ombro
    'M25.5': 'arm',     // Dor no braço
    'S80-S89': 'leg',   // Fratura da perna
    'S90-S99': 'foot',  // Fratura do pé
    'S60-S69': 'hand',  // Fratura da mão
    'S50-S59': 'arm',   // Fratura do antebraço
    'R51': 'head',      // Cefaleia    'J00-J06': 'head',  // Resfriado    'J09-J18': 'torso', // Influenza
    'K29': 'torso',     // Gastrite
    'I10': 'torso',     // Hipertensão
    'M17': 'leg',       // Osteoartrose joelho
    'M19': 'hand',      // Outras artroses
    'M79.6': 'arm',     // Dor membro superior
    'S13': 'neck',      // Lesão pescoço
    'S23': 'torso',     // Lesão tórax
};

const CIDS_PSICOSSOCIAIS_PREFIXOS = ['F', 'Z65'];

/**
 * Verifica se um CID é classificado como psicossocial.
 * @param {string} cid O código CID a ser verificado.
 * @returns {boolean} Verdadeiro se for um CID psicossocial.
 */
function isCidPsicossocial(cid) {
    if (!cid) return false;
    const cidUpper = cid.toUpperCase().trim();
    return CIDS_PSICOSSOCIAIS_PREFIXOS.some(prefix => cidUpper.startsWith(prefix));
};

// Inicializar atestados
async function inicializarAtestados() {
    if (__initializedAtestados) return;

    try {
        adicionarEstilosCorpoHumano();
        configurarEventListenersAtestados();
        await carregarAtestadosDb();
        await preencherFiltroEmpresasAtestados();
        await renderizarAtestados();
        await atualizarMetricasAtestados();
        
        __initializedAtestados = true;
    } catch (e) { 
        console.error('Erro ao inicializar atestados:', e); 
        mostrarMensagem('Erro ao carregar atestados', 'error');
    }
}

function configurarEventListenersAtestados() {
    // Usar event delegation para os botões principais
    try {
        document.addEventListener('click', (e) => {
            try {
                if (e.target.closest('#btn-novo-atestado')) {
                    abrirModalNovoAtestado();
                }
                if (e.target.closest('#btn-rotate-body')) {
                    toggleBodyView();
                }
            } catch (error) { console.error('Erro no event listener de clique:', error); }
        });
    } catch (error) { console.error('Erro ao configurar event listener de clique:', error); }

    // Debounce para filtros
    const filtros = ['#filtro-empresa-atestados', '#filtro-tipo-atestados', '#filtro-status-atestados', '#filtro-data-inicio-atestados', '#filtro-data-fim-atestados'];
    filtros.forEach(selector => {
        const filtroEl = document.querySelector(selector);
        if (filtroEl) {
            filtroEl.addEventListener('change', () => {
                clearTimeout(__filterTimeout);
                __filterTimeout = setTimeout(async () => {
                    try {
                        await renderizarAtestados();
                        await atualizarMetricasAtestados();
                    } catch (error) { console.error('Erro ao aplicar filtros com debounce:', error); }
                }, 300);
            });
        }
    });
}

function parseDateSafe(dateInput) {
    if (!dateInput) return null;
    // Se for um objeto Timestamp do Firestore
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        return dateInput.toDate();
    }
    // Se for uma string ou número
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
}

async function getEmpresasCache() {
    if (!__empresasCache) {
        const empSnap = await db.collection('empresas').get();
        __empresasCache = {};
        empSnap.forEach(d => __empresasCache[d.id] = d.data().nome);
    }
    return __empresasCache;
}

// Função para invalidar o cache quando empresas são adicionadas/editadas
function invalidarCacheEmpresas() {
    __empresasCache = null;
}

// Adicionar CSS dinâmico para melhorar o visual
function adicionarEstilosCorpoHumano() {
    const styleId = 'body-map-styles';
    if (!document.getElementById(styleId)) {
        const styles = `
            .body-map-container {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                border: 1px solid #dee2e6;
            }
            
            .body-part {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .body-part:hover {
                transform: scale(1.02);
                filter: brightness(1.1) !important;
            }
            
            .legend-item {
                transition: all 0.2s ease;
                cursor: pointer;
            }
            
            .legend-item:hover {
                transform: translateX(4px);
                background-color: rgba(0, 0, 0, 0.05) !important;
            }
            
            .body-map-controls {
                background: white;
                border-radius: 8px;
                padding: 10px;
                margin-bottom: 15px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            #body-front-view, #body-back-view {
                transition: opacity 0.3s ease;
            }
            
            .body-map-section {
                background: white;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

function toggleBodyView() {
    const frontView = document.getElementById('body-front-view');
    const backView = document.getElementById('body-back-view');
    const btnRotate = document.getElementById('btn-rotate-body');
    const isFrontVisible = frontView.style.display !== 'none';

    // Animação de transição
    frontView.style.opacity = '0';
    backView.style.opacity = '0';
    
    setTimeout(() => {
        frontView.style.display = isFrontVisible ? 'none' : 'block';
        backView.style.display = isFrontVisible ? 'block' : 'none';
        
        setTimeout(() => {
            frontView.style.opacity = '1';
            backView.style.opacity = '1';
            
            // Atualizar ícone do botão
            if (btnRotate) {
                btnRotate.innerHTML = isFrontVisible ? 
                    '<i class="fas fa-user"></i> Vista Frontal' : 
                    '<i class="fas fa-user-alt"></i> Vista Posterior';
            }
        }, 50);
    }, 200);
}

// Carregar atestados do banco
async function carregarAtestadosDb() {
    try {
        const snap = await db.collection('atestados')
            .orderBy('data_atestado', 'desc')
            .get();
            
        __atestados_cache = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                // Garantir que data_atestado seja um objeto Date
                data_atestado: parseDateSafe(data.data_atestado)
            };
        }).filter(atestado => atestado.data_atestado); // Remover inválidos
    } catch (e) {
        console.error('Erro ao carregar atestados do banco:', e);
        mostrarMensagem('Erro ao carregar atestados do banco', 'error');
        throw e;
    }
}

// Preencher filtro de empresas
async function preencherFiltroEmpresasAtestados() {
    try {
        const select = document.getElementById('filtro-empresa-atestados');
        if (!select) return;
        
        const empSnap = await db.collection('empresas').orderBy('nome').get();
        select.innerHTML = '<option value="">Todas as empresas</option>';
        
        empSnap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data().nome;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao preencher filtro de empresas:', e);
    }
}

// Aplicar filtros aos atestados
function aplicarFiltrosAtestados(lista) {
    const emp = document.getElementById('filtro-empresa-atestados')?.value || '';
    const tipo = document.getElementById('filtro-tipo-atestados')?.value || '';
    const status = document.getElementById('filtro-status-atestados')?.value || '';
    const dataInicio = document.getElementById('filtro-data-inicio-atestados')?.value;
    const dataFim = document.getElementById('filtro-data-fim-atestados')?.value;
    
    return lista.filter(a => {
        const dataAtestado = parseDateSafe(a.data_atestado);
        if (!dataAtestado) return false;

        const dataInicioObj = parseDateSafe(dataInicio);
        const dataFimAjustada = dataFim ? new Date(new Date(dataFim).setHours(23, 59, 59, 999)) : null;

        return (!emp || a.empresaId === emp) &&
               (!tipo || a.tipo === tipo) &&
               (!status || a.status === status) &&
               (!dataInicioObj || dataAtestado >= dataInicioObj) &&
               (!dataFimAjustada || dataAtestado <= dataFimAjustada);
    });
}

// Renderizar atestados na tabela
async function renderizarAtestados() {
    try {
        const tbody = document.getElementById('atestados-container');
        const totalEl = document.getElementById('total-atestados');
        
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="spinner-border"></div></td></tr>';

        const filtrados = aplicarFiltrosAtestados(__atestados_cache);
        
        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhum atestado encontrado</td></tr>';
            if (totalEl) totalEl.textContent = '0 registros';
            atualizarGraficoSilhueta(filtrados); // Limpa o gráfico
            return;
        }
        
        // Atualizar UI em paralelo
        await Promise.all([
            atualizarTabelaAtestados(filtrados),
            atualizarGraficoSilhueta(filtrados),
            analisarAtestadosPsicossociais(filtrados) // Nova função para análise psicossocial
        ]);
        
        if (totalEl) totalEl.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}`;

    } catch (e) {
        console.error('Erro ao renderizar atestados:', e);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados</td></tr>';
    }
}

async function atualizarTabelaAtestados(filtrados) {
    const tbody = document.getElementById('atestados-container');
    const empMap = await getEmpresasCache();

    tbody.innerHTML = filtrados.map(a => {
        let acoesHTML = `
            <button class="btn btn-outline-primary" onclick="editarAtestado('${a.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-outline-danger" onclick="excluirAtestado('${a.id}')"><i class="fas fa-trash"></i></button>
        `;

        const isPsico = isCidPsicossocial(a.cid);
        if (isPsico) {
            const corBotaoPsico = a.investigacaoPsicossocial ? 'btn-success' : 'btn-warning';
            acoesHTML += `<button class="btn ${corBotaoPsico}" onclick="abrirModalAcompanhamentoPsicossocial('${a.id}')" title="Acompanhamento Psicossocial"><i class="fas fa-brain"></i></button>`;
        }

        if (a.encaminhadoINSS && a.afastamentoId) {
            acoesHTML = `<button class="btn btn-outline-warning" title="Ver Encaminhamento ao INSS" onclick="visualizarEncaminhamentoINSS('${a.afastamentoId}')"><i class="fas fa-notes-medical"></i></button>` + acoesHTML;
        }

        return `
        <tr class="${a.encaminhadoINSS ? 'table-warning' : ''}">
            <td>${a.colaborador_nome}</td>
            <td><span class="badge bg-light text-dark">${empMap[a.empresaId] || '-'}</span></td>
            <td>${formatarData(a.data_atestado)}</td>
            <td><span class="badge ${a.dias > 3 ? 'bg-warning' : 'bg-info'}">${a.duracaoValor || a.dias} ${a.duracaoTipo || 'dias'}</span></td>
            <td><span class="badge ${classeTipo(a.tipo)}">${a.tipo}</span></td>
            <td>${a.cid || '-'}</td>
            <td><small>${a.medico || '-'}</small></td>
            <td><span class="badge ${classeStatus(a.status)}">${a.status}</span></td>
            <td class="text-end text-nowrap">
                <div class="btn-group btn-group-sm">${acoesHTML}</div>
            </td>
        </tr>
        `;
    }).join('');
}

function getParteDoCorpoPorCID(cid) {
    if (!cid) return null;
    
    const cidUpper = cid.toUpperCase().trim();
    
    // 1. Buscar match exato
    if (CID_BODY_MAP_CONSOLIDADO[cidUpper]) {
        return CID_BODY_MAP_CONSOLIDADO[cidUpper];
    }
    
    // Buscar por range (ex: S80-S89)
    for (const [range, bodyPart] of Object.entries(CID_BODY_MAP_CONSOLIDADO)) {
        if (range.includes('-')) {
            const [start, end] = range.split('-');
            if (cidUpper >= start && cidUpper <= end) {
                return bodyPart;
            }
        }
    }

    // 3. Buscar por prefixo (para CIDs mais genéricos)
    for (const [prefix, bodyPart] of Object.entries(CID_BODY_MAP_CONSOLIDADO)) {
        if (!prefix.includes('-') && cidUpper.startsWith(prefix)) {
            return bodyPart;
        }
    }
    
    return null;
}

// FUNÇÃO PRINCIPAL MELHORADA - Atualizar gráfico da silhueta
function atualizarGraficoSilhueta(atestados) {
    const legendContainer = document.getElementById('body-map-legend');
    const frontView = document.getElementById('body-front-view');
    const backView = document.getElementById('body-back-view');
    
    // Reset para estilo padrão melhorado
    document.querySelectorAll('.body-part').forEach(part => {
        part.style.fill = '#e9ecef';
        part.style.stroke = '#adb5bd';
        part.style.strokeWidth = '1.5';
        part.style.transition = 'all 0.3s ease';
        part.style.cursor = 'pointer';
    });

    if (!legendContainer) return;

    const partCounts = {};
    atestados.forEach(atestado => {
        const bodyPart = getParteDoCorpoPorCID(atestado.cid);
        if (bodyPart) {
            partCounts[bodyPart] = (partCounts[bodyPart] || 0) + 1;
        }
    });

    // Header da legenda melhorado
    legendContainer.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0"><i class="fas fa-notes-medical text-primary"></i> Incidência por Região</h6>
            <small class="text-muted">${atestados.length} atestados</small>
        </div>
    `;
    
    if (Object.keys(partCounts).length === 0) {
        legendContainer.innerHTML += `
            <div class="text-center py-3">
                <i class="fas fa-info-circle text-muted fa-2x mb-2"></i>
                <p class="text-muted small mb-0">Nenhum CID mapeado no período</p>
            </div>
        `;
        return;
    }

    const sortedParts = Object.entries(partCounts).sort(([, a], [, b]) => b - a);
    const maxCount = sortedParts.length > 0 ? sortedParts[0][1] : 1;

    // Aplicar cores às partes do corpo
    sortedParts.forEach(([part, count]) => {
        const intensity = count / maxCount;
        const color = getColorForIntensity(intensity);
        const opacity = 0.6 + (intensity * 0.4); // Varia opacidade baseada na intensidade

        // Selecionar todas as variações da parte do corpo
        const selectors = [
            `#front-${part}`, `#back-${part}`,
            `#front-${part}-left`, `#front-${part}-right`,
            `#back-${part}-left`, `#back-${part}-right`
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                if (el) {
                    el.style.fill = color;
                    el.style.fillOpacity = opacity;
                    el.style.stroke = darkenColor(color, 20);
                    el.style.strokeWidth = '2';
                    el.style.filter = `drop-shadow(0 2px 4px ${color}40)`;
                    
                    // Adicionar tooltip
                    el.setAttribute('title', `${formatarNomeParte(part)}: ${count} ocorrência(s)`);
                }
            });
        });

        // Adicionar item na legenda com estilo melhorado
        const percentage = ((count / atestados.length) * 100).toFixed(1);
        legendContainer.innerHTML += `
            <div class="legend-item d-flex justify-content-between align-items-center py-1 px-2 rounded mb-1" 
                 style="background-color: ${color}15; border-left: 3px solid ${color};"
                 onmouseover="highlightBodyPart('${part}')"
                 onmouseout="resetBodyPart('${part}')">
                <div class="d-flex align-items-center">
                    <div class="color-indicator me-2" style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%;"></div>
                    <span class="small">${formatarNomeParte(part)}</span>
                </div>
                <div class="d-flex align-items-center">
                    <span class="badge rounded-pill me-2" style="background-color: ${color}; font-size: 0.7em;">${count}</span>
                    <small class="text-muted">${percentage}%</small>
                </div>
            </div>
        `;
    });

    // Adicionar estatísticas resumidas
    const totalRegioes = Object.keys(partCounts).length;
    const regiaoMaisAfetada = sortedParts[0];
    
    if (regiaoMaisAfetada) {
        legendContainer.innerHTML += `
            <div class="mt-3 p-2 bg-light rounded">
                <small class="text-muted d-block">
                    <i class="fas fa-chart-line me-1"></i>
                    Região mais afetada: <strong>${formatarNomeParte(regiaoMaisAfetada[0])}</strong>
                </small>
                <small class="text-muted">
                    <i class="fas fa-map-marked-alt me-1"></i>
                    ${totalRegioes} região(ões) mapeada(s)
                </small>
            </div>
        `;
    }
}

/**
 * Analisa os atestados filtrados e exibe o alerta de saúde psicossocial se necessário.
 * @param {Array} atestadosFiltrados A lista de atestados já filtrada.
 */
function analisarAtestadosPsicossociais(atestadosFiltrados) {
    const alertaContainer = document.getElementById('alerta-atestados-psicossociais');
    const detalhesContainer = document.getElementById('atestados-psicossociais-container');

    if (!alertaContainer || !detalhesContainer) return;

    const casosPsicossociais = atestadosFiltrados.filter(a => isCidPsicossocial(a.cid));

    if (casosPsicossociais.length > 0) {
        detalhesContainer.innerHTML = casosPsicossociais
            .map(atestado => {
                const estagio = atestado.investigacaoPsicossocial?.estagio || 'Não iniciado';
                let corBadge = 'bg-secondary';
                if (estagio === 'Análise Inicial' || estagio === 'Conversa Agendada') corBadge = 'bg-warning text-dark';
                if (estagio === 'Conversado com Funcionário' || estagio === 'Plano de Ação Definido') corBadge = 'bg-info text-dark';
                if (estagio === 'Caso Encerrado') corBadge = 'bg-success';

                return `
                    <div class="alert alert-light p-2 mb-2 d-flex justify-content-between align-items-center">
                        <span><i class="fas fa-user-circle me-2"></i>${atestado.colaborador_nome} (CID: <strong>${atestado.cid}</strong>)</span>
                        <span class="badge ${corBadge}">${estagio}</span>
                    </div>
                `;
            }).join('');
        alertaContainer.style.display = 'block';
    } else {
        alertaContainer.style.display = 'none';
    }
}

// Funções auxiliares para efeitos de hover
function highlightBodyPart(part) {
    const selectors = [
        `#front-${part}`, `#back-${part}`,
        `#front-${part}-left`, `#front-${part}-right`,
        `#back-${part}-left`, `#back-${part}-right`
    ];

    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el) {
                el.style.strokeWidth = '3';
                el.style.stroke = '#000';
                el.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
            }
        });
    });
}

function resetBodyPart(part) {
    const selectors = [
        `#front-${part}`, `#back-${part}`,
        `#front-${part}-left`, `#front-${part}-right`,
        `#back-${part}-left`, `#back-${part}-right`
    ];

    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            if (el) {
                el.style.strokeWidth = '2';
                el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
                // A cor do stroke será resetada quando o mapa for atualizado
            }
        });
    });
}

// Função para escurecer cor (para contornos)
function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Melhorar a função de cores para gradiente mais suave
function getColorForIntensity(intensity) {
    if (intensity < 0.2) return '#4CAF50'; // Verde claro - baixa incidência
    if (intensity < 0.4) return '#8BC34A'; // Verde
    if (intensity < 0.6) return '#FFC107'; // Amarelo
    if (intensity < 0.8) return '#FF9800'; // Laranja
    return '#F44336'; // Vermelho - alta incidência
}

// Melhorar formatação de nomes das partes
function formatarNomeParte(partName) {
    const names = {
        head: 'Cabeça',
        neck: 'Pescoço',
        torso: 'Torso/Abdômen',
        back: 'Costas/Coluna',
        shoulder: 'Ombros',
        arm: 'Braços',
        hand: 'Mãos/Pulsos',
        leg: 'Pernas',
        foot: 'Pés/Tornozelos'
    };
    return names[partName] || partName;
}

async function carregarAlertasPericia() {
    const container = document.getElementById('pericias-proximas-container');
    if (!container) return;

    try {
        const hoje = new Date();
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 10); // Busca em uma janela maior para contar dias úteis

        const snap = await db.collection('afastamentos')
            .where('requerINSS', '==', true)
            .where('inssDataPericia', '>=', hoje)
            .where('inssDataPericia', '<=', dataLimite)
            .get();

        const alertas = [];

        snap.forEach(doc => {
            const afastamento = doc.data();
            const dataPericia = afastamento.inssDataPericia.toDate();
            const diasUteis = calcularDiasUteis(hoje, dataPericia);

            if (diasUteis <= 5) {
                alertas.push({
                    nome: afastamento.colaborador_nome,
                    dataPericia: dataPericia,
                    diasUteis: diasUteis
                });
            }
        });

        if (alertas.length === 0) {
            container.innerHTML = '<p class="text-muted m-2">Nenhum alerta de perícia nos próximos 5 dias úteis.</p>';
            return;
        }

        container.innerHTML = alertas.sort((a, b) => a.dataPericia - b.dataPericia).map(alerta => `
            <div class="alert alert-light d-flex justify-content-between align-items-center p-2 m-1">
                <div>
                    <strong>${alerta.nome}</strong>
                    <br>
                    <small>Data da Perícia: ${alerta.dataPericia.toLocaleDateString('pt-BR')}</small>
                </div>
                <span class="badge bg-danger">${alerta.diasUteis} dia(s) útil(eis)</span>
            </div>
        `).join('');

    } catch (error) {
        console.error("Erro ao carregar alertas de perícia:", error);
        container.innerHTML = '<p class="text-danger m-2">Erro ao carregar alertas.</p>';
    }
}

function calcularDiasUteis(data1, data2) {
    let diasUteis = 0;
    let dataAtual = new Date(data1);
    while (dataAtual <= data2) {
        const diaSemana = dataAtual.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) { // Não é domingo nem sábado
            diasUteis++;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return diasUteis;
}

// Atualizar métricas de atestados
async function atualizarMetricasAtestados() {
    const filtrados = aplicarFiltrosAtestados(__atestados_cache);
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const atestMes = filtrados.filter(a => {
        const dataAtestado = parseDateSafe(a.data_atestado);
        return dataAtestado && dataAtestado >= inicioMes;
    }).length;
    
    const totalDias = filtrados.reduce((s, a) => s + (a.dias || 0), 0);
    const media = filtrados.length ? (totalDias / filtrados.length).toFixed(1) : 0;
    
    const custoTotal = await calcularCustoAtestados(filtrados);
    // Calcula a taxa de absenteísmo (simplificado)
    const totalFuncionariosAtivos = (await db.collection('funcionarios').where('status', '==', 'Ativo').get()).size;
    const taxaAbsenteismo = totalFuncionariosAtivos > 0 ? ((totalDias / (totalFuncionariosAtivos * 22)) * 100).toFixed(1) : 0;
    
    const totalAtestadosMes = document.getElementById('total-atestados-mes');
    const totalDiasAtestados = document.getElementById('total-dias-atestados');
    const mediaDiasAtestado = document.getElementById('media-dias-atestado');
    const custoTotalAtestados = document.getElementById('custo-total-atestados');
    
    if (totalAtestadosMes) totalAtestadosMes.textContent = atestMes;
    if (totalDiasAtestados) totalDiasAtestados.textContent = totalDias;
    if (mediaDiasAtestado) mediaDiasAtestado.textContent = media;
    if (custoTotalAtestados) custoTotalAtestados.textContent = `R$ ${custoTotal.toFixed(2).replace('.', ',')}`;
    
    const percentualAfastamento = document.getElementById('percentual-afastamento');
    if (percentualAfastamento) {
        percentualAfastamento.textContent = `${taxaAbsenteismo}%`;
    }
}

async function calcularCustoAtestados(atestados) {
    if (!atestados.length) return 0;
    
    try {
        const funcionariosSnap = await db.collection('funcionarios').get();
        const salariosMap = new Map();
        
        funcionariosSnap.forEach(doc => {
            const data = doc.data();
            const salario = typeof data.salario === 'string' 
                ? parseFloat(data.salario.replace(/[^\d,]/g, '').replace(',', '.'))
                : data.salario;
                
            if (salario && !isNaN(salario)) {
                salariosMap.set(doc.id, salario);
            }
        });

        return atestados.reduce((total, atestado) => {
            const salario = salariosMap.get(atestado.funcionarioId);
            if (salario && atestado.dias) {
                // Converte horas para dias se necessário (8h = 1 dia)
                const diasDeAtestado = atestado.duracaoTipo === 'horas' ? (atestado.duracaoValor / 8) : atestado.dias;

                const valorHora = salario / 220;
                const horasAtestado = diasDeAtestado * 8;
                return total + (valorHora * horasAtestado);
            }
            return total;
        }, 0);
    } catch (error) {
        console.error('Erro ao calcular custo:', error);
        return 0;
    }
}

// Classes para tipos de atestado
function classeTipo(t) {
    const map = { 
        'Doença': 'bg-danger', 
        'Acidente': 'bg-warning', 
        'Consulta': 'bg-info', 
        'Exame': 'bg-primary', 
        'Outros': 'bg-secondary' 
    };
    return map[t] || 'bg-secondary';
}

// Classes para status
function classeStatus(s) {
    const map = { 
        'Válido': 'bg-success', 
        'Expirado': 'bg-secondary', 
        'Analise': 'bg-warning' 
    };
    return map[s] || 'bg-secondary';
}

// Abrir modal de novo atestado
function abrirModalNovoAtestado() {
    const id = 'novoAtestadoModal';
    let modalEl = document.getElementById(id);
    
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = id;
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Novo Atestado</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-atestado">
                            <div class="mb-2">
                                <label class="form-label">Colaborador</label>
                                <select class="form-select" id="at_colab" required><option value="">Selecione...</option></select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Empresa</label>
                                <select class="form-select" id="at_empresa" required>
                                    <option value="">Selecione</option>
                                </select> 
                            </div>
                            <div class="row g-2">
                                <div class="col-12 mb-2">
                                    <label class="form-label">Duração</label>
                                    <div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="radio" name="duracaoTipo" id="duracao_dias" value="dias" checked>
                                            <label class="form-check-label" for="duracao_dias">Dias</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="radio" name="duracaoTipo" id="duracao_horas" value="horas">
                                            <label class="form-check-label" for="duracao_horas">Horas</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-6" id="container-dias">
                                    <label class="form-label">Dias</label>
                                    <input type="number" min="1" class="form-control" id="at_dias">
                                </div>
                                <div class="col-6 d-none" id="container-horas">
                                    <label class="form-label">Horas</label>
                                    <input type="number" min="1" max="24" class="form-control" id="at_horas">
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Data</label>
                                    <input type="date" class="form-control" id="at_data" required>
                                </div>
                            </div>
                            <div class="row g-2 mt-1">
                                <div class="col-6">
                                    <label class="form-label">Tipo</label>
                                    <select class="form-select" id="at_tipo" required>
                                        <option value="">Selecione</option>
                                        <option>Doença</option>
                                        <option>Acidente</option>
                                        <option>Consulta</option>
                                        <option>Exame</option>
                                        <option>Outros</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">CID</label>
                                    <input class="form-control" id="at_cid" placeholder="J06.9">
                                </div>
                            </div>
                            <div class="mb-2 mt-1">
                                <label class="form-label">Médico</label>
                                <input class="form-control" id="at_medico">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-primary" onclick="salvarNovoAtestado()">Salvar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    document.getElementById('form-atestado').reset();

    // Adicionar listeners para os radio buttons de duração
    document.getElementById('duracao_dias').addEventListener('change', () => {
        document.getElementById('container-dias').classList.remove('d-none');
        document.getElementById('container-horas').classList.add('d-none');
        document.getElementById('at_dias').required = true;
        document.getElementById('at_horas').required = false;
    });
    document.getElementById('duracao_horas').addEventListener('change', () => {
        document.getElementById('container-dias').classList.add('d-none');
        document.getElementById('container-horas').classList.remove('d-none');
        document.getElementById('at_dias').required = false;
        document.getElementById('at_horas').required = true;
    });

    const empresaSelect = document.getElementById('at_empresa');
    empresaSelect.disabled = false; // Garante que o campo esteja habilitado ao abrir

    // Popular empresas no select do modal
    (async () => {
        if (empresaSelect) {
            empresaSelect.innerHTML = '<option value="">Selecione</option>';
            const empSnap = await db.collection('empresas').get();
            
            empSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().nome;
                empresaSelect.appendChild(opt);
            });
        }
        
        // Data padrão
        const dataInput = document.getElementById('at_data');
        if (dataInput) dataInput.valueAsDate = new Date();

        // Popular funcionários
        const funcSelect = document.getElementById('at_colab');
        if (funcSelect) {
            funcSelect.innerHTML = '<option value="">Selecione...</option>'; // Limpa antes de popular
            const funcSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
            funcSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.dataset.empresaId = doc.data().empresaId || '';
                opt.textContent = doc.data().nome;
                funcSelect.appendChild(opt);
            });

            // Adiciona o listener para preencher a empresa automaticamente
            funcSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const empresaId = selectedOption.dataset.empresaId;
                
                empresaSelect.value = empresaId;
                // Desabilita o campo de empresa se um funcionário for selecionado
                empresaSelect.disabled = !!empresaId;
            });
        }
        
    })();
    
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// Salvar novo atestado
async function salvarNovoAtestado() {
    try {
        const colabSelect = document.getElementById('at_colab');
        const colabNome = colabSelect.options[colabSelect.selectedIndex].text;
        const empId = document.getElementById('at_empresa').value;
        const data = document.getElementById('at_data').value;
        const duracaoTipo = document.querySelector('input[name="duracaoTipo"]:checked').value;
        const duracaoValor = duracaoTipo === 'dias' ? parseInt(document.getElementById('at_dias').value, 10) : parseInt(document.getElementById('at_horas').value, 10);
        const dias = duracaoTipo === 'dias' ? duracaoValor : (duracaoValor / 8); // Converte horas para dias para os cálculos
        const tipo = document.getElementById('at_tipo').value;
        const cid = document.getElementById('at_cid').value.trim();
        const medico = document.getElementById('at_medico').value.trim();
        
        const formData = {
            funcionarioId: colabSelect.value,
            empresaId: empId,
            data_atestado: data,
            duracaoTipo: duracaoTipo,
            duracaoValor: duracaoValor,
            tipo: tipo,
            cid: cid,
            medico: medico
        };

        const errors = validarAtestado(formData);
        if (errors.length > 0) {
            mostrarMensagem(errors.join('<br>'), 'warning'); 
            return;
        }
        
        let afastamentoId = null;

        const dataAtestadoObj = parseDateSafe(data);
        const sessentaDiasAtras = new Date(dataAtestadoObj);
        sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60);

        // Buscar todos os atestados anteriores para este funcionário nos últimos 60 dias
        const atestadosAnterioresSnap = await db.collection('atestados')
            .where('funcionarioId', '==', colabSelect.value)
            .where('data_atestado', '>=', sessentaDiasAtras)
            .get();

        let diasAcumuladosTotal = dias; // Soma total de dias de atestado (qualquer CID)
        let diasAcumuladosMesmoCID = dias; // Soma de dias para o CID atual

        atestadosAnterioresSnap.forEach(doc => {
            const atestadoAnterior = { ...doc.data(), data_atestado: parseDateSafe(doc.data().data_atestado) };
            diasAcumuladosTotal += atestadoAnterior.dias || 0;

            // Se o atestado anterior tiver o mesmo CID que o atual (e o CID não for vazio)
            if (cid && atestadoAnterior.cid && atestadoAnterior.cid.toUpperCase() === cid.toUpperCase()) {
                diasAcumuladosMesmoCID += atestadoAnterior.dias || 0;
            }
        });

        let inssTriggered = false;
        let motivoINSS = `Atestado de ${dias} dias.`;

        if (dias > 15) {
            inssTriggered = true;
            motivoINSS += ` (Direto > 15 dias)`;
        } else if (diasAcumuladosTotal > 15) {
            inssTriggered = true;
            motivoINSS += ` (Total acumulado: ${diasAcumuladosTotal} dias em 60 dias)`;
        } else if (cid && diasAcumuladosMesmoCID > 15) {
            inssTriggered = true;
            motivoINSS += ` (Acumulado para CID ${cid}: ${diasAcumuladosMesmoCID} dias em 60 dias)`;
        }

        if (inssTriggered) {
            // Se a regra for atendida, cria um AFASTAMENTO em vez de um atestado
            const afastamentoRef = await db.collection('afastamentos').add({
                colaborador_nome: colabNome,
                funcionarioId: colabSelect.value,                
                empresaId: empId,
                data_inicio: dataAtestadoObj,
                data_termino_prevista: null, // Fica em aberto até a perícia
                dias_atestado_inicial: dias,
                tipo_afastamento: 'Doença (Enc. INSS)',
                motivo: motivoINSS,
                status: 'Ativo',
                requerINSS: true, // Flag para indicar que requer encaminhamento ao INSS
                inssStatus: 'Pendente' // Status do encaminhamento ao INSS
            });
            afastamentoId = afastamentoRef.id; // Guarda o ID do afastamento criado
            mostrarMensagem('Atestado identificado para afastamento e encaminhamento ao INSS!', 'warning');
        }

        await db.collection('atestados').add({
            colaborador_nome: colabNome,
            funcionarioId: colabSelect.value,
            empresaId: empId,            
            data_atestado: dataAtestadoObj,            
            duracaoTipo: duracaoTipo,
            duracaoValor: duracaoValor,
            dias: dias,
            tipo: tipo,
            cid: cid || '',
            medico: medico || '',
            status: 'Válido',            
            criado_em: timestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null,
            encaminhadoINSS: inssTriggered, // Salva se gerou encaminhamento
            afastamentoId: afastamentoId // Salva o ID do afastamento vinculado
        });
        
        const modalEl = document.getElementById('novoAtestadoModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        await carregarAtestadosDb();
        // await carregarAlertasPericia(); // Chamada removida para evitar loops
        renderizarAtestados();
        atualizarMetricasAtestados();
        mostrarMensagem('Atestado cadastrado com sucesso!');
    } catch (e) {
        console.error('Erro ao salvar atestado:', e);
        mostrarMensagem('Erro ao salvar atestado', 'error');
    }
}

function validarAtestado(formData) {
    const errors = [];
    
    if (!formData.funcionarioId) errors.push('Colaborador é obrigatório');
    if (!formData.empresaId) errors.push('Empresa é obrigatória');
    if (!formData.data_atestado) errors.push('Data é obrigatória');
    if (!formData.duracaoValor || formData.duracaoValor < 1) errors.push('A duração (dias ou horas) deve ser maior que 0.');
    if (!formData.tipo) errors.push('Tipo é obrigatório');
    
    // Regex melhorado para CID (letra, 2 dígitos, opcionalmente ponto e mais 1-2 dígitos)
    if (formData.cid && !/^[A-Z]\d{2}(\.\d{1,2})?$/i.test(formData.cid)) {
        errors.push('Formato de CID inválido. Ex: A01 ou J06.9');
    }
    
    return errors;
}

// Ver detalhes do atestado
async function verDetalhesAtestado(id) {
    try {
        if (!a) {
            mostrarMensagem('Atestado não encontrado', 'warning');
            return;
        }
        
        let empresaNome = 'N/A';
        const empMap = await getEmpresasCache();
        empresaNome = empMap[a.empresaId] || 'Empresa não encontrada';
        exibirDetalhesAtestado(a, empresaNome);
    } catch (error) {
        console.error('Erro ao ver detalhes do atestado:', error);
        mostrarMensagem('Erro ao carregar detalhes', 'error');
    }
}

// Exibir detalhes do atestado
function exibirDetalhesAtestado(a, empresaNome) {
    const body = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Colaborador:</strong> ${a.colaborador_nome}</p>
                <p><strong>Empresa:</strong> ${empresaNome}</p>
                <p><strong>Data:</strong> ${formatarData(a.data_atestado)}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Duração:</strong> ${a.duracaoValor || a.dias} ${a.duracaoTipo || 'dias'}</p>
                <p><strong>Tipo:</strong> ${a.tipo}</p>
                <p><strong>CID:</strong> ${a.cid || '-'}</p>
                <p><strong>Médico:</strong> ${a.medico || '-'}</p>
                <p><strong>Status:</strong> ${a.status || 'Válido'}</p>
            </div>
        </div>`;
        
    const idm = 'detAtestadoModal';
    let modalEl = document.getElementById(idm);
    
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = idm;
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Atestado</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="detAtestadoBody"></div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    document.getElementById('detAtestadoBody').innerHTML = body;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// Editar atestado
async function editarAtestado(id) {
    const a = __atestados_cache.find(x => x.id === id);
    
    const mid = 'editAtestadoModal';
    let modalEl = document.getElementById(mid);
    
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = mid;
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Atestado</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-2">
                            <label class="form-label">Colaborador</label>
                            <input class="form-control" id="ed_colab" readonly> <!-- Colaborador não deve ser alterado em edição simples -->
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Dias</label>
                            <input type="number" min="1" class="form-control" id="ed_dias">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Tipo</label>
                            <select class="form-select" id="ed_tipo">
                                <option>Doença</option>
                                <option>Acidente</option>
                                <option>Consulta</option>
                                <option>Exame</option>
                                <option>Outros</option>
                            </select>
                        </div>
                        <div class="mb-2">
                            <label class="form-label">CID</label>
                            <input class="form-control" id="ed_cid">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Médico</label>
                            <input class="form-control" id="ed_medico">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Status</label>
                            <select class="form-select" id="ed_status">
                                <option>Válido</option>
                                <option>Expirado</option>
                                <option>Analise</option>
                                <option>Invalidado</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-primary" id="btn-save-ed-atestado">Salvar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    document.getElementById('ed_colab').value = a.colaborador_nome || '';
    document.getElementById('ed_dias').value = a.dias || 1;
    document.getElementById('ed_tipo').value = a.tipo || 'Outros';
    document.getElementById('ed_cid').value = a.cid || '';
    document.getElementById('ed_medico').value = a.medico || '';
    document.getElementById('ed_status').value = a.status || 'Válido';
    
    const btnSalvar = document.getElementById('btn-save-ed-atestado');
    if (btnSalvar) {
        btnSalvar.onclick = async function() {
            try {
                await db.collection('atestados').doc(id).update({
                    colaborador_nome: document.getElementById('ed_colab').value.trim(),
                    dias: parseInt(document.getElementById('ed_dias').value, 10),
                    tipo: document.getElementById('ed_tipo').value,                    
                    cid: document.getElementById('ed_cid').value.trim(),
                    medico: document.getElementById('ed_medico').value.trim(),
                    status: document.getElementById('ed_status').value,
                    updatedAt: timestamp() // Usa a função global de app.js
                });
                
                const modal = bootstrap.Modal.getInstance(document.getElementById(mid));
                if (modal) modal.hide();
                
                await carregarAtestadosDb();
                await renderizarAtestados();
                atualizarMetricasAtestados();
                mostrarMensagem('Atestado atualizado com sucesso!');
            } catch(e) { 
                console.error('Erro ao atualizar atestado:', e); 
                mostrarMensagem('Erro ao atualizar atestado', 'error'); 
            }
        };
    }
    
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

// Excluir atestado
async function excluirAtestado(id) {
    if (!confirm('Confirma excluir o atestado?')) return;
    
    try {
        await db.collection('atestados').doc(id).delete();
        await carregarAtestadosDb();
        await renderizarAtestados();
        atualizarMetricasAtestados();
        mostrarMensagem('Atestado excluído com sucesso!');
    } catch(e) { 
        console.error('Erro ao excluir atestado:', e); 
        mostrarMensagem('Erro ao excluir atestado', 'error'); 
    }
}

// Função auxiliar para visualizar encaminhamento INSS (se necessário)
function visualizarEncaminhamentoINSS(afastamentoId) {
    // Implementação para visualizar detalhes do encaminhamento ao INSS
    console.log('Visualizar encaminhamento INSS:', afastamentoId);
    mostrarMensagem('Funcionalidade de visualização de encaminhamento INSS', 'info');
}

/**
 * Abre o modal de acompanhamento psicossocial para um atestado específico.
 * @param {string} atestadoId O ID do documento do atestado no Firestore.
 */
async function abrirModalAcompanhamentoPsicossocial(atestadoId) {
    const modalEl = document.getElementById('acompanhamentoPsicossocialModal');
    if (!modalEl) return;

    const atestado = __atestados_cache.find(a => a.id === atestadoId);
    if (!atestado) {
        mostrarMensagem("Atestado não encontrado.", "error");
        return;
    }

    // Preenche os dados no modal
    document.getElementById('psico-atestado-id').value = atestadoId;
    document.getElementById('psico-nome-funcionario').textContent = atestado.colaborador_nome;
    document.getElementById('psico-cid-atestado').textContent = atestado.cid;

    // Popula o select de atribuição
    await popularSelectUsuariosPsico('psico-atribuir-para');

    // Limpa o formulário para uma nova entrada
    document.getElementById('psico-observacoes').value = '';
    document.getElementById('psico-atribuir-para').value = atestado.investigacaoPsicossocial?.atribuidoParaId || '';

    // Carrega o histórico e define o estágio atual
    const investigacao = atestado.investigacaoPsicossocial || {};
    document.getElementById('psico-estagio').value = investigacao.estagio || 'Análise Inicial';

    const historicoContainer = document.getElementById('psico-historico-container');
    if (Array.isArray(investigacao.historico) && investigacao.historico.length > 0) {
        historicoContainer.innerHTML = investigacao.historico
            .sort((a, b) => b.data.seconds - a.data.seconds) // Ordena do mais recente para o mais antigo
            .map((item, index) => `
                <div class="p-2 border-bottom d-flex justify-content-between align-items-start">
                    <div>
                        <p class="mb-1"><strong>${item.estagio}:</strong> ${escapeHTML(item.observacoes)}</p>
                        <small class="text-muted">Por: ${item.responsavelNome || 'Usuário'} em ${item.data.toDate().toLocaleString('pt-BR')}</small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" onclick="editarHistoricoPsicossocial('${atestadoId}', ${index})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-danger" onclick="excluirHistoricoPsicossocial('${atestadoId}', ${index})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
    } else {
        historicoContainer.innerHTML = '<p class="text-muted small">Nenhum registro anterior.</p>';
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Salva os dados do formulário de acompanhamento psicossocial no documento do atestado.
 */
async function salvarAcompanhamentoPsicossocial() {
    const atestadoId = document.getElementById('psico-atestado-id').value;
    const estagio = document.getElementById('psico-estagio').value;
    const observacoes = document.getElementById('psico-observacoes').value.trim();    
    const atribuidoParaSelect = document.getElementById('psico-atribuir-para');
    const atribuidoParaId = atribuidoParaSelect.value;
    const atribuidoParaNome = atribuidoParaId ? atribuidoParaSelect.options[atribuidoParaSelect.selectedIndex].text : null;

    if (!atestadoId || !observacoes) {
        mostrarMensagem("As observações são obrigatórias para salvar um novo registro no histórico.", "warning");
        return;
    }    

    const novoRegistroHistorico = {
        estagio: estagio,
        observacoes: observacoes,
        data: new Date(),
        responsavelUid: firebase.auth().currentUser?.uid,
        responsavelNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email
    };

    try {
        await db.collection('atestados').doc(atestadoId).update({
            'investigacaoPsicossocial.estagio': estagio, // Atualiza o estágio atual
            'investigacaoPsicossocial.atribuidoParaId': atribuidoParaId || null,
            'investigacaoPsicossocial.atribuidoParaNome': atribuidoParaNome || null,
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayUnion(novoRegistroHistorico), // Adiciona ao array de histórico
            'investigacaoPsicossocial.ultimaAtualizacao': firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Acompanhamento salvo com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal')).hide();
        await carregarAtestadosDb(); // Recarrega os dados do cache

        // Se foi atribuído a alguém, cria uma tarefa na agenda
        if (atribuidoParaId) {
            const atestado = __atestados_cache.find(a => a.id === atestadoId);
            const agendaTask = {
                assunto: `Acompanhamento Psicossocial: ${atestado.colaborador_nome}`,
                data: new Date(), // Tarefa para hoje
                tipo: 'Follow-up',
                descricao: `Realizar acompanhamento psicossocial referente ao atestado com CID ${atestado.cid}. Observações: ${observacoes}`,
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

        await renderizarAtestados(); // Renderiza novamente a tabela e os alertas
    } catch (error) {
        console.error("Erro ao salvar acompanhamento:", error);
        mostrarMensagem("Erro ao salvar acompanhamento.", "error");
    }
}

/**
 * Gera um relatório HTML estilizado para impressão do histórico de acompanhamento.
 */
async function imprimirHistoricoPsicossocial() {
    const atestadoId = document.getElementById('psico-atestado-id').value;
    if (!atestadoId) {
        mostrarMensagem("Nenhum atestado selecionado para impressão.", "warning");
        return;
    }

    const atestado = __atestados_cache.find(a => a.id === atestadoId);
    if (!atestado || !atestado.investigacaoPsicossocial?.historico) {
        mostrarMensagem("Não há histórico de acompanhamento para imprimir.", "info");
        return;
    }

    const historicoOrdenado = atestado.investigacaoPsicossocial.historico.sort((a, b) => a.data.seconds - b.data.seconds);

    let historicoHtml = '';
    historicoOrdenado.forEach(item => {
        historicoHtml += `
            <div class="timeline-item">
                <div class="timeline-date">${item.data.toDate().toLocaleDateString('pt-BR')}</div>
                <div class="timeline-content">
                    <h5>${item.estagio}</h5>
                    <p>${escapeHTML(item.observacoes)}</p>
                    <small class="text-muted">Registrado por: ${item.responsavelNome}</small>
                </div>
            </div>
        `;
    });

    const conteudo = `
        <html>
        <head>
            <title>Histórico de Acompanhamento Psicossocial</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }
                .report-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; }
                .report-header h2 { font-weight: 700; color: #0d6efd; }
                .timeline-item { display: flex; margin-bottom: 1.5rem; }
                .timeline-date { min-width: 100px; text-align: right; padding-right: 1rem; border-right: 2px solid #dee2e6; font-weight: bold; }
                .timeline-content { padding-left: 1rem; }
                .signature-area { margin-top: 80px; display: flex; justify-content: space-around; }
                .signature-block { text-align: center; }
            </style>
        </head>
        <body>
            <div class="report-header"><h2>Histórico de Acompanhamento Psicossocial</h2></div>
            <p><strong>Funcionário:</strong> ${atestado.colaborador_nome}</p>
            <p><strong>Atestado Original (CID):</strong> ${atestado.cid}</p>
            <hr>
            ${historicoHtml}
            <div class="signature-area">
                <div class="signature-block"><p>___________________________</p><p>Assinatura do Responsável RH</p></div>
                <div class="signature-block"><p>___________________________</p><p>Assinatura do Colaborador (se aplicável)</p></div>
            </div>
        </body>
        </html>`;

    openPrintWindow(conteudo, { autoPrint: true });
}

/**
 * Popula um select com a lista de usuários do sistema.
 * @param {string} selectId O ID do elemento select.
 */
async function popularSelectUsuariosPsico(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Evita repopular se já tiver opções
    if (select.options.length > 1) return;

    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        usersSnap.forEach(doc => {
            const user = doc.data();
            // Adiciona apenas se o usuário tiver um nome definido
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
 * @param {string} atestadoId O ID do atestado.
 * @param {number} index O índice do registro no array de histórico.
 */
async function editarHistoricoPsicossocial(atestadoId, index) {
    const atestado = __atestados_cache.find(a => a.id === atestadoId);
    const historico = atestado?.investigacaoPsicossocial?.historico.sort((a, b) => b.data.seconds - a.data.seconds)[index];

    if (!historico) {
        mostrarMensagem("Registro do histórico não encontrado.", "error");
        return;
    }

    // Preenche os campos do formulário
    document.getElementById('psico-estagio').value = historico.estagio;
    document.getElementById('psico-observacoes').value = historico.observacoes;

    // Altera o botão para o modo de atualização
    const btnSalvar = document.querySelector('#acompanhamentoPsicossocialModal .btn-primary');
    btnSalvar.textContent = 'Atualizar Registro';
    btnSalvar.onclick = () => atualizarRegistroHistorico(atestadoId, index);

    mostrarMensagem("Modo de edição ativado. Altere os dados e clique em 'Atualizar Registro'.", "info");
}

/**
 * Atualiza um registro específico no histórico de acompanhamento.
 * @param {string} atestadoId O ID do atestado.
 * @param {number} index O índice do registro a ser atualizado.
 */
async function atualizarRegistroHistorico(atestadoId, index) {
    // Implementação da atualização (requer leitura, modificação e escrita do array)
    mostrarMensagem("Funcionalidade de atualização de histórico em desenvolvimento.", "info");
    // TODO: Implementar a lógica de ler o array, modificar o item no índice e salvar o array completo de volta.
}

/**
 * Exclui um registro específico do histórico de acompanhamento.
 * @param {string} atestadoId O ID do atestado.
 * @param {number} index O índice do registro a ser excluído.
 */
async function excluirHistoricoPsicossocial(atestadoId, index) {
    if (!confirm("Tem certeza que deseja excluir este registro do histórico?")) return;

    const atestadoRef = db.collection('atestados').doc(atestadoId);
    const atestadoDoc = await atestadoRef.get();
    const investigacao = atestadoDoc.data().investigacaoPsicossocial;
    const historicoOrdenado = investigacao.historico.sort((a, b) => b.data.seconds - a.data.seconds);

    // Remove o item do array
    const itemParaRemover = historicoOrdenado[index];
    await atestadoRef.update({
        'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemParaRemover)
    });

    mostrarMensagem("Registro do histórico excluído.", "success");
    await carregarAtestadosDb();
    await renderizarAtestados();
    bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal')).hide();
}