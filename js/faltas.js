// Faltas Diárias - Manhã/Tarde
let __faltas_cache = [];
let __faltas_empresas_cache = null;

/**
 * Obtém os nomes das empresas, usando um cache para evitar múltiplas leituras do Firestore.
 * @returns {Promise<Object>} Um objeto mapeando IDs de empresas para seus nomes.
 */
async function getEmpresasFaltas() {
    if (!__faltas_empresas_cache) {
        const snap = await db.collection('empresas').get();
        __faltas_empresas_cache = {};
        snap.forEach(d => __faltas_empresas_cache[d.id] = d.data().nome);
    }
    return __faltas_empresas_cache;
}

/**
 * Converte uma string de data (YYYY-MM-DD) para um objeto Date.
 * @param {string} dateStr - A string da data.
 * @returns {Date} O objeto Date.
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date(); // Retorna a data atual se a string for vazia ou nula
    // Garante que a data é válida antes de retornar
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) {
        // Fallback para formato YYYY-MM-DD se 'T00:00:00' não funcionar em todos os casos
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(); // Retorna hoje se a data for inválida
    }
    return date;
}

// Inicializar faltas
async function inicializarFaltas() {
    try {
        await preencherFiltrosFaltas();
        await carregarFaltas();
        
        const btnFiltro = document.getElementById('btn-falta-filtrar');
        if (btnFiltro && !btnFiltro.__bound) {
            btnFiltro.addEventListener('click', carregarFaltas);
            btnFiltro.__bound = true;
        }
        
        const btnNova = document.getElementById('btn-nova-falta');
        if (btnNova && !btnNova.__bound) {
            btnNova.addEventListener('click', abrirModalNovaFalta);
            btnNova.__bound = true;
        }
    } catch (e) { 
        console.error('Erro ao inicializar faltas:', e); 
    }
}

// Preencher filtros de faltas
async function preencherFiltrosFaltas() {
    try {
        const empSel = document.getElementById('falta-filtro-empresa');
        const setSel = document.getElementById('falta-filtro-setor');
        
        if (!empSel) return;
        
        empSel.innerHTML = '<option value="">Todas</option>';
        const snap = await db.collection('empresas').get();
        
        snap.forEach(doc => { 
            const o = document.createElement('option'); 
            o.value = doc.id; 
            o.textContent = doc.data().nome; 
            empSel.appendChild(o); 
        });
        
        // Data padrão hoje
        const dataInicioInput = document.getElementById('falta-filtro-data-inicio');
        const dataFimInput = document.getElementById('falta-filtro-data-fim');
        if (dataInicioInput && !dataInicioInput.value) {
            const hoje = new Date();
            const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataInicioInput.valueAsDate = primeiroDiaMes;
        }
        if (dataFimInput && !dataFimInput.value) dataFimInput.valueAsDate = new Date();

        
        // Popular setores quando empresa mudar
        if (empSel && setSel) {
            empSel.addEventListener('change', async function() {
                setSel.innerHTML = '<option value="">Todos</option>';
                const id = this.value;
                if (!id) return;
                
                const edoc = await db.collection('empresas').doc(id).get();
                const setores = Array.isArray(edoc.data()?.setores) ? edoc.data().setores : [];
                setores.forEach(s => { 
                    const o = document.createElement('option'); 
                    o.value = s; 
                    o.textContent = s; 
                    setSel.appendChild(o); 
                });
            });
        }
        
        // Configurar restrição de setor se aplicável
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            if (setSel) {
                setSel.value = currentUserPermissions.restricaoSetor;
                setSel.disabled = true;
            }
            if (empSel) {
                empSel.disabled = true;
            }
        }
    } catch (e) { 
        console.error('Erro ao preencher filtros de faltas:', e); 
    }
}

// Carregar faltas
async function carregarFaltas() {
    try {
        const tbody = document.getElementById('faltas-container');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
        
        const dataInicioStr = document.getElementById('falta-filtro-data-inicio')?.value || '';
        const dataFimStr = document.getElementById('falta-filtro-data-fim')?.value || '';
        const empId = document.getElementById('falta-filtro-empresa')?.value || '';
        const periodo = document.getElementById('falta-filtro-periodo')?.value || '';
        const setor = document.getElementById('falta-filtro-setor')?.value || '';
        
        let query = db.collection('faltas').orderBy('data', 'desc');

        // Aplicação da regra de acesso
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            // Se o usuário tem um setor restrito, força a query para esse setor
            query = query.where('setor', '==', currentUserPermissions.restricaoSetor);
        } else if (setor) {
            // Se for admin ou não tiver restrição, mas filtrou por setor
            query = query.where('setor', '==', setor);
        }

        // Filtro por intervalo de data (aplicado para todos)
        if (dataInicioStr) {
            const ini = parseDate(dataInicioStr);
            ini.setHours(0, 0, 0, 0);
            query = query.where('data', '>=', ini);
        }
        if (dataFimStr) {
            const fim = parseDate(dataFimStr);
            fim.setHours(23, 59, 59, 999);
            query = query.where('data', '<=', fim);
        }
        
        // Filtros adicionais
        if (empId) query = query.where('empresaId', '==', empId);
        if (periodo) query = query.where('periodo', '==', periodo);
        
        const snap = await query.get();
        const registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const empMap = await getEmpresasFaltas();
        
        if (registros.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sem faltas para os filtros</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = '';
        registros.forEach(f => {
            // CORREÇÃO: Garante que dataObj seja um objeto Date válido, mesmo se f.data for uma string.
            const dataObj = f.data?.toDate ? f.data.toDate() :
                          (f.data instanceof Date ? f.data : new Date(f.data || Date.now())); // Fallback para data atual se f.data for nulo
            const tr = document.createElement('tr');
            
            // Cria células manualmente para evitar XSS
            const tdData = document.createElement('td');
            tdData.textContent = formatarData(dataObj);
            
            const tdNome = document.createElement('td');
            tdNome.textContent = f.funcionarioNome || '-';
            
            const tdEmpresaSetor = document.createElement('td');
            tdEmpresaSetor.textContent = (empMap[f.empresaId] || '-') + ' / ' + (f.setor || '-');
            
            const tdPeriodo = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'badge ' + (f.periodo === 'manha' ? 'bg-info' : 'bg-primary');
            badge.textContent = f.periodo === 'manha' ? 'Manhã' : 'Tarde';
            tdPeriodo.appendChild(badge);
            
            const tdJustificativa = document.createElement('td');
            tdJustificativa.textContent = f.justificativa || '-';
            
            const tdAcoes = document.createElement('td');
            tdAcoes.className = 'text-end';
            const btnGroup = document.createElement('div');
            btnGroup.className = 'btn-group btn-group-sm';
            const btnExcluir = document.createElement('button');
            btnExcluir.className = 'btn btn-outline-danger';
            btnExcluir.innerHTML = '<i class="fas fa-trash"></i>';
            btnExcluir.onclick = () => excluirFalta(f.id);
            btnGroup.appendChild(btnExcluir);
            tdAcoes.appendChild(btnGroup);
            
            tr.appendChild(tdData);
            tr.appendChild(tdNome);
            tr.appendChild(tdEmpresaSetor);
            tr.appendChild(tdPeriodo);
            tr.appendChild(tdJustificativa);
            tr.appendChild(tdAcoes);
            
            tbody.appendChild(tr);
        });

        // Após carregar a tabela principal, verifica as faltas recorrentes
        await verificarFaltasRecorrentes();
    } catch (e) { 
        console.error('Erro ao carregar faltas:', e);
        mostrarMensagem('Erro ao carregar faltas', 'error');
        
        // Verifica se é um erro comum de falta de índice no Firestore
        if (e.message && e.message.includes('index')) {
            mostrarMensagem('Índice composto ausente no Firestore. Verifique o console para o link de criação do índice.', 'warning');
        }
    }
}

// Abrir modal de nova falta
function abrirModalNovaFalta() {
    const id = 'faltaModal';
    let modalEl = document.getElementById(id);
    
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = id;
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Registrar Falta</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-2">
                            <label class="form-label">Colaborador</label>
                            <select class="form-select" id="falta_func"></select>
                        </div>
                        <div class="row g-2">
                            <div class="col-6">
                                <label class="form-label">Data</label>
                                <input type="date" class="form-control" id="falta_data">
                            </div>
                            <div class="col-6">
                                <label class="form-label">Período</label>
                                <select class="form-select" id="falta_periodo">
                                    <option value="manha">Manhã</option>
                                    <option value="tarde">Tarde</option>
                                </select>
                            </div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Justificativa (opcional)</label>
                            <textarea class="form-control" id="falta_just" rows="2"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-primary" id="btn-salvar-falta">Salvar</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    // Popular funcionários
    (async () => {
        const sel = document.getElementById('falta_func'); 
        if (!sel) return;
        
        sel.innerHTML = '<option value="">Selecione</option>';
        
        // Aplicar filtro de setor se houver restrição
        let fquery = db.collection('funcionarios').where('status', '==', 'Ativo');
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            fquery = fquery.where('setor', '==', currentUserPermissions.restricaoSetor);
        }
        
        const fsnap = await fquery.orderBy('nome').get();
        
        fsnap.forEach(d => { 
            const f = d.data(); 
            const o = document.createElement('option'); 
            o.value = d.id; 
            o.textContent = f.nome; 
            sel.appendChild(o); 
        });
        
        const d = document.getElementById('falta_data'); 
        if (d) {
            d.value = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
        }
        const btnSalvar = document.getElementById('btn-salvar-falta');
        if (btnSalvar) {
            btnSalvar.onclick = salvarFalta;
        }
    })();
    
    new bootstrap.Modal(modalEl).show();
}

// Salvar falta
async function salvarFalta() {
    try {        
        const funcId = document.getElementById('falta_func').value;
        const dataStr = document.getElementById('falta_data').value;
        const periodo = document.getElementById('falta_periodo').value;
        const justificativa = document.getElementById('falta_just').value.trim();
        
        if (!funcId || !dataStr || !periodo) { 
            mostrarMensagem('Preencha colaborador, data e período', 'warning'); 
            return; 
        }
        
        const fdoc = await db.collection('funcionarios').doc(funcId).get();
        const f = fdoc.data();
        
        await db.collection('faltas').add({
            funcionarioId: funcId,
            funcionarioNome: f?.nome || null,
            empresaId: f?.empresaId || null,
            setor: f?.setor || null,
            data: parseDate(dataStr),
            periodo: periodo,
            justificativa: justificativa || null,
            criado_em: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null
        });
        
        // Invalida cache de empresas após salvar falta
        __faltas_empresas_cache = null;

        const modalEl = document.getElementById('faltaModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        await carregarFaltas();
        mostrarMensagem('Falta registrada com sucesso!');
    } catch (e) { 
        console.error('Erro ao salvar falta:', e); 
        mostrarMensagem('Erro ao salvar falta', 'error'); 
    }
}

// Excluir falta
async function excluirFalta(id) {
    if (!confirm('Confirma excluir a falta?')) return;
    
    try { 
        // Invalida cache de empresas antes de excluir falta
        __faltas_empresas_cache = null;

        await db.collection('faltas').doc(id).delete(); 
        await carregarFaltas(); 
        mostrarMensagem('Falta excluída com sucesso!'); 
    } catch(e) { 
        console.error('Erro ao excluir falta:', e); 
        mostrarMensagem('Erro ao excluir falta', 'error'); 
    }
}

// Imprimir relatório de faltas
async function imprimirRelatorioFaltas() {
    try {
        const tipoRel = document.getElementById('falta-tipo-relatorio')?.value || 'diario';
        const dataInicioStr = document.getElementById('falta-filtro-data-inicio')?.value || '';
        const dataFimStr = document.getElementById('falta-filtro-data-fim')?.value || '';
        const empId = document.getElementById('falta-filtro-empresa')?.value || '';
        const periodo = document.getElementById('falta-filtro-periodo')?.value || '';
        const setor = document.getElementById('falta-filtro-setor')?.value || '';
        
        let tipoRelatorio = '';
        let periodoTexto = '';
        let query = db.collection('faltas');
        
        // Aplicar restrição de setor se houver
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            query = query.where('setor', '==', currentUserPermissions.restricaoSetor);
        }
        
        if (tipoRel === 'diario') {
            tipoRelatorio = 'Diário';
            if (dataInicioStr) {
                const data = parseDate(dataInicioStr);
                periodoTexto = `Período de ${data.toLocaleDateString('pt-BR')}`;
                if (dataFimStr && dataFimStr !== dataInicioStr) {
                    periodoTexto += ` até ${parseDate(dataFimStr).toLocaleDateString('pt-BR')}`;
                }
                const ini = parseDate(dataInicioStr); 
                ini.setHours(0,0,0,0);
                query = query.where('data', '>=', ini);
            }
            if (dataFimStr) {
                const fim = parseDate(dataFimStr); 
                fim.setHours(23,59,59,999);
                query = query.where('data', '<=', fim);
            }
        } else if (tipoRel === 'mensal') {
            tipoRelatorio = 'Mensal';
            const hoje = new Date();
            periodoTexto = `Mês: ${hoje.getMonth() + 1}/${hoje.getFullYear()}`;
            const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            fim.setHours(23,59,59,999);
            query = query.where('data', '>=', ini).where('data', '<=', fim);
        } else if (tipoRel === 'geral') {
            tipoRelatorio = 'Geral';
            periodoTexto = 'Todos os períodos';
        } else if (tipoRel === 'setor') {
            tipoRelatorio = 'Por Setor';
            periodoTexto = 'Agrupado por setor';
        }
        
        // Aplicar filtros adicionais apenas se não houver restrição de setor
        if (!(currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin)) {
            if (empId) query = query.where('empresaId', '==', empId);
            if (periodo) query = query.where('periodo', '==', periodo);
        }
        
        let snap;
        if (tipoRel === 'geral' || tipoRel === 'setor') {
            if (empId || periodo) {
                snap = await query.orderBy('data', 'desc').get();
            } else {
                snap = await query.orderBy('data', 'desc').get();
            }
        } else {
            snap = await query.orderBy('data', 'desc').get();
        }
        
        let registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Aplicar filtro de setor no cliente se necessário
        if (setor && !(currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin)) {
            registros = registros.filter(r => (r.setor || '') === setor);
        }
        
        // Obter nomes de empresas
        const empMap = await getEmpresasFaltas();

        // Agrupar por setor se tipo for "setor"
        const agruparPorSetor = (tipoRel === 'setor');
        let dadosAgrupados = {};
        
        if (agruparPorSetor && registros.length > 0) {
            registros.forEach(f => {
                const empNome = empMap[f.empresaId] || '—';
                const setorNome = f.setor || '—';
                const chave = `${empNome} - ${setorNome}`;
                
                if (!dadosAgrupados[chave]) {
                    dadosAgrupados[chave] = { empresa: empNome, setor: setorNome, faltas: [] };
                }
                dadosAgrupados[chave].faltas.push(f);
            });
        }
        
        // Montar HTML
        let html = '<html><head><title>Relatório de Faltas</title>' +
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css">' +
            '<style>@page{size: landscape; margin: 0;}body{font-family:Inter,Segoe UI,sans-serif;padding:20px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid #dee2e6;padding-bottom:15px}.table thead th{background:#f8f9fa;font-weight:600}.badge{font-size:.75rem;padding:.35em .65em}.info-box{background:#e7f3ff;border-left:4px solid #0d6efd;padding:12px;margin-bottom:20px} @media print { body { margin: 1cm; } }</style>' +
            '</head><body>';
        
        html += '<div class="header">' +
            '<div><h4 class="m-0">Relatório de Faltas - ' + tipoRelatorio + '</h4>' +
            '<small class="text-muted">' + periodoTexto;
            
        if (empId) html += ' | Empresa: ' + (empMap[empId] || '—');
        if (setor) html += ' | Setor: ' + setor;
        if (periodo) html += ' | Período: ' + (periodo === 'manha' ? 'Manhã' : 'Tarde');
        
        html += '</small></div>' +  // FECHA A STRING CORRETAMENTE
            '<small class="text-muted">Gerado em: ' + new Date().toLocaleString('pt-BR') + '</small>' +
            '</div>';
        
        if (agruparPorSetor && Object.keys(dadosAgrupados).length > 0) {
            // Relatório agrupado por setor
            Object.keys(dadosAgrupados).forEach(chave => {
                const grupo = dadosAgrupados[chave];
                html += '<div class="mb-4">' +
                    '<h5>' + grupo.empresa + ' - Setor: ' + grupo.setor + '</h5>' +
                    '<table class="table table-sm table-bordered">' +
                    '<thead><tr><th>Data</th><th>Colaborador</th><th>Período</th><th>Justificativa</th></tr></thead><tbody>';
                    
                grupo.faltas.forEach(f => {
                    const dataObj = f.data?.toDate ? f.data.toDate() : f.data;
                    html += '<tr>' +
                        '<td>' + formatarData(dataObj) + '</td>' +
                        '<td>' + (f.funcionarioNome || '—') + '</td>' +
                        '<td><span class="badge ' + (f.periodo === 'manha' ? 'bg-info' : 'bg-primary') + '">' + (f.periodo === 'manha' ? 'Manhã' : 'Tarde') + '</span></td>' +
                        '<td>' + (f.justificativa || '—') + '</td>' +
                        '</tr>';
                });
                
                html += '</tbody></table><p class="text-muted"><strong>Total:</strong> ' + grupo.faltas.length + ' falta(s)</p></div>';
            });
        } else {
            // Relatório simples
            html += '<table class="table table-sm table-bordered">' +
                '<thead><tr><th>Data</th><th>Colaborador</th><th>Empresa</th><th>Setor</th><th>Período</th><th>Justificativa</th></tr></thead><tbody>';
                
            registros.forEach(f => {
                const dataObj = f.data?.toDate ? f.data.toDate() : f.data;
                html += '<tr>' +
                    '<td>' + formatarData(dataObj) + '</td>' +
                    '<td>' + (f.funcionarioNome || '—') + '</td>' +
                    '<td>' + (empMap[f.empresaId] || '—') + '</td>' +
                    '<td>' + (f.setor || '—') + '</td>' +
                    '<td><span class="badge ' + (f.periodo === 'manha' ? 'bg-info' : 'bg-primary') + '">' + (f.periodo === 'manha' ? 'Manhã' : 'Tarde') + '</span></td>' +
                    '<td>' + (f.justificativa || '—') + '</td>' +
                    '</tr>';
            });
            
            html += '</tbody></table>';
            html += '<div class="info-box mt-3"><strong>Total de faltas:</strong> ' + registros.length + '</div>';
        }
        
        html += '</body></html>';
        
        // Abrir janela de impressão via utilitário
        openPrintWindow(html, { autoPrint: true, name: '_blank' });
        
    } catch (e) {
        console.error('Erro ao gerar relatório de faltas:', e);
        mostrarMensagem('Erro ao gerar relatório de faltas', 'error');
    }
}

/**
 * Verifica e exibe um alerta para funcionários com mais de 2 faltas nos últimos 30 dias.
 */
