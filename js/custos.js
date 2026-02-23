// js/custos.js

let custosCharts = {}; // Para armazenar instâncias de gráficos

// Verificar se a função abrirModalLancamentoFinanceiro existe
if (typeof abrirModalLancamentoFinanceiro !== 'function') {
    console.warn('Função abrirModalLancamentoFinanceiro não encontrada. Criando fallback.');
    window.abrirModalLancamentoFinanceiro = function(id) {
        alert('Função de edição em desenvolvimento. ID: ' + id);
        // Redirecionar para a seção financeiro como fallback
        if (typeof showSection === 'function') {
            showSection('financeiro');
        }
    };
}

async function inicializarAnaliseCustos() {
    console.log('Inicializando seção de Análise de Custos.');
    
    try {
        // Limpar gráficos anteriores de forma segura
        Object.values(custosCharts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                } catch (e) { console.warn('Erro ao destruir gráfico:', e); }
            }
        });
        custosCharts = {};

        // Configurar filtros de data para o mês atual
        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

        const filtroInicio = document.getElementById('custos-filtro-inicio');
        const filtroFim = document.getElementById('custos-filtro-fim');
        
        if (filtroInicio) filtroInicio.value = primeiroDiaMes;
        if (filtroFim) filtroFim.value = ultimoDiaMes;

        // Popular filtros de empresa e setor
        await preencherFiltrosCustos();

        // Configurar eventos dos filtros
        configurarEventosFiltros();

        // Carregar dados iniciais
        await carregarDadosAnaliseCustos();
        
    } catch (error) {
        console.error('Erro na inicialização da análise de custos:', error);
        mostrarMensagem('Erro ao inicializar análise de custos: ' + error.message, 'error');
    }
}

function configurarEventosFiltros() {
    // Formulário de filtros
    const formFiltro = document.getElementById('custos-filter-form');
    if (formFiltro) {
        // Remover eventos antigos clonando e substituindo
        const novoForm = formFiltro.cloneNode(true);
        formFiltro.parentNode.replaceChild(novoForm, formFiltro);
        
        novoForm.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            carregarDadosAnaliseCustos(); 
        });
    }

    // Botão de aplicar filtros (caso exista separado)
    const btnAplicar = document.getElementById('btn-custos-aplicar-filtros');
    if (btnAplicar) {
        btnAplicar.removeEventListener('click', carregarDadosAnaliseCustos);
        btnAplicar.addEventListener('click', carregarDadosAnaliseCustos);
    }

    // Checkbox "Selecionar Todos" no cabeçalho
    const selectAllHeader = document.getElementById('custos-select-all-header');
    if (selectAllHeader) {
        selectAllHeader.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#tabela-custos-detalhes .form-check-input');
            checkboxes.forEach(cb => cb.checked = this.checked);
        });
    }

    // Botão "Selecionar Todos"
    const selectAllBtn = document.getElementById('custos-select-all');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            const checkboxes = document.querySelectorAll('#tabela-custos-detalhes .form-check-input');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
        });
    }

    // Botão Imprimir
    const printBtn = document.getElementById('custos-print-button');
    if (printBtn) {
        printBtn.addEventListener('click', imprimirSelecionadosCustos);
    }

    // Botão Exportar
    const exportBtn = document.getElementById('custos-export-button');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportarSelecionadosExcel);
    }
}

