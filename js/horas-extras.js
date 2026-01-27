// Gerenciamento do Dashboard de Horas Extras

let heCharts = {}; // Armazena instâncias dos gráficos para destruí-los depois
let signaturePad = null; // Instância global do SignaturePad
let __he_filtered_data = []; // Cache dos dados filtrados para impressão
let __he_funcionarios_map = {}; // Mapa para vincular funcionário à empresa

async function inicializarHorasExtras() {
    console.log('Inicializando Dashboard de Horas Extras...');
    
    // Configurar filtros e botões
    const filterButton = document.getElementById('he-filterButton');
    const printButton = document.getElementById('he-printButton');
    const exportButton = document.getElementById('he-exportButton');

    if (filterButton && !filterButton.bound) {
        filterButton.addEventListener('click', () => listarHorasExtras());
        filterButton.bound = true;
    }
    if (printButton && !printButton.bound) {
        printButton.addEventListener('click', () => imprimirRelatorioHorasExtras());
        printButton.bound = true;
    }
    if (exportButton && !exportButton.bound) {
        exportButton.addEventListener('click', () => exportarTabelaParaExcel('he-overtimeTable', 'Relatorio_Horas_Extras.xlsx'));
        exportButton.bound = true;
    }

    await preencherFiltrosHorasExtras();
    await listarHorasExtras();
}

async function preencherFiltrosHorasExtras() {
    const sectorFilter = document.getElementById('he-sectorFilter');
    const companyFilter = document.getElementById('he-companyFilter');
    const employeeFilter = document.getElementById('he-employeeFilter');

    if (!sectorFilter) return;

    try {
        // Carregar Empresas e Setores
        const empresasSnap = await db.collection('empresas').orderBy('nome').get();
        const todosSetores = new Set();
        
        companyFilter.innerHTML = '<option value="">Todas as Empresas</option>';
        
        empresasSnap.forEach(doc => {
            const emp = doc.data();
            // Popula filtro de empresa
            companyFilter.innerHTML += `<option value="${doc.id}">${emp.nome}</option>`;
            // Coleta setores
            (emp.setores || []).forEach(setor => todosSetores.add(setor));
        });

        sectorFilter.innerHTML = '<option value="Todos">Todos os Setores</option>';
        [...todosSetores].sort().forEach(setor => {
            sectorFilter.innerHTML += `<option value="${setor}">${setor}</option>`;
        });

        // Carregar Funcionários e criar mapa de vínculo
        const funcSnap = await db.collection('funcionarios').orderBy('nome').get();
        employeeFilter.innerHTML = '<option value="">Todos os Colaboradores</option>';
        __he_funcionarios_map = {};

        funcSnap.forEach(doc => {
            const f = doc.data();
            __he_funcionarios_map[doc.id] = {
                nome: f.nome,
                empresaId: f.empresaId,
                setor: f.setor
            };
            employeeFilter.innerHTML += `<option value="${doc.id}">${f.nome}</option>`;
        });

    } catch (error) {
        console.error("Erro ao popular filtros:", error);
    }

    // Definir datas padrão (Hoje) para otimizar carregamento
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    document.getElementById('he-startDate').value = hojeStr;
    document.getElementById('he-endDate').value = hojeStr;
}

