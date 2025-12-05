// Este script simula o carregamento de variáveis de ambiente de um arquivo .env.local
// para o ambiente de desenvolvimento local. NÃO USE EM PRODUÇÃO.

(async function loadEnv() {
    // Só executa em ambiente local (ex: localhost, 127.0.0.1)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    try {
        const response = await fetch('/.env.local');
        if (!response.ok) {
            console.warn('.env.local não encontrado. As chaves do Firebase podem não carregar.');
            return;
        }

        const text = await response.text();
        const lines = text.split('\n');

        window.process = window.process || { env: {} };

        lines.forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                window.process.env[key.trim()] = value.trim();
            }
        });
    } catch (error) {
        console.error('Erro ao carregar .env.local:', error);
    }
})();