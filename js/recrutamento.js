/**
 * Módulo de Recrutamento e Seleção
 * Integração com Firestore e Escavador API
 */

let vagasAtivas = [];
let candidatosAtuais = [];
let unsubscribeCandidatos = null;
let vagasGlobais = [];
let candidatosGlobais = [];
let chartMetricasRecrutamento = null;
let currentCandidatoId = null;
let escavadorToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMWFkZGU3OWNjOGQ3OTlhNjc2MzE0ZmI1ZjdkZGZmY2VmMDliZmI0YjhjZDRlNDRlNWY2NmEwMzM3YmM1MTAwMjViZWJhNDA5M2FjNjQ4MjMiLCJpYXQiOjE3ODgzNzI2NDEuNTM3MzU4LCJuYmYiOjE3ODgzNzI2NDEuNTM3MzYsImV4cCI6MTgxOTk0MDM5OS41MzU4OTgsInN1YiI6IjQxMjQzNzYiLCJzY29wZXMiOlsiYWNlc3Nhcl9hcGlfcGFnYSIsImFjZXNzYXJfYXBpX3BsYXlncm91bmQiXX0.Tv1aXtEQBEX_WSESRPoA7lTHzGA8evUkLP_jVCOxrgqWsqMKJZ2Q_eVm2LTck_d4-HEjWhzMkvwe329wYaSCM0vOZPQl8UoMosQ5tWNXSnru4H0neD2XnBfDALyXx6ZP-aZRxyrEz2EL0iFINR_pYZOHcYNrqkgMWW8HUlxiI3_aMevRCZ3dOslDvtw0c3ZaucZ3Im2LztAoegFWNId686EFRNmWm6NdLkQwKr3-HuKOBxp5i8RpIAtvANyCyjSysqyIvM8Vf3DUGCOhEEu4S0uNJ7qbY350TVHyBZfYcgFT2WGasVJSho3XfVWJWrYPxNma9sEJuaLIy3fx1FXCacSOS5FIWG5DRsVEQtUJG74iTzWMJ6FG20NJeBREMsU2K-zTCNM85POtt0qj2cKZky_ENDtBL4WfDnHMjVQRMCIwTW8uV2hbkY122fSwUjAZfNtbyHtfLfJXtWvKJqkOoXxY8fWQrVzw7N--HmxeykARPgheT2Cbj9IW5eV-KiBzFZfBuBdzEMco5AWugPsRgAtZQ6bUszz3fNUL1AA7pCm7wmFXjmeZTNpE9Seu_j1DjfFMWxmWdOFCB1psZN3IwPm6JOl7pqZzCeZZtzH5mWthDIvWvnoN1uRnOQ6vmt5tGSKKXh4rEUet8lH8roYf5QFHPIQcPMnDzMt3uczd8mk";

async function inicializarRecrutamento() {
    console.log("Inicializando módulo de recrutamento...");
    await carregarTokenEscavador();
    await carregarVagas();
    await carregarSetoresVaga();
}

