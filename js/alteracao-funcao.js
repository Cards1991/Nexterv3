// Gerenciamento de Alteração de Função
let __alteracao_funcionarios_cache = [];
let __alteracao_empresas_cache = [];

async function inicializarAlteracaoFuncao() {
    try {
        await Promise.all([
            carregarDadosParaAlteracao(),
            carregarHistoricoAlteracoes(),
            verificarAlertasDeExames() // Nova função para verificar os alertas
        ]);
        configurarFormularioAlteracao();
    } catch (e) {
        console.error("Erro ao inicializar alteração de função:", e);
        mostrarMensagem("Erro ao carregar módulo de alteração de função", "error");
    }
}

/**
 * Verifica as alterações de função que estão próximas de 90 dias e exibe um alerta.
 */
async function verificarAlertasDeExames() {
    const container = document.getElementById('alertas-exame-funcao-container');
    const listaAlertas = document.getElementById('lista-alertas-exame-funcao');
    const cardAlerta = document.getElementById('alerta-exame-funcao-modelo');

    if (!container || !listaAlertas || !cardAlerta) return;

    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Busca todas as alterações de função
        const snap = await db.collection('alteracoes_funcao').get();
        const alertas = [];

        snap.forEach(doc => {
            const alteracao = doc.data();
            const dataAlteracao = alteracao.dataAlteracao.toDate();
            dataAlteracao.setHours(0, 0, 0, 0);

            const diffTime = hoje.getTime() - dataAlteracao.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // Se a alteração tem 85 dias ou mais, cria um alerta
            if (diffDays >= 85) {
                alertas.push({
                    nome: alteracao.funcionarioNome,
                    dias: diffDays,
                    de: `${alteracao.setorOrigem} / ${alteracao.cargoOrigem}`,
                    para: `${alteracao.setorDestino} / ${alteracao.cargoDestino}`
                });
            }
        });

        renderizarAlertas(alertas, listaAlertas, cardAlerta);

    } catch (error) {
        console.error("Erro ao verificar alertas de exame de função:", error);
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

        const docRef = await db.collection('alteracoes_funcao').add(alteracaoData);

        // Atualiza o cadastro do funcionário (setor / cargo / empresa) e registra no histórico interno
        try {
            const historicoMov = {
                tipo: 'alteracao_funcao',
                data: alteracaoData.dataAlteracao,
                de: {
                    empresaId: alteracaoData.empresaIdOrigem,
                    empresaNome: alteracaoData.empresaNomeOrigem,
                    setor: alteracaoData.setorOrigem,
                    cargo: alteracaoData.cargoOrigem
                },
                para: {
                    empresaId: alteracaoData.empresaIdDestino,
                    empresaNome: alteracaoData.empresaNomeDestino,
                    setor: alteracaoData.setorDestino,
                    cargo: alteracaoData.cargoDestino
                },
                motivo: alteracaoData.motivo || null,
                alteracaoFuncaoId: docRef.id,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                criadoPor: firebase.auth().currentUser?.uid || null
            };

            // Atualiza campos principais do funcionário
            await db.collection('funcionarios').doc(func.id).update({
                setor: alteracaoData.setorDestino,
                cargo: alteracaoData.cargoDestino,
                empresaId: alteracaoData.empresaIdDestino || alteracaoData.empresaIdOrigem,
                historicoMovimentacoes: firebase.firestore.FieldValue.arrayUnion(historicoMov),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedByUid: firebase.auth().currentUser?.uid || null
            });

            // Atualiza cache local para refletir a mudança imediata na UI
            const cacheIndex = __alteracao_funcionarios_cache.findIndex(f => f.id === func.id);
            if (cacheIndex !== -1) {
                __alteracao_funcionarios_cache[cacheIndex].setor = alteracaoData.setorDestino;
                __alteracao_funcionarios_cache[cacheIndex].cargo = alteracaoData.cargoDestino;
                __alteracao_funcionarios_cache[cacheIndex].empresaId = alteracaoData.empresaIdDestino || alteracaoData.empresaIdOrigem;
            }
        } catch (err) {
            console.error('Erro ao atualizar cadastro/histórico do funcionário:', err);
            // Não interrompe o fluxo principal, apenas avisa
            mostrarMensagem('Alteração registrada, mas falha ao atualizar cadastro do funcionário.', 'warning');
        }

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

/**
 * Popula o dropdown de empresas nos filtros de alteração de função.
 */
function popularFiltroEmpresasAlteracao() {
    const empresaSelect = document.getElementById('alt-filtro-empresa');
    if (!empresaSelect) return;
    
    empresaSelect.innerHTML = '<option value="">Todas</option>';
    
    if (__alteracao_empresas_cache && __alteracao_empresas_cache.length > 0) {
        __alteracao_empresas_cache.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.nome;
            option.textContent = emp.nome;
            empresaSelect.appendChild(option);
        });
    }
}

