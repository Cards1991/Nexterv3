/**
 * NEXTER - Central de Vigilância & Gestão de Rondas
 * js/vigilancia-gestao.js
 */

(function () {
    'use strict';

    // Estados e instâncias de controle
    let mapaAoVivo = null;
    let mapaSeletorPonto = null;
    let mapaDetalhe = null;
    let markerSeletorPonto = null;
    let circuloSeletorRaio = null;

    let markersAoVivo = new Map(); // rondaId -> L.Marker
    let polylinesAoVivo = new Map(); // rondaId -> L.Polyline
    let markersPontosFixos = []; // Array de markers de pontos no mapa ao vivo
    let rotaPlanejadaPolyline = null; // Polyline azul da rota ativa selecionada

    let unsubscribeRondasAtivas = null;
    let cachePontos = [];
    let cacheRotas = [];
    let cacheVigias = [];
    let cacheRondasAtivas = [];

    // Helper: Gerador de hash SHA-256 com salt
    async function hashPin(pin, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function gerarSalt(tamanho = 16) {
        const array = new Uint8Array(tamanho);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Codificação de exibição restrita ao painel do Gestor
    function obfuscatePin(pin, salt) {
        if (!pin) return '';
        const key = (salt || 'nexter_salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 42);
        const chars = pin.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ (key % 17 + 1)));
        return btoa(chars.join(''));
    }

    function deobfuscatePin(encoded, salt) {
        if (!encoded) return '';
        try {
            const key = (salt || 'nexter_salt').split('').reduce((acc, c) => acc + c.charCodeAt(0), 42);
            const str = atob(encoded);
            return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ (key % 17 + 1))).join('');
        } catch (e) {
            return '';
        }
    }

    /**
     * Inicialização Principal do Painel
     */
    window.inicializarVigilanciaGestao = async function () {
        console.log("🛡️ Inicializando Central de Vigilância...");

        // Configura datas padrão no filtro de histórico (Dia Vigente)
        const hojeStr = new Date().toISOString().split('T')[0];
        const elInicio = document.getElementById('hist-data-inicio');
        const elFim = document.getElementById('hist-data-fim');
        if (elInicio && !elInicio.value) elInicio.value = hojeStr;
        if (elFim && !elFim.value) elFim.value = hojeStr;

        // Inicializa o Mapa Ao Vivo Leaflet
        initMapaAoVivo();

        // Carrega dados iniciais do Firestore
        await Promise.all([
            carregarPontosControle(),
            carregarRotas(),
            carregarVigias(),
            carregarOcorrencias()
        ]);

        // Inicia listener em tempo real das rondas ativas
        iniciarListenerRondasAtivas();

        // Listener para redimensionar o mapa quando a aba for ativada
        const tabEl = document.getElementById('tab-aovivo-btn');
        if (tabEl) {
            tabEl.addEventListener('shown.bs.tab', () => {
                if (mapaAoVivo) mapaAoVivo.invalidateSize();
            });
        }
    };

    /**
     * Inicializa o Mapa Leaflet de Monitoramento Ao Vivo
     */
    function initMapaAoVivo() {
        const container = document.getElementById('mapa-vigilancia-aovivo');
        if (!container) return;

        if (mapaAoVivo) {
            mapaAoVivo.remove();
            mapaAoVivo = null;
        }

        // Padrão inicial: centro da fábrica ou centro aproximado da região (-27.1, -49.0)
        const latInicial = -27.0543;
        const lngInicial = -48.9832;

        mapaAoVivo = L.map('mapa-vigilancia-aovivo', {
            zoomControl: true,
            attributionControl: false
        }).setView([latInicial, lngInicial], 17);

        // Camada Base: OpenStreetMap CartoDB Positron / OpenStreetMap Padrão
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(mapaAoVivo);

        // Camada Satélite Esri
        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        });

        // Controle de Camadas
        L.control.layers({
            "Mapa Padrão": osm,
            "Satélite": satellite
        }, null, { position: 'topright' }).addTo(mapaAoVivo);

        setTimeout(() => {
            if (mapaAoVivo) mapaAoVivo.invalidateSize();
        }, 300);
    }

    /**
     * Escuta Rondas Ativas via Firestore onSnapshot
     */
    function iniciarListenerRondasAtivas() {
        if (!window.db) return;

        if (unsubscribeRondasAtivas) {
            unsubscribeRondasAtivas();
            unsubscribeRondasAtivas = null;
        }

        const listaContainer = document.getElementById('lista-rondas-aovivo');
        const badgeContador = document.getElementById('badge-contador-aovivo');
        const kpiAtivas = document.getElementById('kpi-rondas-ativas');

        unsubscribeRondasAtivas = window.db.collection('vigilancia_rondas')
            .where('status', '==', 'EM_ANDAMENTO')
            .onSnapshot((snapshot) => {
                cacheRondasAtivas = [];
                snapshot.forEach(doc => {
                    cacheRondasAtivas.push({ id: doc.id, ...doc.data() });
                });

                const totalAtivas = cacheRondasAtivas.length;
                if (badgeContador) badgeContador.innerText = totalAtivas;
                if (kpiAtivas) kpiAtivas.innerText = totalAtivas;

                renderizarListaRondasAoVivo(cacheRondasAtivas);
                atualizarMapaRondasAoVivo(cacheRondasAtivas);
                atualizarKpiHoje();
            }, (error) => {
                console.error("Erro no listener de rondas ativas:", error);
                if (listaContainer) {
                    listaContainer.innerHTML = `<div class="alert alert-danger py-2 small">Erro de sincronização: ${error.message}</div>`;
                }
            });
    }

    /**
     * Renderiza a lista de rondas em andamento na barra lateral
     */
    function renderizarListaRondasAoVivo(rondas) {
        const container = document.getElementById('lista-rondas-aovivo');
        if (!container) return;

        if (rondas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-satellite fa-3x mb-3 text-secondary opacity-50"></i>
                    <p class="mb-0">Nenhuma ronda em andamento no momento.</p>
                    <small class="text-muted">As rondas iniciadas pelos vigias aparecerão automaticamente aqui.</small>
                </div>
            `;
            return;
        }

        let html = '';
        const agora = new Date();

        rondas.forEach(ronda => {
            let inicioStr = '--:--';
            let duracaoMin = 0;
            if (ronda.inicio) {
                const dtInicio = ronda.inicio.toDate ? ronda.inicio.toDate() : new Date(ronda.inicio);
                inicioStr = dtInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                duracaoMin = Math.round((agora - dtInicio) / (1000 * 60));
            }

            // Status de atualização da última posição
            let badgeConexao = '<span class="badge-status-aovivo"><i class="fas fa-circle fa-beat me-1"></i> Ao Vivo</span>';
            if (ronda.ultimaPosicao && ronda.ultimaPosicao.timestamp) {
                const dtPos = ronda.ultimaPosicao.timestamp.toDate ? ronda.ultimaPosicao.timestamp.toDate() : new Date(ronda.ultimaPosicao.timestamp);
                const segundosSemPos = (agora - dtPos) / 1000;
                if (segundosSemPos > 60) {
                    badgeConexao = '<span class="badge-status-desatualizado"><i class="fas fa-clock me-1"></i> Posição antiga</span>';
                }
            } else {
                badgeConexao = '<span class="badge-status-semgps"><i class="fas fa-satellite-dish me-1"></i> Sem GPS</span>';
            }

            const rotaNome = ronda.rotaNome || 'Ronda Livre';
            const vigiaNome = ronda.vigiaNome || `Matrícula ${ronda.vigiaMatricula || 'N/D'}`;
            const distancia = ronda.distanciaMetros ? `${Math.round(ronda.distanciaMetros)}m` : '0m';

            html += `
                <div class="ronda-ativa-card" onclick="window.focarRondaAoVivo('${ronda.id}')">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="fw-bold text-dark"><i class="fas fa-user-shield text-success me-1"></i> ${vigiaNome}</span>
                        ${badgeConexao}
                    </div>
                    <div class="small text-muted mb-2">
                        <div><i class="fas fa-route me-1"></i> <b>Rota:</b> ${rotaNome}</div>
                        <div><i class="fas fa-clock me-1"></i> Início: ${inicioStr} (${duracaoMin} min) | Distância: ${distancia}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                        <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="event.stopPropagation(); window.focarRondaAoVivo('${ronda.id}')">
                            <i class="fas fa-crosshairs me-1"></i> Focar no Mapa
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.stopPropagation(); window.encerrarRondaForcado('${ronda.id}')" title="Encerrar Ronda Manualmente">
                            <i class="fas fa-stop me-1"></i> Encerrar
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Atualiza os Marcadores e Trajetos no Mapa Ao Vivo
     */
    function atualizarMapaRondasAoVivo(rondas) {
        if (!mapaAoVivo) return;

        const idsAtivos = new Set(rondas.map(r => r.id));

        // Remove do mapa rondas que já foram finalizadas
        markersAoVivo.forEach((marker, id) => {
            if (!idsAtivos.has(id)) {
                mapaAoVivo.removeLayer(marker);
                markersAoVivo.delete(id);
            }
        });
        polylinesAoVivo.forEach((poly, id) => {
            if (!idsAtivos.has(id)) {
                mapaAoVivo.removeLayer(poly);
                polylinesAoVivo.delete(id);
            }
        });

        // Adiciona ou atualiza cada ronda ativa
        rondas.forEach(ronda => {
            if (!ronda.ultimaPosicao || !ronda.ultimaPosicao.lat || !ronda.ultimaPosicao.lng) return;

            const lat = Number(ronda.ultimaPosicao.lat);
            const lng = Number(ronda.ultimaPosicao.lng);

            // Marcador do Vigia
            let marker = markersAoVivo.get(ronda.id);
            if (!marker) {
                const iconHtml = `
                    <div class="vigia-live-marker" style="width: 32px; height: 32px;">
                        <i class="fas fa-person-walking"></i>
                    </div>
                `;
                const customIcon = L.divIcon({
                    className: 'custom-vigia-icon',
                    html: iconHtml,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapaAoVivo);
                marker.bindPopup(`
                    <div class="p-1">
                        <b>${ronda.vigiaNome || 'Vigia'}</b><br>
                        <small>Rota: ${ronda.rotaNome || 'Geral'}</small><br>
                        <small>Precisão GPS: ±${Math.round(ronda.ultimaPosicao.precisao || 0)}m</small>
                    </div>
                `);
                markersAoVivo.set(ronda.id, marker);
            } else {
                marker.setLatLng([lat, lng]);
            }

            // Atualiza trajeto recente (Polyline verde)
            if (ronda.trajetoRecente && Array.isArray(ronda.trajetoRecente) && ronda.trajetoRecente.length > 1) {
                const latlngs = ronda.trajetoRecente.map(p => [p.lat, p.lng]);
                let poly = polylinesAoVivo.get(ronda.id);
                if (!poly) {
                    poly = L.polyline(latlngs, { color: '#10b981', weight: 4, opacity: 0.85 }).addTo(mapaAoVivo);
                    polylinesAoVivo.set(ronda.id, poly);
                } else {
                    poly.setLatLngs(latlngs);
                }
            }
        });
    }

    /**
     * Foca e centraliza a visualização no vigia selecionado
     */
    window.focarRondaAoVivo = function (rondaId) {
        const marker = markersAoVivo.get(rondaId);
        if (marker && mapaAoVivo) {
            mapaAoVivo.setView(marker.getLatLng(), 18, { animate: true });
            marker.openPopup();
        }
    };

    /**
     * Centraliza o mapa abrangendo todos os pontos cadastrados e vigias
     */
    window.centralizarMapaVigilancia = function () {
        if (!mapaAoVivo) return;
        const group = [];
        markersAoVivo.forEach(m => group.push(m.getLatLng()));
        markersPontosFixos.forEach(m => group.push(m.getLatLng()));

        if (group.length > 0) {
            mapaAoVivo.fitBounds(L.latLngBounds(group), { padding: [50, 50], maxZoom: 18 });
        }
    };

    /**
     * Plota todos os pontos de controle cadastrados como marcadores fixos no mapa
     */
    function renderizarPontosFixosNoMapa() {
        if (!mapaAoVivo) return;

        // Limpa marcadores anteriores
        markersPontosFixos.forEach(m => mapaAoVivo.removeLayer(m));
        markersPontosFixos = [];

        cachePontos.forEach(ponto => {
            if (!ponto.latitude || !ponto.longitude || ponto.ativo === false) return;

            const iconPonto = L.divIcon({
                className: 'custom-ponto-icon',
                html: `
                    <div style="background: #ef4444; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                        <i class="fas fa-map-pin"></i>
                    </div>
                `,
                iconSize: [26, 26],
                iconAnchor: [13, 26]
            });

            const m = L.marker([Number(ponto.latitude), Number(ponto.longitude)], { icon: iconPonto }).addTo(mapaAoVivo);
            m.bindPopup(`
                <div>
                    <b class="text-danger">${ponto.nome}</b><br>
                    <small>Setor: ${ponto.setor || '-'}</small><br>
                    <small>Validação: ${ponto.tipoConfirmacao === 'QRCODE' ? 'QR Code Obrigatório' : 'GPS (Proximidade)'}</small><br>
                    <small>Raio Tolerância: ${ponto.raioMetros || 25} metros</small>
                </div>
            `);

            // Raio de tolerância semitransparente
            const circ = L.circle([Number(ponto.latitude), Number(ponto.longitude)], {
                radius: Number(ponto.raioMetros) || 25,
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(mapaAoVivo);

            markersPontosFixos.push(m);
            markersPontosFixos.push(circ);
        });
    }

    /**
     * Carrega Pontos de Controle do Firestore
     */
    async function carregarPontosControle() {
        if (!window.db) return;
        try {
            const snap = await window.db.collection('vigilancia_pontos').get();
            cachePontos = [];
            snap.forEach(doc => cachePontos.push({ id: doc.id, ...doc.data() }));

            const tbody = document.getElementById('tabela-pontos-tbody');
            const kpiPontos = document.getElementById('kpi-total-pontos');
            if (kpiPontos) kpiPontos.innerText = cachePontos.filter(p => p.ativo !== false).length;

            if (!tbody) return;

            if (cachePontos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum ponto de controle cadastrado. Clique em <b>Novo Ponto de Controle</b>.</td></tr>`;
                return;
            }

            let html = '';
            cachePontos.forEach(p => {
                const statusBadge = p.ativo !== false
                    ? '<span class="badge bg-success">Ativo</span>'
                    : '<span class="badge bg-secondary">Inativo</span>';

                const metodoBadge = p.tipoConfirmacao === 'QRCODE'
                    ? '<span class="badge bg-dark"><i class="fas fa-qrcode me-1"></i> QR Code</span>'
                    : '<span class="badge bg-info text-dark"><i class="fas fa-satellite me-1"></i> GPS</span>';

                html += `
                    <tr>
                        <td class="fw-bold">${p.nome}</td>
                        <td>${p.setor || '-'}</td>
                        <td class="font-monospace small">${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}</td>
                        <td>${p.raioMetros || 25} m</td>
                        <td>${metodoBadge}</td>
                        <td class="small text-truncate" style="max-width: 200px;">${p.instrucoes || '-'}</td>
                        <td>${statusBadge}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editarPontoControle('${p.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.excluirPontoControle('${p.id}')" title="Excluir">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;

            // Plota no mapa ao vivo
            renderizarPontosFixosNoMapa();

        } catch (e) {
            console.error("Erro ao carregar pontos:", e);
        }
    }

    /**
     * Modal de Ponto de Controle
     */
    window.abrirModalPonto = function () {
        document.getElementById('formPontoControle').reset();
        document.getElementById('ponto-id').value = '';
        document.getElementById('ponto-ativo').checked = true;
        document.getElementById('modalPontoTitulo').innerHTML = '<i class="fas fa-map-pin me-2"></i> Novo Ponto de Controle';
        window.toggleTipoConfirmacaoPonto();

        const modalEl = document.getElementById('modalPontoControle');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        setTimeout(() => {
            initMapaSeletorPonto(-27.0543, -48.9832, 25);
        }, 400);
    };

    window.editarPontoControle = function (id) {
        const ponto = cachePontos.find(p => p.id === id);
        if (!ponto) return;

        document.getElementById('ponto-id').value = ponto.id;
        document.getElementById('ponto-nome').value = ponto.nome || '';
        document.getElementById('ponto-setor').value = ponto.setor || '';
        document.getElementById('ponto-lat').value = ponto.latitude || '';
        document.getElementById('ponto-lng').value = ponto.longitude || '';
        document.getElementById('ponto-raio').value = ponto.raioMetros || 25;
        document.getElementById('ponto-tipo-confirmacao').value = ponto.tipoConfirmacao || 'GPS';
        document.getElementById('ponto-qrcode-key').value = ponto.qrCodeKey || '';
        document.getElementById('ponto-instrucoes').value = ponto.instrucoes || '';
        document.getElementById('ponto-ativo').checked = ponto.ativo !== false;

        document.getElementById('modalPontoTitulo').innerHTML = '<i class="fas fa-edit me-2"></i> Editar Ponto de Controle';
        window.toggleTipoConfirmacaoPonto();

        const modalEl = document.getElementById('modalPontoControle');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        setTimeout(() => {
            initMapaSeletorPonto(ponto.latitude, ponto.longitude, ponto.raioMetros || 25);
        }, 400);
    };

    function initMapaSeletorPonto(lat, lng, raio) {
        const container = document.getElementById('mapa-seletor-ponto');
        if (!container) return;

        if (mapaSeletorPonto) {
            mapaSeletorPonto.remove();
            mapaSeletorPonto = null;
        }

        mapaSeletorPonto = L.map('mapa-seletor-ponto').setView([lat, lng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaSeletorPonto);

        markerSeletorPonto = L.marker([lat, lng], { draggable: true }).addTo(mapaSeletorPonto);
        circuloSeletorRaio = L.circle([lat, lng], {
            radius: Number(raio) || 25,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.15
        }).addTo(mapaSeletorPonto);

        function atualizarInputs(latlng) {
            document.getElementById('ponto-lat').value = latlng.lat.toFixed(6);
            document.getElementById('ponto-lng').value = latlng.lng.toFixed(6);
            circuloSeletorRaio.setLatLng(latlng);
        }

        markerSeletorPonto.on('dragend', function (e) {
            atualizarInputs(e.target.getLatLng());
        });

        mapaSeletorPonto.on('click', function (e) {
            markerSeletorPonto.setLatLng(e.latlng);
            atualizarInputs(e.latlng);
        });

        mapaSeletorPonto.invalidateSize();
    }

    window.capturarLocalizacaoAtualPonto = function () {
        if (!navigator.geolocation) {
            alert("Geolocalização não é suportada neste navegador.");
            return;
        }
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('ponto-lat').value = lat.toFixed(6);
            document.getElementById('ponto-lng').value = lng.toFixed(6);
            if (mapaSeletorPonto && markerSeletorPonto) {
                const latlng = L.latLng(lat, lng);
                markerSeletorPonto.setLatLng(latlng);
                circuloSeletorRaio.setLatLng(latlng);
                mapaSeletorPonto.setView(latlng, 18);
            }
        }, (err) => {
            alert(`Falha ao obter localização: ${err.message}`);
        }, { enableHighAccuracy: true });
    };

    window.toggleTipoConfirmacaoPonto = function () {
        const tipo = document.getElementById('ponto-tipo-confirmacao').value;
        const wrapper = document.getElementById('wrapper-qrcode-key');
        if (wrapper) {
            wrapper.style.display = tipo === 'QRCODE' ? 'block' : 'none';
        }
    };

    window.gerarChaveQRCodePonto = function () {
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        document.getElementById('ponto-qrcode-key').value = `NEXTER-PONTO-${rand}`;
    };

    window.salvarPontoControle = async function () {
        const id = document.getElementById('ponto-id').value;
        const nome = document.getElementById('ponto-nome').value.trim();
        const setor = document.getElementById('ponto-setor').value.trim();
        const lat = parseFloat(document.getElementById('ponto-lat').value);
        const lng = parseFloat(document.getElementById('ponto-lng').value);
        const raio = parseInt(document.getElementById('ponto-raio').value, 10) || 25;
        const tipo = document.getElementById('ponto-tipo-confirmacao').value;
        const qrKey = document.getElementById('ponto-qrcode-key').value.trim();
        const instrucoes = document.getElementById('ponto-instrucoes').value.trim();
        const ativo = document.getElementById('ponto-ativo').checked;

        if (!nome || isNaN(lat) || isNaN(lng)) {
            alert("Por favor, preencha o nome do ponto e as coordenadas latitude/longitude válidas.");
            return;
        }

        const payload = {
            nome,
            setor,
            latitude: lat,
            longitude: lng,
            raioMetros: raio,
            tipoConfirmacao: tipo,
            qrCodeKey: tipo === 'QRCODE' ? (qrKey || `NEXTER-PONTO-${Date.now().toString(36).toUpperCase()}`) : null,
            instrucoes,
            ativo,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (id) {
                await window.db.collection('vigilancia_pontos').doc(id).update(payload);
            } else {
                payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
                await window.db.collection('vigilancia_pontos').add(payload);
            }

            const modalEl = document.getElementById('modalPontoControle');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            await carregarPontosControle();
            alert("Ponto de controle salvo com sucesso!");
        } catch (e) {
            console.error("Erro ao salvar ponto:", e);
            alert(`Erro ao salvar ponto: ${e.message}`);
        }
    };

    window.excluirPontoControle = async function (id) {
        if (!confirm("Tem certeza que deseja excluir este ponto de controle?")) return;
        try {
            await window.db.collection('vigilancia_pontos').doc(id).delete();
            await carregarPontosControle();
        } catch (e) {
            alert(`Erro ao excluir ponto: ${e.message}`);
        }
    };

    /**
     * Carrega Rotas Cadastradas
     */
    async function carregarRotas() {
        if (!window.db) return;
        try {
            const snap = await window.db.collection('vigilancia_rotas').get();
            cacheRotas = [];
            snap.forEach(doc => cacheRotas.push({ id: doc.id, ...doc.data() }));

            const tbody = document.getElementById('tabela-rotas-tbody');
            if (!tbody) return;

            if (cacheRotas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Nenhuma rota configurada. Clique em <b>Nova Rota</b>.</td></tr>`;
                return;
            }

            let html = '';
            cacheRotas.forEach(r => {
                const qtdPontos = r.pontos ? r.pontos.length : 0;
                const statusBadge = r.ativo !== false
                    ? '<span class="badge bg-success">Ativa</span>'
                    : '<span class="badge bg-secondary">Inativa</span>';

                html += `
                    <tr>
                        <td class="fw-bold">${r.nome}</td>
                        <td>${r.setor || '-'}</td>
                        <td><span class="badge bg-primary rounded-pill">${qtdPontos} pontos</span></td>
                        <td>${r.duracaoEsperadaMin || 45} min</td>
                        <td>v${r.versao || 1}</td>
                        <td>${statusBadge}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editarRota('${r.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.excluirRota('${r.id}')" title="Excluir">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (e) {
            console.error("Erro ao carregar rotas:", e);
        }
    }

    /**
     * Modal de Rota
     */
    window.abrirModalRota = function () {
        document.getElementById('formRota').reset();
        document.getElementById('rota-id').value = '';
        document.getElementById('rota-ativo').checked = true;
        document.getElementById('modalRotaTitulo').innerHTML = '<i class="fas fa-route me-2"></i> Nova Rota de Vigilância';

        renderizarCheckboxesPontosRota([]);

        const modalEl = document.getElementById('modalRota');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    window.editarRota = function (id) {
        const rota = cacheRotas.find(r => r.id === id);
        if (!rota) return;

        document.getElementById('rota-id').value = rota.id;
        document.getElementById('rota-nome').value = rota.nome || '';
        document.getElementById('rota-setor').value = rota.setor || '';
        document.getElementById('rota-duracao').value = rota.duracaoEsperadaMin || 45;
        document.getElementById('rota-descricao').value = rota.descricao || '';
        document.getElementById('rota-ativo').checked = rota.ativo !== false;

        document.getElementById('modalRotaTitulo').innerHTML = '<i class="fas fa-edit me-2"></i> Editar Rota';

        renderizarCheckboxesPontosRota(rota.pontos || []);

        const modalEl = document.getElementById('modalRota');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    function renderizarCheckboxesPontosRota(pontosSelecionados) {
        const container = document.getElementById('lista-selecao-pontos-rota');
        if (!container) return;

        if (cachePontos.length === 0) {
            container.innerHTML = '<p class="text-danger small mb-0">Nenhum ponto de controle cadastrado. Cadastre pontos primeiro na aba "Pontos de Controle".</p>';
            return;
        }

        const idsSelecionados = new Set(pontosSelecionados.map(p => p.pontoId || p));

        let html = '';
        cachePontos.forEach((ponto, index) => {
            const checked = idsSelecionados.has(ponto.id) ? 'checked' : '';
            html += `
                <div class="form-check mb-2">
                    <input class="form-check-input check-ponto-rota" type="checkbox" value="${ponto.id}" id="check-ponto-${ponto.id}" ${checked}>
                    <label class="form-check-label d-flex justify-content-between align-items-center" for="check-ponto-${ponto.id}">
                        <span><b>${ponto.nome}</b> <span class="text-muted small">(${ponto.setor || 'Área Livre'})</span></span>
                        <span class="badge ${ponto.tipoConfirmacao === 'QRCODE' ? 'bg-dark' : 'bg-info text-dark'} small">
                            ${ponto.tipoConfirmacao === 'QRCODE' ? 'QR Code' : 'GPS'}
                        </span>
                    </label>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    window.salvarRota = async function () {
        const id = document.getElementById('rota-id').value;
        const nome = document.getElementById('rota-nome').value.trim();
        const setor = document.getElementById('rota-setor').value.trim();
        const duracao = parseInt(document.getElementById('rota-duracao').value, 10) || 45;
        const descricao = document.getElementById('rota-descricao').value.trim();
        const ativo = document.getElementById('rota-ativo').checked;

        const checkboxes = document.querySelectorAll('.check-ponto-rota:checked');
        const pontos = [];
        checkboxes.forEach((cb, idx) => {
            const pontoDoc = cachePontos.find(p => p.id === cb.value);
            if (pontoDoc) {
                pontos.push({
                    pontoId: pontoDoc.id,
                    nome: pontoDoc.nome,
                    setor: pontoDoc.setor || '',
                    latitude: pontoDoc.latitude,
                    longitude: pontoDoc.longitude,
                    raioMetros: pontoDoc.raioMetros || 25,
                    tipoConfirmacao: pontoDoc.tipoConfirmacao || 'GPS',
                    qrCodeKey: pontoDoc.qrCodeKey || null,
                    ordem: idx + 1,
                    obrigatorio: true
                });
            }
        });

        if (!nome || pontos.length === 0) {
            alert("Informe o nome da rota e selecione pelo menos um ponto de controle.");
            return;
        }

        const payload = {
            nome,
            setor,
            duracaoEsperadaMin: duracao,
            descricao,
            pontos,
            ativo,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (id) {
                // Incrementa versão da rota para auditoria
                payload.versao = firebase.firestore.FieldValue.increment(1);
                await window.db.collection('vigilancia_rotas').doc(id).update(payload);
            } else {
                payload.versao = 1;
                payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
                await window.db.collection('vigilancia_rotas').add(payload);
            }

            const modalEl = document.getElementById('modalRota');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            await carregarRotas();
            alert("Rota salva com sucesso!");
        } catch (e) {
            console.error("Erro ao salvar rota:", e);
            alert(`Erro ao salvar rota: ${e.message}`);
        }
    };

    window.excluirRota = async function (id) {
        if (!confirm("Tem certeza que deseja excluir esta rota?")) return;
        try {
            await window.db.collection('vigilancia_rotas').doc(id).delete();
            await carregarRotas();
        } catch (e) {
            alert(`Erro ao excluir rota: ${e.message}`);
        }
    };

    /**
     * Carrega Vigias do Firestore
     */
    async function carregarVigias() {
        if (!window.db) return;
        try {
            const snap = await window.db.collection('vigilancia_vigias').get();
            cacheVigias = [];
            snap.forEach(doc => cacheVigias.push({ id: doc.id, ...doc.data() }));

            const tbody = document.getElementById('tabela-vigias-tbody');
            const selectHist = document.getElementById('hist-filtro-vigia');

            if (selectHist) {
                selectHist.innerHTML = '<option value="">Todos os Vigias</option>' +
                    cacheVigias.map(v => `<option value="${v.id}">${v.nome} (Matrícula: ${v.matricula})</option>`).join('');
            }

            if (!tbody) return;

            if (cacheVigias.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Nenhum vigia cadastrado. Clique em <b>Cadastrar Vigia</b>.</td></tr>`;
                return;
            }

            let html = '';
            cacheVigias.forEach(v => {
                const statusBadge = v.ativo !== false
                    ? '<span class="badge bg-success">Ativo</span>'
                    : '<span class="badge bg-secondary">Inativo</span>';

                let dataCadastro = '-';
                if (v.criadoEm) {
                    const d = v.criadoEm.toDate ? v.criadoEm.toDate() : new Date(v.criadoEm);
                    dataCadastro = d.toLocaleDateString('pt-BR');
                }

                const erros = v.tentativasIncorretas || 0;
                const errosBadge = erros >= 5
                    ? '<span class="badge bg-danger">Bloqueado</span>'
                    : `<span class="badge bg-light text-dark">${erros}</span>`;

                const pinBadge = (v.pinCode || v.pinHash)
                    ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="fas fa-lock me-1"></i> Salvo (••••)</span>'
                    : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="fas fa-times-circle me-1"></i> Não definido</span>';

                html += `
                    <tr>
                        <td class="fw-bold font-monospace">${v.matricula}</td>
                        <td>${v.nome}</td>
                        <td>${pinBadge}</td>
                        <td>${statusBadge}</td>
                        <td>${dataCadastro}</td>
                        <td>${errosBadge}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editarVigia('${v.id}')" title="Editar Vigia / Ver PIN">
                                <i class="fas fa-key"></i>
                            </button>
                            ${erros >= 5 ? `<button class="btn btn-sm btn-outline-warning me-1" onclick="window.desbloquearVigia('${v.id}')" title="Desbloquear Vigia"><i class="fas fa-unlock"></i></button>` : ''}
                            <button class="btn btn-sm btn-outline-danger" onclick="window.excluirVigia('${v.id}')" title="Desativar">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (e) {
            console.error("Erro ao carregar vigias:", e);
        }
    }

    /**
     * Alterna visualização do PIN (ocultar/mostrar)
     */
    window.toggleVerPinVigia = function () {
        const pinInput = document.getElementById('vigia-pin');
        const icon = document.getElementById('icon-ver-pin');
        if (!pinInput) return;

        if (pinInput.type === 'password') {
            pinInput.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            pinInput.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    };

    /**
     * Modal de Vigia
     */
    window.abrirModalVigia = function () {
        document.getElementById('formVigia').reset();
        document.getElementById('vigia-id').value = '';
        document.getElementById('vigia-ativo').checked = true;

        const pinInput = document.getElementById('vigia-pin');
        pinInput.type = 'password';
        pinInput.value = '';
        pinInput.required = true;
        pinInput.placeholder = '••••';
        delete pinInput.dataset.pinOriginal;

        const badge = document.getElementById('badge-pin-vigia');
        if (badge) {
            badge.className = 'badge bg-warning text-dark';
            badge.innerHTML = '<i class="fas fa-key me-1"></i> Obrigatório';
        }
        const hint = document.getElementById('vigia-pin-hint');
        if (hint) {
            hint.innerHTML = 'Defina um PIN numérico de 4 a 6 dígitos para o vigia.';
        }
        const icon = document.getElementById('icon-ver-pin');
        if (icon) {
            icon.className = 'fas fa-eye';
        }

        document.getElementById('modalVigiaTitulo').innerHTML = '<i class="fas fa-user-shield me-2"></i> Cadastrar Vigia';

        const modalEl = document.getElementById('modalVigia');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    window.editarVigia = function (id) {
        const vigia = cacheVigias.find(v => v.id === id);
        if (!vigia) return;

        document.getElementById('vigia-id').value = vigia.id;
        document.getElementById('vigia-nome').value = vigia.nome || '';
        document.getElementById('vigia-matricula').value = vigia.matricula || '';
        document.getElementById('vigia-ativo').checked = vigia.ativo !== false;

        const pinInput = document.getElementById('vigia-pin');
        pinInput.type = 'password';
        pinInput.required = false;

        const badge = document.getElementById('badge-pin-vigia');
        const hint = document.getElementById('vigia-pin-hint');
        const icon = document.getElementById('icon-ver-pin');
        if (icon) icon.className = 'fas fa-eye';

        // Tenta recuperar o PIN original
        const pinSalvo = vigia.pinCode ? deobfuscatePin(vigia.pinCode, vigia.pinSalt) : '';

        if (pinSalvo) {
            pinInput.value = pinSalvo;
            pinInput.dataset.pinOriginal = pinSalvo;
            if (badge) {
                badge.className = 'badge bg-success-subtle text-success border border-success-subtle';
                badge.innerHTML = `<i class="fas fa-check-circle me-1"></i> Salvo (${pinSalvo.length} dígitos)`;
            }
            if (hint) {
                hint.innerHTML = '<span class="text-success fw-semibold"><i class="fas fa-shield-halved me-1"></i> PIN salvo no banco. Clique no olho para visualizar ou digite novos números para alterar.</span>';
            }
        } else if (vigia.pinHash) {
            // Caso já salvo com hash no primeiro teste do usuário
            pinInput.value = '••••';
            pinInput.dataset.pinOriginal = '••••';
            if (badge) {
                badge.className = 'badge bg-success-subtle text-success border border-success-subtle';
                badge.innerHTML = '<i class="fas fa-shield-halved me-1"></i> PIN Salvo & Ativo';
            }
            if (hint) {
                hint.innerHTML = '<span class="text-success fw-semibold"><i class="fas fa-check-circle me-1"></i> O PIN já está gravado e ativo no banco. Se quiser trocar, digite o novo PIN e salve.</span>';
            }
        } else {
            pinInput.value = '';
            delete pinInput.dataset.pinOriginal;
            if (badge) {
                badge.className = 'badge bg-danger';
                badge.innerHTML = 'Não cadastrado';
            }
            if (hint) {
                hint.innerHTML = 'Este vigia ainda não possui PIN cadastrado.';
            }
        }

        document.getElementById('modalVigiaTitulo').innerHTML = '<i class="fas fa-user-edit me-2"></i> Editar Vigia & PIN';

        const modalEl = document.getElementById('modalVigia');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    window.salvarVigia = async function () {
        const id = document.getElementById('vigia-id').value;
        const nome = document.getElementById('vigia-nome').value.trim();
        const matricula = document.getElementById('vigia-matricula').value.trim();
        const pinInput = document.getElementById('vigia-pin');
        const pin = pinInput.value.trim();
        const pinOriginal = pinInput.dataset.pinOriginal || '';
        const ativo = document.getElementById('vigia-ativo').checked;

        if (!nome || !matricula) {
            alert("Nome e matrícula são obrigatórios.");
            return;
        }

        if (!id && (!pin || pin.length < 4 || pin === '••••')) {
            alert("O PIN é obrigatório no cadastro e deve ter de 4 a 6 dígitos numéricos.");
            return;
        }

        // Validação de matrícula duplicada
        const matExistente = cacheVigias.find(v => v.matricula === matricula && v.id !== id);
        if (matExistente) {
            alert(`A matrícula ${matricula} já está em uso pelo vigia ${matExistente.nome}.`);
            return;
        }

        const payload = {
            nome,
            matricula,
            ativo,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Se informou ou alterou o PIN (e não é a máscara '••••')
        if (pin && pin !== '••••' && pin !== pinOriginal) {
            if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
                alert("O PIN deve conter de 4 a 6 dígitos numéricos (apenas números).");
                return;
            }
            const salt = gerarSalt();
            const hash = await hashPin(pin, salt);
            payload.pinHash = hash;
            payload.pinSalt = salt;
            payload.pinCode = obfuscatePin(pin, salt);
            payload.tentativasIncorretas = 0;
            payload.bloqueadoAte = null;
        } else if (pin && pin === pinOriginal && pin !== '••••') {
            // Mantém o PIN existente e assegura pinCode se faltar
            const vigiaAtual = cacheVigias.find(v => v.id === id);
            if (vigiaAtual && !vigiaAtual.pinCode && vigiaAtual.pinSalt) {
                payload.pinCode = obfuscatePin(pin, vigiaAtual.pinSalt);
            }
        }

        try {
            if (id) {
                await window.db.collection('vigilancia_vigias').doc(id).update(payload);
            } else {
                payload.tentativasIncorretas = 0;
                payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
                await window.db.collection('vigilancia_vigias').add(payload);
            }

            const modalEl = document.getElementById('modalVigia');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            await carregarVigias();
            alert("Vigia e PIN salvos com sucesso!");
        } catch (e) {
            console.error("Erro ao salvar vigia:", e);
            alert(`Erro ao salvar vigia: ${e.message}`);
        }
    };

    window.desbloquearVigia = async function (id) {
        try {
            await window.db.collection('vigilancia_vigias').doc(id).update({
                tentativasIncorretas: 0,
                bloqueadoAte: null
            });
            await carregarVigias();
            alert("Vigia desbloqueado com sucesso!");
        } catch (e) {
            alert(`Erro ao desbloquear vigia: ${e.message}`);
        }
    };

    window.excluirVigia = async function (id) {
        if (!confirm("Tem certeza que deseja inativar este vigia? O histórico de rondas anteriores será preservado.")) return;
        try {
            await window.db.collection('vigilancia_vigias').doc(id).update({
                ativo: false,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            await carregarVigias();
        } catch (e) {
            alert(`Erro ao inativar vigia: ${e.message}`);
        }
    };

    /**
     * Ocorrências
     */
    let cacheOcorrencias = [];
    async function carregarOcorrencias() {
        if (!window.db) return;
        try {
            const snap = await window.db.collection('vigilancia_ocorrencias')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            cacheOcorrencias = [];
            snap.forEach(doc => cacheOcorrencias.push({ id: doc.id, ...doc.data() }));

            const kpiOcorrencias = document.getElementById('kpi-total-ocorrencias');
            if (kpiOcorrencias) kpiOcorrencias.innerText = cacheOcorrencias.length;

            renderizarTabelaOcorrencias(cacheOcorrencias);
        } catch (e) {
            console.error("Erro ao carregar ocorrências:", e);
        }
    }

    function renderizarTabelaOcorrencias(lista) {
        const tbody = document.getElementById('tabela-ocorrencias-tbody');
        if (!tbody) return;

        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Nenhuma ocorrência registrada até o momento.</td></tr>`;
            return;
        }

        let html = '';
        lista.forEach(o => {
            let dataStr = '-';
            if (o.timestamp) {
                const dt = o.timestamp.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
                dataStr = dt.toLocaleString('pt-BR');
            }

            const fotoHtml = o.fotoUrl
                ? `<a href="${o.fotoUrl}" target="_blank" class="btn btn-sm btn-outline-info"><i class="fas fa-image me-1"></i> Ver Foto</a>`
                : '<span class="text-muted small">Sem foto</span>';

            const gpsStr = (o.latitude && o.longitude)
                ? `<span class="small font-monospace">${Number(o.latitude).toFixed(5)}, ${Number(o.longitude).toFixed(5)}</span>`
                : '<span class="text-muted small">-</span>';

            html += `
                <tr>
                    <td class="small fw-semibold">${dataStr}</td>
                    <td>${o.vigiaNome || 'Vigia'}</td>
                    <td class="small text-muted">${o.rotaNome || 'Ronda'}</td>
                    <td><span class="badge bg-warning text-dark">${o.categoria || 'Geral'}</span></td>
                    <td>${o.descricao || '-'}</td>
                    <td>${fotoHtml}</td>
                    <td>${gpsStr}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    window.filtrarOcorrenciasVigilancia = function () {
        const cat = document.getElementById('filtro-categoria-ocorrencia').value;
        if (!cat) {
            renderizarTabelaOcorrencias(cacheOcorrencias);
        } else {
            renderizarTabelaOcorrencias(cacheOcorrencias.filter(o => o.categoria === cat));
        }
    };

    /**
     * Encerrar Ronda Forçado pelo Gestor
     */
    window.encerrarRondaForcado = async function (rondaId) {
        if (!confirm("Deseja realmente encerrar esta ronda administrativamente?")) return;
        try {
            await window.db.collection('vigilancia_rondas').doc(rondaId).update({
                status: 'CONCLUIDA',
                fim: firebase.firestore.FieldValue.serverTimestamp(),
                motivoEncerramento: 'Encerrada pelo Gestor via Painel Central'
            });
            alert("Ronda encerrada com sucesso!");
        } catch (e) {
            alert(`Erro ao encerrar ronda: ${e.message}`);
        }
    };

    /**
     * Atualização do KPI de Rondas Concluídas Hoje (Sem exigir índice composto no Firestore)
     */
    async function atualizarKpiHoje() {
        if (!window.db) return;
        try {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            // Consulta por status com limite e calcula data em memória para dispensar índices manuais
            const snap = await window.db.collection('vigilancia_rondas')
                .where('status', '==', 'CONCLUIDA')
                .limit(200)
                .get();

            let totalHoje = 0;
            snap.forEach(doc => {
                const d = doc.data();
                if (d.fim) {
                    const dtFim = d.fim.toDate ? d.fim.toDate() : new Date(d.fim);
                    if (dtFim >= hoje) totalHoje++;
                }
            });

            const kpi = document.getElementById('kpi-rondas-concluidas');
            if (kpi) kpi.innerText = totalHoje;
        } catch (e) {
            console.warn("Erro ao buscar KPI hoje:", e);
        }
    }

    /**
     * Histórico e Auditoria de Rondas
     */
    window.consultarHistoricoRondas = async function () {
        if (!window.db) return;

        const dtIni = document.getElementById('hist-data-inicio').value;
        const dtFim = document.getElementById('hist-data-fim').value;
        const vigiaId = document.getElementById('hist-filtro-vigia').value;
        const tbody = document.getElementById('tabela-historico-tbody');

        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i> Consultando histórico...</td></tr>';

        try {
            let query = window.db.collection('vigilancia_rondas');

            if (dtIni) {
                const dIni = new Date(dtIni + 'T00:00:00');
                query = query.where('inicio', '>=', dIni);
            }
            if (dtFim) {
                const dFim = new Date(dtFim + 'T23:59:59');
                query = query.where('inicio', '<=', dFim);
            }

            const snap = await query.orderBy('inicio', 'desc').limit(100).get();
            let rondas = [];
            snap.forEach(doc => {
                const d = doc.data();
                if (d.status === 'CONCLUIDA') {
                    rondas.push({ id: doc.id, ...d });
                }
            });

            if (vigiaId) {
                rondas = rondas.filter(r => r.vigiaId === vigiaId);
            }

            if (rondas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Nenhuma ronda encontrada para o período e filtros selecionados.</td></tr>';
                return;
            }

            let html = '';
            rondas.forEach(r => {
                let inicioStr = '-';
                if (r.inicio) {
                    const dt = r.inicio.toDate ? r.inicio.toDate() : new Date(r.inicio);
                    inicioStr = dt.toLocaleString('pt-BR');
                }

                const duracao = r.duracaoMinutos ? `${r.duracaoMinutos} min` : '-';
                const distancia = r.distanciaMetros ? `${(r.distanciaMetros / 1000).toFixed(2)} km` : '-';
                const cumpridos = r.checkpointsStatus ? `${r.checkpointsStatus.filter(c => c.status === 'CONFIRMADO').length} / ${r.checkpointsStatus.length}` : '-';

                html += `
                    <tr>
                        <td class="small fw-semibold">${inicioStr}</td>
                        <td>${r.vigiaNome || 'Vigia'}</td>
                        <td>${r.rotaNome || 'Ronda Livre'}</td>
                        <td>${duracao}</td>
                        <td>${distancia}</td>
                        <td><span class="badge bg-light text-dark border">${cumpridos}</span></td>
                        <td><span class="badge bg-warning-subtle text-dark">${r.qtdOcorrencias || 0}</span></td>
                        <td><span class="badge bg-success">Concluída</span></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.abrirDetalhesRonda('${r.id}')" title="Ver Auditoria do Trajeto">
                                <i class="fas fa-eye me-1"></i> Auditoria
                            </button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (e) {
            console.error("Erro ao consultar histórico:", e);
            tbody.innerHTML = `<tr><td colspan="9" class="text-danger text-center py-4">Erro na consulta: ${e.message}</td></tr>`;
        }
    };

    /**
     * Modal de Auditoria da Ronda (Trajeto + Checkpoints)
     */
    window.abrirDetalhesRonda = async function (rondaId) {
        const modalEl = document.getElementById('modalDetalheRonda');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        const infoDiv = document.getElementById('detalhe-ronda-info');
        infoDiv.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Carregando detalhes do trajeto...</p></div>';

        try {
            const doc = await window.db.collection('vigilancia_rondas').doc(rondaId).get();
            if (!doc.exists) {
                infoDiv.innerHTML = '<div class="alert alert-danger">Ronda não encontrada.</div>';
                return;
            }
            const ronda = doc.data();

            // Busca os pontos detalhados de GPS gravados
            const trajetoSnap = await window.db.collection('vigilancia_rondas').doc(rondaId)
                .collection('trajeto')
                .orderBy('timestamp', 'asc')
                .get();

            const coordenadas = [];
            trajetoSnap.forEach(tDoc => {
                const t = tDoc.data();
                if (t.lat && t.lng) coordenadas.push([Number(t.lat), Number(t.lng)]);
            });

            // Preenche painel informativo lateral
            let dtInicio = ronda.inicio ? (ronda.inicio.toDate ? ronda.inicio.toDate() : new Date(ronda.inicio)).toLocaleString('pt-BR') : '-';
            let dtFim = ronda.fim ? (ronda.fim.toDate ? ronda.fim.toDate() : new Date(ronda.fim)).toLocaleString('pt-BR') : '-';

            let checkpointsHtml = '';
            if (ronda.checkpointsStatus && ronda.checkpointsStatus.length > 0) {
                checkpointsHtml = '<h6 class="fw-bold mt-3 mb-2">Pontos de Controle:</h6><ul class="list-group list-group-flush small">';
                ronda.checkpointsStatus.forEach(cp => {
                    const ok = cp.status === 'CONFIRMADO';
                    checkpointsHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1 bg-transparent">
                            <span><i class="fas fa-${ok ? 'check text-success' : 'times text-danger'} me-1"></i> ${cp.nome}</span>
                            <span class="badge ${ok ? 'bg-success' : 'bg-danger'}">${cp.status}</span>
                        </li>
                    `;
                });
                checkpointsHtml += '</ul>';
            }

            infoDiv.innerHTML = `
                <h5 class="fw-bold text-primary mb-2">${ronda.rotaNome || 'Ronda Realizada'}</h5>
                <p class="small text-muted mb-3"><i class="fas fa-user-shield me-1"></i> <b>Vigia:</b> ${ronda.vigiaNome || '-'} (${ronda.vigiaMatricula || '-'})</p>
                <div class="small">
                    <div><b>Início:</b> ${dtInicio}</div>
                    <div><b>Término:</b> ${dtFim}</div>
                    <div><b>Duração:</b> ${ronda.duracaoMinutos || '-'} minutos</div>
                    <div><b>Distância:</b> ${ronda.distanciaMetros ? (ronda.distanciaMetros / 1000).toFixed(2) + ' km' : '-'}</div>
                    <div><b>Pontos de GPS:</b> ${coordenadas.length} registros</div>
                    <div><b>Ocorrências:</b> ${ronda.qtdOcorrencias || 0}</div>
                </div>
                ${checkpointsHtml}
            `;

            // Desenha no mapa do modal
            setTimeout(() => {
                const containerMapa = document.getElementById('mapa-detalhe-ronda');
                if (mapaDetalhe) {
                    mapaDetalhe.remove();
                    mapaDetalhe = null;
                }
                mapaDetalhe = L.map(containerMapa).setView([-27.0543, -48.9832], 17);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapaDetalhe);

                if (coordenadas.length > 0) {
                    const poly = L.polyline(coordenadas, { color: '#10b981', weight: 4 }).addTo(mapaDetalhe);
                    L.marker(coordenadas[0]).addTo(mapaDetalhe).bindPopup("<b>Início da Ronda</b>").openPopup();
                    L.marker(coordenadas[coordenadas.length - 1]).addTo(mapaDetalhe).bindPopup("<b>Fim da Ronda</b>");
                    mapaDetalhe.fitBounds(poly.getBounds(), { padding: [30, 30] });
                }
            }, 300);

        } catch (e) {
            console.error("Erro ao carregar auditoria:", e);
            infoDiv.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
        }
    };

    /**
     * Exportações PDF e CSV
     */
    window.exportarRelatorioVigilanciaCSV = function () {
        const rows = [];
        const headers = ["Data Início", "Vigia", "Rota", "Duração (min)", "Distância (m)", "Status"];
        rows.push(headers.join(","));

        const trs = document.querySelectorAll('#tabela-historico-tbody tr');
        trs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 6) {
                const row = Array.from(tds).slice(0, 6).map(td => `"${td.innerText.replace(/"/g, '""')}"`);
                rows.push(row.join(","));
            }
        });

        const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_vigilancia_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    window.exportarRelatorioVigilanciaPDF = function () {
        const element = document.getElementById('tab-historico');
        if (!element || typeof html2pdf === 'undefined') {
            window.print();
            return;
        }
        const opt = {
            margin: 10,
            filename: `relatorio_vigilancia_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    };

    // Cleanup ao sair da tela
    window.limparVigilanciaGestao = function () {
        if (unsubscribeRondasAtivas) {
            unsubscribeRondasAtivas();
            unsubscribeRondasAtivas = null;
        }
        if (mapaAoVivo) {
            mapaAoVivo.remove();
            mapaAoVivo = null;
        }
        if (mapaSeletorPonto) {
            mapaSeletorPonto.remove();
            mapaSeletorPonto = null;
        }
    };

    // Atualização manual
    window.atualizarDadosVigilancia = async function (mostrarFeedback = false) {
        const icone = document.getElementById('icon-refresh-vigilancia');
        if (icone) icone.classList.add('fa-spin');
        await Promise.all([
            carregarPontosControle(),
            carregarRotas(),
            carregarVigias(),
            carregarOcorrencias(),
            atualizarKpiHoje()
        ]);
        if (icone) icone.classList.remove('fa-spin');
        if (mostrarFeedback) alert("Dados atualizados com sucesso!");
    };

})();
