// ========================================
// Módulo: Controle de Cestas Básicas
// ========================================

let __cestas_funcionarios_cache = [];
let __cestas_logo_base64 = null;

async function inicializarControleCestas() {
    console.log("Inicializando Controle de Cestas...");
    
    // Configurar listener para upload de logo
    const logoInput = document.getElementById('cestas-logo-input');
    if (logoInput && !logoInput.dataset.bound) {
        logoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(readerEvent) {
                    __cestas_logo_base64 = readerEvent.target.result;
                    mostrarMensagem("Logo carregada com sucesso!", "success");
                };
                reader.readAsDataURL(file);
            }
        });
        logoInput.dataset.bound = 'true';
    }
    
    // Listeners para filtros
    document.getElementById('cestas-filtro-nome')?.addEventListener('input', filtrarCestas);
    document.getElementById('cestas-filtro-empresa')?.addEventListener('change', filtrarCestas);
    document.getElementById('cestas-filtro-setor')?.addEventListener('input', filtrarCestas);

    await carregarFuncionariosCestas();
}

async function carregarFuncionariosCestas() {
    const tbody = document.getElementById('tabela-controle-cestas');
    if (!tbody) return;
    
    // OTIMIZAÇÃO: Usa cache se disponível para evitar carregamento lento
    if (__cestas_funcionarios_cache.length > 0) {
        filtrarCestas();
        return;
    }

    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    try {
        const [funcsSnap, empresasSnap] = await Promise.all([
            db.collection('funcionarios').where('status', '==', 'Ativo').get(), // Removido orderBy para evitar erro de índice
            db.collection('empresas').get()
        ]);
        
        const empresasMap = {};
        const selectEmpresa = document.getElementById('cestas-filtro-empresa');
        if (selectEmpresa) selectEmpresa.innerHTML = '<option value="">Todas as Empresas</option>';

        empresasSnap.forEach(doc => {
            empresasMap[doc.id] = doc.data().nome;
            if (selectEmpresa) selectEmpresa.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });
        
        __cestas_funcionarios_cache = funcsSnap.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                nome: d.nome,
                empresaId: d.empresaId,
                empresaNome: empresasMap[d.empresaId] || 'N/A',
                setor: d.setor || ''
            };
        }).sort((a, b) => a.nome.localeCompare(b.nome)); // Ordenação em memória
        
        filtrarCestas(); // Renderiza com filtros aplicados (ou sem)
        
    } catch (e) {
        console.error("Erro ao carregar funcionários para cestas:", e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar dados.</td></tr>';
    }
}

function filtrarCestas() {
    const termoNome = document.getElementById('cestas-filtro-nome')?.value.toLowerCase() || '';
    const filtroEmpresa = document.getElementById('cestas-filtro-empresa')?.value || '';
    const termoSetor = document.getElementById('cestas-filtro-setor')?.value.toLowerCase() || '';

    const filtrados = __cestas_funcionarios_cache.filter(f => {
        const matchNome = f.nome.toLowerCase().includes(termoNome);
        const matchEmpresa = !filtroEmpresa || f.empresaId === filtroEmpresa;
        const matchSetor = f.setor.toLowerCase().includes(termoSetor);
        return matchNome && matchEmpresa && matchSetor;
    });

    renderizarTabelaCestas(filtrados);
}

function renderizarTabelaCestas(lista = __cestas_funcionarios_cache) {
    const tbody = document.getElementById('tabela-controle-cestas');
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum funcionário encontrado.</td></tr>';
        return;
    }
    
    // OTIMIZAÇÃO: Renderização em lote para performance
    tbody.innerHTML = lista.map(f => `
        <tr>
            <td><input type="checkbox" class="form-check-input cesta-check" value="${f.id}"></td>
            <td>${f.nome}</td>
            <td>${f.empresaNome}</td>
            <td>${f.setor}</td>
        </tr>
    `).join('');
}

function toggleAllCestas(source) {
    document.querySelectorAll('.cesta-check').forEach(cb => cb.checked = source.checked);
}

function calcularPrazoRetirada() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth(); // 0-11
    
    // 20º dia do mês atual
    let dataBase = new Date(ano, mes, 20);
    
    // Adiciona 3 dias úteis
    let diasUteisAdicionados = 0;
    let dataPrazo = new Date(dataBase);
    
    while (diasUteisAdicionados < 3) {
        dataPrazo.setDate(dataPrazo.getDate() + 1);
        const diaSemana = dataPrazo.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) { // Não é Domingo (0) nem Sábado (6)
            diasUteisAdicionados++;
        }
    }
    
    return dataPrazo.toLocaleDateString('pt-BR');
}

