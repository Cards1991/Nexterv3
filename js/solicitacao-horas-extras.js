// =================================================================
// Módulo de Solicitação de Horas Extras (Visão do Gerente)
// =================================================================
console.log("Carregando módulo de solicitação de horas extras...");

let __funcionarios_ativos_solicitacao_cache = [];
let __funcionarios_select_html_cache = '<option value="">Nenhum funcionário ativo encontrado.</option>';
let __funcionarios_replicacao = []; // Lista temporária para o modal de lote
let __solicitacoes_lista_cache = []; // Cache para replicação direta

/**
 * Inicializa a tela de solicitação de horas extras.
 * É chamada quando a seção 'dp-horas-solicitacao' é exibida.
 */
async function inicializarTelaSolicitacao() {
    console.log("Inicializando tela de solicitação de horas extras...");
    
    // Configurar datas padrão (Hoje) nos filtros
    const hoje = new Date().toISOString().split('T')[0];
    const inicioInput = document.getElementById('sol-filtro-data-inicio');
    const fimInput = document.getElementById('sol-filtro-data-fim');
    if (inicioInput && !inicioInput.value) inicioInput.value = hoje;
    if (fimInput && !fimInput.value) fimInput.value = hoje;

    const btnNova = document.getElementById('btn-nova-solicitacao-he');
    if (btnNova && !btnNova.bound) {
        btnNova.addEventListener('click', abrirModalNovaSolicitacao);
        btnNova.bound = true;
    }
    const btnFiltrar = document.getElementById('sol-btn-filtrar');
    if (btnFiltrar && !btnFiltrar.bound) {
        btnFiltrar.addEventListener('click', renderMinhasSolicitacoes);
        btnFiltrar.bound = true;
    }
    await carregarFuncionariosParaCache(); // Pré-carrega os funcionários
    await popularFiltrosSolicitacao();
    await popularFiltroSolicitantes(); // Popula o filtro de usuários
    await renderMinhasSolicitacoes();
}

/**
 * Renderiza a tabela com as solicitações criadas pelo gerente logado.
 */
