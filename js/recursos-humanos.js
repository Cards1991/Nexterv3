let mbtiEquipeList = [];

async function initRecursosHumanos() {
    await carregarMBTIEquipe();
}

async function carregarMBTIEquipe() {
    const tbody = document.getElementById('lista-mbti-equipe');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div><br>Buscando testes...</td></tr>';
    
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
        
    } catch (error) {
        console.error("Erro ao buscar testes MBTI:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Erro ao buscar resultados. Verifique suas permissões.</td></tr>';
    }
}

function renderizarTabelaMBTIEquipe(lista) {
    const tbody = document.getElementById('lista-mbti-equipe');
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum teste registrado para a equipe até o momento.</td></tr>';
        return;
    }
    
    lista.forEach(item => {
        const dataTeste = item.dataTeste ? new Date(item.dataTeste.toDate()).toLocaleDateString('pt-BR') : 'N/A';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 text-muted">${dataTeste}</td>
            <td class="fw-bold">${item.nome || 'N/A'}</td>
            <td>${item.cpf || 'N/A'}</td>
            <td><span class="badge bg-primary fs-6">${item.mbti ? item.mbti.perfil : 'Pendente'}</span></td>
            <td>${item.mbti ? item.mbti.grupo : '-'}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-info" onclick='verDetalhesMBTI(${JSON.stringify(item).replace(/'/g, "&apos;")})' title="Ver Detalhes">
                    <i class="fas fa-eye"></i> Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarMBTIEquipe() {
    const termo = document.getElementById('pesquisa-mbti-equipe').value.toLowerCase();
    const filtrado = mbtiEquipeList.filter(item => 
        (item.nome && item.nome.toLowerCase().includes(termo)) || 
        (item.cpf && item.cpf.includes(termo))
    );
    renderizarTabelaMBTIEquipe(filtrado);
}

function verDetalhesMBTI(item) {
    document.getElementById('detalhe-mbti-nome').textContent = item.nome;
    document.getElementById('detalhe-mbti-cpf').textContent = item.cpf;
    document.getElementById('detalhe-mbti-data').textContent = item.dataTeste ? new Date(item.dataTeste.seconds * 1000).toLocaleDateString('pt-BR') : 'N/A';
    
    if (item.mbti) {
        document.getElementById('detalhe-mbti-tipo').textContent = item.mbti.perfil;
        document.getElementById('detalhe-mbti-titulo').textContent = item.mbti.titulo;
        document.getElementById('detalhe-mbti-grupo').textContent = item.mbti.grupo;
        document.getElementById('detalhe-mbti-desc').textContent = item.mbti.descricao;
    } else {
        document.getElementById('detalhe-mbti-tipo').textContent = "Pendente";
        document.getElementById('detalhe-mbti-titulo').textContent = "";
        document.getElementById('detalhe-mbti-grupo').textContent = "";
        document.getElementById('detalhe-mbti-desc').textContent = "Teste não concluído ou dados incompletos.";
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modal-mbti-detalhes'));
    modal.show();
}

function copiarLinkTeste() {
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'mbti-equipe.html';
    navigator.clipboard.writeText(url).then(() => {
        mostrarMensagem('Link do teste copiado para a área de transferência!', 'success');
    }).catch(err => {
        console.error('Erro ao copiar link:', err);
        mostrarMensagem('Erro ao copiar link. A URL é: ' + url, 'warning');
    });
}
