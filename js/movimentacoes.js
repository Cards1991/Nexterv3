// Gerenciamento de movimentações (Admissão/Demissão)

// Inicializar formulários de movimentação
document.addEventListener('DOMContentLoaded', function() {
    const formAdmissao = document.getElementById('form-admissao');
    if (formAdmissao) {
        formAdmissao.addEventListener('submit', function(e) {
            e.preventDefault();
            registrarMovimentacao('admissao');
        });
    }

    const formDemissao = document.getElementById('form-demissao');
    if (formDemissao) {
        formDemissao.addEventListener('submit', function(e) {
            e.preventDefault();
            registrarMovimentacao('demissao');
        });
    }
});

// Carregar dados para a seção de movimentações
async function carregarMovimentacoes() {
    try {
        carregarSelectsMovimentacao();
        await carregarHistoricoMovimentacoes();
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
        mostrarMensagem('Erro ao carregar dados de movimentações', 'error');
    }
}

// Registrar movimentação
async function registrarMovimentacao(tipo) {
    try {
        const user = firebase.auth().currentUser;

        const funcionarioId = document.getElementById(`funcionario-${tipo}`).value;
        const data = document.getElementById(`data-${tipo}`).value;
        const motivo = document.getElementById(`motivo-${tipo}`).value;

        if (!funcionarioId || !data || !motivo) {
            mostrarMensagem('Preencha todos os campos da movimentação', 'warning');
            return;
        }

        const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcionarioDoc.exists) {
            mostrarMensagem('Funcionário não encontrado', 'error');
            return;
        }
        const funcionarioData = funcionarioDoc.data();

        const movimentacaoData = {
            funcionarioId: funcionarioId,
            funcionarioNome: funcionarioData.nome,
            empresaId: funcionarioData.empresaId,
            tipo: tipo,            
            data: new Date(data.replace(/-/g, '\/')),
            motivo: motivo,
            dataRegistro: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user ? user.uid : null
        };

        const movimentacaoRef = await db.collection('movimentacoes').add(movimentacaoData);

        // Atualizar status do funcionário
        const novoStatus = tipo === 'admissao' ? 'Ativo' : 'Inativo';
        await db.collection('funcionarios').doc(funcionarioId).update({ status: novoStatus });

        mostrarMensagem(`Movimentação de ${tipo} registrada com sucesso!`, 'success');
        document.getElementById(`form-${tipo}`).reset();
        carregarHistoricoMovimentacoes();
        carregarSelectsMovimentacao();

        // Se for pedido de demissão, abrir modal de entrevista
        if (tipo === 'demissao' && motivo.toLowerCase() === 'pedido de demissão') {
            abrirModalAuditoriaRescisao(movimentacaoData, funcionarioData.nome);
        }

    } catch (error) {
        console.error(`Erro ao registrar ${tipo}:`, error);
        mostrarMensagem(`Erro ao registrar ${tipo}`, 'error');
    }
}