async function listarHorasExtras() {
    const tbody = document.getElementById('he-overtimeList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const startDate = document.getElementById('he-startDate').value;
    const endDate = document.getElementById('he-endDate').value;
    const sector = document.getElementById('he-sectorFilter').value;
    const companyId = document.getElementById('he-companyFilter').value;
    const employeeId = document.getElementById('he-employeeFilter').value;

    if (!startDate || !endDate) {
        mostrarMensagem("Por favor, selecione as datas inicial e final.", "warning");
        return;
    }

    let totalExtraHours = 0, totalDSRValue = 0, totalValue = 0;
    let sectorData = {}, employeeData = {}, monthlyData = {};

    try {
        // CORREÇÃO: Filtragem de setor movida para o cliente para evitar erro de índice composto no Firestore
        let query = db.collection('overtime')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);

        const querySnapshot = await query.get();
        tbody.innerHTML = ''; // Limpa a tabela para novos dados

        // Filtra os documentos em memória
        const docs = querySnapshot.docs.filter(doc => {
            const data = doc.data();
            
            // Filtro de Status: Exibir apenas horas autorizadas (ignora pendentes)
            if (data.status === 'pendente') return false;

            // Filtro de Setor
            if (sector !== "Todos" && data.sector !== sector) return false;
            
            // Filtro de Colaborador
            if (employeeId && data.employeeId !== employeeId) return false;

            // Filtro de Empresa (usando o mapa de funcionários)
            if (companyId && __he_funcionarios_map[data.employeeId]?.empresaId !== companyId) return false;

            return true;
        });

        // Salva para impressão
        __he_filtered_data = docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum registro encontrado para o período.</td></tr>';
            criarGraficosHorasExtras({}, {}, {}, 0, 0); // Limpa os gráficos
            return;
        }

        docs.forEach((doc) => {
            const overtime = doc.data();
            const extraHours = parseFloat(overtime.hours) || 0;
            const dsrValue = parseFloat(overtime.dsr) || 0;
            const overtimePay = parseFloat(overtime.overtimePay) || 0;
            const date = new Date(overtime.date + 'T00:00:00');
            const month = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

            sectorData[overtime.sector] = (sectorData[overtime.sector] || 0) + extraHours;
            employeeData[overtime.employeeName] = (employeeData[overtime.employeeName] || 0) + extraHours;
            monthlyData[month] = (monthlyData[month] || 0) + extraHours;

            totalExtraHours += extraHours;
            totalDSRValue += dsrValue;
            totalValue += overtimePay + dsrValue;

            // Lógica de Status de Assinatura
            let assinaturaHtml = '';
            let deleteButton = '';

            if (overtime.signed) {
                const dataAssinatura = overtime.signedAt ? new Date(overtime.signedAt.toDate()).toLocaleString('pt-BR') : 'Data desc.';
                assinaturaHtml = `<span class="badge bg-success" title="Assinado em ${dataAssinatura}"><i class="fas fa-file-signature"></i> Assinado</span>`;
                // Botão de excluir desabilitado para registros assinados
                deleteButton = `<button class="btn btn-sm btn-outline-secondary" disabled title="Registro assinado não pode ser excluído"><i class="fas fa-trash"></i></button>`;
            } else {
                assinaturaHtml = `<button class="btn btn-sm btn-outline-primary" onclick="abrirModalAssinatura('${doc.id}')" title="Assinar"><i class="fas fa-pen-nib"></i> Assinar</button>`;
                deleteButton = `<button class="btn btn-sm btn-outline-danger" onclick="excluirHoraExtra('${doc.id}')"><i class="fas fa-trash"></i></button>`;
            }

            const row = `
                <tr>
                    <td>${overtime.sector}</td>
                    <td>${overtime.employeeName}</td>
                    <td>${formatarData(date)}</td>
                    <td>${overtime.reason}</td>
                    <td>${extraHours.toFixed(2)}</td>
                    <td>${overtimePay.toFixed(2)}</td>
                    <td>${dsrValue.toFixed(2)}</td>
                    <td>${(overtimePay + dsrValue).toFixed(2)}</td>
                    <td class="text-center">${assinaturaHtml}</td>
                    <td>
                        ${deleteButton}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        document.getElementById('he-totalHours').textContent = totalExtraHours.toFixed(2);
        document.getElementById('he-totalDSR').textContent = `R$ ${totalDSRValue.toFixed(2)}`;
        document.getElementById('he-grandTotal').textContent = `R$ ${totalValue.toFixed(2)}`;

        criarGraficosHorasExtras(sectorData, employeeData, monthlyData, totalExtraHours, totalValue);

    } catch (error) {
        console.error("Erro ao listar horas extras: ", error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados. Verifique os índices do Firestore ou as permissões. Detalhe: ${error.message}</td></tr>`;
    }
}

function renderizarRankingHorasExtras(employeeData) {
    const container = document.getElementById('he-employee-ranking');
    if (!container) return;

    container.innerHTML = '';

    const sortedEmployees = Object.entries(employeeData).sort(([, a], [, b]) => b - a);

    if (sortedEmployees.length === 0) {
        container.innerHTML = '<div class="list-group-item text-center text-muted">Nenhum dado de funcionário para exibir.</div>';
        return;
    }

    const top10 = sortedEmployees.slice(0, 10);

    top10.forEach(([nome, horas], index) => {
        const medalhas = ['🥇', '🥈', '🥉'];
        const posicao = index < 3 ? medalhas[index] : `#${index + 1}`;
        const classeCor = index < 3 ? 'fw-bold' : '';

        const itemEl = document.createElement('div');
        itemEl.className = 'list-group-item d-flex justify-content-between align-items-center';
        itemEl.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="${classeCor} me-3" style="min-width: 40px;">${posicao}</span>
                <div>
                    <div class="fw-semibold">${nome}</div>
                </div>
            </div>
            <span class="badge bg-primary rounded-pill px-3 py-2">${horas.toFixed(2)} horas</span>
        `;
        container.appendChild(itemEl);
    });
}

function criarGraficosHorasExtras(sectorData, employeeData, monthlyData, totalHours, totalValue) {
    // Destruir gráficos antigos
    Object.values(heCharts).forEach(chart => chart.destroy());
    heCharts = {};

    document.getElementById('he-totalOvertimeCard').textContent = totalHours.toFixed(2);
    document.getElementById('he-totalOvertimeValueCard').textContent = `R$ ${totalValue.toFixed(2)}`;

    const sortData = (data) => Object.fromEntries(Object.entries(data).sort(([,a],[,b]) => b-a));

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
    };

    heCharts.sector = new Chart(document.getElementById('he-sectorChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(sortData(sectorData)),
            datasets: [{ label: 'Horas Extras', data: Object.values(sortData(sectorData)), backgroundColor: 'rgba(75, 192, 192, 0.7)' }]
        },
        options: chartOptions
    });

    // Renderiza o novo ranking em vez do gráfico de barras
    renderizarRankingHorasExtras(employeeData);

    heCharts.monthly = new Chart(document.getElementById('he-monthlyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData).sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b)),
            datasets: [{ label: 'Horas Extras', data: Object.values(monthlyData), borderColor: 'rgba(255, 99, 132, 1)', tension: 0.1 }]
        },
        options: { ...chartOptions, scales: { y: { beginAtZero: true } } }
    });
}

async function imprimirRelatorioHorasExtras() {
    if (__he_filtered_data.length === 0) {
        mostrarMensagem("Não há dados para imprimir. Realize uma filtragem primeiro.", "warning");
        return;
    }

    // Ordenar por data e nome
    const dadosOrdenados = __he_filtered_data.sort((a, b) => {
        if (a.date !== b.date) return new Date(a.date) - new Date(b.date);
        return a.employeeName.localeCompare(b.employeeName);
    });

    const startDate = document.getElementById('he-startDate').value;
    const endDate = document.getElementById('he-endDate').value;
    const dataFormatada = `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`;

    let linhasHtml = '';
    let totalGeralHoras = 0;
    let totalGeralValor = 0;

    dadosOrdenados.forEach(item => {
        const horas = parseFloat(item.hours) || 0;
        const valor = (parseFloat(item.overtimePay) || 0) + (parseFloat(item.dsr) || 0);
        totalGeralHoras += horas;
        totalGeralValor += valor;

        const assinaturaImg = item.signed && item.signatureUrl 
            ? `<img src="${item.signatureUrl}" style="height: 30px; max-width: 100px;" alt="Assinado">` 
            : '<span style="color: #999; font-size: 10px;">Pendente</span>';

        linhasHtml += `
            <tr>
                <td>${formatarData(new Date(item.date + 'T00:00:00'))}</td>
                <td>${item.employeeName}</td>
                <td>${item.sector}</td>
                <td>${item.reason}</td>
                <td style="text-align: center;">${horas.toFixed(2)}</td>
                <td style="text-align: right;">R$ ${valor.toFixed(2)}</td>
                <td style="text-align: center;">${assinaturaImg}</td>
            </tr>
        `;
    });

    const conteudo = `
        <html>
        <head>
            <title>Relatório de Horas Extras</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; font-size: 12px; padding: 20px; }
                h2 { color: #333; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f8f9fa; border: 1px solid #dee2e6; padding: 8px; text-align: left; }
                td { border: 1px solid #dee2e6; padding: 6px; }
                .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
                .total-row { background-color: #e9ecef; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>Relatório de Horas Extras</h2>
            <p><strong>Período:</strong> ${dataFormatada}</p>
            <table>
                <thead>
                    <tr><th>Data</th><th>Colaborador</th><th>Setor</th><th>Motivo</th><th style="text-align: center;">Horas</th><th style="text-align: right;">Total (c/ DSR)</th><th style="text-align: center;">Assinatura</th></tr>
                </thead>
                <tbody>
                    ${linhasHtml}
                    <tr class="total-row"><td colspan="4" style="text-align: right;">TOTAIS:</td><td style="text-align: center;">${totalGeralHoras.toFixed(2)}</td><td style="text-align: right;">R$ ${totalGeralValor.toFixed(2)}</td><td></td></tr>
                </tbody>
            </table>
            <div class="footer">Gerado pelo Sistema Nexter em ${new Date().toLocaleString('pt-BR')}</div>
        </body>
        </html>
    `;

    openPrintWindow(conteudo, { autoPrint: true });
}

/**
 * Abre o modal de assinatura eletrônica.
 * @param {string} id - ID do registro de hora extra.
 */
async function abrirModalAssinatura(id) {
    try {
        const doc = await db.collection('overtime').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }
        const data = doc.data();

        // Preencher dados no modal
        document.getElementById('assinatura-he-id').value = id;
        document.getElementById('assinatura-colaborador').textContent = data.employeeName;
        document.getElementById('assinatura-data').textContent = formatarData(data.date);
        document.getElementById('assinatura-horas').textContent = `${data.hours}h`;

        const modalEl = document.getElementById('modalAssinaturaHE');
        const modal = new bootstrap.Modal(modalEl);
        
        // Inicializar ou limpar o SignaturePad quando o modal for exibido
        modalEl.addEventListener('shown.bs.modal', function () {
            const canvas = document.getElementById('signature-canvas');
            // Ajustar tamanho do canvas para o container pai
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = 200; // Altura fixa

            if (signaturePad) {
                signaturePad.clear();
            } else {
                signaturePad = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: 'rgb(0, 0, 0)'
                });
            }
        }, { once: true });

        modal.show();

    } catch (error) {
        console.error("Erro ao abrir modal de assinatura:", error);
        mostrarMensagem("Erro ao carregar dados para assinatura.", "error");
    }
}

function limparAssinatura() {
    if (signaturePad) {
        signaturePad.clear();
    }
}

async function salvarAssinatura() {
    if (!signaturePad || signaturePad.isEmpty()) {
        mostrarMensagem("Por favor, forneça a assinatura antes de confirmar.", "warning");
        return;
    }

    const id = document.getElementById('assinatura-he-id').value;
    const btnSalvar = document.querySelector('#modalAssinaturaHE .btn-success');
    const textoOriginal = btnSalvar.innerHTML;

    try {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        // 1. Converter assinatura para imagem (Base64 -> Blob)
        const dataUrl = signaturePad.toDataURL('image/png');
        
        // 2. Upload para Firebase Storage
        const storageRef = firebase.storage().ref();
        const assinaturaRef = storageRef.child(`assinaturas_he/${id}_${Date.now()}.png`);
        
        await assinaturaRef.putString(dataUrl, 'data_url');
        const downloadURL = await assinaturaRef.getDownloadURL();

        // 3. Atualizar Firestore
        await db.collection('overtime').doc(id).update({
            signed: true,
            signedAt: firebase.firestore.FieldValue.serverTimestamp(),
            signatureUrl: downloadURL,
            userAgent: navigator.userAgent
        });

        mostrarMensagem("Assinatura registrada com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('modalAssinaturaHE')).hide();
        await listarHorasExtras(); // Recarrega a lista

    } catch (error) {
        console.error("Erro ao salvar assinatura:", error);
        mostrarMensagem("Erro ao salvar assinatura: " + error.message, "error");
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = textoOriginal;
    }
}

async function excluirHoraExtra(id) {
    // Verifica se já está assinado antes de tentar excluir (segurança extra além da UI)
    try {
        const doc = await db.collection('overtime').doc(id).get();
        if (doc.exists && doc.data().signed) {
            mostrarMensagem("Não é possível excluir um registro já assinado.", "warning");
            return;
        }
    } catch (e) {
        console.error("Erro ao verificar status:", e);
    }

    if (!confirm("Tem certeza que deseja excluir este registro de hora extra?")) return;
    try {
        await db.collection('overtime').doc(id).delete();
        mostrarMensagem("Registro excluído com sucesso.", "success");
        await listarHorasExtras();
    } catch (error) {
        console.error("Erro ao excluir registro:", error);
        mostrarMensagem("Erro ao excluir o registro.", "error");
    }
}

function exportarTabelaParaExcel(tableId, filename) {
    try {
        const table = document.getElementById(tableId);
        if (!table) {
            mostrarMensagem("Tabela não encontrada para exportação.", "error");
            return;
        }
        // Clonar a tabela para não modificar a original (remover a coluna de ações)
        const tableClone = table.cloneNode(true);
        Array.from(tableClone.querySelectorAll('tr')).forEach(row => {
            if (row.cells.length > 0) {
                row.deleteCell(-1); // Remove a última célula (Ações)
            }
        });

        const wb = XLSX.utils.table_to_book(tableClone, { sheet: "Horas Extras" });
        XLSX.writeFile(wb, filename || "relatorio.xlsx");
        mostrarMensagem("Relatório exportado para Excel!", "success");
    } catch (error) {
        console.error("Erro ao exportar para Excel:", error);
        mostrarMensagem("Falha na exportação para Excel.", "error");
    }
}

// Função para formatar data (pode ser movida para utils.js se for usada em mais lugares)
function formatarData(date) {
    if (!date) return '-';
    try {
        const d = new Date(date); // A data já vem como objeto Date
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch {
        return '-';
    }
}

// Adiciona a função ao escopo global para ser chamada pelo app.js
window.inicializarHorasExtras = inicializarHorasExtras;
window.abrirModalAssinatura = abrirModalAssinatura;
window.limparAssinatura = limparAssinatura;
window.salvarAssinatura = salvarAssinatura;

// Adiciona a dependência do XLSX se não existir
if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
    document.head.appendChild(script);
}