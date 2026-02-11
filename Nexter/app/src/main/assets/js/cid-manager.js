// js/cid-manager.js

let __cid_manager_cache = [];

async function inicializarCidManager() {
    await carregarFamiliasCid();
}

async function carregarFamiliasCid() {
    const tbody = document.getElementById('tabela-cid-familias');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const snap = await db.collection('cid_familias').orderBy('range_inicio').get();
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhuma família de CID cadastrada.</td></tr>';
            __cid_manager_cache = [];
            return;
        }
        
        __cid_manager_cache = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        renderizarTabelaCid(__cid_manager_cache);

    } catch (e) {
        console.error("Erro ao carregar famílias de CID:", e);
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function renderizarTabelaCid(lista) {
    const tbody = document.getElementById('tabela-cid-familias');
    if (!tbody) return;
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(cid => {
        return `
            <tr>
                <td><strong>${cid.range_inicio} - ${cid.range_fim}</strong></td>
                <td>${cid.descricao}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirModalFamiliaCid('${cid.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirFamiliaCid('${cid.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarFamiliasCid() {
    const termo = document.getElementById('filtro-cid-intervalo').value.toUpperCase();
    const filtrados = __cid_manager_cache.filter(cid => cid.range_inicio.includes(termo) || cid.range_fim.includes(termo) || cid.descricao.toUpperCase().includes(termo));
    renderizarTabelaCid(filtrados);
}

async function abrirModalFamiliaCid(id = null) {
    const modalId = 'familiaCidModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="familiaCidModalTitle">Nova Família de CID</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-familia-cid">
                            <input type="hidden" id="familia-cid-id">
                            <div class="row">
                                <div class="col-6 mb-3"><label class="form-label">Início do Intervalo</label><input type="text" class="form-control" id="cid-range-inicio" placeholder="Ex: A00" required></div>
                                <div class="col-6 mb-3"><label class="form-label">Fim do Intervalo</label><input type="text" class="form-control" id="cid-range-fim" placeholder="Ex: B99" required></div>
                            </div>
                            <div class="mb-3"><label class="form-label">Descrição da Família</label><textarea class="form-control" id="cid-descricao" rows="3" required></textarea></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarFamiliaCid()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('form-familia-cid').reset();
    document.getElementById('familia-cid-id').value = id || '';
    document.getElementById('familiaCidModalTitle').textContent = id ? 'Editar Família de CID' : 'Nova Família de CID';

    if (id) {
        const doc = await db.collection('cid_familias').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('cid-range-inicio').value = data.range_inicio;
            document.getElementById('cid-range-fim').value = data.range_fim;
            document.getElementById('cid-descricao').value = data.descricao;
        }
    }

    new bootstrap.Modal(modalEl).show();
}

async function salvarFamiliaCid() {
    const id = document.getElementById('familia-cid-id').value;
    const dados = {
        range_inicio: document.getElementById('cid-range-inicio').value.trim().toUpperCase(),
        range_fim: document.getElementById('cid-range-fim').value.trim().toUpperCase(),
        descricao: document.getElementById('cid-descricao').value.trim()
    };

    if (!dados.range_inicio || !dados.range_fim || !dados.descricao) {
        mostrarMensagem("Todos os campos são obrigatórios.", "warning");
        return;
    }

    try {
        if (id) {
            await db.collection('cid_familias').doc(id).update(dados);
        } else {
            await db.collection('cid_familias').add(dados);
        }
        mostrarMensagem("Família de CID salva com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('familiaCidModal')).hide();
        await carregarFamiliasCid();
        // Se houver cache global em outros módulos, idealmente invalidá-lo aqui
    } catch (e) {
        console.error("Erro ao salvar família de CID:", e);
        mostrarMensagem("Erro ao salvar.", "error");
    }
}

async function excluirFamiliaCid(id) {
    if (!confirm("Tem certeza que deseja excluir esta família de CID?")) return;
    try {
        await db.collection('cid_familias').doc(id).delete();
        mostrarMensagem("Família de CID excluída.", "success");
        await carregarFamiliasCid();
    } catch (e) {
        console.error("Erro ao excluir:", e);
    }
}

// Exportar para o escopo global
window.inicializarCidManager = inicializarCidManager;
window.abrirModalFamiliaCid = abrirModalFamiliaCid;
window.salvarFamiliaCid = salvarFamiliaCid;
window.excluirFamiliaCid = excluirFamiliaCid;
window.filtrarFamiliasCid = filtrarFamiliasCid;