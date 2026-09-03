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
    const modal = new bootstrap.Modal(document.getElementById('modalCandidato'));
    modal.show();
}

async function editarCandidato(id) {
    const cand = candidatosAtuais.find(c => c.id === id);
    if (!cand) return;
    
    document.getElementById('candidatoId').value = cand.id;
    document.getElementById('candidatoVagaId').value = cand.vagaId;
    document.getElementById('candidatoNome').value = cand.nome;
    document.getElementById('candidatoCpf').value = cand.cpf;
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
    
    const modal = new bootstrap.Modal(document.getElementById('modalCandidato'));
    modal.show();
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

async function consultarCandidatoAPI() {
    const cpf = document.getElementById('candidatoCpf').value.replace(/\D/g, '');
    const divResult = document.getElementById('resultadoEscavador');
    const area = document.getElementById('areaEscavador');
    const inputNome = document.getElementById('candidatoNome');

    if (!cpf || cpf.length !== 11) {
        mostrarMensagem('Digite um CPF válido (11 dígitos).', 'warning');
        return;
    }

    // 1. Dispara a busca interna e aguarda o resultado
    const funcionarioEncontradoInternamente = await consultarHistoricoInterno(cpf);

    // 2. Pré-Cadastro via Hub Desenvolvedor (Receita Federal) se NÃO achou internamente
    if (!funcionarioEncontradoInternamente) {
        try {
            mostrarMensagem('Buscando dados na Receita Federal...', 'info');
            // MOCK/PLACEHOLDER: Substitua pela chamada real ao endpoint do Hub Desenvolvedor para a Receita Federal
            // Exemplo: fetch(`https://api.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cpf}&token=${HUB_DESENVOLVEDOR_TOKEN}`)
            
            // Simulação de resposta bem-sucedida para o pré-cadastro
            /* 
            const response = await fetch(`URL_HUB_DESENVOLVEDOR`);
            const data = await response.json();
            if (data.status === true && data.result) {
                inputNome.value = data.result.nome_da_pf;
            }
            */
           console.log("Integração Hub Desenvolvedor pendente. API Token necessário.");
           
        } catch (error) {
            console.error("Erro Hub Desenvolvedor:", error);
        }
    } else {
        // Se encontrou internamente, podemos usar o nome que já temos no próprio BD
        try {
            const funcSnap = await db.collection('funcionarios').where('cpf', '==', document.getElementById('candidatoCpf').value).get();
            if(!funcSnap.empty) {
                inputNome.value = funcSnap.docs[0].data().nome;
            }
        } catch(e) {}
    }

    // 3. Buscar Processos no Escavador / Jus Brasil
    area.style.display = 'block';
    divResult.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando processos associados...';

    try {
        let htmlResultados = '';

        // -- ESCAVADOR --
        if (escavadorToken) {
            let processosEncontrados = [];
            let escavadorStatus = '';
            
            // Tentativa 1: CPF
            const responseCpf = await fetch(`https://api.escavador.com/api/v1/envolvido/processos?cpf=${cpf}`, {
                headers: { 'Authorization': `Bearer ${escavadorToken}`, 'X-Requested-With': 'XMLHttpRequest' }
            });
            
            if (responseCpf.ok) {
                const data = await responseCpf.json();
                if (data && data.processos && data.processos.length > 0) {
                    processosEncontrados = data.processos;
                    escavadorStatus = 'Encontrado por CPF';
                }
            }

            // Tentativa 2: Nome + Homônimos (Fallback)
            if (processosEncontrados.length === 0 && inputNome.value.trim() !== '') {
                const nomeBusca = encodeURIComponent(inputNome.value.trim());
                const responseNome = await fetch(`https://api.escavador.com/api/v1/envolvido/processos?nome=${nomeBusca}&incluir_homonimos=true`, {
                    headers: { 'Authorization': `Bearer ${escavadorToken}`, 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (responseNome.ok) {
                    const dataNome = await responseNome.json();
                    if (dataNome && dataNome.processos && dataNome.processos.length > 0) {
                        processosEncontrados = dataNome.processos;
                        escavadorStatus = 'Encontrado por Nome (Atenção: Pode conter homônimos)';
                    }
                }
            }

            // Renderização
            if (processosEncontrados.length > 0) {
                htmlResultados += `<strong>Escavador (${processosEncontrados.length} processos - ${escavadorStatus}):</strong><br><ul class="mt-2 pl-3">`;
                processosEncontrados.slice(0, 5).forEach(proc => {
                    const numCnj = proc.numero_cnj || proc.numero;
                    htmlResultados += `<li><strong class="text-danger">${numCnj}</strong> - ${proc.titulo_polo_ativo || 'Pólo Ativo'} x ${proc.titulo_polo_passivo || 'Pólo Passivo'}<br>`;
                    
                    // Botões de Ação
                    htmlResultados += `<div class="mt-1 mb-2">`;
                    if (proc.fontes && proc.fontes.length > 0 && proc.fontes[0].url) {
                        htmlResultados += `<a href="${proc.fontes[0].url}" target="_blank" class="btn btn-sm btn-outline-primary me-2"><i class="fas fa-university"></i> Ver Oficial no Tribunal</a>`;
                    }
                    htmlResultados += `<button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirDocumentosEscavador('${numCnj}')"><i class="fas fa-file-pdf"></i> Explorar Documentos (PDF)</button>`;
                    htmlResultados += `</div></li>`;
                });
                if (processosEncontrados.length > 5) htmlResultados += `<li><em>... e mais ${processosEncontrados.length - 5} processos.</em></li>`;
                htmlResultados += '</ul>';
            } else {
                htmlResultados += `<span class="text-success"><i class="fas fa-check-circle"></i> Escavador (API): Nenhum processo encontrado (nem por CPF, nem por Nome).</span><br>`;
                htmlResultados += `<a href="https://www.escavador.com/busca?q=${cpf}&qo=t" target="_blank" class="btn btn-sm btn-outline-secondary mt-1"><i class="fas fa-external-link-alt"></i> Verificação Profunda no Site</a><br>`;
            }
        }

        // -- MÓDULO JURÍDICO INTERNO --
        const nomeAtual = inputNome.value.trim().toLowerCase();
        if (nomeAtual) {
            htmlResultados += `<hr class="my-2">`;
            try {
                const processosJuridicosSnap = await db.collection('processos_juridicos').get();
                const processosContraEmpresa = processosJuridicosSnap.docs.filter(doc => {
                    const data = doc.data();
                    return data.parteContraria && data.parteContraria.toLowerCase() === nomeAtual;
                });

                if (processosContraEmpresa.length > 0) {
                    htmlResultados += `<strong class="text-danger"><i class="fas fa-gavel"></i> Sistema Jurídico Interno (${processosContraEmpresa.length} processo(s)):</strong><br><ul class="mt-2 pl-3">`;
                    processosContraEmpresa.forEach(doc => {
                        const proc = doc.data();
                        htmlResultados += `<li><strong class="text-danger">${proc.numeroProcesso || 'S/N'}</strong> - ${proc.tipoAcao || 'Ação'} - Status: ${proc.status || 'N/A'}</li>`;
                    });
                    htmlResultados += '</ul>';
                } else {
                    htmlResultados += `<span class="text-success"><i class="fas fa-check-circle"></i> Sistema Jurídico Interno: Limpo.</span><br>`;
                }
            } catch (err) {
                console.error("Erro ao buscar no módulo jurídico:", err);
                htmlResultados += `<span class="text-warning"><i class="fas fa-exclamation-triangle"></i> Sistema Jurídico Interno: Indisponível.</span><br>`;
            }
        }

        // -- JUS BRASIL (VIA HUB DESENVOLVEDOR) --
        // MOCK/PLACEHOLDER: Implementar quando o token do Hub for providenciado
        htmlResultados += `<hr class="my-2">`;
        htmlResultados += `<span class="text-muted"><i class="fas fa-search"></i> Jus Brasil: <em>Integração com Hub Desenvolvedor pendente.</em></span><br>`;

        divResult.innerHTML = htmlResultados;
        
    } catch (error) {
        console.error('Erro consulta processos:', error);
        divResult.innerHTML = `<span class="text-danger"><i class="fas fa-times-circle"></i> Erro na busca. Verifique se as APIs bloquearam por CORS.</span>`;
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
