// Módulo Cálculo de Férias

let feriasFuncionariosMap = new Map();

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('form-calculo-ferias')) {
        initCalculoFerias();
    }
});

function initCalculoFerias() {
    carregarFuncionariosSelect();
    carregarListaFerias();

    document.getElementById('form-calculo-ferias').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarFerias();
    });
}

async function carregarFuncionariosSelect() {
    try {
        const select = document.getElementById('ferias-colaborador');
        select.innerHTML = '<option value="">Carregando...</option>';

        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione o colaborador...</option>';

        snapshot.forEach(doc => {
            const data = doc.data();
            feriasFuncionariosMap.set(doc.id, data);
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${data.nome} (Matrícula: ${data.matricula || 'S/N'})`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Erro ao carregar funcionários:", error);
        mostrarMensagem('Erro ao carregar lista de colaboradores.', 'error');
    }
}

async function salvarFerias() {
    const btn = document.querySelector('#form-calculo-ferias button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const funcionarioId = document.getElementById('ferias-colaborador').value;
        const tipo = document.getElementById('ferias-tipo').value;
        const dataInicio = document.getElementById('ferias-data-inicio').value;
        const dataFim = document.getElementById('ferias-data-fim').value;

        if (!funcionarioId || !dataInicio || !dataFim) {
            throw new Error("Preencha todos os campos obrigatórios.");
        }

        if (new Date(dataInicio) > new Date(dataFim)) {
            throw new Error("A data de término não pode ser anterior à data de início.");
        }

        const feriasIdField = document.getElementById('ferias-id').value;
        const funcionarioData = feriasFuncionariosMap.get(funcionarioId);
        
        let feriasRef;
        if (feriasIdField) {
            feriasRef = db.collection('ferias').doc(feriasIdField);
        } else {
            feriasRef = db.collection('ferias').doc();
        }

        const feriasDoc = {
            funcionarioId: funcionarioId,
            nomeFuncionario: funcionarioData.nome,
            tipo: tipo,
            dataInicio: dataInicio,
            dataFim: dataFim,
            status: 'Ativa'
        };

        if (!feriasIdField) {
            feriasDoc.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
        }

        await feriasRef.set(feriasDoc, { merge: true });

        // Atualiza a condição baseada nas datas
        const hoje = new Date().toISOString().split('T')[0];
        
        if (dataInicio <= hoje && dataFim >= hoje) {
            console.log(`Atualizando condicao para Férias: ${funcionarioId}`);
            await db.collection('funcionarios').doc(funcionarioId).update({
                condicao: 'Férias'
            });
        } else if (feriasIdField && dataInicio > hoje) {
            // Se foi edição e jogou pra frente, devolvemos pra normal (pode estar de férias no momento)
            const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (funcDoc.exists && funcDoc.data().condicao === 'Férias') {
                console.log(`Voltando condicao para Normal: ${funcionarioId}`);
                await db.collection('funcionarios').doc(funcionarioId).update({
                    condicao: 'Normal'
                });
            }
        }


        mostrarMensagem('Férias salvas com sucesso!', 'success');
        document.getElementById('form-calculo-ferias').reset();
        document.getElementById('ferias-id').value = '';
        carregarListaFerias();

    } catch (error) {
        console.error("Erro ao salvar férias:", error);
        mostrarMensagem(error.message || 'Erro ao registrar férias.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar';
    }
}

async function carregarListaFerias() {
    const tbody = document.getElementById('lista-ferias-tbody');
    try {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
        
        const snapshot = await db.collection('ferias').orderBy('dataInicio', 'desc').get();
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-muted py-4">Nenhum registro de férias encontrado.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const hoje = new Date().toISOString().split('T')[0];
            
            let statusBadge = '<span class="badge bg-secondary">Programada</span>';
            if (data.dataInicio <= hoje && data.dataFim >= hoje) {
                statusBadge = '<span class="badge bg-success">Em Andamento</span>';
            } else if (data.dataFim < hoje) {
                statusBadge = '<span class="badge bg-dark">Concluída</span>';
            }

            if (data.status === 'Cancelada') {
                statusBadge = '<span class="badge bg-danger">Cancelada</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-start ps-4 fw-semibold">${data.nomeFuncionario}</td>
                <td><span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">${data.tipo}</span></td>
                <td class="align-middle">${formatarDataFerias(data.dataInicio)}</td>
                <td class="align-middle">${formatarDataFerias(data.dataFim)}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="prepararEdicaoFerias('${doc.id}', '${data.funcionarioId}', '${data.tipo}', '${data.dataInicio}', '${data.dataFim}')" title="Editar Férias" ${data.status === 'Cancelada' ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="cancelarFerias('${doc.id}', '${data.funcionarioId}', '${data.tipo}')" title="Cancelar Férias" ${data.status === 'Cancelada' || data.dataFim < hoje ? 'disabled' : ''}>
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao carregar histórico de férias:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-danger py-4">Erro ao carregar dados.</td></tr>';
    }
}

window.prepararEdicaoFerias = function(id, funcionarioId, tipo, dataInicio, dataFim) {
    document.getElementById('edit-ferias-id').value = id;
    document.getElementById('edit-funcionario-id').value = funcionarioId;
    document.getElementById('edit-ferias-tipo').value = tipo;
    document.getElementById('edit-ferias-data-inicio').value = dataInicio;
    document.getElementById('edit-ferias-data-fim').value = dataFim;
    
    const modal = new bootstrap.Modal(document.getElementById('modalEditarFerias'));
    modal.show();
};

window.salvarEdicaoFerias = async function() {
    const btn = document.querySelector('#modalEditarFerias .btn-primary');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const feriasId = document.getElementById('edit-ferias-id').value;
        const funcionarioId = document.getElementById('edit-funcionario-id').value;
        const tipo = document.getElementById('edit-ferias-tipo').value;
        const dataInicio = document.getElementById('edit-ferias-data-inicio').value;
        const dataFim = document.getElementById('edit-ferias-data-fim').value;

        if (!dataInicio || !dataFim) {
            throw new Error("Preencha todos os campos obrigatórios.");
        }

        if (new Date(dataInicio) > new Date(dataFim)) {
            throw new Error("A data de término não pode ser anterior à data de início.");
        }

        await db.collection('ferias').doc(feriasId).update({
            tipo: tipo,
            dataInicio: dataInicio,
            dataFim: dataFim
        });

        const hoje = new Date().toISOString().split('T')[0];
        
        if (dataInicio <= hoje && dataFim >= hoje) {
            await db.collection('funcionarios').doc(funcionarioId).update({
                condicao: 'Férias'
            });
        } else if (dataInicio > hoje) {
            const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
            if (funcDoc.exists && funcDoc.data().condicao === 'Férias') {
                await db.collection('funcionarios').doc(funcionarioId).update({
                    condicao: 'Normal'
                });
            }
        }

        mostrarMensagem('Férias atualizadas com sucesso!', 'success');
        
        const modalEl = document.getElementById('modalEditarFerias');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        
        carregarListaFerias();

    } catch (error) {
        console.error("Erro ao salvar edição de férias:", error);
        mostrarMensagem(error.message || 'Erro ao atualizar férias.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar Alterações';
    }
};

window.cancelarFerias = async function(feriasId, funcionarioId, tipo) {
    if (!confirm('Deseja realmente cancelar este registro de férias?')) return;

    try {
        await db.collection('ferias').doc(feriasId).update({
            status: 'Cancelada'
        });

        // Se era Férias em Casa e estava afetando a condição, voltamos para Normal
        if (tipo === 'Férias em Casa') {
            await db.collection('funcionarios').doc(funcionarioId).update({
                condicao: 'Normal'
            });
        }

        mostrarMensagem('Férias canceladas com sucesso.', 'success');
        carregarListaFerias();
    } catch (error) {
        console.error("Erro ao cancelar férias:", error);
        mostrarMensagem('Erro ao cancelar férias.', 'error');
    }
}
function formatarDataFerias(dataStr) {
    if (!dataStr) return '-';
    const partes = dataStr.split('-');
    if (partes.length !== 3) return dataStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

window.sincronizarFeriasManual = async function() {
    try {
        mostrarMensagem('Analisando os dados...', 'info');
        const hoje = new Date().toISOString().split('T')[0];
        
        const snapshot = await db.collection('ferias').get();
        let logs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            logs.push(`Férias do func: ${data.funcionarioId} | Tipo: ${data.tipo} | Inicio: ${data.dataInicio} | Fim: ${data.dataFim} | Status: ${data.status}`);
        });
        
        alert("DEBUG - Leia o que encontrei no banco de dados:\n\n" + logs.join("\n"));

        if (typeof window.verificarFeriasAtivas === 'function') {
            window.isManualSync = true;
            await window.verificarFeriasAtivas();
            window.isManualSync = false;
        } else {
            mostrarMensagem('Erro: Função de sincronização não encontrada.', 'error');
        }
    } catch (e) {
        console.error(e);
        mostrarMensagem('Erro ao forçar sincronização.', 'error');
    }
};
