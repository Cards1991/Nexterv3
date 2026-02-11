// js/body-map-3d.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CID_TO_BODY_REGION } from './cid-map.js';

let scene, camera, renderer, controls, raycaster, mouse;
let bodyModel = null;
let tooltip;
let regionData = {}; // Armazena contagem por região
let totalAtestados = 0;
let labelContainer;
let activeLabels = [];

// Cores do Heatmap
const COLORS = {
    NEUTRAL: 0xe9ecef, // Cinza claro (sem dados)
    LOW: 0x28a745,     // Verde (Baixa incidência)
    MEDIUM: 0xffc107,  // Amarelo (Média incidência)
    HIGH: 0xdc3545,    // Vermelho (Alta incidência)
    HOVER: 0x0d6efd    // Azul (Hover)
};

export function initBodyMap3D(containerId, atestadosData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Limpar container anterior se houver (para evitar múltiplos canvas)
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Configura container para posicionamento relativo (para as etiquetas absolutas funcionarem)
    container.style.position = 'relative';
    
    // Container para as etiquetas (labels)
    labelContainer = document.createElement('div');
    labelContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: 10;';
    container.appendChild(labelContainer);

    // 1. Setup Básico Three.js
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // Fundo branco minimalista

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.5); // Posição inicial frontal

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 2. Iluminação (Neutra e Suave)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 2, 5);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, 2, -5);
    scene.add(backLight);

    // 3. Controles (Orbit)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI / 1.5; // Limita rotação vertical (não ver por baixo)
    controls.target.set(0, 0.9, 0); // Foca no centro do corpo

    // 4. Raycaster para Interação
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    tooltip = document.getElementById('body-map-tooltip');

    // 5. Processar Dados
    processarDados(atestadosData);

    // 6. Carregar Modelo 3D
    const loader = new GLTFLoader();
    // Usando um placeholder path. O usuário deve colocar o arquivo .glb na pasta assets/models/
    loader.load('assets/models/human_body.glb', (gltf) => {
        bodyModel = gltf.scene;
        
        // Ajustes iniciais do modelo
        bodyModel.scale.set(1, 1, 1);
        bodyModel.position.set(0, 0, 0);

        // Aplicar materiais e cores iniciais
        bodyModel.traverse((child) => {
            if (child.isMesh) {
                // Material base fosco e limpo
                child.material = new THREE.MeshStandardMaterial({
                    color: COLORS.NEUTRAL,
                    roughness: 0.5,
                    metalness: 0.1
                });
                
                // Salva a cor original para hover
                child.userData.originalColor = COLORS.NEUTRAL;
                child.userData.regionName = child.name; // Assume que o nome da mesh é a região

                // Aplica cor baseada nos dados
                aplicarCorRegiao(child);
            }
        });

        scene.add(bodyModel);
        criarEtiquetas(); // Cria as etiquetas após carregar
        animate();

    }, undefined, (error) => {
        console.warn('Modelo 3D externo não encontrado (404). Carregando modelo geométrico de fallback.');
        criarModeloFallback();
    });

    // Event Listeners
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);
}

function criarModeloFallback() {
    bodyModel = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: COLORS.NEUTRAL, roughness: 0.5 });

    // Função auxiliar para criar partes
    const createPart = (geo, name, x, y, z) => {
        const mesh = new THREE.Mesh(geo, material.clone());
        mesh.name = name;
        mesh.position.set(x, y, z);
        mesh.userData.originalColor = COLORS.NEUTRAL;
        mesh.userData.regionName = name;
        aplicarCorRegiao(mesh);
        bodyModel.add(mesh);
    };

    // Cabeça
    createPart(new THREE.SphereGeometry(0.25, 32, 32), 'Head', 0, 1.75, 0);

    // Pescoço (Cervical) - Adicionado para garantir que dados desta região apareçam
    createPart(new THREE.CylinderGeometry(0.12, 0.12, 0.2), 'Spine_Cervical', 0, 1.55, 0);
    
    // Tronco (Coluna)
    createPart(new THREE.BoxGeometry(0.6, 0.9, 0.3), 'Spine_Lumbar', 0, 1.05, 0);
    
    // Ombro Direito
    createPart(new THREE.SphereGeometry(0.15), 'Shoulder_R', -0.4, 1.45, 0);
    // Ombro Esquerdo
    createPart(new THREE.SphereGeometry(0.15), 'Shoulder_L', 0.4, 1.45, 0);

    // Braço Direito
    createPart(new THREE.CylinderGeometry(0.1, 0.1, 0.7), 'Arm_R', -0.5, 1.1, 0);
    // Braço Esquerdo
    createPart(new THREE.CylinderGeometry(0.1, 0.1, 0.7), 'Arm_L', 0.5, 1.1, 0);

    // Quadril
    createPart(new THREE.BoxGeometry(0.65, 0.3, 0.35), 'Hips', 0, 0.5, 0);

    // Perna Direita (Coxa + Joelho)
    createPart(new THREE.CylinderGeometry(0.13, 0.1, 0.8), 'Knee_R', -0.2, 0.0, 0);
    // Perna Esquerda
    createPart(new THREE.CylinderGeometry(0.13, 0.1, 0.8), 'Knee_L', 0.2, 0.0, 0);

    // Pé Direito (Tornozelo)
    createPart(new THREE.BoxGeometry(0.2, 0.1, 0.4), 'Ankle_R', -0.2, -0.45, 0.1);
    // Pé Esquerdo
    createPart(new THREE.BoxGeometry(0.2, 0.1, 0.4), 'Ankle_L', 0.2, -0.45, 0.1);

    scene.add(bodyModel);
    criarModeloFallbackLabels(); // Cria etiquetas específicas para o fallback
    
    // Adiciona um texto informativo na cena
    const container = renderer.domElement.parentElement;
    const msg = document.createElement('div');
    msg.style.position = 'absolute';
    msg.style.top = '10px';
    msg.style.left = '10px';
    msg.innerHTML = '<small class="text-muted">Modelo simplificado (arquivo .glb não encontrado)</small>';
    container.appendChild(msg);

    animate();
}

