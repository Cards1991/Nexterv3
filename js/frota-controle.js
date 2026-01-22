// ========================================
// Módulo: Controle de Frotas
// ========================================

// Funções auxiliares
function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
}

function mostrarMensagem(mensagem, tipo = "info") {
    // Implementação básica - você pode integrar com seu sistema de notificações
    alert(`${tipo.toUpperCase()}: ${mensagem}`);
}

async function inicializarControleFrota(secao) {
    switch (secao) {
        case 'frota-dashboard':
            await carregarDashboardFrota();
            await popularFiltroVeiculosDashboard();
            break;
        case 'frota-veiculos':
            await carregarVeiculos();
            break;
        case 'frota-motoristas':
            await carregarMotoristas();
            break;
        case 'frota-utilizacao':
            await carregarUtilizacoes();
            break;
    }
}

// --- SEÇÃO DE VEÍCULOS ---

async function carregarVeiculos() {
    const tbody = document.getElementById('tabela-frota-veiculos');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    try {
        const snapshot = await db.collection('veiculos').orderBy('marca').get();
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum veículo cadastrado.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const v = doc.data();
            const statusClass = v.status === 'Ativo' ? 'bg-success' : (v.status === 'Em Uso' ? 'bg-warning' : 'bg-secondary');
            tbody.innerHTML += `
                <tr>
                    <td>${v.placa || '-'}</td>
                    <td>${v.modelo || ''} / ${v.marca || ''}</td>
                    <td>${v.ano || '-'}</td>
                    <td>${v.quilometragemAtual || 0} km</td>
                    <td>${v.setor || '-'}</td>
                    <td><span class="badge ${statusClass}">${v.status || 'Desconhecido'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalVeiculo('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirVeiculo('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error("Erro ao carregar veículos:", e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar veículos.</td></tr>';
    }
}

async function abrirModalVeiculo(id = null) {
    const modalElement = document.getElementById('frotaVeiculoModal');
    if (!modalElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('form-frota-veiculo');
    if (form) form.reset();
    
    document.getElementById('frota-veiculo-id').value = id || '';

    if (id) {
        document.getElementById('frotaVeiculoModalTitle').textContent = 'Editar Veículo';
        try {
            const doc = await db.collection('veiculos').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('frota-veiculo-placa').value = data.placa || '';
                document.getElementById('frota-veiculo-ano').value = data.ano || '';
                document.getElementById('frota-veiculo-marca').value = data.marca || '';
                document.getElementById('frota-veiculo-modelo').value = data.modelo || '';
                document.getElementById('frota-veiculo-km').value = data.quilometragemAtual || 0;
                document.getElementById('frota-veiculo-venc-doc').value = data.vencimentoDocumento || '';
                document.getElementById('frota-veiculo-setor').value = data.setor || '';
                document.getElementById('frota-veiculo-status').value = data.status || 'Ativo';
            }
        } catch (e) {
            console.error("Erro ao carregar veículo:", e);
            mostrarMensagem("Erro ao carregar dados do veículo.", "error");
        }
    } else {
        document.getElementById('frotaVeiculoModalTitle').textContent = 'Novo Veículo';
    }
    modal.show();
}

async function salvarVeiculo() {
    const id = document.getElementById('frota-veiculo-id').value;
    const dados = {
        placa: document.getElementById('frota-veiculo-placa').value.toUpperCase(),
        ano: parseInt(document.getElementById('frota-veiculo-ano').value) || 0,
        marca: document.getElementById('frota-veiculo-marca').value,
        modelo: document.getElementById('frota-veiculo-modelo').value,
        quilometragemAtual: parseInt(document.getElementById('frota-veiculo-km').value) || 0,
        vencimentoDocumento: document.getElementById('frota-veiculo-venc-doc').value,
        setor: document.getElementById('frota-veiculo-setor').value,
        status: document.getElementById('frota-veiculo-status').value,
    };

    if (!dados.placa || !dados.marca || !dados.modelo) {
        return mostrarMensagem("Placa, Marca e Modelo são obrigatórios.", "warning");
    }

    try {
        if (id) {
            await db.collection('veiculos').doc(id).update(dados);
            mostrarMensagem("Veículo atualizado com sucesso!", "success");
        } else {
            await db.collection('veiculos').add(dados);
            mostrarMensagem("Veículo cadastrado com sucesso!", "success");
        }
        const modal = bootstrap.Modal.getInstance(document.getElementById('frotaVeiculoModal'));
        if (modal) modal.hide();
        await carregarVeiculos();
    } catch (e) {
        console.error("Erro ao salvar veículo:", e);
        mostrarMensagem("Erro ao salvar veículo.", "error");
    }
}

async function excluirVeiculo(id) {
    if (!confirm("Tem certeza que deseja excluir este veículo?")) return;
    try {
        await db.collection('veiculos').doc(id).delete();
        mostrarMensagem("Veículo excluído.", "success");
        await carregarVeiculos();
    } catch (e) {
        console.error("Erro ao excluir veículo:", e);
        mostrarMensagem("Erro ao excluir veículo.", "error");
    }
}

// --- SEÇÃO DE MOTORISTAS ---

async function carregarMotoristas() {
    const tbody = document.getElementById('tabela-frota-motoristas');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    try {
        const snapshot = await db.collection('motoristas').orderBy('nome').get();
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum motorista cadastrado.</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const m = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${m.nome || '-'}</td>
                    <td>${m.cpf || '-'}</td>
                    <td>${m.cnh || '-'}</td>
                    <td>${m.validadeCNH ? formatarData(m.validadeCNH) : '-'}</td>
                    <td>${m.setor || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalMotorista('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirMotorista('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error("Erro ao carregar motoristas:", e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar motoristas.</td></tr>';
    }
}

async function abrirModalMotorista(id = null) {
    const modalElement = document.getElementById('frotaMotoristaModal');
    if (!modalElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('form-frota-motorista');
    if (form) form.reset();
    
    document.getElementById('frota-motorista-id').value = id || '';

    if (id) {
        document.getElementById('frotaMotoristaModalTitle').textContent = 'Editar Motorista';
        try {
            const doc = await db.collection('motoristas').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('frota-motorista-nome').value = data.nome || '';
                document.getElementById('frota-motorista-cpf').value = data.cpf || '';
                document.getElementById('frota-motorista-cnh').value = data.cnh || '';
                document.getElementById('frota-motorista-validade').value = data.validadeCNH || '';
                document.getElementById('frota-motorista-setor').value = data.setor || '';
            }
        } catch (e) {
            console.error("Erro ao carregar motorista:", e);
            mostrarMensagem("Erro ao carregar dados do motorista.", "error");
        }
    } else {
        document.getElementById('frotaMotoristaModalTitle').textContent = 'Novo Motorista';
    }
    modal.show();
}

async function salvarMotorista() {
    const id = document.getElementById('frota-motorista-id').value;
    const dados = {
        nome: document.getElementById('frota-motorista-nome').value,
        cpf: document.getElementById('frota-motorista-cpf').value,
        cnh: document.getElementById('frota-motorista-cnh').value,
        validadeCNH: document.getElementById('frota-motorista-validade').value,
        setor: document.getElementById('frota-motorista-setor').value,
    };

    if (!dados.nome || !dados.cpf || !dados.cnh || !dados.validadeCNH) {
        return mostrarMensagem("Todos os campos são obrigatórios.", "warning");
    }

    try {
        if (id) {
            await db.collection('motoristas').doc(id).update(dados);
            mostrarMensagem("Motorista atualizado com sucesso!", "success");
        } else {
            await db.collection('motoristas').add(dados);
            mostrarMensagem("Motorista cadastrado com sucesso!", "success");
        }
        const modal = bootstrap.Modal.getInstance(document.getElementById('frotaMotoristaModal'));
        if (modal) modal.hide();
        await carregarMotoristas();
    } catch (e) {
        console.error("Erro ao salvar motorista:", e);
        mostrarMensagem("Erro ao salvar motorista.", "error");
    }
}

async function excluirMotorista(id) {
    if (!confirm("Tem certeza que deseja excluir este motorista?")) return;
    try {
        await db.collection('motoristas').doc(id).delete();
        mostrarMensagem("Motorista excluído.", "success");
        await carregarMotoristas();
    } catch (e) {
        console.error("Erro ao excluir motorista:", e);
        mostrarMensagem("Erro ao excluir motorista.", "error");
    }
}

// --- SEÇÃO DE UTILIZAÇÃO ---

async function carregarUtilizacoes() {
    const emUsoTbody = document.getElementById('tabela-frota-em-uso');
    const historicoTbody = document.getElementById('tabela-frota-historico');
    
    if (!emUsoTbody || !historicoTbody) return;
    
    emUsoTbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';
    historicoTbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const snapshot = await db.collection('utilizacoes').orderBy('dataSaida', 'desc').get();
        emUsoTbody.innerHTML = '';
        historicoTbody.innerHTML = '';
        let emUsoCount = 0;

        for (const doc of snapshot.docs) {
            const uso = doc.data();
            const veiculoDoc = await db.collection('veiculos').doc(uso.veiculoId).get();
            const motoristaDoc = await db.collection('motoristas').doc(uso.motoristaId).get();
            const veiculo = veiculoDoc.exists ? veiculoDoc.data() : { placa: 'N/A', modelo: 'N/A' };
            const motorista = motoristaDoc.exists ? motoristaDoc.data() : { nome: 'N/A' };

            if (!uso.dataRetorno) { // Em uso
                emUsoCount++;
                emUsoTbody.innerHTML += `
                    <tr>
                        <td>${veiculo.placa} - ${veiculo.modelo}</td>
                        <td>${motorista.nome}</td>
                        <td>${uso.dataSaida ? formatarData(uso.dataSaida.toDate()) : '-'} ${uso.horaSaida || ''}</td>
                        <td>${uso.destino || '-'}</td>
                        <td class="text-end">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-secondary" title="Imprimir Comprovante de Saída" onclick="imprimirComprovanteSaida('${doc.id}')"><i class="fas fa-print"></i></button>
                                <button class="btn btn-info" onclick="abrirModalRetorno('${doc.id}')">Registrar Retorno</button>
                            </div>
                        </td>
                    </tr>`;
            } else { // Histórico
                historicoTbody.innerHTML += `
                    <tr>
                        <td>${veiculo.placa} - ${veiculo.modelo}</td>
                        <td>${motorista.nome}</td>
                        <td>${uso.dataSaida ? formatarData(uso.dataSaida.toDate()) : '-'} ${uso.horaSaida || ''}</td>
                        <td>${uso.dataRetorno ? formatarData(uso.dataRetorno.toDate()) : '-'} ${uso.horaRetorno || ''}</td>
                        <td>${uso.kmPercorrido || 0} km</td>
                        <td>${uso.destino || '-'}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-secondary" title="Imprimir Relatório de Viagem" onclick="imprimirComprovanteSaida('${doc.id}')"><i class="fas fa-print"></i></button>
                        </td>
                    </tr>`;
            }
        }
        
        if (emUsoCount === 0) {
            emUsoTbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum veículo em uso no momento.</td></tr>';
        }
        
        if (snapshot.empty) {
            historicoTbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma utilização registrada.</td></tr>';
        }
    } catch (e) {
        console.error("Erro ao carregar utilizações:", e);
        emUsoTbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
        historicoTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function abrirModalSaida() {
    const modalElement = document.getElementById('frotaSaidaModal');
    if (!modalElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('form-frota-saida');
    if (form) form.reset();

    const veiculoSelect = document.getElementById('frota-saida-veiculo');
    const motoristaSelect = document.getElementById('frota-saida-motorista');
    
    if (!veiculoSelect || !motoristaSelect) return;
    
    veiculoSelect.innerHTML = '<option value="">Carregando...</option>';
    motoristaSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        const [veiculosSnap, motoristasSnap] = await Promise.all([
            db.collection('veiculos').where('status', '==', 'Ativo').get(),
            db.collection('motoristas').orderBy('nome').get()
        ]);

        veiculoSelect.innerHTML = '<option value="">Selecione um veículo</option>';
        veiculosSnap.forEach(doc => {
            const v = doc.data();
            veiculoSelect.innerHTML += `<option value="${doc.id}" data-km="${v.quilometragemAtual || 0}">${v.placa} - ${v.modelo}</option>`;
        });

        motoristaSelect.innerHTML = '<option value="">Selecione um motorista</option>';
        motoristasSnap.forEach(doc => {
            motoristaSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });

        veiculoSelect.onchange = () => {
            const selectedOption = veiculoSelect.options[veiculoSelect.selectedIndex];
            document.getElementById('frota-saida-km-inicial').value = selectedOption.dataset.km || 0;
        };

        document.getElementById('frota-saida-data').valueAsDate = new Date();
        document.getElementById('frota-saida-hora').value = new Date().toTimeString().slice(0, 5);

        modal.show();
    } catch (e) {
        console.error("Erro ao carregar dados para saída:", e);
        mostrarMensagem("Erro ao carregar dados.", "error");
    }
}

async function registrarSaida() {
    const dados = {
        veiculoId: document.getElementById('frota-saida-veiculo').value,
        motoristaId: document.getElementById('frota-saida-motorista').value,
        dataSaida: new Date(document.getElementById('frota-saida-data').value.replace(/-/g, '/')),
        horaSaida: document.getElementById('frota-saida-hora').value,
        kmInicial: parseInt(document.getElementById('frota-saida-km-inicial').value) || 0,
        destino: document.getElementById('frota-saida-destino').value,
        motivo: document.getElementById('frota-saida-motivo').value,
        dataRetorno: null,
    };

    if (!dados.veiculoId || !dados.motoristaId || !dados.destino) {
        return mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
    }

    try {
        await db.collection('utilizacoes').add(dados);
        await db.collection('veiculos').doc(dados.veiculoId).update({ status: 'Em Uso' });
        mostrarMensagem("Saída registrada com sucesso!", "success");
        const modal = bootstrap.Modal.getInstance(document.getElementById('frotaSaidaModal'));
        if (modal) modal.hide();
        await carregarUtilizacoes();
    } catch (e) {
        console.error("Erro ao registrar saída:", e);
        mostrarMensagem("Erro ao registrar saída.", "error");
    }
}

async function abrirModalRetorno(utilizacaoId) {
    const modalElement = document.getElementById('frotaRetornoModal');
    if (!modalElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    
    try {
        const doc = await db.collection('utilizacoes').doc(utilizacaoId).get();
        if (!doc.exists) {
            mostrarMensagem("Registro de utilização não encontrado.", "error");
            return;
        }

        const uso = doc.data();
        const veiculoDoc = await db.collection('veiculos').doc(uso.veiculoId).get();
        const motoristaDoc = await db.collection('motoristas').doc(uso.motoristaId).get();

        document.getElementById('frota-retorno-utilizacao-id').value = utilizacaoId;
        document.getElementById('frota-retorno-veiculo-id').value = uso.veiculoId;
        document.getElementById('frota-retorno-km-inicial').value = uso.kmInicial || 0;
        document.getElementById('frota-retorno-veiculo-info').textContent = veiculoDoc.exists ? 
            `${veiculoDoc.data().placa} - ${veiculoDoc.data().modelo}` : 'Veículo não encontrado';
        document.getElementById('frota-retorno-motorista-info').textContent = motoristaDoc.exists ? 
            motoristaDoc.data().nome : 'Motorista não encontrado';

        document.getElementById('frota-retorno-data').valueAsDate = new Date();
        document.getElementById('frota-retorno-hora').value = new Date().toTimeString().slice(0, 5);

        modal.show();
    } catch (e) {
        console.error("Erro ao abrir modal de retorno:", e);
        mostrarMensagem("Erro ao carregar dados para retorno.", "error");
    }
}

async function registrarRetorno() {
    const utilizacaoId = document.getElementById('frota-retorno-utilizacao-id').value;
    const veiculoId = document.getElementById('frota-retorno-veiculo-id').value;
    const kmInicial = parseInt(document.getElementById('frota-retorno-km-inicial').value) || 0;
    const kmFinal = parseInt(document.getElementById('frota-retorno-km-final').value) || 0;

    if (kmFinal < kmInicial) {
        return mostrarMensagem("A KM final não pode ser menor que a inicial.", "warning");
    }

    const dados = {
        dataRetorno: new Date(document.getElementById('frota-retorno-data').value.replace(/-/g, '/')),
        horaRetorno: document.getElementById('frota-retorno-hora').value,
        kmFinal: kmFinal,
        kmPercorrido: kmFinal - kmInicial,
    };

    try {
        const batch = db.batch();
        const utilizacaoRef = db.collection('utilizacoes').doc(utilizacaoId);
        batch.update(utilizacaoRef, dados);

        const veiculoRef = db.collection('veiculos').doc(veiculoId);
        batch.update(veiculoRef, { 
            status: 'Ativo', 
            quilometragemAtual: kmFinal 
        });

        await batch.commit();

        mostrarMensagem("Retorno registrado com sucesso!", "success");
        const modal = bootstrap.Modal.getInstance(document.getElementById('frotaRetornoModal'));
        if (modal) modal.hide();
        await carregarUtilizacoes();
    } catch (e) {
        console.error("Erro ao registrar retorno:", e);
        mostrarMensagem("Erro ao registrar retorno.", "error");
    }
}

// --- FUNÇÕES DE IMPRESSÃO ---

async function imprimirComprovanteSaida(utilizacaoId) {
    try {
        const utilizacaoDoc = await db.collection('utilizacoes').doc(utilizacaoId).get();
        if (!utilizacaoDoc.exists) {
            return mostrarMensagem("Registro de utilização não encontrado.", "error");
        }
        const uso = utilizacaoDoc.data();

        const [veiculoDoc, motoristaDoc] = await Promise.all([
            db.collection('veiculos').doc(uso.veiculoId).get(),
            db.collection('motoristas').doc(uso.motoristaId).get()
        ]);

        const veiculo = veiculoDoc.exists ? veiculoDoc.data() : {};
        const motorista = motoristaDoc.exists ? motoristaDoc.data() : {};

        const dataSaida = uso.dataSaida ? uso.dataSaida.toDate().toLocaleDateString('pt-BR') : 'N/A';
        const dataRetorno = uso.dataRetorno ? uso.dataRetorno.toDate().toLocaleDateString('pt-BR') : 'Pendente';

        const conteudo = `
            <html>
                <head>
                    <title>Comprovante de Utilização de Veículo</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        @page { size: A5 landscape; margin: 1cm; }
                        body { font-family: 'Segoe UI', sans-serif; }
                        .comprovante-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                        .field-label { font-weight: bold; color: #555; }
                        .assinatura { margin-top: 60px; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="comprovante-header">
                        <h4>Comprovante de Utilização de Veículo</h4>
                    </div>
                    <div class="row">
                        <div class="col-6 mb-3"><span class="field-label">Motorista:</span> ${motorista.nome || 'N/A'}</div>
                        <div class="col-6 mb-3"><span class="field-label">Veículo:</span> ${veiculo.placa} - ${veiculo.modelo}</div>
                        <div class="col-6 mb-3"><span class="field-label">Data/Hora Saída:</span> ${dataSaida} às ${uso.horaSaida || ''}</div>
                        <div class="col-6 mb-3"><span class="field-label">KM Inicial:</span> ${uso.kmInicial || 0} km</div>
                        <div class="col-12 mb-3"><span class="field-label">Destino:</span> ${uso.destino || 'N/A'}</div>
                        <hr>
                        <div class="col-6 mb-3"><span class="field-label">Data/Hora Retorno:</span> ${dataRetorno} às ${uso.horaRetorno || ''}</div>
                        <div class="col-6 mb-3"><span class="field-label">KM Final:</span> ${uso.kmFinal || 'Pendente'} km</div>
                        <div class="col-12 mb-3"><span class="field-label">KM Percorrido:</span> ${uso.kmPercorrido || 'Pendente'} km</div>
                    </div>
                    <div class="assinatura">
                        <p>_________________________________________</p>
                        <p>${motorista.nome || 'Assinatura do Motorista'}</p>
                    </div>
                </body>
            </html>
        `;

        openPrintWindow(conteudo, { autoPrint: true });

    } catch (e) {
        console.error("Erro ao gerar comprovante:", e);
        mostrarMensagem("Erro ao gerar comprovante.", "error");
    }
}

// --- FUNÇÕES DE FILTRO DO DASHBOARD ---

async function popularFiltroVeiculosDashboard() {
    const select = document.getElementById('frota-dashboard-filtro-veiculo');
    if (!select) return;

    select.innerHTML = '<option value="">Todos os Veículos</option>';
    try {
        const veiculosSnap = await db.collection('veiculos').orderBy('placa').get();
        veiculosSnap.forEach(doc => {
            const v = doc.data();
            select.innerHTML += `<option value="${doc.id}">${v.placa} - ${v.modelo}</option>`;
        });
    } catch (e) {
        console.error("Erro ao popular filtro de veículos:", e);
    }
}

function aplicarFiltroDashboardFrota() {
    const veiculoId = document.getElementById('frota-dashboard-filtro-veiculo').value;
    carregarDashboardFrota(veiculoId);
}

// --- SEÇÃO DE ABASTECIMENTO ---

async function abrirModalAbastecimento() {
    const modalElement = document.getElementById('frotaAbastecimentoModal');
    if (!modalElement) return;

    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('form-frota-abastecimento');
    if (form) form.reset();

    const veiculoSelect = document.getElementById('frota-abastecimento-veiculo');
    veiculoSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        const veiculosSnap = await db.collection('veiculos').orderBy('placa').get();
        veiculoSelect.innerHTML = '<option value="">Selecione um veículo</option>';
        veiculosSnap.forEach(doc => {
            const v = doc.data();
            veiculoSelect.innerHTML += `<option value="${doc.id}" data-km="${v.quilometragemAtual || 0}">${v.placa} - ${v.modelo}</option>`;
        });

        // Preenche o KM automaticamente ao selecionar o veículo
        veiculoSelect.onchange = () => {
            const selectedOption = veiculoSelect.options[veiculoSelect.selectedIndex];
            document.getElementById('frota-abastecimento-km').value = selectedOption.dataset.km || 0;
        };

        // Lógica para cálculo automático no modal
        const litrosInput = document.getElementById('frota-abastecimento-litros');
        const valorLitroInput = document.getElementById('frota-abastecimento-valor-litro');
        const valorTotalInput = document.getElementById('frota-abastecimento-valor-total');

        const calcularTotal = () => {
            const litros = parseFloat(litrosInput.value) || 0;
            const valorLitro = parseFloat(valorLitroInput.value) || 0;
            if (litros > 0 && valorLitro > 0) {
                valorTotalInput.value = (litros * valorLitro).toFixed(2);
            }
        };

        litrosInput.addEventListener('input', calcularTotal);
        valorLitroInput.addEventListener('input', calcularTotal);

        document.getElementById('frota-abastecimento-data').valueAsDate = new Date();
        modal.show();

    } catch (e) {
        console.error("Erro ao abrir modal de abastecimento:", e);
        mostrarMensagem("Erro ao carregar dados para abastecimento.", "error");
    }
}

async function salvarAbastecimento() {
    const dados = {
        veiculoId: document.getElementById('frota-abastecimento-veiculo').value,
        data: new Date(document.getElementById('frota-abastecimento-data').value.replace(/-/g, '/')),
        kmNoAbastecimento: parseInt(document.getElementById('frota-abastecimento-km').value) || 0,
        litros: parseFloat(document.getElementById('frota-abastecimento-litros').value) || 0,
        valorPorLitro: parseFloat(document.getElementById('frota-abastecimento-valor-litro').value) || 0,
        valorTotal: parseFloat(document.getElementById('frota-abastecimento-valor-total').value) || 0,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.veiculoId || !dados.data || dados.kmNoAbastecimento <= 0 || dados.valorTotal <= 0) {
        return mostrarMensagem("Preencha todos os campos obrigatórios corretamente.", "warning");
    }

    try {
        await db.collection('abastecimentos').add(dados);
        
        // Atualiza a quilometragem do veículo se a do abastecimento for maior
        const veiculoRef = db.collection('veiculos').doc(dados.veiculoId);
        const veiculoDoc = await veiculoRef.get();
        if (veiculoDoc.exists && dados.kmNoAbastecimento > (veiculoDoc.data().quilometragemAtual || 0)) {
            await veiculoRef.update({ quilometragemAtual: dados.kmNoAbastecimento });
        }

        mostrarMensagem("Abastecimento registrado com sucesso!", "success");
        const modal = bootstrap.Modal.getInstance(document.getElementById('frotaAbastecimentoModal'));
        if (modal) modal.hide();
        await carregarDashboardFrota(); // Atualiza o dashboard

    } catch (e) {
        console.error("Erro ao salvar abastecimento:", e);
        mostrarMensagem("Erro ao salvar abastecimento.", "error");
    }
}

// --- SEÇÃO DE DASHBOARD ---

async function carregarDashboardFrota(veiculoId = null) {
    try {
        const [veiculosSnap, motoristasSnap, utilizacoesSnap] = await Promise.all([
            db.collection('veiculos').get(),
            db.collection('motoristas').get(),
            db.collection('utilizacoes').where('dataRetorno', '==', null).get()
        ]);

        let ativosCount = 0;
        let emUsoCount = 0;
        let inativosCount = 0;

        veiculosSnap.forEach(doc => {
            const status = doc.data().status;
            if (status === 'Ativo') ativosCount++;
            else if (status === 'Em Uso') emUsoCount++;
            else inativosCount++;
        });

        // Atualizar os elementos HTML com os dados
        const totalVeiculosElement = document.getElementById('frota-total-veiculos');
        const veiculosAtivosElement = document.getElementById('frota-veiculos-ativos');
        const veiculosEmUsoElement = document.getElementById('frota-veiculos-em-uso');
        const totalMotoristasElement = document.getElementById('frota-total-motoristas');
        const viagensAtivasElement = document.getElementById('frota-viagens-ativas');

        if (totalVeiculosElement) totalVeiculosElement.textContent = veiculosSnap.size;
        if (veiculosAtivosElement) veiculosAtivosElement.textContent = ativosCount;
        if (veiculosEmUsoElement) veiculosEmUsoElement.textContent = emUsoCount;
        if (totalMotoristasElement) totalMotoristasElement.textContent = motoristasSnap.size;
        if (viagensAtivasElement) viagensAtivasElement.textContent = utilizacoesSnap.size;

        // --- NOVOS CÁLCULOS DE CONSUMO ---
        const hoje = new Date();
        const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioSeisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);

        let abastecimentosQuery = db.collection('abastecimentos').where('data', '>=', inicioSeisMesesAtras);
        let utilizacoesQuery = db.collection('utilizacoes').where('dataRetorno', '>=', inicioSeisMesesAtras);

        if (veiculoId) {
            abastecimentosQuery = abastecimentosQuery.where('veiculoId', '==', veiculoId);
            utilizacoesQuery = utilizacoesQuery.where('veiculoId', '==', veiculoId);
        }

        // Pega todos os abastecimentos e viagens dos últimos 6 meses para os cálculos
        const [abastecimentosSnap, viagensConcluidasSnap] = await Promise.all([abastecimentosQuery.get(), utilizacoesQuery.get()]);

        const abastecimentos = abastecimentosSnap.docs.map(doc => doc.data());
        const viagens = viagensConcluidasSnap.docs.map(doc => doc.data());

        // Cálculo do Consumo Médio (KM/L)
        const totalLitros = abastecimentos.reduce((acc, curr) => acc + curr.litros, 0);
        const totalKmPercorrido = viagens.reduce((acc, curr) => acc + (curr.kmPercorrido || 0), 0);
        const consumoMedio = (totalLitros > 0 && totalKmPercorrido > 0) ? (totalKmPercorrido / totalLitros) : 0;
        document.getElementById('frota-consumo-medio').textContent = consumoMedio.toFixed(2);

        // Cálculo do Custo por KM
        const gastoTotal = abastecimentos.reduce((acc, curr) => acc + curr.valorTotal, 0);
        const custoKm = (gastoTotal > 0 && totalKmPercorrido > 0) ? (gastoTotal / totalKmPercorrido) : 0;
        document.getElementById('frota-custo-km').textContent = `R$ ${custoKm.toFixed(2)}`;

        // Cálculo do Gasto no Mês Atual
        const gastoMesAtual = abastecimentos
            .filter(a => a.data.toDate() >= inicioMesAtual)
            .reduce((acc, curr) => acc + curr.valorTotal, 0);
        document.getElementById('frota-gasto-mes').textContent = `R$ ${gastoMesAtual.toFixed(2)}`;

        // Preparar dados para o gráfico
        const gastosPorMes = {};
        for (let i = 0; i < 6; i++) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            gastosPorMes[chave] = 0;
        }

        abastecimentos.forEach(a => {
            const data = a.data.toDate();
            const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            if (gastosPorMes.hasOwnProperty(chave)) {
                gastosPorMes[chave] += a.valorTotal;
            }
        });

        const labelsGrafico = Object.keys(gastosPorMes).sort();
        const dataGrafico = labelsGrafico.map(chave => gastosPorMes[chave]);

        renderizarGraficoGastos(labelsGrafico, dataGrafico);

    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
        mostrarMensagem("Erro ao carregar dados do dashboard.", "error");
    }
}

let graficoGastosInstance = null;
function renderizarGraficoGastos(labels, data) {
    const ctx = document.getElementById('frota-grafico-gastos')?.getContext('2d');
    if (!ctx) return;

    if (graficoGastosInstance) {
        graficoGastosInstance.destroy();
    }

    graficoGastosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto com Combustível (R$)',
                data: data,
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => `R$ ${value}` } }
            },
            plugins: { legend: { display: false } }
        }
    });
}