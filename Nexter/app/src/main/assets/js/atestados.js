// Atestados - integração com Firestore + filtros e métricas

// =================================================================
// VARIÁVEIS GLOBAIS E CONSTANTES
// =================================================================

let __atestados_cache = [];
let __empresasCache = null;
let __initializedAtestados = false;
let __cid_familias_cache = null;
window.__filterTimeout = null;

const CIDS_PSICOSSOCIAIS_PREFIXOS = ['F', 'Z65'];

// =================================================================
// FUNÇÕES AUXILIARES GERAIS
// =================================================================

/**
 * Obtém a data atual no formato YYYY-MM-DD, considerando o fuso horário local
 * @returns {string} Data no formato YYYY-MM-DD
 */
function getDataLocalISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; // offset em milissegundos
    const localDate = new Date(now.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

/**
 * Converte uma string de data (YYYY-MM-DD) para Date sem problemas de fuso
 * @param {string} dateString - Data no formato YYYY-MM-DD
 * @returns {Date} Objeto Date ajustado
 */
function parseDataLocal(dateString) {
    if (!dateString) return null;
    
    const [year, month, day] = dateString.split('-').map(Number);
    // Cria a data no meio do dia para evitar problemas de fuso
    return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Formata uma Date para o formato YYYY-MM-DD para inputs type="date"
 * @param {Date} date - Data a ser formatada
 * @returns {string} Data no formato YYYY-MM-DD
 */
function formatarDataParaInput(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * Formata uma data para exibição (DD/MM/YYYY)
 * @param {Date} date - Data a ser formatada
 * @returns {string} Data formatada
 */
function formatarData(date) {
    if (!date) return '';
    const d = parseDateSafe(date);
    return d ? d.toLocaleDateString('pt-BR') : '';
}

/**
 * Formata o input de hora para HH:mm
 */
function formatarHora(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    if (value.length > 2) {
        value = value.substring(0, 2) + ':' + value.substring(2);
    }
    input.value = value;
}

/**
 * Escapa caracteres HTML para segurança
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto seguro
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Abre uma janela para impressão
 * @param {string} content - Conteúdo HTML para impressão
 * @param {Object} options - Opções {autoPrint: boolean}
 */
function openPrintWindow(content, options = {}) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        mostrarMensagem('Permita pop-ups para imprimir o relatório', 'warning');
        return;
    }
    
    printWindow.document.write(content);
    printWindow.document.close();
    
    if (options.autoPrint) {
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
}

// =================================================================
// FUNÇÕES DE MANIPULAÇÃO DE DATA
// =================================================================

function parseDateSafe(dateInput) {
    if (!dateInput) return null;
    
    // Se for um objeto Timestamp do Firestore
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        return dateInput.toDate();
    }
    
    // Se for uma string no formato YYYY-MM-DD
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return parseDataLocal(dateInput);
    }
    
    // Se for uma string ISO
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
        const date = new Date(dateInput);
        // Ajusta para fuso local
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + offset);
    }
    
    // Se for um objeto Date
    if (dateInput instanceof Date) {
        return new Date(dateInput.getTime());
    }
    
    // Default
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
}

// =================================================================
// FUNÇÕES DE CACHE E DADOS
// =================================================================

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

async function getCidFamilias() {
    if (!__cid_familias_cache) {
        const snap = await db.collection('cid_familias').get();
        __cid_familias_cache = snap.docs.map(doc => doc.data());
    }
    return __cid_familias_cache;
}

// =================================================================
// FUNÇÕES DE UTILIDADE PARA ATESTADOS
// =================================================================

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

// Classes para tipos de atestado
function classeTipo(t) {
    const map = { 
        'Doença': 'bg-danger', 
        'Acidente': 'bg-warning', 
        'Acidente de trabalho': 'bg-warning',
        'Acidente de Trajeto': 'bg-warning',
        'Consulta': 'bg-info', 
        'Exame': 'bg-primary', 
        'Acompanhamento': 'bg-success',
        'Licensa Maternidade': 'bg-purple',
        'Licensa Paternidade': 'bg-purple',
        'Serviço Militar': 'bg-secondary',
        'Declaração': 'bg-light text-dark',
        'Outros': 'bg-secondary' 
    };
    return map[t] || 'bg-secondary';
}

// Classes para status
function classeStatus(s) {
    const map = { 
        'Válido': 'bg-success', 
        'Expirado': 'bg-secondary', 
        'Analise': 'bg-warning',
        'Invalidado': 'bg-danger'
    };
    return map[s] || 'bg-secondary';
}

// =================================================================
// FUNÇÕES DE INICIALIZAÇÃO
// =================================================================

// Inicializar atestados
async function inicializarAtestados() {
    if (__initializedAtestados) return;

    // Configurar datas padrão (mês atual) COM FUSO LOCAL
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    // Formatar sem problemas de fuso
    const inicioMesStr = formatarDataParaInput(inicioMes);
    const fimMesStr = formatarDataParaInput(fimMes);

    const filtroInicio = document.getElementById('filtro-data-inicio-atestados');
    const filtroFim = document.getElementById('filtro-data-fim-atestados');

    if (filtroInicio && !filtroInicio.value) filtroInicio.value = inicioMesStr;
    if (filtroFim && !filtroFim.value) filtroFim.value = fimMesStr;

    configurarEventListenersAtestados();
    await preencherFiltroEmpresasAtestados();
    await renderizarAtestados();
    await atualizarMetricasAtestados();
    
    __initializedAtestados = true;
}

