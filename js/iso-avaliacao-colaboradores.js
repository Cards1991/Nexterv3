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

    let query = db.collection('funcionarios').where('status', '==', 'Ativo');
    
    // Lógica de Permissão/Hierarquia
    const currentUserPermissions = window.currentUserPermissions || {};
    const isAdmin = currentUserPermissions.isAdmin;
    const funcionarioId = currentUserPermissions.funcionarioId;
    
    if (!isAdmin && funcionarioId) {
        query = query.where('liderId', '==', funcionarioId);
    }
    
    const funcionariosSnap = await query.get();
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

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando avaliações...</td></tr>';

    try {
        const currentUserPermissions = window.currentUserPermissions || {};
        const isAdmin = currentUserPermissions.isAdmin;
        const gerenteId = currentUserPermissions.funcionarioId;
        
        let query = db.collection('avaliacoes_desempenho_iso');
        
        if (!isAdmin && gerenteId) {
            query = query.where('avaliadorUid', '==', firebase.auth().currentUser.uid); // Filtra pelas que ele criou
        }
        
        const snap = await query.get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma avaliação salva.</td></tr>';
            return;
        }

        // Extrai os dados e ordena localmente para evitar erro de índice composto no Firebase
        let avaliacoes = [];
        snap.forEach(doc => {
            avaliacoes.push({ id: doc.id, ...doc.data() });
        });
        
        avaliacoes.sort((a, b) => {
            const dateA = a.dataAvaliacao?.toDate ? a.dataAvaliacao.toDate().getTime() : 0;
            const dateB = b.dataAvaliacao?.toDate ? b.dataAvaliacao.toDate().getTime() : 0;
            return dateB - dateA; // Descending
        });

        // Buscar nomes dos funcionários para mapeamento
        const funcIds = new Set();
        avaliacoes.forEach(av => funcIds.add(av.funcionarioId));
        
        const funcMap = new Map();
        if (funcIds.size > 0) {
            const funcionariosSnap = await db.collection('funcionarios').get();
            funcionariosSnap.forEach(fDoc => {
                funcMap.set(fDoc.id, fDoc.data().nome);
            });
        }

        tbody.innerHTML = '';
        avaliacoes.forEach(avaliacao => {
            const dataAvaliacao = avaliacao.dataAvaliacao?.toDate ? avaliacao.dataAvaliacao.toDate().toLocaleDateString('pt-BR') : 'Data inválida';
            const nomeColaborador = funcMap.get(avaliacao.funcionarioId) || 'Colaborador não encontrado';
            
            const badgeClass = avaliacao.media >= 4 ? 'bg-success' : (avaliacao.media >= 3 ? 'bg-primary' : 'bg-warning text-dark');
            
            const row = `
                <tr>
                    <td>${dataAvaliacao}</td>
                    <td><strong>${nomeColaborador}</strong></td>
                    <td>${avaliacao.avaliadorEmail || 'N/A'}</td>
                    <td><span class="badge ${badgeClass} fs-6">${avaliacao.media.toFixed(1)}</span></td>
                    <td>${avaliacao.resultado}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info" onclick="visualizarDetalhesAvaliacaoDesempenho('${avaliacao.id}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirAvaliacaoDesempenho('${avaliacao.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // ── Calcular e exibir Média Geral do Setor ──
        const mediaGeralEl = document.getElementById('media-geral-setor');
        if (mediaGeralEl) {
            const avaliacoesComMedia = avaliacoes.filter(av => typeof av.media === 'number' && !isNaN(av.media));
            if (avaliacoesComMedia.length > 0) {
                const somaMedias = avaliacoesComMedia.reduce((acc, av) => acc + av.media, 0);
                const mediaGeral = somaMedias / avaliacoesComMedia.length;
                mediaGeralEl.textContent = mediaGeral.toFixed(1);

                // Ajusta cor do card conforme desempenho
                const card = mediaGeralEl.closest('.card');
                if (card) {
                    card.classList.remove('bg-primary', 'bg-success', 'bg-warning', 'bg-danger');
                    if (mediaGeral >= 4) {
                        card.classList.add('bg-success');
                    } else if (mediaGeral >= 3) {
                        card.classList.add('bg-primary');
                    } else if (mediaGeral >= 2) {
                        card.classList.add('bg-warning');
                        card.querySelector('h6') && (card.querySelector('h6').classList.add('text-dark'));
                        mediaGeralEl.classList.add('text-dark');
                    } else {
                        card.classList.add('bg-danger');
                    }
                }
            } else {
                mediaGeralEl.textContent = '-';
            }
        }

    } catch (error) {
        console.error("Erro ao carregar avaliações de desempenho:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar as avaliações.</td></tr>';
    }
}

async function visualizarDetalhesAvaliacaoDesempenho(id) {
    try {
        const doc = await db.collection('avaliacoes_desempenho_iso').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Avaliação não encontrada.", "warning");
            return;
        }
        const data = doc.data();
        const funcDoc = await db.collection('funcionarios').doc(data.funcionarioId).get();
        const nome = funcDoc.exists ? funcDoc.data().nome : "Desconhecido";
        
        const corpoModal = `
            <div class="mb-3">
                <h6>Colaborador: <span class="text-primary">${nome}</span></h6>
                <small>Média Final: <strong>${data.media.toFixed(1)}</strong> | Resultado: <strong>${data.resultado}</strong></small>
            </div>
            <ul class="list-group mb-3">
                <li class="list-group-item d-flex justify-content-between align-items-center">Assiduidade <span class="badge bg-primary rounded-pill">${data.notas.assiduidade}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Pontualidade <span class="badge bg-primary rounded-pill">${data.notas.pontualidade}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Produtividade <span class="badge bg-primary rounded-pill">${data.notas.produtividade}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Relacionamento <span class="badge bg-primary rounded-pill">${data.notas.relacionamento}</span></li>
                <li class="list-group-item d-flex justify-content-between align-items-center">Iniciativa <span class="badge bg-primary rounded-pill">${data.notas.iniciativa}</span></li>
            </ul>
            <div class="alert alert-secondary">
                <strong>Observações:</strong><br/>
                ${data.observacoes || "Nenhuma observação registrada."}
            </div>
        `;
        abrirModalGenerico("Detalhes da Avaliação", corpoModal);
    } catch (error) {
        console.error("Erro ao visualizar:", error);
    }
}

async function excluirAvaliacaoDesempenho(id) {
    if (!confirm("Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.")) return;
    try {
        await db.collection('avaliacoes_desempenho_iso').doc(id).delete();
        mostrarMensagem("Avaliação excluída com sucesso.", "success");
        await inicializarGerenciarAvaliacoes();
    } catch (error) {
        console.error("Erro ao excluir avaliação:", error);
        mostrarMensagem("Erro ao excluir a avaliação.", "error");
    }
}

async function abrirModalNovaAvaliacaoDesempenho() {
    const modalEl = document.getElementById('modalAvaliacaoDesempenho');
    if (!modalEl) {
        console.error("Modal Avaliação Desempenho não encontrado no DOM!");
        return;
    }
    
    // Mostra Passo 1 e Oculta Passo 2
    document.getElementById('aval-step-1').style.display = 'block';
    document.getElementById('aval-step-2').style.display = 'none';
    
    const tbody = document.getElementById('tabela-colaboradores-avaliacao');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando colaboradores...</td></tr>';
    
    try {
        const currentUserPermissions = window.currentUserPermissions || {};
        const isAdmin = currentUserPermissions.isAdmin;
        const gerenteId = currentUserPermissions.funcionarioId;
        
        let query = db.collection('funcionarios').where('status', '==', 'Ativo');
        if (!isAdmin && gerenteId) {
            query = query.where('liderId', '==', gerenteId);
        }
        
        const snap = await query.get();
        
        // Também vamos buscar quais já foram avaliados HOJE pelo gerente, para dar um feedback visual
        const hojeInic = new Date();
        hojeInic.setHours(0,0,0,0);
        
        let avaliacoesHoje = new Set();
        try {
            const avs = await db.collection('avaliacoes_desempenho_iso')
                .where('avaliadorUid', '==', firebase.auth().currentUser.uid)
                .where('dataAvaliacao', '>=', hojeInic)
                .get();
            avs.forEach(a => avaliacoesHoje.add(a.data().funcionarioId));
        } catch(e) { console.warn("Aviso ao buscar avaliações do dia:", e); }
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum colaborador encontrado sob sua liderança.</td></tr>';
        } else {
            let rows = '';
            let funcs = [];
            snap.forEach(doc => funcs.push({id: doc.id, ...doc.data()}));
            funcs.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(f => {
                const jaAvaliado = avaliacoesHoje.has(f.id);
                const statusBadge = jaAvaliado ? '<span class="badge bg-success">Avaliado Hoje</span>' : '<span class="badge bg-secondary">Pendente</span>';
                const btnText = jaAvaliado ? 'Reavaliar' : 'Avaliar';
                const btnClass = jaAvaliado ? 'btn-outline-secondary' : 'btn-primary';
                
                rows += `
                    <tr>
                        <td><strong>${f.nome}</strong></td>
                        <td>${f.cargo || 'N/A'}</td>
                        <td class="text-center" id="status-aval-${f.id}">${statusBadge}</td>
                        <td class="text-end">
                            <button class="btn btn-sm ${btnClass}" onclick="iniciarAvaliacaoIndividual('${f.id}', '${f.nome.replace(/'/g, "\\'")}')">
                                <i class="fas fa-clipboard-check me-1"></i> ${btnText}
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = rows;
        }
        
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
        
    } catch(e) {
        console.error("Erro ao carregar lista de colaboradores:", e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar colaboradores.</td></tr>';
    }
}