async function verificarFaltasRecorrentes() {
    const alertaContainer = document.getElementById('alerta-faltas-recorrentes');
    const detalhesContainer = document.getElementById('faltas-recorrentes-container');

    if (!alertaContainer || !detalhesContainer) {
        console.warn('Elementos do dashboard de alerta de faltas não encontrados.');
        return;
    }

    try {
        const hoje = new Date();
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);

        let query = db.collection('faltas').where('data', '>=', trintaDiasAtras);

        // Aplica restrição de setor se o usuário não for admin
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            query = query.where('setor', '==', currentUserPermissions.restricaoSetor);
        }

        const snap = await query.get();
        const faltas = snap.docs.map(doc => doc.data());

        const contagemPorFuncionario = faltas.reduce((acc, falta) => {
            if (falta.funcionarioId) {
                if (!acc[falta.funcionarioId]) {
                    acc[falta.funcionarioId] = { nome: falta.funcionarioNome, count: 0 };
                }
                acc[falta.funcionarioId].count++;
            }
            return acc;
        }, {});

        const recorrentes = Object.values(contagemPorFuncionario).filter(f => f.count > 2);

        if (recorrentes.length > 0) {
            detalhesContainer.innerHTML = recorrentes
                .sort((a, b) => b.count - a.count) // Ordena por quem tem mais faltas
                .map(func => `
                    <div class="alert alert-light p-2 mb-2 d-flex justify-content-between align-items-center">
                        <span><i class="fas fa-user-circle me-2"></i>${func.nome}</span>
                        <span class="badge bg-danger">${func.count} faltas</span>
                    </div>
                `).join('');
            alertaContainer.style.display = 'block';
        } else {
            detalhesContainer.innerHTML = '<p class="text-muted">Nenhum funcionário com mais de 2 faltas no período.</p>';
            alertaContainer.style.display = 'none';
        }

    } catch (error) {
        console.error("Erro ao verificar faltas recorrentes:", error);
        detalhesContainer.innerHTML = '<p class="text-danger">Erro ao carregar dados de alerta.</p>';
        alertaContainer.style.display = 'block';
    }
}