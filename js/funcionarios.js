// Gerenciamento de funcionários
let funcionarios = [];

// Carregar funcionários
async function carregarFuncionarios() {
    try {
        const tbody = document.getElementById('tabela-funcionarios');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const funcionariosSnapshot = await db.collection('funcionarios')
            .orderBy('nome')
            .get();

        funcionarios = [];
        
        if (funcionariosSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum funcionário cadastrado</td></tr>';
            return;
        }

        // Carregar empresas para mapeamento
        const empresasSnapshot = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnapshot.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
        });

        tbody.innerHTML = '';
        for (const doc of funcionariosSnapshot.docs) {
            const funcionario = { id: doc.id, ...doc.data() };
            funcionarios.push(funcionario);

            // Determinar status
            let status = funcionario.status || 'Ativo';
            let statusClass = status === 'Inativo' ? 'status-inativo' : 'status-ativo';

            // Verificar movimentações se não tiver status definido
            if (!funcionario.status) {
                const movimentacoesSnapshot = await db.collection('movimentacoes')
                    .where('funcionarioId', '==', doc.id)
                    .orderBy('data', 'desc')
                    .limit(1)
                    .get();
                    
                if (!movimentacoesSnapshot.empty) {
                    const ultimaMov = movimentacoesSnapshot.docs[0].data();
                    if (ultimaMov.tipo === 'demissao') {
                        status = 'Inativo';
                        statusClass = 'status-inativo';
                    }
                }
            }

            const nomeEmpresa = empresasMap[funcionario.empresaId] || 'Empresa não encontrada';
            const tempoDeEmpresa = funcionario.dataAdmissao ? calcularTempoDeEmpresa(funcionario.dataAdmissao.toDate()) : 'N/A';
            const idade = funcionario.dataNascimento ? calcularIdade(funcionario.dataNascimento.toDate()) : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${funcionario.nome}</td>
                <td>${funcionario.cpf}</td>
                <td>${nomeEmpresa}</td>
                <td>${funcionario.setor}</td>
                <td>${funcionario.cargo}</td>
                <td>${idade}</td>
                <td><small>${tempoDeEmpresa}</small></td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editarFuncionario('${doc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="verDetalhesFuncionario('${doc.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirFuncionario('${doc.id}', '${funcionario.nome}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        mostrarMensagem('Erro ao carregar funcionários', 'error');
    }
}

// Salvar funcionário
async function salvarFuncionario() {
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        const nome = document.getElementById('nome-funcionario').value;
        const cpf = document.getElementById('cpf-funcionario').value;
        const email = document.getElementById('email-funcionario').value;
        const telefone = document.getElementById('telefone-funcionario').value;
        const empresaId = document.getElementById('empresa-funcionario').value;
        const setor = document.getElementById('setor-funcionario').value;
        const salario = parseFloat(document.getElementById('salario-funcionario').value) || 0;
        const cargo = document.getElementById('cargo-funcionario').value;
        const sexo = document.getElementById('sexo-funcionario').value;
        const dataNascimento = document.getElementById('nascimento-funcionario').value;
        const dataAdmissao = document.getElementById('admissao-funcionario').value;

        if (!nome || !cpf || !empresaId || !setor || !cargo || !dataAdmissao || !dataNascimento || !sexo) {
            mostrarMensagem('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        // Validar CPF
        if (!validarCPF(cpf)) {
            mostrarMensagem('CPF inválido', 'warning');
            return;
        }

        // Verificar se CPF já existe
        const cpfExistente = await db.collection('funcionarios').where('cpf', '==', cpf).get();
        if (!cpfExistente.empty) {
            mostrarMensagem('Já existe um funcionário cadastrado com este CPF', 'warning');
            return;
        }

        // Validar e converter data
        let dataAdmissaoValida;
        try {
            const [year, month, day] = dataAdmissao.split('-').map(Number);
            dataAdmissaoValida = new Date(year, month - 1, day);
            
            if (isNaN(dataAdmissaoValida.getTime())) {
                mostrarMensagem('Data de admissão inválida', 'warning');
                return;
            }
        } catch (error) {
            mostrarMensagem('Data de admissão inválida', 'warning');
            return;
        }

        const user = firebase.auth().currentUser;
        const funcionarioData = {
            nome: nome,
            cpf: cpf,
            email: email,
            telefone: telefone,
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            salario: salario,
            sexo: sexo,
            dataNascimento: new Date(dataNascimento.replace(/-/g, '\/')),
            dataAdmissao: dataAdmissaoValida,
            status: 'Ativo',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),            
            createdByUid: user ? user.uid : null
        };

        const docRef = await db.collection('funcionarios').add(funcionarioData);
        // Passa o ID do novo documento para a função de cálculo de custo
        await atualizarCustoTotal(docRef.id, salario, empresaId);

        const modal = bootstrap.Modal.getInstance(document.getElementById('funcionarioModal'));
        modal.hide();
        document.getElementById('form-funcionario').reset();
        
        carregarFuncionarios();
        mostrarMensagem('Funcionário cadastrado com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar funcionário:', error);
        mostrarMensagem('Erro ao salvar funcionário', 'error');
    }
}

// Formatar CPF enquanto digita
function formatarCPF(campo) {
    let cpf = campo.value.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    campo.value = cpf;
}

// Formatar telefone enquanto digita
function formatarTelefone(campo) {
    let telefone = campo.value.replace(/\D/g, '');
    if (telefone.length <= 10) {
        telefone = telefone.replace(/(\d{2})(\d)/, '($1) $2');
        telefone = telefone.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
        telefone = telefone.replace(/(\d{2})(\d)/, '($1) $2');
        telefone = telefone.replace(/(\d{5})(\d)/, '$1-$2');
    }
    campo.value = telefone;
}

// Validar CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf === '') return false;
    
    // Elimina CPFs invalidos conhecidos
    if (cpf.length !== 11 ||
        cpf === "00000000000" ||
        cpf === "11111111111" ||
        cpf === "22222222222" ||
        cpf === "33333333333" ||
        cpf === "44444444444" ||
        cpf === "55555555555" ||
        cpf === "66666666666" ||
        cpf === "77777777777" ||
        cpf === "88888888888" ||
        cpf === "99999999999")
        return false;
        
    // Valida 1o digito
    let add = 0;
    for (let i = 0; i < 9; i++)
        add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev === 10 || rev === 11)
        rev = 0;
    if (rev !== parseInt(cpf.charAt(9)))
        return false;
        
    // Valida 2o digito
    add = 0;
    for (let i = 0; i < 10; i++)
        add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev === 10 || rev === 11)
        rev = 0;
    if (rev !== parseInt(cpf.charAt(10)))
        return false;
        
    return true;
}

