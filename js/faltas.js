// Faltas Diárias - Manhã/Tarde
let __faltas_cache = [];
let __faltas_empresas_cache = null;
let __falta_em_edicao_id = null;

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
            btnNova.addEventListener('click', () => abrirModalNovaFalta());
            btnNova.__bound = true;

            // Injetar botão de replicar faltas
            if (!document.getElementById('btn-replicar-faltas')) {
                const btnReplicar = document.createElement('button');
                btnReplicar.id = 'btn-replicar-faltas';
                btnReplicar.className = 'btn btn-warning me-2';
                btnReplicar.innerHTML = '<i class="fas fa-copy"></i> Replicar Manhã -> Tarde';
                btnReplicar.onclick = replicarFaltasManhaTarde;
                btnNova.parentNode.insertBefore(btnReplicar, btnNova);
            }

            // Injetar botão de exportar Excel
            if (!document.getElementById('btn-exportar-faltas')) {
                const btnExportar = document.createElement('button');
                btnExportar.id = 'btn-exportar-faltas';
                btnExportar.className = 'btn btn-success me-2';
                btnExportar.innerHTML = '<i class="fas fa-file-excel"></i> Excel';
                btnExportar.onclick = exportarFaltasExcel;
                btnNova.parentNode.insertBefore(btnExportar, btnNova);
            }
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
        
        // Atualiza cache global para uso na exportação e dashboard
        __faltas_cache = registros;

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
            
            const btnEditar = document.createElement('button');
            btnEditar.className = 'btn btn-outline-primary';
            btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
            btnEditar.onclick = () => editarFalta(f.id);
            btnGroup.appendChild(btnEditar);

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
        renderizarDashboardAnaliseFaltas(registros, empMap);
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
async function abrirModalNovaFalta(faltaId = null) {
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
    
    const btnSalvar = document.getElementById('btn-salvar-falta');
    if (btnSalvar) btnSalvar.onclick = salvarFalta;

    await popularSelectFuncionariosFalta();

    const modalTitle = modalEl.querySelector('.modal-title');
    const formFields = {
        func: document.getElementById('falta_func'),
        data: document.getElementById('falta_data'),
        periodo: document.getElementById('falta_periodo'),
        just: document.getElementById('falta_just')
    };

    if (faltaId) {
        __falta_em_edicao_id = faltaId;
        modalTitle.textContent = 'Editar Falta';
        btnSalvar.textContent = 'Atualizar';

        try {
            const doc = await db.collection('faltas').doc(faltaId).get();
            if (doc.exists) {
                const data = doc.data();
                formFields.func.value = data.funcionarioId;
                const dateObj = data.data?.toDate ? data.data.toDate() : new Date(data.data);
                formFields.data.value = dateObj.toISOString().split('T')[0];
                formFields.periodo.value = data.periodo;
                formFields.just.value = data.justificativa || '';
            }
        } catch (e) {
            console.error('Erro ao carregar falta para edição:', e);
            mostrarMensagem('Erro ao carregar dados.', 'error');
            return;
        }
    } else {
        __falta_em_edicao_id = null;
        modalTitle.textContent = 'Registrar Falta';
        btnSalvar.textContent = 'Salvar';
        
        formFields.func.value = '';
        formFields.data.value = new Date().toISOString().split('T')[0];
        formFields.periodo.value = 'manha';
        formFields.just.value = '';
    }
    
    new bootstrap.Modal(modalEl).show();
}

