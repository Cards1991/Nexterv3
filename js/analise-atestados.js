// ========================================
// Módulo: Análise de Atestados (Dashboard)
// ========================================

let chartsAnaliseAtestados = {};

async function inicializarAnaliseAtestados() {
    console.log("Inicializando Dashboard de Análise de Atestados...");

    // Configurar datas padrão se vazio
    const inicio = document.getElementById('dash-atest-inicio');
    const fim = document.getElementById('dash-atest-fim');

    if (inicio && !inicio.value) {
        const hoje = new Date();
        inicio.value = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0]; // Início do ano
        fim.value = new Date().toISOString().split('T')[0];
    }

    // Preencher filtro de setores
    await carregarSetoresFiltro();

    // Preencher filtro de colaboradores
    await carregarColaboradoresFiltro();

    await carregarDashboardAtestados();
}

async function carregarSetoresFiltro() {
    const select = document.getElementById('dash-atest-setor');
    if (!select || select.options.length > 1) return;

    try {
        const snap = await db.collection('setores').get();
        const setores = new Set();
        snap.forEach(doc => setores.add(doc.data().descricao));

        [...setores].sort().forEach(s => {
            select.innerHTML += `<option value="${s}">${s}</option>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarColaboradoresFiltro() {
    const select = document.getElementById('dash-atest-colaborador');
    if (!select || select.options.length > 1) return;

    try {
        const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Todos os colaboradores</option>';
        snap.forEach(doc => {
            const func = doc.data();
            select.innerHTML += `<option value="${doc.id}">${func.nome}</option>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarDashboardAtestados() {
    const inicio = document.getElementById('dash-atest-inicio').value;
    const fim = document.getElementById('dash-atest-fim').value;
    const setor = document.getElementById('dash-atest-setor').value;
    const funcionarioId = document.getElementById('dash-atest-colaborador').value;

    try {
        let query = db.collection('atestados');
        
        if (inicio) query = query.where('data_atestado', '>=', new Date(inicio + 'T00:00:00'));
        if (fim) query = query.where('data_atestado', '<=', new Date(fim + 'T23:59:59'));
        if (funcionarioId) query = query.where('funcionarioId', '==', funcionarioId);

        const snapshot = await query.get();
        let atestados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtro de setor em memória (se necessário)
        if (setor) {
            // Precisamos buscar o setor do funcionário se não estiver no atestado
            // Por simplificação, assumindo que o objeto atestado tem 'setor' ou vamos ignorar por enquanto
            atestados = atestados.filter(a => a.setor === setor);
        }

        atualizarKPIs(atestados);
        renderizarGraficos(atestados);
        renderizarMapaCorporal(atestados);
        gerarInsightsIA(atestados);

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function atualizarKPIs(atestados) {
    const total = atestados.length;
    const dias = atestados.reduce((acc, curr) => acc + (parseInt(curr.dias) || 0), 0);
    const media = total > 0 ? (dias / total).toFixed(1) : 0;
    
    // Estimativa de custo (simplificada)
    // Idealmente buscaria salários, aqui usaremos uma média fixa de R$ 100/dia para exemplo
    const custoEstimado = dias * 100; 

    document.getElementById('kpi-atest-total').textContent = total;
    document.getElementById('kpi-atest-dias').textContent = dias;
    document.getElementById('kpi-atest-media').textContent = media;
    document.getElementById('kpi-atest-custo').textContent = `R$ ${custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

function renderizarGraficos(atestados) {
    // Destruir gráficos antigos
    Object.values(chartsAnaliseAtestados).forEach(c => c.destroy());

    // 1. Evolução Mensal
    const porMes = {};
    atestados.forEach(a => {
        const data = a.data_atestado?.toDate ? a.data_atestado.toDate() : new Date(a.data_atestado);
        const mes = data.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        porMes[mes] = (porMes[mes] || 0) + 1;
    });
    
    // Ordenar cronologicamente (simplificado)
    const labelsMes = Object.keys(porMes); 
    const dataMes = Object.values(porMes);

    const ctxEvolucao = document.getElementById('chart-atest-evolucao').getContext('2d');
    chartsAnaliseAtestados.evolucao = new Chart(ctxEvolucao, {
        type: 'line',
        data: {
            labels: labelsMes,
            datasets: [{
                label: 'Atestados',
                data: dataMes,
                borderColor: '#0d6efd',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(13, 110, 253, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 2. Distribuição por Tipo
    const porTipo = {};
    atestados.forEach(a => {
        const tipo = a.tipo || 'Outros';
        porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });

    const ctxTipo = document.getElementById('chart-atest-tipo').getContext('2d');
    chartsAnaliseAtestados.tipo = new Chart(ctxTipo, {
        type: 'doughnut',
        data: {
            labels: Object.keys(porTipo),
            datasets: [{
                data: Object.values(porTipo),
                backgroundColor: ['#4361ee', '#f72585', '#4cc9f0', '#f8961e', '#3a0ca3']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Outros gráficos (Setores, Colaboradores) seguem lógica similar...
}

// ========================================
// MAPA DE CALOR CORPORAL (BODY MAP)
// ========================================

function renderizarMapaCorporal(atestados) {
    const container = document.getElementById('body-map-container');
    const tooltip = document.getElementById('body-map-tooltip');
    const legend = document.getElementById('body-map-legend');
    
    if (!container) return;

    // Verifica se a função 3D está disponível e inicializa
    if (typeof window.initBodyMap3D === 'function') {
        window.initBodyMap3D('body-map-container', atestados);
        
        // Legenda específica para o 3D
        legend.innerHTML = `
            <div class="fw-bold mb-1">Incidência</div>
            <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#28a745;margin-right:5px;border:1px solid #ccc"></span> Baixa</div>
            <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#ffc107;margin-right:5px;border:1px solid #ccc"></span> Média</div>
            <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#dc3545;margin-right:5px;border:1px solid #ccc"></span> Alta</div>
        `;
        return; // Encerra aqui se o 3D foi carregado
    }

    console.warn("Módulo 3D não carregado. Renderizando fallback 2D.");
    
    // 1. Processar dados: Mapear CIDs para partes do corpo
    const bodyStats = {
        head: { count: 0, cids: {} },
        torso: { count: 0, cids: {} },
        arms: { count: 0, cids: {} },
        legs: { count: 0, cids: {} },
        systemic: { count: 0, cids: {} } // Para doenças gerais
    };

    atestados.forEach(a => {
        const cid = (a.cid || '').toUpperCase().trim();
        if (!cid) return;
        
        let part = 'systemic';
        const letra = cid.charAt(0);
        const numero = parseInt(cid.substring(1, 3)) || 0;

        // Lógica simplificada de mapeamento CID-10
        if (['F', 'H', 'G43', 'G44', 'J00', 'J01', 'J30'].some(p => cid.startsWith(p)) || (letra === 'S' && numero >= 0 && numero <= 9)) part = 'head';
        else if (['I', 'J', 'K', 'N', 'M54'].some(p => cid.startsWith(p)) || (letra === 'S' && numero >= 20 && numero <= 39)) part = 'torso';
        else if (['M65', 'M75', 'M77'].some(p => cid.startsWith(p)) || (letra === 'S' && numero >= 40 && numero <= 69)) part = 'arms';
        else if (['M17', 'M25', 'I83'].some(p => cid.startsWith(p)) || (letra === 'S' && numero >= 70 && numero <= 99)) part = 'legs';

        bodyStats[part].count++;
        bodyStats[part].cids[cid] = (bodyStats[part].cids[cid] || 0) + 1;
    });

    // 2. Definir cores baseadas na incidência
    const getColor = (count) => {
        if (count === 0) return '#e9ecef'; // Cinza claro
        if (count <= 5) return '#ffeeba'; // Amarelo claro
        if (count <= 15) return '#ffc107'; // Amarelo
        if (count <= 30) return '#fd7e14'; // Laranja
        return '#dc3545'; // Vermelho
    };

    // 3. SVG do Corpo Humano (Silhueta Simplificada)
    const svgContent = `
    <svg viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg" style="height: 100%; width: auto; max-width: 100%;">
        <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
        </defs>
        
        <!-- Cabeça -->
        <path id="body-head" d="M100,10 C85,10 75,25 75,40 C75,55 85,65 100,65 C115,65 125,55 125,40 C125,25 115,10 100,10 Z" 
              fill="${getColor(bodyStats.head.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="head" />
        
        <!-- Tronco -->
        <path id="body-torso" d="M80,65 L120,65 L135,80 L130,180 L70,180 L65,80 Z" 
              fill="${getColor(bodyStats.torso.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="torso" />
        
        <!-- Braço Esquerdo (Visão Frontal - Direita do SVG) -->
        <path id="body-arm-l" d="M135,80 L160,90 L170,160 L155,165 L130,180" 
              fill="${getColor(bodyStats.arms.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="arms" />
        
        <!-- Braço Direito (Visão Frontal - Esquerda do SVG) -->
        <path id="body-arm-r" d="M65,80 L40,90 L30,160 L45,165 L70,180" 
              fill="${getColor(bodyStats.arms.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="arms" />
        
        <!-- Perna Esquerda -->
        <path id="body-leg-l" d="M100,180 L130,180 L125,300 L135,380 L105,380 L100,250" 
              fill="${getColor(bodyStats.legs.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="legs" />
        
        <!-- Perna Direita -->
        <path id="body-leg-r" d="M100,180 L70,180 L75,300 L65,380 L95,380 L100,250" 
              fill="${getColor(bodyStats.legs.count)}" stroke="#6c757d" stroke-width="1" 
              class="body-part" data-part="legs" />
    </svg>
    `;

    container.innerHTML = svgContent;

    // 4. Atualizar Legenda
    legend.innerHTML = `
        <div class="fw-bold mb-1">Incidência</div>
        <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#e9ecef;margin-right:5px;border:1px solid #ccc"></span> 0</div>
        <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#ffeeba;margin-right:5px;border:1px solid #ccc"></span> 1-5</div>
        <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#ffc107;margin-right:5px;border:1px solid #ccc"></span> 6-15</div>
        <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#fd7e14;margin-right:5px;border:1px solid #ccc"></span> 16-30</div>
        <div class="d-flex align-items-center"><span style="width:12px;height:12px;background:#dc3545;margin-right:5px;border:1px solid #ccc"></span> >30</div>
        <div class="mt-2 pt-1 border-top"><small>Sistêmico: <strong>${bodyStats.systemic.count}</strong></small></div>
    `;

    // 5. Interatividade (Tooltip)
    const parts = container.querySelectorAll('.body-part');
    parts.forEach(part => {
        part.style.cursor = 'pointer';
        part.style.transition = 'opacity 0.2s';

        part.addEventListener('mouseenter', (e) => {
            const partName = e.target.dataset.part;
            const data = bodyStats[partName];
            const topCids = Object.entries(data.cids)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([cid, qtd]) => `${cid} (${qtd})`)
                .join(', ');

            e.target.style.opacity = '0.7';
            
            tooltip.innerHTML = `
                <strong>Região: ${traduzirRegiao(partName)}</strong><br>
                Total: ${data.count}<br>
                ${topCids ? 'Top CIDs: ' + topCids : ''}
            `;
            tooltip.style.display = 'block';
        });

        part.addEventListener('mousemove', (e) => {
            // Ajuste para posicionar o tooltip relativo ao container ou mouse
            // Usando coordenadas do mouse relativas à viewport para simplicidade
            const rect = container.getBoundingClientRect();
            tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
            tooltip.style.top = (e.clientY - rect.top - 30) + 'px';
        });

        part.addEventListener('mouseleave', (e) => {
            e.target.style.opacity = '1';
            tooltip.style.display = 'none';
        });
    });
}

function traduzirRegiao(part) {
    const map = {
        'head': 'Cabeça/Pescoço',
        'torso': 'Tronco/Costas',
        'arms': 'Membros Superiores',
        'legs': 'Membros Inferiores',
        'systemic': 'Sistêmico/Geral'
    };
    return map[part] || part;
}

function gerarInsightsIA(atestados) {
    const container = document.getElementById('analise-atestados-insights-ia');
    if (!container) return;

    if (atestados.length === 0) {
        container.innerHTML = '<p class="text-muted">Sem dados suficientes para análise.</p>';
        return;
    }

    // Simulação de análise
    let html = '<ul class="list-unstyled">';
    
    // Análise de CIDs recorrentes
    const cids = {};
    atestados.forEach(a => cids[a.cid] = (cids[a.cid] || 0) + 1);
    const topCid = Object.entries(cids).sort((a, b) => b[1] - a[1])[0];

    if (topCid) {
        html += `<li class="mb-2"><i class="fas fa-notes-medical text-primary me-2"></i> O CID mais frequente é <strong>${topCid[0]}</strong> com ${topCid[1]} ocorrências.</li>`;
    }

    // Análise de dias da semana (ex: muitas faltas na segunda-feira)
    const diasSemana = [0,0,0,0,0,0,0];
    atestados.forEach(a => {
        const d = a.data_atestado?.toDate ? a.data_atestado.toDate() : new Date(a.data_atestado);
        diasSemana[d.getDay()]++;
    });
    
    if (diasSemana[1] > (atestados.length * 0.3)) { // Se > 30% na segunda-feira
        html += `<li class="mb-2"><i class="fas fa-calendar-day text-warning me-2"></i> <strong>Alerta:</strong> Alta concentração de atestados às segundas-feiras.</li>`;
    }

    html += '</ul>';
    container.innerHTML = html;
}

function exportarMapaCorporal() {
    const svg = document.querySelector('#body-map-container svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    // Adiciona fundo branco (SVG transparente por padrão)
    canvas.width = 400;
    canvas.height = 500;
    
    img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 400, 500);
        
        const link = document.createElement('a');
        link.download = 'mapa_corporal_atestados.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// Exportar funções globais
window.inicializarAnaliseAtestados = inicializarAnaliseAtestados;
window.carregarDashboardAtestados = carregarDashboardAtestados;
window.exportarMapaCorporal = exportarMapaCorporal;