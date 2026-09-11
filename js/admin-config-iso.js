// js/admin-config-iso.js

const modulosDisponiveis = [
    { id: 'rh', nome: 'Recursos Humanos', icone: 'fa-users' },
    { id: 'dp', nome: 'Departamento Pessoal', icone: 'fa-user-tie' },
    { id: 'sesmt', nome: 'SESMT (Saúde e Segurança)', icone: 'fa-heart-pulse' },
    { id: 'producao', nome: 'Controle de Produção', icone: 'fa-industry' },
    { id: 'manutencao', nome: 'Manutenção', icone: 'fa-tools' },
    { id: 'logistica', nome: 'Logística', icone: 'fa-truck' },
    { id: 'juridico', nome: 'Jurídico', icone: 'fa-gavel' },
    { id: 'controladoria', nome: 'Controladoria', icone: 'fa-calculator' }
];

async function inicializarAdminConfigIso() {
    const container = document.getElementById('container-config-iso');
    if (!container) return;
    
    container.innerHTML = '<div class="col-12 text-center p-5 text-muted"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><br>Carregando configurações...</div>';
    
    try {
        const doc = await db.collection('configuracoes_sistema').doc('iso9001_modulos').get();
        let configAtual = {};
        if (doc.exists) {
            configAtual = doc.data();
        }
        
        // Armazenar config globalmente para fácil acesso
        window.iso9001ModulosConfig = configAtual;

        renderizarConfiguracoesIso(configAtual);
    } catch (error) {
        console.error("Erro ao carregar configurações da ISO:", error);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar as configurações. Verifique sua conexão.</div>';
    }
}

function renderizarConfiguracoesIso(configAtual) {
    const container = document.getElementById('container-config-iso');
    if (!container) return;
    container.innerHTML = '';
    
    modulosDisponiveis.forEach(modulo => {
        const isChecked = configAtual[modulo.id] === true;
        
        const cardHtml = `
            <div class="col-md-6 col-lg-4 col-xl-3">
                <div class="card h-100 border rounded-4 shadow-sm transition-hover cursor-pointer" onclick="toggleCheckboxIso('${modulo.id}')">
                    <div class="card-body p-4 d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-3">
                            <div class="bg-light d-flex align-items-center justify-content-center rounded-circle text-primary" style="width: 48px; height: 48px; font-size: 1.2rem;">
                                <i class="fas ${modulo.icone}"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">${modulo.nome}</h6>
                        </div>
                        <div class="form-check form-switch m-0 p-0 d-flex align-items-center" onclick="event.stopPropagation()">
                            <input class="form-check-input ms-0" type="checkbox" role="switch" id="switch-iso-${modulo.id}" ${isChecked ? 'checked' : ''} style="width: 3rem; height: 1.5rem; cursor: pointer; margin-top: 0;">
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function toggleCheckboxIso(moduloId) {
    const checkbox = document.getElementById(`switch-iso-${moduloId}`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
    }
}

async function salvarConfiguracoesISO() {
    const btn = document.querySelector('button[onclick="salvarConfiguracoesISO()"]');
    const conteudoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    const novaConfig = {};
    
    modulosDisponiveis.forEach(modulo => {
        const checkbox = document.getElementById(`switch-iso-${modulo.id}`);
        if (checkbox) {
            novaConfig[modulo.id] = checkbox.checked;
        }
    });
    
    try {
        await db.collection('configuracoes_sistema').doc('iso9001_modulos').set(novaConfig, { merge: true });
        window.iso9001ModulosConfig = novaConfig;
        
        // Atualizar menu lateral imediatamente
        if (typeof window.renderizarMenuEscopoIso === 'function') {
            window.renderizarMenuEscopoIso();
        }
        
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem("Configurações da ISO salvas com sucesso!", "success");
        } else {
            alert("Configurações da ISO salvas com sucesso!");
        }
    } catch (error) {
        console.error("Erro ao salvar configurações da ISO:", error);
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem("Erro ao salvar configurações.", "error");
        } else {
            alert("Erro ao salvar configurações.");
        }
    } finally {
        btn.innerHTML = conteudoOriginal;
        btn.disabled = false;
    }
}


