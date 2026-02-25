// js/ocorrencias.js

// Variável global para armazenar a instância do modal
let modalOcorrencia;

// Expor função imediatamente para o escopo global (disponível antes mesmo do DOM ready)
window.abrirModalNovaOcorrencia = async function() {
    try {
        // Verificar se o modal existe
        const modalEl = document.getElementById('modalNovaOcorrencia');
        if (!modalEl) {
            console.error('Modal element not found: modalNovaOcorrencia');
            alert('Erro: Modal não encontrado. Por favor, recarregue a página.');
            return;
        }

        // Resetar formulário
        const form = document.getElementById('form-nova-ocorrencia');
        if (form) form.reset();
        
        const idInput = document.getElementById('ocorrencia-id');
        if (idInput) idInput.value = '';
        
        const containerVeiculo = document.getElementById('container-veiculo-pa');
        if (containerVeiculo) containerVeiculo.style.display = 'none';
        
        // Definir data/hora atual
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const dataInput = document.getElementById('ocorrencia-data');
        if (dataInput) dataInput.value = now.toISOString().slice(0, 16);

        // Carregar colaboradores
        const selectColaborador = document.getElementById('ocorrencia-colaborador');
        if (selectColaborador && typeof db !== 'undefined') {
            selectColaborador.innerHTML = '<option value="">Carregando...</option>';
            
            try {
                const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
                selectColaborador.innerHTML = '<option value="">Selecione...</option>';
                
                snapshot.forEach(doc => {
                    const func = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = func.nome;
                    option.dataset.empresaId = func.empresaId || '';
                    option.dataset.setor = func.setor || '';
                    selectColaborador.appendChild(option);
                });
            } catch (error) {
                console.error("Erro ao carregar colaboradores:", error);
                selectColaborador.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        }

        // Carregar veículos no select
        const selectVeiculo = document.getElementById('ocorrencia-veiculo');
        if (selectVeiculo) {
            const opcoesFixas = `
                <option value="">Selecione o veículo...</option>
                <option value="Particular">Veículo Particular</option>
                <option value="Uber/Taxi">Uber / Táxi</option>
                <option value="Ambulancia">Ambulância</option>
            `;
            selectVeiculo.innerHTML = opcoesFixas + '<option disabled>--- Frota da Empresa ---</option>';

            try {
                const veiculosSnap = await db.collection('veiculos').where('status', '==', 'Ativo').get();
                veiculosSnap.forEach(doc => {
                    const v = doc.data();
                    const option = document.createElement('option');
                    option.value = `${v.modelo} (${v.placa})`;
                    option.textContent = `${v.modelo} - ${v.placa}`;
                    selectVeiculo.appendChild(option);
                });
            } catch (e) {
                console.log("Erro ao carregar frota (pode não estar configurada):", e);
            }
        }

        // Verificar se bootstrap está disponível
        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap not loaded');
            alert('Erro: Bootstrap não está carregado. Por favor, recarregue a página.');
            return;
        }

        modalOcorrencia = new bootstrap.Modal(modalEl);
        modalOcorrencia.show();
    } catch (error) {
        console.error('Erro ao abrir modal de ocorrência:', error);
        alert('Erro ao abrir o modal: ' + error.message);
    }
};

async function inicializarOcorrencias() {
    console.log('Inicializando módulo de Ocorrências...');
    
    // Configurar datas padrão no filtro (mês atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    const filtroInicio = document.getElementById('filtro-ocorrencia-inicio');
    const filtroFim = document.getElementById('filtro-ocorrencia-fim');
    
    if (filtroInicio && !filtroInicio.value) filtroInicio.value = primeiroDia.toISOString().split('T')[0];
    if (filtroFim && !filtroFim.value) filtroFim.value = ultimoDia.toISOString().split('T')[0];

    await carregarOcorrencias();
    await carregarKPIsOcorrencias();
}

