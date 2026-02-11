// ========================================
// Módulo: Avaliação de Colaboradores
// Descrição: Ferramenta para avaliação de colaboradores por amostragem.
// ========================================
async function inicializarAvaliacaoColaboradores() {
    const btnGerar = document.getElementById('btn-gerar-amostra');
    const btnSalvar = document.getElementById('btn-salvar-avaliacoes');

    if (btnGerar && !btnGerar.bound) {
        btnGerar.addEventListener('click', gerarAmostraParaAvaliacao);
        btnGerar.bound = true;
    }
    if (btnSalvar && !btnSalvar.bound) {
        btnSalvar.addEventListener('click', salvarAvaliacoes);
        btnSalvar.bound = true;
    }
}

async function gerarAmostraParaAvaliacao() {
    const container = document.getElementById('avaliacao-container');
    container.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Gerando amostra aleatória...</p></div>';

    const funcionariosSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
    const funcionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (funcionarios.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Nenhum funcionário ativo para gerar amostra.</p>';
        return;
    }

    // Agrupar por setor
    const porSetor = funcionarios.reduce((acc, func) => {
        const setor = func.setor || 'Não Especificado';
        if (!acc[setor]) acc[setor] = [];
        acc[setor].push(func);
        return acc;
    }, {});

    // Gerar amostra de 20% por setor
    let amostraFinal = [];
    for (const setor in porSetor) {
        const funcionariosDoSetor = porSetor[setor];
        const tamanhoAmostra = Math.max(1, Math.ceil(funcionariosDoSetor.length * 0.20));
        
        // Embaralhar e pegar a amostra
        const amostraSetor = funcionariosDoSetor.sort(() => 0.5 - Math.random()).slice(0, tamanhoAmostra);
        amostraFinal = amostraFinal.concat(amostraSetor);
    }

    renderizarListaAvaliacao(amostraFinal);
}

function renderizarListaAvaliacao(amostra) {
    const container = document.getElementById('avaliacao-container');
    container.innerHTML = '';

    // Agrupar amostra por setor para renderização
    const porSetor = amostra.reduce((acc, func) => {
        const setor = func.setor || 'Não Especificado';
        if (!acc[setor]) acc[setor] = [];
        acc[setor].push(func);
        return acc;
    }, {});

    for (const setor in porSetor) {
        const setorDiv = document.createElement('div');
        setorDiv.className = 'mb-4';
        setorDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded mb-2">
                <h5 class="mb-0">${setor}</h5>
                <span class="badge bg-primary fs-6">Média do Setor: <span id="media-setor-${setor.replace(/\s+/g, '')}">0.0</span></span>
            </div>
        `;

        const lista = document.createElement('ul');
        lista.className = 'list-group';

        porSetor[setor].forEach(func => {
            const item = document.createElement('li');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div>
                    <strong>${func.nome}</strong>
                    <small class="text-muted d-block">${func.cargo || 'Cargo não informado'}</small>
                </div>
                <div style="width: 150px;">
                    <select class="form-select form-select-sm nota-avaliacao" data-setor="${setor}" data-funcionario-id="${func.id}">
                        <option value="0" selected>Avaliar...</option>
                        <option value="1">1 - Ruim</option>
                        <option value="2">2 - Regular</option>
                        <option value="3">3 - Bom</option>
                        <option value="4">4 - Ótimo</option>
                        <option value="5">5 - Excelente</option>
                    </select>
                </div>
            `;
            lista.appendChild(item);
        });

        setorDiv.appendChild(lista);
        container.appendChild(setorDiv);
    }

    // Adicionar listeners para calcular médias em tempo real
    document.querySelectorAll('.nota-avaliacao').forEach(select => {
        select.addEventListener('change', calcularMedias);
    });

    // Exibir botões e rodapé
    document.getElementById('btn-salvar-avaliacoes').style.display = 'inline-block';
    document.getElementById('avaliacao-resumo-footer').style.display = 'block';
    calcularMedias(); // Calcular estado inicial
}

