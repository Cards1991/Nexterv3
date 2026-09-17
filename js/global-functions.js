// Global Functions - Dedicated to utilities that don't belong to a specific module
// Specific module functions are now exposed in their respective files.

// Verifica de forma global se um módulo fornece informações para a ISO 9001
window.isModuloDaIso = async function(moduloId) {
    if (window.iso9001ModulosConfig && window.iso9001ModulosConfig[moduloId] !== undefined) {
        return window.iso9001ModulosConfig[moduloId];
    }
    
    try {
        const doc = await db.collection('configuracoes_sistema').doc('iso9001_modulos').get();
        if (doc.exists) {
            window.iso9001ModulosConfig = doc.data();
            return window.iso9001ModulosConfig[moduloId] === true;
        }
        return false;
    } catch (e) {
        console.error("Erro ao verificar config da ISO", e);
        return false;
    }
};

// Renderiza o menu Escopo dinamicamente na Sidebar com base nos módulos ativos
window.renderizarMenuEscopoIso = async function() {
    const container = document.getElementById('dynamic-iso-escopo');
    const btnEscopo = document.getElementById('btn-escopo-iso');
    if (!container || !btnEscopo) {
        console.error("ISO: container ou btnEscopo não encontrados. container:", !!container, "btnEscopo:", !!btnEscopo);
        return;
    }

    let configAtual = window.iso9001ModulosConfig;
    if (!configAtual) {
        try {
            const doc = await db.collection('configuracoes_sistema').doc('iso9001_modulos').get();
            if (doc.exists) {
                configAtual = doc.data();
                window.iso9001ModulosConfig = configAtual;
            } else {
                configAtual = {};
            }
        } catch (e) {
            console.error("Erro ao carregar config da ISO para o menu", e);
            return;
        }
    }

    const modulosNomes = {
        'rh': 'Recursos Humanos',
        'dp': 'Departamento Pessoal',
        'sesmt': 'SESMT',
        'producao': 'Produção',
        'manutencao': 'Manutenção',
        'logistica': 'Logística',
        'juridico': 'Jurídico',
        'controladoria': 'Controladoria'
    };

    let html = '';
    let temModulo = false;

    console.log("ISO: Renderizando menu escopo com a config:", configAtual);

    for (const [id, nome] of Object.entries(modulosNomes)) {
        if (configAtual[id] === true) {
            temModulo = true;
            console.log("ISO: Módulo ativo encontrado:", id);
            html += `
                <li class="nav-item">
                    <a class="nav-link collapsed d-flex align-items-center justify-content-start gap-2 ms-3 text-muted"
                        href="#escopo${id}Submenu" data-bs-toggle="collapse" role="button" aria-expanded="false" style="font-size: 0.9rem;">
                        <i class="fas fa-angle-right"></i> ${nome}
                    </a>
                    <div class="collapse" id="escopo${id}Submenu">
                        <ul class="nav flex-column ms-4" style="border-left: 1px solid #dee2e6;">
                            <li class="nav-item"><a class="nav-link submenu-link py-1" href="#" onclick="window.currentIsoModule = '${id}'; window.currentIsoModuleName = '${nome}'; event.preventDefault(); showSection('iso-indicadores');" style="font-size: 0.85rem;"><i class="fas fa-chart-bar me-1"></i> Indicadores</a></li>
                            <li class="nav-item"><a class="nav-link submenu-link py-1" href="#" onclick="window.currentIsoModule = '${id}'; window.currentIsoModuleName = '${nome}'; event.preventDefault(); showSection('iso-evidencias');" style="font-size: 0.85rem;"><i class="fas fa-folder-open me-1"></i> Evidências</a></li>
                        </ul>
                    </div>
                </li>
            `;
        }
    }

    container.innerHTML = html;
    
    if (temModulo) {
        btnEscopo.style.display = 'flex';
        // Garantir que a tag <li> pai também fique visível (pois o app.js esconde todos os .nav-item)
        if (btnEscopo.parentElement) {
            btnEscopo.parentElement.style.display = 'block';
        }
    } else {
        btnEscopo.style.display = 'none';
        if (btnEscopo.parentElement) {
            btnEscopo.parentElement.style.display = 'none';
        }
    }
};

// ============================
// 🏖️ VERIFICADOR DE FÉRIAS
// ============================
// Expõe globalmente para que o app.js possa chamá-la ao iniciar
window.verificarFeriasAtivas = async function() {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const snapshot = await db.collection('ferias')
            .where('status', '==', 'Ativa')
            .where('tipo', '==', 'Férias em Casa')
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        let contagem = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            if (data.dataFim < hoje) {
                // Férias no passado: Voltar funcionário para 'Normal' se estiver em 'Férias'
                const funcRef = db.collection('funcionarios').doc(data.funcionarioId);
                const funcDoc = await funcRef.get();
                if (funcDoc.exists && funcDoc.data().condicao === 'Férias') {
                    batch.update(funcRef, { condicao: 'Normal' });
                    contagem++;
                }

                batch.update(doc.ref, { status: 'Concluída' });
            } else if (data.dataInicio <= hoje && data.dataFim >= hoje) {
                // Férias em andamento agora: Garantir que ele está de 'Férias'
                const funcRef = db.collection('funcionarios').doc(data.funcionarioId);
                const funcDoc = await funcRef.get();
                if (funcDoc.exists && funcDoc.data().condicao !== 'Férias') {
                    batch.update(funcRef, { condicao: 'Férias' });
                    contagem++;
                }
            }
        }

        if (contagem > 0) {
            await batch.commit();
            console.log(`Verificador de Férias: ${contagem} status de colaboradores atualizados.`);
        }
    } catch (error) {
        console.error("Erro ao verificar férias ativas:", error);
    }
};
