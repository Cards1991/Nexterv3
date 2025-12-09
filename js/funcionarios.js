// Gerenciamento de funcionários
let funcionarios = [];

document.addEventListener('DOMContentLoaded', () => {
    const filtroEmpresa = document.getElementById('filtro-empresa-funcionarios');
    if (filtroEmpresa) {
        filtroEmpresa.addEventListener('change', carregarFuncionarios);
    }
    const filtroNome = document.getElementById('filtro-nome-funcionarios');
    if (filtroNome) {
        filtroNome.addEventListener('input', carregarFuncionarios);
    }
});

// Carregar empresas para selects
async function carregarSelectEmpresas(selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Selecione uma empresa</option>';

        const empresasSnapshot = await db.collection('empresas')
            .orderBy('nome')
            .get();

        empresasSnapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

// Carregar líderes para selects
async function carregarSelectLideres(selectId, funcionarioIdExcluir = null) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Salvar valor atual se existir
        const valorAtual = select.value;
        
        select.innerHTML = '<option value="">Sem líder</option>';

        const funcionariosSnapshot = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .orderBy('nome')
            .get();

        funcionariosSnapshot.forEach(doc => {
            // Não incluir o próprio funcionário se estiver editando
            if (funcionarioIdExcluir && doc.id === funcionarioIdExcluir) {
                return;
            }

            const func = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = func.nome;
            select.appendChild(option);
        });

        // Restaurar valor anterior se ainda existir
        if (valorAtual) {
            select.value = valorAtual;
        }
    } catch (error) {
        console.error('Erro ao carregar líderes:', error);
    }
}

