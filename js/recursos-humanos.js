let mbtiEquipeList = [];

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
