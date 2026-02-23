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

// Função para verificar colaboradores em setores não cadastrados
async function verificarDesconformidadeSetores() {
    try {
        mostrarMensagem("Verificando conformidade de setores...", "info");

        const [setoresSnap, funcionariosSnap, empresasSnap] = await Promise.all([
            db.collection('setores').get(),
            db.collection('funcionarios').where('status', '==', 'Ativo').get(),
            db.collection('empresas').get()
        ]);

        const empresasMap = new Map(empresasSnap.docs.map(doc => [doc.id, doc.data().nome]));
        
        // Cria um conjunto de chaves válidas "empresaId_nomeSetor"
        const setoresValidos = new Set();
        setoresSnap.forEach(doc => {
            const s = doc.data();
            if (s.empresaId && s.descricao) {
                setoresValidos.add(`${s.empresaId}_${s.descricao.trim()}`);
            }
        });

        const desconformidades = [];

        funcionariosSnap.forEach(doc => {
            const f = doc.data();
            const empresaNome = f.empresaId ? (empresasMap.get(f.empresaId) || 'ID Desconhecido') : 'Sem Empresa';
            
            // Verifica se tem empresa e setor
            if (!f.empresaId || !f.setor) {
                desconformidades.push({
                    id: doc.id,
                    empresaId: f.empresaId,
                    nome: f.nome,
                    empresa: empresaNome,
                    setor: f.setor || 'Não informado',
                    motivo: 'Cadastro incompleto (Empresa ou Setor faltando)'
                });
                return;
            }

            // Verifica se o setor existe na empresa
            const chave = `${f.empresaId}_${f.setor.trim()}`;
            if (!setoresValidos.has(chave)) {
                desconformidades.push({
                    id: doc.id,
                    empresaId: f.empresaId,
                    nome: f.nome,
                    empresa: empresaNome,
                    setor: f.setor,
                    motivo: 'Setor não encontrado no cadastro de setores desta empresa'
                });
            }
        });

        if (desconformidades.length === 0) {
            mostrarMensagem("Todos os colaboradores estão em conformidade com o cadastro de setores.", "success");
            return;
        }

        // Exibir resultado
        let html = `
            <div class="alert alert-warning d-flex align-items-center shadow-sm">
                <i class="fas fa-exclamation-triangle fa-2x me-3"></i>
                <div>
                    <h5 class="alert-heading mb-1">Atenção Necessária</h5>
                    <p class="mb-0">Foram encontrados <strong>${desconformidades.length}</strong> colaboradores com inconsistências no cadastro de setor.</p>
                </div>
            </div>
            <div class="table-responsive border rounded shadow-sm" style="max-height: 500px; overflow-y: auto;">
                <table class="table table-hover mb-0 align-middle">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th>Colaborador</th>
                            <th>Empresa</th>
                            <th>Setor Atual</th>
                            <th>Motivo</th>
                            <th class="text-center" style="width: 100px;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        desconformidades.forEach(item => {
            // Escapar aspas simples para o onclick
            const nomeSafe = item.nome.replace(/'/g, "\\'");
            const setorSafe = item.setor.replace(/'/g, "\\'");
            const empresaIdSafe = item.empresaId || '';

            html += `
                <tr>
                    <td><div class="fw-bold text-dark">${item.nome}</div></td>
                    <td><small class="text-muted">${item.empresa}</small></td>
                    <td><span class="badge bg-secondary text-wrap">${item.setor}</span></td>
                    <td><span class="text-danger small"><i class="fas fa-times-circle me-1"></i>${item.motivo}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary" title="Corrigir Setor" 
                            onclick="abrirModalCorrecaoSetor('${item.id}', '${empresaIdSafe}', '${nomeSafe}', '${setorSafe}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;

        if (typeof abrirModalGenerico === 'function') {
            abrirModalGenerico("Relatório de Desconformidade de Setores", html);
        } else {
            console.table(desconformidades);
            alert(`Encontrados ${desconformidades.length} casos de desconformidade. Verifique o console.`);
        }

    } catch (error) {
        console.error("Erro ao verificar desconformidades:", error);
        mostrarMensagem("Erro ao processar verificação.", "error");
    }
}

async function abrirModalCorrecaoSetor(funcId, empresaId, nomeFunc, setorAtual) {
    // Fecha o modal de relatório se estiver aberto (assumindo que é um modal genérico do Bootstrap)
    const modalGenerico = document.getElementById('modalGenerico');
    if (modalGenerico) {
        const modalInstance = bootstrap.Modal.getInstance(modalGenerico);
        if (modalInstance) modalInstance.hide();
    }

    const modalId = 'correcaoSetorModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="fas fa-tools me-2"></i>Corrigir Setor</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-correcao-setor">
                            <input type="hidden" id="correcao-func-id">
                            <div class="mb-3">
                                <label class="form-label text-muted">Colaborador</label>
                                <input type="text" class="form-control" id="correcao-func-nome" readonly disabled>
                            </div>
                            <div class="mb-3">
                                <label class="form-label text-muted">Setor Atual (Inválido)</label>
                                <input type="text" class="form-control is-invalid" id="correcao-setor-atual" readonly disabled>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Novo Setor (Válido)</label>
                                <select class="form-select" id="correcao-novo-setor" required>
                                    <option value="">Carregando setores...</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="salvarCorrecaoSetor()">Salvar Correção</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    document.getElementById('correcao-func-id').value = funcId;
    document.getElementById('correcao-func-nome').value = nomeFunc;
    document.getElementById('correcao-setor-atual').value = setorAtual;

    const select = document.getElementById('correcao-novo-setor');
    select.innerHTML = '<option value="">Selecione o setor correto...</option>';

    if (empresaId) {
        // Removido orderBy('descricao') da query para evitar erro de índice composto. Ordenação feita em memória.
        const setoresSnap = await db.collection('setores').where('empresaId', '==', empresaId).get();
        const setores = setoresSnap.docs.map(doc => doc.data());
        
        setores.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

        setores.forEach(s => {
            select.innerHTML += `<option value="${s.descricao}">${s.descricao}</option>`;
        });
    } else {
        select.innerHTML = '<option value="">Empresa não definida no cadastro</option>';
    }

    new bootstrap.Modal(modalEl).show();
}

async function salvarCorrecaoSetor() {
    const funcId = document.getElementById('correcao-func-id').value;
    const novoSetor = document.getElementById('correcao-novo-setor').value;

    if (!novoSetor) {
        mostrarMensagem("Selecione um setor válido.", "warning");
        return;
    }

    await db.collection('funcionarios').doc(funcId).update({ setor: novoSetor });
    mostrarMensagem("Setor corrigido com sucesso!", "success");
    
    bootstrap.Modal.getInstance(document.getElementById('correcaoSetorModal')).hide();
    
    // Reabre o relatório para continuar as correções
    setTimeout(verificarDesconformidadeSetores, 500);
}

window.verificarDesconformidadeSetores = verificarDesconformidadeSetores;