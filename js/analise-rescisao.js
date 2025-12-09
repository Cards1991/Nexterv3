// Seção Análise de Rescisões

async function inicializarAnaliseRescisao() {
    try {
        const container = document.getElementById('analise-rescisao-container');
        container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando dados de análise...</div>';

        const entrevistasSnap = await db.collection('entrevistas_demissionais').get();
        const entrevistas = entrevistasSnap.docs.map(doc => doc.data());

        if (entrevistas.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Nenhuma entrevista demissional encontrada para análise.</p>';
            return;
        }

        gerarDashboardAnalise(container, entrevistas);

    } catch (e) {
        console.error("Erro ao inicializar análise de rescisões:", e);
        mostrarMensagem("Erro ao carregar dados de análise", "error");
    }
}

async function salvarDadosEntrevista() {
    try {
        const movimentacaoId = document.getElementById('entrevista-movimentacao-id').value;
        if (!movimentacaoId) {
            mostrarMensagem('ID da movimentação não encontrado.', 'error');
            return;
        }

        const entrevistaData = {
            movimentacaoId: movimentacaoId,
            motivoDesligamento: document.getElementById('entrevista-motivo').value,
            avaliacaoExperiencia: document.getElementById('entrevista-experiencia').value,
            pontosPositivos: document.getElementById('entrevista-pontos-positivos').value,
            principaisDesafios: document.getElementById('entrevista-desafios').value,
            sugestaoMelhora: document.getElementById('entrevista-melhorias').value,
            sentiuApoiado: document.querySelector('input[name="entrevista-apoio"]:checked')?.value || null,
            recomendariaEmpresa: document.querySelector('input[name="entrevista-recomenda"]:checked')?.value || null,
            interesseRetornar: document.querySelector('input[name="entrevista-retorno"]:checked')?.value || null,
            dataPreenchimento: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid
        };

        // Validação simples
        if (!entrevistaData.motivoDesligamento || !entrevistaData.avaliacaoExperiencia) {
            mostrarMensagem('Preencha "Motivo do desligamento" e "Avaliação da experiência".', 'warning');
            return;
        }

        await db.collection('entrevistas_demissionais').add(entrevistaData);

        mostrarMensagem('Entrevista demissional salva com sucesso!', 'success');

        const modalEl = document.getElementById('entrevistaDemissionalModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) {
            modal.hide();
        }

        // Atualiza a análise se a seção estiver visível
        if (!document.getElementById('analise-rescisao').classList.contains('d-none')) {
            await inicializarAnaliseRescisao();
        }

    } catch (e) {
        console.error("Erro ao salvar entrevista demissional:", e);
        mostrarMensagem("Falha ao salvar a entrevista.", "error");
    }
}

function gerarDashboardAnalise(container, dados) {
    // Limpa o container e restaura a estrutura
    container.innerHTML = `
        <div class="row">
            <div class="col-lg-8"><canvas id="graficoMotivosDemissao"></canvas></div>
            <div class="col-lg-4" id="indicadores-rescisao"></div>
        </div>
    `;

    // 1. Processar dados para o gráfico
    const motivos = contarOcorrencias(dados, 'motivoDesligamento');
    const labels = Object.keys(motivos);
    const dataPoints = Object.values(motivos);
    
    // 2. Renderizar o gráfico
    const ctx = document.getElementById('graficoMotivosDemissao').getContext('2d');
    renderizarGraficoMotivos(ctx, labels, dataPoints);

    // 3. Renderizar outros indicadores (se houver)
    const indicadoresContainer = document.getElementById('indicadores-rescisao');
    // Exemplo: Adicionar outros cards de análise aqui se desejar
    indicadoresContainer.innerHTML = `<h5 class="mb-3">Resumo</h5><p>Análise baseada em ${dados.length} entrevistas.</p>`;
}

function contarOcorrencias(array, chave) {
    return array.reduce((acc, obj) => {
        const valor = obj[chave];
        if (valor) {
            acc[valor] = (acc[valor] || 0) + 1;
        }
        return acc;
    }, {});
}

function renderizarGraficoMotivos(ctx, labels, data) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nº de Ocorrências',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                ],
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Transforma em gráfico de barras horizontais
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Principais Motivos de Pedido de Demissão' }
            }
        }
    });
}