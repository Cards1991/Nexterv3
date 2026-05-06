// Gerenciamento do Cadastro de Máquinas - ISO 9001
// URL fixa para o ambiente de desenvolvimento/teste via DevTunnels.
// const URL_BASE_QRCODE = 'https://9whrmc68-5500.usw3.devtunnels.ms';
const URL_BASE_QRCODE = 'https://nexterv3.vercel.app';

// Variável global para a instância do Firestore
let __db = null;

// Função para inicializar com a instância do Firestore
function inicializarModuloMaquinas(dbInstance) {
    if (!dbInstance) {
        console.error("Firestore não foi fornecido para o módulo de máquinas");
        return;
    }
    __db = dbInstance;
    inicializarMaquinas();
}

async function inicializarMaquinas() {
    const currentUserPermissions = window.currentUserPermissions || {};
    if (!currentUserPermissions.isMecanicoAdmin) {
        mostrarMensagem("❌ Acesso restrito a gerentes de manutenção.", "warning");
        // Show button but disabled instead of remove
        const btnNova = document.getElementById('btn-nova-maquina');
        if (btnNova) {
            btnNova.style.display = 'block';
            btnNova.disabled = true;
            btnNova.title = 'Apenas gerentes podem adicionar máquinas';
        }
        return;
    }
    
    // ✅ Show button for admin
    const btnNova = document.getElementById('btn-nova-maquina');
    if (btnNova) {
        btnNova.style.display = 'block';
    }
    
    try {
        // Neste ponto, __db já deve estar inicializado por inicializarModuloMaquinas
        if (!__db) throw new Error("Firestore não disponível");

        // ✅ FIXED: Inline Inventory-style dashboard
        await renderizarDashboardMaquinasInline();

        await carregarMaquinas();
        const btnNovaCheck = document.getElementById('btn-nova-maquina');
        if (btnNovaCheck && !btnNovaCheck.__bound) {
            btnNovaCheck.addEventListener('click', () => abrirModalMaquina(null));
            btnNovaCheck.__bound = true;
        }
    } catch (e) {
        console.error("Erro ao inicializar cadastro de máquinas:", e);
        mostrarMensagem("Erro ao carregar o módulo de máquinas. Recarregue a página.", "error");
        
        // Desativar controles se não houver conexão
        const btnNovaCheck = document.getElementById('btn-nova-maquina');
        if (btnNovaCheck) btnNovaCheck.disabled = true;
    }
}

