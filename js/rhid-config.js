// Gerencia a interface de configuração do RHiD

document.addEventListener('DOMContentLoaded', () => {
    const btnTestar = document.getElementById('btn-test-rhid-connection');
    if (btnTestar) {
        btnTestar.addEventListener('click', testarConexaoRhid);
    }
});

async function testarConexaoRhid() {
    const btnTestar = document.getElementById('btn-test-rhid-connection');
    const alertBox = document.getElementById('rhid-connection-alert');
    const icon = document.getElementById('rhid-status-icon');
    const text = document.getElementById('rhid-status-text');

    // UI - Loading
    btnTestar.disabled = true;
    btnTestar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Conectando...';
    alertBox.classList.add('d-none');
    
    try {
        // Usa URL baseada no ambiente local ou produção Vercel
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api' // Vercel Dev local
            : '/api'; // Produção

        const response = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'testConnection' })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // UI - Sucesso
            icon.className = 'fas fa-check-circle text-success fs-4';
            icon.parentElement.className = 'rounded-circle me-3 d-flex align-items-center justify-content-center bg-success bg-opacity-10';
            icon.parentElement.style = 'width: 60px; height: 60px;';
            text.textContent = 'Conectado';
            text.className = 'mb-0 fw-bold text-success';
            
            alertBox.className = 'alert mt-3 alert-success';
            alertBox.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${data.message}`;
            
            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem('Conexão com RHiD bem sucedida!', 'success');
            }
        } else {
            throw new Error(data.message || data.error || 'Erro desconhecido ao conectar no RHiD.');
        }

    } catch (error) {
        // UI - Erro
        icon.className = 'fas fa-times-circle text-danger fs-4';
        icon.parentElement.className = 'rounded-circle me-3 d-flex align-items-center justify-content-center bg-danger bg-opacity-10';
        icon.parentElement.style = 'width: 60px; height: 60px;';
        text.textContent = 'Erro de Conexão';
        text.className = 'mb-0 fw-bold text-danger';
        
        alertBox.className = 'alert mt-3 alert-danger';
        alertBox.innerHTML = `<strong>Erro de Conexão:</strong> ${error.message}`;

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Falha ao conectar no RHiD.', 'error');
        }
    } finally {
        // Restore UI
        btnTestar.disabled = false;
        btnTestar.innerHTML = '<i class="fas fa-wifi me-2"></i> TESTAR CONEXÃO';
    }
}

// ==========================================
// FASE 2: Sincronização de Funcionários (Person)
// ==========================================

async function sincronizarFuncionariosRhid() {
    const btnSync = document.getElementById('btn-sync-rhid-employees');
    const alertBox = document.getElementById('rhid-sync-alert');
    const progressContainer = document.getElementById('rhid-sync-progress-container');
    const progressBar = document.getElementById('rhid-sync-progress-bar');
    const statusText = document.getElementById('rhid-sync-status-text');
    const pctText = document.getElementById('rhid-sync-percentage');

    if (!confirm('Deseja puxar a lista atualizada de colaboradores do RHiD? Esta operação atualizará os cadastros no banco do Nexter.')) {
        return;
    }

    // UI Inicial
    btnSync.disabled = true;
    btnSync.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Sincronizando...';
    alertBox.classList.add('d-none');
    progressContainer.classList.remove('d-none');
    
    progressBar.style.width = '10%';
    statusText.textContent = 'Baixando dados da nuvem RHiD...';
    pctText.textContent = '10%';

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        const response = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'syncEmployees' })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const detalhe = data.details ? ` (${data.details})` : '';
            throw new Error((data.message || data.error || 'Falha ao buscar funcionários.') + detalhe);
        }

        const employees = data.data; // Array vindo do RHiD
        
        if (!employees || employees.length === 0) {
            throw new Error('A lista retornada pelo RHiD está vazia.');
        }

        progressBar.style.width = '40%';
        statusText.textContent = `Processando ${employees.length} funcionários...`;
        pctText.textContent = '40%';

        let sucessos = 0;
        let erros = 0;

        // Verifica a constante global de setores oficiais
        const setoresOficiais = (typeof SETORES_OFICIAIS !== 'undefined') ? SETORES_OFICIAIS : [];

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            
            // Extrair CPF (convertendo para string caso venha como número)
            let cpfStr = emp.cpf ? String(emp.cpf) : '';
            let cpf = cpfStr.replace(/\D/g, '');
            if (!cpf) {
                erros++;
                continue;
            }
            // Garantir que o CPF tenha 11 dígitos (adiciona zeros à esquerda)
            cpf = cpf.padStart(11, '0');
            
            // Extrair Setor e tentar match automático com a lista dos 34 setores
            let setorNormalizado = "";
            let setorRaw = (emp.department || emp.departmentName || "").toUpperCase().trim();
            
            if (setorRaw) {
                // Tenta match exato primeiro
                if (setoresOficiais.includes(setorRaw)) {
                    setorNormalizado = setorRaw;
                } else {
                    // Match parcial simplificado (ex: se o RHiD manda "ADMINISTRATIVO - GERAL", tenta encaixar "ADMINISTRATIVO")
                    const matchParcial = setoresOficiais.find(s => setorRaw.includes(s) || s.includes(setorRaw));
                    if (matchParcial) {
                        setorNormalizado = matchParcial;
                    }
                }
            }

            try {
                // Busca no Firebase pelo CPF
                const funcRef = window.db.collection('funcionarios').where('cpf', '==', cpf);
                const funcSnap = await funcRef.get();

                const dadosUpsert = {
                    rhidPersonId: String(emp.id || ''),
                    rhidRaw: JSON.stringify(emp), // Salva o bruto para uso futuro (exigência da OD)
                    ultimaAtualizacaoRhid: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Se houver nome ou PIS, pode atualizar preventivamente
                if (emp.name) dadosUpsert.nome = emp.name;
                if (emp.pis) dadosUpsert.pis = String(emp.pis);
                if (setorNormalizado) dadosUpsert.setor = setorNormalizado; // Só sobescreve setor se achar correspondência
                
                if (funcSnap.empty) {
                    // CREATE: Funcionário novo
                    dadosUpsert.cpf = cpf;
                    dadosUpsert.dataCriacao = firebase.firestore.FieldValue.serverTimestamp();
                    // Novos colaboradores vindos do RHiD não devem poluir a lista ativa automaticamente
                    dadosUpsert.status = 'INATIVO'; 
                    await window.db.collection('funcionarios').add(dadosUpsert);
                } else {
                    // UPDATE: Atualiza todos que tiverem o CPF (teoricamente 1)
                    for (const doc of funcSnap.docs) {
                        await window.db.collection('funcionarios').doc(doc.id).update(dadosUpsert);
                    }
                }
                
                sucessos++;
            } catch (fbErr) {
                console.error(`Erro ao salvar funcionário CPF ${cpf}:`, fbErr);
                erros++;
            }

            // Atualiza barra de progresso
            const progressoAtual = 40 + Math.floor((i / employees.length) * 60);
            progressBar.style.width = `${progressoAtual}%`;
            pctText.textContent = `${progressoAtual}%`;
        }

        // Finalizou
        progressBar.style.width = '100%';
        progressBar.classList.remove('progress-bar-animated');
        progressBar.classList.add('bg-success');
        statusText.textContent = 'Sincronização Finalizada!';
        pctText.textContent = '100%';

        alertBox.classList.remove('d-none', 'alert-danger');
        alertBox.classList.add('alert-success');
        alertBox.innerHTML = `<strong>Sucesso!</strong> Foram sincronizados ${sucessos} funcionários (Erros/Ignorados: ${erros}).`;
        
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Sincronização RHiD concluída com sucesso.', 'success');
        }

    } catch (error) {
        progressBar.classList.remove('progress-bar-animated', 'bg-primary');
        progressBar.classList.add('bg-danger');
        statusText.textContent = 'Erro na sincronização.';

        alertBox.classList.remove('d-none', 'alert-success');
        alertBox.classList.add('alert-danger');
        alertBox.innerHTML = `<strong>Erro:</strong> ${error.message}`;

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Erro na sincronização.', 'error');
        }
    } finally {
        btnSync.disabled = false;
        btnSync.innerHTML = '<i class="fas fa-cloud-download-alt me-2"></i> SINCRONIZAR AGORA';
    }
}

// ==========================================
// FASE 3: Importação de Apuração de Ponto
// ==========================================

async function importarApuracaoRhid() {
    const btnSync = document.getElementById('btn-sync-rhid-apuracao');
    const alertBox = document.getElementById('rhid-apuracao-alert');
    const progressContainer = document.getElementById('rhid-apuracao-progress-container');
    const progressBar = document.getElementById('rhid-apuracao-progress-bar');
    const statusText = document.getElementById('rhid-apuracao-status-text');
    const pctText = document.getElementById('rhid-apuracao-percentage');

    const dtInicio = document.getElementById('rhid-apuracao-inicio').value;
    const dtFim = document.getElementById('rhid-apuracao-fim').value;

    if (!dtInicio || !dtFim) {
        alert('Por favor, selecione a Data Inicial e a Data Final.');
        return;
    }

    if (!confirm(`Deseja buscar a apuração de ponto do período ${dtInicio} a ${dtFim}?`)) {
        return;
    }

    // UI Inicial
    btnSync.disabled = true;
    btnSync.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Importando...';
    alertBox.classList.add('d-none');
    progressContainer.classList.remove('d-none');
    
    progressBar.style.width = '10%';
    statusText.textContent = 'Solicitando cálculos à Control iD...';
    pctText.textContent = '10%';

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        // 1. Busca todos os funcionários ATIVOS no Firebase (case-insensitive para suportar dados antigos e novos)
        const funcSnap = await window.db.collection('funcionarios').where('status', 'in', ['Ativo', 'ATIVO']).get();
        if (funcSnap.empty) {
            throw new Error("Nenhum funcionário ativo encontrado no sistema.");
        }

        const employees = [];
        funcSnap.forEach(doc => {
            const data = doc.data();
            if (data.rhidPersonId && data.cpf) {
                employees.push({ idPerson: data.rhidPersonId, cpf: data.cpf, nome: data.nome });
            }
        });

        const totalFuncs = employees.length;
        statusText.textContent = `Processando ${totalFuncs} funcionários em lotes...`;

        // 2. Quebrar em chunks (lotes) de 20 para não estourar o timeout ou rate-limit
        const CHUNK_SIZE = 20;
        let processados = 0;
        let espelhosSalvos = 0;

        for (let i = 0; i < employees.length; i += CHUNK_SIZE) {
            const chunk = employees.slice(i, i + CHUNK_SIZE);
            const idPersonsChunk = chunk.map(e => e.idPerson);

            // Traz as apurações desse lote da API Vercel
            const response = await fetch(`${apiBaseUrl}/rhid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'syncApuration',
                    startDate: dtInicio,
                    endDate: dtFim,
                    idPersons: idPersonsChunk
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                console.error(`Erro no lote ${i}:`, data);
                continue; // Continua pros próximos lotes mesmo se um falhar
            }

            const apuracoes = data.data || [];

            // 3. Salvar as apurações no Firebase
            // Para otimizar, faremos writes no Firestore (batched writes)
            const batch = window.db.batch();
            let opsCount = 0;

            for (const apur of apuracoes) {
                // Acha o CPF correspondente
                const emp = chunk.find(e => String(e.idPerson) === String(apur.idPerson));
                if (!emp || !apur.date) continue;

                // Formatar data: "2026-09-01T00:00:00" -> "2026-09-01"
                const dateStr = apur.date.split('T')[0];
                const docId = `${emp.cpf}_${dateStr}`;
                const ref = window.db.collection('espelhos_ponto').doc(docId);

                batch.set(ref, {
                    cpf: emp.cpf,
                    rhidPersonId: apur.idPerson,
                    nome: emp.nome,
                    dataReferencia: dateStr,
                    totalHorasTrabalhadas: apur.totalHorasTrabalhadas || 0,
                    horasDiurnas: apur.horasDiurnasNaoExtra || 0,
                    horasExtras: apur.horasExtrasCalculadas || 0,
                    horasFaltaAtraso: apur.horasFaltaAtraso || 0,
                    horasAusentes: apur.horasAusentes || 0,
                    diasTrabalhados: apur.diasTrabalhados || 0,
                    apuracaoRaw: JSON.stringify(apur),
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                opsCount++;
                espelhosSalvos++;

                // O Firestore Batch suporta até 500 operações por vez. 
                // Se chegar em 400, comitamos e abrimos um novo batch
                if (opsCount >= 400) {
                    await batch.commit();
                    opsCount = 0;
                }
            }

            // Commita o resto do batch
            if (opsCount > 0) {
                await batch.commit();
            }

            processados += chunk.length;
            const pct = Math.floor((processados / totalFuncs) * 100);
            progressBar.style.width = `${pct}%`;
            pctText.textContent = `${pct}%`;
        }

        // Caso a API retorne com sucesso (Endpoint correto)
        progressBar.style.width = '100%';
        progressBar.classList.remove('progress-bar-animated', 'bg-warning');
        progressBar.classList.add('bg-success');
        statusText.textContent = 'Apuração Finalizada!';
        pctText.textContent = '100%';

        alertBox.classList.remove('d-none', 'alert-danger');
        alertBox.classList.add('alert-success');
        alertBox.innerHTML = `<strong>Sucesso!</strong> Foram importados e atualizados ${espelhosSalvos} dias de espelho de ponto para os funcionários no período.`;
        
    } catch (error) {
        progressBar.classList.remove('progress-bar-animated', 'bg-warning');
        progressBar.classList.add('bg-danger');
        statusText.textContent = 'Erro na importação.';

        alertBox.classList.remove('d-none', 'alert-success');
        alertBox.classList.add('alert-danger');
        alertBox.innerHTML = `<strong>Erro:</strong> ${error.message}`;
    } finally {
        btnSync.disabled = false;
        btnSync.innerHTML = '<i class="fas fa-file-import me-2"></i> IMPORTAR ESPELHOS';
    }
}