async function renderMinhasSolicitacoes() {
    const container = document.getElementById('minhas-solicitacoes-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando suas solicitações...</div>';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            container.innerHTML = '<p class="text-muted">Faça login para ver suas solicitações.</p>';
            return;
        }

        // Pega os valores dos filtros
        const dataInicio = document.getElementById('sol-filtro-data-inicio').value;
        const dataFim = document.getElementById('sol-filtro-data-fim').value;
        const setor = document.getElementById('sol-filtro-setor').value;
        const periodo = document.getElementById('sol-filtro-periodo').value;
        const usuarioFiltro = document.getElementById('sol-filtro-usuario').value;

        // CORREÇÃO: Buscamos por ordem de criação (índice padrão) e filtramos data do evento localmente
        // Isso evita o erro de índice inexistente no Firestore
        let query = db.collection('solicitacoes_horas');

        // Se não for admin, filtra apenas as próprias solicitações
        if (typeof currentUserPermissions === 'undefined' || !currentUserPermissions.isAdmin) {
            query = query.where('createdByUid', '==', user.uid);
        }

        query = query.orderBy('createdAt', 'desc').limit(300);

        const snap = await query.get();
        let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtragem local por data do evento
        if (dataInicio) {
            const dtIni = new Date(dataInicio + 'T00:00:00');
            docs = docs.filter(s => s.start && s.start.toDate() >= dtIni);
        }
        if (dataFim) {
            const dtFim = new Date(dataFim + 'T23:59:59');
            docs = docs.filter(s => s.start && s.start.toDate() <= dtFim);
        }

        // Filtro por Solicitante (Usuário)
        if (usuarioFiltro) {
            docs = docs.filter(s => s.createdByUid === usuarioFiltro);
        }

        // Filtro por Período (Manhã, Tarde, Noite)
        if (periodo) {
            docs = docs.filter(s => {
                if (!s.start) return false;
                const start = s.start.toDate();
                const hora = start.getHours();
                
                if (periodo === 'manha') return hora >= 4 && hora < 12;
                if (periodo === 'tarde') return hora >= 12 && hora < 20;
                if (periodo === 'noite') return hora >= 20 || hora < 4;
                return false;
            });
        }

        // Ordenação local por data do evento
        docs.sort((a, b) => {
            const dateA = a.start && a.start.toDate ? a.start.toDate() : new Date(0);
            const dateB = b.start && b.start.toDate ? b.start.toDate() : new Date(0);
            return dateB - dateA;
        });

        if (docs.length === 0) {
            container.innerHTML = '<p class="text-muted text-center mt-4">Você ainda não criou nenhuma solicitação.</p>';
            return;
        }

        // Arrays para separar por período
        const manha = [];
        const tarde = [];
        const noite = [];
        __solicitacoes_lista_cache = []; // Limpa cache

        docs.forEach(s => {
            if (!s.start) return;
            const start = s.start.toDate();
            const hora = start.getHours();
            const item = { ...s, start, end: s.end ? s.end.toDate() : start };

            __solicitacoes_lista_cache.push(item); // Guarda para replicação

            // Regra de Períodos:
            // Manhã: < 12:00
            // Tarde: 12:00 até 19:59
            // Noite: >= 20:00 ou < 04:00
            if (hora >= 20 || hora < 4) {
                noite.push(item);
            } else if (hora < 12) {
                manha.push(item);
            } else {
                tarde.push(item);
            }
        });

        // Função auxiliar para gerar tabela
        const gerarTabela = (titulo, lista, corHeader) => {
            if (lista.length === 0) return '';
            
            let html = `
                <div class="card mb-4 border-${corHeader} shadow-sm">
                    <div class="card-header bg-${corHeader} text-white d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-clock me-2"></i>${titulo}</h6>
                        <span class="badge bg-white text-${corHeader}">${lista.length}</span>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm table-hover mb-0 align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width: 40px;"><input type="checkbox" class="form-check-input" onclick="toggleTodosCheckboxes(this)"></th>
                                        <th>Criação</th>
                                        <th>Funcionário</th>
                                        <th>Período</th>
                                        <th>Status</th>
                                        <th class="text-end">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            lista.forEach(s => {
                const statusBadge = {
                    'pendente': 'bg-warning text-dark',
                    'aprovado': 'bg-success',
                    'rejeitado': 'bg-danger',
                    'cancelado': 'bg-secondary'
                }[s.status] || 'bg-light text-dark';

                html += `
                    <tr>
                        <td><input type="checkbox" class="form-check-input sol-check" value="${s.id}"></td>
                        <td>${s.createdAt.toDate().toLocaleDateString('pt-BR')}</td>
                        <td>
                            <div class="d-flex align-items-center">
                                <span class="fw-bold">${s.employeeName}</span>
                            </div>
                        </td>
                        <td>${s.start.toLocaleString('pt-BR')} - ${s.end.toLocaleString('pt-BR')}</td>
                        <td><span class="badge ${statusBadge}">${s.status || 'pendente'}</span></td>
                        <td class="text-end">
                            <div class="btn-group btn-group-sm">
                                ${s.status === 'pendente' ? `<button class="btn btn-outline-warning" onclick="cancelarMinhaSolicitacao('${s.id}')" title="Cancelar"><i class="fas fa-times-circle"></i></button>` : ''}
                                ${s.status === 'pendente' ? `<button class="btn btn-outline-primary" onclick="editarSolicitacao('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                                ${s.status !== 'aprovado' ? `<button class="btn btn-outline-danger" onclick="excluirMinhaSolicitacao('${s.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            return html;
        };

        let finalHtml = '';
        finalHtml += gerarTabela('Manhã (04:00 - 11:59)', manha, 'info');
        finalHtml += gerarTabela('Tarde (12:00 - 19:59)', tarde, 'warning');
        finalHtml += gerarTabela('Noite (20:00 - 03:59)', noite, 'dark');

        if (finalHtml === '') {
             container.innerHTML = '<p class="text-muted text-center mt-4">Nenhuma solicitação encontrada para os filtros selecionados.</p>';
        } else {
            container.innerHTML = finalHtml;
        }

    } catch (err) {
        console.error("Erro ao renderizar 'Minhas Solicitações':", err);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar suas solicitações.</div>';
    }
}

