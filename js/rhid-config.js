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

                    // Alimentar autorizações de horas extras ("solicitacoes_horas") automaticamente
                    if (doc.horasExtrasCalculadas > 0) {
                        const solId = `rhid_he_${docId}`;
                        const solRef = window.db.collection('solicitacoes_horas').doc(solId);
                        
                        let dtStart = new Date(dateStr + 'T17:00:00'); // Fictício se não houver batida
                        let dtEnd = new Date(dateStr + 'T18:00:00');
                        
                        if (doc.listAfdtManutencao && doc.listAfdtManutencao.length >= 2) {
                            const ultima = doc.listAfdtManutencao[doc.listAfdtManutencao.length - 1].hora;
                            if (ultima) {
                                dtEnd = new Date(ultima);
                                dtStart = new Date(dtEnd.getTime() - (doc.horasExtrasCalculadas * 60000));
                            }
                        }

                        batch.set(solRef, {
                            employeeId: func.id,
                            employeeName: func.nome,
                            department: func.setor || 'Não Informado',
                            reason: 'Apuração Automática RHiD',
                            formaPagamento: 'folha',
                            start: firebase.firestore.Timestamp.fromDate(dtStart),
                            end: firebase.firestore.Timestamp.fromDate(dtEnd),
                            horasExtrasMinutos: doc.horasExtrasCalculadas,
                            status: 'pendente',
                            origem: 'RHiD',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdByName: 'Integração RHiD'
                        }, { merge: true }); 
                    }

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
            const horas = `${Math.floor(r.totalHeMinutos / 60).toString().padStart(2, '0')}:${(r.totalHeMinutos % 60).toString().padStart(2, '0')}`;
            let rankBadge = `<span class="badge bg-secondary rounded-circle px-2">${i+1}</span>`;
            if (i === 0) rankBadge = `<span class="badge bg-danger rounded-circle px-2 shadow-sm"><i class="fas fa-crown text-warning"></i> 1</span>`;
            else if (i === 1) rankBadge = `<span class="badge bg-warning text-dark rounded-circle px-2">2</span>`;
            else if (i === 2) rankBadge = `<span class="badge bg-info text-dark rounded-circle px-2">3</span>`;

            html += `
                <tr>
                    <td class="align-middle">${rankBadge}</td>
                    <td class="align-middle fw-semibold text-dark">${r.nome}</td>
                    <td class="align-middle font-monospace text-muted small">${r.cpf}</td>
                    <td class="align-middle text-center fw-bold text-success">${horas}</td>
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

        // Data selecionada ou Hoje
        const dataInput = document.getElementById('rhid-faltas-data')?.value;
        let hojeObj = new Date();
        if (dataInput) {
            hojeObj = new Date(dataInput + 'T00:00:00');
        }
        
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

                let actions = '';
                if (title === 'Faltas Injustificadas') {
                    actions = `
                    <div class="mt-2 p-2 bg-light rounded border border-danger border-opacity-25 falta-batch-item" data-id="${f.id}" data-nome="${f.nome.replace(/'/g, '&apos;')}" data-setor="${(f.setor || '').replace(/'/g, '&apos;')}">
                        <div class="row g-2">
                            <div class="col-12">
                                <select class="form-select form-select-sm bg-white border-0 shadow-sm falta-batch-motivo">
                                    <option value="">(Ignorar - Manter como Falta)</option>
                                    <option value="Falta Injustificada">Confirmar Falta Injustificada</option>
                                    <option value="Esquecimento de Batida">Esquecimento de Batida</option>
                                    <option value="Problema de Energia/Internet">Problema de Energia / Internet</option>
                                    <option value="Problema no Transporte">Problema no Transporte</option>
                                    <option value="Atraso Justificado">Atraso Justificado</option>
                                    <option value="Problemas Pessoais/Familiares">Problemas Pessoais / Familiares</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                            <div class="col-12">
                                <input type="text" class="form-control form-control-sm bg-white border-0 shadow-sm falta-batch-obs" placeholder="Obs (opcional)">
                            </div>
                        </div>
                    </div>`;
                }

                return `
                <div class="list-group-item py-2 px-3">
                    <div class="d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <div>
                                <div class="fw-bold text-dark small">${f.nome}</div>
                                <div class="text-muted" style="font-size: 0.75rem;"><i class="fas fa-building me-1"></i> ${f.setor || 'N/I'}</div>
                            </div>
                            <span class="badge bg-${colorClass} rounded-pill shadow-sm" style="font-size: 0.7rem;">${badgeText}</span>
                        </div>
                        ${extra}
                        ${actions}
                    </div>
                </div>`;
            }).join('');
            
            if (title === 'Faltas Injustificadas' && list.length > 0) {
                listHtml += `
                    <div class="list-group-item bg-light text-end p-3">
                        <button class="btn btn-danger fw-bold shadow-sm rounded-pill px-4" onclick="salvarLoteFaltasRhid()">
                            <i class="fas fa-save me-2"></i> Salvar Lote
                        </button>
                    </div>
                `;
            }

            return `
                <div class="card shadow-sm border-0 border-${colorClass} border-opacity-25 mb-3" style="border-radius: 12px;">
                    <div class="card-header bg-${colorClass} bg-opacity-10 text-${colorClass} border-0 fw-bold py-2 d-flex justify-content-between align-items-center" style="border-radius: 12px 12px 0 0;">
                        <div><i class="${icon} me-2"></i> ${list.length} ${title}</div>
                    </div>
                    <div class="card-body p-0">
                        <div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
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
    if (typeof inicializarModuloVisitantes === 'function') {
        await inicializarModuloVisitantes();
    }
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
            const heFormatado = heOriginal > 0 ? `${Math.floor(heOriginal / 60).toString().padStart(2, '0')}:${(heOriginal % 60).toString().padStart(2, '0')}` : '-';
            const faltaFormatado = faltaOriginal > 0 ? `${Math.floor(faltaOriginal / 60).toString().padStart(2, '0')}:${(faltaOriginal % 60).toString().padStart(2, '0')}` : '-';
            const trabalhadasOriginal = Number(m.horasTrabalhadas || 0);
            const trabalhadasFormatado = trabalhadasOriginal > 0 ? `${Math.floor(trabalhadasOriginal / 60).toString().padStart(2, '0')}:${(trabalhadasOriginal % 60).toString().padStart(2, '0')}` : '-';
            
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
                const extrairHora = (obj) => {
                    let s = (obj && obj.hora) ? String(obj.hora) : String(obj);
                    if (s.includes('T')) s = s.split('T')[1];
                    s = s.trim().substring(0, 5);
                    if (!s.includes(':')) {
                        let nums = s.replace(/\D/g, '');
                        if (nums.length === 3) nums = '0' + nums;
                        if (nums.length >= 4) return nums.substring(0, 2) + ':' + nums.substring(2, 4);
                    }
                    return s;
                };
                
                const mb = [...m.marcacoes].sort((a, b) => {
                    const valA = extrairHora(a);
                    const valB = extrairHora(b);
                    return valA > valB ? 1 : (valA < valB ? -1 : 0);
                });
                batidasStr = mb.map(b => {
                    return `<span class="badge bg-light text-dark border">${extrairHora(b)}</span>`;
                }).join(' ');
            }

            trs += `
                <tr>
                    <td class="fw-bold">${m.dataReferencia.split('-').reverse().join('/')}</td>
                    <td>${batidasStr}</td>
                    <td>${trabalhadasFormatado}</td>
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

async function enviarTudoFolhaPagamento() {
    const btn = document.getElementById('btn-enviar-folha');
    const dtInicio = document.getElementById('rhid-he-inicio').value;
    const dtFim = document.getElementById('rhid-he-fim').value;

    if (!dtInicio || !dtFim) {
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Selecione o período de início e fim (Filtro Local).', 'warning');
        } else {
            alert('Selecione o período de início e fim.');
        }
        return;
    }

    if (!confirm("Deseja aprovar todas as horas extras pendentes do RHiD neste período?")) {
        return;
    }

    try {
        btn.disabled = true;
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processando...';

        // Converter datas
        const startTimestamp = firebase.firestore.Timestamp.fromDate(new Date(dtInicio + 'T00:00:00'));
        const endTimestamp = firebase.firestore.Timestamp.fromDate(new Date(dtFim + 'T23:59:59'));

        // Buscar todas solicitações pendentes originadas do RHiD
        const snap = await window.db.collection('solicitacoes_horas')
            .where('origem', '==', 'RHiD')
            .where('status', '==', 'pendente')
            .get();

        if (snap.empty) {
            if (typeof mostrarMensagem === 'function') mostrarMensagem('Nenhuma hora extra pendente encontrada para este período.', 'info');
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
            return;
        }

        let batch = window.db.batch();
        let ops = 0;
        let aprovadas = 0;

        snap.forEach(doc => {
            const data = doc.data();
            const docStart = data.start;
            
            // Verificar se está no período
            if (docStart && docStart >= startTimestamp && docStart <= endTimestamp) {
                batch.update(doc.ref, {
                    status: 'aprovado',
                    aprovadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    aprovadoPor: 'Envio em Lote RHiD'
                });
                ops++;
                aprovadas++;

                if (ops === 400) {
                    batch.commit();
                    batch = window.db.batch();
                    ops = 0;
                }
            }
        });

        if (ops > 0) {
            await batch.commit();
        }

        if (aprovadas > 0) {
            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem(`Sucesso! ${aprovadas} solicitações aprovadas e prontas para a folha.`, 'success');
            } else {
                alert(`Sucesso! ${aprovadas} solicitações aprovadas e prontas para a folha.`);
            }
        } else {
            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem('Nenhuma hora extra pendente no período selecionado.', 'info');
            } else {
                alert('Nenhuma hora extra pendente no período selecionado.');
            }
        }
        
        btn.innerHTML = textoOriginal;

    } catch (e) {
        console.error("Erro ao enviar p/ folha:", e);
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Erro ao aprovar horas.', 'error');
        } else {
            alert('Erro ao aprovar horas.');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i> ENVIAR P/ FOLHA DE PAGAMENTO';
    }
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

        const formatDate = (date) => {
            if (!date) return '';
            if (typeof date === 'string') {
                if (date.includes('-')) return date.split('-').reverse().join('/');
                return date;
            }
            if (date.toDate && typeof date.toDate === 'function') {
                const d = date.toDate();
                return d.toLocaleDateString('pt-BR');
            }
            if (date instanceof Date) {
                return date.toLocaleDateString('pt-BR');
            }
            return String(date);
        };
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
                const extrairHora = (obj) => {
                    let s = (obj && obj.hora) ? String(obj.hora) : String(obj);
                    if (s.includes('T')) s = s.split('T')[1];
                    s = s.trim().substring(0, 5);
                    if (!s.includes(':')) {
                        let nums = s.replace(/\D/g, '');
                        if (nums.length === 3) nums = '0' + nums;
                        if (nums.length >= 4) return nums.substring(0, 2) + ':' + nums.substring(2, 4);
                    }
                    return s;
                };

                const mb = [...m.marcacoes].sort((a, b) => {
                    const valA = extrairHora(a);
                    const valB = extrairHora(b);
                    return valA > valB ? 1 : (valA < valB ? -1 : 0);
                });

                batidasStr = mb.map(b => extrairHora(b)).join(' ');

                // Preencher JORNADA REALIZADA
                if (mb.length > 0) ent1 = extrairHora(mb[0]);
                if (mb.length > 1) sai1 = extrairHora(mb[1]);
                if (mb.length > 2) ent2 = extrairHora(mb[2]);
                if (mb.length > 3) sai2 = extrairHora(mb[3]);
                if (mb.length > 4) ent3 = extrairHora(mb[4]);
                if (mb.length > 5) sai3 = extrairHora(mb[5]);

            }

            const duracao = Number(m.horasTrabalhadas || 0) > 0 ? 
                `${Math.floor(m.horasTrabalhadas / 60).toString().padStart(2, '0')}:${(m.horasTrabalhadas % 60).toString().padStart(2, '0')}` : '';

            const faltaM = Number(m.faltasAtrasos || 0);
            const faltaStr = faltaM > 0 ? 
                `${Math.floor(faltaM / 60).toString().padStart(2, '0')}:${(faltaM % 60).toString().padStart(2, '0')}` : '';

            const heM = Number(m.horasExtras || 0);
            const heStr = heM > 0 ? 
                `${Math.floor(heM / 60).toString().padStart(2, '0')}:${(heM % 60).toString().padStart(2, '0')}` : '';

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
                    <td class="${faltaM > 0 ? 'text-danger fw-bold' : ''}" style="${faltaM > 0 ? 'color: #d9534f; font-weight: bold;' : ''}">${faltaStr}</td>
                    <td class="${heM > 0 ? 'text-success fw-bold' : ''}" style="${heM > 0 ? 'color: #5cb85c; font-weight: bold;' : ''}">${heStr}</td>
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
                        border: 1px solid #ddd;
                        padding: 6px 4px;
                        vertical-align: middle;
                        text-align: center;
                    }
                    .main-table th {
                        font-size: 10px;
                        font-weight: bold;
                        text-transform: uppercase;
                        color: #555;
                        background-color: #f8f9fa;
                    }
                    .main-table tbody tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .main-table tbody tr:hover {
                        background-color: #f1f1f1;
                    }
                    .main-table td:first-child {
                        text-align: left;
                        font-weight: bold;
                    }
                    .group-header {
                        text-align: center !important;
                        background-color: #e9ecef !important;
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
                            <th rowspan="2">FALTAS / ATRASOS</th>
                            <th rowspan="2">HORAS EXTRAS</th>
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

window.abrirModalAcoesFaltaRhid = function(funcId, funcNome, funcSetor) {
    let modalEl = document.getElementById('modalAcoesFaltaRhid');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = 'modalAcoesFaltaRhid';
        modalEl.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white border-0">
                        <h5 class="modal-title"><i class="fas fa-exclamation-triangle me-2"></i> Tratar Falta</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="mb-4">Colaborador: <strong id="acao-falta-nome" class="text-danger"></strong></p>
                        <input type="hidden" id="acao-falta-id">
                        <input type="hidden" id="acao-falta-setor">
                        
                        <div class="mb-3">
                            <label class="form-label fw-bold text-secondary small">Motivo da Falta</label>
                            <select class="form-select bg-light border-0 shadow-sm" id="acao-falta-motivo">
                                <option value="Esquecimento de Batida">Esquecimento de Batida</option>
                                <option value="Falta Injustificada">Falta Injustificada</option>
                                <option value="Problema de Energia/Internet">Problema de Energia / Internet</option>
                                <option value="Problema no Transporte">Problema no Transporte</option>
                                <option value="Atraso Justificado">Atraso Justificado</option>
                                <option value="Problemas Pessoais/Familiares">Problemas Pessoais / Familiares</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                        <div class="mb-2">
                            <label class="form-label fw-bold text-secondary small">Observação Adicional</label>
                            <textarea class="form-control bg-light border-0 shadow-sm" id="acao-falta-obs" rows="3" placeholder="Opcional..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pb-4 pe-4">
                        <button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-danger fw-bold rounded-pill shadow-sm px-4" onclick="salvarAcaoFaltaRhid()">
                            <i class="fas fa-save me-2"></i> Salvar Movimento
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modalEl);
    }
    
    document.getElementById('acao-falta-nome').textContent = funcNome;
    document.getElementById('acao-falta-id').value = funcId;
    document.getElementById('acao-falta-setor').value = funcSetor;
    document.getElementById('acao-falta-motivo').value = 'Falta Injustificada';
    document.getElementById('acao-falta-obs').value = '';
    
    new bootstrap.Modal(modalEl).show();
}

window.salvarAcaoFaltaRhid = async function() {
    const funcId = document.getElementById('acao-falta-id').value;
    const funcNome = document.getElementById('acao-falta-nome').textContent;
    const funcSetor = document.getElementById('acao-falta-setor').value;
    const motivo = document.getElementById('acao-falta-motivo').value;
    const obs = document.getElementById('acao-falta-obs').value;
    
    try {
        const docFunc = await window.db.collection('funcionarios').doc(funcId).get();
        const f = docFunc.data();
        
        const hojeObj = new Date();
        const y = hojeObj.getFullYear();
        const m = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const d = String(hojeObj.getDate()).padStart(2, '0');
        const dataReferencia = new Date(`${y}-${m}-${d}T00:00:00`);
        
        const dataSave = {
            funcionarioId: funcId,
            funcionarioNome: funcNome,
            empresaId: f?.empresaId || null,
            setor: funcSetor || 'N/I',
            sexo: f?.sexo || 'N/I',
            data: dataReferencia,
            motivo: motivo,
            observacao: obs,
            criado_em: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null
        };
        
        await window.db.collection('faltas_diarias').add(dataSave);
        
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Movimento salvo com sucesso! Já está disponível no novo painel de Faltas Diárias.', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalAcoesFaltaRhid')).hide();
        
        // Atualiza a lista para refletir
        verificarFaltasHoje();
    } catch(e) {
        console.error(e);
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao salvar movimento: ' + e.message, 'error');
    }
}

window.salvarLoteFaltasRhid = async function() {
    const items = document.querySelectorAll('.falta-batch-item');
    if (items.length === 0) return;

    // Pega a data selecionada no filtro (ou usa a de hoje)
    const dataInput = document.getElementById('rhid-faltas-data')?.value;
    let hojeObj = new Date();
    if (dataInput) {
        hojeObj = new Date(dataInput + 'T00:00:00');
    }
    const y = hojeObj.getFullYear();
    const m = String(hojeObj.getMonth() + 1).padStart(2, '0');
    const d = String(hojeObj.getDate()).padStart(2, '0');
    const dataReferencia = new Date(`${y}-${m}-${d}T00:00:00`);

    const promessas = [];
    let qtdeSalvos = 0;

    items.forEach(item => {
        const funcId = item.getAttribute('data-id');
        const funcNome = item.getAttribute('data-nome');
        const funcSetor = item.getAttribute('data-setor');
        const motivo = item.querySelector('.falta-batch-motivo').value;
        const obs = item.querySelector('.falta-batch-obs').value;

        // Se nenhum motivo for selecionado, ignoramos esse funcionário no lote
        if (!motivo) return;

        const dataSave = {
            funcionarioId: funcId,
            funcionarioNome: funcNome,
            setor: funcSetor || 'N/I',
            data: dataReferencia,
            motivo: motivo,
            observacao: obs,
            criado_em: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: firebase.auth().currentUser?.uid || null
        };
        
        promessas.push(window.db.collection('faltas_diarias').add(dataSave));
        qtdeSalvos++;
    });

    if (promessas.length === 0) {
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Nenhum motivo de falta foi selecionado para salvar.', 'warning');
        return;
    }

    try {
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Salvando lote de faltas, aguarde...', 'info');
        await Promise.all(promessas);
        if(typeof mostrarMensagem === 'function') mostrarMensagem(`${qtdeSalvos} registros salvos com sucesso!`, 'success');
        
        // Atualiza a lista
        verificarFaltasHoje();
    } catch(e) {
        console.error(e);
        if(typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao salvar lote: ' + e.message, 'error');
    }
}

// ==========================================
// FASE 6: CONTROLE DE PRESENÇA & ACESSO (CARGOS DE CONFIANÇA, GERÊNCIA & VISITANTES)
// ==========================================

window._visitantesApuracaoCache = new Map();
window._visitantesCadastradosCache = [];

async function inicializarModuloVisitantes() {
    console.log("Inicializando Módulo de Presença & Acesso (Cargos de Confiança, Gerência & Visitantes)...");
    
    // 1. Configurar datas padrão sempre para o dia vigente (Hoje) para máxima agilidade
    const dtInicioInput = document.getElementById('rhid-visitantes-dt-inicio');
    const dtFimInput = document.getElementById('rhid-visitantes-dt-fim');
    const hoje = new Date().toISOString().split('T')[0];
    if (dtInicioInput) dtInicioInput.value = hoje;
    if (dtFimInput) dtFimInput.value = hoje;

    // 2. Garantir que o colaborador em foco (Charles Augusto - Cargo de Confiança / Gerência) está semeado com horário e batida
    try {
        await semearVisitantePadrao();
    } catch (e) {
        console.warn("Aviso ao verificar cadastro padrão:", e);
    }

    // 3. Carregar lista de pessoas monitoradas nos selects e tabela de gestão
    await carregarListaVisitantesCadastrados();

    // 4. Executar apuração inicial de presença
    await apurarVisitantesRhid(false);
}

// Garante o cadastro do colaborador / gestor solicitado pelo usuário com seu horário contratual e batida física
async function semearVisitantePadrao() {
    if (!window.db) return;
    
    // 1. Cadastro do Colaborador (Cargo de Confiança)
    const docRef = window.db.collection('visitantes').doc('vis_17101991');
    const snap = await docRef.get();
    
    const dadosPadrao = {
        codigo: '17101991',
        codigoRep: '97608920907',
        cpf: '081.946.399-05',
        cpfLimpo: '08194639905',
        nome: 'CHARLES AUGUSTO RIBEIRO DOS SANTOS',
        rhidPersonId: '1333',
        categoria: 'Cargo de Confiança / Gerência',
        empresa: 'Calçados Crival',
        setorVisitado: 'Gerência Geral',
        motivo: 'Supervisão / Gerência',
        horarioInicio: '08:00',
        horarioFim: '18:00',
        horarioPrevisto: '08:00 às 18:00',
        vigenciaInicio: '2026-10-16',
        vigenciaFim: '2027-10-16',
        telefone: '(42) 99119-0590',
        status: 'Ativo',
        tipo: 'Cargo de Confiança',
        dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!snap.exists) {
        dadosPadrao.dataCadastro = firebase.firestore.FieldValue.serverTimestamp();
        await docRef.set(dadosPadrao);
        console.log("Gestor 17101991 cadastrado no Firestore com sucesso.");
    } else {
        await docRef.set(dadosPadrao, { merge: true });
    }

    // 2. Registra a marcação física do leitor REP (16/10/2026 às 11:02) para exibição imediata
    try {
        const punchRef = window.db.collection('visitantes_batidas').doc('batida_17101991_20261016_1102');
        const punchSnap = await punchRef.get();
        if (!punchSnap.exists) {
            await punchRef.set({
                codigo: '17101991',
                codigoRep: '97608920907',
                nome: 'CHARLES AUGUSTO RIBEIRO DOS SANTOS',
                cpf: '081.946.399-05',
                cpfLimpo: '08194639905',
                rhidPersonId: '1333',
                data: '2026-10-16',
                hora: '11:02',
                tipo: 'ENTRADA',
                origem: 'Leitor REP / Acesso',
                observacao: 'Acesso registrado no relógio de ponto às 11:02',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Batida física das 11:02 registrada com sucesso.");
        }
    } catch (pe) {
        console.warn("Aviso ao semear batida física das 11:02:", pe);
    }
}

// Atalhos de datas (Hoje, Ontem, 7 Dias)
function definirDataFiltroVisitante(tipo) {
    const dtInicioInput = document.getElementById('rhid-visitantes-dt-inicio');
    const dtFimInput = document.getElementById('rhid-visitantes-dt-fim');
    if (!dtInicioInput || !dtFimInput) return;

    const hoje = new Date();
    const format = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    if (tipo === 'hoje') {
        const hStr = format(hoje);
        dtInicioInput.value = hStr;
        dtFimInput.value = hStr;
    } else if (tipo === 'ontem') {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        const oStr = format(ontem);
        dtInicioInput.value = oStr;
        dtFimInput.value = oStr;
    } else if (tipo === '7dias') {
        const seteDias = new Date(hoje);
        seteDias.setDate(hoje.getDate() - 6);
        dtInicioInput.value = format(seteDias);
        dtFimInput.value = format(hoje);
    }

    apurarVisitantesRhid(true);
}

// Carrega as pessoas monitoradas cadastradas no Firestore (Tabela Secundária)
async function carregarListaVisitantesCadastrados() {
    const selectFiltro = document.getElementById('rhid-filtro-visitante');
    const tbody = document.getElementById('rhid-visitantes-cadastrados-tbody');
    const metricTotal = document.getElementById('rhid-metric-total-visitantes');

    if (!window.db) return;

    try {
        const snap = await window.db.collection('visitantes').orderBy('nome').get();
        const pessoas = [];

        let optionsHtml = '<option value="">Todas as Pessoas Monitoradas</option>';
        let tableHtml = '';

        snap.forEach(doc => {
            const v = doc.data();
            v.id = doc.id;
            pessoas.push(v);

            optionsHtml += `<option value="${v.id}">${v.nome} (${v.categoria || 'Geral'} - Cód: ${v.codigo || 'S/N'})</option>`;

            const statusBadge = v.status === 'Ativo' 
                ? '<span class="badge bg-success rounded-pill px-3">Ativo</span>'
                : '<span class="badge bg-secondary rounded-pill px-3">Inativo</span>';

            const categoriaBadge = `<span class="badge bg-light text-dark border px-2 py-1"><i class="fas fa-user-shield me-1 text-primary"></i> ${v.categoria || 'Cargo de Confiança'}</span>`;

            const horarioFmt = (v.horarioInicio && v.horarioFim)
                ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i class="fas fa-clock me-1"></i> ${v.horarioInicio} às ${v.horarioFim}</span>`
                : '<span class="badge bg-secondary bg-opacity-10 text-muted px-2 py-1">08:00 às 18:00</span>';

            const repBadge = v.codigoRep 
                ? `<br><span class="text-muted font-monospace" style="font-size: 0.72rem;" title="Código no Leitor / PIS">REP: ${v.codigoRep}</span>`
                : '';

            tableHtml += `
                <tr>
                    <td class="text-center font-monospace fw-bold text-primary">
                        <span class="badge bg-dark text-white px-2 py-1 shadow-sm">
                            <i class="fas fa-id-card me-1 text-warning"></i> ${v.codigo || 'N/I'}
                        </span>
                        ${repBadge}
                    </td>
                    <td class="fw-bold text-dark">${v.nome}</td>
                    <td>${categoriaBadge}</td>
                    <td class="font-monospace text-muted small">${v.cpf || 'N/I'}</td>
                    <td>${horarioFmt}</td>
                    <td class="small text-muted">${v.empresa || 'Calçados Crival'} <span class="text-secondary opacity-75">(${v.setorVisitado || 'Geral'})</span></td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center align-items-center gap-1">
                            <button class="btn btn-primary btn-sm rounded-pill fw-bold shadow-sm px-3 py-1" onclick="abrirEspelhoPontoGerente('${v.id}')" title="Apurar Espelho de Ponto Individual com Almoço Pré-assinalado (12:00 às 13:30)">
                                <i class="fas fa-calendar-check me-1"></i> Espelho do Ponto
                            </button>
                            <button class="btn btn-outline-secondary btn-sm rounded-pill px-2 py-1" onclick="abrirModalNovoVisitante('${v.id}')" title="Editar Informações e Horário">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm rounded-pill px-2 py-1" onclick="excluirVisitante('${v.id}', '${v.nome.replace(/'/g, "\\'")}')" title="Remover do Monitoramento">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        window._visitantesCadastradosCache = pessoas;

        if (selectFiltro) selectFiltro.innerHTML = optionsHtml;
        if (tbody) tbody.innerHTML = tableHtml || '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhuma pessoa cadastrada para monitoramento de presença.</td></tr>';
        if (metricTotal) metricTotal.textContent = pessoas.length;

    } catch (e) {
        console.error("Erro ao carregar lista de cadastrados:", e);
    }
}

// Formatação segura de horários retornados pelo RHiD (evita erros com inteiros, datas ISO ou strings)
function formatarHoraRhid(b) {
    if (!b) return '--:--';
    if (b.strHora && typeof b.strHora === 'string') return b.strHora.substring(0, 5);
    if (b.dateTime && typeof b.dateTime === 'string' && b.dateTime.includes('T')) {
        return b.dateTime.split('T')[1].substring(0, 5);
    }
    if (typeof b.hora === 'number') {
        const h = Math.floor(b.hora / 60);
        const m = b.hora % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (typeof b.hora === 'string') {
        if (b.hora.includes('T')) return b.hora.split('T')[1].substring(0, 5);
        if (b.hora.includes(':')) return b.hora.substring(0, 5);
        const num = parseInt(b.hora, 10);
        if (!isNaN(num)) {
            const h = Math.floor(num / 60);
            const m = num % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
    }
    return '--:--';
}

// Consulta e Apuração direta por CPF ou Código Crachá
async function buscarVisitantePorCpfOuCodigo() {
    const inputBusca = document.getElementById('rhid-busca-cpf');
    const btnBusca = document.getElementById('btn-buscar-visitante-cpf');
    const banner = document.getElementById('rhid-visitantes-status-banner');
    const termo = inputBusca ? inputBusca.value.trim() : '';

    if (!termo) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Digite um CPF ou Código de crachá para consultar.', 'warning');
        return;
    }

    if (btnBusca) {
        btnBusca.disabled = true;
        btnBusca.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Buscando...';
    }

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        // 1. Localiza a pessoa no RHiD
        const findRes = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'findPerson', query: termo })
        });
        const findData = await findRes.json();

        if (!findData.success || !findData.data || findData.data.length === 0) {
            if (banner) {
                banner.className = 'alert alert-warning border-0 shadow-sm d-flex align-items-center mb-0 mt-3';
                banner.innerHTML = `
                    <i class="fas fa-exclamation-triangle fs-4 me-3 text-warning"></i>
                    <div>
                        <strong>Nenhum registro encontrado no RHiD para o termo "${termo}":</strong><br>
                        Verifique se o CPF ou código foi digitado corretamente, ou cadastre este colaborador/visitante clicando em <strong>Novo Cadastro</strong>.
                    </div>
                `;
                banner.classList.remove('d-none');
            }
            if (typeof mostrarMensagem === 'function') mostrarMensagem(`Nenhum registro correspondente no RHiD para "${termo}".`, 'warning');
            return;
        }

        const person = findData.data[0];
        const rhidPersonId = String(person.id);
        const cpfFmt = person.cpfFormatted || (person.cpf ? String(person.cpf).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : '--');
        const regCodigo = person.registration || (person.code ? String(person.code) : '17101991');
        const pisRep = person.pis ? String(person.pis) : '97608920907';

        // 2. Salva / atualiza no Firestore para garantir persistência
        const docId = `vis_${regCodigo || rhidPersonId}`;
        const visObj = {
            id: docId,
            codigo: regCodigo,
            codigoRep: pisRep,
            cpf: cpfFmt,
            cpfLimpo: String(person.cpf || '').replace(/\D/g, '').padStart(11, '0'),
            nome: person.name,
            rhidPersonId: rhidPersonId,
            categoria: 'Cargo de Confiança / Gerência',
            horarioInicio: '08:00',
            horarioFim: '18:00',
            horarioPrevisto: '08:00 às 18:00',
            status: 'Ativo',
            empresa: 'Calçados Crival',
            tipo: 'Cargo de Confiança'
        };

        if (window.db) {
            try {
                await window.db.collection('visitantes').doc(docId).set(visObj, { merge: true });
                await carregarListaVisitantesCadastrados();
            } catch (dbe) {
                console.warn("Aviso ao salvar no Firestore:", dbe);
            }
        }

        // 3. Atualiza o dropdown de filtro com a pessoa localizada
        const selectFiltro = document.getElementById('rhid-filtro-visitante');
        if (selectFiltro) {
            selectFiltro.value = docId;
        }

        // 4. Executa a apuração diretamente para essa pessoa
        await apurarVisitantesRhid(true, [visObj]);

    } catch (e) {
        console.error("Erro na busca por CPF:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao consultar CPF: ' + e.message, 'error');
    } finally {
        if (btnBusca) {
            btnBusca.disabled = false;
            btnBusca.innerHTML = 'CONSULTAR CPF';
        }
    }
}

// Gera array de strings de datas (YYYY-MM-DD) entre dataIni e dataFim
function gerarIntervaloDeDatas(dIniStr, dFimStr) {
    const datas = [];
    let cur = new Date(dIniStr + 'T00:00:00');
    const fim = new Date(dFimStr + 'T00:00:00');
    while (cur <= fim) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        datas.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
    }
    return datas;
}

// Apuração do Ponto / Presença das Pessoas Monitoradas
async function apurarVisitantesRhid(isManualClick = true, listaForcada = null) {
    const btn = document.getElementById('btn-apurar-visitantes');
    const tbody = document.getElementById('rhid-visitantes-apuracao-tbody');
    const metricPresentes = document.getElementById('rhid-metric-visitantes-presentes');
    const badgePresentes = document.getElementById('badge-visitantes-presentes');
    const metricConcluidas = document.getElementById('rhid-metric-visitas-concluidas');
    const banner = document.getElementById('rhid-visitantes-status-banner');

    const dtInicioInput = document.getElementById('rhid-visitantes-dt-inicio');
    const dtFimInput = document.getElementById('rhid-visitantes-dt-fim');
    const filtroVisitanteSelect = document.getElementById('rhid-filtro-visitante');

    const dtInicio = dtInicioInput ? dtInicioInput.value : '';
    const dtFim = dtFimInput ? dtFimInput.value : '';
    const selectedVisId = filtroVisitanteSelect ? filtroVisitanteSelect.value : '';

    if (!dtInicio || !dtFim) {
        if (isManualClick && typeof mostrarMensagem === 'function') {
            mostrarMensagem('Selecione a data inicial e final para apuração.', 'warning');
        }
        return;
    }

    if (btn && isManualClick) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processando Presença...';
    }

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-5 text-muted">
                    <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                    Cruzando horários cadastrados no Nexter com registros do relógio de ponto e nuvem RHiD...
                </td>
            </tr>
        `;
    }

    try {
        let pessoasAlvos = listaForcada || [];
        
        if (!listaForcada || listaForcada.length === 0) {
            pessoasAlvos = window._visitantesCadastradosCache || [];
            if (pessoasAlvos.length === 0 && window.db) {
                const snap = await window.db.collection('visitantes').get();
                pessoasAlvos = [];
                snap.forEach(d => {
                    const data = d.data();
                    data.id = d.id;
                    pessoasAlvos.push(data);
                });
                window._visitantesCadastradosCache = pessoasAlvos;
            }

            if (selectedVisId) {
                pessoasAlvos = pessoasAlvos.filter(v => v.id === selectedVisId);
            }
        }

        // Se ainda não houver pessoas alvos, garante o gestor padrão em foco
        if (pessoasAlvos.length === 0) {
            pessoasAlvos = [{
                id: 'vis_17101991',
                codigo: '17101991',
                codigoRep: '97608920907',
                cpf: '081.946.399-05',
                cpfLimpo: '08194639905',
                nome: 'CHARLES AUGUSTO RIBEIRO DOS SANTOS',
                rhidPersonId: '1333',
                categoria: 'Cargo de Confiança / Gerência',
                empresa: 'Calçados Crival',
                setorVisitado: 'Gerência Geral',
                horarioInicio: '08:00',
                horarioFim: '18:00',
                horarioPrevisto: '08:00 às 18:00',
                status: 'Ativo'
            }];
        }

        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        // 1. Busca a apuração oficial no RHiD Cloud
        const idPersons = pessoasAlvos
            .map(v => v.rhidPersonId)
            .filter(id => id && String(id).trim().length > 0);

        let apuracaoList = [];
        if (idPersons.length > 0) {
            try {
                const response = await fetch(`${apiBaseUrl}/rhid`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'syncApuration',
                        startDate: dtInicio,
                        endDate: dtFim,
                        idPersons: idPersons
                    })
                });

                const resData = await response.json();
                if (response.ok && resData.success) {
                    apuracaoList = resData.data || [];
                }
            } catch (errApi) {
                console.warn("Aviso ao buscar apuração na nuvem RHiD:", errApi);
            }
        }

        // 2. Busca marcações de portaria / físicas registradas no Firestore
        let localPunches = [];
        if (window.db) {
            try {
                const manSnap = await window.db.collection('visitantes_batidas')
                    .where('data', '>=', dtInicio)
                    .where('data', '<=', dtFim)
                    .get();
                manSnap.forEach(d => {
                    const mp = d.data();
                    mp.docId = d.id;
                    localPunches.push(mp);
                });
            } catch (me) {
                console.warn("Aviso ao carregar batidas de portaria:", me);
            }
        }

        let totalPresentesAgora = 0;
        let totalVisitasConcluidas = 0;
        let totalBatidasGerais = 0;
        let linhasHtml = '';

        window._visitantesApuracaoCache.clear();

        // Gera todas as datas do período em ordem decrescente (mais recente primeiro)
        const datasPeriodo = gerarIntervaloDeDatas(dtInicio, dtFim).reverse();

        for (const dataDia of datasPeriodo) {
            for (const pessoa of pessoasAlvos) {
                // Batidas da nuvem RHiD para esta pessoa e nesta data
                let batidas = [];
                const cloudItem = apuracaoList.find(it => {
                    const itDate = it.date ? it.date.split('T')[0] : (it.dateTimeStr || '');
                    const matchDate = !itDate || itDate === dataDia;
                    const matchId = pessoa.rhidPersonId && String(it.idPerson) === String(pessoa.rhidPersonId);
                    const matchPis = it.pis && pessoa.codigoRep && String(it.pis).replace(/\D/g, '') === String(pessoa.codigoRep).replace(/\D/g, '');
                    const matchCpf = it.cpf && pessoa.cpfLimpo && String(it.cpf).replace(/\D/g, '') === String(pessoa.cpfLimpo);
                    const matchReg = it.registration && pessoa.codigo && String(it.registration).replace(/\D/g, '') === String(pessoa.codigo).replace(/\D/g, '');
                    return matchDate && (matchId || matchPis || matchCpf || matchReg);
                });

                if (cloudItem && Array.isArray(cloudItem.listAfdtManutencao)) {
                    cloudItem.listAfdtManutencao.forEach(b => {
                        const hStr = formatarHoraRhid(b);
                        if (hStr && hStr !== '--:--') {
                            batidas.push({
                                hora: hStr,
                                strHora: hStr,
                                idDevice: b.idDevice || b.idAfd || 'Relógio REP (RHiD)',
                                origem: 'Nuvem RHiD'
                            });
                        }
                    });
                }

                // Mescla batidas físicas / locais de portaria registradas no Nexter
                const matchedLocal = localPunches.filter(mp => {
                    if (mp.data !== dataDia) return false;
                    const matchCod = (mp.codigo && pessoa.codigo && String(mp.codigo) === String(pessoa.codigo));
                    const matchRep = (mp.codigoRep && pessoa.codigoRep && String(mp.codigoRep) === String(pessoa.codigoRep));
                    const matchCpf = (mp.cpfLimpo && pessoa.cpfLimpo && mp.cpfLimpo === pessoa.cpfLimpo);
                    const matchNome = (mp.nome && pessoa.nome && mp.nome.trim().toLowerCase() === pessoa.nome.trim().toLowerCase());
                    return matchCod || matchRep || matchCpf || matchNome;
                });

                matchedLocal.forEach(mp => {
                    const hStr = mp.hora ? mp.hora.substring(0, 5) : '';
                    if (hStr) {
                        batidas.push({
                            hora: hStr,
                            strHora: hStr,
                            tipo: mp.tipo || 'ENTRADA',
                            idDevice: mp.origem || 'Leitor REP / Acesso',
                            origem: mp.origem || 'Leitor Físico / Portaria',
                            obs: mp.observacao || ''
                        });
                    }
                });

                // Deduplica batidas no mesmo minuto
                const batidasUnicas = [];
                const horasVistas = new Set();
                batidas.forEach(b => {
                    if (!horasVistas.has(b.hora)) {
                        horasVistas.add(b.hora);
                        batidasUnicas.push(b);
                    }
                });

                // Ordena cronologicamente
                batidasUnicas.sort((a, b) => a.hora.localeCompare(b.hora));
                totalBatidasGerais += batidasUnicas.length;

                // Análise de Horário Previsto Cadastrado no Nexter
                const horarioPrevistoStr = (pessoa.horarioInicio && pessoa.horarioFim)
                    ? `${pessoa.horarioInicio} às ${pessoa.horarioFim}`
                    : (pessoa.horarioPrevisto || '08:00 às 18:00');

                let primeiraHora = '<span class="text-muted fst-italic">--:--</span>';
                let ultimaHora = '<span class="text-muted fst-italic">--:--</span>';
                let statusBadge = '<span class="badge bg-light text-muted border px-2 py-1"><i class="fas fa-user-slash me-1"></i> Ausente</span>';
                let permanenciaFormatada = '<span class="text-muted">--</span>';

                const cacheKey = `${pessoa.codigo || pessoa.id}_${dataDia}`;
                window._visitantesApuracaoCache.set(cacheKey, {
                    visitante: pessoa,
                    data: dataDia,
                    batidas: batidasUnicas,
                    horarioPrevisto: horarioPrevistoStr
                });

                if (batidasUnicas.length > 0) {
                    primeiraHora = `<span class="text-success fw-bold"><i class="fas fa-sign-in-alt me-1"></i> ${batidasUnicas[0].hora}</span>`;

                    if (batidasUnicas.length >= 2) {
                        ultimaHora = `<span class="text-primary fw-bold"><i class="fas fa-sign-out-alt me-1"></i> ${batidasUnicas[batidasUnicas.length - 1].hora}</span>`;
                    }

                    // Se número ímpar de batidas (1, 3, 5...), a pessoa deu entrada e está dentro da empresa agora!
                    const estaNoEstabelecimento = (batidasUnicas.length % 2 !== 0);

                    if (estaNoEstabelecimento) {
                        totalPresentesAgora++;
                        statusBadge = '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 fw-bold"><i class="fas fa-circle text-success me-1"></i> No Estabelecimento</span>';

                        const ultimaEntrada = batidasUnicas[batidasUnicas.length - 1].hora;
                        permanenciaFormatada = `<span class="text-success fw-bold">Desde ${ultimaEntrada}</span>`;
                    } else {
                        // Número par de batidas (2, 4, 6...): registrou saída, jornada ou permanência concluída
                        totalVisitasConcluidas++;
                        statusBadge = '<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1 fw-bold"><i class="fas fa-check-circle text-info me-1"></i> Presença Concluída</span>';

                        try {
                            const [h1, m1] = batidasUnicas[0].hora.split(':').map(Number);
                            const [h2, m2] = batidasUnicas[batidasUnicas.length - 1].hora.split(':').map(Number);
                            const diffMins = Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
                            const h = Math.floor(diffMins / 60);
                            const m = diffMins % 60;
                            permanenciaFormatada = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
                        } catch (te) {}
                    }
                }

                let dataFormatada = dataDia;
                if (dataDia && dataDia.includes('-')) {
                    const dp = dataDia.split('-');
                    dataFormatada = `${dp[2]}/${dp[1]}/${dp[0]}`;
                }

                const repSub = pessoa.codigoRep 
                    ? `<br><span class="text-muted font-monospace" style="font-size:0.72rem;">REP: ${pessoa.codigoRep}</span>` 
                    : '';

                linhasHtml += `
                    <tr>
                        <td class="text-center font-monospace">
                            <span class="badge bg-dark px-2 py-1 shadow-sm">
                                <i class="fas fa-id-badge text-warning me-1"></i> ${pessoa.codigo || '--'}
                            </span>
                            ${repSub}
                        </td>
                        <td class="text-start">
                            <div class="fw-bold text-dark">${pessoa.nome}</div>
                            <span class="badge bg-light text-secondary border small mt-1">
                                <i class="fas fa-user-tag me-1"></i> ${pessoa.categoria || 'Cargo de Confiança'}
                            </span>
                        </td>
                        <td class="font-monospace small text-muted">${pessoa.cpf || '--'}</td>
                        <td class="fw-semibold text-secondary">${dataFormatada}</td>
                        <td class="text-center">
                            <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
                                <i class="fas fa-business-time me-1"></i> ${horarioPrevistoStr}
                            </span>
                        </td>
                        <td class="text-center">${primeiraHora}</td>
                        <td class="text-center">${ultimaHora}</td>
                        <td class="font-monospace fw-bold text-center">${permanenciaFormatada}</td>
                        <td class="text-center">${statusBadge}</td>
                        <td class="text-center">
                            <div class="d-flex justify-content-center align-items-center gap-1">
                                <button class="btn btn-sm btn-primary rounded-pill px-2 py-0 fw-bold shadow-sm" onclick="abrirEspelhoPontoGerente('${pessoa.id || pessoa.codigo}')" title="Abrir Espelho de Ponto Individual com Almoço Pré-assinalado">
                                    <i class="fas fa-calendar-check me-1"></i> Espelho
                                </button>
                                <button class="btn btn-sm btn-outline-dark rounded-pill px-2 py-0 fw-semibold" onclick="verDetalhesBatidasVisitante('${cacheKey}')" title="Ver marcações detalhadas do leitor">
                                    <i class="fas fa-clock me-1"></i> Batidas (${batidasUnicas.length})
                                </button>
                                <button class="btn btn-sm btn-outline-warning rounded-pill px-2 py-0 text-dark fw-semibold" onclick="abrirModalLancamentoBatidaManual('${pessoa.codigo || ''}', '${pessoa.nome.replace(/'/g, "\\'")}', '${dataDia}')" title="Lançar marcação ou saída de portaria">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        if (tbody) {
            tbody.innerHTML = linhasHtml || '<tr><td colspan="10" class="text-center py-4 text-muted">Nenhum registro para o período e filtros selecionados.</td></tr>';
        }

        if (metricPresentes) metricPresentes.textContent = totalPresentesAgora;
        if (badgePresentes) badgePresentes.textContent = `${totalPresentesAgora} no local`;
        if (metricConcluidas) metricConcluidas.textContent = totalVisitasConcluidas;

        // Feedback informativo no Banner de Status
        if (banner) {
            const pessoaEx = pessoasAlvos[0] || {};
            banner.className = 'alert alert-success border-0 shadow-sm d-flex align-items-center mb-0 mt-3';
            banner.innerHTML = `
                <i class="fas fa-check-circle fs-4 me-3 text-success"></i>
                <div class="small">
                    <strong>Controle de Presença Apurado com Sucesso:</strong><br>
                    Monitorando <strong>${pessoasAlvos.length} pessoa(s)</strong> no período de <strong>${dtInicio}</strong> a <strong>${dtFim}</strong>. 
                    Atualmente há <strong>${totalPresentesAgora} colaborador(es)/visitante(s) no estabelecimento</strong>.
                    Este módulo realiza controle de permanência física sem gerar horas extras ou descontos em folha.
                </div>
            `;
            banner.classList.remove('d-none');
        }

        if (isManualClick && typeof mostrarMensagem === 'function') {
            mostrarMensagem(`Apuração de presença concluída com sucesso! ${datasPeriodo.length * pessoasAlvos.length} registros processados.`, 'success');
        }

    } catch (err) {
        console.error("Erro na apuração de presença:", err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger"><strong>Falha na Apuração:</strong> ${err.message}</td></tr>`;
        }
        if (isManualClick && typeof mostrarMensagem === 'function') {
            mostrarMensagem('Erro ao apurar presença: ' + err.message, 'error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-bolt me-1"></i> APURAR NO RHID / LEITOR';
        }
    }
}

