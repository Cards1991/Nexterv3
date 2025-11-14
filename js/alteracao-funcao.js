// Gerenciamento de Alteração de Função

let __alteracao_funcionarios_cache = [];
let __alteracao_empresas_cache = [];

async function inicializarAlteracaoFuncao() {
    try {
        await Promise.all([
            carregarDadosParaAlteracao(),
            carregarHistoricoAlteracoes()
        ]);
        configurarFormularioAlteracao();
    } catch (e) {
        console.error("Erro ao inicializar alteração de função:", e);
        mostrarMensagem("Erro ao carregar módulo de alteração de função", "error");
    }
}

async function carregarDadosParaAlteracao() {
    const [funcSnap, empSnap] = await Promise.all([
        db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get(),
        db.collection('empresas').orderBy('nome').get()
    ]);

    __alteracao_funcionarios_cache = funcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    __alteracao_empresas_cache = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const funcSelect = document.getElementById('alt-funcionario');
    funcSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
    __alteracao_funcionarios_cache.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.nome;
        funcSelect.appendChild(option);
    });

    // Popular cargos existentes
    const cargoSelect = document.getElementById('alt-novo-cargo');
    const cargosExistentes = [...new Set(__alteracao_funcionarios_cache.map(f => f.cargo).filter(Boolean))].sort();
    cargoSelect.innerHTML = '<option value="">Selecione um cargo</option>';
    cargosExistentes.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        cargoSelect.appendChild(option);
    });

}

function configurarFormularioAlteracao() {
    const funcSelect = document.getElementById('alt-funcionario');
    const setorSelect = document.getElementById('alt-novo-setor');
    const dataInput = document.getElementById('alt-data');

    if (dataInput) {
        dataInput.valueAsDate = new Date();
    }

    funcSelect.onchange = () => {
        const funcId = funcSelect.value;
        const funcaoAtualEl = document.getElementById('alt-funcao-atual');
        setorSelect.innerHTML = '<option value="">Selecione um setor</option>';

        if (!funcId) {
            funcaoAtualEl.textContent = 'Selecione um funcionário';
            return;
        }

        const func = __alteracao_funcionarios_cache.find(f => f.id === funcId);
        const empresa = __alteracao_empresas_cache.find(e => e.id === func.empresaId);

        funcaoAtualEl.innerHTML = `
            <strong>Empresa:</strong> ${empresa?.nome || 'N/A'}<br>
            <strong>Setor:</strong> ${func.setor || 'N/A'}<br>
            <strong>Cargo:</strong> ${func.cargo || 'N/A'}
        `;

        // Popular setores de todas as empresas
        __alteracao_empresas_cache.forEach(e => {
            if (e.setores && e.setores.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = e.nome;
                e.setores.forEach(setor => {
                    const option = document.createElement('option');
                    option.value = setor;
                    option.textContent = setor;
                    option.dataset.empresaId = e.id;
                    optgroup.appendChild(option);
                });
                setorSelect.appendChild(optgroup);
            }
        });
    };
}

async function registrarAlteracaoFuncao() {
    try {
        const funcId = document.getElementById('alt-funcionario').value;
        const data = document.getElementById('alt-data').value;
        const novoSetorEl = document.getElementById('alt-novo-setor');
        const novoSetor = novoSetorEl.value;
        const novoCargo = document.getElementById('alt-novo-cargo').value;
        const motivo = document.getElementById('alt-motivo').value;

        if (!funcId || !data || !novoSetor || !novoCargo) {
            mostrarMensagem("Preencha todos os campos obrigatórios.", "warning");
            return;
        }

        const func = __alteracao_funcionarios_cache.find(f => f.id === funcId);
        const empresaOrigem = __alteracao_empresas_cache.find(e => e.id === func.empresaId);
        const empresaDestinoId = novoSetorEl.options[novoSetorEl.selectedIndex].dataset.empresaId;
        const empresaDestino = __alteracao_empresas_cache.find(e => e.id === empresaDestinoId);

        const alteracaoData = {
            funcionarioId: func.id,
            funcionarioNome: func.nome,
            empresaIdOrigem: func.empresaId,
            empresaNomeOrigem: empresaOrigem?.nome || 'N/A',
            setorOrigem: func.setor,
            cargoOrigem: func.cargo,
            empresaIdDestino: empresaDestinoId,
            empresaNomeDestino: empresaDestino?.nome || 'N/A',
            setorDestino: novoSetor,
            cargoDestino: novoCargo,
            dataAlteracao: new Date(data.replace(/-/g, '\/')),
            motivo: motivo,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),            
            createdByUid: firebase.auth().currentUser?.uid
        };

        await db.collection('alteracoes_funcao').add(alteracaoData);
        mostrarMensagem("Alteração registrada com sucesso!", "success");

        gerarTermoAlteracao(alteracaoData);
        document.getElementById('form-alteracao-funcao').reset();
        document.getElementById('alt-funcao-atual').textContent = 'Selecione um funcionário';
        carregarHistoricoAlteracoes();

    } catch (e) {
        console.error("Erro ao registrar alteração:", e);
        mostrarMensagem("Falha ao registrar alteração.", "error");
    }
}

async function carregarHistoricoAlteracoes() {
    const tbody = document.getElementById('historico-alteracoes-container');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

    const snap = await db.collection('alteracoes_funcao').orderBy('dataAlteracao', 'desc').limit(10).get();

    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma alteração recente.</td></tr>';
        return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
        const alt = doc.data();
        return `
            <tr>
                <td>${formatarData(alt.dataAlteracao.toDate())}</td>
                <td>${alt.funcionarioNome}</td>
                <td><small>${alt.setorOrigem} / ${alt.cargoOrigem}</small></td>
                <td><small>${alt.setorDestino} / ${alt.cargoDestino}</small></td>
            </tr>
        `;
    }).join('');
}

function gerarTermoAlteracao(data) {
    const dataFormatada = formatarData(data.dataAlteracao);
    const conteudo = `
        <html>
            <head><title>Termo de Alteração de Função</title><style>@page { size: A4; margin: 0; } body{font-family: Arial, sans-serif; margin: 1.5cm;} h1{text-align:center;} p{line-height: 1.6; text-align: justify;} .assinatura{margin-top: 80px; text-align: center;}</style>
            </head>
            <body>
                <h1>Termo de Alteração Temporária de Função</h1>
                <p>Pelo presente instrumento, fica registrada a alteração temporária de função do(a) colaborador(a) <strong>${data.funcionarioNome}</strong>,
                que na data de <strong>${dataFormatada}</strong>, será deslocado(a) de suas atividades habituais no setor <strong>${data.setorOrigem}</strong>,
                cargo <strong>${data.cargoOrigem}</strong>, para exercer a função de <strong>${data.cargoDestino}</strong> no setor <strong>${data.setorDestino}</strong>.</p>
                <p>A presente alteração é de caráter excepcional e temporário, motivada por: <strong>${data.motivo || 'necessidade operacional do dia'}</strong>.</p>
                <p>O colaborador declara estar ciente e de acordo com a alteração descrita, que se restringe à data mencionada.</p>
                <br><br>
                <p>Local e Data: ________________________, ${dataFormatada}.</p>
                <div class="assinatura">
                    <p>_________________________________________<br><strong>${data.funcionarioNome}</strong><br>(Assinatura do Colaborador)</p>
                </div>
                <div class="assinatura">
                    <p>_________________________________________<br><strong>(Nome do Responsável/Gerente)</strong><br>(Assinatura da Empresa)</p>
                </div>
            </body>
        </html>
    `;

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