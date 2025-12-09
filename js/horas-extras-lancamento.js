// Lógica para o formulário de lançamento de Horas Extras

let lancamentoHorasExtrasInicializado = false;

async function inicializarLancamentoHorasExtras() {
    console.log('Inicializando Lançamento de Horas Extras...');
    
    // Evitar inicialização múltipla
    if (lancamentoHorasExtrasInicializado) {
        console.log('Lançamento de horas extras já inicializado');
        return;
    }
    
    const form = document.getElementById('form-lancamento-horas-extras');
    const employeeSelect = document.getElementById('he-lanc-employeeSelect');
    const dateField = document.getElementById('he-lanc-date');

    // Verificar se elementos essenciais existem
    if (!form || !employeeSelect || !dateField) {
        console.error('Elementos essenciais do formulário não encontrados!');
        mostrarMensagem('Erro ao carregar formulário de horas extras. Recarregue a página.', 'error');
        return;
    }

    try {
        // Configurar data padrão
        if (!dateField.value) {
            const hoje = new Date();
            dateField.value = hoje.toISOString().split('T')[0];
        }

        // Configurar event listeners apenas uma vez
        if (!form.dataset.bound) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await calcularEExibirHorasExtras();
            });
            form.dataset.bound = 'true';
        }

        if (!employeeSelect.dataset.bound) {
            await carregarFuncionariosParaSelect();
            employeeSelect.addEventListener('change', preencherDadosFuncionario);
            employeeSelect.dataset.bound = 'true';
        }

        // Preencher motivos
        preencherMotivosHorasExtras();
        
        // Configurar máscaras de entrada
        configurarMascaras();
        
        lancamentoHorasExtrasInicializado = true;
        console.log('Lançamento de Horas Extras inicializado com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar lançamento de horas extras:', error);
        mostrarMensagem('Erro ao inicializar sistema de horas extras.', 'error');
    }
}

function configurarMascaras() {
    // Máscara para CPF
    const cpfInput = document.getElementById('he-lanc-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            
            if (value.length <= 11) {
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d)/, '$1.$2');
                value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            }
            
            e.target.value = value;
        });
    }

    // Máscara para horário
    const entryTimeInput = document.getElementById('he-lanc-entryTime');
    const exitTimeInput = document.getElementById('he-lanc-exitTime');
    
    [entryTimeInput, exitTimeInput].forEach(input => {
        if (input) {
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 4) value = value.substring(0, 4);
                
                if (value.length >= 2) {
                    value = value.replace(/(\d{2})(\d)/, '$1:$2');
                }
                
                e.target.value = value;
            });
            
            // Placeholder para indicar formato
            input.placeholder = 'HH:mm';
        }
    });
}

