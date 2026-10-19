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
    // 1. CARREGAMENTO E SELEÇÃO DE VIGIA NO MOBILE
    // ==============================================

    // Garante sessão autenticada do Firebase (anônima ou usuário existente)
    async function garantirAutenticacao() {
        if (!window.auth && typeof firebase !== 'undefined') {
            window.auth = firebase.auth();
        }
        if (!window.auth) return null;

        return new Promise((resolve) => {
            const unsub = window.auth.onAuthStateChanged(user => {
                unsub();
                if (user) {
                    resolve(user);
                } else {
                    window.auth.signInAnonymously()
                        .then(cred => resolve(cred.user))
                        .catch(err => {
                            console.warn("Aviso Auth (signInAnonymously):", err.message);
                            resolve(null);
                        });
                }
            });
        });
    }

    let modoMatriculaManual = false;

    window.carregarListaVigiasMobile = async function () {
        const select = document.getElementById('select-vigia-mobile');
        if (!select || !window.db) return;

        try {
            await garantirAutenticacao();

            const snap = await window.db.collection('vigilancia_vigias')
                .where('ativo', '==', true)
                .get();

            if (snap.empty) {
                select.innerHTML = '<option value="">Nenhum vigia ativo cadastrado</option>';
                return;
            }

            const ultMat = localStorage.getItem('ultimo_vigia_matricula') || '';

            let html = '<option value="">-- Toque para selecionar seu nome --</option>';
            let selecionadoDefinido = false;

            snap.forEach(doc => {
                const v = doc.data();
                const sel = (v.matricula === ultMat) ? 'selected' : '';
                if (sel) selecionadoDefinido = true;
                html += `<option value="${v.matricula}" ${sel}>${v.nome} (Matrícula: ${v.matricula})</option>`;
            });
            select.innerHTML = html;

            const inputMat = document.getElementById('input-matricula');

            // Se o último vigia estava salvo e foi encontrado
            if (ultMat && selecionadoDefinido) {
                select.value = ultMat;
                if (inputMat) inputMat.value = ultMat;
            } else if (snap.size === 1) {
                // Se existe apenas 1 vigia cadastrado no sistema, auto-seleciona para agilizar
                const unico = snap.docs[0].data();
                select.value = unico.matricula;
                if (inputMat) inputMat.value = unico.matricula;
                localStorage.setItem('ultimo_vigia_matricula', unico.matricula);
            }
        } catch (e) {
            console.warn("Erro ao carregar lista de vigias no mobile:", e);
        }
    };

    window.aoSelecionarVigiaMobile = function () {
        const select = document.getElementById('select-vigia-mobile');
        const inputMat = document.getElementById('input-matricula');
        const feedback = document.getElementById('login-feedback');
        if (select && inputMat) {
            inputMat.value = select.value;
            if (select.value) {
                localStorage.setItem('ultimo_vigia_matricula', select.value);
                if (feedback) feedback.innerText = '';
                select.classList.remove('border-danger');
            }
        }
    };

    window.alternarModoMatricula = function () {
        modoMatriculaManual = !modoMatriculaManual;
        const wSelect = document.getElementById('wrapper-select-vigia');
        const wInput = document.getElementById('wrapper-input-matricula');
        const link = document.getElementById('link-alternar-modo');

        if (modoMatriculaManual) {
            if (wSelect) wSelect.style.display = 'none';
            if (wInput) {
                wInput.style.display = 'block';
                const input = document.getElementById('input-matricula');
                if (input) input.focus();
            }
            if (link) link.innerHTML = '<i class="fas fa-list me-1"></i> Selecionar na lista';
        } else {
            if (wSelect) wSelect.style.display = 'block';
            if (wInput) wInput.style.display = 'none';
            if (link) link.innerHTML = '<i class="fas fa-keyboard me-1"></i> Digitar matrícula';
        }
    };

    // ==============================================
    // 2. TECLADO VIRTUAL E AUTENTICAÇÃO DO VIGIA
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
        const selectVigia = document.getElementById('select-vigia-mobile');
        const inputMatricula = document.getElementById('input-matricula');
        const feedback = document.getElementById('login-feedback');

        let matricula = '';
        if (!modoMatriculaManual && selectVigia && selectVigia.value) {
            matricula = selectVigia.value.trim();
        } else if (inputMatricula && inputMatricula.value) {
            matricula = inputMatricula.value.trim();
        } else if (selectVigia && selectVigia.value) {
            matricula = selectVigia.value.trim();
        }

        // Se ainda não tem matrícula mas o select tem pelo menos uma opção válida
        if (!matricula && selectVigia && selectVigia.options.length > 1) {
            for (let i = 1; i < selectVigia.options.length; i++) {
                if (selectVigia.options[i].value) {
                    selectVigia.selectedIndex = i;
                    matricula = selectVigia.value;
                    break;
                }
            }
        }

        if (!matricula) {
            feedback.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Por favor, <b>selecione seu nome</b> na lista acima.';
            if (selectVigia && !modoMatriculaManual) {
                selectVigia.classList.add('border-danger');
                selectVigia.focus();
            }
            return;
        }

        if (pinDigitado.length < 4) {
            feedback.innerHTML = '<i class="fas fa-key me-1"></i> Digite seu PIN no teclado abaixo (mínimo 4 dígitos).';
            return;
        }

        localStorage.setItem('ultimo_vigia_matricula', matricula);
        feedback.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Validando credenciais...';

        try {
            await garantirAutenticacao();

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

            // Exibe o Painel Principal do Aplicativo Mobile
            await abrirDashboardVigia();

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

        const viewDash = document.getElementById('view-dashboard-vigia');
        const viewSelecao = document.getElementById('view-selecao-rota');
        const viewRonda = document.getElementById('view-ronda-ativa');
        const viewLogin = document.getElementById('view-login');

        if (viewDash) viewDash.style.display = 'none';
        if (viewSelecao) viewSelecao.style.display = 'none';
        if (viewRonda) viewRonda.style.display = 'none';
        if (viewLogin) viewLogin.style.display = 'flex';
    };

    // ==============================================
    // 3. PAINEL PRINCIPAL DO APP & SELEÇÃO DE ROTAS
    // ==============================================

    window.abrirDashboardVigia = async function () {
        const viewLogin = document.getElementById('view-login');
        const viewRonda = document.getElementById('view-ronda-ativa');
        const viewDash = document.getElementById('view-dashboard-vigia');
        const viewSelecao = document.getElementById('view-selecao-rota');

        if (viewLogin) viewLogin.style.display = 'none';
        if (viewRonda) viewRonda.style.display = 'none';
        if (viewSelecao) viewSelecao.style.display = 'none';
        if (viewDash) viewDash.style.display = 'block';

        if (sessaoVigia) {
            const elNome = document.getElementById('nome-vigia-topo');
            const elMat = document.getElementById('matricula-vigia-topo');
            if (elNome) elNome.innerText = sessaoVigia.nome;
            if (elMat) elMat.innerText = `Matrícula: ${sessaoVigia.matricula}`;
        }

        // Carrega rotas ativas no seletor da Hero Card
        await carregarRotasHeroSelect();

        // Carrega métricas e estatísticas rápidas
        await carregarStatsDashboard();
    };

    // Compatibilidade com chamadas legadas
    window.abrirSelecaoRota = window.abrirDashboardVigia;

    async function carregarRotasHeroSelect() {
        const select = document.getElementById('select-rota-inicio');
        const containerLista = document.getElementById('lista-rotas-disponiveis');
        if (!window.db) return;

        let optionsHtml = '<option value="LIVRE">⚡ Ronda Livre (Patrulhamento Geral)</option>';
        let cardsHtml = '';

        try {
            const snap = await window.db.collection('vigilancia_rotas')
                .where('ativo', '==', true)
                .get();

            if (!snap.empty) {
                snap.forEach(doc => {
                    const r = doc.data();
                    const qtdPontos = r.pontos ? r.pontos.length : 0;
                    optionsHtml += `<option value="${doc.id}">📍 ${r.nome} (${qtdPontos} checkpoints - ${r.setor || 'Fábrica'})</option>`;
                    cardsHtml += `
                        <div class="card-rota-item mb-2 p-3 bg-dark border border-secondary rounded-4 text-white" onclick="window.iniciarRondaPlanejada('${doc.id}')" style="cursor: pointer;">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="fw-bold mb-1">${r.nome}</h6>
                                    <small class="text-muted"><i class="fas fa-location-dot me-1"></i> ${r.setor || 'Fábrica'} | <i class="fas fa-map-pin me-1"></i> ${qtdPontos} checkpoints</small>
                                </div>
                                <span class="badge bg-primary rounded-pill px-3 py-2"><i class="fas fa-play me-1"></i> Iniciar</span>
                            </div>
                        </div>
                    `;
                });
            }

            if (select) select.innerHTML = optionsHtml;
            if (containerLista) {
                containerLista.innerHTML = cardsHtml || '<p class="text-muted small">Nenhuma rota pré-configurada. Você pode iniciar a Ronda Livre acima.</p>';
            }
        } catch (e) {
            console.warn("Erro ao buscar rotas ativas:", e);
        }
    }

    async function carregarStatsDashboard() {
        if (!sessaoVigia || !window.db) return;
        const elRondas = document.getElementById('stat-rondas-feitas');
        const elPontos = document.getElementById('stat-pontos-totais');

        try {
            const inicioHoje = new Date();
            inicioHoje.setHours(0, 0, 0, 0);

            // Consulta rondas do vigia sem exigir índice composto
            const snapRondas = await window.db.collection('vigilancia_rondas')
                .where('vigiaId', '==', sessaoVigia.id)
                .where('status', '==', 'CONCLUIDA')
                .get();

            let rondasHoje = 0;
            snapRondas.forEach(doc => {
                const r = doc.data();
                if (r.fim) {
                    const dt = r.fim.toDate ? r.fim.toDate() : new Date(r.fim);
                    if (dt >= inicioHoje) rondasHoje++;
                }
            });

            if (elRondas) elRondas.innerText = rondasHoje;

            // Total de checkpoints ativos cadastrados na empresa
            const snapPontos = await window.db.collection('vigilancia_pontos')
                .where('ativo', '==', true)
                .get();

            if (elPontos) elPontos.innerText = snapPontos.size;

        } catch (e) {
            console.warn("Erro ao carregar estatísticas do dashboard vigia:", e);
        }
    }

    // ==============================================
    // 4. INÍCIO DA RONDA E EXECUÇÃO OPERACIONAL
    // ==============================================

    window.confirmarEIniciarRonda = async function () {
        const select = document.getElementById('select-rota-inicio');
        const rotaId = select ? select.value : 'LIVRE';

        if (!rotaId || rotaId === 'LIVRE') {
            await window.iniciarRondaLivre();
        } else {
            await window.iniciarRondaPlanejada(rotaId);
        }
    };

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
        await prepararEIniciarRonda(null, 'Ronda Livre / Patrulhamento Geral', [], 1);
    };

    async function prepararEIniciarRonda(rotaId, rotaNome, pontosRota, versao) {
        // Solicita permissão de geolocalização se ainda não concedida
        if (!navigator.geolocation) {
            alert("Aparelho incompatível: Geolocation API não encontrada neste dispositivo.");
            return;
        }

        // 1. Alerta se não estiver em contexto seguro (HTTPS) - o Chrome/Safari móvel bloqueia o GPS no HTTP
        if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            alert("⚠️ Atenção: Conexão Não Segura (HTTP) Detectada!\n\nOs navegadores de celular (Google Chrome e Safari) bloqueiam o GPS obrigatoriamente por segurança quando o site não é acessado por HTTPS.\n\nPara que o trajeto da ronda funcione, acesse o sistema através de um endereço HTTPS seguro.");
        }

        // 2. Verifica se a permissão foi bloqueada no navegador ou nas configurações do celular
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const pStatus = await navigator.permissions.query({ name: 'geolocation' });
                if (pStatus.state === 'denied') {
                    alert("⚠️ Atenção: O GPS consta como bloqueado neste aparelho!\n\nMesmo que você já tenha permitido no navegador, verifique:\n1. Se o botão 'Local / Localização' está ligado na barra de notificações do celular;\n2. Se o app do Chrome tem permissão de Localização concedida nas Configurações do Android (Configurações > Apps > Chrome > Permissões);\n3. Se o site está permitido no ícone de ajustes/cadeado ao lado da URL.");
                }
            } catch (pErr) {}
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
        const viewDash = document.getElementById('view-dashboard-vigia');
        const viewSelecao = document.getElementById('view-selecao-rota');
        const viewLogin = document.getElementById('view-login');
        if (viewDash) viewDash.style.display = 'none';
        if (viewSelecao) viewSelecao.style.display = 'none';
        if (viewLogin) viewLogin.style.display = 'none';

        const viewRonda = document.getElementById('view-ronda-ativa');
        if (viewRonda) viewRonda.style.display = 'flex';
        const elNomeRota = document.getElementById('ronda-nome-rota');
        if (elNomeRota) elNomeRota.innerText = rotaNome;

        renderizarCheckpointsRonda();
        initMapaVigia(pontosRota);
    }

    /**
     * Captura contínua de GPS em alta precisão com fallback inteligente
     */
    function iniciarRastreamentoGps(usarAltaPrecisao = true) {
        if (!navigator.geolocation) return;

        const options = {
            enableHighAccuracy: usarAltaPrecisao,
            timeout: usarAltaPrecisao ? 20000 : 15000,
            maximumAge: 5000
        };

        if (watchGpsId !== null) {
            try {
                navigator.geolocation.clearWatch(watchGpsId);
            } catch (wErr) {}
            watchGpsId = null;
        }

        watchGpsId = navigator.geolocation.watchPosition(
            (pos) => processarPosicaoGps(pos),
            (err) => {
                console.warn(`GPS Warning (altaPrecisao=${usarAltaPrecisao}):`, err.code, err.message);
                const badge = document.getElementById('status-gps-badge');
                if (badge) {
                    if (err.code === 1) { // PERMISSION_DENIED
                        badge.className = "small fw-semibold text-warning";
                        badge.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i> GPS Bloqueado`;
                        badge.title = "Permissão negada ou GPS do celular desativado. Toque para diagnosticar.";
                    } else if (err.code === 2) { // POSITION_UNAVAILABLE
                        if (usarAltaPrecisao) {
                            console.log("Fallback: Tentando GPS sem alta precisão...");
                            iniciarRastreamentoGps(false);
                            return;
                        }
                        badge.className = "small fw-semibold text-danger";
                        badge.innerHTML = `<i class="fas fa-satellite-dish me-1"></i> Sem Sinal GPS`;
                    } else if (err.code === 3) { // TIMEOUT
                        if (usarAltaPrecisao) {
                            console.log("Timeout GPS: Tentando fallback para precisão de rede...");
                            iniciarRastreamentoGps(false);
                            return;
                        }
                        badge.className = "small fw-semibold text-warning";
                        badge.innerHTML = `<i class="fas fa-satellite-dish me-1"></i> Buscando Satélites...`;
                    } else {
                        badge.className = "small fw-semibold text-danger";
                        badge.innerHTML = `<i class="fas fa-satellite-dish me-1"></i> Sinal Fraco (${err.message})`;
                    }
                }
            },
            options
        );
    }

    /**
     * Diagnóstico e Reconexão manual de GPS (ao tocar no badge de status)
     */
    window.diagnosticarOuReconectarGps = function () {
        if (!navigator.geolocation) {
            alert("Geolocalização não é suportada neste aparelho.");
            return;
        }

        const badge = document.getElementById('status-gps-badge');
        if (badge) {
            badge.className = "small fw-semibold text-info";
            badge.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Testando GPS...`;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                processarPosicaoGps(pos);
                iniciarRastreamentoGps(true);
                alert(`✅ GPS Conectado com sucesso!\n\nPrecisão: ±${Math.round(pos.coords.accuracy)} metros.\nSinal operacional e trajeto ativo.`);
            },
            (err) => {
                console.warn("Diagnóstico GPS Erro:", err.code, err.message);
                if (badge) {
                    if (err.code === 1) {
                        badge.className = "small fw-semibold text-warning";
                        badge.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i> GPS Bloqueado`;
                    } else {
                        badge.className = "small fw-semibold text-danger";
                        badge.innerHTML = `<i class="fas fa-satellite-dish me-1"></i> Sem Sinal GPS`;
                    }
                }

                let explicacao = "";
                if (err.code === 1) {
                    explicacao = "O GPS está bloqueado pelo celular ou pelo navegador.\n\n" +
                        "PASSO A PASSO PARA LIBERAR:\n" +
                        "1. Puxe a barra de notificações de cima para baixo e LIGUE o botão 'Local / Localização';\n" +
                        "2. Abra as Configurações do Android > Aplicativos > Chrome > Permissões > Localização > Marque 'Permitir durante o uso do app' e 'Localização precisa';\n" +
                        "3. Toque no ícone de ajustes/cadeado na barra de endereços do Chrome e mude 'Localização' para Permitir.";
                    if (!window.isSecureContext) {
                        explicacao += "\n\n⚠️ Conexão Não Segura (HTTP): O Chrome do celular exige HTTPS para liberar o GPS.";
                    }
                } else if (err.code === 2) {
                    explicacao = "O aparelho não conseguiu obter a posição dos satélites (Ambiente fechado ou guarita sem visada do céu). Vá até uma área externa e tente novamente.";
                } else if (err.code === 3) {
                    explicacao = "Tempo esgotado ao buscar satélites. O sinal pode estar fraco. O sistema continuará tentando em segundo plano.";
                }

                alert(`⚠️ Diagnóstico de GPS (Erro ${err.code}):\n\n${explicacao}`);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    /**
     * Processamento de cada ponto GPS recebido
     */
    async function processarPosicaoGps(pos) {
        if (!rondaAtiva) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const precisao = pos.coords.accuracy;
        const agora = new Date();

        // Atualiza indicadores de tela e SEMPRE restaura o badge caso estivesse com erro
        const badge = document.getElementById('status-gps-badge');
        if (badge) {
            badge.className = "small fw-semibold text-white";
            badge.innerHTML = `<i class="fas fa-satellite text-success me-1"></i> ±<span id="gps-precisao">${Math.round(precisao)}</span>m`;
            badge.title = "GPS Operacional. Toque para testar conexão.";
        }

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

            // Atualiza status visual dos marcadores no mapa móvel
            if (checkpointsMarkers && checkpointsMarkers.length > 0) {
                checkpointsMarkers.forEach(item => {
                    const cpMatch = rondaAtiva.pontos.find(p => p.pontoId === item.pontoId);
                    if (cpMatch && cpMatch.status === 'CONFIRMADO') {
                        item.marker.setStyle({ color: '#10b981', fillColor: '#10b981' });
                    }
                });
            }

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

    let configEmpresaMobile = {
        centroLat: -25.194009,
        centroLng: -50.598688,
        zoomInicial: 17,
        provedorPadrao: 'GOOGLE_HYBRID'
    };
    let areasEmpresaMobile = [];

    async function carregarConfigEAreasMobile() {
        if (!window.db) return;
        try {
            const docConf = await window.db.collection('vigilancia_configuracoes').doc('config_empresa').get();
            if (docConf.exists) {
                configEmpresaMobile = { ...configEmpresaMobile, ...docConf.data() };
            }
            const snapAreas = await window.db.collection('vigilancia_areas').where('ativo', '==', true).get();
            areasEmpresaMobile = [];
            snapAreas.forEach(d => areasEmpresaMobile.push({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn("Aviso ao carregar config/áreas no mobile:", e);
        }
    }

    /**
     * Inicializa o Mapa Móvel do Vigia com Google Satélite HD e Áreas Fabris
     */
    async function initMapaVigia(pontosRota) {
        const container = document.getElementById('mapa-operacao-vigia');
        if (!container) return;

        if (mapaVigia) {
            mapaVigia.remove();
            mapaVigia = null;
        }

        await carregarConfigEAreasMobile();

        const centerLat = Number(configEmpresaMobile.centroLat) || -25.194009;
        const centerLng = Number(configEmpresaMobile.centroLng) || -50.598688;
        const zoom = Number(configEmpresaMobile.zoomInicial) || 17;

        mapaVigia = L.map('mapa-operacao-vigia', {
            zoomControl: false,
            attributionControl: false,
            maxZoom: 21
        }).setView([centerLat, centerLng], zoom);

        // Satélite Google Híbrido HD (Ultra Definição com Vias e Galpões)
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 21,
            subdomains: ['0', '1', '2', '3']
        }).addTo(mapaVigia);

        // Desenha polígonos das áreas da empresa
        if (areasEmpresaMobile && areasEmpresaMobile.length > 0) {
            areasEmpresaMobile.forEach(a => {
                if (!a.coordenadas || a.coordenadas.length < 3) return;
                const latlngs = a.coordenadas.map(c => [Number(c.lat), Number(c.lng)]);
                const cor = a.cor || '#3b82f6';
                L.polygon(latlngs, {
                    color: cor,
                    weight: 1.5,
                    dashArray: '3, 3',
                    fillColor: cor,
                    fillOpacity: 0.2
                }).bindTooltip(a.nome, { sticky: true }).addTo(mapaVigia);
            });
        }

        // Plota pontos da rota no mapa móvel
        checkpointsMarkers = [];
        if (pontosRota && pontosRota.length > 0) {
            pontosRota.forEach(p => {
                if (!p.latitude || !p.longitude) return;
                const lat = Number(p.latitude);
                const lng = Number(p.longitude);
                const ok = p.status === 'CONFIRMADO';
                const m = L.circleMarker([lat, lng], {
                    radius: 7,
                    color: ok ? '#10b981' : '#f59e0b',
                    fillColor: ok ? '#10b981' : '#f59e0b',
                    fillOpacity: 0.9,
                    weight: 2
                }).addTo(mapaVigia);
                m.bindTooltip(p.nome, { sticky: true });
                checkpointsMarkers.push({ pontoId: p.pontoId, marker: m });
            });
        }

        setTimeout(() => {
            if (mapaVigia) mapaVigia.invalidateSize();
        }, 350);
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

            alert(`✅ Ronda finalizada com sucesso!\nDuração: ${duracaoMin} min | Distância: ${Math.round(distanciaTotalAcumulada)} metros`);

            rondaAtiva = null;
            const viewRonda = document.getElementById('view-ronda-ativa');
            if (viewRonda) viewRonda.style.display = 'none';

            // Retorna ao painel principal do aplicativo
            await window.abrirDashboardVigia();

        } catch (e) {
            alert(`Erro ao finalizar ronda: ${e.message}`);
        }
    };

    // Inicialização ao carregar a página mobile
    document.addEventListener('DOMContentLoaded', () => {
        window.carregarListaVigiasMobile();
    });

    document.addEventListener('firebaseMobileReady', () => {
        window.carregarListaVigiasMobile();
    });

    // Se Firebase já estiver pronto
    if (window.db) {
        window.carregarListaVigiasMobile();
    } else {
        setTimeout(() => {
            if (window.carregarListaVigiasMobile) window.carregarListaVigiasMobile();
        }, 800);
    }

})();
