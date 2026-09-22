// js/dp-verbas.js

let modalVerbaInstance = null;
let modalSimuladorInstance = null;

async function inicializarVerbas() {
    if (!modalVerbaInstance) {
        modalVerbaInstance = new bootstrap.Modal(document.getElementById('modalVerba'));
    }
    if (!modalSimuladorInstance) {
        modalSimuladorInstance = new bootstrap.Modal(document.getElementById('modalSimuladorVerba'));
    }
    await carregarListaVerbas();
}

async function carregarListaVerbas() {
    const tbody = document.getElementById('lista-verbas-tabela');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4"><i class="fas fa-spinner fa-spin me-2"></i>Carregando verbas...</td></tr>';
    
    try {
        const snapshot = await db.collection('verbas').orderBy('codigo').get();
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-muted">Nenhuma verba configurada.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const v = doc.data();
            const nomeVerba = v.nome || v.descricao || 'Verba sem nome';
            const badgeTipo = v.tipo === 'Provento' ? 'success' : v.tipo === 'Desconto' ? 'danger' : 'secondary';
            html += `
                <tr>
                    <td class="fw-bold">${v.codigo}</td>
                    <td>${nomeVerba}</td>
                    <td><span class="badge bg-${badgeTipo}">${v.tipo || 'Pendente de Config.'}</span></td>
                    <td>${v.unidade || '-'}</td>
                    <td><small>${v.origem || 'Pendente'} ${v.campoOrigem ? '('+v.campoOrigem+')' : ''}</small></td>
                    <td>${v.ativo ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-danger">Inativo / Incompleto</span>'}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary" onclick="editarVerba('${doc.id}')" title="Configurar"><i class="fas fa-cog"></i></button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar verbas:", e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-danger">Erro ao carregar lista de verbas.</td></tr>';
    }
}

function abrirModalNovaVerba() {
    document.getElementById('form-verba').reset();
    document.getElementById('verba-id').value = '';
    document.getElementById('modalVerbaTitle').innerHTML = '<i class="fas fa-plus text-primary me-2"></i>Nova Verba';
    modalVerbaInstance.show();
}

async function editarVerba(id) {
    try {
        const doc = await db.collection('verbas').doc(id).get();
        if (!doc.exists) return;
        const v = doc.data();

        document.getElementById('verba-id').value = doc.id;
        document.getElementById('verba-codigo').value = v.codigo;
        document.getElementById('verba-nome').value = v.nome || v.descricao || '';
        document.getElementById('verba-tipo').value = v.tipo || 'Provento';
        document.getElementById('verba-unidade').value = v.unidade || 'Valor (R$)';
        document.getElementById('verba-ativo').value = v.ativo ? 'true' : 'false';
        document.getElementById('verba-origem').value = v.origem || 'Manual';
        document.getElementById('verba-campo-origem').value = v.campoOrigem || '';
        document.getElementById('verba-percentual').value = v.percentual || 0;
        document.getElementById('verba-fator').value = v.fator || 1;
        document.getElementById('verba-base').value = v.base || 'Nenhuma';
        document.getElementById('verba-formula').value = v.formula || '';
        
        document.getElementById('inc-inss').checked = v.incidencias?.inss || false;
        document.getElementById('inc-fgts').checked = v.incidencias?.fgts || false;
        document.getElementById('inc-irrf').checked = v.incidencias?.irrf || false;
        document.getElementById('inc-dsr').checked = v.incidencias?.dsr || false;

        document.getElementById('modalVerbaTitle').innerHTML = '<i class="fas fa-edit text-primary me-2"></i>Configurar Verba';
        modalVerbaInstance.show();
    } catch (e) {
        console.error("Erro ao buscar verba:", e);
    }
}

async function salvarVerba() {
    const id = document.getElementById('verba-id').value;
    const v = {
        codigo: document.getElementById('verba-codigo').value,
        nome: document.getElementById('verba-nome').value,
        descricao: document.getElementById('verba-nome').value, // Para retrocompatibilidade
        tipo: document.getElementById('verba-tipo').value,
        unidade: document.getElementById('verba-unidade').value,
        ativo: document.getElementById('verba-ativo').value === 'true',
        origem: document.getElementById('verba-origem').value,
        campoOrigem: document.getElementById('verba-campo-origem').value,
        percentual: parseFloat(document.getElementById('verba-percentual').value) || 0,
        fator: parseFloat(document.getElementById('verba-fator').value) || 1,
        base: document.getElementById('verba-base').value,
        formula: document.getElementById('verba-formula').value,
        incidencias: {
            inss: document.getElementById('inc-inss').checked,
            fgts: document.getElementById('inc-fgts').checked,
            irrf: document.getElementById('inc-irrf').checked,
            dsr: document.getElementById('inc-dsr').checked
        }
    };

    if (!v.codigo || !v.nome || !v.formula) {
        mostrarMensagem('Preencha os campos obrigatórios (Código, Nome e Fórmula).', 'warning');
        return;
    }

    try {
        if (id) {
            await db.collection('verbas').doc(id).update(v);
            mostrarMensagem('Verba atualizada com sucesso!', 'success');
        } else {
            // Verificar se o código já existe
            const verify = await db.collection('verbas').where('codigo', '==', v.codigo).get();
            if (!verify.empty) {
                mostrarMensagem('Já existe uma verba com este código.', 'error');
                return;
            }
            await db.collection('verbas').add(v);
            mostrarMensagem('Verba criada com sucesso!', 'success');
        }
        modalVerbaInstance.hide();
        carregarListaVerbas();
    } catch (e) {
        console.error('Erro ao salvar verba:', e);
        mostrarMensagem('Erro ao salvar verba.', 'error');
    }
}

// Simulador
function abrirSimuladorVerba() {
    const formula = document.getElementById('verba-formula').value;
    if (!formula) {
        mostrarMensagem("A fórmula está vazia. Preencha-a para simular.", "warning");
        return;
    }
    document.getElementById('sim-resultado-container').classList.add('d-none');
    modalSimuladorInstance.show();
}

function executarSimulacao() {
    const formula = document.getElementById('verba-formula').value;
    const baseSel = document.getElementById('verba-base').value;
    const unidadeSel = document.getElementById('verba-unidade').value;
    const fator = parseFloat(document.getElementById('verba-fator').value) || 1;
    const percentual = parseFloat(document.getElementById('verba-percentual').value) || 0;

    const salario = parseFloat(document.getElementById('sim-salario').value) || 0;
    const divisor = parseFloat(document.getElementById('sim-divisor').value) || 220;
    const quantidade = parseFloat(document.getElementById('sim-quantidade').value) || 0;
    const uteis = parseInt(document.getElementById('sim-uteis').value) || 25;
    const dsr = parseInt(document.getElementById('sim-dsr').value) || 5;

    let memoria = `Fórmula: ${formula}\n`;
    memoria += `Quantidade (Input): ${quantidade} ${unidadeSel}\n`;
    memoria += `Fator: ${fator}\n`;
    memoria += `Percentual: ${percentual}%\n`;

    let valorBaseCalculada = 0;
    if (baseSel === 'salarioBase') valorBaseCalculada = salario;
    else if (baseSel === 'valorHora') valorBaseCalculada = salario / divisor;
    else if (baseSel === 'valorDia') valorBaseCalculada = salario / 30;

    memoria += `Base Resolvida (${baseSel}): R$ ${valorBaseCalculada.toFixed(5)}\n\n`;

    let quantFinal = quantidade;
    if (unidadeSel === 'Minutos') {
        quantFinal = quantidade / 60;
        memoria += `Conversão: ${quantidade} minutos / 60 = ${quantFinal.toFixed(5)} horas\n`;
    }

    try {
        // Preparar as variaveis para o avaliador
        const vars = {
            BASE: valorBaseCalculada,
            QUANTIDADE: quantFinal,
            FATOR: fator,
            PERCENTUAL: percentual / 100,
            DIAS_UTEIS: uteis,
            DIAS_DSR: dsr
        };

        let mathExpr = formula;
        Object.keys(vars).forEach(k => {
            mathExpr = mathExpr.replace(new RegExp(`\\b${k}\\b`, 'g'), vars[k]);
        });

        memoria += `Expressão Resolvida: ${mathExpr}\n`;

        // Executar
        const resultadoFinal = Function(`"use strict"; return (${mathExpr})`)();
        
        memoria += `Resultado Bruto: ${resultadoFinal}\n`;

        document.getElementById('sim-memoria').textContent = memoria;
        document.getElementById('sim-valor-final').textContent = `R$ ${resultadoFinal.toFixed(2)}`;
        document.getElementById('sim-resultado-container').classList.remove('d-none');
    } catch (e) {
        document.getElementById('sim-memoria').textContent = memoria + "\nERRO NA EXPRESSÃO: " + e.message;
        document.getElementById('sim-resultado-container').classList.remove('d-none');
    }
}

async function autoConfigurarVerbasTeorema() {
    if (!confirm('Esta ação irá configurar automaticamente TODAS as verbas. As principais terão fórmulas avançadas e as demais serão configuradas como Manuais. Deseja continuar?')) {
        return;
    }
    
    mostrarMensagem('Configurando todas as verbas, aguarde...', 'info');

    const regrasPadrao = {
        '0001': { formula: 'BASE', base: 'salarioBase', origem: 'Variável Calculada', fator: 1, ativo: true, tipo: 'Provento' },
        '0019': { formula: 'BASE * QUANTIDADE * FATOR', base: 'valorHora', origem: 'Apuração RHiD', campoOrigem: 'horasExtrasCalculadas', fator: 1.5, ativo: true, tipo: 'Provento', unidade: 'Minutos' }, // HE 50%
        '0020': { formula: 'BASE * QUANTIDADE * FATOR', base: 'valorHora', origem: 'Apuração RHiD', campoOrigem: 'horasTotalNoturno', fator: 0.2, ativo: true, tipo: 'Provento', unidade: 'Minutos' }, // Adicional Noturno (Checar se é 0020)
        '0201': { formula: 'BASE * QUANTIDADE', base: 'valorHora', origem: 'Apuração RHiD', campoOrigem: 'horasApenasFalta', fator: 1, ativo: true, tipo: 'Desconto', unidade: 'Minutos' }, // Faltas
        '0049': { formula: '(BASE / DIAS_UTEIS) * DIAS_DSR', base: 'Nenhuma', origem: 'Variável Calculada', fator: 1, ativo: true, tipo: 'Provento' }, // DSR
        '0005': { formula: 'QUANTIDADE', base: 'Nenhuma', origem: 'Variável Calculada', fator: 1, ativo: true, tipo: 'Desconto', unidade: 'Valor (R$)' }, // INSS
        '0008': { formula: '0', base: 'Nenhuma', origem: 'Variável Calculada', fator: 1, ativo: true, tipo: 'Provento' } // Arredondamento
    };

    try {
        const snapshot = await db.collection('verbas').get();
        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach(doc => {
            const v = doc.data();
            const codInt = parseInt(v.codigo) || 0;
            
            let regra = regrasPadrao[v.codigo];
            
            if (!regra) {
                // Fallback genérico para todas as outras verbas
                // Presume-se Desconto se o código for > 100 e < 300 (exceções à parte)
                const isDesconto = (codInt >= 100 && codInt <= 299); 
                
                regra = {
                    formula: 'QUANTIDADE',
                    base: 'Nenhuma',
                    origem: 'Manual',
                    fator: 1,
                    ativo: true,
                    tipo: isDesconto ? 'Desconto' : 'Provento',
                    unidade: 'Valor (R$)'
                };
            }

            batch.update(doc.ref, {
                formula: regra.formula,
                base: regra.base,
                origem: regra.origem,
                campoOrigem: regra.campoOrigem || '',
                fator: regra.fator,
                ativo: regra.ativo,
                tipo: regra.tipo || v.tipo || 'Provento',
                unidade: regra.unidade || 'Valor (R$)'
            });
            count++;
        });

        if (count > 0) {
            await batch.commit();
            mostrarMensagem(`${count} verbas configuradas e ativadas com sucesso!`, 'success');
            carregarListaVerbas();
        } else {
            mostrarMensagem('Nenhuma verba encontrada para configurar.', 'warning');
        }
    } catch (e) {
        console.error('Erro na autoconfiguração:', e);
        mostrarMensagem('Erro ao tentar autoconfigurar verbas.', 'error');
    }
}