// Carregar funcionários
async function carregarFuncionarios() {
    try {
        const tbody = document.getElementById('tabela-funcionarios');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        await preencherFiltroEmpresaFuncionarios();
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

        // Popula o array de funcionários primeiro
        funcionarios = funcionariosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Aplicar filtros
        const filtroEmpresaId = document.getElementById('filtro-empresa-funcionarios').value;
        const filtroNome = document.getElementById('filtro-nome-funcionarios').value.toLowerCase();

        let funcionariosFiltrados = funcionarios;

        if (filtroEmpresaId) {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.empresaId === filtroEmpresaId);
        }
        if (filtroNome) {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.nome.toLowerCase().includes(filtroNome));
        }

        if (funcionariosFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum funcionário encontrado para os filtros aplicados.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        for (const funcionario of funcionariosFiltrados) {
            const docId = funcionario.id;
            const status = funcionario.status || 'Ativo';
            const statusClass = status === 'Inativo' ? 'bg-danger' : 'bg-success';

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
                    <button class="btn btn-sm btn-outline-primary" onclick="editarFuncionario('${docId}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="verDetalhesFuncionario('${docId}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirFuncionario('${docId}', '${funcionario.nome}')">
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

async function preencherFiltroEmpresaFuncionarios() {
    try {
        const select = document.getElementById('filtro-empresa-funcionarios');
        if (!select || select.options.length > 1) return; // Não recarrega se já estiver preenchido
        if (!select) {
            console.warn("Elemento 'filtro-empresa-funcionarios' não encontrado.");
            return;
        }

        // Sempre limpa as opções existentes e adiciona a opção padrão
        select.innerHTML = '<option value="">Filtrar por Empresa...</option>';

        const empresasSnapshot = await db.collection('empresas')
            .orderBy('nome')
            .get();

        empresasSnapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao preencher filtro de empresas:', error);
    }
}

// Salvar funcionário
async function salvarFuncionario() {
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        const nome = document.getElementById('nome-funcionario').value;
        const matricula = document.getElementById('matricula-funcionario').value;
        const cpf = document.getElementById('cpf-funcionario').value;
        const rg = document.getElementById('rg-funcionario').value;
        const email = document.getElementById('email-funcionario').value;
        const telefone = document.getElementById('telefone-funcionario').value;
        const sexo = document.getElementById('sexo-funcionario').value;
        const dataNascimento = document.getElementById('nascimento-funcionario').value;

        const empresaId = document.getElementById('empresa-funcionario').value;
        const setor = document.getElementById('setor-funcionario').value;
        const cargo = document.getElementById('cargo-funcionario').value;
        const liderId = document.getElementById('lider-funcionario').value;
        const dataAdmissao = document.getElementById('admissao-funcionario').value;
        const salario = parseFloat(document.getElementById('salario-funcionario').value) || 0;
        const salarioPorFora = parseFloat(document.getElementById('salario-por-fora-funcionario').value) || 0;
        const jornada = document.getElementById('jornada-funcionario').value;
        const tipoContrato = document.getElementById('contrato-funcionario').value;
        const regimeTrabalho = document.getElementById('regime-funcionario').value;

        const escolaridade = document.getElementById('escolaridade-funcionario').value;
        const idiomas = document.getElementById('idiomas-funcionario').value;
        const certificacoes = document.getElementById('certificacoes-funcionario').value;
        const cursos = document.getElementById('cursos-funcionario').value;

        const avaliacaoDesempenho = parseFloat(document.getElementById('desempenho-avaliacao').value) || null;
        const dataAvaliacao = document.getElementById('desempenho-data-avaliacao').value;
        const metas = document.getElementById('desempenho-metas').value;
        const feedback = document.getElementById('desempenho-feedback').value;

        const temPlanoSaude = document.getElementById('beneficio-plano-saude').checked;
        const temValeTransporte = document.getElementById('beneficio-vale-transporte').checked;
        const temValeAlimentacao = document.getElementById('beneficio-vale-alimentacao').checked;
        const temSeguroVida = document.getElementById('beneficio-seguro-vida').checked;
        const outrosBeneficios = document.getElementById('beneficio-outros').value;

        if (!nome || !cpf || !empresaId || !setor || !cargo || !dataAdmissao || !dataNascimento || !sexo) {
            new bootstrap.Tab(document.getElementById('identificacao-tab')).show();
            mostrarMensagem('Preencha todos os campos obrigatórios nas abas.', 'warning');
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
            matricula: matricula,
            cpf: cpf,
            rg: rg,
            email: email,
            telefone: telefone,
            sexo: sexo,
            dataNascimento: new Date(dataNascimento.replace(/-/g, '\/')),

            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            liderId: liderId || null,
            dataAdmissao: dataAdmissaoValida,
            salario: salario,
            salarioPorFora: salarioPorFora,
            jornada: jornada,
            tipoContrato: tipoContrato,
            regimeTrabalho: regimeTrabalho,

            escolaridade: escolaridade,
            idiomas: idiomas,
            certificacoes: certificacoes,
            cursos: cursos,

            desempenho: {
                ultimaAvaliacao: avaliacaoDesempenho,
                dataUltimaAvaliacao: dataAvaliacao ? new Date(dataAvaliacao.replace(/-/g, '\/')) : null,
                metas: metas,
                feedbackPDI: feedback
            },

            beneficios: {
                planoSaude: temPlanoSaude,
                valeTransporte: temValeTransporte,
                valeAlimentacao: temValeAlimentacao,
                seguroVida: temSeguroVida,
                outros: outrosBeneficios
            },

            status: 'Ativo',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),            
            createdByUid: user ? user.uid : null
        };

        const docRef = await db.collection('funcionarios').add(funcionarioData);
        // Passa o ID do novo documento para a função de cálculo de custo
        await atualizarCustoTotal(docRef.id, salario, empresaId, salarioPorFora);

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
        document.getElementById('matricula-funcionario').value = funcionario.matricula || '';
        document.getElementById('cpf-funcionario').value = funcionario.cpf;
        document.getElementById('rg-funcionario').value = funcionario.rg || '';
        document.getElementById('email-funcionario').value = funcionario.email;
        document.getElementById('telefone-funcionario').value = funcionario.telefone || '';
        document.getElementById('sexo-funcionario').value = funcionario.sexo || '';
        document.getElementById('nascimento-funcionario').value = funcionario.dataNascimento ? formatarDataParaInput(funcionario.dataNascimento) : '';

        document.getElementById('lider-funcionario').value = funcionario.liderId || '';
        document.getElementById('admissao-funcionario').value = funcionario.dataAdmissao ? formatarDataParaInput(funcionario.dataAdmissao) : '';
        document.getElementById('salario-funcionario').value = funcionario.salario || '';
        document.getElementById('salario-por-fora-funcionario').value = funcionario.salarioPorFora || '';
        document.getElementById('jornada-funcionario').value = funcionario.jornada || '';
        document.getElementById('contrato-funcionario').value = funcionario.tipoContrato || 'CLT';
        document.getElementById('regime-funcionario').value = funcionario.regimeTrabalho || 'Presencial';

        document.getElementById('escolaridade-funcionario').value = funcionario.escolaridade || '';
        document.getElementById('idiomas-funcionario').value = funcionario.idiomas || '';
        document.getElementById('certificacoes-funcionario').value = funcionario.certificacoes || '';
        document.getElementById('cursos-funcionario').value = funcionario.cursos || '';

        document.getElementById('desempenho-avaliacao').value = funcionario.desempenho?.ultimaAvaliacao || '';
        document.getElementById('desempenho-data-avaliacao').value = funcionario.desempenho?.dataUltimaAvaliacao ? formatarDataParaInput(funcionario.desempenho.dataUltimaAvaliacao) : '';
        document.getElementById('desempenho-metas').value = funcionario.desempenho?.metas || '';
        document.getElementById('desempenho-feedback').value = funcionario.desempenho?.feedbackPDI || '';

        document.getElementById('beneficio-plano-saude').checked = funcionario.beneficios?.planoSaude || false;
        document.getElementById('beneficio-vale-transporte').checked = funcionario.beneficios?.valeTransporte || false;
        document.getElementById('beneficio-vale-alimentacao').checked = funcionario.beneficios?.valeAlimentacao || false;
        document.getElementById('beneficio-seguro-vida').checked = funcionario.beneficios?.seguroVida || false;
        document.getElementById('beneficio-outros').value = funcionario.beneficios?.outros || '';

        // Carregar e selecionar empresa e setor
        const empresaSelect = document.getElementById('empresa-funcionario');
        await carregarSelectEmpresas('empresa-funcionario'); // Garante que as empresas estão carregadas
        
        // Carregar líderes excluindo o próprio funcionário
        if (document.getElementById('lider-funcionario')) {
            await carregarSelectLideres('lider-funcionario', funcionarioId);
        }
        
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
        const matricula = document.getElementById('matricula-funcionario').value;
        const cpf = document.getElementById('cpf-funcionario').value;
        const rg = document.getElementById('rg-funcionario').value;
        const email = document.getElementById('email-funcionario').value;
        const telefone = document.getElementById('telefone-funcionario').value;
        const sexo = document.getElementById('sexo-funcionario').value;
        const dataNascimento = document.getElementById('nascimento-funcionario').value;

        const empresaId = document.getElementById('empresa-funcionario').value;
        const setor = document.getElementById('setor-funcionario').value;
        const cargo = document.getElementById('cargo-funcionario').value;
        const liderId = document.getElementById('lider-funcionario').value;
        const dataAdmissao = document.getElementById('admissao-funcionario').value;
        const salario = parseFloat(document.getElementById('salario-funcionario').value) || 0;
        const salarioPorFora = parseFloat(document.getElementById('salario-por-fora-funcionario').value) || 0;
        const jornada = document.getElementById('jornada-funcionario').value;
        const tipoContrato = document.getElementById('contrato-funcionario').value;
        const regimeTrabalho = document.getElementById('regime-funcionario').value;

        const escolaridade = document.getElementById('escolaridade-funcionario').value;
        const idiomas = document.getElementById('idiomas-funcionario').value;
        const certificacoes = document.getElementById('certificacoes-funcionario').value;
        const cursos = document.getElementById('cursos-funcionario').value;

        const avaliacaoDesempenho = parseFloat(document.getElementById('desempenho-avaliacao').value) || null;
        const dataAvaliacao = document.getElementById('desempenho-data-avaliacao').value;
        const metas = document.getElementById('desempenho-metas').value;
        const feedback = document.getElementById('desempenho-feedback').value;

        const temPlanoSaude = document.getElementById('beneficio-plano-saude').checked;
        const temValeTransporte = document.getElementById('beneficio-vale-transporte').checked;
        const temValeAlimentacao = document.getElementById('beneficio-vale-alimentacao').checked;
        const temSeguroVida = document.getElementById('beneficio-seguro-vida').checked;
        const outrosBeneficios = document.getElementById('beneficio-outros').value;

        if (!nome || !cpf || !empresaId || !setor || !cargo || !dataAdmissao || !dataNascimento || !sexo) {
            // Navega para a primeira aba se houver erro de validação
            new bootstrap.Tab(document.getElementById('identificacao-tab')).show();
            mostrarMensagem('Preencha todos os campos obrigatórios nas abas.', 'warning');
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
            matricula: matricula,
            cpf: cpf,
            rg: rg,
            email: email,
            telefone: telefone,
            sexo: sexo,
            dataNascimento: new Date(dataNascimento.replace(/-/g, '\/')),

            empresaId: empresaId,
            setor: setor,
            cargo: cargo,
            liderId: liderId || null,
            dataAdmissao: dataAdmissaoValida,
            salario: salario,
            salarioPorFora: salarioPorFora,
            jornada: jornada,
            tipoContrato: tipoContrato,
            regimeTrabalho: regimeTrabalho,

            escolaridade: escolaridade,
            idiomas: idiomas,
            certificacoes: certificacoes,
            cursos: cursos,

            desempenho: {
                ultimaAvaliacao: avaliacaoDesempenho,
                dataUltimaAvaliacao: dataAvaliacao ? new Date(dataAvaliacao.replace(/-/g, '\/')) : null,
                metas: metas,
                feedbackPDI: feedback
            },

            beneficios: {
                planoSaude: temPlanoSaude,
                valeTransporte: temValeTransporte,
                valeAlimentacao: temValeAlimentacao,
                seguroVida: temSeguroVida,
                outros: outrosBeneficios
            },

            updatedAt: timestamp(),
            updatedByUid: user ? user.uid : null
        };

        await db.collection('funcionarios').doc(funcionarioId).update(updateData);

        await atualizarCustoTotal(funcionarioId, salario, empresaId, salarioPorFora);

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

async function atualizarCustoTotal(funcionarioId, salario, empresaId, salarioPorFora = 0) {
    try {
        // Lógica de cálculo simplificada conforme solicitado.
        // Custo = Salário + 8% de FGTS + Provisão de Férias (1/12) + Terço de Férias + FGTS s/ Férias + Provisão 13º + FGTS s/ 13º + Sindicato + Patronal + RAT + INCRA + VR.
        const fgts = salario * 0.08;
        const provisaoFerias = salario / 12;
        const tercoFerias = provisaoFerias / 3;
        const fgtsSobreFerias = provisaoFerias * 0.08;
        const provisao13 = salario / 12;
        const fgtsSobre13 = provisao13 * 0.08;

        let custoSindicato = 0;
        let custoPatronal = 0;
        let custoRat = 0;
        let custoIncra = 0;
        let custoValeRefeicao = 0;

        // Busca dados da empresa e do funcionário em paralelo
        const [empresaDoc, funcionarioDoc] = await Promise.all([
            db.collection('empresas').doc(empresaId).get(),
            db.collection('funcionarios').doc(funcionarioId).get()
        ]);

        if (empresaDoc.exists) {
            const empresaData = empresaDoc.data();
            const baseCalculoContribuicoes = salario + provisaoFerias + provisao13;

            if (empresaData.pagaSindicato === true) {
                custoSindicato = baseCalculoContribuicoes * 0.008; // 0.8%
            }
            if (empresaData.pagaContribuicaoPatronal === true) {
                custoPatronal = baseCalculoContribuicoes * 0.20; // 20%

                // Calcula o RAT apenas se a contribuição patronal estiver ativa
                if (empresaData.rat && empresaData.rat > 0) {
                    const percentualRat = (empresaData.rat * 2) / 100;
                    custoRat = salario * percentualRat;
                }

                // Calcula o INCRA (0.2%) apenas se a contribuição patronal estiver ativa
                custoIncra = salario * 0.002;
            }
        }

        if (funcionarioDoc.exists && funcionarioDoc.data().beneficios?.valeAlimentacao === true) {
            custoValeRefeicao = 260.00;
        }

        const custoTotal = salario + fgts + provisaoFerias + tercoFerias + fgtsSobreFerias + provisao13 + fgtsSobre13 + 
                           custoSindicato + custoPatronal + custoRat + custoIncra + custoValeRefeicao + 
                           salarioPorFora; // Adiciona o salário por fora ao custo final

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

        // Histórico de Aumentos
        historicoHTML += '<h6 class="mt-4">Histórico de Aumentos:</h6>';
        if (Array.isArray(funcionario.historicoAumentos) && funcionario.historicoAumentos.length > 0) {
            historicoHTML += '<ul class="list-group list-group-flush" id="historico-aumentos-lista">';
            funcionario.historicoAumentos.forEach((aumento, index) => {
                historicoHTML += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${formatarData(aumento.data)}:</strong> Aumento de R$ ${aumento.valor.toFixed(2)} (${aumento.tipo === 'folha' ? 'Em Folha' : 'Por Fora'})
                            <br><small class="text-muted">Motivo: ${aumento.motivo} | Assinado por: ${aumento.assinatura}</small>
                        </div>
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-primary" onclick="editarAumentoSalario('${funcionarioId}', ${index})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-outline-danger" onclick="excluirAumentoSalario('${funcionarioId}', ${index})"><i class="fas fa-trash"></i></button>
                            <button class="btn btn-outline-secondary" onclick="visualizarTermoAumento('${funcionarioId}', ${index})"><i class="fas fa-print"></i></button>
                        </div>
                    </li>`;
            });
            historicoHTML += '</ul>';
        } else {
            historicoHTML += '<p class="text-muted">Nenhum aumento salarial registrado.</p>';
        }

        // Buscar a última avaliação de desempenho
        const avaliacoesSnap = await db.collection('avaliacoes_colaboradores')
            .where('funcionarioId', '==', funcionarioId)
            .orderBy('dataAvaliacao', 'desc')
            .limit(1)
            .get();

        let ultimaAvaliacao = null;
        let dataUltimaAvaliacao = null;
        if (!avaliacoesSnap.empty) {
            const avaliacao = avaliacoesSnap.docs[0].data();
            ultimaAvaliacao = avaliacao.nota;
            dataUltimaAvaliacao = avaliacao.dataAvaliacao.toDate();
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

            <h5 class="section-title mt-3">Desempenho</h5>
            <div class="row">
                <div class="col-md-6 detail-item">
                    <div class="detail-label">Última Avaliação</div>
                    <div class="detail-value"><i class="fas fa-star"></i> ${ultimaAvaliacao ? ultimaAvaliacao.toFixed(1) + ' / 5' : 'N/A'}</div>
                </div>
                <div class="col-md-6 detail-item">
                    <div class="detail-label">Data da Avaliação</div>
                    <div class="detail-value"><i class="fas fa-calendar-check"></i> ${dataUltimaAvaliacao ? formatarData(dataUltimaAvaliacao) : 'N/A'}</div>
                </div>
            </div>

            <div class="mt-4">${historicoHTML}</div>
        `;

        const modalId = `detalhes-modal-${funcionarioId}`;
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = modalId;

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
                        <button type="button" class="btn btn-success" onclick="abrirModalAumento('${funcionarioId}', '${funcionario.nome}', '${modalId}')">
                            <i class="fas fa-dollar-sign"></i> Aumentar Salário
                        </button>
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
    try {
        inicializarModalFuncionario();
        
        // Carregar empresas
        if (document.getElementById('empresa-funcionario')) {
            carregarSelectEmpresas('empresa-funcionario');
        }
        
        // Carregar líderes
        if (document.getElementById('lider-funcionario')) {
            carregarSelectLideres('lider-funcionario');
        }
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
});

/**
 * Exporta um arquivo CSV com os cabeçalhos para servir de modelo.
 */
function exportarModeloCSV() {
    const headers = [
        "Nome Completo", "CPF", "Data de Nascimento (YYYY-MM-DD)", "Sexo", "Email", "Telefone", 
        "Nome da Empresa", "Setor", "Cargo", "Salário", "Data de Admissão (YYYY-MM-DD)"
    ];
    const exemplo = [
        '"João da Silva"', "537.418.338-49", "1990-05-20", "Masculino", "joao@email.com", "(11) 99999-9999", 
        "Empresa Exemplo", "TI", "Desenvolvedor", "5000.00", "2024-01-15"
    ];
    const exemplo2 = [
        '"Maria Santos"', "842.765.908-52", "1992-08-10", "Feminino", "maria@email.com", "(11) 88888-8888", 
        "Empresa Exemplo", "RH", "Analista", "4500.00", "2024-01-10"
    ];
    const exemplo3 = [
        '"CHARLES AUGUSTO RIBEIRO DOS SANTOS"', "081.946.399-05", "1991-10-17", "Masculino", "charles.santos17101991@gmail.com", "(42)991190590", 
        "Calcados Crival Ltda", "RH", "Gerente De RH", "5600.00", "2022-01-10"
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

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8", // Especifica a codificação
        complete: async function(results) {
            const data = results.data;

            if (data.length === 0) {
                resumoDiv.innerHTML = `<div class="alert alert-danger">O arquivo CSV está vazio ou em formato inválido.</div>`;
                btnImportar.disabled = false;
                btnImportar.innerHTML = 'Iniciar Importação';
                return;
            }

            let sucessoCount = 0;
            let erroCount = 0;
            const erros = [];

            // Cache de empresas e CPFs para otimizar a validação
            const empresasSnap = await db.collection('empresas').get();
            const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.data().nome.toLowerCase(), {id: doc.id, setores: doc.data().setores || [], funcoes: doc.data().funcoes || []}]));
            
            const funcionariosSnap = await db.collection('funcionarios').get();
            const cpfsExistentes = new Set(funcionariosSnap.docs.map(doc => doc.data().cpf));

            for (const [index, row] of data.entries()) {
                const linhaNum = index + 2; // +1 para o índice base 1, +1 para o cabeçalho
                
                const funcionario = {
                    nome: row['Nome Completo']?.trim(),
                    cpf: row['CPF']?.trim().replace(/\D/g, ''),
                    dataNascimento: row['Data de Nascimento (YYYY-MM-DD)']?.trim(),
                    sexo: row['Sexo']?.trim(),
                    email: row['Email']?.trim(),
                    telefone: row['Telefone']?.trim(),
                    empresaNome: row['Nome da Empresa']?.trim(),
                    setor: row['Setor']?.trim(),
                    cargo: row['Cargo']?.trim(),
                    salario: parseFloat(row['Salário']?.trim().replace(',', '.')) || 0,
                    dataAdmissao: row['Data de Admissão (YYYY-MM-DD)']?.trim()
                };

                let erroMsg = '';
                
                // Validar campos obrigatórios
                if (!funcionario.nome) erroMsg = 'O campo "Nome Completo" é obrigatório.';
                else if (!funcionario.cpf) erroMsg = 'O campo "CPF" é obrigatório.';
                else if (!funcionario.dataNascimento) erroMsg = 'O campo "Data de Nascimento" é obrigatório.';
                else if (!funcionario.sexo) erroMsg = 'O campo "Sexo" é obrigatório.';
                else if (!funcionario.empresaNome) erroMsg = 'O campo "Nome da Empresa" é obrigatório.';
                else if (!funcionario.setor) erroMsg = 'O campo "Setor" é obrigatório.';
                else if (!funcionario.cargo) erroMsg = 'O campo "Cargo" é obrigatório.';
                else if (!funcionario.dataAdmissao) erroMsg = 'O campo "Data de Admissão" é obrigatório.';
                
                if (!erroMsg && !validarCPF(funcionario.cpf)) {
                    erroMsg = `CPF inválido: ${funcionario.cpf}`;
                } else if (!erroMsg && cpfsExistentes.has(funcionario.cpf)) {
                    erroMsg = `CPF já cadastrado no sistema: ${funcionario.cpf}`;
                } else if (!erroMsg && !empresasMap.has(funcionario.empresaNome.toLowerCase())) {
                    erroMsg = `Empresa '${funcionario.empresaNome}' não encontrada.`;
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
                    const resultadoAdmissao = validarFormatoData(funcionario.dataAdmissao, 'Data de Admissão');
                    if (resultadoAdmissao.erro) {
                        erroMsg = resultadoAdmissao.erro;
                    } else {
                        dataAdmissaoValida = resultadoAdmissao.data;
                    }
                }

                if (!erroMsg) {
                    const resultadoNascimento = validarFormatoData(funcionario.dataNascimento, 'Data de Nascimento');
                    if (resultadoNascimento.erro) {
                        erroMsg = resultadoNascimento.erro;
                    } else {
                        dataNascimentoValida = resultadoNascimento.data;
                    }
                }

                if (erroMsg) {
                    erroCount++;
                    erros.push(`<li class="list-group-item list-group-item-danger">Linha ${linhaNum} (${funcionario.nome || 'Sem nome'}): ${erroMsg}</li>`);
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
                        console.error(`Erro detalhado ao salvar linha ${linhaNum}:`, dbError);
                        erroCount++;
                        erros.push(`<li class="list-group-item list-group-item-danger">Linha ${linhaNum} (${funcionario.nome}): Erro ao salvar no banco de dados: ${dbError.message}</li>`);
                    }
                }
            }

            resumoDiv.innerHTML = `<div class="alert alert-info">Importação concluída! Sucesso: ${sucessoCount}, Falhas: ${erroCount}.</div>`;
            errosLista.innerHTML = erros.join('');
            btnImportar.disabled = false;
            btnImportar.innerHTML = 'Iniciar Importação';
            carregarFuncionarios();
        }
    });

    reader.onerror = function() {
        resumoDiv.innerHTML = `<div class="alert alert-danger">Erro ao ler o arquivo.</div>`;
        btnImportar.disabled = false;
        btnImportar.innerHTML = 'Iniciar Importação';
    };

    reader.readAsText(file, 'UTF-8');
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

// Funções para Aumento Salarial

function abrirModalAumento(funcionarioId, nomeFuncionario, detalhesModalId) {
    const detalhesModalEl = document.getElementById(detalhesModalId);
    const modalAumentoEl = document.getElementById('aumentoSalarioModal');
    const modalAumento = bootstrap.Modal.getOrCreateInstance(modalAumentoEl);

    // Função para abrir o modal de aumento
    const showAumentoModal = () => {
        document.getElementById('form-aumento-salario').reset();
        document.getElementById('aumento-funcionario-id').value = funcionarioId;
        document.getElementById('aumento-funcionario-nome').value = nomeFuncionario;
        document.getElementById('aumento-data').valueAsDate = new Date();
        modalAumento.show();
    };

    // Adiciona um listener para abrir o segundo modal APÓS o primeiro ser completamente fechado
    detalhesModalEl.addEventListener('hidden.bs.modal', showAumentoModal, { once: true });

    // Inicia o processo de fechar o primeiro modal
    bootstrap.Modal.getInstance(detalhesModalEl).hide();
}

async function salvarAumentoSalario() {
    const funcionarioId = document.getElementById('aumento-funcionario-id').value;
    const valorAumento = parseFloat(document.getElementById('aumento-valor').value);
    const dataAumento = document.getElementById('aumento-data').value;
    const motivoAumento = document.getElementById('aumento-motivo').value;
    const assinatura = document.getElementById('aumento-assinatura').value;
    const tipoAumento = document.querySelector('input[name="tipo-aumento"]:checked').value;

    if (!funcionarioId || !valorAumento || !dataAumento || !motivoAumento || !assinatura) {
        mostrarMensagem("Preencha todos os campos para registrar o aumento.", "warning");
        return;
    }

    try {
        const funcRef = db.collection('funcionarios').doc(funcionarioId);
        const funcDoc = await funcRef.get();
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }

        const dadosFuncionario = funcDoc.data();
        let novoSalario = dadosFuncionario.salario || 0;
        let novoSalarioPorFora = dadosFuncionario.salarioPorFora || 0;

        if (tipoAumento === 'folha') {
            novoSalario += valorAumento;
        } else {
            novoSalarioPorFora += valorAumento;
        }

        const registroAumento = {
            data: new Date(dataAumento.replace(/-/g, '\/')),
            valor: valorAumento,
            motivo: motivoAumento,
            assinatura: assinatura,
            tipo: tipoAumento, // 'folha' ou 'por_fora'
            salarioAnterior: dadosFuncionario.salario || 0,
            salarioPorForaAnterior: dadosFuncionario.salarioPorFora || 0,
            novoSalario: novoSalario
        };

        await funcRef.update({
            salario: novoSalario,
            salarioPorFora: novoSalarioPorFora,
            historicoAumentos: firebase.firestore.FieldValue.arrayUnion(registroAumento)
        });

        await atualizarCustoTotal(funcionarioId, novoSalario, dadosFuncionario.empresaId, novoSalarioPorFora);

        bootstrap.Modal.getInstance(document.getElementById('aumentoSalarioModal')).hide();
        mostrarMensagem("Aumento salarial registrado e aplicado com sucesso!", "success");
        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao salvar aumento salarial:", error);
        mostrarMensagem("Falha ao registrar o aumento.", "error");
    }
}

async function imprimirAumentoSalario() {
    const funcionarioId = document.getElementById('aumento-funcionario-id').value;
    const nomeFuncionario = document.getElementById('aumento-funcionario-nome').value;
    const valorAumento = parseFloat(document.getElementById('aumento-valor').value) || 0;
    const dataAumento = document.getElementById('aumento-data').value;
    const motivoAumento = document.getElementById('aumento-motivo').value;
    const assinatura = document.getElementById('aumento-assinatura').value;
    const tipoAumento = document.querySelector('input[name="tipo-aumento"]:checked').value;

    const dataFormatada = new Date(dataAumento).toLocaleDateString('pt-BR');
    const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const tipoTexto = tipoAumento === 'folha' ? 'Salário em Folha' : 'Salário por Fora';

    const conteudo = `
        <html>
        <head>
            <title>Autorização de Aumento Salarial</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }
                .termo-container { max-width: 800px; margin: auto; border: 1px solid #dee2e6; padding: 2.5rem; border-radius: 15px; }
                .termo-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; }
                .termo-header h2 { font-weight: 700; color: #0d6efd; }
                .termo-body p { font-size: 1.1rem; line-height: 1.8; text-align: justify; }
                .assinatura { margin-top: 80px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="termo-container">
                <div class="termo-header">
                    <h2><i class="fas fa-award"></i> AUTORIZAÇÃO DE AUMENTO SALARIAL</h2>
                </div>
                <div class="termo-body">
                    <p>Eu, <strong>${assinatura}</strong>, na qualidade de diretor(a), autorizo a alteração salarial para o(a) colaborador(a) <strong>${nomeFuncionario}</strong>, conforme os detalhes abaixo:</p>
                    <p><strong>Tipo de Aumento:</strong> ${tipoTexto}<br>
                       <strong>Valor do Aumento:</strong> R$ ${valorAumento.toFixed(2)}<br>
                       <strong>Motivo:</strong> ${motivoAumento}
                    </p>
                    <p style="text-align: right; margin-top: 40px;">${hojeFormatado}.</p>
                </div>
                <div class="assinatura">
                    <p>_________________________________________</p>
                    <p><strong>${assinatura}</strong><br>Diretor(a)</p>
                </div>
                 <div class="assinatura">
                    <p>_________________________________________</p>
                    <p><strong>${nomeFuncionario}</strong><br>Colaborador(a)</p>
                </div>
            </div>
        </body>
        </html>
    `;

    openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });
}

