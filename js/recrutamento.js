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
            
            let tagsHtml = '';
            if (cand.mbti) {
                tagsHtml += `<span class="badge bg-primary mb-1 me-1" title="Perfil MBTI"><i class="fas fa-brain"></i> ${cand.mbti.perfil}</span>`;
            }
            if (cand.escavador_summary) {
                const total = cand.escavador_summary.total || 0;
                const badgeClass = total > 0 ? 'bg-danger' : 'bg-success';
                tagsHtml += `<span class="badge ${badgeClass} mb-1" title="Processos Escavador"><i class="fas fa-gavel"></i> ${total} Proc.</span>`;
            }

            card.innerHTML = `
                <div class="kanban-card-title">${cand.nome}</div>
                <div class="small text-muted mb-2"><i class="fas fa-briefcase"></i> ${vagaTitle}</div>
                ${tagsHtml ? `<div class="mb-2">${tagsHtml}</div>` : ''}
                <div class="d-flex justify-content-between align-items-center mt-2 border-top pt-2">
                    <span class="badge bg-light text-dark border"><i class="fas fa-phone"></i> ${cand.telefone || '-'}</span>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-primary" onclick="editarCandidato('${cand.id}')" title="Ver Detalhes">
                            <i class="fas fa-folder-open"></i> Ficha
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Opções">
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                                <li><a class="dropdown-item" href="#" onclick="avancarFaseCandidato(event, '${cand.id}', '${fase}')"><i class="fas fa-step-forward text-success me-2"></i>Avançar Fase</a></li>
                                <li><a class="dropdown-item" href="#" onclick="reprovarCandidato(event, '${cand.id}')"><i class="fas fa-archive text-warning me-2"></i>Reprovar (Banco)</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="excluirCandidato(event, '${cand.id}')"><i class="fas fa-trash-alt me-2"></i>Excluir Candidato</a></li>
                            </ul>
                        </div>
                    </div>
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
   GESTÃO DE MODAIS E FORMULÃRIOS
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
    _checarPermissaoEscavadorCandidato();
    document.getElementById('formCandidato').reset();
    document.getElementById('candidatoId').value = '';
    document.getElementById('candidatoFaseAtual').value = 'triagem';
    document.getElementById('linkCurriculoAtual').innerHTML = '';
    document.getElementById('areaEscavador').style.display = 'none';
    const elAreaProcessos = document.getElementById('areaProcessosInternos');
    if (elAreaProcessos) elAreaProcessos.style.display = 'none';
    
    // MBTI Removido

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
    
    _checarPermissaoEscavadorCandidato();
    
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
    
    // Renderizar Painel de Resumo do Totem
    const painelResumo = document.getElementById('painel-resumo-totem');
    if (cand.escavador_summary) {
        painelResumo.style.display = 'block';
        
        const escavadorDiv = document.getElementById('totem-resumo-escavador');
        if (escavadorDiv) {
            const sum = cand.escavador_summary;
            if (sum.total === 0) {
                escavadorDiv.innerHTML = '<span class="badge bg-success"><i class="fas fa-check"></i> Nada Consta</span>';
            } else {
                let badges = `<span class="badge bg-secondary mb-1">Total: ${sum.total}</span> `;
                if(sum.confirmed > 0) badges += `<span class="badge bg-danger mb-1">Confirmados: ${sum.confirmed}</span> `;
                if(sum.homonyms > 0) badges += `<span class="badge bg-warning text-dark mb-1">Homônimos: ${sum.homonyms}</span> `;
                if(sum.possible > 0) badges += `<span class="badge bg-info text-dark mb-1">Possíveis: ${sum.possible}</span> `;
                escavadorDiv.innerHTML = badges + `<br><small class="text-primary mt-1 d-block" style="cursor:pointer;" onclick="consultarCandidatoAPI()"><i class="fas fa-search-plus"></i> Ver Detalhes (Buscando Novamente)</small>`;
            }
        }
    } else {
        painelResumo.style.display = 'none';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalCandidato'));
    modal.show();

    // MBTI e Match Comportamental movidos para o módulo de RH
    // carregarMBTICandidato(id);
}

async function _checarPermissaoEscavadorCandidato() {
    const btn = document.getElementById('btn-escavador-candidato');
    if (!btn) return;
    let permitir = window.currentUserPermissions?.isAdmin || window.currentUserPermissions?.permitirEscavador;
    if (!permitir && window.configFluxos) {
        permitir = await window.configFluxos.getConfiguracao('permitirEscavador') === true;
    }
    btn.style.display = permitir ? 'inline-block' : 'none';
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


    // Esconder painéis seguintes
    areaInterna.style.display = 'none';
    area.style.display = 'none';
    
    // Injetar botões de ação do Passo 1
    const resultHistorico = document.getElementById('resultadoHistorico');
    if (!funcionarioEncontradoInternamente) {
        resultHistorico.innerHTML = `
            <div class="card shadow-sm border-0 rounded-3 bg-light">
                <div class="card-body py-3">
                    <span class="text-success fw-medium"><i class="fas fa-check-circle me-2"></i>Nenhum histórico de trabalho anterior encontrado na empresa.</span>
                </div>
            </div>`;
    }
    
    resultHistorico.innerHTML += `
        <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
            <button type="button" class="btn btn-outline-danger px-4 rounded-pill fw-medium shadow-sm transition-transform" onclick="reprovarCandidatoImediato()" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <i class="fas fa-times-circle me-1"></i> Reprovar Candidato
            </button>
            <button type="button" class="btn btn-primary px-4 rounded-pill fw-medium shadow-sm transition-transform" onclick="consultarPasso2Juridico()" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                Avançar p/ Passo 2 <i class="fas fa-play ms-1"></i>
            </button>
        </div>
    `;
    
    document.getElementById('areaHistoricoColaborador').style.display = 'block';
}

window.consultarPasso2Juridico = async function() {
    const inputNome = document.getElementById('candidatoNome');
    const areaInterna = document.getElementById('areaProcessosInternos');
    const divResultInterno = document.getElementById('resultadoProcessosInternos');
    
    const nomeAtual = inputNome.value.trim().toLowerCase();
    areaInterna.style.display = 'block';
    
    if (!nomeAtual) {
        divResultInterno.innerHTML = `
            <div class="card shadow-sm border-0 rounded-3 bg-light">
                <div class="card-body py-3">
                    <span class="text-warning fw-medium"><i class="fas fa-exclamation-triangle me-2"></i>Nome não preenchido para buscar no Jurídico Interno.</span>
                </div>
            </div>`;
    } else {
        let htmlInternos = `
            <div class="card shadow-sm border-0 rounded-3 bg-light">
                <div class="card-body py-3">
        `;
        try {
            const processosJuridicosSnap = await db.collection('processos_juridicos').get();
            const processosContraEmpresa = processosJuridicosSnap.docs.filter(doc => {
                const data = doc.data();
                return data.parteContraria && data.parteContraria.toLowerCase() === nomeAtual;
            });

            if (processosContraEmpresa.length > 0) {
                htmlInternos += `<h6 class="text-danger mb-3"><i class="fas fa-exclamation-circle me-2"></i>Foram encontrados processos contra a empresa:</h6><ul class="list-group list-group-flush small">`;
                processosContraEmpresa.forEach(doc => {
                    const proc = doc.data();
                    htmlInternos += `<li class="list-group-item px-0 py-1 bg-transparent border-0"><i class="fas fa-gavel text-muted me-2"></i><strong class="text-danger">${proc.numeroProcesso || 'S/N'}</strong> - ${proc.tipoAcao || 'Ação'} <span class="badge bg-secondary ms-2">${proc.status || 'N/A'}</span></li>`;
                });
                htmlInternos += `</ul>`;
            } else {
                htmlInternos += `<span class="text-success fw-medium"><i class="fas fa-check-circle me-2"></i>Nada consta no sistema Jurídico Interno para este nome.</span>`;
            }
        } catch (err) {
            htmlInternos += `<span class="text-warning fw-medium"><i class="fas fa-exclamation-triangle me-2"></i>Sistema Jurídico Interno indisponível.</span>`;
        }
        htmlInternos += `</div></div>`;
        divResultInterno.innerHTML = htmlInternos;
    }

    divResultInterno.innerHTML += `
        <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
            <button type="button" class="btn btn-outline-danger px-4 rounded-pill fw-medium shadow-sm transition-transform" onclick="reprovarCandidatoImediato()" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <i class="fas fa-times-circle me-1"></i> Reprovar Candidato
            </button>
            <button type="button" class="btn btn-primary px-4 rounded-pill fw-medium shadow-sm transition-transform" onclick="prepararPasso3Escavador()" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                Avançar p/ Passo 3 <i class="fas fa-play ms-1"></i>
            </button>
        </div>
    `;
}

window.prepararPasso3Escavador = function() {
    const area = document.getElementById('areaEscavador');
    const divResult = document.getElementById('resultadoEscavador');
    const exactCheck = document.getElementById('buscaExataCpf');
    const modeToUse = (exactCheck && exactCheck.checked) ? 'AUTO' : 'HOMONIMOS_ONLY';

    area.style.display = 'block';
    divResult.innerHTML = `
        <div class="card shadow-sm border-warning rounded-3 border-top border-warning border-3">
            <div class="card-body">
                <h6 class="card-title text-warning-emphasis"><i class="fas fa-search-dollar me-2"></i>Consulta de Antecedentes Externa (Escavador)</h6>
                <p class="small text-muted mb-4">A consulta processual em tribunais gera custos adicionais para a empresa por CPF. Verifique as informações internas nos passos anteriores. Se for necessário confirmar antecedentes na justiça, execute a busca externa abaixo.</p>
                
                <div class="d-flex justify-content-between align-items-center mt-2 pt-3 border-top">
                    <button type="button" class="btn btn-outline-danger px-4 rounded-pill fw-medium shadow-sm transition-transform" onclick="reprovarCandidatoImediato()" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fas fa-times-circle me-1"></i> Reprovar Candidato
                    </button>
                    <button type="button" class="btn btn-warning px-4 rounded-pill fw-bold shadow-sm transition-transform text-dark" onclick="consultarEscavadorAPI('${modeToUse}')" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fas fa-balance-scale me-1"></i> Consultar Antecedentes
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.reprovarCandidatoImediato = function() {
    const statusSelect = document.getElementById('candidatoStatus');
    if (statusSelect) {
        statusSelect.value = 'Reprovado';
    }
    mostrarMensagem('Candidato reprovado na triagem. Status atualizado.', 'warning');
    if (typeof salvarCandidato === 'function') {
        salvarCandidato();
    }
}

