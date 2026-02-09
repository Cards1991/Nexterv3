// ========================================
// Módulo: Avaliação de Experiência
// ========================================

async function inicializarAvaliacaoExperiencia() {
    console.log("Inicializando Avaliação de Experiência...");
    await carregarPainelExperiencia();
    
    // Configurar listeners
    const btnSalvar = document.getElementById('btn-salvar-avaliacao-exp');
    if (btnSalvar && !btnSalvar.bound) {
        btnSalvar.textContent = 'Salvar Avaliação';
        btnSalvar.addEventListener('click', salvarAvaliacaoExperiencia);
        btnSalvar.bound = true;
    }
}

async function carregarPainelExperiencia() {
    const container = document.getElementById('lista-pendencias-experiencia');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Verificando contratos...</td></tr>';

    try {
        // Obter valores dos filtros
        const filtroInicio = document.getElementById('filtro-exp-inicio')?.value;
        const filtroFim = document.getElementById('filtro-exp-fim')?.value;
        const filtroPeriodo = document.getElementById('filtro-exp-periodo')?.value;

        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        // Buscar funcionários ativos
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();

        let pendencias = [];
        let totalEmExperiencia = 0;

        snapshot.forEach(doc => {
            const func = { id: doc.id, ...doc.data() };
            
            if (!func.dataAdmissao) return;
            
            const admissao = func.dataAdmissao.toDate ? func.dataAdmissao.toDate() : new Date(func.dataAdmissao);
            admissao.setHours(0, 0, 0, 0); // Normalizar hora para cálculo correto de dias
            
            // Calcular datas de vencimento (contando o primeiro dia)
            const vencimento45 = new Date(admissao);
            vencimento45.setDate(admissao.getDate() + 44);

            const vencimento90 = new Date(admissao);
            vencimento90.setDate(admissao.getDate() + 89);

            // Verificar se está no período de experiência (até 90 dias após admissão)
            if (hoje <= vencimento90) {
                totalEmExperiencia++;
            }

            // Lógica para identificar pendências
            // Verifica 1º Período (45 dias)
            const diasPara45 = Math.ceil((vencimento45 - hoje) / (1000 * 60 * 60 * 24));

            let mostrar45 = false;

            // Lógica de filtro
            if (filtroInicio || filtroFim) {
                // Se tem filtro de data, respeita o intervalo (desde que não esteja vencido há muito tempo, opcional)
                const dataIni = filtroInicio ? new Date(filtroInicio) : new Date('2000-01-01');
                const dataFim = filtroFim ? new Date(filtroFim) : new Date('2100-01-01');
                if (vencimento45 >= dataIni && vencimento45 <= dataFim && diasPara45 >= -2) mostrar45 = true; // Sempre 2 dias antes
            } else {
                // Padrão: Próximos 10 dias + 2 dias antes
                if (diasPara45 <= 10 && diasPara45 >= -2) mostrar45 = true;
            }

            if (mostrar45 && (!filtroPeriodo || filtroPeriodo === '45')) {
                pendencias.push({
                    ...func,
                    periodo: 45,
                    vencimento: vencimento45,
                    diasRestantes: diasPara45,
                    responsavel: func.responsavelAvaliacao45
                });
            }

            // Verifica 2º Período (90 dias)
            const diasPara90 = Math.ceil((vencimento90 - hoje) / (1000 * 60 * 60 * 24));
            
            let mostrar90 = false;
            if (filtroInicio || filtroFim) {
                const dataIni = filtroInicio ? new Date(filtroInicio) : new Date('2000-01-01');
                const dataFim = filtroFim ? new Date(filtroFim) : new Date('2100-01-01');
                if (vencimento90 >= dataIni && vencimento90 <= dataFim && diasPara90 >= -2) mostrar90 = true; // Sempre 2 dias antes
            } else {
                // Padrão: Próximos 10 dias + 2 dias antes
                if (diasPara90 <= 10 && diasPara90 >= -2) mostrar90 = true;
            }

            if (mostrar90 && (!filtroPeriodo || filtroPeriodo === '90')) {
                pendencias.push({
                    ...func,
                    periodo: 90,
                    vencimento: vencimento90,
                    diasRestantes: diasPara90,
                    responsavel: func.responsavelAvaliacao90
                });
            }
        });

        // Ordenar por urgência (menor dias restantes)
        pendencias.sort((a, b) => a.diasRestantes - b.diasRestantes);

        renderizarTabelaExperiencia(pendencias);
        atualizarKPIsExperiencia(totalEmExperiencia, pendencias.length);
        carregarDashboardExperienciaAnalitico();
        carregarAvaliacoesConcluidas(); // Carrega o novo histórico

    } catch (error) {
        console.error("Erro ao carregar painel de experiência:", error);
        container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function renderizarTabelaExperiencia(lista) {
    const container = document.getElementById('lista-pendencias-experiencia');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma avaliação pendente no momento.</td></tr>';
        return;
    }

    container.innerHTML = lista.map(item => {
        let statusBadge = '';
        if (item.diasRestantes < 0) statusBadge = `<span class="badge bg-danger">Vencido há ${Math.abs(item.diasRestantes)} dias</span>`;
        else if (item.diasRestantes <= 5) statusBadge = `<span class="badge bg-warning text-dark">Vence em ${item.diasRestantes} dias</span>`;
        else statusBadge = `<span class="badge bg-info text-dark">Vence em ${item.diasRestantes} dias</span>`;

        let responsavelInfo = '';
        if (item.responsavel) {
            responsavelInfo = `<div class="small text-muted"><i class="fas fa-user-tag"></i> ${item.responsavel.nome}</div>`;
        }

        return `
            <tr>
                <td>
                    <div class="fw-bold">${item.nome}</div>
                    <small class="text-muted">${item.setor || '-'} / ${item.cargo || '-'}</small>
                </td>
                <td>${new Date(item.dataAdmissao.toDate()).toLocaleDateString('pt-BR')}</td>
                <td><span class="badge bg-secondary">${item.periodo} Dias</span></td>
                <td>
                    ${item.vencimento.toLocaleDateString('pt-BR')}
                    ${responsavelInfo}
                </td>
                <td>${statusBadge}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="abrirModalAtribuicaoExperiencia('${item.id}', '${item.nome}', ${item.periodo})" title="Atribuir Responsável">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="abrirModalAvaliacaoExperiencia('${item.id}', '${item.nome}', ${item.periodo})">
                        <i class="fas fa-clipboard-check"></i> Avaliar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarKPIsExperiencia(total, pendentes) {
    const elTotal = document.getElementById('exp-kpi-total');
    const elPendentes = document.getElementById('exp-kpi-pendentes');
    if (elTotal) elTotal.textContent = total;
    if (elPendentes) elPendentes.textContent = pendentes;
}

async function abrirModalAvaliacaoExperiencia(id, nome, periodo) {
    const modalEl = document.getElementById('modalAvaliacaoExperiencia');
    const form = document.getElementById('form-avaliacao-experiencia');
    form.reset();

    document.getElementById('aval-exp-funcionario-id').value = id;
    document.getElementById('aval-exp-periodo').value = periodo;
    document.getElementById('aval-exp-titulo').textContent = `Avaliação de Experiência - ${periodo} Dias`;
    document.getElementById('aval-exp-nome').value = nome;
    document.getElementById('aval-exp-data').valueAsDate = new Date();

    new bootstrap.Modal(modalEl).show();
}

async function salvarAvaliacaoExperiencia() {
    const funcionarioId = document.getElementById('aval-exp-funcionario-id').value;
    const periodo = parseInt(document.getElementById('aval-exp-periodo').value);
    const dataAvaliacao = document.getElementById('aval-exp-data').value;
    const resultado = document.getElementById('aval-exp-resultado').value;
    const observacoes = document.getElementById('aval-exp-obs').value;
    const nomeFuncionario = document.getElementById('aval-exp-nome').value;

    // Buscar setor do funcionário
    let setorFuncionario = 'Não informado';
    let gerenteSetor = '_________________________';
    const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
    if (funcDoc.exists) {
        setorFuncionario = funcDoc.data().setor || 'Não informado';
        // Buscar o gerente do setor
        const setorQuery = await db.collection('setores').where('descricao', '==', setorFuncionario).limit(1).get();
        if (!setorQuery.empty) {
            const setorData = setorQuery.docs[0].data();
            gerenteSetor = setorData.gerenteResponsavel || '_________________________';
        }
    }


    const criterios = ['assiduidade', 'pontualidade', 'produtividade', 'relacionamento', 'iniciativa'];
    const notas = {};
    let media = 0;
    
    criterios.forEach(c => {
        const val = parseInt(document.querySelector(`input[name="aval-${c}"]:checked`)?.value || 0);
        notas[c] = val;
        media += val;
    });
    media = media / criterios.length;

    if (media === 0) {
        alert("Por favor, avalie todos os critérios.");
        return;
    }

    try {
        const avaliacaoData = {
            funcionarioId,
            periodo,
            dataAvaliacao: new Date(dataAvaliacao + 'T00:00:00'),
            notas,
            media,
            resultado,
            observacoes,
            avaliadorUid: firebase.auth().currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('avaliacoes_experiencia').add(avaliacaoData);
        
        bootstrap.Modal.getInstance(document.getElementById('modalAvaliacaoExperiencia')).hide();
        mostrarMensagem("Avaliação registrada com sucesso!", "success");
        carregarPainelExperiencia();

        // Opções de Impressão
        if (confirm("Deseja imprimir o formulário de avaliação?")) {
            imprimirAvaliacaoExperiencia(avaliacaoData, nomeFuncionario, setorFuncionario, gerenteSetor);
        }
        if (resultado === 'Aprovado' && confirm("O colaborador foi aprovado! Deseja imprimir a carta de parabenização?")) {
            imprimirCartaParabenizacao(nomeFuncionario, periodo);
        }

        carregarAvaliacoesConcluidas(); // Atualiza o histórico

    } catch (error) {
        console.error("Erro ao salvar avaliação:", error);
        mostrarMensagem("Erro ao salvar avaliação.", "error");
    }
}

async function carregarDashboardExperienciaAnalitico() {
    const ctx = document.getElementById('grafico-experiencia-resultado')?.getContext('2d');
    if (!ctx) return;

    try {
        const snap = await db.collection('avaliacoes_experiencia').get();
        const dados = { Aprovado: 0, Reprovado: 0, Prorrogado: 0 };
        
        snap.forEach(doc => {
            const r = doc.data().resultado;
            if (dados[r] !== undefined) dados[r]++;
        });

        if (window.chartExperiencia) window.chartExperiencia.destroy();

        window.chartExperiencia = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(dados),
                datasets: [{
                    data: Object.values(dados),
                    backgroundColor: ['#28a745', '#dc3545', '#ffc107']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });

    } catch (e) {
        console.error("Erro dashboard analítico:", e);
    }
}

// --- Funções de Impressão ---

function imprimirAvaliacaoExperiencia(dados, nome, setor, gerenteSetor = '_________________________') {
    const dataFormatada = dados.dataAvaliacao.toLocaleDateString('pt-BR');
    
    const conteudo = `
        <html>
        <head>
            <title>Avaliação de Experiência - ${nome}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .info-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #dee2e6; }
                .criteria-table { width: 100%; margin-bottom: 20px; }
                .criteria-table th, .criteria-table td { padding: 10px; border-bottom: 1px solid #dee2e6; }
                .result-box { text-align: center; padding: 15px; border: 2px solid #333; margin-top: 20px; font-weight: bold; font-size: 1.2em; }
                .signatures { margin-top: 80px; display: flex; justify-content: space-between; }
                .sig-line { border-top: 1px solid #333; width: 45%; text-align: center; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h3>AVALIAÇÃO DE CONTRATO DE EXPERIÊNCIA</h3>
                <p class="mb-0 text-muted">${dados.periodo} Dias</p>
            </div>

            <div class="info-box">
                <div class="row">
                    <div class="col-8"><strong>Colaborador:</strong> ${nome}</div>
                    <div class="col-4"><strong>Data:</strong> ${dataFormatada}</div>
                    <div class="col-12 mt-2"><strong>Setor:</strong> ${setor}</div>
                </div>
            </div>

            <h5>Critérios Avaliados (1 a 5)</h5>
            <table class="criteria-table">
                <thead><tr><th>Critério</th><th class="text-center">Nota</th></tr></thead>
                <tbody>
                    <tr><td>Assiduidade</td><td class="text-center">${dados.notas.assiduidade}</td></tr>
                    <tr><td>Pontualidade</td><td class="text-center">${dados.notas.pontualidade}</td></tr>
                    <tr><td>Produtividade</td><td class="text-center">${dados.notas.produtividade}</td></tr>
                    <tr><td>Relacionamento Interpessoal</td><td class="text-center">${dados.notas.relacionamento}</td></tr>
                    <tr><td>Iniciativa</td><td class="text-center">${dados.notas.iniciativa}</td></tr>
                </tbody>
                <tfoot>
                    <tr class="table-light"><th>Média Final</th><th class="text-center">${dados.media.toFixed(1)}</th></tr>
                </tfoot>
            </table>

            <div class="mb-4">
                <strong>Observações do Avaliador:</strong>
                <p class="border p-2 rounded" style="min-height: 60px;">${dados.observacoes || 'Sem observações.'}</p>
            </div>

            <div class="result-box">
                PARECER FINAL: ${dados.resultado.toUpperCase()}
            </div>

            <div class="signatures">
                <div class="sig-line">
                    ${gerenteSetor}<br>
                    <small>Assinatura</small>
                </div>
                <div class="sig-line">
                    <small>Assinatura</small>
                </div>
            </div>
        </body>
        </html>
    `;
    
    openPrintWindow(conteudo, { autoPrint: true });
}

function imprimirCartaParabenizacao(nome, periodo) {
    const conteudo = `
        <html>
        <head>
            <title>Parabéns - ${nome}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: 'Georgia', serif; padding: 60px; text-align: center; color: #333; background-image: url('assets/bg-confetti.png'); background-size: cover; }
                .container { border: 5px double #d4af37; padding: 40px; border-radius: 15px; background: rgba(255,255,255,0.95); }
                h1 { color: #d4af37; font-size: 3em; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
                .name { font-size: 2em; font-weight: bold; color: #2c3e50; margin: 20px 0; }
                .message { font-size: 1.2em; line-height: 1.8; margin-bottom: 40px; }
                .footer { margin-top: 60px; font-style: italic; color: #7f8c8d; }
                .logo { max-height: 80px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Se tiver logo, pode descomentar abaixo -->
                <!-- <img src="assets/logo.png" class="logo"> -->
                
                <h1>Parabéns!</h1>
                
                <div class="name">${nome}</div>
                
                <div class="message">
                    <p>É com grande satisfação que informamos a aprovação do seu período de experiência de <strong>${periodo} dias</strong>!</p>
                    <p>Seu desempenho, dedicação e comprometimento têm sido fundamentais para o nosso time. Estamos muito felizes em tê-lo(a) conosco e confiantes de que continuaremos construindo uma trajetória de sucesso juntos.</p>
                    <p>Continue dando o seu melhor. O seu crescimento é o nosso crescimento!</p>
                </div>

                <div class="footer">
                    <p>Atenciosamente,</p>
                    <p><strong>Diretoria e Recursos Humanos</strong></p>
                    <p>Calçados Crival</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    openPrintWindow(conteudo, { autoPrint: true });
}

// --- HISTÓRICO DE AVALIAÇÕES ---

async function carregarAvaliacoesConcluidas() {
    const tbody = document.getElementById('tabela-avaliacoes-concluidas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const snap = await db.collection('avaliacoes_experiencia').orderBy('dataAvaliacao', 'desc').get();
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma avaliação concluída encontrada.</td></tr>';
            return;
        }

        const funcSnap = await db.collection('funcionarios').get();
        const funcMap = new Map(funcSnap.docs.map(doc => [doc.id, doc.data().nome]));

        tbody.innerHTML = '';
        snap.forEach(doc => {
            const avaliacao = doc.data();
            const nomeFunc = funcMap.get(avaliacao.funcionarioId) || 'Funcionário não encontrado';
            
            const getResultadoClass = (resultado) => {
                if (resultado === 'Aprovado') return 'bg-success';
                if (resultado === 'Reprovado') return 'bg-danger';
                if (resultado === 'Prorrogado') return 'bg-warning text-dark';
                return 'bg-secondary';
            };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${nomeFunc}</td>
                <td>${avaliacao.periodo} Dias</td>
                <td>${avaliacao.dataAvaliacao.toDate().toLocaleDateString('pt-BR')}</td>
                <td><span class="badge ${getResultadoClass(avaliacao.resultado)}">${avaliacao.resultado}</span></td>
                <td>${avaliacao.media.toFixed(1)}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="visualizarAvaliacao('${doc.id}')" title="Visualizar/Imprimir Avaliação"><i class="fas fa-eye"></i></button>
                        ${avaliacao.resultado === 'Aprovado' ? `<button class="btn btn-outline-success" onclick="reimprimirCarta('${doc.id}')" title="Reimprimir Carta"><i class="fas fa-award"></i></button>` : ''}
                        <button class="btn btn-outline-primary" onclick="editarAvaliacao('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-danger" onclick="excluirAvaliacao('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {
        console.error("Erro ao carregar avaliações concluídas:", e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar histórico.</td></tr>';
    }
}

async function visualizarAvaliacao(id) {
    try {
        const doc = await db.collection('avaliacoes_experiencia').doc(id).get();
        if (!doc.exists) return;
        const avaliacao = doc.data();
        
        const funcDoc = await db.collection('funcionarios').doc(avaliacao.funcionarioId).get();
        const nomeFunc = funcDoc.exists ? funcDoc.data().nome : 'N/A';
        const setorFunc = funcDoc.exists ? funcDoc.data().setor : 'N/A';

        let gerenteSetor = '_________________________';
        if (setorFunc !== 'N/A') {
            const setorQuery = await db.collection('setores').where('descricao', '==', setorFunc).limit(1).get();
            if (!setorQuery.empty) {
                gerenteSetor = setorQuery.docs[0].data().gerenteResponsavel || '_________________________';
            }
        }
        
        imprimirAvaliacaoExperiencia(avaliacao, nomeFunc, setorFunc, gerenteSetor);
    } catch (e) {
        console.error("Erro ao visualizar avaliação:", e);
        mostrarMensagem("Erro ao carregar dados para visualização.", "error");
    }
}

async function editarAvaliacao(id) {
    try {
        const doc = await db.collection('avaliacoes_experiencia').doc(id).get();
        if (!doc.exists) return;
        const avaliacao = doc.data();
        
        const funcDoc = await db.collection('funcionarios').doc(avaliacao.funcionarioId).get();
        const nomeFunc = funcDoc.exists ? funcDoc.data().nome : 'Funcionário não encontrado';

        await abrirModalAvaliacaoExperiencia(avaliacao.funcionarioId, nomeFunc, avaliacao.periodo);
        
        // Preencher campos do modal
        document.getElementById('aval-exp-data').value = avaliacao.dataAvaliacao.toDate().toISOString().split('T')[0];
        document.getElementById('aval-exp-resultado').value = avaliacao.resultado;
        document.getElementById('aval-exp-obs').value = avaliacao.observacoes;
        for (const criterio in avaliacao.notas) {
            const radio = document.querySelector(`input[name="aval-${criterio}"][value="${avaliacao.notas[criterio]}"]`);
            if (radio) radio.checked = true;
        }

        // Mudar botão para atualizar
        const btn = document.getElementById('btn-salvar-avaliacao-exp');
        btn.textContent = 'Atualizar Avaliação';
        btn.onclick = () => atualizarAvaliacao(id);

    } catch (e) {
        console.error("Erro ao carregar para edição:", e);
    }
}

async function atualizarAvaliacao(id) {
    const dadosForm = {
        dataAvaliacao: new Date(document.getElementById('aval-exp-data').value + 'T00:00:00'),
        resultado: document.getElementById('aval-exp-resultado').value,
        observacoes: document.getElementById('aval-exp-obs').value,
        notas: {},
        media: 0
    };

    const criterios = ['assiduidade', 'pontualidade', 'produtividade', 'relacionamento', 'iniciativa'];
    criterios.forEach(c => {
        const val = parseInt(document.querySelector(`input[name="aval-${c}"]:checked`)?.value || 0);
        dadosForm.notas[c] = val;
        dadosForm.media += val;
    });
    dadosForm.media /= criterios.length;

    try {
        await db.collection('avaliacoes_experiencia').doc(id).update(dadosForm);
        bootstrap.Modal.getInstance(document.getElementById('modalAvaliacaoExperiencia')).hide();
        mostrarMensagem("Avaliação atualizada com sucesso!", "success");
        carregarAvaliacoesConcluidas();
    } catch (e) {
        console.error("Erro ao atualizar:", e);
    }
}

async function excluirAvaliacao(id) {
    if (confirm('Tem certeza que deseja excluir permanentemente esta avaliação?')) {
        await db.collection('avaliacoes_experiencia').doc(id).delete();
        mostrarMensagem('Avaliação excluída.');
        carregarAvaliacoesConcluidas();
    }
}

async function reimprimirCarta(id) {
    const doc = await db.collection('avaliacoes_experiencia').doc(id).get();
    if (!doc.exists) return;
    const avaliacao = doc.data();
    
    const funcDoc = await db.collection('funcionarios').doc(avaliacao.funcionarioId).get();
    const nomeFunc = funcDoc.exists ? funcDoc.data().nome : 'N/A';
    
    imprimirCartaParabenizacao(nomeFunc, avaliacao.periodo);
}

// Funções de Atribuição
async function abrirModalAtribuicaoExperiencia(id, nome, periodo) {
    const modalEl = document.getElementById('modalAtribuicaoExperiencia');
    if (!modalEl) return;

    document.getElementById('attrib-exp-funcionario-id').value = id;
    document.getElementById('attrib-exp-periodo').value = periodo;
    document.getElementById('attrib-exp-nome').value = nome;
    
    const select = document.getElementById('attrib-exp-usuario');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione um usuário</option>';
        usersSnap.forEach(doc => {
            const user = doc.data();
            if (user.nome) {
                select.innerHTML += `<option value="${doc.id}">${user.nome}</option>`;
            }
        });
    } catch (e) {
        console.error("Erro ao carregar usuários:", e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    new bootstrap.Modal(modalEl).show();
}

async function salvarAtribuicaoExperiencia() {
    const funcId = document.getElementById('attrib-exp-funcionario-id').value;
    const periodo = parseInt(document.getElementById('attrib-exp-periodo').value);
    const usuarioSelect = document.getElementById('attrib-exp-usuario');
    const usuarioId = usuarioSelect.value;
    const usuarioNome = usuarioSelect.options[usuarioSelect.selectedIndex].text;

    if (!usuarioId) {
        mostrarMensagem("Selecione um usuário.", "warning");
        return;
    }

    try {
        const updateData = {};
        if (periodo === 45) {
            updateData.responsavelAvaliacao45 = { uid: usuarioId, nome: usuarioNome };
        } else {
            updateData.responsavelAvaliacao90 = { uid: usuarioId, nome: usuarioNome };
        }

        await db.collection('funcionarios').doc(funcId).update(updateData);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAtribuicaoExperiencia'));
        if (modal) modal.hide();
        
        mostrarMensagem("Atribuição salva com sucesso!", "success");
        carregarPainelExperiencia();

    } catch (e) {
        console.error("Erro ao salvar atribuição:", e);
        mostrarMensagem("Erro ao salvar atribuição.", "error");
    }
}

// Exportar funções
window.inicializarAvaliacaoExperiencia = inicializarAvaliacaoExperiencia;
window.abrirModalAvaliacaoExperiencia = abrirModalAvaliacaoExperiencia;
window.salvarAvaliacaoExperiencia = salvarAvaliacaoExperiencia;
window.abrirModalAtribuicaoExperiencia = abrirModalAtribuicaoExperiencia;
window.salvarAtribuicaoExperiencia = salvarAtribuicaoExperiencia;
window.visualizarAvaliacao = visualizarAvaliacao;
window.editarAvaliacao = editarAvaliacao;
window.excluirAvaliacao = excluirAvaliacao;
window.reimprimirCarta = reimprimirCarta;