// Carregar histórico de movimentações
async function carregarHistoricoMovimentacoes() {
    try {
        const tbody = document.getElementById('tabela-movimentacoes');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const movimentacoesSnapshot = await db.collection('movimentacoes').orderBy('data', 'desc').limit(20).get();

        if (movimentacoesSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum histórico de movimentação encontrado</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        movimentacoesSnapshot.forEach(doc => {
            const mov = doc.data();
            const dataObj = mov.data?.toDate ? mov.data.toDate() : mov.data;
            const tipoBadge = mov.tipo === 'admissao' ? '<span class="badge bg-success">Admissão</span>' : '<span class="badge bg-danger">Demissão</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatarData(dataObj)}</td>
                <td>${mov.funcionarioNome}</td>
                <td>${tipoBadge}</td>
                <td>${mov.motivo}</td>
                <td><span class="badge bg-secondary">${mov.status || 'Concluído'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirMovimentacao('${doc.id}', '${mov.funcionarioId}', '${mov.tipo}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar histórico de movimentações:', error);
    }
}

// Excluir movimentação
async function excluirMovimentacao(movimentacaoId, funcionarioId, tipoMovimentacao) {
    if (!confirm(`Tem certeza que deseja excluir esta movimentação? O status do funcionário será revertido.`)) {
        return;
    }

    try {
        // 1. Excluir o registro da movimentação
        await db.collection('movimentacoes').doc(movimentacaoId).delete();

        // 2. Reverter o status do funcionário
        if (funcionarioId) {
            // Se excluiu uma demissão, o funcionário volta a ser 'Ativo'
            // Se excluiu uma admissão, o funcionário volta a ser 'Inativo'
            const novoStatus = tipoMovimentacao === 'demissao' ? 'Ativo' : 'Inativo';
            await db.collection('funcionarios').doc(funcionarioId).update({ status: novoStatus });
        }

        mostrarMensagem('Movimentação excluída com sucesso!');
        
        // Recarregar o histórico para refletir a mudança
        await carregarHistoricoMovimentacoes();

    } catch (error) {
        console.error('Erro ao excluir movimentação:', error);
        mostrarMensagem('Erro ao excluir movimentação.', 'error');
    }
}

// Abrir modal de entrevista demissional
function abrirModalEntrevista(movimentacaoId, nomeFuncionario) {
    const formEntrevista = document.getElementById('form-entrevista-demissional');
    if (formEntrevista) {
        formEntrevista.reset();
    } else {
        console.error('Formulário de entrevista demissional não encontrado!');
    }
    document.getElementById('entrevista-movimentacao-id').value = movimentacaoId;
    document.getElementById('entrevista-nome-funcionario').textContent = nomeFuncionario;

    const modalEl = document.getElementById('entrevistaDemissionalModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Função para salvar a entrevista (será implementada em analise-rescisao.js)
async function salvarEntrevistaDemissional() {
    // A implementação completa estará em analise-rescisao.js
    // para manter a organização do código.
    if (typeof salvarDadosEntrevista === 'function') {
        await salvarDadosEntrevista();
    } else {
        console.error('Função salvarDadosEntrevista não encontrada.');
        mostrarMensagem('Erro ao tentar salvar entrevista.', 'error');
    }
}

async function abrirModalAuditoriaRescisao(movimentacaoData, nomeFuncionario) {
    const modalId = 'auditoriaRescisaoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = modalId;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Auditoria em Rescisões</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-auditoria-rescisao">
                            <div class="mb-3">
                                <label class="form-label">Empresa</label>
                                <input type="text" class="form-control" id="auditoria-empresa" readonly>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Tipo de Rescisão</label>
                                <select class="form-select" id="auditoria-tipo-rescisao">
                                    <option value="TAC-Empregado">T.A.C - Empregado</option>
                                    <option value="TAC-Empresa">T.A.C - Empresa</option>
                                    <option value="Termino-Contrato">Término de Contrato</option>
                                    <option value="Dispensa">Dispensa</option>
                                    <option value="Acordo-Legal">Acordo Legal</option>
                                    <option value="Acordo-PF">Acordo P.F.</option>
                                    <option value="Pedido-Demissao">Pedido de Demissão</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Conferências</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Verbas" id="auditoria-verbas">
                                    <input class="form-check-input" type="checkbox" value="Verbas" id="auditoria-verbas" />
                                    <label class="form-check-label" for="auditoria-verbas">Verbas</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="verbas-check" id="verbas-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="verbas-check" id="verbas-sim" value="Sim" />
                                        <label class="form-check-label" for="verbas-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="verbas-check" id="verbas-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="verbas-check" id="verbas-nao" value="Não" />
                                        <label class="form-check-label" for="verbas-nao">Não</label>
                                    </div>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Ferias" id="auditoria-ferias">
                                    <input class="form-check-input" type="checkbox" value="Ferias" id="auditoria-ferias" />
                                    <label class="form-check-label" for="auditoria-ferias">Férias</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="ferias-check" id="ferias-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="ferias-check" id="ferias-sim" value="Sim" />
                                        <label class="form-check-label" for="ferias-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="ferias-check" id="ferias-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="ferias-check" id="ferias-nao" value="Não" />
                                        <label class="form-check-label" for="ferias-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Extrato Analitico" id="auditoria-extrato">
                                    <input class="form-check-input" type="checkbox" value="Extrato Analitico" id="auditoria-extrato" />
                                    <label class="form-check-label" for="auditoria-extrato">Extrato Analítico</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="extrato-check" id="extrato-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="extrato-check" id="extrato-sim" value="Sim" />
                                        <label class="form-check-label" for="extrato-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="extrato-check" id="extrato-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="extrato-check" id="extrato-nao" value="Não" />
                                        <label class="form-check-label" for="extrato-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="FGTS Aberto" id="auditoria-fgts">
                                    <input class="form-check-input" type="checkbox" value="FGTS Aberto" id="auditoria-fgts" />
                                    <label class="form-check-label" for="auditoria-fgts">FGTS Aberto</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="fgts-check" id="fgts-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="fgts-check" id="fgts-sim" value="Sim" />
                                        <label class="form-check-label" for="fgts-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="fgts-check" id="fgts-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="fgts-check" id="fgts-nao" value="Não" />
                                        <label class="form-check-label" for="fgts-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Multa Rescisórias" id="auditoria-multa">
                                    <input class="form-check-input" type="checkbox" value="Multa Rescisórias" id="auditoria-multa" />
                                    <label class="form-check-label" for="auditoria-multa">Multa Rescisórias</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="multa-check" id="multa-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="multa-check" id="multa-sim" value="Sim" />
                                        <label class="form-check-label" for="multa-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="multa-check" id="multa-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="multa-check" id="multa-nao" value="Não" />
                                        <label class="form-check-label" for="multa-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Desc.Aviso" id="auditoria-desconto">
                                    <input class="form-check-input" type="checkbox" value="Desc.Aviso" id="auditoria-desconto" />
                                    <label class="form-check-label" for="auditoria-desconto">Desc.Aviso</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="desconto-check" id="desconto-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="desconto-check" id="desconto-sim" value="Sim" />
                                        <label class="form-check-label" for="desconto-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="desconto-check" id="desconto-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="desconto-check" id="desconto-nao" value="Não" />
                                        <label class="form-check-label" for="desconto-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Consignado" id="auditoria-consignado">
                                    <input class="form-check-input" type="checkbox" value="Consignado" id="auditoria-consignado" />
                                    <label class="form-check-label" for="auditoria-consignado">Consignado</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="consignado-check" id="consignado-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="consignado-check" id="consignado-sim" value="Sim" />
                                        <label class="form-check-label" for="consignado-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="consignado-check" id="consignado-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="consignado-check" id="consignado-nao" value="Não" />
                                        <label class="form-check-label" for="consignado-nao">Não</label>
                                    </div>
                                </div>
                                 <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="Ent. Demissional" id="auditoria-entrevista">
                                    <input class="form-check-input" type="checkbox" value="Ent. Demissional" id="auditoria-entrevista" />
                                    <label class="form-check-label" for="auditoria-entrevista">Ent. Demissional</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="entrevista-check" id="entrevista-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="entrevista-check" id="entrevista-sim" value="Sim" />
                                        <label class="form-check-label" for="entrevista-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="entrevista-check" id="entrevista-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="entrevista-check" id="entrevista-nao" value="Não" />
                                        <label class="form-check-label" for="entrevista-nao">Não</label>
                                    </div>
                                </div>
                                  <div class="form-check">
                                    <input class="form-check-input" type="checkbox" value="E-social" id="auditoria-esocial">
                                    <input class="form-check-input" type="checkbox" value="E-social" id="auditoria-esocial" />
                                    <label class="form-check-label" for="auditoria-esocial">E-social</label>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="esocial-check" id="esocial-sim" value="Sim">
                                        <input class="form-check-input" type="radio" name="esocial-check" id="esocial-sim" value="Sim" />
                                        <label class="form-check-label" for="esocial-sim">Sim</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="esocial-check" id="esocial-nao" value="Não">
                                        <input class="form-check-input" type="radio" name="esocial-check" id="esocial-nao" value="Não" />
                                        <label class="form-check-label" for="esocial-nao">Não</label>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Datas</label>
                                <div class="row">
                                    <div class="col-md-6">
                                        <label class="form-label">Envio Financeiro</label>
                                        <input type="date" class="form-control" id="auditoria-envio-financeiro">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Data de Vencimento</label>
                                        <input type="date" class="form-control" id="auditoria-vencimento">
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Assinatura</label>
                                <textarea class="form-control" rows="2" id="auditoria-assinatura"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="imprimirAuditoriaRescisao()"><i class="fas fa-print"></i> Imprimir Auditoria</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    // Preencher dados
    const empresaInput = document.getElementById('auditoria-empresa');
    if (movimentacaoData.empresaId) {
        try {
            const empresaDoc = await db.collection('empresas').doc(movimentacaoData.empresaId).get();
            empresaInput.value = empresaDoc.exists ? empresaDoc.data().nome : 'Empresa não encontrada';
        } catch (error) {
            console.error("Erro ao buscar nome da empresa:", error);
            empresaInput.value = 'Erro ao carregar';
        }
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function imprimirAuditoriaRescisao() {
    // Implementar a lógica para gerar e imprimir o relatório de auditoria
    // com base nos dados do formulário
    console.log('Implementar a lógica para gerar e imprimir o relatório de auditoria');
}