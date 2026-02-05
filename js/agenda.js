// ========================================
// Módulo: Agenda Centralizada
// ========================================

let agendaView = 'cards'; // 'cards' ou 'calendario'
let calendarioDataAtual = new Date();

// Variáveis globais para controle dos modais
let modaisAbertos = [];

// Cache de elementos DOM
let domCache = {};

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Configura os filtros de data e o botão de aplicar
    const btnFiltrarAgenda = document.getElementById('btn-filtrar-agenda');
    if (btnFiltrarAgenda) {
        btnFiltrarAgenda.addEventListener('click', carregarAgenda);
    }
    const chkAniversarios = document.getElementById('agenda-filtro-aniversarios');
    if (chkAniversarios) {
        chkAniversarios.addEventListener('change', carregarAgenda);
    }
    configurarFiltrosDeDataAgenda();
    popularFiltroDeAno();
    criarModais();
    adicionarCSSModais();
});

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function getElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function mostrarMensagem(mensagem, tipo = "info") {
    let messageContainer = getElement('message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'message-container';
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
        `;
        document.body.appendChild(messageContainer);
        domCache['message-container'] = messageContainer;
    }

    const messageId = 'message-' + Date.now();
    const bgColor = tipo === 'success' ? 'alert-success' : 
                   tipo === 'warning' ? 'alert-warning' :
                   tipo === 'error' ? 'alert-danger' : 'alert-info';

    const messageHTML = `
        <div id="${messageId}" class="alert ${bgColor} alert-dismissible fade show">
            ${mensagem}
            <button type="button" class="btn-close" onclick="document.getElementById('${messageId}').remove()"></button>
        </div>
    `;
    
    messageContainer.insertAdjacentHTML('beforeend', messageHTML);
    
    setTimeout(() => {
        const messageEl = document.getElementById(messageId);
        if (messageEl) {
            messageEl.remove();
        }
    }, 5000);
}

function openPrintWindow(conteudo, opcoes = {}) {
    try {
        const janela = window.open('', opcoes.name || '_blank', 'width=800,height=600');
        if (!janela) {
            mostrarMensagem("Permita pop-ups para imprimir o resumo.", "warning");
            return null;
        }
        
        janela.document.write(conteudo);
        janela.document.close();
        
        if (opcoes.autoPrint) {
            setTimeout(() => {
                janela.focus();
                janela.print();
            }, 500);
        }
        
        return janela;
    } catch (error) {
        return null;
    }
}
// ========================================
// CONFIGURAÇÃO INICIAL
// ========================================

function configurarFiltrosDeDataAgenda(dataReferencia = null) {
    const dataBase = dataReferencia ? new Date(dataReferencia) : new Date();
    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    getElement('agenda-filtro-inicio').value = primeiroDia.toISOString().split('T')[0];
    getElement('agenda-filtro-fim').value = ultimoDia.toISOString().split('T')[0];
}

function configurarFiltrosParaAno(ano) {
    const primeiroDia = new Date(ano, 0, 1); // 1º de janeiro do ano especificado
    const ultimoDia = new Date(ano, 11, 31); // 31 de dezembro do ano especificado

    getElement('agenda-filtro-inicio').value = primeiroDia.toISOString().split('T')[0];
    getElement('agenda-filtro-fim').value = ultimoDia.toISOString().split('T')[0];
    
    carregarAgenda();
    mostrarMensagem(`Filtro configurado para o ano de ${ano}`, "info");

    // Atualiza o texto do botão do filtro de ano
    const btnAno = getElement('agenda-filtro-ano-btn');
    if (btnAno) {
        btnAno.innerHTML = `<i class="fas fa-calendar-alt me-1"></i> Ano: ${ano}`;
    }
}

function popularFiltroDeAno() {
    const listaAnos = getElement('agenda-filtro-ano-lista');
    if (!listaAnos) return;

    const anoAtual = new Date().getFullYear();
    const anoInicial = anoAtual - 2;
    const anoFinal = anoAtual + 5;

    listaAnos.innerHTML = ''; // Limpa a lista

    for (let ano = anoInicial; ano <= anoFinal; ano++) {
        listaAnos.innerHTML += `<li><a class="dropdown-item" href="#" onclick="configurarFiltrosParaAno(${ano})">${ano}</a></li>`;
    }

    // Define o texto inicial do botão para o ano atual
    const btnAno = getElement('agenda-filtro-ano-btn');
    if (btnAno) {
        btnAno.innerHTML = `<i class="fas fa-calendar-alt me-1"></i> Ano: ${anoAtual}`;
    }
}

// ========================================
// GERENCIAMENTO DE MODAIS
// ========================================

function criarModais() {
    criarModalNovaAtividade();
}

function criarModalNovaAtividade() {
    if (getElement('novaAtividadeModal')) return;
    
    const modalHTML = `
        <div class="modal" id="novaAtividadeModal" tabindex="-1" aria-hidden="true" style="display: none;">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nova Atividade</h5>
                        <button type="button" class="btn-close" onclick="fecharModal('novaAtividadeModal')"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-nova-atividade">
                            <div class="mb-3">
                                <label for="atividade-assunto" class="form-label">Assunto *</label>
                                <input type="text" class="form-control" id="atividade-assunto" required>
                            </div>
                            <div class="row">
                                <div class="col-7">
                                    <label for="atividade-data" class="form-label">Data *</label>
                                    <input type="date" class="form-control" id="atividade-data" required min="2020-01-01" max="2030-12-31">
                                </div>
                                <div class="col-5">
                                    <label for="atividade-hora" class="form-label">Horário</label>
                                    <input type="time" class="form-control" id="atividade-hora">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="atividade-tipo" class="form-label">Tipo *</label>
                                <select class="form-select" id="atividade-tipo" required>
                                    <option value="">Selecione...</option>
                                    <option value="Tarefa">Tarefa</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Revisão">Revisão</option>
                                    <option value="Reunião">Reunião</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="atividade-recorrencia" class="form-label">Repetir</label>
                                    <select class="form-select" id="atividade-recorrencia">
                                        <option value="nao">Não se repete</option>
                                    <option value="diariamente">Diariamente</option>
                                        <option value="mensal">Mensalmente</option>
                                    </select>
                                </div>
                            </div>
                        <div class="mb-3" id="container-repetir-diariamente" style="display: none;">
                            <label for="atividade-repetir-dias" class="form-label">Repetir por quantos dias?</label>
                            <input type="number" class="form-control" id="atividade-repetir-dias" value="7" min="1" max="365">
                        </div>
                            <div class="mb-3 form-check" id="container-gerar-ano-todo-atividade" style="display: none;">
                                <input type="checkbox" class="form-check-input" id="atividade-gerar-ano-todo">
                                <label class="form-check-label" for="atividade-gerar-ano-todo">Gerar para o ano todo</label>
                            </div>
                            <div class="mb-3">
                                <label for="atividade-descricao" class="form-label">Descrição *</label>
                                <textarea class="form-control" id="atividade-descricao" rows="3" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label for="atividade-atribuido-para" class="form-label">Atribuir para (Opcional)</label>
                                <select class="form-select" id="atividade-atribuido-para"></select>
                            </div>
                            <!-- Seção de Histórico de Tempo (Visível apenas na edição) -->
                            <div id="atividade-timelog-section" style="display: none;" class="mt-3 border-top pt-3">
                                <label class="form-label fw-bold"><i class="fas fa-history"></i> Histórico de Execução (Pausas e Retornos)</label>
                                <div id="atividade-timelog-container"></div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="fecharModal('novaAtividadeModal')">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarNovaAtividade()">Salvar Atividade</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop" id="backdrop-novaAtividadeModal" style="display: none;"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function abrirModalNovaAtividade(dadosPreenchimento = null) {
    criarModalNovaAtividade();

    await popularSelectUsuarios('atividade-atribuido-para');
    const modal = getElement('novaAtividadeModal');
    const backdrop = getElement('backdrop-novaAtividadeModal');
    
    if (!modal) {
        return;
    }
    
    // Reset do formulário
    const form = getElement('form-nova-atividade');
    if (form) form.reset();
    
    const dataInput = getElement('atividade-data');
    
    // Se não há dados para preenchimento (modo criação), restaurar textos padrão
    if (!dadosPreenchimento) {
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) modalTitle.textContent = 'Nova Atividade';
        const saveButton = modal.querySelector('.btn-primary');
        if (saveButton) saveButton.textContent = 'Salvar Atividade';

        // Limpar dados de edição do formulário
        if (form) {
            delete form.dataset.editId;
            delete form.dataset.editCollection;
            getElement('atividade-timelog-section').style.display = 'none';
        }
    } else {
        // Modo edição - atualizar textos
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Atividade';
        const saveButton = modal.querySelector('.btn-primary');
        if (saveButton) saveButton.textContent = 'Salvar Alterações';
    }
    
    if (dataInput && !dadosPreenchimento) {
        const hoje = new Date();
        dataInput.value = hoje.toISOString().split('T')[0];
    }
    
    // Mostrar modal e backdrop
    modal.style.display = 'block';
    backdrop.style.display = 'block';
    
    // Adicionar à lista de modais abertos
    if (!modaisAbertos.includes('novaAtividadeModal')) {
        modaisAbertos.push('novaAtividadeModal');
    }
    
    // Adicionar evento para fechar ao clicar no backdrop
    backdrop.onclick = function() {
        fecharModal('novaAtividadeModal');
    };
    
    // Adicionar evento para fechar com ESC
    document.addEventListener('keydown', fecharComESC);
    
    // Se há dados para preenchimento, preencher após o modal estar visível
    if (dadosPreenchimento) {
        requestAnimationFrame(() => preencherFormularioAtividade(dadosPreenchimento));
    }

    // Adiciona o listener para o campo de recorrência (se já não existir)
    const recorrenciaSelect = getElement('atividade-recorrencia');
    if (recorrenciaSelect) {
        recorrenciaSelect.onchange = function() {
            const containerRepetirDiariamente = getElement('container-repetir-diariamente');
            const containerGerarAnoTodo = getElement('container-gerar-ano-todo-atividade');
            
            containerRepetirDiariamente.style.display = this.value === 'diariamente' ? 'block' : 'none';
            containerGerarAnoTodo.style.display = this.value === 'mensal' ? 'block' : 'none';

            if (this.value !== 'diariamente') {
                getElement('atividade-repetir-dias').value = '7';
            }
            if (this.value !== 'mensal') { 
                getElement('atividade-gerar-ano-todo').checked = false;
            }
        };
    }
}

async function popularSelectUsuarios(selectId) {
    const select = getElement(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">Eu mesmo (Padrão)</option>`;
    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        usersSnap.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}" data-nome="${doc.data().nome}">${doc.data().nome}</option>`;
        });
    } catch (error) {
    }
}
function fecharModal(modalId) {
    const modal = getElement(modalId);
    const backdrop = getElement('backdrop-' + modalId);
    
    if (modal) modal.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
    
    // Remover da lista de modais abertos
    modaisAbertos = modaisAbertos.filter(id => id !== modalId);
    
    // Remover evento ESC se não houver mais modais abertos
    if (modaisAbertos.length === 0) {
        document.removeEventListener('keydown', fecharComESC);
    }
}

