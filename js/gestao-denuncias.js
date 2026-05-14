/**
 * Lógica do Painel de Gestão de Denúncias
 */

let denunciasAtuais = [];
let denunciaSelecionadaId = null;

async function initGestaoDenuncias() {
    await carregarDenuncias();
    configurarEventosGestaoDenuncias();
}

async function carregarDenuncias() {
    const tbody = document.getElementById('tbody-denuncias');
    if (!tbody) return;

    try {
        const snapshot = await db.collection('denuncias').orderBy('dataCriacao', 'desc').get();
        
        denunciasAtuais = [];
        let html = '';
        
        let countTotal = 0;
        let countAnalise = 0;
        let countAndamento = 0;
        let countConcluido = 0;

        if (snapshot.empty) {
            html = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhuma denúncia ou relato encontrado.</td></tr>`;
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                denunciasAtuais.push(data);
                
                // Contagens
                countTotal++;
                if (data.status === 'Em Análise') countAnalise++;
                if (data.status === 'Em Andamento') countAndamento++;
                if (data.status === 'Concluído' || data.status === 'Resolvido') countConcluido++;
                
                // Formatação
                let badgeClass = 'bg-secondary';
                if (data.status === 'Em Análise') badgeClass = 'bg-warning text-dark';
                if (data.status === 'Em Andamento') badgeClass = 'bg-info text-white';
                if (data.status === 'Concluído') badgeClass = 'bg-success text-white';
                if (data.status === 'Improcedente') badgeClass = 'bg-danger text-white';
                
                let tipoFormatado = String(data.tipoRelato).replace('_', ' ');
                let dataFormatada = '-';
                if (data.dataCriacao) {
                    const dataObj = data.dataCriacao.toDate();
                    dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                }
                
                let infoIdentificacao = data.identificacao === 'anonimo' 
                    ? '<span class="text-muted"><i class="fas fa-user-secret me-1"></i> Anônimo</span>' 
                    : `<span class="text-primary"><i class="fas fa-user me-1"></i> ${data.dadosPessoais?.nome || 'Identificado'}</span>`;

                html += `
                    <tr>
                        <td class="ps-4 fw-bold text-primary">${data.protocolo}</td>
                        <td>${dataFormatada}</td>
                        <td class="text-capitalize">${tipoFormatado}</td>
                        <td>${infoIdentificacao}</td>
                        <td><span class="badge ${badgeClass} rounded-pill px-3 py-1">${data.status || 'Em Análise'}</span></td>
                        <td class="text-end pe-4">
                            <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="abrirDetalhesDenuncia('${doc.id}')">
                                <i class="fas fa-search me-1"></i> Analisar
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        tbody.innerHTML = html;
        
        // Atualizar cards
        document.getElementById('count-total-denuncias').innerText = countTotal;
        document.getElementById('count-analise').innerText = countAnalise;
        document.getElementById('count-andamento').innerText = countAndamento;
        document.getElementById('count-concluido').innerText = countConcluido;

    } catch (error) {
        console.error("Erro ao carregar denúncias:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle me-2"></i> Erro ao carregar dados.</td></tr>`;
    }
}

function abrirDetalhesDenuncia(id) {
    const relato = denunciasAtuais.find(d => d.id === id);
    if (!relato) return;
    
    denunciaSelecionadaId = id;
    
    // Preencher dados básicos
    document.getElementById('detalhe-protocolo').innerText = relato.protocolo;
    
    // Status
    const statusBadge = document.getElementById('detalhe-status');
    statusBadge.innerText = relato.status || 'Em Análise';
    statusBadge.className = 'badge rounded-pill px-3 py-2 ';
    if (relato.status === 'Em Análise') statusBadge.classList.add('bg-warning', 'text-dark');
    else if (relato.status === 'Em Andamento') statusBadge.classList.add('bg-info', 'text-white');
    else if (relato.status === 'Concluído') statusBadge.classList.add('bg-success', 'text-white');
    else if (relato.status === 'Improcedente') statusBadge.classList.add('bg-danger', 'text-white');
    else statusBadge.classList.add('bg-secondary', 'text-white');
    
    // Data
    let dataFormatada = '-';
    if (relato.dataCriacao) {
        const d = relato.dataCriacao.toDate();
        dataFormatada = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
    }
    document.getElementById('detalhe-data').innerText = dataFormatada;
    document.getElementById('detalhe-tipo').innerText = String(relato.tipoRelato).replace('_', ' ');
    
    // Identificação
    if (relato.identificacao === 'anonimo') {
        document.getElementById('detalhe-identificacao-tipo').innerHTML = '<i class="fas fa-user-secret me-2"></i> Relato Anônimo';
        document.getElementById('detalhe-dados-pessoais').style.display = 'none';
    } else {
        document.getElementById('detalhe-identificacao-tipo').innerHTML = '<i class="fas fa-user me-2 text-primary"></i> Relato Identificado';
        document.getElementById('detalhe-dados-pessoais').style.display = 'block';
        
        document.getElementById('detalhe-nome').innerText = relato.dadosPessoais?.nome || '-';
        document.getElementById('detalhe-setor').innerText = relato.dadosPessoais?.setor || '-';
        document.getElementById('detalhe-email').innerText = relato.dadosPessoais?.email || '-';
        document.getElementById('detalhe-telefone').innerText = relato.dadosPessoais?.telefone || '-';
    }
    
    // Descrição
    document.getElementById('detalhe-descricao').innerText = relato.descricao || '';
    
    // Select de status
    document.getElementById('select-mudar-status').value = relato.status || 'Em Análise';
    
    // Respostas
    renderizarRespostas(relato.respostas || []);
    
    // Mostrar Modal
    const modal = new bootstrap.Modal(document.getElementById('modal-detalhes-denuncia'));
    modal.show();
}

function renderizarRespostas(respostas) {
    const container = document.getElementById('container-respostas');
    if (!respostas || respostas.length === 0) {
        container.innerHTML = '<p class="text-muted small italic">Nenhuma interação registrada até o momento.</p>';
        return;
    }
    
    let html = '';
    respostas.forEach(resp => {
        let dataResp = '-';
        if (resp.data) {
             const d = resp.data.toDate ? resp.data.toDate() : new Date(resp.data);
             dataResp = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        }
        
        html += `
            <div class="mb-3 p-3 bg-white border border-start border-4 border-primary rounded shadow-sm">
                <div class="d-flex justify-content-between mb-2">
                    <span class="fw-bold text-primary"><i class="fas fa-user-shield me-1"></i> Comitê de Ética</span>
                    <small class="text-muted">${dataResp}</small>
                </div>
                <p class="mb-0 text-break" style="white-space: pre-wrap;">${resp.texto}</p>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function configurarEventosGestaoDenuncias() {
    const formResposta = document.getElementById('form-nova-resposta');
    if (formResposta) {
        // Clone e recoloque para evitar listeners duplicados em reload dinâmico
        const novoForm = formResposta.cloneNode(true);
        formResposta.parentNode.replaceChild(novoForm, formResposta);
        
        novoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!denunciaSelecionadaId) return;
            
            const btn = document.getElementById('btn-salvar-resposta');
            const textoResposta = document.getElementById('nova-resposta-texto').value.trim();
            const novoStatus = document.getElementById('select-mudar-status').value;
            
            if (!textoResposta && novoStatus === document.getElementById('detalhe-status').innerText) {
                Swal.fire('Atenção', 'Digite uma resposta ou altere o status para salvar.', 'warning');
                return;
            }
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';
            
            try {
                const relatoRef = db.collection('denuncias').doc(denunciaSelecionadaId);
                const relatoDoc = await relatoRef.get();
                
                let atualizacoes = {
                    status: novoStatus
                };
                
                if (textoResposta) {
                    const respostasAtuais = relatoDoc.data().respostas || [];
                    respostasAtuais.push({
                        texto: textoResposta,
                        data: new Date()
                    });
                    atualizacoes.respostas = respostasAtuais;
                }
                
                await relatoRef.update(atualizacoes);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Atualizado',
                    text: 'O relato foi atualizado com sucesso.',
                    timer: 1500,
                    showConfirmButton: false
                });
                
                document.getElementById('nova-resposta-texto').value = '';
                
                // Fechar modal
                bootstrap.Modal.getInstance(document.getElementById('modal-detalhes-denuncia')).hide();
                
                // Recarregar
                carregarDenuncias();
                
            } catch (error) {
                console.error("Erro ao salvar atualização:", error);
                Swal.fire('Erro', 'Ocorreu um erro ao atualizar o relato.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Salvar e Notificar';
            }
        });
    }
}