function gerarRelatorioCestas() {
    const selecionados = Array.from(document.querySelectorAll('.cesta-check:checked')).map(cb => cb.value);
    
    if (selecionados.length === 0) {
        mostrarMensagem("Selecione pelo menos um colaborador.", "warning");
        return;
    }
    
    if (!__cestas_logo_base64) {
        if (!confirm("Nenhuma logo selecionada. Deseja continuar sem logo?")) return;
    }
    
    const funcionariosSelecionados = __cestas_funcionarios_cache.filter(f => selecionados.includes(f.id));
    const prazo = calcularPrazoRetirada();
    const hoje = new Date();
    const mesRef = hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const mesRefCapitalized = mesRef.charAt(0).toUpperCase() + mesRef.slice(1);
    
    let html = `<html><head><title>Vales Cesta Básica</title><style>@page { size: A4; margin: 10mm; } body { font-family: Arial, sans-serif; margin: 0; padding: 0; } .container { display: flex; flex-wrap: wrap; justify-content: space-between; } .vale { width: 48%; height: 55mm; border: 1px dashed #000; margin-bottom: 5mm; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; page-break-inside: avoid; } .header { display: flex; align-items: center; margin-bottom: 10px; justify-content: center; } .logo { max-width: 80px; max-height: 50px; margin-right: 15px; } .title { font-weight: bold; font-size: 16px; text-transform: uppercase; } .content { text-align: center; } .name { font-weight: bold; font-size: 14px; margin: 5px 0; border-bottom: 1px solid #ccc; display: inline-block; min-width: 80%; } .company { font-size: 12px; margin-bottom: 5px; font-style: italic; } .prazo { font-size: 11px; color: #555; margin-top: 5px; font-weight: bold; } .referencia { font-size: 12px; margin-bottom: 5px; font-weight: bold; color: #333; }</style></head><body><div class="container">`;
    
    funcionariosSelecionados.forEach(f => {
        const logoHtml = __cestas_logo_base64 ? `<img src="${__cestas_logo_base64}" class="logo">` : '';
        html += `<div class="vale"><div class="header">${logoHtml}<div class="title">VALE UMA CESTA BÁSICA</div></div><div class="content"><div class="referencia">Referência: ${mesRefCapitalized}</div><div class="name">${f.nome}</div><div class="company">${f.empresaNome}</div><div class="prazo">Prazo para retirar: ${prazo}</div></div></div>`;
    });
    
    html += `</div></body></html>`;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
}

// Exportar funções
window.inicializarControleCestas = inicializarControleCestas;
window.gerarRelatorioCestas = gerarRelatorioCestas;
window.toggleAllCestas = toggleAllCestas;

async function verificarAlertasCestas(idsFuncionarios) {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth(); // 0-11

    // Período: do dia 26 do mês anterior ao dia 25 do mês atual
    const dataFim = new Date(anoAtual, mesAtual, 26); // Dia 26, 00:00
    const dataInicio = new Date(anoAtual, mesAtual - 1, 26); // Dia 26 do mês anterior

    const funcionariosComOcorrencias = new Map();
    const idsSet = new Set(idsFuncionarios); // Conjunto para busca rápida em memória

    // 1. Buscar faltas no período (Filtro de funcionário feito em memória para evitar erro de índice)
    const faltasSnap = await db.collection('faltas')
        .where('data', '>=', dataInicio)
        .where('data', '<', dataFim)
        .get();
    
    faltasSnap.forEach(doc => {
        const falta = doc.data();
        if (idsSet.has(falta.funcionarioId)) {
            if (!funcionariosComOcorrencias.has(falta.funcionarioId)) {
                funcionariosComOcorrencias.set(falta.funcionarioId, { nome: falta.funcionarioNome, tipo: 'Falta' });
            }
        }
    });

    // 2. Buscar atestados no período (Filtro de funcionário feito em memória)
    const atestadosSnap = await db.collection('atestados')
        .where('data_atestado', '>=', dataInicio)
        .where('data_atestado', '<', dataFim)
        .get();

    atestadosSnap.forEach(doc => {
        const atestado = doc.data();
        if (idsSet.has(atestado.funcionarioId)) {
            if (!funcionariosComOcorrencias.has(atestado.funcionarioId)) {
                funcionariosComOcorrencias.set(atestado.funcionarioId, { nome: atestado.colaborador_nome, tipo: 'Atestado' });
            }
        }
    });

    return Array.from(funcionariosComOcorrencias.values());
}