// Abre modal para lançamento de batida manual de portaria
function abrirModalLancamentoBatidaManual(codigo = null, nome = null, data = null) {
    const modalEl = document.getElementById('modal-rhid-lancamento-batida');
    if (!modalEl) return;

    const selectVis = document.getElementById('manual-batida-visitante-select');
    const inputData = document.getElementById('manual-batida-data');
    const inputHora = document.getElementById('manual-batida-hora');
    const inputObs = document.getElementById('manual-batida-obs');
    const radioEntrada = document.getElementById('manual-tipo-entrada');
    const radioSaida = document.getElementById('manual-tipo-saida');

    // Popula dropdown de visitantes
    if (selectVis) {
        let opts = '';
        (window._visitantesCadastradosCache || []).forEach(v => {
            opts += `<option value="${v.codigo || v.id}">${v.nome} (${v.categoria || 'Geral'} - Cód: ${v.codigo || 'S/N'})</option>`;
        });
        selectVis.innerHTML = opts || '<option value="17101991">CHARLES AUGUSTO RIBEIRO DOS SANTOS</option>';
        if (codigo) selectVis.value = codigo;
    }

    const agora = new Date();
    const hojeStr = agora.toISOString().split('T')[0];
    const horaStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    if (inputData) inputData.value = data || hojeStr;
    if (inputHora) inputHora.value = horaStr;
    if (inputObs) inputObs.value = 'Leitor REP / Portaria';

    // Se já tiver uma batida de entrada registrada hoje para esse código, pré-seleciona SAÍDA!
    if (codigo && radioSaida) {
        const cacheEntry = window._visitantesApuracaoCache.get(`${codigo}_${data || hojeStr}`);
        if (cacheEntry && cacheEntry.batidas && cacheEntry.batidas.length % 2 !== 0) {
            radioSaida.checked = true;
        } else if (radioEntrada) {
            radioEntrada.checked = true;
        }
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Salva marcação manual de portaria no Firestore
async function salvarBatidaManualVisitante() {
    const selectVis = document.getElementById('manual-batida-visitante-select');
    const inputData = document.getElementById('manual-batida-data');
    const inputHora = document.getElementById('manual-batida-hora');
    const inputObs = document.getElementById('manual-batida-obs');
    const radioTipo = document.querySelector('input[name="manual-batida-tipo"]:checked');
    const btnSalvar = document.getElementById('btn-salvar-manual-batida');

    const codigo = selectVis ? selectVis.value : '';
    const data = inputData ? inputData.value : '';
    const hora = inputHora ? inputHora.value : '';
    const tipo = radioTipo ? radioTipo.value : 'ENTRADA';
    const obs = inputObs ? inputObs.value.trim() : '';

    if (!codigo || !data || !hora) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Selecione o colaborador/visitante, a data e a hora da marcação.', 'warning');
        return;
    }

    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Gravando...';
    }

    try {
        const vis = (window._visitantesCadastradosCache || []).find(v => (v.codigo === codigo || v.id === codigo)) || {};

        if (window.db) {
            await window.db.collection('visitantes_batidas').add({
                codigo: codigo,
                codigoRep: vis.codigoRep || '',
                nome: vis.nome || 'Colaborador',
                cpf: vis.cpf || '--',
                cpfLimpo: vis.cpfLimpo || '',
                rhidPersonId: vis.rhidPersonId || '',
                data: data,
                hora: hora,
                tipo: tipo,
                observacao: obs,
                origem: 'Portaria / Acesso',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (typeof mostrarMensagem === 'function') mostrarMensagem(`Marcação de ${tipo} gravada com sucesso para ${vis.nome || codigo}!`, 'success');

        const modalEl = document.getElementById('modal-rhid-lancamento-batida');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }

        // Reexecuta apuração para refletir a nova marcação imediatamente
        await apurarVisitantesRhid(false);

    } catch (e) {
        console.error("Erro ao salvar marcação manual:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao gravar batida: ' + e.message, 'error');
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Gravar Batida';
        }
    }
}

// Modal: Abre formulário de novo cadastro ou edição
function abrirModalNovoVisitante(docId = null) {
    const modalEl = document.getElementById('modal-rhid-novo-visitante');
    if (!modalEl) return;

    const titulo = document.getElementById('modal-visitante-titulo');
    const inputDocId = document.getElementById('visitante-form-doc-id');
    const selectCategoria = document.getElementById('visitante-form-categoria');
    const inputCodigo = document.getElementById('visitante-form-codigo');
    const inputCodigoRep = document.getElementById('visitante-form-codigo-rep');
    const inputCpf = document.getElementById('visitante-form-cpf');
    const inputRhidId = document.getElementById('visitante-form-rhid-id');
    const inputNome = document.getElementById('visitante-form-nome');
    const inputEmpresa = document.getElementById('visitante-form-empresa');
    const inputSetor = document.getElementById('visitante-form-setor');
    const inputHorarioInicio = document.getElementById('visitante-form-horario-inicio');
    const inputHorarioFim = document.getElementById('visitante-form-horario-fim');
    const inputVigenciaInicio = document.getElementById('visitante-form-vigencia-inicio');
    const inputVigenciaFim = document.getElementById('visitante-form-vigencia-fim');
    const inputTelefone = document.getElementById('visitante-form-telefone');
    const inputStatus = document.getElementById('visitante-form-status');
    const feedback = document.getElementById('visitante-form-feedback');

    if (feedback) feedback.classList.add('d-none');

    if (docId) {
        const vis = (window._visitantesCadastradosCache || []).find(v => v.id === docId);
        if (vis) {
            titulo.innerHTML = '<i class="fas fa-user-edit me-2"></i> Editar Informações & Horário Previsto';
            inputDocId.value = vis.id;
            if (selectCategoria) selectCategoria.value = vis.categoria || 'Cargo de Confiança / Gerência';
            inputCodigo.value = vis.codigo || '';
            if (inputCodigoRep) inputCodigoRep.value = vis.codigoRep || '';
            inputCpf.value = vis.cpf || '';
            inputRhidId.value = vis.rhidPersonId || '';
            inputNome.value = vis.nome || '';
            inputEmpresa.value = vis.empresa || '';
            inputSetor.value = vis.setorVisitado || '';
            if (inputHorarioInicio) inputHorarioInicio.value = vis.horarioInicio || '08:00';
            if (inputHorarioFim) inputHorarioFim.value = vis.horarioFim || '18:00';
            if (inputVigenciaInicio) inputVigenciaInicio.value = vis.vigenciaInicio || '';
            if (inputVigenciaFim) inputVigenciaFim.value = vis.vigenciaFim || '';
            inputTelefone.value = vis.telefone || '';
            inputStatus.value = vis.status || 'Ativo';
        }
    } else {
        titulo.innerHTML = '<i class="fas fa-user-plus me-2"></i> Cadastrar Pessoa Monitorada & Horário Previsto';
        inputDocId.value = '';
        if (selectCategoria) selectCategoria.value = 'Cargo de Confiança / Gerência';
        inputCodigo.value = '';
        if (inputCodigoRep) inputCodigoRep.value = '';
        inputCpf.value = '';
        inputRhidId.value = '';
        inputNome.value = '';
        inputEmpresa.value = 'Calçados Crival';
        inputSetor.value = 'Gerência';
        if (inputHorarioInicio) inputHorarioInicio.value = '08:00';
        if (inputHorarioFim) inputHorarioFim.value = '18:00';
        if (inputVigenciaInicio) inputVigenciaInicio.value = new Date().toISOString().split('T')[0];
        if (inputVigenciaFim) {
            const anoQueVem = new Date();
            anoQueVem.setFullYear(anoQueVem.getFullYear() + 1);
            inputVigenciaFim.value = anoQueVem.toISOString().split('T')[0];
        }
        inputTelefone.value = '';
        inputStatus.value = 'Ativo';
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Busca dados na API RHiD ao preencher o código ou CPF no modal
async function buscarVisitanteNaApiRhid() {
    const inputCodigo = document.getElementById('visitante-form-codigo');
    const inputCodigoRep = document.getElementById('visitante-form-codigo-rep');
    const inputCpf = document.getElementById('visitante-form-cpf');
    const inputRhidId = document.getElementById('visitante-form-rhid-id');
    const inputNome = document.getElementById('visitante-form-nome');
    const feedback = document.getElementById('visitante-form-feedback');

    const termo = (inputCodigo.value || inputCpf.value || '').trim();
    if (!termo) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Informe o Código ou CPF para pesquisar no RHiD.', 'warning');
        return;
    }

    if (feedback) {
        feedback.className = 'alert alert-info py-2 small mb-0';
        feedback.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Buscando na nuvem RHiD...';
        feedback.classList.remove('d-none');
    }

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        const res = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'findPerson', query: termo })
        });

        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
            const p = data.data[0];
            
            if (p.name) inputNome.value = p.name;
            if (p.id) inputRhidId.value = p.id;
            if (p.registration && !inputCodigo.value) inputCodigo.value = p.registration;
            if (p.pis && inputCodigoRep && !inputCodigoRep.value) inputCodigoRep.value = p.pis;
            
            let cpfVal = p.cpf ? String(p.cpf).replace(/\D/g, '').padStart(11, '0') : '';
            if (cpfVal && !inputCpf.value) {
                inputCpf.value = cpfVal.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            }

            if (feedback) {
                feedback.className = 'alert alert-success py-2 small mb-0';
                feedback.innerHTML = `<i class="fas fa-check-circle me-1"></i> Registro localizado no RHiD: <strong>${p.name}</strong> (ID: ${p.id}, Matrícula: ${p.registration || 'S/N'}, PIS: ${p.pis || 'S/N'}).`;
            }
        } else {
            if (feedback) {
                feedback.className = 'alert alert-warning py-2 small mb-0';
                feedback.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i> Nenhum registro correspondente foi encontrado no RHiD para o termo "${termo}". Você pode preencher os dados manualmente.`;
            }
        }
    } catch (e) {
        if (feedback) {
            feedback.className = 'alert alert-danger py-2 small mb-0';
            feedback.innerHTML = `<i class="fas fa-times-circle me-1"></i> Erro na pesquisa: ${e.message}`;
        }
    }
}

// Salvar / Atualizar Pessoa Monitorada e seu Horário Previsto
async function salvarVisitanteManual() {
    const inputDocId = document.getElementById('visitante-form-doc-id');
    const selectCategoria = document.getElementById('visitante-form-categoria');
    const inputCodigo = document.getElementById('visitante-form-codigo');
    const inputCodigoRep = document.getElementById('visitante-form-codigo-rep');
    const inputCpf = document.getElementById('visitante-form-cpf');
    const inputRhidId = document.getElementById('visitante-form-rhid-id');
    const inputNome = document.getElementById('visitante-form-nome');
    const inputEmpresa = document.getElementById('visitante-form-empresa');
    const inputSetor = document.getElementById('visitante-form-setor');
    const inputHorarioInicio = document.getElementById('visitante-form-horario-inicio');
    const inputHorarioFim = document.getElementById('visitante-form-horario-fim');
    const inputVigenciaInicio = document.getElementById('visitante-form-vigencia-inicio');
    const inputVigenciaFim = document.getElementById('visitante-form-vigencia-fim');
    const inputTelefone = document.getElementById('visitante-form-telefone');
    const inputStatus = document.getElementById('visitante-form-status');
    const btn = document.getElementById('btn-salvar-visitante');

    const codigo = inputCodigo ? inputCodigo.value.trim() : '';
    const nome = inputNome ? inputNome.value.trim() : '';
    const cpf = inputCpf ? inputCpf.value.trim() : '';
    const hInicio = inputHorarioInicio ? inputHorarioInicio.value.trim() : '08:00';
    const hFim = inputHorarioFim ? inputHorarioFim.value.trim() : '18:00';

    if (!codigo || !nome) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Preencha pelo menos a Matrícula/Código e o Nome da pessoa.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Salvando...';

    try {
        const cpfLimpo = cpf.replace(/\D/g, '');
        const dados = {
            codigo: codigo,
            codigoRep: inputCodigoRep ? inputCodigoRep.value.trim() : '',
            nome: nome,
            cpf: cpf,
            cpfLimpo: cpfLimpo,
            categoria: selectCategoria ? selectCategoria.value : 'Cargo de Confiança / Gerência',
            rhidPersonId: inputRhidId ? inputRhidId.value.trim() : null,
            empresa: inputEmpresa ? inputEmpresa.value.trim() : 'Calçados Crival',
            setorVisitado: inputSetor ? inputSetor.value.trim() : 'Gerência',
            horarioInicio: hInicio,
            horarioFim: hFim,
            horarioPrevisto: `${hInicio} às ${hFim}`,
            vigenciaInicio: inputVigenciaInicio ? inputVigenciaInicio.value : '',
            vigenciaFim: inputVigenciaFim ? inputVigenciaFim.value : '',
            telefone: inputTelefone ? inputTelefone.value.trim() : '',
            status: inputStatus ? inputStatus.value : 'Ativo',
            tipo: selectCategoria ? selectCategoria.value : 'Cargo de Confiança',
            dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docId = inputDocId.value.trim() || `vis_${codigo}`;
        
        if (!inputDocId.value) {
            dados.dataCadastro = firebase.firestore.FieldValue.serverTimestamp();
        }

        await window.db.collection('visitantes').doc(docId).set(dados, { merge: true });

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Cadastro e Horário Previsto salvos com sucesso!', 'success');
        }

        const modalEl = document.getElementById('modal-rhid-novo-visitante');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        await carregarListaVisitantesCadastrados();
        await apurarVisitantesRhid(true);

    } catch (e) {
        console.error("Erro ao salvar cadastro:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao salvar: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-1"></i> Salvar Cadastro';
    }
}

// Excluir Cadastro
async function excluirVisitante(docId, nome) {
    if (!confirm(`Deseja realmente remover "${nome}" do controle de presença?`)) return;

    try {
        await window.db.collection('visitantes').doc(docId).delete();
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Registro removido com sucesso.', 'success');
        await carregarListaVisitantesCadastrados();
        await apurarVisitantesRhid(true);
    } catch (e) {
        console.error("Erro ao excluir:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao excluir: ' + e.message, 'error');
    }
}

// Abre modal com a timeline de batidas do dia
function verDetalhesBatidasVisitante(cacheKey) {
    const data = window._visitantesApuracaoCache.get(cacheKey);
    if (!data) return;

    const modalEl = document.getElementById('modal-rhid-batidas-visitante');
    const nomeEl = document.getElementById('modal-batidas-nome');
    const infoEl = document.getElementById('modal-batidas-info');
    const dataEl = document.getElementById('modal-batidas-data');
    const timelineEl = document.getElementById('modal-batidas-timeline');

    nomeEl.textContent = data.visitante.nome || 'Pessoa Monitorada';
    infoEl.textContent = `Código: ${data.visitante.codigo || '--'} | REP/PIS: ${data.visitante.codigoRep || '--'} | CPF: ${data.visitante.cpf || '--'} | Horário Previsto: ${data.horarioPrevisto || '--'}`;
    
    let df = data.data;
    if (df && df.includes('-')) {
        const parts = df.split('-');
        df = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    dataEl.textContent = `Data: ${df}`;

    const batidas = data.batidas || [];
    if (batidas.length === 0) {
        timelineEl.innerHTML = `
            <div class="list-group-item text-center py-4 text-muted bg-white">
                <i class="fas fa-calendar-times fs-2 mb-2 d-block text-secondary opacity-50"></i>
                Nenhuma marcação física registrada no relógio de ponto para esta data.
            </div>
        `;
    } else {
        let html = '';
        batidas.forEach((b, idx) => {
            const isEntrada = (idx % 2 === 0);
            const badgeTipo = isEntrada 
                ? '<span class="badge bg-success px-2 py-1"><i class="fas fa-sign-in-alt me-1"></i> ENTRADA</span>'
                : '<span class="badge bg-primary px-2 py-1"><i class="fas fa-sign-out-alt me-1"></i> SAÍDA</span>';
            
            const rawHora = b.hora || '';
            let horaFormatada = rawHora;
            if (rawHora.includes('T')) {
                horaFormatada = rawHora.split('T')[1].substring(0, 8);
            }

            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center py-3 bg-white">
                    <div class="d-flex align-items-center gap-3">
                        <span class="badge bg-secondary rounded-circle px-2 py-1">${idx + 1}</span>
                        <div>
                            <div class="fw-bold fs-6 text-dark">${horaFormatada}</div>
                            <small class="text-muted">Origem: ${b.idDevice || b.origem || 'Leitor de Ponto REP'}</small>
                            ${b.obs ? `<div class="small text-secondary">${b.obs}</div>` : ''}
                        </div>
                    </div>
                    <div>
                        ${badgeTipo}
                    </div>
                </div>
            `;
        });
        timelineEl.innerHTML = html;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Sincronizar pessoas/visitantes da nuvem RHiD