function calcularMedias() {
    const todasAsNotas = [];
    const notasPorSetor = {};
    let preenchidas = 0;

    document.querySelectorAll('.nota-avaliacao').forEach(select => {
        const nota = parseInt(select.value, 10);
        const setor = select.dataset.setor;

        if (!notasPorSetor[setor]) {
            notasPorSetor[setor] = [];
        }

        if (nota > 0) {
            todasAsNotas.push(nota);
            notasPorSetor[setor].push(nota);
            preenchidas++;
        }
    });

    // Calcular e exibir média por setor
    for (const setor in notasPorSetor) {
        const notas = notasPorSetor[setor];
        const media = notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '0.0';
        const mediaEl = document.getElementById(`media-setor-${setor.replace(/\s+/g, '')}`);
        if (mediaEl) mediaEl.textContent = media;
    }

    // Calcular e exibir totais e média geral
    const totalAmostra = document.querySelectorAll('.nota-avaliacao').length;
    const mediaGeral = todasAsNotas.length > 0 ? (todasAsNotas.reduce((a, b) => a + b, 0) / todasAsNotas.length).toFixed(1) : '0.0';

    document.getElementById('total-amostra').textContent = totalAmostra;
    document.getElementById('total-preenchidas').textContent = preenchidas;
    document.getElementById('media-geral-avaliacao').textContent = mediaGeral;
}

