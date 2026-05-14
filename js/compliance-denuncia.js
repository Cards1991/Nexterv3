/**
 * Canal de Transparência e Denúncias - Lógica de UI e Firebase
 */

// Funções de navegação da UI
function abrirFazerRelato() {
    document.getElementById('secao-inicio-denuncias').style.display = 'none';
    document.getElementById('secao-acompanhar-relato').style.display = 'none';
    
    const secaoFazer = document.getElementById('secao-fazer-relato');
    secaoFazer.style.display = 'block';
    secaoFazer.classList.add('animate-fade-in');
}

function abrirAcompanharRelato() {
    document.getElementById('secao-inicio-denuncias').style.display = 'none';
    document.getElementById('secao-fazer-relato').style.display = 'none';
    
    const secaoAcompanhar = document.getElementById('secao-acompanhar-relato');
    secaoAcompanhar.style.display = 'block';
    secaoAcompanhar.classList.add('animate-fade-in');
}

function voltarParaInicioDenuncias() {
    document.getElementById('secao-fazer-relato').style.display = 'none';
    document.getElementById('secao-acompanhar-relato').style.display = 'none';
    
    const secaoInicio = document.getElementById('secao-inicio-denuncias');
    secaoInicio.style.display = 'grid'; // because it's a grid container
    secaoInicio.classList.add('animate-fade-in');
    
    // Limpar formulários
    document.getElementById('form-denuncia').reset();
    document.getElementById('form-acompanhar-relato').reset();
    document.getElementById('resultado-busca-relato').style.display = 'none';
    toggleIdentificacao();
}

function toggleIdentificacao() {
    const selecao = document.getElementById('identificacao-relato').value;
    const dadosIdentificacao = document.getElementById('dados-identificacao');
    
    if (selecao === 'identificado') {
        dadosIdentificacao.style.display = 'block';
        dadosIdentificacao.classList.add('animate-fade-in');
    } else {
        dadosIdentificacao.style.display = 'none';
    }
}

function gerarProtocolo() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `DN-${ano}${mes}${dia}-${random}`;
}

function copiarProtocolo() {
    const protocolo = document.getElementById('protocolo-gerado').innerText;
    navigator.clipboard.writeText(protocolo).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'Copiado!',
            text: 'Número de protocolo copiado para a área de transferência.',
            timer: 1500,
            showConfirmButton: false
        });
    });
}