// Editar funcionário
async function editarFuncionario(funcionarioId) {
    try {
        const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcionarioDoc.exists) {
            mostrarMensagem('Funcionário não encontrado', 'error');
            return;
        }

        const funcionario = funcionarioDoc.data();
        
        // Preencher modal de edição
        const funcionarioModal = new bootstrap.Modal(document.getElementById('funcionarioModal'));
        const salvarBtn = document.querySelector('#funcionarioModal .btn-primary');
        
        document.querySelector('#funcionarioModal .modal-title').textContent = 'Editar Funcionário';
        document.getElementById('nome-funcionario').value = funcionario.nome;
        document.getElementById('cpf-funcionario').value = funcionario.cpf;
        document.getElementById('email-funcionario').value = funcionario.email;
        document.getElementById('telefone-funcionario').value = funcionario.telefone || '';
        document.getElementById('cargo-funcionario').value = funcionario.cargo;
        document.getElementById('salario-funcionario').value = funcionario.salario || '';        
        document.getElementById('sexo-funcionario').value = funcionario.sexo || '';
        document.getElementById('nascimento-funcionario').value = funcionario.dataNascimento ? formatarDataParaInput(funcionario.dataNascimento) : '';
        document.getElementById('admissao-funcionario').value = funcionario.dataAdmissao ? formatarDataParaInput(funcionario.dataAdmissao) : '';

        // Carregar e selecionar empresa e setor
        const empresaSelect = document.getElementById('empresa-funcionario');
        await carregarSelectEmpresas('empresa-funcionario'); // Garante que as empresas estão carregadas
        
        empresaSelect.value = funcionario.empresaId;
        
        // Carrega setores e funções e depois seleciona os valores corretos
        await carregarSetoresPorEmpresa(funcionario.empresaId, 'setor-funcionario');
        await carregarFuncoesPorEmpresa(funcionario.empresaId, 'cargo-funcionario');
        document.getElementById('setor-funcionario').value = funcionario.setor;
        document.getElementById('cargo-funcionario').value = funcionario.cargo;

        funcionarioModal.show();

        salvarBtn.textContent = 'Atualizar Funcionário';
        salvarBtn.onclick = function() { atualizarFuncionario(funcionarioId); };
        
    } catch (error) {
        console.error('Erro ao editar funcionário:', error);
        mostrarMensagem('Erro ao carregar dados do funcionário', 'error');
    }
}