async function salvarAvaliacoes() {
    const avaliacoes = [];
    const avaliador = firebase.auth().currentUser;

    document.querySelectorAll('.nota-avaliacao').forEach(select => {
        // Pula se não for uma nota válida (ex: "Avaliar...")
        if (parseInt(select.value, 10) === 0) {
            return;
        }
        const nota = parseInt(select.value, 10);
        if (nota > 0) {
            avaliacoes.push({
                avaliadorUid: avaliador.uid,
                avaliadorEmail: avaliador.email,
                funcionarioId: select.dataset.funcionarioId,
                setor: select.dataset.setor,
                nota: nota,
                dataAvaliacao: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    if (avaliacoes.length === 0) {
        mostrarMensagem("Nenhuma avaliação foi preenchida para salvar.", "warning");
        return;
    }

    if (!confirm(`Deseja salvar ${avaliacoes.length} avaliações?`)) {
        return;
    }

    try {
        // 1. Criar um documento para o ciclo de avaliação
        const cicloRef = db.collection('avaliacoes_ciclos').doc();
        const mediaGeral = parseFloat(document.getElementById('media-geral-avaliacao').textContent);
        const totalAmostra = parseInt(document.getElementById('total-amostra').textContent, 10);

        const cicloData = {
            id: cicloRef.id,
            dataCiclo: firebase.firestore.FieldValue.serverTimestamp(),
            avaliadorUid: avaliador.uid,
            avaliadorEmail: avaliador.email,
            totalAmostra: totalAmostra,
            totalAvaliados: avaliacoes.length,
            mediaGeral: mediaGeral
        };

        // 2. Preparar um batch para salvar tudo atomicamente
        const batch = db.batch();

        // Adiciona o ciclo ao batch
        batch.set(cicloRef, cicloData);

        // 3. Adicionar cada avaliação individual ao batch, vinculando ao ID do ciclo
        avaliacoes.forEach(avaliacao => {
            const docRef = db.collection('avaliacoes_colaboradores').doc();
            batch.set(docRef, { ...avaliacao, cicloId: cicloRef.id });
        });

        // Executa todas as operações no batch
        await batch.commit();

        mostrarMensagem("Avaliações salvas com sucesso!", "success");
        
        // Limpar a tela após salvar
        document.getElementById('avaliacao-container').innerHTML = '<p class="text-center text-muted">Avaliações salvas. Gere uma nova amostra para continuar.</p>';
        document.getElementById('btn-salvar-avaliacoes').style.display = 'none';
        document.getElementById('avaliacao-resumo-footer').style.display = 'none';

    } catch (error) {
        console.error("Erro ao salvar avaliações:", error);
        mostrarMensagem("Ocorreu um erro ao salvar as avaliações.", "error");
    }
}

// ========================================
// Módulo: Gerenciar Avaliações
// ========================================

async function inicializarGerenciarAvaliacoes() {
    const tbody = document.getElementById('tabela-ciclos-avaliacao');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando ciclos...</td></tr>';

    try {
        const snap = await db.collection('avaliacoes_ciclos').orderBy('dataCiclo', 'desc').get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum ciclo de avaliação salvo.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snap.forEach(doc => {
            const ciclo = doc.data();
            const dataCiclo = ciclo.dataCiclo?.toDate ? ciclo.dataCiclo.toDate().toLocaleString('pt-BR') : 'Data inválida';
            const row = `
                <tr>
                    <td>${dataCiclo}</td>
                    <td>${ciclo.avaliadorEmail || 'N/A'}</td>
                    <td><span class="badge bg-secondary">${ciclo.totalAmostra}</span> / <span class="badge bg-info">${ciclo.totalAvaliados}</span></td>
                    <td><span class="badge bg-primary">${ciclo.mediaGeral.toFixed(1)}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info" onclick="visualizarDetalhesCiclo('${doc.id}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirCicloAvaliacao('${doc.id}')" title="Excluir Ciclo"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar ciclos de avaliação:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar os ciclos.</td></tr>';
    }
}

async function visualizarDetalhesCiclo(cicloId) {
    try {
        const snap = await db.collection('avaliacoes_colaboradores').where('cicloId', '==', cicloId).get();
        if (snap.empty) {
            mostrarMensagem("Nenhuma avaliação detalhada encontrada para este ciclo.", "info");
            return;
        }

        const funcionariosAvaliados = await Promise.all(snap.docs.map(async doc => {
            const avaliacao = doc.data();
            const funcDoc = await db.collection('funcionarios').doc(avaliacao.funcionarioId).get();
            const nomeFunc = funcDoc.exists ? funcDoc.data().nome : 'Funcionário não encontrado';
            return { nome: nomeFunc, nota: avaliacao.nota, setor: avaliacao.setor };
        }));

        let corpoModal = '<ul class="list-group">';
        funcionariosAvaliados.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(item => {
            corpoModal += `<li class="list-group-item d-flex justify-content-between align-items-center">${item.nome} <small class="text-muted">(${item.setor})</small> <span class="badge bg-primary rounded-pill">${item.nota}</span></li>`;
        });
        corpoModal += '</ul>';

        abrirModalGenerico("Detalhes do Ciclo de Avaliação", corpoModal);

    } catch (error) {
        console.error("Erro ao buscar detalhes do ciclo:", error);
        mostrarMensagem("Erro ao carregar detalhes do ciclo.", "error");
    }
}

async function excluirCicloAvaliacao(cicloId) {
    if (!confirm("Tem certeza que deseja excluir este ciclo de avaliação e todas as suas notas? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        const batch = db.batch();
        // Deletar o documento do ciclo
        batch.delete(db.collection('avaliacoes_ciclos').doc(cicloId));
        // Deletar todas as avaliações individuais associadas
        const avaliacoesSnap = await db.collection('avaliacoes_colaboradores').where('cicloId', '==', cicloId).get();
        avaliacoesSnap.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        mostrarMensagem("Ciclo de avaliação excluído com sucesso.", "success");
        await inicializarGerenciarAvaliacoes(); // Recarrega a lista
    } catch (error) {
        console.error("Erro ao excluir ciclo de avaliação:", error);
        mostrarMensagem("Erro ao excluir o ciclo.", "error");
    }
}