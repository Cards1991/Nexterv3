// ========================================
// Módulo: Jurídico Corporativo - Dashboard
// ========================================

let juridicoRiscoChart = null; // Variável para guardar a instância do gráfico

async function inicializarDashboardJuridico() {
    console.log("Inicializando Dashboard Jurídico Corporativo...");

    try {
        const processosSnap = await db.collection('processos_juridicos').get();
        const processos = processosSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        // 1. Processos Ativos
        const ativos = processos.filter(p => p.status === 'Ativo');
        document.getElementById('kpi-processos-ativos').innerText = ativos.length;

        // 2. Risco Trabalhista Estimado (Risco Alto/Provável) e Audiências no Mês
        let riscoFinanceiroTotal = 0;
        let audienciasMes = 0;
        
        const hoje = new Date();
        const trintaDias = new Date();
        trintaDias.setDate(hoje.getDate() + 30);
        
        const criticos = []; // Para a tabela
        
        ativos.forEach(p => {
            // Soma valor de causa se risco for Alto ou Provável
            if (p.riscoGeral === 'Alto' || p.riscoGeral === 'Provável') {
                riscoFinanceiroTotal += parseFloat(p.valorCausa || 0);
            }
            
            // Verifica audiências (dataAudiencia ou dataConciliacao)
            let temAudiencia = false;
            let dataMaisProxima = null;
            
            const verificarData = (dataStr) => {
                if (dataStr) {
                    const d = dataStr.toDate ? dataStr.toDate() : new Date(dataStr);
                    if (d >= hoje && d <= trintaDias) temAudiencia = true;
                    if (!dataMaisProxima || d < dataMaisProxima) dataMaisProxima = d;
                }
            };
            
            verificarData(p.dataAudiencia);
            verificarData(p.dataConciliacao);
            verificarData(p.dataInstrucao);
            
            if (temAudiencia) audienciasMes++;
            
            // Tabela de Próximos Prazos / Audiências (priorizando quem tem data próxima)
            if (dataMaisProxima && dataMaisProxima >= hoje) {
                criticos.push({ ...p, proximaData: dataMaisProxima });
            }
        });
        
        document.getElementById('kpi-risco-financeiro').innerText = 'R$ ' + riscoFinanceiroTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        document.getElementById('kpi-audiencias-mes').innerText = audienciasMes;

        // 3. Contratos a Vencer (mock por enquanto, até ter a collection)
        // Se houver collection 'juridico_contratos':
        try {
            const contratosSnap = await db.collection('juridico_contratos').get();
            const contratos = contratosSnap.docs.map(d => d.data());
            const aVencer = contratos.filter(c => {
                if (!c.dataFim) return false;
                const d = c.dataFim.toDate ? c.dataFim.toDate() : new Date(c.dataFim);
                return d >= hoje && d <= trintaDias;
            });
            document.getElementById('kpi-contratos-vencer').innerText = aVencer.length;
        } catch (e) {
             document.getElementById('kpi-contratos-vencer').innerText = '0';
        }

        // 4. Preencher Tabela de Prazos/Audiências (Ordenada por data)
        criticos.sort((a, b) => a.proximaData - b.proximaData);
        const tbodyCriticos = document.getElementById('jur-dash-processos-criticos');
        tbodyCriticos.innerHTML = '';
        
        if (criticos.length === 0) {
            tbodyCriticos.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Nenhum processo com audiência/prazo agendado.</td></tr>';
        } else {
            criticos.slice(0, 10).forEach(p => {
                let badgeClass = 'bg-secondary';
                if (p.riscoGeral === 'Alto' || p.riscoGeral === 'Provável') badgeClass = 'bg-danger';
                else if (p.riscoGeral === 'Médio' || p.riscoGeral === 'Possível') badgeClass = 'bg-warning text-dark';
                else if (p.riscoGeral === 'Baixo' || p.riscoGeral === 'Remoto') badgeClass = 'bg-success';
                
                tbodyCriticos.innerHTML += `
                    <tr>
                        <td class="fw-bold">${p.numeroProcesso || 'N/A'}</td>
                        <td>${p.funcionarioNome || p.cliente || 'N/A'}</td>
                        <td><span class="badge ${badgeClass}">${p.riscoGeral || 'N/D'}</span></td>
                        <td>${p.proximaData.toLocaleDateString('pt-BR')}</td>
                        <td>R$ ${(p.valorCausa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                `;
            });
        }

        // 5. Gráfico de Risco de Perda
        const riscoCount = { 'Provável/Alto': 0, 'Possível/Médio': 0, 'Remoto/Baixo': 0, 'Não Classificado': 0 };
        ativos.forEach(p => {
            const r = p.riscoGeral;
            if (r === 'Alto' || r === 'Provável') riscoCount['Provável/Alto']++;
            else if (r === 'Médio' || r === 'Possível') riscoCount['Possível/Médio']++;
            else if (r === 'Baixo' || r === 'Remoto') riscoCount['Remoto/Baixo']++;
            else riscoCount['Não Classificado']++;
        });
        
        renderizarGraficoRisco(riscoCount);

    } catch (error) {
        console.error("Erro ao carregar dashboard jurídico:", error);
    }
}

function renderizarGraficoRisco(dados) {
    const ctx = document.getElementById('jur-dash-grafico-risco')?.getContext('2d');
    if (!ctx) return;

    if (juridicoRiscoChart) juridicoRiscoChart.destroy();

    juridicoRiscoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dados),
            datasets: [{
                data: Object.values(dados),
                backgroundColor: ['#dc3545', '#ffc107', '#198754', '#adb5bd'], // Vermelho, Amarelo, Verde, Cinza
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom' } 
            } 
        }
    });
}