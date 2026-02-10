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
- **js/atestados.js**: Updated `calcularCustoAtestados` function to use total employee cost (custoTotal) divided by 220 hours instead of just salary.
- **js/funcionarios.js**: Added progress bar to `reprocessarCustosFuncionarios` function for better user feedback during bulk operations.

### New Costs Added (Conditional per Company)
- Patronal s/ salario: 20% of salary (only if company has `hasPatronal: true`)
- Patronal s/ férias: 20% of férias provision (only if company has `hasPatronal: true`)
- Patronal s/13º: 20% of 13º provision (only if company has `hasPatronal: true`)
- Cont Terceiros s/ salario: 7.64% of salary (only if company has `hasContTerceiros: true`)
- Cont Terceiros s/ férias: 7.64% of férias provision (only if company has `hasContTerceiros: true`)
- Cont Terceiros s/13º: 7.64% of 13º provision (only if company has `hasContTerceiros: true`)

### Company Configuration Required
To configure whether a company includes patronal and cont terceiros costs:
1. Go to the companies management section
2. Edit the company document in Firestore
3. Add the following fields:
   - `hasPatronal: true` (if the company has patronal costs)
   - `hasContTerceiros: true` (if the company has cont terceiros costs)
4. If these fields are not set or set to `false`, the costs will not be included

### Atestados Cost Calculation Update
- Changed from using just salary to using total employee cost (custoTotal) divided by 220 hours
- This provides more accurate cost estimation for medical certificates based on the complete employee cost structure

### Progress Bar for Bulk Operations
- Added visual progress bar to the "Reprocessar Custos" function
- Shows current progress (processed/total) and percentage completion
- Improves user experience during long-running bulk operations

### Verification
- All test cases updated and verified to match new calculations.
- Total cost for R$ 1000 salary: R$ 1608.24 (as specified).
- For companies without patronal/cont terceiros: R$ 6020 salary + R$ 3100 por fora = R$ 10900 total cost
- Atestados cost calculation now uses complete employee cost structure
