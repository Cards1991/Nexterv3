// js/mapaColaboradores.js

let map;
let markersCluster;
let __mapa_funcionarios_cache = []; // Cache para filtragem local

// Inicializa o mapa usando Leaflet
function initMap() {
    const mapElement = document.getElementById("mapa-colaboradores");
    if (!mapElement) return;

    // Se o mapa já existe, apenas ajusta o tamanho (útil quando a aba se torna visível)
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return;
    }

    // Coordenadas iniciais (Centro aproximado de Imbituva, PR - ajuste conforme sua sede)
    const center = [-25.2278, -50.6033];

    // Cria o mapa
    // Verifica se L (Leaflet) está definido
    if (typeof L === 'undefined') {
        console.error("Leaflet não carregado.");
        return;
    }

    map = L.map('mapa-colaboradores').setView(center, 12);

    // Adiciona a camada de tiles do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Inicializa o grupo de clusterização se o plugin estiver carregado
    if (L.markerClusterGroup) {
        markersCluster = L.markerClusterGroup();
        map.addLayer(markersCluster);
    }
}

// Busca CEP via ViaCEP (Mantido para auxiliar no preenchimento)
async function buscarCep(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
            if(document.getElementById('endereco-logradouro')) document.getElementById('endereco-logradouro').value = data.logradouro;
            if(document.getElementById('endereco-bairro')) document.getElementById('endereco-bairro').value = data.bairro;
            if(document.getElementById('endereco-cidade')) document.getElementById('endereco-cidade').value = data.localidade;
            if(document.getElementById('endereco-estado')) document.getElementById('endereco-estado').value = data.uf;

            // Limpa coordenadas antigas pois o endereço mudou
            if(document.getElementById('endereco-latitude')) document.getElementById('endereco-latitude').value = '';
            if(document.getElementById('endereco-longitude')) document.getElementById('endereco-longitude').value = '';
        }
    } catch (error) {
        console.error("Erro ao buscar CEP:", error);
    }
}

