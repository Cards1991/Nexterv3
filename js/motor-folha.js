// js/motor-folha.js

window.motorFolha = {
    async processar(funcionario, apuracaoPonto, verbasCadastradas, parametrosTela) {
        let movimentos = [];
        let totalProventos = 0;
        let totalDescontos = 0;
        let baseINSS = 0;
        let baseFGTS = 0;
        let baseIRRF = 0;
        let baseDSR = 0;

        const salarioBase = parseFloat(funcionario.salario) || 0;
        const divisor = 220; // Futuramente ler de funcionario.divisor ou similar
        const valorHora = salarioBase / divisor;
        const valorDia = salarioBase / 30;

        // Filtrar e organizar verbas
        const verbasAtivas = verbasCadastradas.filter(v => v.ativo);
        
        // Etapas de Cálculo (Informativas/Bases -> Proventos -> Descontos)
        const ordemCálculo = ['Informativa', 'Base', 'Provento', 'Desconto'];
        verbasAtivas.sort((a, b) => {
            const diffTipo = ordemCálculo.indexOf(a.tipo) - ordemCálculo.indexOf(b.tipo);
            if (diffTipo !== 0) return diffTipo;

            // Regra: Impostos devem ser os últimos Descontos a serem calculados
            const impostos = ['0005', '0006', '0007']; // INSS, IRRF, FGTS
            const aIsImposto = impostos.includes(a.codigo) ? 1 : 0;
            const bIsImposto = impostos.includes(b.codigo) ? 1 : 0;
            if (aIsImposto !== bIsImposto) return aIsImposto - bIsImposto;

            // Regra: DSR deve ser o último Provento a ser calculado
            const dsr = ['0049'];
            const aIsDsr = dsr.includes(a.codigo) ? 1 : 0;
            const bIsDsr = dsr.includes(b.codigo) ? 1 : 0;
            if (aIsDsr !== bIsDsr) return aIsDsr - bIsDsr;

            return a.codigo.localeCompare(b.codigo);
        });

        for (const verba of verbasAtivas) {
            let quantidade = 0;

            // Identificar a Quantidade de Origem
            if ((verba.origem === 'RHiD' || verba.origem === 'Apuração RHiD') && verba.campoOrigem && apuracaoPonto) {
                quantidade = parseFloat(apuracaoPonto[verba.campoOrigem]) || 0;
            } else if (verba.origem === 'Calculada' || verba.origem === 'Variável Calculada' || verba.origem === 'Manual') {
                if (verba.codigo === '001' || verba.codigo === '0001') quantidade = 1; // Salário Base (1 un)
                else if (verba.codigo === '101') quantidade = apuracaoPonto.faltasHoras || 0; // Exemplo de manual mapeada (Falta)
                else if (verba.codigo === '102') quantidade = apuracaoPonto.atrasosHoras || 0; // Exemplo de manual mapeada (Atraso)
            }

            let nomeVerba = verba.descricao || verba.nome || 'Verba ' + verba.codigo;
            let memoria = `Processamento da Verba ${verba.codigo} - ${nomeVerba}\n`;
            memoria += `Unidade Configurada: ${verba.unidade}\n`;

            // Conversão de Unidade
            let quantFinal = quantidade;
            if (verba.unidade === 'Minutos') {
                quantFinal = quantidade / 60;
                memoria += `Conversão RHiD (Minutos): ${quantidade}m / 60 = ${quantFinal.toFixed(5)} horas decimais.\n`;
            } else {
                memoria += `Quantidade Original: ${quantidade}\n`;
            }

            // Resolução de Base
            let valorBaseCalculada = 0;
            if (verba.base === 'salarioBase') valorBaseCalculada = salarioBase;
            else if (verba.base === 'valorHora') valorBaseCalculada = valorHora;
            else if (verba.base === 'valorDia') valorBaseCalculada = valorDia;

            memoria += `Base Resolvida (${verba.base}): R$ ${valorBaseCalculada.toFixed(5)}\n`;

            // Variáveis do Motor
            const vars = {
                BASE: valorBaseCalculada,
                QUANTIDADE: quantFinal,
                FATOR: verba.fator || 1,
                PERCENTUAL: (verba.percentual || 0) / 100,
                DIAS_UTEIS: parametrosTela.diasUteis || 25,
                DIAS_DSR: parametrosTela.diasDsr || 5,
                BASE_INSS: baseINSS,
                BASE_IRRF: baseIRRF,
                BASE_FGTS: baseFGTS,
                BASE_DSR: baseDSR
            };

            let mathExpr = verba.formula;
            Object.keys(vars).forEach(k => {
                mathExpr = mathExpr.replace(new RegExp(`\\b${k}\\b`, 'g'), vars[k]);
            });

            memoria += `Expressão Analisada: ${mathExpr}\n`;

            let resultadoValor = 0;
            try {
                // Disponibiliza as funções globais no escopo
                const fEval = new Function('vars', 'calcularINSS', 'calcularIRRF', `"use strict"; return (${mathExpr});`);
                resultadoValor = fEval(vars, window.calcularINSS, window.calcularIRRF);
            } catch (e) {
                console.error(`Erro ao interpretar fórmula da verba ${verba.codigo}`, e);
                memoria += `[ERRO NA FÓRMULA]: ${e.message}\n`;
                continue;
            }

            const valorArredondado = Number((resultadoValor || 0).toFixed(2));
            memoria += `Resultado: R$ ${valorArredondado}\n`;

            // Pular verbas zeradas (exceto o Salário Base, INSS e DSR para auditoria)
            if (valorArredondado === 0 && !['001', '0001', '0005', '0049'].includes(verba.codigo)) {
                continue;
            }

            // Lançar no movimento financeiro se for Provento ou Desconto
            if (verba.tipo === 'Provento' || verba.tipo === 'Desconto') {
                movimentos.push({
                    verbaCodigo: verba.codigo,
                    nome: nomeVerba,
                    natureza: verba.tipo === 'Provento' ? 'V' : 'D',
                    referencia: quantFinal.toFixed(2),
                    valor: valorArredondado,
                    memoriaCalculo: memoria
                });

                if (verba.tipo === 'Provento') {
                    totalProventos += valorArredondado;
                    // Acumuladores de Incidências
                    if (verba.incidencias && verba.incidencias.inss) baseINSS += valorArredondado;
                    if (verba.incidencias && verba.incidencias.irrf) baseIRRF += valorArredondado;
                    if (verba.incidencias && verba.incidencias.fgts) baseFGTS += valorArredondado;
                    if (verba.incidencias && verba.incidencias.dsr) baseDSR += valorArredondado;
                }
                if (verba.tipo === 'Desconto') {
                    totalDescontos += valorArredondado;
                    // Acumuladores de Incidências (Abatimentos da base)
                    if (verba.incidencias && verba.incidencias.inss) baseINSS -= valorArredondado;
                    if (verba.incidencias && verba.incidencias.irrf) baseIRRF -= valorArredondado;
                    if (verba.incidencias && verba.incidencias.fgts) baseFGTS -= valorArredondado;
                    if (verba.incidencias && verba.incidencias.dsr) baseDSR -= valorArredondado;
                }
            }
        }

        return {
            movimentos,
            totalProventos,
            totalDescontos,
            liquido: totalProventos - totalDescontos
        };
    }
};
