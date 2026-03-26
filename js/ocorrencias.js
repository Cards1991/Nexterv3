/**
 * js/ocorrencias.js - RECONSTRUÍDO DO ZERO (VERSÃO V3)
 * Eliminada dependência do bootstrap.Modal para evitar erro de Backdrop.
 */

// Estado global do módulo
let __ocorrencias_v3_data = [];

// 1. Inicialização
async function inicializarOcorrencias() {
    console.log("🚀 Inicializando módulo de Ocorrências V3...");
    
    // Configurar datas padrões (mês atual) nos filtros
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = hoje.toISOString().split('T')[0];
    
    const inputInicio = document.getElementById('f-oco-inicio');
    const inputFim = document.getElementById('f-oco-fim');
    if (inputInicio) inputInicio.value = inicio;
    if (inputFim) inputFim.value = fim;

    // Carregar dados iniciais
    await carregarOcorrenciasV3();
    await carregarDadosFormularioV3();
}

// 2. Controle de Modal (Customizado - Sem Bootstrap)
window.abrirModalOcorrenciaSaude = function(id = null) {
    const overlay = document.getElementById('modalV3Overlay');
    const form = document.getElementById('formOcoV3');
    const title = document.getElementById('modalV3Title');
    
    if (!overlay || !form) return;

    // Reset
    form.reset();
    document.getElementById('v3-id').value = '';
    document.getElementById('v3-veiculo-container').style.display = 'none';
    title.textContent = 'Registrar Nova Ocorrência';
    
    // Valor padrão hoje/agora
    const dataInput = document.getElementById('v3-data');
    if (dataInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dataInput.value = now.toISOString().slice(0, 16);
    }

    if (id) {
        preencherEdicaoV3(id);
    }

    overlay.style.display = 'flex';
};

window.fecharModalOcorrenciaSaude = function() {
    const overlay = document.getElementById('modalV3Overlay');
    if (overlay) overlay.style.display = 'none';
};

// 3. Gerenciamento de Dados (CRUD)
async function carregarOcorrenciasV3() {
    const tbody = document.getElementById('tabela-oco-v3');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('ocorrencias_saude').orderBy('data', 'desc').limit(100).get();
        __ocorrencias_v3_data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarTabelaV3(__ocorrencias_v3_data);
        atualizarKPIsV3(__ocorrencias_v3_data);
    } catch (error) {
        console.error("Erro ao buscar ocorrências:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Falha ao carregar dados.</td></tr>';
    }
}