async function gravarCustoCestas() {
    const valorCestaInput = document.getElementById('cestas-valor-input');
    const valorCesta = parseFloat(valorCestaInput.value);

    if (isNaN(valorCesta) || valorCesta <= 0) {
        mostrarMensagem("Por favor, insira um valor válido para a cesta.", "warning");
        return;
    }

    const selecionadosIds = Array.from(document.querySelectorAll('.cesta-check:checked')).map(cb => cb.value);

    if (selecionadosIds.length === 0) {
        mostrarMensagem("Selecione pelo menos um colaborador para gravar o custo.", "warning");
        return;
    }

    // Verificar alertas
    const funcionariosComAlertas = await verificarAlertasCestas(selecionadosIds);
    if (funcionariosComAlertas.length > 0) {
        let alertaMsg = "Atenção! Os seguintes colaboradores selecionados possuem faltas ou atestados no período de apuração:\n\n";
        alertaMsg += funcionariosComAlertas.map(f => `- ${f.nome} (${f.tipo})`).join('\n');
        alertaMsg += "\n\nDeseja continuar e gravar o custo para TODOS os selecionados mesmo assim?";
        
        if (!confirm(alertaMsg)) {
            mostrarMensagem("Operação cancelada pelo usuário.", "info");
            return;
        }
    }

    const hoje = new Date();
    const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), 20);
    const loteId = `CESTA-${Date.now()}`; // ID único para este lote de lançamentos

    const batch = db.batch();

    selecionadosIds.forEach(funcId => {
        const funcionario = __cestas_funcionarios_cache.find(f => f.id === funcId);
        if (funcionario) {
            const lancamentoRef = db.collection('lancamentos_financeiros').doc();

            batch.set(lancamentoRef, {
                origem: 'DESPESAS COM M.O.',
                subdivisao: 'Cesta Básica',
                valor: valorCesta,
                dataVencimento: dataVencimento,
                funcionarioId: funcId,
                funcionarioNome: funcionario.nome,
                empresaId: funcionario.empresaId,
                setor: funcionario.setor,
                motivo: `Cesta básica referente a ${hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`,
                status: 'Pendente',
                loteId: loteId, // Adiciona o ID do lote
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    try {
        await batch.commit();
        // Salva o ID do lote no localStorage para a função de desfazer
        localStorage.setItem('ultimoLoteCestasId', loteId);
        mostrarMensagem(`${selecionadosIds.length} custos de cesta básica foram lançados no financeiro.`, "success");
    } catch (error) {
        console.error("Erro ao gravar custos das cestas:", error);
        mostrarMensagem("Ocorreu um erro ao lançar os custos.", "error");
    }
}

async function desfazerUltimoLancamentoCestas() {
    const ultimoLoteId = localStorage.getItem('ultimoLoteCestasId');
    if (!ultimoLoteId) {
        mostrarMensagem("Nenhum lançamento recente de cestas para desfazer.", "info");
        return;
    }

    if (!confirm(`Tem certeza que deseja desfazer o último lançamento de custos de cesta básica (Lote: ${ultimoLoteId})? Todos os registros financeiros associados serão excluídos.`)) {
        return;
    }

    try {
        const querySnapshot = await db.collection('lancamentos_financeiros').where('loteId', '==', ultimoLoteId).get();
        
        if (querySnapshot.empty) {
            mostrarMensagem("Registros do último lote não encontrados. A operação pode já ter sido desfeita.", "warning");
            localStorage.removeItem('ultimoLoteCestasId');
            return;
        }

        const batch = db.batch();
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        localStorage.removeItem('ultimoLoteCestasId');
        mostrarMensagem(`Operação desfeita. ${querySnapshot.size} lançamentos foram excluídos.`, "success");

    } catch (error) {
        console.error("Erro ao desfazer lançamento de cestas:", error);
        mostrarMensagem("Ocorreu um erro ao tentar desfazer a operação.", "error");
    }
}

window.gravarCustoCestas = gravarCustoCestas;
window.desfazerUltimoLancamentoCestas = desfazerUltimoLancamentoCestas;