function fecharComESC(event) {
    if (event.key === 'Escape' && modaisAbertos.length > 0) {
        const ultimoModal = modaisAbertos[modaisAbertos.length - 1];
        fecharModal(ultimoModal);
    }
}

// ========================================
// SALVAMENTO DE DADOS
// ========================================

async function salvarNovaAtividade() {
    
    const form = getElement('form-nova-atividade');
    const editId = form?.dataset.editId;
    const editCollection = form?.dataset.editCollection;

    const assunto = getElement('atividade-assunto')?.value.trim();
    const data = getElement('atividade-data')?.value;
    const hora = getElement('atividade-hora')?.value;
    const tipo = getElement('atividade-tipo')?.value;
    const descricao = getElement('atividade-descricao')?.value.trim();
    const recorrencia = getElement('atividade-recorrencia')?.value;
    const gerarAnoTodo = getElement('atividade-gerar-ano-todo')?.checked;
    const repetirDias = parseInt(getElement('atividade-repetir-dias')?.value, 10);
    const atribuidoParaSelect = getElement('atividade-atribuido-para');
    
    // Coletar dados do histórico de tempo (se houver)
    let timeLog = [];
    const timeLogRows = document.querySelectorAll('.timelog-row');
    if (timeLogRows.length > 0) {
        timeLogRows.forEach(row => {
            const startInput = row.querySelector('.timelog-start');
            const endInput = row.querySelector('.timelog-end');
            if (startInput && startInput.value) {
                timeLog.push({
                    start: new Date(startInput.value),
                    end: endInput && endInput.value ? new Date(endInput.value) : null
                });
            }
        });
        // Ordenar por data de início
        timeLog.sort((a, b) => a.start - b.start);
    }

    let atribuidoParaId = atribuidoParaSelect.value;
    let atribuidoParaNome = atribuidoParaId ? atribuidoParaSelect.options[atribuidoParaSelect.selectedIndex].dataset.nome : null;

    // Se não selecionou ninguém (Eu mesmo), define o ID do usuário atual explicitamente
    if (!atribuidoParaId) {
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            atribuidoParaId = currentUser.uid;
            atribuidoParaNome = currentUser.displayName || currentUser.email;
        }
    }


    // Validação
    if (!assunto || !data || !tipo || !descricao) {
        mostrarMensagem("Preencha todos os campos obrigatórios (*)", "warning");
    }

    try {
        // Validar data
        const dataAtividade = new Date(`${data}T${hora || '00:00:00'}`);
        if (isNaN(dataAtividade.getTime())) {
            mostrarMensagem("Data inválida. Verifique a data informada.", "error");
            return;
        }

        if (recorrencia === 'mensal' && gerarAnoTodo && !editId) {
            // Lógica para criar 12 eventos mensais
            const batch = db.batch();
            const dataBase = new Date(`${data}T${hora || '00:00:00'}`);

            for (let i = 0; i < 12; i++) {
                const dataEvento = new Date(dataBase);
                dataEvento.setMonth(dataBase.getMonth() + i);

                const docRef = db.collection('agenda_atividades').doc();
                const dadosAtividade = {
                    assunto: `${assunto} (${i + 1}/12)`,
                    data: dataEvento,
                    tipo: tipo,
                    descricao: descricao,
                    status: 'Aberto',
                    atribuidoParaId: atribuidoParaId || null,
                    atribuidoParaNome: atribuidoParaNome || null,
                    criadoPor: firebase.auth().currentUser?.uid || 'desconhecido',
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                };
                batch.set(docRef, dadosAtividade);
            }
            await batch.commit();
            mostrarMensagem("12 atividades recorrentes foram criadas!", "success");
        } else if (recorrencia === 'diariamente' && repetirDias > 0 && !editId) {
            // Lógica para criar eventos diários
            if (repetirDias > 365) {
                mostrarMensagem("O número máximo de repetições diárias é 365.", "warning");
                return;
            }
            const batch = db.batch();
            const dataBase = new Date(`${data}T${hora || '00:00:00'}`);

            for (let i = 0; i < repetirDias; i++) {
                const dataEvento = new Date(dataBase);
                dataEvento.setDate(dataBase.getDate() + i);

                const docRef = db.collection('agenda_atividades').doc();
                const dadosAtividade = {
                    assunto: `${assunto} (${i + 1}/${repetirDias})`,
                    data: dataEvento,
                    tipo: tipo,
                    descricao: descricao,
                    status: 'Aberto',
                    atribuidoParaId: atribuidoParaId || null,
                    atribuidoParaNome: atribuidoParaNome || null,
                    criadoPor: firebase.auth().currentUser?.uid || 'desconhecido',
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                };
                batch.set(docRef, dadosAtividade);
            }
            await batch.commit();
            mostrarMensagem(`${repetirDias} atividades diárias foram criadas!`, "success");
        } else {
            // Lógica para evento único ou edição
            const atividadeData = {
                assunto, 
                data: dataAtividade, 
                tipo, 
                descricao,
                atribuidoParaId: atribuidoParaId || null,
                atribuidoParaNome: atribuidoParaNome || null,
                // Se estiver editando e tivermos coletado logs de tempo, salvamos
                // Caso contrário, mantemos o que já existe (tratado em salvarAlteracoes se mesclarmos, mas aqui sobrescrevemos o objeto)
                ...(timeLog.length > 0 ? { timeLog } : {})
            };

            if (editId && editCollection) {
                await salvarAlteracoes(editId, editCollection, atividadeData);
            } else {
                atividadeData.status = 'Aberto';
                atividadeData.criadoPorNome = firebase.auth().currentUser?.displayName || 
                                             firebase.auth().currentUser?.email || 
                                             'Usuário Desconhecido';
                atividadeData.criadoPor = firebase.auth().currentUser?.uid || 'desconhecido';
                atividadeData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('agenda_atividades').add(atividadeData);
                mostrarMensagem("Atividade salva com sucesso!", "success");
            }
        }
        fecharModal('novaAtividadeModal');

        if (atribuidoParaId && atribuidoParaId !== firebase.auth().currentUser.uid) {
            mostrarMensagem(`Tarefa atribuída para ${atribuidoParaNome}!`, 'info');
        }

        // Recarrega a agenda para mostrar a nova atividade
        await carregarAgenda();

        // Atualiza dashboard de atividades se estiver visível
        if (document.getElementById('dashboard-atividades') && !document.getElementById('dashboard-atividades').classList.contains('d-none') && typeof carregarDadosDashboardAtividades === 'function') {
            await carregarDadosDashboardAtividades();
        }

    } catch (error) {
        mostrarMensagem("Erro ao salvar atividade: " + error.message, "error");
    }
}

