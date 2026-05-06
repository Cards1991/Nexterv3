// Gerenciamento do Dashboard de Horas Extras

let heCharts = {}; // Armazena instâncias dos gráficos para destruí-los depois
let signaturePad = null; // Instância global do SignaturePad
let __he_filtered_data = []; // Cache dos dados filtrados para impressão
let __he_funcionarios_map = {}; // Mapa para vincular funcionário à empresa
let __he_macro_setores_map = {}; // Mapa para armazenar os macro setores
let __he_todos_setores_map = new Map(); // Mapa global de setores (ID -> Descrição)
let __he_setor_to_macro_map = {}; // Mapa para buscar nome do macro setor pelo nome do setor

async function inicializarHorasExtras() {
    console.log('Inicializando Dashboard de Horas Extras...');

    // Configurar filtros e botões
    const filterButton = document.getElementById('he-filterButton');
    const printButton = document.getElementById('he-printButton');
    const exportButton = document.getElementById('he-exportButton');
    const reprocessButton = document.getElementById('he-reprocessButton');

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
    if (reprocessButton && !reprocessButton.bound) {
        reprocessButton.addEventListener('click', () => reprocessarHorasExtras());
        reprocessButton.bound = true;
    }

    await preencherFiltrosHorasExtras();
    await listarHorasExtras();
}

async function preencherFiltrosHorasExtras() {
    const sectorFilter = document.getElementById('he-sectorFilter');
    const companyFilter = document.getElementById('he-companyFilter');
    const employeeFilter = document.getElementById('he-employeeFilter');
    const macroSectorFilter = document.getElementById('he-macroSectorFilter');

    if (!sectorFilter) return;

    try {
        // Carregar Empresas, Setores e Macro Setores em paralelo
        const [empresasSnap, setoresSnap, macroSetoresSnap, funcSnap] = await Promise.all([
            db.collection('empresas').orderBy('nome').get(),
            db.collection('setores').orderBy('descricao').get(),
            db.collection('macro_setores').get(),
            db.collection('funcionarios').orderBy('nome').get()
        ]);

        // Processar Empresas
        companyFilter.innerHTML = '<option value="">Todas as Empresas</option>';
        empresasSnap.forEach(doc => {
            companyFilter.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });

        // Processar Setores e guardar em um mapa para referência
        const todosSetores = new Map();
        setoresSnap.forEach(doc => {
            todosSetores.set(doc.id, doc.data().descricao);
        });
        __he_todos_setores_map = todosSetores;

        sectorFilter.innerHTML = '<option value="Todos">Todos os Setores</option>';
        [...todosSetores.values()].sort().forEach(setor => {
            sectorFilter.innerHTML += `<option value="${setor}">${setor}</option>`;
        });

        // Processar Macro Setores
        macroSectorFilter.innerHTML = '<option value="">Nenhum</option>';
        __he_macro_setores_map = {};
        __he_setor_to_macro_map = {}; // Resetar o mapa
        
        macroSetoresSnap.forEach(doc => {
            const data = doc.data();
            const macroNome = data.nome || 'Sem nome';
            const setoresIds = data.setoresIds || [];
            
            __he_macro_setores_map[doc.id] = setoresIds;
            macroSectorFilter.innerHTML += `<option value="${doc.id}">${data.nome}</option>`;
            
            // Criar mapeamento inverso: setor (nome) -> nome do macro setor
            setoresIds.forEach(setorId => {
                const setorNome = __he_todos_setores_map.get(setorId);
                if (setorNome) {
                    __he_setor_to_macro_map[setorNome.trim().toLowerCase()] = macroNome;
                }
            });
        });
        
        console.log('Mapeamento Setor -> Macro Setor:', __he_setor_to_macro_map);

        // Event listener para o filtro de macro setor
        macroSectorFilter.addEventListener('change', (e) => {
            const macroSetorId = e.target.value;
            const setoresDoMacroIds = __he_macro_setores_map[macroSetorId] || [];

            // Resetar filtro de setor para "Todos"
            sectorFilter.value = 'Todos';

            // Filtrar opções do select de setores
            Array.from(sectorFilter.options).forEach(option => {
                if (option.value === 'Todos') {
                    option.style.display = '';
                    return;
                }

                // Encontrar ID do setor pelo nome (descrição)
                const entry = [...__he_todos_setores_map.entries()].find(([id, desc]) => desc === option.value);
                const sectorId = entry ? entry[0] : null;

                if (macroSetorId) {
                    option.style.display = (sectorId && setoresDoMacroIds.includes(sectorId)) ? '' : 'none';
                } else {
                    option.style.display = '';
                }
            });
        });


        // Carregar Funcionários e criar mapa de vínculo
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

    // Definir datas padrão (ciclo de fechamento: dia 26 ao dia 25)
    const hoje = new Date();
    let anoInicio = hoje.getFullYear();
    let mesInicio = hoje.getMonth();
    
    if (hoje.getDate() <= 25) {
        mesInicio -= 1;
        if (mesInicio < 0) {
            mesInicio = 11;
            anoInicio -= 1;
        }
    }
    
    const dataInicio = new Date(anoInicio, mesInicio, 26);
    
    const toLocalISO = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };

    document.getElementById('he-startDate').value = toLocalISO(dataInicio);
    document.getElementById('he-endDate').value = toLocalISO(hoje);
}


