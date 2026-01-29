// ========================================
// Módulo: Treinamento e Desenvolvimento
// ========================================

let temaSelecionado = '';
let treinamentoAtual = null;

// Função global para selecionar o tema via menu
window.selecionarTemaTreinamento = function(tema) {
    temaSelecionado = tema;
    // Se a seção já estiver visível, recarrega a lista
    const section = document.getElementById('treinamento');
    if (section && !section.classList.contains('d-none')) {
        carregarListaTreinamentos();
    }
};

async function inicializarTreinamento() {
    console.log("Inicializando módulo de Treinamento...");
    await carregarListaTreinamentos();
}

async function carregarListaTreinamentos() {
    const container = document.getElementById('treinamento-container');
    if (!container) return;

    const tituloTema = temaSelecionado ? `Treinamentos de ${temaSelecionado}` : 'Todos os Treinamentos';
    
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="page-title mb-0">${tituloTema}</h2>
            ${currentUserPermissions.isAdmin ? 
                `<button class="btn btn-primary" onclick="abrirModalNovoTreinamento()">
                    <i class="fas fa-plus"></i> Novo Treinamento
                </button>` : ''}
        </div>
        <div id="lista-treinamentos" class="row g-4">
            <div class="col-12 text-center py-5"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Carregando cursos...</p></div>
        </div>
    `;

    try {
        let query = db.collection('treinamentos');
        if (temaSelecionado) {
            query = query.where('tema', '==', temaSelecionado);
        }

        const snapshot = await query.get();
        const listaEl = document.getElementById('lista-treinamentos');
        
        if (snapshot.empty) {
            listaEl.innerHTML = '<div class="col-12 text-center text-muted py-5"><h4><i class="fas fa-book-open opacity-25"></i></h4><p>Nenhum treinamento disponível neste tema.</p></div>';
            return;
        }

        // Buscar progresso do usuário
        const user = firebase.auth().currentUser;
        let progressos = {};
        if (user) {
            const progSnap = await db.collection('treinamento_progresso')
                .where('userId', '==', user.uid)
                .get();
            progSnap.forEach(doc => {
                progressos[doc.data().treinamentoId] = doc.data();
            });
        }

        listaEl.innerHTML = '';
        snapshot.forEach(doc => {
            const t = doc.data();
            const prog = progressos[doc.id] || {};
            const concluidoModulo = prog.moduloConcluido || false;
            const aprovado = prog.aprovado || false;
            const nota = prog.nota || 0;

            let statusBadge = '<span class="badge bg-secondary">Não Iniciado</span>';
            let btnLabel = 'Iniciar Curso';
            let btnClass = 'btn-primary';

            if (aprovado) {
                statusBadge = `<span class="badge bg-success"><i class="fas fa-check"></i> Aprovado (${nota}%)</span>`;
                btnLabel = 'Revisar Conteúdo';
                btnClass = 'btn-outline-success';
            } else if (concluidoModulo) {
                statusBadge = '<span class="badge bg-warning text-dark">Módulo Concluído - Prova Pendente</span>';
                btnLabel = 'Continuar / Fazer Prova';
                btnClass = 'btn-warning';
            } else if (prog.iniciado) {
                statusBadge = '<span class="badge bg-info text-dark">Em Andamento</span>';
                btnLabel = 'Continuar';
            }

            listaEl.innerHTML += `
                <div class="col-md-4">
                    <div class="card h-100 shadow-sm hover-card">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title mb-0">${t.titulo}</h5>
                                ${currentUserPermissions.isAdmin ? 
                                    `<button class="btn btn-sm btn-link text-danger p-0" onclick="excluirTreinamento('${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                            <p class="card-text text-muted small flex-grow-1">${t.descricao || 'Sem descrição.'}</p>
                            <div class="mb-3">${statusBadge}</div>
                            <button class="btn ${btnClass} w-100 mt-auto" onclick="abrirModuloTreinamento('${doc.id}')">
                                ${btnLabel}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error("Erro ao carregar treinamentos:", error);
        document.getElementById('lista-treinamentos').innerHTML = '<div class="col-12 text-danger text-center">Erro ao carregar dados.</div>';
    }
}

async function abrirModuloTreinamento(id) {
    const container = document.getElementById('treinamento-container');
    container.innerHTML = '<div class="text-center py-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    try {
        const doc = await db.collection('treinamentos').doc(id).get();
        if (!doc.exists) throw new Error("Treinamento não encontrado");
        
        treinamentoAtual = { id: doc.id, ...doc.data() };
        
        // Buscar progresso
        const user = firebase.auth().currentUser;
        let progresso = { moduloConcluido: false, aprovado: false };
        if (user) {
            const progDoc = await db.collection('treinamento_progresso')
                .where('userId', '==', user.uid)
                .where('treinamentoId', '==', id)
                .limit(1).get();
            if (!progDoc.empty) {
                progresso = progDoc.docs[0].data();
            } else {
                // Registrar início se não existir
                await db.collection('treinamento_progresso').add({
                    userId: user.uid,
                    treinamentoId: id,
                    iniciado: true,
                    dataInicio: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        // Renderizar Módulo
        const videoEmbed = treinamentoAtual.videoUrl.includes('youtube') 
            ? treinamentoAtual.videoUrl.replace('watch?v=', 'embed/') 
            : treinamentoAtual.videoUrl;

        container.innerHTML = `
            <div class="mb-3">
                <button class="btn btn-outline-secondary btn-sm" onclick="carregarListaTreinamentos()">
                    <i class="fas fa-arrow-left"></i> Voltar para Lista
                </button>
            </div>
            <div class="card shadow-lg">
                <div class="card-header bg-dark text-white p-3">
                    <h3 class="mb-0">${treinamentoAtual.titulo}</h3>
                </div>
                <div class="card-body p-4">
                    <!-- Vídeo -->
                    <div class="ratio ratio-16x9 mb-4 bg-black rounded">
                        <iframe src="${videoEmbed}" title="Vídeo do Treinamento" allowfullscreen></iframe>
                    </div>

                    <!-- Slides / Material de Apoio -->
                    <div class="card bg-light mb-4">
                        <div class="card-body">
                            <h5 class="card-title"><i class="fas fa-chalkboard-teacher"></i> Material de Apoio</h5>
                            <p class="card-text">${treinamentoAtual.slidesDescricao || 'Confira os slides explicativos abaixo:'}</p>
                            ${treinamentoAtual.slidesUrl ? 
                                `<a href="${treinamentoAtual.slidesUrl}" target="_blank" class="btn btn-outline-primary">
                                    <i class="fas fa-file-pdf"></i> Visualizar Slides / Material
                                </a>` : '<span class="text-muted">Nenhum material extra anexado.</span>'}
                        </div>
                    </div>

                    <!-- Ação de Conclusão -->
                    <div class="d-flex justify-content-between align-items-center border-top pt-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="check-concluido-modulo" 
                                ${progresso.moduloConcluido ? 'checked disabled' : ''} 
                                onchange="marcarModuloConcluido(this.checked)">
                            <label class="form-check-label fw-bold" for="check-concluido-modulo">
                                Declaro que assisti ao vídeo e li o material de apoio.
                            </label>
                        </div>
                        
                        <button id="btn-iniciar-prova" class="btn btn-success btn-lg" 
                            ${!progresso.moduloConcluido ? 'disabled' : ''} 
                            onclick="abrirModalProva()">
                            ${progresso.aprovado ? '<i class="fas fa-check-circle"></i> Aprovado (Refazer Prova)' : '<i class="fas fa-pen-alt"></i> Fazer Prova'}
                        </button>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error(error);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar módulo.</div>';
    }
}

