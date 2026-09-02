/**
 * Módulo de Recrutamento e Seleção
 * Integração com Firestore e Escavador API
 */

let vagasAtivas = [];
let candidatosAtuais = [];
let unsubscribeCandidatos = null;
let escavadorToken = null;

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
            const responseEscavador = await fetch(`https://api.escavador.com/api/v1/envolvido/processos?cpf=${cpf}`, {
                headers: {
                    'Authorization': `Bearer ${escavadorToken}`,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (responseEscavador.status === 404) {
                htmlResultados += `<span class="text-success"><i class="fas fa-check-circle"></i> Escavador: Nenhum processo encontrado.</span><br>`;
            } else if (responseEscavador.ok) {
                const data = await responseEscavador.json();
                if (data && data.processos && data.processos.length > 0) {
                    htmlResultados += `<strong>Escavador (${data.processos.length} processos encontrados):</strong><br><ul class="mt-2 pl-3">`;
                    data.processos.slice(0, 5).forEach(proc => {
                        htmlResultados += `<li><strong>${proc.numero_cnj || proc.numero}</strong> - ${proc.titulo_polo_ativo || 'Pólo Ativo'} x ${proc.titulo_polo_passivo || 'Pólo Passivo'}</li>`;
                    });
                    if (data.processos.length > 5) htmlResultados += `<li><em>... e mais ${data.processos.length - 5} processos.</em></li>`;
                    htmlResultados += '</ul>';
                } else {
                    htmlResultados += `<span class="text-success"><i class="fas fa-check-circle"></i> Escavador: Nenhum processo.</span><br>`;
                }
            } else {
                htmlResultados += `<span class="text-danger"><i class="fas fa-times-circle"></i> Erro Escavador.</span><br>`;
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
        if (!ocorrenciasSnap.empty) {
            html += `<hr class="my-2"><strong>Ocorrências / Atestados (Saúde):</strong> ${ocorrenciasSnap.size} registro(s) encontrado(s).<br><ul class="mb-1 pl-3">`;
            ocorrenciasSnap.docs.forEach(doc => {
                const oc = doc.data();
                html += `<li><small>${oc.data ? new Date(oc.data.seconds * 1000).toLocaleDateString() : 'Data não info.'} - ${oc.tipo || 'Sem tipo'} (${oc.descricao || 'Sem motivo'})</small></li>`;
            });
            html += `</ul>`;
        }

        // Buscar Histórico de Faltas
        const faltasSnap = await db.collection('faltas').where('funcionarioId', '==', funcId).get();
        if (!faltasSnap.empty) {
            html += `<hr class="my-2"><strong>Histórico de Faltas:</strong> ${faltasSnap.size} falta(s) registrada(s).<br><ul class="mb-1 pl-3">`;
            faltasSnap.docs.forEach(doc => {
                const f = doc.data();
                const dataFalta = f.data && f.data.seconds ? new Date(f.data.seconds * 1000).toLocaleDateString() : (f.data ? new Date(f.data).toLocaleDateString() : 'Data não info.');
                html += `<li><small>${dataFalta} - ${f.justificada ? 'Justificada' : 'Injustificada'}</small></li>`;
            });
            html += `</ul>`;
        }

        // Buscar Histórico Disciplinar
        const disciplinarSnap = await db.collection('registros_disciplinares').where('funcionarioId', '==', funcId).get();
        if (!disciplinarSnap.empty) {
            html += `<hr class="my-2"><strong class="text-danger">Histórico Disciplinar:</strong> ${disciplinarSnap.size} registro(s) encontrado(s).<br><ul class="mb-1 pl-3">`;
            disciplinarSnap.docs.forEach(doc => {
                const d = doc.data();
                const dataOcorrencia = d.dataOcorrencia && d.dataOcorrencia.seconds ? new Date(d.dataOcorrencia.seconds * 1000).toLocaleDateString() : (d.dataOcorrencia ? new Date(d.dataOcorrencia).toLocaleDateString() : 'Data não info.');
                html += `<li><small class="text-danger">${dataOcorrencia} - ${d.classificacao || 'Advertência'} / ${d.medidaAplicada || 'N/A'}: ${d.descricao || 'Sem motivo registrado'}</small></li>`;
            });
            html += `</ul>`;
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
