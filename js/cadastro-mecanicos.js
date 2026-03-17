// Cadastro de Mecânicos - Gerente de Manutenção
let __mecanicos_cache = [];
let __unsubscribe_mecanicos = null;

async function inicializarCadastroMecanicos() {
    await carregarSelectSetores();
    await carregarListaMecanicos();
}

async function carregarListaMecanicos() {
    const tbody = document.getElementById('tabela-mecanicos');
    const totalEl = document.getElementById('total-mecanicos');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        if (__unsubscribe_mecanicos) __unsubscribe_mecanicos();
        
        let query = db.collection('funcionarios').where('isMecanico', '==', true);
        
        const tipo = document.getElementById('filtro-tipo-mecanico')?.value;
        const status = document.getElementById('filtro-status-mecanico')?.value;
        const setor = document.getElementById('filtro-setor-mecanico')?.value;

        if (tipo === 'gerente') {
            query = query.where('isMecanicoAdmin', '==', true);
        } else if (tipo === 'inativo') {
            query = query.where('status', '==', 'Inativo');
        }

        if (status) query = query.where('status', '==', status);

        __unsubscribe_mecanicos = query.orderBy('nome').onSnapshot(async snap => {
            __mecanicos_cache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Client-side setor filter
            let filtrados = __mecanicos_cache;
            if (setor) {
                filtrados = filtrados.filter(m => m.setor === setor);
            }
            
            totalEl.textContent = filtrados.length;
            
            if (filtrados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">Nenhum mecânico encontrado.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            filtrados.forEach(m => renderMecanicoRow(m, tbody));
        });
    } catch (error) {
        console.error('Erro:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar</td></tr>';
    }
}

function renderMecanicoRow(m, tbody) {
    const nivelBadge = m.isMecanicoAdmin ? '<span class="badge bg-success">Gerente</span>' : '<span class="badge bg-info">Mecânico</span>';
    const statusBadge = m.status === 'Ativo' ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>';
    const telFormatado = m.telefone ? formatarTelefoneWhatsApp(m.telefone) : 'N/A';

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <strong>${m.nome}</strong>
            ${m.matricula ? `<br><small class="text-muted">${m.matricula}</small>` : ''}
        </td>
        <td>${m.matricula || '-'}</td>
        <td>${m.setor || '-'}</td>
        <td>${nivelBadge}</td>
        <td>
            ${m.telefone ? `<a href="https://wa.me/${telFormatado}" target="_blank" class="text-success">
                <i class="fab fa-whatsapp"></i> ${m.telefone}
            </a>` : 'Sem telefone'}
        </td>
        <td>${statusBadge}</td>
        <td class="text-end">
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="editarMecanico('${m.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="alternarStatusMecanico('${m.id}')" title="${m.status === 'Ativo' ? 'Inativar' : 'Ativar'}">
                    <i class="fas fa-${m.status === 'Ativo' ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn btn-outline-warning ${m.isMecanicoAdmin ? '' : 'd-none'}" onclick="alternarNivelMecanico('${m.id}')" title="Gerente → Mecânico">
                    <i class="fas fa-user-crown"></i>
                </button>
            </div>
        </td>
    `;
    tbody.appendChild(row);
}

async function carregarSelectFuncionariosAtivosModal() {
    const select = document.getElementById('selectFuncionarioExistente');
    select.innerHTML = '<option value="">Novo Mecânico</option><option value="">Carregando...</option>';
    
    try {
        const snap = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .where('isMecanico', '==', false)
            .orderBy('nome')
            .limit(100)
            .get();
        
        snap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${data.nome} (${data.matricula || 'Sem matrícula'}) - ${data.setor || 'Sem setor'}`;
            select.appendChild(option);
        });
        
        // Auto-fill when employee selected
        select.onchange = function() {
            const funcId = this.value;
            if (funcId) {
                loadFuncionarioData(funcId);
            } else {
                // Clear form for new
                document.getElementById('nomeMecanico').value = '';
                document.getElementById('matriculaMecanico').value = '';
                document.getElementById('setorMecanico').value = '';
                document.getElementById('telefoneMecanico').value = '';
            }
        };
    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function loadFuncionarioData(funcId) {
    try {
        const doc = await db.collection('funcionarios').doc(funcId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('nomeMecanico').value = data.nome;
            document.getElementById('matriculaMecanico').value = data.matricula || '';
            document.getElementById('telefoneMecanico').value = data.telefone || '';
            document.getElementById('setorMecanico').value = data.setor || '';
        }
    } catch (error) {
        console.error('Erro ao carregar funcionário:', error);
    }
}