// ==========================================
// FASE 4: Processamento e Relatórios (Horas Extras & Faltas Hoje)
// ==========================================

async function apurarHorasExtrasPeriodo() {
    const btn = document.getElementById('btn-apurar-he');
    const dtInicio = document.getElementById('rhid-he-inicio').value;
    const dtFim = document.getElementById('rhid-he-fim').value;
    const container = document.getElementById('rhid-he-container');
    const tbody = document.getElementById('rhid-he-tbody');

    if (!dtInicio || !dtFim) {
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Selecione o período de início e fim (Filtro Local).', 'warning');
        } else {
            alert('Selecione o período de início e fim.');
        }
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Apurando...';
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><span class="spinner-border spinner-border-sm text-success me-2"></span> Buscando horas extras no banco...</td></tr>';
        container.classList.remove('d-none');

        // 1. Buscar todos os funcionários ATIVOS no Firebase para filtrar a lista
        const funcSnap = await window.db.collection('funcionarios').where('status', 'in', ['Ativo', 'ATIVO']).get();
        const cpfsAtivos = new Set();
        funcSnap.forEach(doc => {
            const data = doc.data();
            
            if (data.cpf) cpfsAtivos.add(data.cpf);
        });

        // 2. Busca espelhos no Firebase
        const espelhosSnap = await window.db.collection('espelhos_ponto')
            .where('dataReferencia', '>=', dtInicio)
            .where('dataReferencia', '<=', dtFim)
            .get();

        if (espelhosSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum dado encontrado no período. Importe os espelhos primeiro.</td></tr>';
            return;
        }

        const heMap = new Map();

        espelhosSnap.forEach(doc => {
            const data = doc.data();
            
            // FILTRO: Ignora se o CPF não for de um funcionário ativo
            if (!data.cpf || !cpfsAtivos.has(data.cpf)) return;

            const heMinutos = Number(data.horasExtras || 0);
            if (heMinutos > 0) {
                if (!heMap.has(data.cpf)) {
                    heMap.set(data.cpf, {
                        cpf: data.cpf,
                        nome: data.nome || 'Desconhecido',
                        totalHeMinutos: 0
                    });
                }
                heMap.get(data.cpf).totalHeMinutos += heMinutos;
            }
        });

        // Converte para array e ordena (maior para menor)
        const rankingList = Array.from(heMap.values()).sort((a, b) => b.totalHeMinutos - a.totalHeMinutos);

        if (rankingList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma hora extra processada para o período.</td></tr>';
            return;
        }

        // Renderiza as linhas
        let html = '';
        rankingList.forEach((r, i) => {
            const horas = (r.totalHeMinutos / 60).toFixed(2);
            let rankBadge = `<span class="badge bg-secondary rounded-circle px-2">${i+1}</span>`;
            if (i === 0) rankBadge = `<span class="badge bg-danger rounded-circle px-2 shadow-sm"><i class="fas fa-crown text-warning"></i> 1</span>`;
            else if (i === 1) rankBadge = `<span class="badge bg-warning text-dark rounded-circle px-2">2</span>`;
            else if (i === 2) rankBadge = `<span class="badge bg-info text-dark rounded-circle px-2">3</span>`;

            html += `
                <tr>
                    <td class="align-middle">${rankBadge}</td>
                    <td class="align-middle fw-semibold text-dark">${r.nome}</td>
                    <td class="align-middle font-monospace text-muted small">${r.cpf}</td>
                    <td class="align-middle text-center fw-bold text-success">${horas} h</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (e) {
        console.error("Erro ao apurar HE:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao apurar horas extras.', 'error');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Falha na consulta.</td></tr>';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-calculator me-2"></i> APURAR HORAS EXTRAS';
    }
}

async function verificarFaltasHoje() {
    const btn = document.getElementById('btn-verificar-faltas-hoje');
    const container = document.getElementById('rhid-faltas-hoje-container');

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Consultando Nuvem...';
        container.innerHTML = '<div class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm text-danger me-2"></span> Buscando batidas de hoje no RHiD...</div>';
        container.classList.remove('d-none');

        // Pega todos ativos, afastados ou em férias para montar o relatório completo
        const funcSnap = await window.db.collection('funcionarios').where('status', 'in', ['Ativo', 'ATIVO', 'Afastado', 'Férias']).get();
        if (funcSnap.empty) {
            container.innerHTML = '<div class="alert alert-warning mb-0">Nenhum funcionário ativo.</div>';
            return;
        }

        const idPersons = [];
        const funcMap = new Map();
        
        funcSnap.forEach(doc => {
            const data = doc.data();

            if (data.rhidPersonId) {
                idPersons.push(data.rhidPersonId);
                funcMap.set(String(data.rhidPersonId), { 
                    id: doc.id,
                    nome: data.nome,
                    setor: data.setor,
                    cpf: data.cpf,
                    condicao: data.condicao || data.condicao_atual || 'Normal'
                });
            }
        });

        // Hoje, compensando fuso (Y-m-d) local
        const hojeObj = new Date();
        const y = hojeObj.getFullYear();
        const m = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const d = String(hojeObj.getDate()).padStart(2, '0');
        const hoje = `${y}-${m}-${d}`;

        // Busca atestados ativos
        const atestadosSnap = await window.db.collection('atestados').get();
        const mapAtestadosValidos = new Map();
        
        atestadosSnap.forEach(adoc => {
            const a = adoc.data();
            if (!a.data_atestado || !a.dias) return;
            let start = a.data_atestado.toDate ? a.data_atestado.toDate() : new Date(a.data_atestado);
            // Corrige fuso (considerando que foi salvo em local time ou ajusta)
            start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            
            let end = new Date(start);
            end.setDate(start.getDate() + (parseInt(a.dias, 10) - 1));
            
            let today = new Date(hojeObj.getFullYear(), hojeObj.getMonth(), hojeObj.getDate());
            
            if (today >= start && today <= end) {
                mapAtestadosValidos.set(a.funcionarioId, a);
            }
        });

        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        // Lotes para evitar Payload Too Large e timeout
        const CHUNK_SIZE = 20;
        const faltantes = [];
        const catAtestado = [];
        const catAfastado = [];
        const catFerias = [];
        const catExterno = [];

        for (let i = 0; i < idPersons.length; i += CHUNK_SIZE) {
            const chunk = idPersons.slice(i, i + CHUNK_SIZE);
            const response = await fetch(`${apiBaseUrl}/rhid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'syncApuration',
                    startDate: hoje,
                    endDate: hoje,
                    idPersons: chunk
                })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                console.error("Lote ignorado devido a erro:", data);
                continue;
            }

            const apuracoes = data.data || [];
            apuracoes.forEach(apur => {
                const func = funcMap.get(String(apur.idPerson));
                if (!func) return;

                const condicao = func.condicao || 'Normal';
                
                // Primeiro, verifica as condições e atestados do funcionário (independente se o RHiD abonou ou não)
                if (condicao === 'Férias') {
                    catFerias.push(func);
                } else if (condicao === 'Trabalho Externo') {
                    catExterno.push(func);
                } else if (condicao.startsWith('Afastado')) {
                    catAfastado.push(func);
                } else if (mapAtestadosValidos.has(func.id)) {
                    func.atestadoInfo = mapAtestadosValidos.get(func.id);
                    catAtestado.push(func);
                } else {
                    // Se não tem justificativa no nosso sistema, verifica as batidas
                    let temBatida = false;
                    if (apur.totalHorasTrabalhadas > 0) temBatida = true;
                    
                    if (!temBatida && apur.listAfdtManutencao && Array.isArray(apur.listAfdtManutencao)) {
                        const batidasReais = apur.listAfdtManutencao.filter(b => b.idAfd !== null || b.idAfdChange !== null);
                        if (batidasReais.length > 0) temBatida = true;
                    }

                    // Se não tiver batidas, é falta injustificada
                    if (!temBatida) {
                        faltantes.push({ ...func, apur: apur });
                    }
                }
            });
        }

        // Helper para gerar html de categoria
        const renderCategory = (title, icon, colorClass, list, badgeText) => {
            if (list.length === 0) return '';
            
            let listHtml = list.map(f => {
                let extra = '';
                if (f.atestadoInfo) {
                    extra = `<br><span class="text-success small fw-bold extra-info"><i class="fas fa-notes-medical"></i> Atestado de ${f.atestadoInfo.dias} dias (${f.atestadoInfo.tipo || 'Motivo N/I'})</span>`;
                } else if (f.condicao && f.condicao !== 'Normal') {
                    extra = `<br><span class="text-muted small extra-info">${f.condicao}</span>`;
                }

                return `
                <div class="list-group-item py-2 px-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold text-dark small">${f.nome}</div>
                            <div class="text-muted" style="font-size: 0.75rem;"><i class="fas fa-building me-1"></i> ${f.setor || 'N/I'}</div>
                            ${extra}
                        </div>
                        <span class="badge bg-${colorClass} rounded-pill shadow-sm" style="font-size: 0.7rem;">${badgeText}</span>
                    </div>
                </div>`;
            }).join('');

            return `
                <div class="card shadow-sm border-0 border-${colorClass} border-opacity-25 mb-3" style="border-radius: 12px;">
                    <div class="card-header bg-${colorClass} bg-opacity-10 text-${colorClass} border-0 fw-bold py-2 d-flex justify-content-between align-items-center" style="border-radius: 12px 12px 0 0;">
                        <div><i class="${icon} me-2"></i> ${list.length} ${title}</div>
                    </div>
                    <div class="card-body p-0">
                        <div class="list-group list-group-flush" style="max-height: 250px; overflow-y: auto;">
                            ${listHtml}
                        </div>
                    </div>
                </div>
            `;
        };

        let html = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0 fw-bold text-dark"><i class="fas fa-chart-pie me-2"></i> Relatório de Absenteísmo de Hoje</h6>
                <button class="btn btn-sm btn-success rounded-pill fw-bold shadow-sm" onclick="exportarFaltasCSV()">
                    <i class="fas fa-file-excel me-1"></i> Exportar Relatório Completo
                </button>
            </div>
        `;
        html += renderCategory('Faltas Injustificadas', 'fas fa-exclamation-triangle', 'danger', faltantes, 'Ausente');
        html += renderCategory('Em Atestado Médico', 'fas fa-briefcase-medical', 'success', catAtestado, 'Atestado');
        html += renderCategory('Afastamentos Ativos', 'fas fa-user-injured', 'warning text-dark', catAfastado, 'Afastado');
        html += renderCategory('Em Férias', 'fas fa-umbrella-beach', 'info text-dark', catFerias, 'Férias');
        html += renderCategory('Trabalho Externo', 'fas fa-car', 'secondary', catExterno, 'Externo');

        if (faltantes.length === 0 && catAtestado.length === 0 && catAfastado.length === 0 && catFerias.length === 0 && catExterno.length === 0) {
            container.innerHTML = `
                <div class="alert alert-success border-0 shadow-sm mb-0 rounded-4">
                    <i class="fas fa-check-circle me-2"></i> Todos registraram batidas hoje!
                </div>
            `;
            return;
        }

        container.innerHTML = html;
        window.__faltas_atuais = faltantes;

    } catch (e) {
        console.error("Erro verificar faltas:", e);
        container.innerHTML = `<div class="alert alert-danger mb-0"><i class="fas fa-times-circle me-2"></i> Erro ao verificar faltas: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search me-2"></i> VERIFICAR FALTAS HOJE';
    }
}

