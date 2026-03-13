// ✅ NEW: Toggle sidebar mechanic menu + roles
function toggleRoleElements() {
    const currentUserPermissions = window.currentUserPermissions || {};
    
    // Admin-only
    const adminOnly = document.querySelectorAll('.admin-only');
    adminOnly.forEach(el => {
        el.style.display = currentUserPermissions.isAdmin ? 'block' : 'none';
    });

    // Mecânico-only (Versão Mobile)
    const mecanicoOnly = document.querySelectorAll('.mecanico-only');
    mecanicoOnly.forEach(el => {
        el.style.display = currentUserPermissions.isMecanico ? 'block' : 'none';
    });
}

window.toggleRoleElements = toggleRoleElements; // Global