/**
 * Carrega todos os funcionários ativos para um cache local.
 * Isso acelera o preenchimento do select no modal de nova solicitação.
 */
async function carregarFuncionariosParaCache() {
    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        const funcionarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        __funcionarios_ativos_solicitacao_cache = funcionarios;

        if (funcionarios.length > 0) {
            let optionsHtml = '<option value="">Selecione um funcionário</option>';
            funcionarios.forEach(f => {
                optionsHtml += `<option value="${f.id}" data-nome="${f.nome}" data-setor="${f.setor || ''}">${f.nome} - ${f.cargo || ''}</option>`;
            });
            __funcionarios_select_html_cache = optionsHtml;
        }
        console.log(`Cache de funcionários para solicitação carregado: ${funcionarios.length} funcionários.`);
    } catch (err) {
        console.error("Erro ao carregar funcionários para cache:", err);
        mostrarMensagem("Erro ao carregar lista de funcionários.", "error");
    }
}

/**
 * Populates the sector filter dropdown on the solicitation screen.
 */
async function popularFiltrosSolicitacao() {
    const setorSelect = document.getElementById('sol-filtro-setor');
    if (!setorSelect) return;

    // Avoid re-populating if already filled
    if (setorSelect.options.length > 1) return;

    try {
        const setores = new Set();
        const empresasSnap = await db.collection('empresas').get();
        empresasSnap.forEach(doc => {
            (doc.data().setores || []).forEach(setor => setores.add(setor));
        });

        [...setores].sort().forEach(setor => {
            setorSelect.innerHTML += `<option value="${setor}">${setor}</option>`;
        });
    } catch (error) {
        console.error("Erro ao popular filtro de setores:", error);
    }
}

/**
 * Popula o filtro de solicitantes na tela de listagem.
 */
