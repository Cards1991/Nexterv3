// ✅ NEW: Toggle sidebar mechanic menu + roles
function toggleRoleElements() {
    const currentUserPermissions = window.currentUserPermissions || {};
    
    // Admin-only
    const adminOnly = document.querySelectorAll('.admin-only');
    adminOnly.forEach(el => {
        el.style.display = currentUserPermissions.isAdmin ? 'block' : 'none';
    });

    // Mecânico Admin-only (Full ISO)
    const mecanicoAdminOnly = document.querySelectorAll('.mecanico-admin-only');
    mecanicoAdminOnly.forEach(el => {
        el.style.display = currentUserPermissions.isMecanicoAdmin ? 'block' : 'none';
    });

    // Mecânico normal-only (read-only)
    const mecanicoNormalOnly = document.querySelectorAll('.mecanico-normal-only');
    mecanicoNormalOnly.forEach(el => {
        el.style.display = currentUserPermissions.isMecanico && !currentUserPermissions.isMecanicoAdmin ? 'block' : 'none';
    });

    // Mecânico-any
    const mecanicoAny = document.querySelectorAll('.mecanico-any');
    mecanicoAny.forEach(el => {
        el.style.display = currentUserPermissions.isMecanico ? 'block' : 'none';
    });

    // ISO-access (all authenticated users + admins)
    const isoAccess = document.querySelectorAll('.iso-access');
    isoAccess.forEach(el => {
        el.style.display = (currentUserPermissions.isAdmin || currentUserPermissions.isMecanico || currentUserPermissions.hasIsoAccess !== false) ? 'block' : 'none';
    });
}

// ✅ NEW: Safe Bootstrap Modal helper - prevents backdrop errors
function safeModal(modalId, options = {}) {
    const el = document.getElementById(modalId);
    if (!el) {
        console.warn(`Modal #${modalId} not found in DOM`);
        return null;
    }
    try {
        let modal = bootstrap.Modal.getInstance(el);
        // Se a instância estiver corrompida (sem _config), descartamos
        if (modal && typeof modal._config === 'undefined') {
            try { modal.dispose(); } catch(e){}
            modal = null;
        }
        if (!modal) {
            modal = new bootstrap.Modal(el, options);
        }
        return modal;
    } catch (e) {
        console.error(`Bootstrap Modal error for #${modalId}:`, e);
        return null;
    }
}

function safeShowModal(modalId, options = {}) {
    return new Promise((resolve) => {
        const modal = safeModal(modalId, options);
        if (modal) {
            const el = document.getElementById(modalId);
            if (el && !el.classList.contains('show')) {
                const onShown = () => resolve(modal);
                el.addEventListener('shown.bs.modal', onShown, { once: true });
                try {
                    modal.show();
                } catch(e) {
                    // Fallback visual
                    el.classList.add('show');
                    el.style.display = 'block';
                    resolve(modal);
                }
            } else {
                resolve(modal);
            }
        } else {
            resolve(null);
        }
    });
}

function safeHideModal(modalId) {
    return new Promise((resolve) => {
        const el = document.getElementById(modalId);
        if (el) {
            const modal = bootstrap.Modal.getInstance(el);
            if (modal && modal._config !== undefined && el.classList.contains('show')) {
                const onHidden = () => resolve();
                el.addEventListener('hidden.bs.modal', onHidden, { once: true });
                
                // Hook para evitar undefined backdrop interno do Bootstrap se ele tentar disparar escondido
                if (typeof modal._backdrop === 'undefined' || modal._backdrop === null) {
                   modal._backdrop = { hide: function(cb) { if(cb) cb(); }, show: function(cb){ if(cb) cb(); }, dispose: function(){} };
                }

                try {
                    modal.hide();
                } catch(e) {
                    console.error("Erro interno do Bootstrap ao ocultar modal:", e);
                    fecharModalManual(el);
                    resolve();
                }
            } else {
                fecharModalManual(el);
                resolve();
            }
        } else {
            resolve();
        }
    });
}

function fecharModalManual(el) {
    if(!el) return;
    el.classList.remove('show');
    el.style.display = 'none';
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}

window.safeModal = safeModal;
window.safeShowModal = safeShowModal;
window.safeHideModal = safeHideModal;
window.toggleRoleElements = toggleRoleElements;
