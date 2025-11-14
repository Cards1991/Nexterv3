// Atestados - integração com Firestore + filtros e métricas
let __atestados_cache = [];

// Inicializar atestados
async function inicializarAtestados() {
    try {
        await carregarAtestadosDb();
        await carregarAlertasPericia(); // Carrega o novo dashboard de alertas
        await preencherFiltroEmpresasAtestados();
        await renderizarAtestados();
        atualizarMetricasAtestados();
        
        const btnFiltrar = document.getElementById('btn-filtrar-atestados');
        if (btnFiltrar && !btnFiltrar.__bound) {
            btnFiltrar.addEventListener('click', () => { 
                renderizarAtestados(); 
                atualizarMetricasAtestados(); 
            });
            btnFiltrar.__bound = true;
        }
        
        const btnNovo = document.getElementById('btn-novo-atestado');
        if (btnNovo && !btnNovo.__bound) {
            btnNovo.addEventListener('click', abrirModalNovoAtestado);
            btnNovo.__bound = true;
        }
    } catch (e) { 
        console.error('Erro ao inicializar atestados:', e); 
    }
}

// Carregar atestados do banco
async function carregarAtestadosDb() {
    try {
        const snap = await db.collection('atestados').orderBy('data_atestado', 'desc').get();
        __atestados_cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('Erro ao carregar atestados do banco:', e);
        throw e;
    }
}