async function abrirModalNovoMecanico(mecanicoId = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalMecanico'));
    const title = document.getElementById('modalMecanicoTitle');
    const form = document.getElementById('formMecanico');
    
    form.reset();
    document.getElementById('mecanicoId').value = mecanicoId || '';
    title.textContent = mecanicoId ? 'Editar Mecânico' : 'Novo Mecânico';
    
    // Load Ativo funcionarios for dropdown
    await carregarSelectFuncionariosAtivosModal();
    
    if (mecanicoId) {
        const doc = await db.collection('funcionarios').doc(mecanicoId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('nomeMecanico').value = data.nome;
            document.getElementById('matriculaMecanico').value = data.matricula || '';
            document.getElementById('telefoneMecanico').value = data.telefone || '';
            document.getElementById('setorMecanico').value = data.setor || '';
            document.getElementById('selectFuncionarioExistente').value = data.id || '';
            document.getElementById('nivelMecanico').value = data.isMecanicoAdmin ? 'gerente' : 'mecanico';
            document.getElementById('statusMecanico').value = data.status || 'Ativo';
        }
    } else {
        document.getElementById('selectFuncionarioExistente').value = '';
    }
    
    modal.show();
}

async function salvarMecanico() {
    const form = document.getElementById('formMecanico');
    const mecanicoId = document.getElementById('mecanicoId').value;
    const funcionarioExistenteId = document.getElementById('selectFuncionarioExistente').value;
    
    if (funcionarioExistenteId) {
        // UPDATE existing funcionario - set mechanic flags
        const updateData = {
            isMecanico: true,
            isMecanicoAdmin: document.getElementById('nivelMecanico').value === 'gerente',
            telefone: document.getElementById('telefoneMecanico').value, // Update phone if provided
            status: document.getElementById('statusMecanico').value
        };
        
        try {
            await db.collection('funcionarios').doc(funcionarioExistenteId).update(updateData);
            mostrarMensagem('Mecânico ativado/atualizado!');
            bootstrap.Modal.getInstance(document.getElementById('modalMecanico')).hide();
            carregarListaMecanicos();
        } catch (error) {
            console.error(error);
            mostrarMensagem('Erro ao atualizar: ' + error.message, 'error');
        }
        return;
    }
    
    // CREATE new if no existing selected
    const data = {
        nome: document.getElementById('nomeMecanico').value,
        matricula: document.getElementById('matriculaMecanico').value,
        telefone: document.getElementById('telefoneMecanico').value,
        setor: document.getElementById('setorMecanico').value,
        isMecanico: true,
        isMecanicoAdmin: document.getElementById('nivelMecanico').value === 'gerente',
        status: document.getElementById('statusMecanico').value
    };

    if (!data.nome || !data.telefone) {
        mostrarMensagem('Nome e telefone obrigatórios.', 'warning');
        return;
    }

    try {
        await db.collection('funcionarios').add(data);
        mostrarMensagem('Novo mecânico cadastrado!');
        bootstrap.Modal.getInstance(document.getElementById('modalMecanico')).hide();
        carregarListaMecanicos();
    } catch (error) {
        console.error(error);
        mostrarMensagem('Erro ao salvar: ' + error.message, 'error');
    }
}

async function alternarStatusMecanico(mecanicoId) {
    if (!confirm('Alternar status deste mecânico?')) return;
    
    try {
        const doc = await db.collection('funcionarios').doc(mecanicoId).get();
        const currentStatus = doc.data().status;
        await db.collection('funcionarios').doc(mecanicoId).update({
            status: currentStatus === 'Ativo' ? 'Inativo' : 'Ativo'
        });
        mostrarMensagem('Status alterado!');
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function alternarNivelMecanico(mecanicoId) {
    if (!confirm('Mudar de Gerente → Mecânico Normal?')) return;
    
    try {
        await db.collection('funcionarios').doc(mecanicoId).update({
            isMecanicoAdmin: false
        });
        mostrarMensagem('Nivel alterado para Mecânico Normal!');
        carregarListaMecanicos();
    } catch (error) {
        mostrarMensagem('Erro: ' + error.message, 'error');
    }
}

async function editarMecanico(mecanicoId) {
    abrirModalNovoMecanico(mecanicoId);
}

async function carregarSelectSetores() {
    const select = document.getElementById('filtro-setor-mecanico');
    try {
        const snap = await db.collection('setores').get();
        select.innerHTML = '<option value="">Todos Setores</option>';
        snap.forEach(doc => {
            const setor = doc.data().descricao;
            select.innerHTML += `<option value="${setor}">${setor}</option>`;
        });
    } catch (error) {
        console.error(error);
    }
}

async function exportarListaMecanicos() {
    const data = __mecanicos_cache.map(m => ({
        Nome: m.nome,
        Matricula: m.matricula || '',
        Setor: m.setor || '',
        Nivel: m.isMecanicoAdmin ? 'Gerente' : 'Mecânico',
        Telefone: m.telefone || '',
        Status: m.status || ''
    }));

    const csv = 'data:text/csv;charset=utf-8,' + 
        'Nome,Matricula,Setor,Nivel,Telefone,Status\n' +
        data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `mecanicos-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// ✅ Global Functions - Load LAST so local functions defined first
// Exposto globalmente via window - Fixed order issue
window.abrirModalNovoMecanico = abrirModalNovoMecanico;
window.carregarListaMecanicos = carregarListaMecanicos;
window.exportarListaMecanicos = exportarListaMecanicos;
window.salvarMecanico = salvarMecanico;
window.editarMecanico = editarMecanico;
window.alternarStatusMecanico = alternarStatusMecanico;
window.alternarNivelMecanico = alternarNivelMecanico;
window.inicializarCadastroMecanicos = inicializarCadastroMecanicos;
