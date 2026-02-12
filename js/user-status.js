// =====================================================
// Módulo de Status de Usuário (Painel de Usuários Online)
// =====================================================

class UserStatusManager {
    constructor() {
        this.userStatusList = document.getElementById('user-status-list');
        this.closeButton = document.getElementById('close-user-status-panel');
        this.panel = document.getElementById('user-status-panel');
        this.unsubscribe = null;

        this.init();
    }

    init() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hidePanel());
        }
        // Exemplo de como abrir o painel (pode ser ativado por um botão no menu, etc.)
        // document.getElementById('open-user-status-panel-btn').addEventListener('click', () => this.showPanel());
    }

    showPanel() {
        if (this.panel) {
            this.panel.classList.remove('d-none');
            this.startListening();
        }
    }

    hidePanel() {
        if (this.panel) {
            this.panel.classList.add('d-none');
            this.stopListening();
        }
    }

    startListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        this.unsubscribe = db.collection('user_status')
            .where('last_seen', '>', fiveMinutesAgo)
            .onSnapshot(snapshot => {
                const users = [];
                snapshot.forEach(doc => {
                    users.push(doc.data());
                });
                this.renderUsers(users);
            }, error => {
                console.error("Erro ao ouvir status de usuários:", error);
            });
    }

    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
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
            const lastSeen = user.last_seen ? new Date(user.last_seen.seconds * 1000).toLocaleTimeString() : 'agora';
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>
                    <i class="fas fa-user-circle me-2 text-success"></i>
                    <span class="fw-bold">${user.displayName || user.email}</span>
                </div>
                <small class="text-muted">Visto por último: ${lastSeen}</small>
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
                displayName: user.displayName,
                email: user.email,
                status: 'online',
                last_seen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
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
        } catch (error) {
            console.error("Erro ao definir status do usuário como offline:", error);
        }
    }

    // Função para manter o usuário ativo
    static startKeepAlive(user) {
        if (!user) return;
        // Atualiza a cada 2 minutos
        setInterval(async () => {
            const userStatusRef = db.collection('user_status').doc(user.uid);
            try {
                await userStatusRef.update({
                    last_seen: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                // O documento pode não existir se o usuário nunca logou, então não é um erro crítico
            }
        }, 2 * 60 * 1000); 
    }
}

// Inicializar o manager
let userStatusManager;
document.addEventListener('DOMContentLoaded', () => {
    // Adicionamos um listener para o auth state para só inicializar se houver um usuário
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            if (!userStatusManager) {
                userStatusManager = new UserStatusManager();
                // O painel pode ser aberto por outro evento, mas vamos começar a ouvir
                userStatusManager.startListening();
                
                const openButton = document.getElementById('open-user-status-panel-btn');
                if(openButton){
                    openButton.addEventListener('click', () => userStatusManager.showPanel());
                }
            }
        }
    });
});
