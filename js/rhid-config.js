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
    const funcOpcionalId = document.getElementById('rhid-apuracao-funcionario').value;

    if (!dtInicio || !dtFim) {
        alertBox.className = 'alert mt-3 alert-warning mb-0';
        alertBox.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i> Selecione a Data Inicial e Final.';
        alertBox.classList.remove('d-none');
        return;
    }

    // UI Inicial
    btnSync.disabled = true;
    btnSync.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Importando...';
    alertBox.classList.add('d-none');
    progressContainer.classList.remove('d-none');
    
    progressBar.style.width = '10%';
    statusText.textContent = 'Mapeando funcionários locais...';
    pctText.textContent = '10%';

    try {
        let queryFunc = window.db.collection('funcionarios').where('status', 'in', ['Ativo', 'ATIVO']);
        const funcSnap = await queryFunc.get();
        
        let idPersons = [];
        const funcMap = new Map();
        
        funcSnap.forEach(doc => {
            const data = doc.data();

            if (data.rhidPersonId) {
                // Se foi selecionado um funcionário específico, ignora os demais
                if (funcOpcionalId && doc.id !== funcOpcionalId) return;

                idPersons.push(data.rhidPersonId);
                funcMap.set(String(data.rhidPersonId), { 
                    id: doc.id,
                    nome: data.nome,
                    setor: data.setor,
                    cpf: data.cpf
                });
            }
        });

        if (idPersons.length === 0) {
            throw new Error(funcOpcionalId ? 'Funcionário selecionado não possui ID do RHiD vinculado.' : 'Nenhum funcionário ativo com vínculo ao RHiD encontrado.');
        }

        progressBar.style.width = '30%';
        statusText.textContent = `Comunicando com RHiD API para ${idPersons.length} colaborador(es)...`;
        pctText.textContent = '30%';

        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        // Lotes menores para evitar sobrecarga no Firebase (Resource Exhausted)
        const CHUNK_SIZE = 10;
        let totaisLotesProcessados = 0;
        let totalEspelhosSalvos = 0;

        for (let i = 0; i < idPersons.length; i += CHUNK_SIZE) {
            const chunk = idPersons.slice(i, i + CHUNK_SIZE);
            
            statusText.textContent = `Buscando lote ${Math.floor(i/CHUNK_SIZE)+1} de ${Math.ceil(idPersons.length/CHUNK_SIZE)}...`;

            const response = await fetch(`${apiBaseUrl}/rhid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'syncApuration',
                    startDate: dtInicio,
                    endDate: dtFim,
                    idPersons: chunk
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                const detalhe = data.details ? ` (${data.details})` : '';
                throw new Error((data.message || data.error || 'Falha ao buscar apuração.') + detalhe);
            }

            if (data.data && data.data.length > 0) {
                // Prepara batch write para o Firestore
                let batch = window.db.batch();
                let operations = 0;

                for (const doc of data.data) {
                    const func = funcMap.get(String(doc.idPerson));
                    if (!func) continue;

                    // Formatar data para YYYY-MM-DD (remove o horário caso venha T00:00:00 da API)
                    const dateStr = doc.date.split('T')[0];
                    const docId = `${func.cpf}_${dateStr}`;
                    const ref = window.db.collection('espelhos_ponto').doc(docId);
                    
                    batch.set(ref, {
                        cpf: func.cpf,
                        nome: func.nome,
                        setor: func.setor,
                        rhidPersonId: doc.idPerson,
                        dataReferencia: dateStr,
                        
                        horasTrabalhadas: doc.totalHorasTrabalhadas || 0,
                        horasExtras: doc.horasExtrasCalculadas || 0,
                        horasFaltaAtraso: doc.horasFaltaAtraso || 0,
                        horasAdicionalNoturno: doc.horasNoturnasNaoExtra || 0,
                        horasEspera: doc.horasEspera || 0,
                        
                        primeiraBatida: (doc.listAfdtManutencao && doc.listAfdtManutencao.length > 0) ? doc.listAfdtManutencao[0].hora : null,
                        ultimaBatida: (doc.listAfdtManutencao && doc.listAfdtManutencao.length > 0) ? doc.listAfdtManutencao[doc.listAfdtManutencao.length - 1].hora : null,
                        marcacoes: doc.listAfdtManutencao || [],
                        
                        importadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }); // Merge true para não sobrescrever justificativas já feitas na auditoria

                    operations++;
                    totalEspelhosSalvos++;

                    // Limite menor para evitar erro de resource-exhausted
                    if (operations >= 100) {
                        await batch.commit();
                        batch = window.db.batch();
                        operations = 0;
                    }
                }

                if (operations > 0) {
                    await batch.commit();
                }
            }

            totaisLotesProcessados++;
            const pct = 30 + Math.floor((totaisLotesProcessados / Math.ceil(idPersons.length/CHUNK_SIZE)) * 70);
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
        alertBox.innerHTML = `<strong>Sucesso!</strong> Foram importados e atualizados ${totalEspelhosSalvos} dias de espelho de ponto para os funcionários no período.`;
        
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
        const catSemControle = [];
        const catSumidos = [];
        const catAguardandoTurno = [];

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
                const condLower = condicao.toLowerCase();
                
                if (condLower === 'férias' || condLower === 'ferias') {
                    catFerias.push(func);
                } else if (condLower.includes('externo')) {
                    catExterno.push(func);
                } else if (condLower.includes('sem controle')) {
                    catSemControle.push(func);
                } else if (condLower.includes('sumido')) {
                    catSumidos.push(func);
                } else if (condLower.includes('afastado') || condLower.includes('inss')) {
                    catAfastado.push(func);
                } else if (mapAtestadosValidos.has(func.id)) {
                    func.atestadoInfo = mapAtestadosValidos.get(func.id);
                    catAtestado.push(func);
                } else {
                    // Se não tem justificativa no nosso sistema, verifica as batidas
                    let temBatida = false;
                    let turnoAindaNaoComecou = false;
                    
                    if (apur.totalHorasTrabalhadas > 0) temBatida = true;
                    
                    if (!temBatida && apur.listAfdtManutencao && Array.isArray(apur.listAfdtManutencao)) {
                        const batidasReais = apur.listAfdtManutencao.filter(b => b.idAfd !== null || b.idAfdChange !== null);
                        if (batidasReais.length > 0) {
                            temBatida = true;
                        } else {
                            // Checa se o turno começa no futuro comparado à hora atual
                            const batidasPrevistas = apur.listAfdtManutencao.filter(b => b.horaPrevista !== null && b.horaPrevista !== undefined && b.horaPrevista > 0);
                            let primeiroHorarioInt = null;
                            if (batidasPrevistas.length > 0) {
                                // Usa a primeira hora prevista da lista (cronológica), não Math.min pois turno da noite passa da meia-noite (ex: 59 < 1800)
                                primeiroHorarioInt = batidasPrevistas[0].horaPrevista;
                            } else if (apur.strHorarioContratualSimples) {
                                const match = apur.strHorarioContratualSimples.match(/^(\d{2}):(\d{2})/);
                                if (match) {
                                    primeiroHorarioInt = parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
                                }
                            }
                            
                            if (primeiroHorarioInt !== null) {
                                const agora = new Date();
                                const horaAtualInt = agora.getHours() * 100 + agora.getMinutes();
                                if (horaAtualInt < primeiroHorarioInt) {
                                    turnoAindaNaoComecou = true;
                                }
                            }
                        }
                    }

                    // Se não tiver batidas, é falta injustificada, a não ser que o turno seja mais tarde
                    if (!temBatida) {
                        if (turnoAindaNaoComecou) {
                            // Aguardando turno - não vai pra lista de faltantes!
                            catAguardandoTurno.push({ ...func, apur: apur });
                        } else {
                            faltantes.push({ ...func, apur: apur });
                        }
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
        html += renderCategory('Sem Controle de Jornada', 'fas fa-user-clock', 'secondary', catSemControle, 'Sem Controle');
        html += renderCategory('Colaboradores Sumidos', 'fas fa-ghost', 'dark', catSumidos, 'Sumido');
        html += renderCategory('Aguardando Início do Turno', 'fas fa-clock', 'info', catAguardandoTurno, 'Aguardando Turno');

        if (faltantes.length === 0 && catAtestado.length === 0 && catAfastado.length === 0 && catFerias.length === 0 && catExterno.length === 0 && catSemControle.length === 0 && catSumidos.length === 0 && catAguardandoTurno.length === 0) {
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

// ==========================================
// FASE 5: Auditoria Individual e Processamento (Justificativas e Horas Extras)
// ==========================================

// Executa o carregamento assim que a tela for aberta pelo roteador do Nexter (app.js)
window.inicializarRhidConfig = async function() {
    await carregarFuncionariosAuditoria();
};

async function carregarFuncionariosAuditoria() {
    const selectAuditoria = document.getElementById('rhid-auditoria-funcionario');
    const selectApuracao = document.getElementById('rhid-apuracao-funcionario');
    
    if (!selectAuditoria && !selectApuracao) return;

    try {
        const snap = await window.db.collection('funcionarios').where('status', 'in', ['Ativo', 'ATIVO']).orderBy('nome').get();
        
        let optionsAuditoria = '<option value="">Selecione um funcionário...</option>';
        let optionsApuracao = '<option value="">Todos os Funcionários (Importação em Lote)</option>';
        
        snap.forEach(doc => {
            const f = doc.data();
            optionsAuditoria += `<option value="${f.cpf}" data-id="${doc.id}">${f.nome}</option>`;
            // Na importação de apuração, o value pode ser o ID do documento para bater com funcOpcionalId
            optionsApuracao += `<option value="${doc.id}">${f.nome}</option>`;
        });

        if (selectAuditoria) selectAuditoria.innerHTML = optionsAuditoria;
        if (selectApuracao) selectApuracao.innerHTML = optionsApuracao;

    } catch (e) {
        console.error('Erro ao carregar funcionários', e);
        if (selectAuditoria) selectAuditoria.innerHTML = '<option value="">Erro ao carregar</option>';
        if (selectApuracao) selectApuracao.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function buscarAuditoriaPonto() {
    const selectFunc = document.getElementById('rhid-auditoria-funcionario');
    const cpf = selectFunc.value;
    const dtInicio = document.getElementById('rhid-auditoria-inicio').value;
    const dtFim = document.getElementById('rhid-auditoria-fim').value;
    const container = document.getElementById('rhid-auditoria-container');
    const tbody = document.getElementById('rhid-auditoria-tbody');
    const btn = document.getElementById('btn-buscar-auditoria');

    if (!cpf || !dtInicio || !dtFim) {
        mostrarMensagem('Selecione o funcionário e o período.', 'warning');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        container.classList.remove('d-none');
        tbody.innerHTML = '<tr><td colspan="6" class="py-5 text-center"><i class="fas fa-spinner fa-spin fa-2x mb-2 text-primary"></i><br>Buscando batidas...</td></tr>';

        const espelhosSnap = await window.db.collection('espelhos_ponto')
            .where('cpf', '==', cpf)
            .get();

        if (espelhosSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-muted">Nenhum registro encontrado neste período. Sincronize o RHiD primeiro.</td></tr>';
            return;
        }

        let docsFiltrados = [];
        espelhosSnap.forEach(doc => {
            const data = doc.data();
            if (data.dataReferencia >= dtInicio && data.dataReferencia <= dtFim) {
                docsFiltrados.push({ id: doc.id, ...data });
            }
        });

        if (docsFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-muted">Nenhum registro encontrado neste período específico.</td></tr>';
            return;
        }

        // Ordenar por dataReferencia
        docsFiltrados.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));

        let trs = '';
        docsFiltrados.forEach(m => {
            const id = m.id;
            
            const heOriginal = Number(m.horasExtras || 0);
            const faltaOriginal = Number(m.horasFaltaAtraso || 0);
            const heFormatado = heOriginal > 0 ? (heOriginal / 60).toFixed(2) : '-';
            const faltaFormatado = faltaOriginal > 0 ? (faltaOriginal / 60).toFixed(2) : '-';
            
            // Faltas Action
            let acaoFalta = '<span class="text-muted">-</span>';
            if (faltaOriginal > 0) {
                if (m.statusFalta === 'Justificada') {
                    acaoFalta = `<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Justificada</span> <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="desfazerFalta('${id}')" title="Desfazer"><i class="fas fa-undo"></i></button>`;
                } else {
                    acaoFalta = `<button class="btn btn-sm btn-outline-warning" onclick="justificarFalta('${id}')"><i class="fas fa-file-medical me-1"></i>Justificar</button>`;
                }
            }

            // Horas Extras Action
            let acaoHe = '<span class="text-muted">-</span>';
            if (heOriginal > 0) {
                if (m.statusAprovacaoHe === 'Aprovada') {
                    acaoHe = `<span class="badge bg-success"><i class="fas fa-check"></i> Aprovada</span> <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="desfazerHe('${id}')"><i class="fas fa-undo"></i></button>`;
                } else if (m.statusAprovacaoHe === 'Descartada') {
                    acaoHe = `<span class="badge bg-danger"><i class="fas fa-times"></i> Descartada</span> <button class="btn btn-sm btn-link text-secondary p-0 ms-2" onclick="desfazerHe('${id}')"><i class="fas fa-undo"></i></button>`;
                } else {
                    acaoHe = `
                        <button class="btn btn-sm btn-success me-1" title="Aprovar Hora Extra" onclick="aprovarHoraExtra('${id}')"><i class="fas fa-check"></i></button>
                        <button class="btn btn-sm btn-danger" title="Descartar Hora Extra" onclick="descartarHoraExtra('${id}')"><i class="fas fa-times"></i></button>
                    `;
                }
            }

            let batidasStr = '<span class="text-muted small">Sem marcação</span>';
            if (m.marcacoes && m.marcacoes.length > 0) {
                // Ordenar batidas defensivamente (lidando com strings ou objetos)
                const mb = [...m.marcacoes].sort((a, b) => {
                    const valA = (a && a.hora) ? String(a.hora) : String(a);
                    const valB = (b && b.hora) ? String(b.hora) : String(b);
                    return valA.localeCompare(valB);
                });
                batidasStr = mb.map(b => {
                    const val = (b && b.hora) ? String(b.hora) : String(b);
                    return `<span class="badge bg-light text-dark border">${val.substring(0, 5)}</span>`;
                }).join(' ');
            }

            trs += `
                <tr>
                    <td class="fw-bold">${m.dataReferencia.split('-').reverse().join('/')}</td>
                    <td>${batidasStr}</td>
                    <td>${Number(m.horasTrabalhadas || 0) > 0 ? (Number(m.horasTrabalhadas) / 60).toFixed(2) + 'h' : '-'}</td>
                    <td class="${faltaOriginal > 0 && m.statusFalta !== 'Justificada' ? 'text-danger fw-bold' : (m.statusFalta === 'Justificada' ? 'text-success text-decoration-line-through' : '')}">${faltaFormatado}</td>
                    <td>${acaoFalta}</td>
                    <td class="${heOriginal > 0 && m.statusAprovacaoHe !== 'Descartada' ? 'text-success fw-bold' : (m.statusAprovacaoHe === 'Descartada' ? 'text-muted text-decoration-line-through' : '')}">${heFormatado}</td>
                    <td>${acaoHe}</td>
                </tr>
            `;
        });

        tbody.innerHTML = trs;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-danger">Erro ao buscar auditoria.</td></tr>';
        mostrarMensagem('Erro interno.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search me-2"></i> Buscar';
    }
}

async function justificarFalta(docId) {
    if (!confirm('Tem certeza que deseja justificar esta falta? Ela NÃO será descontada na folha.')) return;
    try {
        await window.db.collection('espelhos_ponto').doc(docId).update({ statusFalta: 'Justificada' });
        buscarAuditoriaPonto(); // recarrega a tabela
        mostrarMensagem('Falta justificada com sucesso!', 'success');
    } catch(e) {
        console.error(e);
        mostrarMensagem('Erro ao justificar.', 'error');
    }
}

async function desfazerFalta(docId) {
    try {
        await window.db.collection('espelhos_ponto').doc(docId).update({ statusFalta: firebase.firestore.FieldValue.delete() });
        buscarAuditoriaPonto();
    } catch(e) { console.error(e); }
}

async function aprovarHoraExtra(docId) {
    try {
        await window.db.collection('espelhos_ponto').doc(docId).update({ statusAprovacaoHe: 'Aprovada' });
        buscarAuditoriaPonto();
    } catch(e) { console.error(e); }
}

async function descartarHoraExtra(docId) {
    if (!confirm('Descartar essa hora extra? Ela não será paga na folha.')) return;
    try {
        await window.db.collection('espelhos_ponto').doc(docId).update({ statusAprovacaoHe: 'Descartada' });
        buscarAuditoriaPonto();
    } catch(e) { console.error(e); }
}

async function desfazerHe(docId) {
    try {
        await window.db.collection('espelhos_ponto').doc(docId).update({ statusAprovacaoHe: firebase.firestore.FieldValue.delete() });
        buscarAuditoriaPonto();
    } catch(e) { console.error(e); }
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


async function gerarEspelhoPDF() {
    const cpf = document.getElementById('rhid-auditoria-funcionario').value;
    const dtInicio = document.getElementById('rhid-auditoria-inicio').value;
    const dtFim = document.getElementById('rhid-auditoria-fim').value;

    if (!cpf || !dtInicio || !dtFim) {
        mostrarMensagem('Selecione o funcionário e o período para gerar o PDF.', 'warning');
        return;
    }

    try {
        mostrarMensagem('Gerando PDF...', 'info');

        // Buscar dados do funcionário
        const funcSnap = await window.db.collection('funcionarios').where('cpf', '==', cpf).get();
        if (funcSnap.empty) throw new Error('Funcionário não encontrado no banco.');
        
        let funcionario = null;
        funcSnap.forEach(doc => funcionario = doc.data());

        // Buscar empresa
        let empresaData = { razaoSocial: '', cnpj: '', cei: '', enderecoText: '' };
        if (funcionario.empresaId) {
            const empSnap = await window.db.collection('empresas').doc(funcionario.empresaId).get();
            if (empSnap.exists) {
                const e = empSnap.data();
                empresaData.razaoSocial = e.razaoSocial || e.nomeFantasia || '';
                empresaData.cnpj = e.cnpj || '';
                empresaData.cei = e.cei || '';
                empresaData.enderecoText = '';
                if (e.endereco) {
                    empresaData.enderecoText = `${e.endereco.logradouro || ''}, ${e.endereco.numero || ''} - ${e.endereco.bairro || ''} - ${e.endereco.cidade || ''}/${e.endereco.uf || ''}`;
                }
            }
        }

        // Buscar espelhos (ponto)
        const espelhosSnap = await window.db.collection('espelhos_ponto').where('cpf', '==', cpf).get();
        let docsFiltrados = [];
        espelhosSnap.forEach(doc => {
            const data = doc.data();
            if (data.dataReferencia >= dtInicio && data.dataReferencia <= dtFim) {
                docsFiltrados.push(data);
            }
        });

        if (docsFiltrados.length === 0) {
            mostrarMensagem('Nenhum registro encontrado neste período para gerar o PDF.', 'warning');
            return;
        }

        // Ordenar
        docsFiltrados.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));

        const formatDate = (dateStr) => dateStr.split('-').reverse().join('/');
        const getWeekday = (dateStr) => {
            const d = new Date(dateStr + 'T00:00:00');
            const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
            return dias[d.getDay()];
        };

        let tableRows = '';

        docsFiltrados.forEach(m => {
            const diaSemana = getWeekday(m.dataReferencia);
            const dataFormatada = formatDate(m.dataReferencia);
            
            // Batidas
            let batidasStr = '';
            let ent1='', sai1='', ent2='', sai2='', ent3='', sai3='';
            let tratamentos = [];

            if (m.marcacoes && m.marcacoes.length > 0) {
                const mb = [...m.marcacoes].sort((a, b) => {
                    const valA = (a && a.hora) ? String(a.hora) : String(a);
                    const valB = (b && b.hora) ? String(b.hora) : String(b);
                    return valA.localeCompare(valB);
                });

                batidasStr = mb.map(b => {
                    const val = (b && b.hora) ? String(b.hora) : String(b);
                    return val.substring(0, 5);
                }).join(' ');

                // Preencher JORNADA REALIZADA
                if (mb.length > 0) ent1 = ((mb[0] && mb[0].hora) ? String(mb[0].hora) : String(mb[0])).substring(0, 5);
                if (mb.length > 1) sai1 = ((mb[1] && mb[1].hora) ? String(mb[1].hora) : String(mb[1])).substring(0, 5);
                if (mb.length > 2) ent2 = ((mb[2] && mb[2].hora) ? String(mb[2].hora) : String(mb[2])).substring(0, 5);
                if (mb.length > 3) sai2 = ((mb[3] && mb[3].hora) ? String(mb[3].hora) : String(mb[3])).substring(0, 5);
                if (mb.length > 4) ent3 = ((mb[4] && mb[4].hora) ? String(mb[4].hora) : String(mb[4])).substring(0, 5);
                if (mb.length > 5) sai3 = ((mb[5] && mb[5].hora) ? String(mb[5].hora) : String(mb[5])).substring(0, 5);

                // TRATAMENTOS EFETUADOS
                mb.forEach(b => {
                    let h = (b && b.hora) ? String(b.hora).substring(0, 5) : String(b).substring(0, 5);
                    let tipo = 'I'; // default Included
                    let motivo = 'MARCAÇÃO IDFACE/IDFLEX';
                    
                    if (b && typeof b === 'object') {
                        // Adaptar se a API enviar flag de pré-assinalado ou autom.
                        if (b.preAssinalado) { tipo = 'P'; motivo = 'BATIDA AUTOMÁTICA'; }
                        if (b.desconsiderado) { tipo = 'D'; motivo = 'DESCONSIDERADO'; }
                    }
                    
                    tratamentos.push(`<tr>
                        <td style="border: none; padding: 0 4px; font-size: 10px;">${h}</td>
                        <td style="border: none; padding: 0 4px; font-size: 10px; text-align: center;">${tipo}</td>
                        <td style="border: none; padding: 0 4px; font-size: 10px;">${motivo}</td>
                    </tr>`);
                });
            }

            const duracao = Number(m.horasTrabalhadas || 0) > 0 ? 
                `${Math.floor(m.horasTrabalhadas / 60).toString().padStart(2, '0')}:${(m.horasTrabalhadas % 60).toString().padStart(2, '0')}` : '';

            tableRows += `
                <tr>
                    <td>${dataFormatada} - ${diaSemana}</td>
                    <td>${batidasStr}</td>
                    <td>${ent1}</td>
                    <td>${sai1}</td>
                    <td>${ent2}</td>
                    <td>${sai2}</td>
                    <td>${ent3}</td>
                    <td>${sai3}</td>
                    <td>${duracao}</td>
                    <td>00004</td>
                    <td style="padding: 0;">
                        <table style="width: 100%; margin: 0; border: none;">${tratamentos.join('')}</table>
                    </td>
                </tr>
            `;
        });

        // HTML final
        const html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Espelho de Ponto Eletrônico</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 11px;
                        color: #333;
                        margin: 0;
                        padding: 20px;
                    }
                    .header-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        border-bottom: 2px solid #ccc;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                    }
                    .title {
                        font-size: 24px;
                        font-weight: bold;
                        line-height: 1.1;
                        color: #4a4a4a;
                    }
                    .period {
                        font-size: 14px;
                        font-weight: bold;
                        color: #b00;
                    }
                    .info-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .info-table td {
                        padding: 4px 0;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #555;
                    }
                    .main-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        text-align: left;
                    }
                    .main-table th, .main-table td {
                        border-bottom: 1px solid #ddd;
                        padding: 6px 4px;
                        vertical-align: top;
                    }
                    .main-table th {
                        font-size: 9px;
                        font-weight: bold;
                        text-transform: uppercase;
                        color: #555;
                    }
                    .group-header {
                        text-align: center !important;
                        border-bottom: 1px solid #555 !important;
                    }
                    .legend {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 30px;
                    }
                    .contract-table {
                        width: 50%;
                        border-collapse: collapse;
                        margin-bottom: 50px;
                    }
                    .contract-table th, .contract-table td {
                        border-bottom: 1px solid #ddd;
                        padding: 4px;
                        text-align: left;
                        font-size: 10px;
                    }
                    .signatures {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 50px;
                    }
                    .signature-line {
                        width: 45%;
                        border-top: 1px solid #333;
                        text-align: center;
                        padding-top: 5px;
                        font-size: 10px;
                        color: #555;
                    }
                    @media print {
                        body { margin: 0; padding: 0; }
                        @page { size: landscape; margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header-top">
                    <div class="title">Espelho<br><span style="font-weight: normal; font-size: 20px;">de Ponto Eletrônico</span></div>
                    <div class="period">DE ${formatDate(dtInicio)} ATÉ ${formatDate(dtFim)}</div>
                </div>

                <table class="info-table">
                    <tr>
                        <td colspan="2"><span class="info-label">EMPRESA:</span> ${empresaData.razaoSocial}</td>
                        <td><span class="info-label">CNPJ:</span> ${empresaData.cnpj}</td>
                        <td><span class="info-label">CEI:</span> ${empresaData.cei || '-'}</td>
                    </tr>
                    <tr>
                        <td colspan="4"><span class="info-label">ENDEREÇO:</span> ${empresaData.enderecoText || '-'}</td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="info-label">NOME:</span> ${funcionario.nome}</td>
                        <td><span class="info-label">PIS/PASEP:</span> ${funcionario.pis || '-'}</td>
                        <td><span class="info-label">ADMISSÃO:</span> ${funcionario.dataAdmissao ? formatDate(funcionario.dataAdmissao) : '-'}</td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="info-label">CENTRO DE CUSTO:</span> ${funcionario.centroCusto || '-'}</td>
                        <td><span class="info-label">CPF:</span> ${funcionario.cpf}</td>
                        <td><span class="info-label">MATRÍCULA:</span> ${funcionario.matricula || '-'}</td>
                    </tr>
                    <tr>
                        <td colspan="2"><span class="info-label">DEPARTAMENTO:</span> ${funcionario.setor || '-'}</td>
                        <td colspan="2"><span class="info-label">CARGO:</span> ${funcionario.cargo || '-'}</td>
                    </tr>
                </table>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th rowspan="2">DIA</th>
                            <th rowspan="2">MARCAÇÕES REGISTRADAS<br>NO PONTO ELETRÔNICO</th>
                            <th colspan="6" class="group-header">JORNADA REALIZADA</th>
                            <th rowspan="2">DURAÇÃO</th>
                            <th rowspan="2">CH</th>
                            <th rowspan="2">TRATAMENTOS EFETUADOS SOBRE OS DADOS ORIGINAIS<br>
                                <div style="display: flex; gap: 20px; font-weight: normal; margin-top: 4px;">
                                    <span>HORÁRIO</span> <span>OCORR</span> <span>MOTIVO</span>
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th>ENT. 1</th>
                            <th>SAÍ. 1</th>
                            <th>ENT. 2</th>
                            <th>SAÍ. 2</th>
                            <th>ENT. 3</th>
                            <th>SAÍ. 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <div class="legend">
                    (I)=Incluído, (P)=Pré-assinalado, (D)=Desconsiderado
                </div>

                <div style="font-size: 18px; color: #555; margin-bottom: 10px;">
                    Horários Contratuais<br>do Empregado
                </div>
                <table class="contract-table">
                    <thead>
                        <tr>
                            <th>CÓDIGO DO HORÁRIO(CH)</th>
                            <th>ENT</th>
                            <th>SAÍ</th>
                            <th>ENT</th>
                            <th>SAÍ</th>
                            <th>ENT</th>
                            <th>SAÍ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>00004</td>
                            <td>08:00</td>
                            <td>12:00</td>
                            <td>13:00</td>
                            <td>18:03</td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="signature-line">${funcionario.nome}</div>
                    <div class="signature-line">${empresaData.razaoSocial}</div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for styles and fonts to load
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };

    } catch (e) {
        console.error(e);
        mostrarMensagem('Erro ao gerar o PDF.', 'error');
    }
}
