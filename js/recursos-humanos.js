let mbtiEquipeList = [];
let chartMbtiMacro = null;

async function initRecursosHumanos() {
    await carregarMBTIEquipe();
}

async function carregarMBTIEquipe() {
    const tbody = document.getElementById('lista-mbti-equipe');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div><br>Buscando testes...</td></tr>';
    
    try {
        const snapshot = await db.collection('equipe_mbti').orderBy('dataTeste', 'desc').get();
        mbtiEquipeList = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            mbtiEquipeList.push(data);
        });
        
        document.getElementById('mbti-total-testes').textContent = mbtiEquipeList.length;
        renderizarTabelaMBTIEquipe(mbtiEquipeList);
        renderizarMatrizGerentes();
        renderizarMapaVisualCorporativo();
        
    } catch (error) {
        console.error("Erro ao buscar testes MBTI:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Erro ao buscar resultados. Verifique suas permissões.</td></tr>';
    }
}

function renderizarTabelaMBTIEquipe(lista) {
    const tbody = document.getElementById('lista-mbti-equipe');
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum teste registrado para a equipe até o momento.</td></tr>';
        return;
    }
    
    lista.forEach(item => {
        let statusBadge = '';
        let acoesBtn = '';
        let dataStr = '';

        if (item.status === 'Pendente') {
            statusBadge = '<span class="badge bg-warning text-dark"><i class="fas fa-clock"></i> Pendente</span>';
            dataStr = `<div class="small text-muted">Criado em: ${item.dataCriacao ? new Date(item.dataCriacao.toDate()).toLocaleDateString('pt-BR') : '-'}</div>`;
            acoesBtn = `
                <button class="btn btn-sm btn-outline-secondary me-1" onclick="reenviarLinkConvite('${item.id}')" title="Copiar Link">
                    <i class="fas fa-link"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluirConvite('${item.id}')" title="Cancelar Convite">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else {
            statusBadge = '<span class="badge bg-success"><i class="fas fa-check"></i> Concluído</span>';
            dataStr = `<div class="small text-muted">Feito em: ${item.dataTeste ? new Date(item.dataTeste.toDate()).toLocaleDateString('pt-BR') : '-'}</div>`;
            acoesBtn = `
                <button class="btn btn-sm btn-outline-info" onclick='verDetalhesMBTI(${JSON.stringify(item).replace(/'/g, "&apos;")})' title="Ver Detalhes">
                    <i class="fas fa-eye"></i> Detalhes
                </button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="excluirConvite('${item.id}')" title="Excluir Resultado">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        let toggleGerente = '-';
        if (item.status === 'Concluído' && item.mbti) {
            const isGerente = item.isGerente === true ? 'checked' : '';
            toggleGerente = `
                <div class="form-check form-switch d-flex justify-content-center">
                    <input class="form-check-input cursor-pointer" type="checkbox" onchange="marcarComoGerente('${item.id}', this.checked)" ${isGerente}>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">${statusBadge} ${dataStr}</td>
            <td class="fw-bold">${item.nome || 'N/A'}</td>
            <td>${item.mbti ? `<span class="badge bg-primary fs-6">${item.mbti.perfil}</span>` : '-'}</td>
            <td>${item.mbti ? item.mbti.grupo : '-'}</td>
            <td class="text-center">${toggleGerente}</td>
            <td class="text-center">
                ${acoesBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarMBTIEquipe() {
    const termo = document.getElementById('pesquisa-mbti-equipe').value.toLowerCase();
    const filtrado = mbtiEquipeList.filter(item => 
        (item.nome && item.nome.toLowerCase().includes(termo))
    );
    renderizarTabelaMBTIEquipe(filtrado);
}

function verDetalhesMBTI(item) {
    document.getElementById('detalhe-mbti-nome').textContent = item.nome;
    document.getElementById('detalhe-mbti-data').textContent = item.dataTeste ? new Date(item.dataTeste.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
    
    if (item.mbti) {
        document.getElementById('detalhe-mbti-tipo').textContent = item.mbti.perfil;
        document.getElementById('detalhe-mbti-titulo').textContent = item.mbti.titulo;
        document.getElementById('detalhe-mbti-grupo').textContent = item.mbti.grupo;
        document.getElementById('detalhe-mbti-desc').textContent = item.mbti.descricao;
        
        // Pega as profissões estáticas do arquivo mbti.js (acessível via mbtiData se importado, 
        // ou usa fallback)
        let profissoesStr = "Profissões não especificadas para este perfil.";
        if (typeof mbtiData !== 'undefined' && mbtiData.results[item.mbti.perfil]) {
            profissoesStr = mbtiData.results[item.mbti.perfil].profissoes || profissoesStr;
        }
        document.getElementById('detalhe-mbti-profissoes').textContent = profissoesStr;

    } else {
        document.getElementById('detalhe-mbti-tipo').textContent = "Pendente";
        document.getElementById('detalhe-mbti-titulo').textContent = "";
        document.getElementById('detalhe-mbti-grupo').textContent = "";
        document.getElementById('detalhe-mbti-desc').textContent = "Teste não concluído.";
        document.getElementById('detalhe-mbti-profissoes').textContent = "-";
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modal-mbti-detalhes'));
    modal.show();
}

async function abrirModalGerarConvite() {
    document.getElementById('area-link-gerado').classList.remove('d-none');
    
    // O link é genérico, sem token
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'mbti-equipe.html';
    document.getElementById('convite-link').value = url;
    
    const modal = new bootstrap.Modal(document.getElementById('modal-gerar-convite'));
    modal.show();
}

function copiarLinkConvite() {
    const linkInput = document.getElementById('convite-link');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    try {
        document.execCommand('copy');
        mostrarMensagem('Link copiado para a área de transferência!', 'success');
    } catch (err) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
            mostrarMensagem('Link copiado para a área de transferência!', 'success');
        });
    }
}

function reenviarLinkConvite(id) {
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'mbti-equipe.html?t=' + id;
    navigator.clipboard.writeText(url).then(() => {
        mostrarMensagem('Link copiado para a área de transferência!', 'success');
    });
}

async function excluirConvite(id) {
    if (confirm("Deseja realmente excluir este registro?")) {
        try {
            await db.collection('equipe_mbti').doc(id).delete();
            mostrarMensagem('Registro excluído com sucesso.', 'success');
            carregarMBTIEquipe();
        } catch (error) {
            mostrarMensagem('Erro ao cancelar convite.', 'error');
        }
    }
}

async function marcarComoGerente(id, isGerente) {
    try {
        await db.collection('equipe_mbti').doc(id).update({
            isGerente: isGerente
        });
        
        // Atualiza a lista na memória
        const idx = mbtiEquipeList.findIndex(x => x.id === id);
        if (idx !== -1) {
            mbtiEquipeList[idx].isGerente = isGerente;
        }
        
        // Atualiza apenas a matriz para não piscar a tabela inteira
        renderizarMatrizGerentes();
        mostrarMensagem('Cargo de gerência atualizado.', 'success');
    } catch (error) {
        console.error("Erro ao marcar gerente:", error);
        mostrarMensagem('Erro ao atualizar gerente.', 'error');
        // Reverte visualmente em caso de erro
        carregarMBTIEquipe();
    }
}

function renderizarMatrizGerentes() {
    const container = document.getElementById('matriz-gerentes-container');
    const gerentes = mbtiEquipeList.filter(x => x.isGerente === true && x.mbti);
    
    if (gerentes.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">Nenhum gerente marcado ainda. Marque na tabela abaixo os colaboradores que atuam como gerentes.</div>';
        return;
    }
    
    // Conta quantos de cada tipo
    const contagem = {};
    gerentes.forEach(g => {
        const perfil = g.mbti.perfil;
        contagem[perfil] = (contagem[perfil] || 0) + 1;
    });
    
    // Transforma em array e ordena do mais comum para o menos comum
    const arrContagem = Object.keys(contagem).map(perfil => ({
        perfil: perfil,
        total: contagem[perfil],
        percent: Math.round((contagem[perfil] / gerentes.length) * 100)
    })).sort((a, b) => b.total - a.total);
    
    let html = '';
    arrContagem.forEach(item => {
        html += `
            <div class="col-md-3 mb-3">
                <div class="card h-100 border-success shadow-sm">
                    <div class="card-body text-center">
                        <h2 class="fw-bold text-success mb-0">${item.perfil}</h2>
                        <div class="display-5 fw-bold text-dark mt-2">${item.total}</div>
                        <div class="text-muted small">Gerentes (${item.percent}%)</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderizarMapaVisualCorporativo() {
    const testes = mbtiEquipeList.filter(x => x.status === 'Concluído' && x.mbti);
    const containerMapa = document.getElementById('heatmap-mbti-container');
    const ctxMacro = document.getElementById('chart-mbti-macro');
    
    if (testes.length === 0) {
        if(containerMapa) containerMapa.innerHTML = '<div class="col-12 text-center text-muted py-5">Aguardando conclusões de testes...</div>';
        return;
    }
    
    // Contagem Grupos
    const contagemGrupos = {
        "Os Administradores": 0,
        "Os Pesquisadores": 0,
        "Os Idealistas": 0,
        "Os Ativos": 0
    };
    
    // Contagem Perfis (16)
    const contagemPerfis = {};
    const perfisOrdenados = [
        "INTJ", "INTP", "ENTJ", "ENTP",
        "INFJ", "INFP", "ENFJ", "ENFP",
        "ISTJ", "ISFJ", "ESTJ", "ESFJ",
        "ISTP", "ISFP", "ESTP", "ESFP"
    ];
    
    perfisOrdenados.forEach(p => contagemPerfis[p] = 0);
    
    testes.forEach(t => {
        if(contagemGrupos[t.mbti.grupo] !== undefined) {
            contagemGrupos[t.mbti.grupo]++;
        }
        if(contagemPerfis[t.mbti.perfil] !== undefined) {
            contagemPerfis[t.mbti.perfil]++;
        }
    });

    // 1. Chart
    if (chartMbtiMacro) {
        chartMbtiMacro.destroy();
    }
    
    if (ctxMacro) {
        chartMbtiMacro = new Chart(ctxMacro, {
            type: 'doughnut',
            data: {
                labels: ['Administradores', 'Pesquisadores', 'Idealistas', 'Ativos'],
                datasets: [{
                    data: [
                        contagemGrupos["Os Administradores"],
                        contagemGrupos["Os Pesquisadores"],
                        contagemGrupos["Os Idealistas"],
                        contagemGrupos["Os Ativos"]
                    ],
                    backgroundColor: ['#0d6efd', '#6610f2', '#198754', '#fd7e14'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                },
                cutout: '70%'
            }
        });
    }

    // 2. Heatmap
    if (containerMapa) {
        const maxVal = Math.max(...Object.values(contagemPerfis), 1);
        
        let html = '';
        perfisOrdenados.forEach(perfil => {
            const qtd = contagemPerfis[perfil];
            const hasPeople = qtd > 0;
            const alpha = hasPeople ? (0.3 + (qtd / maxVal) * 0.7) : 0; 
            
            let colorRgb = '13, 110, 253'; 
            let fontColor = hasPeople ? '#fff' : '#6c757d';
            let groupName = "";
            
            if (["INTJ", "INTP", "ENTJ", "ENTP"].includes(perfil)) {
                colorRgb = '102, 16, 242'; // Roxo
                groupName = "Pesquisadores";
            } else if (["INFJ", "INFP", "ENFJ", "ENFP"].includes(perfil)) {
                colorRgb = '25, 135, 84'; // Verde
                groupName = "Idealistas";
            } else if (["ISTJ", "ISFJ", "ESTJ", "ESFJ"].includes(perfil)) {
                colorRgb = '13, 110, 253'; // Azul
                groupName = "Administradores";
            } else if (["ISTP", "ISFP", "ESTP", "ESFP"].includes(perfil)) {
                colorRgb = '253, 126, 20'; // Laranja
                groupName = "Ativos";
            }

            const bgColor = hasPeople ? `rgba(${colorRgb}, ${alpha})` : '#f8f9fa';
            const borderStyle = hasPeople ? 'border: none;' : 'border: 1px dashed #dee2e6;';
            const badgeStr = hasPeople ? `<span class="badge bg-white text-dark rounded-pill mt-1 shadow-sm" style="font-size: 0.75rem;">${qtd}</span>` : '';

            html += `
                <div class="col-3">
                    <div class="card h-100 shadow-sm" style="background-color: ${bgColor}; ${borderStyle} transition: 0.3s; cursor: default;" title="${groupName} - ${qtd} pessoa(s)">
                        <div class="card-body p-2 d-flex flex-column align-items-center justify-content-center" style="min-height: 80px;">
                            <h5 class="mb-0 fw-bold" style="color: ${fontColor};">${perfil}</h5>
                            ${badgeStr}
                        </div>
                    </div>
                </div>
            `;
        });

        containerMapa.innerHTML = html;
    }
}