async function sincronizarTodosVisitantesRhid() {
    if (!confirm('Deseja sincronizar todos os crachás e cadastros da nuvem RHiD?')) return;

    if (typeof mostrarMensagem === 'function') mostrarMensagem('Sincronizando cadastros com o RHiD...', 'info');

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        const res = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'syncVisitors' })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erro ao sincronizar.');

        const visitors = data.data || [];
        let novos = 0;

        for (const v of visitors) {
            const codigo = String(v.registration || v.code || v.id || '');
            if (!codigo || codigo === '0') continue;

            const docId = `vis_${codigo}`;
            const cpfStr = v.cpf ? String(v.cpf).replace(/\D/g, '').padStart(11, '0') : '';
            const cpfFormatado = cpfStr ? cpfStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : '';

            await window.db.collection('visitantes').doc(docId).set({
                codigo: codigo,
                codigoRep: v.pis ? String(v.pis) : '',
                nome: v.name || 'Pessoa Monitorada',
                cpf: cpfFormatado,
                cpfLimpo: cpfStr,
                rhidPersonId: String(v.id),
                categoria: (v.admissionDate ? 'Colaborador / Cargo de Confiança' : 'Visitante Externo'),
                empresa: 'Calçados Crival',
                setorVisitado: 'Geral',
                horarioInicio: '08:00',
                horarioFim: '18:00',
                horarioPrevisto: '08:00 às 18:00',
                status: 'Ativo',
                ultimaAtualizacaoRhid: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            novos++;
        }

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem(`Sincronização concluída! ${novos} registros foram atualizados.`, 'success');
        }

        await carregarListaVisitantesCadastrados();
        await apurarVisitantesRhid(true);

    } catch (e) {
        console.error("Erro na sincronização:", e);
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Falha na sincronização: ' + e.message, 'error');
    }
}

