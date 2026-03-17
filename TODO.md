# Task: Fix Cadastro de Máquinas listener + Add employee selector to Gerenciar Mecânicos

## Plan Approved ✅
- Fix Firestore listener lifecycle (iso-maquinas/iso-manutencao menu error)
- Add dropdown select from existing funcionarios (Ativo) in mecânicos modal + update flag (no new record)

## Steps [1/6] ⏳
- [x] 1. Create TODO.md  
- [ ] 2. Fix js/iso-manutencao.js listener + add proper cleanup
- [ ] 3. Update js/app.js section navigation + init sequence
- [ ] 4. Add employee select dropdown to views/cadastro-mecanicos.html modal
- [ ] 5. Update js/cadastro-mecanicos.js: load Ativo funcs + UPDATE existing (set isMecanico flag)
- [ ] 6. Test: Navigate iso-maquinas (no 400), mecânicos modal shows employees + saves flag

**Next:** Edit js/iso-manutencao.js
