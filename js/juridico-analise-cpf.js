// js/juridico-consulta-cpf.js

// Variáveis globais
let __historico_analises_cache = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    inicializarAnaliseCPF();
    carregarHistoricoLocal();
});

async function inicializarAnaliseCPF() {
    console.log("Inicializando módulo de Análise de CPF...");

    // Adiciona listener para tecla Enter
    const cpfInput = document.getElementById('jur-cpf-numero');
    const nomeInput = document.getElementById('jur-cpf-nome');

    if (cpfInput) {
        cpfInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') executarAnaliseCPF();
        });
    }

    if (nomeInput) {
        nomeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') executarAnaliseCPF();
        });
    }
}

function mascaraCPF(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 9) {
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
    } else if (v.length > 6) {
        v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    } else if (v.length > 3) {
        v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    }

    input.value = v;
}

function mostrarMensagem(mensagem, tipo = 'info') {
    const toast = document.getElementById('liveToast');
    const toastBody = document.getElementById('toastMessage');

    if (!toast || !toastBody) {
        // Fallback para alert se toast não existir
        if (tipo === 'error') {
            alert('❌ ' + mensagem);
        } else if (tipo === 'warning') {
            alert('⚠️ ' + mensagem);
        } else {
            console.log(mensagem);
        }
        return;
    }

    toastBody.textContent = mensagem;

    // Mudar cor baseado no tipo
    const toastHeader = toast.querySelector('.toast-header');
    if (toastHeader) {
        toastHeader.className = 'toast-header';
        if (tipo === 'error') {
            toastHeader.classList.add('bg-danger', 'text-white');
        } else if (tipo === 'warning') {
            toastHeader.classList.add('bg-warning');
        } else {
            toastHeader.classList.add('bg-info', 'text-white');
        }

        setTimeout(() => {
            toastHeader.className = 'toast-header';
        }, 3000);
    }

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function abrirModalGenerico(titulo, conteudo) {
    const modal = document.getElementById('modalResultadoAnalise');
    const modalTitle = document.getElementById('modalResultadoLabel');
    const modalBody = document.getElementById('modalResultadoBody');

    if (!modal || !modalTitle || !modalBody) {
        console.error('Modal não encontrado');
        // Fallback: exibir em alert
        alert(titulo + '\n\n' + conteudo.replace(/<[^>]*>/g, ''));
        return;
    }

    modalTitle.textContent = titulo;
    modalBody.innerHTML = conteudo;

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function carregarHistoricoLocal() {
    try {
        const historico = localStorage.getItem('jur_cpf_historico');
        if (historico) {
            const items = JSON.parse(historico);
            items.forEach(item => adicionarAoHistoricoLocal(item, false));
        }
    } catch (e) {
        console.error('Erro ao carregar histórico:', e);
    }
}

function salvarHistoricoLocal(resultado) {
    try {
        let historico = localStorage.getItem('jur_cpf_historico');
        let items = historico ? JSON.parse(historico) : [];

        // Adicionar ao início e manter apenas últimos 20
        items.unshift({
            ...resultado,
            timestampSalvo: new Date().toISOString()
        });

        if (items.length > 20) items = items.slice(0, 20);

        localStorage.setItem('jur_cpf_historico', JSON.stringify(items));
    } catch (e) {
        console.error('Erro ao salvar histórico:', e);
    }
}

async function executarAnaliseCPF() {
    const cpfInput = document.getElementById('jur-cpf-numero');
    const nomeInput = document.getElementById('jur-cpf-nome');
    const abrangenciaSelect = document.getElementById('jur-cpf-abrangencia');
    const btn = document.querySelector('[onclick="executarAnaliseCPF()"]');
    const progressContainer = document.getElementById('analise-progress-container');
    const progressBar = document.getElementById('analise-progress-bar');
    const statusText = document.getElementById('analise-status-text');

    const cpf = cpfInput ? cpfInput.value.replace(/\D/g, '') : '';
    const nome = nomeInput ? nomeInput.value.trim() : '';
    const abrangencia = abrangenciaSelect ? abrangenciaSelect.value : 'nacional';

    // Validações
    if (cpf.length !== 11) {
        mostrarMensagem("CPF inválido. Digite 11 números.", "warning");
        cpfInput?.focus();
        return;
    }

    if (nome.length < 3) {
        mostrarMensagem("Nome completo é obrigatório para a busca judicial.", "warning");
        nomeInput?.focus();
        return;
    }

    // UI Loading
    if (btn) btn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '30%';
    if (progressBar) progressBar.textContent = '30%';
    if (statusText) statusText.textContent = 'Conectando ao servidor de análise...';

    try {
        // URL do backend
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        let API_URL = '/api/consultar-judicial';

        if (isLocal) {
            // Tentar backend na porta 3001
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);
                await fetch('http://localhost:3001/api/health', {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                API_URL = 'http://localhost:3001/api/consultar-judicial';
                console.log("Conectado ao Backend de Análise (3001)");
            } catch (e) {
                console.log("Backend 3001 indisponível, tentando 3000...");
                API_URL = 'http://localhost:3000/api/consultar-judicial';
            }
        }

        if (progressBar) progressBar.style.width = '60%';
        if (progressBar) progressBar.textContent = '60%';
        if (statusText) statusText.textContent = 'Enviando requisição...';

        // Obter usuário do Firebase se disponível
        let usuario = 'Anônimo';
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            usuario = firebase.auth().currentUser.email || firebase.auth().currentUser.displayName || 'Anônimo';
        }

        console.log(`Enviando requisição para: ${API_URL}`);

        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cpf,
                nome,
                abrangencia,
                usuario: usuario
            })
        });

        if (progressBar) progressBar.style.width = '80%';
        if (progressBar) progressBar.textContent = '80%';
        if (statusText) statusText.textContent = 'Processando resposta...';

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (progressBar) progressBar.style.width = '100%';
        if (progressBar) progressBar.textContent = '100%';

        if (data.success) {
            if (statusText) statusText.textContent = 'Concluído!';
            exibirResultadoAnalise(data.resultado);
            adicionarAoHistoricoLocal(data.resultado);
            atualizarScoreRisco(data.resultado);

            // Habilitar botão de exportar PDF
            const btnExportar = document.getElementById('btn-exportar-cpf-pdf');
            if (btnExportar) {
                btnExportar.disabled = false;
                btnExportar.onclick = () => exportarPDF(data.resultado);
            }

            mostrarMensagem("Consulta realizada com sucesso!", "success");
        } else {
            throw new Error(data.error || 'Erro desconhecido na análise');
        }

    } catch (error) {
        console.error("Erro na análise:", error);
        mostrarMensagem("Falha na consulta: " + error.message, "error");
        if (statusText) statusText.textContent = 'Erro na consulta.';
        if (progressBar) progressBar.classList.add('bg-danger');

        // Exibir erro no relatório
        exibirErroRelatorio(cpf, nome, error.message);

    } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                progressBar.classList.remove('bg-danger');
            }
        }, 3000);
    }
}

