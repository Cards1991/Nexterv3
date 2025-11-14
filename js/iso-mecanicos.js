// Gerenciamento do Cadastro de Mecânicos - ISO 9001

async function inicializarMecanicos() {
    try {
        await carregarMecanicos();
        const btnNovo = document.getElementById('btn-adicionar-mecanico');
        if (btnNovo && !btnNovo.__bound) {
            btnNovo.addEventListener('click', () => abrirModalAdicionarMecanico());
            btnNovo.__bound = true;
        }
    } catch (e) {
        console.error("Erro ao inicializar cadastro de mecânicos:", e);
        mostrarMensagem("Erro ao carregar o módulo de mecânicos.", "error");
    }
}

async function carregarMecanicos() {
    const tbody = document.getElementById('tabela-mecanicos');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        // Busca funcionários que estão marcados como mecânicos
        const snap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum mecânico cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snap.forEach(doc => {
            const funcionario = doc.data();
            const row = `
                <tr>
                    <td>${funcionario.nome}</td>
                    <td>${funcionario.cpf || '-'}</td>
                    <td>${funcionario.setor || '-'} / ${funcionario.cargo || '-'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger" title="Remover da lista de mecânicos" onclick="removerMecanico('${doc.id}')"><i class="fas fa-user-minus"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Erro ao carregar mecânicos:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar mecânicos.</td></tr>';
    }
}

async function abrirModalAdicionarMecanico() {
    const modalId = 'mecanicoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Adicionar Mecânico</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <p>Selecione um funcionário ativo para adicioná-lo à lista de mecânicos.</p>
                        <div class="mb-3">
                            <label class="form-label">Funcionário</label>
                            <select class="form-select" id="select-novo-mecanico" required></select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="adicionarMecanico()">Adicionar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }
    
    // Popular o select com funcionários que ainda NÃO são mecânicos
    const select = document.getElementById('select-novo-mecanico');
    select.innerHTML = '<option value="">Carregando funcionários...</option>';
    
    const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
    select.innerHTML = '<option value="">Selecione um funcionário</option>';
    snap.forEach(doc => {
        if (doc.data().isMecanico !== true) {
            select.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        }
    });

    new bootstrap.Modal(modalEl).show();
}

async function adicionarMecanico() {
    const funcionarioId = document.getElementById('select-novo-mecanico').value;
    if (!funcionarioId) {
        mostrarMensagem("Selecione um funcionário.", "warning");
        return;
    }

    try {
        // Marca o funcionário como mecânico
        await db.collection('funcionarios').doc(funcionarioId).update({ isMecanico: true });
        
        mostrarMensagem("Mecânico adicionado com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('mecanicoModal')).hide();
        await carregarMecanicos();

    } catch (error) {
        console.error("Erro ao adicionar mecânico:", error);
        mostrarMensagem("Erro ao adicionar mecânico.", "error");
    }
}

async function removerMecanico(funcionarioId) {
    if (!confirm("Tem certeza que deseja remover este funcionário da lista de mecânicos? Ele não será excluído do sistema, apenas desmarcado como mecânico.")) {
        return;
    }
    try {
        // Apenas remove a marcação de mecânico
        await db.collection('funcionarios').doc(funcionarioId).update({ isMecanico: false });
        mostrarMensagem("Mecânico removido da lista.", "info");
        await carregarMecanicos();
    } catch (error) {
        console.error("Erro ao remover mecânico:", error);
        mostrarMensagem("Erro ao remover o mecânico.", "error");
    }
}