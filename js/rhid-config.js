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

        // 1. Busca todos os funcionários ATIVOS no Firebase
        const funcSnap = await window.db.collection('funcionarios').where('status', '==', 'ATIVO').get();
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
