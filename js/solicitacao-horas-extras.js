// =================================================================
// Módulo de Solicitação de Horas Extras (Visão do Gerente)
// =================================================================

/**
 * Inicializa a tela de solicitação de horas extras.
 * É chamada quando a seção 'dp-horas-solicitacao' é exibida.
 */
async function inicializarTelaSolicitacao() {
    console.log("Inicializando tela de solicitação de horas extras...");
    const btnNova = document.getElementById('btn-nova-solicitacao-he');
    if (btnNova && !btnNova.bound) {
        btnNova.addEventListener('click', abrirModalNovaSolicitacao);
        btnNova.bound = true;
    }
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

        const snap = await db.collection('solicitacoes_horas')
            .where('createdByUid', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        if (snap.empty) {
            container.innerHTML = '<p class="text-muted text-center mt-4">Você ainda não criou nenhuma solicitação.</p>';
            return;
        }

        let html = '<table class="table table-sm table-hover"><thead><tr><th>Criação</th><th>Funcionário</th><th>Período</th><th>Status</th><th class="text-end">Ações</th></tr></thead><tbody>';
        for (const doc of snap.docs) {
            const s = doc.data();
            const start = s.start.toDate();
            const end = s.end.toDate();

            const statusBadge = {
                'pendente': 'bg-warning text-dark',
                'aprovado': 'bg-success',
                'rejeitado': 'bg-danger',
                'cancelado': 'bg-secondary'
            }[s.status] || 'bg-light text-dark';

            html += `
                <tr>
                    <td>${s.createdAt.toDate().toLocaleDateString('pt-BR')}</td>
                    <td>${s.employeeName}</td>
                    <td>${start.toLocaleString('pt-BR')} - ${end.toLocaleString('pt-BR')}</td>
                    <td><span class="badge ${statusBadge}">${s.status || 'pendente'}</span></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            ${s.status === 'pendente' ? `<button class="btn btn-outline-warning" onclick="cancelarMinhaSolicitacao('${doc.id}')" title="Cancelar"><i class="fas fa-times-circle"></i></button>` : ''}
                            ${s.status !== 'aprovado' ? `<button class="btn btn-outline-danger" onclick="excluirMinhaSolicitacao('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        console.error("Erro ao renderizar 'Minhas Solicitações':", err);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar suas solicitações.</div>';
    }
}

/**
 * Abre o modal para criar uma nova solicitação de horas extras.
 */
function abrirModalNovaSolicitacao() {
    const modalId = 'solicitacaoHorasModal';
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
        console.error("Elemento do modal de solicitação não encontrado.");
        return;
    }
    
    // 1. Reseta o formulário e preenche os campos de data/hora
    document.getElementById('form-solicitacao-horas').reset();
    const now = new Date();
    document.getElementById('sol-start-date').value = now.toISOString().split('T')[0];
    document.getElementById('sol-start-time').value = now.toTimeString().slice(0, 5);
    const endDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    document.getElementById('sol-end-date').value = endDateTime.toISOString().split('T')[0];
    document.getElementById('sol-end-time').value = endDateTime.toTimeString().slice(0, 5);

    // 2. Mostra o modal imediatamente para o usuário
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // 3. Carrega os funcionários em segundo plano (assincronamente)
    const select = document.getElementById('sol-employee');
    select.innerHTML = '<option value="">Carregando funcionários...</option>';
    select.disabled = true;

    db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get()
        .then(snapshot => {
            select.innerHTML = '<option value="">Selecione um funcionário</option>';
            snapshot.forEach(doc => {
                const f = doc.data();
                select.innerHTML += `<option value="${doc.id}" data-nome="${f.nome}">${f.nome} - ${f.cargo || ''}</option>`;
            });
            select.disabled = false;
        })
        .catch(err => {
            console.error("Erro ao carregar funcionários no modal:", err);
            select.innerHTML = '<option value="">Erro ao carregar funcionários</option>';
            select.disabled = false;
        });
}

/**
 * Salva a nova solicitação de horas extras no Firestore.
 */
async function salvarNovaSolicitacao() {
    const employeeSelect = document.getElementById('sol-employee');
    const employeeId = employeeSelect.value;
    const employeeName = employeeSelect.options[employeeSelect.selectedIndex].dataset.nome;
    const startDate = document.getElementById('sol-start-date').value;
    const startTime = document.getElementById('sol-start-time').value;
    const endDate = document.getElementById('sol-end-date').value;
    const endTime = document.getElementById('sol-end-time').value;
    const reason = document.getElementById('sol-reason').value;

    if (!employeeId || !startDate || !startTime || !endDate || !endTime) {
        mostrarMensagem('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    try {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);

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
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user.uid,
            createdByName: user.displayName || user.email,
            valorEstimado: valorEstimado,
            valorOriginalSolicitado: valorEstimado // Salva o valor original na criação
        };

        await db.collection('solicitacoes_horas').add(data);
        mostrarMensagem('Solicitação enviada para aprovação!', 'success');

        bootstrap.Modal.getInstance(document.getElementById('solicitacaoHorasModal')).hide();
        await renderMinhasSolicitacoes();

    } catch (err) {
        console.error('Erro ao salvar solicitação:', err);
        mostrarMensagem('Falha ao salvar a solicitação.', 'error');
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

        if (doc.data().createdByUid !== user.uid) {
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
        if (doc.data().createdByUid !== user.uid) {
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
// Garante compatibilidade com chamadas `onclick` antigas no HTML
window.abrirModalSolicitacaoHoras = abrirModalNovaSolicitacao;

// Exporta funções para o escopo global para serem chamadas pelo HTML
window.cancelarMinhaSolicitacao = cancelarMinhaSolicitacao;
window.excluirMinhaSolicitacao = excluirMinhaSolicitacao;

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