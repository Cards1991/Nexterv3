// js/setores.js

async function inicializarSetores() {
    await carregarSetores();
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