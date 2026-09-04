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
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">${statusBadge} ${dataStr}</td>
            <td class="fw-bold">${item.nome || 'N/A'}</td>
            <td><span class="badge bg-primary fs-6">${item.mbti ? item.mbti.perfil : '-'}</span></td>
            <td>${item.mbti ? item.mbti.grupo : '-'}</td>
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
    } else {
        document.getElementById('detalhe-mbti-tipo').textContent = "Pendente";
        document.getElementById('detalhe-mbti-titulo').textContent = "";
        document.getElementById('detalhe-mbti-grupo').textContent = "";
        document.getElementById('detalhe-mbti-desc').textContent = "Teste não concluído.";
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modal-mbti-detalhes'));
    modal.show();
}

async function abrirModalGerarConvite() {
    document.getElementById('area-link-gerado').classList.add('d-none');
    document.getElementById('btn-salvar-convite').style.display = 'block';
    
    // Carregar colaboradores se o select estiver vazio (apenas a opção padrão)
    const select = document.getElementById('convite-funcionario');
    if (select.options.length <= 1) {
        select.innerHTML = '<option value="">Carregando...</option>';
        try {
            const snap = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
            
            let funcionariosList = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.nome) {
                    funcionariosList.push({ id: doc.id, nome: data.nome });
                }
            });
            
            // Ordenar no cliente para evitar a necessidade de índice composto no Firestore
            funcionariosList.sort((a, b) => a.nome.localeCompare(b.nome));

            select.innerHTML = '<option value="">Selecione um colaborador...</option>';
            funcionariosList.forEach(f => {
                select.innerHTML += `<option value="${f.id}" data-nome="${f.nome}">${f.nome}</option>`;
            });
        } catch (error) {
            console.error("Erro ao buscar funcionários:", error);
            select.innerHTML = '<option value="">Erro ao carregar colaboradores</option>';
        }
    } else {
        select.value = '';
    }

    const modal = new bootstrap.Modal(document.getElementById('modal-gerar-convite'));
    modal.show();
}

async function gerarLinkConvite() {
    const select = document.getElementById('convite-funcionario');
    const funcionarioId = select.value;
    
    if (!funcionarioId) {
        mostrarMensagem('Selecione um colaborador.', 'warning');
        return;
    }
    
    const nome = select.options[select.selectedIndex].dataset.nome;

    const btn = document.getElementById('btn-salvar-convite');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

    try {
        // Cria o convite
        const docRef = await db.collection('equipe_mbti').add({
            nome: nome,
            funcionarioId: funcionarioId,
            status: 'Pendente',
            dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
        });

        const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'mbti-equipe.html?t=' + docRef.id;
        
        // Cria a tarefa na agenda para o próprio usuário criador
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            await db.collection('agenda_atividades').add({
                assunto: `Acompanhar Teste MBTI - ${nome}`,
                data: new Date(),
                tipo: 'Follow-up',
                descricao: `O colaborador ${nome} recebeu o convite para o teste MBTI. Acompanhar a conclusão do teste.\nLink enviado: ${url}`,
                status: 'Aberto',
                atribuidoParaId: currentUser.uid,
                atribuidoParaNome: currentUser.displayName || currentUser.email,
                criadoPor: currentUser.uid,
                criadoPorNome: currentUser.displayName || currentUser.email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        document.getElementById('convite-link').value = url;
        document.getElementById('area-link-gerado').classList.remove('d-none');
        btn.style.display = 'none';

        carregarMBTIEquipe();
    } catch (error) {
        console.error("Erro ao criar convite:", error);
        mostrarMensagem('Erro ao gerar convite.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Gerar Link';
    }
}

function copiarLinkConvite() {
    const url = document.getElementById('convite-link').value;
    navigator.clipboard.writeText(url).then(() => {
        mostrarMensagem('Link copiado para a área de transferência!', 'success');
    });
}

function reenviarLinkConvite(id) {
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'mbti-equipe.html?t=' + id;
    navigator.clipboard.writeText(url).then(() => {
        mostrarMensagem('Link copiado para a área de transferência!', 'success');
    });
}

async function excluirConvite(id) {
    if (confirm("Deseja realmente cancelar este convite?")) {
        try {
            await db.collection('equipe_mbti').doc(id).delete();
            mostrarMensagem('Convite cancelado.', 'success');
            carregarMBTIEquipe();
        } catch (error) {
            mostrarMensagem('Erro ao cancelar convite.', 'error');
        }
    }
}