async function listarHorasExtras() {
    const tbody = document.getElementById('he-overtimeList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="10" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const startDate = document.getElementById('he-startDate').value;
    const endDate = document.getElementById('he-endDate').value;
    const sectorFilter = document.getElementById('he-sectorFilter');
    const companyId = document.getElementById('he-companyFilter').value;
    const employeeId = document.getElementById('he-employeeFilter').value;
    const macroSectorFilter = document.getElementById('he-macroSectorFilter');
    const paymentFilter = document.getElementById('he-paymentFilter');
    const paymentId = paymentFilter ? paymentFilter.value : '';
    const statusFilter = document.getElementById('he-statusFilter');
    const statusId = statusFilter ? statusFilter.value : '';

    // Obter os setores selecionados (pode ser um ou vários)
    const selectedSectors = Array.from(sectorFilter.selectedOptions).map(opt => opt.value);

    if (!startDate || !endDate) {
        mostrarMensagem("Por favor, selecione as datas inicial e final.", "warning");
        return;
    }

    const macroSectorId = macroSectorFilter ? macroSectorFilter.value : '';
    let totalExtraHours = 0, totalDSRValue = 0, totalValue = 0;
    let sectorData = {}, employeeData = {}, monthlyData = {};

    try {
        let query = db.collection('overtime')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);

        const querySnapshot = await query.get();
        tbody.innerHTML = '';

        const docs = querySnapshot.docs.filter(doc => {
            const data = doc.data();

            // Filtro de Status
            if (statusId) {
                if (statusId === 'aprovado') {
                    if (data.status === 'pendente' || data.status === 'rejeitado' || data.status === 'cancelado') return false;
                } else {
                    if (data.status !== statusId) return false;
                }
            } else {
                if (data.status === 'pendente') return false; // Default behavior when no status filter is selected
            }

            // Filtro de Pagamento
            if (paymentId) {
                const forma = data.formaPagamento || 'por-fora';
                if (forma !== paymentId) return false;
            }

            // Filtro de Setor (agora suporta múltiplos)
            if (!selectedSectors.includes('Todos') && !selectedSectors.includes(data.sector)) return false;

            // Filtro de Setor Macro
            if (macroSectorId) {
                const setoresDoMacroIds = __he_macro_setores_map[macroSectorId] || [];
                const setoresDoMacroDescs = setoresDoMacroIds
                    .map(id => (__he_todos_setores_map.get(id) || '').trim().toLowerCase())
                    .filter(Boolean);
                const dataSectorFormatted = (data.sector || '').trim().toLowerCase();

                if (!setoresDoMacroDescs.includes(dataSectorFormatted)) return false;
            }

            if (employeeId && data.employeeId !== employeeId) return false;
            if (companyId && (__he_funcionarios_map[data.employeeId]?.empresaId !== companyId)) return false;

            return true;
        });

        __he_filtered_data = docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum registro encontrado para o período.</td></tr>';
            criarGraficosHorasExtras({}, {}, {}, 0, 0);
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

            let deleteButton = '';

            if (overtime.signed) {
                deleteButton = `<button class="btn btn-sm btn-outline-secondary" disabled title="Registro assinado não pode ser excluído"><i class="fas fa-trash"></i></button>`;
            } else {
                deleteButton = `<button class="btn btn-sm btn-outline-danger" onclick="excluirHoraExtra('${doc.id}')" title="Excluir"><i class="fas fa-trash"></i></button>`;
            }

            let reprocessButtonRow = `<button class="btn btn-sm btn-outline-primary me-1" onclick="reprocessarUmaHoraExtra('${doc.id}')" title="Recalcular Valores"><i class="fas fa-sync"></i></button>`;

            // Buscar o nome do setor macro baseado no setor
            const setorNome = (overtime.sector || '').trim().toLowerCase();
            const macroSetorNome = __he_setor_to_macro_map[setorNome] || '-';

            const row = `
                <tr>
                    <td>${overtime.sector}</td>
                    <td>${macroSetorNome}</td>
                    <td>${overtime.employeeName}</td>
                    <td>${formatarData(date)}</td>
                    <td>${overtime.reason}</td>
                    <td class="fw-bold">${fakeDecimalToHHmm(extraHours)}</td>
                    <td>R$ ${overtimePay.toFixed(2)} (${overtime.overtimeType}%)</td>
                    <td>R$ ${dsrValue.toFixed(2)}</td>
                    <td>R$ ${(overtimePay + dsrValue).toFixed(2)}</td>
                    <td>
                        ${reprocessButtonRow}
                        ${deleteButton}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        document.getElementById('he-totalHours').textContent = fakeDecimalToHHmm(totalExtraHours);
        document.getElementById('he-totalDSR').textContent = `R$ ${totalDSRValue.toFixed(2)}`;
        document.getElementById('he-grandTotal').textContent = `R$ ${totalValue.toFixed(2)}`;

        criarGraficosHorasExtras(sectorData, employeeData, monthlyData, totalExtraHours, totalValue);

    } catch (error) {
        console.error("Erro ao listar horas extras: ", error);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados. Detalhe: ${error.message}</td></tr>`;
    }
}

