# TODO: Restrict WhatsApp Button to ISO Manutenção Only

## Plan Approved ✅

## Steps:
- [x] **1.** Create TODO - DONE
- [ ] **2.** Edit `js/iso-manutencao.js` → `adicionarBotaoConfigWhatsApp()`
  - Add: `if (window.secaoAtual !== 'iso-manutencao') return;`
  - Remove setTimeout retries
  - Add cleanup on section change
- [ ] **3.** Test: ISO Manut. → shows ✓ | Other pages → hidden ✓
- [ ] **4.** COMPLETE

**Next:** Edit file now

