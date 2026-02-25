// js/setores.js

async function inicializarSetores() {
    await carregarSetores();
    adicionarBotaoVerificacao();
}

async function carregarSetores() {
    const tbody = document.getElementById('tabela-setores');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const [setoresSnap, empresasSnap, funcionariosSnap] = await Promise.all([
            db.collection('setores').orderBy('descricao').get(),
            db.collection('empresas').get(),
            db.collection('funcionarios').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
        const funcionariosMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, doc.data().nome]));

        if (setoresSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum setor cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        setoresSnap.forEach(doc => {
            const setor = doc.data();
            const empresaNome = empresasMap.get(setor.empresaId) || 'N/A';
            const gerenteNome = funcionariosMap.get(setor.gerenteId) || 'N/A';
            const dataCriacao = setor.createdAt?.toDate ? setor.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';

            const row = `
                <tr>
                    <td>${setor.descricao}</td>
                    <td>${empresaNome}</td>
                    <td>${gerenteNome}</td>
                    <td class="text-center">${setor.qtdIdeal || 0}</td>
                    <td>${dataCriacao}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" onclick="abrirModalSetor('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirSetor('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Erro ao carregar setores:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar setores.</td></tr>';
    }
}

async function abrirModalSetor(setorId = null) {
    const modalEl = document.getElementById('setorModal');
    const form = document.getElementById('form-setor');
    form.reset();
    document.getElementById('setor-id').value = setorId || '';
    document.querySelector('#setorModal .modal-title').textContent = setorId ? 'Editar Setor' : 'Novo Setor';

    // Popular selects
    const empresaSelect = document.getElementById('setor-empresa');
    const gerenteSelect = document.getElementById('setor-gerente');
    
    empresaSelect.innerHTML = '<option value="">Carregando...</option>';
    gerenteSelect.innerHTML = '<option value="">Carregando...</option>';

    const [empresasSnap, funcionariosSnap] = await Promise.all([
        db.collection('empresas').orderBy('nome').get(),
        db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get()
    ]);

    empresaSelect.innerHTML = '<option value="">Selecione uma empresa</option>';
    empresasSnap.forEach(doc => {
        empresaSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    gerenteSelect.innerHTML = '<option value="">Nenhum</option>';
    funcionariosSnap.forEach(doc => {
        gerenteSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });

    if (setorId) {
        const doc = await db.collection('setores').doc(setorId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('setor-empresa').value = data.empresaId;
            document.getElementById('setor-descricao').value = data.descricao;
            document.getElementById('setor-gerente').value = data.gerenteId || '';
            document.getElementById('setor-qtd-ideal').value = data.qtdIdeal || '';
            document.getElementById('setor-observacao').value = data.observacao || '';
        }
    }

    new bootstrap.Modal(modalEl).show();
}

async function salvarSetor() {
    const setorId = document.getElementById('setor-id').value;
    const dados = {
        empresaId: document.getElementById('setor-empresa').value,
        descricao: document.getElementById('setor-descricao').value.trim(),
        gerenteId: document.getElementById('setor-gerente').value || null,
        qtdIdeal: parseInt(document.getElementById('setor-qtd-ideal').value) || 0,
        observacao: document.getElementById('setor-observacao').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!dados.empresaId || !dados.descricao) {
        mostrarMensagem("Empresa e Descrição são obrigatórios.", "warning");
        return;
    }

    // Validação de duplicidade
    try {
        const duplicidadeSnap = await db.collection('setores')
            .where('empresaId', '==', dados.empresaId)
            .where('descricao', '==', dados.descricao)
            .get();

        const duplicado = duplicidadeSnap.docs.some(doc => doc.id !== setorId);
        if (duplicado) {
            mostrarMensagem("Já existe um setor com esta descrição para a empresa selecionada.", "warning");
            return;
        }
    } catch (error) {
        console.error("Erro ao verificar duplicidade:", error);
    }

    try {
        if (setorId) {
            await db.collection('setores').doc(setorId).update(dados);
            mostrarMensagem("Setor atualizado com sucesso!", "success");
        } else {
            dados.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('setores').add(dados);
            mostrarMensagem("Setor cadastrado com sucesso!", "success");
        }
        bootstrap.Modal.getInstance(document.getElementById('setorModal')).hide();
        await carregarSetores();
        await carregarDashboardSetores();
    } catch (error) {
        console.error("Erro ao salvar setor:", error);
        mostrarMensagem("Erro ao salvar o setor.", "error");
    }
}

async function excluirSetor(setorId) {
    if (!confirm("Tem certeza que deseja excluir este setor? Funcionários neste setor não serão excluídos, mas precisarão ser realocados.")) return;

    try {
        await db.collection('setores').doc(setorId).delete();
        mostrarMensagem("Setor excluído com sucesso.", "info");
        await carregarSetores();
        await carregarDashboardSetores();
    } catch (error) {
        console.error("Erro ao excluir setor:", error);
        mostrarMensagem("Erro ao excluir o setor.", "error");
    }
}

async function carregarDashboardSetores() {
    const tbody = document.getElementById('tabela-dashboard-setores');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Calculando métricas...</td></tr>';

    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);

        const [setoresSnap, funcionariosSnap, reposicoesSnap, contratacoesSnap, empresasSnap, faltasSnap, sumidosSnap] = await Promise.all([
            db.collection('setores').get(),
            db.collection('funcionarios').where('status', '==', 'Ativo').get(),
            db.collection('reposicoes').where('status', '==', 'pendente').get(),
            db.collection('contratacoes').where('status', '==', 'pendente').get(),
            db.collection('empresas').get(),
            db.collection('faltas').where('data', '>=', hoje).where('data', '<', amanha).get(),
            db.collection('casos_sumidos').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
        
        // Estrutura para agrupar dados por setor
        const dadosSetores = {};

        // 1. Inicializa com os setores cadastrados
        setoresSnap.forEach(doc => {
            const s = doc.data();
            const chave = `${s.empresaId}_${s.descricao}`; // Chave única composta
            dadosSetores[chave] = {
                id: doc.id,
                empresaId: s.empresaId,
                empresaNome: empresasMap.get(s.empresaId) || 'N/A',
                nome: s.descricao,
                qtdIdeal: parseInt(s.qtdIdeal) || 0,
                qtdAtual: 0,
                reposicoesPendentes: 0,
                admissoesPendentes: 0,
                faltasHoje: 0,
                colaboradoresSumidos: 0
            };
        });

        // 2. Conta funcionários ativos
        funcionariosSnap.forEach(doc => {
            const f = doc.data();
            if (f.empresaId && f.setor) {
                // Tenta encontrar o setor correspondente. 
                // Nota: Isso depende da consistência do nome do setor entre as coleções.
                // Idealmente, usaríamos IDs, mas o sistema atual usa nomes em muitos lugares.
                const chave = `${f.empresaId}_${f.setor}`;
                if (dadosSetores[chave]) {
                    dadosSetores[chave].qtdAtual++;
                }
            }
        });

        // 3. Conta reposições pendentes
        reposicoesSnap.forEach(doc => {
            const r = doc.data();
            if (r.empresaId && r.setor) {
                const chave = `${r.empresaId}_${r.setor}`;
                if (dadosSetores[chave]) {
                    dadosSetores[chave].reposicoesPendentes++;
                }
            }
        });

        // 4. Conta admissões pendentes (somando a quantidade de vagas)
        contratacoesSnap.forEach(doc => {
            const c = doc.data();
            if (c.empresaId && c.setor) {
                const chave = `${c.empresaId}_${c.setor}`;
                if (dadosSetores[chave]) {
                    dadosSetores[chave].admissoesPendentes += (parseInt(c.quantidade) || 1);
                }
            }
        });

        // 5. Conta faltas de hoje
        faltasSnap.forEach(doc => {
            const f = doc.data();
            if (f.empresaId && f.setor) {
                const chave = `${f.empresaId}_${f.setor}`;
                if (dadosSetores[chave]) {
                    dadosSetores[chave].faltasHoje++;
                }
            }
        });

        // 6. Conta colaboradores sumidos (apenas ativos)
        // Mapeia funcionários ativos para buscar empresaId
        const funcionariosMap = new Map(funcionariosSnap.docs.map(doc => [doc.id, doc.data()]));

        sumidosSnap.forEach(doc => {
            const s = doc.data();
            if (s.status === 'Finalizado') return; // Ignora casos finalizados

            const func = funcionariosMap.get(s.funcionarioId);
            // Só conta se o funcionário ainda estiver ativo e tivermos os dados de empresa/setor
            if (func && func.empresaId && s.setor) {
                const chave = `${func.empresaId}_${s.setor}`;
                if (dadosSetores[chave]) {
                    dadosSetores[chave].colaboradoresSumidos++;
                }
            }
        });

        // Renderiza a tabela
        const listaOrdenada = Object.values(dadosSetores).sort((a, b) => {
            if (a.empresaNome !== b.empresaNome) return a.empresaNome.localeCompare(b.empresaNome);
            return a.nome.localeCompare(b.nome);
        });

        if (listaOrdenada.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Nenhum setor cadastrado para análise.</td></tr>';
            return;
        }

        tbody.innerHTML = listaOrdenada.map(s => {
            const gap = s.qtdAtual - s.qtdIdeal;
            let gapClass = 'text-success';
            let gapIcon = '<i class="fas fa-check"></i>';
            
            if (gap < 0) {
                gapClass = 'text-danger fw-bold';
                gapIcon = '<i class="fas fa-arrow-down"></i>';
            } else if (gap > 0) {
                gapClass = 'text-warning fw-bold';
                gapIcon = '<i class="fas fa-arrow-up"></i>';
            }

            return `
                <tr>
                    <td>${s.empresaNome}</td>
                    <td><strong>${s.nome}</strong></td>
                    <td class="text-center bg-light">${s.qtdIdeal}</td>
                    <td class="text-center fw-bold">${s.qtdAtual}</td>
                    <td class="text-center">${s.reposicoesPendentes > 0 ? `<span class="badge bg-warning text-dark">${s.reposicoesPendentes}</span>` : '-'}</td>
                    <td class="text-center">${s.admissoesPendentes > 0 ? `<span class="badge bg-info text-dark">${s.admissoesPendentes}</span>` : '-'}</td>
                    <td class="text-center ${s.faltasHoje > 0 ? 'text-danger fw-bold' : ''}">${s.faltasHoje > 0 ? s.faltasHoje : '-'}</td>
                    <td class="text-center ${s.colaboradoresSumidos > 0 ? 'text-danger fw-bold' : ''}">${s.colaboradoresSumidos > 0 ? s.colaboradoresSumidos : '-'}</td>
                    <td class="text-center ${gapClass}">${gapIcon} ${gap > 0 ? '+' : ''}${gap}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Erro ao carregar dashboard de setores:", error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados do dashboard.</td></tr>';
    }
}

function exportarDashboardSetoresExcel() {
    const table = document.getElementById('table-analise-lotacao');
    if (!table) {
        mostrarMensagem("Tabela não encontrada.", "error");
        return;
    }
    const wb = XLSX.utils.table_to_book(table, {sheet: "Lotação"});
    XLSX.writeFile(wb, 'Analise_Lotacao_Vagas.xlsx');
}

function exportarDashboardSetoresWord() {
     const table = document.getElementById('table-analise-lotacao');
     if (!table) {
        mostrarMensagem("Tabela não encontrada.", "error");
        return;
     }
     
     const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>Análise de Lotação</title>
            <!--[if gte mso 9]>
            <xml>
            <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>90</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page {
                    size: 29.7cm 21cm;
                    margin: 1cm 1cm 1cm 1cm;
                    mso-page-orientation: landscape;
                }
                @page Section1 {
                    size: 29.7cm 21cm;
                    margin: 1cm 1cm 1cm 1cm;
                    mso-header-margin: 36pt;
                    mso-footer-margin: 36pt;
                    mso-paper-source: 0;
                    layout: landscape;
                }
                div.Section1 {
                    page: Section1;
                }
                body { font-family: Arial, sans-serif; }
                table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                th, td { border: 1px solid #000; padding: 4px; text-align: center; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <div class="Section1">
                <h2>Análise de Lotação e Vagas</h2>
                ${table.outerHTML}
            </div>
        </body>
        </html>
     `;
     
     const blob = new Blob(['\ufeff', html], {
        type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Analise_Lotacao_Vagas.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Exportar funções globalmente
window.exportarDashboardSetoresExcel = exportarDashboardSetoresExcel;
window.exportarDashboardSetoresWord = exportarDashboardSetoresWord;
window.carregarDashboardSetores = carregarDashboardSetores;

function adicionarBotaoVerificacao() {
    if (document.getElementById('btn-verificar-desconformidade')) return;

    const tbody = document.getElementById('tabela-setores');
    if (!tbody) return;

    const table = tbody.closest('table');
    // Encontra o container da tabela (pode ser um .table-responsive ou o pai direto)
    const container = table.closest('.table-responsive') || table.parentElement;
    
    // Tenta encontrar um container de ações acima da tabela
    let toolbar = container.previousElementSibling;
    
    // Verifica se é um container válido para botões (d-flex), senão cria um
    if (!toolbar || !toolbar.classList.contains('d-flex')) {
        toolbar = document.createElement('div');
        toolbar.className = 'd-flex justify-content-end mb-3 gap-2';
        container.parentElement.insertBefore(toolbar, container);
    }

    const btn = document.createElement('button');
    btn.id = 'btn-verificar-desconformidade';
    btn.className = 'btn btn-warning text-dark btn-sm';
    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Verificar Desconformidades';
    btn.onclick = verificarDesconformidadeSetores;
    
    toolbar.appendChild(btn);
}

// --- Início da Refatoração do Modal de Desconformidade ---

// Gerencia as instâncias dos modais para evitar duplicação
const modalManager = {
    report: null,
    correction: null,
    getReportModal: function() {
        if (!this.report) {
            this.report = new bootstrap.Modal(document.getElementById('desconformidadeModal'));
        }
        return this.report;
    },
    getCorrectionModal: function() {
        if (!this.correction) {
            this.correction = new bootstrap.Modal(document.getElementById('correcaoSetorModal'));
        }
        return this.correction;
    }
};

// Cria os elementos do DOM para os modais na inicialização da página
function criarModaisDeDesconformidade() {
    if (document.getElementById('desconformidadeModal')) return;

    const reportModalHTML = `
        <div class="modal fade" id="desconformidadeModal" tabindex="-1" aria-labelledby="desconformidadeModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="desconformidadeModalLabel">Relatório de Desconformidade de Setores</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="desconformidade-summary" class="alert alert-warning"></div>
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th class="text-center">Ação</th>
                                        <th>Colaborador</th>
                                        <th>Empresa</th>
                                        <th>Setor Atual (Inválido)</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody id="desconformidade-table-body">
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const correctionModalHTML = `
        <div class="modal fade" id="correcaoSetorModal" tabindex="-1" aria-labelledby="correcaoSetorModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="correcaoSetorModalLabel">Corrigir Setor do Colaborador</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-correcao-setor">
                            <input type="hidden" id="correcao-func-id">
                            <div class="mb-3">
                                <label class="form-label">Colaborador</label>
                                <input type="text" class="form-control" id="correcao-func-nome" readonly disabled>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Setor Atual (Inválido)</label>
                                <input type="text" class="form-control is-invalid" id="correcao-setor-atual" readonly disabled>
                            </div>
                            <div class="mb-3">
                                <label for="correcao-novo-setor" class="form-label">Novo Setor</label>
                                <select class="form-select" id="correcao-novo-setor" required></select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btn-salvar-correcao">Salvar Correção</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', reportModalHTML);
    document.body.insertAdjacentHTML('beforeend', correctionModalHTML);
    
    // Adiciona o listener para salvar a correção
    document.getElementById('btn-salvar-correcao').addEventListener('click', salvarCorrecaoSetor);
}


async function verificarDesconformidadeSetores() {
    mostrarMensagem("Verificando conformidade de setores...", "info");
    
    try {
        const [setoresSnap, funcionariosSnap, empresasSnap] = await Promise.all([
            db.collection('setores').get(),
            db.collection('funcionarios').where('status', '==', 'Ativo').get(),
            db.collection('empresas').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
        const setoresValidos = new Set(setoresSnap.docs.map(doc => `${doc.data().empresaId}_${doc.data().descricao.trim()}`));

        const desconformidades = [];
        funcionariosSnap.forEach(doc => {
            const f = doc.data();
            const chave = `${f.empresaId}_${(f.setor || '').trim()}`;
            if (!f.empresaId || !f.setor || !setoresValidos.has(chave)) {
                desconformidades.push({
                    id: doc.id,
                    ...f,
                    empresaNome: f.empresaId ? (empresasMap.get(f.empresaId) || 'ID Desconhecido') : 'Sem Empresa',
                    motivo: !f.empresaId || !f.setor ? 'Cadastro incompleto' : 'Setor não cadastrado na empresa'
                });
            }
        });

        if (desconformidades.length === 0) {
            mostrarMensagem("Todos os colaboradores estão em conformidade.", "success");
            return;
        }

        renderizarModalDesconformidade(desconformidades);

    } catch (error) {
        console.error("Erro ao verificar desconformidades:", error);
        mostrarMensagem("Erro ao processar verificação: " + error.message, "error");
    }
}

function renderizarModalDesconformidade(desconformidades) {
    const summary = document.getElementById('desconformidade-summary');
    summary.textContent = `Foram encontrados ${desconformidades.length} colaborador(es) com inconsistências.`;

    const tableBody = document.getElementById('desconformidade-table-body');
    tableBody.innerHTML = ''; 

    desconformidades.forEach(item => {
        const tr = document.createElement('tr');
        
        const createCell = (content) => {
            const td = document.createElement('td');
            td.innerHTML = content;
            return td;
        };
        
        const actionTd = document.createElement('td');
        actionTd.className = 'text-center';
        
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-outline-primary';
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        
        if (!item.empresaId) {
            editButton.disabled = true;
            editButton.title = 'Não é possível corrigir: o colaborador não possui uma empresa definida.';
        } else {
            editButton.title = 'Corrigir setor';
            editButton.addEventListener('click', () => {
                abrirModalCorrecaoSetor(item.id, item.empresaId, item.nome, item.setor);
            });
        }
        
        actionTd.appendChild(editButton);
        tr.appendChild(actionTd);

        tr.appendChild(createCell(item.nome));
        tr.appendChild(createCell(item.empresaNome));
        tr.appendChild(createCell(`<span class="badge bg-danger">${item.setor || 'Não informado'}</span>`));
        tr.appendChild(createCell(item.motivo));

        tableBody.appendChild(tr);
    });

    modalManager.getReportModal().show();
}


async function abrirModalCorrecaoSetor(funcId, empresaId, nomeFunc, setorAtual) {
    document.getElementById('correcao-func-id').value = funcId;
    document.getElementById('correcao-func-nome').value = nomeFunc;
    document.getElementById('correcao-setor-atual').value = setorAtual;

    const select = document.getElementById('correcao-novo-setor');
    select.innerHTML = '<option value="">Carregando...</option>';
    select.disabled = true;

    try {
        // Removido o .orderBy('descricao') para evitar erro de índice no Firebase
        const setoresSnap = await db.collection('setores').where('empresaId', '==', empresaId).get();
        
        if (setoresSnap.empty) {
            select.innerHTML = '<option value="">Nenhum setor cadastrado para esta empresa</option>';
        } else {
            // Ordenar os resultados no lado do cliente
            const setores = setoresSnap.docs.map(doc => doc.data());
            setores.sort((a, b) => a.descricao.localeCompare(b.descricao));

            select.innerHTML = '<option value="">Selecione o novo setor...</option>';
            setores.forEach(setorData => {
                const setor = setorData.descricao;
                const option = new Option(setor, setor, false, setor === setorAtual);
                select.add(option);
            });
            select.disabled = false;
        }
    } catch (error) {
        console.error("Erro ao carregar setores para correção:", error);
        select.innerHTML = '<option value="">Erro ao carregar setores</option>';
    }
    
    modalManager.getReportModal().hide();
    modalManager.getCorrectionModal().show();
}

async function salvarCorrecaoSetor() {
    const funcId = document.getElementById('correcao-func-id').value;
    const novoSetor = document.getElementById('correcao-novo-setor').value;

    if (!novoSetor) {
        mostrarMensagem("Selecione um novo setor.", "warning");
        return;
    }

    const button = document.getElementById('btn-salvar-correcao');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        await db.collection('funcionarios').doc(funcId).update({ 
            setor: novoSetor,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        mostrarMensagem("Setor do colaborador corrigido com sucesso!", "success");
        modalManager.getCorrectionModal().hide();
        
        // Re-executa a verificação para atualizar a lista
        verificarDesconformidadeSetores();

    } catch (error) {
        console.error("Erro ao salvar correção de setor:", error);
        mostrarMensagem("Erro ao salvar a correção: " + error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = 'Salvar Correção';
    }
}


// Adicionar funções ao escopo global e inicializar
document.addEventListener('DOMContentLoaded', criarModaisDeDesconformidade);
window.verificarDesconformidadeSetores = verificarDesconformidadeSetores;

// --- Fim da Refatoração do Modal de Desconformidade ---