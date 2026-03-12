# TODO - Fix Painel Demitidos: Table Show Tipo Demissão (not Motivo)

## Status: Analysis Complete, Ready to Fix

**Issue**: Edit → changes tipoDemissao → table shows motivoDesligamento instead

**Root Cause** (`js/painel-demitidos.js:207`):
```
let motivo = f.motivoDesligamento || f.tipoDemissao || '-';
```
`<td>${motivo}</td>` prioritizes wrong field.

**HTML** (`views/painel-demitidos.html`): `<th>Tipo de Demissão</th>` ✓ correct.

## Plan:
✅ **COMPLETE** - Table now prioritizes `f.tipoDemissao` over motivoDesligamento

**Changes**:
- `let tipoDemissao = f.tipoDemissao || f.motivoDesligamento || '-';`
- `<td>${tipoDemissao}</td>`

Reload Painel de Demitidos - edits now reflect 'Tipo de Demissão' in table.

