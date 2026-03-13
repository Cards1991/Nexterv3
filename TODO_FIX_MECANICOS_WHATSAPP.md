# ✅ TODO: Fixar Mecânicos WhatsApp Vazio - IMPLEMENTAÇÃO INICIADA

## 📋 STATUS ATUAL:
- ❌ `carregarListaMecanicosComTelefone()` retorna vazio
- ✅ Query: `isMecanico==true && telefone!=null && !=\"\" && status==\"Ativo\"`
- ✅ Permissions: Read OK para admins (`hasAccessToSection('funcionarios')`)
- 🔍 **Possíveis causas**: Sem dados, sem `isMecanico: true`, permission setor, telefone malformado

## ✅ TODO IMPLEMENTADO:
```
[ ] 1. Adicionar DEBUG logs em carregarListaMecanicosComTelefone()
[ ] 2. FALLBACK query: Apenas `isMecanico==true` + filtro client-side
[ ] 3. CHECK user permissions antes da query
[ ] 4. UI: Mostrar count + \"buscar mecânicos\"
[ ] 5. SAMPLE data se vazio (opcional)
[ ] 6. Teste: showSection('iso-manutencao') → Novo chamado → Ver logs
```

**Próximo**: Editar `js/iso-manutencao.js` com debug + fallback.

**Execute**: `showSection('iso-manutencao')` após edits para testar.

