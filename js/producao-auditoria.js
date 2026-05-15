/**
 * NEXTER - Módulo de Auditoria de Produção
 */

let __auditoria_qr_stream = null;
let __auditoria_ficha_atual = null;

async function inicializarProducaoAuditoria() {
    console.log("Inicializando módulo de Auditoria de Fichas");
}

window.auditoriaBuscarFicha = async () => {
    const codigoInput = document.getElementById('auditoria-input-codigo');
    let codigo = codigoInput.value.trim().toUpperCase();

    if (!codigo) {
        mostrarMensagem("Por favor, digite o código da ficha.", "warning");
        return;
    }

    if (!codigo.startsWith('FCH-')) {
        codigo = 'FCH-' + codigo;
    }

    codigoInput.value = codigo;
    const btnBusca = document.querySelector('button[onclick="window.auditoriaBuscarFicha()"]');
    const conteudoResultados = document.getElementById('auditoria-resultados');
    
    if (btnBusca) btnBusca.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const db = firebase.firestore();
        const docs = await db.collection('producao_fichas').where('codigo', '==', codigo).get();

        if (docs.empty) {
            mostrarMensagem("Ficha não encontrada no sistema. Pode ser uma ficha falsa ou de outro sistema.", "error");
            conteudoResultados.classList.add('d-none');
            return;
        }

        const doc = docs.docs[0];
        const ficha = { id: doc.id, ...doc.data() };
        __auditoria_ficha_atual = ficha;

        renderizarAuditoria(ficha);
        conteudoResultados.classList.remove('d-none');

    } catch (error) {
        console.error("Erro ao buscar ficha para auditoria:", error);
        mostrarMensagem("Erro ao buscar informações da ficha.", "error");
    } finally {
        if (btnBusca) btnBusca.innerHTML = 'Buscar';
    }
};

