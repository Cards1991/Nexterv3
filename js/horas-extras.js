// Gerenciamento do Dashboard de Horas Extras

let heCharts = {}; // Armazena instâncias dos gráficos para destruí-los depois

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
        printButton.addEventListener('click', () => alert('Impressão em desenvolvimento.'));
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
    if (!sectorFilter || sectorFilter.options.length > 1) return;

    sectorFilter.innerHTML = '<option value="Todos">Todos os Setores</option>';
    try {
        const empresasSnap = await db.collection('empresas').get();
        const todosSetores = new Set();
        empresasSnap.forEach(doc => {
            (doc.data().setores || []).forEach(setor => todosSetores.add(setor));
        });
        [...todosSetores].sort().forEach(setor => {
            sectorFilter.innerHTML += `<option value="${setor}">${setor}</option>`;
        });
    } catch (error) {
        console.error("Erro ao popular filtro de setores:", error);
    }

    // Definir datas padrão (mês atual)
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('he-startDate').value = primeiroDia;
    document.getElementById('he-endDate').value = ultimoDia;
}

async function listarHorasExtras() {
    const tbody = document.getElementById('he-overtimeList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const startDate = document.getElementById('he-startDate').value;
    const endDate = document.getElementById('he-endDate').value;
    const sector = document.getElementById('he-sectorFilter').value;

    if (!startDate || !endDate) {
        mostrarMensagem("Por favor, selecione as datas inicial e final.", "warning");
        return;
    }

    let totalExtraHours = 0, totalDSRValue = 0, totalValue = 0;
    let sectorData = {}, employeeData = {}, monthlyData = {};

    try {
        let query = db.collection('overtime')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);

        if (sector !== "Todos") {
            query = query.where('sector', '==', sector);
        }

        const querySnapshot = await query.get();
        tbody.innerHTML = ''; // Limpa a tabela para novos dados

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum registro encontrado para o período.</td></tr>';
        }

        querySnapshot.forEach((doc) => {
            const overtime = doc.data();
            const extraHours = parseFloat(overtime.hours) || 0;
            const dsrValue = parseFloat(overtime.dsr) || 0;
            const overtimePay = parseFloat(overtime.overtimePay) || 0;
            const date = new Date(overtime.date + 'T00:00:00');
            const month = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

            sectorData[overtime.sector] = (sectorData[overtime.sector] || 0) + extraHours;
            employeeData[overtime.employeeName] = (employeeData[overtime.employeeName] || 0) + extraHours;
            monthlyData[month] = (monthlyData[month] || 0) + extraHours;

            totalExtraHours += extraHours;
            totalDSRValue += dsrValue;
            totalValue += overtimePay + dsrValue;

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
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirHoraExtra('${doc.id}')"><i class="fas fa-trash"></i></button>
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
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados. Verifique os índices do Firestore.</td></tr>';
    }
}

function criarGraficosHorasExtras(sectorData, employeeData, monthlyData, totalHours, totalValue) {
    // Destruir gráficos antigos
    Object.values(heCharts).forEach(chart => chart.destroy());
    heCharts = {};

    document.getElementById('he-totalOvertimeCard').textContent = totalHours.toFixed(2);
    document.getElementById('he-totalOvertimeValueCard').textContent = `R$ ${totalValue.toFixed(2)}`;

    const sortData = (data) => Object.entries(data).sort(([,a],[,b]) => b-a).reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    const top10EmployeeData = Object.fromEntries(Object.entries(sortData(employeeData)).slice(0, 10));

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

    heCharts.employee = new Chart(document.getElementById('he-employeeChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(top10EmployeeData),
            datasets: [{ label: 'Horas Extras', data: Object.values(top10EmployeeData), backgroundColor: 'rgba(153, 102, 255, 0.7)' }]
        },
        options: chartOptions
    });

    heCharts.monthly = new Chart(document.getElementById('he-monthlyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData).sort((a, b) => new Date('01 ' + a) - new Date('01 ' + b)),
            datasets: [{ label: 'Horas Extras', data: Object.values(monthlyData), borderColor: 'rgba(255, 99, 132, 1)', tension: 0.1 }]
        },
        options: { ...chartOptions, scales: { y: { beginAtZero: true } } }
    });
}

async function excluirHoraExtra(id) {
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
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // Adicionado UTC para evitar problemas de fuso
    } catch {
        return '-';
    }
}

// Adiciona a função ao escopo global para ser chamada pelo app.js
window.inicializarHorasExtras = inicializarHorasExtras;

// Adiciona a dependência do XLSX se não existir
if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
    document.head.appendChild(script);
}