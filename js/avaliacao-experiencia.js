// ========================================
// Módulo: Avaliação de Experiência
// ========================================

async function inicializarAvaliacaoExperiencia() {
    console.log("Inicializando Avaliação de Experiência...");
    await carregarPainelExperiencia();
    
    // Configurar listeners
    const btnSalvar = document.getElementById('btn-salvar-avaliacao-exp');
    if (btnSalvar && !btnSalvar.bound) {
        btnSalvar.addEventListener('click', salvarAvaliacaoExperiencia);
        btnSalvar.bound = true;
    }
}

async function carregarPainelExperiencia() {
    const container = document.getElementById('lista-pendencias-experiencia');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Verificando contratos...</td></tr>';

    try {
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
            
            // Calcular datas de vencimento
            const vencimento45 = new Date(admissao);
            vencimento45.setDate(admissao.getDate() + 45);
            
            const vencimento90 = new Date(admissao);
            vencimento90.setDate(admissao.getDate() + 90);

            // Verificar se está no período de experiência (até 90 dias após admissão)
            if (hoje <= vencimento90) {
                totalEmExperiencia++;
            }

            // Lógica para identificar pendências
            // Verifica 1º Período (45 dias)
            const diasPara45 = Math.ceil((vencimento45 - hoje) / (1000 * 60 * 60 * 24));
            
            // Mostra se falta pouco (<= 10 dias) e se ainda não venceu (>= 0 dias)
            if (diasPara45 <= 10 && diasPara45 >= 0) {
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
            if (diasPara90 <= 10 && diasPara90 >= 0) {
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