/**
 * NEXTER - View Loader System
 * Dynamically loads HTML views and modals to keep index.html clean.
 */

const ViewLoader = {
    // Registered views to be loaded
    views: [
        { id: 'sidebar', url: 'views/sidebar.html' },
        { id: 'header-container', url: 'views/header.html' }
    ],

    // Registered modals to be loaded at the bottom of the body
    modals: [
        { url: 'views/modal-empresa.html' },
        { url: 'views/modal-importar-empresas.html' },
        { url: 'views/modal-funcionario.html' },
        { url: 'views/modal-horas-extras-resultado.html' },
        { url: 'views/modal-horas-extras-ajuste.html' },
        { url: 'views/modal-horas-extras-solicitacao.html' },
        { url: 'views/modal-horas-extras-lote.html' },
        { url: 'views/modal-atualizar-funcionarios-excel.html' },
        { url: 'views/modal-importar-funcionarios-csv.html' },
        { url: 'views/modal-permissoes.html' },
        { url: 'views/modal-entrevista-demissional.html' },
        { url: 'views/modal-selecionar-colaborador-reposicao.html' },
        { url: 'views/modal-aumento-coletivo.html' },
        { url: 'views/modal-novo-usuario.html' },
        { url: 'views/modal-nova-reposicao.html' },
        { url: 'views/modal-nova-contratacao.html' },
        { url: 'views/modal-registro-disciplinar.html' },
        { url: 'views/modal-processo-juridico.html' },
        { url: 'views/modal-juridico-cliente.html' },
        { url: 'views/modal-evento-agenda.html' },
        { url: 'views/modal-analise-risco-ia.html' },
        { url: 'views/modal-rescisao.html' },
        { url: 'views/modal-aumento-salario.html' },
        { url: 'views/modal-frota-veiculo.html' },
        { url: 'views/modal-frota-motorista.html' },
        { url: 'views/modal-frota-saida.html' },
        { url: 'views/modal-frota-retorno.html' },
        { url: 'views/modal-frota-destino.html' },
        { url: 'views/modal-horas-extras-assinatura.html' },
        { url: 'views/modal-setor.html' },
        { url: 'views/modal-novo-setor.html' },
        { url: 'views/modal-treinamento-novo.html' },
        { url: 'views/modal-treinamento-prova.html' },
        { url: 'views/modal-avaliacao-experiencia.html' },
        { url: 'views/modal-avaliacao-experiencia-atribuicao.html' },
        { url: 'views/modal-biometria-selecao.html' },
        { url: 'views/modal-login-manutencao.html' },
        { url: 'views/modal-acompanhamento-psico.html' },
        { url: 'views/modal-novo-epi.html' },
        { url: 'views/modal-entrada-estoque.html' },
        { url: 'views/ai-chat.html' }
    ],

    /**
     * Initialize the loader
     */
    async init() {
        console.log("🚀 Initializing ViewLoader...");

        // Load main views into their containers
        const viewPromises = this.views.map(view => this.loadView(view.id, view.url));

        // Load modals into a dynamic container
        const modalsContainer = document.createElement('div');
        modalsContainer.id = 'dynamic-modals-container';
        document.body.appendChild(modalsContainer);

        const modalPromises = this.modals.map(modal => this.loadInto(modalsContainer, modal.url));

        await Promise.all([...viewPromises, ...modalPromises]);
        console.log("✅ All views and modals loaded.");

        // Trigger a custom event for other scripts to know we are ready
        document.dispatchEvent(new CustomEvent('viewsLoaded'));
    },

    /**
     * Load an HTML file into a specific container by ID
     */
    async loadView(containerId, url) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`⚠️ Container #${containerId} not found for ${url}`);
            return;
        }
        return this.loadInto(container, url);
    },

    /**
     * Fetch and inject HTML into an element
     */
    async loadInto(container, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();

            // We use insertAdjacentHTML to keep any existing content or avoid overwriting if needed
            container.insertAdjacentHTML('beforeend', html);
        } catch (error) {
            console.error(`❌ Failed to load ${url}:`, error);
        }
    }
};

// Start loading when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ViewLoader.init());
} else {
    ViewLoader.init();
}