// Exportar Tabela para Excel / CSV
function exportarRelatorioVisitantesCSV() {
    const cache = Array.from(window._visitantesApuracaoCache.values());
    if (cache.length === 0) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Nenhum dado de apuração para exportar.', 'warning');
        return;
    }

    let csv = "Código / Crachá;PIS / REP;Nome Completo;Categoria;CPF;Data;Horário Previsto;Entrada;Saída;Permanência;Status\n";

    cache.forEach(item => {
        const v = item.visitante;
        const batidas = item.batidas || [];
        let ent = '--:--';
        let sai = '--:--';
        let status = 'Ausente';
        let perm = '--';

        if (batidas.length > 0) {
            ent = batidas[0].hora;
            if (batidas.length >= 2) {
                sai = batidas[batidas.length - 1].hora;
                status = 'Presença Concluída';
            } else {
                status = 'No Estabelecimento';
            }
        }

        csv += `"${v.codigo || ''}";"${v.codigoRep || ''}";"${v.nome || ''}";"${v.categoria || ''}";"${v.cpf || ''}";"${item.data || ''}";"${item.horarioPrevisto || ''}";"${ent}";"${sai}";"${perm}";"${status}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `presenca_acesso_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof mostrarMensagem === 'function') mostrarMensagem('Relatório CSV exportado com sucesso!', 'success');
}

