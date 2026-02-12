class LocalDB {
    constructor() {
        this.data = {};
        this.load();
    }

    load() {
        const data = localStorage.getItem('localDB');
        if (data) {
            this.data = JSON.parse(data);
        }
    }

    save() {
        localStorage.setItem('localDB', JSON.stringify(this.data));
    }

    collection(name) {
        if (!this.data[name]) {
            this.data[name] = [];
        }

        return {
            add: (data) => {
                const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                data.id = id;
                this.data[name].push(data);
                this.save();
                return Promise.resolve({ id });
            },
            get: () => {
                return Promise.resolve(this.data[name].map(item => ({ id: item.id, data: () => item })));
            },
            where: (field, op, value) => {
                let filtered = this.data[name];
                if (op === '==') {
                    filtered = filtered.filter(item => item[field] === value);
                } else if (op === '>=') {
                    filtered = filtered.filter(item => item[field] >= value);
                } else if (op === '<=') {
                    filtered = filtered.filter(item => item[field] <= value);
                }
                // add more ops if needed
                return {
                    get: () => Promise.resolve(filtered.map(item => ({ id: item.id, data: () => item }))),
                    orderBy: (field2, direction) => {
                        filtered.sort((a, b) => {
                            if (direction === 'desc') {
                                return b[field2] - a[field2];
                            }
                            return a[field2] - b[field2];
                        });
                        return {
                            get: () => Promise.resolve(filtered.map(item => ({ id: item.id, data: () => item }))),
                            limit: (num) => {
                                filtered = filtered.slice(0, num);
                                return {
                                    get: () => Promise.resolve(filtered.map(item => ({ id: item.id, data: () => item })))
                                };
                            }
                        };
                    }
                };
            },
            orderBy: (field, direction) => {
                this.data[name].sort((a, b) => {
                    if (direction === 'desc') {
                        return b[field] - a[field];
                    }
                    return a[field] - b[field];
                });
                return {
                    get: () => Promise.resolve(this.data[name].map(item => ({ id: item.id, data: () => item }))),
                    limit: (num) => {
                        const limited = this.data[name].slice(0, num);
                        return {
                            get: () => Promise.resolve(limited.map(item => ({ id: item.id, data: () => item })))
                        };
                    }
                };
            },
            doc: (id) => {
                return {
                    get: () => {
                        const item = this.data[name].find(i => i.id === id);
                        return Promise.resolve({ exists: !!item, data: () => item });
                    },
                    update: (data) => {
                        const index = this.data[name].findIndex(i => i.id === id);
                        if (index !== -1) {
                            Object.assign(this.data[name][index], data);
                            this.save();
                        }
                        return Promise.resolve();
                    },
                    delete: () => {
                        const index = this.data[name].findIndex(i => i.id === id);
                        if (index !== -1) {
                            this.data[name].splice(index, 1);
                            this.save();
                        }
                        return Promise.resolve();
                    }
                };
            }
        };
    }
}

// CORREÇÃO: Só inicializa o LocalDB se o Firebase não estiver ativo
if (!window.db) {
    console.warn("⚠️ Firebase não detectado. Inicializando LocalDB (Modo Offline).");
    window.db = new LocalDB();
    window.auth = { currentUser: { uid: 'offline-user' } };
    window.timestamp = () => new Date();
} else {
    console.log("✅ Firebase detectado. LocalDB ignorado para evitar conflitos.");
}