/**
 * Filtra o histórico de alterações de função com base nos filtros selecionados.
 */
async function filtrarAlteracoesFuncao() {
    const tbody = document.getElementById('historico-alteracoes-container');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Filtrando...</td></tr>';

    try {
        const dataInicio = document.getElementById('alt-filtro-inicio').value;
        const dataFim = document.getElementById('alt-filtro-fim').value;
        const empresa = document.getElementById('alt-filtro-empresa').value;
        const nome = document.getElementById('alt-filtro-nome').value.toLowerCase().trim();

        // Consulta base - sem limites para permitir filtragem completa
        let query = db.collection('alteracoes_funcao').orderBy('dataAlteracao', 'desc');
        
        const snap = await query.get();

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma alteração encontrada.</td></tr>';
            return;
        }

        let resultados = snap.docs.map(doc => doc.data());

        // Aplicar filtros
        if (dataInicio) {
            const inicio = new Date(dataInicio);
            inicio.setHours(0, 0, 0, 0);
            resultados = resultados.filter(alt => alt.dataAlteracao.toDate() >= inicio);
        }

        if (dataFim) {
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999);
            resultados = resultados.filter(alt => alt.dataAlteracao.toDate() <= fim);
        }

        if (empresa) {
            resultados = resultados.filter(alt => 
                alt.empresaNomeDestino === empresa || alt.empresaNomeOrigem === empresa
            );
        }

        if (nome) {
            resultados = resultados.filter(alt => 
                alt.funcionarioNome && alt.funcionarioNome.toLowerCase().includes(nome)
            );
        }

        if (resultados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum resultado para os filtros selecionados.</td></tr>';
            return;
        }

        tbody.innerHTML = resultados.map((alt, index) => {
            // Armazena os dados no elemento usando dataset para evitar problemas com JSON.stringify em onclick
            return `
                <tr data-alt-func-id="${alt.funcionarioId}" data-alt-index="${index}">
                    <td>${formatarData(alt.dataAlteracao.toDate())}</td>
                    <td>${alt.funcionarioNome || 'N/A'}</td>
                    <td><small>${alt.setorOrigem} / ${alt.cargoOrigem}</small></td>
                    <td><small>${alt.setorDestino} / ${alt.cargoDestino}</small></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-info" onclick="buscarEExecutarAcao('${alt.funcionarioId}', 'visualizar')" title="Visualizar"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-secondary" onclick="reimprimirTermoFiltrado('${alt.funcionarioId}')" title="Reimprimir"><i class="fas fa-print"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Erro ao filtrar alterações:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao filtrar dados.</td></tr>';
    }
}

/**
 * Função auxiliar para buscar o ID do documento e executar ação.
 * Como não temos o ID direto após filtragem, usamos os dados para encontrar.
 */
async function buscarEExecutarAcao(funcionarioId, acao) {
    try {
        const snap = await db.collection('alteracoes_funcao')
            .where('funcionarioId', '==', funcionariosId)
            .orderBy('dataAlteracao', 'desc')
            .limit(1)
            .get();
        
        if (!snap.empty) {
            const docId = snap.docs[0].id;
            if (acao === 'visualizar') {
                visualizarAlteracao(docId);
            }
        }
    } catch (error) {
        console.error("Erro ao buscar alteração:", error);
    }
}

/**
 * Reimprime o termo a partir dos dados do objeto.
 */
async function reimprimirTermoPorDados(alt) {
    if (alt && alt.dataAlteracao) {
        // Garantir que dataAlteracao seja um objeto Date para a função gerarTermoAlteracao
        const dados = {
            ...alt,
            dataAlteracao: alt.dataAlteracao.toDate ? alt.dataAlteracao.toDate() : new Date(alt.dataAlteracao)
        };
        gerarTermoAlteracao(dados);
    }
}

/**
 * Reimprime o termo filtrado buscando pelo ID do funcionário.
 */
async function reimprimirTermoFiltrado(funcionariosId) {
    try {
        const snap = await db.collection('alteracoes_funcao')
            .where('funcionarioId', '==', funcionariosId)
            .orderBy('dataAlteracao', 'desc')
            .limit(1)
            .get();
        
        if (!snap.empty) {
            gerarTermoAlteracao(snap.docs[0].data());
        } else {
            mostrarMensagem("Registro não encontrado para reimpressão.", "error");
        }
    } catch (error) {
        console.error("Erro ao reimprimir termo filtrado:", error);
        mostrarMensagem("Falha ao gerar o termo para reimpressão.", "error");
    }
}

/**
 * Limpa os filtros de alteração de função e recarrega o histórico completo.
 */
function limparFiltrosAlteracoes() {
    document.getElementById('alt-filtro-inicio').value = '';
    document.getElementById('alt-filtro-fim').value = '';
    document.getElementById('alt-filtro-empresa').value = '';
    document.getElementById('alt-filtro-nome').value = '';
    
    carregarHistoricoAlteracoes();
}

async function carregarHistoricoAlteracoes() {
    const tbody = document.getElementById('historico-alteracoes-container');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

    // Popula o filtro de empresas se ainda não foi feito
    popularFiltroEmpresasAlteracao();

    const snap = await db.collection('alteracoes_funcao').orderBy('dataAlteracao', 'desc').limit(10).get();

    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma alteração recente.</td></tr>';
        return;
    }

    tbody.innerHTML = snap.docs.map(doc => {
        const alt = doc.data();
        return `
            <tr>
                <td>${formatarData(alt.dataAlteracao.toDate())}</td>
                <td>${alt.funcionarioNome || 'N/A'}</td>
                <td><small>${alt.setorOrigem} / ${alt.cargoOrigem}</small></td>
                <td><small>${alt.setorDestino} / ${alt.cargoDestino}</small></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="visualizarAlteracao('${doc.id}')" title="Visualizar"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-outline-primary" onclick="editarAlteracao('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-outline-secondary" onclick="reimprimirTermo('${doc.id}')" title="Reimprimir"><i class="fas fa-print"></i></button>
                        <button class="btn btn-outline-danger" onclick="excluirAlteracao('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Renderiza os alertas na interface do usuário.
 * @param {Array} alertas - A lista de alertas a serem exibidos.
 * @param {HTMLElement} listaEl - O elemento onde a lista de alertas será renderizada.
 * @param {HTMLElement} cardEl - O card de alerta principal.
 */
function renderizarAlertas(alertas, listaEl, cardEl) {
    if (alertas.length === 0) {
        cardEl.style.display = 'none';
        return;
    }

    listaEl.innerHTML = alertas.map(alerta => `
        <div class="alert alert-secondary p-2 mb-2">
            <strong>${alerta.nome}</strong> - A alteração de função para 
            <strong>${alerta.para}</strong> já completou 
            <span class="badge bg-danger">${alerta.dias} dias</span>. 
            É recomendado realizar o exame de mudança de função.
        </div>
    `).join('');

    cardEl.style.display = 'block';
}

function gerarTermoAlteracao(data) {
    // CORREÇÃO: Garante que estamos passando um objeto Date para a função formatarData
    const dataFormatada = formatarData(data.dataAlteracao.toDate ? data.dataAlteracao.toDate() : data.dataAlteracao);
    const hojeFormatado = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    let corpoTermo = '';
    
    if (data.motivo === 'Mudança temporária') {
        // Texto ajustado para corresponder exatamente ao solicitado pelo usuário, em um único parágrafo.
        corpoTermo = `<p>Pelo presente instrumento, fica registrada a alteração de função do(a) colaborador(a) <strong>${data.funcionarioNome}</strong>. Na data de <strong>${dataFormatada}</strong>, será transferido(a) de suas atividades no setor <strong>${data.setorOrigem}</strong> (cargo: <strong>${data.cargoOrigem}</strong>) para exercer a função de <strong>${data.cargoDestino}</strong> no setor <strong>${data.setorDestino}</strong>. Motivo da Alteração: Mudança temporária. O colaborador declara ter recebido todo o treinamento e equipamento de proteção e esta ciente e de acordo com a alteração descrita. Todas as demais cláusulas do contrato de trabalho original permanecem inalteradas.</p>`;
    } else {
        // Texto para outros motivos também ajustado para um único parágrafo para consistência.
        corpoTermo = `<p>Pelo presente instrumento, fica registrada a alteração de função do(a) colaborador(a) <strong>${data.funcionarioNome}</strong>, que a partir da data de <strong>${dataFormatada}</strong>, será transferido(a) de suas atividades no setor <strong>${data.setorOrigem}</strong> (cargo: <strong>${data.cargoOrigem}</strong>) para exercer a função de <strong>${data.cargoDestino}</strong> no setor <strong>${data.setorDestino}</strong>. Motivo da Alteração: ${data.motivo || 'Necessidade operacional.'}. O colaborador declara estar ciente e de acordo com a alteração descrita. Todas as demais cláusulas do contrato de trabalho original permanecem inalteradas.</p>`;
    }

    // CORREÇÃO: Substituído todo o bloco de conteúdo pelo novo layout profissional
    const conteudo = `
        <html>
            <head>
                <title>Termo de mudança temporária de função</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 0; }
                    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #333; }
                    .termo-container { max-width: 800px; margin: 2cm auto; padding: 2cm; border: 1px solid #ddd; }
                    .termo-header { text-align: center; border-bottom: 2px solid #0d6efd; padding-bottom: 1rem; margin-bottom: 2rem; }
                    .termo-header h2 { font-weight: 700; color: #0d6efd; }
                    .termo-body p { font-size: 1.1rem; line-height: 1.8; text-align: justify; margin-bottom: 1.5rem; }
                    .assinatura-area { margin-top: 80px; display: flex; justify-content: space-around; }
                    .assinatura-block { text-align: center; }
                    .assinatura-linha { border-top: 1px solid #333; width: 280px; margin: 40px auto 5px auto; }
                    @media print {
                        body { background-color: #fff; }
                        .termo-container { border: none; box-shadow: none; margin: 1cm; padding: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="termo-container">
                    <div class="termo-header">
                        <h2>Termo de mudança temporária de função</h2>
                    </div>
                    <div class="termo-body">
                        ${corpoTermo}
                        <p class="text-end mt-5">Imbituva-PR, ${hojeFormatado}.</p>
                    </div>
                    <div class="assinatura-area">
                        <div class="assinatura-block"><div class="assinatura-linha"></div><p><strong>${data.funcionarioNome}</strong><br>Colaborador(a)</p></div>
                        <div class="assinatura-block"><div class="assinatura-linha"></div><p><strong>Empresa</strong><br>(Responsável)</p></div>
                    </div>
                </div>
            </body>
        </html>
    `;

    openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });
}

async function visualizarAlteracao(id) {
    try {
        const doc = await db.collection('alteracoes_funcao').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro de alteração não encontrado.", "error");
            return;
        }
        const alt = doc.data();
        const corpoModal = `
            <p><strong>Funcionário:</strong> ${alt.funcionarioNome}</p>
            <p><strong>Data da Alteração:</strong> ${formatarData(alt.dataAlteracao.toDate())}</p>
            <hr>
            <p><strong>De:</strong></p>
            <ul>
                <li><strong>Empresa:</strong> ${alt.empresaNomeOrigem}</li>
                <li><strong>Setor:</strong> ${alt.setorOrigem}</li>
                <li><strong>Cargo:</strong> ${alt.cargoOrigem}</li>
            </ul>
            <p><strong>Para:</strong></p>
            <ul>
                <li><strong>Empresa:</strong> ${alt.empresaNomeDestino}</li>
                <li><strong>Setor:</strong> ${alt.setorDestino}</li>
                <li><strong>Cargo:</strong> ${alt.cargoDestino}</li>
            </ul>
            <hr>
            <p><strong>Motivo:</strong> ${alt.motivo || 'Não informado'}</p>
        `;
        abrirModalGenerico("Detalhes da Alteração de Função", corpoModal);
    } catch (error) {
        console.error("Erro ao visualizar alteração:", error);
        mostrarMensagem("Falha ao carregar detalhes da alteração.", "error");
    }
}