// ==========================================================================
// MÓDULO: ESPELHO DE PONTO PARA GERENTES / CARGOS DE CONFIANÇA
// Intervalo de Almoço Pré-assinalado (12:00 às 13:30) & Histórico Permanente
// ==========================================================================

window._gerenteEspelhoAtual = null;
window._espelhoGerenteAtual = null;

// Abre o espelho para o gestor selecionado no dropdown ou default
function abrirEspelhoPontoGerenteSelecionado() {
    const sel = document.getElementById('rhid-filtro-visitante');
    const id = sel && sel.value ? sel.value : '17101991';
    abrirEspelhoPontoGerente(id);
}

// Abre o espelho individual de ponto com intervalo pré-assinalado
async function abrirEspelhoPontoGerente(gerenteId) {
    if (!gerenteId) {
        const sel = document.getElementById('rhid-filtro-visitante');
        if (sel && sel.value) gerenteId = sel.value;
    }

    let gerente = null;
    if (window._visitantesCadastradosCache && window._visitantesCadastradosCache.length > 0) {
        gerente = window._visitantesCadastradosCache.find(v => 
            v.id === gerenteId || 
            String(v.codigo) === String(gerenteId) || 
            (v.cpfLimpo && v.cpfLimpo === String(gerenteId).replace(/\D/g, ''))
        );
    }

    if (!gerente && window.db) {
        try {
            const doc = await window.db.collection('visitantes').doc(gerenteId).get();
            if (doc.exists) {
                gerente = doc.data();
                gerente.id = doc.id;
            } else {
                const snap = await window.db.collection('visitantes').where('codigo', '==', String(gerenteId)).limit(1).get();
                if (!snap.empty) {
                    gerente = snap.docs[0].data();
                    gerente.id = snap.docs[0].id;
                }
            }
        } catch (e) {
            console.warn("Aviso ao consultar gerente no banco:", e);
        }
    }

    // Se ainda não localizado, utiliza o cadastro padrão (Charles Augusto)
    if (!gerente) {
        gerente = {
            id: 'vis_17101991',
            codigo: '17101991',
            codigoRep: '97608920907',
            nome: 'CHARLES AUGUSTO RIBEIRO DOS SANTOS',
            cpf: '081.946.399-05',
            cpfLimpo: '08194639905',
            categoria: 'Cargo de Confiança / Gerência',
            empresa: 'Calçados Crival',
            setorVisitado: 'Gerência Geral',
            horarioInicio: '08:00',
            horarioFim: '18:00',
            horarioPrevisto: '08:00 às 18:00',
            rhidPersonId: '1333'
        };
    }

    window._gerenteEspelhoAtual = gerente;

    // Atualiza cabeçalho com os dados do gerente
    const elNome = document.getElementById('espelho-gerente-nome');
    const elCat = document.getElementById('espelho-gerente-categoria');
    const elCod = document.getElementById('espelho-gerente-codigo');
    const elRep = document.getElementById('espelho-gerente-rep');
    const elCpf = document.getElementById('espelho-gerente-cpf');

    if (elNome) elNome.textContent = gerente.nome || 'Gerente';
    if (elCat) elCat.textContent = gerente.categoria || 'Cargo de Confiança / Gerência';
    if (elCod) elCod.textContent = gerente.codigo || '--';
    if (elRep) elRep.textContent = gerente.codigoRep || gerente.pis || '97608920907';
    if (elCpf) elCpf.textContent = gerente.cpf || '--';

    // Intervalo de almoço padrão: 12:00 às 13:30 (1h30m)
    const almocoInicioInput = document.getElementById('espelho-gerente-almoco-inicio');
    const almocoFimInput = document.getElementById('espelho-gerente-almoco-fim');
    if (almocoInicioInput) almocoInicioInput.value = '12:00';
    if (almocoFimInput) almocoFimInput.value = '13:30';

    // Período padrão: Sempre traz por padrão o dia vigente (Hoje) para acelerar a consulta
    const dtInicioInput = document.getElementById('espelho-gerente-dt-inicio');
    const dtFimInput = document.getElementById('espelho-gerente-dt-fim');
    const hojeStr = new Date().toISOString().split('T')[0];
    if (dtInicioInput) dtInicioInput.value = hojeStr;
    if (dtFimInput) dtFimInput.value = hojeStr;

    // Abre o Modal do Espelho
    const modalEl = document.getElementById('modal-rhid-espelho-gerente');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }

    // Primeiro verifica se já existe histórico salvo no banco para o período
    const temHistorico = await carregarHistoricoSalvoEspelhoGerente(gerente, dtInicioInput.value, dtFimInput.value);
    if (!temHistorico) {
        // Se ainda não foi salvo, processa automaticamente as batidas live dos relógios
        await processarEspelhoPontoGerente(false);
    }
}