function exibirResultadoAnalise(resultado) {
    // Validar resultado
    if (!resultado) {
        console.error('Resultado inválido');
        return;
    }

    // Atualizar o relatório na página principal
    const containerRelatorio = document.getElementById('jur-cpf-resultado-relatorio');
    if (containerRelatorio) {
        const scoreClass = resultado.score_risco <= 30 ? 'success' : (resultado.score_risco <= 70 ? 'warning' : 'danger');

        let html = `
            <div class="alert alert-${scoreClass} mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <span><strong>Relatório de Consulta Completa por CPF</strong></span>
                    <span class="badge bg-light text-dark">${resultado.abrangencia || 'Consulta'}</span>
                </div>
                <p class="mb-0 mt-2">${resultado.observacao || 'Análise concluída com sucesso.'}</p>
            </div>

            <div class="row mb-3">
                <div class="col-md-6">
                    <p><strong>Nome:</strong> ${escapeHtml(resultado.nome)}</p>
                    <p><strong>CPF:</strong> ${formatarCPF(resultado.cpf)}</p>
                </div>
                <div class="col-md-6 text-end">
                    <p><small>${new Date(resultado.timestamp).toLocaleString('pt-BR')}</small></p>
                </div>
            </div>
            
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong>Score de Risco:</strong>
                    <span class="badge bg-${scoreClass} fs-6">${resultado.score_risco}%</span>
                </div>
                <div class="progress" style="height: 10px;">
                    <div class="progress-bar bg-${scoreClass}" style="width: ${resultado.score_risco}%"></div>
                </div>
            </div>

            <h6 class="border-bottom pb-2 mt-3">Relatório Estruturado</h6>
            <div class="bg-light p-3 rounded" style="font-family: monospace; white-space: pre-wrap; font-size: 0.9em; max-height: 400px; overflow-y: auto;">
                ${escapeHtml(resultado.relatorio || 'Relatório não disponível')}
            </div>

            <div class="mt-3 p-2 bg-light small text-muted border rounded">
                <i class="fas fa-info-circle"></i> ${escapeHtml(resultado.isencao || 'Este relatório é fornecido para fins informativos. Recomenda-se verificação adicional quando necessário.')}
            </div>
        `;

        containerRelatorio.innerHTML = html;
    }

    // Também abrir no modal para visualização detalhada
    const modalHtml = `
        <div class="alert alert-info mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <span><strong>Relatório de Consulta Completa por CPF</strong></span>
                <span class="badge bg-light text-dark">${resultado.abrangencia || 'Consulta'}</span>
            </div>
            <p class="mb-0 mt-2">${escapeHtml(resultado.observacao || 'Análise concluída com sucesso.')}</p>
        </div>

        <div class="row mb-3">
            <div class="col-md-6">
                <p><strong>Nome:</strong> ${escapeHtml(resultado.nome)}</p>
                <p><strong>CPF:</strong> ${formatarCPF(resultado.cpf)}</p>
            </div>
            <div class="col-md-6 text-end">
                <p><small>${new Date(resultado.timestamp).toLocaleString('pt-BR')}</small></p>
            </div>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>Score de Risco:</strong>
                <span class="badge bg-${resultado.score_risco <= 30 ? 'success' : (resultado.score_risco <= 70 ? 'warning' : 'danger')} fs-6">${resultado.score_risco}%</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar bg-${resultado.score_risco <= 30 ? 'success' : (resultado.score_risco <= 70 ? 'warning' : 'danger')}" style="width: ${resultado.score_risco}%"></div>
            </div>
        </div>

        <h6 class="border-bottom pb-2 mt-3">Relatório Estruturado</h6>
        <div class="bg-light p-3 rounded" style="font-family: monospace; white-space: pre-wrap; font-size: 0.9em; max-height: 500px; overflow-y: auto;">
            ${escapeHtml(resultado.relatorio || 'Relatório não disponível')}
        </div>

        <div class="mt-3 p-2 bg-light small text-muted border rounded">
            <i class="fas fa-info-circle"></i> ${escapeHtml(resultado.isencao || 'Este relatório é fornecido para fins informativos. Recomenda-se verificação adicional quando necessário.')}
        </div>
    `;

    abrirModalGenerico(`Relatório: ${resultado.nome}`, modalHtml);
}