async function visualizarTermoAumento(funcionarioId, historicoIndex) {
    try {
        const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }

        const funcionario = funcDoc.data();
        const aumento = funcionario.historicoAumentos[historicoIndex];

        if (!aumento) {
            mostrarMensagem("Registro de aumento não encontrado.", "error");
            return;
        }

        const dataFormatada = formatarData(aumento.data);
        const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        const tipoTexto = aumento.tipo === 'folha' ? 'Salário em Folha' : 'Salário por Fora';

        const conteudo = `
            <html>
            <head>
                <title>Autorização de Aumento Salarial</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }
                    .termo-container { max-width: 800px; margin: auto; border: 1px solid #dee2e6; padding: 2.5rem; border-radius: 15px; }
                    .termo-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .termo-header h2 { font-weight: 700; color: #0d6efd; }
                    .termo-body p { font-size: 1.1rem; line-height: 1.8; text-align: justify; }
                    .assinatura { margin-top: 80px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="termo-container">
                    <div class="termo-header"><h2><i class="fas fa-award"></i> AUTORIZAÇÃO DE AUMENTO SALARIAL</h2></div>
                    <div class="termo-body">
                    <p>Eu, <strong>${aumento.assinatura}</strong>, na qualidade de diretor(a), autorizei a alteração salarial para o(a) colaborador(a) <strong>${funcionario.nome}</strong>, conforme os detalhes abaixo:</p>
                    <p><strong>Tipo de Aumento:</strong> ${tipoTexto}<br>
                       <strong>Valor do Aumento:</strong> R$ ${parseFloat(aumento.valor).toFixed(2)}<br>
                       <strong>Motivo:</strong> ${aumento.motivo}
                    </p>
                        <p style="text-align: right; margin-top: 40px;">${hojeFormatado}.</p>
                    </div>
                    <div class="assinatura"><p>_________________________________________</p><p><strong>${aumento.assinatura}</strong><br>Diretor(a)</p></div>
                    <div class="assinatura"><p>_________________________________________</p><p><strong>${funcionario.nome}</strong><br>Colaborador(a)</p></div>
                </div>
            </body>
            </html>`;

        openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });

    } catch (error) {
        console.error("Erro ao visualizar termo de aumento:", error);
        mostrarMensagem("Falha ao gerar o termo para visualização.", "error");
    }
}