async function preencherFiltrosCustos() {
    const empresaSelect = document.getElementById('custos-filtro-empresa');
    const setorSelect = document.getElementById('custos-filtro-setor');
    const processoSelect = document.getElementById('custos-filtro-processo');

    // Popular Empresas
    if (empresaSelect) {
        empresaSelect.innerHTML = '<option value="">Todas as Empresas</option>';
        try {
            const empresasSnap = await db.collection('empresas').orderBy('nome').get();
            empresasSnap.forEach(doc => {
                empresaSelect.innerHTML += `<option value="${doc.id}">${doc.data().nome || 'Empresa sem nome'}</option>`;
            });
        } catch (error) {
            console.error("Erro ao carregar empresas:", error);
            empresaSelect.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    }

    // Popular Setores
    if (setorSelect) {
        setorSelect.innerHTML = '<option value="">Todos os Setores</option>';
        try {
            const setoresSnap = await db.collection('setores').get();
            const setoresSet = new Set();
            setoresSnap.forEach(doc => {
                const setor = doc.data().descricao || doc.data().nome;
                if (setor) setoresSet.add(setor);
            });
            [...setoresSet].sort().forEach(s => setorSelect.innerHTML += `<option value="${s}">${s}</option>`);
        } catch (error) {
            console.error("Erro ao carregar setores:", error);
        }
    }

    // Popular Processos (subdivisões)
    if (processoSelect) {
        processoSelect.innerHTML = '<option value="">Todos os Processos</option>';
        try {
            const lancamentosSnap = await db.collection('lancamentos_financeiros')
                .select('subdivisao')
                .limit(100)
                .get();
            
            const processosSet = new Set();
            lancamentosSnap.forEach(doc => {
                const subdivisao = doc.data().subdivisao;
                if (subdivisao) processosSet.add(subdivisao);
            });
            
            [...processosSet].sort().forEach(p => processoSelect.innerHTML += `<option value="${p}">${p}</option>`);
        } catch (error) {
            console.error("Erro ao carregar processos:", error);
        }
    }
}

function formatarDataSegura(data) {
    if (!data) return '-';
    
    try {
        // Firestore Timestamp
        if (data && typeof data.toDate === 'function') {
            return data.toDate().toLocaleDateString('pt-BR');
        }
        // Date object
        if (data instanceof Date) {
            return data.toLocaleDateString('pt-BR');
        }
        // String ISO
        if (typeof data === 'string') {
            return new Date(data).toLocaleDateString('pt-BR');
        }
        // Timestamp com seconds
        if (data && typeof data.seconds === 'number') {
            return new Date(data.seconds * 1000).toLocaleDateString('pt-BR');
        }
        return '-';
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return '-';
    }
}

async function carregarDadosAnaliseCustos() {
    const tbody = document.getElementById('tabela-custos-detalhes');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="12" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando dados...</td></tr>';

    try {
        const filtroInicio = document.getElementById('custos-filtro-inicio')?.value;
        const filtroFim = document.getElementById('custos-filtro-fim')?.value;
        const filtroEmpresa = document.getElementById('custos-filtro-empresa')?.value;
        const filtroSetor = document.getElementById('custos-filtro-setor')?.value;
        const filtroProcesso = document.getElementById('custos-filtro-processo')?.value;

        let custosQuery = db.collection('lancamentos_financeiros');

        // Aplicar filtros de data
        if (filtroInicio) {
            const dataInicio = new Date(filtroInicio);
            dataInicio.setHours(0, 0, 0, 0);
            custosQuery = custosQuery.where('dataVencimento', '>=', dataInicio);
        }
        
        if (filtroFim) {
            const dataFim = new Date(filtroFim);
            dataFim.setHours(23, 59, 59, 999);
            custosQuery = custosQuery.where('dataVencimento', '<=', dataFim);
        }
        
        if (filtroEmpresa) {
            custosQuery = custosQuery.where('empresaId', '==', filtroEmpresa);
        }
        
        if (filtroSetor) {
            custosQuery = custosQuery.where('setor', '==', filtroSetor);
        }
        
        if (filtroProcesso) {
            custosQuery = custosQuery.where('subdivisao', '==', filtroProcesso);
        }

        // Ordenar por data
        custosQuery = custosQuery.orderBy('dataVencimento', 'desc');

        const custosSnap = await custosQuery.get();
        
        const lancamentos = custosSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                valor: parseFloat(data.valor) || 0,
                juros: parseFloat(data.juros) || 0
            };
        });

        renderizarKPIsCustos(lancamentos);
        await renderizarTabelaCustos(lancamentos);
        renderizarGraficosCustos(lancamentos);

    } catch (error) {
        console.error("Erro ao carregar dados de análise de custos:", error);
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger">Erro ao carregar dados: ' + error.message + '</td></tr>';
        mostrarMensagem("Erro ao carregar análise de custos. Verifique os índices do Firestore.", "error");
    }
}

function renderizarKPIsCustos(lancamentos) {
    const totalPagar = lancamentos.reduce((acc, l) => acc + (l.valor || 0), 0);
    const totalJuros = lancamentos.reduce((acc, l) => acc + (l.juros || 0), 0);
    const despesasRH = lancamentos
        .filter(l => l.origem === 'FOPAG' || l.origem === 'DESPESAS COM M.O.')
        .reduce((acc, l) => acc + (l.valor || 0), 0);
    
    const projecao = totalPagar * 1.05;
    const valores = lancamentos.map(l => l.valor || 0);
    const media = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    
    let desvioPadrao = 0;
    if (valores.length > 1) {
        const quadradoDiferencas = valores.map(x => Math.pow(x - media, 2));
        const somaQuadrados = quadradoDiferencas.reduce((a, b) => a + b, 0);
        desvioPadrao = Math.sqrt(somaQuadrados / (valores.length - 1));
    }

    const elementos = {
        'custos-kpi-total-pagar': totalPagar,
        'custos-kpi-total-juros': totalJuros,
        'custos-kpi-despesas-rh': despesasRH,
        'custos-kpi-projecao': projecao,
        'custos-kpi-desvio-padrao': desvioPadrao,
        'custos-kpi-media-mensal': media
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = `R$ ${valor.toFixed(2).replace('.', ',')}`;
        }
    });
}

