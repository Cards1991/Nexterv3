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

window.toggleRoleElements = toggleRoleElements; // Global
