// Gerenciamento da Seção de Cálculos do Departamento Pessoal

async function inicializarCalculos() {
    try {
        const funcSelect = document.getElementById('calc-funcionario');
        if (!funcSelect) return;

        funcSelect.innerHTML = '<option value="">Carregando funcionários...</option>';
        const snapshot = await db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get();

        funcSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
        snapshot.forEach(doc => {
            const func = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${func.nome} (Salário: R$ ${func.salario?.toFixed(2) || '0.00'})`;
            option.dataset.salarioBase = func.salario || 0;
            funcSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Erro ao inicializar Cálculos:", e);
        mostrarMensagem("Erro ao carregar a seção de Cálculos.", "error");
    }
}

async function calcularFolhaPagamento() {
    const resultadoDiv = document.getElementById('holerite-resultado');
    resultadoDiv.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Calculando...</p></div>';

    try {
        // 1. ENTRADA DE DADOS
        const funcionarioId = document.getElementById('calc-funcionario').value;
        if (!funcionarioId) {
            mostrarMensagem("Selecione um funcionário.", "warning");
            resultadoDiv.innerHTML = '<p class="text-center text-muted mt-5">Selecione um funcionário para começar.</p>';
            return;
        }

        const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcDoc.exists) {
            mostrarMensagem("Funcionário não encontrado.", "error");
            return;
        }
        const funcionario = funcDoc.data();
        const salarioBase = parseFloat(funcionario.salario) || 0;
        const jornadaMensal = 220; // Padrão CLT

        // Variáveis do mês
        const horasExtras = parseFloat(document.getElementById('calc-horas-extras').value) || 0;
        const horasAdicionalNoturno = parseFloat(document.getElementById('calc-adicional-noturno').value) || 0;
        const horasFalta = parseFloat(document.getElementById('calc-faltas-horas').value) || 0;
        const numDependentes = parseInt(document.getElementById('calc-dependentes-irrf').value) || 0;
        const comissoes = parseFloat(document.getElementById('calc-comissoes').value) || 0;
        const outrosDescontos = parseFloat(document.getElementById('calc-outros-descontos').value) || 0;
        const descontaVT = document.getElementById('calc-desconto-vt').checked;

        // 2. CÁLCULO DOS PROVENTOS
        const valorHora = salarioBase / jornadaMensal;
        const horasExtrasReais = window.fakeDecimalToTrueDecimal ? window.fakeDecimalToTrueDecimal(horasExtras) : horasExtras;
        const horasAdicionalNoturnoReais = window.fakeDecimalToTrueDecimal ? window.fakeDecimalToTrueDecimal(horasAdicionalNoturno) : horasAdicionalNoturno;
        const horasFaltaReais = window.fakeDecimalToTrueDecimal ? window.fakeDecimalToTrueDecimal(horasFalta) : horasFalta;

        const valorSalarioBase = Number(salarioBase.toFixed(2));
        const valorHorasExtras = Number((horasExtrasReais * (valorHora * 1.5)).toFixed(2));
        const valorDSR = valorHorasExtras > 0 ? Number((valorHorasExtras / 6).toFixed(2)) : 0;
        const valorAdicionalNoturno = Number((horasAdicionalNoturnoReais * (valorHora * 0.2)).toFixed(2));
        const valorComissoes = Number(comissoes.toFixed(2));

        // Total Proventos = Soma exata das verbas de proventos
        const totalProventos = Number((valorSalarioBase + valorHorasExtras + valorDSR + valorAdicionalNoturno + valorComissoes).toFixed(2));

        // 3. CÁLCULO DOS DESCONTOS OBRIGATÓRIOS
        const descontoINSS = Number(Math.max(0, calcularINSS(totalProventos)).toFixed(2));
        const baseCalculoIRRF = totalProventos - descontoINSS - (numDependentes * 189.59);
        const descontoIRRF = Number(Math.max(0, calcularIRRF(baseCalculoIRRF)).toFixed(2));

        // 4. DESCONTOS OPCIONAIS E VARIÁVEIS
        const descontoVT = descontaVT ? Number((salarioBase * 0.06).toFixed(2)) : 0;
        const descontoFaltas = Number((horasFaltaReais * valorHora).toFixed(2));
        const valorOutrosDescontos = Number(outrosDescontos.toFixed(2));

        // Total Descontos = Soma exata de todas as verbas de descontos
        const totalDescontos = Number((descontoINSS + descontoIRRF + descontoVT + descontoFaltas + valorOutrosDescontos).toFixed(2));

        // 5. CÁLCULO DO SALÁRIO LÍQUIDO
        const salarioLiquido = Number((totalProventos - totalDescontos).toFixed(2));

        // 6. GERAÇÃO DO DEMONSTRATIVO
        const holeriteHTML = `
            <style>
                .holerite { font-family: 'Courier New', Courier, monospace; border: 1px solid #ccc; padding: 15px; }
                .holerite-header, .holerite-footer { text-align: center; margin-bottom: 15px; }
                .holerite-body { display: flex; justify-content: space-between; }
                .holerite-col { width: 48%; }
                .holerite-table { width: 100%; font-size: 0.9rem; }
                .holerite-table th, .holerite-table td { padding: 4px; border-bottom: 1px dashed #eee; }
                .holerite-table th { text-align: left; }
                .holerite-table td:last-child { text-align: right; }
                .total-line { font-weight: bold; border-top: 1px solid #333; }
            </style>
            <div class="holerite" id="holerite-imprimivel">
                <div class="holerite-header">
                    <h5>DEMONSTRATIVO DE PAGAMENTO</h5>
                    <p>Competência: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    <p><strong>Funcionário:</strong> ${funcionario.nome}</p>
                </div>
                <div class="holerite-body">
                    <div class="holerite-col">
                        <table class="holerite-table">
                            <thead><tr><th>Proventos</th><th>Valor (R$)</th></tr></thead>
                            <tbody>
                                <tr><td>Salário Base</td><td>${valorSalarioBase.toFixed(2)}</td></tr>
                                ${valorHorasExtras > 0 ? `<tr><td>Horas Extras (50%)</td><td>${valorHorasExtras.toFixed(2)}</td></tr>` : ''}
                                ${valorDSR > 0 ? `<tr><td>DSR s/ Horas Extras</td><td>${valorDSR.toFixed(2)}</td></tr>` : ''}
                                ${valorAdicionalNoturno > 0 ? `<tr><td>Adicional Noturno (20%)</td><td>${valorAdicionalNoturno.toFixed(2)}</td></tr>` : ''}
                                ${valorComissoes > 0 ? `<tr><td>Comissões/Prêmios</td><td>${valorComissoes.toFixed(2)}</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                    <div class="holerite-col">
                        <table class="holerite-table">
                            <thead><tr><th>Descontos</th><th>Valor (R$)</th></tr></thead>
                            <tbody>
                                <tr><td>INSS</td><td>${descontoINSS.toFixed(2)}</td></tr>
                                <tr><td>IRRF</td><td>${descontoIRRF.toFixed(2)}</td></tr>
                                ${descontoVT > 0 ? `<tr><td>Vale-Transporte</td><td>${descontoVT.toFixed(2)}</td></tr>` : ''}
                                ${descontoFaltas > 0 ? `<tr><td>Faltas/Atrasos</td><td>${descontoFaltas.toFixed(2)}</td></tr>` : ''}
                                ${valorOutrosDescontos > 0 ? `<tr><td>Outros Descontos</td><td>${valorOutrosDescontos.toFixed(2)}</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="holerite-footer">
                    <table class="holerite-table">
                        <tr class="total-line"><td>Total Proventos</td><td>R$ ${totalProventos.toFixed(2)}</td></tr>
                        <tr class="total-line"><td>Total Descontos</td><td>R$ ${totalDescontos.toFixed(2)}</td></tr>
                        <tr class="total-line"><td><strong>Salário Líquido</strong></td><td><strong>R$ ${salarioLiquido.toFixed(2)}</strong></td></tr>
                    </table>
                </div>
            </div>
        `;
        resultadoDiv.innerHTML = holeriteHTML;
        document.getElementById('btn-imprimir-holerite').style.display = 'block';

        // 7. GERAR ANÁLISE COM IA
        const dadosParaIA = {
            salarioBruto: totalProventos,
            salarioLiquido,
            totalProventos,
            totalDescontos,
            descontos: {
                inss: descontoINSS,
                irrf: descontoIRRF,
                vt: descontoVT,
                faltas: descontoFaltas,
                outros: valorOutrosDescontos
            },
            proventos: {
                base: valorSalarioBase,
                horasExtras: valorHorasExtras,
                dsr: valorDSR,
                adicionalNoturno: valorAdicionalNoturno,
                comissoes: valorComissoes
            }
        };
        gerarAnaliseIAHolerite(dadosParaIA);

    } catch (error) {
        console.error("Erro ao calcular folha:", error);
        resultadoDiv.innerHTML = '<p class="text-center text-danger">Ocorreu um erro ao processar o cálculo.</p>';
        mostrarMensagem("Erro ao calcular a folha de pagamento.", "error");
    }
}

function gerarAnaliseIAHolerite(dados) {
    const containerAnalise = document.getElementById('holerite-analise-ia-texto');
    const cardAnalise = document.getElementById('card-analise-ia-holerite');
    
    cardAnalise.style.display = 'block';
    containerAnalise.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Gerando explicação...</p>';

    setTimeout(() => {
        let explicacao = '<ul>';

        explicacao += `<li>Seu <strong>salário bruto</strong> este mês foi de <strong>R$ ${dados.salarioBruto.toFixed(2)}</strong>.</li>`;

        if (dados.proventos.horasExtras > 0) {
            explicacao += `<li>Você recebeu <strong>R$ ${dados.proventos.horasExtras.toFixed(2)}</strong> referentes a horas extras.</li>`;
        }
        if (dados.proventos.dsr > 0) {
            explicacao += `<li>Você recebeu <strong>R$ ${dados.proventos.dsr.toFixed(2)}</strong> referente a DSR sobre horas extras.</li>`;
        }
        if (dados.descontos.faltas > 0) {
            explicacao += `<li class="text-danger">Houve um desconto de <strong>R$ ${dados.descontos.faltas.toFixed(2)}</strong> por conta de faltas ou atrasos.</li>`;
        }
        explicacao += `<li>Os descontos obrigatórios de <strong>INSS (R$ ${dados.descontos.inss.toFixed(2)})</strong> e <strong>IRRF (R$ ${dados.descontos.irrf.toFixed(2)})</strong> foram aplicados sobre o seu salário bruto.</li>`;
        explicacao += `<li>Após todos os descontos, seu <strong>salário líquido</strong> a receber é de <strong>R$ ${dados.salarioLiquido.toFixed(2)}</strong>.</li>`;

        explicacao += '</ul>';
        containerAnalise.innerHTML = explicacao;
    }, 1200);
}

function calcularINSS(salarioBruto) {
    if (salarioBruto <= 0) return 0;
    // Tabela INSS Progressiva 2025/2026 (Salário Mínimo R$ 1.518,00 / Teto R$ 8.157,41)
    const faixas = [
        { limite: 1518.00, aliquota: 0.075, deducao: 0 },
        { limite: 2793.88, aliquota: 0.09, deducao: 22.77 },
        { limite: 4190.83, aliquota: 0.12, deducao: 106.59 },
        { limite: 8157.41, aliquota: 0.14, deducao: 190.40 }
    ];
    const teto = 951.63;

    if (salarioBruto > 8157.41) return teto;

    for (const faixa of faixas) {
        if (salarioBruto <= faixa.limite) {
            return Math.max(0, (salarioBruto * faixa.aliquota) - faixa.deducao);
        }
    }
    return teto;
}

function calcularIRRF(baseCalculo) {
    if (baseCalculo <= 2259.20) return 0;
    // Tabela IRRF Progressiva
    const faixas = [
        { limite: 2259.20, aliquota: 0, deducao: 0 },
        { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
        { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
        { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
        { limite: Infinity, aliquota: 0.275, deducao: 896.00 }
    ];

    for (const faixa of faixas) {
        if (baseCalculo <= faixa.limite) {
            return Math.max(0, (baseCalculo * faixa.aliquota) - faixa.deducao);
        }
    }
    return 0;
}

function imprimirDemonstrativo() {
    const conteudo = document.getElementById('holerite-imprimivel').innerHTML;
    const html = `<html><head><title>Demonstrativo de Pagamento</title><link rel="stylesheet" href="css/style.css"><style>body{background:white;}.holerite{border:none;}</style></head><body>${conteudo}</body></html>`;
    openPrintWindow(html, { autoPrint: true, name: '_blank' });
}