async function carregarMaquinas() {
    const tbody = document.getElementById('tabela-maquinas');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        // Verificar novamente a conexão
        if (!__db) {
            throw new Error("Conexão com o banco de dados não disponível");
        }

        const [maquinasSnap, empresasSnap] = await Promise.all([
            __db.collection('maquinas').orderBy('nome').get(),
            __db.collection('empresas').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));

        if (maquinasSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma máquina cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        maquinasSnap.forEach(doc => {
            const maquina = doc.data();
            const qrText = `${URL_BASE_QRCODE || window.location.origin}/manutencao-mobile.html?maquina=${encodeURIComponent(maquina.codigo)}`;

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
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar máquinas.<br>
                    <small>${error.message}</small>
                </td>
            </tr>
        `;
    }
}

async function abrirModalMaquina(maquinaId = null) {
    // Verificar conexão antes de abrir modal
    if (!__db) {
        mostrarMensagem("Conexão com o banco de dados não disponível", "error");
        return;
    }

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
                            
                            <hr>
                            <h6 class="mb-2 fw-bold text-secondary">Principais Motivos de Abertura (Até 5)</h6>
                            <div class="mb-2"><input type="text" class="form-control form-control-sm" id="maquina-motivo-1" placeholder="Motivo 1 (Ex: Falha no motor)"></div>
                            <div class="mb-2"><input type="text" class="form-control form-control-sm" id="maquina-motivo-2" placeholder="Motivo 2 (Ex: Vazamento de óleo)"></div>
                            <div class="mb-2"><input type="text" class="form-control form-control-sm" id="maquina-motivo-3" placeholder="Motivo 3 (Ex: Ruído estranho)"></div>
                            <div class="mb-2"><input type="text" class="form-control form-control-sm" id="maquina-motivo-4" placeholder="Motivo 4 (Ex: Parada repentina)"></div>
                            <div class="mb-3"><input type="text" class="form-control form-control-sm" id="maquina-motivo-5" placeholder="Motivo 5 (Ex: Peça quebrada)"></div>
                            <hr>

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
        try {
            const doc = await __db.collection('maquinas').doc(maquinaId).get();
            const data = doc.data();
            if (data) {
                document.getElementById('maquina-empresa').value = data.empresaId;
                await carregarSetoresPorEmpresa(data.empresaId, 'maquina-setor');
                document.getElementById('maquina-setor').value = data.setor;
                document.getElementById('maquina-codigo').value = data.codigo;
                document.getElementById('maquina-nome').value = data.nome;
                document.getElementById('maquina-patrimonio').value = data.patrimonio || '';
                document.getElementById('maquina-gerente').value = data.gerente || '';
                
                // Carregar motivos se existirem
                const motivos = data.motivos || [];
                document.getElementById('maquina-motivo-1').value = motivos[0] || '';
                document.getElementById('maquina-motivo-2').value = motivos[1] || '';
                document.getElementById('maquina-motivo-3').value = motivos[2] || '';
                document.getElementById('maquina-motivo-4').value = motivos[3] || '';
                document.getElementById('maquina-motivo-5').value = motivos[4] || '';
                
                document.getElementById('maquina-critica').checked = data.isCritica || false;
            }
        } catch (error) {
            console.error("Erro ao carregar dados da máquina:", error);
            mostrarMensagem("Erro ao carregar dados da máquina", "error");
        }
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

async function salvarMaquina() {
    // Verificar conexão
    if (!__db) {
        mostrarMensagem("Conexão com o banco de dados perdida", "error");
        return;
    }

    const maquinaId = document.getElementById('maquina-id').value;
    const motivos = [
        document.getElementById('maquina-motivo-1').value.trim(),
        document.getElementById('maquina-motivo-2').value.trim(),
        document.getElementById('maquina-motivo-3').value.trim(),
        document.getElementById('maquina-motivo-4').value.trim(),
        document.getElementById('maquina-motivo-5').value.trim()
    ].filter(m => m !== '');

    const dados = {
        empresaId: document.getElementById('maquina-empresa').value,
        setor: document.getElementById('maquina-setor').value,
        codigo: document.getElementById('maquina-codigo').value.trim().toUpperCase(),
        nome: document.getElementById('maquina-nome').value.trim(),
        patrimonio: document.getElementById('maquina-patrimonio').value.trim(),
        gerente: document.getElementById('maquina-gerente').value.trim(),
        motivos: motivos,
        isCritica: document.getElementById('maquina-critica').checked
    };

    if (!dados.empresaId || !dados.setor || !dados.codigo || !dados.nome) {
        mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
        return;
    }

    try {
        // Verificar se o código já existe (em caso de criação)
        if (!maquinaId) {
            const checkSnap = await __db.collection('maquinas').where('codigo', '==', dados.codigo).get();
            if (!checkSnap.empty) {
                mostrarMensagem("Este Código Identificador já está em uso.", "error");
                return;
            }
        }

        if (maquinaId) {
            await __db.collection('maquinas').doc(maquinaId).update(dados);
            mostrarMensagem("Máquina atualizada com sucesso!", "success");
        } else {
            await __db.collection('maquinas').add(dados);
            mostrarMensagem("Máquina cadastrada com sucesso!", "success");
        }

        bootstrap.Modal.getInstance(document.getElementById('maquinaModal')).hide();
        await carregarMaquinas();

    } catch (error) {
        console.error("Erro ao salvar máquina:", error);
        mostrarMensagem("Erro ao salvar os dados da máquina: " + error.message, "error");
    }
}

async function excluirMaquina(maquinaId) {
    // Verificar conexão
    if (!__db) {
        mostrarMensagem("Conexão com o banco de dados não disponível", "error");
        return;
    }

    if (!confirm("Tem certeza que deseja excluir esta máquina? Esta ação não pode ser desfeita.")) {
        return;
    }
    
    try {
        // Verificar se a máquina tem chamados abertos antes de excluir
        const chamadosSnap = await __db.collection('manutencao_chamados').where('maquinaId', '==', maquinaId).limit(1).get();
        if (!chamadosSnap.empty) {
            mostrarMensagem("Não é possível excluir. Esta máquina já possui chamados de manutenção registrados.", "error");
            return;
        }

        await __db.collection('maquinas').doc(maquinaId).delete();
        mostrarMensagem("Máquina excluída com sucesso.", "info");
        await carregarMaquinas();
    } catch (error) {
        console.error("Erro ao excluir máquina:", error);
        mostrarMensagem("Erro ao excluir a máquina: " + error.message, "error");
    }
}

// Funções auxiliares (precisam ser definidas ou ajustadas)
async function carregarSelectEmpresas(selectId) {
    if (!__db) return;
    
    const select = document.getElementById(selectId);
    if (!select) return;
    
    try {
        const empresasSnap = await __db.collection('empresas').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione uma empresa</option>';
        empresasSnap.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function carregarSetoresPorEmpresa(empresaId, selectId) {
    if (!__db || !empresaId) return;
    
    const select = document.getElementById(selectId);
    if (!select) return;
    
    try {
        const empresaDoc = await __db.collection('empresas').doc(empresaId).get();
        if (empresaDoc.exists) {
            const setores = empresaDoc.data().setores || [];
            select.innerHTML = '<option value="">Selecione um setor</option>';
            setores.forEach(setor => {
                select.innerHTML += `<option value="${setor}">${setor}</option>`;
            });
        }
    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function mostrarMensagem(mensagem, tipo = "info") {
    // Implementação da função de mensagens (igual à usada no outro arquivo)
    const toast = document.createElement('div');
    toast.className = `alert alert-${tipo} alert-toast position-fixed`;
    toast.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    let icon = '';
    switch(tipo) {
        case 'success': icon = '<i class="fas fa-check-circle"></i> '; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle"></i> '; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i> '; break;
        default: icon = '<i class="fas fa-info-circle"></i> '; break;
    }
    
    toast.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>${icon} ${mensagem}</div>
            <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// ✅ Added dashboard support
// ✅ INLINE Inventory Dashboard
async function renderizarDashboardMaquinasInline() {
    const container = document.getElementById('dashboard-maquinas-metricas');
    if (!container) return;

    try {
        const [totalSnap, criticasSnap, semGerenteSnap, chamadosSnap] = await Promise.all([
            __db.collection('maquinas').get(),
            __db.collection('maquinas').where('isCritica', '==', true).get(),
            __db.collection('maquinas').where('gerente', '==', null).get(),
            __db.collection('manutencao_chamados').where('status', 'in', ['Aberto', 'Em Andamento']).get()
        ]);

        const total = totalSnap.size;
        const criticas = criticasSnap.size;
        const semGerente = semGerenteSnap.size;
        const chamadosAbertos = chamadosSnap.size;

        container.innerHTML = `
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card border-left-primary shadow h-100 py-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Estoque Total</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${total}</div>
                                <div class="text-xs text-success font-weight-bold">Máquinas</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-cogs fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card border-left-danger shadow h-100 py-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-danger text-uppercase mb-1">Crítico</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${criticas}</div>
                                <div class="text-xs text-danger font-weight-bold">Prioridade alta</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-exclamation-triangle fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card border-left-warning shadow h-100 py-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">Sem Responsável</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${semGerente}</div>
                                <div class="text-xs text-warning font-weight-bold">Gerente pendente</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-user-slash fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="card border-left-info shadow h-100 py-2">
                    <div class="card-body">
                        <div class="row no-gutters align-items-center">
                            <div class="col mr-2">
                                <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Ordens Pendentes</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${chamadosAbertos}</div>
                                <div class="text-xs text-info font-weight-bold">Chamados ativos</div>
                            </div>
                            <div class="col-auto">
                                <i class="fas fa-tools fa-2x text-gray-300"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-warning">Carregando inventário...</div></div>';
    }
}

// Exportar funções para uso global
window.inicializarModuloMaquinas = inicializarModuloMaquinas;
window.abrirModalMaquina = abrirModalMaquina;
window.salvarMaquina = salvarMaquina;
window.excluirMaquina = excluirMaquina;
window.carregarMaquinas = carregarMaquinas;
window.renderizarDashboardMaquinasInline = renderizarDashboardMaquinasInline;