function renderizarAuditoria(ficha) {
    // 1. Header
    document.getElementById('auditoria-codigo-display').textContent = ficha.codigo;
    
    const badgeStatus = document.getElementById('auditoria-badge-status');
    if (ficha.status === 'aberta') {
        badgeStatus.className = 'badge bg-primary mb-2';
        badgeStatus.textContent = 'Em Aberto (Aguardando Produção)';
    } else if (ficha.status === 'concluida') {
        badgeStatus.className = 'badge bg-success mb-2';
        badgeStatus.textContent = 'Concluída';
    } else if (ficha.status === 'cancelada') {
        badgeStatus.className = 'badge bg-danger mb-2';
        badgeStatus.textContent = 'Cancelada';
    }

    document.getElementById('auditoria-data-criacao').textContent = formatarDataAuditoria(ficha.createdAt);
    document.getElementById('auditoria-impresso-por').innerHTML = `<i class="fas fa-user-circle me-1"></i>${ficha.geradoPorNome || 'Sistema'}`;
    
    // 2. Validações
    document.getElementById('auditoria-autenticidade').innerHTML = '<i class="fas fa-check-circle me-1"></i>Válida (Nexter)';
    
    const divDuplicidade = document.getElementById('auditoria-duplicidade');
    if (ficha.status === 'concluida') {
        divDuplicidade.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Já Apontada';
        divDuplicidade.className = 'fw-bold text-warning';
    } else {
        divDuplicidade.innerHTML = '<i class="fas fa-check me-1"></i>Liberada';
        divDuplicidade.className = 'fw-bold text-success';
    }

    let tempoString = '--';
    if (ficha.dataProducao && ficha.createdAt) {
        // Tempo entre a criação da ficha e o apontamento (em horas/minutos)
        const inicio = ficha.createdAt.toDate ? ficha.createdAt.toDate() : new Date(ficha.createdAt);
        const fim = ficha.dataProducao.toDate ? ficha.dataProducao.toDate() : new Date(ficha.dataProducao);
        const diffMs = fim - inicio;
        
        if (diffMs > 0) {
            const horas = Math.floor(diffMs / 3600000);
            const minutos = Math.floor((diffMs % 3600000) / 60000);
            tempoString = `${horas}h ${minutos}m`;
        }
    }
    document.getElementById('auditoria-tempo').innerHTML = `<i class="fas fa-clock me-1"></i>${tempoString}`;

    // 3. Tabela de Produtos e Soma Total
    const tbody = document.getElementById('auditoria-tabela-produtos');
    tbody.innerHTML = '';
    let totalPecas = 0;
    let totalProduzido = 0;

    if (ficha.produtos && ficha.produtos.length > 0) {
        ficha.produtos.forEach(p => {
            const quantEsperada = parseInt(p.quantidade) || 0;
            const quantProduzida = (ficha.status === 'concluida') ? quantEsperada : 0; // Simplificação para status concluido vs pendente
            
            totalPecas += quantEsperada;
            totalProduzido += quantProduzida;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4 fw-bold text-dark">${p.codigo || '--'}</td>
                <td>
                    <div class="fw-bold">${p.descricao || 'Produto não identificado'}</div>
                    ${p.cor ? `<div class="small text-muted">Cor: ${p.cor}</div>` : ''}
                </td>
                <td class="text-center"><span class="badge bg-light text-dark border">${p.tamanho || 'U'}</span></td>
                <td class="text-center fw-bold ${quantProduzida > 0 ? 'text-success' : 'text-muted'}">${quantProduzida} / ${quantEsperada}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Nenhum produto listado nesta ficha.</td></tr>';
    }
    
    document.getElementById('auditoria-total-pecas').textContent = `${totalProduzido} / ${totalPecas}`;

    // 4. Timeline de Histórico
    gerarTimeline(ficha);
}

function gerarTimeline(ficha) {
    const timeline = document.getElementById('auditoria-timeline');
    timeline.innerHTML = '';

    const addEvent = (icon, colorClass, title, info, dateString) => {
        timeline.innerHTML += `
            <div class="timeline-item">
                <div class="timeline-marker ${colorClass}"><i class="${icon}"></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">${title}</div>
                    <div class="timeline-info">${info}</div>
                    <div class="timeline-date"><i class="far fa-clock me-1"></i>${dateString}</div>
                </div>
            </div>
        `;
    };

    // Evento: Geração da Ficha
    addEvent(
        'fas fa-print', 'info', 
        'Ficha Gerada e Impressa', 
        `Por: ${ficha.geradoPorNome || 'Sistema'} (Setor: ${ficha.setor || '--'})`,
        formatarDataAuditoria(ficha.createdAt)
    );

    // Evento: Apontamento / Conclusão
    if (ficha.status === 'concluida') {
        const dataProd = formatarDataAuditoria(ficha.dataProducao || ficha.updatedAt);
        const opNome = ficha.operadorNome || '--';
        addEvent(
            'fas fa-check', 'success',
            'Produção Apontada',
            `Operador: ${opNome}<br>Apontado no sistema via: Lançamento de Produção`,
            dataProd
        );
    } else if (ficha.status === 'cancelada') {
        addEvent(
            'fas fa-times', 'danger',
            'Ficha Cancelada',
            `Motivo: Não informado`,
            formatarDataAuditoria(ficha.updatedAt)
        );
    }

    // Se houve relançamento/substituição (Lógica customizada se existir)
    if (ficha.historicoAlteracoes && Array.isArray(ficha.historicoAlteracoes)) {
        ficha.historicoAlteracoes.forEach(alt => {
            addEvent(
                'fas fa-edit', 'warning',
                'Ficha Alterada / Substituída',
                `Motivo: ${alt.motivo || 'Revisão'}<br>Por: ${alt.usuarioNome || 'Admin'}`,
                formatarDataAuditoria(alt.data)
            );
        });
    }
}

function formatarDataAuditoria(timestamp) {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date)) return '--';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

window.auditoriaAbrirApontamento = () => {
    if (!__auditoria_ficha_atual) return;
    
    if (__auditoria_ficha_atual.status === 'concluida') {
        if (!confirm("Esta ficha já está marcada como concluída. Deseja registrar uma substituição/re-apontamento?")) {
            return;
        }
    }
    
    // O usuário quer fazer apontamento manual da ficha. Redirecionar para Lançar Produção
    // e preencher o código da ficha no modal
    carregarSecao('producao-lancamento').then(() => {
        // Aguarda renderização
        setTimeout(() => {
            // Se existir o método no gestao, usamos
            if (typeof buscarFichaAuditoria === 'function') {
                const modalEl = document.getElementById('modalAuditoriaFicha');
                if (modalEl) {
                    const input = document.getElementById('af-codigo-ficha');
                    if (input) {
                        input.value = __auditoria_ficha_atual.codigo;
                        new bootstrap.Modal(modalEl).show();
                        buscarFichaAuditoria();
                    }
                }
            }
        }, 500);
    });
};

// ================================================================
// SCANNER QR CODE (AUDITORIA)
// ================================================================

window.auditoriaAbrirScanner = () => {
    const modalEl = document.getElementById('modalScannerAuditoria');
    if (!modalEl) return;
    
    modalEl.addEventListener('hidden.bs.modal', () => {
        window.auditoriaPararScanner();
    }, { once: true });

    new bootstrap.Modal(modalEl).show();
    setTimeout(() => iniciarCameraAuditoria(), 400);
};

window.auditoriaPararScanner = () => {
    if (__auditoria_qr_stream) {
        __auditoria_qr_stream.getTracks().forEach(t => t.stop());
        __auditoria_qr_stream = null;
    }
};

async function iniciarCameraAuditoria() {
    const video = document.getElementById('auditoria-qr-video');
    const canvas = document.getElementById('auditoria-qr-canvas');
    const status = document.getElementById('auditoria-qr-status');
    if (!video) return;

    if (!window.jsQR) {
        status.textContent = 'Carregando leitor...';
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    status.textContent = 'Acessando câmera...';
    try {
        __auditoria_qr_stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        video.srcObject = __auditoria_qr_stream;
        video.setAttribute("playsinline", true);
        video.play();
        status.textContent = 'Aponte para o QR Code';

        requestAnimationFrame(() => escanearFrameAuditoria(video, canvas, status));
    } catch (err) {
        console.error("Erro câmera:", err);
        status.textContent = 'Erro ao acessar câmera.';
        status.className = 'mt-4 badge bg-danger px-3 py-2 rounded-pill fw-normal';
    }
}

function escanearFrameAuditoria(video, canvas, status) {
    if (!__auditoria_qr_stream) return; // Parou

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

        if (code) {
            console.log("QR Lido Auditoria:", code.data);
            
            // Toca um som de bipe sucesso
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Frequência do bipe
                oscillator.connect(audioCtx.destination);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.1);
            } catch (e) {}

            window.auditoriaPararScanner();
            
            const modalEl = document.getElementById('modalScannerAuditoria');
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();

            // Preenche o input e busca
            const inputCodigo = document.getElementById('auditoria-input-codigo');
            if (inputCodigo) {
                // Tratar se a string tiver prefixo ou não
                let codigoLimpo = code.data;
                if (!codigoLimpo.startsWith('FCH-') && /^[A-Z0-9\-]+$/.test(codigoLimpo)) {
                    // Algumas fichas antigas poderiam ser apenas o ID ou já vir com FCH-
                    codigoLimpo = 'FCH-' + codigoLimpo;
                }
                inputCodigo.value = codigoLimpo;
                window.auditoriaBuscarFicha();
            }
            return;
        }
    }
    requestAnimationFrame(() => escanearFrameAuditoria(video, canvas, status));
}
