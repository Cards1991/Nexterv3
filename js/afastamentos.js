// Afastamentos - listagem e criação básica
let __afastamentos_cache = [];

async function carregarAfastamentos() {
    try {
        const tbody = document.getElementById('afastamentos-container');
        await carregarAlertasPericia(); // Carrega o dashboard de alertas

        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const snap = await db.collection('afastamentos').orderBy('data_inicio', 'desc').get();
        __afastamentos_cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (__afastamentos_cache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum afastamento cadastrado</td></tr>';
            return;
        }

        const empresasSnapshot = await db.collection('empresas').get();
        const empMap = new Map(empresasSnapshot.docs.map(doc => [doc.id, doc.data().nome]));

        tbody.innerHTML = '';
        __afastamentos_cache.forEach(a => {
            const inicio = a.data_inicio?.toDate ? a.data_inicio.toDate() : a.data_inicio;
            const fim = a.data_termino_prevista?.toDate ? a.data_termino_prevista.toDate() : a.data_termino_prevista;
            const statusBadge = a.status === 'Ativo' ? 'bg-danger' : 'bg-success';
            const dias = calcularDiferencaDias(a.data_inicio, a.data_termino_prevista);

            let acoesHTML = `
                <button class="btn btn-sm btn-outline-primary" onclick="editarAfastamento('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirAfastamento('${a.id}')"><i class="fas fa-trash"></i></button>
            `;

            // Se o afastamento requer INSS e ainda está pendente, mostra o botão de encaminhamento
            if (a.requerINSS && a.inssStatus === 'Pendente') {
                acoesHTML = `
                    <button class="btn btn-sm btn-warning" onclick="abrirModalEncaminhamentoINSS('${a.id}')"><i class="fas fa-exclamation-triangle"></i> Encaminhar INSS</button>
                    <button class="btn btn-sm btn-outline-primary" onclick="editarAfastamento('${a.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirAfastamento('${a.id}')"><i class="fas fa-trash"></i></button>
                `;
            }

            const empresaNome = empMap.get(a.empresaId) || '-';
            
            const row = `
                <tr>
                    <td>${empresaNome} / ${a.setor || '-'}</td>
                    <td>${a.colaborador_nome || '-'}</td>
                    <td>${formatarData(inicio)}</td>
                    <td>${dias}</td>
                    <td>${a.tipo_afastamento || '-'}</td>
                    <td><span class="badge ${statusBadge}">${a.status}</span></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="verDetalhesAfastamento('${a.id}')"><i class="fas fa-eye"></i></button>
                            ${a.status === 'Ativo' && !a.requerINSS ? `<button class="btn btn-outline-success" onclick="darBaixaAfastamento('${a.id}')"><i class="fas fa-check-circle"></i> Dar Baixa</button>` : ''}
                            ${acoesHTML}
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (e) {
        console.error('Erro ao carregar afastamentos:', e);
        mostrarMensagem('Erro ao carregar afastamentos', 'error');
    }
}

function abrirModalEncaminhamentoINSS(afastamentoId) {
    const modalId = 'inssModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Encaminhamento ao INSS</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">Atestado é superior a 15 dias ou o mesmo colaborador tem atestados que somam mais de 15 dias no mesmo período, proceda com o encaminhamento ao INSS!</div>
                        <form id="form-inss">
                            <input type="hidden" id="inss-afastamento-id">
                            <div class="mb-3">
                                <label class="form-label">Data de encaminhamento ao INSS</label>
                                <input type="date" class="form-control" id="inss-data-encaminhamento" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Número do Protocolo</label>
                                <input type="text" class="form-control" id="inss-protocolo" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Data da Perícia</label>
                                <input type="date" class="form-control" id="inss-data-pericia">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEncaminhamentoINSS()">Salvar Encaminhamento</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('form-inss').reset();
    document.getElementById('inss-afastamento-id').value = afastamentoId;
    document.getElementById('inss-data-encaminhamento').valueAsDate = new Date();
    document.getElementById('inss-data-pericia').value = ''; // Limpa a data da perícia

    new bootstrap.Modal(modalEl).show();
}

async function salvarEncaminhamentoINSS() {
    const afastamentoId = document.getElementById('inss-afastamento-id').value;
    const dataEncaminhamento = document.getElementById('inss-data-encaminhamento').value;
    const protocolo = document.getElementById('inss-protocolo').value.trim();
    const dataPericia = document.getElementById('inss-data-pericia').value;

    if (!dataEncaminhamento || !protocolo) {
        mostrarMensagem("Preencha a data de encaminhamento e o número do protocolo.", "warning");
        return;
    }

    try {
        const updateData = {
            inssStatus: 'Encaminhado',            
            inssDataEncaminhamento: new Date(dataEncaminhamento.replace(/-/g, '\/')),
            inssProtocolo: protocolo
        };
        if (dataPericia) {
            updateData.inssDataPericia = new Date(dataPericia);
        }

        await db.collection('afastamentos').doc(afastamentoId).update(updateData);

        mostrarMensagem("Encaminhamento ao INSS registrado com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('inssModal')).hide();
        await carregarAfastamentos();

    } catch (error) {
        console.error("Erro ao salvar encaminhamento INSS:", error);
        mostrarMensagem("Erro ao salvar os dados do encaminhamento.", "error");
    }
}

async function carregarAlertasPericia() {
    const container = document.getElementById('pericias-proximas-container');
    if (!container) return;

    try {
        const hoje = new Date();
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 10); // Busca em uma janela maior para contar dias úteis

        const snap = await db.collection('afastamentos')
            .where('requerINSS', '==', true)
            .where('inssDataPericia', '>=', hoje)
            .where('inssDataPericia', '<=', dataLimite)
            .get();

        const alertas = [];

        snap.forEach(doc => {
            const afastamento = doc.data();
            const dataPericia = afastamento.inssDataPericia.toDate();
            const diasUteis = calcularDiasUteis(hoje, dataPericia);

            if (diasUteis <= 5) {
                alertas.push({
                    nome: afastamento.colaborador_nome,
                    dataPericia: dataPericia,
                    diasUteis: diasUteis
                });
            }
        });

        if (alertas.length === 0) {
            container.innerHTML = '<p class="text-muted m-2">Nenhum alerta de perícia nos próximos 5 dias úteis.</p>';
            return;
        }

        container.innerHTML = alertas.sort((a, b) => a.dataPericia - b.dataPericia).map(alerta => `
            <div class="alert alert-light d-flex justify-content-between align-items-center p-2 m-1">
                <div>
                    <strong>${alerta.nome}</strong>
                    <br>
                    <small>Data da Perícia: ${alerta.dataPericia.toLocaleDateString('pt-BR')}</small>
                </div>
                <span class="badge bg-danger">${alerta.diasUteis} dia(s) útil(eis)</span>
            </div>
        `).join('');

    } catch (error) {
        console.error("Erro ao carregar alertas de perícia:", error);
        container.innerHTML = '<p class="text-danger m-2">Erro ao carregar alertas.</p>';
    }
}

function calcularDiasUteis(data1, data2) {
    let diasUteis = 0;
    let dataAtual = new Date(data1);
    while (dataAtual <= data2) {
        const diaSemana = dataAtual.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) { // Não é domingo nem sábado
            diasUteis++;
        }
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return diasUteis;
}

// Função para calcular a diferença de dias
function calcularDiferencaDias(dataInicio, dataFim) {
    if (!dataInicio) return '-';
    try {
        const inicio = dataInicio.toDate ? dataInicio.toDate() : new Date(dataInicio);
        const fim = dataFim ? (dataFim.toDate ? dataFim.toDate() : new Date(dataFim)) : new Date();
        
        const diffTime = Math.abs(fim - inicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch {
        return '-';
    }
}

// Funções placeholder para evitar erros
async function verDetalhesAfastamento(id) {
    const afastamento = __afastamentos_cache.find(a => a.id === id);
    alert(`Detalhes para: ${afastamento.colaborador_nome}\nMotivo: ${afastamento.motivo || 'Não informado'}`);
}

async function darBaixaAfastamento(id) {
    if (!confirm('Confirma dar baixa neste afastamento?')) return;
    
    try {
        await db.collection('afastamentos').doc(id).update({ 
            status: 'Encerrado', 
            updatedAt: timestamp() 
        });
        
        mostrarMensagem('Afastamento encerrado com sucesso!');
        await carregarAfastamentos();
    } catch(e) {
        console.error('Erro ao encerrar afastamento:', e);
        mostrarMensagem('Erro ao encerrar afastamento', 'error');
    }
}

async function editarAfastamento(afastamentoId) {
    const afastamento = __afastamentos_cache.find(a => a.id === afastamentoId);
    if (!afastamento) {
        mostrarMensagem('Afastamento não encontrado.', 'error');
        return;
    }

    // Abre o modal (que será criado se não existir) e popula os campos
    abrirModalNovoAfastamento();

    // Aguarda um instante para o modal ser renderizado
    setTimeout(async () => {
        document.querySelector('#afastamentoModal .modal-title').textContent = 'Editar Afastamento';
        
        // Preenche os campos com os dados do afastamento
        document.getElementById('af_inicio').value = formatarDataParaInput(afastamento.data_inicio);
        document.getElementById('af_fim').value = formatarDataParaInput(afastamento.data_termino_prevista);
        document.getElementById('af_tipo').value = afastamento.tipo_afastamento;
        document.getElementById('af_motivo').value = afastamento.motivo || '';

        // Seleciona o funcionário e desabilita a troca
        const funcSelect = document.getElementById('af_func');
        funcSelect.value = afastamento.funcionarioId;
        funcSelect.disabled = true; // Impede a troca de funcionário na edição
        funcSelect.dispatchEvent(new Event('change')); // Dispara o evento para carregar CPF, empresa e setor

        // Altera o botão para "Atualizar"
        const btnSalvar = document.querySelector('#afastamentoModal .btn-primary');
        btnSalvar.textContent = 'Atualizar Afastamento';
        btnSalvar.onclick = () => atualizarAfastamento(afastamentoId);
    }, 500); // Um pequeno delay para garantir que os selects foram populados
}

async function atualizarAfastamento(afastamentoId) {
    try {
        const updateData = {
            data_inicio: new Date(document.getElementById('af_inicio').value.replace(/-/g, '\/')),
            data_termino_prevista: new Date(document.getElementById('af_fim').value.replace(/-/g, '\/')),
            tipo_afastamento: document.getElementById('af_tipo').value,
            motivo: document.getElementById('af_motivo').value.trim(),
            updatedAt: timestamp()
        };

        await db.collection('afastamentos').doc(afastamentoId).update(updateData);
        mostrarMensagem('Afastamento atualizado com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('afastamentoModal')).hide();
        await carregarAfastamentos();
    } catch (e) {
        console.error('Erro ao atualizar afastamento:', e);
        mostrarMensagem('Erro ao atualizar afastamento.', 'error');
    }
}

async function excluirAfastamento(id) {
    if (!confirm("Confirma a exclusão deste afastamento?")) return;
    try {
        await db.collection('afastamentos').doc(id).delete();
        mostrarMensagem("Afastamento excluído.", "info");
        await carregarAfastamentos();
    } catch (e) {
        mostrarMensagem("Erro ao excluir afastamento.", "error");
    }
}

// Inicializar eventos
document.addEventListener('DOMContentLoaded', function() {
    const btnNovo = document.getElementById('btn-novo-afastamento');
    if (btnNovo) btnNovo.addEventListener('click', abrirModalNovoAfastamento);
    carregarAfastamentos(); // Carrega os afastamentos ao inicializar
});

// Adiciona uma função utilitária para formatar datas para inputs do tipo 'date'
document.addEventListener('DOMContentLoaded', function() {
    if (typeof formatarDataParaInput === 'undefined') {
        window.formatarDataParaInput = (data) => data ? (data.toDate ? data.toDate() : new Date(data)).toISOString().split('T')[0] : '';
    }
});

// Abrir modal de novo afastamento
function abrirModalNovoAfastamento() {
    const modalId = 'afastamentoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = modalId;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Novo Afastamento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-afastamento">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Colaborador</label>
                                    <select class="form-select" id="af_func" required></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">CPF</label>
                                    <input type="text" class="form-control" id="af_cpf" readonly />
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Empresa</label>
                                    <select class="form-select" id="af_empresa"></select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Setor</label>
                                    <select class="form-select" id="af_setor"></select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Início</label>
                                    <input type="date" class="form-control" id="af_inicio" required />
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Término Previsto</label>
                                    <input type="date" class="form-control" id="af_fim" required />
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Tipo</label>
                                    <select class="form-select" id="af_tipo" required>
                                        <option value="">Selecione</option>
                                        <option value="Doença">Doença</option>
                                        <option value="Acidente">Acidente</option>
                                        <option value="Maternidade">Maternidade</option>
                                        <option value="Outros">Outros</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Motivo</label>
                                    <textarea class="form-control" id="af_motivo" rows="2"></textarea>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarNovoAfastamento()">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    // Reseta o estado do modal para "Novo Afastamento" toda vez que é aberto
    const form = document.getElementById('form-afastamento');
    if (form) {
        form.reset();
    }
    const modalTitle = document.querySelector('#afastamentoModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Novo Afastamento';
    }
    document.getElementById('af_func').disabled = false;
    const btnSalvar = document.querySelector('#afastamentoModal .btn-primary');
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvar';
        btnSalvar.onclick = salvarNovoAfastamento;
    }

    // Popular empresas e setores
    (async () => {
        const selEmp = document.getElementById('af_empresa');
        const selSet = document.getElementById('af_setor');
        const selFunc = document.getElementById('af_func');

        if (selEmp) {
            selEmp.innerHTML = '<option value="">Selecione</option>';
            const empSnap = await db.collection('empresas').get();

            empSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = doc.data().nome;
                selEmp.appendChild(opt);
            });

            selEmp.addEventListener('change', async function() {
                selSet.innerHTML = '<option value="">Selecione o setor</option>';
                selSet.disabled = true;
                const id = this.value;
                if (!id) return;

                const edoc = await db.collection('empresas').doc(id).get();
                const setores = Array.isArray(edoc.data()?.setores) ? edoc.data().setores : [];

                setores.forEach(s => {
                    const o = document.createElement('option');
                    o.value = s;
                    o.textContent = s;
                    selSet.appendChild(o);
                });

                selSet.disabled = setores.length === 0;
            });
        }

        // Carregar funcionarios e bind
        if (selFunc) {
            selFunc.innerHTML = '<option value="">Selecione</option>';
            const fsnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
            const funcs = fsnap.docs.map(d => ({ id: d.id, ...d.data() }));

            funcs.forEach(f => {
                const o = document.createElement('option');
                o.value = f.id;
                o.textContent = f.nome;
                selFunc.appendChild(o);
            });

            selFunc.addEventListener('change', async function() {
                const id = this.value;
                if (!id) return;

                const f = funcs.find(x => x.id === id);
                if (!f) return;

                document.getElementById('af_cpf').value = f.cpf || '';

                // Set empresa
                if (selEmp && f.empresaId) {
                    selEmp.value = f.empresaId;

                    const edoc = await db.collection('empresas').doc(f.empresaId).get();
                    const setores = Array.isArray(edoc.data()?.setores) ? edoc.data().setores : [];

                    selSet.innerHTML = '<option value="">Selecione o setor</option>';
                    setores.forEach(s => {
                        const o = document.createElement('option');
                        o.value = s;
                        o.textContent = s;
                        selSet.appendChild(o);
                    });

                    selSet.disabled = setores.length === 0;
                    if (f.setor) selSet.value = f.setor;
                }
            });
        }

        // Data padrão
        const inicioInput = document.getElementById('af_inicio');
        const fimInput = document.getElementById('af_fim');
        if (inicioInput) inicioInput.valueAsDate = new Date();
        if (fimInput) fimInput.valueAsDate = new Date();

    })();

    new bootstrap.Modal(modalEl).show();
}

// Salvar novo afastamento
async function salvarNovoAfastamento() {
    try {
        const funcSelect = document.getElementById('af_func');
        const funcId = funcSelect.value;
        const funcionarioNome = funcSelect.options[funcSelect.selectedIndex]?.text || '';
        const cpf = document.getElementById('af_cpf').value.trim();
        const empresaId = document.getElementById('af_empresa').value;
        const setor = document.getElementById('af_setor').value;
        const inicio = document.getElementById('af_inicio').value;
        const fim = document.getElementById('af_fim').value;
        const tipo = document.getElementById('af_tipo').value;
        const motivo = document.getElementById('af_motivo').value.trim();

        if (!funcionarioNome || !cpf || !inicio || !fim || !tipo) {
            mostrarMensagem('Preencha os campos obrigatórios', 'warning');
            return;
        }

        const inicioDate = new Date(inicio.replace(/-/g, '\/'));
        const fimDate = new Date(fim.replace(/-/g, '\/'));

        if (isNaN(inicioDate) || isNaN(fimDate) || fimDate <= inicioDate) {
            mostrarMensagem('Datas inválidas', 'warning');
            return;
        }

        const user = firebase.auth().currentUser;

        await db.collection('afastamentos').add({
            colaborador_nome: funcionarioNome,
            funcionarioId: funcId,
            cpf: cpf,
            empresaId: empresaId || null,
            setor: setor || null,
            data_inicio: inicioDate,
            data_termino_prevista: fimDate,
            tipo_afastamento: tipo,
            motivo: motivo || null,
            status: 'Ativo',
            criado_em: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user ? user.uid : null
        });

        mostrarMensagem('Afastamento cadastrado com sucesso!');
        const modalEl = document.getElementById('afastamentoModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        await carregarAfastamentos();
    } catch (e) {
        console.error('Erro ao salvar afastamento:', e);
        mostrarMensagem('Erro ao salvar afastamento', 'error');
    }
}

// Função para mostrar mensagens (assumindo que existe)
function mostrarMensagem(mensagem, tipo = 'success') {
    // Implementação básica - adapte conforme sua aplicação
    alert(`${tipo.toUpperCase()}: ${mensagem}`);
}

// Função genérica para abrir um modal com título e corpo customizados
function abrirModalGenerico(titulo, corpo) {
    const modalId = 'modalGenerico';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title" id="modalGenericoTitulo"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body" id="modalGenericoCorpo"></div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('modalGenericoTitulo').textContent = titulo;
    document.getElementById('modalGenericoCorpo').innerHTML = corpo;
    new bootstrap.Modal(modalEl).show();
}