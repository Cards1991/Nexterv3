// ========================================
// Módulo: Controle Disciplinar
// Descrição: Gerenciamento de controle disciplinar de funcionários
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Módulo Controle Disciplinar carregado');
    
    // Adiciona o evento de clique ao botão para abrir o modal de novo registro
    const btnNovoRegistro = document.getElementById('btn-novo-registro-disciplinar');
    if (btnNovoRegistro) {
        btnNovoRegistro.addEventListener('click', () => abrirModalNovoRegistroDisciplinar());
    }
    setupFiltrosDisciplinares();
});

function setupFiltrosDisciplinares() {
    const tableContainer = document.getElementById('tabela-controle-disciplinar')?.closest('.table-responsive') || document.getElementById('tabela-controle-disciplinar')?.parentElement;
    
    if (tableContainer && !document.getElementById('disciplinar-filtro-container')) {
        const filterHTML = `
            <div id="disciplinar-filtro-container" class="row g-2 mb-3 align-items-end bg-light p-2 rounded border">
                <div class="col-md-3">
                    <label class="form-label small fw-bold">Data Início</label>
                    <input type="date" id="disciplinar-filtro-data-inicio" class="form-control form-control-sm">
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-bold">Data Fim</label>
                    <input type="date" id="disciplinar-filtro-data-fim" class="form-control form-control-sm">
                </div>
                <div class="col-md-4">
                    <label class="form-label small fw-bold">Funcionário</label>
                    <select id="disciplinar-filtro-funcionario" class="form-select form-select-sm">
                        <option value="">Todos</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button id="btn-filtrar-disciplinar" class="btn btn-primary btn-sm w-100"><i class="fas fa-filter"></i> Filtrar</button>
                </div>
            </div>
        `;
        tableContainer.insertAdjacentHTML('beforebegin', filterHTML);
        
        // Popula o filtro de funcionários
        if (typeof carregarSelectFuncionariosAtivos === 'function') {
            carregarSelectFuncionariosAtivos('disciplinar-filtro-funcionario');
        }

        document.getElementById('btn-filtrar-disciplinar').addEventListener('click', carregarDadosDisciplinares);
    }
}