async function salvarAlteracoes(id, collection, dados) {
    try {
        const dadosParaAtualizar = {
            ...dados,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection(collection).doc(id).update(dadosParaAtualizar);
        mostrarMensagem("Item atualizado com sucesso!", "success");
        const modalId = 'novaAtividadeModal';
        
        fecharModal(modalId);
        await carregarAgenda();

        // Atualiza dashboard de atividades se estiver visível
        if (document.getElementById('dashboard-atividades') && !document.getElementById('dashboard-atividades').classList.contains('d-none') && typeof carregarDadosDashboardAtividades === 'function') {
            await carregarDadosDashboardAtividades();
        }
        
    } catch (error) {
        mostrarMensagem("Erro ao salvar alterações: " + error.message, "error");
    }
}

// ========================================
// CARREGAMENTO E EXIBIÇÃO DA AGENDA
// ========================================
async function carregarAgenda() {
    
    const containersMinhas = {
        andamento: getElement('agenda-minhas-andamento'),
        hoje: getElement('agenda-minhas-hoje'),
        amanha: getElement('agenda-minhas-amanha'),
        atraso: getElement('agenda-minhas-atraso'),
        '7dias': getElement('agenda-minhas-7dias'),
        '30dias': getElement('agenda-minhas-30dias'),
        futuro: getElement('agenda-minhas-futuro')
    };

    const containersEquipe = {
        andamento: getElement('agenda-equipe-andamento'),
        hoje: getElement('agenda-equipe-hoje'),
        amanha: getElement('agenda-equipe-amanha'),
        atraso: getElement('agenda-equipe-atraso'),
        '7dias': getElement('agenda-equipe-7dias'),
        '30dias': getElement('agenda-equipe-30dias'),
        futuro: getElement('agenda-equipe-futuro'),
    };

    // Verificar se containers existem
    const todosContainers = [...Object.values(containersMinhas), ...Object.values(containersEquipe)];
    for (const container of todosContainers) {
        if (container) {
            container.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i></div>';
        }
    }

    // Se a visão for de calendário, ajusta os filtros para o mês inteiro
    if (agendaView === 'calendario') {
        getElement('agenda-filtro-inicio').value = new Date(calendarioDataAtual.getFullYear(), calendarioDataAtual.getMonth(), 1).toISOString().split('T')[0];
        getElement('agenda-filtro-fim').value = new Date(calendarioDataAtual.getFullYear(), calendarioDataAtual.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    try {
        const currentUser = firebase.auth().currentUser;
        
        const incluirAniversarios = getElement('agenda-filtro-aniversarios').checked;

        const promises = [
            fetchVencimentosFinanceiros(),
            fetchPericiasINSS(),
            fetchAtividades()
        ];
        if (incluirAniversarios) {
            promises.push(fetchAniversariantes(), fetchAniversariosDeEmpresa());
        }

        const [vencimentos, pericias, atividades, aniversariantes = [], aniversariosEmpresa = []] = await Promise.all(promises);

        let todosEventos = [
            ...vencimentos, 
            ...pericias, 
            ...aniversariantes, 
            ...aniversariosEmpresa,
            ...atividades
        ];

        const statusFiltro = getElement('agenda-filtro-status').value;
        if (statusFiltro) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            todosEventos = todosEventos.filter(evento => {
                let effectiveStatus = evento.status;
                if ((effectiveStatus === 'Aberto' || effectiveStatus === 'Pendente') && new Date(evento.data) < hoje) {
                    effectiveStatus = 'Atrasado';
                }

                return effectiveStatus === statusFiltro;
            });
        }
        

        // Ordenação: 1. Abertos/Atrasados, 2. Concluídos
        todosEventos.sort((a, b) => {
            const statusOrder = { 'Aberto': 1, 'Pendente': 1, 'Atrasado': 1, 'Concluído': 2, 'Encerrado': 2 };
            const statusA = statusOrder[a.status] || 3;
            const statusB = statusOrder[b.status] || 3;

            if (statusA !== statusB) return statusA - statusB;
            return a.data - b.data; // Se o status for o mesmo, ordena por data
        });

        // Ordenar eventos por data
        todosEventos.sort((a, b) => a.data - b.data);
        
        // Separar eventos: Minhas vs Equipe
        const eventosMinhas = [];
        const eventosEquipe = [];

        todosEventos.forEach(evento => {
            // Se for atividade criada por mim e atribuída a outro, vai para Equipe
            if (evento.collection === 'agenda_atividades' && 
                evento.criadoPor === currentUser.uid && 
                evento.atribuidoParaId && 
                evento.atribuidoParaId !== currentUser.uid) {
                eventosEquipe.push(evento);
            } else {
                // Todo o resto (minhas tarefas, aniversários, financeiro, etc) vai para Minhas
                eventosMinhas.push(evento);
            }
        });

        if (agendaView === 'cards') {
            distribuirEventosNosCards(eventosMinhas, containersMinhas, 'agenda-minhas');
            distribuirEventosNosCards(eventosEquipe, containersEquipe, 'agenda-equipe');
        } else {
            renderizarCalendario(todosEventos);
        }
        inicializarTooltips();

    } catch (error) {
    }
}

function alternarVisaoAgenda(view) {
    agendaView = view;
    const viewCards = getElement('agenda-cards-view');
    const viewCalendario = getElement('agenda-calendario-view');
    const btnCards = getElement('btn-view-cards');
    const btnCalendario = getElement('btn-view-calendario');

    if (view === 'calendario') {
        viewCards.classList.add('d-none');
        viewCalendario.classList.remove('d-none');
        btnCards.classList.remove('active');
        btnCalendario.classList.add('active');
        calendarioDataAtual = new Date();
    } else {
        viewCalendario.classList.add('d-none');
        btnCards.classList.add('active');
        btnCalendario.classList.remove('active');
        configurarFiltrosDeDataAgenda();
    }
    carregarAgenda();
}

function renderizarCalendario(eventos) {
    const container = getElement('agenda-calendario-view');
    const ano = calendarioDataAtual.getFullYear();
    const mes = calendarioDataAtual.getMonth();

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const diasNoMes = ultimoDia.getDate();
    const diaSemanaPrimeiro = primeiroDia.getDay();

    const nomeMes = calendarioDataAtual.toLocaleString('pt-BR', { month: 'long' });

    let html = `
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <button class="btn btn-outline-secondary" onclick="mudarMesCalendario(-1)"><i class="fas fa-chevron-left"></i></button>
                <h4 class="mb-0 text-capitalize">${nomeMes} de ${ano}</h4>
                <button class="btn btn-outline-secondary" onclick="mudarMesCalendario(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="card-body p-0">
                <div class="calendario-grid">
                    <div class="calendario-header">Dom</div>
                    <div class="calendario-header">Seg</div>
                    <div class="calendario-header">Ter</div>
                    <div class="calendario-header">Qua</div>
                    <div class="calendario-header">Qui</div>
                    <div class="calendario-header">Sex</div>
                    <div class="calendario-header">Sáb</div>
    `;

    // Células vazias antes do primeiro dia
    for (let i = 0; i < diaSemanaPrimeiro; i++) {
        html += `<div class="calendario-dia outro-mes"></div>`;
    }

    // Dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataAtual = new Date(ano, mes, dia);
        const hoje = new Date();
        const isHoje = dataAtual.toDateString() === hoje.toDateString();
        const diaId = `dia-${ano}-${mes + 1}-${dia}`;

        html += `<div class="calendario-dia ${isHoje ? 'hoje' : ''}" id="${diaId}">
                    <div class="dia-numero">${dia}</div>
                    <div class="dia-eventos"></div>
                  </div>`;
    }

    html += `</div></div></div>`;
    container.innerHTML = html;

    // Popula os eventos no calendário
    eventos.forEach(evento => {
        const dataEvento = evento.data;
        const dia = dataEvento.getDate();
        const mesEvento = dataEvento.getMonth();
        const anoEvento = dataEvento.getFullYear();

        if (anoEvento === ano && mesEvento === mes) {
            const diaId = `dia-${ano}-${mes + 1}-${dia}`;
            const diaContainer = document.querySelector(`#${diaId} .dia-eventos`);
            if (diaContainer) {
                const cor = getCorEvento(evento.tipo);
                diaContainer.innerHTML += `<div class="evento-pill" style="background-color: ${cor}" data-bs-toggle="tooltip" title="${escapeHTML(evento.titulo)}"></div>`;
            }
        }
    });
}

function mudarMesCalendario(direcao) {
    calendarioDataAtual.setMonth(calendarioDataAtual.getMonth() + direcao);
    carregarAgenda();
}

function getCorEvento(tipo) {
    const cores = { 
        financeiro: '#28a745', 
        pericia: '#ffc107', 
        aniversario: '#0dcaf0', 
        empresa: '#6f42c1', 
        Reunião: '#6610f2', 
        Prazo: '#dc3545', 
        Lembrete: '#6c757d', 
        Pessoal: '#212529', 
        Tarefa: '#198754', 
        'Follow-up': '#0dcaf0', 
        Revisão: '#ffc107', 
        Outro: '#adb5bd',
        Experiencia: '#fd7e14' // Laranja para experiência
    };
    return cores[tipo] || '#6c757d';
}

function distribuirEventosNosCards(eventos, containers, prefixoId) {
    
    // Limpar containers
    Object.values(containers).forEach(c => { 
        if (c) c.innerHTML = ''; 
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const seteDias = new Date(hoje);
    seteDias.setDate(hoje.getDate() + 7);

    const trintaDias = new Date(hoje);
    trintaDias.setDate(hoje.getDate() + 30);
    const counts = { andamento: 0, hoje: 0, amanha: 0, '7dias': 0, '30dias': 0, atraso: 0, futuro: 0 };

    eventos.forEach(evento => {
        const eventoData = new Date(evento.data);
        eventoData.setHours(0, 0, 0, 0);

        // Lógica para tarefas Em Andamento ou Pausadas - Vão para a coluna específica
        if (evento.status === 'Em Andamento' || evento.status === 'Pausado') {
            if (containers.andamento) {
                containers.andamento.innerHTML += criarCardEvento(evento);
                counts.andamento++;
            }
            return;
        }

        // Lógica para tarefas atrasadas - PRIORIDADE MÁXIMA
        if ((evento.status === 'Aberto' || evento.status === 'Pendente') && eventoData < hoje) {
            containers.atraso.innerHTML += criarCardEvento(evento);
            counts.atraso++;
            return;
        }

        if (eventoData.getTime() === hoje.getTime()) {
            containers.hoje.innerHTML += criarCardEvento(evento);
            counts.hoje++;
        } else if (eventoData.getTime() === amanha.getTime()) {
            containers.amanha.innerHTML += criarCardEvento(evento);
            counts.amanha++;
        } else if (eventoData > amanha && eventoData <= seteDias) {
            containers['7dias'].innerHTML += criarCardEvento(evento);
            counts['7dias']++;
        } else if (eventoData > seteDias && eventoData <= trintaDias) {
            containers['30dias'].innerHTML += criarCardEvento(evento);
            counts['30dias']++;
        } else if (eventoData > trintaDias) {
            containers.futuro.innerHTML += criarCardEvento(evento);
            counts.futuro++;
        }
    });

    // Atualizar contadores e mensagens vazias
    for (const key in containers) {
        const container = containers[key];
        if (container && container.innerHTML === '') {
            container.innerHTML = '<p class="text-muted text-center small p-2">Nenhum evento neste período.</p>';
        }
        const countElement = getElement(`${prefixoId}-count-${key}`);
        if (countElement) {
            countElement.textContent = counts[key];
        }
    }
}

function inicializarTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (tooltip) tooltip.dispose();
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function criarCardEvento(evento) {
    const icones = {
        financeiro: 'fa-dollar-sign',
        pericia: 'fa-user-md',
        aniversario: 'fa-birthday-cake',
        empresa: 'fa-building',
        Reunião: 'fa-users',
        Prazo: 'fa-hourglass-half',
        Lembrete: 'fa-bell',
        Pessoal: 'fa-user',
        Tarefa: 'fa-clipboard-check',
        'Follow-up': 'fa-calendar-check',
        Revisão: 'fa-magnifying-glass',
        Outro: 'fa-sticky-note',
        Experiencia: 'fa-user-clock'
    };
    
    const cores = {
        financeiro: 'border-success',
        pericia: 'border-warning',
        aniversario: 'border-info',
        empresa: 'border-primary',
        Reunião: 'border-purple',
        Prazo: 'border-danger',
        Lembrete: 'border-secondary',
        Pessoal: 'border-dark',
        Tarefa: 'border-success',
        'Follow-up': 'border-info',
        Revisão: 'border-warning',
        Outro: 'border-secondary',
        Experiencia: 'border-orange' // Classe CSS personalizada ou fallback
    };
    
    const dataObj = new Date(evento.data);
    let dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const horaFormatada = dataObj.toTimeString().slice(0, 5);
    if (horaFormatada !== '00:00') {
        dataFormatada += ` às ${horaFormatada}`;
    }

    const icone = icones[evento.tipo] || 'fa-sticky-note';
    const cor = cores[evento.tipo] || 'border-secondary';

    // Lógica para badge de propriedade (Minha vs Equipe)
    let ownershipBadge = '';
    const currentUser = firebase.auth().currentUser;

    if (evento.collection === 'agenda_atividades' && currentUser) {
        const isAssignedToMe = evento.atribuidoParaId === currentUser.uid;
        const isCreatedByMe = evento.criadoPor === currentUser.uid;
        const isDelegated = isCreatedByMe && evento.atribuidoParaId && evento.atribuidoParaId !== currentUser.uid;

        if (isAssignedToMe) {
            ownershipBadge = `<span class="badge bg-primary ms-1" style="font-size: 0.7em; vertical-align: middle;"><i class="fas fa-user me-1"></i>Minha</span>`;
        } else if (isDelegated) {
            ownershipBadge = `<span class="badge bg-info text-dark ms-1" style="font-size: 0.7em; vertical-align: middle;"><i class="fas fa-users me-1"></i>Equipe</span>`;
        }
    }

    let acoesHTML = '';
    if (evento.collection && currentUser && evento.criadoPor === currentUser.uid) {
        acoesHTML = `
            <div class="agenda-card-actions">
                ${evento.collection === 'agenda_atividades' && evento.status !== 'Concluído' && evento.status !== 'Em Andamento' ? `
                <button class="btn btn-sm btn-icon" onclick="iniciarAtividadeAgenda('${evento.id}')" title="Iniciar Execução">
                    <i class="fas fa-play text-warning"></i>
                </button>` : ''}
                ${evento.collection === 'agenda_atividades' && evento.status === 'Em Andamento' ? `
                <button class="btn btn-sm btn-icon" onclick="pausarAtividadeAgenda('${evento.id}')" title="Pausar Atividade">
                    <i class="fas fa-pause text-secondary"></i>
                </button>` : ''}
                <button class="btn btn-sm btn-icon" onclick="visualizarEvento('${evento.id}', '${evento.collection}')" title="Visualizar">
                    <i class="fas fa-eye text-info"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="editarEvento('${evento.id}', '${evento.collection}')" title="Editar">
                    <i class="fas fa-edit text-primary"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="concluirEvento('${evento.id}', '${evento.collection}')" title="Concluir Tarefa" ${evento.status === 'Concluído' ? 'disabled' : ''}>
                    <i class="fas fa-check-circle ${evento.status === 'Concluído' ? 'text-muted' : 'text-success'}"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="excluirEvento('${evento.id}', '${evento.collection}')" title="Excluir">
                    <i class="fas fa-trash-alt text-danger"></i>
                </button>
            </div>
        `;
    } else if (evento.collection && currentUser) {
        acoesHTML = `
            <div class="agenda-card-actions">
                ${evento.collection === 'agenda_atividades' && (evento.status === 'Aberto' || evento.status === 'Pendente' || evento.status === 'Pausado' || !evento.status) ? `
                <button class="btn btn-sm btn-icon" onclick="iniciarAtividadeAgenda('${evento.id}')" title="Iniciar Execução">
                    <i class="fas fa-play text-warning"></i>
                </button>` : ''}
                ${evento.collection === 'agenda_atividades' && evento.status === 'Em Andamento' ? `
                <button class="btn btn-sm btn-icon" onclick="pausarAtividadeAgenda('${evento.id}')" title="Pausar Atividade">
                    <i class="fas fa-pause text-secondary"></i>
                </button>` : ''}
                <button class="btn btn-sm btn-icon" onclick="visualizarEvento('${evento.id}', '${evento.collection}')" title="Visualizar">
                    <i class="fas fa-eye text-info"></i>
                </button>
                <button class="btn btn-sm btn-icon" onclick="concluirEvento('${evento.id}', '${evento.collection}')" title="Concluir Tarefa"><i class="fas fa-check-circle text-success"></i></button>
            </div>
        `;
    } else if (evento.sourceCollection && evento.id) {
        acoesHTML = `
        <div class="agenda-card-actions">
            <button class="btn btn-sm btn-icon" onclick="visualizarEventoExterno('${evento.id}', '${evento.sourceCollection}', '${evento.tipo}')" title="Visualizar Detalhes">
                <i class="fas fa-eye text-info"></i>
            </button>
        </div>
        `;
    }

    let atribuicaoInfo = '';
    if (evento.atribuidoParaNome && currentUser && evento.criadoPor !== currentUser.uid) {
        atribuicaoInfo = `<small class="text-muted d-block">De: ${evento.criadoPorNome}</small>`;
    } else if (evento.atribuidoParaNome && currentUser && evento.atribuidoParaId !== currentUser.uid) {
        atribuicaoInfo = `<small class="text-muted d-block">Para: ${evento.atribuidoParaNome}</small>`;
    }

    let statusBadge = '';
    if (evento.status) {
        let statusClass = 'bg-secondary';
        let statusText = evento.status;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataEvento = new Date(evento.data);
        dataEvento.setHours(0, 0, 0, 0);

        if ((evento.status === 'Pendente' || evento.status === 'Aberto') && dataEvento < hoje) {
            statusClass = 'bg-danger';
            statusText = 'Atrasado';
        } else if (evento.status === 'Pendente' || evento.status === 'Aberto') {
            statusClass = 'bg-warning text-dark';
            statusText = 'Em Aberto';
        } else if (evento.status === 'Em Andamento') {
            statusClass = 'bg-info text-white';
            statusText = 'Em Andamento';
        } else if (evento.status === 'Pausado') {
            statusClass = 'bg-secondary text-white';
            statusText = 'Pausado';
        } else if (evento.status === 'Concluído' || evento.status === 'Encerrado') {
            statusClass = 'bg-secondary'; // Cinza para concluído
            statusText = 'Concluído';
        }
        // CORREÇÃO: A badge não estava sendo construída
        statusBadge = `<span class="badge ${statusClass} ms-2">${statusText}</span>`;
    }

    let conclusaoInfo = '';
    if (evento.status === 'Concluído' && evento.concluidoEm) {
        const dataConclusao = evento.concluidoEm.toDate ? evento.concluidoEm.toDate() : new Date(evento.concluidoEm);
        const dataFormatadaConclusao = dataConclusao.toLocaleDateString('pt-BR');
        const horaFormatadaConclusao = dataConclusao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        conclusaoInfo = `<div class="mt-2 pt-2 border-top small text-success">
            <i class="fas fa-check-double me-1"></i> Concluído em: ${dataFormatadaConclusao} às ${horaFormatadaConclusao}
            ${evento.tempoResolucao ? `<br><i class="fas fa-stopwatch me-1"></i> Duração: ${evento.tempoResolucao}` : ''}
        </div>`;
    }

    return `
        <div class="agenda-card ${cor}">
            <div class="agenda-card-icon"><i class="fas ${icone}"></i></div>
            <div class="agenda-card-content">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="agenda-card-title">
                        ${evento.titulo}
                        ${ownershipBadge}
                    </div>
                    ${statusBadge}
                </div>
                <div class="agenda-card-description">${evento.descricao}</div>
                <div class="agenda-card-date">${atribuicaoInfo} ${dataFormatada}</div>
                ${conclusaoInfo}
            </div>
            ${acoesHTML}
        </div>
    `;
}

// ========================================
// FUNÇÕES DE FETCH DE DADOS (CORRIGIDAS)
// ========================================

async function fetchVencimentosFinanceiros() {
    const dataInicio = new Date(getElement('agenda-filtro-inicio').value);
    const dataFim = new Date(getElement('agenda-filtro-fim').value);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio) || isNaN(dataFim)) {
        console.error("Datas de filtro da agenda inválidas.");
        return [];
    }

    try {
        const snapshot = await db.collection('lancamentos_financeiros')
            .where('subdivisao', '==', 'Provisão')
            .where('dataVencimento', '>=', dataInicio)
            .where('dataVencimento', '<=', dataFim)
            .get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                sourceCollection: 'lancamentos_financeiros',
                tipo: 'financeiro',
                data: data.dataVencimento.toDate(),
                titulo: `Vencimento: ${data.motivo}`,
                descricao: `Valor: R$ ${data.valor?.toFixed(2) || '0.00'}`
            };
        });
    } catch (error) {
        return [];
    }
}