// Funções auxiliares para editar e excluir aumentos salariais
async function editarAumentoSalario(funcionarioId, historicoIndex) {
    try {
        const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }

        const funcionario = funcDoc.data();
        const aumento = funcionario.historicoAumentos[historicoIndex];

        if (!aumento) {
            mostrarMensagem("Registro de aumento não encontrado.", "error");
            return;
        }

        // Preencher o modal de aumento com os dados existentes
        document.getElementById('aumento-funcionario-id').value = funcionarioId;
        document.getElementById('aumento-funcionario-nome').value = funcionario.nome;
        document.getElementById('aumento-valor').value = aumento.valor;
        document.getElementById('aumento-data').value = formatarDataParaInput(aumento.data);
        document.getElementById('aumento-motivo').value = aumento.motivo;
        document.getElementById('aumento-assinatura').value = aumento.assinatura;
        
        // Selecionar o tipo de aumento correto
        const tipoAumentoRadio = document.querySelector(`input[name="tipo-aumento"][value="${aumento.tipo}"]`);
        if (tipoAumentoRadio) {
            tipoAumentoRadio.checked = true;
        }

        // Alterar o comportamento do botão salvar para edição
        const salvarBtn = document.querySelector('#aumentoSalarioModal .btn-primary');
        salvarBtn.textContent = 'Atualizar Aumento';
        salvarBtn.onclick = function() { atualizarAumentoExistente(funcionarioId, historicoIndex); };

        // Mostrar o modal
        const modalAumento = new bootstrap.Modal(document.getElementById('aumentoSalarioModal'));
        modalAumento.show();

    } catch (error) {
        console.error("Erro ao editar aumento salarial:", error);
        mostrarMensagem("Falha ao carregar dados do aumento.", "error");
    }
}

