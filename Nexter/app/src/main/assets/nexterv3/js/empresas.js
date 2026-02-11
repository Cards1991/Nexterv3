// Gerenciamento de empresas
let empresas = [];

document.addEventListener('DOMContentLoaded', () => {
    // Modal de empresa
    const empresaModal = document.getElementById('empresaModal');
    if (empresaModal) {
        empresaModal.addEventListener('show.bs.modal', function(event) {
            // Verifica se o modal foi acionado pelo botão "Nova Empresa"
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && relatedTarget.getAttribute('data-bs-target') === '#empresaModal') {
                document.getElementById('form-empresa').reset();
                document.querySelector('#empresaModal .modal-title').textContent = 'Nova Empresa';
                const salvarBtn = this.querySelector('.btn-primary');
                salvarBtn.textContent = 'Salvar Empresa';
                salvarBtn.onclick = salvarEmpresa;
            }
        });
    }
});


// Adiciona listener para o input de arquivo do logo
document.addEventListener('DOMContentLoaded', () => {
    const logoFileInput = document.getElementById('logo-file-empresa');
    const logoPreview = document.getElementById('logo-preview-empresa');
    const logoUrlInput = document.getElementById('logo-url-empresa');

    if (logoFileInput && logoPreview && logoUrlInput) {
        logoFileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    logoPreview.src = e.target.result;
                    logoPreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
                logoUrlInput.value = file.name; // Salva o nome do arquivo para a lógica existente
            }
        });
    }
});

