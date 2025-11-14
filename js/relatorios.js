// Relatórios e análises
async function carregarRelatorios() {
    try {
        await preencherFiltrosRelatorios();
        aplicarFiltrosRelatorio();
    } catch (e) { 
        console.warn('Erro ao carregar relatórios:', e); 
    }
}

// Preencher filtros de relatórios
async function preencherFiltrosRelatorios() {
    try {
        // Popular filtro de empresas
        const empSel = document.getElementById('empresa-relatorio');
        const pendEmpSel = document.getElementById('pend-empresa-filter');
        
        if (empSel) {
            empSel.innerHTML = '<option value="">Todas as empresas</option>';
            const empSnap = await db.collection('empresas').get();
            empSnap.forEach(doc => {
                const o = document.createElement('option');
                o.value = doc.id;
                o.textContent = doc.data().nome;
                empSel.appendChild(o);
            });
        }

        if (pendEmpSel) {
            pendEmpSel.innerHTML = '<option value="">Todas as empresas</option>';
            const empSnap = await db.collection('empresas').get();
            empSnap.forEach(doc => {
                const o = document.createElement('option');
                o.value = doc.id;
                o.textContent = doc.data().nome;
                pendEmpSel.appendChild(o);
            });
            
            // Configurar filtro de setores
            pendEmpSel.onchange = async function() {
                const setSel = document.getElementById('pend-setor-filter');
                if (!setSel) return;
                
                setSel.innerHTML = '<option value="">Todos os setores</option>';
                const id = this.value;
                if (!id) return;
                
                const ed = await db.collection('empresas').doc(id).get();
                const setores = Array.isArray(ed.data()?.setores) ? ed.data().setores : [];
                setores.forEach(s => { 
                    const o = document.createElement('option'); 
                    o.value = s; 
                    o.textContent = s; 
                    setSel.appendChild(o); 
                });
            };
        }
    } catch (e) { 
        console.warn('Erro ao preencher filtros:', e); 
    }
}

// Aplicar filtros ao relatório
document.getElementById('form-filtro-relatorio').addEventListener('submit', function(e) {
    e.preventDefault();
    aplicarFiltrosRelatorio();
});

// Aplicar filtros de relatório
async function aplicarFiltrosRelatorio() {
    try {
        const tbody = document.getElementById('tabela-relatorios');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const fonte = document.getElementById('fonte-relatorio')?.value || 'movimentacoes';
        const dataInicial = document.getElementById('data-inicial').value;
        const dataFinal = document.getElementById('data-final').value;
        const empresaId = document.getElementById('empresa-relatorio').value;
        const tipo = document.getElementById('tipo-relatorio').value;

        let registros = [];

        if (fonte === 'movimentacoes') {
            let query = db.collection('movimentacoes');
            if (dataInicial) query = query.where('data', '>=', new Date(dataInicial));
            if (dataFinal) {
                const df = new Date(dataFinal);
                df.setHours(23, 59, 59, 999);
                query = query.where('data', '<=', df);
            }
            if (tipo) query = query.where('tipo', '==', tipo);
            if (empresaId) query = query.where('empresaId', '==', empresaId);
            query = query.orderBy('data', 'desc');
            
            const snap = await query.get();
            registros = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), __fonte: 'mov' }));
        } else if (fonte === 'afastamentos') {
            let query = db.collection('afastamentos');
            if (dataInicial) query = query.where('data_inicio', '>=', new Date(dataInicial));
            if (dataFinal) {
                const df = new Date(dataFinal);
                df.setHours(23,59,59,999);
                query = query.where('data_inicio', '<=', df);
            }
            if (empresaId) query = query.where('empresaId', '==', empresaId);
            
            const snap = await query.orderBy('data_inicio', 'desc').get();
            registros = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), __fonte: 'afast' }));
        } else if (fonte === 'atestados') {
            let query = db.collection('atestados');
            if (dataInicial) query = query.where('data_atestado', '>=', new Date(dataInicial));
            if (dataFinal) {
                const df = new Date(dataFinal);
                df.setHours(23,59,59,999);
                query = query.where('data_atestado', '<=', df);
            }
            if (empresaId) query = query.where('empresaId', '==', empresaId);
            
            const snap = await query.orderBy('data_atestado', 'desc').get();
            registros = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), __fonte: 'atest' }));
        }

        await carregarDadosRelatorio(registros);
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        mostrarMensagem('Erro ao aplicar filtros', 'error');
    }
}