async function atualizarAumentoExistente(funcionarioId, historicoIndex) {
    try {
        const valorAumento = parseFloat(document.getElementById('aumento-valor').value);
        const dataAumento = document.getElementById('aumento-data').value;
        const motivoAumento = document.getElementById('aumento-motivo').value;
        const assinatura = document.getElementById('aumento-assinatura').value;
        const tipoAumento = document.querySelector('input[name="tipo-aumento"]:checked').value;

        if (!valorAumento || !dataAumento || !motivoAumento || !assinatura) {
            mostrarMensagem("Preencha todos os campos para atualizar o aumento.", "warning");
            return;
        }

        const funcRef = db.collection('funcionarios').doc(funcionarioId);
        const funcDoc = await funcRef.get();
        
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }

        const funcionario = funcDoc.data();
        const aumentoAtual = funcionario.historicoAumentos[historicoIndex];

        if (!aumentoAtual) {
            mostrarMensagem("Registro de aumento não encontrado.", "error");
            return;
        }

        // Criar novo registro de aumento
        const novoRegistroAumento = {
            data: new Date(dataAumento.replace(/-/g, '\/')),
            valor: valorAumento,
            motivo: motivoAumento,
            assinatura: assinatura,
            tipo: tipoAumento,
            salarioAnterior: aumentoAtual.salarioAnterior,
            salarioPorForaAnterior: aumentoAtual.salarioPorForaAnterior,
            novoSalario: aumentoAtual.novoSalario // Mantém o mesmo para não afetar cálculos existentes
        };

        // Atualizar o array de histórico
        const historicoAtualizado = [...funcionario.historicoAumentos];
        historicoAtualizado[historicoIndex] = novoRegistroAumento;

        await funcRef.update({
            historicoAumentos: historicoAtualizado
        });

        bootstrap.Modal.getInstance(document.getElementById('aumentoSalarioModal')).hide();
        mostrarMensagem("Aumento salarial atualizado com sucesso!", "success");
        
        // Recarregar os detalhes do funcionário se estiverem abertos
        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao atualizar aumento salarial:", error);
        mostrarMensagem("Falha ao atualizar o aumento.", "error");
    }
}

