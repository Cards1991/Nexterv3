// Faltas Diárias - Manhã/Tarde
let __faltas_cache = [];

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
        const d = document.getElementById('falta-filtro-data');
        if (d && !d.value) d.valueAsDate = new Date();
        
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
        
        const dataStr = document.getElementById('falta-filtro-data')?.value || '';
        const empId = document.getElementById('falta-filtro-empresa')?.value || '';
        const periodo = document.getElementById('falta-filtro-periodo')?.value || '';
        const setor = document.getElementById('falta-filtro-setor')?.value || '';
        
        let query = db.collection('faltas').orderBy('data', 'desc');

        // APLICAÇÃO DA REGRA DE ACESSO
        if (currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin) {
            // Se o usuário tem um setor restrito, força a query para esse setor
            query = query.where('setor', '==', currentUserPermissions.restricaoSetor);
        } else if (setor) {
            // Se for admin ou não tiver restrição, mas filtrou por setor
            query = query.where('setor', '==', setor);
        }
        
        // Filtro por data (aplicado para todos)
        if (dataStr) {
            const ini = new Date(dataStr.replace(/-/g, '\/'));
            ini.setHours(0, 0, 0, 0);
            const fim = new Date(dataStr.replace(/-/g, '\/'));
            fim.setHours(23, 59, 59, 999);
            query = query.where('data', '>=', ini).where('data', '<=', fim);
        }
        
        // Filtros adicionais
        if (empId) query = query.where('empresaId', '==', empId);
        if (periodo) query = query.where('periodo', '==', periodo);
        
        const snap = await query.get();
        const registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const empSnap = await db.collection('empresas').get(); 
        const empMap = {}; 
        empSnap.forEach(d => empMap[d.id] = d.data().nome);
        
        if (registros.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sem faltas para os filtros</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = '';
        registros.forEach(f => {
            const dataObj = f.data?.toDate ? f.data.toDate() : f.data;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatarData(dataObj)}</td>
                <td>${f.funcionarioNome || '-'}</td>
                <td>${empMap[f.empresaId] || '-'} / ${f.setor || '-'}</td>
                <td><span class="badge ${f.periodo === 'manha' ? 'bg-info' : 'bg-primary'}">${f.periodo === 'manha' ? 'Manhã' : 'Tarde'}</span></td>
                <td>${f.justificativa || '-'}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-danger" onclick="excluirFalta('${f.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error('Erro ao carregar faltas:', e); 
        mostrarMensagem('Erro ao carregar faltas', 'error'); 
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
        if (d) d.valueAsDate = new Date();
        
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
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
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
            data: new Date(dataStr.replace(/-/g, '\/')),
            periodo: periodo,
            justificativa: justificativa || null,
            criado_em: timestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null
        });
        
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
        const dataStr = document.getElementById('falta-filtro-data')?.value || '';
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
            if (dataStr) {
                const data = new Date(dataStr);
                periodoTexto = `Data: ${data.toLocaleDateString('pt-BR')}`;
                const ini = new Date(dataStr); 
                ini.setHours(0,0,0,0);
                const fim = new Date(dataStr); 
                fim.setHours(23,59,59,999);
                query = query.where('data', '>=', ini).where('data', '<=', fim);
            } else {
                // Se diário sem data, usar hoje
                const hoje = new Date();
                periodoTexto = `Data: ${hoje.toLocaleDateString('pt-BR')}`;
                const ini = new Date(); 
                ini.setHours(0,0,0,0);
                const fim = new Date(); 
                fim.setHours(23,59,59,999);
                query = query.where('data', '>=', ini).where('data', '<=', fim);
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
        if (setor && tipoRel !== 'setor' && !(currentUserPermissions.restricaoSetor && !currentUserPermissions.isAdmin)) {
            registros = registros.filter(r => (r.setor || '') === setor);
        }
        
        // Obter nomes de empresas
        const empSnap = await db.collection('empresas').get();
        const empMap = {};
        empSnap.forEach(d => empMap[d.id] = d.data().nome);
        
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
        
        html += '</small></div>' +
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
        
        // Abrir janela de impressão
        let printFrame = document.getElementById('print-frame');
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'print-frame';
            printFrame.style.display = 'none';
            document.body.appendChild(printFrame);
        }
        printFrame.contentDocument.write(html);
        printFrame.contentDocument.close();
        printFrame.contentWindow.print();
        
    } catch (e) {
        console.error('Erro ao gerar relatório de faltas:', e);
        mostrarMensagem('Erro ao gerar relatório de faltas', 'error');
    }
}

// Função auxiliar para formatar data (caso não exista)
function formatarData(data) {
    if (!data) return '—';
    const dataObj = data instanceof Date ? data : data.toDate();
    return dataObj.toLocaleDateString('pt-BR');
}