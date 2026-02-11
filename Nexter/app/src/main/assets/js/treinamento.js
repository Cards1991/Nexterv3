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

    const tituloTema = temaSelecionado ? `Treinamentos de ${temaSelecionado}` : 'Painel de Treinamentos';
    
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
        
        // Agrupamento por tema se nenhum tema selecionado
        const cursosPorTema = {};
        
        snapshot.forEach(doc => {
            const t = doc.data();
            
            let isVisible = false;
            if (currentUserPermissions.isAdmin) {
                isVisible = true; // Admin vê tudo
            } else {
                // Se não tiver atribuição, assume 'todos'. Se tiver, verifica se o usuário está na lista ou se é 'todos'
                if (!t.atribuidoPara || t.atribuidoPara.includes('todos') || (user && t.atribuidoPara.includes(user.uid))) {
                    isVisible = true;
                }
            }

            if (!isVisible) return;

            const tema = t.tema || 'Outros';
            if (!cursosPorTema[tema]) cursosPorTema[tema] = [];
            cursosPorTema[tema].push({ id: doc.id, ...t });
        });

        // Função auxiliar para renderizar card
        const renderCard = (t, docId) => {
            const prog = progressos[docId] || {};
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

            return `
                <div class="col-md-4">
                    <div class="card h-100 shadow-sm hover-card">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="card-title mb-0">${t.titulo}</h5>
                                ${currentUserPermissions.isAdmin ? 
                                    `<button class="btn btn-sm btn-link text-danger p-0" onclick="excluirTreinamento('${docId}')"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                            <p class="card-text text-muted small flex-grow-1">${t.descricao || 'Sem descrição.'}</p>
                            <div class="mb-3">${statusBadge}</div>
                            <button class="btn ${btnClass} w-100 mt-auto" onclick="abrirModuloTreinamento('${docId}')">
                                ${btnLabel}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        };

        if (temaSelecionado) {
            // Renderiza apenas o tema selecionado (embora o menu agora chame com '' por padrão, mantemos compatibilidade)
            const cursos = cursosPorTema[temaSelecionado] || [];
            cursos.forEach(c => { listaEl.innerHTML += renderCard(c, c.id); });
        } else {
            // Renderiza todos agrupados
            for (const [tema, cursos] of Object.entries(cursosPorTema)) {
                if (cursos.length > 0) {
                    listaEl.innerHTML += `<div class="col-12"><h4 class="border-bottom pb-2 mb-3 mt-4 text-primary">${tema}</h4></div>`;
                    cursos.forEach(c => { listaEl.innerHTML += renderCard(c, c.id); });
                }
            }
        }
        
        if (listaEl.innerHTML === '') {
             listaEl.innerHTML = '<div class="col-12 text-center text-muted py-5"><h4><i class="fas fa-book-open opacity-25"></i></h4><p>Nenhum treinamento disponível.</p></div>';
        }

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
    document.getElementById('container-perguntas').innerHTML = ''; // Limpa perguntas anteriores
    
    // Carregar lista de usuários para atribuição
    const selectAtribuicao = document.getElementById('novo-treino-atribuicao');
    if (selectAtribuicao) {
        selectAtribuicao.innerHTML = '<option value="todos" selected>Todos os Usuários</option>';
        db.collection('usuarios').orderBy('nome').get().then(snap => {
            snap.forEach(doc => {
                const u = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = u.nome || u.email;
                selectAtribuicao.appendChild(option);
            });
        }).catch(err => console.error("Erro ao carregar usuários:", err));
    }

    new bootstrap.Modal(modalEl).show();
}

// --- Funções para Gerenciar Perguntas na UI ---

function adicionarPerguntaUI() {
    const container = document.getElementById('container-perguntas');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'card mb-3 pergunta-item bg-light';
    div.innerHTML = `
        <div class="card-body p-3">
            <div class="d-flex justify-content-between mb-2">
                <h6 class="mb-0">Pergunta ${index + 1}</h6>
                <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('.pergunta-item').remove()"><i class="fas fa-trash"></i></button>
            </div>
            <input type="text" class="form-control mb-2 pergunta-texto" placeholder="Digite o enunciado da pergunta" required>
            <div class="opcoes-container"></div>
            <button type="button" class="btn btn-sm btn-link text-decoration-none px-0" onclick="adicionarOpcaoUI(this, ${Date.now()})">+ Adicionar Opção</button>
        </div>
    `;
    container.appendChild(div);
    // Adiciona 2 opções por padrão
    const btnAddOpcao = div.querySelector('button[onclick^="adicionarOpcaoUI"]');
    adicionarOpcaoUI(btnAddOpcao, Date.now());
    adicionarOpcaoUI(btnAddOpcao, Date.now());
}