function exibirErroRelatorio(cpf, nome, erro) {
    const containerRelatorio = document.getElementById('jur-cpf-resultado-relatorio');
    if (containerRelatorio) {
        containerRelatorio.innerHTML = `
            <div class="alert alert-danger mb-3">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Erro na Consulta</strong>
                <p class="mb-0 mt-2">${escapeHtml(erro)}</p>
            </div>
            <div class="row mb-3">
                <div class="col-md-6">
                    <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
                    <p><strong>CPF:</strong> ${formatarCPF(cpf)}</p>
                </div>
            </div>
            <div class="alert alert-warning">
                <i class="fas fa-info-circle"></i>
                Verifique sua conexão com a internet e tente novamente. Se o problema persistir, contate o suporte.
            </div>
        `;
    }
}

function atualizarScoreRisco(resultado) {
    const scoreDiv = document.getElementById('jur-cpf-score');
    const parecerDiv = document.getElementById('jur-cpf-parecer-ia');

    if (scoreDiv) {
        scoreDiv.textContent = `${resultado.score_risco}%`;
        const scoreClass = resultado.score_risco <= 30 ? 'text-success' : (resultado.score_risco <= 70 ? 'text-warning' : 'text-danger');
        scoreDiv.className = `display-1 fw-bold ${scoreClass}`;
    }

    if (parecerDiv) {
        let parecer = '';
        if (resultado.score_risco <= 30) {
            parecer = '✅ <strong>Baixo Risco:</strong> O candidato apresenta baixo risco reputacional. Recomenda-se prosseguir com o processo de contratação.';
        } else if (resultado.score_risco <= 70) {
            parecer = '⚠️ <strong>Risco Moderado:</strong> O candidato apresenta algumas inconsistências. Recomenda-se investigação adicional antes da decisão final.';
        } else {
            parecer = '❌ <strong>Alto Risco:</strong> O candidato apresenta alto risco reputacional. Recomenda-se cautela e análise aprofundada pela equipe jurídica.';
        }

        parecerDiv.innerHTML = `<i class="fas fa-robot me-2"></i> ${parecer}<br><small class="text-muted mt-2 d-block">Baseado em análise de dados públicos e restrições legais.</small>`;
    }
}

