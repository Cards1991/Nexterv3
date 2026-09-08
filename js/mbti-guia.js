// Script para manipulação do Guia Prático de MBTI
const mbtiApiKey = 'AIzaSyAp58r4Qv_8FBf9IWbxwUYSorS-_MHVVLo'; // Chave existente do Gemini

let currentMbtiProfile = '';

function abrirGuiaMBTI(perfil) {
    if (!perfil) return;
    currentMbtiProfile = perfil.toUpperCase();
    
    // Verifica se o modal já existe
    let modalEl = document.getElementById('modal-mbti-guia');
    if (!modalEl) {
        criarModalGuiaMBTI();
        modalEl = document.getElementById('modal-mbti-guia');
    }
    
    // Preenche os dados
    preencherDadosGuiaMBTI(currentMbtiProfile);
    
    // Mostra o modal (usando Bootstrap)
    if(typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        // Fallback caso bootstrap falhe
        modalEl.style.display = 'block';
        modalEl.classList.add('show');
    }
}

function criarModalGuiaMBTI() {
    const html = `
    <div class="modal fade" id="modal-mbti-guia" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg" style="border-radius: 15px;">
                <div class="modal-header bg-primary text-white" style="border-top-left-radius: 15px; border-top-right-radius: 15px;">
                    <h5 class="modal-title fw-bold">
                        <i class="fas fa-brain me-2"></i> Guia Prático: Como trabalhar com <span id="guia-mbti-perfil-nome" class="badge bg-light text-primary ms-1"></span>
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                
                <div class="modal-body p-0" style="background-color: #f8f9fa;">
                    
                    <!-- Resumo Rápido e Inteligência Artificial -->
                    <div class="row g-0">
                        <div class="col-md-4 bg-white p-4 border-end">
                            <h6 class="text-primary fw-bold mb-3"><i class="fas fa-bolt text-warning me-2"></i> Guia Rápido</h6>
                            <div class="mb-3">
                                <strong class="text-success"><i class="fas fa-check-circle me-1"></i> Para trabalhar bem:</strong>
                                <ul class="small text-muted mt-1" id="guia-mbti-resumo-bom"></ul>
                            </div>
                            <div class="mb-3">
                                <strong class="text-danger"><i class="fas fa-times-circle me-1"></i> Evite:</strong>
                                <ul class="small text-muted mt-1" id="guia-mbti-resumo-ruim"></ul>
                            </div>
                            <div class="alert alert-primary py-2 px-3 small border-0 mb-4" style="background-color: #e6f0ff;">
                                <strong>💡 Melhor abordagem:</strong><br>
                                <span id="guia-mbti-resumo-abordagem"></span>
                            </div>

                            <hr>

                            <!-- Busca Inteligente -->
                            <h6 class="text-primary fw-bold mt-4"><i class="fas fa-search me-2"></i> Situação Específica?</h6>
                            <p class="small text-muted">A IA adaptará as regras deste perfil para o seu problema.</p>
                            <div class="mb-2">
                                <textarea id="guia-mbti-ia-input" class="form-control form-control-sm" rows="3" placeholder="Ex: Preciso cobrar um funcionário que está atrasado..."></textarea>
                            </div>
                            <button class="btn btn-primary btn-sm w-100" onclick="consultarIA_MBTI()"><i class="fas fa-robot me-1"></i> Obter Orientação</button>
                            
                            <div id="guia-mbti-ia-resultado" class="mt-3 small" style="display: none;"></div>
                        </div>

                        <!-- Abas Detalhadas -->
                        <div class="col-md-8 p-4">
                            <ul class="nav nav-pills nav-fill mb-4" id="mbti-pills-tab" role="tablist">
                                <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-comunicacao" type="button">Comunicação</button></li>
                                <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-delegacao" type="button">Delegação</button></li>
                                <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-feedback" type="button">Feedback</button></li>
                                <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-motivacao" type="button">Motivação</button></li>
                                <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-conflito" type="button">Conflitos</button></li>
                                <li class="nav-item dropdown">
                                    <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">Mais...</a>
                                    <ul class="dropdown-menu">
                                        <li><button class="dropdown-item" data-bs-toggle="pill" data-bs-target="#tab-mudanca" type="button">Mudanças</button></li>
                                        <li><button class="dropdown-item" data-bs-toggle="pill" data-bs-target="#tab-pressao" type="button">Pressão</button></li>
                                        <li><button class="dropdown-item" data-bs-toggle="pill" data-bs-target="#tab-desenvolvimento" type="button">Desenvolvimento</button></li>
                                        <li><button class="dropdown-item" data-bs-toggle="pill" data-bs-target="#tab-equipe" type="button">Equipe</button></li>
                                    </ul>
                                </li>
                            </ul>

                            <div class="tab-content" id="mbti-pills-tabContent">
                                <!-- Dinamicamente preenchido -->
                                <div class="tab-pane fade show active" id="tab-comunicacao">
                                    <h5 class="text-dark"><i class="fas fa-comments text-primary me-2"></i> Como se comunicar</h5>
                                    <p id="guia-texto-comunicacao" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-delegacao">
                                    <h5 class="text-dark"><i class="fas fa-tasks text-primary me-2"></i> Como delegar atividades</h5>
                                    <p id="guia-texto-delegacao" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-feedback">
                                    <h5 class="text-dark"><i class="fas fa-bullhorn text-primary me-2"></i> Como dar feedback</h5>
                                    <p id="guia-texto-feedback" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-motivacao">
                                    <h5 class="text-dark"><i class="fas fa-fire text-primary me-2"></i> Como motivar</h5>
                                    <p id="guia-texto-motivacao" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-conflito">
                                    <h5 class="text-dark"><i class="fas fa-handshake text-primary me-2"></i> Como lidar com conflitos e erros</h5>
                                    <p class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"><strong class="text-dark">Em conflitos: </strong><span id="guia-texto-conflito"></span></p>
                                    <p class="text-muted" style="line-height: 1.6; font-size: 1.05rem;"><strong class="text-dark">Diante de erros: </strong><span id="guia-texto-erros"></span></p>
                                </div>
                                <div class="tab-pane fade" id="tab-mudanca">
                                    <h5 class="text-dark"><i class="fas fa-exchange-alt text-primary me-2"></i> Como comunicar mudanças</h5>
                                    <p id="guia-texto-mudanca" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-pressao">
                                    <h5 class="text-dark"><i class="fas fa-tachometer-alt text-primary me-2"></i> Quando sob pressão</h5>
                                    <ul class="list-group list-group-flush mt-3 border-top-0">
                                        <li class="list-group-item bg-transparent px-0 border-0">
                                            <strong>Sinais de estresse:</strong> <span id="guia-pressao-sinais" class="text-muted"></span>
                                        </li>
                                        <li class="list-group-item bg-transparent px-0 border-0">
                                            <strong class="text-success">Como agir:</strong> <span id="guia-pressao-agir" class="text-muted"></span>
                                        </li>
                                        <li class="list-group-item bg-transparent px-0 border-0">
                                            <strong class="text-danger">O que evitar:</strong> <span id="guia-pressao-evitar" class="text-muted"></span>
                                        </li>
                                    </ul>
                                </div>
                                <div class="tab-pane fade" id="tab-desenvolvimento">
                                    <h5 class="text-dark"><i class="fas fa-chart-line text-primary me-2"></i> Como desenvolver este perfil</h5>
                                    <p id="guia-texto-desenvolvimento" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                                <div class="tab-pane fade" id="tab-equipe">
                                    <h5 class="text-dark"><i class="fas fa-users text-primary me-2"></i> Trabalho em Equipe</h5>
                                    <p id="guia-texto-equipe" class="text-muted mt-3" style="line-height: 1.6; font-size: 1.05rem;"></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer bg-light p-2 justify-content-center">
                    <span class="small text-muted" style="font-size: 0.75rem; text-align: center;">
                        <i class="fas fa-info-circle"></i> As orientações são baseadas em preferências comportamentais (MBTI) e não representam diagnóstico psicológico ou medida isolada de competência.
                    </span>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

function preencherDadosGuiaMBTI(perfil) {
    if (!window.mbti_work_guidance) {
        console.error("Dados mbti_work_guidance não carregados.");
        return;
    }
    
    const dados = window.mbti_work_guidance[perfil];
    if (!dados) {
        console.error("Perfil MBTI não encontrado no guia: " + perfil);
        return;
    }

    document.getElementById('guia-mbti-perfil-nome').textContent = perfil;
    
    // Resumo Rápido
    document.getElementById('guia-mbti-resumo-bom').innerHTML = dados.quick_guide.to_work_well.map(i => `<li class="mb-1">${i}</li>`).join('');
    document.getElementById('guia-mbti-resumo-ruim').innerHTML = dados.quick_guide.avoid.map(i => `<li class="mb-1">${i}</li>`).join('');
    document.getElementById('guia-mbti-resumo-abordagem').textContent = dados.quick_guide.best_approach;

    // Abas
    document.getElementById('guia-texto-comunicacao').textContent = dados.communication;
    document.getElementById('guia-texto-delegacao').textContent = dados.delegation;
    document.getElementById('guia-texto-feedback').textContent = dados.feedback;
    document.getElementById('guia-texto-motivacao').textContent = dados.motivation;
    document.getElementById('guia-texto-conflito').textContent = dados.conflict;
    document.getElementById('guia-texto-erros').textContent = dados.mistakes;
    document.getElementById('guia-texto-mudanca').textContent = dados.change;
    
    document.getElementById('guia-pressao-sinais').textContent = dados.pressure.signals;
    document.getElementById('guia-pressao-agir').textContent = dados.pressure.act;
    document.getElementById('guia-pressao-evitar').textContent = dados.pressure.avoid;
    
    document.getElementById('guia-texto-desenvolvimento').textContent = dados.development;
    document.getElementById('guia-texto-equipe').textContent = dados.teamwork;
    
    // Reset da IA
    document.getElementById('guia-mbti-ia-input').value = '';
    document.getElementById('guia-mbti-ia-resultado').style.display = 'none';
    
    // Reset das tabs para a primeira
    const firstTabEl = document.querySelector('#mbti-pills-tab li:first-child button');
    if(firstTabEl && typeof bootstrap !== 'undefined') {
        const tab = new bootstrap.Tab(firstTabEl);
        tab.show();
    }
}

async function consultarIA_MBTI() {
    const inputEl = document.getElementById('guia-mbti-ia-input');
    const situacao = inputEl.value.trim();
    const resultBox = document.getElementById('guia-mbti-ia-resultado');
    
    if(!situacao) {
        inputEl.focus();
        return;
    }
    
    resultBox.style.display = 'block';
    resultBox.className = 'mt-3 p-3 rounded text-dark';
    resultBox.style.backgroundColor = '#f1f3f5';
    resultBox.innerHTML = '<i class="fas fa-spinner fa-spin text-primary me-2"></i> Analisando a situação...';

    const dadosPerfil = window.mbti_work_guidance[currentMbtiProfile];
    if(!dadosPerfil) return;

    // Construção do Prompt baseada na OD
    const prompt = `
Atue como um consultor de RH comportamental e especialista em gestão.
Um gestor precisa de ajuda para lidar com um funcionário ou colega cujo perfil MBTI é: ${currentMbtiProfile}.

Aqui estão as diretrizes de como esse perfil funciona (use isso como base absoluta):
Comunicação: ${dadosPerfil.communication}
Delegação: ${dadosPerfil.delegation}
Conflitos: ${dadosPerfil.conflict}
Como dar feedback: ${dadosPerfil.feedback}
O que evitar: ${dadosPerfil.quick_guide.avoid.join(', ')}

Situação que o gestor relatou:
"${situacao}"

Sua tarefa:
Com base nas características do perfil ${currentMbtiProfile}, dê uma orientação DIRETA, OBJETIVA E PRÁTICA sobre o que o gestor deve fazer nessa situação específica.
Não invente características psicológicas novas. Apenas adapte o conhecimento do perfil à situação informada.

Formato obrigatório da resposta:
1. "Como abordar" (2 ou 3 frases práticas sobre o que falar/fazer)
2. "Evite" (1 frase sobre o que não fazer nessa situação)
3. "Sugestão de fala" (Coloque uma frase entre aspas de como o gestor poderia abordar verbalmente a situação)

NÃO use jargões acadêmicos ou excessivamente clínicos. Seja muito prático para um ambiente corporativo.`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${mbtiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            let text = data.candidates[0].content.parts[0].text;
            
            // Formatando a saída markdown do gemini para HTML simples (negrito)
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\n/g, '<br>');
            
            resultBox.style.backgroundColor = '#eef9f0';
            resultBox.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-robot text-success me-2 fs-5"></i> 
                    <strong class="text-success">Orientação para o perfil ${currentMbtiProfile}</strong>
                </div>
                ${text}
            `;
        } else {
            throw new Error("Resposta inválida da IA");
        }
    } catch(err) {
        console.error(err);
        resultBox.style.backgroundColor = '#fdf0f0';
        resultBox.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-circle me-1"></i> Falha ao buscar orientação. Tente novamente.</span>';
    }
}