async function carregarOcorrencias() {
    const tbody = document.getElementById('tabela-ocorrencias');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const inicio = document.getElementById('filtro-ocorrencia-inicio').value;
        const fim = document.getElementById('filtro-ocorrencia-fim').value;
        const tipo = document.getElementById('filtro-ocorrencia-tipo').value;
        const nome = document.getElementById('filtro-ocorrencia-nome')?.value.toLowerCase().trim();

        let query = db.collection('ocorrencias_saude');

        if (inicio) query = query.where('data', '>=', new Date(inicio + 'T00:00:00'));
        if (fim) query = query.where('data', '<=', new Date(fim + 'T23:59:59'));
        
        const snapshot = await query.orderBy('data', 'desc').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma ocorrência encontrada no período.</td></tr>';
            return;
        }

        let encontrou = false;
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Filtro de tipo no cliente (caso não tenha índice composto)
            if (tipo && data.tipo !== tipo) return;
            // Filtro de nome no cliente
            if (nome && !data.colaboradorNome.toLowerCase().includes(nome)) return;

            encontrou = true;
            const dataFormatada = data.data ? new Date(data.data.toDate()).toLocaleString('pt-BR') : '-';
            const badgePA = data.encaminhadoPA ? '<span class="badge bg-danger">P.A.</span>' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${data.colaboradorNome}</td>
                <td><small>${data.empresaNome || ''}<br>${data.setor || ''}</small></td>
                <td><span class="badge bg-secondary">${data.tipo}</span> ${badgePA}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info" onclick="visualizarOcorrencia('${doc.id}')" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editarOcorrencia('${doc.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirOcorrencia('${doc.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (!encontrou) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma ocorrência encontrada com os filtros atuais.</td></tr>';
        }

    } catch (error) {
        console.error("Erro ao carregar ocorrências:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function editarOcorrencia(id) {
    try {
        const doc = await db.collection('ocorrencias_saude').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Ocorrência não encontrada.", "error");
            return;
        }
        const data = doc.data();

        // Abrir e preencher o modal
        await abrirModalNovaOcorrencia(); 

        document.getElementById('ocorrencia-id').value = id;
        document.getElementById('ocorrencia-data').value = new Date(data.data.toDate()).toISOString().slice(0, 16);
        document.getElementById('ocorrencia-tipo').value = data.tipo;
        
        // Aguardar o carregamento dos colaboradores e selecionar o correto
        const colaboradorSelect = document.getElementById('ocorrencia-colaborador');
        await aguardarCarregamentoSelect(colaboradorSelect);
        colaboradorSelect.value = data.colaboradorId;

        document.getElementById('ocorrencia-descricao').value = data.descricao;
        document.getElementById('ocorrencia-tratamento').value = data.tratamento;
        document.getElementById('ocorrencia-encaminhado-pa').checked = data.encaminhadoPA;
        
        toggleCampoVeiculo(); // Garante que o campo de veículo seja exibido se necessário
        
        if (data.encaminhadoPA) {
            const veiculoSelect = document.getElementById('ocorrencia-veiculo');
            await aguardarCarregamentoSelect(veiculoSelect, true); // Pode não ter opções de frota
            veiculoSelect.value = data.veiculo;
        }

        // Alterar o título do modal para "Editar Ocorrência"
        const modalTitle = document.querySelector('#modalNovaOcorrencia .modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Ocorrência';
        }


    } catch (error) {
        console.error("Erro ao preparar edição da ocorrência:", error);
        mostrarMensagem("Erro ao carregar dados para edição.", "error");
    }
}

// Função auxiliar para aguardar o carregamento de um select
function aguardarCarregamentoSelect(selectElement, allowEmpty = false) {
    return new Promise(resolve => {
        const checkOptions = () => {
            const isLoading = selectElement.innerHTML.includes('Carregando');
            const hasOptions = selectElement.options.length > 1; // Mais que "Selecione..." ou "Erro"
            
            if (!isLoading && (hasOptions || allowEmpty)) {
                resolve();
            } else {
                setTimeout(checkOptions, 100); // Tenta novamente em 100ms
            }
        };
        checkOptions();
    });
}


