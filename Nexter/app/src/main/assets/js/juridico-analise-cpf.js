// js/juridico-analise-cpf.js

// Variáveis globais
let __historico_analises_cache = [];

async function inicializarAnaliseCPF() {
    console.log("Inicializando módulo de Análise de CPF...");
    // Aqui você poderia carregar um histórico se tivesse uma coleção para isso
    // await carregarHistoricoAnalises();
}

function mascaraCPF(i) {
    let v = i.value;
    if (isNaN(v[v.length - 1])) { // impede entrar outro caractere que não seja número
        i.value = v.substring(0, v.length - 1);
        return;
    }
    i.setAttribute("maxlength", "14");
    if (v.length == 3 || v.length == 7) i.value += ".";
    if (v.length == 11) i.value += "-";
}

async function executarAnaliseCPF() {
    const cpfInput = document.getElementById('analise-cpf-input');
    const nomeInput = document.getElementById('analise-nome-input');
    const motivoInput = document.getElementById('analise-motivo');
    const btn = document.getElementById('btn-executar-analise');
    const progressContainer = document.getElementById('analise-progress-container');
    const progressBar = document.getElementById('analise-progress-bar');
    const statusText = document.getElementById('analise-status-text');

    const cpf = cpfInput.value.replace(/\D/g, '');
    const nome = nomeInput.value.trim();
    const motivo = motivoInput.value;

    if (cpf.length !== 11) {
        mostrarMensagem("CPF inválido. Digite 11 números.", "warning");
        return;
    }
    if (nome.length < 3) {
        mostrarMensagem("Nome completo é obrigatório para a busca judicial.", "warning");
        return;
    }

    // UI Loading
    btn.disabled = true;
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = '30%';
    if (statusText) statusText.textContent = 'Conectando ao servidor de análise...';

    try {
        // URL do backend local
        // Tenta detectar se está rodando localmente ou em produção
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Tenta primeiro a porta 3001 (Backend Dedicado), depois a 3000 (Backend Geral)
        let API_URL = '/api/consultar-judicial';
        
        if (isLocal) {
            // Verifica qual porta está respondendo
            try {
                await fetch('http://localhost:3001/api/health', { method: 'GET', signal: AbortSignal.timeout(1000) });
                API_URL = 'http://localhost:3001/api/consultar-judicial';
                console.log("Conectado ao Backend de Análise (3001)");
            } catch (e) {
                console.log("Backend 3001 indisponível, tentando 3000...");
                API_URL = 'http://localhost:3000/api/consultar-judicial';
            }
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
                motivo,
                usuario: firebase.auth().currentUser?.email || 'Anônimo'
            })
        });

        if (progressBar) progressBar.style.width = '80%';
        if (statusText) statusText.textContent = 'Processando resposta...';

        const data = await response.json();

        if (data.success) {
            if (progressBar) progressBar.style.width = '100%';
            if (statusText) statusText.textContent = 'Concluído!';
            exibirResultadoAnalise(data.resultado);
            adicionarAoHistoricoLocal(data.resultado);
        } else {
            throw new Error(data.error || 'Erro desconhecido na análise');
        }

    } catch (error) {
        console.error("Erro na análise:", error);
        mostrarMensagem("Falha na consulta: " + error.message, "error");
        if (statusText) statusText.textContent = 'Erro na consulta.';
        if (progressBar) progressBar.classList.add('bg-danger');
    } finally {
        btn.disabled = false;
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.classList.remove('bg-danger');
            }
        }, 3000);
    }
}

function exibirResultadoAnalise(resultado) {
    let html = `
        <div class="alert alert-info mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <span><strong>Relatório de Consulta Completa por CPF</strong></span>
                <span class="badge bg-light text-dark">${resultado.tipoConsulta || 'Consulta'}</span>
            </div>
            <p class="mb-0 mt-2">${resultado.observacao}</p>
        </div>

        <div class="row mb-3">
            <div class="col-md-6">
                <p><strong>Nome:</strong> ${resultado.nome}</p>
                <p><strong>CPF:</strong> ${resultado.cpf}</p>
            </div>
            <div class="col-md-6 text-end">
                <p><small>${new Date(resultado.timestamp).toLocaleString()}</small></p>
            </div>
        </div>

        <h6 class="border-bottom pb-2">Relatório Estruturado</h6>
        <div class="bg-light p-3 rounded" style="font-family: monospace; white-space: pre-wrap; font-size: 0.9em;">
            ${resultado.relatorio || 'Relatório não disponível'}
        </div>

        <div class="mt-3 p-2 bg-light small text-muted border rounded">
            <i class="fas fa-info-circle"></i> ${resultado.isencao}
        </div>
    `;

    if (typeof abrirModalGenerico === 'function') {
        abrirModalGenerico(`Relatório de Consulta: ${resultado.nome}`, html);
    } else {
        // Fallback se o modal genérico não existir
        const container = document.getElementById('juridico-analise-cpf');
        const resultDiv = document.createElement('div');
        resultDiv.className = 'card mt-3';
        resultDiv.innerHTML = `<div class="card-body">${html}</div>`;
        container.appendChild(resultDiv);
    }
}

function adicionarAoHistoricoLocal(resultado) {
    const tbody = document.getElementById('tabela-historico-analises');
    if (!tbody) return;

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${new Date().toLocaleDateString()}</td>
        <td>${resultado.cpf}</td>
        <td>${firebase.auth().currentUser?.email || 'Sistema'}</td>
        <td><span class="badge bg-success">Concluído</span></td>
        <td class="text-end">
            <button class="btn btn-sm btn-info" onclick='exibirResultadoAnalise(${JSON.stringify(resultado)})'>Ver Detalhes</button>
        </td>
    `;
    
    // Adiciona no topo
    tbody.insertBefore(row, tbody.firstChild);
}

// Exportar funções para o escopo global
window.inicializarAnaliseCPF = inicializarAnaliseCPF;
window.mascaraCPF = mascaraCPF;
window.executarAnaliseCPF = executarAnaliseCPF;
// Expor exibirResultadoAnalise globalmente para o onclick do histórico
window.exibirResultadoAnalise = exibirResultadoAnalise;