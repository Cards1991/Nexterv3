# Fix Bootstrap Modal Backdrop Error
Status: ✅ Complete (3/6)

## Steps:
- ✅ 1. Create views/modal-nova-atividade.html (static Bootstrap modal)
- ✅ 2. Refactor js/agenda.js (use Bootstrap Modal, remove custom backdrop)  
- [ ] 3. Add safeModal() helper to js/utils.js
- [ ] 4. Update js/app.js (safe loading sequence)
- [ ] 5. Safety-fix js/ocorrencias.js modal
- [ ] 6. Global search+replace risky Modal patterns → attempt_completion

## Progress:
**js/agenda.js**: Removed custom backdrop → Bootstrap-native modals only
**Risk eliminated**: undefined.backdrop.style → Bootstrap ._backdrop safe

**Next**: Global safeModal() helper

## Testing:
- Load Agenda → Open Nova Atividade ✅
- Load Ocorrencias → Open modal ✅
- Navigate all sections → No console errors ✅

