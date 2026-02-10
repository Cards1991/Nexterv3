# TODO: Fix Firebase Loading and DOM Errors in manutencao-mobile.js

## Current Issues
- Firebase SDK scripts not loading properly, causing 'firebase' to be undefined
- Secondary error in mostrarErroCritico when accessing classList on null element

## Plan
1. **Dynamic Firebase Loading**: Remove static FirPLAebase script tags from HTML and load them dynamically in JS with error handling
2. **DOM Safety Checks**: Add null checks in mostrarErroCritico before accessing DOM properties
3. **Initialization Timing**: Ensure Firebase is fully loaded before attempting initialization
4. **Fallback Handling**: Add retry mechanism for script loading failures

## Steps
- [x] Modify manutencao-mobile.html to remove static Firebase script tags
- [x] Update manutencao-mobile.js to include dynamic script loading function
- [x] Add DOM safety checks in mostrarErroCritico
- [ ] Test the changes by running the page

---

## Update: Added New Cost Calculations to Employee Cost Estimation

### Changes Made
- **js/funcionarios.js**: Updated `atualizarCustoTotal` function to include new patronal (20%) and cont terceiros (7.64%) calculations applied to salary, férias, and 13º.
- **test-custos.js**: Updated test function and expected values to reflect new cost calculations. For R$ 1000 salary, total cost is now R$ 1608.24.

### New Costs Added
- Patronal s/ salario: 20% of salary
- Patronal s/ férias: 20% of férias provision
- Patronal s/13º: 20% of 13º provision
- Cont Terceiros s/ salario: 7.64% of salary
- Cont Terceiros s/ férias: 7.64% of férias provision
- Cont Terceiros s/13º: 7.64% of 13º provision

### Verification
- All test cases updated and verified to match new calculations.
- Total cost for R$ 1000 salary: R$ 1608.24 (as specified).
