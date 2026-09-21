// Variável global para armazenar temporariamente o processamento simulado
let processamentoAtual = null;

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

        // Sugerir competência atual
        const hoje = new Date();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        document.getElementById('calc-competencia').value = `${mes}/${hoje.getFullYear()}`;
        toggleCamposPorTipoCalculo();
    } catch (e) {
        console.error("Erro ao inicializar Cálculos:", e);
        mostrarMensagem("Erro ao carregar a seção de Cálculos.", "error");
    }
}

function toggleCamposPorTipoCalculo() {
    const tipo = document.getElementById('calc-tipo').value;
    const blocoVariaveis = document.getElementById('bloco-variaveis-folha');
    if (tipo === '2') { // Adiantamento
        blocoVariaveis.style.display = 'none';
    } else { // Folha Mensal
        blocoVariaveis.style.display = 'block';
    }
    verificarCalculoExistente();
}

async function verificarCalculoExistente() {
    const funcionarioId = document.getElementById('calc-funcionario').value;
    const competencia = document.getElementById('calc-competencia').value;
    const tipoCalculo = document.getElementById('calc-tipo').value;
    
    if (!funcionarioId || !competencia || competencia.length < 7) return;

    const idUnico = `${funcionarioId}_${competencia.replace('/', '')}_${tipoCalculo}`;
    const docRef = db.collection('historico_folha').doc(idUnico);
    const doc = await docRef.get();

    if (doc.exists) {
        mostrarMensagem(`Atenção: Já existe um cálculo salvo para esta competência (${tipoCalculo === '1' ? 'Folha' : 'Adto'}).`, 'info');
        const data = doc.data();
        
        // Restaurar parâmetros de entrada se existirem
        if (data.parametros) {
            if (document.getElementById('calc-horas-extras')) document.getElementById('calc-horas-extras').value = data.parametros.horasExtras || 0;
            if (document.getElementById('calc-adicional-noturno')) document.getElementById('calc-adicional-noturno').value = data.parametros.horasAdicionalNoturno || 0;
            if (document.getElementById('calc-faltas-horas')) document.getElementById('calc-faltas-horas').value = data.parametros.horasFalta || 0;
            if (document.getElementById('calc-dependentes-irrf')) document.getElementById('calc-dependentes-irrf').value = data.parametros.numDependentes || 0;
            if (document.getElementById('calc-comissoes')) document.getElementById('calc-comissoes').value = data.parametros.comissoes || 0;
            if (document.getElementById('calc-outros-descontos')) document.getElementById('calc-outros-descontos').value = data.parametros.outrosDescontos || 0;
            if (document.getElementById('calc-desconto-vt')) document.getElementById('calc-desconto-vt').checked = data.parametros.descontaVT || false;
        }

        // Renderizar a tabela com os movimentos salvos
        const funcSelect = document.getElementById('calc-funcionario');
        const funcionarioNome = funcSelect.options[funcSelect.selectedIndex].textContent.split('(')[0].trim();
        
        const totais = renderizarPreviewCalculo(data.movimentos, funcionarioNome, tipoCalculo, competencia, true);
        
        // Configurar processamentoAtual para que o botão Sobrescrever funcione
        processamentoAtual = {
            funcionarioId,
            funcionarioNome,
            competencia,
            tipoCalculo,
            movimentos: data.movimentos,
            totalProventos: totais.totalProventos,
            totalDescontos: totais.totalDescontos,
            liquido: totais.liquido,
            parametros: data.parametros || {},
            jaExiste: true
        };
    } else {
        // Se não existir, limpa o preview para evitar confusão
        document.getElementById('holerite-resultado').innerHTML = `
            <div class="text-center text-muted p-5 mt-5">
                <i class="fas fa-laptop-code fa-3x mb-3 text-light"></i>
                <p>Preencha os dados e clique em "Simular Cálculo" para visualizar as verbas que serão geradas.</p>
            </div>
        `;
        document.getElementById('btn-salvar-processamento').style.display = 'none';
        processamentoAtual = null;
    }
}