async function renderizarTabelaCustos(lancamentos) {
    const tbody = document.getElementById('tabela-custos-detalhes');
    if (!tbody) return;

    if (lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhum lançamento encontrado com os filtros aplicados.</td></tr>';
        return;
    }

    // Buscar empresas
    const empresasMap = {};
    try {
        const empresasSnap = await db.collection('empresas').get();
        empresasSnap.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome || 'Empresa sem nome';
        });
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }

    tbody.innerHTML = lancamentos.map(l => {
        const valorTotal = (l.valor || 0) + (l.juros || 0);
        const statusClass = l.status === 'Pago' ? 'bg-success' : 
                           l.status === 'Pendente' ? 'bg-warning' : 
                           'bg-secondary';
        const dataVencimento = l.dataVencimento ? formatarDataSegura(l.dataVencimento) : '-';
        
        return `
        <tr>
            <td class="text-center">
                <input type="checkbox" class="form-check-input" value="${l.id}">
            </td>
            <td>
                <span class="badge ${statusClass}">${l.status || 'Pendente'}</span>
            </td>
            <td>${l.origem || '-'}</td>
            <td>${l.subdivisao || '-'}</td>
            <td>${l.motivo || l.observacao || '-'}</td>
            <td class="text-end">R$ ${(l.valor || 0).toFixed(2).replace('.', ',')}</td>
            <td class="text-end">R$ ${(l.juros || 0).toFixed(2).replace('.', ',')}</td>
            <td class="text-end fw-bold">R$ ${valorTotal.toFixed(2).replace('.', ',')}</td>
            <td>${dataVencimento}</td>
            <td>${empresasMap[l.empresaId] || 'N/A'}</td>
            <td>${l.setor || 'N/A'}</td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="editarLancamentoCusto('${l.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="excluirLancamentoCusto('${l.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function renderizarGraficosCustos(lancamentos) {
    try {
        // Gráfico de Barras por Processo
        const custosPorProcesso = lancamentos.reduce((acc, l) => {
            const processo = l.subdivisao || 'Não Classificado';
            acc[processo] = (acc[processo] || 0) + (l.valor || 0);
            return acc;
        }, {});
        
        if (Object.keys(custosPorProcesso).length > 0) {
            renderizarGraficoCustos('custos-processo-bar-chart', 'bar', 'Custos por Processo', custosPorProcesso);
        }

        // Gráfico de Linha de Evolução
        const custosPorDia = lancamentos.reduce((acc, l) => {
            if (l.dataVencimento) {
                try {
                    const dataStr = formatarDataSegura(l.dataVencimento).split('/').reverse().join('-');
                    acc[dataStr] = (acc[dataStr] || 0) + (l.valor || 0);
                } catch (e) {
                    console.warn('Erro ao processar data para gráfico:', e);
                }
            }
            return acc;
        }, {});
        
        // Ordenar por data
        const datasOrdenadas = Object.keys(custosPorDia).sort();
        const dadosOrdenados = {};
        datasOrdenadas.forEach(data => {
            dadosOrdenados[data] = custosPorDia[data];
        });
        
        if (Object.keys(dadosOrdenados).length > 0) {
            renderizarGraficoCustos('custos-evolucao-chart', 'line', 'Evolução de Custos no Período', dadosOrdenados);
        }

        renderizarGraficoComparativoMensal();
        
    } catch (error) {
        console.error("Erro ao renderizar gráficos:", error);
    }
}

async function renderizarGraficoComparativoMensal() {
    const canvas = document.getElementById('custos-comparativo-mensal-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hoje = new Date();
    const labels = [];
    const dataAnoAtual = [];
    const dataAnoAnterior = [];

    try {
        for (let i = 0; i < 12; i++) {
            const mes = i;
            labels.push(new Date(hoje.getFullYear(), mes, 1).toLocaleString('pt-BR', { month: 'short' }));

            const inicioMesAtual = new Date(hoje.getFullYear(), mes, 1);
            const fimMesAtual = new Date(hoje.getFullYear(), mes + 1, 0, 23, 59, 59);
            const inicioMesAnterior = new Date(hoje.getFullYear() - 1, mes, 1);
            const fimMesAnterior = new Date(hoje.getFullYear() - 1, mes + 1, 0, 23, 59, 59);

            const snapAtual = await db.collection('lancamentos_financeiros')
                .where('dataVencimento', '>=', inicioMesAtual)
                .where('dataVencimento', '<=', fimMesAtual)
                .get();
            
            const totalAtual = snapAtual.docs.reduce((acc, doc) => {
                return acc + (parseFloat(doc.data().valor) || 0);
            }, 0);
            dataAnoAtual.push(totalAtual);

            const snapAnterior = await db.collection('lancamentos_financeiros')
                .where('dataVencimento', '>=', inicioMesAnterior)
                .where('dataVencimento', '<=', fimMesAnterior)
                .get();
            
            const totalAnterior = snapAnterior.docs.reduce((acc, doc) => {
                return acc + (parseFloat(doc.data().valor) || 0);
            }, 0);
            dataAnoAnterior.push(totalAnterior);
        }

        if (custosCharts['custos-comparativo-mensal-chart']) {
            custosCharts['custos-comparativo-mensal-chart'].destroy();
        }

        custosCharts['custos-comparativo-mensal-chart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `${hoje.getFullYear() - 1}`,
                        data: dataAnoAnterior,
                        backgroundColor: 'rgba(173, 181, 189, 0.7)',
                        borderColor: 'rgba(173, 181, 189, 1)',
                        borderWidth: 1
                    },
                    {
                        label: `${hoje.getFullYear()}`,
                        data: dataAnoAtual,
                        backgroundColor: 'rgba(67, 97, 238, 0.7)',
                        borderColor: 'rgba(67, 97, 238, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(2);
                            }
                        }
                    } 
                }
            }
        });
    } catch (error) {
        console.error("Erro ao renderizar gráfico comparativo mensal:", error);
    }
}

function renderizarGraficoCustos(canvasId, tipo, titulo, dados) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (custosCharts[canvasId]) {
        custosCharts[canvasId].destroy();
    }

    const labels = Object.keys(dados);
    const valores = Object.values(dados);

    if (labels.length === 0) {
        return;
    }

    try {
        custosCharts[canvasId] = new Chart(ctx, {
            type: tipo,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valor (R$)',
                    data: valores,
                    backgroundColor: tipo === 'line' ? 'rgba(67, 97, 238, 0.1)' : 'rgba(67, 97, 238, 0.7)',
                    borderColor: '#4361ee',
                    borderWidth: 2,
                    fill: tipo === 'line',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: tipo !== 'bar' },
                    title: { display: true, text: titulo } 
                },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(2);
                            }
                        }
                    } 
                }
            }
        });
    } catch (error) {
        console.error(`Erro ao criar gráfico ${canvasId}:`, error);
    }
}

async function excluirLancamentoCusto(id) {
    if (!confirm("Tem certeza que deseja excluir este lançamento de custo?")) return;

    try {
        await db.collection('lancamentos_financeiros').doc(id).delete();
        mostrarMensagem("Lançamento excluído com sucesso!", "success");
        await carregarDadosAnaliseCustos();
    } catch (error) {
        console.error("Erro ao excluir lançamento:", error);
        mostrarMensagem("Erro ao excluir lançamento: " + error.message, "error");
    }
}

function editarLancamentoCusto(id) {
    // Verificar se a função original existe
    if (typeof window.abrirModalLancamentoFinanceiro === 'function') {
        window.abrirModalLancamentoFinanceiro(id);
    } else {
        console.warn('Função abrirModalLancamentoFinanceiro não disponível. Usando fallback.');
        mostrarMensagem('Redirecionando para o módulo financeiro...', 'info');
        
        // Tentar redirecionar para a seção financeiro
        if (typeof showSection === 'function') {
            showSection('financeiro');
            
            // Tentar novamente após um tempo
            setTimeout(() => {
                if (typeof window.abrirModalLancamentoFinanceiro === 'function') {
                    window.abrirModalLancamentoFinanceiro(id);
                } else {
                    alert('Para editar este lançamento, acesse o módulo Financeiro e busque pelo ID: ' + id);
                }
            }, 1000);
        } else {
            alert('ID do lançamento para edição: ' + id);
        }
    }
}

function imprimirSelecionadosCustos() {
    const checkboxes = document.querySelectorAll('#tabela-custos-detalhes .form-check-input:checked');
    if (checkboxes.length === 0) {
        mostrarMensagem('Selecione pelo menos um lançamento para imprimir.', 'warning');
        return;
    }
    
    const ids = Array.from(checkboxes).map(cb => cb.value);
    console.log('Imprimir lançamentos:', ids);
    mostrarMensagem('Funcionalidade de impressão em desenvolvimento.', 'info');
}

function exportarSelecionadosExcel() {
    const checkboxes = document.querySelectorAll('#tabela-custos-detalhes .form-check-input:checked');
    if (checkboxes.length === 0) {
        mostrarMensagem('Selecione pelo menos um lançamento para exportar.', 'warning');
        return;
    }
    
    mostrarMensagem('Funcionalidade de exportação em desenvolvimento.', 'info');
}

// Tornar funções acessíveis globalmente
window.inicializarAnaliseCustos = inicializarAnaliseCustos;
window.excluirLancamentoCusto = excluirLancamentoCusto;
window.editarLancamentoCusto = editarLancamentoCusto;