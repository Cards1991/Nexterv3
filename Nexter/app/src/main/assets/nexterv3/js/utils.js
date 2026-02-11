// js/utils.js

/**
 * Exibe uma mensagem de feedback para o usuário.
 * @param {string} mensagem O texto a ser exibido.
 * @param {string} tipo 'success', 'error', 'warning', ou 'info'.
 */
function mostrarMensagem(mensagem, tipo = 'success') {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-success';

    const toastContainer = document.body;
    const toast = document.createElement('div');
    toast.className = `alert ${alertClass} alert-dismissible fade show`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    toast.innerHTML = `${mensagem}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

/**
 * Abre uma nova janela para impressão com o conteúdo fornecido.
 * @param {string} content O conteúdo HTML a ser impresso.
 * @param {object} options Opções para a janela de impressão.
 */
function openPrintWindow(content, options = {}) {
    const win = window.open('', options.name || '_blank');
    if (!win) {
        mostrarMensagem('Permita pop-ups para imprimir o relatório', 'warning');
        return;
    }
    
    // Adiciona o meta charset UTF-8 ao conteúdo para garantir a correta exibição de caracteres especiais
    const completeHtml = `
        <!DOCTYPE html><html><head><meta charset="UTF-8">${content.includes('<head>') ? '' : '<title>Impressão</title>'}</head><body>${content}</body></html>
    `;

    win.document.write(completeHtml);
    win.document.close();
    
    if (options.autoPrint) {
        win.focus();
        setTimeout(() => {
            win.print();
            if (options.closeAfterPrint) {
                win.close();
            }
        }, 500);
    }
}

function formatarData(data) {
    if (!data) return '—';
    const dataObj = data?.toDate ? data.toDate() : 
                   (data instanceof Date ? data : new Date(data));
    return dataObj.toLocaleDateString('pt-BR');
}

/**
 * Formata um número de telefone para o padrão do WhatsApp (55 + DDD + Número).
 * @param {string} numero O número de telefone.
 * @returns {string} O número formatado.
 */
function formatarTelefoneWhatsApp(numero) {
    if (!numero) return '';
    let telefone = numero.replace(/[^\d+]/g, '');
    if (!telefone.startsWith('+')) telefone = '55' + telefone.replace(/^0+/, '');
    return telefone;
}