async function editarAlteracao(id) {
    try {
        const doc = await db.collection('alteracoes_funcao').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro de alteração não encontrado.", "error");
            return;
        }
        const alt = doc.data();

        // Preenche o formulário com os dados
        document.getElementById('alt-funcionario').value = alt.funcionarioId;
        document.getElementById('alt-funcionario').dispatchEvent(new Event('change')); // Força a atualização dos dados do funcionário

        // Aguarda um pouco para os selects serem populados e então seleciona os valores
        setTimeout(() => {
            const setorSelect = document.getElementById('alt-novo-setor');
            const cargoSelect = document.getElementById('alt-novo-cargo');
            const motivoSelect = document.getElementById('alt-motivo');
            document.getElementById('alt-data').value = alt.dataAlteracao.toDate().toISOString().split('T')[0];
            motivoSelect.value = alt.motivo || '';
            setorSelect.value = alt.setorDestino;
            cargoSelect.value = alt.cargoDestino;
        }, 500);

        // Altera o botão para o modo de atualização
        const btnSalvar = document.querySelector('#form-alteracao-funcao button');
        btnSalvar.innerHTML = '<i class="fas fa-save"></i> Atualizar Registro';
        btnSalvar.onclick = () => atualizarAlteracao(id);

        window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo para ver o formulário

    } catch (error) {
        console.error("Erro ao carregar dados para edição:", error);
        mostrarMensagem("Falha ao carregar dados para edição.", "error");
    }
}

