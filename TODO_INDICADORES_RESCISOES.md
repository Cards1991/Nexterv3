# TODO - Fix Indicadores Direção: Rescisões Classification Rule

## Analysis:
**js/indicadores-direcao.js** `carregarDadosIndicadores()`:
```
const tiposPedido = [
    'Pedido de demissão',
    'T.A.C - Empregado', 
    'Acordo Legal',
    'Acordo P.F.'
];
```
Checks `d.motivo` (should use `d.tipoDemissao`)

**User Rule** ("Demissão" vs "Pedido"):
**"Demissão" if**:
- Demissão sem justa Causa
- Demissão por justa Causa  
- Término de contrato
- T.A.C - empresa

**"Pedido de Demissão" otherwise**

## Plan:
1. ✅ Update `tiposDemissao` array with exact user types
2. ✅ Change `d.motivo` → `d.tipoDemissao || d.motivo` 
3. Test: Rule matches user spec

✅ **COMPLETE** - Updated classification logic per user rule

**Changes:**
- `tiposDemissao` = exact user types for "Demissão"
- `d.tipoDemissao || d.motivo` fallback
- Logic inverted: !isDemissao → pedidos, else dispensas

Reload Indicadores Direção → Rescisões now classified correctly.