// Atalhos rápidos para seleção de período
async function definirPeriodoEspelho(tipo) {
    const dtInicioInput = document.getElementById('espelho-gerente-dt-inicio');
    const dtFimInput = document.getElementById('espelho-gerente-dt-fim');
    if (!dtInicioInput || !dtFimInput) return;

    const hoje = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (tipo === 'mes_atual') {
        const y = hoje.getFullYear();
        const m = hoje.getMonth();
        const primDia = new Date(y, m, 1);
        const ultDia = new Date(y, m + 1, 0);
        dtInicioInput.value = fmt(primDia);
        dtFimInput.value = fmt(ultDia);
    } else if (tipo === 'mes_anterior') {
        const y = hoje.getFullYear();
        const m = hoje.getMonth() - 1;
        const primDia = new Date(y, m, 1);
        const ultDia = new Date(y, m + 1, 0);
        dtInicioInput.value = fmt(primDia);
        dtFimInput.value = fmt(ultDia);
    } else if (tipo === 'ultimos_15') {
        const d15 = new Date(hoje);
        d15.setDate(hoje.getDate() - 14);
        dtInicioInput.value = fmt(d15);
        dtFimInput.value = fmt(hoje);
    } else if (tipo === 'hoje') {
        dtInicioInput.value = fmt(hoje);
        dtFimInput.value = fmt(hoje);
    }

    if (window._gerenteEspelhoAtual) {
        const temHistorico = await carregarHistoricoSalvoEspelhoGerente(window._gerenteEspelhoAtual, dtInicioInput.value, dtFimInput.value);
        if (!temHistorico) {
            await processarEspelhoPontoGerente(false);
        }
    }
}

// Carrega o histórico previamente salvo no Firestore
async function carregarHistoricoSalvoEspelhoGerente(gerente, dtInicio, dtFim) {
    if (!window.db || !gerente || !dtInicio || !dtFim) return false;

    const alertEl = document.getElementById('espelho-gerente-alert');

    try {
        const snap = await window.db.collection('espelhos_gerentes')
            .where('codigo', '==', String(gerente.codigo))
            .where('data', '>=', dtInicio)
            .where('data', '<=', dtFim)
            .get();

        if (snap.empty) {
            return false;
        }

        const diasSalvos = [];
        snap.forEach(doc => {
            diasSalvos.push(doc.data());
        });

        // Ordena por data crescente
        diasSalvos.sort((a, b) => a.data.localeCompare(b.data));

        const almocoIni = diasSalvos[0].almocoInicio || '12:00';
        const almocoFim = diasSalvos[0].almocoFim || '13:30';

        // Renderiza espelho a partir do histórico salvo no Firestore
        renderizarTabelaEspelho(gerente, dtInicio, dtFim, diasSalvos, true, almocoIni, almocoFim);

        if (alertEl) {
            alertEl.className = 'alert alert-success border-0 shadow-sm d-flex align-items-center mb-3 py-2';
            alertEl.innerHTML = `
                <i class="fas fa-history fs-4 me-3 text-success"></i>
                <div class="small">
                    <strong>Histórico Salvo Carregado do Banco:</strong> Foram recuperados <strong>${diasSalvos.length} dia(s) arquivados</strong> para o período de <strong>${dtInicio}</strong> a <strong>${dtFim}</strong>.
                    <br><span class="text-muted">Para buscar novas batidas recentes do relógio ou recalcular, clique em <strong>"Processar no RHiD / Leitor"</strong>.</span>
                </div>
            `;
            alertEl.classList.remove('d-none');
        }

        return true;
    } catch (e) {
        console.warn("Aviso ao consultar histórico salvo:", e);
        return false;
    }
}

