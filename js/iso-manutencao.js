// Gerenciamento de Chamados de Manutenção - ISO 9001 com WhatsApp
let __chamados_cache = []; // Cache para impressão
let __maquinas_cache = null; // Cache para o select de máquinas
let __unsubscribe_manutencao = null; // Para parar o listener do snapshot

// Configurações de WhatsApp
const WHATSAPP_CONFIG = {
    enabled: true, // Ativar/desativar notificações
    gerenteTelefone: '', // Será preenchido automaticamente
    gerenteNome: '',
    mensagemPadrao: '🚨 *NOVO CHAMADO DE MANUTENÇÃO*\n\nMáquina: {maquina}\nMotivo: {motivo}\nPrioridade: {prioridade}\nStatus: {status}\n\nClique para acessar: {link}'
};

// ============ VERIFICAÇÕES INICIAIS ============
if (typeof firebase === 'undefined' || !firebase.apps.length) {
    console.error('Firebase não foi inicializado. Certifique-se de que firebase.js foi carregado.');
}

if (typeof db === 'undefined') {
    console.error('Variável db não definida. Certifique-se de inicializar o Firestore.');
}

// ============ INICIALIZAÇÃO ============
async function inicializarManutencao() {
    try {
        // Verificar se Firebase está disponível
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            mostrarMensagem("Firebase não inicializado. Recarregue a página.", "error");
            return;
        }
        
        if (typeof db === 'undefined') {
            mostrarMensagem("Banco de dados não disponível.", "error");
            return;
        }

        // Configurar botões
        const btnNovo = document.getElementById('btn-novo-chamado-manutencao');
        const btnFiltrar = document.getElementById('btn-filtrar-manutencao');
        
        if (btnNovo && !btnNovo.hasAttribute('data-listener-bound')) {
            btnNovo.addEventListener('click', () => abrirModalChamado(null));
            btnNovo.setAttribute('data-listener-bound', 'true');
        }
        
        if (btnFiltrar && !btnFiltrar.hasAttribute('data-listener-bound')) {
            btnFiltrar.addEventListener('click', carregarChamadosManutencao);
            btnFiltrar.setAttribute('data-listener-bound', 'true');
        }

        // Carregar configurações do gerente
        await carregarConfigGerente();
        
        // Carregar chamados
        await carregarChamadosManutencao();
        
        // Adicionar botão de configurações WhatsApp
        setTimeout(adicionarBotaoConfigWhatsApp, 1000);
    } catch (e) {
        console.error("Erro ao inicializar módulo de manutenção:", e);
        mostrarMensagem("Erro ao carregar módulo de manutenção", "error");
    }
}