async function marcarModuloConcluido(checked) {
    if (!checked || !treinamentoAtual) return;

    const btnProva = document.getElementById('btn-iniciar-prova');
    const user = firebase.auth().currentUser;

    try {
        const query = await db.collection('treinamento_progresso')
            .where('userId', '==', user.uid)
            .where('treinamentoId', '==', treinamentoAtual.id)
            .get();

        if (!query.empty) {
            await query.docs[0].ref.update({ moduloConcluido: true });
        } else {
            await db.collection('treinamento_progresso').add({
                userId: user.uid,
                treinamentoId: treinamentoAtual.id,
                moduloConcluido: true,
                iniciado: true
            });
        }

        btnProva.disabled = false;
        mostrarMensagem("Módulo concluído! A prova foi liberada.", "success");
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao salvar progresso.", "error");
    }
}

// --- Lógica da Prova ---

function abrirModalProva() {
    if (!treinamentoAtual || !treinamentoAtual.perguntas) {
        mostrarMensagem("Erro: Prova não configurada para este treinamento.", "error");
        return;
    }

    const modalEl = document.getElementById('modalProvaTreinamento');
    const container = document.getElementById('prova-perguntas-container');
    
    document.getElementById('prova-titulo').textContent = `Prova: ${treinamentoAtual.titulo}`;
    
    let html = '';
    treinamentoAtual.perguntas.forEach((p, index) => {
        html += `
            <div class="mb-4 p-3 border rounded bg-white">
                <p class="fw-bold mb-3">${index + 1}. ${p.texto}</p>
                <div class="options-list">
                    ${p.opcoes.map((opt, i) => `
                        <div class="form-check mb-2">
                            <input class="form-check-input" type="radio" name="pergunta_${index}" id="p${index}_opt${i}" value="${i}">
                            <label class="form-check-label" for="p${index}_opt${i}">${opt}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    new bootstrap.Modal(modalEl).show();
}

async function finalizarProva() {
    const perguntas = treinamentoAtual.perguntas;
    let acertos = 0;
    let respondidas = 0;

    perguntas.forEach((p, index) => {
        const selected = document.querySelector(`input[name="pergunta_${index}"]:checked`);
        if (selected) {
            respondidas++;
            if (parseInt(selected.value) === parseInt(p.correta)) {
                acertos++;
            }
        }
    });

    if (respondidas < perguntas.length) {
        mostrarMensagem("Por favor, responda todas as perguntas.", "warning");
        return;
    }

    const nota = (acertos / perguntas.length) * 100;
    const aprovado = nota >= 75;
    const user = firebase.auth().currentUser;

    // Salvar resultado
    try {
        const query = await db.collection('treinamento_progresso')
            .where('userId', '==', user.uid)
            .where('treinamentoId', '==', treinamentoAtual.id)
            .get();

        const dados = {
            nota: nota,
            aprovado: aprovado,
            dataProva: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!query.empty) {
            // Só atualiza se a nota for maior ou se ainda não tinha sido aprovado
            const atual = query.docs[0].data();
            if (!atual.aprovado || nota > atual.nota) {
                await query.docs[0].ref.update(dados);
            }
        } else {
            await db.collection('treinamento_progresso').add({
                userId: user.uid,
                treinamentoId: treinamentoAtual.id,
                moduloConcluido: true,
                ...dados
            });
        }

        bootstrap.Modal.getInstance(document.getElementById('modalProvaTreinamento')).hide();

        if (aprovado) {
            abrirModalGenerico("Parabéns!", `
                <div class="text-center">
                    <i class="fas fa-trophy fa-4x text-warning mb-3"></i>
                    <h4>Você foi aprovado!</h4>
                    <p class="fs-5">Sua nota: <strong>${nota.toFixed(0)}%</strong></p>
                    <p>O treinamento foi concluído com sucesso.</p>
                </div>
            `);
        } else {
            abrirModalGenerico("Não foi dessa vez", `
                <div class="text-center">
                    <i class="fas fa-times-circle fa-4x text-danger mb-3"></i>
                    <h4>Reprovado</h4>
                    <p class="fs-5">Sua nota: <strong>${nota.toFixed(0)}%</strong></p>
                    <p>A nota mínima é 75%. Revise o conteúdo e tente novamente.</p>
                </div>
            `);
        }

        // Recarregar tela do módulo para atualizar status
        abrirModuloTreinamento(treinamentoAtual.id);

    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao salvar resultado da prova.", "error");
    }
}

// --- Admin: Novo Treinamento ---

function abrirModalNovoTreinamento() {
    const modalEl = document.getElementById('modalNovoTreinamento');
    document.getElementById('form-novo-treinamento').reset();
    new bootstrap.Modal(modalEl).show();
}

async function salvarNovoTreinamento() {
    const titulo = document.getElementById('novo-treino-titulo').value;
    const tema = document.getElementById('novo-treino-tema').value;
    const video = document.getElementById('novo-treino-video').value;
    const slides = document.getElementById('novo-treino-slides').value;
    const descricao = document.getElementById('novo-treino-descricao').value;
    const jsonProva = document.getElementById('novo-treino-prova-json').value;

    try {
        let perguntas = [];
        try {
            perguntas = JSON.parse(jsonProva);
        } catch (e) {
            alert("Erro no formato JSON das perguntas. Verifique a sintaxe.");
            return;
        }

        await db.collection('treinamentos').add({
            titulo, tema, videoUrl: video, slidesUrl: slides, descricao, perguntas,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        bootstrap.Modal.getInstance(document.getElementById('modalNovoTreinamento')).hide();
        mostrarMensagem("Treinamento criado com sucesso!", "success");
        carregarListaTreinamentos();
    } catch (e) {
        console.error(e);
        mostrarMensagem("Erro ao criar treinamento.", "error");
    }
}

async function excluirTreinamento(id) {
    if(!confirm("Excluir este treinamento?")) return;
    try {
        await db.collection('treinamentos').doc(id).delete();
        carregarListaTreinamentos();
    } catch(e) { console.error(e); }
}

// Exportar funções
window.inicializarTreinamento = inicializarTreinamento;
window.abrirModalNovoTreinamento = abrirModalNovoTreinamento;
window.salvarNovoTreinamento = salvarNovoTreinamento;
window.abrirModuloTreinamento = abrirModuloTreinamento;
window.marcarModuloConcluido = marcarModuloConcluido;
window.abrirModalProva = abrirModalProva;
window.finalizarProva = finalizarProva;
window.excluirTreinamento = excluirTreinamento;