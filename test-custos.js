// Test script for employee cost calculations
// This tests the calculation logic from atualizarCustoTotal function

function calcularCustoTotal(salario, salarioPorFora = 0, temValeAlimentacao = false) {
    // Cálculo dos custos padrão para todas as empresas
    const fgts = salario * 0.08; // FGTS: 8%
    const sindicato = salario * 0.008; // Sindicato: 0,8%

    // Provisão de Férias
    const provisaoFerias = salario / 12;
    const tercoFerias = provisaoFerias / 3; // Terço de Férias
    const fgtsFerias = provisaoFerias * 0.08; // FGTS s/ Prov. Férias

    // Provisão 13º
    const provisao13 = salario / 12;
    const fgts13 = provisao13 * 0.08; // Provisão de FGTS s/ 13º

    // Soma de todos os custos adicionais
    const totalAdicionais = fgts + sindicato + provisaoFerias + tercoFerias + fgtsFerias + provisao13 + fgts13;

    // Benefício vale alimentação
    const custoValeRefeicao = temValeAlimentacao ? 260.00 : 0;

    // Custo Total = Salário + Custos Adicionais + Benefícios + Salário Por Fora
    const custoTotal = salario + totalAdicionais + custoValeRefeicao + salarioPorFora;

    return parseFloat(custoTotal.toFixed(2));
}

// Test cases
console.log('=== Testes de Cálculo de Custos ===\n');

// Test 1: Salário R$ 1000, sem benefícios extras
const custo1 = calcularCustoTotal(1000);
console.log(`Salário R$ 1000,00: Custo Total = R$ ${custo1}`);
console.log(`Esperado: R$ 1295.78, Resultado: ${custo1 === 1295.78 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

// Test 2: Salário R$ 2000, sem benefícios extras
const custo2 = calcularCustoTotal(2000);
console.log(`Salário R$ 2000,00: Custo Total = R$ ${custo2}`);
console.log(`Esperado: R$ 2591.56, Resultado: ${custo2 === 2591.56 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

// Test 3: Salário R$ 1000 com vale alimentação
const custo3 = calcularCustoTotal(1000, 0, true);
console.log(`Salário R$ 1000,00 + Vale Alimentação: Custo Total = R$ ${custo3}`);
console.log(`Esperado: R$ 1555.78, Resultado: ${custo3 === 1555.78 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

// Test 4: Salário R$ 1000 com salário por fora R$ 500
const custo4 = calcularCustoTotal(1000, 500);
console.log(`Salário R$ 1000,00 + Salário por Fora R$ 500,00: Custo Total = R$ ${custo4}`);
console.log(`Esperado: R$ 1795.78, Resultado: ${custo4 === 1795.78 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

// Test 5: Salário R$ 1000 com vale alimentação e salário por fora
const custo5 = calcularCustoTotal(1000, 500, true);
console.log(`Salário R$ 1000,00 + Vale Alimentação + Salário por Fora R$ 500,00: Custo Total = R$ ${custo5}`);
console.log(`Esperado: R$ 2055.78, Resultado: ${custo5 === 2055.78 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

// Test 6: Salário R$ 1500
const custo6 = calcularCustoTotal(1500);
console.log(`Salário R$ 1500,00: Custo Total = R$ ${custo6}`);
console.log(`Esperado: R$ 1943.67, Resultado: ${custo6 === 1943.67 ? '✓ CORRETO' : '✗ INCORRETO'}\n`);

console.log('=== Detalhamento dos Cálculos para R$ 1000,00 ===');
const salario = 1000;
const fgts = salario * 0.08;
const sindicato = salario * 0.008;
const provisaoFerias = salario / 12;
const tercoFerias = provisaoFerias / 3;
const fgtsFerias = provisaoFerias * 0.08;
const provisao13 = salario / 12;
const fgts13 = provisao13 * 0.08;
const totalAdicionais = fgts + sindicato + provisaoFerias + tercoFerias + fgtsFerias + provisao13 + fgts13;

console.log(`FGTS (8%): R$ ${fgts.toFixed(2)}`);
console.log(`Sindicato (0,8%): R$ ${sindicato.toFixed(2)}`);
console.log(`Provisão Férias: R$ ${provisaoFerias.toFixed(2)}`);
console.log(`Terço Férias: R$ ${tercoFerias.toFixed(2)}`);
console.log(`FGTS s/ Férias: R$ ${fgtsFerias.toFixed(2)}`);
console.log(`Provisão 13º: R$ ${provisao13.toFixed(2)}`);
console.log(`FGTS s/ 13º: R$ ${fgts13.toFixed(2)}`);
console.log(`Total Adicionais: R$ ${totalAdicionais.toFixed(2)}`);
console.log(`Salário Base: R$ ${salario.toFixed(2)}`);
console.log(`Custo Total: R$ ${(salario + totalAdicionais).toFixed(2)}`);