// Função para carregar dados de controle disciplinar
async function carregarDadosDisciplinares() {
    console.log('Carregando dados de controle disciplinar...');
    let todosRegistros = []; // Para usar no dashboard

    const tbody = document.getElementById('tabela-controle-disciplinar');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    try {
        let query = db.collection('registros_disciplinares');

        const dataInicio = document.getElementById('disciplinar-filtro-data-inicio')?.value;
        const dataFim = document.getElementById('disciplinar-filtro-data-fim')?.value;
        const funcId = document.getElementById('disciplinar-filtro-funcionario')?.value;

        if (dataInicio) query = query.where('dataOcorrencia', '>=', new Date(dataInicio + 'T00:00:00'));
        if (dataFim) query = query.where('dataOcorrencia', '<=', new Date(dataFim + 'T23:59:59'));
        if (funcId) query = query.where('funcionarioId', '==', funcId);

        const querySnapshot = await query.orderBy('dataOcorrencia', 'desc').get();

        if (querySnapshot.empty) {
            gerarDashboardDisciplinar([]); // Gera dashboard vazio
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro disciplinar encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        querySnapshot.forEach(doc => {
            const registro = doc.data();
            todosRegistros.push(registro); // Adiciona ao array para o dashboard
            const dataOcorrencia = registro.dataOcorrencia?.toDate ? registro.dataOcorrencia.toDate() : new Date();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${registro.funcionarioNome || 'N/A'}</td>
                <td><span class="badge bg-secondary">${registro.classificacao || '-'}</span></td>
                <td>${formatarData(dataOcorrencia)}</td>
                <td class="text-truncate" style="max-width: 300px;" title="${registro.descricao}">${registro.descricao}</td>
                <td><span class="badge bg-warning text-dark">${registro.medidaAplicada}</span></td>
                <td class="text-end"><button class="btn btn-sm btn-outline-info" onclick="visualizarRegistroDisciplinar('${doc.id}')" title="Visualizar"><i class="fas fa-eye"></i></button> <button class="btn btn-sm btn-outline-primary" onclick="editarRegistroDisciplinar('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="deletarRegistroDisciplinar('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(row);
        });

        // Gera o dashboard com os dados carregados
        gerarDashboardDisciplinar(todosRegistros);
    } catch (error) {
        console.error("Erro ao carregar registros disciplinares:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar registros.</td></tr>';
        mostrarMensagem('Falha ao carregar os registros disciplinares.', 'error');
    }
}

function gerarDashboardDisciplinar(registros) {
    const totalRegistrosEl = document.getElementById('disciplinar-total-registros');
    const analiseIAEl = document.getElementById('disciplinar-analise-ia');
    const resumoFuncionariosTbody = document.getElementById('tabela-resumo-funcionarios-disciplinar');

    if (!totalRegistrosEl || !analiseIAEl || !resumoFuncionariosTbody) return;

    // 1. Métricas Gerais
    totalRegistrosEl.textContent = registros.length;

    // 2. Gráfico de Classificação de Ocorrências
    const contagemPorClassificacao = registros.reduce((acc, reg) => {
        const classificacao = reg.classificacao || 'Não Classificado';
        acc[classificacao] = (acc[classificacao] || 0) + 1;
        return acc;
    }, {});

    renderizarGraficoClassificacao(contagemPorClassificacao);

    // 3. Análise com IA (Simulada)
    let analiseTexto = '<ul>';
    if (registros.length === 0) {
        analiseTexto += '<li>Nenhum registro encontrado para análise.</li>';
    } else {
        const sortedClassificacoes = Object.entries(contagemPorClassificacao).sort(([, a], [, b]) => b - a);
        const maisComum = sortedClassificacoes[0];
        if (maisComum) {
            analiseTexto += `<li>A ocorrência mais comum é a <strong>Alínea ${maisComum[0]}</strong>, com <strong>${maisComum[1]}</strong> registro(s).</li>`;
        }

        const reincidentes = Object.entries(registros.reduce((acc, reg) => {
            acc[reg.funcionarioNome] = (acc[reg.funcionarioNome] || 0) + 1;
            return acc;
        }, {})).filter(([, count]) => count > 2);

        if (reincidentes.length > 0) {
            analiseTexto += `<li class="text-warning"><strong>Ponto de Atenção:</strong> ${reincidentes.length} funcionário(s) apresentam 3 ou mais registros. Recomenda-se uma conversa de feedback.</li>`;
        } else {
            analiseTexto += '<li>Não foram identificados padrões de reincidência significativos.</li>';
        }
    }
    analiseTexto += '</ul>';
    analiseIAEl.innerHTML = analiseTexto;

    // 4. Tabela de Resumo por Funcionário
    const resumoPorFuncionario = registros.reduce((acc, reg) => {
        if (!acc[reg.funcionarioNome]) {
            acc[reg.funcionarioNome] = { count: 0, ultimaData: new Date(0) };
        }
        acc[reg.funcionarioNome].count++;
        const dataOcorrencia = reg.dataOcorrencia.toDate();
        if (dataOcorrencia > acc[reg.funcionarioNome].ultimaData) {
            acc[reg.funcionarioNome].ultimaData = dataOcorrencia;
        }
        return acc;
    }, {});

    const resumoArray = Object.entries(resumoPorFuncionario).sort(([, a], [, b]) => b.count - a.count);

    if (resumoArray.length === 0) {
        resumoFuncionariosTbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum funcionário com registros.</td></tr>';
    } else {
        resumoFuncionariosTbody.innerHTML = resumoArray.map(([nome, dados]) => `
            <tr>
                <td>${nome}</td>
                <td><span class="badge bg-danger">${dados.count}</span></td>
                <td>${formatarData(dados.ultimaData)}</td>
            </tr>
        `).join('');
    }
}

let graficoClassificacaoInstance = null;
function renderizarGraficoClassificacao(dados) {
    const ctx = document.getElementById('grafico-classificacao-ocorrencias')?.getContext('2d');
    if (!ctx) return;

    if (graficoClassificacaoInstance) {
        graficoClassificacaoInstance.destroy();
    }

    graficoClassificacaoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dados).map(k => `Alínea ${k}`),
            datasets: [{
                data: Object.values(dados),
                backgroundColor: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#fca311', '#003049'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// Função para abrir modal de novo registro
async function abrirModalNovoRegistroDisciplinar(id = null) {
    console.log('Abrindo modal para registro disciplinar');
    const modal = new bootstrap.Modal(document.getElementById('registroDisciplinarModal'));
    const form = document.getElementById('form-registro-disciplinar');
    form.reset();
    document.getElementById('registro-disciplinar-id').value = '';
    
    // Limpa área de sugestão se existir
    const sugestaoEl = document.getElementById('disciplinar-sugestao-container');
    if (sugestaoEl) sugestaoEl.innerHTML = '';

    // Preencher select de funcionários
    const selectFuncionario = document.getElementById('disciplinar-funcionario');
    selectFuncionario.innerHTML = '<option value="">Carregando...</option>';

    try {
        const funcionariosSnapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        selectFuncionario.innerHTML = '<option value="">Selecione o funcionário</option>';
        funcionariosSnapshot.forEach(doc => {
            const funcionario = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = funcionario.nome;
            selectFuncionario.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar funcionários: ", error);
        selectFuncionario.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarMensagem('Falha ao carregar a lista de funcionários.', 'error');
    }

    // Adicionar listeners para sugestão
    selectFuncionario.addEventListener('change', verificarSugestaoDisciplinar);
    
    // Adiciona container de sugestão se não existir
    const modalBody = form.parentElement;
    if (!document.getElementById('disciplinar-sugestao-container')) {
        const div = document.createElement('div');
        div.id = 'disciplinar-sugestao-container';
        div.className = 'mt-3';
        // Insere antes dos botões do modal (footer) ou no final do body
        modalBody.appendChild(div);
    }

    // TODO: Implementar lógica para carregar dados se for edição (id != null)

    modal.show();
}

async function verificarSugestaoDisciplinar() {
    const funcionarioId = document.getElementById('disciplinar-funcionario').value;
    const container = document.getElementById('disciplinar-sugestao-container');
    
    if (!funcionarioId || !container) return;
    
    container.innerHTML = '<div class="text-muted small"><i class="fas fa-spinner fa-spin"></i> Analisando histórico...</div>';

    try {
        // Buscar histórico do funcionário
        const historySnap = await db.collection('registros_disciplinares')
            .where('funcionarioId', '==', funcionarioId)
            .orderBy('dataOcorrencia', 'desc')
            .get();

        const history = historySnap.docs.map(d => d.data());
        
        // Lógica de sugestão
        let sugestao = '';
        let motivo = '';
        let cor = 'alert-info';

        // Verifica suspensões anteriores
        const hasSusp7 = history.some(r => r.medidaAplicada === 'Suspensão de 7 dias');
        const hasSusp5 = history.some(r => r.medidaAplicada === 'Suspensão de 5 dias');
        const hasSusp3 = history.some(r => r.medidaAplicada === 'Suspensão de 3 dias');
        const hasSusp1 = history.some(r => r.medidaAplicada === 'Suspensão de 1 dia');

        if (hasSusp7) {
            sugestao = 'Justa Causa';
            motivo = 'Colaborador já possui suspensão de 7 dias.';
            cor = 'alert-danger';
        } else if (hasSusp5) {
            sugestao = 'Suspensão de 7 dias';
            motivo = 'Colaborador já possui suspensão de 5 dias.';
            cor = 'alert-warning';
        } else if (hasSusp3) {
            sugestao = 'Suspensão de 5 dias';
            motivo = 'Colaborador já possui suspensão de 3 dias.';
            cor = 'alert-warning';
        } else if (hasSusp1) {
            sugestao = 'Suspensão de 3 dias';
            motivo = 'Colaborador já possui suspensão de 1 dia.';
            cor = 'alert-warning';
        } else {
            // Verifica advertências nos últimos 30 dias
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
            
            const advertenciasRecentes = history.filter(r => 
                r.medidaAplicada.includes('Advertência') && 
                r.dataOcorrencia.toDate() >= trintaDiasAtras
            );

            if (advertenciasRecentes.length >= 3) {
                sugestao = 'Suspensão de 1 dia';
                motivo = `Colaborador possui ${advertenciasRecentes.length} advertências nos últimos 30 dias.`;
                cor = 'alert-warning';
            } else {
                sugestao = 'Advertência Escrita';
                motivo = 'Histórico recente limpo ou leve.';
                cor = 'alert-success';
            }
        }

        container.innerHTML = `
            <div class="alert ${cor} mb-0">
                <strong><i class="fas fa-robot"></i> Sugestão do Sistema:</strong> ${sugestao}
                <br><small>${motivo}</small>
            </div>
        `;
        
        // Tenta pré-selecionar a medida se existir no select
        const tipoSelect = document.getElementById('disciplinar-tipo');
        if (tipoSelect) {
            for (let i = 0; i < tipoSelect.options.length; i++) {
                if (tipoSelect.options[i].value === sugestao) {
                    tipoSelect.selectedIndex = i;
                    break;
                }
            }
        }

    } catch (e) {
        console.error("Erro ao gerar sugestão:", e);
        container.innerHTML = '';
    }
}

// Função para salvar novo registro
async function salvarRegistroDisciplinar() {
    const registroId = document.getElementById('registro-disciplinar-id').value;
    const funcionarioSelect = document.getElementById('disciplinar-funcionario');
    const funcionarioId = funcionarioSelect.value;
    const funcionarioNome = funcionarioSelect.options[funcionarioSelect.selectedIndex].text;
    const dataOcorrencia = document.getElementById('disciplinar-data').value;
    const classificacao = document.getElementById('disciplinar-classificacao').value;
    const medidaAplicada = document.getElementById('disciplinar-tipo').value;
    const descricao = document.getElementById('disciplinar-ocorrencia').value;

    // Validação
    if (!funcionarioId || !dataOcorrencia || !classificacao || !medidaAplicada || !descricao) {
        mostrarMensagem('Por favor, preencha todos os campos do formulário.', 'warning');
        return;
    }

    const registroData = {
        funcionarioId,
        funcionarioNome,
        classificacao,
        dataOcorrencia: new Date(dataOcorrencia.replace(/-/g, '\/')),
        medidaAplicada,
        descricao,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
        if (registroId) {
            // Atualizar registro existente
            await db.collection('registros_disciplinares').doc(registroId).update(registroData);
            mostrarMensagem('Registro disciplinar atualizado com sucesso!', 'success');
        } else {
            // Criar novo registro
            registroData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('registros_disciplinares').add(registroData);
            mostrarMensagem('Registro disciplinar salvo com sucesso!', 'success');
        }

        bootstrap.Modal.getInstance(document.getElementById('registroDisciplinarModal')).hide();
        await carregarDadosDisciplinares(); // Atualiza a tabela
    } catch (error) {
        console.error("Erro ao salvar registro disciplinar: ", error);
        mostrarMensagem('Falha ao salvar o registro disciplinar.', 'error');
    }
}

// Função para editar registro
async function editarRegistroDisciplinar(id) {
    console.log('Editando registro disciplinar:', id);
    try {
        const doc = await db.collection('registros_disciplinares').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }
        const registro = doc.data();

        // Abre o modal e preenche os campos
        await abrirModalNovoRegistroDisciplinar(id);

        document.getElementById('registro-disciplinar-id').value = id;
        document.getElementById('disciplinar-funcionario').value = registro.funcionarioId;
        document.getElementById('disciplinar-data').value = formatarDataParaInput(registro.dataOcorrencia);
        document.getElementById('disciplinar-classificacao').value = registro.classificacao;
        document.getElementById('disciplinar-tipo').value = registro.medidaAplicada;
        document.getElementById('disciplinar-ocorrencia').value = registro.descricao;

    } catch (error) {
        console.error("Erro ao carregar registro para edição:", error);
        mostrarMensagem("Falha ao carregar dados para edição.", "error");
    }
}

// Função para deletar registro
async function deletarRegistroDisciplinar(id) {
    if (!confirm('Tem certeza que deseja excluir este registro disciplinar? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        await db.collection('registros_disciplinares').doc(id).delete();
        mostrarMensagem('Registro disciplinar excluído com sucesso!', 'success');
        await carregarDadosDisciplinares(); // Recarrega a lista e o dashboard
    } catch (error) {
        console.error("Erro ao excluir registro disciplinar:", error);
        mostrarMensagem('Falha ao excluir o registro.', 'error');
    }
}

// Função para visualizar os detalhes de um registro
async function visualizarRegistroDisciplinar(id) {
    try {
        const doc = await db.collection('registros_disciplinares').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }
        const registro = doc.data();

        // Buscar histórico completo do funcionário para exibir no modal
        const historySnap = await db.collection('registros_disciplinares')
            .where('funcionarioId', '==', registro.funcionarioId)
            .orderBy('dataOcorrencia', 'desc')
            .get();

        let historicoHTML = '<div class="list-group list-group-flush mt-3">';
        historySnap.forEach(hDoc => {
            const h = hDoc.data();
            const activeClass = hDoc.id === id ? 'list-group-item-primary' : '';
            historicoHTML += `
                <div class="list-group-item ${activeClass}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${h.medidaAplicada}</h6>
                        <small>${formatarData(h.dataOcorrencia.toDate())}</small>
                    </div>
                    <p class="mb-1 small">Alínea ${h.classificacao}: ${h.descricao}</p>
                </div>
            `;
        });
        historicoHTML += '</div>';

        const corpoModal = `
            <div class="mb-3">
                <h5>${registro.funcionarioNome}</h5>
                <hr>
                <h6>Histórico Disciplinar</h6>
                ${historicoHTML}
            </div>
        `;

        abrirModalGenerico("Detalhes do Registro Disciplinar", corpoModal);

    } catch (error) { 
        console.error("Erro ao visualizar registro:", error);
        mostrarMensagem("Falha ao carregar detalhes do registro.", "error");
    }
}

function formatarDataParaInput(data) {
    if (!data) return '';
    const d = data.toDate ? data.toDate() : new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

async function abrirModalImpressaoDisciplinar() {
    const modalId = 'impressaoDisciplinarModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Imprimir Relatório Disciplinar</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Selecione o funcionário para gerar o relatório completo de seu histórico disciplinar.</p>
                        <div class="mb-3">
                            <label class="form-label">Funcionário</label>
                            <select class="form-select" id="select-imprimir-disciplinar" required></select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirRelatorioDisciplinar()"><i class="fas fa-print"></i> Gerar e Imprimir</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const select = document.getElementById('select-imprimir-disciplinar');
    select.innerHTML = '<option value="">Carregando...</option>';

    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione um funcionário</option>';
        snapshot.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}" data-nome="${doc.data().nome}">${doc.data().nome}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar funcionários para impressão:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function imprimirRelatorioDisciplinar() {
    const select = document.getElementById('select-imprimir-disciplinar');
    const funcionarioId = select.value;
    const funcionarioNome = select.options[select.selectedIndex].dataset.nome;

    if (!funcionarioId) {
        mostrarMensagem("Por favor, selecione um funcionário.", "warning");
        return;
    }

    try {
        const snapshot = await db.collection('registros_disciplinares')
            .where('funcionarioId', '==', funcionarioId)
            .orderBy('dataOcorrencia', 'desc')
            .get();

        let tabelaHTML = '<p class="text-muted">Nenhum registro encontrado para este funcionário.</p>';
        if (!snapshot.empty) {
            tabelaHTML = '<table class="table-custom"><thead><tr><th>Data</th><th>Classificação</th><th>Medida</th><th>Descrição</th></tr></thead><tbody>';
            snapshot.forEach(doc => {
                const reg = doc.data();
                tabelaHTML += `
                    <tr>
                        <td>${formatarData(reg.dataOcorrencia.toDate())}</td>
                        <td><strong>${reg.classificacao || '-'}</strong></td>
                        <td><span class="badge-custom">${reg.medidaAplicada}</span></td>
                        <td>${reg.descricao}</td>
                    </tr>
                `;
            });
            tabelaHTML += '</tbody></table>';
        }

        // Pega a URL do logo para incluir na impressão
        const logoEl = document.getElementById('sidebar-logo');
        const logoUrl = logoEl ? logoEl.src : '';

        const conteudo = `
            <html>
                <head>
                    <title>Relatório Disciplinar - ${funcionarioNome}</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @page { size: A4; margin: 1.5cm; } 
                        body { font-family: 'Segoe UI', sans-serif; color: #333; background: #fff; } 
                        .report-container { max-width: 100%; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #0d6efd; padding-bottom: 20px; }
                        .header h2 { color: #0d6efd; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                        .header p { color: #6c757d; margin: 5px 0 0; font-size: 0.9rem; }
                        .info-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                        .info-label { font-weight: 600; color: #495057; }
                        .info-value { font-weight: 500; color: #212529; }
                        .table-custom { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        .table-custom th { background-color: #0d6efd; color: white; padding: 12px; text-align: left; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; }
                        .table-custom td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 0.9rem; vertical-align: top; }
                        .table-custom tr:last-child td { border-bottom: 2px solid #0d6efd; }
                        .badge-custom { background-color: #e9ecef; color: #495057; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; border: 1px solid #ced4da; }
                        .footer { margin-top: 50px; text-align: center; font-size: 0.8rem; color: #adb5bd; border-top: 1px solid #dee2e6; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <h2>Relatório Disciplinar</h2>
                            <p>Histórico de Ocorrências e Medidas Disciplinares</p>
                        </div>

                        <div class="info-card">
                            <div class="row">
                                <div class="col-md-6 mb-2">
                                    <span class="info-label">Colaborador:</span>
                                    <div class="info-value fs-5">${funcionarioNome}</div>
                                </div>
                                <div class="col-md-6 mb-2 text-md-end">
                                    <span class="info-label">Data de Emissão:</span>
                                    <div class="info-value">${new Date().toLocaleDateString('pt-BR')}</div>
                                </div>
                            </div>
                        </div>

                        <h5 class="mb-3 text-primary" style="font-weight: 600; border-left: 4px solid #0d6efd; padding-left: 10px;">Detalhamento das Ocorrências</h5>
                        ${tabelaHTML}

                        <div class="footer">
                            <p>Documento gerado eletronicamente pelo Sistema Nexter.</p>
                            <p>Confidencial - Uso Interno</p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });

    } catch (error) {
        console.error("Erro ao gerar relatório disciplinar:", error);
        mostrarMensagem("Falha ao gerar o relatório.", "error");
    }
}