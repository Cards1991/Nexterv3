// ==========================================
// CORREÇÕES E MELHORIAS PERSONALIZADAS
// ==========================================

// 1. Relatório Estilizado e Correção de Data (Avaliação de Experiência)
window.imprimirAvaliacaoExperiencia = function(dados) {
    console.log("Gerando relatório estilizado...", dados);

    // Correção do erro de data (trata Timestamp do Firestore ou String)
    let dataAval = dados.dataAvaliacao;
    if (dataAval && typeof dataAval.toDate === 'function') {
        dataAval = dataAval.toDate(); 
    } else if (typeof dataAval === 'string') {
        dataAval = new Date(dataAval);
    }
    
    const dataFormatada = (dataAval instanceof Date && !isNaN(dataAval)) 
        ? dataAval.toLocaleDateString('pt-BR') 
        : 'Data não informada';

    // HTML do Relatório Estilizado
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Avaliação de Experiência - ${dados.nome || 'Colaborador'}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print { body { -webkit-print-color-adjust: exact; } }
                body { background-color: #f3f4f6; font-family: 'Segoe UI', sans-serif; padding: 40px; }
                .report-card { background: white; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; max-width: 850px; margin: 0 auto; }
                .report-header { background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%); color: white; padding: 30px; text-align: center; }
                .report-body { padding: 40px; }
                .info-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 30px; border-left: 5px solid #0d6efd; }
                .score-table th { background-color: #e9ecef; color: #495057; }
                .score-badge { width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; color: white; }
                .score-1, .score-2 { background-color: #dc3545; }
                .score-3 { background-color: #ffc107; color: #333; }
                .score-4, .score-5 { background-color: #198754; }
                .result-box { text-align: center; padding: 20px; border-radius: 10px; margin-top: 30px; }
                .result-approved { background-color: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; }
                .result-reprooved { background-color: #f8d7da; color: #842029; border: 1px solid #f5c2c7; }
                .signature-area { margin-top: 60px; border-top: 1px solid #dee2e6; padding-top: 10px; display: flex; justify-content: space-between; }
                .sig-line { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 10px; margin-top: 40px; }
            </style>
        </head>
        <body>
            <div class="report-card">
                <div class="report-header">
                    <h2 class="mb-0">Avaliação de Experiência</h2>
                    <p class="mb-0 opacity-75">Relatório de Desempenho Individual</p>
                </div>
                <div class="report-body">
                    <div class="info-box">
                        <div class="row">
                            <div class="col-md-6 mb-2"><strong>Colaborador:</strong> ${dados.nome || '-'}</div>
                            <div class="col-md-6 mb-2"><strong>Data:</strong> ${dataFormatada}</div>
                            <div class="col-md-6"><strong>Período:</strong> ${dados.periodo || '-'} dias</div>
                            <div class="col-md-6"><strong>Avaliador:</strong> ${dados.avaliador || 'Gestão'}</div>
                        </div>
                    </div>

                    <h5 class="mb-3 text-primary">Critérios Avaliados</h5>
                    <table class="table table-hover score-table">
                        <thead>
                            <tr>
                                <th>Critério</th>
                                <th class="text-center" width="100">Nota</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(dados.notas || {}).map(([k, v]) => `
                                <tr>
                                    <td style="text-transform: capitalize;">${k}</td>
                                    <td class="text-center"><span class="score-badge score-${v}">${v}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="mt-4">
                        <h6 class="text-muted">Observações</h6>
                        <p class="p-3 bg-light rounded border">${dados.observacoes || 'Sem observações.'}</p>
                    </div>

                    <div class="result-box ${dados.resultado === 'Aprovado' ? 'result-approved' : 'result-reprooved'}">
                        <h3 class="mb-0">${dados.resultado || 'Pendente'}</h3>
                        <small>Média Final: <strong>${dados.media ? dados.media.toFixed(1) : '-'}</strong></small>
                    </div>

                    <div class="signature-area">
                        <div class="sig-line">Colaborador</div>
                        <div class="sig-line">Gestor Responsável</div>
                    </div>
                </div>
            </div>
            <script>
                setTimeout(() => window.print(), 500);
            </script>
        </body>
        </html>
    `;

    const win = window.open('', '_blank', 'width=900,height=900');
    win.document.write(htmlContent);
    win.document.close();
};

// 2. Filtro de Vencidos (Remove avaliações passadas da lista)
function filtrarVencidosExperiencia() {
    const tbody = document.getElementById('lista-pendencias-experiencia');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Normaliza para comparar apenas a data

    rows.forEach(row => {
        // Assume que a coluna Vencimento é a 4ª (índice 3)
        const cellVencimento = row.cells[3];
        if (cellVencimento) {
            const dataTexto = cellVencimento.textContent.trim();
            // Parse DD/MM/AAAA
            const parts = dataTexto.split('/');
            if (parts.length === 3) {
                const dataVenc = new Date(parts[2], parts[1] - 1, parts[0]);
                if (dataVenc < hoje) {
                    row.style.display = 'none'; // Oculta se já venceu
                }
            }
        }
    });
}

// Observa mudanças na tabela para reaplicar o filtro quando os dados carregarem
document.addEventListener('DOMContentLoaded', () => {
    const targetNode = document.getElementById('lista-pendencias-experiencia');
    if (targetNode) {
        const observer = new MutationObserver(filtrarVencidosExperiencia);
        observer.observe(targetNode, { childList: true, subtree: true });
    }
});

// 3. People Analytics - Filtro de Amostra por Setor
document.addEventListener('DOMContentLoaded', () => {
    const btnGerar = document.getElementById('btn-gerar-amostra');
    
    if (btnGerar) {
        // Clona o botão para remover listeners antigos e garantir nossa lógica
        const newBtn = btnGerar.cloneNode(true);
        btnGerar.parentNode.replaceChild(newBtn, btnGerar);

        newBtn.addEventListener('click', async () => {
            const container = document.getElementById('avaliacao-container');
            container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2">Gerando amostra filtrada...</p></div>';

            try {
                // Verifica restrição de setor do usuário logado
                const userSetor = window.currentUserPermissions?.restricaoSetor;
                
                let query = db.collection('funcionarios').where('status', '==', 'Ativo');
                
                if (userSetor) {
                    console.log(`Filtrando amostra para o setor: ${userSetor}`);
                    query = query.where('setor', '==', userSetor);
                } else {
                    console.log('Gerando amostra global (sem restrição de setor)');
                }

                const snapshot = await query.get();
                const funcionarios = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    funcionarios.push({ id: doc.id, ...data });
                });

                if (funcionarios.length === 0) {
                    container.innerHTML = '<div class="alert alert-warning text-center">Nenhum colaborador encontrado para o seu setor.</div>';
                    return;
                }

                // Lógica de Amostragem (Ex: 20% ou mínimo de 3)
                const sampleSize = Math.max(3, Math.ceil(funcionarios.length * 0.2));
                const shuffled = funcionarios.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, sampleSize);

                // Renderiza a lista
                let html = '<div class="list-group">';
                selected.forEach(f => {
                    // Verifica se a função original existe, senão alerta
                    const onClickAction = typeof iniciarAvaliacaoColaborador === 'function' 
                        ? `iniciarAvaliacaoColaborador('${f.id}', '${f.nome.replace(/'/g, "\\'")}')`
                        : `alert('Função de avaliação não encontrada. Contate o suporte.')`;

                    html += `
                        <div class="list-group-item d-flex justify-content-between align-items-center p-3">
                            <div class="d-flex align-items-center">
                                <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-3" style="width:40px; height:40px;">
                                    <i class="fas fa-user text-secondary"></i>
                                </div>
                                <div>
                                    <h6 class="mb-0 fw-bold">${f.nome}</h6>
                                    <small class="text-muted">${f.setor || 'Sem setor'} &bull; ${f.cargo || 'Sem cargo'}</small>
                                </div>
                            </div>
                            <button class="btn btn-outline-primary btn-sm" onclick="${onClickAction}">
                                <i class="fas fa-star me-1"></i> Avaliar
                            </button>
                        </div>
                    `;
                });
                html += '</div>';

                container.innerHTML = html;
                
                // Atualiza rodapé se existir
                const totalEl = document.getElementById('total-amostra');
                if(totalEl) totalEl.textContent = selected.length;
                
                const preenchidasEl = document.getElementById('total-preenchidas');
                if(preenchidasEl) preenchidasEl.textContent = '0';

                const footer = document.getElementById('avaliacao-resumo-footer');
                if(footer) footer.style.display = 'block';

            } catch (error) {
                console.error("Erro ao gerar amostra:", error);
                container.innerHTML = `<div class="alert alert-danger">Erro ao gerar amostra: ${error.message}</div>`;
            }
        });
    }
});

// 4. Correção de Erro em iso-manutencao.js (ReferenceError: textoOriginal)
// Define um valor global de fallback para evitar que o sistema trave ao tentar restaurar o botão
if (typeof window.textoOriginal === 'undefined') {
    window.textoOriginal = 'Salvar';
}

// 5. Dashboard de Faltas - Indicador de Experiência
async function carregarFaltasExperiencia() {
    const container = document.getElementById('ranking-faltas-experiencia');
    if (!container) return;

    container.innerHTML = '<div class="list-group-item text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando dados de experiência...</div>';

    try {
        // 1. Definir período de experiência (90 dias atrás até hoje)
        const hoje = new Date();
        const dataCorteExperiencia = new Date();
        dataCorteExperiencia.setDate(hoje.getDate() - 90);

        // 2. Buscar funcionários admitidos após a data de corte (estão em experiência)
        const funcionariosSnap = await db.collection('funcionarios')
            .where('status', '==', 'Ativo')
            .get();

        const mapFuncExperiencia = new Map(); // ID -> Dados
        
        funcionariosSnap.forEach(doc => {
            const f = doc.data();

            // Filtra colaboradores que já possuem rescisão (mesmo que status esteja Ativo por erro)
            if (f.dataDemissao || f.dataDesligamento) return;

            // Tenta obter a data de admissão de vários formatos possíveis
            let dataAdmissao = null;
            if (f.admissao) {
                if (f.admissao.toDate) dataAdmissao = f.admissao.toDate();
                else if (typeof f.admissao === 'string') dataAdmissao = new Date(f.admissao);
            } else if (f.dataAdmissao) {
                if (f.dataAdmissao.toDate) dataAdmissao = f.dataAdmissao.toDate();
                else if (typeof f.dataAdmissao === 'string') dataAdmissao = new Date(f.dataAdmissao);
            }

            if (dataAdmissao && dataAdmissao >= dataCorteExperiencia) {
                mapFuncExperiencia.set(doc.id, {
                    nome: f.nome,
                    setor: f.setor,
                    admissao: dataAdmissao,
                    faltas: 0,
                    diasFaltas: new Set() // Para controlar dias únicos e evitar duplicidade manhã/tarde
                });
            }
        });

        if (mapFuncExperiencia.size === 0) {
            container.innerHTML = '<div class="list-group-item text-center text-muted">Nenhum colaborador em período de experiência encontrado.</div>';
            return;
        }

        // 3. Buscar faltas no período selecionado no filtro do dashboard
        const inicioInput = document.getElementById('dash-faltas-data-inicio');
        const fimInput = document.getElementById('dash-faltas-data-fim');
        
        let dataInicioFiltro = new Date();
        dataInicioFiltro.setDate(1); // Início do mês atual padrão
        let dataFimFiltro = new Date();

        if (inicioInput && inicioInput.value) dataInicioFiltro = new Date(inicioInput.value);
        if (fimInput && fimInput.value) dataFimFiltro = new Date(fimInput.value);
        
        // Ajuste horas
        dataInicioFiltro.setHours(0,0,0,0);
        dataFimFiltro.setHours(23,59,59,999);

        const faltasSnap = await db.collection('faltas')
            .where('data', '>=', firebase.firestore.Timestamp.fromDate(dataInicioFiltro))
            .where('data', '<=', firebase.firestore.Timestamp.fromDate(dataFimFiltro))
            .get();

        // 4. Contabilizar faltas apenas para quem está em experiência
        faltasSnap.forEach(doc => {
            const falta = doc.data();
            const funcId = falta.funcionarioId || falta.funcionario; 
            
            if (funcId && mapFuncExperiencia.has(funcId)) {
                const dados = mapFuncExperiencia.get(funcId);
                
                // Contagem deduplicada por funcionário + dia
                if (falta.data) {
                    const d = falta.data.toDate ? falta.data.toDate() : new Date(falta.data);
                    const dataKey = `${funcId}_${d.toDateString()}`;
                    if (!dados.diasFaltas.has(dataKey)) {
                        dados.diasFaltas.add(dataKey);
                    }
                }
            }
        });

        // Atualizar contagem baseada em dias únicos
        for (const dados of mapFuncExperiencia.values()) {
            dados.faltas = dados.diasFaltas.size;
        }

        // 5. Ordenar e Renderizar
        const ranking = Array.from(mapFuncExperiencia.values())
            .filter(f => f.faltas > 0)
            .sort((a, b) => b.faltas - a.faltas)
            .slice(0, 10); // Limita aos 10 primeiros

        if (ranking.length === 0) {
            container.innerHTML = '<div class="list-group-item text-center text-muted">Nenhuma falta registrada para colaboradores em experiência neste período.</div>';
            return;
        }

        let html = '';
        ranking.forEach(item => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${item.nome}</div>
                        <small class="text-muted">
                            <i class="fas fa-sitemap me-1"></i>${item.setor || 'N/A'} &bull; 
                            Adm: ${item.admissao.toLocaleDateString('pt-BR')}
                        </small>
                    </div>
                    <span class="badge bg-danger rounded-pill">${item.faltas} falta(s)</span>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar indicador de experiência:", error);
        container.innerHTML = `<div class="list-group-item text-danger">Erro: ${error.message}</div>`;
    }
}

// Listener para o botão de filtro do dashboard de faltas
document.addEventListener('DOMContentLoaded', () => {
    const btnFiltrar = document.getElementById('btn-filtrar-dashboard-faltas');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => {
            setTimeout(carregarFaltasExperiencia, 500);
        });
    }
});

// 6. Correção do Filtro de Subdivisão (Painel Financeiro)
document.addEventListener('DOMContentLoaded', () => {
    const origemSelect = document.getElementById('fin-filtro-origem');
    const subdivisaoSelect = document.getElementById('fin-filtro-subdivisao');

    if (origemSelect && subdivisaoSelect) {
        // Mapeamento de Origem -> Subdivisões
        const subdivisoesPorOrigem = {
            'FOPAG': [
                'Salário Mensal',
                'Adiantamento Salarial',
                '13º Salário',
                'Férias',
                'Rescisão',
                'Pró-labore'
            ],
            'IMPOSTOS': [
                'FGTS',
                'Multa de 40% (FGTS)',
                'INSS',
                'IRRF',
                'DARF',
                'Contribuição Sindical'
            ],
            'DESPESAS COM M.O.': [
                'Vale Transporte',
                'Vale Alimentação/Refeição',
                'Plano de Saúde',
                'Seguro de Vida',
                'Exames Ocupacionais',
                'EPIs',
                'Uniformes'
            ]
        };

        // Função para atualizar as opções de subdivisão
        function atualizarSubdivisoes() {
            const origemSelecionada = origemSelect.value;
            
            // Limpa as opções atuais (mantendo a primeira "Todas")
            subdivisaoSelect.innerHTML = '<option value="">Todas</option>';

            if (origemSelecionada && subdivisoesPorOrigem[origemSelecionada]) {
                const opcoes = subdivisoesPorOrigem[origemSelecionada];
                opcoes.forEach(opcao => {
                    const option = document.createElement('option');
                    option.value = opcao;
                    option.textContent = opcao;
                    subdivisaoSelect.appendChild(option);
                });
            }
        }

        // Adiciona o listener para atualizar quando a origem mudar
        origemSelect.addEventListener('change', atualizarSubdivisoes);
        
        // Inicializa o filtro (caso a página recarregue com valor selecionado)
        atualizarSubdivisoes();
    }
});

// 7. Eliminar Tabela de Registro de Ponto Importado (Garantia Visual)
document.addEventListener('DOMContentLoaded', () => {
    // Monitora a inserção da tabela para ocultá-la imediatamente
    const observer = new MutationObserver(() => {
        const tbody = document.getElementById('tabela-ponto-eletronico-body');
        const container = tbody ? (tbody.closest('.card') || tbody.closest('table')) : null;
        if (container) container.style.display = 'none';

        const tbodyResumo = document.getElementById('tabela-resumo-colaborador-body');
        const containerResumo = tbodyResumo ? (tbodyResumo.closest('.card') || tbodyResumo.closest('table')) : null;
        if (containerResumo) containerResumo.style.display = 'none';
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

// 8. Patch para Setores - Horário de Entrada
// Redefine funções para suportar o novo campo de horário de entrada
document.addEventListener('DOMContentLoaded', () => {
    window.abrirModalSetor = async function(id = null) {
        const modalEl = document.getElementById('setorModal');
        if (!modalEl) return;
        
        // Injeta o campo de horário se não existir no formulário
        if (!document.getElementById('setor-horario-entrada')) {
            const qtdIdealInput = document.getElementById('setor-qtd-ideal');
            const formSetor = document.getElementById('form-setor');
            const newField = document.createElement('div');
            newField.className = 'mb-3';
            newField.innerHTML = `<label class="form-label">Horário de Entrada</label><input type="time" class="form-control" id="setor-horario-entrada">`;

            if (qtdIdealInput && qtdIdealInput.closest('.mb-3')) {
                qtdIdealInput.closest('.mb-3').after(newField);
            } else if (formSetor) {
                formSetor.appendChild(newField);
            }
        }
        
        const form = document.getElementById('form-setor');
        form.reset();
        document.getElementById('setor-id').value = id || '';
        document.querySelector('#setorModal .modal-title').textContent = id ? 'Editar Setor' : 'Novo Setor';
        
        // Popular selects
        if (typeof carregarSelectEmpresas === 'function') await carregarSelectEmpresas('setor-empresa');
        
        // Carregar gerentes (funcionários)
        const gerenteSelect = document.getElementById('setor-gerente');
        if (gerenteSelect) {
             gerenteSelect.innerHTML = '<option value="">Selecione...</option>';
             const funcSnap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
             funcSnap.forEach(doc => {
                 const f = doc.data();
                 gerenteSelect.innerHTML += `<option value="${f.nome}">${f.nome}</option>`;
             });
        }

        if (id) {
            const doc = await db.collection('setores').doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('setor-empresa').value = data.empresaId;
                document.getElementById('setor-descricao').value = data.descricao;
                document.getElementById('setor-gerente').value = data.gerenteResponsavel || '';
                document.getElementById('setor-qtd-ideal').value = data.qtdIdeal || '';
                document.getElementById('setor-observacao').value = data.observacoes || '';
                const horarioEl = document.getElementById('setor-horario-entrada');
                if (horarioEl) horarioEl.value = data.horarioEntrada || '';
            }
        }
        
        new bootstrap.Modal(modalEl).show();
    };

    window.salvarSetor = async function() {
        const idEl = document.getElementById('setor-id');
        const empresaEl = document.getElementById('setor-empresa');
        const descricaoEl = document.getElementById('setor-descricao');
        const gerenteEl = document.getElementById('setor-gerente');
        const qtdIdealEl = document.getElementById('setor-qtd-ideal');
        const observacaoEl = document.getElementById('setor-observacao');
        const horarioEl = document.getElementById('setor-horario-entrada');

        if (!empresaEl || !descricaoEl) { console.error("Elementos do formulário de setor não encontrados."); return; }

        const id = idEl ? idEl.value : '';

        const dados = {
            empresaId: empresaEl.value,
            descricao: descricaoEl.value.trim(),
            gerenteResponsavel: gerenteEl ? gerenteEl.value : '',
            qtdIdeal: qtdIdealEl ? (parseInt(qtdIdealEl.value) || 0) : 0,
            observacao: observacaoEl ? observacaoEl.value : '',
            horarioEntrada: horarioEl ? horarioEl.value : '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!dados.empresaId || !dados.descricao) { alert("Preencha os campos obrigatórios."); return; }

        if (id) await db.collection('setores').doc(id).update(dados);
        else { dados.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('setores').add(dados); }
        
        bootstrap.Modal.getInstance(document.getElementById('setorModal')).hide();
        // Tenta recarregar a tabela se a função original estiver disponível, senão recarrega a página
        if (typeof carregarSetores === 'function') carregarSetores(); else location.reload();
    };
});

// 9. Fix para Modal de Afastamentos
document.addEventListener('click', function(e) {
    if (e.target && (e.target.id === 'btn-novo-afastamento' || e.target.closest('#btn-novo-afastamento'))) {
        const modalEl = document.getElementById('modalNovoAfastamento');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
            
            // Carregar colaboradores se o select estiver vazio
            const select = document.getElementById('afastamento-colaborador');
            if (select && select.options.length <= 1) {
                select.innerHTML = '<option value="">Carregando...</option>';
                db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get().then(snap => {
                    select.innerHTML = '<option value="">Selecione...</option>';
                    snap.forEach(doc => {
                        const f = doc.data();
                        select.innerHTML += `<option value="${doc.id}">${f.nome}</option>`;
                    });
                }).catch(err => {
                    console.error("Erro ao carregar colaboradores:", err);
                });
            }
        }
    }
});