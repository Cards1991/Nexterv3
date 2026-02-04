// Gerenciamento da Análise SWOT - ISO 9001
let swotChartInstance = null;

async function inicializarSwot() {
    try {
        await carregarFatoresSwot();
    } catch (e) {
        console.error("Erro ao inicializar Análise SWOT:", e);
        mostrarMensagem("Erro ao carregar a Análise SWOT.", "error");
    }
}

async function carregarFatoresSwot() {
    const tipos = ['forca', 'fraqueza', 'oportunidade', 'ameaca'];
    let totais = { forca: 0, fraqueza: 0, oportunidade: 0, ameaca: 0 };

    for (const tipo of tipos) {
        const container = document.getElementById(`swot-${tipo}s-container`);
        if (!container) continue;

        container.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>`;

        try {
            const snap = await db.collection('iso_swot').where('tipo', '==', tipo).get();
            if (snap.empty) {
                container.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum fator adicionado.</td></tr>`;
                // Mesmo vazio, zera os totais para o cálculo da classificação
                document.getElementById(`swot-total-relevancia-${tipo}`).textContent = '0%';
                document.getElementById(`swot-total-resultado-${tipo}`).textContent = '0.00';
                totais[tipo] = 0;
                continue;
            }

            container.innerHTML = '';
            let totalRelevancia = 0;
            let totalResultadoQuadrante = 0;

            const fatores = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));


            // Ordena os fatores pela relevância, do maior para o menor
            fatores.sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));

            fatores.forEach(fator => {
                const resultado = ((fator.relevancia || 0) / 100) * (fator.classificacao || 0);
                totalRelevancia += (fator.relevancia || 0);
                totalResultadoQuadrante += resultado;


                const row = `
                    <tr>
                        <td>${fator.relevancia || 0}%</td>
                        <td>${fator.fator || '-'}</td>
                        <td>${fator.classificacao || '-'}</td>
                        <td><span class="badge bg-info">${resultado.toFixed(2)}</span></td>
                        <td>${fator.pdca || '-'}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="abrirModalFatorSwot('${tipo}', '${fator.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirFatorSwot('${fator.id}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
                container.innerHTML += row;
            });

            // Atualiza o totalizador de relevância
            const totalEl = document.getElementById(`swot-total-relevancia-${tipo}`);
            if (totalEl) {
                totalEl.textContent = `${totalRelevancia}%`;
                totalEl.classList.remove('text-success', 'text-danger');
                if (totalRelevancia === 100) {
                    totalEl.classList.add('text-success');
                } else if (totalRelevancia > 100) {
                    totalEl.classList.add('text-danger');
                }
            }

            // Atualiza o totalizador de resultado do quadrante
            const totalResultadoEl = document.getElementById(`swot-total-resultado-${tipo}`);
            if (totalResultadoEl) {
                totalResultadoEl.textContent = totalResultadoQuadrante.toFixed(2);
            }
            totais[tipo] = totalResultadoQuadrante;

        } catch (error) {
            console.error(`Erro ao carregar ${tipo}s:`, error);
            container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erro ao carregar.</td></tr>`;
        }
    }

    // Calcula e exibe a classificação da empresa
    calcularEExibirClassificacao(totais);
    await carregarHistoricoSwot(); // Carrega o histórico após carregar os dados atuais
}

function calcularEExibirClassificacao(totais) {
    const classificacao = (totais.forca + totais.oportunidade) - (totais.fraqueza + totais.ameaca);
    let textoClassificacao = '';

    if (classificacao < 0.851) {
        textoClassificacao = 'Ruim';
    } else if (classificacao >= 0.852 && classificacao < 1.601) {
        textoClassificacao = 'Abaixo da média';
    } else if (classificacao >= 1.602 && classificacao < 2.451) {
        textoClassificacao = 'Média';
    } else if (classificacao >= 2.452 && classificacao < 3.251) {
        textoClassificacao = 'Muito Boa';
    } else {
        textoClassificacao = 'Excelente';
    }

    const resultadoEl = document.getElementById('swot-classificacao-resultado');
    if (resultadoEl) {
        resultadoEl.textContent = `${textoClassificacao} (${classificacao.toFixed(2)})`;
    }
}