// Escutar mudanças para verificar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const funcSelect = document.getElementById('calc-funcionario');
        const compInput = document.getElementById('calc-competencia');
        if (funcSelect) funcSelect.addEventListener('change', verificarCalculoExistente);
        if (compInput) compInput.addEventListener('blur', verificarCalculoExistente);
    }, 1000);
});

function renderizarPreviewCalculo(movimentos, funcionarioNome, tipoCalculo, competencia, jaExiste) {
    const resultadoDiv = document.getElementById('holerite-resultado');
    const btnSalvar = document.getElementById('btn-salvar-processamento');
    
    let totalProventos = 0;
    let totalDescontos = 0;

    let trs = '';
    movimentos.forEach(m => {
        const desc = window.verbasMap && window.verbasMap[m.verbaCodigo] ? window.verbasMap[m.verbaCodigo].descricao : 'Verba ' + m.verbaCodigo;
        if (m.natureza === 'V') totalProventos += Number(m.valor);
        if (m.natureza === 'D') totalDescontos += Number(m.valor);
        
        trs += `
            <tr>
                <td class="text-center">${m.verbaCodigo}</td>
                <td>${desc}</td>
                <td class="text-center">${m.referencia || ''}</td>
                <td class="text-end text-success">${m.natureza === 'V' ? 'R$ ' + Number(m.valor).toFixed(2) : ''}</td>
                <td class="text-end text-danger">${m.natureza === 'D' ? 'R$ ' + Number(m.valor).toFixed(2) : ''}</td>
            </tr>
        `;
    });

    const salarioLiquido = totalProventos - totalDescontos;

    let alertaHtml = `
        <div class="alert alert-info py-2 mb-3">
            <i class="fas fa-info-circle me-2"></i> Cálculo para <strong>${funcionarioNome}</strong> (${tipoCalculo === '1' ? 'Folha' : 'Adto'} - ${competencia}). Clique em "Gravar no Histórico" para salvar.
        </div>
    `;
    
    if (jaExiste) {
        alertaHtml = `
            <div class="alert alert-warning py-2 mb-3">
                <i class="fas fa-exclamation-triangle me-2"></i> <strong>Atenção!</strong> Já existe um cálculo salvo para este mês. Se você prosseguir, o cálculo anterior será <strong>sobrescrito</strong>.
            </div>
        `;
        btnSalvar.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i> Sobrescrever Histórico';
        btnSalvar.classList.replace('btn-success', 'btn-warning');
    } else {
        btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Gravar no Histórico';
        btnSalvar.classList.replace('btn-warning', 'btn-success');
    }

    resultadoDiv.innerHTML = `
        ${alertaHtml}
        <table class="table table-sm table-bordered">
            <thead class="table-light">
                <tr><th class="text-center">Cód.</th><th>Descrição</th><th class="text-center">Ref.</th><th class="text-end">Vencimentos</th><th class="text-end">Descontos</th></tr>
            </thead>
            <tbody>${trs}</tbody>
            <tfoot>
                <tr><td colspan="3" class="text-end fw-bold">Totais</td><td class="text-end fw-bold text-success">R$ ${totalProventos.toFixed(2)}</td><td class="text-end fw-bold text-danger">R$ ${totalDescontos.toFixed(2)}</td></tr>
                <tr><td colspan="3" class="text-end fw-bold fs-5">Valor Líquido</td><td colspan="2" class="text-end fw-bold fs-5 text-primary">R$ ${salarioLiquido.toFixed(2)}</td></tr>
            </tfoot>
        </table>
    `;
    
    btnSalvar.style.display = 'block';
    
    // Devolver os totais calculados para caso quem chamou precise
    return { totalProventos, totalDescontos, liquido: salarioLiquido };
}