// Processa o espelho no período desejado via API RHiD e AFD dos relógios físicos
async function processarEspelhoPontoGerente(isManualClick = true) {
    const gerente = window._gerenteEspelhoAtual;
    if (!gerente) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Nenhum gerente selecionado.', 'warning');
        return;
    }

    const dtInicioInput = document.getElementById('espelho-gerente-dt-inicio');
    const dtFimInput = document.getElementById('espelho-gerente-dt-fim');
    const almocoInicioInput = document.getElementById('espelho-gerente-almoco-inicio');
    const almocoFimInput = document.getElementById('espelho-gerente-almoco-fim');
    const btnProcessar = document.getElementById('btn-processar-espelho-gerente');
    const tbody = document.getElementById('espelho-gerente-tbody');
    const alertEl = document.getElementById('espelho-gerente-alert');

    const dtInicio = dtInicioInput ? dtInicioInput.value : '';
    const dtFim = dtFimInput ? dtFimInput.value : '';
    const almocoInicio = (almocoInicioInput && almocoInicioInput.value) ? almocoInicioInput.value : '12:00';
    const almocoFim = (almocoFimInput && almocoFimInput.value) ? almocoFimInput.value : '13:30';

    if (!dtInicio || !dtFim) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Selecione o período inicial e final.', 'warning');
        return;
    }

    if (btnProcessar) {
        btnProcessar.disabled = true;
        btnProcessar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processando...';
    }

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="py-5 text-center text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                    Buscando batidas do relógio físico e da nuvem RHiD com almoço pré-assinalado (${almocoInicio} às ${almocoFim})...
                </td>
            </tr>
        `;
    }

    try {
        // 1. Busca apuração na API RHiD (inclui live AFD de todos os 9 relógios)
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        const idPersons = gerente.rhidPersonId ? [gerente.rhidPersonId] : (gerente.id ? [gerente.id] : [1333]);

        let apuracaoList = [];
        try {
            const resp = await fetch(`${apiBaseUrl}/rhid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'syncApuration',
                    startDate: dtInicio,
                    endDate: dtFim,
                    idPersons: idPersons,
                    cpf: gerente.cpf || '',
                    query: gerente.codigo || ''
                })
            });

            const resData = await resp.json();
            if (resp.ok && resData.success) {
                apuracaoList = resData.data || [];
            }
        } catch (apiErr) {
            console.warn("Aviso na API RHiD:", apiErr);
        }

        // 2. Busca batidas locais / manuais no Firestore
        let localPunches = [];
        if (window.db) {
            try {
                const snapManual = await window.db.collection('visitantes_batidas_manuais')
                    .where('data', '>=', dtInicio)
                    .where('data', '<=', dtFim)
                    .get();
                snapManual.forEach(d => localPunches.push(d.data()));

                const snapLocal = await window.db.collection('visitantes_batidas')
                    .where('data', '>=', dtInicio)
                    .where('data', '<=', dtFim)
                    .get();
                snapLocal.forEach(d => localPunches.push(d.data()));
            } catch (fsErr) {
                console.warn("Aviso ao ler batidas locais:", fsErr);
            }
        }

        // 3. Monta todos os dias do período selecionado
        const datasPeriodo = gerarIntervaloDeDatas(dtInicio, dtFim);
        const diasSemanaNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const hojeStr = new Date().toISOString().split('T')[0];

        // Duração do intervalo de almoço em minutos
        const [hAlmIni, mAlmIni] = almocoInicio.split(':').map(Number);
        const [hAlmFim, mAlmFim] = almocoFim.split(':').map(Number);
        const minAlmocoTotal = Math.max(0, (hAlmFim * 60 + mAlmFim) - (hAlmIni * 60 + mAlmIni)); // Ex: 90 min (1h30m)

        const diasProcessados = [];

        for (const dataDia of datasPeriodo) {
            const partesData = dataDia.split('-');
            const dateObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
            const diaSemanaNum = dateObj.getDay();
            const diaSemanaNome = diasSemanaNomes[diaSemanaNum];

            // Coleta batidas da nuvem RHiD e AFD para este dia e para este gerente
            const batidas = [];
            apuracaoList.forEach(it => {
                const itDate = it.date ? it.date.split('T')[0] : (it.dateTimeStr || '');
                const matchDate = !itDate || itDate === dataDia;
                const matchId = gerente.rhidPersonId && String(it.idPerson) === String(gerente.rhidPersonId);
                const matchPis = it.pis && gerente.codigoRep && String(it.pis).replace(/\D/g, '') === String(gerente.codigoRep).replace(/\D/g, '');
                const matchCpf = it.cpf && gerente.cpfLimpo && String(it.cpf).replace(/\D/g, '') === String(gerente.cpfLimpo);
                const matchReg = it.registration && gerente.codigo && String(it.registration).replace(/\D/g, '') === String(gerente.codigo).replace(/\D/g, '');

                if (matchDate && (matchId || matchPis || matchCpf || matchReg)) {
                    if (Array.isArray(it.listAfdtManutencao)) {
                        it.listAfdtManutencao.forEach(b => {
                            const hStr = formatarHoraRhid(b);
                            if (hStr && hStr !== '--:--') {
                                batidas.push({
                                    hora: hStr,
                                    idDevice: b.idDevice || b.idAfd || 'Relógio REP',
                                    origem: 'RHiD Cloud / Relógio REP'
                                });
                            }
                        });
                    }
                }
            });

            // Mescla batidas manuais e portaria
            localPunches.forEach(mp => {
                if (mp.data === dataDia) {
                    const matchCod = mp.codigo && gerente.codigo && String(mp.codigo) === String(gerente.codigo);
                    const matchRep = mp.codigoRep && gerente.codigoRep && String(mp.codigoRep) === String(gerente.codigoRep);
                    const matchCpf = mp.cpfLimpo && gerente.cpfLimpo && mp.cpfLimpo === gerente.cpfLimpo;
                    const matchNome = mp.nome && gerente.nome && mp.nome.trim().toLowerCase() === gerente.nome.trim().toLowerCase();

                    if (matchCod || matchRep || matchCpf || matchNome) {
                        const hStr = mp.hora ? mp.hora.substring(0, 5) : '';
                        if (hStr) {
                            batidas.push({
                                hora: hStr,
                                idDevice: mp.origem || 'Leitor / Portaria',
                                origem: mp.origem || 'Leitor / Portaria'
                            });
                        }
                    }
                }
            });

            // Deduplica e ordena por horário
            const batidasUnicas = [];
            const horasSet = new Set();
            batidas.forEach(b => {
                if (!horasSet.has(b.hora)) {
                    horasSet.add(b.hora);
                    batidasUnicas.push(b);
                }
            });
            batidasUnicas.sort((a, b) => a.hora.localeCompare(b.hora));

            const nomesDispositivos = Array.from(new Set(batidasUnicas.map(b => b.idDevice || b.origem))).join(', ') || 'Relógio REP / RHiD';

            let entrada1 = '--:--';
            let saidaAlmoco = '--:--';
            let retornoAlmoco = '--:--';
            let saida2 = '--:--';
            let horasTrabalhadasStr = '00h 00m';
            let minutosTrabalhados = 0;
            let status = 'Sem Registro';
            let statusClass = 'text-muted';
            let ehDiaUtil = (diaSemanaNum >= 1 && diaSemanaNum <= 5);

            if (diaSemanaNum === 0) {
                // Domingo: DSR
                status = 'DSR';
                statusClass = 'badge bg-secondary bg-opacity-25 text-dark';
            } else if (diaSemanaNum === 6) {
                // Sábado: Folga / Compensado
                if (batidasUnicas.length > 0) {
                    entrada1 = batidasUnicas[0].hora;
                    saidaAlmoco = almocoInicio;
                    retornoAlmoco = almocoFim;
                    saida2 = batidasUnicas.length > 1 ? batidasUnicas[batidasUnicas.length - 1].hora : '--:--';
                    status = 'Trabalho em Sábado';
                    statusClass = 'badge bg-primary';
                } else {
                    status = 'Folga';
                    statusClass = 'badge bg-secondary bg-opacity-25 text-dark';
                }
            } else {
                // Segunda a Sexta (Dia Útil)
                if (batidasUnicas.length > 0) {
                    entrada1 = batidasUnicas[0].hora;
                    // Intervalo de Almoço Pré-assinalado por Lei (Art. 74 CLT)
                    saidaAlmoco = almocoInicio;
                    retornoAlmoco = almocoFim;

                    if (batidasUnicas.length >= 2) {
                        saida2 = batidasUnicas[batidasUnicas.length - 1].hora;
                        status = 'Presente';
                        statusClass = 'badge bg-success';
                    } else {
                        // Apenas 1 batida (Ex: entrou agora de manhã)
                        if (dataDia === hojeStr) {
                            saida2 = '--:--';
                            status = 'No Local (Em Aberto)';
                            statusClass = 'badge bg-info text-dark';
                        } else {
                            saida2 = '--:--';
                            status = 'Marcação Incompleta';
                            statusClass = 'badge bg-warning text-dark';
                        }
                    }

                    // Cálculo das Horas Trabalhadas deduzindo o intervalo de almoço pré-assinalado
                    if (entrada1 !== '--:--' && saida2 !== '--:--') {
                        const [he, me] = entrada1.split(':').map(Number);
                        const [hs, ms] = saida2.split(':').map(Number);
                        const minTotalBruto = Math.max(0, (hs * 60 + ms) - (he * 60 + me));

                        // Desconta 90 minutos de almoço se o período engloba o almoço
                        let minLiquido = minTotalBruto;
                        if (minTotalBruto > minAlmocoTotal) {
                            minLiquido = minTotalBruto - minAlmocoTotal;
                        }
                        minutosTrabalhados = minLiquido;
                        const hCalc = Math.floor(minLiquido / 60);
                        const mCalc = minLiquido % 60;
                        horasTrabalhadasStr = `${String(hCalc).padStart(2, '0')}h ${String(mCalc).padStart(2, '0')}m`;
                    }
                } else {
                    // Sem batidas no dia útil
                    if (dataDia > hojeStr) {
                        status = 'Aguardando';
                        statusClass = 'badge bg-light text-muted border';
                    } else if (dataDia === hojeStr) {
                        status = 'Sem Marcação';
                        statusClass = 'badge bg-warning text-dark';
                    } else {
                        status = 'Ausente / Falta';
                        statusClass = 'badge bg-danger';
                    }
                }
            }

            diasProcessados.push({
                data: dataDia,
                diaSemana: diaSemanaNome,
                diaSemanaNum: diaSemanaNum,
                ehDiaUtil: ehDiaUtil,
                entrada1: entrada1,
                saidaAlmoco: saidaAlmoco,
                retornoAlmoco: retornoAlmoco,
                saida2: saida2,
                horasTrabalhadasStr: horasTrabalhadasStr,
                minutosTrabalhados: minutosTrabalhados,
                status: status,
                statusClass: statusClass,
                origem: batidasUnicas.length > 0 ? nomesDispositivos : '--',
                batidasQtd: batidasUnicas.length,
                todasBatidas: batidasUnicas
            });
        }

        // Renderiza na tela
        renderizarTabelaEspelho(gerente, dtInicio, dtFim, diasProcessados, false, almocoInicio, almocoFim);

        if (alertEl) {
            alertEl.className = 'alert alert-info border-0 shadow-sm d-flex align-items-center mb-3 py-2';
            alertEl.innerHTML = `
                <i class="fas fa-check-circle fs-4 me-3 text-info"></i>
                <div class="small">
                    <strong>Apuração Atualizada do RHiD e Relógios Físicos:</strong> Espelho processado com intervalo de almoço pré-assinalado das <strong>${almocoInicio} às ${almocoFim}</strong>.
                    Clique em <strong>"Salvar Histórico"</strong> para arquivar permanentemente este espelho no banco de dados.
                </div>
            `;
            alertEl.classList.remove('d-none');
        }

        if (isManualClick && typeof mostrarMensagem === 'function') {
            mostrarMensagem('Espelho de ponto processado com sucesso!', 'success');
        }

    } catch (e) {
        console.error("Erro ao processar espelho do gerente:", e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-danger">Falha ao processar espelho: ${e.message}</td></tr>`;
        }
    } finally {
        if (btnProcessar) {
            btnProcessar.disabled = false;
            btnProcessar.innerHTML = '<i class="fas fa-bolt me-1"></i> Processar no RHiD / Leitor';
        }
    }
}

// Renderiza linhas e métricas consolidadas na tabela do espelho
function renderizarTabelaEspelho(gerente, dtInicio, dtFim, dias, salvoEmBanco, almocoInicio = '12:00', almocoFim = '13:30') {
    const tbody = document.getElementById('espelho-gerente-tbody');
    const elTotDias = document.getElementById('espelho-metric-total-dias');
    const elTrab = document.getElementById('espelho-metric-trabalhados');
    const elFolgas = document.getElementById('espelho-metric-folgas');
    const elTotHoras = document.getElementById('espelho-metric-total-horas');

    let totalDias = dias.length;
    let diasTrabalhados = 0;
    let folgasDsr = 0;
    let totalMinutos = 0;

    let rowsHtml = '';

    dias.forEach(d => {
        if (d.status === 'Presente' || d.status === 'No Local (Em Aberto)' || d.status === 'Trabalho em Sábado' || (d.entrada1 && d.entrada1 !== '--:--')) {
            diasTrabalhados++;
        }
        if (d.status === 'DSR' || d.status === 'Folga') {
            folgasDsr++;
        }
        totalMinutos += (d.minutosTrabalhados || 0);

        const dp = d.data.split('-');
        const dataFmt = `${dp[2]}/${dp[1]}/${dp[0]}`;

        const badgePre = `<span class="badge bg-warning bg-opacity-25 text-dark font-monospace px-2 py-1" title="Intervalo pré-assinalado Art. 74 CLT">`;

        rowsHtml += `
            <tr>
                <td class="fw-bold text-dark font-monospace">${dataFmt}</td>
                <td class="text-secondary">${d.diaSemana}</td>
                <td class="font-monospace fw-bold text-success">${d.entrada1 || '--:--'}</td>
                <td class="font-monospace text-dark">${d.saidaAlmoco !== '--:--' ? badgePre + d.saidaAlmoco + ' <small class="text-muted">(Pré)</small></span>' : '--:--'}</td>
                <td class="font-monospace text-dark">${d.retornoAlmoco !== '--:--' ? badgePre + d.retornoAlmoco + ' <small class="text-muted">(Pré)</small></span>' : '--:--'}</td>
                <td class="font-monospace fw-bold text-primary">${d.saida2 || '--:--'}</td>
                <td class="font-monospace fw-bold text-dark">${d.horasTrabalhadasStr || '00h 00m'}</td>
                <td><span class="${d.statusClass || 'badge bg-light text-dark border'}">${d.status}</span></td>
                <td class="small text-muted text-truncate" style="max-width: 180px;" title="${d.origem || ''}">${d.origem || '--'}</td>
            </tr>
        `;
    });

    const totH = Math.floor(totalMinutos / 60);
    const totM = totalMinutos % 60;
    const totalHorasStr = `${String(totH).padStart(2, '0')}h ${String(totM).padStart(2, '0')}m`;

    if (elTotDias) elTotDias.textContent = totalDias;
    if (elTrab) elTrab.textContent = diasTrabalhados;
    if (elFolgas) elFolgas.textContent = folgasDsr;
    if (elTotHoras) elTotHoras.textContent = totalHorasStr;

    if (tbody) {
        tbody.innerHTML = rowsHtml || '<tr><td colspan="9" class="py-4 text-center text-muted">Nenhum dia para o período.</td></tr>';
    }

    // Armazena no estado global da aplicação
    window._espelhoGerenteAtual = {
        gerente: gerente,
        dtInicio: dtInicio,
        dtFim: dtFim,
        almocoInicio: almocoInicio,
        almocoFim: almocoFim,
        salvoEmBanco: salvoEmBanco,
        totais: {
            totalDias: totalDias,
            diasTrabalhados: diasTrabalhados,
            folgasDsr: folgasDsr,
            totalMinutos: totalMinutos,
            totalHorasFormatado: totalHorasStr
        },
        dias: dias
    };
}