function criarModeloFallbackLabels() {
    // Pequeno delay para garantir que a geometria esteja pronta
    setTimeout(criarEtiquetas, 100);
}

function processarDados(atestados) {
    regionData = {};
    totalAtestados = atestados.length;

    atestados.forEach(atestado => {
        const cid = (atestado.cid || '').toUpperCase().trim();
        // Busca a região baseada no prefixo do CID
        let region = null;
        
        // Tenta match exato ou por prefixo
        for (const [key, value] of Object.entries(CID_TO_BODY_REGION)) {
            if (cid.startsWith(key)) {
                region = value;
                // Se encontrar um match mais específico (ex: M54.5 vs M54), continua buscando? 
                // Aqui assumimos que a ordem no objeto ou especificidade define. 
                // Para simplicidade, pegamos o primeiro match ou o mais longo.
            }
        }

        if (region) {
            if (!regionData[region]) {
                regionData[region] = { count: 0, cids: {} };
            }
            regionData[region].count++;
            regionData[region].cids[cid] = (regionData[region].cids[cid] || 0) + 1;
        }
    });
}

function aplicarCorRegiao(mesh) {
    const regionName = mesh.name;
    const data = regionData[regionName];

    if (data && data.count > 0) {
        let colorHex = COLORS.LOW;
        if (data.count > 5) colorHex = COLORS.MEDIUM;
        if (data.count > 15) colorHex = COLORS.HIGH;

        mesh.material.color.setHex(colorHex);
        mesh.userData.originalColor = colorHex;
        mesh.userData.hasData = true;
        mesh.userData.info = data;
    }
}

function onMouseMove(event) {
    // Calcula posição do mouse normalizada (-1 a +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycasting
    raycaster.setFromCamera(mouse, camera);
    
    if (bodyModel) {
        const intersects = raycaster.intersectObjects(bodyModel.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            // Highlight
            if (object.material) {
                // Restaura cor de todos (simples) ou gerencia estado
                bodyModel.traverse((child) => {
                    if (child.isMesh && child.userData.originalColor) {
                        child.material.color.setHex(child.userData.originalColor);
                    }
                });
                
                // Cor de hover
                object.material.color.setHex(COLORS.HOVER);
                
                // Tooltip
                showTooltip(event, object);
            }
            renderer.domElement.style.cursor = 'pointer';
        } else {
            // Reset
            bodyModel.traverse((child) => {
                if (child.isMesh && child.userData.originalColor) {
                    child.material.color.setHex(child.userData.originalColor);
                }
            });
            hideTooltip();
            renderer.domElement.style.cursor = 'default';
        }
    }
}

function showTooltip(event, object) {
    if (!tooltip) return;
    
    const regionName = object.name;
    const data = object.userData.info;
    
    let content = `<strong>Região: ${regionName}</strong>`;
    
    if (data) {
        content += `<br>Incidência: ${data.count}`;
        // Top CIDs
        const topCids = Object.entries(data.cids)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cid, qtd]) => `${cid} (${qtd})`)
            .join(', ');
        content += `<br><small>Top CIDs: ${topCids}</small>`;
    } else {
        content += `<br><span class="text-muted">Sem registros</span>`;
    }

    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
}

function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
}