async function popularSelectFuncionariosFalta() {
    const sel = document.getElementById('falta_func'); 
    if (!sel || sel.options.length > 1) return;
    
    sel.innerHTML = '<option value="">Selecione</option>';
    
    let fquery = db.collection('funcionarios').where('status', '==', 'Ativo');
    if (currentUserPermissions && currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
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
        
        const faltaData = {
            funcionarioId: funcId,
            funcionarioNome: f?.nome || null,
            empresaId: f?.empresaId || null,
            setor: f?.setor || null,
            data: parseDate(dataStr),
            periodo: periodo,
            justificativa: justificativa || null
        };

        if (__falta_em_edicao_id) {
            // Atualizar
            await db.collection('faltas').doc(__falta_em_edicao_id).update(faltaData);
            mostrarMensagem('Falta atualizada com sucesso!');
        } else {
            // Criar nova
            faltaData.criado_em = firebase.firestore.FieldValue.serverTimestamp();
            faltaData.createdByUid = firebase.auth().currentUser?.uid || null;
            await db.collection('faltas').add(faltaData);
            mostrarMensagem('Falta registrada com sucesso!');
        }
        
        // Invalida cache de empresas após salvar falta
        __faltas_empresas_cache = null;

        const modalEl = document.getElementById('faltaModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        await carregarFaltas();
    } catch (e) { 
        console.error('Erro ao salvar falta:', e); 
        mostrarMensagem('Erro ao salvar falta', 'error'); 
    }
}

function editarFalta(id) {
    abrirModalNovaFalta(id);
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

async function replicarFaltasManhaTarde() {
    const dataStr = document.getElementById('falta-filtro-data-inicio')?.value;
    if (!dataStr) {
        mostrarMensagem('Selecione uma data no filtro "Data Inicial" para replicar.', 'warning');
        return;
    }
    
    const dataAlvo = parseDate(dataStr);
    dataAlvo.setHours(0,0,0,0);
    
    const dataFim = new Date(dataAlvo);
    dataFim.setHours(23,59,59,999);

    if (!confirm(`Deseja replicar as faltas do período da MANHÃ para a TARDE do dia ${formatarData(dataAlvo)}?`)) {
        return;
    }

    try {
        // Buscar todas as faltas do dia (evita necessidade de índice composto no Firestore)
        const diaSnap = await db.collection('faltas')
            .where('data', '>=', dataAlvo)
            .where('data', '<=', dataFim)
            .get();

        if (diaSnap.empty) {
            mostrarMensagem('Nenhuma falta encontrada para esta data.', 'info');
            return;
        }

        // Separar em memória
        const faltasManha = [];
        const funcionariosComFaltaTarde = new Set();

        diaSnap.forEach(doc => {
            const f = doc.data();
            if (f.periodo === 'manha') {
                faltasManha.push({ id: doc.id, ...f });
            } else if (f.periodo === 'tarde') {
                funcionariosComFaltaTarde.add(f.funcionarioId);
            }
        });

        if (faltasManha.length === 0) {
            mostrarMensagem('Nenhuma falta encontrada no período da manhã para esta data.', 'info');
            return;
        }

        const batch = db.batch();
        let count = 0;

        faltasManha.forEach(faltaManha => {
            if (!funcionariosComFaltaTarde.has(faltaManha.funcionarioId)) {
                const novaFaltaRef = db.collection('faltas').doc();
                // Remove o id que foi adicionado no objeto local para não salvar no banco
                const { id, ...dadosFalta } = faltaManha;
                
                batch.set(novaFaltaRef, {
                    ...dadosFalta,
                    periodo: 'tarde',
                    criado_em: firebase.firestore.FieldValue.serverTimestamp(),
                    replicadoDe: faltaManha.id
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            mostrarMensagem(`${count} faltas replicadas para o período da tarde com sucesso!`, 'success');
            await carregarFaltas();
        } else {
            mostrarMensagem('Todas as faltas da manhã já possuem correspondente à tarde.', 'info');
        }

    } catch (e) {
        console.error('Erro ao replicar faltas:', e);
        mostrarMensagem('Erro ao replicar faltas.', 'error');
    }
}

function exportarFaltasExcel() {
    if (!__faltas_cache || __faltas_cache.length === 0) {
        mostrarMensagem('Não há dados para exportar.', 'warning');
        return;
    }

    // Adiciona a biblioteca XLSX se não existir
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
        script.onload = () => exportarFaltasExcel();
        document.head.appendChild(script);
        return;
    }

    const dadosExportacao = __faltas_cache.map(f => {
        const dataObj = f.data?.toDate ? f.data.toDate() : new Date(f.data);
        return {
            'Data': dataObj.toLocaleDateString('pt-BR'),
            'Funcionário': f.funcionarioNome || 'N/A',
            'Setor': f.setor || 'N/A',
            'Período': f.periodo === 'manha' ? 'Manhã' : 'Tarde',
            'Justificativa': f.justificativa || ''
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExportacao);
    XLSX.utils.book_append_sheet(wb, ws, "Faltas");
    XLSX.writeFile(wb, "Relatorio_Faltas.xlsx");
}

function renderizarDashboardAnaliseFaltas(registros, empMap) {
    let dashboardContainer = document.getElementById('dashboard-analise-faltas');
    
    // Cria o container se não existir
    if (!dashboardContainer) {
        dashboardContainer = document.createElement('div');
        dashboardContainer.id = 'dashboard-analise-faltas';
        dashboardContainer.className = 'row mb-4 g-3';
        
        // Insere antes da tabela
        const tabelaContainer = document.getElementById('faltas-container')?.closest('.table-responsive') || document.getElementById('faltas-container')?.parentElement;
        if (tabelaContainer) {
            tabelaContainer.parentElement.insertBefore(dashboardContainer, tabelaContainer);
        }
    }

    if (!registros || registros.length === 0) {
        dashboardContainer.innerHTML = '';
        return;
    }

    // Cálculos
    const totalFaltas = registros.length;
    const porPeriodo = { manha: 0, tarde: 0 };
    const porSetor = {};
    const porFuncionario = {};

    registros.forEach(r => {
        // Período
        if (r.periodo === 'manha') porPeriodo.manha++;
        else porPeriodo.tarde++;

        // Setor
        const setor = r.setor || 'Não definido';
        porSetor[setor] = (porSetor[setor] || 0) + 1;

        // Funcionário
        const func = r.funcionarioNome || 'Desconhecido';
        porFuncionario[func] = (porFuncionario[func] || 0) + 1;
    });

    // Top 3 Setores
    const topSetores = Object.entries(porSetor)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

    // Top 3 Funcionários
    const topFuncionarios = Object.entries(porFuncionario)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

    // HTML do Dashboard
    dashboardContainer.innerHTML = `
        <div class="col-md-3">
            <div class="card bg-light h-100 border-0 shadow-sm">
                <div class="card-body text-center">
                    <h6 class="text-muted mb-2">Total de Faltas</h6>
                    <h2 class="mb-0 text-primary fw-bold">${totalFaltas}</h2>
                    <small class="text-muted">Manhã: ${porPeriodo.manha} | Tarde: ${porPeriodo.tarde}</small>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-header bg-white fw-bold py-2">Top Setores</div>
                <ul class="list-group list-group-flush list-group-sm">
                    ${topSetores.map(([nome, qtd]) => 
                        `<li class="list-group-item d-flex justify-content-between align-items-center py-1">
                            <span class="text-truncate" style="max-width: 70%;">${nome}</span>
                            <span class="badge bg-secondary rounded-pill">${qtd}</span>
                        </li>`).join('')}
                </ul>
            </div>
        </div>
        <div class="col-md-5">
            <div class="card h-100 border-0 shadow-sm">
                <div class="card-header bg-white fw-bold py-2">Funcionários com Mais Faltas</div>
                <ul class="list-group list-group-flush list-group-sm">
                    ${topFuncionarios.map(([nome, qtd]) => 
                        `<li class="list-group-item d-flex justify-content-between align-items-center py-1">
                            <span class="text-truncate" style="max-width: 80%;">${nome}</span>
                            <span class="badge bg-danger rounded-pill">${qtd}</span>
                        </li>`).join('')}
                </ul>
            </div>
        </div>
    `;
}