async function visualizarOcorrencia(id) {
    try {
        const doc = await db.collection('ocorrencias_saude').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Ocorrência não encontrada.", "error");
            return;
        }
        const data = doc.data();
        const dataFormatada = data.data ? new Date(data.data.toDate()).toLocaleString('pt-BR') : '-';
        const veiculoInfo = data.encaminhadoPA ? (data.veiculo || 'Não informado') : 'Não se aplica';
        const encaminhadoPA = data.encaminhadoPA ? 'Sim' : 'Não';

        const conteudo = `
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Data/Hora:</label>
                    <div>${dataFormatada}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Tipo:</label>
                    <div>${data.tipo}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Colaborador:</label>
                    <div>${data.colaboradorNome}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Empresa/Setor:</label>
                    <div>${data.empresaNome || '-'} / ${data.setor || '-'}</div>
                </div>
                <div class="col-12 mb-3">
                    <label class="fw-bold">Descrição:</label>
                    <div class="p-2 bg-light rounded border">${data.descricao}</div>
                </div>
                <div class="col-12 mb-3">
                    <label class="fw-bold">Tratamento:</label>
                    <div class="p-2 bg-light rounded border">${data.tratamento || 'Nenhum tratamento registrado.'}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Encaminhado ao P.A.?</label>
                    <div>${encaminhadoPA}</div>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="fw-bold">Veículo:</label>
                    <div>${veiculoInfo}</div>
                </div>
                <div class="col-12 text-end text-muted small">
                    Registrado por: ${data.registradoPor || 'Sistema'}
                </div>
            </div>
        `;

        if (typeof abrirModalGenerico === 'function') {
            abrirModalGenerico("Detalhes da Ocorrência", conteudo);
        } else {
            // Fallback se abrirModalGenerico não estiver disponível
            alert(`Detalhes:\n${data.descricao}\nTratamento: ${data.tratamento}`);
        }
    } catch (error) {
        console.error("Erro ao visualizar ocorrência:", error);
        mostrarMensagem("Erro ao carregar detalhes.", "error");
    }
}

function toggleCampoVeiculo() {
    const isPA = document.getElementById('ocorrencia-encaminhado-pa').checked;
    const containerVeiculo = document.getElementById('container-veiculo-pa');
    const campoVeiculo = document.getElementById('ocorrencia-veiculo');
    
    if (isPA) {
        containerVeiculo.style.display = 'block';
        campoVeiculo.setAttribute('required', 'required');
    } else {
        containerVeiculo.style.display = 'none';
        campoVeiculo.removeAttribute('required');
        campoVeiculo.value = '';
    }
}