// Salva o espelho permanentemente no Firestore mantendo o histórico de fechamentos
async function salvarHistoricoEspelhoGerente() {
    const espelho = window._espelhoGerenteAtual;
    if (!espelho || !espelho.dias || espelho.dias.length === 0) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Processe o espelho primeiro antes de salvar o histórico.', 'warning');
        return;
    }

    const btnSalvar = document.getElementById('btn-salvar-espelho-gerente');
    const alertEl = document.getElementById('espelho-gerente-alert');

    if (btnSalvar) {
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Gravando...';
    }

    try {
        if (!window.db) throw new Error("Conexão com o banco de dados não disponível.");

        const batch = window.db.batch();
        const gerente = espelho.gerente;

        // Grava cada dia individualmente em 'espelhos_gerentes'
        espelho.dias.forEach(d => {
            const docId = `esp_${gerente.codigo}_${d.data}`;
            const ref = window.db.collection('espelhos_gerentes').doc(docId);
            batch.set(ref, {
                gerenteId: gerente.id || gerente.codigo,
                codigo: String(gerente.codigo),
                codigoRep: String(gerente.codigoRep || ''),
                cpf: String(gerente.cpf || ''),
                cpfLimpo: String(gerente.cpfLimpo || ''),
                nome: gerente.nome,
                data: d.data,
                diaSemana: d.diaSemana,
                diaSemanaNum: d.diaSemanaNum,
                entrada1: d.entrada1,
                saidaAlmoco: d.saidaAlmoco,
                retornoAlmoco: d.retornoAlmoco,
                saida2: d.saida2,
                intervaloPreAssinalado: true,
                almocoInicio: espelho.almocoInicio,
                almocoFim: espelho.almocoFim,
                horasTrabalhadasStr: d.horasTrabalhadasStr,
                minutosTrabalhados: d.minutosTrabalhados,
                status: d.status,
                statusClass: d.statusClass,
                origem: d.origem,
                atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        // Grava também o resumo de fechamento do período
        const fechamentoId = `fechamento_${gerente.codigo}_${espelho.dtInicio}_${espelho.dtFim}`;
        const refFechamento = window.db.collection('espelhos_gerentes_fechamentos').doc(fechamentoId);
        batch.set(refFechamento, {
            gerenteId: gerente.id || gerente.codigo,
            codigo: String(gerente.codigo),
            nome: gerente.nome,
            cpf: String(gerente.cpf || ''),
            dtInicio: espelho.dtInicio,
            dtFim: espelho.dtFim,
            almocoInicio: espelho.almocoInicio,
            almocoFim: espelho.almocoFim,
            totais: espelho.totais,
            totalDias: espelho.totais.totalDias,
            diasTrabalhados: espelho.totais.diasTrabalhados,
            folgasDsr: espelho.totais.folgasDsr,
            totalHorasFormatado: espelho.totais.totalHorasFormatado,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            salvoPor: 'RH / Nexter'
        }, { merge: true });

        await batch.commit();

        espelho.salvoEmBanco = true;

        if (alertEl) {
            alertEl.className = 'alert alert-success border-0 shadow-sm d-flex align-items-center mb-3 py-2';
            alertEl.innerHTML = `
                <i class="fas fa-check-double fs-4 me-3 text-success"></i>
                <div class="small">
                    <strong>Histórico Salvo com Sucesso!</strong> O espelho de ponto de <strong>${gerente.nome}</strong> para o período de <strong>${espelho.dtInicio}</strong> a <strong>${espelho.dtFim}</strong> foi gravado no banco de dados e ficará permanentemente acessível.
                </div>
            `;
            alertEl.classList.remove('d-none');
        }

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Histórico do espelho de ponto salvo com sucesso!', 'success');
        }

    } catch (e) {
        console.error("Erro ao salvar histórico do espelho:", e);
        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem('Erro ao salvar histórico: ' + e.message, 'error');
        }
    } finally {
        if (btnSalvar) {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Histórico';
        }
    }
}

// Impressão oficial do Espelho de Ponto (com pré-assinalação legal Art. 74 CLT)
function imprimirEspelhoGerente() {
    const espelho = window._espelhoGerenteAtual;
    if (!espelho || !espelho.dias || espelho.dias.length === 0) {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Processe ou carregue o espelho primeiro antes de imprimir.', 'warning');
        return;
    }

    const g = espelho.gerente;
    const dpIni = espelho.dtInicio.split('-');
    const dpFim = espelho.dtFim.split('-');
    const dtIniFmt = `${dpIni[2]}/${dpIni[1]}/${dpIni[0]}`;
    const dtFimFmt = `${dpFim[2]}/${dpFim[1]}/${dpFim[0]}`;

    let linhasHtml = '';
    espelho.dias.forEach(d => {
        const dp = d.data.split('-');
        const dFmt = `${dp[2]}/${dp[1]}/${dp[0]}`;
        linhasHtml += `
            <tr>
                <td style="text-align: center; font-weight: bold;">${dFmt}</td>
                <td style="text-align: left;">${d.diaSemana}</td>
                <td style="text-align: center; font-weight: bold;">${d.entrada1 || '--:--'}</td>
                <td style="text-align: center;">${d.saidaAlmoco !== '--:--' ? d.saidaAlmoco + ' *' : '--:--'}</td>
                <td style="text-align: center;">${d.retornoAlmoco !== '--:--' ? d.retornoAlmoco + ' *' : '--:--'}</td>
                <td style="text-align: center; font-weight: bold;">${d.saida2 || '--:--'}</td>
                <td style="text-align: center; font-weight: bold;">${d.horasTrabalhadasStr || '00h 00m'}</td>
                <td style="text-align: center;">${d.status}</td>
            </tr>
        `;
    });

    const printHtml = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Espelho de Ponto - ${g.nome} - ${dtIniFmt} a ${dtFimFmt}</title>
            <style>
                @page { size: A4 portrait; margin: 12mm 15mm; }
                body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 0; }
                .header { border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 12px; }
                .empresa-nome { font-size: 16px; font-weight: bold; text-transform: uppercase; }
                .doc-titulo { font-size: 13px; font-weight: bold; margin-top: 4px; text-transform: uppercase; color: #111; }
                .info-box { border: 1px solid #999; border-radius: 4px; padding: 8px; margin-bottom: 12px; background: #fafafa; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
                th, td { border: 1px solid #777; padding: 4px 6px; }
                th { background-color: #e9ecef; text-transform: uppercase; font-size: 9px; }
                .totais-box { display: flex; justify-content: space-between; border: 1px solid #777; background: #f1f3f5; padding: 6px 12px; font-weight: bold; margin-bottom: 16px; border-radius: 4px; }
                .declaracao { font-size: 9.5px; text-align: justify; border: 1px solid #ccc; padding: 8px; margin-bottom: 30px; line-height: 1.4; background: #fdfdfd; }
                .assinaturas { display: flex; justify-content: space-around; margin-top: 40px; text-align: center; }
                .assinatura-linha { width: 220px; border-top: 1px solid #222; padding-top: 4px; font-size: 10px; font-weight: bold; }
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="background: #e7f5ff; border: 1px solid #74c0fc; padding: 10px; margin-bottom: 15px; border-radius: 6px; text-align: right;">
                <button onclick="window.print()" style="background: #1971c2; color: #fff; font-weight: bold; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    IMPRIMIR DOCUMENTO (PDF)
                </button>
            </div>

            <div class="header">
                <div class="empresa-nome">CALÇADOS CRIVAL LTDA</div>
                <div class="doc-titulo">ESPELHO DE PONTO ELETRÔNICO — CONTROLE DE FREQUÊNCIA</div>
                <div style="font-size: 10px; color: #555;">Sistema Nexter v3 — Módulo Integração RHiD (Control iD)</div>
            </div>

            <div class="info-box">
                <div class="info-grid">
                    <div><strong>Colaborador / Gestor:</strong> ${g.nome}</div>
                    <div><strong>Período de Apuração:</strong> ${dtIniFmt} a ${dtFimFmt}</div>
                    <div><strong>Cargo / Perfil:</strong> ${g.categoria || 'Cargo de Confiança / Gerência'}</div>
                    <div><strong>Matrícula / Código Crachá:</strong> ${g.codigo || '--'}</div>
                    <div><strong>CPF:</strong> ${g.cpf || '--'}</div>
                    <div><strong>PIS / Código REP:</strong> ${g.codigoRep || '97608920907'}</div>
                    <div><strong>Jornada de Referência:</strong> 08:00 às 18:00</div>
                    <div><strong>Intervalo Pré-assinalado:</strong> ${espelho.almocoInicio} às ${espelho.almocoFim} (1h30m)</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 12%;">Data</th>
                        <th style="width: 14%;">Dia da Semana</th>
                        <th style="width: 12%;">Entrada 1</th>
                        <th style="width: 13%;">Saída Almoço *</th>
                        <th style="width: 13%;">Retorno Almoço *</th>
                        <th style="width: 12%;">Saída 2</th>
                        <th style="width: 12%;">Total Horas</th>
                        <th style="width: 12%;">Ocorrência</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasHtml}
                </tbody>
            </table>

            <div class="totais-box">
                <div>Dias no Período: ${espelho.totais.totalDias}</div>
                <div>Dias Trabalhados: ${espelho.totais.diasTrabalhados}</div>
                <div>Folgas / DSR: ${espelho.totais.folgasDsr}</div>
                <div>Total de Horas Trabalhadas: ${espelho.totais.totalHorasFormatado}</div>
            </div>

            <div class="declaracao">
                <strong>* INTERVALO INTRAJORNADA PRÉ-ASSINALADO:</strong> O intervalo para repouso e alimentação constante neste espelho (${espelho.almocoInicio} às ${espelho.almocoFim}) é pré-assinalado nos termos do <strong>Artigo 74, § 2º da Consolidação das Leis do Trabalho (CLT)</strong> e da <strong>Portaria MTP nº 671/2021</strong>.
                Reconheço a exatidão das marcações de entrada e saída registradas neste documento, confirmando a regular fruição do intervalo intrajornada.
            </div>

            <div class="assinaturas">
                <div>
                    <div class="assinatura-linha">
                        ${g.nome}<br>
                        <span style="font-weight: normal; font-size: 9px;">Assinatura do Colaborador / Gestor</span>
                    </div>
                </div>
                <div>
                    <div class="assinatura-linha">
                        CALÇADOS CRIVAL LTDA<br>
                        <span style="font-weight: normal; font-size: 9px;">Recursos Humanos / Gestão</span>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 400);
                };
            </script>
        </body>
        </html>
    `;

    const w = window.open('', '_blank');
    if (w) {
        w.document.open();
        w.document.write(printHtml);
        w.document.close();
    } else {
        if (typeof mostrarMensagem === 'function') mostrarMensagem('Permita a abertura de pop-ups no seu navegador para imprimir.', 'warning');
    }
}

// ==========================================================================
// IMPORTAÇÃO AUTOMÁTICA DE TODOS OS CADASTROS DO RHID CLOUD
// ==========================================================================

// Abre o modal de importação automática
function abrirModalImportarRhid() {
    const modalEl = document.getElementById('modal-rhid-importar-todos');
    const alertEl = document.getElementById('import-rhid-alert');
    const progContainer = document.getElementById('import-rhid-progress-container');
    const btnExec = document.getElementById('btn-executar-importacao-rhid');

    if (alertEl) alertEl.classList.add('d-none');
    if (progContainer) progContainer.classList.add('d-none');
    if (btnExec) {
        btnExec.disabled = false;
        btnExec.innerHTML = '<i class="fas fa-cloud-download-alt me-1"></i> Iniciar Importação Automática';
    }

    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    }
}

// Executa a importação automática de cadastros do RHiD e salva no Firestore
async function executarImportacaoRhidAutomatico() {
    const btnExec = document.getElementById('btn-executar-importacao-rhid');
    const alertEl = document.getElementById('import-rhid-alert');
    const progContainer = document.getElementById('import-rhid-progress-container');
    const progBar = document.getElementById('import-rhid-progress-bar');
    const progText = document.getElementById('import-rhid-status-text');
    const progPerc = document.getElementById('import-rhid-percentage');

    const radioMode = document.querySelector('input[name="radio-import-mode"]:checked');
    const mode = radioMode ? radioMode.value : 'managers_only';

    const hIni = (document.getElementById('import-horario-inicio') || {}).value || '08:00';
    const hFim = (document.getElementById('import-horario-fim') || {}).value || '18:00';

    if (btnExec) {
        btnExec.disabled = true;
        btnExec.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Importando da Nuvem...';
    }

    if (progContainer) progContainer.classList.remove('d-none');
    if (progBar) progBar.style.width = '20%';
    if (progText) progText.textContent = 'Consultando cadastros na nuvem RHiD...';
    if (progPerc) progPerc.textContent = '20%';

    try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3000/api'
            : '/api';

        const resp = await fetch(`${apiBaseUrl}/rhid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'importAllRhidPersons',
                mode: mode
            })
        });

        const resData = await resp.json();
        if (!resp.ok || !resData.success) {
            throw new Error(resData.message || 'Falha ao buscar cadastros no RHiD.');
        }

        const persons = resData.data || [];
        if (persons.length === 0) {
            if (alertEl) {
                alertEl.className = 'alert alert-info border-0 shadow-sm mt-3 mb-0';
                alertEl.innerHTML = '<i class="fas fa-info-circle me-1"></i> Nenhuma pessoa encontrada para o filtro selecionado.';
                alertEl.classList.remove('d-none');
            }
            if (btnExec) btnExec.disabled = false;
            return;
        }

        if (progBar) progBar.style.width = '60%';
        if (progText) progText.textContent = `Gravando ${persons.length} cadastros no banco de dados...`;
        if (progPerc) progPerc.textContent = '60%';

        // Grava no Firestore em lotes de 400 (limite do Firestore batch é 500)
        if (!window.db) throw new Error("Conexão com Firestore não inicializada.");

        const CHUNK_SIZE = 400;
        let salvos = 0;

        for (let i = 0; i < persons.length; i += CHUNK_SIZE) {
            const chunk = persons.slice(i, i + CHUNK_SIZE);
            const batch = window.db.batch();

            chunk.forEach(p => {
                const docId = `vis_${p.codigo || p.rhidPersonId}`;
                const ref = window.db.collection('visitantes').doc(docId);
                batch.set(ref, {
                    codigo: p.codigo,
                    codigoRep: p.codigoRep || '',
                    nome: p.nome,
                    cpf: p.cpf || '',
                    cpfLimpo: p.cpfLimpo || '',
                    rhidPersonId: p.rhidPersonId,
                    categoria: p.categoria || 'Cargo de Confiança / Gerência',
                    horarioInicio: hIni,
                    horarioFim: hFim,
                    horarioPrevisto: `${hIni} às ${hFim}`,
                    status: 'Ativo',
                    empresa: p.empresa || 'Calçados Crival',
                    setorVisitado: 'Geral',
                    importadoRhidEm: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                salvos++;
            });

            await batch.commit();
        }

        if (progBar) progBar.style.width = '100%';
        if (progText) progText.textContent = 'Importação e sincronização concluídas!';
        if (progPerc) progPerc.textContent = '100%';

        if (alertEl) {
            alertEl.className = 'alert alert-success border-0 shadow-sm mt-3 mb-0';
            alertEl.innerHTML = `
                <i class="fas fa-check-circle me-1"></i>
                <strong>Sucesso!</strong> Foram importados e cadastrados <strong>${salvos} colaboradores/gestores</strong> diretamente da nuvem RHiD!
            `;
            alertEl.classList.remove('d-none');
        }

        if (typeof mostrarMensagem === 'function') {
            mostrarMensagem(`${salvos} cadastros importados do RHiD com sucesso!`, 'success');
        }

        // Recarrega lista e apuração
        await carregarListaVisitantesCadastrados();
        await apurarVisitantesRhid(true);

        setTimeout(() => {
            const modalEl = document.getElementById('modal-rhid-importar-todos');
            if (modalEl && typeof bootstrap !== 'undefined') {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
        }, 1800);

    } catch (e) {
        console.error("Erro na importação automática:", e);
        if (alertEl) {
            alertEl.className = 'alert alert-danger border-0 shadow-sm mt-3 mb-0';
            alertEl.innerHTML = `<i class="fas fa-exclamation-triangle me-1"></i> Erro: ${e.message}`;
            alertEl.classList.remove('d-none');
        }
    } finally {
        if (btnExec) {
            btnExec.disabled = false;
            btnExec.innerHTML = '<i class="fas fa-cloud-download-alt me-1"></i> Iniciar Importação Automática';
        }
    }
}