async function excluirAumentoSalario(funcionarioId, historicoIndex) {
    if (!confirm("Tem certeza que deseja excluir este registro de aumento salarial?")) {
        return;
    }

    try {
        const funcRef = db.collection('funcionarios').doc(funcionarioId);
        const funcDoc = await funcRef.get();
        
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }

        const funcionario = funcDoc.data();
        
        if (!funcionario.historicoAumentos || historicoIndex >= funcionario.historicoAumentos.length) {
            mostrarMensagem("Registro de aumento não encontrado.", "error");
            return;
        }

        // Remover o item do array
        const historicoAtualizado = [...funcionario.historicoAumentos];
        historicoAtualizado.splice(historicoIndex, 1);

        await funcRef.update({
            historicoAumentos: historicoAtualizado
        });

        mostrarMensagem("Registro de aumento excluído com sucesso!", "success");
        
        // Recarregar os detalhes do funcionário se estiverem abertos
        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao excluir aumento salarial:", error);
        mostrarMensagem("Falha ao excluir o registro de aumento.", "error");
    }
}

// Função auxiliar para abrir janela de impressão
function openPrintWindow(content, options = {}) {
    const { autoPrint = false, name = '_blank', specs = 'width=800,height=600' } = options;
    
    const printWindow = window.open('', name, specs);
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();

    if (autoPrint) {
        printWindow.focus();
        printWindow.print();
        // printWindow.close(); // Descomente se quiser fechar automaticamente após imprimir
    }
}