async function carregarTokenEscavador() {
    try {
        const response = await fetch('TokenEscavador.txt');
        if (response.ok) {
            escavadorToken = (await response.text()).trim();
            console.log("Token do Escavador carregado com sucesso.");
        } else {
            console.warn("Arquivo TokenEscavador.txt não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao ler TokenEscavador.txt:", error);
    }
}

async function carregarSetoresVaga() {
    try {
        const snapshot = await db.collection('setores').get();
        const select = document.getElementById('vagaSetor');
        if(!select) return;
        select.innerHTML = '<option value="">Selecione...</option>';
        snapshot.forEach(doc => {
            const setor = doc.data();
            select.innerHTML += `<option value="${setor.nome}">${setor.nome}</option>`;
        });
    } catch (e) {
        console.error("Erro ao carregar setores:", e);
    }
}

async function carregarVagas() {
    try {
        const snapshot = await db.collection('vagas').orderBy('criadoEm', 'desc').get();
        vagasAtivas = [];
        const filtro = document.getElementById('filtro-vaga-kanban');
        const selectModal = document.getElementById('candidatoVagaId');
        
        if(filtro) filtro.innerHTML = '<option value="">Todas as Vagas</option>';
        if(selectModal) selectModal.innerHTML = '<option value="">Selecione a vaga...</option>';

        snapshot.forEach(doc => {
            const vaga = { id: doc.id, ...doc.data() };
            vagasAtivas.push(vaga);
            
            if (vaga.status !== 'Fechada') {
                if(filtro) filtro.innerHTML += `<option value="${vaga.id}">${vaga.titulo} (${vaga.local})</option>`;
                if(selectModal) selectModal.innerHTML += `<option value="${vaga.id}">${vaga.titulo}</option>`;
            }
        });
        
        if (vagasAtivas.length > 0) {
            carregarKanbanCandidatos();
        }
    } catch (error) {
        console.error("Erro ao carregar vagas:", error);
    }
}

function carregarKanbanCandidatos() {
    const vagaFiltro = document.getElementById('filtro-vaga-kanban')?.value;
    
    if (unsubscribeCandidatos) {
        unsubscribeCandidatos();
    }

    let query = db.collection('candidatos');
    if (vagaFiltro) {
        query = query.where('vagaId', '==', vagaFiltro);
    }

    unsubscribeCandidatos = query.onSnapshot(snapshot => {
        candidatosAtuais = [];
        snapshot.forEach(doc => candidatosAtuais.push({ id: doc.id, ...doc.data() }));
        renderizarKanban();
    }, error => {
        console.error("Erro ao observar candidatos:", error);
    });
}

function renderizarKanban() {
    const colunas = ['triagem', 'entrevista', 'avaliacao', 'aprovado', 'banco'];
    const busca = document.getElementById('busca-candidato')?.value.toLowerCase() || '';

    // Limpar colunas e contadores
    colunas.forEach(col => {
        const div = document.getElementById(`cards-${col}`);
        const count = document.getElementById(`count-${col}`);
        if(div) div.innerHTML = '';
        if(count) count.innerText = '0';
    });

    let contadores = { triagem: 0, entrevista: 0, avaliacao: 0, aprovado: 0, banco: 0 };

    candidatosAtuais.forEach(cand => {
        if (busca && !cand.nome.toLowerCase().includes(busca) && !cand.cpf.includes(busca)) return;
        
        const fase = cand.faseAtual || 'triagem';
        const div = document.getElementById(`cards-${fase}`);
        
        if (div) {
            const vagaTitle = vagasAtivas.find(v => v.id === cand.vagaId)?.titulo || 'Vaga Excluída';
            
            const card = document.createElement('div');
            card.className = 'kanban-card fade-in';
            card.draggable = true;
            card.id = `cand-${cand.id}`;
            card.dataset.id = cand.id;
            
            // Eventos Drag
            card.addEventListener('dragstart', dragStart);
            card.addEventListener('dragend', dragEnd);
            
            card.innerHTML = `
                <div class="kanban-card-title">${cand.nome}</div>
                <div class="small text-muted mb-2"><i class="fas fa-briefcase"></i> ${vagaTitle}</div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="badge bg-light text-dark border"><i class="fas fa-phone"></i> ${cand.telefone || '-'}</span>
                    <button class="btn btn-sm btn-light border" onclick="editarCandidato('${cand.id}')" title="Ver Detalhes">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
            
            div.appendChild(card);
            contadores[fase]++;
        }
    });

    // Atualiza badges
    colunas.forEach(col => {
        const count = document.getElementById(`count-${col}`);
        if(count) count.innerText = contadores[col];
    });
}

/* =============================================
   DRAG AND DROP LOGIC
   ============================================= */
let draggedCard = null;

function dragStart(e) {
    draggedCard = this;
    setTimeout(() => this.style.opacity = '0.5', 0);
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function dragEnd() {
    this.style.opacity = '1';
    draggedCard = null;
    document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
}

function allowDrop(e) {
    e.preventDefault();
    const column = e.target.closest('.kanban-column');
    if(column) column.classList.add('drag-over');
}

async function drop(e, faseDestino) {
    e.preventDefault();
    document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    
    const candId = e.dataTransfer.getData('text/plain');
    if (!candId || !faseDestino) return;

    try {
        await db.collection('candidatos').doc(candId).update({ faseAtual: faseDestino });
        mostrarMensagem('Fase do candidato atualizada!', 'success');
    } catch (error) {
        console.error('Erro ao mover candidato:', error);
        mostrarMensagem('Erro ao mover candidato.', 'error');
    }
}

/* =============================================
   GESTÃO DE MODAIS E FORMULÁRIOS
   ============================================= */

function abrirModalVaga() {
    document.getElementById('formVaga').reset();
    document.getElementById('vagaId').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalVaga'));
    modal.show();
}

async function salvarVaga() {
    const id = document.getElementById('vagaId').value;
    const vaga = {
        titulo: document.getElementById('vagaTitulo').value,
        status: document.getElementById('vagaStatus').value,
        setor: document.getElementById('vagaSetor').value,
        local: document.getElementById('vagaLocal').value,
        descricao: document.getElementById('vagaDescricao').value,
        criadoEm: id ? undefined : firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!vaga.titulo || !vaga.setor) {
        mostrarMensagem('Preencha os campos obrigatórios!', 'error');
        return;
    }

    try {
        if (id) {
            await db.collection('vagas').doc(id).update(vaga);
        } else {
            await db.collection('vagas').add(vaga);
        }
        bootstrap.Modal.getInstance(document.getElementById('modalVaga')).hide();
        mostrarMensagem('Vaga salva com sucesso!');
        carregarVagas();
    } catch (error) {
        console.error('Erro salvar vaga:', error);
        mostrarMensagem('Erro ao salvar vaga.', 'error');
    }
}

function abrirModalCandidato() {
    document.getElementById('formCandidato').reset();
    document.getElementById('candidatoId').value = '';
    document.getElementById('candidatoFaseAtual').value = 'triagem';
    document.getElementById('linkCurriculoAtual').innerHTML = '';
    document.getElementById('areaEscavador').style.display = 'none';
    const elAreaProcessos = document.getElementById('areaProcessosInternos');
    if (elAreaProcessos) elAreaProcessos.style.display = 'none';
    
    // Clear MBTI
    document.getElementById('candidato-mbti-resultado').innerHTML = '<span class="text-muted fst-italic small">Teste MBTI ainda não realizado.</span>';
    document.getElementById('gerente-mbti-resultado').innerHTML = '<span class="text-muted fst-italic small">Selecione uma vaga para carregar o perfil do gestor e calcular a compatibilidade.</span>';

    const modal = new bootstrap.Modal(document.getElementById('modalCandidato'));
    modal.show();
}

function formatarCPF(input) {
    const cpf = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = cpf
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

async function editarCandidato(id) {
    const cand = candidatosAtuais.find(c => c.id === id);
    if (!cand) return;
    
    document.getElementById('candidatoId').value = cand.id;
    document.getElementById('candidatoVagaId').value = cand.vagaId;
    document.getElementById('candidatoNome').value = cand.nome;
    const cpfInput = document.getElementById('candidatoCpf');
    cpfInput.value = cand.cpf;
    formatarCPF(cpfInput);
    document.getElementById('candidatoTelefone').value = cand.telefone || '';
    document.getElementById('candidatoEmail').value = cand.email || '';
    document.getElementById('candidatoAnotacoes').value = cand.anotacoes || '';
    document.getElementById('candidatoFaseAtual').value = cand.faseAtual || 'triagem';
    
    const linkDiv = document.getElementById('linkCurriculoAtual');
    if (cand.curriculoUrl) {
        linkDiv.innerHTML = `<a href="${cand.curriculoUrl}" target="_blank"><i class="fas fa-file-pdf"></i> Visualizar Currículo Atual</a>`;
    } else {
        linkDiv.innerHTML = 'Nenhum currículo anexado.';
    }
    
    document.getElementById('areaEscavador').style.display = 'none';
    const elAreaProcessos = document.getElementById('areaProcessosInternos');
    if (elAreaProcessos) elAreaProcessos.style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('modalCandidato'));
    modal.show();

    // Carregar MBTI do candidato e Match
    carregarMBTICandidato(id);
}

async function salvarCandidato() {
    const id = document.getElementById('candidatoId').value;
    const vagaId = document.getElementById('candidatoVagaId').value;
    const nome = document.getElementById('candidatoNome').value;
    const cpf = document.getElementById('candidatoCpf').value;
    const arquivo = document.getElementById('candidatoCurriculo').files[0];

    if (!vagaId || !nome || !cpf) {
        mostrarMensagem('Preencha vaga, nome e CPF.', 'error');
        return;
    }

    const candidatoData = {
        vagaId, nome, cpf,
        telefone: document.getElementById('candidatoTelefone').value,
        email: document.getElementById('candidatoEmail').value,
        anotacoes: document.getElementById('candidatoAnotacoes').value,
        faseAtual: document.getElementById('candidatoFaseAtual').value,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (!id) {
            candidatoData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        }

        let docRef;
        if (id) {
            docRef = db.collection('candidatos').doc(id);
            await docRef.update(candidatoData);
        } else {
            docRef = await db.collection('candidatos').add(candidatoData);
        }

        // Fazer Upload se houver
        if (arquivo) {
            mostrarMensagem('Enviando currículo...', 'info');
            const refStorage = firebase.storage().ref(`curriculos/${docRef.id}_${arquivo.name}`);
            const snapshot = await refStorage.put(arquivo);
            const url = await snapshot.ref.getDownloadURL();
            await docRef.update({ curriculoUrl: url });
        }

        bootstrap.Modal.getInstance(document.getElementById('modalCandidato')).hide();
        mostrarMensagem('Candidato salvo com sucesso!');
    } catch (e) {
        console.error('Erro ao salvar candidato:', e);
        mostrarMensagem('Erro ao salvar candidato.', 'error');
    }
}

/* =============================================
   INTEGRAÇÃO ESCAVADOR
   ============================================= */

// Token placeholder (Substitua depois pelo seu token do Hub Desenvolvedor)
const HUB_DESENVOLVEDOR_TOKEN = 'SEU_TOKEN_AQUI';

async function consultarCandidatoAPI(deepSearchModeParam = null) {
    const cpfRaw = document.getElementById('candidatoCpf').value;
    const cpf = cpfRaw.replace(/\D/g, '');
    const divResult = document.getElementById('resultadoEscavador');
    const area = document.getElementById('areaEscavador');
    const divResultInterno = document.getElementById('resultadoProcessosInternos');
    const areaInterna = document.getElementById('areaProcessosInternos');
    const inputNome = document.getElementById('candidatoNome');
    const personId = document.getElementById('candidatoId').value || currentCandidatoId;

    if (!cpf || cpf.length !== 11) {
        mostrarMensagem('Digite um CPF válido (11 dígitos).', 'warning');
        return;
    }

    let modeToUse = deepSearchModeParam;
    if (!modeToUse) {
        const exactCheck = document.getElementById('buscaExataCpf');
        modeToUse = (exactCheck && exactCheck.checked) ? 'AUTO' : 'HOMONIMOS_ONLY';
    }

    // 1. Dispara a busca interna e aguarda o resultado
    const funcionarioEncontradoInternamente = await consultarHistoricoInterno(cpf);

    // 2. Pré-Cadastro via Hub Desenvolvedor (Receita Federal)
    if (!funcionarioEncontradoInternamente) {
        try {
            mostrarMensagem('Buscando dados na Receita Federal...', 'info');
            // MOCK/PLACEHOLDER: Integração Receita Federal
        } catch (error) {
            console.error("Erro Hub Desenvolvedor:", error);
        }
    } else {
        try {
            const funcSnap = await db.collection('funcionarios').where('cpf', '==', cpfRaw).get();
            if(!funcSnap.empty) {
                inputNome.value = funcSnap.docs[0].data().nome;
            }
        } catch(e) {}
    }

    // 3. Buscar Processos via NEXTER Backend (Escavador V2)
    area.style.display = 'block';
    
    // Novo Loading Flow Interativo
    divResult.innerHTML = `
        <div class="escavador-loading-steps">
            <div class="step-item active" id="step-cpf"><i class="fas fa-spinner fa-spin"></i> Consultando CPF...</div>
            <div class="step-item" id="step-analysis"><i class="fas fa-search"></i> Analisando correspondências...</div>
            <div class="step-item" id="step-name"><i class="fas fa-users"></i> Ampliando pesquisa por nome...</div>
            <div class="step-item" id="step-consolidation"><i class="fas fa-layer-group"></i> Consolidando processos encontrados...</div>
        </div>
    `;

    const s1 = setTimeout(() => { 
        const e1 = document.getElementById('step-cpf'); 
        const e2 = document.getElementById('step-analysis');
        if(e1) e1.classList.replace('active', 'completed'); 
        if(e2) e2.classList.add('active'); 
    }, 1500);

    const s2 = setTimeout(() => { 
        const e1 = document.getElementById('step-analysis');
        const e2 = document.getElementById('step-name');
        if(e1) e1.classList.replace('active', 'completed'); 
        if(e2) e2.classList.add('active'); 
    }, 3000);

    const s3 = setTimeout(() => { 
        const e1 = document.getElementById('step-name');
        const e2 = document.getElementById('step-consolidation');
        if(e1) e1.classList.replace('active', 'completed'); 
        if(e2) e2.classList.add('active'); 
    }, 5000);

    try {
        // Chamada para o Backend
        const response = await fetch('/api/legal/process-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                personId: personId || null,
                cpfRaw: cpf,
                nomeRaw: inputNome.value.trim(),
                mode: modeToUse
            })
        });

        const data = await response.json();
        
        let htmlResultados = '';

        if (response.ok && data.status === 'SUCCESS_WITH_RESULTS') {
            const sum = data.summary;
            
            // Header
            htmlResultados += `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0 text-primary"><i class="fas fa-gavel"></i> ${sum.total} processos encontrados</h5>
                    ${modeToUse !== 'ALWAYS' ? `<button class="btn btn-sm btn-outline-secondary" onclick="consultarCandidatoAPI('ALWAYS')"><i class="fas fa-search-plus"></i> Executar busca ampliada</button>` : ''}
                </div>
            `;

            // Summary Cards
            htmlResultados += `
                <div class="escavador-summary">
                    <div class="summary-card" style="border-left: 4px solid var(--nexter-success);">
                        <div class="count text-success">${sum.confirmed}</div>
                        <div class="label">CPF Confirmado</div>
                    </div>
                    <div class="summary-card" style="border-left: 4px solid var(--nexter-primary);">
                        <div class="count text-primary">${sum.highConfidence}</div>
                        <div class="label">Alta Correspondência</div>
                    </div>
                    <div class="summary-card" style="border-left: 4px solid var(--nexter-warning);">
                        <div class="count text-warning">${sum.possible}</div>
                        <div class="label">Verificar Identidade</div>
                    </div>
                    <div class="summary-card" style="border-left: 4px solid var(--nexter-danger);">
                        <div class="count text-danger">${sum.homonyms}</div>
                        <div class="label">Possíveis Homônimos</div>
                    </div>
                </div>
                
                <div class="alert alert-info small py-2"><i class="fas fa-info-circle"></i> <strong>Estratégia:</strong> Pesquisa ampliada realizada utilizando documento, nome e critérios de correspondência (${data.strategiesExecuted.join(', ')}).</div>
            `;

            if (sum.homonyms > 0 || sum.possible > 0) {
                 htmlResultados += `<div class="alert alert-warning small py-2"><i class="fas fa-exclamation-triangle"></i> Encontramos processos associados ao mesmo nome, porém o CPF não foi identificado diretamente na fonte judicial. Revise as correspondências sinalizadas.</div>`;
            }

            htmlResultados += `<div class="process-list mt-3">`;
            
            data.processes.forEach(proc => {
                let badgeClass = 'homonym';
                if (proc.classificacao === 'CONFIRMADO') badgeClass = 'confirmed';
                else if (proc.classificacao === 'ALTA_PROBABILIDADE') badgeClass = 'high';
                else if (proc.classificacao === 'POSSIVEL_CORRESPONDENCIA') badgeClass = 'possible';

                htmlResultados += `
                    <div class="process-card fade-in">
                        <div class="process-header">
                            <div>
                                <div class="process-number">${proc.numero_cnj || 'S/N'}</div>
                                <div class="process-title">${proc.titulo_polo_ativo || 'N/I'} <span class="text-muted mx-1">x</span> ${proc.titulo_polo_passivo || 'N/I'}</div>
                            </div>
                            <div class="d-flex flex-column align-items-end">
                                <span class="match-badge ${badgeClass}" title="${proc.match_documento_por}">
                                    ${proc.badgeText}
                                </span>
                                <span class="score-text mt-1">Score: ${proc.nexterMatchScore}/100</span>
                            </div>
                        </div>
                        <div class="process-details">
                            <p><strong>Tribunal/UF:</strong> ${proc.estado_origem?.sigla || ''} - ${proc.capa?.orgao_julgador || 'N/I'}</p>
                            <p><strong>Área:</strong> <span class="badge bg-secondary">${proc.capa?.area || 'Não especificada'}</span></p>
                            <p><strong>Classe:</strong> ${proc.capa?.classe || 'N/I'}</p>
                            <p><strong>Status:</strong> ${proc.capa?.situacao || 'Desconhecido'}</p>
                            <p><strong>Distribuição:</strong> ${proc.capa?.data_distribuicao ? new Date(proc.capa.data_distribuicao).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div class="process-actions">
                            <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirDocumentosEscavador('${proc.numero_cnj}')"><i class="fas fa-file-pdf"></i> Documentos Públicos</button>
                            ${proc.fontes && proc.fontes[0]?.url ? `<a href="${proc.fontes[0].url}" target="_blank" class="btn btn-sm btn-outline-secondary"><i class="fas fa-external-link-alt"></i> Abrir fonte externa</a>` : ''}
                            
                            ${proc.classificacao !== 'CONFIRMADO' ? `
                                <div class="review-actions">
                                    <button class="btn btn-sm btn-success text-white" onclick="revisarCorrespondencia('${personId}', '${proc.numero_cnj}', 'CONFIRMED')"><i class="fas fa-check"></i> Confirmar</button>
                                    <button class="btn btn-sm btn-warning" onclick="revisarCorrespondencia('${personId}', '${proc.numero_cnj}', 'HOMONYM')"><i class="fas fa-ban"></i> Homônimo</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            htmlResultados += `</div>`;
        } else if (response.ok && data.status === 'SUCCESS_NO_RESULTS') {
            htmlResultados += `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Não foram encontrados processos nas fontes consultadas. 
                    <br><small>A ausência de resultados não significa necessariamente inexistência de processos, pois alguns tribunais podem não disponibilizar CPF/CNPJ das partes.</small>
                </div>
                ${modeToUse !== 'ALWAYS' ? `<button class="btn btn-sm btn-outline-primary mt-2" onclick="consultarCandidatoAPI('ALWAYS')"><i class="fas fa-search-plus"></i> Executar busca ampliada (Deep Search)</button>` : ''}
            `;
        } else {
            // Tratamento de Erros Retornados pelo Backend
            let errorMsg = data.error || 'Erro ao consultar API.';
            if (data.status === 'AUTH_ERROR') errorMsg = 'Falha de autenticação com o provedor (Token Inválido).';
            if (data.status === 'NO_CREDIT') errorMsg = 'Consulta temporariamente indisponível (Sem Saldo).';
            if (data.status === 'RATE_LIMIT') errorMsg = 'Muitas consultas simultâneas. Tente novamente em breve.';
            htmlResultados += `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${errorMsg}</div>`;
        }

        // -- MÓDULO JURÍDICO INTERNO --
        const nomeAtual = inputNome.value.trim().toLowerCase();
        if (nomeAtual && areaInterna && divResultInterno) {
            areaInterna.style.display = 'block';
            let htmlInternos = '';
            try {
                const processosJuridicosSnap = await db.collection('processos_juridicos').get();
                const processosContraEmpresa = processosJuridicosSnap.docs.filter(doc => {
                    const data = doc.data();
                    return data.parteContraria && data.parteContraria.toLowerCase() === nomeAtual;
                });

                if (processosContraEmpresa.length > 0) {
                    htmlInternos += `<ul class="mt-2 pl-3">`;
                    processosContraEmpresa.forEach(doc => {
                        const proc = doc.data();
                        htmlInternos += `<li><strong class="text-danger">${proc.numeroProcesso || 'S/N'}</strong> - ${proc.tipoAcao || 'Ação'} - Status: ${proc.status || 'N/A'}</li>`;
                    });
                    htmlInternos += '</ul>';
                } else {
                    htmlInternos += `<span class="text-success"><i class="fas fa-check-circle"></i> Sistema Jurídico Interno: Nada consta para este nome.</span><br>`;
                }
            } catch (err) {
                htmlInternos += `<span class="text-warning"><i class="fas fa-exclamation-triangle"></i> Sistema Jurídico Interno indisponível.</span><br>`;
            }
            divResultInterno.innerHTML = htmlInternos;
        }

        divResult.innerHTML = htmlResultados;
        
    } catch (error) {
        console.error('Erro consulta processos (Network):', error);
        divResult.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Consulta temporariamente indisponível. Erro de conexão com o servidor.</div>`;
    }
}

window.revisarCorrespondencia = async function(personId, numeroCnj, decision) {
    if(!personId || personId === 'undefined') {
        mostrarMensagem('Salve o candidato antes de revisar a correspondência.', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/legal/review-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId, numeroCnj, decision, reviewedBy: 'Usuario' })
        });
        
        if (response.ok) {
            mostrarMensagem('Revisão salva com sucesso!', 'success');
            // Opcional: Atualizar UI via JS ou re-pesquisar
        } else {
            mostrarMensagem('Falha ao salvar revisão.', 'error');
        }
    } catch (e) {
        mostrarMensagem('Erro de conexão.', 'error');
    }
}


/* =============================================
   HISTÓRICO INTERNO DO EX-COLABORADOR
   ============================================= */
async function consultarHistoricoInterno(cpfFomatado) {
    const areaHistorico = document.getElementById('areaHistoricoColaborador');
    const resultHistorico = document.getElementById('resultadoHistorico');
    
    // Pegar apenas números do CPF pesquisado
    const searchCpf = cpfFomatado.replace(/\D/g, '');

    try {
        // 1. Buscar o funcionário (traz todos e filtra no JS para garantir match de CPF independente de máscara no BD)
        const allFuncsSnap = await db.collection('funcionarios').get();
        let funcDoc = null;
        
        for (let doc of allFuncsSnap.docs) {
            const data = doc.data();
            if (data.cpf && data.cpf.replace(/\D/g, '') === searchCpf) {
                funcDoc = doc;
                break;
            }
        }
        
        if (!funcDoc) {
            areaHistorico.style.display = 'none';
            return false; // Não encontrou nenhum colaborador com esse CPF
        }
        
        const funcData = funcDoc.data();
        const funcId = funcDoc.id;

        areaHistorico.style.display = 'block';
        let html = `<strong>Status Atual:</strong> <span class="badge ${funcData.status === 'Ativo' ? 'bg-success' : 'bg-danger'}">${funcData.status || 'Desconhecido'}</span><br>`;
        html += `<strong>Nome no Sistema:</strong> ${funcData.nome}<br>`;

        if (funcData.status !== 'Ativo') {
            html += `<strong>Motivo Desligamento:</strong> ${funcData.motivoDesligamento || funcData.tipoDemissao || 'Não informado no cadastro'}<br>`;
        }

        // 2. Buscar Ocorrências e Atestados
        const ocorrenciasSnap = await db.collection('ocorrencias_saude').where('colaboradorId', '==', funcId).get();
        html += `<hr class="my-2"><strong>Ocorrências / Atestados (Saúde):</strong> `;
        if (!ocorrenciasSnap.empty) {
            html += `${ocorrenciasSnap.size} registro(s) encontrado(s).<br><ul class="mb-1 pl-3">`;
            ocorrenciasSnap.docs.forEach(doc => {
                const oc = doc.data();
                html += `<li><small>${oc.data ? new Date(oc.data.seconds * 1000).toLocaleDateString() : 'Data não info.'} - ${oc.tipo || 'Sem tipo'} (${oc.descricao || 'Sem motivo'})</small></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<span class="text-success">Nenhum atestado/ocorrência.</span><br>`;
        }

        // Buscar Histórico de Faltas
        const faltasSnap = await db.collection('faltas').where('funcionarioId', '==', funcId).get();
        html += `<hr class="my-2"><strong>Histórico de Faltas:</strong> `;
        if (!faltasSnap.empty) {
            html += `${faltasSnap.size} falta(s) registrada(s).<br><ul class="mb-1 pl-3">`;
            faltasSnap.docs.forEach(doc => {
                const f = doc.data();
                const dataFalta = f.data && f.data.seconds ? new Date(f.data.seconds * 1000).toLocaleDateString() : (f.data ? new Date(f.data).toLocaleDateString() : 'Data não info.');
                html += `<li><small>${dataFalta} - ${f.justificada ? 'Justificada' : 'Injustificada'}</small></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<span class="text-success">Nenhuma falta registrada.</span><br>`;
        }

        // Buscar Histórico Disciplinar
        const disciplinarSnap = await db.collection('registros_disciplinares').where('funcionarioId', '==', funcId).get();
        html += `<hr class="my-2"><strong class="text-danger">Histórico Disciplinar:</strong> `;
        if (!disciplinarSnap.empty) {
            html += `${disciplinarSnap.size} registro(s) encontrado(s).<br><ul class="mb-1 pl-3">`;
            disciplinarSnap.docs.forEach(doc => {
                const d = doc.data();
                const dataOcorrencia = d.dataOcorrencia && d.dataOcorrencia.seconds ? new Date(d.dataOcorrencia.seconds * 1000).toLocaleDateString() : (d.dataOcorrencia ? new Date(d.dataOcorrencia).toLocaleDateString() : 'Data não info.');
                html += `<li><small class="text-danger">${dataOcorrencia} - ${d.classificacao || 'Advertência'} / ${d.medidaAplicada || 'N/A'}: ${d.descricao || 'Sem motivo registrado'}</small></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<span class="text-success">Nenhuma ocorrência disciplinar.</span><br>`;
        }

        // 3. Buscar Entrevista Demissional
        const entrevistasSnap = await db.collection('entrevistas_demissionais').where('funcionarioId', '==', funcId).get();
        if (!entrevistasSnap.empty) {
            const ent = entrevistasSnap.docs[0].data();
            html += `<hr class="my-2"><strong>Entrevista Demissional:</strong><br>`;
            html += `<small><b>Motivo Alegado pelo Funcionário:</b> ${ent.motivoDesligamento || '-'}<br>`;
            html += `<b>Recomendaria a empresa?</b> ${ent.recomendariaEmpresa === 'sim' ? 'Sim' : 'Não'}<br>`;
            html += `<b>Interesse em retornar?</b> ${ent.interesseRetornar === 'sim' ? 'Sim' : 'Não'}<br>`;
            if (ent.pontosPositivos) html += `<b>Pontos Positivos:</b> ${ent.pontosPositivos}<br>`;
            if (ent.principaisDesafios) html += `<b>Desafios:</b> ${ent.principaisDesafios}</small><br>`;
        }

        // 4. Buscar Gestão de Sumidos (Abandono)
        const sumidosSnap = await db.collection('casos_sumidos').where('funcionarioId', '==', funcId).get();
        html += `<hr class="my-2"><strong>Gestão de Sumidos (Abandono de Emprego):</strong> `;
        if (!sumidosSnap.empty) {
            html += `${sumidosSnap.size} registro(s) encontrado(s).<br><ul class="mb-1 pl-3">`;
            sumidosSnap.docs.forEach(doc => {
                const s = doc.data();
                const dataUltimoPonto = s.dataUltimoPonto && s.dataUltimoPonto.seconds ? new Date(s.dataUltimoPonto.seconds * 1000) : (s.dataUltimoPonto ? new Date(s.dataUltimoPonto) : null);
                let detalhes = `Último ponto: ${dataUltimoPonto ? dataUltimoPonto.toLocaleDateString() : 'Desconhecida'} - Status: ${s.status}`;
                
                // Calcula os dias sumidos se houver data de rescisão
                const dataRescisaoRaw = funcData.dataDesligamento || funcData.dataDemissao;
                if (dataUltimoPonto && dataRescisaoRaw) {
                    const dataRescisao = dataRescisaoRaw.seconds ? new Date(dataRescisaoRaw.seconds * 1000) : new Date(dataRescisaoRaw);
                    const diffTime = Math.abs(dataRescisao - dataUltimoPonto);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    detalhes += `<br><span class="text-danger">-> ${diffDays} dia(s) sumido até a rescisão.</span>`;
                }

                html += `<li><small>${detalhes}</small></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<span class="text-success">Nenhum registro de abandono.</span><br>`;
        }

        // Alertas visuais
        if (funcData.status === 'Ativo') {
            html = `<div class="alert alert-danger mb-0"><strong>Atenção:</strong> Este CPF pertence a um colaborador ATUALMENTE ATIVO na empresa.</div>` + html;
        }

        areaHistorico.style.display = 'block';
        resultHistorico.innerHTML = html;
        return true; // Encontrou o colaborador
    } catch (error) {
        console.error('Erro ao consultar histórico interno:', error);
        resultHistorico.innerHTML = '<span class="text-danger">Erro ao carregar histórico interno.</span>';
        areaHistorico.style.display = 'block';
        return false;
    }
}

// -----------------------------------------------------
// FUNÇÕES DO MODAL DE DOCUMENTOS DO ESCAVADOR (PDF)
// -----------------------------------------------------

window.abrirDocumentosEscavador = async function(numeroCnj) {
    if (!escavadorToken) {
        alert("Token do Escavador não encontrado.");
        return;
    }

    // Prepara e abre o modal
    document.getElementById('docEscavadorProcessoNum').textContent = numeroCnj;
    const listaContainer = document.getElementById('listaDocumentosContainer');
    const pdfFrame = document.getElementById('escavadorPdfFrame');
    const overlay = document.getElementById('pdfViewerOverlay');
    
    listaContainer.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin fa-2x mb-2"></i><br>Buscando documentos públicos...</div>';
    pdfFrame.style.display = 'none';
    pdfFrame.src = '';
    overlay.style.display = 'flex';
    
    // Mostra o modal (precisa garantir que foi carregado pelo view-loader)
    const modalEl = document.getElementById('modalDocumentosEscavador');
    if (!modalEl) {
        alert("O modal de documentos ainda não foi carregado na página.");
        return;
    }
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    try {
        const response = await fetch(`https://api.escavador.com/api/v1/processos/numero_cnj/${numeroCnj}/documentos-publicos`, {
            headers: { 'Authorization': `Bearer ${escavadorToken}`, 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            if(response.status === 404) {
                 listaContainer.innerHTML = '<div class="alert alert-warning m-2">Nenhum documento público encontrado para este processo.</div>';
                 return;
            }
            throw new Error(`Erro API Escavador: ${response.status}`);
        }

        const data = await response.json();
        const itens = data.items || [];
        
        if (itens.length === 0) {
            listaContainer.innerHTML = '<div class="alert alert-warning m-2">Nenhum documento público disponível nesta rota para este processo.</div>';
            return;
        }

        let html = '<div class="list-group list-group-flush">';
        itens.forEach(doc => {
            const dataStr = doc.data ? new Date(doc.data).toLocaleDateString() : 'Data N/A';
            html += `
                <a href="#" class="list-group-item list-group-item-action py-3" onclick="carregarPDFEscavador(event, '${numeroCnj}', '${doc.id}')">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 text-primary"><i class="far fa-file-alt"></i> ${doc.titulo || 'Documento'}</h6>
                        <small class="text-muted">${dataStr}</small>
                    </div>
                    <p class="mb-1 small">${doc.tipo || ''}</p>
                </a>
            `;
        });
        html += '</div>';
        listaContainer.innerHTML = html;

    } catch (error) {
        console.error("Erro ao buscar documentos:", error);
        listaContainer.innerHTML = `<div class="alert alert-danger m-2">Falha ao carregar documentos.<br><small>${error.message}</small></div>`;
    }
};

window.carregarPDFEscavador = async function(event, numeroCnj, docId) {
    event.preventDefault();
    
    // Atualiza UI da lista para mostrar o selecionado
    const links = document.getElementById('listaDocumentosContainer').querySelectorAll('a.list-group-item');
    links.forEach(el => el.classList.remove('active', 'bg-light'));
    event.currentTarget.classList.add('active');

    const pdfFrame = document.getElementById('escavadorPdfFrame');
    const overlay = document.getElementById('pdfViewerOverlay');
    
    // Mostra loading no overlay
    overlay.innerHTML = '<i class="fas fa-spinner fa-spin fa-3x mb-3 text-secondary"></i><h5>Baixando e decodificando PDF...</h5>';
    overlay.style.display = 'flex';
    pdfFrame.style.display = 'none';

    try {
        const response = await fetch(`https://api.escavador.com/api/v1/processos/numero_cnj/${numeroCnj}/documentos/${docId}`, {
            headers: { 'Authorization': `Bearer ${escavadorToken}`, 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) throw new Error(`Erro API ao baixar documento: ${response.status}`);
        
        // A API de download do Escavador geralmente retorna os bytes do PDF
        const blob = await response.blob();
        
        // Verifica se realmente é um PDF ou JSON (erro mascarado)
        if (blob.type.includes("json")) {
             const text = await blob.text();
             const json = JSON.parse(text);
             throw new Error(json.message || "Erro desconhecido da API");
        }
        
        const blobUrl = URL.createObjectURL(blob);
        pdfFrame.src = blobUrl;
        
        // Esconde o overlay e mostra o iframe
        pdfFrame.onload = function() {
            overlay.style.display = 'none';
            pdfFrame.style.display = 'block';
        };

    } catch(error) {
        console.error("Erro no PDF:", error);
        overlay.innerHTML = `<i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i><h5 class="text-white">Erro ao visualizar PDF</h5><p class="small text-white-50">${error.message}</p>`;
    }
};

/* =============================================
   IMPRESSÃO DA FICHA DO CANDIDATO
   ============================================= */
window.imprimirFichaCandidato = function() {
    const nome = document.getElementById('candidatoNome').value || 'Não informado';
    let cpf = document.getElementById('candidatoCpf').value || 'Não informado';
    const telefone = document.getElementById('candidatoTelefone').value || 'Não informado';
    const email = document.getElementById('candidatoEmail').value || 'Não informado';
    const vagaSelect = document.getElementById('candidatoVagaId');
    const vaga = vagaSelect.options[vagaSelect.selectedIndex]?.text || 'Não informada';
    const anotacoes = document.getElementById('candidatoAnotacoes').value || 'Sem anotações.';
    
    // Fallbacks if elements are hidden/empty before fetching
    const elHistInterno = document.getElementById('resultadoHistorico');
    const elEscavador = document.getElementById('resultadoEscavador');
    const elProcInternos = document.getElementById('resultadoProcessosInternos');

    const histInterno = elHistInterno ? elHistInterno.innerHTML : '';
    let procEscavador = elEscavador ? elEscavador.innerHTML : '';
    const procInternos = elProcInternos ? elProcInternos.innerHTML : '';

    // Remove buttons and interaction elements from Escavador HTML for printing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = procEscavador;
    tempDiv.querySelectorAll('button').forEach(b => b.remove());
    tempDiv.querySelectorAll('a').forEach(a => a.remove()); // Remove links to avoid clutter
    tempDiv.querySelectorAll('.review-actions').forEach(d => d.remove());
    const escavadorClean = tempDiv.innerHTML;

    const dataAtual = new Date().toLocaleString('pt-BR');

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Ficha de Antecedentes - ${nome}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
            @page {
                size: A4;
                margin: 15mm;
            }
            
            body {
                font-family: 'Inter', sans-serif;
                color: #333;
                line-height: 1.5;
                margin: 0;
                padding: 0;
                background: #fff;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #1e3a8a;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }

            .header-logo {
                font-size: 24px;
                font-weight: 700;
                color: #1e3a8a;
                letter-spacing: -0.5px;
            }

            .header-logo span {
                color: #ef4444;
            }

            .header-info {
                text-align: right;
                font-size: 10px;
                color: #666;
            }

            .doc-title {
                text-align: center;
                font-size: 18px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 25px;
                color: #111827;
            }

            .section {
                margin-bottom: 25px;
                page-break-inside: avoid;
            }

            .section-title {
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                background-color: #f3f4f6;
                padding: 8px 12px;
                border-left: 4px solid #1e3a8a;
                margin-bottom: 15px;
                color: #374151;
            }

            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }

            .info-item {
                font-size: 12px;
            }

            .info-item strong {
                display: block;
                color: #6b7280;
                font-size: 10px;
                text-transform: uppercase;
                margin-bottom: 2px;
            }

            .info-item div {
                font-weight: 600;
                color: #111827;
            }

            .box-content {
                font-size: 12px;
                border: 1px solid #e5e7eb;
                padding: 15px;
                border-radius: 6px;
            }

            .box-content p { margin-top: 0; }

            /* Escavador clean styles */
            .process-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .process-card {
                border: 1px solid #d1d5db;
                border-radius: 6px;
                padding: 10px;
                background: #f9fafb;
                page-break-inside: avoid;
            }
            .process-header {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 8px;
                margin-bottom: 8px;
            }
            .process-number { font-weight: 700; color: #1e3a8a; }
            .process-title { font-size: 11px; color: #4b5563; }
            .match-badge {
                font-size: 10px;
                font-weight: bold;
                padding: 3px 6px;
                border-radius: 4px;
                border: 1px solid #9ca3af;
                background: #fff;
            }
            .process-details p {
                margin: 2px 0;
                font-size: 11px;
            }
            .escavador-summary {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
            }
            .summary-card {
                flex: 1;
                border: 1px solid #e5e7eb;
                padding: 10px;
                text-align: center;
                background: #fff;
                border-radius: 4px;
            }
            .summary-card .count { font-size: 16px; font-weight: bold; }
            .summary-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
            
            .text-danger { color: #dc2626; }
            .text-success { color: #16a34a; }
            .text-warning { color: #d97706; }
            .text-primary { color: #2563eb; }
            .text-muted { color: #6b7280; }

            .alert { padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; margin-bottom: 10px; }
            .badge { padding: 2px 5px; background: #e5e7eb; border-radius: 3px; font-size: 10px; }

            .signature-area {
                margin-top: 50px;
                display: flex;
                justify-content: space-around;
                page-break-inside: avoid;
            }

            .signature-line {
                width: 250px;
                border-top: 1px solid #000;
                text-align: center;
                padding-top: 5px;
                font-size: 11px;
                font-weight: 600;
            }
            .signature-line span {
                display: block;
                font-size: 10px;
                font-weight: 400;
                color: #666;
            }

            ul { padding-left: 20px; margin-top: 5px; }
            li { margin-bottom: 5px; font-size: 12px; }
        </style>
    </head>
    <body>

        <div class="header">
            <div class="header-logo">Nexter <span>/ RH Crival</span></div>
            <div class="header-info">
                Documento de Uso Restrito e Confidencial<br>
                Gerado em: ${dataAtual}
            </div>
        </div>

        <div class="doc-title">Relatório de Antecedentes e Ficha do Candidato</div>

        <div class="section">
            <div class="section-title">Dados do Candidato</div>
            <div class="box-content info-grid">
                <div class="info-item">
                    <strong>Nome Completo</strong>
                    <div>${nome}</div>
                </div>
                <div class="info-item">
                    <strong>CPF</strong>
                    <div>${cpf}</div>
                </div>
                <div class="info-item">
                    <strong>Telefone / WhatsApp</strong>
                    <div>${telefone}</div>
                </div>
                <div class="info-item">
                    <strong>E-mail</strong>
                    <div>${email}</div>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <strong>Vaga Pretendida</strong>
                    <div>${vaga}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Histórico na Empresa (Ex-Colaborador)</div>
            <div class="box-content">
                ${histInterno.trim() && !histInterno.includes('Buscando registros internos') ? histInterno : 'Nenhum registro verificado.'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Processos Jurídicos Internos</div>
            <div class="box-content">
                ${procInternos.trim() && !procInternos.includes('Buscando') ? procInternos : 'Nenhum registro interno verificado.'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Consulta de Antecedentes (Escavador)</div>
            <div class="box-content" style="border: none; padding: 0;">
                ${escavadorClean.trim() && !escavadorClean.includes('Buscando') ? escavadorClean : '<div class="alert">Nenhuma busca de antecedentes realizada ou sem resultados.</div>'}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Parecer / Anotações do Entrevistador</div>
            <div class="box-content" style="min-height: 80px;">
                ${anotacoes.replace(/\n/g, '<br>')}
            </div>
        </div>

        <div class="signature-area">
            <div class="signature-line">
                ${nome}
                <span>Candidato</span>
            </div>
            <div class="signature-line">
                Responsável RH
                <span>Nexter / RH Crival</span>
            </div>
        </div>

        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 800);
            };
        </script>
    </body>
    </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
    } else {
        alert('Por favor, permita pop-ups neste site para poder imprimir a ficha.');
    }
};

// --- MBTI MODULE (Recrutamento) ---

document.getElementById('candidatoVagaId').addEventListener('change', () => {
    const id = document.getElementById('candidatoId').value;
    if(id) carregarMBTICandidato(id);
});

async function carregarMBTICandidato(candidatoId) {
    const container = document.getElementById('candidato-mbti-resultado');
    if(!container) return;
    
    let candidatoMBTI = null;
    
    try {
        const doc = await db.collection('candidatos').doc(candidatoId).get();
        const data = doc.data();
        if(data && data.mbti) {
            candidatoMBTI = data.mbti;
            container.innerHTML = `
                <div class="d-flex flex-column">
                    <span class="badge bg-primary fs-6 mb-1 align-self-start">${data.mbti.tipo}</span>
                    <strong class="text-dark">${data.mbti.titulo}</strong>
                    <span class="text-muted small">${data.mbti.grupo}</span>
                </div>
            `;
        } else {
            container.innerHTML = `<span class="text-muted fst-italic small">Teste MBTI ainda não realizado.</span>`;
        }
        
        await calcularMatchMBTI(candidatoMBTI);
    } catch(e) {
        console.error("Erro ao carregar MBTI", e);
    }
}

function iniciarMBTICandidato() {
    const id = document.getElementById('candidatoId').value;
    if(!id) {
        if(typeof mostrarMensagem === 'function') {
            mostrarMensagem('Salve o candidato primeiro para gerar a ficha, depois aplique o teste.', 'warning');
        } else {
            alert('Salve o candidato primeiro para gerar a ficha, depois aplique o teste.');
        }
        return;
    }
    
    if(typeof abrirModalMBTI === 'function') {
        abrirModalMBTI(id, 'candidato');
    } else {
        console.error('Função abrirModalMBTI não encontrada.');
    }
}

async function calcularMatchMBTI(candidatoMBTI) {
    const matchContainer = document.getElementById('gerente-mbti-resultado');
    const vagaId = document.getElementById('candidatoVagaId').value;
    
    if(!vagaId) {
        matchContainer.innerHTML = '<span class="text-muted fst-italic small">Selecione uma vaga para carregar o perfil do gestor.</span>';
        return;
    }
    
    try {
        // 1. Pegar a Vaga
        const vagaDoc = await db.collection('vagas').doc(vagaId).get();
        if(!vagaDoc.exists) throw new Error('Vaga não encontrada');
        const setorId = vagaDoc.data().setorId;
        
        if(!setorId) {
            matchContainer.innerHTML = '<span class="text-muted small">Vaga não vinculada a um setor específico.</span>';
            return;
        }
        
        // 2. Pegar o Setor (para achar o Lider/Gerente)
        const setorDoc = await db.collection('setores').doc(setorId).get();
        if(!setorDoc.exists) throw new Error('Setor não encontrado');
        const liderId = setorDoc.data().liderId;
        const liderNome = setorDoc.data().liderNome || 'Gerente';
        
        if(!liderId) {
            matchContainer.innerHTML = `<span class="text-muted small">Setor <strong>${setorDoc.data().nome}</strong> não possui gerente definido.</span>`;
            return;
        }
        
        // 3. Pegar o MBTI do Gerente
        const funcDoc = await db.collection('funcionarios').doc(liderId).get();
        if(!funcDoc.exists) throw new Error('Gerente não encontrado');
        const gerenteData = funcDoc.data();
        const gerenteMBTI = gerenteData.mbti;
        
        if(!gerenteMBTI) {
            matchContainer.innerHTML = `
                <div class="alert alert-warning py-2 mb-0 small">
                    <i class="fas fa-exclamation-triangle"></i> O gestor <strong>${liderNome}</strong> ainda não realizou o Teste MBTI.
                </div>`;
            return;
        }
        
        // 4. Calcular e Exibir Match
        let matchText = '<div class="alert alert-info py-2 mb-0 small"><i class="fas fa-info-circle"></i> O candidato precisa fazer o teste para calcular a compatibilidade.</div>';
        
        if(candidatoMBTI) {
            // Lógica Básica de Match (Exemplo simples baseado em letras em comum)
            let letrasIguais = 0;
            for(let i=0; i<4; i++) {
                if(candidatoMBTI.tipo[i] === gerenteMBTI.tipo[i]) letrasIguais++;
            }
            
            let percentual = (letrasIguais / 4) * 100;
            let badgeClass = percentual >= 75 ? 'bg-success' : (percentual === 50 ? 'bg-warning text-dark' : 'bg-danger');
            let txtCompatibilidade = percentual >= 75 ? 'Alta afinidade' : (percentual === 50 ? 'Afinidade moderada' : 'Perfis complementares/opostos');
            
            matchText = `
                <div class="d-flex align-items-center mb-2">
                    <span class="badge ${badgeClass} fs-6 me-2">${percentual}% Match</span>
                    <span class="fw-bold text-secondary">${txtCompatibilidade}</span>
                </div>
            `;
        }
        
        matchContainer.innerHTML = `
            <div class="mb-2">
                <span class="badge bg-secondary mb-1">${gerenteMBTI.tipo}</span>
                <strong class="text-dark d-block" style="font-size:0.9rem;">${liderNome}</strong>
                <span class="text-muted small">${gerenteMBTI.titulo}</span>
            </div>
            ${matchText}
        `;
        
    } catch(e) {
        console.error("Erro ao calcular match", e);
        matchContainer.innerHTML = '<span class="text-danger small">Erro ao carregar dados do gerente.</span>';
    }
}
