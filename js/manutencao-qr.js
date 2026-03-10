/**
 * NEXTER - Logica para QR Code de Manutencao
 */

// Versão melhorada que funciona tanto com viewsLoaded quanto diretamente
(function() {
    // Função principal para processar QR Code
    function processarQRCodeManutencao() {
        const urlParams = new URLSearchParams(window.location.search);
        const maquinaId = urlParams.get('maquina');
        
        // Verifica se veio pelo QR Code
        if (maquinaId) {
            console.log("QR Code detectado para máquina:", maquinaId);
            
            // Redireciona para a página mobile com o ID da máquina
            window.location.href = `manutencao-mobile.html?maquinaId=${maquinaId}`;
            return true;
        }
        return false;
    }

    // Tenta processar imediatamente
    if (!processarQRCodeManutencao()) {
        // Se não processou, configura listener para quando as views carregarem
        document.addEventListener('viewsLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            // Verifica se veio pelo QR Code (ex: ?action=manutencao&maquina=123)
            if (urlParams.get('action') === 'manutencao' || urlParams.has('maquina')) {
                const modalLogin = new bootstrap.Modal(document.getElementById('modalLoginManutencao'));
                modalLogin.show();

                // Remove listeners antigos para evitar duplicação
                const formLogin = document.getElementById('form-login-manutencao');
                const novoListener = async (e) => {
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

                        // Redireciona para a seção de manutenção com o ID da máquina
                        const maquinaId = urlParams.get('maquina');
                        if (maquinaId) {
                            // Aguarda um pouco e depois abre o modal de novo chamado
                            setTimeout(() => {
                                if (typeof showSection === 'function') {
                                    showSection('iso-manutencao');
                                    setTimeout(() => {
                                        // Tenta abrir o modal de novo chamado com a máquina pré-selecionada
                                        const btnNovo = document.getElementById('btn-novo-chamado-manutencao');
                                        if (btnNovo) {
                                            btnNovo.click();
                                            // Aguarda o modal abrir e seleciona a máquina
                                            setTimeout(() => {
                                                const selectMaquina = document.getElementById('chamado-maquina');
                                                if (selectMaquina) {
                                                    selectMaquina.value = maquinaId;
                                                    // Dispara evento change para atualizar possíveis dependências
                                                    selectMaquina.dispatchEvent(new Event('change'));
                                                }
                                            }, 500);
                                        }
                                    }, 500);
                                }
                            }, 300);
                        }

                    } catch (error) {
                        console.error("Erro login manutenção:", error);
                        erroDiv.textContent = "Falha na autenticação. Verifique suas credenciais.";
                        erroDiv.classList.remove('d-none');
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = 'Entrar';
                    }
                };

                // Remove listener antigo e adiciona o novo
                formLogin.removeEventListener('submit', formLogin._listener);
                formLogin.addEventListener('submit', novoListener);
                formLogin._listener = novoListener;
            }
        });
    }
})();