async function calcularFolhaPagamento() {
    const resultadoDiv = document.getElementById('holerite-resultado');
    const btnSalvar = document.getElementById('btn-salvar-processamento');
    resultadoDiv.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">Simulando Cálculos...</p></div>';
    btnSalvar.style.display = 'none';
    processamentoAtual = null;

    try {
        // 1. ENTRADA DE DADOS
        const funcionarioId = document.getElementById('calc-funcionario').value;
        const competencia = document.getElementById('calc-competencia').value;
        const tipoCalculo = document.getElementById('calc-tipo').value;
        
        if (!funcionarioId || !competencia) {
            mostrarMensagem("Selecione um funcionário e informe a competência.", "warning");
            resultadoDiv.innerHTML = '<div class="text-center text-muted p-5 mt-5"><i class="fas fa-laptop-code fa-3x mb-3 text-light"></i><p>Preencha os dados e clique em "Simular Cálculo".</p></div>';
            return;
        }

        const idUnico = `${funcionarioId}_${competencia.replace('/', '')}_${tipoCalculo}`;
        const docRefExistente = await db.collection('historico_folha').doc(idUnico).get();
        const jaExiste = docRefExistente.exists;

        const funcDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcDoc.exists) return;
        
        const funcionario = funcDoc.data();
        const salarioBase = parseFloat(funcionario.salario) || 0;
        const jornadaMensal = 220;
        let movimentos = [];
        let totalProventos = 0;
        let totalDescontos = 0;
        let parametrosEntrada = {};

        // 2. PROCESSAMENTO: ADIANTAMENTO (VALE)
        if (tipoCalculo === '2') {
            const valorAdiantamento = Number((salarioBase * 0.40).toFixed(2));
            movimentos.push({
                verbaCodigo: '0060',
                natureza: 'V',
                referencia: '40.00',
                valor: valorAdiantamento
            });
            totalProventos += valorAdiantamento;
        } 
        // 3. PROCESSAMENTO: FOLHA MENSAL
        else if (tipoCalculo === '1') {
            const horasExtras = parseFloat(document.getElementById('calc-horas-extras').value) || 0;
            const horasAdicionalNoturno = parseFloat(document.getElementById('calc-adicional-noturno').value) || 0;
            const horasFalta = parseFloat(document.getElementById('calc-faltas-horas').value) || 0;
            const numDependentes = parseInt(document.getElementById('calc-dependentes-irrf').value) || 0;
            const comissoes = parseFloat(document.getElementById('calc-comissoes').value) || 0;
            const outrosDescontos = parseFloat(document.getElementById('calc-outros-descontos').value) || 0;
            const descontaVT = document.getElementById('calc-desconto-vt').checked;

            const valorHora = salarioBase / jornadaMensal;

            parametrosEntrada = {
                horasExtras, horasAdicionalNoturno, horasFalta, numDependentes, comissoes, outrosDescontos, descontaVT
            };

            // Salário Base (Provento)
            movimentos.push({ verbaCodigo: '0001', natureza: 'V', referencia: '30.00', valor: salarioBase });
            totalProventos += salarioBase;

            // Faltas (Desconto)
            if (horasFalta > 0) {
                const valorFaltas = Number((horasFalta * valorHora).toFixed(2));
                movimentos.push({ verbaCodigo: '0201', natureza: 'D', referencia: horasFalta.toFixed(2), valor: valorFaltas });
                totalDescontos += valorFaltas;
            }

            // Horas Extras (Provento)
            let valorHorasExtras = 0;
            if (horasExtras > 0) {
                valorHorasExtras = Number((horasExtras * (valorHora * 1.5)).toFixed(2));
                movimentos.push({ verbaCodigo: '0032', natureza: 'V', referencia: horasExtras.toFixed(2), valor: valorHorasExtras });
                totalProventos += valorHorasExtras;
                
                // DSR sobre Extras
                const valorDSR = Number((valorHorasExtras / 6).toFixed(2));
                movimentos.push({ verbaCodigo: '0049', natureza: 'V', referencia: '', valor: valorDSR });
                totalProventos += valorDSR;
            }

            // Adicional Noturno
            if (horasAdicionalNoturno > 0) {
                const valorAdicionalNoturno = Number((horasAdicionalNoturno * (valorHora * 0.2)).toFixed(2));
                movimentos.push({ verbaCodigo: '0020', natureza: 'V', referencia: horasAdicionalNoturno.toFixed(2), valor: valorAdicionalNoturno });
                totalProventos += valorAdicionalNoturno;
            }

            // Comissões
            if (comissoes > 0) {
                movimentos.push({ verbaCodigo: '0015', natureza: 'V', referencia: '', valor: comissoes });
                totalProventos += comissoes;
            }

            // Descontos Legais (INSS e IRRF)
            const descontoINSS = Number(Math.max(0, calcularINSS(totalProventos)).toFixed(2));
            movimentos.push({ verbaCodigo: '0101', natureza: 'D', referencia: '', valor: descontoINSS });
            totalDescontos += descontoINSS;

            const baseCalculoIRRF = totalProventos - descontoINSS - (numDependentes * 189.59);
            const descontoIRRF = Number(Math.max(0, calcularIRRF(baseCalculoIRRF)).toFixed(2));
            if (descontoIRRF > 0) {
                movimentos.push({ verbaCodigo: '0102', natureza: 'D', referencia: '', valor: descontoIRRF });
                totalDescontos += descontoIRRF;
            }

            // Vale-Transporte
            if (descontaVT) {
                const descontoVT = Number((salarioBase * 0.06).toFixed(2));
                movimentos.push({ verbaCodigo: '0115', natureza: 'D', referencia: '6.00', valor: descontoVT });
                totalDescontos += descontoVT;
            }

            // Outros Descontos
            if (outrosDescontos > 0) {
                movimentos.push({ verbaCodigo: '0198', natureza: 'D', referencia: '', valor: outrosDescontos });
                totalDescontos += outrosDescontos;
            }

            // Verificar se houve adiantamento neste mês para deduzir (Simulação Básica)
            const adtoPrevio = await db.collection('historico_folha')
                .where('funcionarioId', '==', funcionarioId)
                .where('competencia', '==', competencia)
                .where('tipoCalculo', '==', '2')
                .get();
                
            if (!adtoPrevio.empty) {
                let valorAdto = 0;
                adtoPrevio.forEach(d => {
                    const movs = d.data().movimentos || [];
                    const adtoMov = movs.find(m => m.verbaCodigo === '0060');
                    if (adtoMov) valorAdto += parseFloat(adtoMov.valor);
                });
                if (valorAdto > 0) {
                    movimentos.push({ verbaCodigo: '0112', natureza: 'D', referencia: '', valor: valorAdto });
                    totalDescontos += valorAdto;
                }
            }
        }

        // REGRA DE NEGÓCIO: Arredondamento do Mês (Verba 0008)
        let provisorioLiquido = Number((totalProventos - totalDescontos).toFixed(2));
        if (provisorioLiquido > 0 && !Number.isInteger(provisorioLiquido)) {
            const liquidoArredondado = Math.ceil(provisorioLiquido);
            const valorArredondamento = Number((liquidoArredondado - provisorioLiquido).toFixed(2));
            
            if (valorArredondamento > 0) {
                movimentos.push({ verbaCodigo: '0008', natureza: 'V', referencia: '', valor: valorArredondamento });
                totalProventos += valorArredondamento;
            }
        }

        // Renderizar Preview em Tabela
        const totais = renderizarPreviewCalculo(movimentos, funcionario.nome, tipoCalculo, competencia, jaExiste);

        // Salvar estado na memória global para gravação
        processamentoAtual = {
            funcionarioId,
            funcionarioNome: funcionario.nome,
            competencia,
            tipoCalculo,
            movimentos,
            totalProventos: totais.totalProventos,
            totalDescontos: totais.totalDescontos,
            liquido: totais.liquido,
            parametros: parametrosEntrada,
            jaExiste
        };

    } catch (error) {
        console.error("Erro ao simular folha:", error);
        document.getElementById('holerite-resultado').innerHTML = '<p class="text-center text-danger">Ocorreu um erro ao processar o cálculo.</p>';
        mostrarMensagem("Erro ao processar simulação.", "error");
    }
}

