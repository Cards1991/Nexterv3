/**
 * NEXTER - Operação do Vigia (Celular Corporativo Compartilhado)
 * js/vigilancia-operacao.js
 */

(function () {
    'use strict';

    // Estados da Sessão do Vigia
    let sessaoVigia = null; // { id, matricula, nome }
    let pinDigitado = '';
    let rondaAtiva = null; // { id, rotaId, rotaNome, pontos, inicio, ultimaLat, ultimaLng }

    // Recursos de hardware e monitoramento
    let watchGpsId = null;
    let wakeLockInstance = null;
    let mapaVigia = null;
    let markerVigia = null;
    let polylineVigia = null;
    let checkpointsMarkers = [];
    let html5QrCodeScanner = null;
    let timerRondaInterval = null;
    let ultimaPosicaoRegistrada = null;
    let distanciaTotalAcumulada = 0;
    let trajetoEmMemoria = [];

    // Helper: Gerador de hash SHA-256 com salt
    async function hashPin(pin, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fórmula de Haversine para cálculo de distância entre duas coordenadas em metros
    function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Raio da Terra em metros
        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distância em metros
    }

    // ==============================================
    // 1. TECLADO VIRTUAL E AUTENTICAÇÃO DO VIGIA
    // ==============================================

    window.teclarPin = function (digito) {
        if (pinDigitado.length < 6) {
            pinDigitado += digito;
            atualizarDisplayPin();
        }
    };

    window.apagarPin = function () {
        if (pinDigitado.length > 0) {
            pinDigitado = pinDigitado.slice(0, -1);
            atualizarDisplayPin();
        }
    };

    window.limparPin = function () {
        pinDigitado = '';
        atualizarDisplayPin();
    };

    function atualizarDisplayPin() {
        for (let i = 0; i < 6; i++) {
            const dot = document.getElementById(`dot-${i}`);
            if (dot) {
                if (i < pinDigitado.length) {
                    dot.classList.add('filled');
                } else {
                    dot.classList.remove('filled');
                }
            }
        }
    }

    window.autenticarVigia = async function () {
        const inputMatricula = document.getElementById('input-matricula');
        const feedback = document.getElementById('login-feedback');
        const matricula = inputMatricula ? inputMatricula.value.trim() : '';

        if (!matricula) {
            feedback.innerText = "Informe sua matrícula corporativa.";
            return;
        }

        if (pinDigitado.length < 4) {
            feedback.innerText = "Digite seu PIN completo (mínimo 4 dígitos).";
            return;
        }

        feedback.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Validando credenciais...';

        try {
            // Busca vigia ativo no Firestore
            const snap = await window.db.collection('vigilancia_vigias')
                .where('matricula', '==', matricula)
                .where('ativo', '==', true)
                .limit(1)
                .get();

            if (snap.empty) {
                feedback.innerText = "Matrícula não localizada ou vigia inativo.";
                window.limparPin();
                return;
            }

            const doc = snap.docs[0];
            const vigiaData = doc.data();

            // Verifica bloqueio temporário
            if (vigiaData.bloqueadoAte) {
                const bloqueio = vigiaData.bloqueadoAte.toDate ? vigiaData.bloqueadoAte.toDate() : new Date(vigiaData.bloqueadoAte);
                if (bloqueio > new Date()) {
                    feedback.innerText = `Acesso temporariamente bloqueado até ${bloqueio.toLocaleTimeString('pt-BR')}. Procure o Gestor.`;
                    window.limparPin();
                    return;
                }
            }

            // Valida hash do PIN
            const hashInformado = await hashPin(pinDigitado, vigiaData.pinSalt || '');
            if (hashInformado !== vigiaData.pinHash) {
                const tentativas = (vigiaData.tentativasIncorretas || 0) + 1;
                const updateData = { tentativasIncorretas: tentativas };

                if (tentativas >= 5) {
                    const bloqueioAte = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
                    updateData.bloqueadoAte = bloqueioAte;
                    feedback.innerText = "PIN incorreto 5 vezes. Matrícula bloqueada por 15 minutos.";
                } else {
                    feedback.innerText = `PIN incorreto. Tentativa ${tentativas} de 5.`;
                }

                await window.db.collection('vigilancia_vigias').doc(doc.id).update(updateData);
                window.limparPin();
                return;
            }

            // Sucesso: zera tentativas incorretas
            await window.db.collection('vigilancia_vigias').doc(doc.id).update({
                tentativasIncorretas: 0,
                bloqueadoAte: null,
                ultimoLogin: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Estabelece Sessão Individual
            sessaoVigia = {
                id: doc.id,
                matricula: vigiaData.matricula,
                nome: vigiaData.nome
            };

            window.limparPin();
            feedback.innerText = '';

            // Registra auditoria de login
            await window.db.collection('vigilancia_auditoria').add({
                tipo: 'LOGIN_VIGIA',
                vigiaId: sessaoVigia.id,
                vigiaNome: sessaoVigia.nome,
                vigiaMatricula: sessaoVigia.matricula,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });

            // Exibe tela de seleção de rota
            abrirSelecaoRota();

        } catch (e) {
            console.error("Erro na autenticação:", e);
            feedback.innerText = `Erro de conexão: ${e.message}`;
        }
    };

    window.encerrarSessaoVigia = function () {
        if (rondaAtiva) {
            if (!confirm("Existe uma ronda em andamento! Deseja realmente finalizar e sair?")) return;
            window.confirmarFinalizacaoRonda();
            return;
        }

        sessaoVigia = null;
        window.limparPin();
        const inputMatricula = document.getElementById('input-matricula');
        if (inputMatricula) inputMatricula.value = '';

        document.getElementById('view-selecao-rota').style.display = 'none';
        document.getElementById('view-ronda-ativa').style.display = 'none';
        document.getElementById('view-login').style.display = 'flex';
    };

    // ==============================================
    // 2. SELEÇÃO DE ROTA
    // ==============================================

    async function abrirSelecaoRota() {
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-ronda-ativa').style.display = 'none';
        document.getElementById('view-selecao-rota').style.display = 'block';

        document.getElementById('nome-vigia-topo').innerText = sessaoVigia.nome;
        document.getElementById('matricula-vigia-topo').innerText = `Matrícula: ${sessaoVigia.matricula}`;

        const container = document.getElementById('lista-rotas-disponiveis');
        container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

        try {
            const snap = await window.db.collection('vigilancia_rotas')
                .where('ativo', '==', true)
                .get();

            if (snap.empty) {
                container.innerHTML = '<p class="text-muted small">Nenhuma rota pré-configurada no momento. Você pode iniciar uma Ronda Livre abaixo.</p>';
                return;
            }

            let html = '';
            snap.forEach(doc => {
                const rota = doc.data();
                const qtdPontos = rota.pontos ? rota.pontos.length : 0;

                html += `
                    <div class="card-rota-item" onclick="window.iniciarRondaPlanejada('${doc.id}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="fw-bold mb-1 text-white">${rota.nome}</h6>
                                <small class="text-muted"><i class="fas fa-location-dot me-1"></i> ${rota.setor || 'Fábrica'} | <i class="fas fa-map-pin me-1"></i> ${qtdPontos} checkpoints</small>
                            </div>
                            <span class="badge bg-primary rounded-pill px-3 py-2">Iniciar</span>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = `<div class="alert alert-danger small">${e.message}</div>`;
        }
    }

    // ==============================================
    // 3. INÍCIO DA RONDA E EXECUÇÃO OPERACIONAL
    // ==============================================

    window.iniciarRondaPlanejada = async function (rotaId) {
        try {
            const doc = await window.db.collection('vigilancia_rotas').doc(rotaId).get();
            if (!doc.exists) return;
            const rota = doc.data();

            await prepararEIniciarRonda(rotaId, rota.nome, rota.pontos || [], rota.versao || 1);
        } catch (e) {
            alert(`Erro ao iniciar rota: ${e.message}`);
        }
    };

    window.iniciarRondaLivre = async function () {
        await prepararEIniciarRonda(null, 'Ronda Livre / Perimetral', [], 1);
    };

    async function prepararEIniciarRonda(rotaId, rotaNome, pontosRota, versao) {
        // Solicita permissão de geolocalização se ainda não concedida
        if (!navigator.geolocation) {
            alert("Aparelho incompatível: Geolocation API não encontrada.");
            return;
        }

        // Tenta obter WakeLock para manter tela ligada durante a ronda
        try {
            if ('wakeLock' in navigator) {
                wakeLockInstance = await navigator.wakeLock.request('screen');
                console.log("🔋 WakeLock ativado: tela mantida acesa durante a ronda.");
            }
        } catch (err) {
            console.warn("WakeLock não disponível ou negado:", err);
        }

        // Prepara lista inicial de checkpoints
        const checkpointsStatus = pontosRota.map((p, idx) => ({
            pontoId: p.pontoId || `ponto_${idx}`,
            nome: p.nome,
            setor: p.setor || '',
            latitude: p.latitude,
            longitude: p.longitude,
            raioMetros: p.raioMetros || 25,
            tipoConfirmacao: p.tipoConfirmacao || 'GPS',
            qrCodeKey: p.qrCodeKey || null,
            ordem: idx + 1,
            status: 'PENDENTE',
            horario: null,
            distanciaMetros: null,
            metodo: null
        }));

        const payloadRonda = {
            vigiaId: sessaoVigia.id,
            vigiaMatricula: sessaoVigia.matricula,
            vigiaNome: sessaoVigia.nome,
            rotaId: rotaId || null,
            rotaNome: rotaNome,
            versaoRota: versao,
            status: 'EM_ANDAMENTO',
            inicio: firebase.firestore.FieldValue.serverTimestamp(),
            fim: null,
            duracaoMinutos: 0,
            distanciaMetros: 0,
            qtdOcorrencias: 0,
            checkpointsStatus: checkpointsStatus,
            trajetoRecente: [],
            ultimaPosicao: null,
            dispositivoId: navigator.userAgent
        };

        const rondaRef = await window.db.collection('vigilancia_rondas').add(payloadRonda);

        rondaAtiva = {
            id: rondaRef.id,
            rotaId,
            rotaNome,
            pontos: checkpointsStatus,
            inicio: new Date()
        };

        distanciaTotalAcumulada = 0;
        trajetoEmMemoria = [];
        ultimaPosicaoRegistrada = null;

        // Inicia captura contínua de GPS
        iniciarRastreamentoGps();

        // Inicia contador de tempo
        iniciarTimerRonda();

        // Alterna para tela da ronda ativa
        document.getElementById('view-selecao-rota').style.display = 'none';
        document.getElementById('view-ronda-ativa').style.display = 'flex';
        document.getElementById('ronda-nome-rota').innerText = rotaNome;

        renderizarCheckpointsRonda();
        initMapaVigia(pontosRota);
    }

    /**
     * Captura contínua de GPS em alta precisão
     */
    function iniciarRastreamentoGps() {
        if (!navigator.geolocation) return;

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        };

        watchGpsId = navigator.geolocation.watchPosition(
            (pos) => processarPosicaoGps(pos),
            (err) => {
                console.warn("GPS Warning:", err.message);
                const badge = document.getElementById('status-gps-badge');
                if (badge) badge.innerHTML = `<i class="fas fa-satellite-dish text-danger me-1"></i> Sinal Fraco (${err.message})`;
            },
            options
        );
    }

    /**
     * Processamento de cada ponto GPS recebido
     */
    async function processarPosicaoGps(pos) {
        if (!rondaAtiva) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const precisao = pos.coords.accuracy;
        const agora = new Date();

        // Atualiza indicadores de tela
        const elPrecisao = document.getElementById('gps-precisao');
        if (elPrecisao) elPrecisao.innerText = Math.round(precisao);

        // Se tiver ponto anterior, calcula distância percorrida
        if (ultimaPosicaoRegistrada) {
            const dist = calcularDistanciaHaversine(
                ultimaPosicaoRegistrada.lat,
                ultimaPosicaoRegistrada.lng,
                lat,
                lng
            );

            // Filtro de ruído: descarta variações insignificantes (< 2 metros) ou saltos anormais (> 200m em 5s)
            if (dist >= 2 && dist < 200) {
                distanciaTotalAcumulada += dist;
            }
        }

        ultimaPosicaoRegistrada = { lat, lng, precisao, timestamp: agora };
        trajetoEmMemoria.push({ lat, lng, timestamp: agora.toISOString(), precisao });

        // Mantém os últimos 30 pontos no documento principal para visualização rápida no painel ao vivo
        const trajetoRecente = trajetoEmMemoria.slice(-30);

        const elDist = document.getElementById('status-distancia-ronda');
        if (elDist) {
            elDist.innerText = distanciaTotalAcumulada > 1000
                ? `${(distanciaTotalAcumulada / 1000).toFixed(2)} km`
                : `${Math.round(distanciaTotalAcumulada)} metros`;
        }

        // Atualiza mapa móvel do vigia
        atualizarMapaVigia(lat, lng);

        // Atualização em lote no Firestore
        try {
            await window.db.collection('vigilancia_rondas').doc(rondaAtiva.id).update({
                distanciaMetros: distanciaTotalAcumulada,
                trajetoRecente: trajetoRecente,
                ultimaPosicao: {
                    lat,
                    lng,
                    precisao,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    statusConexao: 'ONLINE'
                }
            });

            // Grava ponto no histórico detalhado da ronda (subcoleção)
            await window.db.collection('vigilancia_rondas').doc(rondaAtiva.id)
                .collection('trajeto')
                .add({
                    lat,
                    lng,
                    precisao,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

        } catch (e) {
            console.warn("Buffer offline: gravando localmente devido a falha de rede:", e.message);
            // Salva no buffer local caso a fábrica tenha sombra de rede
            let buffer = JSON.parse(localStorage.getItem('vigilancia_offline_crumbs') || '[]');
            buffer.push({ rondaId: rondaAtiva.id, lat, lng, precisao, timestamp: Date.now() });
            localStorage.setItem('vigilancia_offline_crumbs', JSON.stringify(buffer));
        }

        // Validação automática por proximidade GPS dos pontos pendentes
        verificarProximidadeCheckpoints(lat, lng, precisao);
    }

    /**
     * Validação de Checkpoints por GPS (Haversine)
     */
    function verificarProximidadeCheckpoints(lat, lng, precisaoGps) {
        if (!rondaAtiva || !rondaAtiva.pontos) return;

        let houveMudanca = false;

        rondaAtiva.pontos.forEach(cp => {
            if (cp.status === 'PENDENTE' && cp.tipoConfirmacao === 'GPS' && cp.latitude && cp.longitude) {
                const dist = calcularDistanciaHaversine(lat, lng, Number(cp.latitude), Number(cp.longitude));
                const tolerancia = Number(cp.raioMetros) || 25;

                // Se o vigia entrou no raio de tolerância do ponto
                if (dist <= tolerancia) {
                    cp.status = 'CONFIRMADO';
                    cp.horario = new Date().toISOString();
                    cp.distanciaMetros = Math.round(dist);
                    cp.metodo = 'GPS_PROXIMIDADE';
                    houveMudanca = true;

                    // Feedback tátil no aparelho (vibração)
                    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                }
            }
        });

        if (houveMudanca) {
            renderizarCheckpointsRonda();
            // Sincroniza status dos checkpoints com o Firestore
            window.db.collection('vigilancia_rondas').doc(rondaAtiva.id).update({
                checkpointsStatus: rondaAtiva.pontos
            }).catch(err => console.error("Erro ao sincronizar checkpoints:", err));
        }
    }

    /**
     * Renderiza a lista de checkpoints na tela do vigia
     */
    function renderizarCheckpointsRonda() {
        const container = document.getElementById('lista-checkpoints-ronda');
        const badgeContador = document.getElementById('contador-checkpoints');
        if (!container || !rondaAtiva) return;

        const pontos = rondaAtiva.pontos || [];
        const confirmados = pontos.filter(p => p.status === 'CONFIRMADO').length;

        if (badgeContador) badgeContador.innerText = `${confirmados} / ${pontos.length}`;

        if (pontos.length === 0) {
            container.innerHTML = '<p class="text-muted small">Ronda Livre sem checkpoints obrigatórios cadastrados.</p>';
            return;
        }

        let html = '';
        pontos.forEach((cp, idx) => {
            const ok = cp.status === 'CONFIRMADO';
            const icon = ok ? '<i class="fas fa-check-circle text-success fs-4"></i>' : '<i class="fas fa-circle-dot text-warning fs-4"></i>';
            const metodoTag = cp.tipoConfirmacao === 'QRCODE' ? '<span class="badge bg-dark ms-2">Exige QR Code</span>' : '';

            html += `
                <div class="checkpoint-card ${ok ? 'confirmado' : 'pendente'}">
                    <div class="d-flex align-items-center gap-3">
                        ${icon}
                        <div>
                            <div class="fw-bold text-white">${cp.nome} ${metodoTag}</div>
                            <small class="text-muted">${cp.setor || 'Fábrica'} | Raio: ${cp.raioMetros || 25}m</small>
                        </div>
                    </div>
                    <div>
                        ${ok ? '<span class="badge bg-success">Validado</span>' : '<span class="badge bg-secondary">Pendente</span>'}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    /**
     * Inicializa o Mapa Móvel do Vigia
     */
    function initMapaVigia(pontosRota) {
        const container = document.getElementById('mapa-operacao-vigia');
        if (!container) return;

        if (mapaVigia) {
            mapaVigia.remove();
            mapaVigia = null;
        }

        mapaVigia = L.map('mapa-operacao-vigia', {
            zoomControl: false,
            attributionControl: false
        }).setView([-27.0543, -48.9832], 17);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaVigia);

        // Plota pontos da rota no mapa móvel
        checkpointsMarkers = [];
        if (pontosRota && pontosRota.length > 0) {
            pontosRota.forEach(p => {
                if (!p.latitude || !p.longitude) return;
                const m = L.circleMarker([Number(p.latitude), Number(p.longitude)], {
                    radius: 7,
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.8
                }).addTo(mapaVigia);
                checkpointsMarkers.push(m);
            });
        }
    }

    function atualizarMapaVigia(lat, lng) {
        if (!mapaVigia) return;

        if (!markerVigia) {
            markerVigia = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 1
            }).addTo(mapaVigia);
            mapaVigia.setView([lat, lng], 18);
        } else {
            markerVigia.setLatLng([lat, lng]);
            mapaVigia.panTo([lat, lng], { animate: true });
        }

        // Desenha traçado da caminhada
        const latlngs = trajetoEmMemoria.map(p => [p.lat, p.lng]);
        if (!polylineVigia) {
            polylineVigia = L.polyline(latlngs, { color: '#10b981', weight: 4 }).addTo(mapaVigia);
        } else {
            polylineVigia.setLatLngs(latlngs);
        }
    }

    /**
     * Timer da Ronda Ativa
     */
    function iniciarTimerRonda() {
        if (timerRondaInterval) clearInterval(timerRondaInterval);

        const badge = document.getElementById('badge-tempo-ronda');
        const start = Date.now();

        timerRondaInterval = setInterval(() => {
            const diff = Math.floor((Date.now() - start) / 1000);
            const m = Math.floor(diff / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            if (badge) badge.innerHTML = `<i class="fas fa-circle-play fa-beat me-1"></i> ${m}:${s}`;
        }, 1000);
    }

    // ==============================================
    // 4. SCANNER QR CODE DE CHECKPOINTS
    // ==============================================

    window.abrirScannerQRCode = function () {
        const modalEl = document.getElementById('modalScanner');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        setTimeout(() => {
            if (!html5QrCodeScanner) {
                html5QrCodeScanner = new Html5Qrcode("qr-reader-container");
            }

            html5QrCodeScanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
                    processarLeituraQRCode(decodedText);
                },
                (errorMessage) => {
                    // Leitura contínua em progresso
                }
            ).catch(err => {
                alert(`Erro ao iniciar câmera: ${err}`);
            });
        }, 400);
    };

    window.fecharScannerQRCode = function () {
        if (html5QrCodeScanner) {
            html5QrCodeScanner.stop().then(() => {
                html5QrCodeScanner.clear();
                html5QrCodeScanner = null;
            }).catch(() => { });
        }
    };

    function processarLeituraQRCode(codigo) {
        window.fecharScannerQRCode();
        const modalEl = document.getElementById('modalScanner');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        if (!rondaAtiva || !rondaAtiva.pontos) {
            alert(`QR Code lido: ${codigo}`);
            return;
        }

        // Busca o checkpoint que corresponde a essa chave
        const ponto = rondaAtiva.pontos.find(p => p.qrCodeKey && p.qrCodeKey.toUpperCase() === codigo.trim().toUpperCase());

        if (ponto) {
            ponto.status = 'CONFIRMADO';
            ponto.horario = new Date().toISOString();
            ponto.metodo = 'QR_CODE_FISICO';

            if ('vibrate' in navigator) navigator.vibrate([150, 50, 150]);

            renderizarCheckpointsRonda();

            window.db.collection('vigilancia_rondas').doc(rondaAtiva.id).update({
                checkpointsStatus: rondaAtiva.pontos
            });

            alert(`✅ Ponto Confirmado com Sucesso: ${ponto.nome}!`);
        } else {
            alert(`⚠️ QR Code não reconhecido para os pontos desta rota: ${codigo}`);
        }
    }

    // ==============================================
    // 5. REGISTRO DE OCORRÊNCIA NA RONDA
    // ==============================================

    window.abrirModalOcorrencia = function () {
        document.getElementById('ocorrencia-descricao').value = '';
        document.getElementById('ocorrencia-foto').value = '';
        const modalEl = document.getElementById('modalOcorrencia');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    window.salvarOcorrenciaRonda = async function () {
        if (!rondaAtiva) return;

        const categoria = document.getElementById('ocorrencia-categoria').value;
        const descricao = document.getElementById('ocorrencia-descricao').value.trim();
        const fotoInput = document.getElementById('ocorrencia-foto');

        if (!descricao) {
            alert("Descreva o que foi observado na ocorrência.");
            return;
        }

        let fotoBase64 = null;
        if (fotoInput && fotoInput.files && fotoInput.files[0]) {
            fotoBase64 = await converterArquivoBase64(fotoInput.files[0]);
        }

        const payload = {
            rondaId: rondaAtiva.id,
            rotaNome: rondaAtiva.rotaNome,
            vigiaId: sessaoVigia.id,
            vigiaNome: sessaoVigia.nome,
            vigiaMatricula: sessaoVigia.matricula,
            categoria,
            descricao,
            fotoUrl: fotoBase64,
            latitude: ultimaPosicaoRegistrada ? ultimaPosicaoRegistrada.lat : null,
            longitude: ultimaPosicaoRegistrada ? ultimaPosicaoRegistrada.lng : null,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Salva na coleção global de ocorrências
            await window.db.collection('vigilancia_ocorrencias').add(payload);

            // Incrementa contador na ronda
            await window.db.collection('vigilancia_rondas').doc(rondaAtiva.id).update({
                qtdOcorrencias: firebase.firestore.FieldValue.increment(1)
            });

            const modalEl = document.getElementById('modalOcorrencia');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            alert("Ocorrência registrada com sucesso!");
        } catch (e) {
            alert(`Erro ao registrar ocorrência: ${e.message}`);
        }
    };

    function converterArquivoBase64(arquivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(arquivo);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // ==============================================
    // 6. CONCLUSÃO DA RONDA
    // ==============================================

    window.confirmarFinalizacaoRonda = async function () {
        if (!rondaAtiva) return;

        const pendentes = (rondaAtiva.pontos || []).filter(p => p.status === 'PENDENTE');
        let msg = "Deseja realmente finalizar a ronda?";
        if (pendentes.length > 0) {
            msg = `Atenção: Existem ${pendentes.length} pontos de controle NÃO confirmados nesta rota!\nDeseja encerrar mesmo assim?`;
        }

        if (!confirm(msg)) return;

        // Para os rastreadores e WakeLock
        if (watchGpsId !== null) {
            navigator.geolocation.clearWatch(watchGpsId);
            watchGpsId = null;
        }
        if (timerRondaInterval) {
            clearInterval(timerRondaInterval);
            timerRondaInterval = null;
        }
        if (wakeLockInstance) {
            wakeLockInstance.release().then(() => { wakeLockInstance = null; });
        }

        const duracaoMin = Math.round((new Date() - rondaAtiva.inicio) / (1000 * 60));

        try {
            await window.db.collection('vigilancia_rondas').doc(rondaAtiva.id).update({
                status: 'CONCLUIDA',
                fim: firebase.firestore.FieldValue.serverTimestamp(),
                duracaoMinutos: duracaoMin,
                distanciaMetros: Math.round(distanciaTotalAcumulada)
            });

            alert(`Ronda finalizada com sucesso!\nDuração: ${duracaoMin} min | Distância: ${Math.round(distanciaTotalAcumulada)} metros`);

            rondaAtiva = null;
            window.encerrarSessaoVigia();

        } catch (e) {
            alert(`Erro ao finalizar ronda: ${e.message}`);
        }
    };

})();
