/**
 * Módulo: Configurações de Fluxos (Atribuições)
 * Centraliza o gerenciamento de usuários responsáveis por tarefas automatizadas.
 */
window.configFluxos = (function () {

    const CONFIG_DOC = 'configuracoes/atribuicoes_automaticas';

    async function inicializarTela() {
        if (!window.currentUserPermissions?.isAdmin) {
            document.querySelector('.app-container').innerHTML = '<div class="alert alert-danger m-4">Acesso negado. Apenas administradores podem configurar fluxos.</div>';
            return;
        }
        await popularSelects();
        await carregarConfiguracoes();
    }

    async function popularSelects() {
        const selAcerto = document.getElementById('config-acerto-responsavel');
        const selPsico = document.getElementById('config-psicossocial-responsavel');
        
        try {
            const snap = await db.collection('usuarios').orderBy('nome').get();
            let optionsHTML = '<option value="">— Selecione o responsável —</option>';
            snap.forEach(doc => {
                const data = doc.data();
                const nome = data.nome || data.email || doc.id;
                optionsHTML += `<option value="${doc.id}">${nome}</option>`;
            });

            if (selAcerto) selAcerto.innerHTML = optionsHTML;
            if (selPsico) selPsico.innerHTML = optionsHTML;
        } catch (e) {
            console.error('Erro ao carregar usuários:', e);
            if (selAcerto) selAcerto.innerHTML = '<option value="">Erro ao carregar</option>';
            if (selPsico) selPsico.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    async function carregarConfiguracoes() {
        try {
            const snap = await db.doc(CONFIG_DOC).get();
            if (snap.exists) {
                const cfg = snap.data();
                
                const selAcerto = document.getElementById('config-acerto-responsavel');
                if (selAcerto && cfg.acertoRescisorioId) {
                    selAcerto.value = cfg.acertoRescisorioId;
                }

                const selPsico = document.getElementById('config-psicossocial-responsavel');
                if (selPsico && cfg.psicossocialId) {
                    selPsico.value = cfg.psicossocialId;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar configurações de fluxos:', e);
        }
    }

    async function salvarConfiguracoes() {
        const btn = document.getElementById('btn-salvar-config-fluxos');
        const feedback = document.getElementById('config-fluxos-feedback');
        const selAcerto = document.getElementById('config-acerto-responsavel');
        const selPsico = document.getElementById('config-psicossocial-responsavel');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Salvando...';
        feedback.innerHTML = '';

        try {
            const configData = {
                acertoRescisorioId: selAcerto.value || null,
                acertoRescisorioNome: selAcerto.value ? selAcerto.options[selAcerto.selectedIndex].text : null,
                
                psicossocialId: selPsico.value || null,
                psicossocialNome: selPsico.value ? selPsico.options[selPsico.selectedIndex].text : null,

                atualizadoPor: window.currentUser?.uid || 'sistema',
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.doc(CONFIG_DOC).set(configData, { merge: true });

            feedback.innerHTML = '<span class="text-success small fw-bold"><i class="fas fa-check-circle me-1"></i>Configurações salvas com sucesso!</span>';
            setTimeout(() => { feedback.innerHTML = ''; }, 4000);

        } catch (e) {
            console.error('Erro ao salvar configurações:', e);
            feedback.innerHTML = '<span class="text-danger small fw-bold"><i class="fas fa-times-circle me-1"></i>Erro ao salvar. Tente novamente.</span>';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Todas as Configurações';
        }
    }

    // Helper global para outros scripts buscarem configurações de fluxo rapidamente
    async function getConfiguracao(chaveFluxo) {
        try {
            const snap = await db.doc(CONFIG_DOC).get();
            if (snap.exists) {
                return snap.data()[chaveFluxo] || null;
            }
        } catch (e) {
            console.error('Erro ao buscar configuração de fluxo:', e);
        }
        return null;
    }

    return { inicializarTela, salvarConfiguracoes, getConfiguracao };

})();