async function atualizarAlteracao(id) {
    const dadosAtualizados = {
        dataAlteracao: new Date(document.getElementById('alt-data').value.replace(/-/g, '\/')),
        setorDestino: document.getElementById('alt-novo-setor').value,
        cargoDestino: document.getElementById('alt-novo-cargo').value,
        motivo: document.getElementById('alt-motivo').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('alteracoes_funcao').doc(id).update(dadosAtualizados);
        mostrarMensagem("Alteração atualizada com sucesso!", "success");
        
        // Restaura o botão para o estado original
        const btnSalvar = document.querySelector('#form-alteracao-funcao button');
        btnSalvar.innerHTML = '<i class="fas fa-print"></i> Registrar e Imprimir Termo';
        btnSalvar.onclick = registrarAlteracaoFuncao;

        document.getElementById('form-alteracao-funcao').reset();
        await carregarHistoricoAlteracoes();

    } catch (error) {
        console.error("Erro ao atualizar alteração:", error);
        mostrarMensagem("Falha ao atualizar o registro.", "error");
    }
}

async function excluirAlteracao(id) {
    if (!confirm("Tem certeza que deseja excluir este registro de alteração? O cadastro do funcionário será revertido para o setor/cargo anterior.")) return;
    
    try {
        const docRef = db.collection('alteracoes_funcao').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            mostrarMensagem("Registro de alteração não encontrado.", "error");
            return;
        }

        const alteracao = docSnap.data();
        const funcionarioId = alteracao.funcionarioId;

        if (funcionarioId) {
            const funcRef = db.collection('funcionarios').doc(funcionarioId);
            
            await db.runTransaction(async (transaction) => {
                const funcDoc = await transaction.get(funcRef);
                if (funcDoc.exists) {
                    const funcData = funcDoc.data();
                    
                    // Reverte os dados cadastrais para a origem
                    const updateData = {
                        setor: alteracao.setorOrigem,
                        cargo: alteracao.cargoOrigem,
                        empresaId: alteracao.empresaIdOrigem
                    };

                    // Remove do histórico de movimentações do funcionário
                    let historico = funcData.historicoMovimentacoes || [];
                    const novoHistorico = historico.filter(h => h.alteracaoFuncaoId !== id);

                    transaction.update(funcRef, {
                        ...updateData,
                        historicoMovimentacoes: novoHistorico
                    });
                }
                
                // Exclui o registro de alteração
                transaction.delete(docRef);
            });
        } else {
            // Se não tiver funcionário vinculado, apenas exclui o registro
            await docRef.delete();
        }

        mostrarMensagem("Registro de alteração excluído e cadastro revertido com sucesso.", "success");
        await carregarHistoricoAlteracoes();
    } catch (error) {
        console.error("Erro ao excluir alteração:", error);
        mostrarMensagem("Falha ao excluir o registro.", "error");
    }
}

async function reimprimirTermo(id) {
    try {
        const doc = await db.collection('alteracoes_funcao').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado para reimpressão.", "error");
            return;
        }
        gerarTermoAlteracao(doc.data());
    } catch (error) {
        console.error("Erro ao reimprimir termo:", error);
        mostrarMensagem("Falha ao gerar o termo para reimpressão.", "error");
    }
}