// Preencher filtro de empresas
async function preencherFiltroEmpresasAtestados() {
    try {
        const select = document.getElementById('filtro-empresa-atestados');
        if (!select) return;
        
        const empSnap = await db.collection('empresas').get();
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
    
    return lista.filter(a => (
        (!emp || a.empresaId === emp) &&
        (!tipo || a.tipo === tipo) &&
        (!status || a.status === status) &&
        (!dataInicio || a.data_atestado.toDate() >= new Date(dataInicio)) &&
        (!dataFim || a.data_atestado.toDate() <= new Date(new Date(dataFim).setHours(23, 59, 59, 999)))
    ));
}

// Renderizar atestados na tabela
async function renderizarAtestados() {
    try {
        const tbody = document.getElementById('atestados-container');
        const totalEl = document.getElementById('total-atestados');
        
        if (!tbody) return;
        
        const filtrados = aplicarFiltrosAtestados(__atestados_cache);
        
        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum atestado encontrado</td></tr>';
            if (totalEl) totalEl.textContent = '0 registros';
            return;
        }
        
        // Obter nomes de empresas
        const empSnap = await db.collection('empresas').get();
        const empMap = {};
        empSnap.forEach(d => empMap[d.id] = d.data().nome);
        
        tbody.innerHTML = filtrados.map(a => {
            let acoesHTML = `
                <button class="btn btn-outline-primary" onclick="verDetalhesAtestado('${a.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-outline-secondary" onclick="editarAtestado('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline-danger" onclick="excluirAtestado('${a.id}')"><i class="fas fa-trash"></i></button>
            `;

            // Se o atestado gerou um encaminhamento, adiciona o botão para ver os detalhes
            if (a.encaminhadoINSS && a.afastamentoId) {
                acoesHTML += `<button class="btn btn-outline-warning" title="Ver Encaminhamento ao INSS" onclick="visualizarEncaminhamentoINSS('${a.afastamentoId}')"><i class="fas fa-notes-medical"></i></button>`;
            }

            return `
            <tr class="${a.encaminhadoINSS ? 'table-warning' : ''}">
                <td>${a.colaborador_nome}</td>
                <td><span class="badge bg-light text-dark">${empMap[a.empresaId] || '-'}</span></td>
                <td>${formatarData(a.data_atestado)}</td>
                <td><span class="badge ${a.dias > 3 ? 'bg-warning' : 'bg-info'}">${a.dias}</span></td>
                <td><span class="badge ${classeTipo(a.tipo)}">${a.tipo}</span></td>
                <td>${a.cid || '-'}</td>
                <td><small>${a.medico || '-'}</small></td>
                <td><span class="badge ${classeStatus(a.status)}">${a.status}</span></td>
                <td class="text-end text-nowrap">
                    <div class="btn-group btn-group-sm">
                        ${acoesHTML}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
        
        if (totalEl) totalEl.textContent = `${filtrados.length} registros`;
    } catch (e) {
        console.error('Erro ao renderizar atestados:', e);
    }
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
    try {
        const filtrados = aplicarFiltrosAtestados(__atestados_cache);
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const atestMes = filtrados.filter(a => {
            const dataAtestado = a.data_atestado?.toDate ? a.data_atestado.toDate() : a.data_atestado;
            return dataAtestado >= inicioMes;
        }).length;
        
        const totalDias = filtrados.reduce((s, a) => s + (a.dias || 0), 0);
        const media = filtrados.length ? (totalDias / filtrados.length).toFixed(1) : 0;
        
        // --- NOVO CÁLCULO DE CUSTO ---
        let custoTotal = 0;
        if (filtrados.length > 0) {
            // 1. Criar um mapa de funcionários e seus salários para consulta rápida
            const funcionariosSnap = await db.collection('funcionarios').get();
            const salariosMap = new Map();
            funcionariosSnap.forEach(doc => {
                const data = doc.data();
                if (data.salario) {
                    salariosMap.set(doc.id, data.salario);
                }
            });

            // 2. Calcular o custo para cada atestado
            custoTotal = filtrados.reduce((total, atestado) => {
                const salario = salariosMap.get(atestado.funcionarioId);
                if (salario && atestado.dias) {
                    const valorHora = salario / 220;
                    const horasAtestado = atestado.dias * 8; // Assumindo 8 horas por dia
                    return total + (valorHora * horasAtestado);
                }
                return total;
            }, 0);
        }
        // --- FIM DO NOVO CÁLCULO ---

        const totalAtestadosMes = document.getElementById('total-atestados-mes');
        const totalDiasAtestados = document.getElementById('total-dias-atestados');
        const mediaDiasAtestado = document.getElementById('media-dias-atestado');
        const custoTotalAtestados = document.getElementById('custo-total-atestados');
        
        if (totalAtestadosMes) totalAtestadosMes.textContent = atestMes;
        if (totalDiasAtestados) totalDiasAtestados.textContent = totalDias;
        if (mediaDiasAtestado) mediaDiasAtestado.textContent = media;
        if (custoTotalAtestados) custoTotalAtestados.textContent = `R$ ${custoTotal.toFixed(2).replace('.', ',')}`;
        
        // Percentual de afastamento (simplificado)
        const percentualAfastamento = document.getElementById('percentual-afastamento');
        if (percentualAfastamento) {
            percentualAfastamento.textContent = filtrados.length > 0 ? '—' : '0%';
        }
    } catch (e) {
        console.error('Erro ao atualizar métricas de atestados:', e);
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
                                <div class="col-6">
                                    <label class="form-label">Data</label>
                                    <input type="date" class="form-control" id="at_data" required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Dias</label>
                                    <input type="number" min="1" class="form-control" id="at_dias" required>
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
    
    // Popular empresas no select do modal
    (async () => {
        const select = document.getElementById('at_empresa');
        if (select) {
            select.innerHTML = '<option value="">Selecione</option>';
            const empSnap = await db.collection('empresas').get();
            
            empSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().nome;
                select.appendChild(opt);
            });
        }
        
        // Data padrão
        const dataInput = document.getElementById('at_data');
        if (dataInput) dataInput.valueAsDate = new Date();

        // Popular funcionários
        const funcSelect = document.getElementById('at_colab');
        if (funcSelect) {
            const funcSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
            funcSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.dataset.empresaId = doc.data().empresaId || '';
                opt.textContent = doc.data().nome;
                funcSelect.appendChild(opt);
            });
        }
        
    })();
    
    new bootstrap.Modal(modalEl).show();
}

// Salvar novo atestado
async function salvarNovoAtestado() {
    try {
        const colabSelect = document.getElementById('at_colab');
        const colabNome = colabSelect.options[colabSelect.selectedIndex].text;
        const empId = document.getElementById('at_empresa').value;
        const data = document.getElementById('at_data').value;
        const dias = parseInt(document.getElementById('at_dias').value, 10);
        const tipo = document.getElementById('at_tipo').value;
        const cid = document.getElementById('at_cid').value.trim();
        const medico = document.getElementById('at_medico').value.trim();
        
        if (!colabSelect.value || !empId || !data || !dias || !tipo) { 
            mostrarMensagem('Preencha os campos obrigatórios', 'warning'); 
            return; 
        }
        
        let afastamentoId = null;

        // =====================================================================
        // NOVA LÓGICA: VERIFICAR SE O ATESTADO DEVE VIRAR AFASTAMENTO (INSS)
        // =====================================================================
        const sessentaDiasAtras = new Date(data);
        sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60);

        // Buscar todos os atestados anteriores para este funcionário nos últimos 60 dias
        const atestadosAnterioresSnap = await db.collection('atestados')
            .where('funcionarioId', '==', colabSelect.value)
            .where('data_atestado', '>=', sessentaDiasAtras)
            .get();

        let diasAcumuladosTotal = dias; // Soma total de dias de atestado (qualquer CID)
        let diasAcumuladosMesmoCID = dias; // Soma de dias para o CID atual

        atestadosAnterioresSnap.forEach(doc => {
            const atestadoAnterior = doc.data();
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
                data_inicio: new Date(data.replace(/-/g, '\/')),
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
            data_atestado: new Date(data.replace(/-/g, '\/')),
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
        await carregarAlertasPericia();
        renderizarAtestados();
        atualizarMetricasAtestados();
        mostrarMensagem('Atestado cadastrado com sucesso!');
    } catch (e) {
        console.error('Erro ao salvar atestado:', e);
        mostrarMensagem('Erro ao salvar atestado', 'error');
    }
}

// Ver detalhes do atestado
function verDetalhesAtestado(id) {
    const a = __atestados_cache.find(x => x.id === id);
    if (!a) return;
    
    // Carregar nome da empresa
    let empresaNome = 'Empresa não encontrada';
    if (a.empresaId) {
        db.collection('empresas').doc(a.empresaId).get()
            .then(doc => {
                if (doc.exists) {
                    empresaNome = doc.data().nome;
                }
                exibirDetalhesAtestado(a, empresaNome);
            })
            .catch(() => {
                exibirDetalhesAtestado(a, empresaNome);
            });
    } else {
        exibirDetalhesAtestado(a, empresaNome);
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
                <p><strong>Dias:</strong> ${a.dias}</p>
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
    new bootstrap.Modal(modalEl).show();
}

// Editar atestado
async function editarAtestado(id) {
    const a = __atestados_cache.find(x => x.id === id);
    if (!a) return;
    
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
    
    new bootstrap.Modal(modalEl).show();
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