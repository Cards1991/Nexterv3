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
a s y n c   f u n c t i o n   g e r a r E s p e l h o P D F ( )   {  
         c o n s t   c p f   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' r h i d - a u d i t o r i a - f u n c i o n a r i o ' ) . v a l u e ;  
         c o n s t   d t I n i c i o   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' r h i d - a u d i t o r i a - i n i c i o ' ) . v a l u e ;  
         c o n s t   d t F i m   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' r h i d - a u d i t o r i a - f i m ' ) . v a l u e ;  
  
         i f   ( ! c p f   | |   ! d t I n i c i o   | |   ! d t F i m )   {  
                 m o s t r a r M e n s a g e m ( ' S e l e c i o n e   o   f u n c i o n � � r i o   e   o   p e r � � o d o   p a r a   g e r a r   o   P D F . ' ,   ' w a r n i n g ' ) ;  
                 r e t u r n ;  
         }  
  
         t r y   {  
                 m o s t r a r M e n s a g e m ( ' G e r a n d o   P D F . . . ' ,   ' i n f o ' ) ;  
  
                 / /   B u s c a r   d a d o s   d o   f u n c i o n � � r i o  
                 c o n s t   f u n c S n a p   =   a w a i t   w i n d o w . d b . c o l l e c t i o n ( ' f u n c i o n a r i o s ' ) . w h e r e ( ' c p f ' ,   ' = = ' ,   c p f ) . g e t ( ) ;  
                 i f   ( f u n c S n a p . e m p t y )   t h r o w   n e w   E r r o r ( ' F u n c i o n � � r i o   n � � o   e n c o n t r a d o   n o   b a n c o . ' ) ;  
                  
                 l e t   f u n c i o n a r i o   =   n u l l ;  
                 f u n c S n a p . f o r E a c h ( d o c   = >   f u n c i o n a r i o   =   d o c . d a t a ( ) ) ;  
  
                 / /   B u s c a r   e m p r e s a  
                 l e t   e m p r e s a D a t a   =   {   r a z a o S o c i a l :   ' ' ,   c n p j :   ' ' ,   c e i :   ' ' ,   e n d e r e c o T e x t :   ' '   } ;  
                 i f   ( f u n c i o n a r i o . e m p r e s a I d )   {  
                         c o n s t   e m p S n a p   =   a w a i t   w i n d o w . d b . c o l l e c t i o n ( ' e m p r e s a s ' ) . d o c ( f u n c i o n a r i o . e m p r e s a I d ) . g e t ( ) ;  
                         i f   ( e m p S n a p . e x i s t s )   {  
                                 c o n s t   e   =   e m p S n a p . d a t a ( ) ;  
                                 e m p r e s a D a t a . r a z a o S o c i a l   =   e . r a z a o S o c i a l   | |   e . n o m e F a n t a s i a   | |   ' ' ;  
                                 e m p r e s a D a t a . c n p j   =   e . c n p j   | |   ' ' ;  
                                 e m p r e s a D a t a . c e i   =   e . c e i   | |   ' ' ;  
                                 e m p r e s a D a t a . e n d e r e c o T e x t   =   ' ' ;  
                                 i f   ( e . e n d e r e c o )   {  
                                         e m p r e s a D a t a . e n d e r e c o T e x t   =   ` $ { e . e n d e r e c o . l o g r a d o u r o   | |   ' ' } ,   $ { e . e n d e r e c o . n u m e r o   | |   ' ' }   -   $ { e . e n d e r e c o . b a i r r o   | |   ' ' }   -   $ { e . e n d e r e c o . c i d a d e   | |   ' ' } / $ { e . e n d e r e c o . u f   | |   ' ' } ` ;  
                                 }  
                         }  
                 }  
  
                 / /   B u s c a r   e s p e l h o s   ( p o n t o )  
                 c o n s t   e s p e l h o s S n a p   =   a w a i t   w i n d o w . d b . c o l l e c t i o n ( ' e s p e l h o s _ p o n t o ' ) . w h e r e ( ' c p f ' ,   ' = = ' ,   c p f ) . g e t ( ) ;  
                 l e t   d o c s F i l t r a d o s   =   [ ] ;  
                 e s p e l h o s S n a p . f o r E a c h ( d o c   = >   {  
                         c o n s t   d a t a   =   d o c . d a t a ( ) ;  
                         i f   ( d a t a . d a t a R e f e r e n c i a   > =   d t I n i c i o   & &   d a t a . d a t a R e f e r e n c i a   < =   d t F i m )   {  
                                 d o c s F i l t r a d o s . p u s h ( d a t a ) ;  
                         }  
                 } ) ;  
  
                 i f   ( d o c s F i l t r a d o s . l e n g t h   = = =   0 )   {  
                         m o s t r a r M e n s a g e m ( ' N e n h u m   r e g i s t r o   e n c o n t r a d o   n e s t e   p e r � � o d o   p a r a   g e r a r   o   P D F . ' ,   ' w a r n i n g ' ) ;  
                         r e t u r n ;  
                 }  
  
                 / /   O r d e n a r  
                 d o c s F i l t r a d o s . s o r t ( ( a ,   b )   = >   a . d a t a R e f e r e n c i a . l o c a l e C o m p a r e ( b . d a t a R e f e r e n c i a ) ) ;  
  
                 c o n s t   f o r m a t D a t e   =   ( d a t e S t r )   = >   d a t e S t r . s p l i t ( ' - ' ) . r e v e r s e ( ) . j o i n ( ' / ' ) ;  
                 c o n s t   g e t W e e k d a y   =   ( d a t e S t r )   = >   {  
                         c o n s t   d   =   n e w   D a t e ( d a t e S t r   +   ' T 0 0 : 0 0 : 0 0 ' ) ;  
                         c o n s t   d i a s   =   [ ' D O M ' ,   ' S E G ' ,   ' T E R ' ,   ' Q U A ' ,   ' Q U I ' ,   ' S E X ' ,   ' S A B ' ] ;  
                         r e t u r n   d i a s [ d . g e t D a y ( ) ] ;  
                 } ;  
  
                 l e t   t a b l e R o w s   =   ' ' ;  
  
                 d o c s F i l t r a d o s . f o r E a c h ( m   = >   {  
                         c o n s t   d i a S e m a n a   =   g e t W e e k d a y ( m . d a t a R e f e r e n c i a ) ;  
                         c o n s t   d a t a F o r m a t a d a   =   f o r m a t D a t e ( m . d a t a R e f e r e n c i a ) ;  
                          
                         / /   B a t i d a s  
                         l e t   b a t i d a s S t r   =   ' ' ;  
                         l e t   e n t 1 = ' ' ,   s a i 1 = ' ' ,   e n t 2 = ' ' ,   s a i 2 = ' ' ,   e n t 3 = ' ' ,   s a i 3 = ' ' ;  
                         l e t   t r a t a m e n t o s   =   [ ] ;  
  
                         i f   ( m . m a r c a c o e s   & &   m . m a r c a c o e s . l e n g t h   >   0 )   {  
                                 c o n s t   m b   =   [ . . . m . m a r c a c o e s ] . s o r t ( ( a ,   b )   = >   {  
                                         c o n s t   v a l A   =   ( a   & &   a . h o r a )   ?   S t r i n g ( a . h o r a )   :   S t r i n g ( a ) ;  
                                         c o n s t   v a l B   =   ( b   & &   b . h o r a )   ?   S t r i n g ( b . h o r a )   :   S t r i n g ( b ) ;  
                                         r e t u r n   v a l A . l o c a l e C o m p a r e ( v a l B ) ;  
                                 } ) ;  
  
                                 b a t i d a s S t r   =   m b . m a p ( b   = >   {  
                                         c o n s t   v a l   =   ( b   & &   b . h o r a )   ?   S t r i n g ( b . h o r a )   :   S t r i n g ( b ) ;  
                                         r e t u r n   v a l . s u b s t r i n g ( 0 ,   5 ) ;  
                                 } ) . j o i n ( '   ' ) ;  
  
                                 / /   P r e e n c h e r   J O R N A D A   R E A L I Z A D A  
                                 i f   ( m b . l e n g t h   >   0 )   e n t 1   =   ( ( m b [ 0 ]   & &   m b [ 0 ] . h o r a )   ?   S t r i n g ( m b [ 0 ] . h o r a )   :   S t r i n g ( m b [ 0 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                 i f   ( m b . l e n g t h   >   1 )   s a i 1   =   ( ( m b [ 1 ]   & &   m b [ 1 ] . h o r a )   ?   S t r i n g ( m b [ 1 ] . h o r a )   :   S t r i n g ( m b [ 1 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                 i f   ( m b . l e n g t h   >   2 )   e n t 2   =   ( ( m b [ 2 ]   & &   m b [ 2 ] . h o r a )   ?   S t r i n g ( m b [ 2 ] . h o r a )   :   S t r i n g ( m b [ 2 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                 i f   ( m b . l e n g t h   >   3 )   s a i 2   =   ( ( m b [ 3 ]   & &   m b [ 3 ] . h o r a )   ?   S t r i n g ( m b [ 3 ] . h o r a )   :   S t r i n g ( m b [ 3 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                 i f   ( m b . l e n g t h   >   4 )   e n t 3   =   ( ( m b [ 4 ]   & &   m b [ 4 ] . h o r a )   ?   S t r i n g ( m b [ 4 ] . h o r a )   :   S t r i n g ( m b [ 4 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                 i f   ( m b . l e n g t h   >   5 )   s a i 3   =   ( ( m b [ 5 ]   & &   m b [ 5 ] . h o r a )   ?   S t r i n g ( m b [ 5 ] . h o r a )   :   S t r i n g ( m b [ 5 ] ) ) . s u b s t r i n g ( 0 ,   5 ) ;  
  
                                 / /   T R A T A M E N T O S   E F E T U A D O S  
                                 m b . f o r E a c h ( b   = >   {  
                                         l e t   h   =   ( b   & &   b . h o r a )   ?   S t r i n g ( b . h o r a ) . s u b s t r i n g ( 0 ,   5 )   :   S t r i n g ( b ) . s u b s t r i n g ( 0 ,   5 ) ;  
                                         l e t   t i p o   =   ' I ' ;   / /   d e f a u l t   I n c l u d e d  
                                         l e t   m o t i v o   =   ' M A R C A � ! � �O   I D F A C E / I D F L E X ' ;  
                                          
                                         i f   ( b   & &   t y p e o f   b   = = =   ' o b j e c t ' )   {  
                                                 / /   A d a p t a r   s e   a   A P I   e n v i a r   f l a g   d e   p r � � - a s s i n a l a d o   o u   a u t o m .  
                                                 i f   ( b . p r e A s s i n a l a d o )   {   t i p o   =   ' P ' ;   m o t i v o   =   ' B A T I D A   A U T O M � � T I C A ' ;   }  
                                                 i f   ( b . d e s c o n s i d e r a d o )   {   t i p o   =   ' D ' ;   m o t i v o   =   ' D E S C O N S I D E R A D O ' ;   }  
                                         }  
                                          
                                         t r a t a m e n t o s . p u s h ( ` < t r >  
                                                 < t d   s t y l e = " b o r d e r :   n o n e ;   p a d d i n g :   0   4 p x ;   f o n t - s i z e :   1 0 p x ; " > $ { h } < / t d >  
                                                 < t d   s t y l e = " b o r d e r :   n o n e ;   p a d d i n g :   0   4 p x ;   f o n t - s i z e :   1 0 p x ;   t e x t - a l i g n :   c e n t e r ; " > $ { t i p o } < / t d >  
                                                 < t d   s t y l e = " b o r d e r :   n o n e ;   p a d d i n g :   0   4 p x ;   f o n t - s i z e :   1 0 p x ; " > $ { m o t i v o } < / t d >  
                                         < / t r > ` ) ;  
                                 } ) ;  
                         }  
  
                         c o n s t   d u r a c a o   =   N u m b e r ( m . h o r a s T r a b a l h a d a s   | |   0 )   >   0   ?    
                                 ` $ { M a t h . f l o o r ( m . h o r a s T r a b a l h a d a s   /   6 0 ) . t o S t r i n g ( ) . p a d S t a r t ( 2 ,   ' 0 ' ) } : $ { ( m . h o r a s T r a b a l h a d a s   %   6 0 ) . t o S t r i n g ( ) . p a d S t a r t ( 2 ,   ' 0 ' ) } `   :   ' ' ;  
  
                         t a b l e R o w s   + =   `  
                                 < t r >  
                                         < t d > $ { d a t a F o r m a t a d a }   -   $ { d i a S e m a n a } < / t d >  
                                         < t d > $ { b a t i d a s S t r } < / t d >  
                                         < t d > $ { e n t 1 } < / t d >  
                                         < t d > $ { s a i 1 } < / t d >  
                                         < t d > $ { e n t 2 } < / t d >  
                                         < t d > $ { s a i 2 } < / t d >  
                                         < t d > $ { e n t 3 } < / t d >  
                                         < t d > $ { s a i 3 } < / t d >  
                                         < t d > $ { d u r a c a o } < / t d >  
                                         < t d > 0 0 0 0 4 < / t d >  
                                         < t d   s t y l e = " p a d d i n g :   0 ; " >  
                                                 < t a b l e   s t y l e = " w i d t h :   1 0 0 % ;   m a r g i n :   0 ;   b o r d e r :   n o n e ; " > $ { t r a t a m e n t o s . j o i n ( ' ' ) } < / t a b l e >  
                                         < / t d >  
                                 < / t r >  
                         ` ;  
                 } ) ;  
  
                 / /   H T M L   f i n a l  
                 c o n s t   h t m l   =   `  
                         < ! D O C T Y P E   h t m l >  
                         < h t m l   l a n g = " p t - B R " >  
                         < h e a d >  
                                 < m e t a   c h a r s e t = " U T F - 8 " >  
                                 < t i t l e > E s p e l h o   d e   P o n t o   E l e t r � � n i c o < / t i t l e >  
                                 < s t y l e >  
                                         b o d y   {  
                                                 f o n t - f a m i l y :   ' A r i a l ' ,   s a n s - s e r i f ;  
                                                 f o n t - s i z e :   1 1 p x ;  
                                                 c o l o r :   # 3 3 3 ;  
                                                 m a r g i n :   0 ;  
                                                 p a d d i n g :   2 0 p x ;  
                                         }  
                                         . h e a d e r - t o p   {  
                                                 d i s p l a y :   f l e x ;  
                                                 j u s t i f y - c o n t e n t :   s p a c e - b e t w e e n ;  
                                                 a l i g n - i t e m s :   f l e x - e n d ;  
                                                 b o r d e r - b o t t o m :   2 p x   s o l i d   # c c c ;  
                                                 p a d d i n g - b o t t o m :   5 p x ;  
                                                 m a r g i n - b o t t o m :   1 0 p x ;  
                                         }  
                                         . t i t l e   {  
                                                 f o n t - s i z e :   2 4 p x ;  
                                                 f o n t - w e i g h t :   b o l d ;  
                                                 l i n e - h e i g h t :   1 . 1 ;  
                                                 c o l o r :   # 4 a 4 a 4 a ;  
                                         }  
                                         . p e r i o d   {  
                                                 f o n t - s i z e :   1 4 p x ;  
                                                 f o n t - w e i g h t :   b o l d ;  
                                                 c o l o r :   # b 0 0 ;  
                                         }  
                                         . i n f o - t a b l e   {  
                                                 w i d t h :   1 0 0 % ;  
                                                 b o r d e r - c o l l a p s e :   c o l l a p s e ;  
                                                 m a r g i n - b o t t o m :   2 0 p x ;  
                                         }  
                                         . i n f o - t a b l e   t d   {  
                                                 p a d d i n g :   4 p x   0 ;  
                                                 b o r d e r - b o t t o m :   1 p x   s o l i d   # e 0 e 0 e 0 ;  
                                         }  
                                         . i n f o - l a b e l   {  
                                                 f o n t - w e i g h t :   b o l d ;  
                                                 c o l o r :   # 5 5 5 ;  
                                         }  
                                         . m a i n - t a b l e   {  
                                                 w i d t h :   1 0 0 % ;  
                                                 b o r d e r - c o l l a p s e :   c o l l a p s e ;  
                                                 m a r g i n - b o t t o m :   2 0 p x ;  
                                                 t e x t - a l i g n :   l e f t ;  
                                         }  
                                         . m a i n - t a b l e   t h ,   . m a i n - t a b l e   t d   {  
                                                 b o r d e r - b o t t o m :   1 p x   s o l i d   # d d d ;  
                                                 p a d d i n g :   6 p x   4 p x ;  
                                                 v e r t i c a l - a l i g n :   t o p ;  
                                         }  
                                         . m a i n - t a b l e   t h   {  
                                                 f o n t - s i z e :   9 p x ;  
                                                 f o n t - w e i g h t :   b o l d ;  
                                                 t e x t - t r a n s f o r m :   u p p e r c a s e ;  
                                                 c o l o r :   # 5 5 5 ;  
                                         }  
                                         . g r o u p - h e a d e r   {  
                                                 t e x t - a l i g n :   c e n t e r   ! i m p o r t a n t ;  
                                                 b o r d e r - b o t t o m :   1 p x   s o l i d   # 5 5 5   ! i m p o r t a n t ;  
                                         }  
                                         . l e g e n d   {  
                                                 f o n t - s i z e :   1 0 p x ;  
                                                 c o l o r :   # 6 6 6 ;  
                                                 m a r g i n - b o t t o m :   3 0 p x ;  
                                         }  
                                         . c o n t r a c t - t a b l e   {  
                                                 w i d t h :   5 0 % ;  
                                                 b o r d e r - c o l l a p s e :   c o l l a p s e ;  
                                                 m a r g i n - b o t t o m :   5 0 p x ;  
                                         }  
                                         . c o n t r a c t - t a b l e   t h ,   . c o n t r a c t - t a b l e   t d   {  
                                                 b o r d e r - b o t t o m :   1 p x   s o l i d   # d d d ;  
                                                 p a d d i n g :   4 p x ;  
                                                 t e x t - a l i g n :   l e f t ;  
                                                 f o n t - s i z e :   1 0 p x ;  
                                         }  
                                         . s i g n a t u r e s   {  
                                                 d i s p l a y :   f l e x ;  
                                                 j u s t i f y - c o n t e n t :   s p a c e - b e t w e e n ;  
                                                 m a r g i n - t o p :   5 0 p x ;  
                                         }  
                                         . s i g n a t u r e - l i n e   {  
                                                 w i d t h :   4 5 % ;  
                                                 b o r d e r - t o p :   1 p x   s o l i d   # 3 3 3 ;  
                                                 t e x t - a l i g n :   c e n t e r ;  
                                                 p a d d i n g - t o p :   5 p x ;  
                                                 f o n t - s i z e :   1 0 p x ;  
                                                 c o l o r :   # 5 5 5 ;  
                                         }  
                                         @ m e d i a   p r i n t   {  
                                                 b o d y   {   m a r g i n :   0 ;   p a d d i n g :   0 ;   }  
                                                 @ p a g e   {   s i z e :   l a n d s c a p e ;   m a r g i n :   1 c m ;   }  
                                         }  
                                 < / s t y l e >  
                         < / h e a d >  
                         < b o d y >  
                                 < d i v   c l a s s = " h e a d e r - t o p " >  
                                         < d i v   c l a s s = " t i t l e " > E s p e l h o < b r > < s p a n   s t y l e = " f o n t - w e i g h t :   n o r m a l ;   f o n t - s i z e :   2 0 p x ; " > d e   P o n t o   E l e t r � � n i c o < / s p a n > < / d i v >  
                                         < d i v   c l a s s = " p e r i o d " > D E   $ { f o r m a t D a t e ( d t I n i c i o ) }   A T � 0   $ { f o r m a t D a t e ( d t F i m ) } < / d i v >  
                                 < / d i v >  
  
                                 < t a b l e   c l a s s = " i n f o - t a b l e " >  
                                         < t r >  
                                                 < t d   c o l s p a n = " 2 " > < s p a n   c l a s s = " i n f o - l a b e l " > E M P R E S A : < / s p a n >   $ { e m p r e s a D a t a . r a z a o S o c i a l } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > C N P J : < / s p a n >   $ { e m p r e s a D a t a . c n p j } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > C E I : < / s p a n >   $ { e m p r e s a D a t a . c e i   | |   ' - ' } < / t d >  
                                         < / t r >  
                                         < t r >  
                                                 < t d   c o l s p a n = " 4 " > < s p a n   c l a s s = " i n f o - l a b e l " > E N D E R E � ! O : < / s p a n >   $ { e m p r e s a D a t a . e n d e r e c o T e x t   | |   ' - ' } < / t d >  
                                         < / t r >  
                                         < t r >  
                                                 < t d   c o l s p a n = " 2 " > < s p a n   c l a s s = " i n f o - l a b e l " > N O M E : < / s p a n >   $ { f u n c i o n a r i o . n o m e } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > P I S / P A S E P : < / s p a n >   $ { f u n c i o n a r i o . p i s   | |   ' - ' } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > A D M I S S � �O : < / s p a n >   $ { f u n c i o n a r i o . d a t a A d m i s s a o   ?   f o r m a t D a t e ( f u n c i o n a r i o . d a t a A d m i s s a o )   :   ' - ' } < / t d >  
                                         < / t r >  
                                         < t r >  
                                                 < t d   c o l s p a n = " 2 " > < s p a n   c l a s s = " i n f o - l a b e l " > C E N T R O   D E   C U S T O : < / s p a n >   $ { f u n c i o n a r i o . c e n t r o C u s t o   | |   ' - ' } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > C P F : < / s p a n >   $ { f u n c i o n a r i o . c p f } < / t d >  
                                                 < t d > < s p a n   c l a s s = " i n f o - l a b e l " > M A T R � � C U L A : < / s p a n >   $ { f u n c i o n a r i o . m a t r i c u l a   | |   ' - ' } < / t d >  
                                         < / t r >  
                                         < t r >  
                                                 < t d   c o l s p a n = " 2 " > < s p a n   c l a s s = " i n f o - l a b e l " > D E P A R T A M E N T O : < / s p a n >   $ { f u n c i o n a r i o . s e t o r   | |   ' - ' } < / t d >  
                                                 < t d   c o l s p a n = " 2 " > < s p a n   c l a s s = " i n f o - l a b e l " > C A R G O : < / s p a n >   $ { f u n c i o n a r i o . c a r g o   | |   ' - ' } < / t d >  
                                         < / t r >  
                                 < / t a b l e >  
  
                                 < t a b l e   c l a s s = " m a i n - t a b l e " >  
                                         < t h e a d >  
                                                 < t r >  
                                                         < t h   r o w s p a n = " 2 " > D I A < / t h >  
                                                         < t h   r o w s p a n = " 2 " > M A R C A � ! � " E S   R E G I S T R A D A S < b r > N O   P O N T O   E L E T R �  N I C O < / t h >  
                                                         < t h   c o l s p a n = " 6 "   c l a s s = " g r o u p - h e a d e r " > J O R N A D A   R E A L I Z A D A < / t h >  
                                                         < t h   r o w s p a n = " 2 " > D U R A � ! � �O < / t h >  
                                                         < t h   r o w s p a n = " 2 " > C H < / t h >  
                                                         < t h   r o w s p a n = " 2 " > T R A T A M E N T O S   E F E T U A D O S   S O B R E   O S   D A D O S   O R I G I N A I S < b r >  
                                                                 < d i v   s t y l e = " d i s p l a y :   f l e x ;   g a p :   2 0 p x ;   f o n t - w e i g h t :   n o r m a l ;   m a r g i n - t o p :   4 p x ; " >  
                                                                         < s p a n > H O R � � R I O < / s p a n >   < s p a n > O C O R R < / s p a n >   < s p a n > M O T I V O < / s p a n >  
                                                                 < / d i v >  
                                                         < / t h >  
                                                 < / t r >  
                                                 < t r >  
                                                         < t h > E N T .   1 < / t h >  
                                                         < t h > S A � � .   1 < / t h >  
                                                         < t h > E N T .   2 < / t h >  
                                                         < t h > S A � � .   2 < / t h >  
                                                         < t h > E N T .   3 < / t h >  
                                                         < t h > S A � � .   3 < / t h >  
                                                 < / t r >  
                                         < / t h e a d >  
                                         < t b o d y >  
                                                 $ { t a b l e R o w s }  
                                         < / t b o d y >  
                                 < / t a b l e >  
  
                                 < d i v   c l a s s = " l e g e n d " >  
                                         ( I ) = I n c l u � � d o ,   ( P ) = P r � � - a s s i n a l a d o ,   ( D ) = D e s c o n s i d e r a d o  
                                 < / d i v >  
  
                                 < d i v   s t y l e = " f o n t - s i z e :   1 8 p x ;   c o l o r :   # 5 5 5 ;   m a r g i n - b o t t o m :   1 0 p x ; " >  
                                         H o r � � r i o s   C o n t r a t u a i s < b r > d o   E m p r e g a d o  
                                 < / d i v >  
                                 < t a b l e   c l a s s = " c o n t r a c t - t a b l e " >  
                                         < t h e a d >  
                                                 < t r >  
                                                         < t h > C �  D I G O   D O   H O R � � R I O ( C H ) < / t h >  
                                                         < t h > E N T < / t h >  
                                                         < t h > S A � � < / t h >  
                                                         < t h > E N T < / t h >  
                                                         < t h > S A � � < / t h >  
                                                         < t h > E N T < / t h >  
                                                         < t h > S A � � < / t h >  
                                                 < / t r >  
                                         < / t h e a d >  
                                         < t b o d y >  
                                                 < t r >  
                                                         < t d > 0 0 0 0 4 < / t d >  
                                                         < t d > 0 8 : 0 0 < / t d >  
                                                         < t d > 1 2 : 0 0 < / t d >  
                                                         < t d > 1 3 : 0 0 < / t d >  
                                                         < t d > 1 8 : 0 3 < / t d >  
                                                         < t d > < / t d >  
                                                         < t d > < / t d >  
                                                 < / t r >  
                                         < / t b o d y >  
                                 < / t a b l e >  
  
                                 < d i v   c l a s s = " s i g n a t u r e s " >  
                                         < d i v   c l a s s = " s i g n a t u r e - l i n e " > $ { f u n c i o n a r i o . n o m e } < / d i v >  
                                         < d i v   c l a s s = " s i g n a t u r e - l i n e " > $ { e m p r e s a D a t a . r a z a o S o c i a l } < / d i v >  
                                 < / d i v >  
                         < / b o d y >  
                         < / h t m l >  
                 ` ;  
  
                 c o n s t   p r i n t W i n d o w   =   w i n d o w . o p e n ( ' ' ,   ' _ b l a n k ' ) ;  
                 p r i n t W i n d o w . d o c u m e n t . w r i t e ( h t m l ) ;  
                 p r i n t W i n d o w . d o c u m e n t . c l o s e ( ) ;  
                  
                 / /   W a i t   f o r   s t y l e s   a n d   f o n t s   t o   l o a d  
                 p r i n t W i n d o w . o n l o a d   =   ( )   = >   {  
                         s e t T i m e o u t ( ( )   = >   {  
                                 p r i n t W i n d o w . p r i n t ( ) ;  
                         } ,   5 0 0 ) ;  
                 } ;  
  
         }   c a t c h   ( e )   {  
                 c o n s o l e . e r r o r ( e ) ;  
                 m o s t r a r M e n s a g e m ( ' E r r o   a o   g e r a r   o   P D F . ' ,   ' e r r o r ' ) ;  
         }  
 }  
 