// ================================================================
//  Terceirizados — Módulo completo com busca Hub do Desenvolvedor
// ================================================================

const HUB_TOKEN = '214312030idUEkpCDXn386933872';

// ── Utilitários ──────────────────────────────────────────────────
function formatarCPFInput(el) {
    let v = el.value.replace(/\D/g, '').substring(0, 11);
    if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    el.value = v;
}

function inicializarTerceirizados() {
    carregarTerceirizados();
    carregarSelectEmpresas('empresa-terceirizado');

    const empSelect = document.getElementById('empresa-terceirizado');
    if (empSelect && !empSelect.dataset.listener) {
        empSelect.addEventListener('change', async (e) => {
            const empId = e.target.value;
            await carregarSetoresPorEmpresa(empId, 'setor-terceirizado');
            await carregarFuncoesPorEmpresa(empId, 'cargo-terceirizado');
            await carregarSelectLideres('lider-terceirizado');
        });
        empSelect.dataset.listener = 'true';
    }
}

// ── Carregar lista ───────────────────────────────────────────────
let _terceirizadosCache = [];

async function carregarTerceirizados() {
    const tbody = document.getElementById('tabela-terceirizados');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5" style="color:#475569;">
        <i class="fas fa-spinner fa-spin fa-2x mb-3" style="color:#6366f1;display:block;"></i>Carregando...</td></tr>`;

    try {
        const [snapshot, empresasSnap, funcSnap] = await Promise.all([
            db.collection('funcionarios').where('tipoContrato', 'in', ['PJ', 'Estágio', 'Temporário']).get(),
            db.collection('empresas').get(),
            db.collection('funcionarios').where('status', '==', 'Ativo').get()
        ]);

        const empresasMap = {};
        empresasSnap.forEach(d => empresasMap[d.id] = d.data().nome || d.id);

        const funcMap = {};
        funcSnap.forEach(d => funcMap[d.id] = d.data().nome || d.id);

        _terceirizadosCache = [];
        snapshot.forEach(doc => {
            const f = { id: doc.id, ...doc.data() };
            f._empresaNome = empresasMap[f.empresaId] || f.empresaId || '--';
            f._liderNome   = f.liderId ? (funcMap[f.liderId] || f.liderId) : '--';
            _terceirizadosCache.push(f);
        });
        // Ordenar por nome no cliente (evita índice composto no Firestore)
        _terceirizadosCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

        // Stats
        const empresasSet = new Set(_terceirizadosCache.map(f => f.empresaId).filter(Boolean));
        const lideresSet  = new Set(_terceirizadosCache.map(f => f.liderId).filter(Boolean));
        _setStatEl('terc-stat-total', _terceirizadosCache.length);
        _setStatEl('terc-stat-ativos', _terceirizadosCache.filter(f => f.status === 'Ativo').length);
        _setStatEl('terc-stat-empresas', empresasSet.size);
        _setStatEl('terc-stat-lideres', lideresSet.size);

        document.getElementById('terc-count-label').textContent = `${_terceirizadosCache.length} registros`;
        renderTerceirizados(_terceirizadosCache);

    } catch (e) {
        console.error('Erro ao carregar terceirizados:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:#ef4444;">
            <i class="fas fa-exclamation-triangle me-2"></i>Erro ao carregar dados.</td></tr>`;
    }
}

