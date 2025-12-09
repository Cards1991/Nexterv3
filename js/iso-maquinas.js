// Gerenciamento do Cadastro de Máquinas - ISO 9001
// URL fixa para o ambiente de desenvolvimento/teste via DevTunnels.
const URL_BASE_QRCODE = 'https://9whrmc68-5500.usw3.devtunnels.ms';

async function inicializarMaquinas() {
    try {
        await carregarMaquinas();
        const btnNova = document.getElementById('btn-nova-maquina');
        if (btnNova && !btnNova.__bound) {
            btnNova.addEventListener('click', () => abrirModalMaquina(null));
            btnNova.__bound = true;
        }
    } catch (e) {
        console.error("Erro ao inicializar cadastro de máquinas:", e);
        mostrarMensagem("Erro ao carregar o módulo de máquinas.", "error");
    }
}

async function carregarMaquinas() {
    const tbody = document.getElementById('tabela-maquinas');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const [maquinasSnap, empresasSnap] = await Promise.all([
            db.collection('maquinas').orderBy('nome').get(),
            db.collection('empresas').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));

        if (maquinasSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma máquina cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        maquinasSnap.forEach(doc => {
            const maquina = doc.data();
            const qrText = `${URL_BASE_QRCODE}/manutencao-mobile.html?maquina=${encodeURIComponent(maquina.codigo)}`;

            const row = `
                <tr>
                    <td><span class="badge bg-secondary">${maquina.codigo}</span></td>
                    <td>${maquina.patrimonio || '-'}</td>
                    <td>${maquina.nome}</td>
                    <td>${empresasMap.get(maquina.empresaId) || 'N/A'} / ${maquina.setor}</td>
                    <td>${maquina.gerente || '-'}</td>
                    <td>
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control" value="${qrText}" readonly>
                            <button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText('${qrText}')" title="Copiar"><i class="fas fa-copy"></i></button>
                        </div>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" title="Alterar" onclick="abrirModalMaquina('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluirMaquina('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Erro ao carregar máquinas:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar máquinas.</td></tr>';
    }
}

async function abrirModalMaquina(maquinaId = null) {
    const modalId = 'maquinaModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Cadastrar Máquina</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-maquina">
                            <input type="hidden" id="maquina-id">
                            <div class="mb-3"><label class="form-label">Empresa</label><select class="form-select" id="maquina-empresa" required></select></div>
                            <div class="mb-3"><label class="form-label">Setor</label><select class="form-select" id="maquina-setor" required></select></div>
                            <div class="mb-3"><label class="form-label">Código Identificador</label><input type="text" class="form-control" id="maquina-codigo" placeholder="Ex: INJ-001" required></div>
                            <div class="mb-3"><label class="form-label">Nome da Máquina</label><input type="text" class="form-control" id="maquina-nome" required></div>
                            <div class="mb-3"><label class="form-label">Número do Patrimônio</label><input type="text" class="form-control" id="maquina-patrimonio"></div>
                            <div class="mb-3"><label class="form-label">Gerente Responsável</label><input type="text" class="form-control" id="maquina-gerente"></div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" id="maquina-critica">
                                <label class="form-check-label" for="maquina-critica">Máquina Crítica (Prioridade em manutenções)</label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarMaquina()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Configurar dependência Empresa -> Setor
        document.getElementById('maquina-empresa').addEventListener('change', function() {
            carregarSetoresPorEmpresa(this.value, 'maquina-setor');
        });
    }

    const form = document.getElementById('form-maquina');
    form.reset();
    document.getElementById('maquina-id').value = maquinaId || '';
    document.querySelector(`#${modalId} .modal-title`).textContent = maquinaId ? 'Alterar Máquina' : 'Nova Máquina';

    await carregarSelectEmpresas('maquina-empresa');

    if (maquinaId) {
        const doc = await db.collection('maquinas').doc(maquinaId).get();
        const data = doc.data();
        document.getElementById('maquina-empresa').value = data.empresaId;
        await carregarSetoresPorEmpresa(data.empresaId, 'maquina-setor');
        document.getElementById('maquina-setor').value = data.setor;
        document.getElementById('maquina-codigo').value = data.codigo;
        document.getElementById('maquina-nome').value = data.nome;
        document.getElementById('maquina-patrimonio').value = data.patrimonio || '';
        document.getElementById('maquina-gerente').value = data.gerente;
        document.getElementById('maquina-critica').checked = data.isCritica || false;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

async function salvarMaquina() {
    const maquinaId = document.getElementById('maquina-id').value;
    const dados = {
        empresaId: document.getElementById('maquina-empresa').value,
        setor: document.getElementById('maquina-setor').value,
        codigo: document.getElementById('maquina-codigo').value.trim().toUpperCase(),
        nome: document.getElementById('maquina-nome').value.trim(),
        patrimonio: document.getElementById('maquina-patrimonio').value.trim(),
        gerente: document.getElementById('maquina-gerente').value.trim(),
        isCritica: document.getElementById('maquina-critica').checked
    };

    if (!dados.empresaId || !dados.setor || !dados.codigo || !dados.nome) {
        mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
        return;
    }

    try {
        // Verificar se o código já existe (em caso de criação)
        if (!maquinaId) {
            const checkSnap = await db.collection('maquinas').where('codigo', '==', dados.codigo).get();
            if (!checkSnap.empty) {
                mostrarMensagem("Este Código Identificador já está em uso.", "error");
                return;
            }
        }

        if (maquinaId) {
            await db.collection('maquinas').doc(maquinaId).update(dados);
            mostrarMensagem("Máquina atualizada com sucesso!", "success");
        } else {
            await db.collection('maquinas').add(dados);
            mostrarMensagem("Máquina cadastrada com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('maquinaModal')).hide();
        await carregarMaquinas();

    } catch (error) {
        console.error("Erro ao salvar máquina:", error);
        mostrarMensagem("Erro ao salvar os dados da máquina.", "error");
    }
}

async function excluirMaquina(maquinaId) {
    if (!confirm("Tem certeza que deseja excluir esta máquina? Esta ação não pode ser desfeita.")) {
        return;
    }
    try {
        // Opcional: Verificar se a máquina tem chamados abertos antes de excluir
        const chamadosSnap = await db.collection('manutencao_chamados').where('maquinaId', '==', maquinaId).limit(1).get();
        if (!chamadosSnap.empty) {
            mostrarMensagem("Não é possível excluir. Esta máquina já possui chamados de manutenção registrados.", "error");
            return;
        }

        await db.collection('maquinas').doc(maquinaId).delete();
        mostrarMensagem("Máquina excluída com sucesso.", "info");
        await carregarMaquinas();
    } catch (error) {
        console.error("Erro ao excluir máquina:", error);
        mostrarMensagem("Erro ao excluir a máquina.", "error");
    }
}