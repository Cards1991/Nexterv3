// Habilitar persistência offline
if (window.db && typeof window.db.enablePersistence === 'function') {
    window.db.enablePersistence({ synchronizeTabs: true })
        .then(() => {
            console.log('✅ Persistência offline habilitada.');
        })
        .catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistência offline já está ativa em outra aba.');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ O navegador não suporta persistência offline.');
            } else {
                console.error('❌ Erro ao habilitar persistência offline:', err);
            }
        });
}