function exportarFaltasCSV() {
    const container = document.getElementById('rhid-faltas-hoje-container');
    const items = container.querySelectorAll('.list-group-item');

    if (items.length === 0) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Não há dados para exportar.', 'warning');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Adiciona BOM para acentuação no Excel
    csvContent += "Nome;Setor;Status;Detalhes\n";

    items.forEach(item => {
        const nome = item.querySelector('.fw-bold')?.innerText.trim() || '';
        const setorRaw = item.querySelector('.text-muted')?.innerText.trim() || '';
        const status = item.querySelector('.badge')?.innerText.trim() || '';
        const extraInfo = item.querySelector('.extra-info')?.innerText.trim() || '';
        
        // Remove icon text if present
        const setor = setorRaw.replace('🏢', '').trim(); // Fallback se tiver icone

        csvContent += `${nome};${setor};${status};${extraInfo}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Relatorio_Absenteismo_${date}.csv`);
    document.body.appendChild(link); // Requerido no FF
    link.click();
    document.body.removeChild(link);
}

function exportarHorasExtrasCSV() {
    const tbody = document.getElementById('rhid-he-tbody');
    const rows = tbody.querySelectorAll('tr');

    if (rows.length === 0 || tbody.innerHTML.includes('Nenhum') || tbody.innerHTML.includes('Buscando')) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Não há dados para exportar.', 'warning');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Adiciona BOM para acentuação no Excel
    csvContent += "Rank;Nome;CPF;Total Horas Extras\n";

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length === 4) {
            // Extrai texto limpo
            const rank = cols[0].innerText.replace(/[^0-9]/g, '').trim();
            const nome = cols[1].innerText.trim();
            const cpf = cols[2].innerText.trim();
            const horasStr = cols[3].innerText.replace('h', '').trim(); // Remove o "h"
            
            // Troca ponto por vírgula no número para Excel em PT-BR entender como decimal
            const horasFormatado = horasStr.replace('.', ',');

            csvContent += `${rank};${nome};${cpf};${horasFormatado}\n`;
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ranking_Horas_Extras_Ativos.csv`);
    document.body.appendChild(link); // Requisito no Firefox
    
    link.click();
    link.remove();
}
