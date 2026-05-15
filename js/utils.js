// =============================================================
// utils.js — Utilitários Globais do Nexter
// Carregado por páginas standalone (ex: manutencao-mobile.html)
// =============================================================

/**
 * Exibe uma mensagem de alerta flutuante no topo da página.
 * Compatível com o padrão do módulo mobile (feedback-container).
 */
function mostrarMensagem(mensagem, tipo = 'info') {
    // Tenta usar o container do mobile, senão o principal
    const container =
        document.getElementById('feedback-container') ||
        document.getElementById('toast-container') ||
        document.body;

    const alertId = `alert-${Date.now()}`;
    const tipoBootstrap = tipo === 'error' ? 'danger' : tipo;

    const alertHtml = `
        <div id="${alertId}" class="alert alert-${tipoBootstrap} alert-dismissible fade show shadow-sm" role="alert"
             style="min-width:260px; max-width:400px; font-size:0.9rem;">
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
        </div>`;

    if (container === document.body) {
        // Cria um container fixo se não existir
        let fc = document.getElementById('__utils-feedback');
        if (!fc) {
            fc = document.createElement('div');
            fc.id = '__utils-feedback';
            fc.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;';
            document.body.appendChild(fc);
        }
        fc.insertAdjacentHTML('beforeend', alertHtml);
        setTimeout(() => {
            const el = document.getElementById(alertId);
            if (el && window.bootstrap) bootstrap.Alert.getOrCreateInstance(el).close();
            else if (el) el.remove();
        }, 5000);
    } else {
        container.insertAdjacentHTML('beforeend', alertHtml);
        setTimeout(() => {
            const el = document.getElementById(alertId);
            if (el && window.bootstrap) bootstrap.Alert.getOrCreateInstance(el).close();
            else if (el) el.remove();
        }, 5000);
    }
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão BR (DD/MM/YYYY).
 */
function formatarDataBR(dataISO) {
    if (!dataISO) return '—';
    return dataISO.split('-').reverse().join('/');
}

/**
 * Retorna a data de hoje no formato ISO (YYYY-MM-DD).
 */
function hojeISO() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Capitaliza a primeira letra de uma string.
 */
function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Gera um ID aleatório simples.
 */
function gerarId(prefixo = 'ID') {
    return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Exporta para escopo global
window.mostrarMensagem = mostrarMensagem;
window.formatarDataBR = formatarDataBR;
window.hojeISO = hojeISO;
window.capitalizar = capitalizar;
window.gerarId = gerarId;

console.log('[utils.js] Utilitários carregados.');
