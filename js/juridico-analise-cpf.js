// ========================================
// Módulo: Jurídico - Análise Pública de CPF
// ========================================

async function inicializarAnaliseCPF() {
    console.log("Inicializando Análise de CPF...");
    await carregarHistoricoAnalises();
}

async function carregarHistoricoAnalises() {
    const tbody = document.getElementById('tabela-historico-analises');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando histórico...</td></tr>';

    try {
        const snapshot = await db.collection('analises_juridicas')
            .orderBy('dataExecucao', 'desc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma análise realizada.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const analise = doc.data();
            const data = analise.dataExecucao ? analise.dataExecucao.toDate().toLocaleString('pt-BR') : '-';
            
            let statusBadge = '<span class="badge bg-secondary">Desconhecido</span>';
            if (analise.status === 'Concluido') statusBadge = '<span class="badge bg-success">Concluído</span>';
            else if (analise.status === 'Em Andamento') statusBadge = '<span class="badge bg-warning text-dark">Em Andamento</span>';
            else if (analise.status === 'Erro') statusBadge = '<span class="badge bg-danger">Erro</span>';

            const row = `
                <tr>
                    <td>${data}</td>
                    <td>${analise.cpf}</td>
                    <td>${analise.solicitante || 'Sistema'}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="visualizarRelatorioAnalise('${doc.id}')" title="Ver Relatório">
                            <i class="fas fa-file-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar histórico.</td></tr>';
    }
}

function abrirModalNovaAnalise() {
    const modalId = 'novaAnaliseCPFModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-dark text-white">
                        <h5 class="modal-title"><i class="fas fa-search me-2"></i>Nova Análise de CPF</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info small">
                            <i class="fas fa-info-circle"></i> Esta funcionalidade realiza uma varredura em fontes públicas. O processo pode levar alguns minutos.
                        </div>
                        <div class="mb-3">
                            <label class="form-label">CPF do Indivíduo</label>
                            <input type="text" class="form-control" id="analise-cpf-input" placeholder="000.000.000-00" oninput="mascaraCPF(this)">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Motivo da Consulta (Interno)</label>
                            <select class="form-select" id="analise-motivo">
                                <option value="Atualização Cadastral">Atualização Cadastral</option>
                                <option value="Processo Seletivo">Processo Seletivo</option>
                                <option value="Compliance">Compliance</option>
                                <option value="Outro">Outro</option>
                            </select>
                        </div>
                        <div id="analise-progress-container" style="display: none;">
                            <label class="form-label small">Executando varredura...</label>
                            <div class="progress mb-2">
                                <div id="analise-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                            </div>
                            <div id="analise-status-text" class="small text-muted">Iniciando...</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="btn-cancelar-analise">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="executarAnaliseCPF()" id="btn-executar-analise">
                            <i class="fas fa-play me-2"></i> Iniciar Análise
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    // Reset
    document.getElementById('analise-cpf-input').value = '';
    document.getElementById('analise-progress-container').style.display = 'none';
    document.getElementById('btn-executar-analise').disabled = false;
    document.getElementById('btn-cancelar-analise').disabled = false;
    document.getElementById('analise-cpf-input').disabled = false;

    new bootstrap.Modal(modalEl).show();
}

function mascaraCPF(i) {
    let v = i.value;
    if (isNaN(v[v.length - 1])) {
        i.value = v.substring(0, v.length - 1);
        return;
    }
    i.setAttribute("maxlength", "14");
    v = v.replace(/\D/g, "");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    i.value = v;
}

async function executarAnaliseCPF() {
    const cpf = document.getElementById('analise-cpf-input').value;
    const motivo = document.getElementById('analise-motivo').value;

    if (cpf.length < 14) {
        mostrarMensagem("CPF inválido.", "warning");
        return;
    }

    // UI Update
    document.getElementById('analise-progress-container').style.display = 'block';
    document.getElementById('btn-executar-analise').disabled = true;
    document.getElementById('btn-cancelar-analise').disabled = true;
    document.getElementById('analise-cpf-input').disabled = true;

    const progressBar = document.getElementById('analise-progress-bar');
    const statusText = document.getElementById('analise-status-text');

    try {
        // Simulação de Varredura Progressiva (Backend Simulation)
        const fontes = [
            "Receita Federal (Situação Cadastral)",
            "Tribunais de Justiça Estaduais (TJ)",
            "Tribunais Regionais Federais (TRF)",
            "Tribunais do Trabalho (TRT)",
            "Tribunais Superiores (STJ, STF, TST)",
            "Diários Oficiais",
            "Portais de Transparência"
        ];

        for (let i = 0; i < fontes.length; i++) {
            statusText.textContent = `Consultando: ${fontes[i]}...`;
            const progress = ((i + 1) / fontes.length) * 100;
            progressBar.style.width = `${progress}%`;
            
            // Simula delay de rede variável
            await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));
        }

        statusText.textContent = "Consolidando resultados...";
        await new Promise(r => setTimeout(r, 500));

        // Gera dados simulados (Mock)
        const resultado = gerarResultadoSimulado(cpf);

        // Salva no Firestore
        const docRef = await db.collection('analises_juridicas').add({
            cpf: cpf,
            motivo: motivo,
            dataExecucao: firebase.firestore.FieldValue.serverTimestamp(),
            solicitante: firebase.auth().currentUser.email,
            solicitanteUid: firebase.auth().currentUser.uid,
            status: 'Concluido',
            resultado: resultado
        });

        mostrarMensagem("Análise concluída com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('novaAnaliseCPFModal')).hide();
        
        await carregarHistoricoAnalises();
        visualizarRelatorioAnalise(docRef.id);

    } catch (error) {
        console.error("Erro na análise:", error);
        mostrarMensagem("Erro ao executar análise.", "error");
        document.getElementById('btn-executar-analise').disabled = false;
        document.getElementById('btn-cancelar-analise').disabled = false;
    }
}

function gerarResultadoSimulado(cpf) {
    // Esta função simula o retorno de uma API de scraping
    const temProcesso = Math.random() > 0.5; // 50% de chance de ter processo
    
    const processos = [];
    if (temProcesso) {
        processos.push({
            numero: "0012345-88.2023.8.26.0100",
            tribunal: "TJSP",
            tipo: "Cível",
            classe: "Execução de Título Extrajudicial",
            situacao: "Em andamento",
            dataUltimaMovimentacao: new Date().toISOString()
        });
        if (Math.random() > 0.7) {
             processos.push({
                numero: "1000567-12.2021.5.02.0001",
                tribunal: "TRT-2",
                tipo: "Trabalhista",
                classe: "Ação Trabalhista - Rito Ordinário",
                situacao: "Arquivado",
                dataUltimaMovimentacao: "2022-05-15T10:00:00.000Z"
            });
        }
    }

    return {
        idConsulta: 'REQ-' + Date.now(),
        cpf: cpf,
        scoreConfianca: 0.95,
        categorias: {
            identidade: { situacao: "Regular", nome: "NOME SIMULADO DO INDIVIDUO" },
            penal: [], // Simulação limpa para penal
            legal: processos
        },
        fontesConsultadas: ["TJSP", "TRF3", "TRT2", "STJ", "STF", "Receita Federal"],
        limitacoes: ["Consulta ao TJ-RJ indisponível no momento"],
        observacao: processos.length > 0 ? "Constam processos públicos associados ao CPF." : "Nada consta nas bases consultadas.",
        isencao: "Este relatório é gerado a partir de informações públicas disponíveis, com finalidade exclusivamente informativa e operacional. Não constitui certidão oficial de antecedentes criminais, nem estabelece culpa, condenação ou inocência."
    };
}

async function visualizarRelatorioAnalise(id) {
    try {
        const doc = await db.collection('analises_juridicas').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Análise não encontrada.", "error");
            return;
        }
        const dados = doc.data();
        const resultado = dados.resultado;

        // Renderização do Relatório
        let processosHtml = '';
        if (resultado.categorias.legal.length > 0 || resultado.categorias.penal.length > 0) {
            const todosProcessos = [...resultado.categorias.legal, ...resultado.categorias.penal];
            processosHtml = `
                <div class="table-responsive mt-3">
                    <table class="table table-bordered table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>Tribunal</th>
                                <th>Número do Processo</th>
                                <th>Tipo/Classe</th>
                                <th>Situação</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${todosProcessos.map(p => `
                                <tr>
                                    <td>${p.tribunal}</td>
                                    <td>${p.numero}</td>
                                    <td>${p.tipo} / ${p.classe}</td>
                                    <td><span class="badge ${p.situacao === 'Arquivado' ? 'bg-secondary' : 'bg-warning text-dark'}">${p.situacao}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            processosHtml = '<div class="alert alert-success mt-3"><i class="fas fa-check-circle"></i> Nenhum processo encontrado nas bases consultadas.</div>';
        }

        const limitacoesHtml = resultado.limitacoes && resultado.limitacoes.length > 0 
            ? `<div class="alert alert-warning small mt-2"><i class="fas fa-exclamation-triangle"></i> <strong>Limitações:</strong> ${resultado.limitacoes.join(', ')}</div>` 
            : '';

        const conteudoRelatorio = `
            <div class="container-fluid p-4" style="background: #fff;">
                <div class="text-center border-bottom pb-3 mb-3">
                    <h4 class="mb-0">Relatório de Análise Jurídica Pública</h4>
                    <small class="text-muted">ID: ${resultado.idConsulta} | Data: ${new Date(dados.dataExecucao.toDate()).toLocaleString('pt-BR')}</small>
                </div>

                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-body">
                                <h6 class="card-title text-primary">Dados da Consulta</h6>
                                <p class="mb-1"><strong>CPF:</strong> ${resultado.cpf}</p>
                                <p class="mb-1"><strong>Nome (Receita):</strong> ${resultado.categorias.identidade.nome}</p>
                                <p class="mb-0"><strong>Situação Cadastral:</strong> ${resultado.categorias.identidade.situacao}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100 border-0 bg-light">
                            <div class="card-body">
                                <h6 class="card-title text-primary">Resumo da Análise</h6>
                                <p class="mb-1"><strong>Score de Confiança:</strong> ${(resultado.scoreConfianca * 100).toFixed(0)}%</p>
                                <p class="mb-1"><strong>Fontes Consultadas:</strong> ${resultado.fontesConsultadas.length}</p>
                                <p class="mb-0"><strong>Observação:</strong> ${resultado.observacao}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <h5 class="border-bottom pb-2">Detalhamento Processual</h5>
                ${processosHtml}
                ${limitacoesHtml}

                <div class="mt-5 p-3 bg-light border rounded small text-muted text-justify">
                    <strong>Isenção Jurídica Obrigatória:</strong><br>
                    ${resultado.isencao}
                </div>

                <div class="text-center mt-4 no-print">
                    <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Imprimir Relatório</button>
                </div>
            </div>
        `;

        abrirModalGenerico("Relatório de Análise", conteudoRelatorio);

    } catch (error) {
        console.error("Erro ao visualizar relatório:", error);
        mostrarMensagem("Erro ao gerar relatório.", "error");
    }
}

// Exportar funções
window.inicializarAnaliseCPF = inicializarAnaliseCPF;
window.abrirModalNovaAnalise = abrirModalNovaAnalise;
window.executarAnaliseCPF = executarAnaliseCPF;
window.visualizarRelatorioAnalise = visualizarRelatorioAnalise;
window.mascaraCPF = mascaraCPF;