/**
 * NEXTER - Logica para QR Code de Manutencao
 */
document.addEventListener('viewsLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    // Verifica se veio pelo QR Code (ex: ?action=manutencao&maquina=123)
    if (urlParams.get('action') === 'manutencao' || urlParams.has('maquina')) {
        const modalLogin = new bootstrap.Modal(document.getElementById('modalLoginManutencao'));
        modalLogin.show();

        document.getElementById('form-login-manutencao').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-manutencao-email').value;
            const senha = document.getElementById('login-manutencao-senha').value;
            const erroDiv = document.getElementById('login-manutencao-erro');
            const btnSubmit = e.target.querySelector('button[type="submit"]');

            try {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
                erroDiv.classList.add('d-none');

                await firebase.auth().signInWithEmailAndPassword(email, senha);

                modalLogin.hide();

                // Redireciona para a seção de manutenção
                if (typeof showSection === 'function') {
                    showSection('iso-manutencao');
                }

                // Abre o modal de novo chamado se necessário
                setTimeout(() => {
                    const btnNovo = document.getElementById('btn-novo-chamado-manutencao');
                    if (btnNovo) btnNovo.click();
                }, 500);

            } catch (error) {
                console.error("Erro login manutenção:", error);
                erroDiv.textContent = "Falha na autenticação. Verifique suas credenciais.";
                erroDiv.classList.remove('d-none');
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = 'Entrar';
            }
        });
    }
});
