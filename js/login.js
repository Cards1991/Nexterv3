// Configuração do Login - VERSÃO CORRIGIDA
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando página de login...');
    
    // Verificar se usuário já está logado
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('Usuário já autenticado, redirecionando para sistema...');
            if (!window.location.href.includes('index.html') && window.location.pathname !== '/') {
                window.location.replace('index.html');
            }
        }
    });

    const form = document.getElementById('form-login');
    const btnGoogle = document.getElementById('btn-google');

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
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            submitBtn.disabled = true;

            try {
                // Define a persistência da sessão para a aba atual do navegador
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
                
                // Fazer login
                const userCredential = await firebase.auth().signInWithEmailAndPassword(email, senha);
                console.log('Login bem-sucedido:', userCredential.user.email);
                
                // Verificar se o email está verificado
                if (!userCredential.user.emailVerified) {
                    console.log('Email não verificado, mas permitindo acesso');
                    // Você pode remover esta verificação se quiser permitir acesso sem verificação
                }
                
                mostrarMensagemLogin('Login realizado com sucesso!', 'success');
                
                // Redirecionar após breve delay para mostrar mensagem de sucesso
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                
            } catch (error) {
                console.error('Erro no login:', error);
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
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Login com Google
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async function() {
            // Mostrar loading
            const originalText = btnGoogle.innerHTML;
            btnGoogle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
            btnGoogle.disabled = true;
            
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                
                // Adicionar escopos adicionais se necessário
                provider.addScope('email');
                provider.addScope('profile');
                
                // Define a persistência da sessão
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
                
                // Fazer login com Google
                const userCredential = await firebase.auth().signInWithPopup(provider);
                console.log('Login Google bem-sucedido:', userCredential.user.email);
                
                mostrarMensagemLogin('Login com Google realizado com sucesso!', 'success');
                
                // Redirecionar após breve delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                
            } catch (error) {
                console.error('Erro no login com Google:', error);
                let mensagemErro = 'Falha no login com Google. ';
                
                switch (error.code) {
                    case 'auth/popup-blocked':
                        mensagemErro = 'Popup bloqueado. Permita popups para este site.';
                        break;
                    case 'auth/popup-closed-by-user':
                        mensagemErro = 'Login cancelado pelo usuário.';
                        break;
                    case 'auth/unauthorized-domain':
                        mensagemErro = 'Domínio não autorizado para login.';
                        break;
                    case 'auth/network-request-failed':
                        mensagemErro = 'Erro de conexão. Verifique sua internet.';
                        break;
                    default:
                        mensagemErro += error.message;
                }
                
                mostrarMensagemLogin(mensagemErro, 'error');
                
            } finally {
                // Restaurar botão
                btnGoogle.innerHTML = originalText;
                btnGoogle.disabled = false;
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
    // Remover mensagens existentes
    const mensagensExistentes = document.querySelectorAll('.login-alert');
    mensagensExistentes.forEach(msg => msg.remove());
    
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-info';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `login-alert alert ${alertClass} alert-dismissible fade show`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        min-width: 300px;
        max-width: 90%;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    alertDiv.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos para mensagens de sucesso/info
    if (tipo === 'success' || tipo === 'info') {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
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

// Se quiser adicionar botão para mostrar/ocultar senha, adicione este HTML no seu form:
/*
<div class="input-group mb-3">
    <input type="password" class="form-control" id="login-senha" placeholder="••••••••" required>
    <button class="btn btn-outline-secondary" type="button" onclick="toggleSenhaVisibility()">
        <i class="fas fa-eye" id="toggle-senha-icon"></i>
    </button>
</div>
*/