async function fetchPericiasINSS() {
    const dataInicio = new Date(getElement('agenda-filtro-inicio').value);
    const dataFim = new Date(getElement('agenda-filtro-fim').value);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio) || isNaN(dataFim)) {
        return [];
    }

    try {
        const snapshot = await db.collection('afastamentos')
            .where('requerINSS', '==', true)
            .where('inssDataPericia', '>=', dataInicio)
            .where('inssDataPericia', '<=', dataFim)
            .get();
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                sourceCollection: 'afastamentos',
                tipo: 'pericia',
                data: data.inssDataPericia.toDate(),
                titulo: `Perícia INSS: ${data.colaborador_nome}`,
                descricao: `Protocolo: ${data.inssProtocolo || 'N/A'}`
            };
        });
    } catch (error) {
        return [];
    }
}

async function fetchAniversariantes() {
    const dataInicio = new Date(getElement('agenda-filtro-inicio').value);
    const dataFim = new Date(getElement('agenda-filtro-fim').value);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio) || isNaN(dataFim)) {
        return [];
    }

    try {
        const aniversariantes = [];
        
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();
        snapshot.forEach(doc => {
            const func = doc.data();
            if (func.dataNascimento) {
                const nasc = func.dataNascimento.toDate();
                // Verifica se o aniversário está no período do filtro
                for (let ano = dataInicio.getFullYear(); ano <= dataFim.getFullYear(); ano++) {
                    const dataAniversario = new Date(ano, nasc.getMonth(), nasc.getDate());
                    if (dataAniversario >= dataInicio && dataAniversario <= dataFim) {
                        aniversariantes.push({
                            id: doc.id,
                            sourceCollection: 'funcionarios',
                            tipo: 'aniversario',
                            data: dataAniversario,
                            descricao: `Setor: ${func.setor || 'N/A'}`
                        });
                        break;
                    }
                }
            }
        });
        return aniversariantes;
    } catch (error) {
        return [];
    }
}