// Geocodifica o endereço usando Nominatim (OpenStreetMap)
async function geocodificarEndereco(enderecoObj) {
    if (!enderecoObj.logradouro || !enderecoObj.cidade) {
        console.warn("Endereço incompleto para geocodificação.");
        return null;
    }

    // Monta a query de busca
    const query = `${enderecoObj.logradouro}, ${enderecoObj.numero || ''}, ${enderecoObj.bairro || ''}, ${enderecoObj.cidade}, ${enderecoObj.estado || ''}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    try {
        // Adiciona cabeçalho para respeitar a política de uso do Nominatim
        const response = await fetch(url, {
            headers: {
                'Accept-Language': 'pt-BR'
            }
        });
        const data = await response.json();

        if (data && data.length > 0) {
            return {
                lat: data[0].lat,
                lng: data[0].lon
            };
        } else {
            console.warn("Endereço não encontrado pelo serviço de geocodificação.");
        }
    } catch (error) {
        console.error("Erro na geocodificação:", error);
    }
    return null;
}

// Carrega colaboradores e renderiza no mapa
async function carregarMapaColaboradores() {
    // Garante que o mapa está inicializado
    if (!map) {
        initMap();
    } else {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        __mapa_funcionarios_cache = snapshot.docs.map(doc => doc.data());

        // Popula o filtro de bairros e renderiza
        atualizarFiltrosMapa();
        renderizarMarcadores();

        console.log(`Mapa atualizado com ${__mapa_funcionarios_cache.length} colaboradores.`);
    } catch (error) {
        console.error("Erro ao carregar colaboradores no mapa:", error);
    }
}

function renderizarMarcadores() {
    if (markersCluster) {
        markersCluster.clearLayers();
    } else if (map) {
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) map.removeLayer(layer);
        });
    }

    // Obter valores dos filtros
    const filtroNome = document.getElementById('filtro-mapa-nome')?.value.toLowerCase() || '';
    const filtroBairro = document.getElementById('filtro-mapa-bairro')?.value || '';
    const totalDisplay = document.getElementById('total-mapa-display');

    let count = 0;
    const markers = [];

    __mapa_funcionarios_cache.forEach(func => {
        // Aplica filtros
        if (filtroNome && !func.nome.toLowerCase().includes(filtroNome)) return;

        const bairroFunc = func.endereco?.bairro || 'Não Informado';
        if (filtroBairro && bairroFunc !== filtroBairro) return;

        if (func.endereco && func.endereco.latitude && func.endereco.longitude) {
            const lat = parseFloat(func.endereco.latitude);
            const lng = parseFloat(func.endereco.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng]);
                const popupContent = `<div style="min-width: 200px;"><h6 class="mb-1 fw-bold">${func.nome}</h6><p class="mb-0 small text-muted">${func.cargo || ''}</p><hr class="my-2"><p class="mb-1 small"><strong>Setor:</strong> ${func.setor || '-'}</p><p class="mb-1 small"><strong>Bairro:</strong> ${func.endereco.bairro || '-'}</p><p class="mb-0 small"><strong>Cidade:</strong> ${func.endereco.cidade || '-'}</p></div>`;
                marker.bindPopup(popupContent);
                markers.push(marker);
                count++;
            }
        }
    });

    if (markersCluster) {
        markersCluster.addLayers(markers);
        if (markers.length > 0) {
            map.fitBounds(markersCluster.getBounds());
        }
    } else {
        markers.forEach(m => m.addTo(map));
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds());
        }
    }

    if (totalDisplay) {
        totalDisplay.textContent = `Total: ${count}`;
    }
}

function atualizarFiltrosMapa() {
    const select = document.getElementById('filtro-mapa-bairro');
    if (!select) return;

    // Salva seleção atual
    const valorAtual = select.value;

    // Conta colaboradores por bairro
    const contagem = {};
    __mapa_funcionarios_cache.forEach(f => {
        const bairro = f.endereco?.bairro || 'Não Informado';
        contagem[bairro] = (contagem[bairro] || 0) + 1;
    });

    // Popula o select
    select.innerHTML = '<option value="">Todos os Bairros</option>';
    Object.keys(contagem).sort().forEach(bairro => {
        const option = document.createElement('option');
        option.value = bairro;
        option.textContent = `${bairro} (${contagem[bairro]})`;
        select.appendChild(option);
    });

    // Restaura seleção se ainda existir
    if (valorAtual && contagem[valorAtual]) {
        select.value = valorAtual;
    }
}

function filtrarMapaLocalmente() {
    renderizarMarcadores();
}

async function sincronizarGeolocalizacao() {
    if (!confirm("Isso irá verificar todos os funcionários ativos sem coordenadas e tentar buscar a localização baseada no endereço cadastrado.\n\nEsse processo pode demorar um pouco (aprox. 1 segundo por registro) para respeitar os limites da API gratuita.\n\nDeseja continuar?")) return;

    mostrarMensagem("Iniciando sincronização de geolocalização... Por favor, aguarde.", "info");

    try {
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').get();
        let atualizados = 0;
        let erros = 0;
        let ignorados = 0;
        let nomesComErro = [];

        const docs = snapshot.docs;

        // Função auxiliar para delay (promessa)
        const delay = ms => new Promise(res => setTimeout(res, ms));

        for (const doc of docs) {
            const func = doc.data();

            // Se já tem coordenadas, pula
            if (func.endereco && func.endereco.latitude && func.endereco.longitude) {
                continue;
            }

            // Se não tem endereço completo, pula
            if (!func.endereco || !func.endereco.logradouro || !func.endereco.cidade) {
                ignorados++;
                continue;
            }

            // Tenta geocodificar
            const coords = await geocodificarEndereco(func.endereco);

            if (coords) {
                // Atualiza no Firestore
                const novoEndereco = { ...func.endereco, latitude: coords.lat, longitude: coords.lng };
                await db.collection('funcionarios').doc(doc.id).update({
                    endereco: novoEndereco
                });
                atualizados++;
            } else {
                erros++;
                nomesComErro.push(func.nome); // Adiciona o nome à lista de erros
            }

            // Delay de 1.2s para respeitar limite do Nominatim (1 req/s)
            await delay(1200);
        }

        mostrarMensagem(`Sincronização concluída! Atualizados: ${atualizados}, Não encontrados: ${erros}, Sem endereço: ${ignorados}.`, "success");

        if (nomesComErro.length > 0) {
            alert("Não foi possível localizar o endereço para os seguintes colaboradores:\n\n" + nomesComErro.join("\n") + "\n\nVerifique se o endereço está correto e tente novamente.");
        }

        carregarMapaColaboradores();

    } catch (error) {
        console.error("Erro na sincronização:", error);
        mostrarMensagem("Erro ao sincronizar geolocalização.", "error");
    }
}

async function buscarEnderecoManual(btnElement) {
    const logradouro = document.getElementById('endereco-logradouro').value;
    const cidade = document.getElementById('endereco-cidade').value;
    const numero = document.getElementById('endereco-numero').value;

    if (!logradouro || !cidade) {
        alert("Por favor, preencha pelo menos o Logradouro e a Cidade para realizar a busca.");
        return;
    }

    // Feedback visual no botão
    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btnElement.disabled = true;

    // Monta a query de busca
    const query = `${logradouro}, ${numero || ''}, ${cidade}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;

    try {
        const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            const addr = result.address;

            // Formata o endereço encontrado para exibição
            const ruaEncontrada = addr.road || addr.pedestrian || addr.footway || logradouro;
            const bairroEncontrado = addr.suburb || addr.neighbourhood || addr.quarter || '';
            const cidadeEncontrada = addr.city || addr.town || addr.village || addr.municipality || cidade;

            const msg = `Endereço encontrado:\n\n` +
                        `Rua: ${ruaEncontrada}\n` +
                        `Bairro: ${bairroEncontrado}\n` +
                        `Cidade: ${cidadeEncontrada}\n` +
                        `CEP: ${addr.postcode || 'Não informado'}\n\n` +
                        `Deseja atualizar os campos com estes dados?`;

            if (confirm(msg)) {
                document.getElementById('endereco-logradouro').value = ruaEncontrada;
                if (bairroEncontrado) document.getElementById('endereco-bairro').value = bairroEncontrado;
                document.getElementById('endereco-cidade').value = cidadeEncontrada;
                if (addr.postcode) document.getElementById('endereco-cep').value = addr.postcode;

                // Salva as coordenadas encontradas
                document.getElementById('endereco-latitude').value = result.lat;
                document.getElementById('endereco-longitude').value = result.lon;
            }
        } else {
            alert("Endereço não encontrado na base de dados. Verifique se o nome da rua e cidade estão corretos.");
        }
    } catch (error) {
        console.error("Erro na busca manual:", error);
        alert("Ocorreu um erro ao buscar o endereço.");
    } finally {
        btnElement.innerHTML = originalContent;
        btnElement.disabled = false;
    }
}

// Exportar funções para uso global
window.initMap = initMap;
window.buscarCep = buscarCep;
window.geocodificarEndereco = geocodificarEndereco;
window.carregarMapaColaboradores = carregarMapaColaboradores;
window.sincronizarGeolocalizacao = sincronizarGeolocalizacao;
window.buscarEnderecoManual = buscarEnderecoManual;
window.filtrarMapaLocalmente = filtrarMapaLocalmente;

// Inicializa o mapa quando o DOM estiver pronto, se o elemento existir
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('mapa-colaboradores')) {
        initMap();
    }
});