function adicionarAoHistoricoLocal(resultado, salvar = true) {
    const historicoContainer = document.getElementById('jur-cpf-historico');
    if (!historicoContainer) return;

    // Remover mensagem "Nenhuma consulta"
    if (historicoContainer.children.length === 1 && historicoContainer.children[0].textContent.includes('Nenhuma consulta')) {
        historicoContainer.innerHTML = '';
    }

    const dataStr = new Date(resultado.timestamp).toLocaleString('pt-BR');
    const scoreClass = resultado.score_risco <= 30 ? 'success' : (resultado.score_risco <= 70 ? 'warning' : 'danger');

    const item = document.createElement('div');
    item.className = 'list-group-item list-group-item-action';
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <strong>${escapeHtml(resultado.nome)}</strong>
                <br>
                <small class="text-muted">${formatarCPF(resultado.cpf)}</small>
            </div>
            <div class="text-end">
                <span class="badge bg-${scoreClass} mb-1">${resultado.score_risco}%</span>
                <br>
                <small class="text-muted">${dataStr}</small>
            </div>
        </div>
        <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary me-1" onclick='verDetalhesHistorico(${JSON.stringify(resultado)})'>
                <i class="fas fa-eye"></i> Ver
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick='removerDoHistorico(this, "${resultado.cpf}")'>
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    historicoContainer.insertBefore(item, historicoContainer.firstChild);

    if (salvar) {
        salvarHistoricoLocal(resultado);
    }
}

function verDetalhesHistorico(resultado) {
    exibirResultadoAnalise(resultado);
}

function removerDoHistorico(botao, cpf) {
    if (confirm('Remover esta consulta do histórico?')) {
        const item = botao.closest('.list-group-item');
        if (item) item.remove();

        // Remover do localStorage
        try {
            let historico = localStorage.getItem('jur_cpf_historico');
            if (historico) {
                let items = JSON.parse(historico);
                items = items.filter(item => item.cpf !== cpf);
                localStorage.setItem('jur_cpf_historico', JSON.stringify(items));
            }
        } catch (e) {
            console.error('Erro ao remover do histórico:', e);
        }

        mostrarMensagem('Consulta removida do histórico', 'info');

        // Se não houver mais itens, mostrar mensagem
        const container = document.getElementById('jur-cpf-historico');
        if (container && container.children.length === 0) {
            container.innerHTML = '<div class="list-group-item text-muted text-center">Nenhuma consulta realizada</div>';
        }
    }
}

function formatarCPF(cpf) {
    if (!cpf) return '';
    const numeros = cpf.replace(/\D/g, '');
    if (numeros.length !== 11) return cpf;
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function exportarPDF(resultado) {
    mostrarMensagem('Função de exportação PDF em desenvolvimento', 'info');
    // Implementar lógica de exportação PDF aqui
    console.log('Exportar PDF:', resultado);
}

// Função global para ser chamada pelo onclick
window.executarAnaliseCPF = executarAnaliseCPF;
window.mascaraCPF = mascaraCPF;
window.verDetalhesHistorico = verDetalhesHistorico;
window.removerDoHistorico = removerDoHistorico;
window.exportarPDF = exportarPDF;