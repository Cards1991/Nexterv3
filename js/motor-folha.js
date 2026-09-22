// js/motor-folha.js

window.motorFolha = {
    async processar(funcionario, apuracaoPonto, verbasCadastradas, parametrosTela) {
        let movimentos = [];
        let totalProventos = 0;
        let totalDescontos = 0;

        const salarioBase = parseFloat(funcionario.salario) || 0;
        const divisor = 220; // Futuramente ler de funcionario.divisor ou similar
        const valorHora = salarioBase / divisor;
        const valorDia = salarioBase / 30;

        // Filtrar e organizar verbas
        const verbasAtivas = verbasCadastradas.filter(v => v.ativo);
        
        // Etapas de Cálculo (Informativas/Bases -> Proventos -> Descontos)
        const ordemCálculo = ['Informativa', 'Base', 'Provento', 'Desconto'];
        verbasAtivas.sort((a, b) => ordemCálculo.indexOf(a.tipo) - ordemCálculo.indexOf(b.tipo));

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

            // Pular se a quantidade for 0 (salvo se for o salário base)
            if (quantidade === 0 && verba.codigo !== '001' && verba.codigo !== '0001') continue;

            let memoria = `Processamento da Verba ${verba.codigo} - ${verba.nome}\n`;
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
                DIAS_DSR: parametrosTela.diasDsr || 5
            };

            let mathExpr = verba.formula;
            Object.keys(vars).forEach(k => {
                mathExpr = mathExpr.replace(new RegExp(`\\b${k}\\b`, 'g'), vars[k]);
            });

            memoria += `Expressão Analisada: ${mathExpr}\n`;

            let resultadoValor = 0;
            try {
                // Evaluando a fórmula com JS puro de forma isolada
                resultadoValor = Function(`"use strict"; return (${mathExpr})`)();
            } catch (e) {
                console.error(`Erro ao interpretar fórmula da verba ${verba.codigo}`, e);
                memoria += `[ERRO NA FÓRMULA]: ${e.message}\n`;
                continue;
            }

            const valorArredondado = Number(resultadoValor.toFixed(2));
            memoria += `Resultado: R$ ${valorArredondado}\n`;

            // Lançar no movimento financeiro se for Provento ou Desconto
            if (verba.tipo === 'Provento' || verba.tipo === 'Desconto') {
                movimentos.push({
                    verbaCodigo: verba.codigo,
                    nome: verba.nome,
                    natureza: verba.tipo === 'Provento' ? 'V' : 'D',
                    referencia: quantFinal.toFixed(2),
                    valor: valorArredondado,
                    memoriaCalculo: memoria
                });

                if (verba.tipo === 'Provento') totalProventos += valorArredondado;
                if (verba.tipo === 'Desconto') totalDescontos += valorArredondado;
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