// Carregar empresas
async function carregarEmpresas() {
    try {
        const tbody = document.getElementById('tabela-empresas');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

        const empresasSnapshot = await db.collection('empresas').get();
        const setoresSnapshot = await db.collection('setores').get();
        empresas = [];

        if (empresasSnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma empresa cadastrada</td></tr>';
            return;
        }

        // Contar funcionários por empresa
        const funcionariosSnapshot = await db.collection('funcionarios').get();
        const contagemFuncionarios = {};
        const contagemSetores = {};
        setoresSnapshot.forEach(doc => {
            const setor = doc.data();
            contagemSetores[setor.empresaId] = (contagemSetores[setor.empresaId] || 0) + 1;
        });
        funcionariosSnapshot.forEach(doc => {
            const func = doc.data();
            if (func.empresaId) {
                contagemFuncionarios[func.empresaId] = (contagemFuncionarios[func.empresaId] || 0) + 1;
            }
        });

        tbody.innerHTML = '';
        empresasSnapshot.forEach(doc => {
            const empresa = { id: doc.id, ...doc.data() };
            empresas.push(empresa);

            const numFuncionarios = contagemFuncionarios[doc.id] || 0;
            const numSetores = contagemSetores[doc.id] || 0;
            const numFuncoes = Array.isArray(empresa.funcoes) ? empresa.funcoes.length : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${empresa.nome}</td>
                <td>${empresa.cnpj || 'Não informado'}</td>
                <td><span class="badge bg-secondary">${numSetores}</span></td>
                <td><span class="badge bg-primary">${numFuncionarios}</span></td>
                <td><span class="badge bg-info">${numFuncoes}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editarEmpresa('${doc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirEmpresa('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
        mostrarMensagem('Erro ao carregar empresas', 'error');
    }
}

// Salvar empresa
async function salvarEmpresa() {
    try {
        const nome = document.getElementById('nome-empresa').value;
        const cnpj = document.getElementById('cnpj-empresa')?.value || ''; // Garante que seja uma string vazia se não encontrado
        const funcoesText = document.getElementById('funcoes-empresa').value;
        const rat = parseFloat(document.getElementById('rat-empresa').value) || 0;
        
        // Captura dos impostos configuráveis
        const temFgts = document.getElementById('empresa-check-fgts')?.checked || false;
        const percFgts = temFgts ? (parseFloat(document.getElementById('empresa-input-fgts').value) || 0) : 0;
        const temTerceiros = document.getElementById('empresa-check-terceiro')?.checked || false;
        const percTerceiros = temTerceiros ? (parseFloat(document.getElementById('empresa-input-terceiro').value) || 0) : 0;
        const temPatronal = document.getElementById('empresa-check-patronal')?.checked || false;
        const percPatronal = temPatronal ? (parseFloat(document.getElementById('empresa-input-patronal').value) || 0) : 0;
        const temSindicato = document.getElementById('empresa-check-sindicato')?.checked || false;
        const percSindicato = temSindicato ? (parseFloat(document.getElementById('empresa-input-sindicato').value) || 0) : 0;


        if (!nome) {
            mostrarMensagem('Preencha o nome da empresa', 'warning');
            return;
        }

        const funcoes = funcoesText.split(',').map(f => f.trim()).filter(f => f);
        const user = firebase.auth().currentUser;

        const empresaData = {
            nome: nome,
            cnpj: cnpj,
            rat: rat,
            impostos: {
                fgts: percFgts,
                terceiros: percTerceiros,
                patronal: percPatronal,
                sindicato: percSindicato
            },
            funcoes: funcoes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),            
            createdByUid: user ? user.uid : null
        };

        await db.collection('empresas').add(empresaData);

        // Fechar modal e limpar formulário
        const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
        modal.hide();
        document.getElementById('form-empresa').reset();

        // Recarregar lista
        carregarEmpresas();
        mostrarMensagem('Empresa cadastrada com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar empresa:', error);
        mostrarMensagem('Erro ao salvar empresa', 'error');
    }
}

// Editar empresa
async function editarEmpresa(empresaId) {
    const empresa = empresas.find(e => e.id === empresaId);
    if (empresa) {
        // Preencher modal com dados da empresa
        document.getElementById('nome-empresa').value = empresa.nome;
        document.getElementById('cnpj-empresa').value = empresa.cnpj || '';
        document.getElementById('funcoes-empresa').value = Array.isArray(empresa.funcoes) ? empresa.funcoes.join(', ') : '';
        document.getElementById('rat-empresa').value = empresa.rat || '';

        // Preencher impostos
        const impostos = empresa.impostos || {};
        
        // FGTS
        document.getElementById('empresa-check-fgts').checked = (impostos.fgts > 0);
        document.getElementById('empresa-input-fgts').value = impostos.fgts || '';
        document.getElementById('empresa-input-fgts').classList.toggle('d-none', !(impostos.fgts > 0));
        
        // Terceiros
        document.getElementById('empresa-check-terceiro').checked = (impostos.terceiros > 0);
        document.getElementById('empresa-input-terceiro').value = impostos.terceiros || '';
        document.getElementById('empresa-input-terceiro').classList.toggle('d-none', !(impostos.terceiros > 0));
        
        // Patronal
        // Compatibilidade com versão anterior (pagaContribuicaoPatronal booleano)
        const temPatronal = (impostos.patronal > 0) || (empresa.pagaContribuicaoPatronal === true);
        document.getElementById('empresa-check-patronal').checked = temPatronal;
        document.getElementById('empresa-input-patronal').value = impostos.patronal || (temPatronal ? 20 : '');
        document.getElementById('empresa-input-patronal').classList.toggle('d-none', !temPatronal);
        
        // Sindicato
        document.getElementById('empresa-check-sindicato').checked = (impostos.sindicato > 0);
        document.getElementById('empresa-input-sindicato').value = impostos.sindicato || '';
        document.getElementById('empresa-input-sindicato').classList.toggle('d-none', !(impostos.sindicato > 0));
        
        // Garante que o título do modal esteja correto para edição
        const modalTitle = document.querySelector('#empresaModal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Editar Empresa';

        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('empresaModal'));
        modal.show();

        // Alterar comportamento do botão salvar
        const salvarBtn = document.querySelector('#empresaModal .btn-primary');
        salvarBtn.textContent = 'Atualizar Empresa';
        salvarBtn.onclick = function() { atualizarEmpresa(empresaId); };
    }
}

// Atualizar empresa
async function atualizarEmpresa(empresaId) {
    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        const nome = document.getElementById('nome-empresa').value;
        const cnpj = document.getElementById('cnpj-empresa').value;
        const funcoesText = document.getElementById('funcoes-empresa').value;
        const rat = parseFloat(document.getElementById('rat-empresa').value) || 0;
        
        // Captura dos impostos configuráveis
        const temFgts = document.getElementById('empresa-check-fgts')?.checked || false;
        const percFgts = temFgts ? (parseFloat(document.getElementById('empresa-input-fgts').value) || 0) : 0;
        const temTerceiros = document.getElementById('empresa-check-terceiro')?.checked || false;
        const percTerceiros = temTerceiros ? (parseFloat(document.getElementById('empresa-input-terceiro').value) || 0) : 0;
        const temPatronal = document.getElementById('empresa-check-patronal')?.checked || false;
        const percPatronal = temPatronal ? (parseFloat(document.getElementById('empresa-input-patronal').value) || 0) : 0;
        const temSindicato = document.getElementById('empresa-check-sindicato')?.checked || false;
        const percSindicato = temSindicato ? (parseFloat(document.getElementById('empresa-input-sindicato').value) || 0) : 0;

        const funcoes = funcoesText.split(',').map(f => f.trim()).filter(f => f);
        const user = firebase.auth().currentUser;

        const updateData = {
            nome: nome,
            cnpj: cnpj,
            funcoes: funcoes,            
            rat: rat,
            impostos: {
                fgts: percFgts,
                terceiros: percTerceiros,
                patronal: percPatronal,
                sindicato: percSindicato
            },
            updatedAt: timestamp(),
            updatedByUid: user ? user.uid : null
        };

        await db.collection('empresas').doc(empresaId).update(updateData);

        // Fechar modal e resetar
        const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
        modal.hide();
        document.getElementById('form-empresa').reset();

        // Restaurar comportamento do botão
        const salvarBtn = document.querySelector('#empresaModal .btn-primary');
        salvarBtn.textContent = 'Salvar Empresa';
        salvarBtn.onclick = salvarEmpresa;

        // Recarregar lista
        carregarEmpresas();
        mostrarMensagem('Empresa atualizada com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        mostrarMensagem('Erro ao atualizar empresa', 'error');
    }
}

// Excluir empresa
async function excluirEmpresa(empresaId) {
    if (!confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        // Verificar se existem funcionários vinculados
        const funcionariosSnapshot = await db.collection('funcionarios')
            .where('empresaId', '==', empresaId)
            .get();

        if (!funcionariosSnapshot.empty) {
            mostrarMensagem('Não é possível excluir empresa com funcionários vinculados', 'warning');
            return;
        }

        await db.collection('empresas').doc(empresaId).delete();
        carregarEmpresas();
        mostrarMensagem('Empresa excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir empresa:', error);
        mostrarMensagem('Erro ao excluir empresa', 'error');
    }
}

// Carregar empresas para selects
async function carregarSelectEmpresas(selectId) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione uma empresa</option>';
        const empresasSnapshot = await db.collection('empresas').orderBy('nome').get();
        
        empresasSnapshot.forEach(doc => {
            const empresa = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar empresas no select:', error);
    }
}

/**
 * Exporta um arquivo CSV com os cabeçalhos para servir de modelo para empresas.
 */
function exportarModeloEmpresasCSV() {
    const headers = [
        "nome", "cnpj", "setores (separados por vírgula)", "funcoes (separados por vírgula)"
    ];
    const exemplo = [
        '"Empresa Exemplo SA"', '"00.111.222/0001-33"', '"RH,TI,Financeiro,Produção"', '"Analista,Gerente,Operador"'
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + 
        headers.join(",") + "\n" + 
        exemplo.join(",");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_empresas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarMensagem("Modelo CSV para empresas exportado com sucesso!", "success");
}

/**
 * Analisa uma única linha de um arquivo CSV, tratando campos entre aspas que podem conter vírgulas.
 * @param {string} line A linha do CSV a ser analisada.
 * @returns {string[]} Um array de strings com os valores das colunas.
 */
function parseCSVLine(line) {
    const values = [];
    let current_value = '';
    let in_quotes = false;

    // Adiciona uma vírgula no final para garantir que o último valor seja processado.
    line += ',';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            // Lida com aspas duplas ("") para escapar uma aspa dentro de um campo.
            if (in_quotes && line[i+1] === '"') {
                current_value += '"';
                i++; // Pula a próxima aspa
            } else {
                in_quotes = !in_quotes;
            }
        } else if (char === ',' && !in_quotes) {
            values.push(current_value.trim());
            current_value = '';
        } else {
            current_value += char;
        }
    }
    return values;
}

/**
 * Processa o arquivo CSV selecionado pelo usuário para importar empresas.
 */
async function processarArquivoEmpresasCSV() {
    const fileInput = document.getElementById('csv-empresas-file-input');
    const btnImportar = document.getElementById('btn-iniciar-importacao-empresas');
    const resultadoDiv = document.getElementById('importacao-empresas-resultado');
    const resumoDiv = document.getElementById('importacao-empresas-resumo');
    const errosLista = document.getElementById('importacao-empresas-erros-lista');

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
        let sucessoCount = 0;
        let erroCount = 0;

        // Cache de empresas existentes para evitar duplicatas
        const empresasSnap = await db.collection('empresas').get();
        const nomesExistentes = new Set(empresasSnap.docs.map(doc => doc.data().nome.toLowerCase()));

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const values = parseCSVLine(line);
            const empresa = {
                nome: values[0]?.trim(),
                cnpj: values[1]?.trim(),
                setores: values[2]?.split(',').map(s => s.trim()).filter(Boolean),
                funcoes: values[3]?.split(',').map(f => f.trim()).filter(Boolean)
            };

            let erroMsg = '';
            if (!empresa.nome) {
                erroMsg = 'O campo "nome" da empresa é obrigatório.';
            } else if (nomesExistentes.has(empresa.nome.toLowerCase())) {
                erroMsg = `A empresa "${empresa.nome}" já existe e será ignorada.`;
            }

            if (erroMsg) {
                erroCount++;
                errosLista.innerHTML += `<li class="list-group-item list-group-item-warning">Linha ${i + 1}: ${erroMsg}</li>`;
            } else {
                try {
                    const empresaData = {
                        nome: empresa.nome,
                        cnpj: empresa.cnpj || '',
                        setores: empresa.setores || [],
                        funcoes: empresa.funcoes || [],
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdByUid: firebase.auth().currentUser?.uid
                    };
                    
                    await db.collection('empresas').add(empresaData);
                    nomesExistentes.add(empresaData.nome.toLowerCase()); // Adiciona ao cache para a mesma importação
                    sucessoCount++;
                } catch (dbError) {
                    erroCount++;
                    errosLista.innerHTML += `<li class="list-group-item list-group-item-danger">Linha ${i + 1} (${empresa.nome}): Erro ao salvar no banco de dados: ${dbError.message}</li>`;
                }
            }
        }

        resumoDiv.innerHTML = `<div class="alert alert-info">Importação concluída! Sucesso: ${sucessoCount}, Falhas/Ignorados: ${erroCount}.</div>`;
        btnImportar.disabled = false;
        btnImportar.innerHTML = 'Iniciar Importação';
        carregarEmpresas(); // Atualiza a tabela de empresas na tela
    };

    reader.readAsText(file);
}