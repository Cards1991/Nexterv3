// NEW Dashboard for ISO Maquinas
async function renderizarDashboardMaquinas() {
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
                                <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Total Máquinas</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${total}</div>
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
                                <div class="text-xs font-weight-bold text-danger text-uppercase mb-1">Críticas</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${criticas}</div>
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
                                <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">Sem Gerente</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${semGerente}</div>
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
                                <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Chamados Abertos</div>
                                <div class="h5 mb-0 font-weight-bold text-gray-800">${chamadosAbertos}</div>
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
        console.error("Erro dashboard máquinas:", error);
        container.innerHTML = '<div class="col-12"><div class="alert alert-warning">Erro ao carregar dashboard</div></div>';
    }
}