function adicionarOpcaoUI(btn, groupName) {
    const container = btn.previousElementSibling;
    const div = document.createElement('div');
    div.className = 'input-group mb-2 opcao-item';
    div.innerHTML = `
        <div class="input-group-text">
            <input class="form-check-input mt-0 opcao-correta" type="radio" name="radio_${groupName}" aria-label="Correta" title="Marcar como correta">
        </div>
        <input type="text" class="form-control opcao-texto" placeholder="Texto da opção" required>
        <button class="btn btn-outline-secondary" type="button" onclick="this.closest('.opcao-item').remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(div);
}

// --- Fim Funções UI ---

async function salvarNovoTreinamento() {
    const titulo = document.getElementById('novo-treino-titulo').value;
    const tema = document.getElementById('novo-treino-tema').value;
    const videoFile = document.getElementById('novo-treino-video').files[0];
    const slidesFile = document.getElementById('novo-treino-slides').files[0];
    const descricao = document.getElementById('novo-treino-descricao').value;
    const atribuicaoSelect = document.getElementById('novo-treino-atribuicao');
    const atribuidoPara = atribuicaoSelect ? Array.from(atribuicaoSelect.selectedOptions).map(opt => opt.value) : ['todos'];

    try {
        let perguntas = [];
        
        // Coletar perguntas da UI
        const perguntasEls = document.querySelectorAll('.pergunta-item');
        perguntasEls.forEach(pEl => {
            const texto = pEl.querySelector('.pergunta-texto').value;
            const opcoesEls = pEl.querySelectorAll('.opcao-item');
            const opcoes = [];
            let correta = 0;
            
            opcoesEls.forEach((optEl, idx) => {
                opcoes.push(optEl.querySelector('.opcao-texto').value);
                if (optEl.querySelector('.opcao-correta').checked) {
                    correta = idx;
                }
            });
            
            if (texto && opcoes.length > 0) {
                perguntas.push({ texto, opcoes, correta });
            }
        });

        if (perguntas.length === 0) {
            if(!confirm("Nenhuma pergunta foi cadastrada. Deseja salvar o treinamento sem prova?")) return;
        }

        // Upload de arquivos
        let videoUrl = '';
        let slidesUrl = '';
        const storageRef = firebase.storage().ref();
        const timestamp = Date.now();

        // Feedback visual de upload
        const btnSalvar = document.querySelector('#modalNovoTreinamento .btn-primary');
        const textoOriginal = btnSalvar.innerHTML;
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando arquivos...';

        try {
            if (videoFile) {
                const videoRef = storageRef.child(`treinamentos/${timestamp}_${videoFile.name}`);
                await videoRef.put(videoFile);
                videoUrl = await videoRef.getDownloadURL();
            }

            if (slidesFile) {
                const slidesRef = storageRef.child(`treinamentos/${timestamp}_${slidesFile.name}`);
                await slidesRef.put(slidesFile);
                slidesUrl = await slidesRef.getDownloadURL();
            }
        } catch (uploadError) {
            console.error("Erro detalhado no upload:", uploadError);
            throw new Error("Falha no upload. Verifique se o CORS está configurado no Firebase Storage.");
        }

        if (!videoUrl && !slidesUrl) {
            if(!confirm("Nenhum vídeo ou slide foi anexado. Deseja continuar?")) return;
        }

        await db.collection('treinamentos').add({
            titulo, tema, videoUrl, slidesUrl, descricao, perguntas, atribuidoPara,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        bootstrap.Modal.getInstance(document.getElementById('modalNovoTreinamento')).hide();
        mostrarMensagem("Treinamento criado com sucesso!", "success");
        carregarListaTreinamentos();
    } catch (e) {
        console.error(e);
        mostrarMensagem(e.message || "Erro ao criar treinamento.", "error");
    } finally {
        const btnSalvar = document.querySelector('#modalNovoTreinamento .btn-primary');
        if(btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = 'Salvar Treinamento';
        }
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
window.adicionarPerguntaUI = adicionarPerguntaUI;
window.adicionarOpcaoUI = adicionarOpcaoUI;