async function fetchAniversariosDeEmpresa() {
    const dataInicio = new Date(getElement('agenda-filtro-inicio').value);
    const dataFim = new Date(getElement('agenda-filtro-fim').value);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio) || isNaN(dataFim)) {
        return [];
    }

    try {
        const aniversarios = [];
        const snapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();
        
        snapshot.forEach(doc => {
            const func = doc.data();
            if (func.dataAdmissao) {
                const admissao = func.dataAdmissao.toDate();
                for (let ano = dataInicio.getFullYear(); ano <= dataFim.getFullYear(); ano++) {
                    const dataAniversario = new Date(ano, admissao.getMonth(), admissao.getDate());
                    if (dataAniversario >= dataInicio && dataAniversario <= dataFim && ano !== admissao.getFullYear()) {
                        const anosDeEmpresa = ano - admissao.getFullYear();
                        aniversarios.push({
                            id: doc.id,
                            sourceCollection: 'funcionarios',
                            tipo: 'empresa',
                            data: dataAniversario,
                            titulo: `Aniversário de Empresa: ${func.nome}`,
                            descricao: `Completando ${anosDeEmpresa} ano(s) de casa.`
                        });
                        break;
                    }
                }
            }
        });
        return aniversarios;
    } catch (error) {
        return [];
    }
}