function renderizarTabelaV3(lista) {
    const tbody = document.getElementById('tabela-oco-v3');
    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(oco => {
        const dataStr = oco.data?.toDate ? oco.data.toDate().toLocaleString('pt-BR') : '-';
        const badgeCor = oco.tipo === 'Acidente' ? 'bg-danger' : 
                         oco.tipo === 'Doença' ? 'bg-warning text-dark' : 'bg-secondary';
        
        return `
            <tr>
                <td class="ps-3 fw-bold small">${dataStr}</td>
                <td>
                    <div class="fw-bold">${oco.colaboradorNome}</div>
                </td>
                <td><small>${oco.empresaNome || '-'}<br>${oco.setor || '-'}</small></td>
                <td><span class="badge ${badgeCor}">${oco.tipo}</span></td>
                <td class="text-end pe-3">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="visualizarOcoV3('${oco.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-outline-warning" onclick="abrirModalOcorrenciaSaude('${oco.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-danger" onclick="excluirOcoV3('${oco.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function salvarOcorrenciaV3() {
    const btn = document.getElementById('v3-btn-salvar');
    const id = document.getElementById('v3-id').value;
    const colabSelect = document.getElementById('v3-colaborador');
    
    // Validação mínima
    const dataVal = document.getElementById('v3-data').value;
    const tipoVal = document.getElementById('v3-tipo').value;
    const descVal = document.getElementById('v3-descricao').value;
    const colabVal = colabSelect.value;

    if (!dataVal || !tipoVal || !descVal || !colabVal) {
        alert("Por favor, preencha todos os campos obrigatórios (*).");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';

    try {
        const selectedOption = colabSelect.options[colabSelect.selectedIndex];
        
        const dados = {
            data: new Date(dataVal),
            tipo: tipoVal,
            colaboradorId: colabVal,
            colaboradorNome: selectedOption.text,
            empresaId: selectedOption.dataset.empresaId || '',
            empresaNome: selectedOption.dataset.empresaNome || '',
            setor: selectedOption.dataset.setor || '',
            descricao: descVal,
            tratamento: document.getElementById('v3-tratamento').value,
            encaminhadoPA: document.getElementById('v3-pa').checked,
            veiculo: document.getElementById('v3-veiculo').value,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await db.collection('ocorrencias_saude').doc(id).update(dados);
        } else {
            dados.registradoPor = auth.currentUser?.email || 'N/A';
            dados.registradoEm = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('ocorrencias_saude').add(dados);
        }

        fecharModalOcorrenciaSaude();
        await carregarOcorrenciasV3();
        alert("Registro gravado com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar registro: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Gravar Registro';
    }
}

// 4. Auxiliares
async function carregarDadosFormularioV3() {
    const select = document.getElementById('v3-colaborador');
    if (!select) return;

    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione o funcionário...</option>';
        
        snapshot.forEach(doc => {
            const f = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.text = f.nome;
            opt.dataset.empresaId = f.empresaId || '';
            opt.dataset.empresaNome = f.empresa || '';
            opt.dataset.setor = f.setor || '';
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Erro ao carregar colaboradores:", e);
    }
}

function preencherEdicaoV3(id) {
    const oco = __ocorrencias_v3_data.find(o => o.id === id);
    if (!oco) return;

    document.getElementById('modalV3Title').textContent = 'Editar Ocorrência';
    document.getElementById('v3-id').value = id;
    
    if (oco.data) {
        const d = oco.data.toDate ? oco.data.toDate() : new Date(oco.data);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('v3-data').value = d.toISOString().slice(0, 16);
    }

    document.getElementById('v3-tipo').value = oco.tipo || '';
    document.getElementById('v3-colaborador').value = oco.colaboradorId || '';
    document.getElementById('v3-descricao').value = oco.descricao || '';
    document.getElementById('v3-tratamento').value = oco.tratamento || '';
    document.getElementById('v3-pa').checked = oco.encaminhadoPA || false;
    document.getElementById('v3-veiculo').value = oco.veiculo || '';
    
    toggleV3Veiculo();
}

window.toggleV3Veiculo = function() {
    const isChecked = document.getElementById('v3-pa').checked;
    document.getElementById('v3-veiculo-container').style.display = isChecked ? 'block' : 'none';
};

async function excluirOcoV3(id) {
    if (confirm("Tem certeza que deseja remover este registro permanentemente?")) {
        try {
            await db.collection('ocorrencias_saude').doc(id).delete();
            await carregarOcorrenciasV3();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    }
}

function atualizarKPIsV3(lista) {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const total = lista.length;
    const noMes = lista.filter(o => {
        const d = o.data?.toDate ? o.data.toDate() : new Date(o.data);
        return d >= inicioMes;
    }).length;
    
    const acidentes = lista.filter(o => o.tipo === 'Acidente').length;
    const pa = lista.filter(o => o.encaminhadoPA).length;

    if (document.getElementById('k-oco-total')) document.getElementById('k-oco-total').textContent = total;
    if (document.getElementById('k-oco-mes')) document.getElementById('k-oco-mes').textContent = noMes;
    if (document.getElementById('k-oco-acidentes')) document.getElementById('k-oco-acidentes').textContent = acidentes;
    if (document.getElementById('k-oco-pa')) document.getElementById('k-oco-pa').textContent = pa;
}

// Exposição Global
window.inicializarOcorrencias = inicializarOcorrencias;
window.salvarOcorrenciaSaude = salvarOcorrenciaV3;
window.visualizarOcoV3 = async (id) => {
    const oco = __ocorrencias_v3_data.find(o => o.id === id);
    if (!oco) return;
    
    // Reutilizando modal genérico do app.js se existir
    if (typeof abrirModalGenerico === 'function') {
        const html = `
            <div class="p-2">
                <p><strong>Colaborador:</strong> ${oco.colaboradorNome}</p>
                <p><strong>Empresa/Setor:</strong> ${oco.empresaNome || '-'} / ${oco.setor || '-'}</p>
                <p><strong>Tipo:</strong> ${oco.tipo}</p>
                <hr>
                <p><strong>Descrição:</strong><br>${oco.descricao}</p>
                <p><strong>Tratamento:</strong><br>${oco.tratamento || 'N/A'}</p>
                <p><strong>Encaminhado P.A:</strong> ${oco.encaminhadoPA ? 'Sim ('+oco.veiculo+')' : 'Não'}</p>
            </div>
        `;
        abrirModalGenerico("Detalhes da Ocorrência", html);
    } else {
        alert("Descrição:\n" + oco.descricao);
    }
};