async function salvarOcorrencia() {
    const form = document.getElementById('form-nova-ocorrencia');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btnSalvar = document.querySelector('#modalNovaOcorrencia .btn-primary');
    const textoOriginal = btnSalvar.textContent;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const id = document.getElementById('ocorrencia-id').value;
        const isUpdate = id !== '';

        const colaboradorSelect = document.getElementById('ocorrencia-colaborador');
        const colaboradorId = colaboradorSelect.value;
        const colaboradorNome = colaboradorSelect.options[colaboradorSelect.selectedIndex].text;
        const empresaId = colaboradorSelect.options[colaboradorSelect.selectedIndex].dataset.empresaId || '';
        const setor = colaboradorSelect.options[colaboradorSelect.selectedIndex].dataset.setor || '';
        
        let empresaNome = '';
        if (empresaId) {
            const empDoc = await db.collection('empresas').doc(empresaId).get();
            if (empDoc.exists) empresaNome = empDoc.data().nome;
        }

        const dados = {
            data: new Date(document.getElementById('ocorrencia-data').value),
            tipo: document.getElementById('ocorrencia-tipo').value,
            colaboradorId: colaboradorId,
            colaboradorNome: colaboradorNome,
            empresaId: empresaId,
            empresaNome: empresaNome,
            setor: setor,
            descricao: document.getElementById('ocorrencia-descricao').value,
            tratamento: document.getElementById('ocorrencia-tratamento').value,
            encaminhadoPA: document.getElementById('ocorrencia-encaminhado-pa').checked,
            veiculo: document.getElementById('ocorrencia-veiculo').value,
            // Mantém o autor original no update, ou define um novo no create
            registradoPor: isUpdate ? undefined : firebase.auth().currentUser.email,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (isUpdate) {
            // Remove campos que não devem ser sobrescritos na atualização
            Object.keys(dados).forEach(key => dados[key] === undefined && delete dados[key]);
            
            await db.collection('ocorrencias_saude').doc(id).update(dados);
            mostrarMensagem('Ocorrência atualizada com sucesso!', 'success');
        } else {
            dados.registradoPor = firebase.auth().currentUser.email;
            dados.registradoEm = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('ocorrencias_saude').add(dados);
            mostrarMensagem('Ocorrência registrada com sucesso!', 'success');
        }
        
        modalOcorrencia.hide();
        carregarOcorrencias();
        carregarKPIsOcorrencias();

    } catch (error) {
        console.error("Erro ao salvar ocorrência:", error);
        mostrarMensagem('Erro ao salvar: ' + error.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = textoOriginal;

        // Resetar o título do modal para o padrão
        const modalTitle = document.querySelector('#modalNovaOcorrencia .modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-exclamation-circle"></i> Nova Ocorrência';
        }
    }
}

async function excluirOcorrencia(id) {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
        try {
            await db.collection('ocorrencias_saude').doc(id).delete();
            mostrarMensagem('Registro excluído.', 'success');
            carregarOcorrencias();
            carregarKPIsOcorrencias();
        } catch (error) {
            console.error("Erro ao excluir:", error);
            mostrarMensagem('Erro ao excluir.', 'error');
        }
    }
}

function filtrarOcorrencias() {
    carregarOcorrencias();
}

async function carregarKPIsOcorrencias() {
    try {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        
        const snapshotTotal = await db.collection('ocorrencias_saude').get();
        const total = snapshotTotal.size;
        
        let mes = 0;
        let acidentes = 0;
        let pa = 0;

        snapshotTotal.forEach(doc => {
            const d = doc.data();
            const dataOcorrencia = d.data && d.data.toDate ? d.data.toDate() : new Date(d.data);
            
            if (dataOcorrencia >= inicioMes) mes++;
            if (d.tipo === 'Acidente') acidentes++;
            if (d.encaminhadoPA) pa++;
        });

        document.getElementById('kpi-total-ocorrencias').textContent = total;
        document.getElementById('kpi-ocorrencias-mes').textContent = mes;
        document.getElementById('kpi-ocorrencias-acidente').textContent = acidentes;
        document.getElementById('kpi-ocorrencias-pa').textContent = pa;

    } catch (e) {
        console.error("Erro KPIs:", e);
    }
}

function exportarOcorrenciasExcel() {
    const table = document.getElementById('tabela-ocorrencias');
    if (!table || table.rows.length <= 1) {
        alert("Sem dados para exportar.");
        return;
    }
    
    let csv = [];
    for (let i = 0; i < table.rows.length; i++) {
        let row = [], cols = table.rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length - 1; j++) { // Ignora última coluna (ações)
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(","));
    }

    const csvFile = new Blob([csv.join("\n")], {type: "text/csv"});
    const downloadLink = document.createElement("a");
    downloadLink.download = "ocorrencias_saude.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
}

// Expor funções para o escopo global
window.inicializarOcorrencias = inicializarOcorrencias;
window.carregarOcorrencias = carregarOcorrencias;
window.salvarOcorrencia = salvarOcorrencia;
window.excluirOcorrencia = excluirOcorrencia;
window.filtrarOcorrencias = filtrarOcorrencias;
window.carregarKPIsOcorrencias = carregarKPIsOcorrencias;
window.exportarOcorrenciasExcel = exportarOcorrenciasExcel;
window.toggleCampoVeiculo = toggleCampoVeiculo;
window.visualizarOcorrencia = visualizarOcorrencia;
window.editarOcorrencia = editarOcorrencia;