// Atualizar funcionário
async function atualizarFuncionario(funcionarioId) {
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        const nome = document.getElementById('nome-funcionario').value;
        const cpf = document.getElementById('cpf-funcionario').value;
        const email = document.getElementById('email-funcionario').value;
        const telefone = document.getElementById('telefone-funcionario').value;
        const empresaId = document.getElementById('empresa-funcionario').value;
        const setor = document.getElementById('setor-funcionario').value;
        const salario = parseFloat(document.getElementById('salario-funcionario').value) || 0;
        const cargo = document.getElementById('cargo-funcionario').value;
        const sexo = document.getElementById('sexo-funcionario').value;
        const dataNascimento = document.getElementById('nascimento-funcionario').value;
        const dataAdmissao = document.getElementById('admissao-funcionario').value;

        if (!nome || !cpf || !empresaId || !setor || !cargo || !dataAdmissao || !dataNascimento || !sexo) {
            mostrarMensagem('Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        // Validar e converter data
        let dataAdmissaoValida;
        try {
            const [year, month, day] = dataAdmissao.split('-').map(Number);
            dataAdmissaoValida = new Date(year, month - 1, day);
            
            if (isNaN(dataAdmissaoValida.getTime())) {
                mostrarMensagem('Data de admissão inválida', 'warning');
                return;
            }
        } catch (error) {
            mostrarMensagem('Data de admissão inválida', 'warning');
            return;
        }

        const user = firebase.auth().currentUser;
        const updateData = {
            nome: nome,
            cpf: cpf,
            email: email,
            telefone: telefone,
            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            salario: salario,
            sexo: sexo,
            dataNascimento: new Date(dataNascimento.replace(/-/g, '\/')),
            dataAdmissao: dataAdmissaoValida,
            updatedAt: timestamp(),
            updatedByUid: user ? user.uid : null
        };

        await db.collection('funcionarios').doc(funcionarioId).update(updateData);

        await atualizarCustoTotal(funcionarioId, salario, empresaId);

        // Resetar e fechar o modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('funcionarioModal'));
        modal.hide();
        document.getElementById('form-funcionario').reset();

        const salvarBtn = document.querySelector('#funcionarioModal .btn-primary');
        salvarBtn.textContent = 'Salvar Funcionário';
        salvarBtn.onclick = salvarFuncionario;

        carregarFuncionarios();
        mostrarMensagem('Funcionário atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        mostrarMensagem('Erro ao atualizar funcionário', 'error');
    }
}

async function atualizarCustoTotal(funcionarioId, salario, empresaId) {
    try {
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (!empresaDoc.exists) {
            console.warn(`Empresa ${empresaId} não encontrada para calcular o custo total.`);
            return;
        }

        const pagaFGTS = empresaDoc.data().pagaFGTS === true;
        const pagaSindicato = empresaDoc.data().pagaSindicato === true;

        // --- NOVA LÓGICA DE CÁLCULO ---
        const provisaoDecimoTerceiro = salario / 12;
        const provisaoFerias = salario / 12;
        const tercoFerias = provisaoFerias / 3;
        
        // Base de cálculo para FGTS e Sindicato
        const baseCalculo = salario + provisaoDecimoTerceiro;

        // Cálculo dos encargos
        const totalFGTS = pagaFGTS ? (salario + provisaoDecimoTerceiro + provisaoFerias) * 0.08 : 0;
        const custoSindicato = pagaSindicato ? (baseCalculo * 0.008) : 0; // 0.8% = 0.008

        // Soma de todos os custos
        const custoTotal = salario + provisaoDecimoTerceiro + provisaoFerias + tercoFerias + totalFGTS + custoSindicato;

        await db.collection('funcionarios').doc(funcionarioId).update({
            custoTotal: parseFloat(custoTotal.toFixed(2))
        });

        // Recarregar a lista de funcionários para exibir o custo atualizado
        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao calcular ou salvar custo total:", error);
    }
}

// Excluir funcionário
async function excluirFuncionario(funcionarioId, nomeFuncionario) {
    if (!confirm(`Tem certeza que deseja excluir o funcionário "${nomeFuncionario}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        // Verificar se existem movimentações vinculadas a este funcionário
        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .where('funcionarioId', '==', funcionarioId)
            .limit(1)
            .get();

        if (!movimentacoesSnapshot.empty) {
            mostrarMensagem('Não é possível excluir um funcionário que já possui movimentações (admissão/demissão) registradas.', 'warning');
            return;
        }

        // Se não houver movimentações, pode excluir
        await db.collection('funcionarios').doc(funcionarioId).delete();
        
        mostrarMensagem('Funcionário excluído com sucesso!');
        await carregarFuncionarios(); // Recarrega a lista
    } catch (error) {
        console.error('Erro ao excluir funcionário:', error);
        mostrarMensagem('Erro ao excluir funcionário.', 'error');
    }
}

// Ver detalhes do funcionário
async function verDetalhesFuncionario(funcionarioId) {
    try {
        const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcionarioDoc.exists) {
            mostrarMensagem('Funcionário não encontrado', 'error');
            return;
        }
        const funcionario = funcionarioDoc.data();

        const movimentacoesSnapshot = await db.collection('movimentacoes')
            .where('funcionarioId', '==', funcionarioId)
            .orderBy('data', 'desc')
            .get();

        let historicoHTML = '<h6>Histórico de Movimentações:</h6>';
        if (movimentacoesSnapshot.empty) {
            historicoHTML += '<p class="text-muted">Nenhuma movimentação registrada</p>';
        } else {
            historicoHTML += '<ul class="list-group">';
            movimentacoesSnapshot.forEach(doc => {
                const mov = doc.data();
                const dataObj = mov.data?.toDate ? mov.data.toDate() : mov.data;
                historicoHTML += `
                    <li class="list-group-item">
                        <strong>${mov.tipo === 'admissao' ? 'Admissão' : 'Demissão'}</strong> - ${formatarData(dataObj)}<br>
                        <small>Motivo: ${mov.motivo}</small>
                    </li>
                `;
            });
            historicoHTML += '</ul>';
        }

        // Carregar nome da empresa
        let nomeEmpresa = 'Empresa não encontrada';
        if (funcionario.empresaId) {
            const empresaDoc = await db.collection('empresas').doc(funcionario.empresaId).get();
            if (empresaDoc.exists) {
                nomeEmpresa = empresaDoc.data().nome;
            }
        }

        const status = funcionario.status || 'Ativo';
        const statusClass = status === 'Inativo' ? 'bg-danger' : 'bg-success';

        const idade = funcionario.dataNascimento ? calcularIdade(funcionario.dataNascimento.toDate()) : 'N/A';

        const detalhesHTML = `
            <style>
                .detail-item { margin-bottom: 1rem; }
                .detail-label { font-size: 0.8rem; color: #6c757d; font-weight: 600; display: block; margin-bottom: 0.25rem; }
                .detail-value { font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .detail-value .fas { color: #0d6efd; }
            </style>
            
            <h5 class="section-title mt-2">Dados Pessoais</h5>
            <div class="row">
                <div class="col-md-6 detail-item"><div class="detail-label">CPF</div><div class="detail-value"><i class="fas fa-id-card"></i> ${funcionario.cpf}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Idade</div><div class="detail-value"><i class="fas fa-birthday-cake"></i> ${idade}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">E-mail</div><div class="detail-value"><i class="fas fa-envelope"></i> ${funcionario.email || 'Não informado'}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Telefone</div><div class="detail-value"><i class="fas fa-phone"></i> ${funcionario.telefone || 'Não informado'}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Sexo</div><div class="detail-value"><i class="fas fa-venus-mars"></i> ${funcionario.sexo || 'Não informado'}</div></div>
            </div>

            <h5 class="section-title mt-3">Dados Profissionais</h5>
            <div class="row">
                <div class="col-md-6 detail-item"><div class="detail-label">Empresa</div><div class="detail-value"><i class="fas fa-building"></i> ${nomeEmpresa}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Setor</div><div class="detail-value"><i class="fas fa-sitemap"></i> ${funcionario.setor}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Cargo</div><div class="detail-value"><i class="fas fa-user-tie"></i> ${funcionario.cargo}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Data de Admissão</div><div class="detail-value"><i class="fas fa-calendar-alt"></i> ${funcionario.dataAdmissao ? formatarData(funcionario.dataAdmissao.toDate()) : 'N/A'}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Salário</div><div class="detail-value"><i class="fas fa-dollar-sign"></i> ${funcionario.salario ? 'R$ ' + funcionario.salario.toFixed(2) : 'Não informado'}</div></div>
                <div class="col-md-6 detail-item"><div class="detail-label">Custo Total (Estimado)</div><div class="detail-value"><i class="fas fa-calculator"></i> ${funcionario.custoTotal ? 'R$ ' + funcionario.custoTotal.toFixed(2) : 'Não calculado'}</div></div>
            </div>

            <div class="mt-4">${historicoHTML}</div>
        `;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title mb-0">${funcionario.nome}</h5>
                            <span class="badge ${statusClass}">${status}</span>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">${detalhesHTML}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        const modal = new bootstrap.Modal(modalDiv);
        modal.show();
        modalDiv.addEventListener('hidden.bs.modal', function() { 
            document.body.removeChild(modalDiv); 
        });
    } catch (error) {
        console.error('Erro ao carregar detalhes do funcionário:', error);
        mostrarMensagem('Erro ao carregar detalhes', 'error');
    }
}

// Carregar setores baseado na empresa selecionada
async function carregarSetoresPorEmpresa(empresaId, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um setor</option>';
    if (!empresaId) return;
    
    try {
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (!empresaDoc.exists) return;

        const empresa = empresaDoc.data();
        
        if (empresa.setores && empresa.setores.length > 0) {
            select.disabled = false;
            empresa.setores.forEach(setor => {
                const option = document.createElement('option');
                option.value = setor;
                option.textContent = setor;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="">Nenhum setor cadastrado</option>';
            select.disabled = true;
        }
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
    }
}

// Carregar funções baseado na empresa selecionada
async function carregarFuncoesPorEmpresa(empresaId, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um cargo</option>';
    select.disabled = true;

    if (!empresaId) {
        select.innerHTML = '<option value="">Selecione a empresa primeiro</option>';
        return;
    }
    
    try {
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (!empresaDoc.exists) return;

        const empresa = empresaDoc.data();
        
        if (empresa.funcoes && empresa.funcoes.length > 0) {
            select.disabled = false;
            empresa.funcoes.forEach(funcao => {
                select.innerHTML += `<option value="${funcao}">${funcao}</option>`;
            });
        }
    } catch (error) {
        console.error('Erro ao carregar funções:', error);
    }
}

// Carregar funcionários ativos para selects
async function carregarSelectFuncionariosAtivos(selectId, incluirInativos = false) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um funcionário</option>';

        const funcionariosSnapshot = await db.collection('funcionarios').orderBy('nome').get();
        
        for (const doc of funcionariosSnapshot.docs) {
            const func = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = func.nome;

            if (incluirInativos) {
                select.appendChild(option);
            } else {
                // Lógica específica para admissão/demissão
                if (selectId === 'funcionario-admissao' && func.status === 'Inativo') {
                    select.appendChild(option);
                } else if (selectId === 'funcionario-demissao' && func.status !== 'Inativo') {
                    select.appendChild(option);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao carregar funcionários para select:', error);
    }
}

function carregarSelectsMovimentacao() {
    carregarSelectFuncionariosAtivos('funcionario-admissao');
    carregarSelectFuncionariosAtivos('funcionario-demissao');
}

function calcularTempoDeEmpresa(dataAdmissao) {
    if (!dataAdmissao || isNaN(new Date(dataAdmissao))) {
        return 'N/A';
    }

    const hoje = new Date();
    let anos = hoje.getFullYear() - dataAdmissao.getFullYear();
    let meses = hoje.getMonth() - dataAdmissao.getMonth();
    let dias = hoje.getDate() - dataAdmissao.getDate();

    if (dias < 0) {
        meses--;
        dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }
    return `${anos > 0 ? anos + (anos > 1 ? ' anos, ' : ' ano, ') : ''}${meses > 0 ? meses + (meses > 1 ? ' meses' : ' mês') : (anos > 0 ? '' : dias + ' dias')}`;
}

function calcularIdade(dataNascimento) {
    if (!dataNascimento || isNaN(new Date(dataNascimento))) {
        return 'N/A';
    }
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
        idade--;
    }
    return idade;
}

// Inicializar eventos do modal de funcionário
function inicializarModalFuncionario() {
    const empresaSelect = document.getElementById('empresa-funcionario');
    const setorSelect = document.getElementById('setor-funcionario');

    if (empresaSelect) {
        empresaSelect.addEventListener('change', function() {
            carregarSetoresPorEmpresa(this.value, 'setor-funcionario');
            carregarFuncoesPorEmpresa(this.value, 'cargo-funcionario');
        });
    }

    // Formatar CPF e telefone enquanto digita
    const cpfInput = document.getElementById('cpf-funcionario');
    const telefoneInput = document.getElementById('telefone-funcionario');

    if (cpfInput) {
        cpfInput.addEventListener('input', function() {
            formatarCPF(this);
        });
    }

    if (telefoneInput) {
        telefoneInput.addEventListener('input', function() {
            formatarTelefone(this);
        });
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    inicializarModalFuncionario();
    carregarSelectEmpresas('empresa-funcionario');
});

/**
 * Função para parsear linhas CSV corretamente, lidando com campos entre aspas
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Adicionar o último campo
    result.push(current.trim());
    
    // Remover aspas dos campos
    return result.map(field => field.replace(/^"(.*)"$/, '$1'));
}

/**
 * Exporta um arquivo CSV com os cabeçalhos para servir de modelo.
 */
function exportarModeloCSV() {
    const headers = [
        "nome", "cpf", "dataNascimento (YYYY-MM-DD)", "sexo", "email", "telefone", 
        "empresaNome", "setor", "cargo", "salario", "dataAdmissao (YYYY-MM-DD)"
    ];
    const exemplo = [
        '"João Silva"', "123.456.789-00", "1990-05-20", "Masculino", "joao@email.com", "(11) 99999-9999", 
        "Empresa Exemplo", "TI", "Desenvolvedor", "5000.00", "2024-01-15"
    ];
    const exemplo2 = [
        '"Maria Santos"', "987.654.321-00", "maria@email.com", "(11) 88888-8888", 
        "Empresa Exemplo", "RH", "Analista", "4500.00", "20240110"
    ];
    const exemplo3 = [
        '"CHARLES AUGUSTO RIBEIRO DOS SANTOS"', "08194639905", "charles.santos17101991@gmail.com", "(42)991190590", 
        "Calcados Crival Ltda", "Gerente De RH", "Gerente De RH", "5600.00", "2022-01-10"
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + 
        headers.join(",") + "\n" + 
        exemplo.join(",") + "\n" +
        exemplo2.join(",") + "\n" +
        exemplo3.join(",");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_funcionarios.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarMensagem("Modelo CSV exportado com sucesso!", "success");
}

/**
 * Processa o arquivo CSV selecionado pelo usuário para importar funcionários.
 */
async function processarArquivoCSV() {
    const fileInput = document.getElementById('csv-file-input');
    const btnImportar = document.getElementById('btn-iniciar-importacao');
    const resultadoDiv = document.getElementById('importacao-resultado');
    const resumoDiv = document.getElementById('importacao-resumo');
    const errosLista = document.getElementById('importacao-erros-lista');

    if (fileInput.files.length === 0) {
        mostrarMensagem("Por favor, selecione um arquivo CSV.", "warning");
        return;
    }

    btnImportar.disabled = true;
    btnImportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';
    resultadoDiv.style.display = 'block';
    resumoDiv.innerHTML = '';
    errosLista.innerHTML = '';

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(event) {
        const csvData = event.target.result;
        const lines = csvData.split(/\r\n|\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            resumoDiv.innerHTML = `<div class="alert alert-danger">O arquivo CSV está vazio ou contém apenas cabeçalhos.</div>`;
            btnImportar.disabled = false;
            btnImportar.innerHTML = 'Iniciar Importação';
            return;
        }

        const headers = parseCSVLine(lines[0]);

        // Validação básica do cabeçalho
        const expectedHeaders = [
            "nome", "cpf", "dataNascimento (YYYY-MM-DD)", "sexo", "email", "telefone", 
            "empresaNome", "setor", "cargo", "salario", "dataAdmissao (YYYY-MM-DD)"
        ];
        if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
            resumoDiv.innerHTML = `<div class="alert alert-danger">O cabeçalho do arquivo CSV é inválido. Use o modelo exportado.</div>`;
            btnImportar.disabled = false;
            btnImportar.innerHTML = 'Iniciar Importação';
            return;
        }

        let sucessoCount = 0;
        let erroCount = 0;

        // Cache de empresas e CPFs para otimizar a validação
        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.data().nome.toLowerCase(), {id: doc.id, setores: doc.data().setores || []}]));
        
        const funcionariosSnap = await db.collection('funcionarios').get();
        const cpfsExistentes = new Set(funcionariosSnap.docs.map(doc => doc.data().cpf));

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const values = parseCSVLine(line);
            
            // Verificar se temos o número correto de colunas
            if (values.length !== expectedHeaders.length) {
                erroCount++;
                errosLista.innerHTML += `<li class="list-group-item list-group-item-danger">Linha ${i + 1}: Número incorreto de colunas. Esperado: ${expectedHeaders.length}, Encontrado: ${values.length}. Verifique se os campos com vírgulas estão entre aspas.</li>`;
                continue;
            }

            const funcionario = {
                nome: values[0]?.trim(),
                cpf: values[1]?.trim().replace(/\D/g, ''),
                dataNascimento: values[2]?.trim(),
                sexo: values[3]?.trim(),
                email: values[4]?.trim(),
                telefone: values[5]?.trim(),
                empresaNome: values[6]?.trim(),
                setor: values[7]?.trim(),
                cargo: values[8]?.trim(),
                salario: parseFloat(values[9]?.trim().replace(',', '.')) || 0,
                dataAdmissao: values[10]?.trim()
            };

            console.log('Funcionário processado:', funcionario); // Debug

            // Validações
            let erroMsg = '';
            
            // Validar campos obrigatórios
            if (!funcionario.nome) erroMsg = 'O campo "nome" é obrigatório.';
            else if (!funcionario.cpf) erroMsg = 'O campo "cpf" é obrigatório.';
            else if (!funcionario.dataNascimento) erroMsg = 'O campo "dataNascimento" é obrigatório.';
            else if (!funcionario.sexo) erroMsg = 'O campo "sexo" é obrigatório.';
            else if (!funcionario.empresaNome) erroMsg = 'O campo "empresaNome" é obrigatório.';
            else if (!funcionario.setor) erroMsg = 'O campo "setor" é obrigatório.';
            else if (!funcionario.cargo) erroMsg = 'O campo "cargo" é obrigatório.';
            else if (!funcionario.dataAdmissao) erroMsg = 'O campo "dataAdmissao" é obrigatório.';
            
            if (!erroMsg && !validarCPF(funcionario.cpf)) {
                erroMsg = `CPF inválido: ${funcionario.cpf}`;
            } else if (!erroMsg && cpfsExistentes.has(funcionario.cpf)) {
                erroMsg = `CPF já cadastrado no sistema: ${funcionario.cpf}`;
            } else if (!erroMsg && !empresasMap.has(funcionario.empresaNome.toLowerCase())) {
                erroMsg = `Empresa '${funcionario.empresaNome}' não encontrada.`;
            } else if (!erroMsg && !empresasMap.get(funcionario.empresaNome.toLowerCase()).setores.map(s => s.toLowerCase()).includes(funcionario.setor.toLowerCase())) {
                erroMsg = `Setor '${funcionario.setor}' não encontrado na empresa '${funcionario.empresaNome}'.`;
            }

            // Validar e converter datas
            let dataAdmissaoValida = null;
            let dataNascimentoValida = null;

            const validarFormatoData = (dataStr, nomeCampo) => {
                if (!dataStr) return { data: null, erro: `O campo "${nomeCampo}" é obrigatório.` };
                try {
                    let dataValida;
                    const dataLimpa = dataStr.replace(/['"]/g, '').trim();
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(dataLimpa)) {
                        return { data: null, erro: `Formato de data inválido para "${nomeCampo}": ${dataLimpa}. Use YYYY-MM-DD.` };
                    }
                    
                    const [year, month, day] = dataLimpa.split('-').map(Number);
                    dataValida = new Date(year, month - 1, day);

                    if (isNaN(dataValida.getTime())) {
                        return { data: null, erro: `Data inválida para "${nomeCampo}": ${dataLimpa}` };
                    }
                    return { data: dataValida, erro: null };
                } catch (e) {
                    return { data: null, erro: `Erro ao processar data para "${nomeCampo}": ${dataStr}` };
                }
            };

            if (!erroMsg) {
                const resultadoAdmissao = validarFormatoData(funcionario.dataAdmissao, 'dataAdmissao');
                if (resultadoAdmissao.erro) {
                    erroMsg = resultadoAdmissao.erro;
                } else {
                    dataAdmissaoValida = resultadoAdmissao.data;
                }
            }

            if (!erroMsg) {
                const resultadoNascimento = validarFormatoData(funcionario.dataNascimento, 'dataNascimento');
                if (resultadoNascimento.erro) {
                    erroMsg = resultadoNascimento.erro;
                } else {
                    dataNascimentoValida = resultadoNascimento.data;
                }
            }

            if (erroMsg) {
                erroCount++;
                errosLista.innerHTML += `<li class="list-group-item list-group-item-danger">Linha ${i + 1} (${funcionario.nome || 'Sem nome'}): ${erroMsg}</li>`;
            } else {
                try {
                    const empresaData = empresasMap.get(funcionario.empresaNome.toLowerCase());
                    const novoFuncionario = {
                        nome: funcionario.nome,
                        cpf: funcionario.cpf,
                        email: funcionario.email,
                        telefone: funcionario.telefone,
                        empresaId: empresaData.id,
                        sexo: funcionario.sexo,                        
                        dataNascimento: dataNascimentoValida,
                        setor: funcionario.setor,
                        cargo: funcionario.cargo,
                        salario: funcionario.salario,
                        dataAdmissao: dataAdmissaoValida,
                        status: 'Ativo',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdByUid: firebase.auth().currentUser?.uid
                    };
                    
                    await db.collection('funcionarios').add(novoFuncionario);
                    cpfsExistentes.add(novoFuncionario.cpf);
                    sucessoCount++;
                } catch (dbError) {
                    console.error(`Erro detalhado ao salvar linha ${i + 1}:`, dbError);
                    erroCount++;
                    errosLista.innerHTML += `<li class="list-group-item list-group-item-danger">Linha ${i + 1} (${funcionario.nome}): Erro ao salvar no banco de dados: ${dbError.message}</li>`;
                }
            }
        }

        resumoDiv.innerHTML = `<div class="alert alert-info">Importação concluída! Sucesso: ${sucessoCount}, Falhas: ${erroCount}.</div>`;
        btnImportar.disabled = false;
        btnImportar.innerHTML = 'Iniciar Importação';
        carregarFuncionarios();
    };

    reader.onerror = function() {
        resumoDiv.innerHTML = `<div class="alert alert-danger">Erro ao ler o arquivo.</div>`;
        btnImportar.disabled = false;
        btnImportar.innerHTML = 'Iniciar Importação';
    };

    reader.readAsText(file);
}

// Funções auxiliares para formatação de data
function formatarDataParaInput(data) {
    if (!data) return '';
    const dateObj = data.toDate ? data.toDate() : new Date(data);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatarData(data) {
    if (!data) return 'N/A';
    const dateObj = data.toDate ? data.toDate() : new Date(data);
    return dateObj.toLocaleDateString('pt-BR');
}