function isValidTime(timeString) {
    if (!timeString) return false;
    
    // Verificar formato HH:mm
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) return false;
    
    // Verificar se é um horário válido
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function formatarData(data) {
    if (!(data instanceof Date) || isNaN(data)) {
        return 'Data inválida';
    }
    
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function isValidCPF(cpf) {
    // Função básica de validação de CPF
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Cálculo dos dígitos verificadores (simplificado)
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    
    return resto === parseInt(cpf.charAt(10));
}

function debugFirebaseStatus() {
    console.log('=== DEBUG FIREBASE STATUS ===');
    console.log('1. Firebase app inicializado?', !!window.firebase?.apps?.length);
    console.log('2. auth.currentUser:', window.auth?.currentUser?.email || 'null');
    console.log('3. db disponível?', typeof db !== 'undefined');
    console.log('4. db tem collection?', db && typeof db.collection === 'function');
    
    // Testar uma consulta simples
    if (db && typeof db.collection === 'function') {
        db.collection('funcionarios').limit(1).get()
            .then(snap => {
                console.log('5. Teste de consulta:', snap.size, 'documentos encontrados');
            })
            .catch(err => {
                console.log('5. Erro na consulta teste:', err.message);
            });
    }
}

async function carregarFuncionariosParaSelect() {
    const select = document.getElementById('he-lanc-employeeSelect');
    if (!select) {
        console.error('Select de funcionários não encontrado');
        return;
    }

    try {
        // Mostrar estado de carregamento
        select.innerHTML = '<option value="">Carregando funcionários...</option>';
        select.disabled = true;

        // AGUARDAR A INICIALIZAÇÃO COMPLETA DO FIREBASE
        if (!window.firebase || !window.firebase.apps || window.firebase.apps.length === 0) {
            console.error('Firebase não inicializado!');
            select.innerHTML = '<option value="">Erro: Firebase não configurado</option>';
            return;
        }

        // Verificar se auth.currentUser existe
        const user = window.auth ? window.auth.currentUser : null;
        if (!user) {
            console.error('Usuário não autenticado!');
            select.innerHTML = '<option value="">Erro: Faça login primeiro</option>';
            return;
        }

        // Executar debug
        debugFirebaseStatus();

        // Tentar diferentes coleções e filtros
        let snapshot = null;
        let collectionName = null;

        // Lista de possíveis coleções e filtros
        const tentativas = [
            // Tentativa 1: funcionarios com status ativo
            { 
                collection: 'funcionarios', 
                filter: { field: 'status', operator: '==', value: 'ativo' },
                orderBy: 'nome'
            },
            // Tentativa 2: funcionarios sem filtro (todos)
            { 
                collection: 'funcionarios', 
                filter: null,
                orderBy: 'nome'
            },
            // Tentativa 3: employees com active
            { 
                collection: 'employees', 
                filter: { field: 'active', operator: '==', value: true },
                orderBy: 'name'
            },
            // Tentativa 4: employees sem filtro
            { 
                collection: 'employees', 
                filter: null,
                orderBy: 'name'
            },
            // Tentativa 5: funcionarios com ativo = true
            { 
                collection: 'funcionarios', 
                filter: { field: 'ativo', operator: '==', value: true },
                orderBy: 'nome'
            }
        ];

        for (const tentativa of tentativas) {
            try {
                console.log(`Tentando coleção: ${tentativa.collection}, filtro:`, tentativa.filter);
                
                let query = db.collection(tentativa.collection);
                
                // Aplicar filtro se existir
                if (tentativa.filter) {
                    query = query.where(tentativa.filter.field, tentativa.filter.operator, tentativa.filter.value);
                }
                
                // Aplicar ordenação
                query = query.orderBy(tentativa.orderBy);
                
                snapshot = await query.get();
                collectionName = tentativa.collection;
                
                console.log(`Consulta ${tentativa.collection} sucesso:`, snapshot.size, 'documentos');
                
                if (!snapshot.empty) {
                    break; // Parar no primeiro que funcionar
                }
            } catch (error) {
                console.log(`Erro na tentativa ${tentativa.collection}:`, error.message);
                // Continuar para próxima tentativa
            }
        }

        if (!snapshot || snapshot.empty) {
            // Mensagem mais informativa
            select.innerHTML = `
                <option value="">
                    Nenhum funcionário encontrado.
                    Verifique se há dados na coleção 'funcionarios' ou 'employees'.
                </option>
            `;
            
            console.warn('Nenhum funcionário encontrado. Diagnóstico:');
            console.log('1. Verifique se há documentos nas coleções:');
            console.log('- funcionarios');
            console.log('- employees');
            console.log('2. Execute no console do navegador:');
            console.log('db.collection("funcionarios").limit(1).get().then(snap => console.log(snap.size))');
            console.log('3. Verifique autenticação:');
            console.log('auth.currentUser:', user ? user.email : 'null');
            
            return;
        }

        // Preencher o select com os dados encontrados
        select.innerHTML = '<option value="">Selecione o funcionário...</option>';
        
        snapshot.forEach(doc => {
            const func = doc.data();
            
            // Mapear diferentes nomes de campos possíveis
            const nome = func.nome || func.name || func.Nome || `Funcionário ${doc.id}`;
            const cpf = func.cpf || func.CPF || '';
            const salario = parseFloat(func.salario || func.salary || func.salario_base || func.salarioBase || 0);
            const setor = func.setor || func.sector || func.departamento || '';
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = nome;
            option.dataset.cpf = cpf;
            option.dataset.salario = salario;
            option.dataset.setor = setor;
            option.dataset.collection = collectionName; // Guardar a coleção usada
            
            select.appendChild(option);
        });
        
        select.disabled = false;
        console.log(`Carregados ${snapshot.size} funcionários com sucesso da coleção ${collectionName}!`);
        
        // Disparar evento de mudança para debug
        select.dispatchEvent(new Event('change'));
        
    } catch (error) {
        console.error("Erro crítico ao carregar funcionários:", error);
        console.error("Detalhes:", {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        select.innerHTML = `
            <option value="">
                Erro ao carregar: ${error.message || 'Erro desconhecido'}
            </option>
        `;
        
        // Tentar carregar uma lista de fallback local
        carregarFuncionariosFallback(select);
    }
}

// Função de fallback caso o Firestore falhe
function carregarFuncionariosFallback(select) {
    console.log('Usando fallback de funcionários...');
    
    // Lista de fallback (pode ser preenchida com dados locais)
    const funcionariosFallback = [
        { id: 'fallback1', nome: 'Funcionário de Exemplo', cpf: '000.000.000-00', salario: 2500, setor: 'Administrativo' }
    ];
    
    select.innerHTML = '<option value="">Selecione o funcionário...</option>';
    
    funcionariosFallback.forEach(func => {
        const option = document.createElement('option');
        option.value = func.id;
        option.textContent = func.nome;
        option.dataset.cpf = func.cpf;
        option.dataset.salario = func.salario;
        option.dataset.setor = func.setor;
        option.dataset.fallback = 'true'; // Marcar como fallback
        
        select.appendChild(option);
    });
    
    select.disabled = false;
    console.log('Fallback carregado com', funcionariosFallback.length, 'funcionários');
}

async function preencherDadosFuncionario(event) {
    const select = event.target;
    const funcionarioId = select.value;
    const cpfInput = document.getElementById('he-lanc-cpf');
    const salaryInput = document.getElementById('he-lanc-salary');
    const sectorInput = document.getElementById('he-lanc-sector');

    // Limpar campos se nenhum funcionário for selecionado
    if (!funcionarioId) {
        if (cpfInput) cpfInput.value = '';
        if (salaryInput) salaryInput.value = '';
        if (sectorInput) sectorInput.value = '';
        return;
    }

    // Verificar se é um fallback
    const selectedOption = select.options[select.selectedIndex];
    const isFallback = selectedOption.dataset.fallback === 'true';
    const collection = selectedOption.dataset.collection || 'funcionarios';

    try {
        // Se for fallback, usar dados do option
        if (isFallback) {
            console.log('Usando dados do fallback');
            if (cpfInput) cpfInput.value = selectedOption.dataset.cpf || '';
            if (salaryInput) salaryInput.value = selectedOption.dataset.salario || '0';
            if (sectorInput) sectorInput.value = selectedOption.dataset.setor || '';
            return;
        }

        // Buscar dados atualizados do Firestore
        console.log(`Buscando funcionário ${funcionarioId} da coleção ${collection}`);
        
        const doc = await db.collection(collection).doc(funcionarioId).get();
        
        if (!doc.exists) {
            console.warn('Documento não encontrado, usando dados do option');
            // Fallback para dados do option
            if (cpfInput) cpfInput.value = selectedOption.dataset.cpf || '';
            if (salaryInput) salaryInput.value = selectedOption.dataset.salario || '0';
            if (sectorInput) sectorInput.value = selectedOption.dataset.setor || '';
            return;
        }

        const func = doc.data();
        console.log('Dados do funcionário:', func);
        
        // Preencher campos
        if (cpfInput) {
            const cpf = func.cpf || func.CPF || '';
            cpfInput.value = cpf;
        }
        
        if (salaryInput) {
            // Extrair salário de diferentes campos possíveis
            const salario = parseFloat(
                func.salario || 
                func.salary || 
                func.salario_base || 
                func.salarioBase || 
                0
            );
            salaryInput.value = salario.toFixed(2);
        }
        
        if (sectorInput) {
            const setor = func.setor || func.sector || func.departamento || '';
            sectorInput.value = setor;
        }
        
        console.log(`Dados carregados para funcionário: ${func.nome || func.name}`);
        
    } catch (error) {
        console.error("Erro ao buscar dados do funcionário:", error);
        
        // Fallback para dados do option
        if (selectedOption) {
            if (cpfInput) cpfInput.value = selectedOption.dataset.cpf || '';
            if (salaryInput) salaryInput.value = selectedOption.dataset.salario || '0';
            if (sectorInput) sectorInput.value = selectedOption.dataset.setor || '';
        }
    }
}

function preencherMotivosHorasExtras() {
    const select = document.getElementById('he-lanc-reason');
    if (!select) {
        console.error('Select de motivos não encontrado');
        return;
    }

    // Evitar preencher múltiplas vezes
    if (select.options.length > 1 && select.dataset.filled === 'true') {
        return;
    }

    const motivos = [
        "Manutenção", "Limpeza", "Abastecer/Bater produto", "Treinamento", "Produção",
        "Organizar", "Lançar Monitoramento", "Limpeza de Matriz", "Limpeza de Robô",
        "Manutenção de Maq.Costura", "Manutenção de Injetora", "Revezamento de Estoque",
        "Transporte", "Organizar Palmilhas"
    ];

    select.innerHTML = '<option value="">Selecione o motivo...</option>';
    motivos.forEach(motivo => {
        const option = document.createElement('option');
        option.value = motivo;
        option.textContent = motivo;
        select.appendChild(option);
    });
    
    select.dataset.filled = 'true';
}

function validarFormularioHorasExtras() {
    const salary = document.getElementById('he-lanc-salary').value;
    const entryTime = document.getElementById('he-lanc-entryTime').value;
    const exitTime = document.getElementById('he-lanc-exitTime').value;
    const overtimeType = document.getElementById('he-lanc-overtimeType').value;
    const date = document.getElementById('he-lanc-date').value;
    const reason = document.getElementById('he-lanc-reason').value;
    const employeeSelect = document.getElementById('he-lanc-employeeSelect');

    const erros = [];

    // Validar funcionário
    if (!employeeSelect.value) {
        erros.push('Selecione um funcionário');
        employeeSelect.focus();
    }

    // Validar data
    if (!date) {
        erros.push('Data é obrigatória');
    } else {
        const dataObj = new Date(date + 'T00:00:00');
        if (isNaN(dataObj.getTime())) {
            erros.push('Data inválida');
        }
    }

    // Validar salário
    const salarioNum = parseFloat(salary);
    if (isNaN(salarioNum) || salarioNum <= 0) {
        erros.push('Salário deve ser maior que zero');
    }

    // Validar horários
    if (!isValidTime(entryTime)) {
        erros.push('Hora de entrada inválida (formato HH:mm)');
    }
    
    if (!isValidTime(exitTime)) {
        erros.push('Hora de saída inválida (formato HH:mm)');
    } else if (isValidTime(entryTime) && isValidTime(exitTime)) {
        // Validar se saída é depois da entrada
        const [entryHours, entryMinutes] = entryTime.split(':').map(Number);
        const [exitHours, exitMinutes] = exitTime.split(':').map(Number);
        
        const entryTotalMinutes = entryHours * 60 + entryMinutes;
        const exitTotalMinutes = exitHours * 60 + exitMinutes;
        
        if (exitTotalMinutes <= entryTotalMinutes) {
            erros.push('Hora de saída deve ser posterior à hora de entrada');
        }
    }

    // Validar tipo de hora extra
    if (!overtimeType || (overtimeType !== '50' && overtimeType !== '100')) {
        erros.push('Selecione o tipo de hora extra (50% ou 100%)');
    }

    // Validar motivo
    if (!reason) {
        erros.push('Selecione um motivo para as horas extras');
    }

    return erros;
}

async function calcularEExibirHorasExtras() {
    // Validar formulário primeiro
    const erros = validarFormularioHorasExtras();
    if (erros.length > 0) {
        mostrarMensagem(erros.join('<br>'), 'warning');
        return;
    }

    // Obter valores dos campos
    const salary = parseFloat(document.getElementById('he-lanc-salary').value);
    const entryTime = document.getElementById('he-lanc-entryTime').value;
    const exitTime = document.getElementById('he-lanc-exitTime').value;
    const overtimeType = parseInt(document.getElementById('he-lanc-overtimeType').value);
    const date = document.getElementById('he-lanc-date').value;
    const reason = document.getElementById('he-lanc-reason').value;
    const employeeSelect = document.getElementById('he-lanc-employeeSelect');
    const employeeName = employeeSelect.options[employeeSelect.selectedIndex].text;
    const cpf = document.getElementById('he-lanc-cpf').value;
    const sector = document.getElementById('he-lanc-sector').value;

    try {
        // Calcular diferença de horas
        const entryDateTime = new Date(`${date}T${entryTime}:00`);
        const exitDateTime = new Date(`${date}T${exitTime}:00`);
        
        // Se a saída for anterior à entrada, assumir que é no dia seguinte
        if (exitDateTime <= entryDateTime) {
            exitDateTime.setDate(exitDateTime.getDate() + 1);
        }
        
        const hoursDiff = (exitDateTime - entryDateTime) / (1000 * 60 * 60);
        
        if (hoursDiff <= 0) {
            mostrarMensagem('Erro no cálculo de horas. Verifique os horários.', 'error');
            return;
        }

        // Calcular valores
        const hourlyRate = salary / 220; // 220 horas mensais
        const overtimeRate = (overtimeType === 50) ? hourlyRate * 1.5 : hourlyRate * 2;
        const overtimePay = overtimeRate * hoursDiff;
        
        // Cálculo do DSR (Descanso Semanal Remunerado)
        // Considerando 26 dias úteis e 4-5 domingos/feriados no mês
        // Fórmula: (valor das horas extras / 26) × 5
        const dsr = (overtimePay / 26) * 5;

        // Preparar dados para exibição
        const overtimeData = {
            employeeId: employeeSelect.value,
            employeeName: employeeName,
            cpf: cpf,
            salary: salary,
            sector: sector,
            date: date,
            reason: reason,
            entryTime: entryTime,
            exitTime: exitTime,
            hours: parseFloat(hoursDiff.toFixed(2)),
            overtimeType: overtimeType,
            hourlyRate: parseFloat(hourlyRate.toFixed(2)),
            overtimeRate: parseFloat(overtimeRate.toFixed(2)),
            overtimePay: parseFloat(overtimePay.toFixed(2)),
            dsr: parseFloat(dsr.toFixed(2)),
            total: parseFloat((overtimePay + dsr).toFixed(2)),
            createdAt: new Date().toISOString(),
            status: 'pendente'
        };

        // Preencher modal de resultados
        exibirResultadoModal(overtimeData);
        
    } catch (error) {
        console.error('Erro ao calcular horas extras:', error);
        mostrarMensagem('Erro ao calcular horas extras. Verifique os dados informados.', 'error');
    }
}

function exibirResultadoModal(overtimeData) {
    const modalElement = document.getElementById('he-resultModal');
    if (!modalElement) {
        console.error('Elemento modal não encontrado');
        // Fallback: mostrar resultados em alerta
        alert(`
            Funcionário: ${overtimeData.employeeName}
            Data: ${formatarData(new Date(overtimeData.date + 'T00:00:00'))}
            Motivo: ${overtimeData.reason}
            Horas: ${overtimeData.hours}h
            Valor por Hora: R$ ${overtimeData.overtimeRate}
            Total Horas Extras: R$ ${overtimeData.overtimePay}
            DSR: R$ ${overtimeData.dsr}
            Total: R$ ${overtimeData.total}
        `);
        return;
    }

    // Preencher dados no modal
    document.getElementById('he-modalEmployeeName').textContent = overtimeData.employeeName;
    document.getElementById('he-modalDate').textContent = formatarData(new Date(overtimeData.date + 'T00:00:00'));
    document.getElementById('he-modalReason').textContent = overtimeData.reason;
    
    document.getElementById('he-modalResult').innerHTML = `
        <div class="row">
            <div class="col-6">
                <p><strong>Salário Base:</strong></p>
                <p><strong>Salário por Hora:</strong></p>
                <p><strong>Taxa Hora Extra:</strong></p>
                <p><strong>Horas Trabalhadas:</strong></p>
                <p><strong>Valor Horas Extras:</strong></p>
                <p><strong>DSR:</strong></p>
            </div>
            <div class="col-6 text-end">
                <p>R$ ${overtimeData.salary.toFixed(2)}</p>
                <p>R$ ${overtimeData.hourlyRate.toFixed(2)}</p>
                <p>R$ ${overtimeData.overtimeRate.toFixed(2)} (${overtimeData.overtimeType}%)</p>
                <p>${overtimeData.hours}h</p>
                <p class="fw-bold">R$ ${overtimeData.overtimePay.toFixed(2)}</p>
                <p>R$ ${overtimeData.dsr.toFixed(2)}</p>
            </div>
        </div>
        <hr>
        <div class="row">
            <div class="col-6">
                <h5><strong>TOTAL A PAGAR:</strong></h5>
            </div>
            <div class="col-6 text-end">
                <h5 class="text-success fw-bold">R$ ${overtimeData.total.toFixed(2)}</h5>
            </div>
        </div>
    `;

    // Configurar botão de salvar
    const saveButton = document.getElementById('he-saveButton');
    if (saveButton) {
        saveButton.onclick = () => salvarHorasExtras(overtimeData);
        
        // Mostrar estado inicial do botão
        saveButton.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Horas Extras';
        saveButton.disabled = false;
        saveButton.classList.remove('btn-secondary');
        saveButton.classList.add('btn-primary');
    }

    // Mostrar modal usando Bootstrap
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const resultModal = new bootstrap.Modal(modalElement);
            resultModal.show();
        } else {
            // Fallback se Bootstrap não estiver disponível
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
        }
    } catch (error) {
        console.error('Erro ao abrir modal:', error);
        modalElement.style.display = 'block';
    }
}

async function salvarHorasExtras(overtimeData) {
    const saveButton = document.getElementById('he-saveButton');
    const modalElement = document.getElementById('he-resultModal');
    
    if (!saveButton || !modalElement) {
        mostrarMensagem('Erro ao salvar: elementos não encontrados.', 'error');
        return;
    }

    try {
        // Mostrar estado de carregamento
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Salvando...';
        saveButton.disabled = true;
        
        // Adicionar timestamp e informações adicionais
        const dadosParaSalvar = {
            ...overtimeData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'usuario_atual',
            status: 'pendente'
        };

        // Salvar no Firestore
        await db.collection('overtime').add(dadosParaSalvar);
        
        console.log('Horas extras salvas com sucesso:', dadosParaSalvar);
        
        // Mostrar mensagem de sucesso
        mostrarMensagem('Horas extras salvas com sucesso!', 'success');
        
        // Fechar modal após um breve delay
        setTimeout(() => {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide();
                }
            } else {
                modalElement.style.display = 'none';
                modalElement.classList.remove('show');
            }
            
            // Limpar formulário
            const form = document.getElementById('form-lancamento-horas-extras');
            if (form) {
                form.reset();
                
                // Resetar campos específicos
                document.getElementById('he-lanc-cpf').value = '';
                document.getElementById('he-lanc-salary').value = '';
                document.getElementById('he-lanc-sector').value = '';
                
                // Resetar data para hoje (CORRIGIDO: adicionado [0])
                const dateField = document.getElementById('he-lanc-date');
                if (dateField) {
                    dateField.value = new Date().toISOString().split('T')[0];
                }
            }
        }, 1500);
        
    } catch (error) {
        console.error('Erro ao salvar horas extras: ', error);
        
        // Restaurar botão
        saveButton.innerHTML = '<i class="fas fa-save me-2"></i> Tentar Novamente';
        saveButton.disabled = false;
        
        mostrarMensagem('Erro ao salvar horas extras. Tente novamente.', 'error');
        
        // Log detalhado do erro
        if (error.code) {
            console.error('Código do erro:', error.code);
            console.error('Mensagem:', error.message);
        }
    }
}

function mostrarMensagem(mensagem, tipo = 'info') {
    console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
    
    const toastContainer = document.getElementById('toast-container') || criarContainerToasts();
    
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${tipo} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.innerHTML += toastHTML;
    
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
        toast.show();
    } else {
        alert(mensagem);
    }
}

function criarContainerToasts() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1060';
    document.body.appendChild(container);
    return container;
}

// Adicionar a função ao escopo global
window.inicializarLancamentoHorasExtras = inicializarLancamentoHorasExtras;

// Inicializar quando o DOM estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Módulo de horas extras carregado');
    });
}