async function fetchAtividades() {
    const dataInicio = new Date(getElement('agenda-filtro-inicio').value);
    const dataFim = new Date(getElement('agenda-filtro-fim').value);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio) || isNaN(dataFim)) {
        return [];
    }

    try {
        const currentUser = firebase.auth().currentUser;        
        if (!currentUser) {
            console.warn("fetchAtividades: Usuário não autenticado. Retornando array vazio.");
            return [];
        }

        // Buscar com filtro no servidor
        const atividadesSnap = await db.collection('agenda_atividades')
            .where('data', '>=', dataInicio)
            .where('data', '<=', dataFim)
            .where('criadoPor', '==', currentUser.uid).get();
        
        const atribuidasSnap = await db.collection('agenda_atividades')
            .where('data', '>=', dataInicio)
            .where('data', '<=', dataFim)
            .where('atribuidoParaId', '==', currentUser.uid)
            .get();

        const todasAsAtividades = new Map();

        // Processar resultados
        [...atividadesSnap.docs, ...atribuidasSnap.docs].forEach(doc => {
            if (!todasAsAtividades.has(doc.id)) {
                todasAsAtividades.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });

        // Filtra os eventos combinados pelo período selecionado
        const atividadesFiltradas = Array.from(todasAsAtividades.values())            
            .map(atividade => {
                return {
                    id: atividade.id,
                    collection: 'agenda_atividades',
                    tipo: atividade.tipo || 'Tarefa',
                    data: atividade.data.toDate(),
                    titulo: `${atividade.tipo || 'Atividade'}: ${atividade.assunto}`,
                    descricao: atividade.descricao || '',
                    criadoEm: atividade.criadoEm,
                    status: atividade.status || 'Aberto',
                    criadoPor: atividade.criadoPor,
                    criadoPorNome: atividade.criadoPorNome,
                    atribuidoParaId: atividade.atribuidoParaId,
                    atribuidoParaNome: atividade.atribuidoParaNome,
                    concluidoEm: atividade.concluidoEm,
                    tempoResolucao: atividade.tempoResolucao
                };
            });

        return atividadesFiltradas;

    } catch (error) {
        return [];
    }
}

// ========================================
// OPERAÇÕES CRUD
// ========================================

async function excluirEvento(id, collection) {
    if (!id || !collection) {
        mostrarMensagem("Informações insuficientes para excluir o evento.", "error");
        return;
    }

    if (confirm("Tem certeza de que deseja excluir este item da agenda?")) {
        try {
            await db.collection(collection).doc(id).delete();
            mostrarMensagem("Item excluído com sucesso!", "success");
            await carregarAgenda();
        } catch (error) {
            mostrarMensagem("Erro ao excluir o item: " + error.message, "error");
        }
    }
}

async function editarEvento(id, collection) {
    if (!id || !collection) {
        mostrarMensagem("ID ou coleção inválidos.", "error");
        return;
    }

    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("O item que você está tentando editar não foi encontrado.", "error");
            return;
        }

        const data = doc.data();
        const dadosPreenchimento = {
            id: id,
            collection: collection,
            ...data
        };

        // Abrir o modal correto com os dados para preenchimento
        if (collection === 'agenda_atividades') {
            abrirModalNovaAtividade(dadosPreenchimento);
        }
    } catch (error) {
        mostrarMensagem("Erro ao carregar dados para edição: " + error.message, "error");
    }
}

