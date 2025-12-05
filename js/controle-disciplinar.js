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
});

// Função para carregar dados de controle disciplinar
async function carregarDadosDisciplinares() {
    console.log('Carregando dados de controle disciplinar...');
    let todosRegistros = []; // Para usar no dashboard

    const tbody = document.getElementById('tabela-controle-disciplinar');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const snapshot = await db.collection('registros_disciplinares').orderBy('dataOcorrencia', 'desc').get();

        if (snapshot.empty) {
            gerarDashboardDisciplinar([]); // Gera dashboard vazio
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro disciplinar encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
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

    // TODO: Implementar lógica para carregar dados se for edição (id != null)

    modal.show();
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

        const corpoModal = `
            <div class="row">
                <div class="col-md-6 mb-3"><strong>Funcionário:</strong><p>${registro.funcionarioNome}</p></div>
                <div class="col-md-6 mb-3"><strong>Data da Ocorrência:</strong><p>${formatarData(registro.dataOcorrencia.toDate())}</p></div>
                <div class="col-12 mb-3"><strong>Classificação (CLT):</strong><p>Alínea ${registro.classificacao}</p></div>
                <div class="col-12 mb-3"><strong>Medida Aplicada:</strong><p><span class="badge bg-warning text-dark">${registro.medidaAplicada}</span></p></div>
                <div class="col-12"><strong>Descrição da Ocorrência:</strong><p style="white-space: pre-wrap;">${registro.descricao}</p></div>
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
            tabelaHTML = '<table class="table table-bordered table-sm"><thead><tr><th>Data</th><th>Classificação</th><th>Medida</th><th>Descrição</th></tr></thead><tbody>';
            snapshot.forEach(doc => {
                const reg = doc.data();
                tabelaHTML += `
                    <tr>
                        <td>${formatarData(reg.dataOcorrencia.toDate())}</td>
                        <td>${reg.classificacao || '-'}</td>
                        <td>${reg.medidaAplicada}</td>
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
                    <style>ge { size: A4; margin: 1cm; } 
                        body { font-family: 'Segoe UI', sans-serif; color: #333; } 
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
                        .header img { max-height: 60px; max-width: 200px; }
                        .header h2 { color: #0056b3; margin: 0; font-weight: 600; }
                        .info-section p { margin-bottom: 5px; }
                        .table { font-size: 0.9rem; }
                        .table th { background-color: #f2f2f2; }
                        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #888; }
                    </style>
                </head>
                <body>
                    < 
                    <div class="info-section mb-4">
                        <p><strong>Funcionário:</strong> ${funcionarioNome}</p>
                        <p><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>

                    ${tabelaHTML}

                    <div class="footer">
                        <p>NEXTER - O Controle em suas mãos</p>
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