window.consultarEscavadorAPI = async function(modeToUse) {
    const cpfRaw = document.getElementById('candidatoCpf').value;
    const cpf = cpfRaw.replace(/\D/g, '');
    const divResult = document.getElementById('resultadoEscavador');
    const inputNome = document.getElementById('candidatoNome');
    const personId = document.getElementById('candidatoId').value || currentCandidatoId;

    if (!modeToUse) {
        const exactCheck = document.getElementById('buscaExataCpf');
        modeToUse = (exactCheck && exactCheck.checked) ? 'AUTO' : 'HOMONIMOS_ONLY';
    }

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
        const data = await window.frontendEscavadorSearch(cpf, inputNome ? inputNome.value : '', modeToUse);
        const response = { ok: data.status === 'SUCCESS_WITH_RESULTS' || data.status === 'SUCCESS_NO_RESULTS' };
        
        let htmlResultados = '';

        if (response.ok && data.status === 'SUCCESS_WITH_RESULTS') {
            const sum = data.summary;
            
            // Header
            htmlResultados += `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0 text-primary"><i class="fas fa-gavel"></i> ${sum.total} processos encontrados</h5>
                    ${modeToUse !== 'ALWAYS' ? `<button class="btn btn-sm btn-outline-secondary" onclick="consultarEscavadorAPI('ALWAYS')"><i class="fas fa-search-plus"></i> Executar busca ampliada</button>` : ''}
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
                        <div class="label">Possíveis HomÃ´nimos</div>
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
                            <p><strong>Ã rea:</strong> <span class="badge bg-secondary">${proc.capa?.area || 'Não especificada'}</span></p>
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
                                    <button class="btn btn-sm btn-warning" onclick="revisarCorrespondencia('${personId}', '${proc.numero_cnj}', 'HOMONYM')"><i class="fas fa-ban"></i> HomÃ´nimo</button>
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
                ${modeToUse !== 'ALWAYS' ? `<button class="btn btn-sm btn-outline-primary mt-2" onclick="consultarEscavadorAPI('ALWAYS')"><i class="fas fa-search-plus"></i> Executar busca ampliada (Deep Search)</button>` : ''}
            `;
        } else {
            // Tratamento de Erros Retornados pelo Backend
            let errorMsg = data.error || 'Erro ao consultar API.';
            if (data.status === 'AUTH_ERROR') errorMsg = 'Falha de autenticação com o provedor (Token Inválido).';
            if (data.status === 'NO_CREDIT') errorMsg = 'Consulta temporariamente indisponível (Sem Saldo).';
            if (data.status === 'RATE_LIMIT') errorMsg = 'Muitas consultas simultâneas. Tente novamente em breve.';
            htmlResultados += `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${errorMsg}</div>`;
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
   HISTÃ“RICO INTERNO DO EX-COLABORADOR
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

        let html = `
            <div class="card shadow-sm border-0 rounded-3 mb-3">
                <div class="card-body">
                    <h6 class="card-title text-primary"><i class="fas fa-id-badge me-2"></i>Informações do Cadastro</h6>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <small class="text-muted d-block">Status Atual</small>
                            <span class="badge ${funcData.status === 'Ativo' ? 'bg-success' : 'bg-danger'} rounded-pill px-3 py-2">${funcData.status || 'Desconhecido'}</span>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted d-block">Nome no Sistema</small>
                            <span class="fw-bold">${funcData.nome}</span>
                        </div>
        `;

        if (funcData.status !== 'Ativo') {
            html += `
                        <div class="col-12 mt-2">
                            <small class="text-muted d-block">Motivo do Desligamento</small>
                            <span class="fw-bold text-danger"><i class="fas fa-sign-out-alt me-1"></i>${funcData.motivoDesligamento || funcData.tipoDemissao || 'Não informado'}</span>
                        </div>
            `;
        }
        html += `</div></div></div>`;

        // 2. Buscar Ocorrências e Atestados
        const ocorrenciasSnap = await db.collection('ocorrencias_saude').where('colaboradorId', '==', funcId).get();
        html += `
            <div class="card shadow-sm border-0 rounded-3 mb-3">
                <div class="card-body">
                    <h6 class="card-title text-warning"><i class="fas fa-notes-medical me-2"></i>Ocorrências e Atestados Médicos</h6>
        `;
        if (!ocorrenciasSnap.empty) {
            html += `<span class="badge bg-warning text-dark mb-2">${ocorrenciasSnap.size} registro(s)</span><ul class="list-group list-group-flush small">`;
            ocorrenciasSnap.docs.forEach(doc => {
                const oc = doc.data();
                html += `<li class="list-group-item px-0 py-1 bg-transparent border-0"><i class="fas fa-caret-right text-muted me-2"></i>${oc.data ? new Date(oc.data.seconds * 1000).toLocaleDateString() : 'Data não informada'} - <strong>${oc.tipo || 'Sem tipo'}</strong> <span class="text-muted">(${oc.descricao || 'Sem motivo'})</span></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<div class="text-success small fw-medium"><i class="fas fa-check-circle me-1"></i>Nenhum atestado ou ocorrência médica.</div>`;
        }
        html += `</div></div>`;

        // Buscar Histórico de Faltas
        const faltasSnap = await db.collection('faltas').where('funcionarioId', '==', funcId).get();
        html += `
            <div class="card shadow-sm border-0 rounded-3 mb-3">
                <div class="card-body">
                    <h6 class="card-title text-danger"><i class="fas fa-user-clock me-2"></i>Histórico de Faltas</h6>
        `;
        if (!faltasSnap.empty) {
            html += `<span class="badge bg-danger mb-2">${faltasSnap.size} falta(s)</span><ul class="list-group list-group-flush small">`;
            faltasSnap.docs.forEach(doc => {
                const f = doc.data();
                const dataFalta = f.data && f.data.seconds ? new Date(f.data.seconds * 1000).toLocaleDateString() : (f.data ? new Date(f.data).toLocaleDateString() : 'Data não informada');
                html += `<li class="list-group-item px-0 py-1 bg-transparent border-0"><i class="fas fa-caret-right text-muted me-2"></i>${dataFalta} - <span class="${f.justificada ? 'text-warning' : 'text-danger fw-bold'}">${f.justificada ? 'Justificada' : 'Injustificada'}</span></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<div class="text-success small fw-medium"><i class="fas fa-check-circle me-1"></i>Nenhuma falta registrada.</div>`;
        }
        html += `</div></div>`;

        // Buscar Histórico Disciplinar
        const disciplinarSnap = await db.collection('registros_disciplinares').where('funcionarioId', '==', funcId).get();
        html += `
            <div class="card shadow-sm border-0 rounded-3 mb-3">
                <div class="card-body">
                    <h6 class="card-title text-danger"><i class="fas fa-gavel me-2"></i>Histórico Disciplinar</h6>
        `;
        if (!disciplinarSnap.empty) {
            html += `<span class="badge bg-danger mb-2">${disciplinarSnap.size} registro(s)</span><ul class="list-group list-group-flush small">`;
            disciplinarSnap.docs.forEach(doc => {
                const d = doc.data();
                const dataOcorrencia = d.dataOcorrencia && d.dataOcorrencia.seconds ? new Date(d.dataOcorrencia.seconds * 1000).toLocaleDateString() : (d.dataOcorrencia ? new Date(d.dataOcorrencia).toLocaleDateString() : 'Data não informada');
                html += `<li class="list-group-item px-0 py-1 bg-transparent border-0"><i class="fas fa-caret-right text-muted me-2"></i>${dataOcorrencia} - <strong>${d.classificacao || 'Advertência'}</strong> / ${d.medidaAplicada || 'N/A'}: <span class="text-muted">${d.descricao || 'Sem motivo registrado'}</span></li>`;
            });
            html += `</ul>`;
        } else {
            html += `<div class="text-success small fw-medium"><i class="fas fa-check-circle me-1"></i>Nenhuma ocorrência disciplinar.</div>`;
        }
        html += `</div></div>`;

        // 3. Buscar Entrevista Demissional
        const entrevistasSnap = await db.collection('entrevistas_demissionais').where('funcionarioId', '==', funcId).get();
        if (!entrevistasSnap.empty) {
            const ent = entrevistasSnap.docs[0].data();
            html += `
            <div class="card shadow-sm border-0 rounded-3 mb-3 bg-light">
                <div class="card-body">
                    <h6 class="card-title text-secondary"><i class="fas fa-comments me-2"></i>Entrevista Demissional</h6>
                    <div class="small">
                        <b>Motivo Alegado:</b> ${ent.motivoDesligamento || '-'}<br>
                        <b>Recomendaria a empresa?</b> ${ent.recomendariaEmpresa === 'sim' ? '<span class="text-success fw-bold">Sim</span>' : '<span class="text-danger fw-bold">Não</span>'}<br>
                        <b>Interesse em retornar?</b> ${ent.interesseRetornar === 'sim' ? '<span class="text-success fw-bold">Sim</span>' : '<span class="text-danger fw-bold">Não</span>'}<br>
            `;
            if (ent.pontosPositivos) html += `<b>Pontos Positivos:</b> <span class="text-muted">${ent.pontosPositivos}</span><br>`;
            if (ent.principaisDesafios) html += `<b>Desafios:</b> <span class="text-muted">${ent.principaisDesafios}</span><br>`;
            html += `</div></div></div>`;
        }

        // 4. Buscar Gestão de Sumidos (Abandono)
        const sumidosSnap = await db.collection('casos_sumidos').where('funcionarioId', '==', funcId).get();
        html += `
            <div class="card shadow-sm border-0 rounded-3 mb-3">
                <div class="card-body">
                    <h6 class="card-title text-danger"><i class="fas fa-user-ninja me-2"></i>Abandono de Emprego (Gestão de Sumidos)</h6>
        `;
        if (!sumidosSnap.empty) {
            html += `<span class="badge bg-danger mb-2">${sumidosSnap.size} registro(s)</span><ul class="list-group list-group-flush small">`;
            sumidosSnap.docs.forEach(doc => {
                const s = doc.data();
                const dataUltimoPonto = s.dataUltimoPonto && s.dataUltimoPonto.seconds ? new Date(s.dataUltimoPonto.seconds * 1000) : (s.dataUltimoPonto ? new Date(s.dataUltimoPonto) : null);
                let detalhes = `Último ponto: <strong>${dataUltimoPonto ? dataUltimoPonto.toLocaleDateString() : 'Desconhecida'}</strong> - Status: <span class="badge bg-secondary">${s.status}</span>`;
                
                const dataRescisaoRaw = funcData.dataDesligamento || funcData.dataDemissao;
                if (dataUltimoPonto && dataRescisaoRaw) {
                    const dataRescisao = dataRescisaoRaw.seconds ? new Date(dataRescisaoRaw.seconds * 1000) : new Date(dataRescisaoRaw);
                    const diffTime = Math.abs(dataRescisao - dataUltimoPonto);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    detalhes += `<div class="text-danger mt-1"><i class="fas fa-exclamation-circle me-1"></i>${diffDays} dia(s) sumido até a rescisão.</div>`;
                }
                html += `<li class="list-group-item px-0 py-1 bg-transparent border-0">${detalhes}</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<div class="text-success small fw-medium"><i class="fas fa-check-circle me-1"></i>Nenhum registro de abandono.</div>`;
        }
        html += `</div></div>`;

        // Alertas visuais
        if (funcData.status === 'Ativo') {
            html = `<div class="alert alert-danger shadow-sm border-0"><i class="fas fa-exclamation-triangle me-2"></i><strong>Atenção:</strong> Este CPF pertence a um colaborador ATUALMENTE ATIVO na empresa.</div>` + html;
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
// FUNÇÃ•ES DO MODAL DE DOCUMENTOS DO ESCAVADOR (PDF)
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

document.body.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'candidatoVagaId') {
        const id = document.getElementById('candidatoId').value;
        if(id) carregarMBTICandidato(id);
    }
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
                    <button class="btn btn-sm btn-outline-info mt-2 align-self-start" onclick="abrirGuiaMBTI('${data.mbti.tipo}')">
                        <i class="fas fa-brain me-1"></i> Como trabalhar com este perfil
                    </button>
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
    const btnAnalise = document.getElementById('btnAnalisarCompatibilidade');
    
    if(candidatoMBTI) {
        btnAnalise.style.display = 'block';
        window.currentCandidatoMBTI = candidatoMBTI;
        window.currentCandidatoNome = document.getElementById('candidatoNome').value || 'Candidato';
        matchContainer.innerHTML = `<div class="alert alert-success py-2 mb-0 small"><i class="fas fa-check-circle"></i> Perfil detectado. Clique no botão abaixo para analisar o ranking de gestores.</div>`;
    } else {
        btnAnalise.style.display = 'none';
        matchContainer.innerHTML = '<span class="text-muted fst-italic small">Aplique o teste MBTI no candidato primeiro.</span>';
    }
}

let cachedGestores = null;

async function abrirRankingMBTI() {
    if(!window.currentCandidatoMBTI) return;
    const candType = window.currentCandidatoMBTI.tipo || window.currentCandidatoMBTI.perfil;
    
    document.getElementById('mbtiRankCandidatoNome').textContent = window.currentCandidatoNome;
    document.getElementById('mbtiRankCandidatoPerfil').textContent = candType;
    document.getElementById('mbtiRankDetalhes').style.display = 'none';
    document.getElementById('mbtiRankPlaceholder').style.display = 'flex';
    document.getElementById('mbtiRankingList').innerHTML = '<div class="p-4 text-center text-muted"><i class="fas fa-spinner fa-spin fa-2x mb-2"></i><br>Buscando gestores...</div>';

    const modal = new bootstrap.Modal(document.getElementById('modalMBTICompatibilidade'));
    modal.show();

    try {
        if(!cachedGestores) {
            const funcs = await db.collection('funcionarios').get();
            cachedGestores = [];
            funcs.forEach(doc => {
                const data = doc.data();
                if(data.mbti && (data.cargo && (data.cargo.toLowerCase().includes('gerente') || data.cargo.toLowerCase().includes('coordenador') || data.cargo.toLowerCase().includes('lider')))) {
                    cachedGestores.push({ id: doc.id, nome: data.nome, mbti: data.mbti.tipo || data.mbti.perfil });
                } else if(data.mbti && data.isAdmin) {
                    cachedGestores.push({ id: doc.id, nome: data.nome, mbti: data.mbti.tipo || data.mbti.perfil });
                }
            });
        }

        if(cachedGestores.length === 0) {
            document.getElementById('mbtiRankingList').innerHTML = '<div class="alert alert-warning m-3">Nenhum gestor com perfil MBTI encontrado no sistema.</div>';
            return;
        }

        const resultados = cachedGestores.map(gest => {
            const calc = MBTICompatibilityEngine.calcular(candType, gest.mbti);
            return { ...gest, ...calc };
        });

        resultados.sort((a, b) => b.geral - a.geral);

        let html = '';
        resultados.forEach((res, index) => {
            let medal = '';
            if(index === 0) medal = '🥇 ';
            else if(index === 1) medal = '🥈 ';
            else if(index === 2) medal = '🥉 ';
            else medal = `${index+1}º `;

            html += `
                <a href="#" class="list-group-item list-group-item-action py-3" onclick="mostrarDetalheRanking(${index}); return false;">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div class="text-truncate">
                            <h6 class="mb-1 text-dark fw-bold">${medal}${res.nome}</h6>
                            <span class="badge bg-light text-dark border">${res.mbti}</span>
                            <span class="badge bg-${res.color} ms-1">${res.classificacao}</span>
                        </div>
                        <div class="text-end ms-2">
                            <h4 class="mb-0 fw-bold" style="color: var(--bs-${res.color});">${res.geral}%</h4>
                        </div>
                    </div>
                </a>
            `;
        });

        window.currentMBTIResultados = resultados;
        document.getElementById('mbtiRankingList').innerHTML = html;

    } catch(e) {
        console.error("Erro ao buscar ranking", e);
        document.getElementById('mbtiRankingList').innerHTML = '<div class="alert alert-danger m-3">Erro ao analisar compatibilidade.</div>';
    }
}

window.mostrarDetalheRanking = function(index) {
    if(!window.currentMBTIResultados) return;
    const res = window.currentMBTIResultados[index];
    if(!res) return;

    document.getElementById('mbtiRankPlaceholder').style.display = 'none';
    document.getElementById('mbtiRankDetalhes').style.display = 'flex';

    document.getElementById('mbtiDetalheGestorNome').textContent = res.nome;
    document.getElementById('mbtiDetalheGestorPerfil').textContent = res.mbti;
    document.getElementById('mbtiDetalheGeral').textContent = res.geral + '%';
    document.getElementById('mbtiDetalheGeral').style.color = `var(--bs-${res.color})`;
    document.getElementById('mbtiDetalheClassificacao').textContent = res.classificacao;
    document.getElementById('mbtiDetalheClassificacao').className = `badge bg-${res.color}`;

    document.getElementById('mbtiValCom').textContent = res.comunicacao;
    document.getElementById('mbtiBarCom').style.width = res.comunicacao + '%';
    
    document.getElementById('mbtiValLid').textContent = res.lideranca;
    document.getElementById('mbtiBarLid').style.width = res.lideranca + '%';

    document.getElementById('mbtiValOpe').textContent = res.operacional;
    document.getElementById('mbtiBarOpe').style.width = res.operacional + '%';

    document.getElementById('mbtiValRel').textContent = res.relacional;
    document.getElementById('mbtiBarRel').style.width = res.relacional + '%';

    document.getElementById('mbtiDetalheStrengths').innerHTML = res.strengths.map(s => `<li>${s}</li>`).join('');
    document.getElementById('mbtiDetalheAttention').innerHTML = res.attention.map(s => `<li>${s}</li>`).join('');

    const recs = MBTICompatibilityEngine.getRecomendacoes(window.currentCandidatoMBTI.tipo || window.currentCandidatoMBTI.perfil, res.mbti);
    document.getElementById('mbtiDetalheRecs').innerHTML = recs.map(s => `<li>${s}</li>`).join('');
};


/* =============================================
   AÇÕES DO KANBAN CARD
   ============================================= */

async function avancarFaseCandidato(event, id, faseAtual) {
    if(event) event.stopPropagation();
    const fases = ['triagem', 'entrevista', 'avaliacao', 'aprovado', 'banco'];
    let idx = fases.indexOf(faseAtual);
    if(idx >= 0 && idx < 3) {
        let proximaFase = fases[idx + 1];
        try {
            await db.collection('candidatos').doc(id).update({ faseAtual: proximaFase });
            mostrarMensagem('Candidato avançado com sucesso!');
        } catch(e) {
            console.error(e);
            mostrarMensagem('Erro ao avançar candidato.', 'error');
        }
    } else if (idx === 3) {
        mostrarMensagem('Candidato já está na última fase (Aprovado)!', 'warning');
    } else {
        mostrarMensagem('Candidato está no banco de talentos. Mova manualmente.', 'warning');
    }
}

async function reprovarCandidato(event, id) {
    if(event) event.stopPropagation();
    if(confirm('Deseja mover este candidato para o Banco de Talentos (Reprovado)?')) {
        try {
            await db.collection('candidatos').doc(id).update({ faseAtual: 'banco' });
            mostrarMensagem('Candidato movido para o Banco de Talentos.');
        } catch(e) {
            console.error(e);
            mostrarMensagem('Erro ao mover candidato.', 'error');
        }
    }
}

async function excluirCandidato(event, id) {
    if(event) event.stopPropagation();
    if(confirm('Tem certeza que deseja excluir este candidato permanentemente?')) {
        try {
            await db.collection('candidatos').doc(id).delete();
            mostrarMensagem('Candidato excluído com sucesso.');
        } catch(e) {
            console.error(e);
            mostrarMensagem('Erro ao excluir candidato.', 'error');
        }
    }
}



// Inject pulse animation globally
if (!document.getElementById('pulse-animation-style')) {
    const style = document.createElement('style');
    style.id = 'pulse-animation-style';
    style.innerHTML = `
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 15px rgba(220, 53, 69, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
        }
    `;
    document.head.appendChild(style);
}