function preencherFormularioAtividade(dados) {
    try {
        const assuntoInput = getElement('atividade-assunto');
        const dataInput = getElement('atividade-data');
        const horaInput = getElement('atividade-hora');
        const tipoSelect = getElement('atividade-tipo');
        const descricaoTextarea = getElement('atividade-descricao');
        const atribuidoParaSelect = getElement('atividade-atribuido-para');
        const form = getElement('form-nova-atividade');

        if (!assuntoInput || !dataInput || !horaInput || !tipoSelect || !descricaoTextarea || !form || !atribuidoParaSelect) {
            mostrarMensagem("Erro ao carregar formulário de edição.", "error");
            return;
        }

        assuntoInput.value = dados.assunto || '';
        
        // CORREÇÃO: Garante que a data seja um objeto Date válido
        const dataEvento = dados.data?.toDate ? dados.data.toDate() : new Date(dados.data);
        if (isNaN(dataEvento.getTime())) {
            throw new Error("Data inválida recebida para preenchimento.");
        }

        dataInput.value = dataEvento.toISOString().split('T')[0];
        if (horaInput) {
            horaInput.value = dataEvento.toTimeString().slice(0, 5);
        }
        tipoSelect.value = dados.tipo || '';
        descricaoTextarea.value = dados.descricao || '';
        atribuidoParaSelect.value = dados.atribuidoParaId || '';

        // Armazenar ID e coleção para a função de salvar
        form.dataset.editId = dados.id;
        form.dataset.editCollection = dados.collection;

        // Preencher Histórico de Tempo (TimeLog)
        const timelogSection = getElement('atividade-timelog-section');
        const timelogContainer = getElement('atividade-timelog-container');
        
        if (timelogSection && timelogContainer) {
            timelogSection.style.display = 'block';
            timelogContainer.innerHTML = '';
            let logs = dados.timeLog || [];
            
            // Se não tem timeLog mas tem executionStartTime (legado), cria um log inicial
            if (logs.length === 0 && dados.executionStartTime) {
                const start = dados.executionStartTime.toDate ? dados.executionStartTime.toDate() : new Date(dados.executionStartTime);
                const end = dados.concluidoEm ? (dados.concluidoEm.toDate ? dados.concluidoEm.toDate() : new Date(dados.concluidoEm)) : null;
                logs.push({ start, end });
            }

            if (logs.length === 0) {
                timelogContainer.innerHTML = '<p class="text-muted small">Nenhum registro de tempo ainda.</p>';
            } else {
                logs.forEach((log, index) => {
                    const startVal = log.start ? (log.start.toDate ? log.start.toDate() : new Date(log.start)).toISOString().slice(0, 16) : '';
                    const endVal = log.end ? (log.end.toDate ? log.end.toDate() : new Date(log.end)).toISOString().slice(0, 16) : '';
                    
                    const row = document.createElement('div');
                    row.className = 'row g-2 mb-2 timelog-row align-items-center';
                    row.innerHTML = `
                        <div class="col-5">
                            <label class="small text-muted">Início</label>
                            <input type="datetime-local" class="form-control form-control-sm timelog-start" value="${startVal}">
                        </div>
                        <div class="col-5">
                            <label class="small text-muted">Fim (Pausa)</label>
                            <input type="datetime-local" class="form-control form-control-sm timelog-end" value="${endVal}">
                        </div>
                    `;
                    timelogContainer.appendChild(row);
                });
            }
        }


    } catch (error) {
        mostrarMensagem("Erro ao preencher formulário de edição.", "error");
    }
}

/**
 * Gera e imprime um vale-pizza de aniversário para um funcionário.
 * @param {string} funcionarioId - O ID do funcionário.
 * @param {string} nomeFuncionario - O nome do funcionário.
 */
function emitirValePizza(funcionarioId, nomeFuncionario) {
    const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    const conteudoHTML = `
        <html>
            <head>
                <title>Vale-Pizza de Aniversário</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    @page { size: A5 landscape; margin: 1cm; }
                    body { font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100%; background-color: #fff3e0; }
                    .vale-container { text-align: center; border: 5px dashed #ff7043; border-radius: 15px; padding: 2rem; background-color: #fff; width: 100%; max-width: 600px; }
                    .vale-header h2 { font-weight: 700; color: #d9534f; }
                    .vale-icon { font-size: 4rem; color: #ff7043; margin-bottom: 1rem; }
                    .vale-body p { font-size: 1.2rem; }
                    .vale-footer { margin-top: 2rem; font-size: 0.8rem; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="vale-container">

                        <div class="vale-icon"><i class="fas fa-pizza-slice"></i></div>
                        <p class="mt-4">A <strong>Calçados Crival</strong> parabeniza você, <strong>${nomeFuncionario}</strong>, pelo seu dia!</p>
                        <p>Este vale dá direito a uma pizza grande para celebrar esta data especial.</p>
                    </div>
                    <div class="vale-footer">Válido por 30 dias a partir de ${hojeFormatado}.</div>
                </div>
            </body>
        </html>`;

    openPrintWindow(conteudoHTML, { autoPrint: true, name: `vale-pizza-${funcionarioId}` });
}

// ========================================
// FUNÇÕES ADICIONAIS
// ========================================