function configurarEventListenersAtestados() {
    // Usar event delegation para os botões principais
    try {
        document.addEventListener('click', (e) => {
            // Adicionado listener para o botão de novo atestado
            if (e.target.closest('#btn-novo-atestado')) {
                abrirModalAtestado();
            }
        });
    } catch (error) { console.error('Erro ao configurar event listener de clique:', error); }

    // Debounce para filtros
    const filtros = ['#filtro-empresa-atestados', '#filtro-tipo-atestados', '#filtro-status-atestados', '#filtro-data-inicio-atestados', '#filtro-data-fim-atestados'];
    filtros.forEach(selector => {
        const filtroEl = document.querySelector(selector);
        if (filtroEl) {
            filtroEl.addEventListener('change', () => {
                clearTimeout(window.__filterTimeout);
                window.__filterTimeout = setTimeout(async () => {
                    try {
                        await renderizarAtestados();
                        await atualizarMetricasAtestados();
                    } catch (error) { console.error('Erro ao aplicar filtros com debounce:', error); }
                }, 300);
            });
        }
    });
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

// =================================================================
// FUNÇÕES DE FILTRO E RENDERIZAÇÃO
// =================================================================

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

        const dataInicioObj = parseDataLocal(dataInicio);
        const dataFimAjustada = dataFim ? new Date(parseDataLocal(dataFim).setHours(23, 59, 59, 999)) : null;

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

        // Carrega todos os atestados do banco
        const snap = await db.collection('atestados')
            .orderBy('data_atestado', 'desc')
            .get();
            
        __atestados_cache = snap.docs.map(d => {
            const data = d.data();
            // Converte Timestamp para Date local corretamente
            let dataAtestado = null;
            if (data.data_atestado) {
                if (data.data_atestado.toDate) {
                    dataAtestado = data.data_atestado.toDate();
                } else if (data.data_atestado instanceof Date) {
                    dataAtestado = data.data_atestado;
                }
            }
            
            return {
                id: d.id,
                ...data,
                data_atestado: dataAtestado
            };
        }).filter(atestado => atestado.data_atestado);

        const filtrados = aplicarFiltrosAtestados(__atestados_cache);
        
        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhum atestado encontrado</td></tr>';
            if (totalEl) totalEl.textContent = '0 registros';
            return;
        }
        
        // Atualizar UI em paralelo
        await Promise.all([
            atualizarTabelaAtestados(filtrados),
        ]);
        
        if (totalEl) totalEl.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}`;

    } catch (e) {
        console.error('Erro ao renderizar atestados:', e);
        const tbodyError = document.getElementById('atestados-container');
        if (tbodyError) tbodyError.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados</td></tr>';
    }
}

async function atualizarTabelaAtestados(filtrados) {
    const tbody = document.getElementById('atestados-container');
    const empMap = await getEmpresasCache();

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-muted">
                    <i class="fas fa-inbox fa-2x mb-2"></i><br>
                    Nenhum atestado encontrado
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(a => {
        const empresaNome = empMap[a.empresaId] || '-';
        const dataFormatada = formatarData(a.data_atestado);
        const duracaoText = a.duracaoTipo === 'horas' 
            ? `${a.duracaoValor} horas` 
            : `${a.dias} dia${a.dias > 1 ? 's' : ''}`;
        
        // Ícone baseado no tipo de atestado
        let tipoIcon = 'fa-file-medical';
        if (a.tipo.includes('Acidente')) tipoIcon = 'fa-user-injured';
        else if (a.tipo.includes('Consulta')) tipoIcon = 'fa-stethoscope';
        else if (a.tipo.includes('Exame')) tipoIcon = 'fa-microscope';
        else if (a.tipo === 'Acompanhamento') tipoIcon = 'fa-hands-helping';

        // Ações condicionais
        let acoesHTML = `
            <button class="btn btn-outline-info btn-sm" onclick="verDetalhesAtestado('${a.id}')" title="Visualizar">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-primary btn-sm" onclick="editarAtestado('${a.id}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="excluirAtestado('${a.id}')" title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        `;

        if (a.encaminhadoINSS && a.afastamentoId) {
            acoesHTML = `
                <button class="btn btn-outline-warning btn-sm me-1" title="Ver Encaminhamento ao INSS" onclick="visualizarEncaminhamentoINSS('${a.afastamentoId}')">
                    <i class="fas fa-notes-medical"></i>
                </button>
                ${acoesHTML}
            `;
        }

        // Verificar se é psicossocial para adicionar botão de acompanhamento
        if (isCidPsicossocial(a.cid)) {
            acoesHTML = `
                <button class="btn btn-outline-success btn-sm me-1" title="Acompanhamento Psicossocial" onclick="abrirModalAcompanhamentoPsicossocial('${a.id}')">
                    <i class="fas fa-brain"></i>
                </button>
                ${acoesHTML}
            `;
        }

        return `
        <tr class="${a.encaminhadoINSS ? 'table-warning' : ''} ${isCidPsicossocial(a.cid) ? 'border-start border-primary border-3' : ''}">
            <td class="ps-3" data-label="Colaborador">
                <div class="d-flex align-items-center">
                    <div class="me-2">
                        <i class="fas ${tipoIcon} text-primary"></i>
                    </div>
                    <div>
                        <div class="fw-bold">${a.colaborador_nome}</div>
                        <small class="text-muted d-block">${empresaNome}</small>
                        ${a.cid ? `<small class="badge bg-light text-dark mt-1">CID: ${a.cid}</small>` : ''}
                    </div>
                </div>
            </td>
            <td data-label="Data / Duração">
                <div class="small fw-bold">${dataFormatada}</div>
                <div class="small text-muted">${duracaoText}</div>
                ${a.medico ? `<small class="text-truncate d-block" title="${a.medico}">Médico: ${a.medico}</small>` : ''}
            </td>
            <td data-label="Tipo / Status">
                <span class="badge ${classeTipo(a.tipo)} mb-1 d-inline-block">${a.tipo}</span>
                <span class="badge ${classeStatus(a.status)} d-inline-block">${a.status}</span>
                ${isCidPsicossocial(a.cid) ? `
                    <div class="mt-1">
                        <small class="text-primary"><i class="fas fa-brain me-1"></i> Psicossocial</small>
                    </div>
                ` : ''}
            </td>
            <td class="text-center" data-label="Ações">
                <div class="btn-group btn-group-sm" role="group">
                    ${acoesHTML}
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

// =================================================================
// FUNÇÕES DE MÉTRICAS E CÁLCULOS
// =================================================================

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
    const media = filtrados.length ? (totalDias / filtrados.length).toFixed(2) : '0.00';

    const custoTotal = await calcularCustoAtestados(filtrados);
    const totalFuncionariosAtivos = (await db.collection('funcionarios').where('status', '==', 'Ativo').get()).size;
    const taxaAbsenteismo = totalFuncionariosAtivos > 0 ? ((totalDias / (totalFuncionariosAtivos * 22)) * 100).toFixed(1) : 0;

    const totalAtestadosMes = document.getElementById('total-atestados-mes');
    const totalDiasAtestados = document.getElementById('total-dias-atestados');
    const mediaDiasAtestado = document.getElementById('media-dias-atestado');
    const custoTotalAtestados = document.getElementById('custo-total-atestados');

    if (totalAtestadosMes) totalAtestadosMes.textContent = atestMes;
    if (totalDiasAtestados) totalDiasAtestados.textContent = totalDias.toFixed(2).replace('.', ',');
    if (mediaDiasAtestado) mediaDiasAtestado.textContent = media.replace('.', ',');
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
        const custoTotalMap = new Map();

        funcionariosSnap.forEach(doc => {
            const data = doc.data();
            const custoTotal = data.custoTotal || 0;
            custoTotalMap.set(doc.id, custoTotal);
        });

        // Fetch companies for schedule (jornadaTrabalho)
        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = new Map();
        empresasSnap.forEach(doc => {
            empresasMap.set(doc.id, doc.data());
        });

        return atestados.reduce((total, atestado) => {
            const custoTotalFuncionario = custoTotalMap.get(atestado.funcionarioId);
            const empresa = empresasMap.get(atestado.empresaId);

            if (custoTotalFuncionario && empresa) {
                let horasPerdidas = 0;

                if (atestado.duracaoTipo === 'horas') {
                    // Parse hours
                    if (typeof atestado.duracaoValor === 'string' && atestado.duracaoValor.includes(':')) {
                        const [h, m] = atestado.duracaoValor.split(':').map(Number);
                        horasPerdidas = h + (m / 60);
                    } else {
                        horasPerdidas = parseFloat(atestado.duracaoValor) || 0;
                    }
                } else {
                    // Duration in days - Calculate based on schedule
                    const dias = parseInt(atestado.dias) || 0;
                    let dataInicio = parseDateSafe(atestado.data_atestado);
                    
                    if (dataInicio && !isNaN(dataInicio.getTime())) {
                        // Default schedule if not defined (Standard 8.8h Mon-Fri)
                        const jornada = empresa.jornadaTrabalho || {
                            segunda: 8.8, terca: 8.8, quarta: 8.8, quinta: 8.8, sexta: 8.8, sabado: 0, domingo: 0
                        };
                        
                        // Map day index (0=Sun, 1=Mon...) to keys
                        const diasSemanaKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

                        for (let i = 0; i < dias; i++) {
                            const currentDay = new Date(dataInicio);
                            currentDay.setDate(dataInicio.getDate() + i);
                            const dayIndex = currentDay.getDay();
                            const dayKey = diasSemanaKeys[dayIndex];
                            
                            horasPerdidas += parseFloat(jornada[dayKey] || 0);
                        }
                    }
                }

                const valorHora = custoTotalFuncionario / 220;
                return total + (valorHora * horasPerdidas);
            }
            return total;
        }, 0);
    } catch (error) {
        console.error('Erro ao calcular custo:', error);
        return 0;
    }
}

// =================================================================
// FUNÇÕES DE ALERTAS DE PERÍCIA
// =================================================================

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

// =================================================================
// FUNÇÕES DO MODAL DE ATESTADO
// =================================================================

// Abrir modal de novo atestado
async function abrirModalAtestado(atestadoId = null) {
    const id = 'atestadoModal';
    let modalEl = document.getElementById(id);
    
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = id;
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="atestadoModalTitle">Novo Atestado</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-atestado">
                            <div class="mb-2">
                                <label class="form-label">Colaborador</label>
                                <select class="form-select" id="at_colab" required><option value="">Selecione...</option></select>
                            </div>
                            <div class="row g-2 mb-2">
                                <div class="col-6">
                                    <label class="form-label">Empresa</label>
                                    <select class="form-select" id="at_empresa" required><option value="">Selecione</option></select> 
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Setor</label>
                                    <input type="text" class="form-control" id="at_setor" readonly>
                                </div>
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
                                    <input type="text" class="form-control" id="at_horas" placeholder="HH:mm" maxlength="5" oninput="formatarHora(this)">
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
                                        <option value="Doença">Doença</option>
                                        <option value="Acidente de trabalho">Acidente de trabalho</option>
                                        <option value="Acidente de Trajeto">Acidente de Trajeto</option>
                                        <option value="Acompanhamento">Acompanhamento</option>
                                        <option value="Licensa Maternidade">Licensa Maternidade</option>
                                        <option value="Licensa Paternidade">Licensa Paternidade</option>
                                        <option value="Serviço Militar">Serviço Militar</option>
                                        <option value="Consulta">Consulta</option>
                                        <option value="Exame">Exame</option>
                                        <option value="Declaração">Declaração</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">CID</label>
                                    <input class="form-control" id="at_cid" placeholder="A00.0" maxlength="5" oninput="formatarInputCID(this)">
                                </div>
                            </div>
                            <!-- Campos Condicionais -->
                            <div id="container-acompanhamento" class="mt-2" style="display: none;">
                                <label class="form-label">Tipo de Acompanhamento</label>
                                <select class="form-select" id="at_tipo_acompanhamento">
                                    <option value="Acompanhamento de Filho">Acompanhamento de Filho</option>
                                    <option value="Acompanhamento de Conjuge">Acompanhamento de Cônjuge</option>
                                </select>
                            </div>
                            <div id="container-cat" class="mt-2" style="display: none;">
                                <button type="button" class="btn btn-warning w-100" onclick="abrirModalCAT()">
                                    <i class="fas fa-file-medical-alt me-2"></i> Preencher CAT
                                </button>
                            </div>
                            <div id="at_cid_descricao" class="form-text bg-light p-2 rounded mt-2" style="display: none;"></div>
                            <div class="mb-2 mt-1">
                                <label class="form-label">Médico</label>
                                <input class="form-control" id="at_medico">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-primary" onclick="salvarAtestado()">Salvar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    // Reset do formulário
    document.getElementById('form-atestado').reset();
    
    // Data padrão - USANDO FUNÇÃO DE DATA LOCAL
    const dataInput = document.getElementById('at_data');
    if (dataInput) dataInput.value = getDataLocalISO();
    
    // Configurar listeners uma única vez
    if (!modalEl.dataset.listenersConfigurados) {
        // Listener para campos condicionais
        const tipoSelect = document.getElementById('at_tipo');
        tipoSelect.addEventListener('change', function() {
            const containerAcompanhamento = document.getElementById('container-acompanhamento');
            const containerCAT = document.getElementById('container-cat');
            containerAcompanhamento.style.display = this.value === 'Acompanhamento' ? 'block' : 'none';
            containerCAT.style.display = this.value === 'Acidente de trabalho' ? 'block' : 'none';
        });

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

        modalEl.dataset.listenersConfigurados = true;
    }

    const empresaSelect = document.getElementById('at_empresa');
    empresaSelect.disabled = false; // Garante que o campo esteja habilitado ao abrir

    // Popular empresas no select do modal
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
    
    // Popular funcionários
    const funcSelect = document.getElementById('at_colab');
    if (funcSelect) {
        funcSelect.innerHTML = '<option value="">Selecione...</option>'; // Limpa antes de popular
        const funcSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        funcSnap.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.dataset.empresaId = doc.data().empresaId || '';
            opt.dataset.setor = doc.data().setor || '';
            opt.textContent = doc.data().nome;
            funcSelect.appendChild(opt);
        });

        // Adiciona o listener para preencher a empresa e setor automaticamente
        funcSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const empresaId = selectedOption.dataset.empresaId || '';
            const setor = selectedOption.dataset.setor || '';
            
            empresaSelect.value = empresaId;
            // Desabilita o campo de empresa se um funcionário for selecionado
            empresaSelect.disabled = !!empresaId;
            
            const setorInput = document.getElementById('at_setor');
            if (setorInput) setorInput.value = setor;
        });
    }
    
    // Exibir modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function abrirModalCAT() {
    mostrarMensagem("Funcionalidade para preenchimento da CAT será implementada.", "info");
}

// =================================================================
// FUNÇÕES DE CID
// =================================================================

async function atualizarDescricaoCID(cidInput) {
    const cid = cidInput.value.trim().toUpperCase();
    const descEl = document.getElementById('at_cid_descricao');
    if (!descEl) return;

    if (!cid) {
        descEl.textContent = '';
        descEl.style.display = 'none';
        return;
    }

    const letra = cid.charAt(0);
    const numero = parseInt(cid.substring(1, 3), 10);

    if (!letra.match(/[A-Z]/) || isNaN(numero)) {
        descEl.textContent = 'Formato de CID inválido.';
        descEl.style.display = 'block';
        return;
    }

    const familias = await getCidFamilias();
    const familiaEncontrada = familias.find(f => {
        const startLetra = f.range_inicio.charAt(0);
        const endLetra = f.range_fim.charAt(0);
        const startNum = parseInt(f.range_inicio.substring(1, 3), 10);
        const endNum = parseInt(f.range_fim.substring(1, 3), 10);
        
        if (letra < startLetra || letra > endLetra) return false;
        
        if (startLetra === endLetra) {
            return numero >= startNum && numero <= endNum;
        }
        if (letra === startLetra) return numero >= startNum;
        if (letra === endLetra) return numero <= endNum;
        return true; // Letra intermediária
    });

    descEl.textContent = familiaEncontrada ? familiaEncontrada.descricao : 'Família de CID não encontrada.';
    descEl.style.display = 'block';
}

function formatarInputCID(input) {
    // Remove tudo que não for letra ou número
    let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Garante que começa com letra
    if (value.length > 0 && !/[A-Z]/.test(value[0])) {
        value = value.substring(1);
    }
    
    // Aplica a máscara LNN.N
    if (value.length > 3) {
        value = value.substring(0, 3) + '.' + value.substring(3, 4);
    }
    
    input.value = value;
    
    // Chama a função original para buscar a descrição
    atualizarDescricaoCID(input);
}

// =================================================================
// FUNÇÕES DE SALVAR ATESTADO
// =================================================================

// Salvar novo atestado
async function salvarAtestado() {
    try {
        const colabSelect = document.getElementById('at_colab');
        const colabNome = colabSelect.options[colabSelect.selectedIndex].text;
        const empId = document.getElementById('at_empresa').value;
        const setor = document.getElementById('at_setor').value;
        const dataString = document.getElementById('at_data').value;
        const duracaoTipo = document.querySelector('input[name="duracaoTipo"]:checked').value;
        
        let duracaoValor;
        let dias;

        if (duracaoTipo === 'dias') {
            duracaoValor = parseInt(document.getElementById('at_dias').value, 10);
            dias = duracaoValor;
        } else {
            duracaoValor = document.getElementById('at_horas').value;
            const [h, m] = duracaoValor.split(':').map(Number);
            dias = (h + (m / 60)) / 8;
        }

        const tipo = document.getElementById('at_tipo').value;
        const tipoAcompanhamento = document.getElementById('at_tipo_acompanhamento').value;
        const cid = document.getElementById('at_cid').value.trim();
        const medico = document.getElementById('at_medico').value.trim();
        
        // Usar parseDataLocal para garantir consistência
        const dataAtestadoObj = parseDataLocal(dataString);
        
        const formData = {
            funcionarioId: colabSelect.value,
            empresaId: empId,
            data_atestado: dataAtestadoObj,
            duracaoTipo: duracaoTipo,
            duracaoValor: duracaoValor,
            tipo: tipo,
            cid: cid,
            medico: medico
        };

        if (duracaoTipo === 'horas' && !/^\d{2}:\d{2}$/.test(duracaoValor)) {
             mostrarMensagem('Formato de hora inválido. Use HH:mm', 'warning');
             return;
        }

        const errors = validarAtestado(formData);
        if (errors.length > 0) {
            mostrarMensagem(errors.join('<br>'), 'warning'); 
            return;
        }
        
        // Checagem de cota de acompanhamento
        if (tipo === 'Acompanhamento') {
            const atestadosAcompanhamento = await db.collection('atestados')
                .where('funcionarioId', '==', colabSelect.value)
                .where('tipo', '==', 'Acompanhamento')
                .get();

            if (atestadosAcompanhamento.size >= 2) {
                const datasAnteriores = atestadosAcompanhamento.docs.map(doc => {
                    const data = doc.data().data_atestado;
                    return data ? formatarData(data) : 'Data não disponível';
                });
                const continuar = await abrirModalAlertaAcompanhamento(datasAnteriores);
                if (!continuar) {
                    mostrarMensagem("Lançamento cancelado pelo usuário.", "info");
                    return; // Para a execução se o usuário cancelar
                }
            }
        }

        let afastamentoId = null;

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
                setor: setor,
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
            setor: setor,
            data_atestado: firebase.firestore.Timestamp.fromDate(dataAtestadoObj), // SALVA COMO TIMESTAMP
            duracaoTipo: duracaoTipo,
            duracaoValor: duracaoValor,
            dias: dias,
            tipo: tipo,
            tipoAcompanhamento: tipo === 'Acompanhamento' ? tipoAcompanhamento : null,
            cid: cid || '',
            medico: medico || '',
            status: 'Válido',            
            criado_em: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null,
            encaminhadoINSS: inssTriggered, // Salva se gerou encaminhamento
            afastamentoId: afastamentoId // Salva o ID do afastamento vinculado
        });
        
        const modalEl = document.getElementById('atestadoModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
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
    // Permite formatos como F41.1 e F411
    if (formData.cid && !/^[A-Z]\d{2}(\.?\d{1,2})?$/i.test(formData.cid)) {
        errors.push('Formato de CID inválido. Ex: F41.1 ou F411');
    }
    
    return errors;
}

async function abrirModalAlertaAcompanhamento(datasAnteriores) {
    return new Promise((resolve) => {
        const modalId = 'alertaAcompanhamentoModal';
        let modalEl = document.getElementById(modalId);

        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content border-warning">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Alerta de Cota de Acompanhamento</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Este colaborador já utilizou ou excedeu a cota de 2 atestados para acompanhamento.</p>
                            <p><strong>Datas dos registros anteriores:</strong></p>
                            <ul id="datas-acompanhamento-anteriores" class="list-group"></ul>
                            <p class="mt-3 fw-bold">Deseja continuar com o lançamento mesmo assim?</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="btn-cancelar-acomp">Cancelar Lançamento</button>
                            <button type="button" class="btn btn-primary" id="btn-continuar-acomp">Sim, Continuar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        document.getElementById('datas-acompanhamento-anteriores').innerHTML = datasAnteriores.map(data => `<li class="list-group-item">${data}</li>`).join('');

        const modal = new bootstrap.Modal(modalEl);
        document.getElementById('btn-continuar-acomp').onclick = () => { modal.hide(); resolve(true); };
        document.getElementById('btn-cancelar-acomp').onclick = () => { modal.hide(); resolve(false); };
        modalEl.addEventListener('hidden.bs.modal', () => resolve(false), { once: true });
        modal.show();
    });
}

// =================================================================
// FUNÇÕES DE VISUALIZAÇÃO, EDIÇÃO E EXCLUSÃO
// =================================================================

// Ver detalhes do atestado
async function verDetalhesAtestado(id) {
    try {
        const a = __atestados_cache.find(x => x.id === id);
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
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const modal = bootstrap.Modal.getInstance(document.getElementById(mid));
                if (modal) modal.hide();
                
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

// =================================================================
// FUNÇÕES DE ACOMPANHAMENTO PSICOSSOCIAL
// =================================================================

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
            .sort((a, b) => {
                const timeA = a.data?.seconds || 0;
                const timeB = b.data?.seconds || 0;
                return timeB - timeA; // Mais recente primeiro
            })
            .map((item, index) => `
                <div class="p-2 border-bottom d-flex justify-content-between align-items-start">
                    <div>
                        <p class="mb-1"><strong>${item.estagio}:</strong> ${escapeHTML(item.observacoes)}</p>
                        <small class="text-muted">Por: ${item.responsavelNome || 'Usuário'} em ${item.data?.toDate ? item.data.toDate().toLocaleString('pt-BR') : 'Data não disponível'}</small>
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
 * Salva os dados do formulário de acompanhamento psicossocial no documento do atestado.
 */
async function salvarAcompanhamentoPsicossocial() {
    const atestadoId = document.getElementById('psico-atestado-id').value;
    const estagio = document.getElementById('psico-estagio').value;
    const observacoes = document.getElementById('psico-observacoes').value.trim();    
    const atribuidoParaSelect = document.getElementById('psico-atribuir-para');
    const atribuidoParaId = atribuidoParaSelect.value;
    const atribuidoParaNome = atribuidoParaId ? atribuidoParaSelect.options[atribuidoParaSelect.selectedIndex].text : null;

    if (!atestadoId || !observacoes || !estagio) {
        mostrarMensagem("Todos os campos são obrigatórios para salvar o acompanhamento.", "warning");
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

        bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal')).hide();

        await renderizarAtestados(); // Renderiza novamente a tabela
    } catch (error) {
        console.error("Erro ao salvar acompanhamento:", error);
        mostrarMensagem("Erro ao salvar acompanhamento.", "error");
    }
}

/**
 * Gera um relatório HTML estilizado para impressão do histórico de acompanhamento.
 */
async function imprimirHistoricoPsicossocial() {
    const atestadoIdPrincipal = document.getElementById('psico-atestado-id').value;
    if (!atestadoIdPrincipal) {
        mostrarMensagem("Nenhum atestado selecionado para impressão.", "warning");
        return;
    }

    // 1. Encontra o atestado principal que abriu o modal e seu funcionário
    const atestadoPrincipal = __atestados_cache.find(a => a.id === atestadoIdPrincipal);
    if (!atestadoPrincipal) {
        mostrarMensagem("Atestado de referência não encontrado.", "error");
        return;
    }

    const funcionarioId = atestadoPrincipal.funcionarioId;
    const colaboradorNome = atestadoPrincipal.colaborador_nome;
    const investigacao = atestadoPrincipal.investigacaoPsicossocial || {};

    // 2. Agrupa todos os atestados do mesmo funcionário para montar o histórico completo
    const todosAtestadosDoFuncionario = __atestados_cache.filter(a => a.funcionarioId === funcionarioId);

    // 3. Monta o histórico combinado
    const historicoAtestados = todosAtestadosDoFuncionario.map(a => ({
        data: parseDateSafe(a.data_atestado),
        tipo: 'Atestado Recebido',
        detalhes: `Atestado de ${a.duracaoValor || a.dias} ${a.duracaoTipo || 'dias'} (CID: ${a.cid || 'N/A'})`
    }));

    const historicoAcompanhamento = (investigacao.historico || []).map(item => ({
        data: parseDateSafe(item.data),
        tipo: item.estagio,
        detalhes: item.observacoes
    }));

    const historicoCompleto = [...historicoAtestados, ...historicoAcompanhamento]
        .filter(item => item.data) // Garante que todos os itens têm data
        .sort((a, b) => a.data - b.data); // Ordena do mais antigo para o mais recente (timeline)

    // 4. Verifica se há algo para imprimir
    if (historicoCompleto.length === 0) {
        mostrarMensagem("Não há histórico de acompanhamento para imprimir.", "info");
        return;
    }

    let historicoHtml = '';
    historicoCompleto.forEach(item => {
        const dataFormatada = item.data.toLocaleDateString('pt-BR');
        historicoHtml += `
            <div class="timeline-item">
                <div class="timeline-date">${dataFormatada}</div>
                <div class="timeline-content">
                    <h5>${item.tipo}</h5>
                    <p>${escapeHTML(item.detalhes)}</p>
                </div>
            </div>
        `;
    });

    const conteudo = `
        <html>
        <head>
            <title>Histórico de Acompanhamento Psicossocial - ${colaboradorNome}</title>
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
            <p><strong>Funcionário:</strong> ${colaboradorNome}</p>
            <p><strong>Atestado de Referência (CID):</strong> ${atestadoPrincipal.cid}</p>
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
 * Preenche o formulário para editar um registro específico do histórico.
 * @param {string} atestadoId O ID do atestado.
 * @param {number} index O índice do registro no array de histórico.
 */
async function editarHistoricoPsicossocial(atestadoId, index) {
    const atestado = __atestados_cache.find(a => a.id === atestadoId);
    if (!atestado || !atestado.investigacaoPsicossocial?.historico) {
        mostrarMensagem("Histórico não encontrado.", "error");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...atestado.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    const historico = historicoOrdenado[index];

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
    const atestadoRef = db.collection('atestados').doc(atestadoId);
    const atestadoDoc = await atestadoRef.get();
    
    if (!atestadoDoc.exists) {
        mostrarMensagem("Atestado não encontrado.", "error");
        return;
    }

    const data = atestadoDoc.data();
    if (!data.investigacaoPsicossocial || !Array.isArray(data.investigacaoPsicossocial.historico)) {
        mostrarMensagem("Histórico não encontrado.", "error");
        return;
    }

    const estagio = document.getElementById('psico-estagio').value;
    const observacoes = document.getElementById('psico-observacoes').value.trim();

    if (!estagio || !observacoes) {
        mostrarMensagem("Todos os campos são obrigatórios.", "warning");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...data.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    if (index < 0 || index >= historicoOrdenado.length) {
        mostrarMensagem("Índice inválido.", "error");
        return;
    }

    const itemAntigo = historicoOrdenado[index];
    const itemAtualizado = {
        ...itemAntigo,
        estagio: estagio,
        observacoes: observacoes,
        atualizadoEm: new Date(),
        atualizadoPor: firebase.auth().currentUser?.uid,
        atualizadoPorNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email
    };

    try {
        // Remove o item antigo e adiciona o atualizado
        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemAntigo)
        });

        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayUnion(itemAtualizado),
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.ultimaAtualizacao': firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Registro atualizado com sucesso!", "success");
        
        // Atualiza o cache local
        const atestadoIndex = __atestados_cache.findIndex(a => a.id === atestadoId);
        if (atestadoIndex !== -1) {
            __atestados_cache[atestadoIndex] = { 
                ...__atestados_cache[atestadoIndex],
                ...(await atestadoRef.get()).data() 
            };
        }

        // Restaura o botão ao estado normal
        const btnSalvar = document.querySelector('#acompanhamentoPsicossocialModal .btn-primary');
        btnSalvar.textContent = 'Salvar Acompanhamento';
        btnSalvar.onclick = salvarAcompanhamentoPsicossocial;

        // Fecha o modal e reabre para mostrar os dados atualizados
        bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal')).hide();
        await abrirModalAcompanhamentoPsicossocial(atestadoId);
        
    } catch (error) {
        console.error("Erro ao atualizar registro:", error);
        mostrarMensagem("Erro ao atualizar registro.", "error");
    }
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
    
    if (!atestadoDoc.exists) {
        mostrarMensagem("Atestado não encontrado.", "error");
        return;
    }

    const data = atestadoDoc.data();
    if (!data.investigacaoPsicossocial || !Array.isArray(data.investigacaoPsicossocial.historico)) {
        mostrarMensagem("Não há histórico para excluir.", "warning");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...data.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    if (index < 0 || index >= historicoOrdenado.length) {
        mostrarMensagem("Índice inválido.", "error");
        return;
    }

    const itemParaRemover = historicoOrdenado[index];

    try {
        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemParaRemover)
        });

        mostrarMensagem("Registro do histórico excluído.", "success");

        // Atualiza o cache local
        const atestadoIndex = __atestados_cache.findIndex(a => a.id === atestadoId);
        if (atestadoIndex !== -1) {
            __atestados_cache[atestadoIndex] = { 
                ...__atestados_cache[atestadoIndex],
                ...(await atestadoRef.get()).data() 
            };
        }

        await renderizarAtestados();
        const modal = bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal'));
        if (modal) modal.hide();
        
    } catch (error) {
        console.error("Erro ao excluir histórico:", error);
        mostrarMensagem("Erro ao excluir registro.", "error");
    }
}

/**
 * Preenche o formulário para editar um registro específico do histórico.
 * @param {string} atestadoId O ID do atestado.
 * @param {number} index O índice do registro no array de histórico.
 */
async function editarHistoricoPsicossocial(atestadoId, index) {
    const atestado = __atestados_cache.find(a => a.id === atestadoId);
    if (!atestado || !atestado.investigacaoPsicossocial?.historico) {
        mostrarMensagem("Histórico não encontrado.", "error");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...atestado.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    const historico = historicoOrdenado[index];

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
    const atestadoRef = db.collection('atestados').doc(atestadoId);
    const atestadoDoc = await atestadoRef.get();
    
    if (!atestadoDoc.exists) {
        mostrarMensagem("Atestado não encontrado.", "error");
        return;
    }

    const data = atestadoDoc.data();
    if (!data.investigacaoPsicossocial || !Array.isArray(data.investigacaoPsicossocial.historico)) {
        mostrarMensagem("Histórico não encontrado.", "error");
        return;
    }

    const estagio = document.getElementById('psico-estagio').value;
    const observacoes = document.getElementById('psico-observacoes').value.trim();

    if (!estagio || !observacoes) {
        mostrarMensagem("Todos os campos são obrigatórios.", "warning");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...data.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    if (index < 0 || index >= historicoOrdenado.length) {
        mostrarMensagem("Índice inválido.", "error");
        return;
    }

    const itemAntigo = historicoOrdenado[index];
    const itemAtualizado = {
        ...itemAntigo,
        estagio: estagio,
        observacoes: observacoes,
        atualizadoEm: new Date(),
        atualizadoPor: firebase.auth().currentUser?.uid,
        atualizadoPorNome: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email
    };

    try {
        // Remove o item antigo e adiciona o atualizado
        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemAntigo)
        });

        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayUnion(itemAtualizado),
            'investigacaoPsicossocial.estagio': estagio,
            'investigacaoPsicossocial.ultimaAtualizacao': firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Registro atualizado com sucesso!", "success");
        
        // Atualiza o cache local
        const atestadoIndex = __atestados_cache.findIndex(a => a.id === atestadoId);
        if (atestadoIndex !== -1) {
            __atestados_cache[atestadoIndex] = { 
                ...__atestados_cache[atestadoIndex],
                ...(await atestadoRef.get()).data() 
            };
        }

        // Restaura o botão ao estado normal
        const btnSalvar = document.querySelector('#acompanhamentoPsicossocialModal .btn-primary');
        btnSalvar.textContent = 'Salvar Acompanhamento';
        btnSalvar.onclick = salvarAcompanhamentoPsicossocial;

        // Fecha o modal e reabre para mostrar os dados atualizados
        bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal')).hide();
        await abrirModalAcompanhamentoPsicossocial(atestadoId);
        
    } catch (error) {
        console.error("Erro ao atualizar registro:", error);
        mostrarMensagem("Erro ao atualizar registro.", "error");
    }
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
    
    if (!atestadoDoc.exists) {
        mostrarMensagem("Atestado não encontrado.", "error");
        return;
    }

    const data = atestadoDoc.data();
    if (!data.investigacaoPsicossocial || !Array.isArray(data.investigacaoPsicossocial.historico)) {
        mostrarMensagem("Não há histórico para excluir.", "warning");
        return;
    }

    // Ordenar para pegar o item correto pelo índice
    const historicoOrdenado = [...data.investigacaoPsicossocial.historico].sort((a, b) => {
        const timeA = a.data?.seconds || 0;
        const timeB = b.data?.seconds || 0;
        return timeB - timeA; // Mais recente primeiro
    });

    if (index < 0 || index >= historicoOrdenado.length) {
        mostrarMensagem("Índice inválido.", "error");
        return;
    }

    const itemParaRemover = historicoOrdenado[index];

    try {
        await atestadoRef.update({
            'investigacaoPsicossocial.historico': firebase.firestore.FieldValue.arrayRemove(itemParaRemover)
        });

        mostrarMensagem("Registro do histórico excluído.", "success");

        // Atualiza o cache local
        const atestadoIndex = __atestados_cache.findIndex(a => a.id === atestadoId);
        if (atestadoIndex !== -1) {
            __atestados_cache[atestadoIndex] = { 
                ...__atestados_cache[atestadoIndex],
                ...(await atestadoRef.get()).data() 
            };
        }

        await renderizarAtestados();
        const modal = bootstrap.Modal.getInstance(document.getElementById('acompanhamentoPsicossocialModal'));
        if (modal) modal.hide();
        
    } catch (error) {
        console.error("Erro ao excluir histórico:", error);
        mostrarMensagem("Erro ao excluir registro.", "error");
    }
}

// =================================================================
// FUNÇÕES DE EXPORTAÇÃO
// =================================================================

async function exportarAtestadosExcel() {
    // Adiciona a biblioteca XLSX se não existir
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
        script.onload = () => exportarAtestadosExcel();
        document.head.appendChild(script);
        return;
    }

    const filtrados = aplicarFiltrosAtestados(__atestados_cache);

    if (filtrados.length === 0) {
        mostrarMensagem("Não há dados para exportar com os filtros atuais.", "warning");
        return;
    }

    const funcSnap = await db.collection('funcionarios').get();
    const funcMap = new Map(funcSnap.docs.map(doc => [doc.id, doc.data()]));

    const dadosExportacao = filtrados.map(a => {
        const func = funcMap.get(a.funcionarioId);
        return {
            'Colaborador': a.colaborador_nome,
            'Setor': func ? func.setor : 'N/A',
            'Data': formatarData(a.data_atestado),
            'Motivo': a.tipo,
            'Duracao': `${a.duracaoValor || a.dias} ${a.duracaoTipo || 'dias'}`,
            'CID': a.cid || ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atestados");

    // Ajustar largura das colunas
    ws['!cols'] = [
        { wch: 30 }, // Colaborador
        { wch: 20 }, // Setor
        { wch: 12 }, // Data
        { wch: 20 }, // Motivo
        { wch: 15 }, // Duração
        { wch: 10 }  // CID
    ];

    XLSX.writeFile(wb, "Relatorio_Atestados.xlsx");
    mostrarMensagem("Relatório de atestados exportado com sucesso!", "success");
}

// =================================================================
// FUNÇÕES DE ANÁLISE PSICOSSOCIAL
// =================================================================

/**
 * Calcula e renderiza os KPIs (indicadores) da seção psicossocial.
 * @param {Array} casos - A lista de casos psicossociais.
 */
function renderizarMetricasPsicossociais(casos) {
    const totalCasosEl = document.getElementById('psico-kpi-total-casos');
    const casosAbertosEl = document.getElementById('psico-kpi-casos-abertos');
    const mediaDiasEl = document.getElementById('psico-kpi-media-dias');

    if (!totalCasosEl || !casosAbertosEl || !mediaDiasEl) return;

    const totalCasos = casos.length;
    const casosAbertos = casos.filter(c => c.investigacaoPsicossocial?.estagio !== 'Caso Encerrado').length;
    
    const totalDias = casos.reduce((acc, caso) => acc + (caso.dias || 0), 0);
    const mediaDias = totalCasos > 0 ? (totalDias / totalCasos).toFixed(1) : '0.0';

    totalCasosEl.textContent = totalCasos;
    casosAbertosEl.textContent = casosAbertos;
    mediaDiasEl.textContent = mediaDias;
}

/**
 * Renderiza o gráfico de tendência de casos psicossociais ao longo do tempo.
 * @param {Array} casos - A lista de casos psicossociais.
 */
function renderizarGraficoTendenciaPsicossocial(casos) {
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
        const dataAtestado = parseDateSafe(caso.data_atestado);
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

    if (psicoChartInstance) {
        psicoChartInstance.destroy();
    }

    psicoChartInstance = new Chart(ctx, {
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

// =================================================================
// EXPORTAÇÃO DAS FUNÇÕES PARA O ESCOPO GLOBAL
// =================================================================

window.exportarAtestadosExcel = exportarAtestadosExcel;
window.atualizarDescricaoCID = atualizarDescricaoCID;
window.formatarInputCID = formatarInputCID;
window.getDataLocalISO = getDataLocalISO;
window.parseDataLocal = parseDataLocal;
window.formatarDataParaInput = formatarDataParaInput;
window.formatarHora = formatarHora;
window.verDetalhesAtestado = verDetalhesAtestado;
window.editarAtestado = editarAtestado;
window.excluirAtestado = excluirAtestado;
window.abrirModalAcompanhamentoPsicossocial = abrirModalAcompanhamentoPsicossocial;
window.salvarAcompanhamentoPsicossocial = salvarAcompanhamentoPsicossocial;
window.imprimirHistoricoPsicossocial = imprimirHistoricoPsicossocial;
window.editarHistoricoPsicossocial = editarHistoricoPsicossocial;
window.atualizarRegistroHistorico = atualizarRegistroHistorico;
window.excluirHistoricoPsicossocial = excluirHistoricoPsicossocial;
window.visualizarEncaminhamentoINSS = visualizarEncaminhamentoINSS;
window.abrirModalAtestado = abrirModalAtestado;
window.salvarAtestado = salvarAtestado;
window.inicializarAtestados = inicializarAtestados;
window.renderizarAtestados = renderizarAtestados;
window.atualizarMetricasAtestados = atualizarMetricasAtestados;