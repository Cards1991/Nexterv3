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
    const filtroSemSetor = document.getElementById('filtro-sem-setor-funcionarios');
    if (filtroSemSetor) {
        filtroSemSetor.addEventListener('change', carregarFuncionarios);
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
        const filtroSemSetor = document.getElementById('filtro-sem-setor-funcionarios')?.checked;

        let funcionariosFiltrados = funcionarios;

        if (filtroEmpresaId) {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.empresaId === filtroEmpresaId);
        }
        if (filtroNome) {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => f.nome.toLowerCase().includes(filtroNome));
        }
        if (filtroSemSetor) {
            funcionariosFiltrados = funcionariosFiltrados.filter(f => !f.setor || (typeof f.setor === 'string' && f.setor.trim() === ''));
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

        // Dados de Endereço
        const endereco = {
            cep: document.getElementById('endereco-cep').value,
            logradouro: document.getElementById('endereco-logradouro').value,
            numero: document.getElementById('endereco-numero').value,
            bairro: document.getElementById('endereco-bairro').value,
            cidade: document.getElementById('endereco-cidade').value,
            estado: document.getElementById('endereco-estado').value,
            latitude: document.getElementById('endereco-latitude').value,
            longitude: document.getElementById('endereco-longitude').value
        };

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

        // Geocodificação (se tiver endereço e não tiver coordenadas ou se for um novo cadastro)
        // Nota: geocodificarEndereco é global, vinda de mapaColaboradores.js
        if (endereco.logradouro && endereco.cidade && typeof geocodificarEndereco === 'function') {
            const coords = await geocodificarEndereco(endereco);
            if (coords) {
                endereco.latitude = coords.lat;
                endereco.longitude = coords.lng;
            }
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

            endereco: endereco,

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
        const funcionarioModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('funcionarioModal'));
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

        // Preencher Endereço
        document.getElementById('endereco-cep').value = funcionario.endereco?.cep || '';
        document.getElementById('endereco-logradouro').value = funcionario.endereco?.logradouro || '';
        document.getElementById('endereco-numero').value = funcionario.endereco?.numero || '';
        document.getElementById('endereco-bairro').value = funcionario.endereco?.bairro || '';
        document.getElementById('endereco-cidade').value = funcionario.endereco?.cidade || '';
        document.getElementById('endereco-estado').value = funcionario.endereco?.estado || '';
        document.getElementById('endereco-latitude').value = funcionario.endereco?.latitude || '';
        document.getElementById('endereco-longitude').value = funcionario.endereco?.longitude || '';

        // Status Biometria
        const statusBio = document.getElementById('status-biometria');
        if (statusBio) {
            statusBio.className = funcionario.biometriaAtiva ? 'ms-2 badge bg-success' : 'ms-2 badge bg-secondary';
            statusBio.textContent = funcionario.biometriaAtiva ? 'Biometria Cadastrada' : 'Não cadastrada';
        }

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
        
        // Define Setor (com fallback se não existir na lista)
        const setorSelect = document.getElementById('setor-funcionario');
        if (setorSelect) {
            setorSelect.value = funcionario.setor;
            // Se o valor não foi selecionado (não existe na lista), adiciona manualmente
            if (funcionario.setor && setorSelect.value !== funcionario.setor) {
                const option = document.createElement('option');
                option.value = funcionario.setor;
                option.textContent = funcionario.setor;
                option.selected = true;
                setorSelect.appendChild(option);
            }
        }

        // Define Cargo (com fallback se não existir na lista)
        const cargoSelect = document.getElementById('cargo-funcionario');
        if (cargoSelect) {
            cargoSelect.value = funcionario.cargo;
            if (funcionario.cargo && cargoSelect.value !== funcionario.cargo) {
                const option = document.createElement('option');
                option.value = funcionario.cargo;
                option.textContent = funcionario.cargo;
                option.selected = true;
                cargoSelect.appendChild(option);
            }
        }

        funcionarioModal.show();
        
        // Armazena o ID no formulário para uso na biometria
        const form = document.getElementById('form-funcionario');
        if (form) form.dataset.funcionarioId = funcionarioId;

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

        // Dados de Endereço
        const endereco = {
            cep: document.getElementById('endereco-cep').value,
            logradouro: document.getElementById('endereco-logradouro').value,
            numero: document.getElementById('endereco-numero').value,
            bairro: document.getElementById('endereco-bairro').value,
            cidade: document.getElementById('endereco-cidade').value,
            estado: document.getElementById('endereco-estado').value,
            latitude: document.getElementById('endereco-latitude').value,
            longitude: document.getElementById('endereco-longitude').value
        };

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

        // Geocodificação na edição
        if (endereco.logradouro && endereco.cidade && typeof geocodificarEndereco === 'function') {
            const coords = await geocodificarEndereco(endereco);
            if (coords) {
                endereco.latitude = coords.lat;
                endereco.longitude = coords.lng;
            }
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

            endereco: endereco,

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
        let custoValeRefeicao = 0;

        // Busca dados do funcionário para verificar benefícios
        const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();

        if (funcionarioDoc.exists && funcionarioDoc.data().beneficios?.valeAlimentacao === true) {
            custoValeRefeicao = 260.00;
        }

        // Busca dados da empresa para verificar se tem patronal e cont terceiros
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        let hasPatronal = false; // padrão: não tem
        let hasContTerceiros = false; // padrão: não tem

        if (empresaDoc.exists) {
            const empresa = empresaDoc.data();
            hasPatronal = empresa.hasPatronal === true; // só se explicitamente true
            hasContTerceiros = empresa.hasContTerceiros === true; // só se explicitamente true
        }

        // Cálculo dos custos padrão para todas as empresas
        const fgts = salario * 0.08; // FGTS: 8%
        const sindicato = salario * 0.008; // Sindicato: 0,8%

        // Provisão de Férias
        const provisaoFerias = salario / 12;
        const tercoFerias = provisaoFerias / 3; // Terço de Férias
        const fgtsFerias = provisaoFerias * 0.08; // FGTS s/ Prov. Férias

        // Provisão 13º
        const provisao13 = salario / 12;
        const fgts13 = provisao13 * 0.08; // Provisão de FGTS s/ 13º

        // Novos custos: Patronal e Contribuições Terceiros (condicionais por empresa)
        let patronalSalario = 0;
        let patronalFerias = 0;
        let patronal13 = 0;
        let contTerceirosSalario = 0;
        let contTerceirosFerias = 0;
        let contTerceiros13 = 0;

        if (hasPatronal) {
            patronalSalario = salario * 0.20; // Patronal s/ salario: 20%
            patronalFerias = provisaoFerias * 0.20; // Patronal s/ férias: 20%
            patronal13 = provisao13 * 0.20; // Patronal s/13º: 20%
        }

        if (hasContTerceiros) {
            contTerceirosSalario = salario * 0.0764; // Cont Terceiros s/ salario: 7,64%
            contTerceirosFerias = provisaoFerias * 0.0764; // Cont Terceiros s/ férias: 7,64%
            contTerceiros13 = provisao13 * 0.0764; // Cont Terceiros s/13º: 7,64%
        }

        // Soma de todos os custos adicionais
        const totalAdicionais = fgts + sindicato + provisaoFerias + tercoFerias + fgtsFerias + provisao13 + fgts13 + patronalSalario + patronalFerias + patronal13 + contTerceirosSalario + contTerceirosFerias + contTerceiros13;

        // Custo Total = Salário + Custos Adicionais + Benefícios + Salário Por Fora
        const custoTotal = salario + totalAdicionais + custoValeRefeicao + salarioPorFora;

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

        // Histórico de Alterações de Função (registrado no próprio documento do funcionário)
        if (Array.isArray(funcionario.historicoMovimentacoes) && funcionario.historicoMovimentacoes.length > 0) {
            historicoHTML += '<h6 class="mt-4">Histórico de Alterações de Função:</h6>';
            historicoHTML += '<ul class="list-group list-group-flush">';
            // Ordena descendente por data quando possível
            const movsOrdenadas = funcionario.historicoMovimentacoes.slice().sort((a, b) => {
                const ad = a.data && a.data.toDate ? a.data.toDate().getTime() : new Date(a.data).getTime();
                const bd = b.data && b.data.toDate ? b.data.toDate().getTime() : new Date(b.data).getTime();
                return bd - ad;
            });
            movsOrdenadas.forEach((mov) => {
                historicoHTML += `
                    <li class="list-group-item">
                        <strong>${formatarData(mov.data)}:</strong>
                        <div><small>De: ${mov.de.empresaNome || 'N/A'} — ${mov.de.setor || 'N/A'} / ${mov.de.cargo || 'N/A'}</small></div>
                        <div><small>Para: ${mov.para.empresaNome || 'N/A'} — ${mov.para.setor || 'N/A'} / ${mov.para.cargo || 'N/A'}</small></div>
                        <div><small class="text-muted">Motivo: ${mov.motivo || 'Não informado'}</small></div>
                    </li>`;
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
                        <button type="button" class="btn btn-info" onclick="atualizarCustoTotal('${funcionarioId}', ${funcionario.salario || 0}, '${funcionario.empresaId}', ${funcionario.salarioPorFora || 0})">
                            <i class="fas fa-calculator"></i> Reprocessar Custo
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

    select.disabled = true;
    select.innerHTML = '<option value="">Carregando...</option>';

    try {
        const setoresSnap = await db.collection('setores').orderBy('descricao').get();

        if (setoresSnap.empty) {
            select.innerHTML = '<option value="">Nenhum setor cadastrado</option>';
            return;
        }

        const setoresDocs = setoresSnap.docs.sort((a, b) => (a.data().descricao || '').localeCompare(b.data().descricao || ''));

        select.innerHTML = '<option value="">Selecione um setor</option>';
        setoresDocs.forEach(doc => {
            const setor = doc.data();
            const option = document.createElement('option');
            option.value = setor.descricao;
            option.textContent = setor.descricao;
            select.appendChild(option);
        });
        select.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar setores:', error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
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
                    const option = document.createElement('option');
                    option.value = funcao;
                    option.textContent = funcao;
                    select.appendChild(option);
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

    if (setorSelect) {
        setorSelect.addEventListener('change', async function() {
            const setorDesc = this.value;
            const empresaId = document.getElementById('empresa-funcionario').value;
            const liderSelect = document.getElementById('lider-funcionario');

            if (!setorDesc || !empresaId || !liderSelect) return;

            try {
                const setorSnap = await db.collection('setores')
                    .where('empresaId', '==', empresaId)
                    .where('descricao', '==', setorDesc)
                    .limit(1).get();

                if (!setorSnap.empty) {
                    const setorData = setorSnap.docs[0].data();
                    liderSelect.value = setorData.gerenteId || '';
                }
            } catch (error) {
                console.error("Erro ao buscar líder do setor:", error);
            }
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

// --- Integração Biometria Android ---

function cadastrarBiometriaFuncionario() {
    // Recupera o ID armazenado no dataset do formulário
    const form = document.getElementById('form-funcionario');
    const funcionarioId = form ? form.dataset.funcionarioId : null;

    if (!funcionarioId) {
        mostrarMensagem("Salve o funcionário antes de cadastrar a biometria.", "warning");
        return;
    }

    console.log("🔍 Debug Cadastro Biometria: Verificando interface...");
    console.log("window.AndroidBiometria:", window.AndroidBiometria);

    if (window.AndroidBiometria && typeof window.AndroidBiometria.cadastrarBiometria === 'function') {
        mostrarMensagem("Solicitando cadastro biométrico no dispositivo...", "info");
        try {
            window.AndroidBiometria.cadastrarBiometria(funcionarioId);
        } catch (e) {
            console.error("Erro ao chamar biometria nativa:", e);
            mostrarMensagem("Erro ao abrir sensor: " + e.message, "error");
        }
    } else {
        mostrarMensagem("Funcionalidade disponível apenas no App Android.", "warning");
    }
}

// Callback chamado pelo Android
window.onBiometriaCadastrada = async function(funcionarioId, sucesso) {
    if (sucesso || sucesso === 'true') {
        try {
            await db.collection('funcionarios').doc(funcionarioId).update({
                biometriaAtiva: true,
                biometriaData: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            const statusBio = document.getElementById('status-biometria');
            if (statusBio) {
                statusBio.className = 'ms-2 badge bg-success';
                statusBio.textContent = 'Biometria Cadastrada';
            }
            mostrarMensagem("Biometria vinculada com sucesso!", "success");
        } catch (e) {
            console.error(e);
            mostrarMensagem("Erro ao salvar status da biometria.", "error");
        }
    } else {
        mostrarMensagem("Falha no cadastro biométrico.", "error");
    }
};

async function exportarFuncionariosExcel() {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
        script.onload = () => exportarFuncionariosExcel();
        document.head.appendChild(script);
        return;
    }

    if (!funcionarios || funcionarios.length === 0) {
        mostrarMensagem("Nenhum funcionário carregado para exportar.", "warning");
        return;
    }

    try {
        const empresasSnap = await db.collection('empresas').get();
        const empresasMap = {};
        empresasSnap.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
        });

        const dadosExportacao = funcionarios.map(f => {
            const admissao = f.dataAdmissao ? (f.dataAdmissao.toDate ? f.dataAdmissao.toDate() : new Date(f.dataAdmissao)) : null;
            const nascimento = f.dataNascimento ? (f.dataNascimento.toDate ? f.dataNascimento.toDate() : new Date(f.dataNascimento)) : null;

            return {
                "Nome": f.nome,
                "CPF": f.cpf,
                "Matrícula": f.matricula || '',
                "Empresa": empresasMap[f.empresaId] || 'N/A',
                "Setor": f.setor || '',
                "Cargo": f.cargo || '',
                "Salário": f.salario || 0,
                "Admissão": admissao ? admissao.toLocaleDateString('pt-BR') : '',
                "Nascimento": nascimento ? nascimento.toLocaleDateString('pt-BR') : '',
                "Email": f.email || '',
                "Telefone": f.telefone || '',
                "Status": f.status || 'Ativo'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dadosExportacao);
        XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
        XLSX.writeFile(wb, "Cadastro_Funcionarios.xlsx");

    } catch (error) {
        console.error("Erro ao exportar excel:", error);
        mostrarMensagem("Erro ao exportar para Excel.", "error");
    }
}

// Função para reprocessar custos de todos os funcionários
async function reprocessarCustosFuncionarios() {
    if (!confirm("Deseja reprocessar os custos de TODOS os funcionários? Isso pode levar alguns segundos.")) {
        return;
    }

    try {
        mostrarMensagem("Reprocessando custos... aguarde.", "info");

        const funcionariosSnap = await db.collection('funcionarios').get();
        const totalFuncionarios = funcionariosSnap.docs.length;
        let processados = 0;
        let erros = 0;

        // Criar barra de progresso
        const progressContainer = document.createElement('div');
        progressContainer.id = 'progress-container';
        progressContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 9999;
            min-width: 300px;
        `;

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 20px;
            background-color: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 10px;
        `;

        const progressFill = document.createElement('div');
        progressFill.style.cssText = `
            height: 100%;
            background-color: #007bff;
            width: 0%;
            transition: width 0.3s ease;
        `;

        const progressText = document.createElement('div');
        progressText.style.cssText = `
            text-align: center;
            font-weight: bold;
            color: #333;
        `;

        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        document.body.appendChild(progressContainer);

        // Função para atualizar progresso
        const atualizarProgresso = (processado, total) => {
            const percentual = Math.round((processado / total) * 100);
            progressFill.style.width = `${percentual}%`;
            progressText.textContent = `Processando... ${processado}/${total} (${percentual}%)`;
        };

        for (const [index, doc] of funcionariosSnap.docs.entries()) {
            const funcionario = doc.data();
            const salario = parseFloat(funcionario.salario || 0);
            const salarioPorFora = parseFloat(funcionario.salarioPorFora || 0);
            const empresaId = funcionario.empresaId;

            if (salario > 0 || salarioPorFora > 0) {
                try {
                    await atualizarCustoTotal(doc.id, salario, empresaId, salarioPorFora);
                    processados++;
                } catch (error) {
                    console.error(`Erro ao reprocessar custo do funcionário ${funcionario.nome}:`, error);
                    erros++;
                }
            }

            // Atualizar progresso a cada funcionário processado
            atualizarProgresso(index + 1, totalFuncionarios);
        }

        // Remover barra de progresso
        document.body.removeChild(progressContainer);

        if (erros === 0) {
            mostrarMensagem(`Custos reprocessados com sucesso para ${processados} funcionários!`, "success");
        } else {
            mostrarMensagem(`Custos reprocessados para ${processados} funcionários, com ${erros} erros.`, "warning");
        }

        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao reprocessar custos:", error);
        mostrarMensagem("Erro ao reprocessar custos.", "error");

        // Remover barra de progresso em caso de erro
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            document.body.removeChild(progressContainer);
        }
    }
}

// Exportar funções globais
window.abrirModalAumentoColetivo = abrirModalAumentoColetivo;
window.aplicarAumentoColetivo = aplicarAumentoColetivo;
window.desfazerUltimoAumentoMassa = desfazerUltimoAumentoMassa;
window.exportarFuncionariosExcel = exportarFuncionariosExcel;
window.reprocessarCustosFuncionarios = reprocessarCustosFuncionarios;
window.cadastrarBiometriaFuncionario = cadastrarBiometriaFuncionario;

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

// --- AUMENTO SALARIAL EM MASSA ---

function abrirModalAumentoColetivo() {
    const modalEl = document.getElementById('modalAumentoColetivo');
    if (modalEl) {
        // Resetar formulário
        const form = document.getElementById('form-aumento-coletivo');
        if (form) form.reset();
        
        // Definir data de corte como hoje por padrão
        const dataCorteInput = document.getElementById('aumento-coletivo-data-corte');
        if (dataCorteInput) dataCorteInput.valueAsDate = new Date();
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        mostrarMensagem("Modal de aumento coletivo não encontrado.", "error");
    }
}

async function aplicarAumentoColetivo() {
    const percentualInput = document.getElementById('aumento-coletivo-percentual');
    const dataCorteInput = document.getElementById('aumento-coletivo-data-corte');
    const motivoInput = document.getElementById('aumento-coletivo-motivo');

    const percentual = parseFloat(percentualInput.value);
    const dataCorte = new Date(dataCorteInput.value + 'T23:59:59');
    const motivo = motivoInput.value.trim();

    if (isNaN(percentual) || percentual === 0) {
        mostrarMensagem("Porcentagem inválida.", "warning");
        return;
    }
    if (!dataCorteInput.value) {
        mostrarMensagem("Data de corte é obrigatória.", "warning");
        return;
    }

    if (!confirm(`Confirma o aumento de ${percentual}% para funcionários admitidos até ${dataCorte.toLocaleDateString()}?`)) {
        return;
    }

    try {
        mostrarMensagem("Aplicando aumentos... aguarde.", "info");
        
        const funcionariosSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        const batch = db.batch();
        let count = 0;
        const dataAumento = new Date();

        funcionariosSnap.forEach(doc => {
            const func = doc.data();
            const dataAdmissao = func.dataAdmissao?.toDate ? func.dataAdmissao.toDate() : new Date(func.dataAdmissao);
            
            if (dataAdmissao <= dataCorte) {
                const salarioAtual = parseFloat(func.salario || 0);
                if (salarioAtual > 0) {
                    const novoSalario = salarioAtual * (1 + (percentual / 100));
                    
                    const funcRef = db.collection('funcionarios').doc(doc.id);
                    batch.update(funcRef, { 
                        salario: parseFloat(novoSalario.toFixed(2)),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    const registroAumento = {
                        data: dataAumento,
                        valor: parseFloat((novoSalario - salarioAtual).toFixed(2)),
                        motivo: `${motivo} (${percentual}%)`,
                        assinatura: 'Sistema (Coletivo)',
                        tipo: 'folha',
                        salarioAnterior: salarioAtual,
                        novoSalario: parseFloat(novoSalario.toFixed(2))
                    };
                    batch.update(funcRef, {
                        historicoAumentos: firebase.firestore.FieldValue.arrayUnion(registroAumento)
                    });
                    count++;
                }
            }
        });

        if (count > 0) {
            await batch.commit();
            mostrarMensagem(`Aumento aplicado com sucesso para ${count} funcionários!`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modalAumentoColetivo')).hide();
            carregarFuncionarios();
        } else {
            mostrarMensagem("Nenhum funcionário encontrado com os critérios selecionados.", "warning");
        }

    } catch (error) {
        console.error("Erro no aumento coletivo:", error);
        mostrarMensagem("Erro ao aplicar aumento coletivo.", "error");
    }
}

async function abrirModalAumentoMassa() {
    const percentual = prompt("Digite a porcentagem de aumento para TODOS os funcionários (apenas salário em folha):", "6.0");
    if (percentual === null) return;
    
    const pct = parseFloat(percentual.replace(',', '.'));
    if (isNaN(pct) || pct <= 0) {
        mostrarMensagem("Porcentagem inválida.", "warning");
        return;
    }

    if (confirm(`ATENÇÃO: Isso aplicará um aumento de ${pct}% no salário em folha de TODOS os funcionários ativos.\n\nConfirma esta operação?`)) {
        aplicarAumentoMassa(pct);
    }
}

async function aplicarAumentoMassa(percentual) {
    try {
        mostrarMensagem("Aplicando aumentos... aguarde.", "info");
        
        const funcionariosSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        const batch = db.batch();
        const historicoBackup = [];
        const dataAumento = new Date();

        funcionariosSnap.forEach(doc => {
            const func = doc.data();
            const salarioAtual = parseFloat(func.salario || 0);
            
            if (salarioAtual > 0) {
                const novoSalario = salarioAtual * (1 + (percentual / 100));
                
                // Salva dados para backup/undo
                historicoBackup.push({
                    id: doc.id,
                    salarioAnterior: salarioAtual
                });

                // Atualiza funcionário
                const funcRef = db.collection('funcionarios').doc(doc.id);
                batch.update(funcRef, { 
                    salario: parseFloat(novoSalario.toFixed(2)),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Adiciona ao histórico individual (opcional, mas recomendado)
                const registroAumento = {
                    data: dataAumento,
                    valor: parseFloat((novoSalario - salarioAtual).toFixed(2)),
                    motivo: `Dissídio/Aumento em Massa (${percentual}%)`,
                    assinatura: 'Sistema',
                    tipo: 'folha',
                    salarioAnterior: salarioAtual,
                    novoSalario: parseFloat(novoSalario.toFixed(2))
                };
                batch.update(funcRef, {
                    historicoAumentos: firebase.firestore.FieldValue.arrayUnion(registroAumento)
                });
            }
        });

        // Salva o log do lote para permitir desfazer
        const logRef = db.collection('historico_aumentos_massa').doc();
        batch.set(logRef, {
            data: firebase.firestore.FieldValue.serverTimestamp(),
            percentual: percentual,
            funcionariosAfetados: historicoBackup,
            criadoPor: firebase.auth().currentUser?.uid
        });

        await batch.commit();
        mostrarMensagem(`Aumento de ${percentual}% aplicado com sucesso para ${historicoBackup.length} funcionários!`, "success");
        carregarFuncionarios();

    } catch (error) {
        console.error("Erro no aumento em massa:", error);
        mostrarMensagem("Erro ao aplicar aumento em massa.", "error");
    }
}

async function desfazerUltimoAumentoMassa() {
    if (!confirm("Deseja desfazer o ÚLTIMO aumento em massa aplicado? Isso reverterá os salários para o valor anterior.")) return;

    try {
        let logDoc = null;
        
        // Tenta buscar ordenado
        try {
            const logsSnap = await db.collection('historico_aumentos_massa').orderBy('data', 'desc').limit(1).get();
            if (!logsSnap.empty) {
                logDoc = logsSnap.docs[0];
            }
        } catch (queryError) {
            console.warn("Erro na query ordenada, tentando busca simples...", queryError);
            // Fallback: busca tudo e ordena em memória
            const allLogsSnap = await db.collection('historico_aumentos_massa').get();
            if (!allLogsSnap.empty) {
                const docs = allLogsSnap.docs.sort((a, b) => {
                    const aDate = a.data().data?.toDate?.() || new Date(a.data().data);
                    const bDate = b.data().data?.toDate?.() || new Date(b.data().data);
                    return bDate.getTime() - aDate.getTime();
                });
                logDoc = docs[0];
            }
        }

        if (!logDoc) {
            mostrarMensagem("Nenhum histórico de aumento em massa encontrado.", "warning");
            return;
        }

        const logData = logDoc.data();
        if (!logData.funcionariosAfetados || logData.funcionariosAfetados.length === 0) {
            mostrarMensagem("Histórico de aumento em massa vazio ou inválido.", "warning");
            return;
        }

        const batch = db.batch();
        const dataAtualizacao = firebase.firestore.FieldValue.serverTimestamp();

        logData.funcionariosAfetados.forEach(item => {
            const funcRef = db.collection('funcionarios').doc(item.id);
            batch.update(funcRef, { 
                salario: parseFloat(item.salarioAnterior || 0),
                updatedAt: dataAtualizacao 
            });
        });

        // Deleta o log após reverter
        batch.delete(logDoc.ref);

        await batch.commit();
        mostrarMensagem(`Aumento em massa revertido para ${logData.funcionariosAfetados.length} funcionários.`, "success");
        await carregarFuncionarios();

    } catch (error) {
        console.error("Erro ao desfazer aumento em massa:", error);
        mostrarMensagem("Erro ao desfazer aumento em massa: " + error.message, "error");
    }
}

/**
 * Processa um arquivo Excel (.xlsx) para atualizar dados de funcionários existentes.
 * A função lê a primeira planilha do arquivo, converte para JSON e atualiza
 * os registros no Firestore com base na correspondência de CPF.
 */
async function processarArquivoAtualizacaoXLSX() {
    const fileInput = document.getElementById('csv-atualizacao-file-input');
    const file = fileInput.files[0];
    const btn = document.getElementById('btn-iniciar-atualizacao');
    const resultadoDiv = document.getElementById('atualizacao-resultado');
    const resumoDiv = document.getElementById('atualizacao-resumo');
    const errosLista = document.getElementById('atualizacao-erros-lista');

    if (!file) {
        mostrarMensagem("Por favor, selecione um arquivo Excel (.xlsx).", "warning");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    resultadoDiv.style.display = 'block';
    resumoDiv.innerHTML = 'Analisando arquivo...';
    errosLista.innerHTML = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            // Usar {cellDates: true} para que o XLSX tente converter datas automaticamente
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Usar {raw: false} para obter valores formatados (bom para CPF como texto)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

            if (jsonData.length === 0) {
                resumoDiv.innerHTML = '<span class="text-danger">O arquivo está vazio ou a primeira planilha não contém dados.</span>';
                btn.disabled = false;
                btn.innerHTML = 'Iniciar Atualização';
                return;
            }

            if (!jsonData[0].hasOwnProperty('cpf')) {
                resumoDiv.innerHTML = '<span class="text-danger">Arquivo inválido! A coluna "cpf" é obrigatória para a atualização.</span>';
                btn.disabled = false;
                btn.innerHTML = 'Iniciar Atualização';
                return;
            }

            // Cache de empresas para evitar múltiplas buscas no banco
            const empresasSnap = await db.collection('empresas').get();
            const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.data().nome.toLowerCase(), doc.id]));

            let updatedCount = 0;
            let createdCount = 0;
            let notFoundCount = 0;
            let errorCount = 0;
            const notFoundCpfs = [];
            let batch = db.batch();
            let batchSize = 0;

            for (const [i, row] of jsonData.entries()) {
                // Busca CPF de forma case-insensitive
                let cpfRaw = null;
                for (const key in row) {
                    if (key.toLowerCase().includes('cpf')) {
                        cpfRaw = row[key]?.toString().trim();
                        break;
                    }
                }
                const cpf = cpfRaw ? cpfRaw.replace(/\D/g, '') : '';

                if (!cpf) {
                    errorCount++;
                    const li = document.createElement('li');
                    li.className = 'list-group-item list-group-item-danger';
                    li.textContent = `Linha ${i + 2}: CPF não encontrado ou inválido.`;
                    errosLista.appendChild(li);
                    continue;
                }

                try {
                    const querySnapshot = await db.collection('funcionarios').where('cpf', '==', cpf).limit(1).get();

                    if (!querySnapshot.empty) {
                        const doc = querySnapshot.docs[0];
                        const updateData = {};

                        // Mapeia colunas do Excel para campos do Firestore de forma flexível
                        for (const key in row) {
                            if (!row.hasOwnProperty(key) || row[key] === null || row[key] === undefined) {
                                continue;
                            }

                            const lowerKey = key.toLowerCase();
                            let field = null;

                            // Mapeamento flexível baseado em palavras-chave
                            if (lowerKey.includes('nome') && !lowerKey.includes('empresa')) {
                                field = 'nome';
                            } else if (lowerKey.includes('cpf')) {
                                continue; // CPF já usado para identificação
                            } else if (lowerKey.includes('matr')) {
                                field = 'matricula';
                            } else if (lowerKey.includes('empresa')) {
                                field = 'empresaNome';
                            } else if (lowerKey.includes('setor')) {
                                field = 'setor';
                            } else if (lowerKey.includes('cargo') || lowerKey.includes('função') || lowerKey.includes('funcao')) {
                                field = 'cargo';
                            } else if (lowerKey.includes('sal')) {
                                field = 'salario';
                            } else if (lowerKey.includes('admiss')) {
                                field = 'dataAdmissao';
                            } else if (lowerKey.includes('nasc')) {
                                field = 'dataNascimento';
                            } else if (lowerKey.includes('email')) {
                                field = 'email';
                            } else if (lowerKey.includes('telefone') || lowerKey.includes('fone') || lowerKey.includes('celular')) {
                                field = 'telefone';
                            } else if (lowerKey === 'sexo' || lowerKey.includes('gênero') || lowerKey.includes('genero')) {
                                field = 'sexo';
                            } else if (lowerKey.includes('status')) {
                                field = 'status';
                            }

                            if (!field) continue; // Ignora colunas não mapeadas

                            const value = row[key];

                            // Permite atualizar para string vazia apenas para campos de texto
                            if (value === '' && ['nome', 'matricula', 'setor', 'cargo', 'email', 'telefone', 'sexo', 'endereco.cep', 'endereco.logradouro', 'endereco.numero', 'endereco.bairro', 'endereco.cidade', 'endereco.estado'].includes(field)) {
                                updateData[field] = '';
                            } else if (value !== '') {
                                if (field === 'empresaNome') {
                                    const empresaId = empresasMap.get(value.toString().toLowerCase());
                                    if (empresaId) updateData['empresaId'] = empresaId;
                                } else if (field === 'dataNascimento' || field === 'dataAdmissao') {
                                    // Tenta parsear data do formato brasileiro dd/mm/yyyy
                                    let parsedDate = null;
                                    if (value instanceof Date && !isNaN(value)) {
                                        parsedDate = value;
                                    } else if (typeof value === 'string') {
                                        const dateStr = value.trim();
                                        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
                                        const match = dateStr.match(dateRegex);
                                        if (match) {
                                            const [, day, month, year] = match;
                                            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                            if (isNaN(parsedDate.getTime())) parsedDate = null;
                                        }
                                    }
                                    if (parsedDate) {
                                        updateData[field] = firebase.firestore.Timestamp.fromDate(parsedDate);
                                    }
                                } else if (field === 'salario') {
                                    const salario = parseFloat(value.toString().replace(',', '.'));
                                    if (!isNaN(salario)) updateData[field] = salario;
                                } else if (field === 'status') {
                                    updateData[field] = value;
                                } else {
                                    updateData[field] = value;
                                }
                            }
                        }

                        if (Object.keys(updateData).length > 0) {
                            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                            batch.update(doc.ref, updateData);
                            updatedCount++;
                            batchSize++;
                        }

                        if (batchSize >= 400) {
                            await batch.commit();
                            batch = db.batch();
                            batchSize = 0;
                        }

                    } else {
                        // Lógica de Criação (Novo Funcionário)
                        const newData = {
                            cpf: cpf,
                            status: 'Ativo',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdByUid: firebase.auth().currentUser?.uid,
                            endereco: {}
                        };
                        
                        let hasData = false;

                        for (const key in row) {
                            if (!row.hasOwnProperty(key) || row[key] === null || row[key] === undefined) {
                                continue;
                            }

                            const lowerKey = key.toLowerCase();
                            let field = null;

                            // Mapeamento flexível (mesma lógica da atualização)
                            if (lowerKey.includes('nome') && !lowerKey.includes('empresa')) {
                                field = 'nome';
                            } else if (lowerKey.includes('cpf')) {
                                continue; 
                            } else if (lowerKey.includes('matr')) {
                                field = 'matricula';
                            } else if (lowerKey.includes('empresa')) {
                                field = 'empresaNome';
                            } else if (lowerKey.includes('setor')) {
                                field = 'setor';
                            } else if (lowerKey.includes('cargo') || lowerKey.includes('função') || lowerKey.includes('funcao')) {
                                field = 'cargo';
                            } else if (lowerKey.includes('sal')) {
                                field = 'salario';
                            } else if (lowerKey.includes('admiss')) {
                                field = 'dataAdmissao';
                            } else if (lowerKey.includes('nasc')) {
                                field = 'dataNascimento';
                            } else if (lowerKey.includes('email')) {
                                field = 'email';
                            } else if (lowerKey.includes('telefone') || lowerKey.includes('fone') || lowerKey.includes('celular')) {
                                field = 'telefone';
                            } else if (lowerKey.includes('status')) {
                                field = 'status';
                            }

                            if (!field) continue;

                            const value = row[key];
                            let finalValue = value;

                            // Processamento de valores
                            if (field === 'empresaNome') {
                                const empresaId = empresasMap.get(value.toString().toLowerCase());
                                if (empresaId) {
                                    newData['empresaId'] = empresaId;
                                    continue; 
                                }
                            } else if (field === 'dataNascimento' || field === 'dataAdmissao') {
                                let parsedDate = null;
                                if (value instanceof Date && !isNaN(value)) {
                                    parsedDate = value;
                                } else if (typeof value === 'string') {
                                    const dateStr = value.trim();
                                    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
                                    const match = dateStr.match(dateRegex);
                                    if (match) {
                                        const [, day, month, year] = match;
                                        parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                        if (isNaN(parsedDate.getTime())) parsedDate = null;
                                    }
                                }
                                if (parsedDate) {
                                    finalValue = firebase.firestore.Timestamp.fromDate(parsedDate);
                                } else {
                                    continue;
                                }
                            } else if (field === 'salario') {
                                const salario = parseFloat(value.toString().replace(',', '.'));
                                if (!isNaN(salario)) finalValue = salario;
                                else continue;
                            } else {
                                finalValue = value;
                            }

                            // Atribuição
                            newData[field] = finalValue;
                            hasData = true;
                        }

                        if (hasData && newData.nome) {
                            const newDocRef = db.collection('funcionarios').doc();
                            batch.set(newDocRef, newData);
                            createdCount++;
                            batchSize++;
                            
                            if (batchSize >= 400) {
                                await batch.commit();
                                batch = db.batch();
                                batchSize = 0;
                            }
                        } else {
                            if (!newData.nome) {
                                errorCount++;
                                // Opcional: Logar erro de falta de nome
                            }
                        }
                    }
                } catch (err) {
                    errorCount++;
                    const li = document.createElement('li');
                    li.className = 'list-group-item list-group-item-danger';
                    li.textContent = `Linha ${i + 2} (CPF: ${cpf}): Erro - ${err.message}`;
                    errosLista.appendChild(li);
                }
            }

            if (batchSize > 0) await batch.commit();

            resumoDiv.innerHTML = `<p class="mb-1"><strong class="text-success">${updatedCount}</strong> atualizados. <strong class="text-primary">${createdCount}</strong> criados.</p><p class="mb-1"><strong class="text-danger">${errorCount}</strong> erros.</p>`;
            if (notFoundCpfs.length > 0) errosLista.innerHTML += `<li class="list-group-item list-group-item-warning">CPFs não encontrados: ${notFoundCpfs.join(', ')}</li>`;
            if (typeof carregarFuncionarios === 'function') carregarFuncionarios();

        } catch (readError) {
            resumoDiv.innerHTML = `<span class="text-danger">Erro ao ler o arquivo Excel: ${readError.message}</span>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Iniciar Atualização';
        }
    };
    reader.readAsArrayBuffer(file);
}