function onWindowResize() {
    if (!camera || !renderer || !renderer.domElement.parentElement) return;
    const container = renderer.domElement.parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function criarEtiquetas() {
    if (!labelContainer || !bodyModel) return;
    
    labelContainer.innerHTML = '';
    activeLabels = [];

    // Itera sobre os dados processados para criar etiquetas onde houver incidência
    for (const [region, data] of Object.entries(regionData)) {
        if (data.count > 0) {
            // Encontra o objeto 3D correspondente
            let targetObject = null;
            bodyModel.traverse(child => {
                if (child.name === region || child.userData.regionName === region) {
                    targetObject = child;
                }
            });

            if (targetObject) {
                const percent = totalAtestados > 0 ? ((data.count / totalAtestados) * 100).toFixed(1) : 0;
                
                // Determina o lado da etiqueta baseado na região (Esquerda/Direita na tela)
                // _R (Right Body) fica na Esquerda da tela (-X)
                // _L (Left Body) fica na Direita da tela (+X)
                const isLeftSideScreen = region.includes('_R'); 
                
                // Configuração de estilo baseada no lado
                let transform = 'translate(30px, -50%)'; // Padrão: Lado Direito
                let lineStyle = 'left: -30px; width: 30px;';
                let dotStyle = 'left: -30px; transform: translate(-50%, -50%);';
                
                if (isLeftSideScreen) {
                    transform = 'translate(calc(-100% - 30px), -50%)'; // Lado Esquerdo
                    lineStyle = 'right: -30px; width: 30px;';
                    dotStyle = 'right: -30px; transform: translate(50%, -50%);';
                }

                const labelDiv = document.createElement('div');
                labelDiv.className = 'body-3d-label';
                labelDiv.style.cssText = `
                    position: absolute;
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid #999;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    pointer-events: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                    transform: ${transform};
                    white-space: nowrap;
                    z-index: 100;
                `;
                
                // Conteúdo da etiqueta com linha conectora (seta)
                labelDiv.innerHTML = `
                    <div style="position: absolute; top: 50%; height: 1px; background: #666; ${lineStyle}"></div>
                    <div style="position: absolute; top: 50%; width: 5px; height: 5px; background: #333; border-radius: 50%; ${dotStyle}"></div>
                    <div style="font-weight:bold; color:#333; border-bottom: 1px solid #eee; margin-bottom: 2px;">${traduzirRegiao(region)}</div>
                    <div style="color:#${COLORS.HIGH.toString(16)}; font-weight:bold; font-size: 12px;">
                        ${percent}% <span style="font-weight:normal; color:#666; font-size: 10px;">(${data.count})</span>
                    </div>
                `;

                labelContainer.appendChild(labelDiv);
                activeLabels.push({ element: labelDiv, object: targetObject });
            }
        }
    }
}

function updateLabelsPosition() {
    if (!activeLabels.length || !camera) return;

    const tempV = new THREE.Vector3();
    const canvas = renderer.domElement;

    activeLabels.forEach(item => {
        // Obtém o centro do objeto
        if (item.object.geometry) {
            item.object.geometry.computeBoundingBox();
            item.object.geometry.boundingBox.getCenter(tempV);
            item.object.localToWorld(tempV);
        } else {
            item.object.getWorldPosition(tempV);
        }

        // Projeta para coordenadas de tela
        tempV.project(camera);

        const x = (tempV.x * .5 + .5) * canvas.clientWidth;
        const y = (tempV.y * -.5 + .5) * canvas.clientHeight;

        // Oculta se estiver atrás da câmera
        if (tempV.z > 1) {
            item.element.style.display = 'none';
        } else {
            item.element.style.display = 'block';
            item.element.style.left = `${x}px`;
            item.element.style.top = `${y}px`;
        }
    });
}

function traduzirRegiao(part) {
    const map = {
        'Head': 'Cabeça',
        'Spine_Cervical': 'Cervical',
        'Spine_Lumbar': 'Lombar/Costas',
        'Shoulder_R': 'Ombro Dir.',
        'Shoulder_L': 'Ombro Esq.',
        'Arm_R': 'Braço Dir.',
        'Arm_L': 'Braço Esq.',
        'Hips': 'Quadril',
        'Knee_R': 'Joelho Dir.',
        'Knee_L': 'Joelho Esq.',
        'Ankle_R': 'Tornozelo Dir.',
        'Ankle_L': 'Tornozelo Esq.'
    };
    return map[part] || part;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateLabelsPosition(); // Atualiza posição das etiquetas
    renderer.render(scene, camera);
}

// Expor para o escopo global para ser chamado pelo script legado
window.initBodyMap3D = initBodyMap3D;