// Inicialização e Event Listeners
function initComplianceDenuncia() {
    const formDenuncia = document.getElementById('form-denuncia');
    if (formDenuncia) {
        // Remover listener antigo se existir para evitar duplicidade
        const newFormDenuncia = formDenuncia.cloneNode(true);
        formDenuncia.parentNode.replaceChild(newFormDenuncia, formDenuncia);
        
        newFormDenuncia.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnEnviar = document.getElementById('btn-enviar-relato');
            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Enviando...';
            
            try {
                const tipoRelato = document.getElementById('tipo-relato').value;
                const identificacao = document.getElementById('identificacao-relato').value;
                const descricao = document.getElementById('descricao-relato').value;
                
                let dadosPessoais = null;
                if (identificacao === 'identificado') {
                    dadosPessoais = {
                        nome: document.getElementById('nome-denunciante').value,
                        setor: document.getElementById('setor-denunciante').value,
                        email: document.getElementById('email-denunciante').value,
                        telefone: document.getElementById('telefone-denunciante').value
                    };
                }
                
                const protocolo = gerarProtocolo();
                
                // Salvar no Firebase
                await db.collection('denuncias').add({
                    protocolo: protocolo,
                    tipoRelato: tipoRelato,
                    identificacao: identificacao,
                    dadosPessoais: dadosPessoais,
                    descricao: descricao,
                    dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'Em Análise',
                    respostas: []
                });
                
                // Mostrar protocolo
                document.getElementById('protocolo-gerado').innerText = protocolo;
                
                // Mostrar modal
                const modal = new bootstrap.Modal(document.getElementById('modal-protocolo'));
                modal.show();
                
                newFormDenuncia.reset();
                toggleIdentificacao();
                
            } catch (error) {
                console.error("Erro ao enviar relato:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Ocorreu um erro ao enviar seu relato. Tente novamente mais tarde.'
                });
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="fas fa-paper-plane me-2"></i> Enviar Relato Confidencial';
            }
        });
    }

    const formAcompanhar = document.getElementById('form-acompanhar-relato');
    if (formAcompanhar) {
        // Remover listener antigo se existir
        const newFormAcompanhar = formAcompanhar.cloneNode(true);
        formAcompanhar.parentNode.replaceChild(newFormAcompanhar, formAcompanhar);
        
        newFormAcompanhar.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnBuscar = document.getElementById('btn-buscar-protocolo');
            const protocoloInput = document.getElementById('input-protocolo-busca').value.trim().toUpperCase();
            
            if (!protocoloInput) return;
            
            btnBuscar.disabled = true;
            btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            try {
                const snapshot = await db.collection('denuncias').where('protocolo', '==', protocoloInput).get();
                
                if (snapshot.empty) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Não Encontrado',
                        text: 'Nenhum relato encontrado com este número de protocolo. Verifique e tente novamente.'
                    });
                    document.getElementById('resultado-busca-relato').style.display = 'none';
                } else {
                    const relatoDoc = snapshot.docs[0];
                    const relato = relatoDoc.data();
                    
                    document.getElementById('res-protocolo').innerText = relato.protocolo;
                    
                    const statusBadge = document.getElementById('res-status');
                    statusBadge.innerText = relato.status;
                    
                    // Ajustar cor do badge baseado no status
                    statusBadge.className = 'badge rounded-pill px-3 py-2 fw-bold ';
                    if (relato.status === 'Em Análise') {
                        statusBadge.classList.add('bg-warning', 'text-dark');
                    } else if (relato.status === 'Concluído' || relato.status === 'Resolvido') {
                        statusBadge.classList.add('bg-success', 'text-white');
                    } else if (relato.status === 'Em Andamento') {
                        statusBadge.classList.add('bg-info', 'text-white');
                    } else {
                        statusBadge.classList.add('bg-secondary', 'text-white');
                    }
                    
                    // Formatar data
                    let dataFormatada = '--/--/----';
                    if (relato.dataCriacao) {
                        const data = relato.dataCriacao.toDate();
                        dataFormatada = data.toLocaleString('pt-BR');
                    }
                    document.getElementById('res-data-criacao').innerText = dataFormatada;
                    
                    // Mostrar respostas se houver
                    const timelineResposta = document.getElementById('timeline-resposta');
                    if (relato.respostas && relato.respostas.length > 0) {
                        const ultimaResposta = relato.respostas[relato.respostas.length - 1];
                        
                        let dataRespStr = '--/--/----';
                        if (ultimaResposta.data) {
                             const dataR = ultimaResposta.data.toDate ? ultimaResposta.data.toDate() : new Date(ultimaResposta.data);
                             dataRespStr = dataR.toLocaleString('pt-BR');
                        }
                        
                        document.getElementById('res-data-resposta').innerText = dataRespStr;
                        document.getElementById('res-texto-resposta').innerText = ultimaResposta.texto;
                        
                        timelineResposta.style.display = 'block';
                    } else {
                        timelineResposta.style.display = 'none';
                    }
                    
                    document.getElementById('resultado-busca-relato').style.display = 'block';
                    document.getElementById('resultado-busca-relato').classList.add('animate-fade-in');
                }
                
            } catch (error) {
                console.error("Erro ao buscar relato:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Erro ao consultar o protocolo. Tente novamente.'
                });
            } finally {
                btnBuscar.disabled = false;
                btnBuscar.innerText = 'Consultar';
            }
        });
    }
}