async function popularFiltroSolicitantes() {
    const select = document.getElementById('sol-filtro-usuario');
    if (!select || select.options.length > 1) return;

    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        select.innerHTML = '<option value="">Todos</option>';
        usersSnap.forEach(doc => {
            const user = doc.data();
            select.innerHTML += `<option value="${doc.id}">${user.nome || user.email}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar solicitantes para filtro:", error);
    }
}

/**
 * Abre o modal para criar uma nova solicitação de horas extras.
 */
async function abrirModalNovaSolicitacao() {
    const modalId = 'solicitacaoHorasModal';
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
        console.error("Elemento do modal de solicitação não encontrado.");
        return;
    }
    
    // 1. Reseta o formulário e preenche os campos de data/hora
    document.getElementById('form-solicitacao-horas').reset();
    document.getElementById('sol-id').value = ''; // Limpa o ID para garantir que é uma nova criação
    const now = new Date();
    document.getElementById('sol-start-date').value = now.toISOString().split('T')[0];
    document.getElementById('sol-start-time').value = now.toTimeString().slice(0, 5);
    const endDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    document.getElementById('sol-end-time').value = endDateTime.toTimeString().slice(0, 5);

    // Restaura título e botão padrão
    modalEl.querySelector('.modal-title').innerHTML = '<i class="fas fa-clock me-2"></i>Nova Solicitação de Horas Extras';
    modalEl.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-paper-plane me-1"></i> Enviar Solicitação';

    // 2. Mostra o modal imediatamente para o usuário
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Carregar lista de solicitantes (usuários do sistema)
    await popularSelectSolicitantes();
    
    // Define o usuário atual como padrão se for uma nova solicitação
    const currentUser = firebase.auth().currentUser;
    const reqSelect = document.getElementById('sol-requester');
    if (reqSelect && currentUser && !document.getElementById('sol-id').value) {
        reqSelect.value = currentUser.uid;
    }

    // 3. Carrega os funcionários do cache (agora é síncrono e rápido)
    const select = document.getElementById('sol-employee');
    select.innerHTML = '<option value="">Selecione um funcionário</option>'; // Default option
    select.innerHTML = __funcionarios_select_html_cache;
    select.disabled = __funcionarios_ativos_solicitacao_cache.length === 0;

    // Adiciona um listener para preencher o setor quando um funcionário é selecionado
    select.addEventListener('change', (e) => {
        const sectorInput = document.getElementById('sol-sector');
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (sectorInput && selectedOption) {
            // Preenche o campo de setor com o valor do atributo data-setor da opção selecionada
            sectorInput.value = selectedOption.dataset.setor || '';
        }
    });
}

async function popularSelectSolicitantes() {
    const select = document.getElementById('sol-requester');
    if (!select) return;
    
    // Evita repopular se já tiver opções carregadas
    if (select.options.length > 0) return;

    try {
        const usersSnap = await db.collection('usuarios').orderBy('nome').get();
        select.innerHTML = ''; 
        
        usersSnap.forEach(doc => {
            const user = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = user.nome || user.email;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar solicitantes:", error);
    }
}

/**
 * Salva a nova solicitação de horas extras no Firestore.
 */
async function salvarNovaSolicitacao() {
    const solicitacaoId = document.getElementById('sol-id').value;
    const employeeSelect = document.getElementById('sol-employee');
    const employeeId = employeeSelect.value;
    const employeeName = employeeSelect.options[employeeSelect.selectedIndex].dataset.nome;
    const startDate = document.getElementById('sol-start-date').value;
    const startTime = document.getElementById('sol-start-time').value;
    const endDate = startDate; // A data de fim é a mesma da de início
    const endTime = document.getElementById('sol-end-time').value;
    const reason = document.getElementById('sol-reason').value;

    const requesterSelect = document.getElementById('sol-requester');
    const requesterId = requesterSelect ? requesterSelect.value : user.uid;
    const requesterName = requesterSelect ? requesterSelect.options[requesterSelect.selectedIndex].text : (user.displayName || user.email);

    if (!employeeId || !startDate || !startTime || !endTime) {
        mostrarMensagem('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    try {
        // CORREÇÃO: Cria a data a partir dos componentes para evitar problemas de fuso horário
        const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
        const [sHour, sMinute] = startTime.split(':').map(Number);
        const start = new Date(sYear, sMonth - 1, sDay, sHour, sMinute);
        const [eYear, eMonth, eDay] = endDate.split('-').map(Number); // CORRIGIDO
        const [eHour, eMinute] = endTime.split(':').map(Number);
        const end = new Date(eYear, eMonth - 1, eDay, eHour, eMinute);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            mostrarMensagem('As datas e horas fornecidas são inválidas.', 'error');
            return;
        }

        const user = firebase.auth().currentUser;
        // Adiciona o cálculo do valor estimado na criação
        const valorEstimado = await calcularValorEstimado(start, end, employeeId);

        const data = {
            employeeId,
            employeeName,
            start: firebase.firestore.Timestamp.fromDate(start),
            end: firebase.firestore.Timestamp.fromDate(end),
            reason: reason || '',
            status: 'pendente',
            valorEstimado: valorEstimado,
            createdByUid: requesterId,
            createdByName: requesterName
        };

        if (solicitacaoId) {
            // Atualização
            data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            data.updatedByUid = user.uid; // Registra quem alterou
            
            await db.collection('solicitacoes_horas').doc(solicitacaoId).update(data);
            mostrarMensagem('Solicitação atualizada com sucesso!', 'success');
        } else {
            // Criação
            data.valorOriginalSolicitado = valorEstimado;
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            await db.collection('solicitacoes_horas').add(data);
            mostrarMensagem('Solicitação enviada para aprovação!', 'success');
        }

        bootstrap.Modal.getInstance(document.getElementById('solicitacaoHorasModal')).hide();
        await renderMinhasSolicitacoes();

    } catch (err) {
        console.error('Erro ao salvar solicitação:', err);
        mostrarMensagem('Falha ao salvar a solicitação.', 'error');
    }
}

/**
 * Seleciona ou deseleciona todos os checkboxes da tabela visível.
 */
function toggleTodosCheckboxes(source) {
    const checkboxes = document.querySelectorAll('.sol-check');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

/**
 * Replica as solicitações selecionadas para o dia seguinte.
 */
async function replicarSelecionados() {
    const checkboxes = document.querySelectorAll('.sol-check:checked');
    if (checkboxes.length === 0) {
        mostrarMensagem("Selecione pelo menos uma solicitação para replicar.", "warning");
        return;
    }

    if (!confirm(`Deseja replicar ${checkboxes.length} solicitações para o dia seguinte?`)) return;

    try {
        const user = firebase.auth().currentUser;
        const batch = db.batch();
        let count = 0;

        for (const cb of checkboxes) {
            const id = cb.value;
            const original = __solicitacoes_lista_cache.find(s => s.id === id);
            if (!original) continue;

            // Calcular novas datas (+1 dia)
            const newStart = new Date(original.start);
            newStart.setDate(newStart.getDate() + 1);
            
            const newEnd = new Date(original.end);
            newEnd.setDate(newEnd.getDate() + 1);

            // Recalcular valor estimado
            const valorEstimado = await calcularValorEstimado(newStart, newEnd, original.employeeId);

            const newDocRef = db.collection('solicitacoes_horas').doc();
            const newData = {
                employeeId: original.employeeId,
                employeeName: original.employeeName,
                reason: original.reason,
                start: firebase.firestore.Timestamp.fromDate(newStart),
                end: firebase.firestore.Timestamp.fromDate(newEnd),
                status: 'pendente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdByUid: user.uid,
                createdByName: user.displayName || user.email,
                valorEstimado: valorEstimado,
                valorOriginalSolicitado: valorEstimado,
                replicadoDe: id
            };

            batch.set(newDocRef, newData);
            count++;
        }

        await batch.commit();
        
        mostrarMensagem(`${count} solicitações replicadas com sucesso!`, "success");
        await renderMinhasSolicitacoes();

    } catch (err) {
        console.error("Erro na replicação em lote:", err);
        mostrarMensagem("Erro ao criar solicitações.", "error");
    }
}

/**
 * Abre o modal de solicitação preenchido com os dados para edição.
 * @param {string} id - O ID da solicitação.
 */
async function editarSolicitacao(id) {
    try {
        const doc = await db.collection('solicitacoes_horas').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        }
        const data = doc.data();

        // Abre o modal (que reseta o form)
        await abrirModalNovaSolicitacao();

        // Preenche com os dados existentes
        document.getElementById('sol-id').value = id;
        document.getElementById('sol-employee').value = data.employeeId;
        // Dispara evento para preencher setor, se necessário, ou define manualmente
        // document.getElementById('sol-sector').value = ... (já tratado pelo change do select se disparado, ou podemos deixar o usuário ver ao salvar)
        
        const start = data.start.toDate();
        const end = data.end.toDate();

        document.getElementById('sol-start-date').value = start.toISOString().split('T')[0];
        document.getElementById('sol-start-time').value = start.toTimeString().slice(0, 5);
        document.getElementById('sol-end-time').value = end.toTimeString().slice(0, 5);
        document.getElementById('sol-reason').value = data.reason || '';

        const reqSelect = document.getElementById('sol-requester');
        if (reqSelect && data.createdByUid) {
            reqSelect.value = data.createdByUid;
        }

        // Ajusta textos para modo edição
        document.querySelector('#solicitacaoHorasModal .modal-title').innerHTML = '<i class="fas fa-edit me-2"></i>Editar Solicitação';
        document.querySelector('#form-solicitacao-horas button[type="submit"]').innerHTML = '<i class="fas fa-save me-1"></i> Salvar Alterações';

    } catch (err) {
        console.error("Erro ao editar solicitação:", err);
        mostrarMensagem("Erro ao carregar dados.", "error");
    }
}

/**
 * Permite que o gerente que criou a solicitação a cancele.
 * @param {string} id - O ID da solicitação.
 */
async function cancelarMinhaSolicitacao(id) {
    if (!confirm("Tem certeza que deseja cancelar esta solicitação?")) return;

    try {
        const user = firebase.auth().currentUser;
        const docRef = db.collection('solicitacoes_horas').doc(id);
        const doc = await docRef.get();

        const isCreator = doc.data().createdByUid === user.uid;
        const isAdmin = typeof currentUserPermissions !== 'undefined' && currentUserPermissions.isAdmin;

        if (!isCreator && !isAdmin) {
            mostrarMensagem("Você não tem permissão para cancelar esta solicitação.", "error");
            return;
        }

        await docRef.update({
            status: 'cancelado',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem("Solicitação cancelada.", "info");
        await renderMinhasSolicitacoes();

    } catch (err) {
        console.error("Erro ao cancelar solicitação:", err);
        mostrarMensagem("Falha ao cancelar a solicitação.", "error");
    }
}

/**
 * Permite que o gerente que criou a solicitação a exclua permanentemente.
 * @param {string} id - O ID da solicitação.
 */
async function excluirMinhaSolicitacao(id) {
    if (!confirm("Tem certeza que deseja EXCLUIR esta solicitação permanentemente? Esta ação não pode ser desfeita.")) return;

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            mostrarMensagem("Você precisa estar logado para excluir uma solicitação.", "error");
            return;
        }

        const docRef = db.collection('solicitacoes_horas').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        }

        // Validação de permissão
        const isCreator = doc.data().createdByUid === user.uid;
        const isAdmin = typeof currentUserPermissions !== 'undefined' && currentUserPermissions.isAdmin;

        if (!isCreator && !isAdmin) {
            mostrarMensagem("Você não tem permissão para excluir esta solicitação.", "error");
            return;
        }

        await docRef.delete();
        mostrarMensagem("Solicitação excluída com sucesso.", "success");
        await renderMinhasSolicitacoes(); // Atualiza a lista
    } catch (err) {
        console.error("Erro ao excluir solicitação:", err);
        mostrarMensagem("Falha ao excluir a solicitação.", "error");
    }
}

// Adiciona o listener para o formulário do modal
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-solicitacao-horas');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            salvarNovaSolicitacao();
        });
    }
});

// Garante compatibilidade com chamadas `onclick` antigas no HTML
window.abrirModalSolicitacaoHoras = abrirModalNovaSolicitacao;

// Exporta funções para o escopo global para serem chamadas pelo HTML
window.cancelarMinhaSolicitacao = cancelarMinhaSolicitacao;
window.excluirMinhaSolicitacao = excluirMinhaSolicitacao;
window.replicarSelecionados = replicarSelecionados;
window.toggleTodosCheckboxes = toggleTodosCheckboxes;
window.editarSolicitacao = editarSolicitacao;

/**
 * Calcula o valor estimado de uma solicitação de horas extras.
 * (Função adicionada para estar disponível neste módulo)
 */
async function calcularValorEstimado(start, end, employeeId) {
    try {
        const duracaoMinutos = (end - start) / (1000 * 60);
        if (duracaoMinutos <= 0) return 0;

        const funcDoc = await db.collection('funcionarios').doc(employeeId).get();
        if (!funcDoc.exists) return 0;

        const salario = parseFloat(funcDoc.data().salario || 0);
        if (salario <= 0) return 0;

        const valorHora = salario / 220;
        const valorExtra = (duracaoMinutos / 60) * (valorHora * 1.5); // Assumindo 50%
        const dsr = valorExtra / 6; // DSR simplificado

        return parseFloat((valorExtra + dsr).toFixed(2));
    } catch (error) {
        console.error("Erro no cálculo do valor estimado:", error);
        return 0;
    }
}