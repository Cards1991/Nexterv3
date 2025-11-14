// Gerenciamento de Chamados de Manutenção - ISO 9001
let __chamados_cache = []; // Cache para impressão
let __unsubscribe_manutencao = null; // Para parar o listener do snapshot

async function inicializarManutencao() {
    try {
        const btnNovo = document.getElementById('btn-novo-chamado-manutencao');
        if (btnNovo && !btnNovo.__bound) {
            btnNovo.addEventListener('click', () => abrirModalChamado(null));
            btnNovo.__bound = true;
        }
        const btnFiltrar = document.getElementById('btn-filtrar-manutencao');
        if (btnFiltrar && !btnFiltrar.__bound) {
            btnFiltrar.addEventListener('click', carregarChamadosManutencao);
            btnFiltrar.__bound = true;
        }
        await carregarChamadosManutencao();
    } catch (e) {
        console.error("Erro ao inicializar módulo de manutenção:", e);
        mostrarMensagem("Erro ao carregar módulo de manutenção", "error");
    }
}

async function carregarChamadosManutencao() {
    // Se já existe um listener, remove para criar um novo com os filtros
    if (__unsubscribe_manutencao) {
        __unsubscribe_manutencao();
    }

    const tbody = document.getElementById('tabela-chamados-manutencao');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try { // Obter dados das máquinas para saber quais são críticas
        const maquinasSnap = await db.collection('maquinas').get();
        const maquinasCriticas = new Map(maquinasSnap.docs.map(doc => [doc.data().codigo, doc.data().isCritica || false]));

        let query = db.collection('manutencao_chamados');

        const dataInicio = document.getElementById('filtro-manut-inicio').value;
        const dataFim = document.getElementById('filtro-manut-fim').value;

        if (dataInicio) {
            query = query.where('dataAbertura', '>=', new Date(dataInicio));
        }
        if (dataFim) {
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999);
            query = query.where('dataAbertura', '<=', fim);
        }

        __unsubscribe_manutencao = query.orderBy('dataAbertura', 'desc').onSnapshot(snap => {

        let chamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Mapeamento de prioridades para ordenação
        const prioridadeValor = { 'Urgente': 1, 'Prioritário': 2, 'Normal': 3 };

        // Lógica de Ordenação com Prioridades
        chamados.sort((a, b) => {
            // 1. Máquina Parada tem a maior prioridade
            if (a.maquinaParada && !b.maquinaParada) return -1;
            if (!a.maquinaParada && b.maquinaParada) return 1;

            // 2. Ordenar por Prioridade
            const prioridadeA = prioridadeValor[a.prioridade || 'Normal'] || 3;
            const prioridadeB = prioridadeValor[b.prioridade || 'Normal'] || 3;
            if (prioridadeA < prioridadeB) return -1;
            if (prioridadeA > prioridadeB) return 1;

            // 3. Máquina Crítica é a próxima prioridade
            const aIsCritica = maquinasCriticas.get(a.maquinaId) || false;
            const bIsCritica = maquinasCriticas.get(b.maquinaId) || false;
            if (aIsCritica && !bIsCritica) return -1;
            if (!aIsCritica && bIsCritica) return 1;

            // 4. Por fim, ordena pela data de abertura
            // Adicionada verificação para evitar erro se dataAbertura for nulo
            const timeA = a.dataAbertura?.toMillis() || 0;
            const timeB = b.dataAbertura?.toMillis() || 0;
            
            return timeB - timeA;
        });

        __chamados_cache = chamados;

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum chamado de manutenção aberto.</td></tr>';
            renderizarMetricasManutencao([]);
            return;
        }

        tbody.innerHTML = '';
        chamados.forEach(chamado => {
            const abertura = chamado.dataAbertura?.toDate();
            const encerramento = chamado.dataEncerramento?.toDate();
            const isCritica = maquinasCriticas.get(chamado.maquinaId) || false;

            // Define a classe da linha para destacar chamados críticos ou parados
            const rowClass = chamado.maquinaParada ? 'table-danger' : (isCritica ? 'table-warning' : '');

            let statusBadge;
            switch (chamado.status) {
                case 'Aberto':
                    statusBadge = '<span class="badge bg-danger">Aberto</span>';
                    break;
                case 'Concluído':
                    statusBadge = '<span class="badge bg-success">Concluído</span>';
                    break;
                case 'Em Andamento':
                    statusBadge = '<span class="badge bg-info">Em Andamento</span>';
                    break;
                default:
                    statusBadge = `<span class="badge bg-secondary">${chamado.status}</span>`;
            }
            
            // Define a cor do badge de prioridade
            let prioridadeBadgeClass = 'bg-secondary';
            switch(chamado.prioridade) {
                case 'Urgente': prioridadeBadgeClass = 'bg-danger'; break;
                case 'Prioritário': prioridadeBadgeClass = 'bg-warning text-dark'; break;
                case 'Normal': prioridadeBadgeClass = 'bg-success'; break;
            }

            let prioridadeConteudo;
            if (chamado.status === 'Aberto' || chamado.status === 'Em Andamento') {
                prioridadeConteudo = `
                    <select class="form-select form-select-sm ${prioridadeBadgeClass}" style="max-width: 120px; line-height: 1;" onchange="atualizarPrioridade('${chamado.id}', this.value)">
                        <option value="Normal" ${chamado.prioridade === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="Prioritário" ${chamado.prioridade === 'Prioritário' ? 'selected' : ''}>Prioritário</option>
                        <option value="Urgente" ${chamado.prioridade === 'Urgente' ? 'selected' : ''}>Urgente</option>
                    </select>`;
            } else {
                prioridadeConteudo = ''; // Deixa o campo em branco para chamados concluídos
            }

            let tempoParadaConteudo;
            if (chamado.maquinaParada) {
                if (isCritica) {
                    tempoParadaConteudo = '<strong class="text-danger">ALERTA MÁXIMO</strong>';
                } else {
                    tempoParadaConteudo = '<strong class="text-warning">Alerta</strong>';
                }
            } else {
                tempoParadaConteudo = chamado.tempoParada || '-';
            }

            const row = `
                <tr class="${rowClass}">
                    <td>
                        ${chamado.maquinaId}
                        ${isCritica ? '<span class="badge bg-dark ms-1" title="Máquina Crítica">Crítica</span>' : ''}
                    </td>
                    <td>${chamado.motivo}</td>
                    <td>${abertura ? abertura.toLocaleString('pt-BR') : '-'}</td>
                    <td>${encerramento ? encerramento.toLocaleString('pt-BR') : '-'}</td>
                    <td>${tempoParadaConteudo}</td>
                    <td>${prioridadeConteudo}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end">
                        <button class="btn btn-outline-secondary" title="Imprimir Chamado" onclick="imprimirChamado('${chamado.id}')"><i class="fas fa-print"></i></button>
                        ${chamado.status === 'Aberto' ? `<button class="btn btn-outline-info" title="Iniciar Atendimento" onclick="iniciarAtendimento('${chamado.id}')"><i class="fas fa-play-circle"></i></button>` : ''}
                        ${chamado.status === 'Aberto' || chamado.status === 'Em Andamento' ? `<button class="btn btn-outline-success" title="Finalizar Chamado" onclick="abrirModalFinalizar('${chamado.id}')"><i class="fas fa-check-circle"></i></button>` : ''}
                        <button class="btn btn-outline-danger" title="Excluir Chamado" onclick="excluirChamado('${chamado.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        renderizarMetricasManutencao(__chamados_cache);
    });
    } catch (error) {
        console.error("Erro ao carregar chamados de manutenção:", error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro ao carregar chamados.</td></tr>';
    }
}

function renderizarMetricasManutencao(chamados) {
    const container = document.getElementById('metricas-manutencao');
    if (!container) return;

    const abertos = chamados.filter(c => c.status === 'Aberto' || c.status === 'Em Andamento').length;
    const concluidos = chamados.filter(c => c.status === 'Concluído').length;

    container.innerHTML = `
        <div class="col-md-6 mb-4">
            <div class="card stat-card"><div class="card-body"><i class="fas fa-exclamation-circle text-danger"></i><div class="number">${abertos}</div><div class="label">Chamados em Aberto</div></div></div></div>
        <div class="col-md-6 mb-4">
            <div class="card stat-card"><div class="card-body"><i class="fas fa-check-circle text-success"></i><div class="number">${concluidos}</div><div class="label">Chamados Concluídos no Período</div></div></div></div>
    `;
}

async function abrirModalChamado(chamadoId = null) {
    const modalId = 'manutencaoChamadoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Abrir Chamado de Manutenção</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-chamado-manutencao">
                            <input type="hidden" id="chamado-id">
                            <div class="mb-3">
                                <label class="form-label">Máquina</label>
                                <select class="form-select" id="chamado-maquina" required></select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Motivo da Manutenção</label>
                                <input type="text" class="form-control" id="chamado-motivo" placeholder="Ex: Vazamento de óleo, falha no motor" required>
                            </div>
                             <div class="mb-3">
                                <label class="form-label">Observações</label>
                                <textarea class="form-control" id="chamado-obs" rows="3"></textarea>
                            </div>
                            <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" id="chamado-maquina-parada">
                                <label class="form-check-label" for="chamado-maquina-parada">A máquina está parada?</label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarChamado()">Salvar Chamado</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('form-chamado-manutencao').reset();
    document.getElementById('chamado-id').value = chamadoId || '';

    // Popular select de máquinas
    const maquinaSelect = document.getElementById('chamado-maquina');
    maquinaSelect.innerHTML = '<option value="">Carregando máquinas...</option>';
    
    const maquinasSnap = await db.collection('maquinas').orderBy('nome').get();
    maquinaSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
    maquinasSnap.forEach(doc => {
        const maquina = doc.data();
        // Usamos o CÓDIGO como valor, que é o identificador único para o QR Code
        maquinaSelect.innerHTML += `<option value="${maquina.codigo}">${maquina.nome} (Cód: ${maquina.codigo})</option>`;
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarChamado() {
    const maquinaId = document.getElementById('chamado-maquina').value;
    const motivo = document.getElementById('chamado-motivo').value;
    const observacoes = document.getElementById('chamado-obs').value;
    const maquinaParada = document.getElementById('chamado-maquina-parada').checked;

    if (!maquinaId || !motivo) {
        mostrarMensagem("Selecione a máquina e descreva o motivo.", "warning");
        return;
    }

    try {
        const chamadoData = {
            maquinaId,
            motivo,
            observacoes,
            maquinaParada,
            paradaInicioTimestamp: maquinaParada ? firebase.firestore.FieldValue.serverTimestamp() : null,
            prioridade: 'Normal', // Prioridade padrão
            status: 'Aberto',
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            dataEncerramento: null,
            tempoParada: null,
            pecasUtilizadas: null,
            tipoManutencao: null,
            mecanicoResponsavelNome: null,
            createdByUid: firebase.auth().currentUser?.uid
        };

        await db.collection('manutencao_chamados').add(chamadoData);

        mostrarMensagem("Chamado de manutenção aberto com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('manutencaoChamadoModal')).hide();
        await carregarChamadosManutencao();

    } catch (error) {
        console.error("Erro ao salvar chamado:", error);
        mostrarMensagem("Erro ao abrir chamado.", "error");
    }
}

async function atualizarPrioridade(chamadoId, novaPrioridade) {
    try {
        await db.collection('manutencao_chamados').doc(chamadoId).update({
            prioridade: novaPrioridade
        });
        // A tabela será reordenada e atualizada automaticamente pelo onSnapshot
        mostrarMensagem("Prioridade atualizada!", "info");
    } catch (error) {
        console.error("Erro ao atualizar prioridade:", error);
        mostrarMensagem("Falha ao atualizar a prioridade.", "error");
    }
}

async function iniciarAtendimento(chamadoId) {
    const modalId = 'iniciarAtendimentoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Iniciar Atendimento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="iniciar-atendimento-id">
                        <div class="mb-3">
                            <label class="form-label">Mecânico Responsável</label>
                            <select class="form-select" id="iniciar-atendimento-mecanico" required></select>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <div id="pergunta-parada-container">
                                <input class="form-check-input" type="checkbox" id="iniciar-atendimento-parada-check">
                                <label class="form-check-label" for="iniciar-atendimento-parada-check">A manutenção exigirá que a máquina pare?</label>
                            </div>
                        </div>
                        <div class="mb-3" id="parada-prevista-container" style="display: none;">
                            <label class="form-label">Previsão de Início da Parada</label>
                            <input type="datetime-local" class="form-control" id="parada-inicio-previsto">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="confirmarInicioAtendimento()">Confirmar Início</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Adiciona o listener para o checkbox
        const paradaCheck = document.getElementById('iniciar-atendimento-parada-check');
        paradaCheck.addEventListener('change', function() {
            const container = document.getElementById('parada-prevista-container');
            const input = document.getElementById('parada-inicio-previsto');
            container.style.display = this.checked ? 'block' : 'none';
            input.disabled = !this.checked;
        });
    }

    // Resetar o formulário do modal
    document.getElementById('iniciar-atendimento-id').value = chamadoId;
    const paradaCheck = document.getElementById('iniciar-atendimento-parada-check');
    paradaCheck.checked = false;
    paradaCheck.disabled = false;
    document.getElementById('parada-prevista-container').style.display = 'none';
    document.getElementById('parada-inicio-previsto').value = '';
    document.getElementById('parada-inicio-previsto').disabled = true;

    // Popular select de mecânicos
    const mecanicoSelect = document.getElementById('iniciar-atendimento-mecanico');
    mecanicoSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
        const mecanicosSnap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();
        mecanicoSelect.innerHTML = '<option value="">Selecione o mecânico</option>';
        mecanicosSnap.forEach(doc => {
            mecanicoSelect.innerHTML += `<option value="${doc.id}" data-nome="${doc.data().nome}">${doc.data().nome}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar mecânicos:", error);
        mecanicoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    // VERIFICAÇÃO DA MÁQUINA PARADA
    const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
    const perguntaContainer = document.getElementById('pergunta-parada-container');

    if (chamadoDoc.exists && chamadoDoc.data().maquinaParada) {
        perguntaContainer.style.display = 'none'; // Esconde a pergunta
    } else {
        perguntaContainer.style.display = 'block'; // Mostra a pergunta
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function confirmarInicioAtendimento() {
    const chamadoId = document.getElementById('iniciar-atendimento-id').value;
    const mecanicoSelect = document.getElementById('iniciar-atendimento-mecanico');
    const mecanicoId = mecanicoSelect.value;
    const mecanicoNome = mecanicoSelect.options[mecanicoSelect.selectedIndex].dataset.nome;

    const precisaParar = document.getElementById('iniciar-atendimento-parada-check').checked;
    const inicioPrevisto = document.getElementById('parada-inicio-previsto').value;

    if (!mecanicoId) {
        mostrarMensagem("Selecione o mecânico responsável.", "warning");
        return;
    }

    if (precisaParar && !inicioPrevisto) {
        mostrarMensagem("Se a máquina precisa parar, informe a data e hora previstas para o início da parada.", "warning");
        return;
    }

    try {
        const updateData = {
            status: 'Em Andamento',
            mecanicoResponsavelId: mecanicoId,
            mecanicoResponsavelNome: mecanicoNome
        };

        if (precisaParar) {
            updateData.maquinaParada = true;
            // Apenas atualiza o timestamp se ele ainda não existir (para não sobrescrever o da abertura)
            const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
            if (!chamadoDoc.data().paradaInicioTimestamp) {
                updateData.paradaInicioTimestamp = new Date(inicioPrevisto);
            }
        }

        const chamadoRef = db.collection('manutencao_chamados').doc(chamadoId);
        await chamadoRef.update(updateData);

        mostrarMensagem("Atendimento iniciado com sucesso!", "info");
        bootstrap.Modal.getInstance(document.getElementById('iniciarAtendimentoModal')).hide();
    } catch (error) {
        console.error("Erro ao iniciar atendimento:", error);
        mostrarMensagem("Erro ao atualizar o status do chamado.", "error");
    }
}

async function abrirModalFinalizar(chamadoId) {
    const modalId = 'finalizarChamadoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Finalizar Chamado de Manutenção</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="finalizar-chamado-id">
                        <div class="mb-3">
                            <label class="form-label">Tipo de Manutenção Realizada</label>
                            <select class="form-select" id="finalizar-tipo-manutencao" required>
                                <option value="">Selecione...</option>
                                <option>Corretiva</option>
                                <option>Preventiva</option>
                                <option>Preditiva</option>
                                <option>Melhoria</option>
                                <option>Ajuste Operacional</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Observações do Mecânico</label>
                            <textarea class="form-control" id="finalizar-obs" rows="4" placeholder="Descreva o serviço realizado, peças trocadas, etc."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Peças Utilizadas (opcional)</label>
                            <textarea class="form-control" id="finalizar-pecas" rows="3" placeholder="Ex: 1x Rolamento 6203, 2m de Correia XPTO..."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Mecânico Responsável</label>
                            <select class="form-select" id="finalizar-mecanico" required></select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="finalizarChamado()">Finalizar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    // Preencher dados do chamado no modal de finalização
    const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
    if (chamadoDoc.exists) {
        const chamadoData = chamadoDoc.data();
        // Se a máquina estava parada, o campo de observações do mecânico se torna obrigatório
        const obsMecanicoInput = document.getElementById('finalizar-obs');
        obsMecanicoInput.required = chamadoData.maquinaParada || false;
    }

    document.getElementById('finalizar-chamado-id').value = chamadoId;
    document.getElementById('finalizar-tipo-manutencao').value = '';
    document.getElementById('finalizar-obs').value = '';
    document.getElementById('finalizar-pecas').value = '';

    // Popular select de mecânicos
    const mecanicoSelect = document.getElementById('finalizar-mecanico');
    mecanicoSelect.innerHTML = '<option value="">Carregando...</option>';
    const mecanicosSnap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();
    mecanicoSelect.innerHTML = '<option value="">Selecione o mecânico</option>';
    mecanicosSnap.forEach(doc => {
        const funcionario = doc.data();
        mecanicoSelect.innerHTML += `<option value="${doc.id}">${funcionario.nome}</option>`;
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function finalizarChamado() {
    const chamadoId = document.getElementById('finalizar-chamado-id').value;
    const tipoManutencao = document.getElementById('finalizar-tipo-manutencao').value;
    const observacoesMecanico = document.getElementById('finalizar-obs').value;
    const pecasUtilizadas = document.getElementById('finalizar-pecas').value;
    const mecanicoSelect = document.getElementById('finalizar-mecanico');
    const mecanicoId = mecanicoSelect.value;
    const mecanicoNome = mecanicoSelect.options[mecanicoSelect.selectedIndex].text;

    if (!tipoManutencao) {
        mostrarMensagem("Selecione o tipo de manutenção realizada.", "warning");
        return;
    }

    if (!mecanicoId) {
        mostrarMensagem("Selecione o mecânico responsável.", "warning");
        return;
    }
    
    if (document.getElementById('finalizar-obs').required && !observacoesMecanico) {
        mostrarMensagem("Para chamados com 'Máquina Parada', a observação do mecânico é obrigatória.", "warning");
        return;
    }

    try {
        const btn = document.querySelector('#finalizarChamadoModal .btn-success');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';

        const chamadoRef = db.collection('manutencao_chamados').doc(chamadoId);
        const doc = await chamadoRef.get();
        if (!doc.exists) throw new Error("Chamado não encontrado");

        const chamado = doc.data();
        const dataEncerramento = new Date();
        let tempoParada = null;

        // Calcula o tempo de parada apenas se houver um timestamp de início de parada.
        if (chamado.paradaInicioTimestamp) {
            tempoParada = calcularTempoDeParada(new Date(chamado.paradaInicioTimestamp), dataEncerramento);
        }

        await chamadoRef.update({
            status: 'Concluído',
            maquinaParada: false, // Ao concluir, o alerta de máquina parada é desativado.
            dataEncerramento: dataEncerramento,
            tempoParada: tempoParada,
            tipoManutencao: tipoManutencao,
            observacoesMecanico: observacoesMecanico,
            pecasUtilizadas: pecasUtilizadas || null,
            mecanicoResponsavelId: mecanicoId,
            mecanicoResponsavelNome: mecanicoNome
        });

        mostrarMensagem("Chamado encerrado com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('finalizarChamadoModal')).hide();
        // A tabela irá se atualizar sozinha por causa do onSnapshot

    } catch (error) {
        console.error("Erro ao finalizar chamado:", error);
        mostrarMensagem("Erro ao finalizar o chamado.", "error");
    } finally {
        const btn = document.querySelector('#finalizarChamadoModal .btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Finalizar';
        }
    }
}

async function excluirChamado(chamadoId) {
    if (!confirm("Tem certeza que deseja excluir este chamado permanentemente?")) {
        return;
    }
    try {
        await db.collection('manutencao_chamados').doc(chamadoId).delete();
        mostrarMensagem("Chamado excluído.", "info");
        // A tabela irá se atualizar sozinha por causa do onSnapshot
    } catch (error) {
        console.error("Erro ao excluir chamado:", error);
        mostrarMensagem("Erro ao excluir o chamado.", "error");
    }
}

function calcularTempoDeParada(inicio, fim) {
    let diffMs = fim - inicio;
    const horas = Math.floor(diffMs / 3600000);
    diffMs -= horas * 3600000;
    const minutos = Math.floor(diffMs / 60000);

    let resultado = '';
    if (horas > 0) resultado += `${horas}h `;
    if (minutos > 0) resultado += `${minutos}m`;

    return resultado.trim() || 'Menos de 1m';
}

async function imprimirChamado(chamadoId) {
    const chamado = __chamados_cache.find(c => c.id === chamadoId);
    if (!chamado) {
        mostrarMensagem("Chamado não encontrado para impressão.", "error");
        return;
    }

    const dataAbertura = chamado.dataAbertura?.toDate()?.toLocaleString('pt-BR') || 'N/A';
    const dataEncerramento = chamado.dataEncerramento?.toDate()?.toLocaleString('pt-BR') || 'Pendente';

    // Buscar o número do patrimônio da máquina
    let patrimonio = 'N/A';
    try {
        const maquinaSnap = await db.collection('maquinas').where('codigo', '==', chamado.maquinaId).limit(1).get();
        if (!maquinaSnap.empty) {
            patrimonio = maquinaSnap.docs[0].data().patrimonio || 'N/A';
        }
    } catch (e) { console.error("Erro ao buscar patrimônio da máquina:", e); }

    const conteudo = `
        <html>
            <head>
                <title>Ordem de Manutenção - Chamado ${chamado.id.substring(0, 6)}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                    .print-container { max-width: 800px; margin: auto; padding: 20px; }
                    .os-header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #dee2e6; padding-bottom: 1rem; }
                    @page { size: A4; margin: 0; }
                    .os-header h3 { font-weight: 600; }
                    .section-title { font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 1.5rem; margin-bottom: 1rem; }
                    .field-label { font-weight: bold; color: #6c757d; }
                    .field-value { font-size: 1.1rem; }
                    .field-box { border: 1px solid #e9ecef; background-color: #f8f9fa; padding: 1rem; border-radius: .5rem; min-height: 100px; }
                    .signature-area { margin-top: 5rem; }
                    .signature-line { border-bottom: 1px solid #343a40; margin-top: 3rem; }
                    @media print {
                        body { margin: 1cm; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .alert-danger { background-color: #f8d7da !important; color: #721c24 !important; border-color: #f5c6cb !important; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="os-header">
                        <h3>ORDEM DE SERVIÇO DE MANUTENÇÃO</h3>
                        <p class="text-muted mb-0">Chamado ID: ${chamado.id.substring(0, 8).toUpperCase()}</p>
                    </div>

                    ${chamado.maquinaParada ? '<div class="alert alert-danger text-center p-3 mb-4"><h4><i class="fas fa-exclamation-triangle"></i> ATENÇÃO: MÁQUINA PARADA</h4></div>' : ''}

                    <h5 class="section-title">1. Identificação do Chamado</h5>
                    <div class="row">
                        <div class="col-4 mb-3"><div class="field-label">Máquina/Equipamento</div><div class="field-value">${chamado.maquinaId}</div></div>
                        <div class="col-4 mb-3"><div class="field-label">Nº Patrimônio</div><div class="field-value">${patrimonio}</div></div>
                        <div class="col-4 mb-3"><div class="field-label">Status</div><div class="field-value">${chamado.status}</div></div>
                        <div class="col-6 mb-3"><div class="field-label">Data de Abertura</div><div class="field-value">${dataAbertura}</div></div>
                        <div class="col-6 mb-3"><div class="field-label">Data de Encerramento</div><div class="field-value">${dataEncerramento}</div></div>
                    </div>

                    <h5 class="section-title">2. Descrição do Problema</h5>
                    <div class="field-box">${chamado.motivo}</div>

                    <h5 class="section-title">3. Detalhes da Manutenção</h5>
                    <div class="row">
                        <div class="col-6 mb-3"><div class="field-label">Tipo de Manutenção</div><div class="field-value">${chamado.tipoManutencao || 'Não informado'}</div></div>
                        <div class="col-6 mb-3"><div class="field-label">Mecânico Responsável</div><div class="field-value">${chamado.mecanicoResponsavelNome || 'Não informado'}</div></div>
                    </div>

                    <div class="mb-3">
                        <div class="field-label">Serviço Realizado / Observações</div>
                        <div class="field-box">${chamado.observacoesMecanico || 'A preencher...'}</div>
                    </div>
                    <div class="mb-3">
                        <div class="field-label">Peças Utilizadas</div>
                        <div class="field-box">${chamado.pecasUtilizadas || 'Nenhuma peça informada.'}</div>
                    </div>

                    <div class="row signature-area">
                        <div class="col-6 text-center">
                            <div class="signature-line"></div>
                            <p class="mb-0 mt-2">Assinatura do Mecânico</p>
                        </div>
                        <div class="col-6 text-center">
                            <div class="signature-line"></div>
                            <p class="mb-0 mt-2">Assinatura do Gerente</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;

    // Técnica de impressão via Iframe para evitar nova aba e cabeçalhos/rodapés
    let printFrame = document.getElementById('print-frame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'print-frame';
        printFrame.style.display = 'none';
        document.body.appendChild(printFrame);
    }
    printFrame.contentDocument.write(conteudo);
    printFrame.contentDocument.close();
    printFrame.contentWindow.print();
}