function _setStatEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderTerceirizados(list) {
    const tbody = document.getElementById('tabela-terceirizados');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5" style="color:#475569;">
            <i class="fas fa-users-slash fa-2x mb-3" style="display:block;color:#334155;"></i>
            Nenhum terceirizado cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(f => {
        const initials = (f.nome || '?').trim().split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const statusClass = f.status === 'Ativo' ? 'terc-status-ativo' : 'terc-status-ativo" style="background:rgba(239,68,68,0.12);color:#f87171;';
        const idEsc = f.id.replace(/'/g, "\\'");
        const nomeEsc = (f.nome || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;">
                    <div class="terc-avatar">${initials}</div>
                    <div>
                        <div style="font-weight:600;color:#f1f5f9;">${f.nome || '--'}</div>
                        <div style="font-size:0.73rem;color:#64748b;">${f.email || ''}</div>
                    </div>
                </div>
            </td>
            <td><span class="terc-cpf-badge">${f.cpf || '--'}</span></td>
            <td style="color:#e2e8f0;">${f._empresaNome}</td>
            <td>
                <div style="font-weight:500;color:#e2e8f0;">${f.cargo || '--'}</div>
                <div style="font-size:0.73rem;color:#64748b;">${f.setor || ''}</div>
            </td>
            <td style="color:#a5b4fc;">${f._liderNome}</td>
            <td><span class="${statusClass}">${f.status || 'Ativo'}</span></td>
            <td style="text-align:right;">
                <div style="display:flex;justify-content:flex-end;gap:0.4rem;">
                    <button class="btn-terc-edit" onclick="editarTerceirizado('${idEsc}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-terc-del" onclick="excluirTerceirizado('${idEsc}','${nomeEsc}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filtrarTerceirizados(q) {
    const term = q.toLowerCase().trim();
    if (!term) { renderTerceirizados(_terceirizadosCache); return; }
    const filtered = _terceirizadosCache.filter(f =>
        (f.nome || '').toLowerCase().includes(term) ||
        (f.cpf  || '').includes(term) ||
        (f.cargo || '').toLowerCase().includes(term) ||
        (f._empresaNome || '').toLowerCase().includes(term)
    );
    document.getElementById('terc-count-label').textContent = `${filtered.length} de ${_terceirizadosCache.length}`;
    renderTerceirizados(filtered);
}

// ── Abrir Modal ──────────────────────────────────────────────────
function abrirModalTerceirizado(id = null) {
    _limparModalTerceirizado();

    const titleEl = document.getElementById('terc-modal-title-text');
    const subEl   = document.getElementById('terc-modal-subtitle');
    if (titleEl) titleEl.textContent = id ? 'Editar Terceirizado' : 'Novo Terceirizado';
    if (subEl)   subEl.textContent   = id
        ? 'Edite os dados do colaborador terceirizado'
        : 'Preencha o CPF e clique em buscar para carregar as informações automaticamente';

    const modalEl = document.getElementById('terceirizadoModal');
    if (!modalEl) { console.error('Modal #terceirizadoModal não encontrado.'); return; }
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    // Populate empresa select and attach change listener once
    carregarSelectEmpresas('empresa-terceirizado').then(() => {
        const empEl = document.getElementById('empresa-terceirizado');
        if (empEl && !empEl._tercListener) {
            empEl._tercListener = true;
            empEl.addEventListener('change', async e => {
                const empId = e.target.value;
                await Promise.all([
                    carregarSetoresPorEmpresa(empId, 'setor-terceirizado'),
                    carregarFuncoesPorEmpresa(empId, 'cargo-terceirizado')
                ]);
            });
        }
    });
    carregarSelectLideres('lider-terceirizado');

    if (id) {
        document.getElementById('terc-edit-id').value = id;
        _preencherModalParaEdicao(id);
    }
}

function _limparModalTerceirizado() {
    const campos = ['terc-edit-id','terc-cpf','terc-data-nasc','terc-nome','terc-nascimento',
        'terc-genero','terc-email','terc-telefone','terc-rg','terc-nome-mae','terc-nome-pai',
        'terc-cep','terc-logradouro','terc-numero','terc-bairro','terc-cidade','terc-uf',
        'terc-admissao','terc-salario','terc-obs'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const hubResult = document.getElementById('terc-hub-result');
    if (hubResult) hubResult.classList.remove('show');
    const hubStatus = document.getElementById('terc-hub-status');
    if (hubStatus) hubStatus.innerHTML = '';
    const turbo = document.getElementById('terc-turbo');
    if (turbo) turbo.checked = false;
}

async function _preencherModalParaEdicao(id) {
    try {
        const doc = await db.collection('funcionarios').doc(id).get();
        if (!doc.exists) return;
        const f = doc.data();
        const _set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
        _set('terc-cpf', f.cpf);
        _set('terc-nome', f.nome);
        _set('terc-genero', f.genero);
        _set('terc-email', f.email);
        _set('terc-telefone', f.telefone);
        _set('terc-rg', f.rg);
        _set('terc-nome-mae', f.nomeMae);
        _set('terc-nome-pai', f.nomePai);
        _set('terc-cep', f.cep);
        _set('terc-logradouro', f.logradouro);
        _set('terc-numero', f.numero);
        _set('terc-bairro', f.bairro);
        _set('terc-cidade', f.cidade);
        _set('terc-uf', f.uf);
        _set('terc-salario', f.salario);
        _set('terc-obs', f.observacoes);
        if (f.dataAdmissao) _set('terc-admissao', _toDateInput(f.dataAdmissao));
        if (f.dataNascimento) _set('terc-nascimento', _toDateInput(f.dataNascimento));
        const statusEl = document.getElementById('terc-status');
        if (statusEl) statusEl.value = f.status || 'Ativo';
        const tipoEl = document.getElementById('terc-tipo-contrato');
        if (tipoEl) tipoEl.value = f.tipoContrato || 'PJ';
        // Empresa > Setor > Cargo > Líder
        const empEl = document.getElementById('empresa-terceirizado');
        if (empEl && f.empresaId) {
            empEl.value = f.empresaId;
            await Promise.all([
                carregarSetoresPorEmpresa(f.empresaId, 'setor-terceirizado'),
                carregarFuncoesPorEmpresa(f.empresaId, 'cargo-terceirizado')
            ]);
            _set('setor-terceirizado', f.setor);
            _set('cargo-terceirizado', f.cargo);
        }
        const liderEl = document.getElementById('lider-terceirizado');
        if (liderEl && f.liderId) liderEl.value = f.liderId;
    } catch(e) {
        console.error('Erro ao carregar dados para edição:', e);
    }
}

function _toDateInput(firestoreDate) {
    if (!firestoreDate) return '';
    const d = firestoreDate.toDate ? firestoreDate.toDate() : new Date(firestoreDate);
    return d.toISOString().split('T')[0];
}

// ── Busca Hub do Desenvolvedor ───────────────────────────────────
window.buscarCpfTerceirizado = async function() {
    const cpf = (document.getElementById('terc-cpf')?.value || '').replace(/\D/g, '');
    const dataNasc = (document.getElementById('terc-data-nasc')?.value || '').trim();
    const useTurbo = document.getElementById('terc-turbo')?.checked;

    const statusDiv = document.getElementById('terc-hub-status');
    const resultCard = document.getElementById('terc-hub-result');
    const btn = document.getElementById('btn-buscar-terc');

    if (cpf.length !== 11) {
        if (statusDiv) statusDiv.innerHTML = `<div class="alert alert-warning py-2 mb-0" style="font-size:0.8rem;">
            <i class="fas fa-exclamation-triangle me-1"></i> CPF inválido. Digite 11 dígitos.</div>`;
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Buscando...';
    if (statusDiv) statusDiv.innerHTML = '';
    if (resultCard) resultCard.classList.remove('show');

    try {
        let url = `https://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cpf}`;
        url += `&data=${dataNasc || ''}`;
        url += `&token=${HUB_TOKEN}`;
        if (useTurbo) url += `&turbo=1`;

        const resp = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = await resp.json();

        if (resp.ok && data.return === 'OK' && data.result) {
            const r = data.result;
            _preencherCamposHub(r);

            // Mostrar card de resultado
            if (resultCard) {
                document.getElementById('terc-hub-nome-display').textContent = r.nome_da_pf || '—';
                document.getElementById('terc-hub-grid').innerHTML = _buildHubGrid(r);
                resultCard.classList.add('show');
            }

            if (statusDiv) statusDiv.innerHTML = `<div style="color:#34d399;font-size:0.8rem;font-weight:600;margin-top:0.5rem;">
                <i class="fas fa-check-circle me-1"></i> Encontrado com sucesso</div>`;
        } else {
            const msg = data.message || data.error || 'CPF não encontrado.';
            if (statusDiv) statusDiv.innerHTML = `<div class="alert alert-danger py-2 mb-0" style="font-size:0.8rem;">
                <i class="fas fa-times-circle me-1"></i> ${msg}</div>`;
        }
    } catch (err) {
        console.error('Erro Hub:', err);
        if (statusDiv) statusDiv.innerHTML = `<div class="alert alert-danger py-2 mb-0" style="font-size:0.8rem;">
            <i class="fas fa-wifi me-1"></i> Erro de conexão com o Hub.</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search me-1"></i> Buscar';
    }
};

function _preencherCamposHub(r) {
    const _set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    _set('terc-nome', r.nome_da_pf);
    // Data de nascimento: API retorna dd/mm/yyyy
    if (r.data_nascimento) {
        const parts = r.data_nascimento.split('/');
        if (parts.length === 3) _set('terc-nascimento', `${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    // Endereço
    if (r.logradouro) _set('terc-logradouro', r.logradouro);
    if (r.bairro)     _set('terc-bairro', r.bairro);
    if (r.municipio)  _set('terc-cidade', r.municipio);
    if (r.uf)         _set('terc-uf', r.uf);
    if (r.cep)        _set('terc-cep', r.cep);
    if (r.numero)     _set('terc-numero', r.numero);
    // Demais campos pessoais
    if (r.nome_mae)  _set('terc-nome-mae', r.nome_mae);
    if (r.nome_pai)  _set('terc-nome-pai', r.nome_pai);
    if (r.sexo) {
        const gen = document.getElementById('terc-genero');
        if (gen) gen.value = r.sexo === 'M' ? 'Masculino' : r.sexo === 'F' ? 'Feminino' : 'Outro';
    }
}

function _buildHubGrid(r) {
    const fields = [
        ['CPF',              r.ni],
        ['Situação Receita', r.situacao_cadastral],
        ['Data de Nascimento', r.data_nascimento],
        ['Sexo',             r.sexo === 'M' ? 'Masculino' : r.sexo === 'F' ? 'Feminino' : r.sexo],
        ['Nome da Mãe',      r.nome_mae],
        ['Nome do Pai',      r.nome_pai],
        ['Logradouro',       r.logradouro ? `${r.logradouro}${r.numero ? ', '+r.numero : ''}` : null],
        ['Bairro',           r.bairro],
        ['Município / UF',   r.municipio ? `${r.municipio} / ${r.uf}` : null],
        ['CEP',              r.cep],
        ['Emissão',          r.data_emissao],
        ['Óbito',            r.obito === 'Sim' ? '⚠️ Consta óbito' : null],
    ].filter(([, v]) => v);

    return fields.map(([lbl, val]) => `
        <div class="hub-result-item">
            <label>${lbl}</label>
            <span>${val}</span>
        </div>`).join('');
}

// ── Salvar ───────────────────────────────────────────────────────
window.salvarTerceirizado = async function() {
    const _val = id => (document.getElementById(id)?.value || '').trim();

    const nome = _val('terc-nome');
    const cpf  = _val('terc-cpf');
    const empresaId = _val('empresa-terceirizado');

    if (!nome || !cpf || !empresaId) {
        mostrarMensagem('Preencha Nome, CPF e Empresa.', 'warning');
        return;
    }
    if (typeof validarCPF === 'function' && !validarCPF(cpf.replace(/\D/g,''))) {
        mostrarMensagem('CPF inválido.', 'warning');
        return;
    }

    const btn = document.getElementById('btnSalvarTerceirizado');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

    const admissao = _val('terc-admissao');
    const nasc     = _val('terc-nascimento');

    const payload = {
        nome,
        cpf,
        empresaId,
        setor:          _val('setor-terceirizado'),
        cargo:          _val('cargo-terceirizado'),
        liderId:        _val('lider-terceirizado') || null,
        tipoContrato:   _val('terc-tipo-contrato') || 'PJ',
        status:         _val('terc-status') || 'Ativo',
        email:          _val('terc-email'),
        telefone:       _val('terc-telefone'),
        rg:             _val('terc-rg'),
        nomeMae:        _val('terc-nome-mae'),
        nomePai:        _val('terc-nome-pai'),
        genero:         _val('terc-genero'),
        cep:            _val('terc-cep'),
        logradouro:     _val('terc-logradouro'),
        numero:         _val('terc-numero'),
        bairro:         _val('terc-bairro'),
        cidade:         _val('terc-cidade'),
        uf:             _val('terc-uf'),
        salario:        parseFloat(_val('terc-salario')) || null,
        observacoes:    _val('terc-obs'),
        dataAdmissao:   admissao ? new Date(admissao + 'T12:00:00Z') : null,
        dataNascimento: nasc     ? new Date(nasc     + 'T12:00:00Z') : null,
        atualizadoEm:   firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const editId = _val('terc-edit-id');
        if (editId) {
            await db.collection('funcionarios').doc(editId).update(payload);
            mostrarMensagem('Terceirizado atualizado com sucesso!');
        } else {
            payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('funcionarios').add(payload);
            mostrarMensagem('Terceirizado cadastrado com sucesso!');
        }

        bootstrap.Modal.getInstance(document.getElementById('terceirizadoModal')).hide();
        carregarTerceirizados();

    } catch (err) {
        console.error('Erro ao salvar:', err);
        mostrarMensagem('Erro ao salvar. Tente novamente.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Terceirizado';
    }
};

// ── Editar ───────────────────────────────────────────────────────
window.editarTerceirizado = function(id) {
    abrirModalTerceirizado(id);
};

// ── Excluir ──────────────────────────────────────────────────────
window.excluirTerceirizado = function(id, nome) {
    if (!confirm(`Confirma a exclusão de "${nome}"?\nEsta ação não pode ser desfeita.`)) return;
    db.collection('funcionarios').doc(id).delete()
        .then(() => { mostrarMensagem(`${nome} excluído com sucesso.`); carregarTerceirizados(); })
        .catch(err => { console.error(err); mostrarMensagem('Erro ao excluir.', 'error'); });
};

// ── Helpers de select ────────────────────────────────────────────
async function carregarSelectEmpresas(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    try {
        const snap = await db.collection('empresas').orderBy('nome').get();
        el.innerHTML = '<option value="">-- Selecione --</option>';
        snap.forEach(d => {
            el.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`;
        });
    } catch(e) { console.warn('Erro ao carregar empresas:', e); }
}

async function carregarSetoresPorEmpresa(empId, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '<option value="">-- Carregando... --</option>';
    try {
        const snap = await db.collection('setores').where('empresaId', '==', empId).orderBy('nome').get();
        el.innerHTML = '<option value="">-- Selecione --</option>';
        snap.forEach(d => { el.innerHTML += `<option value="${d.data().nome}">${d.data().nome}</option>`; });
    } catch(e) { el.innerHTML = '<option value="">-- Selecione --</option>'; }
}

async function carregarFuncoesPorEmpresa(empId, elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '<option value="">-- Carregando... --</option>';
    try {
        const snap = await db.collection('funcoes').where('empresaId', '==', empId).orderBy('nome').get();
        el.innerHTML = '<option value="">-- Selecione --</option>';
        snap.forEach(d => { el.innerHTML += `<option value="${d.data().nome}">${d.data().nome}</option>`; });
    } catch(e) { el.innerHTML = '<option value="">-- Selecione --</option>'; }
}

async function carregarSelectLideres(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    try {
        // Sem orderBy para evitar exigência de índice composto; ordenamos client-side
        const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
        el.innerHTML = '<option value="">-- Sem líder definido --</option>';
        list.forEach(f => {
            el.innerHTML += `<option value="${f.id}">${f.nome}${f.cargo ? ' — '+f.cargo : ''}</option>`;
        });
    } catch(e) { console.warn('Erro ao carregar líderes:', e); }
}

// Exportar para uso global
window.inicializarTerceirizados = inicializarTerceirizados;
window.filtrarTerceirizados = filtrarTerceirizados;
window.abrirModalTerceirizado = abrirModalTerceirizado;
window.formatarCPFInput = formatarCPFInput;