async function carregarHistoricoSwot() {
    const tbody = document.getElementById('tabela-historico-swot');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const snap = await db.collection('swot_historico').orderBy('ano', 'desc').get();
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum histórico salvo.</td></tr>';
            return;
        }

        const historico = snap.docs.map(doc => ({ ano: doc.id, ...doc.data() }));

        tbody.innerHTML = '';
        historico.forEach(item => {
            const row = `
                <tr>
                    <td><strong>${item.ano}</strong></td>
                    <td>${item.score.toFixed(2)}</td>
                    <td><span class="badge bg-primary">${item.classificacao}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalEdicaoHistorico('${item.ano}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        renderizarGraficoHistorico(historico.reverse()); // Reverte para o gráfico ficar em ordem cronológica

    } catch (error) {
        console.error("Erro ao carregar histórico SWOT:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar histórico.</td></tr>';
    }
}

function renderizarGraficoHistorico(historico) {
    const ctx = document.getElementById('grafico-historico-swot')?.getContext('2d');
    if (!ctx) return;

    const labels = historico.map(item => item.ano);
    const data = historico.map(item => item.score);

    if (swotChartInstance) {
        swotChartInstance.destroy();
    }

    swotChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score da Empresa',
                data: data,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

async function salvarAnaliseSwotAnual() {
    const ano = new Date().getFullYear();
    const docRef = db.collection('swot_historico').doc(String(ano));

    try {
        const doc = await docRef.get();
        if (doc.exists) {
            if (!confirm(`Já existe uma análise salva para ${ano}. Deseja sobrescrevê-la com os dados atuais?`)) {
                return;
            }
        } else {
            if (!confirm(`Deseja salvar a análise SWOT atual para o ano de ${ano}?`)) {
                return;
            }
        }

        const totais = {
            forca: parseFloat(document.getElementById('swot-total-resultado-forca').textContent) || 0,
            fraqueza: parseFloat(document.getElementById('swot-total-resultado-fraqueza').textContent) || 0,
            oportunidade: parseFloat(document.getElementById('swot-total-resultado-oportunidade').textContent) || 0,
            ameaca: parseFloat(document.getElementById('swot-total-resultado-ameaca').textContent) || 0,
        };

        const score = (totais.forca + totais.oportunidade) - (totais.fraqueza + totais.ameaca);
        const classificacaoTexto = document.getElementById('swot-classificacao-resultado').textContent.split(' (')[0];

        await docRef.set({
            ano: String(ano),
            score: score,
            classificacao: classificacaoTexto,
            detalhes: totais,
            salvoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem(`Análise SWOT para ${ano} foi salva com sucesso!`, 'success');
        await carregarHistoricoSwot(); // Atualiza a lista e o gráfico
    } catch (error) {
        console.error("Erro ao salvar análise SWOT anual:", error);
        mostrarMensagem("Erro ao salvar análise SWOT anual.", "error");
    }
}

async function abrirModalFatorSwot(tipo, fatorId = null) {
    const modalId = 'swotFatorModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="swot-modal-title">Adicionar Fator</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-swot-fator">
                            <input type="hidden" id="swot-fator-id">
                            <input type="hidden" id="swot-fator-tipo">
                            <div class="mb-3">
                                <label class="form-label">Fator</label>
                                <textarea class="form-control" id="swot-fator" rows="3" required></textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Relevância (0-100%)</label>
                                    <input type="number" class="form-control" id="swot-relevancia" min="0" max="100" required placeholder="0-100">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Classificação (0-10)</label>
                                    <input type="number" class="form-control" id="swot-classificacao" min="0" max="10" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Tratamento PDCA</label>
                                <input type="text" class="form-control" id="swot-pdca">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarFatorSwot()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('form-swot-fator').reset();
    document.getElementById('swot-fator-id').value = fatorId || '';
    document.getElementById('swot-fator-tipo').value = tipo;

    const modalTitle = document.getElementById('swot-modal-title');
    const tipoCapitalizado = tipo.charAt(0).toUpperCase() + tipo.slice(1);

    if (fatorId) {
        modalTitle.textContent = `Editar Fator de ${tipoCapitalizado}`;
        try {
            const doc = await db.collection('iso_swot').doc(fatorId).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('swot-fator').value = data.fator || '';
                document.getElementById('swot-relevancia').value = data.relevancia || 0;
                document.getElementById('swot-classificacao').value = data.classificacao || 0;
                document.getElementById('swot-pdca').value = data.pdca || '';
            }
        } catch (error) {
            console.error("Erro ao carregar dados do fator para edição:", error);
            mostrarMensagem("Erro ao carregar dados para edição.", "error");
            return;
        }
    } else {
        modalTitle.textContent = `Adicionar Fator de ${tipoCapitalizado}`;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

async function salvarFatorSwot() {
    const fatorId = document.getElementById('swot-fator-id').value;
    const tipo = document.getElementById('swot-fator-tipo').value;
    const dados = {
        tipo: tipo,
        fator: document.getElementById('swot-fator').value.trim(),
        relevancia: parseInt(document.getElementById('swot-relevancia').value, 10),
        classificacao: parseInt(document.getElementById('swot-classificacao').value, 10),
        pdca: document.getElementById('swot-pdca').value.trim()
    };

    if (!dados.fator || isNaN(dados.relevancia) || isNaN(dados.classificacao)) {
        mostrarMensagem("Preencha os campos Fator, Relevância e Classificação.", "warning");
        return;
    }

    if (dados.relevancia < 0 || dados.relevancia > 100) {
        mostrarMensagem("O valor da Relevância deve estar entre 0 e 100.", "warning");
        return;
    }

    if (dados.classificacao < 0 || dados.classificacao > 10) {
        mostrarMensagem("O valor da Classificação deve estar entre 0 e 10.", "warning");
        return;
    }

    try {
        if (fatorId) {
            await db.collection('iso_swot').doc(fatorId).update(dados);
            mostrarMensagem("Fator atualizado com sucesso!", "success");
        } else {
            await db.collection('iso_swot').add(dados);
            mostrarMensagem("Fator adicionado com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('swotFatorModal')).hide();
        await carregarFatoresSwot();

    } catch (error) {
        console.error("Erro ao salvar fator SWOT:", error);
        mostrarMensagem("Erro ao salvar o fator.", "error");
    }
}

async function excluirFatorSwot(fatorId) {
    if (!confirm("Tem certeza que deseja excluir este fator?")) {
        return;
    }

    try {
        await db.collection('iso_swot').doc(fatorId).delete();
        mostrarMensagem("Fator excluído com sucesso.", "info");
        await carregarFatoresSwot();
    } catch (error) {
        console.error("Erro ao excluir fator SWOT:", error);
        mostrarMensagem("Erro ao excluir o fator.", "error");
    }
}

async function abrirModalEdicaoHistorico(ano) {
    const modalId = 'historicoSwotModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="historico-modal-title">Editar Análise de </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small">Ajuste os totais consolidados para cada quadrante. O Score e a Classificação serão recalculados automaticamente.</p>
                        <form id="form-historico-swot">
                            <input type="hidden" id="historico-ano">
                            <div class="row">
                                <div class="col-6 mb-3"><label class="form-label">Total Forças</label><input type="number" step="0.01" class="form-control" id="hist-forca"></div>
                                <div class="col-6 mb-3"><label class="form-label">Total Fraquezas</label><input type="number" step="0.01" class="form-control" id="hist-fraqueza"></div>
                                <div class="col-6 mb-3"><label class="form-label">Total Oportunidades</label><input type="number" step="0.01" class="form-control" id="hist-oportunidade"></div>
                                <div class="col-6 mb-3"><label class="form-label">Total Ameaças</label><input type="number" step="0.01" class="form-control" id="hist-ameaca"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEdicaoHistorico()">Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    try {
        const doc = await db.collection('swot_historico').doc(ano).get();
        if (!doc.exists) {
            mostrarMensagem("Registro histórico não encontrado.", "error");
            return;
        }
        const data = doc.data();
        document.getElementById('historico-modal-title').textContent = `Editar Análise de ${ano}`;
        document.getElementById('historico-ano').value = ano;
        document.getElementById('hist-forca').value = data.detalhes.forca.toFixed(2);
        document.getElementById('hist-fraqueza').value = data.detalhes.fraqueza.toFixed(2);
        document.getElementById('hist-oportunidade').value = data.detalhes.oportunidade.toFixed(2);
        document.getElementById('hist-ameaca').value = data.detalhes.ameaca.toFixed(2);

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

    } catch (error) {
        console.error("Erro ao abrir edição de histórico:", error);
        mostrarMensagem("Erro ao carregar dados para edição.", "error");
    }
}

async function salvarEdicaoHistorico() {
    const ano = document.getElementById('historico-ano').value;
    const totais = {
        forca: parseFloat(document.getElementById('hist-forca').value) || 0,
        fraqueza: parseFloat(document.getElementById('hist-fraqueza').value) || 0,
        oportunidade: parseFloat(document.getElementById('hist-oportunidade').value) || 0,
        ameaca: parseFloat(document.getElementById('hist-ameaca').value) || 0,
    };

    const score = (totais.forca + totais.oportunidade) - (totais.fraqueza + totais.ameaca);
    const tempDiv = document.createElement('div');
    calcularEExibirClassificacao(totais); // Usa a função existente para obter o texto
    const classificacaoTexto = document.getElementById('swot-classificacao-resultado').textContent.split(' (')[0];

    try {
        await db.collection('swot_historico').doc(ano).update({
            score: score,
            classificacao: classificacaoTexto,
            detalhes: totais
        });
        mostrarMensagem(`Análise de ${ano} atualizada com sucesso!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('historicoSwotModal')).hide();
        await carregarFatoresSwot(); // Recarrega tudo para garantir consistência
    } catch (error) {
        console.error("Erro ao salvar edição do histórico:", error);
        mostrarMensagem("Erro ao salvar alterações.", "error");
    }
}