// Buscar informações do gerente no banco
async function carregarConfigGerente() {
    try {
        // Primeiro tenta buscar do Firestore
        const configSnap = await db.collection('configuracoes').doc('whatsapp').get();
        if (configSnap.exists) {
            const config = configSnap.data();
            WHATSAPP_CONFIG.gerenteTelefone = config.telefone || '';
            WHATSAPP_CONFIG.mensagemPadrao = config.mensagemPadrao || WHATSAPP_CONFIG.mensagemPadrao;
            WHATSAPP_CONFIG.enabled = config.ativo !== false;
            console.log('Configurações WhatsApp carregadas do banco');
            return;
        }

        // Se não encontrar, busca gerente nos usuários
        const gerentesSnap = await db.collection('usuarios')
            .where('cargo', 'in', ['Gerente', 'Supervisor', 'Coordenador'])
            .where('receberNotificacoes', '==', true)
            .limit(1)
            .get();
        
        if (!gerentesSnap.empty) {
            const gerente = gerentesSnap.docs[0].data();
            WHATSAPP_CONFIG.gerenteTelefone = gerente.telefone || '';
            WHATSAPP_CONFIG.gerenteNome = gerente.nome || '';
            console.log(`Notificações WhatsApp configuradas para: ${gerente.nome}`);
        } else {
            console.warn('Nenhum gerente configurado para receber notificações');
            WHATSAPP_CONFIG.enabled = false;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações do gerente:', error);
        WHATSAPP_CONFIG.enabled = false;
    }
}

// ============ WHATSAPP FUNCTIONS ============
function enviarNotificacaoWhatsApp(chamadoData) {
    if (!WHATSAPP_CONFIG.enabled || !WHATSAPP_CONFIG.gerenteTelefone) {
        console.log('Notificações WhatsApp desativadas ou telefone não configurado');
        return false;
    }

    try {
        const telefone = formatarTelefoneWhatsApp(WHATSAPP_CONFIG.gerenteTelefone);
        if (!telefone) {
            console.warn('Número de telefone inválido para WhatsApp');
            return false;
        }
        
        // URL do sistema (para acesso rápido)
        const urlSistema = window.location.origin;
        
        // Preparar mensagem
        const mensagem = WHATSAPP_CONFIG.mensagemPadrao
            .replace('{maquina}', chamadoData.maquinaId || 'N/A')
            .replace('{motivo}', chamadoData.motivo || 'N/A')
            .replace('{prioridade}', chamadoData.prioridade || 'Normal')
            .replace('{status}', chamadoData.status || 'Aberto')
            .replace('{link}', urlSistema)
            .replace('{id}', chamadoData.id ? chamadoData.id.substring(0, 8).toUpperCase() : 'NOVO');

        // Codificar mensagem para URL
        const mensagemCodificada = encodeURIComponent(mensagem);
        
        // Criar link do WhatsApp
        const whatsappLink = `https://wa.me/${telefone}?text=${mensagemCodificada}`;
        
        // Abrir em nova janela
        const novaJanela = window.open(whatsappLink, '_blank');
        
        if (novaJanela) {
            console.log('WhatsApp aberto para envio de notificação');
            
            // Fechar janela após alguns segundos (opcional)
            setTimeout(() => {
                try {
                    if (!novaJanela.closed) {
                        novaJanela.close();
                    }
                } catch (e) {
                    console.log('Não foi possível fechar a janela automaticamente');
                }
            }, 5000);
            
            return true;
        } else {
            console.warn('Pop-up bloqueado. Por favor, permita pop-ups para envio automático.');
            
            // Alternativa: Mostrar link para clique manual
            mostrarLinkWhatsAppManual(whatsappLink);
            return false;
        }
    } catch (error) {
        console.error('Erro ao preparar notificação WhatsApp:', error);
        return false;
    }
}

function mostrarLinkWhatsAppManual(link) {
    // Remove alerta anterior se existir
    const alertaAnterior = document.getElementById('whatsapp-manual-alert');
    if (alertaAnterior) alertaAnterior.remove();
    
    const linkManual = document.createElement('div');
    linkManual.className = 'alert alert-info mt-3';
    linkManual.id = 'whatsapp-manual-alert';
    linkManual.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-1"><i class="fab fa-whatsapp"></i> Notificação WhatsApp</h6>
                <p class="mb-0">Clique para enviar notificação ao gerente:</p>
            </div>
            <div>
                <a href="${link}" target="_blank" class="btn btn-success btn-sm">
                    <i class="fab fa-whatsapp"></i> Enviar WhatsApp
                </a>
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="document.getElementById('whatsapp-manual-alert').remove()">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    // Adicionar à página (no topo)
    const container = document.querySelector('.container-fluid') || document.body;
    if (container.firstChild) {
        container.insertBefore(linkManual, container.firstChild);
    } else {
        container.appendChild(linkManual);
    }
}

function enviarAlertaCriticoWhatsApp(chamadoData) {
    if (!chamadoData.maquinaParada || !WHATSAPP_CONFIG.enabled) return false;
    
    try {
        const telefone = formatarTelefoneWhatsApp(WHATSAPP_CONFIG.gerenteTelefone);
        if (!telefone) return false;
        
        const mensagemAlerta = `🔥 *ALERTA CRÍTICO - MÁQUINA PARADA* 🔥\n\n` +
            `🚫 MÁQUINA: ${chamadoData.maquinaId}\n` +
            `📋 MOTIVO: ${chamadoData.motivo}\n` +
            `⏰ HORA: ${new Date().toLocaleTimeString('pt-BR')}\n` +
            `📈 PRIORIDADE: ${chamadoData.prioridade || 'Urgente'}\n` +
            `🔴 STATUS: MÁQUINA PARADA\n\n` +
            `❗ AÇÃO IMEDIATA REQUERIDA!\n` +
            `🔗 ${window.location.origin}`;

        const mensagemCodificada = encodeURIComponent(mensagemAlerta);
        const whatsappLink = `https://wa.me/${telefone}?text=${mensagemCodificada}`;
        
        // Abre em nova janela
        const janelaAlerta = window.open(whatsappLink, '_blank', 'width=600,height=700');
        
        if (janelaAlerta) {
            console.log('Alerta crítico enviado via WhatsApp');
            
            // Fecha após 10 segundos
            setTimeout(() => {
                try {
                    if (!janelaAlerta.closed) janelaAlerta.close();
                } catch (e) {}
            }, 10000);
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao enviar alerta crítico:', error);
        return false;
    }
}

async function reenviarNotificacao(chamadoId) {
    const chamado = __chamados_cache.find(c => c.id === chamadoId);
    if (!chamado) {
        mostrarMensagem("Chamado não encontrado", "error");
        return;
    }

    const enviado = enviarNotificacaoWhatsApp(chamado);
    
    if (enviado) {
        // Marca como enviado no banco de dados
        try {
            await db.collection('manutencao_chamados').doc(chamadoId).update({
                notificacaoEnviada: true,
                notificacaoData: firebase.firestore.FieldValue.serverTimestamp(),
                notificacaoReenviada: true
            });
            mostrarMensagem("Notificação reenviada com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao atualizar status da notificação:", error);
            mostrarMensagem("Notificação enviada, mas erro ao atualizar status", "warning");
        }
    }
}

// ============ CONFIGURAÇÕES WHATSAPP ============
function abrirConfigWhatsApp() {
    const modalId = 'configWhatsAppModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">
                            <i class="fab fa-whatsapp"></i> Configurações de Notificações WhatsApp
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <small>
                                <i class="fas fa-exclamation-triangle"></i> 
                                O WhatsApp Web será aberto automaticamente. Certifique-se de estar logado.
                            </small>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Telefone do Gerente *</label>
                            <div class="input-group">
                                <span class="input-group-text">+55</span>
                                <input type="text" class="form-control" id="config-whatsapp-telefone" 
                                       placeholder="11999999999" value="${WHATSAPP_CONFIG.gerenteTelefone || ''}" required>
                            </div>
                            <div class="form-text">Número com DDD, sem espaços ou caracteres especiais</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Nome do Destinatário (opcional)</label>
                            <input type="text" class="form-control" id="config-whatsapp-nome" 
                                   placeholder="Nome do gerente" value="${WHATSAPP_CONFIG.gerenteNome || ''}">
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Mensagem Padrão *</label>
                            <textarea class="form-control" id="config-whatsapp-mensagem" rows="5" required>${WHATSAPP_CONFIG.mensagemPadrao}</textarea>
                            <div class="form-text">
                                <small>
                                    <strong>Variáveis disponíveis:</strong><br>
                                    <code>{maquina}</code> - Nome da máquina<br>
                                    <code>{motivo}</code> - Motivo do chamado<br>
                                    <code>{prioridade}</code> - Prioridade<br>
                                    <code>{status}</code> - Status do chamado<br>
                                    <code>{link}</code> - Link do sistema<br>
                                    <code>{id}</code> - ID do chamado
                                </small>
                            </div>
                        </div>
                        
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" id="config-whatsapp-ativo" ${WHATSAPP_CONFIG.enabled ? 'checked' : ''}>
                            <label class="form-check-label" for="config-whatsapp-ativo">
                                Ativar notificações por WhatsApp
                            </label>
                        </div>
                        
                        <div class="mt-3">
                            <button class="btn btn-sm btn-outline-primary" onclick="testarWhatsApp()">
                                <i class="fab fa-whatsapp"></i> Testar Envio
                            </button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="salvarConfigWhatsApp()">
                            <i class="fas fa-save"></i> Salvar Configurações
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarConfigWhatsApp() {
    const telefoneInput = document.getElementById('config-whatsapp-telefone');
    const mensagemInput = document.getElementById('config-whatsapp-mensagem');
    const nomeInput = document.getElementById('config-whatsapp-nome');
    const ativoInput = document.getElementById('config-whatsapp-ativo');
    
    if (!telefoneInput || !mensagemInput) {
        mostrarMensagem("Elementos do formulário não encontrados", "error");
        return;
    }
    
    const telefone = telefoneInput.value.trim();
    const mensagem = mensagemInput.value.trim();
    const nome = nomeInput ? nomeInput.value.trim() : '';
    const ativo = ativoInput ? ativoInput.checked : false;

    // Validação
    if (ativo && !telefone) {
        mostrarMensagem("Informe o telefone para ativar as notificações", "warning");
        telefoneInput.focus();
        return;
    }
    
    if (!mensagem) {
        mostrarMensagem("A mensagem padrão é obrigatória", "warning");
        mensagemInput.focus();
        return;
    }
    
    if (ativo && !formatarTelefoneWhatsApp(telefone)) {
        mostrarMensagem("Número de telefone inválido", "warning");
        telefoneInput.focus();
        return;
    }

    WHATSAPP_CONFIG.gerenteTelefone = telefone;
    WHATSAPP_CONFIG.mensagemPadrao = mensagem;
    WHATSAPP_CONFIG.gerenteNome = nome;
    WHATSAPP_CONFIG.enabled = ativo;

    // Salvar no Firestore
    try {
        await db.collection('configuracoes').doc('whatsapp').set({
            telefone,
            mensagemPadrao: mensagem,
            nomeDestinatario: nome,
            ativo,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            atualizadoPor: firebase.auth().currentUser?.uid || 'sistema'
        }, { merge: true });
        
        mostrarMensagem("Configurações do WhatsApp salvas com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('configWhatsAppModal')).hide();
    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        mostrarMensagem("Erro ao salvar no banco de dados. Configurações salvas apenas localmente.", "warning");
    }
}

function testarWhatsApp() {
    const telefoneInput = document.getElementById('config-whatsapp-telefone');
    if (!telefoneInput) {
        mostrarMensagem("Campo de telefone não encontrado", "error");
        return;
    }
    
    const telefone = telefoneInput.value.trim();
    if (!telefone) {
        mostrarMensagem("Informe um telefone para testar", "warning");
        telefoneInput.focus();
        return;
    }

    const telefoneFormatado = formatarTelefoneWhatsApp(telefone);
    if (!telefoneFormatado) {
        mostrarMensagem("Número de telefone inválido", "warning");
        return;
    }
    
    const mensagemTeste = "🔔 *TESTE DE NOTIFICAÇÃO*\n\nEsta é uma mensagem de teste do sistema de manutenção.\n\n✅ Sistema funcionando corretamente!\n\nHora: " + new Date().toLocaleTimeString('pt-BR');
    const mensagemCodificada = encodeURIComponent(mensagemTeste);
    const whatsappLink = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
    
    const janelaTeste = window.open(whatsappLink, '_blank');
    if (!janelaTeste) {
        mostrarLinkWhatsAppManual(whatsappLink);
    }
}

function adicionarBotaoConfigWhatsApp() {
    // Seleciona o container dos botões de ação na seção de manutenção
    const actionContainer = document.querySelector('#iso-manutencao .d-flex.gap-2');
    
    if (actionContainer && !document.getElementById('btn-config-whatsapp')) {
        const btnConfig = document.createElement('button');
        btnConfig.id = 'btn-config-whatsapp';
        btnConfig.className = 'btn btn-success';
        btnConfig.innerHTML = '<i class="fab fa-whatsapp me-2"></i> Configurar WhatsApp';
        btnConfig.title = 'Configurar notificações por WhatsApp';
        btnConfig.onclick = abrirConfigWhatsApp;
        
        // Adiciona o botão junto aos outros botões de gerenciamento
        actionContainer.appendChild(btnConfig);
    }
}

// ============ FUNÇÕES PRINCIPAIS DE MANUTENÇÃO ============
async function carregarChamadosManutencao() {
    // Limpar listener anterior se existir
    if (__unsubscribe_manutencao) {
        __unsubscribe_manutencao();
        __unsubscribe_manutencao = null;
    }

    const tbody = document.getElementById('tabela-chamados-manutencao');
    if (!tbody) {
        console.error("Elemento tabela-chamados-manutencao não encontrado");
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const maquinasSnap = await db.collection('maquinas').get();
        const maquinasCriticas = new Map(maquinasSnap.docs.map(doc => [doc.data().codigo, doc.data().isCritica || false]));

        let query = db.collection('manutencao_chamados');

        const dataInicio = document.getElementById('filtro-manut-inicio')?.value;
        const dataFim = document.getElementById('filtro-manut-fim')?.value;

        if (dataInicio) {
            query = query.where('dataAbertura', '>=', new Date(dataInicio));
        }
        if (dataFim) {
            const fim = new Date(dataFim);
            fim.setHours(23, 59, 59, 999);
            query = query.where('dataAbertura', '<=', fim);
        }

        __unsubscribe_manutencao = query.orderBy('dataAbertura', 'desc').onSnapshot(snap => {
            let chamados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const prioridadeValor = { 'Urgente': 1, 'Prioritário': 2, 'Normal': 3 };

            chamados.sort((a, b) => {
                if (a.maquinaParada && !b.maquinaParada) return -1;
                if (!a.maquinaParada && b.maquinaParada) return 1;

                const prioridadeA = prioridadeValor[a.prioridade || 'Normal'] || 3;
                const prioridadeB = prioridadeValor[b.prioridade || 'Normal'] || 3;
                if (prioridadeA < prioridadeB) return -1;
                if (prioridadeA > prioridadeB) return 1;

                const aIsCritica = maquinasCriticas.get(a.maquinaId) || false;
                const bIsCritica = maquinasCriticas.get(b.maquinaId) || false;
                if (aIsCritica && !bIsCritica) return -1;
                if (!aIsCritica && bIsCritica) return 1;

                const timeA = a.dataAbertura?.toMillis() || 0;
                const timeB = b.dataAbertura?.toMillis() || 0;
                
                return timeB - timeA;
            });

            __chamados_cache = chamados;

            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum chamado de manutenção aberto.</td></tr>';
                renderizarMetricasManutencao([]);
                return;
            }

            let tableHtml = '';
            chamados.forEach(chamado => {
                const abertura = chamado.dataAbertura?.toDate();
                const encerramento = chamado.dataEncerramento?.toDate();
                const isCritica = maquinasCriticas.get(chamado.maquinaId) || false;

                const rowClass = chamado.maquinaParada ? 'table-danger' : (isCritica ? 'table-warning' : '');

                let statusBadge;
                switch (chamado.status) {
                    case 'Aberto':
                        statusBadge = '<span class="badge bg-danger">Aberto</span>';
                        break;
                    case 'Concluído':
                        statusBadge = '<span class="badge bg-success">Concluído</span>';
                        break;
                    case 'Em Andamento':
                        statusBadge = '<span class="badge bg-info">Em Andamento</span>';
                        break;
                    default:
                        statusBadge = `<span class="badge bg-secondary">${chamado.status}</span>`;
                }
                
                let prioridadeBadgeClass = 'bg-secondary';
                switch(chamado.prioridade) {
                    case 'Urgente': prioridadeBadgeClass = 'bg-danger'; break;
                    case 'Prioritário': prioridadeBadgeClass = 'bg-warning text-dark'; break;
                    case 'Normal': prioridadeBadgeClass = 'bg-success'; break;
                }

                let prioridadeConteudo;
                if (chamado.status === 'Aberto' || chamado.status === 'Em Andamento') {
                    prioridadeConteudo = `
                        <select class="form-select form-select-sm w-auto d-inline-block ${prioridadeBadgeClass}" onchange="atualizarPrioridade('${chamado.id}', this.value)">
                            <option value="Normal" ${chamado.prioridade === 'Normal' ? 'selected' : ''}>Normal</option>
                            <option value="Prioritário" ${chamado.prioridade === 'Prioritário' ? 'selected' : ''}>Prioritário</option>
                            <option value="Urgente" ${chamado.prioridade === 'Urgente' ? 'selected' : ''}>Urgente</option>
                        </select>`;
                } else {
                    prioridadeConteudo = `<span class="badge ${prioridadeBadgeClass}">${chamado.prioridade || 'Normal'}</span>`;
                }

                let tempoParadaConteudo;
                if (chamado.maquinaParada && chamado.status !== 'Concluído') {
                    // Calcular tempo atual de parada para máquinas ainda paradas
                    if (chamado.paradaInicioTimestamp) {
                        const inicio = chamado.paradaInicioTimestamp.toDate();
                        const agora = new Date();
                        const diffMs = agora - inicio;
                        const horas = Math.floor(diffMs / 3600000);
                        const minutos = Math.floor((diffMs % 3600000) / 60000);

                        let tempoAtual = '';
                        if (horas > 0) tempoAtual += `${horas}h `;
                        if (minutos > 0) tempoAtual += `${minutos}m`;
                        tempoAtual = tempoAtual.trim() || 'Menos de 1m';

                        if (isCritica) {
                            tempoParadaConteudo = `<strong class="text-danger">ALERTA MÁXIMO<br><small>${tempoAtual}</small></strong>`;
                        } else {
                            tempoParadaConteudo = `<strong class="text-warning">Alerta<br><small>${tempoAtual}</small></strong>`;
                        }
                    } else {
                        if (isCritica) {
                            tempoParadaConteudo = '<strong class="text-danger">ALERTA MÁXIMO</strong>';
                        } else {
                            tempoParadaConteudo = '<strong class="text-warning">Alerta</strong>';
                        }
                    }
                } else {
                    tempoParadaConteudo = chamado.tempoParada || '-';
                }

                // Botão para reenviar notificação WhatsApp
                const botaoWhatsApp = WHATSAPP_CONFIG.enabled ? 
                    `<button class="btn btn-sm ${chamado.notificacaoEnviada ? 'btn-success' : 'btn-outline-success'}" 
                            title="${chamado.notificacaoEnviada ? 'Notificação enviada' : 'Enviar notificação WhatsApp'}" 
                            onclick="reenviarNotificacao('${chamado.id}')">
                        <i class="fab fa-whatsapp"></i>
                    </button>` : '';

                const row = `
                    <tr class="${rowClass}">
                        <td>
                            ${chamado.maquinaId}
                            ${isCritica ? '<span class="badge bg-dark ms-1" title="Máquina Crítica">Crítica</span>' : ''}
                        </td>
                        <td>${chamado.motivo || ''}</td>
                        <td>${abertura ? abertura.toLocaleString('pt-BR') : '-'}</td>
                        <td>${encerramento ? encerramento.toLocaleString('pt-BR') : '-'}</td>
                        <td>${tempoParadaConteudo}</td>
                        <td>${prioridadeConteudo}</td>
                        <td>${statusBadge}</td>

                        <td class="text-end">
                            ${botaoWhatsApp}
                            <button class="btn btn-outline-secondary btn-sm" title="Imprimir Chamado" onclick="imprimirChamado('${chamado.id}')">
                                <i class="fas fa-print"></i>
                            </button>
                            ${chamado.status === 'Aberto' ? `
                                <button class="btn btn-outline-info btn-sm" title="Iniciar Atendimento" onclick="iniciarAtendimento('${chamado.id}')">
                                    <i class="fas fa-play-circle"></i>
                                </button>` : ''}
                            ${chamado.status === 'Aberto' || chamado.status === 'Em Andamento' ? `
                                <button class="btn btn-outline-success btn-sm" title="Finalizar Chamado" onclick="abrirModalFinalizar('${chamado.id}')">
                                    <i class="fas fa-check-circle"></i>
                                </button>` : ''}
                            <button class="btn btn-outline-danger btn-sm" title="Excluir Chamado" onclick="excluirChamado('${chamado.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tableHtml += row;
            });

            tbody.innerHTML = tableHtml;
            renderizarMetricasManutencao(__chamados_cache);
        }, error => {
            console.error("Erro no listener de chamados:", error);
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar chamados.</td></tr>';
        });
    } catch (error) {
        console.error("Erro ao carregar chamados de manutenção:", error);
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro ao carregar chamados.</td></tr>';
        }
    }
}

function renderizarMetricasManutencao(chamados) {
    const container = document.getElementById('metricas-manutencao');
    if (!container) return;

    const abertos = chamados.filter(c => c.status === 'Aberto' || c.status === 'Em Andamento').length;
    const normais = chamados.filter(c => c.prioridade === 'Normal' && (c.status === 'Aberto' || c.status === 'Em Andamento')).length;
    const paradas = chamados.filter(c => c.maquinaParada).length;
    const urgentes = chamados.filter(c => c.prioridade === 'Urgente' && (c.status === 'Aberto' || c.status === 'Em Andamento')).length;

    // Define classes de alerta se houver itens críticos
    const classUrgentes = urgentes > 0 ? 'card-alert-blink' : '';
    const classParadas = paradas > 0 ? 'card-alert-blink' : '';

    container.innerHTML = `
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-warning text-dark">
                <div class="card-body text-center">
                    <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                    <div class="number display-6 fw-bold">${abertos}</div>
                    <div class="label text-uppercase small">Chamados em Aberto</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-info text-white">
                <div class="card-body text-center">
                    <i class="fas fa-tools fa-2x mb-2"></i>
                    <div class="number display-6 fw-bold">${normais}</div>
                    <div class="label text-uppercase small">Chamados Normais</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-danger text-white ${classUrgentes}">
                <div class="card-body text-center">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <div class="number display-6 fw-bold">${urgentes}</div>
                    <div class="label text-uppercase small">Urgentes</div>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card stat-card bg-dark text-white ${classParadas}">
                <div class="card-body text-center">
                    <i class="fas fa-industry fa-2x mb-2"></i>
                    <div class="number display-6 fw-bold">${paradas}</div>
                    <div class="label text-uppercase small">Máquinas Paradas</div>
                </div>
            </div>
        </div>
    `;
}

// ============ MODAL NOVO CHAMADO ============
async function abrirModalChamado(chamadoId = null) {
    const modalId = 'manutencaoChamadoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-tools"></i> ${chamadoId ? 'Editar' : 'Abrir'} Chamado de Manutenção
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-chamado-manutencao">
                            <input type="hidden" id="chamado-id" value="${chamadoId || ''}">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Máquina *</label>
                                    <select class="form-select" id="chamado-maquina" required>
                                        <option value="">Selecione uma máquina...</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Tipo de Manutenção *</label>
                                    <select class="form-select" id="chamado-tipo-manutencao" required>
                                        <option value="Corretiva">Corretiva</option>
                                        <option value="Preventiva Mensal">Preventiva Mensal</option>
                                    </select>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Prioridade Inicial</label>
                                    <select class="form-select" id="chamado-prioridade">
                                        <option value="Normal">Normal</option>
                                        <option value="Prioritário">Prioritário</option>
                                        <option value="Urgente">Urgente</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3" id="chamado-mes-container" style="display: none;">
                                    <label class="form-label">Mês de Referência</label>
                                    <select class="form-select" id="chamado-mes-referencia">
                                        <option value="">Selecione o mês...</option>
                                        <option value="1">Janeiro</option>
                                        <option value="2">Fevereiro</option>
                                        <option value="3">Março</option>
                                        <option value="4">Abril</option>
                                        <option value="5">Maio</option>
                                        <option value="6">Junho</option>
                                        <option value="7">Julho</option>
                                        <option value="8">Agosto</option>
                                        <option value="9">Setembro</option>
                                        <option value="10">Outubro</option>
                                        <option value="11">Novembro</option>
                                        <option value="12">Dezembro</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Motivo da Manutenção *</label>
                                <input type="text" class="form-control" id="chamado-motivo" placeholder="Ex: Vazamento de óleo, falha no motor" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Observações</label>
                                <textarea class="form-control" id="chamado-obs" rows="3" placeholder="Detalhes adicionais..."></textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-check form-switch mb-3">
                                        <input class="form-check-input" type="checkbox" id="chamado-maquina-parada">
                                        <label class="form-check-label" for="chamado-maquina-parada">
                                            <strong><i class="fas fa-exclamation-triangle text-danger"></i> A máquina está parada?</strong>
                                        </label>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check form-switch mb-3">
                                        <input class="form-check-input" type="checkbox" id="chamado-enviar-whatsapp" ${WHATSAPP_CONFIG.enabled ? 'checked' : ''} ${WHATSAPP_CONFIG.enabled ? '' : 'disabled'}>
                                        <label class="form-check-label" for="chamado-enviar-whatsapp">
                                            <i class="fab fa-whatsapp ${WHATSAPP_CONFIG.enabled ? 'text-success' : 'text-muted'}"></i> 
                                            ${WHATSAPP_CONFIG.enabled ? 'Enviar notificação WhatsApp' : 'WhatsApp desativado'}
                                        </label>
                                    </div>
                                </div>
                            </div>
                            ${WHATSAPP_CONFIG.enabled ? `
                            <div class="alert alert-info">
                                <small>
                                    <i class="fas fa-info-circle"></i> 
                                    Uma notificação será enviada ao gerente via WhatsApp se a opção estiver ativada.
                                    ${WHATSAPP_CONFIG.gerenteNome ? `Destinatário: ${WHATSAPP_CONFIG.gerenteNome}` : ''}
                                </small>
                            </div>` : ''}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarChamado()">
                            <i class="fas fa-paper-plane"></i> ${chamadoId ? 'Atualizar' : 'Abrir'} Chamado
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const form = document.getElementById('form-chamado-manutencao');
    if (form) form.reset();
    
    document.getElementById('chamado-id').value = chamadoId || '';
    document.getElementById('chamado-prioridade').value = 'Normal';
    document.getElementById('chamado-enviar-whatsapp').checked = WHATSAPP_CONFIG.enabled;
    document.getElementById('chamado-enviar-whatsapp').disabled = !WHATSAPP_CONFIG.enabled;

    // Popular select de máquinas (MOVIDO PARA ANTES DA EDIÇÃO)
    const maquinaSelect = document.getElementById('chamado-maquina');
    if (maquinaSelect) {
        maquinaSelect.innerHTML = '<option value="">Carregando máquinas...</option>';

        if (!__maquinas_cache) {
            try {
                const maquinasSnap = await db.collection('maquinas').orderBy('nome').get();
                __maquinas_cache = maquinasSnap.docs.map(doc => doc.data());
            } catch (error) {
                console.error("Erro ao carregar máquinas:", error);
                __maquinas_cache = [];
            }
        }

        if (__maquinas_cache && __maquinas_cache.length > 0) {
            maquinaSelect.innerHTML = '<option value="">Selecione uma máquina</option>';
            __maquinas_cache.forEach(maquina => {
                maquinaSelect.innerHTML += `<option value="${maquina.codigo}">${maquina.nome} (Cód: ${maquina.codigo})</option>`;
            });
        } else {
            maquinaSelect.innerHTML = '<option value="">Nenhuma máquina encontrada</option>';
        }
    }

    // Se for edição, carrega os dados existentes
    if (chamadoId) {
        try {
            const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
            if (chamadoDoc.exists) {
                const data = chamadoDoc.data();
                document.getElementById('chamado-maquina').value = data.maquinaId || '';
                document.getElementById('chamado-motivo').value = data.motivo || '';
                document.getElementById('chamado-obs').value = data.observacoes || '';
                document.getElementById('chamado-prioridade').value = data.prioridade || 'Normal';
                document.getElementById('chamado-tipo-manutencao').value = data.tipoManutencao || 'Corretiva';
                document.getElementById('chamado-maquina-parada').checked = data.maquinaParada || false;
            }
        } catch (error) {
            console.error("Erro ao carregar dados do chamado:", error);
        }
    }

    // Configurar listener para mostrar/esconder campo de mês
    const tipoManutencaoSelect = document.getElementById('chamado-tipo-manutencao');
    const mesContainer = document.getElementById('chamado-mes-container');
    const mesSelect = document.getElementById('chamado-mes-referencia');

    if (tipoManutencaoSelect && mesContainer && mesSelect) {
        tipoManutencaoSelect.addEventListener('change', function() {
            if (this.value === 'Preventiva Mensal') {
                mesContainer.style.display = 'block';
                mesSelect.required = true;
                // Definir mês atual como padrão
                const mesAtual = new Date().getMonth() + 1;
                mesSelect.value = mesAtual.toString();
            } else {
                mesContainer.style.display = 'none';
                mesSelect.required = false;
                mesSelect.value = '';
            }
        });
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarChamado() {
    const maquinaId = document.getElementById('chamado-maquina')?.value;
    const motivo = document.getElementById('chamado-motivo')?.value;
    const observacoes = document.getElementById('chamado-obs')?.value;
    const maquinaParada = document.getElementById('chamado-maquina-parada')?.checked || false;
    const prioridade = document.getElementById('chamado-prioridade')?.value || 'Normal';
    const tipoManutencao = document.getElementById('chamado-tipo-manutencao')?.value;
    const mesReferencia = document.getElementById('chamado-mes-referencia')?.value;
    const enviarWhatsapp = document.getElementById('chamado-enviar-whatsapp')?.checked && WHATSAPP_CONFIG.enabled;
    const chamadoId = document.getElementById('chamado-id')?.value;

    if (!maquinaId || !motivo || !tipoManutencao) {
        mostrarMensagem("Selecione a máquina, tipo de manutenção e descreva o motivo.", "warning");
        return;
    }

    if (tipoManutencao === 'Preventiva Mensal' && !mesReferencia) {
        mostrarMensagem("Selecione o mês de referência para manutenção preventiva.", "warning");
        return;
    }

    try {
        const btnSalvar = document.querySelector('#manutencaoChamadoModal .btn-primary');
        const textoOriginal = btnSalvar.innerHTML;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btnSalvar.disabled = true;

        const chamadoData = {
            maquinaId,
            motivo,
            observacoes,
            maquinaParada,
            prioridade,
            paradaInicioTimestamp: maquinaParada ? firebase.firestore.FieldValue.serverTimestamp() : null,
            dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid,
            createdByNome: firebase.auth().currentUser?.displayName || 'Usuário',
            notificacaoEnviada: false
        };

        let docRef;
        let chamadoCompleto;
        
        if (chamadoId) {
            // Atualizar chamado existente
            await db.collection('manutencao_chamados').doc(chamadoId).update(chamadoData);
            docRef = db.collection('manutencao_chamados').doc(chamadoId);
            chamadoCompleto = { id: chamadoId, ...chamadoData };
            mostrarMensagem("Chamado atualizado com sucesso!", "success");
        } else {
            // Criar novo chamado
            chamadoData.status = 'Aberto';
            chamadoData.dataEncerramento = null;
            chamadoData.tempoParada = null;
            chamadoData.pecasUtilizadas = null;
            chamadoData.tipoManutencao = null;
            chamadoData.mecanicoResponsavelNome = null;
            
            docRef = await db.collection('manutencao_chamados').add(chamadoData);
            const novoId = docRef.id;
            chamadoCompleto = { id: novoId, ...chamadoData };
            
            // ENVIA NOTIFICAÇÃO WHATSAPP
            let notificacaoEnviada = false;
            if (enviarWhatsapp && WHATSAPP_CONFIG.enabled) {
                // Envia notificação principal
                notificacaoEnviada = enviarNotificacaoWhatsApp(chamadoCompleto);
                
                // Se for máquina parada, envia alerta crítico
                if (maquinaParada) {
                    setTimeout(() => enviarAlertaCriticoWhatsApp(chamadoCompleto), 1000);
                }
                
                // Atualiza status da notificação
                if (notificacaoEnviada) {
                    await docRef.update({ 
                        notificacaoEnviada: true,
                        notificacaoData: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            // Feedback para o usuário
            let mensagemSucesso = "✅ Chamado de manutenção aberto com sucesso!";
            if (enviarWhatsapp && notificacaoEnviada) {
                mensagemSucesso += " 📱 Notificação WhatsApp enviada.";
            } else if (enviarWhatsapp && !notificacaoEnviada) {
                mensagemSucesso += " ⚠️ Pop-up do WhatsApp bloqueado. Clique no botão WhatsApp na lista para enviar manualmente.";
            }
            mostrarMensagem(mensagemSucesso, "success");
        }
        
        // Fecha o modal
        bootstrap.Modal.getInstance(document.getElementById('manutencaoChamadoModal')).hide();
        
        // Recarrega a lista
        await carregarChamadosManutencao();

    } catch (error) {
        console.error("Erro ao salvar chamado:", error);
        mostrarMensagem("Erro ao salvar chamado: " + error.message, "error");
    } finally {
        const btnSalvar = document.querySelector('#manutencaoChamadoModal .btn-primary');
        if (btnSalvar) {
            btnSalvar.innerHTML = textoOriginal || '<i class="fas fa-paper-plane"></i> Salvar';
            btnSalvar.disabled = false;
        }
    }
}

// ============ FUNÇÕES DE GERENCIAMENTO ============
async function atualizarPrioridade(chamadoId, novaPrioridade) {
    if (!chamadoId || !novaPrioridade) {
        mostrarMensagem("Dados inválidos para atualizar prioridade", "warning");
        return;
    }
    
    try {
        await db.collection('manutencao_chamados').doc(chamadoId).update({
            prioridade: novaPrioridade,
            prioridadeAtualizadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            prioridadeAtualizadaPor: firebase.auth().currentUser?.uid
        });
        
        // Se for Urgente e máquina parada, reenvia notificação
        const chamado = __chamados_cache.find(c => c.id === chamadoId);
        if (novaPrioridade === 'Urgente' && chamado?.maquinaParada && WHATSAPP_CONFIG.enabled) {
            setTimeout(() => enviarAlertaCriticoWhatsApp({...chamado, prioridade: 'Urgente'}), 500);
        }
        
        mostrarMensagem(`Prioridade atualizada para ${novaPrioridade}!`, "info");
    } catch (error) {
        console.error("Erro ao atualizar prioridade:", error);
        mostrarMensagem("Falha ao atualizar a prioridade.", "error");
    }
}

async function iniciarAtendimento(chamadoId) {
    const modalId = 'iniciarAtendimentoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Iniciar Atendimento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="iniciar-atendimento-id">
                        <div class="mb-3">
                            <label class="form-label">Mecânico Responsável *</label>
                            <select class="form-select" id="iniciar-atendimento-mecanico" required></select>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <div id="pergunta-parada-container">
                                <input class="form-check-input" type="checkbox" id="iniciar-atendimento-parada-check">
                                <label class="form-check-label" for="iniciar-atendimento-parada-check">A manutenção exigirá que a máquina pare?</label>
                            </div>
                        </div>
                        <div class="mb-3" id="parada-prevista-container" style="display: none;">
                            <label class="form-label">Previsão de Início da Parada</label>
                            <input type="datetime-local" class="form-control" id="parada-inicio-previsto">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="confirmarInicioAtendimento()">Confirmar Início</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        // Adiciona o listener para o checkbox
        const paradaCheck = document.getElementById('iniciar-atendimento-parada-check');
        paradaCheck.addEventListener('change', function() {
            const container = document.getElementById('parada-prevista-container');
            const input = document.getElementById('parada-inicio-previsto');
            container.style.display = this.checked ? 'block' : 'none';
            input.disabled = !this.checked;
            
            if (this.checked) {
                // Define data/hora atual como padrão
                const now = new Date();
                const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                input.value = localDateTime;
            }
        });
    }

    // Resetar o formulário do modal
    document.getElementById('iniciar-atendimento-id').value = chamadoId;
    const paradaCheck = document.getElementById('iniciar-atendimento-parada-check');
    paradaCheck.checked = false;
    paradaCheck.disabled = false;
    document.getElementById('parada-prevista-container').style.display = 'none';
    document.getElementById('parada-inicio-previsto').value = '';
    document.getElementById('parada-inicio-previsto').disabled = true;

    // Popular select de mecânicos
    const mecanicoSelect = document.getElementById('iniciar-atendimento-mecanico');
    mecanicoSelect.innerHTML = '<option value="">Carregando...</option>';
    try {
        const mecanicosSnap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();
        mecanicoSelect.innerHTML = '<option value="">Selecione o mecânico</option>';
        mecanicosSnap.forEach(doc => {
            const func = doc.data();
            mecanicoSelect.innerHTML += `<option value="${doc.id}" data-nome="${func.nome}">${func.nome} - ${func.matricula || ''}</option>`;
        });
    } catch (error) {
        console.error("Erro ao carregar mecânicos:", error);
        mecanicoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    // VERIFICAÇÃO DA MÁQUINA PARADA
    try {
        const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
        const perguntaContainer = document.getElementById('pergunta-parada-container');

        if (chamadoDoc.exists && chamadoDoc.data().maquinaParada) {
            perguntaContainer.style.display = 'none'; // Esconde a pergunta
        } else {
            perguntaContainer.style.display = 'block'; // Mostra a pergunta
        }
    } catch (error) {
        console.error("Erro ao verificar máquina parada:", error);
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function confirmarInicioAtendimento() {
    const chamadoId = document.getElementById('iniciar-atendimento-id').value;
    const mecanicoSelect = document.getElementById('iniciar-atendimento-mecanico');
    const mecanicoId = mecanicoSelect.value;
    const mecanicoNome = mecanicoSelect.options[mecanicoSelect.selectedIndex].dataset.nome;

    const precisaParar = document.getElementById('iniciar-atendimento-parada-check').checked;
    const inicioPrevisto = document.getElementById('parada-inicio-previsto').value;

    if (!mecanicoId) {
        mostrarMensagem("Selecione o mecânico responsável.", "warning");
        return;
    }

    if (precisaParar && !inicioPrevisto) {
        mostrarMensagem("Se a máquina precisa parar, informe a data e hora previstas para o início da parada.", "warning");
        return;
    }

    try {
        const updateData = {
            status: 'Em Andamento',
            mecanicoResponsavelId: mecanicoId,
            mecanicoResponsavelNome: mecanicoNome,
            atendimentoIniciadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (precisaParar) {
            updateData.maquinaParada = true;
            // Apenas atualiza o timestamp se ele ainda não existir (para não sobrescrever o da abertura)
            const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
            if (chamadoDoc.exists && !chamadoDoc.data().paradaInicioTimestamp) {
                updateData.paradaInicioTimestamp = new Date(inicioPrevisto);
            }
            
            // Envia notificação de máquina que vai parar
            const chamado = __chamados_cache.find(c => c.id === chamadoId);
            if (chamado && WHATSAPP_CONFIG.enabled) {
                setTimeout(() => {
                    const mensagem = `⚠️ *ATENÇÃO: MÁQUINA VAI PARAR* ⚠️\n\n` +
                        `Máquina: ${chamado.maquinaId}\n` +
                        `Motivo: ${chamado.motivo}\n` +
                        `Mecânico: ${mecanicoNome}\n` +
                        `Previsão de parada: ${new Date(inicioPrevisto).toLocaleString('pt-BR')}\n\n` +
                        `Preparem-se para a parada programada!`;
                    
                    const telefone = formatarTelefoneWhatsApp(WHATSAPP_CONFIG.gerenteTelefone);
                    if (telefone) {
                        const mensagemCodificada = encodeURIComponent(mensagem);
                        const whatsappLink = `https://wa.me/${telefone}?text=${mensagemCodificada}`;
                        window.open(whatsappLink, '_blank');
                    }
                }, 500);
            }
        }

        const chamadoRef = db.collection('manutencao_chamados').doc(chamadoId);
        await chamadoRef.update(updateData);

        mostrarMensagem("Atendimento iniciado com sucesso!", "info");
        bootstrap.Modal.getInstance(document.getElementById('iniciarAtendimentoModal')).hide();
    } catch (error) {
        console.error("Erro ao iniciar atendimento:", error);
        mostrarMensagem("Erro ao atualizar o status do chamado.", "error");
    }
}

async function abrirModalFinalizar(chamadoId) {
    const modalId = 'finalizarChamadoModal';
    let modalEl = document.getElementById(modalId);

    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-check-circle"></i> Finalizar Chamado de Manutenção
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="finalizar-chamado-id">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Tipo de Manutenção Realizada *</label>
                                <select class="form-select" id="finalizar-tipo-manutencao" required>
                                    <option value="">Selecione...</option>
                                    <option>Corretiva</option>
                                    <option>Preventiva</option>
                                    <option>Preditiva</option>
                                    <option>Melhoria</option>
                                    <option>Ajuste Operacional</option>
                                    <option>Lubrificação</option>
                                    <option>Inspeção</option>
                                    <option>Calibração</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Mecânico Responsável *</label>
                                <select class="form-select" id="finalizar-mecanico" required></select>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Observações do Mecânico *</label>
                            <textarea class="form-control" id="finalizar-obs" rows="4" placeholder="Descreva o serviço realizado, diagnóstico, etc." required></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Peças Utilizadas (opcional)</label>
                            <textarea class="form-control" id="finalizar-pecas" rows="3" placeholder="Ex: 1x Rolamento 6203, 2m de Correia XPTO..."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Tempo Total de Parada</label>
                            <div class="input-group">
                                <input type="number" class="form-control" id="finalizar-tempo-horas" placeholder="Horas" min="0" value="0">
                                <span class="input-group-text">h</span>
                                <input type="number" class="form-control" id="finalizar-tempo-minutos" placeholder="Minutos" min="0" max="59" value="0">
                                <span class="input-group-text">min</span>
                            </div>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="finalizar-enviar-whatsapp" ${WHATSAPP_CONFIG.enabled ? 'checked' : ''}>
                            <label class="form-check-label" for="finalizar-enviar-whatsapp">
                                <i class="fab fa-whatsapp text-success"></i> Enviar notificação de conclusão
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-success" onclick="finalizarChamado()">
                            <i class="fas fa-check"></i> Finalizar Chamado
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    // Preencher dados do chamado no modal de finalização
    try {
        const chamadoDoc = await db.collection('manutencao_chamados').doc(chamadoId).get();
        if (chamadoDoc.exists) {
            const chamadoData = chamadoDoc.data();
            // Se a máquina estava parada, o campo de observações do mecânico se torna obrigatório
            const obsMecanicoInput = document.getElementById('finalizar-obs');
            if (obsMecanicoInput) {
                obsMecanicoInput.required = chamadoData.maquinaParada || false;
            }
            
            // Preencher tempo de parada se existir
            if (chamadoData.tempoParada) {
                const tempoMatch = chamadoData.tempoParada.match(/(\d+)h\s*(\d+)?m?/);
                if (tempoMatch) {
                    document.getElementById('finalizar-tempo-horas').value = tempoMatch[1] || 0;
                    document.getElementById('finalizar-tempo-minutos').value = tempoMatch[2] || 0;
                }
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do chamado:", error);
    }

    document.getElementById('finalizar-chamado-id').value = chamadoId;
    document.getElementById('finalizar-tipo-manutencao').value = '';
    document.getElementById('finalizar-obs').value = '';
    document.getElementById('finalizar-pecas').value = '';
    document.getElementById('finalizar-tempo-horas').value = '0';
    document.getElementById('finalizar-tempo-minutos').value = '0';
    document.getElementById('finalizar-enviar-whatsapp').checked = WHATSAPP_CONFIG.enabled;

    // Popular select de mecânicos
    const mecanicoSelect = document.getElementById('finalizar-mecanico');
    if (mecanicoSelect) {
        mecanicoSelect.innerHTML = '<option value="">Carregando...</option>';
        try {
            const mecanicosSnap = await db.collection('funcionarios').where('isMecanico', '==', true).orderBy('nome').get();
            mecanicoSelect.innerHTML = '<option value="">Selecione o mecânico</option>';
            mecanicosSnap.forEach(doc => {
                const funcionario = doc.data();
                mecanicoSelect.innerHTML += `<option value="${doc.id}">${funcionario.nome} - ${funcionario.matricula || ''}</option>`;
            });
        } catch (error) {
            console.error("Erro ao carregar mecânicos:", error);
            mecanicoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function finalizarChamado() {
    const chamadoId = document.getElementById('finalizar-chamado-id').value;
    const tipoManutencao = document.getElementById('finalizar-tipo-manutencao')?.value;
    const observacoesMecanico = document.getElementById('finalizar-obs')?.value;
    const pecasUtilizadas = document.getElementById('finalizar-pecas')?.value;
    const mecanicoSelect = document.getElementById('finalizar-mecanico');
    const mecanicoId = mecanicoSelect?.value;
    const mecanicoNome = mecanicoSelect ? mecanicoSelect.options[mecanicoSelect.selectedIndex].text.split(' - ')[0] : '';
    const horas = parseInt(document.getElementById('finalizar-tempo-horas')?.value) || 0;
    const minutos = parseInt(document.getElementById('finalizar-tempo-minutos')?.value) || 0;
    const enviarWhatsapp = document.getElementById('finalizar-enviar-whatsapp')?.checked;

    if (!tipoManutencao) {
        mostrarMensagem("Selecione o tipo de manutenção realizada.", "warning");
        return;
    }

    if (!mecanicoId) {
        mostrarMensagem("Selecione o mecânico responsável.", "warning");
        return;
    }
    
    if (!observacoesMecanico) {
        mostrarMensagem("Preencha as observações do mecânico.", "warning");
        return;
    }

    try {
        const btn = document.querySelector('#finalizarChamadoModal .btn-success');
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizando...';

        const chamadoRef = db.collection('manutencao_chamados').doc(chamadoId);
        const doc = await chamadoRef.get();
        if (!doc.exists) throw new Error("Chamado não encontrado");

        const chamado = doc.data();
        const dataEncerramento = new Date();
        let tempoParada = null;

        // Calcula o tempo de parada
        if (chamado.paradaInicioTimestamp) {
            const inicio = chamado.paradaInicioTimestamp.toDate();
            const diffMs = dataEncerramento - inicio;
            const horasCalc = Math.floor(diffMs / 3600000);
            const minutosCalc = Math.floor((diffMs % 3600000) / 60000);
            
            tempoParada = `${horasCalc}h ${minutosCalc}m`;
        } else if (horas > 0 || minutos > 0) {
            tempoParada = `${horas}h ${minutos}m`;
        }

        const updateData = {
            status: 'Concluído',
            maquinaParada: false,
            dataEncerramento: dataEncerramento,
            tempoParada: tempoParada,
            tipoManutencao: tipoManutencao,
            observacoesMecanico: observacoesMecanico,
            pecasUtilizadas: pecasUtilizadas || null,
            mecanicoResponsavelId: mecanicoId,
            mecanicoResponsavelNome: mecanicoNome,
            encerradoPor: firebase.auth().currentUser?.uid,
            encerradoPorNome: firebase.auth().currentUser?.displayName || 'Usuário'
        };

        await chamadoRef.update(updateData);

        // Envia notificação de conclusão se solicitado
        if (enviarWhatsapp && WHATSAPP_CONFIG.enabled) {
            setTimeout(() => {
                const mensagemConclusao = `✅ *CHAMADO CONCLUÍDO* ✅\n\n` +
                    `Máquina: ${chamado.maquinaId}\n` +
                    `Motivo: ${chamado.motivo}\n` +
                    `Tipo: ${tipoManutencao}\n` +
                    `Mecânico: ${mecanicoNome}\n` +
                    `Tempo de parada: ${tempoParada || 'N/A'}\n` +
                    `Concluído em: ${dataEncerramento.toLocaleString('pt-BR')}\n\n` +
                    `🔧 *SERVIÇO REALIZADO:*\n${observacoesMecanico.substring(0, 200)}${observacoesMecanico.length > 200 ? '...' : ''}`;
                
                const telefone = formatarTelefoneWhatsApp(WHATSAPP_CONFIG.gerenteTelefone);
                if (telefone) {
                    const mensagemCodificada = encodeURIComponent(mensagemConclusao);
                    const whatsappLink = `https://wa.me/${telefone}?text=${mensagemCodificada}`;
                    window.open(whatsappLink, '_blank');
                }
            }, 1000);
        }

        mostrarMensagem("Chamado encerrado com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('finalizarChamadoModal')).hide();

    } catch (error) {
        console.error("Erro ao finalizar chamado:", error);
        mostrarMensagem("Erro ao finalizar o chamado.", "error");
    } finally {
        const btn = document.querySelector('#finalizarChamadoModal .btn-success');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal || '<i class="fas fa-check"></i> Finalizar Chamado';
        }
    }
}

async function excluirChamado(chamadoId) {
    if (!confirm("Tem certeza que deseja excluir este chamado permanentemente?\n\n⚠️ Esta ação não pode ser desfeita!")) {
        return;
    }
    
    try {
        await db.collection('manutencao_chamados').doc(chamadoId).delete();
        mostrarMensagem("Chamado excluído com sucesso!", "info");
    } catch (error) {
        console.error("Erro ao excluir chamado:", error);
        mostrarMensagem("Erro ao excluir o chamado.", "error");
    }
}

function calcularTempoDeParada(inicio, fim) {
    let diffMs = fim - inicio;
    const horas = Math.floor(diffMs / 3600000);
    diffMs -= horas * 3600000;
    const minutos = Math.floor(diffMs / 60000);

    let resultado = '';
    if (horas > 0) resultado += `${horas}h `;
    if (minutos > 0) resultado += `${minutos}m`;

    return resultado.trim() || 'Menos de 1m';
}

async function imprimirChamado(chamadoId) {
    const chamado = __chamados_cache.find(c => c.id === chamadoId);
    if (!chamado) {
        mostrarMensagem("Chamado não encontrado para impressão.", "error");
        return;
    }

    const dataAbertura = chamado.dataAbertura?.toDate()?.toLocaleString('pt-BR') || 'N/A';
    const dataEncerramento = chamado.dataEncerramento?.toDate()?.toLocaleString('pt-BR') || 'Pendente';

    // Buscar o número do patrimônio da máquina
    let patrimonio = 'N/A';
    let maquinaNome = chamado.maquinaId;
    try {
        const maquinaSnap = await db.collection('maquinas').where('codigo', '==', chamado.maquinaId).limit(1).get();
        if (!maquinaSnap.empty) {
            const maquinaData = maquinaSnap.docs[0].data();
            patrimonio = maquinaData.patrimonio || 'N/A';
            maquinaNome = maquinaData.nome || chamado.maquinaId;
        }
    } catch (e) { 
        console.error("Erro ao buscar patrimônio da máquina:", e); 
    }

    const conteudo = `
        <html>
            <head>
                <title>Ordem de Manutenção - Chamado ${chamado.id.substring(0, 6)}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; }
                    .print-container { max-width: 800px; margin: auto; padding: 15px; }
                    .os-header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #dee2e6; padding-bottom: 0.75rem; }
                    @page { size: A4; margin: 0.5cm; }
                    .os-header h3 { font-weight: 600; font-size: 1.5rem; }
                    .section-title { font-weight: 500; border-bottom: 1px solid #eee; padding-bottom: 3px; margin-top: 1rem; margin-bottom: 0.75rem; font-size: 1rem; }
                    .field-label { font-weight: bold; color: #6c757d; font-size: 0.85rem; }
                    .field-value { font-size: 0.95rem; }
                    .field-box { border: 1px solid #e9ecef; background-color: #f8f9fa; padding: 0.75rem; border-radius: .25rem; min-height: 80px; font-size: 0.9rem; }
                    .signature-area { margin-top: 3rem; }
                    .signature-line { border-bottom: 1px solid #343a40; margin-top: 2rem; }
                    .table td, .table th { padding: 0.3rem; font-size: 0.85rem; }
                    @media print {
                        body { margin: 0; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .alert-danger { background-color: #f8d7da !important; color: #721c24 !important; border-color: #f5c6cb !important; }
                        .btn { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="os-header">
                        <h3>ORDEM DE SERVIÇO DE MANUTENÇÃO</h3>
                        <p class="text-muted mb-0">Chamado ID: ${chamado.id.substring(0, 8).toUpperCase()}</p>
                        <p class="text-muted mb-0">Data de impressão: ${new Date().toLocaleString('pt-BR')}</p>
                    </div>

                    ${chamado.maquinaParada ? '<div class="alert alert-danger text-center p-2 mb-3"><h5 class="mb-0"><i class="fas fa-exclamation-triangle"></i> ATENÇÃO: MÁQUINA PARADA</h5></div>' : ''}

                    <h5 class="section-title">1. Identificação do Chamado</h5>
                    <div class="row">
                        <div class="col-4 mb-2"><div class="field-label">Máquina/Equipamento</div><div class="field-value">${maquinaNome}</div></div>
                        <div class="col-4 mb-2"><div class="field-label">Código</div><div class="field-value">${chamado.maquinaId}</div></div>
                        <div class="col-4 mb-2"><div class="field-label">Nº Patrimônio</div><div class="field-value">${patrimonio}</div></div>
                        <div class="col-4 mb-2"><div class="field-label">Status</div><div class="field-value">${chamado.status}</div></div>
                        <div class="col-4 mb-2"><div class="field-label">Prioridade</div><div class="field-value">${chamado.prioridade}</div></div>
                        <div class="col-4 mb-2"><div class="field-label">Tipo</div><div class="field-value">${chamado.tipoManutencao || 'Não informado'}</div></div>
                        <div class="col-6 mb-2"><div class="field-label">Data de Abertura</div><div class="field-value">${dataAbertura}</div></div>
                        <div class="col-6 mb-2"><div class="field-label">Data de Encerramento</div><div class="field-value">${dataEncerramento}</div></div>
                    </div>

                    <h5 class="section-title">2. Descrição do Problema</h5>
                    <div class="field-box">${chamado.motivo || ''}</div>

                    <h5 class="section-title">3. Detalhes da Manutenção</h5>
                    <div class="row mb-2">
                        <div class="col-6"><div class="field-label">Mecânico Responsável</div><div class="field-value">${chamado.mecanicoResponsavelNome || 'Não informado'}</div></div>
                        <div class="col-6"><div class="field-label">Tempo de Parada</div><div class="field-value">${chamado.tempoParada || 'N/A'}</div></div>
                    </div>

                    <div class="mb-2">
                        <div class="field-label">Serviço Realizado / Observações</div>
                        <div class="field-box">${chamado.observacoesMecanico || 'A preencher...'}</div>
                    </div>
                    <div class="mb-2">
                        <div class="field-label">Peças Utilizadas</div>
                        <div class="field-box">${chamado.pecasUtilizadas || 'Nenhuma peça informada.'}</div>
                    </div>

                    <div class="row signature-area">
                        <div class="col-6 text-center">
                            <div class="signature-line"></div>
                            <p class="mb-0 mt-2">Assinatura do Mecânico</p>
                            <p class="text-muted">${chamado.mecanicoResponsavelNome || ''}</p>
                        </div>
                        <div class="col-6 text-center">
                            <div class="signature-line"></div>
                            <p class="mb-0 mt-2">Assinatura do Gerente/Supervisor</p>
                            <p class="text-muted">${WHATSAPP_CONFIG.gerenteNome || ''}</p>
                        </div>
                    </div>
                    
                    <div class="mt-3 text-center text-muted">
                        <small>Sistema de Gerenciamento de Manutenção - ${new Date().getFullYear()}</small>
                    </div>
                </div>
            </body>
        </html>
    `;

    // Imprimir utilizando janela de impressão
    const printWindow = window.open('', '_blank');
    printWindow.document.write(conteudo);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        // Não fecha automaticamente para permitir visualização
    }, 500);
}

// ============ FUNÇÕES DE MANUTENÇÃO PREVENTIVA ============
async function criarChamadosPreventivosMensais(maquinaId, motivo, observacoes, prioridade, mesReferencia, enviarWhatsapp) {
    try {
        const btnSalvar = document.querySelector('#manutencaoChamadoModal .btn-primary');
        const textoOriginal = btnSalvar.innerHTML;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando chamados preventivos...';
        btnSalvar.disabled = true;

        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth() + 1; // Janeiro = 1
        const mesInicio = parseInt(mesReferencia);

        let chamadosCriados = 0;
        let notificacoesEnviadas = 0;

        // Criar chamados de mesReferencia até dezembro
        for (let mes = mesInicio; mes <= 12; mes++) {
            const dataAbertura = new Date(anoAtual, mes - 1, 1); // Primeiro dia do mês

            const chamadoData = {
                maquinaId,
                motivo: `${motivo} - ${getNomeMes(mes)}/${anoAtual}`,
                observacoes,
                maquinaParada: false, // Manutenção preventiva não para a máquina
                prioridade,
                tipoManutencao: 'Preventiva Mensal',
                dataAbertura: firebase.firestore.Timestamp.fromDate(dataAbertura),
                status: 'Aberto',
                dataEncerramento: null,
                tempoParada: null,
                pecasUtilizadas: null,
                mecanicoResponsavelNome: null,
                paradaInicioTimestamp: null,
                createdByUid: firebase.auth().currentUser?.uid,
                createdByNome: firebase.auth().currentUser?.displayName || 'Usuário',
                notificacaoEnviada: false
            };

            const docRef = await db.collection('manutencao_chamados').add(chamadoData);
            chamadosCriados++;

            // Para o mês atual, enviar notificação se solicitado
            if (mes === mesAtual && enviarWhatsapp && WHATSAPP_CONFIG.enabled) {
                const chamadoCompleto = { id: docRef.id, ...chamadoData };
                const notificacaoEnviada = enviarNotificacaoWhatsApp(chamadoCompleto);

                if (notificacaoEnviada) {
                    notificacoesEnviadas++;
                    await docRef.update({
                        notificacaoEnviada: true,
                        notificacaoData: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }

        let mensagemSucesso = `✅ ${chamadosCriados} chamados preventivos criados com sucesso!`;
        if (enviarWhatsapp && notificacoesEnviadas > 0) {
            mensagemSucesso += ` 📱 ${notificacoesEnviadas} notificação(ões) WhatsApp enviada(s).`;
        }
        mostrarMensagem(mensagemSucesso, "success");

    } catch (error) {
        console.error("Erro ao criar chamados preventivos:", error);
        mostrarMensagem("Erro ao criar chamados preventivos: " + error.message, "error");
    } finally {
        const btnSalvar = document.querySelector('#manutencaoChamadoModal .btn-primary');
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = textoOriginal || '<i class="fas fa-paper-plane"></i> Abrir Chamado';
        }
    }
}

function getNomeMes(mes) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || '';
}

// ============ FUNÇÕES UTILITÁRIAS ============
function mostrarMensagem(mensagem, tipo = "info") {
    // Remove mensagens anteriores
    const mensagensAntigas = document.querySelectorAll('.alert-toast');
    mensagensAntigas.forEach(m => m.remove());

    const toast = document.createElement('div');
    toast.className = `alert alert-${tipo} alert-toast position-fixed`;
    toast.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 0.5rem 1rem rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    let icon = '';
    switch(tipo) {
        case 'success': icon = '<i class="fas fa-check-circle me-2"></i>'; break;
        case 'error': icon = '<i class="fas fa-exclamation-circle me-2"></i>'; break;
        case 'warning': icon = '<i class="fas fa-exclamation-triangle me-2"></i>'; break;
        default: icon = '<i class="fas fa-info-circle me-2"></i>'; break;
    }
    
    toast.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>${icon} <span>${mensagem}</span></div>
            <button type="button" class="btn-close ms-2" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove automaticamente após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Função utilitária para formatar telefone WhatsApp
function formatarTelefoneWhatsApp(telefone) {
    if (!telefone) return '';
    
    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');
    
    // Validações
    if (numeros.length < 10 || numeros.length > 13) {
        console.warn('Número de telefone inválido:', telefone);
        return '';
    }
    
    // WhatsApp espera: código do país + DDD + número
    // Ex: 55 (Brasil) + 11 (SP) + 999999999 = 13 dígitos
    
    // Se já tem código do país (começa com 55) e tem 13 dígitos
    if (numeros.startsWith('55') && numeros.length === 13) {
        return numeros;
    }
    
    // Se tem 11 dígitos (DDD 2 + número 9)
    if (numeros.length === 11) {
        return '55' + numeros;
    }
    
    // Se tem 10 dígitos (DDD 2 + número 8 - antigo)
    if (numeros.length === 10) {
        return '55' + numeros;
    }
    
    // Se tem 12 dígitos (código país + 10 dígitos)
    if (numeros.length === 12) {
        return numeros;
    }
    
    console.warn('Formato de telefone não reconhecido:', telefone);
    return '';
}

// Função para limpar listener quando sair da página
function limparListenerManutencao() {
    if (__unsubscribe_manutencao) {
        __unsubscribe_manutencao();
        __unsubscribe_manutencao = null;
        console.log('Listener de manutenção removido');
    }
}

// Adicionar estilos CSS para as animações
if (!document.querySelector('#manutencao-styles')) {
    const style = document.createElement('style');
    style.id = 'manutencao-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .stat-card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: none;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.2);
        }
        
        .stat-card .number {
            font-weight: 700;
            margin: 8px 0;
        }
        
        .stat-card .label {
            font-size: 0.85rem;
            letter-spacing: 0.5px;
            opacity: 0.9;
        }
        
        .table-hover tbody tr:hover {
            background-color: rgba(0,0,0,0.03);
        }
    `;
    document.head.appendChild(style);
}

// Configurar listeners para limpeza
window.addEventListener('beforeunload', limparListenerManutencao);
window.addEventListener('pagehide', limparListenerManutencao);

// Inicializa quando o DOM estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarManutencao);
} else {
    setTimeout(inicializarManutencao, 100);
}