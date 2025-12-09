// ========================================
// Módulo: Jurídico - Dashboard
// ========================================

let juridicoPerformanceChart = null; // Variável para guardar a instância do gráfico

async function inicializarDashboardJuridico() {
    console.log("Inicializando Dashboard Jurídico...");

    // Carregar as métricas dinamicamente
    document.getElementById('jur-dash-total-processos').textContent = '0';
    document.getElementById('jur-dash-prazos-urgentes').textContent = '0';
    document.getElementById('jur-dash-previsao-receita').textContent = 'R$ 0';
    document.getElementById('jur-dash-taxa-sucesso').textContent = '0%';

    // Exemplo de como carregar o gráfico de performance
    const ctx = document.getElementById('jur-dash-grafico-performance')?.getContext('2d');
    if (ctx) {
        // Se já existe um gráfico, destrói antes de criar um novo
        if (juridicoPerformanceChart) {
            juridicoPerformanceChart.destroy();
        }

        juridicoPerformanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Trabalhista', 'Cível', 'Tributário'],
                datasets: [{ // Dados zerados inicialmente
                    data: [0, 0, 0],
                    backgroundColor: ['#4361ee', '#f72585', '#4cc9f0'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}