async function reprocessarHorasExtras() {
    if (!confirm("Isso irá recalcular os valores de todas as horas extras visíveis na tabela. Esta ação não pode ser desfeita. Deseja continuar?")) {
        return;
    }

    const registrosParaReprocessar = __he_filtered_data.filter(item => !item.signed);

    if (registrosParaReprocessar.length === 0) {
        mostrarMensagem("Não há registros não assinados para reprocessar nos filtros atuais.", "info");
        return;
    }

    mostrarMensagem(`Reprocessando ${registrosParaReprocessar.length} registros...`, "info");
    const reprocessButton = document.getElementById('he-reprocessButton');
    reprocessButton.disabled = true;
    reprocessButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Reprocessando...`;

    try {
        // Atualizar o mapeamento de macro setores antes de reprocessar
        await atualizarMapeamentoMacroSetores();
        
        const batch = db.batch();
        const funcionariosCache = {};

        for (const item of registrosParaReprocessar) {
            let funcionarioData = funcionariosCache[item.employeeId];
            if (!funcionarioData) {
                const funcDoc = await db.collection('funcionarios').doc(item.employeeId).get();
                if (funcDoc.exists) {
                    funcionarioData = funcDoc.data();
                    funcionariosCache[item.employeeId] = funcionarioData;
                } else {
                    console.warn(`Funcionário com ID ${item.employeeId} não encontrado. Pulando item.`);
                    continue;
                }
            }

            // Lógica de cálculo (simplificada, idealmente viria de uma função centralizada)
            const salarioBase = parseFloat(funcionarioData.salario) || 0;
            const jornadaMensal = parseFloat(funcionarioData.jornada) || 220;
            const valorHora = salarioBase / jornadaMensal;

            // Determinar o multiplicador baseado no tipo de hora extra (ex: 50 -> 1.5, 100 -> 2.0)
            const tipoHE = parseFloat(item.overtimeType) || 50;
            const multiplicador = 1 + (tipoHE / 100);

            const valorHoraExtra = valorHora * multiplicador;
            
            // Recalcular as horas no formato "fake decimal" (ex: 4:45 -> 4.45) se tivermos os horários
            let horasParaCalculo = parseFloat(item.hours) || 0;
            if (item.entryTime && item.exitTime) {
                const d1 = new Date(`${item.date}T${item.entryTime}:00`);
                let d2 = new Date(`${item.date}T${item.exitTime}:00`);
                if (d2 <= d1) d2.setDate(d2.getDate() + 1);
                const diffHorasReais = (d2 - d1) / 3600000;
                horasParaCalculo = trueDecimalToFakeDecimal(diffHorasReais);
            }

            const totalHorasExtras = valorHoraExtra * horasParaCalculo;

            // Recálculo do DSR (exemplo simples)
            // A lógica real pode ser mais complexa e depender de dias úteis/domingos no período.
            const diasNoMes = new Date(new Date(item.date).getFullYear(), new Date(item.date).getMonth() + 1, 0).getDate();
            const domingosEFeriados = 5; // Valor exemplo, deveria ser calculado
            const diasUteis = diasNoMes - domingosEFeriados;
            const valorDSR = (totalHorasExtras / diasUteis) * domingosEFeriados;

            // Obter o setor atual do funcionário no cadastro de funcionários
            const setorFuncionario = funcionarioData.setor || '';

            const docRef = db.collection('overtime').doc(item.id);
            
            // Atualiza tanto os valores quanto o setor baseado no cadastro atual do funcionário
            batch.update(docRef, {
                overtimePay: parseFloat(totalHorasExtras.toFixed(2)),
                dsr: parseFloat(valorDSR.toFixed(2)),
                sector: setorFuncionario, // Atualiza com o setor atual do funcionário
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
        mostrarMensagem("Horas extras reprocessadas com sucesso! A lista será atualizada.", "success");

    } catch (error) {
        console.error("Erro ao reprocessar horas extras:", error);
        mostrarMensagem(`Erro ao reprocessar: ${error.message}`, "error");
    } finally {
        reprocessButton.disabled = false;
        reprocessButton.innerHTML = `<i class="fas fa-sync-alt"></i> Reprocessar`;
        await listarHorasExtras(); // Atualiza a visualização
    }
}

/**
 * Reprocessa uma única hora extra pelo ID
 */
async function reprocessarUmaHoraExtra(id) {
    try {
        const docRef = db.collection('overtime').doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            mostrarMensagem("Registro não encontrado.", "error");
            return;
        }

        const item = docSnap.data();
        if (item.signed) {
            if (!confirm("Este registro já foi ASSINADO. Deseja realmente REPROCESSAR e possivelmente alterar os valores?")) {
                return;
            }
        }

        // Feedback visual no botão
        const btn = document.querySelector(`button[onclick*="${id}"][onclick*="reprocessar"]`);
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        // Buscar dados do funcionário para obter salário atualizado
        const funcDoc = await db.collection('funcionarios').doc(item.employeeId).get();
        if (!funcDoc.exists) {
            mostrarMensagem(`Funcionário com ID ${item.employeeId} não encontrado.`, "error");
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            return;
        }

        const funcionarioData = funcDoc.data();
        const salarioBase = parseFloat(funcionarioData.salario) || 0;
        const jornadaMensal = parseFloat(funcionarioData.jornada) || 220;
        const valorHora = salarioBase / jornadaMensal;

        // Determinar o multiplicador baseado no tipo de hora extra
        const tipoHE = parseFloat(item.overtimeType) || 50;
        const multiplicador = 1 + (tipoHE / 100);

        const valorHoraExtra = valorHora * multiplicador;
        
        // Recalcular as horas no formato "fake decimal" (ex: 4:45 -> 4.45) se tivermos os horários
        let horasParaCalculo = parseFloat(item.hours) || 0;
        if (item.entryTime && item.exitTime) {
            const d1 = new Date(`${item.date}T${item.entryTime}:00`);
            let d2 = new Date(`${item.date}T${item.exitTime}:00`);
            if (d2 <= d1) d2.setDate(d2.getDate() + 1);
            const diffHorasReais = (d2 - d1) / 3600000;
            horasParaCalculo = trueDecimalToFakeDecimal(diffHorasReais);
        }

        const totalHorasExtras = valorHoraExtra * horasParaCalculo;

        // Recálculo do DSR (usando lógica compatível com o sistema)
        const dataLanc = new Date(item.date + 'T12:00:00');
        const ano = dataLanc.getFullYear();
        const mes = dataLanc.getMonth();
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const domingosEFeriados = 5; // Valor exemplo simplificado
        const diasUteis = diasNoMes - domingosEFeriados;
        const valorDSR = (totalHorasExtras / (diasUteis || 25)) * domingosEFeriados;

        const setorFuncionario = funcionarioData.setor || '';

        await docRef.update({
            hours: horasParaCalculo, // Atualiza para o formato esperado (ex: 4.45)
            overtimePay: parseFloat(totalHorasExtras.toFixed(2)),
            dsr: parseFloat(valorDSR.toFixed(2)),
            sector: setorFuncionario,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem(`Valores recalculados para ${item.employeeName}!`, "success");
        await listarHorasExtras();

    } catch (error) {
        console.error("Erro ao reprocessar:", error);
        mostrarMensagem("Erro ao recalcular: " + error.message, "error");
    }
}

/**
 * Atualiza o mapeamento de macro setores a partir do banco de dados
 */
async function atualizarMapeamentoMacroSetores() {
    try {
        const setoresSnap = await db.collection('setores').get();
        const macroSetoresSnap = await db.collection('macro_setores').get();

        // Atualiza o mapa de setores
        const todosSetores = new Map();
        setoresSnap.forEach(doc => {
            todosSetores.set(doc.id, doc.data().descricao);
        });
        __he_todos_setores_map = todosSetores;

        // Atualiza o mapa de macro setores e o mapeamento inverso
        __he_macro_setores_map = {};
        __he_setor_to_macro_map = {};

        macroSetoresSnap.forEach(doc => {
            const data = doc.data();
            const macroNome = data.nome || 'Sem nome';
            const setoresIds = data.setoresIds || [];

            __he_macro_setores_map[doc.id] = setoresIds;

            // Criar mapeamento inverso: setor (nome) -> nome do macro setor
            setoresIds.forEach(setorId => {
                const setorNome = __he_todos_setores_map.get(setorId);
                if (setorNome) {
                    __he_setor_to_macro_map[setorNome.trim().toLowerCase()] = macroNome;
                }
            });
        });

        console.log('Mapeamento de Macro Setores atualizado:', __he_setor_to_macro_map);
    } catch (error) {
        console.error("Erro ao atualizar mapeamento de macro setores:", error);
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
            <span class="badge bg-primary rounded-pill px-3 py-2">${decimalToHHmm(horas)}</span>
        `;
        container.appendChild(itemEl);
    });
}

function criarGraficosHorasExtras(sectorData, employeeData, monthlyData, totalHours, totalValue) {
    // Destruir gráficos antigos
    Object.values(heCharts).forEach(chart => chart.destroy());
    heCharts = {};

    const elTotalCard = document.getElementById('he-totalOvertimeCard');
    if (elTotalCard) elTotalCard.textContent = totalHours.toFixed(2);

    const elValueCard = document.getElementById('he-totalOvertimeValueCard');
    if (elValueCard) elValueCard.textContent = `R$ ${totalValue.toFixed(2)}`;

    const sortData = (data) => Object.fromEntries(Object.entries(data).sort(([, a], [, b]) => b - a));

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
                <td style="text-align: center; font-weight: bold;">${decimalToHHmm(horas)}</td>
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
                    <tr class="total-row"><td colspan="4" style="text-align: right;">TOTAIS:</td><td style="text-align: center;">${decimalToHHmm(totalGeralHoras)}</td><td style="text-align: right;">R$ ${totalGeralValor.toFixed(2)}</td><td></td></tr>
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
window.reprocessarUmaHoraExtra = reprocessarUmaHoraExtra;

// Adiciona a dependência do XLSX se não existir
if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.0/xlsx.full.min.js";
    document.head.appendChild(script);
}