function iniciarAvaliacaoIndividual(id, nome) {
    document.getElementById('aval-step-1').style.display = 'none';
    document.getElementById('aval-step-2').style.display = 'block';
    
    document.getElementById('form-avaliacao-desempenho').reset();
    document.getElementById('aval-des-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('aval-des-funcionario-id').value = id;
    document.getElementById('aval-des-nome-colaborador').textContent = nome;
    
    document.getElementById('aval-des-media-display').textContent = '-';
    document.getElementById('aval-des-resultado-display').innerHTML = '<span class="badge bg-secondary">Aguardando notas...</span>';
    
    // Adicionar listeners para calcular quando mudar rádio
    document.querySelectorAll('input[type=radio][name^="aval-des-"]').forEach(radio => {
        radio.addEventListener('change', calcularResultadoAutomaticoAvaliacaoDesempenho);
    });
    
    const btnSalvar = document.getElementById('btn-salvar-avaliacao-desempenho');
    const novoBtn = btnSalvar.cloneNode(true);
    btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
    novoBtn.addEventListener('click', salvarNovaAvaliacaoDesempenho);
}

function voltarParaPasso1Avaliacao() {
    document.getElementById('aval-step-2').style.display = 'none';
    document.getElementById('aval-step-1').style.display = 'block';
}

function calcularResultadoAutomaticoAvaliacaoDesempenho() {
    const criterios = ['assiduidade', 'pontualidade', 'produtividade', 'relacionamento', 'iniciativa'];
    let soma = 0;
    let preenchidos = 0;
    
    criterios.forEach(c => {
        const radio = document.querySelector(`input[name="aval-des-${c}"]:checked`);
        if (radio) {
            soma += parseInt(radio.value);
            preenchidos++;
        }
    });
    
    if (preenchidos === criterios.length) {
        const media = soma / criterios.length;
        document.getElementById('aval-des-media-display').textContent = media.toFixed(1);
        
        let resultadoTexto = "";
        let badgeClass = "";
        
        if (media >= 4.5) { resultadoTexto = "Excelente"; badgeClass = "bg-success"; }
        else if (media >= 3.5) { resultadoTexto = "Bom"; badgeClass = "bg-primary"; }
        else if (media >= 2.5) { resultadoTexto = "Regular"; badgeClass = "bg-warning text-dark"; }
        else { resultadoTexto = "Precisa Melhorar"; badgeClass = "bg-danger"; }
        
        document.getElementById('aval-des-resultado').value = resultadoTexto;
        document.getElementById('aval-des-resultado-display').innerHTML = `<span class="badge ${badgeClass} fs-5">${resultadoTexto}</span>`;
    }
}

async function salvarNovaAvaliacaoDesempenho() {
    const funcionarioId = document.getElementById('aval-des-funcionario-id').value;
    const dataAvaliacao = document.getElementById('aval-des-data').value;
    const resultado = document.getElementById('aval-des-resultado').value;
    const observacoes = document.getElementById('aval-des-obs').value;
    
    const criterios = ['assiduidade', 'pontualidade', 'produtividade', 'relacionamento', 'iniciativa'];
    const notas = {};
    let media = 0;
    let preenchidos = 0;
    
    for (let c of criterios) {
        const radio = document.querySelector(`input[name="aval-des-${c}"]:checked`);
        if (!radio) {
            mostrarMensagem("Por favor, avalie todos os critérios de 1 a 5.", "warning");
            return;
        }
        const val = parseInt(radio.value);
        notas[c] = val;
        media += val;
        preenchidos++;
    }
    media = media / criterios.length;
    
    const btnSalvar = document.getElementById('btn-salvar-avaliacao-desempenho');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    try {
        const avaliador = firebase.auth().currentUser;
        
        // Ajustar a data para 12:00 para evitar fuso horário puxando para o dia anterior
        const dataAjustada = new Date(dataAvaliacao + 'T12:00:00');
        
        const avaliacaoData = {
            funcionarioId,
            dataAvaliacao: dataAjustada,
            notas,
            media,
            resultado,
            observacoes,
            avaliadorUid: avaliador.uid,
            avaliadorEmail: avaliador.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('avaliacoes_desempenho_iso').add(avaliacaoData);
        
        mostrarMensagem("Avaliação salva com sucesso!", "success");
        
        // Atualiza a tabela do passo 1 visualmente
        const statusTd = document.getElementById(`status-aval-${funcionarioId}`);
        if (statusTd) {
            statusTd.innerHTML = '<span class="badge bg-success">Avaliado Agora</span>';
        }
        
        // Voltar para a lista e recarregar a tabela de fundo
        voltarParaPasso1Avaliacao();
        await inicializarGerenciarAvaliacoes();
        
    } catch(error) {
        console.error("Erro ao salvar avaliação:", error);
        mostrarMensagem("Erro ao salvar a avaliação.", "error");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Avaliação';
    }
}