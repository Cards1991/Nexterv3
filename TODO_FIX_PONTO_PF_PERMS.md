# TODO: Fix New Users Accessing Ponto PF Menu Without Permission ✅ FIXED

## Problem:
js/app.js was force-adding 'ponto-pf' to **ALL** users' secoesPermitidas, overriding admin permission checks.

## Fix Applied:
- **REMOVED** the force-add code in js/app.js (lines ~580):
```
if (currentUserPermissions.secoesPermitidas && !currentUserPermissions.secoesPermitidas.includes('ponto-pf')) {
    currentUserPermissions.secoesPermitidas.push('ponto-pf');
}
```
- Now new users in admin.js get **default** `['dashboard']` only.
- Menu respects explicit `secoesPermitidas` array from Firestore 'usuarios' doc.

## Test:
1. Admin: admin-usuarios → Novo Usuário (defaults to dashboard only).
2. Login as new user → No Ponto PF menu access.
3. Admin edit perms → Check 'ponto-pf' → Now accessible.

**Result:** Permissions now enforced correctly. No backdoor access.

Demo: start views/admin-usuarios.html (if exists) or navigate via sidebar → Gerenciar Usuários → Create new → Test login.