async function salvarProcessamento() {
    if (!processamentoAtual) return;
    
    const btn = document.getElementById('btn-salvar-processamento');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';
    btn.disabled = true;

    try {
        const idUnico = `${processamentoAtual.funcionarioId}_${processamentoAtual.competencia.replace('/', '')}_${processamentoAtual.tipoCalculo}`;
        const docRef = db.collection('historico_folha').doc(idUnico);
        
        await docRef.set({
            funcionarioId: processamentoAtual.funcionarioId,
            competencia: processamentoAtual.competencia,
            tipoCalculo: processamentoAtual.tipoCalculo,
            movimentos: processamentoAtual.movimentos,
            parametros: processamentoAtual.parametros,
            origem: 'Cálculo Sistema Nexter',
            dataProcessamento: firebase.firestore.FieldValue.serverTimestamp()
        });

        mostrarMensagem(`Cálculo de ${processamentoAtual.funcionarioNome} ${processamentoAtual.jaExiste ? 'atualizado' : 'gravado'} com sucesso!`, 'success');
        
        // Limpar tela
        document.getElementById('holerite-resultado').innerHTML = `
            <div class="text-center p-5 mt-5">
                <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
                <h5 class="text-success">Cálculo ${processamentoAtual.jaExiste ? 'Atualizado' : 'Gravado'}!</h5>
                <p class="text-muted">Você já pode consultar o holerite oficial na aba de Funcionários.</p>
            </div>
        `;
        btn.style.display = 'none';
        processamentoAtual = null;

    } catch (error) {
        console.error("Erro ao gravar processamento:", error);
        mostrarMensagem("Falha ao gravar no histórico.", "error");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
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

// ==========================================
// INTEGRAÇÃO RHID (FASE 4)
// ==========================================
async function buscarApuracaoRhidParaCalculo() {
    const btn = document.getElementById('btn-pull-rhid');
    const funcSelect = document.getElementById('calc-funcionario');
    const dtInicio = document.getElementById('calc-rhid-inicio').value;
    const dtFim = document.getElementById('calc-rhid-fim').value;

    if (!funcSelect.value) {
        mostrarMensagem('Selecione um funcionário primeiro.', 'warning');
        return;
    }
    if (!dtInicio || !dtFim) {
        mostrarMensagem('Selecione o período (Data Inicial e Final).', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // 1. Pegar o CPF do funcionário selecionado
        const funcDoc = await db.collection('funcionarios').doc(funcSelect.value).get();
        const funcData = funcDoc.data();
        
        if (!funcData || !funcData.cpf) {
            mostrarMensagem('Funcionário sem CPF cadastrado no sistema.', 'error');
            return;
        }

        // 2. Buscar espelhos de ponto no Firebase para este CPF
        // Filtramos a data no frontend para evitar erros de índice composto no Firestore
        const espelhosSnap = await db.collection('espelhos_ponto')
            .where('cpf', '==', funcData.cpf)
            .get();

        if (espelhosSnap.empty) {
            mostrarMensagem('Nenhum dado do RHiD encontrado para este funcionário.', 'warning');
            return;
        }

        let totalMinutosExtra = 0;
        let totalMinutosFalta = 0;
        let diasEncontrados = 0;

        espelhosSnap.forEach(doc => {
            const data = doc.data();
            const dataRef = data.dataReferencia; // Formato YYYY-MM-DD
            
            // Verifica se a data do espelho está dentro do período selecionado
            if (dataRef >= dtInicio && dataRef <= dtFim) {
                // Integração de Faltas: Ignorar as justificadas pela Auditoria
                if (data.statusFalta !== 'Justificada') {
                    totalMinutosFalta += Number(data.horasFaltaAtraso || 0);
                }

                // Integração de Horas Extras: Ignorar as descartadas pela Auditoria
                if (data.statusAprovacaoHe !== 'Descartada') {
                    totalMinutosExtra += Number(data.horasExtras || 0);
                }

                diasEncontrados++;
            }
        });

        if (diasEncontrados === 0) {
            mostrarMensagem('Nenhum espelho de ponto encontrado no período selecionado.', 'warning');
            return;
        }

        // 3. Converter minutos para horas decimais (DP Padrão)
        // Ex: 90 minutos = 1.5 horas
        const horasExtrasDecimais = (totalMinutosExtra / 60).toFixed(2);
        const horasFaltaDecimais = (totalMinutosFalta / 60).toFixed(2);

        // 4. Preencher os inputs na tela
        document.getElementById('calc-horas-extras').value = horasExtrasDecimais;
        document.getElementById('calc-faltas-horas').value = horasFaltaDecimais;

        mostrarMensagem(`Sucesso! ${diasEncontrados} dias importados do RHiD.`, 'success');

    } catch (e) {
        console.error('Erro ao buscar apuração RHiD:', e);
        mostrarMensagem('Erro ao consultar espelhos de ponto.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    }
}

// ==========================================
// FUNÇÕES DA ABA DE FECHAMENTO COLETIVO
// ==========================================

function preencherCompetenciaFechamento() {
    const calcComp = document.getElementById('calc-competencia').value;
    const filtroComp = document.getElementById('filtro-fechamento-competencia');
    if (!filtroComp.value && calcComp) {
        filtroComp.value = calcComp;
    }
}

async function buscarFechamentoColetivo() {
    const comp = document.getElementById('filtro-fechamento-competencia').value;
    const tipo = document.getElementById('filtro-fechamento-tipo').value;
    const container = document.getElementById('fechamento-resultado-container');

    if (!comp || comp.length < 7) {
        mostrarMensagem('Preencha a competência corretamente (MM/YYYY).', 'warning');
        return;
    }

    container.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x mb-3"></i><p>Buscando processamentos...</p></div>';

    try {
        const snapshot = await db.collection('historico_folha')
            .where('competencia', '==', comp)
            .where('tipoCalculo', '==', tipo)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="text-center text-muted p-5">
                    <i class="fas fa-folder-open fa-3x mb-3 text-light"></i>
                    <p>Nenhum cálculo encontrado para <strong>${comp}</strong> (${tipo === '1' ? 'Folha Mensal' : 'Adiantamento'}).</p>
                </div>
            `;
            return;
        }

        // Buscar todos os funcionários para pegar os nomes
        const funcSnap = await db.collection('funcionarios').get();
        const mapFuncs = {};
        funcSnap.forEach(f => { mapFuncs[f.id] = f.data().nome || 'Desconhecido'; });

        let somaProventos = 0;
        let somaDescontos = 0;
        let somaLiquido = 0;
        let trs = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            const nome = mapFuncs[data.funcionarioId] || 'Funcionário não encontrado';
            
            // Recalcular totais desse holerite
            let prov = 0;
            let desc = 0;
            if (data.movimentos) {
                data.movimentos.forEach(m => {
                    if (m.natureza === 'V') prov += parseFloat(m.valor);
                    if (m.natureza === 'D') desc += parseFloat(m.valor);
                });
            }
            const liq = prov - desc;

            somaProventos += prov;
            somaDescontos += desc;
            somaLiquido += liq;

            trs += `
                <tr>
                    <td>${nome}</td>
                    <td class="text-end text-success">R$ ${prov.toFixed(2)}</td>
                    <td class="text-end text-danger">R$ ${desc.toFixed(2)}</td>
                    <td class="text-end fw-bold text-primary">R$ ${liq.toFixed(2)}</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="fw-bold mb-0 text-secondary"><i class="fas fa-file-invoice-dollar me-2"></i>Resultados de ${comp} (${tipo === '1' ? 'Folha Mensal' : 'Adiantamento'})</h6>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.print()"><i class="fas fa-print me-1"></i> Imprimir</button>
            </div>
            <div class="table-responsive">
                <table class="table table-hover table-bordered align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Funcionário</th>
                            <th class="text-end">Total Vencimentos</th>
                            <th class="text-end">Total Descontos</th>
                            <th class="text-end">Líquido a Receber</th>
                        </tr>
                    </thead>
                    <tbody>${trs}</tbody>
                    <tfoot class="table-light fw-bold">
                        <tr>
                            <td class="text-end">TOTAIS GERAIS:</td>
                            <td class="text-end text-success fs-5">R$ ${somaProventos.toFixed(2)}</td>
                            <td class="text-end text-danger fs-5">R$ ${somaDescontos.toFixed(2)}</td>
                            <td class="text-end text-primary fs-5">R$ ${somaLiquido.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

    } catch (e) {
        console.error('Erro ao buscar fechamento coletivo:', e);
        container.innerHTML = '<p class="text-center text-danger p-5">Erro ao buscar dados.</p>';
        mostrarMensagem('Erro ao consultar fechamento.', 'error');
    }
}