// Carregar dados do relatório
async function carregarDadosRelatorio(registros) {
    try {
        const tbody = document.getElementById('tabela-relatorios');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum dado encontrado com os filtros aplicados</td></tr>';
            return;
        }

        // Carregar dados auxiliares
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const empresasSnapshot = await db.collection('empresas').get();

        const funcionariosMap = {};
        const empresasMap = {};
        const funcionarioEmpresaMap = {};

        funcionariosSnapshot.forEach(doc => {
            funcionariosMap[doc.id] = doc.data().nome;
            funcionarioEmpresaMap[doc.id] = doc.data().empresaId;
        });
        
        empresasSnapshot.forEach(doc => { 
            empresasMap[doc.id] = doc.data().nome; 
        });

        registros.forEach(rec => {
            let dataObj, nomeFuncionario = '-', nomeEmpresa = '-', setor = '-', tipoBadge = '-', motivo = '-';
            
            if (rec.__fonte === 'mov') {
                nomeFuncionario = rec.funcionarioNome || funcionariosMap[rec.funcionarioId] || 'Não encontrado';
                const empId = rec.empresaId || funcionarioEmpresaMap[rec.funcionarioId];
                nomeEmpresa = empresasMap[empId] || 'Não encontrada';
                const docFunc = funcionariosSnapshot.docs.find(d => d.id === rec.funcionarioId);
                setor = docFunc?.data()?.setor || 'Não informado';
                dataObj = rec.data?.toDate ? rec.data.toDate() : rec.data;
                tipoBadge = `<span class="badge ${rec.tipo === 'admissao' ? 'bg-success' : 'bg-danger'}">${rec.tipo === 'admissao' ? 'Admissão' : 'Demissão'}</span>`;
                motivo = rec.motivo || '-';
            } else if (rec.__fonte === 'afast') {
                nomeFuncionario = rec.colaborador_nome || '-';
                nomeEmpresa = empresasMap[rec.empresaId] || rec.empresa || '-';
                setor = rec.setor || '-';
                dataObj = rec.data_inicio?.toDate ? rec.data_inicio.toDate() : rec.data_inicio;
                tipoBadge = `<span class="badge bg-warning">Afastamento</span>`;
                motivo = rec.tipo_afastamento || '-';
            } else if (rec.__fonte === 'atest') {
                nomeFuncionario = rec.colaborador_nome || '-';
                nomeEmpresa = empresasMap[rec.empresaId] || rec.empresa_nome || '-';
                setor = rec.setor || '-';
                dataObj = rec.data_atestado?.toDate ? rec.data_atestado.toDate() : rec.data_atestado;
                tipoBadge = `<span class="badge bg-info">Atestado (${rec.tipo || '-'})</span>`;
                motivo = rec.cid || '-';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatarData(dataObj)}</td>
                <td>${nomeFuncionario}</td>
                <td>${nomeEmpresa} / ${setor}</td>
                <td>${tipoBadge}</td>
                <td>${motivo}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar dados do relatório:', error);
        mostrarMensagem('Erro ao carregar relatório', 'error');
    }
}

// Gerar análise com IA (simulada)
async function gerarAnaliseIA() {
    try {
        const analiseDiv = document.getElementById('analise-ia-container');
        if (!analiseDiv) return;
        
        analiseDiv.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Gerando análise com IA...</div>';

        const dataInicial = document.getElementById('data-inicial').value; // Certifique-se de que esses IDs existem
        const dataFinal = document.getElementById('data-final').value;
        const empresaId = document.getElementById('empresa-relatorio').value;

        let query = db.collection('movimentacoes');
        if (dataInicial) query = query.where('data', '>=', new Date(dataInicial));
        if (dataFinal) {
            const df = new Date(dataFinal);
            df.setHours(23, 59, 59, 999);
            query = query.where('data', '<=', df);
        }
        if (empresaId) query = query.where('empresaId', '==', empresaId);

        const movimentacoesSnapshot = await query.orderBy('data', 'desc').get();
        const registros = movimentacoesSnapshot.docs.map(doc => doc.data());

        // Para dar um efeito de "processamento"
        setTimeout(async () => {
            const analise = await gerarAnaliseSimuladaIA(registros);
            analiseDiv.innerHTML = analise;
        }, 1500);

    } catch (error) {
        console.error('Erro ao gerar análise com IA:', error);
        const analiseDiv = document.getElementById('analise-ia-container');
        if (analiseDiv) {
            analiseDiv.innerHTML = '<p class="text-danger">Erro ao gerar análise. Tente novamente.</p>';
        }
    }
}

// Gerar análise simulada com IA
async function gerarAnaliseSimuladaIA(registros) {
    if (registros.length === 0) {
        return '<p class="text-muted">Nenhum dado para analisar. Por favor, ajuste os filtros.</p>';
    }

    const total = registros.length;
    const admissoes = registros.filter(r => r.tipo === 'admissao');
    const demissoes = registros.filter(r => r.tipo === 'demissao');

    let analiseHTML = `<div class="ai-insights">`;
    analiseHTML += `<h6><i class="fas fa-chart-line"></i> Visão Geral do Período</h6>`;
    analiseHTML += `<p>Analisando <strong>${total}</strong> movimentações, sendo <strong>${admissoes.length} admissões</strong> e <strong>${demissoes.length} demissões</strong>.</p>`;

    // 1. Análise de Rotatividade (Turnover)
    if (demissoes.length > 0) {
        const pedidosDemissao = demissoes.filter(r => r.motivo === 'Pedido de Demissão').length;
        const percPedidos = ((pedidosDemissao / demissoes.length) * 100).toFixed(1);

        analiseHTML += `<h6><i class="fas fa-walking"></i> Análise de Turnover</h6>`;
        analiseHTML += `<p>Dos <strong>${demissoes.length}</strong> desligamentos, <strong>${pedidosDemissao} (${percPedidos}%)</strong> foram voluntários (pedido de demissão).</p>`;

        if (percPedidos > 50) {
            analiseHTML += `<div class="alert alert-warning small p-2">
                <i class="fas fa-exclamation-triangle"></i> <strong>Ponto de Atenção:</strong> A maioria dos desligamentos é voluntária. 
                Recomenda-se analisar os dados da "Análise de Rescisões" para entender as causas.
            </div>`;
        }
    }

    // 2. Análise de Outliers por Setor
    if (total > 5) { // Só faz sentido com um volume mínimo
        const [funcionarios, empresas] = await Promise.all([
            db.collection('funcionarios').get(),
            db.collection('empresas').get()
        ]);
        const funcMap = new Map(funcionarios.docs.map(d => [d.id, d.data()]));
        const empMap = new Map(empresas.docs.map(d => [d.id, d.data()]));

        const movimentacoesPorSetor = registros.reduce((acc, reg) => {
            const func = funcMap.get(reg.funcionarioId);
            if (!func) return acc;

            const empresa = empMap.get(func.empresaId);
            const chave = `${empresa?.nome || 'N/A'} / ${func.setor || 'N/A'}`;
            
            if (!acc[chave]) acc[chave] = { admissoes: 0, demissoes: 0 };
            
            if (reg.tipo === 'admissao') acc[chave].admissoes++;
            else acc[chave].demissoes++;

            return acc;
        }, {});

        const setoresCriticos = Object.entries(movimentacoesPorSetor).filter(([, v]) => v.demissoes > v.admissoes && v.demissoes > 2);

        if (setoresCriticos.length > 0) {
            analiseHTML += `<h6><i class="fas fa-search-location"></i> Análise por Setor</h6>`;
            setoresCriticos.forEach(([setor, dados]) => {
                analiseHTML += `<p>O setor <strong>${setor}</strong> apresentou <strong>${dados.demissoes} demissões</strong> e <strong>${dados.admissoes} admissões</strong>, indicando um possível ponto de atenção na retenção.</p>`;
            });
        }
    }

    // 3. Recomendações Gerais
    analiseHTML += `<h6><i class="fas fa-lightbulb"></i> Recomendações Automáticas</h6>`;
    if (demissoes.length > admissoes.length) {
        analiseHTML += `<p>💡 O número de demissões superou o de admissões. Verifique se isso está alinhado à estratégia da empresa ou se há necessidade de ações de retenção.</p>`;
    } else {
        analiseHTML += `<p>💡 O quadro de funcionários está estável ou em crescimento. Continue monitorando os indicadores de satisfação na "Análise de Rescisões".</p>`;
    }

    analiseHTML += `</div>`;
    return analiseHTML;
}

// Imprimir pendências por setor
async function imprimirPendenciasSetor() {
    try {
        const empFilter = document.getElementById('pend-empresa-filter')?.value || '';
        const setFilter = document.getElementById('pend-setor-filter')?.value || ''; // Certifique-se de que este ID existe
        
        const [repSnap, contSnap, empSnap] = await Promise.all([
            db.collection('reposicoes').where('status', '==', 'pendente').get(),
            db.collection('contratacoes').where('status', '==', 'pendente').get(),
            db.collection('empresas').get()
        ]);
        
        const empresas = {}; 
        empSnap.forEach(d => empresas[d.id] = d.data().nome);
        
        const agruparPorSetor = {};
        
        // Processar reposições
        repSnap.forEach(d => {
            const r = d.data();
            if (empFilter && r.empresaId !== empFilter) return;
            if (setFilter && (r.setor || '') !== setFilter) return;
            
            const emp = empresas[r.empresaId] || '—';
            const setor = r.setor || '—';
            const chave = `${emp} - ${setor}`;
            
            if (!agruparPorSetor[chave]) {
                agruparPorSetor[chave] = { empresa: emp, setor: setor, reposicoes: 0, contratacoes: 0 };
            }
            agruparPorSetor[chave].reposicoes++;
        });

        // Processar contratações
        contSnap.forEach(d => {
            const c = d.data();
            if (empFilter && c.empresaId !== empFilter) return;
            if (setFilter && (c.setor || '') !== setFilter) return;
            
            const emp = empresas[c.empresaId] || '—';
            const setor = c.setor || '—';
            const chave = `${emp} - ${setor}`;
            
            if (!agruparPorSetor[chave]) {
                agruparPorSetor[chave] = { empresa: emp, setor: setor, reposicoes: 0, contratacoes: 0 };
            }
            agruparPorSetor[chave].contratacoes++;
        });

        // Montar HTML para impressão
        let html = '<html><head><title>Pendências por Setor</title>'+
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css">'+
            '<style>@page{size: landscape;}body{font-family:Inter,Segoe UI,sans-serif;padding:20px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px} .table thead th{background:#f8fafc} .badge{font-size:.75rem}</style>'+
            '</head><body class="p-4">'+
            '<div class="header"><h4 class="m-0">Pendências por Setor</h4><small class="text-muted">'+new Date().toLocaleString('pt-BR')+'</small></div><hr/>';
        
        Object.keys(agruparPorSetor).forEach(chave => {
            const item = agruparPorSetor[chave];
            html += `<h5 class="mt-3">${chave}</h5>`;
            html += '<table class="table table-sm table-bordered"><thead><tr><th>Tipo</th><th>Quantidade</th></tr></thead><tbody>';
            html += `<tr><td>Reposições Pendentes</td><td>${item.reposicoes}</td></tr>`;
            html += `<tr><td>Contratações Pendentes</td><td>${item.contratacoes}</td></tr>`;
            html += `<tr class="table-info"><td><strong>Total</strong></td><td><strong>${item.reposicoes + item.contratacoes}</strong></td></tr>`;
            html += '</tbody></table>';
        });
        
        html += '</body></html>';
        
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
    } catch (e) {
        console.error(e);
        mostrarMensagem('Erro ao gerar relatório de pendências', 'error');
    }
}