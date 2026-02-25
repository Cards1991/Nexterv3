// js/ocorrencias.js

// Variável global para armazenar a instância do modal
let modalOcorrencia;

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
    
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const inicio = document.getElementById('filtro-ocorrencia-inicio').value;
        const fim = document.getElementById('filtro-ocorrencia-fim').value;
        const tipo = document.getElementById('filtro-ocorrencia-tipo').value;

        let query = db.collection('ocorrencias_saude');

        if (inicio) query = query.where('data', '>=', new Date(inicio + 'T00:00:00'));
        if (fim) query = query.where('data', '<=', new Date(fim + 'T23:59:59'));
        
        const snapshot = await query.orderBy('data', 'desc').get();
        
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhuma ocorrência encontrada no período.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Filtro de tipo no cliente (caso não tenha índice composto)
            if (tipo && data.tipo !== tipo) return;

            const dataFormatada = data.data ? new Date(data.data.toDate()).toLocaleString('pt-BR') : '-';
            const veiculoInfo = data.encaminhadoPA ? (data.veiculo || 'Não informado') : '-';
            const badgePA = data.encaminhadoPA ? '<span class="badge bg-danger">P.A.</span>' : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${data.colaboradorNome}</td>
                <td><small>${data.empresaNome || ''}<br>${data.setor || ''}</small></td>
                <td><span class="badge bg-secondary">${data.tipo}</span> ${badgePA}</td>
                <td>${data.descricao}</td>
                <td>${data.tratamento || '-'}</td>
                <td>${veiculoInfo}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirOcorrencia('${doc.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("Erro ao carregar ocorrências:", error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

async function abrirModalNovaOcorrencia() {
    // Resetar formulário
    document.getElementById('form-nova-ocorrencia').reset();
    document.getElementById('ocorrencia-id').value = '';
    document.getElementById('container-veiculo-pa').style.display = 'none';
    
    // Definir data/hora atual
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('ocorrencia-data').value = now.toISOString().slice(0, 16);

    // Carregar colaboradores
    const selectColaborador = document.getElementById('ocorrencia-colaborador');
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

    // Carregar veículos no select
    const selectVeiculo = document.getElementById('ocorrencia-veiculo');
    // Manter as opções estáticas e adicionar as do banco
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

    modalOcorrencia = new bootstrap.Modal(document.getElementById('modalNovaOcorrencia'));
    modalOcorrencia.show();
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
        const colaboradorSelect = document.getElementById('ocorrencia-colaborador');
        const colaboradorId = colaboradorSelect.value;
        const colaboradorNome = colaboradorSelect.options[colaboradorSelect.selectedIndex].text;
        const empresaId = colaboradorSelect.options[colaboradorSelect.selectedIndex].dataset.empresaId || '';
        const setor = colaboradorSelect.options[colaboradorSelect.selectedIndex].dataset.setor || '';
        
        // Buscar nome da empresa
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
            registradoPor: firebase.auth().currentUser.email,
            registradoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('ocorrencias_saude').add(dados);
        
        mostrarMensagem('Ocorrência registrada com sucesso!', 'success');
        modalOcorrencia.hide();
        carregarOcorrencias();
        carregarKPIsOcorrencias();

    } catch (error) {
        console.error("Erro ao salvar ocorrência:", error);
        mostrarMensagem('Erro ao salvar: ' + error.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = textoOriginal;
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
window.abrirModalNovaOcorrencia = abrirModalNovaOcorrencia;
window.salvarOcorrencia = salvarOcorrencia;
window.excluirOcorrencia = excluirOcorrencia;
window.filtrarOcorrencias = filtrarOcorrencias;
window.carregarKPIsOcorrencias = carregarKPIsOcorrencias;
window.exportarOcorrenciasExcel = exportarOcorrenciasExcel;
window.toggleCampoVeiculo = toggleCampoVeiculo;