function imprimirResumoDoDia() {
    // Captura os containers de "Hoje" tanto de Minhas Atividades quanto da Equipe
    const containerMinhas = getElement('agenda-minhas-hoje');
    const containerEquipe = getElement('agenda-equipe-hoje');
    
    // Verifica se há conteúdo válido (não vazio e sem a mensagem de "Nenhum evento")
    const temMinhas = containerMinhas && containerMinhas.children.length > 0 && !containerMinhas.querySelector('p.text-muted');
    const temEquipe = containerEquipe && containerEquipe.children.length > 0 && !containerEquipe.querySelector('p.text-muted');

    if (!temMinhas && !temEquipe) {
        mostrarMensagem("Não há eventos na coluna 'Hoje' para imprimir.", "info");
        return;
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    let conteudoPrincipal = '';

    if (temMinhas) {
        conteudoPrincipal += `
            <h4 class="mt-4 mb-3 border-bottom pb-2">Minhas Atividades</h4>
            <div class="agenda-cards">${containerMinhas.innerHTML}</div>
        `;
    }

    if (temEquipe) {
        conteudoPrincipal += `
            <h4 class="mt-4 mb-3 border-bottom pb-2">Atividades da Equipe</h4>
            <div class="agenda-cards">${containerEquipe.innerHTML}</div>
        `;
    }

    let conteudoHTML = `
        <html>
            <head>
                <title>Resumo do Dia - ${dataHoje}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style> 
                    @page { size: A4; margin: 1.5cm; }
                    body { font-family: 'Segoe UI', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 20px; }
                    .agenda-card-actions { display: none !important; } 
                    .agenda-card { border: 1px solid #dee2e6; border-left-width: 4px; margin-bottom: 10px; page-break-inside: avoid; padding: 10px; border-radius: 4px; background-color: #f8f9fa; }
                    .agenda-card-title { font-weight: bold; font-size: 1.1em; margin-bottom: 5px; }
                    .agenda-card-description { font-size: 0.9em; color: #555; margin-bottom: 5px; }
                    .agenda-card-date { font-size: 0.8em; color: #777; }
                    /* Cores das bordas para impressão */
                    .border-success { border-left-color: #28a745 !important; }
                    .border-warning { border-left-color: #ffc107 !important; }
                    .border-info { border-left-color: #17a2b8 !important; }
                    .border-primary { border-left-color: #0d6efd !important; }
                    .border-danger { border-left-color: #dc3545 !important; }
                    .border-secondary { border-left-color: #6c757d !important; }
                    .border-dark { border-left-color: #212529 !important; }
                    .border-purple { border-left-color: #6610f2 !important; }
                    .border-orange { border-left-color: #fd7e14 !important; }
                </style>
            </head>
            <body>
                <h2 class="mb-4 text-center">Resumo de Atividades - ${dataHoje}</h2>
                ${conteudoPrincipal}
                <div class="mt-5 text-center text-muted small">
                    <p>Gerado automaticamente pelo Sistema Nexter</p>
                </div>
            </body>
        </html>`;

    openPrintWindow(conteudoHTML, { autoPrint: true, name: '_blank' });
}

function calcularTempoResolucao(dataCriacao) {
    // Esta função agora é um wrapper simplificado. 
    // O cálculo real deve considerar o timeLog se disponível.
    // Se chamado sem contexto de timeLog, retorna null ou cálculo simples.
    return null; 
}

function calcularTempoTotalMs(timeLog) {
    if (!timeLog || !Array.isArray(timeLog)) return 0;
    let totalMs = 0;
    const agora = new Date();

    timeLog.forEach(log => {
        const start = log.start.toDate ? log.start.toDate() : new Date(log.start);
        const end = log.end ? (log.end.toDate ? log.end.toDate() : new Date(log.end)) : agora;
        totalMs += (end - start);
    });
    return totalMs;
}

function formatarTempoMs(diffMs) {
    if (diffMs < 0) diffMs = 0;

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    diffMs -= dias * (1000 * 60 * 60 * 24);
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    diffMs -= horas * (1000 * 60 * 60);
    const minutos = Math.floor(diffMs / (1000 * 60));

    return `${dias}d ${horas}h ${minutos}m`;
}

async function concluirEvento(id, collection) {
    if (!id || !collection) {
        mostrarMensagem("Informações insuficientes para concluir a tarefa.", "error");
        return;
    }

    if (!confirm("Deseja marcar esta tarefa como concluída?")) {
        return;
    }

    try {
        const docRef = db.collection(collection).doc(id);
        const doc = await docRef.get();
        const dados = doc.data();

        // CORREÇÃO: Usa o tempo de início da execução se existir, senão usa o tempo de criação.
        const startTime = dados.executionStartTime || dados.criadoEm;

        await docRef.update({ 
            status: 'Concluído',
            concluidoEm: firebase.firestore.FieldValue.serverTimestamp(),
            tempoResolucao: calcularTempoResolucao(startTime)
        });

        mostrarMensagem("Tarefa concluída com sucesso!", "success");
        await carregarAgenda();
    } catch (error) {
        mostrarMensagem("Ocorreu um erro ao tentar concluir a tarefa.", "error");
    }
}

async function iniciarAtividadeAgenda(id) {
    try {
        await db.collection('agenda_atividades').doc(id).update({
            status: 'Em Andamento',
            executionStartTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        mostrarMensagem("Atividade iniciada! Status alterado para 'Em Andamento'.", "success");
        await carregarAgenda();
    } catch (error) {
        mostrarMensagem("Erro ao iniciar atividade.", "error");
    }
}

async function pausarAtividadeAgenda(id) {
    try {
        await db.collection('agenda_atividades').doc(id).update({
            status: 'Pausado'
        });
        mostrarMensagem("Atividade pausada.", "info");
        await carregarAgenda();
    } catch (error) {
        mostrarMensagem("Erro ao pausar atividade.", "error");
    }
}

async function visualizarEventoExterno(id, sourceCollection, eventType) {
    try {
        switch (sourceCollection) {
            case 'lancamentos_financeiros':
                if (typeof abrirModalLancamentoFinanceiro === 'function') {
                    abrirModalLancamentoFinanceiro(id);
                } else {
                    mostrarMensagem("Função para visualizar lançamento financeiro não encontrada. Navegando para a seção Financeiro.", "info");
                    showSection('financeiro');
                }
                break;
            case 'afastamentos':
                if (typeof abrirModalAfastamento === 'function') {
                    abrirModalAfastamento(id);
                } else {
                    mostrarMensagem("Função para visualizar afastamento não encontrada. Navegando para a seção Afastamentos.", "info");
                    showSection('afastamentos');
                }
                break;
            case 'funcionarios':
                if (typeof abrirModalFuncionario === 'function') {
                    abrirModalFuncionario(id);
                } else {
                    mostrarMensagem("Função para visualizar funcionário não encontrada. Navegando para a seção Funcionários.", "info");
                    showSection('funcionarios');
                }
                break;
            default:
                mostrarMensagem(`Não é possível visualizar detalhes para o tipo de evento: ${eventType} da coleção ${sourceCollection}.`, "info");
                break;
        }
    } catch (error) {
        mostrarMensagem("Erro ao tentar visualizar o evento.", "error");
    }
 }

async function visualizarEvento(id, collection) {
    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Atividade não encontrada.", "error");
            return;
        }
        
        const atividade = doc.data();
        const dataFormatada = atividade.data ? new Date(atividade.data.toDate()).toLocaleString('pt-BR') : 'N/A';
        
        const conteudo = `
            <div class="mb-3">
                <label class="fw-bold">Assunto:</label>
                <div>${atividade.assunto || atividade.titulo || '-'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-6">
                    <label class="fw-bold">Data:</label>
                    <div>${dataFormatada}</div>
                </div>
                <div class="col-6">
                    <label class="fw-bold">Tipo:</label>
                    <div>${atividade.tipo || '-'}</div>
                </div>
            </div>
            <div class="mb-3">
                <label class="fw-bold">Descrição:</label>
                <div class="p-2 bg-light rounded border" style="white-space: pre-wrap;">${atividade.descricao || '-'}</div>
            </div>
            <div class="row mb-3">
                <div class="col-6">
                    <label class="fw-bold">Status:</label>
                    <div><span class="badge ${atividade.status === 'Concluído' ? 'bg-success' : 'bg-warning'}">${atividade.status || 'Aberto'}</span></div>
                </div>
                <div class="col-6">
                    <label class="fw-bold">Atribuído para:</label>
                    <div>${atividade.atribuidoParaNome || '-'}</div>
                </div>
            </div>
            ${atividade.criadoPorNome ? `<div class="text-muted small text-end">Criado por: ${atividade.criadoPorNome}</div>` : ''}
        `;

        if (typeof abrirModalGenerico === 'function') {
            abrirModalGenerico("Detalhes da Atividade", conteudo);
        } else {
            alert(`Assunto: ${atividade.assunto}\nData: ${dataFormatada}\nDescrição: ${atividade.descricao}`);
        }

    } catch (error) {
        mostrarMensagem("Erro ao carregar detalhes da atividade.", "error");
    }
}

// ========================================
// CSS PARA MODAIS
// ========================================

function adicionarCSSModais() {
    const style = document.createElement('style');
    if (document.getElementById('agenda-modal-styles')) return;
    style.id = 'agenda-modal-styles';
    style.textContent = `
        .agenda-card {
            position: relative;
        }
        .agenda-card-actions {
            position: absolute;
            top: 5px;
            right: 5px;
            display: none; /* Usar especificidade em vez de !important */
            background-color: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            padding: 2px;
        }
        .agenda-card:hover .agenda-card-actions {
            display: flex;
            gap: 5px;
        }
        .btn-icon {
            background-color: transparent;
            padding: 5px 8px;
            line-height: 1;
        }
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            z-index: 1050;
            display: none;
        }
        .modal-dialog {
            position: relative;
            width: auto;
            margin: 0.5rem;
            pointer-events: none;
        }
        .modal-content {
            position: relative;
            display: flex;
            flex-direction: column;
            width: 100%;
            pointer-events: auto;
            background-color: #fff;
            background-clip: padding-box;
            border: 1px solid rgba(0,0,0,.2);
            border-radius: 0.3rem;
            outline: 0;
            max-width: 500px;
            margin: 1.75rem auto;
        }
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #000;
            opacity: 0.5;
            z-index: 1040;
        }
        @media (min-width: 576px) {
            .modal-dialog {
                max-width: 500px;
                margin: 1.75rem auto;
            }
        }
    `;
    document.head.appendChild(style);
}

// ========================================
// EXPORTAÇÃO DE FUNÇÕES GLOBAIS
// ========================================

window.abrirModalNovaAtividade = abrirModalNovaAtividade;
window.salvarNovaAtividade = salvarNovaAtividade;
window.carregarAgenda = carregarAgenda;
window.fecharModal = fecharModal;
window.visualizarEventoExterno = visualizarEventoExterno;
window.editarEvento = editarEvento;
window.excluirEvento = excluirEvento;
window.concluirEvento = concluirEvento;
window.imprimirResumoDoDia = imprimirResumoDoDia;
window.visualizarEvento = visualizarEvento;
window.alternarVisaoAgenda = alternarVisaoAgenda;
window.mudarMesCalendario = mudarMesCalendario;
window.configurarFiltrosParaAno = configurarFiltrosParaAno;
window.emitirValePizza = emitirValePizza;
window.openPrintWindow = openPrintWindow;
window.iniciarAtividadeAgenda = iniciarAtividadeAgenda;
window.pausarAtividadeAgenda = pausarAtividadeAgenda;