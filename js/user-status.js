// =====================================================
// Módulo de Status de Usuário (Painel de Usuários Online) - CORRIGIDO
// =====================================================

class UserStatusManager {
    constructor() {
        this.userStatusList = document.getElementById('user-status-list');
        this.closeButton = document.getElementById('close-user-status-panel');
        this.panel = document.getElementById('user-status-panel');
        this.unsubscribe = null;
        this.isListening = false;
        this.keepAliveInterval = null;

        // Não inicia o listener automaticamente no construtor
    }

    init() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hidePanel());
        }
    }

    showPanel() {
        if (this.panel) {
            this.panel.classList.remove('d-none');
            if (!this.isListening) {
                this.startListening();
            }
        }
    }

    hidePanel() {
        if (this.panel) {
            this.panel.classList.add('d-none');
            // Não paramos de ouvir quando esconde o painel, apenas escondemos
        }
    }

    startListening() {
        if (this.isListening) return;
        
        this.isListening = true;
        
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        // CORREÇÃO: Removemos o filtro de tempo muito restritivo
        // Em vez de filtrar apenas os últimos 5 minutos, pegamos todos
        // e ordenamos pelos mais recentes
        
        this.unsubscribe = db.collection('user_status')
            .orderBy('last_seen', 'desc')
            .limit(50) // Limita a 50 usuários para performance
            .onSnapshot(snapshot => {
                const users = [];
                const agora = new Date();
                
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    
                    // Calcula se o usuário está online (últimos 10 minutos)
                    let isOnline = false;
                    if (userData.last_seen) {
                        try {
                            let lastSeenDate;
                            if (userData.last_seen.toDate) {
                                lastSeenDate = userData.last_seen.toDate();
                            } else if (userData.last_seen.seconds) {
                                lastSeenDate = new Date(userData.last_seen.seconds * 1000);
                            } else if (userData.last_seen instanceof Date) {
                                lastSeenDate = userData.last_seen;
                            }
                            
                            if (lastSeenDate) {
                                const diffMinutes = (agora - lastSeenDate) / 1000 / 60;
                                isOnline = diffMinutes < 10; // Online se visto nos últimos 10 minutos
                            }
                        } catch (e) {
                            console.warn("Erro ao processar timestamp:", e);
                        }
                    }
                    
                    users.push({
                        id: doc.id,
                        ...userData,
                        isOnline: isOnline
                    });
                });
                
                // Filtra apenas usuários online
                const onlineUsers = users.filter(u => u.isOnline);
                
                this.renderUsers(onlineUsers);
            }, error => {
                console.error("Erro ao ouvir status de usuários:", error);
                this.isListening = false;
            });
    }

    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            this.isListening = false;
        }
    }

    renderUsers(users) {
        if (!this.userStatusList) return;

        this.userStatusList.innerHTML = ''; // Limpa a lista

        if (users.length === 0) {
            this.userStatusList.innerHTML = '<li class="list-group-item text-muted">Nenhum usuário online no momento.</li>';
            return;
        }

        users.forEach(user => {
            let lastSeenText = 'agora mesmo';
            
            if (user.last_seen) {
                try {
                    // Verifica se é timestamp do Firestore
                    let lastSeenDate;
                    if (user.last_seen.toDate) {
                        lastSeenDate = user.last_seen.toDate();
                    } else if (user.last_seen.seconds) {
                        lastSeenDate = new Date(user.last_seen.seconds * 1000);
                    } else if (user.last_seen instanceof Date) {
                        lastSeenDate = user.last_seen;
                    }
                    
                    if (lastSeenDate) {
                        const agora = new Date();
                        const diffSeconds = Math.floor((agora - lastSeenDate) / 1000);
                        
                        if (diffSeconds < 60) {
                            lastSeenText = `${diffSeconds} segundos atrás`;
                        } else if (diffSeconds < 3600) {
                            const minutes = Math.floor(diffSeconds / 60);
                            lastSeenText = `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
                        } else {
                            lastSeenText = lastSeenDate.toLocaleTimeString();
                        }
                    }
                } catch (e) {
                    console.warn("Erro ao processar timestamp:", e);
                }
            }

     const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    <i class="fas ${statusIcon} me-2 ${statusClass}" style="font-size: 0.8rem;"></i>
                    <i class="fas fa-circle text-success me-2" style="font-size: 0.6rem;"></i>
                    <i class="fas fa-user-circle me-2"></i>
                    <span class="fw-bold">${user.displayName || user.email || 'Usuário'}</span>
                </div>
                <small class="text-muted">${lastSeenText}</small>
            `;
            this.userStatusList.appendChild(li);
        });
    }

    // Função para ser chamada no login
    static async setUserOnline(user) {
        if (!user) return;
        
        const userStatusRef = db.collection('user_status').doc(user.uid);
        
        try {
            await userStatusRef.set({
                uid: user.uid,
                displayName: user.displayName || user.email,
                email: user.email,
                status: 'online',
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log("Usuário marcado como online:", user.email);
            
            // Inicia o keep-alive para este usuário
            UserStatusManager.startKeepAlive(user);
            
        } catch (error) {
            console.error("Erro ao definir status do usuário como online:", error);
        }
    }

    // Função para ser chamada no logout
    static async setUserOffline(user) {
        if (!user) return;
        
        const userStatusRef = db.collection('user_status').doc(user.uid);
        
        try {
            await userStatusRef.update({
                status: 'offline',
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log("Usuário marcado como offline:", user.email);
            
            // Para o keep-alive (será gerenciado pela instância)
            
        } catch (error) {
            console.error("Erro ao definir status do usuário como offline:", error);
        }
    }

    // Função para manter o usuário ativo
    static startKeepAlive(user) {
        if (!user) return;
        
        // Verifica se já existe um intervalo para este usuário
        if (user._keepAliveInterval) {
            clearInterval(user._keepAliveInterval);
        }
        
        // Atualiza a cada 2 minutos
        user._keepAliveInterval = setInterval(async () => {
            const userStatusRef = db.collection('user_status').doc(user.uid);
            
            try {
                await userStatusRef.update({
                    last_seen: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'online'
                });
                console.log("🔄 Keep-alive (ping) enviado para:", user.email);
            } catch (error) {
                console.log("Documento não existe ainda, criando...");
                // Se não existir, cria
                await UserStatusManager.setUserOnline(user);
            }
        }, 2 * 60 * 1000);
    }
    
    static stopKeepAlive(user) {
        if (user && user._keepAliveInterval) {
            clearInterval(user._keepAliveInterval);
            delete user._keepAliveInterval;
        }
    }
}

// Inicialização correta
let userStatusManager;

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o manager independente do auth state
    userStatusManager = new UserStatusManager();
    userStatusManager.init();
    
    // Configura listeners de autenticação
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("Usuário logado:", user.email);
            
            // Marca como online quando loga
            UserStatusManager.setUserOnline(user);
            
            // Configura botão de abrir painel
            const openButton = document.getElementById('open-user-status-panel-btn');
            if (openButton) {
                // Remove listeners antigos para evitar duplicação
                openButton.replaceWith(openButton.cloneNode(true));
                const newButton = document.getElementById('open-user-status-panel-btn');
                newButton.addEventListener('click', () => userStatusManager.showPanel());
            }
            
        } else {
            console.log("Usuário deslogado");
            // Se havia um usuário anterior, paramos o keep-alive
            if (window._lastUser) {
                UserStatusManager.stopKeepAlive(window._lastUser);
            }
        }
        
        // Guarda referência do último usuário
        window._lastUser = user;
    });
    
    // Inicia o listening em background (opcional)
    // userStatusManager.startListening();
});

// Adicione este CSS para melhor visualização
const style = document.createElement('style');
style.textContent = `
    #user-status-panel {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 300px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        border-radius: 8px;
    }
    
    #user-status-panel .list-group-item {
        padding: 0.5rem 1rem;
    }
    
    #user-status-panel .fa-circle {
        font-size: 0.6rem;
        vertical-align: middle;
    }
`;
document.head.appendChild(style);