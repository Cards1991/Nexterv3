// Configuração do Login - VERSÃO CORRIGIDA
document.addEventListener('DOMContentLoaded', function() {
    
    // Verificar se usuário já está logado
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (!window.location.href.includes('index.html') && window.location.pathname !== '/') {
                window.location.replace('index.html');
            }
        }
    });

    const form = document.getElementById('form-login');

    // Login com email/senha
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const senha = document.getElementById('login-senha').value;
            
            if (!email || !senha) {
                mostrarMensagemLogin('Preencha todos os campos', 'error');
                return;
            }

            // Validar formato do email
            if (!validarEmail(email)) {
                mostrarMensagemLogin('Por favor, insira um email válido', 'error');
                return;
            }

            // Mostrar loading
            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const originalText = btnText.textContent;
            
            btnText.textContent = 'Verificando acesso...';
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' + submitBtn.innerHTML;
            submitBtn.disabled = true;
            
            // Efeito de desfoque no card
            document.querySelector('.login-card').style.filter = 'blur(1px)';

            try {
                // Define a persistência da sessão para a aba atual do navegador
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
                
                // Fazer login
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, senha);
                
                // Verificar se o email está verificado
                if (!userCredential.user.emailVerified) {
                    // Você pode remover esta verificação se quiser permitir acesso sem verificação
                }

                // Set user status to online
                if (typeof UserStatusManager !== 'undefined') {
                    await UserStatusManager.setUserOnline(userCredential.user);
                }
                
                // Animação de sucesso (Slide Out)
                document.querySelector('.login-card').style.filter = 'none';
                document.querySelector('.login-card').classList.add('slide-out');
                
                // Redirecionar após breve delay para mostrar mensagem de sucesso
                setTimeout(() => {
                    window.location.href = 'index.html'; // CORREÇÃO AQUI
                }, 600);
                
            } catch (error) {
                
                // Remove desfoque
                document.querySelector('.login-card').style.filter = 'none';
                
                let mensagemErro = 'Falha no login. ';
                
                switch (error.code) {
                    case 'auth/invalid-login-credentials':
                        mensagemErro = 'E-mail ou senha incorretos.';
                        break;
                    case 'auth/invalid-email':
                        mensagemErro += 'Email inválido.';
                        break;
                    case 'auth/user-disabled':
                        mensagemErro += 'Usuário desativado.';
                        break;
                    case 'auth/user-not-found':
                        mensagemErro += 'Usuário não encontrado.';
                        break;
                    case 'auth/wrong-password':
                        mensagemErro += 'Senha incorreta.';
                        break;
                    case 'auth/too-many-requests':
                        mensagemErro += 'Muitas tentativas. Tente novamente mais tarde.';
                        break;
                    case 'auth/network-request-failed':
                        mensagemErro += 'Erro de conexão. Verifique sua internet.';
                        break;
                    default:
                        mensagemErro += 'Erro interno. Tente novamente.';
                }
                
                mostrarMensagemLogin(mensagemErro, 'error');
                
            } finally {
                // Restaurar botão
                if (!document.querySelector('.slide-out')) { // Só restaura se não estiver saindo
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span class="btn-text">${originalText}</span>`;
                }
            }
        });
    }

    // Adicionar evento para permitir login com Enter
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement.type !== 'button' && activeElement.type !== 'submit') {
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
});

// Função para validar email
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Função para mostrar mensagens de login
function mostrarMensagemLogin(mensagem, tipo = 'info') {
    const feedbackDiv = document.getElementById('login-feedback');
    const card = document.querySelector('.login-card');
    
    if (feedbackDiv) {
        feedbackDiv.textContent = mensagem;
        feedbackDiv.style.opacity = '1';
        
        if (tipo === 'error') {
            // Adiciona animação de shake no card
            card.classList.add('shake');
            
            // Destaca os campos
            const inputs = document.querySelectorAll('.form-control');
            inputs.forEach(input => input.classList.add('is-invalid'));
            
            setTimeout(() => {
                card.classList.remove('shake');
                inputs.forEach(input => input.classList.remove('is-invalid'));
            }, 500);
        }
    }
}

// Função para alternar visibilidade da senha (opcional)
function toggleSenhaVisibility() {
    const senhaInput = document.getElementById('login-senha');
    const toggleIcon = document.getElementById('toggle-senha-icon');
    
    if (senhaInput.type === 'password') {
        senhaInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        senhaInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}