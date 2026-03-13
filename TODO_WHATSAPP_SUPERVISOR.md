# ✅ TODO: Fix WhatsApp Supervisor Button Visibility

## Status: 🚧 FIX IN PROGRESS (0/4)

**Problem**: "Configurar WhatsApp" button not appearing in Painel de Manutenção

### ✅ 1. [ ] Robust Button Creation (js/iso-manutencao.js)
- Multiple DOM selectors
- Force recreation without ID check
- Synchronous + retry mechanism
- Console logging

### ✅ 2. [ ] Permanent HTML Button (views/iso-manutencao.html)  
- Static button in header
- JS toggle active state
- Always visible

### ✅ 3. [ ] Test Initialization Flow
```
1. Navigate: showSection('iso-manutencao')
2. Call: inicializarManutencao() 
3. Verify: adicionarBotaoConfigWhatsApp()
4. Button appears within 2s
```

### ✅ 4. [ ] Live Test
- Configure phone: 5542991190590
- Open test call
- Send WhatsApp to mechanics
- Verify wa.me links open

**Acceptance**: User confirms "Botão Configurar WhatsApp visível e funcionando"

