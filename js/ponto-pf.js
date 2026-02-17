document.addEventListener('DOMContentLoaded', () => {
    const btnRegistrarPonto = document.getElementById('btn-registrar-ponto-pf');
    if (btnRegistrarPonto) {
        btnRegistrarPonto.addEventListener('click', () => {
            registrarPontoPorBiometria();
        });
    }
});

function registrarPontoPorBiometria() {
    const statusDiv = document.getElementById('ponto-pf-status');
    
    console.log("Solicitando autenticação biométrica...");
    statusDiv.innerHTML = `<div class="alert alert-info">Aguardando autenticação biométrica...</div>`;

    if (window.AndroidBiometria && typeof window.AndroidBiometria.autenticarBiometria === 'function') {
        try {
            window.AndroidBiometria.autenticarBiometria();
        } catch (e) {
            console.error("Erro ao chamar a função de biometria nativa:", e);
            statusDiv.innerHTML = `<div class="alert alert-danger">Erro ao iniciar o sensor biométrico.</div>`;
        }
    } else {
        console.warn("Interface 'AndroidBiometria' não encontrada. Usando modo de simulação.");
        // Simulação para testes no navegador
        const simularId = prompt("SIMULAÇÃO: Digite o ID do funcionário:");
        if (simularId) {
            window.onBiometriaIdentificada(simularId);
        } else {
            statusDiv.innerHTML = `<div class="alert alert-warning">Autenticação cancelada.</div>`;
        }
    }
}

// Callback que será chamado pelo código nativo Android após a autenticação
window.onBiometriaIdentificada = async function(funcionarioId) {
    const statusDiv = document.getElementById('ponto-pf-status');
    statusDiv.innerHTML = `<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> Processando ID: ${funcionarioId}...</div>`;

    try {
        // 1. Buscar dados do funcionário
        const funcionarioDoc = await db.collection('funcionarios').doc(funcionarioId).get();
        if (!funcionarioDoc.exists) {
            statusDiv.innerHTML = `<div class="alert alert-danger">Funcionário com ID ${funcionarioId} não encontrado.</div>`;
            return;
        }
        const funcionario = funcionarioDoc.data();
        const nomeFuncionario = funcionario.nome;

        // 2. Verificar se existe um ponto de entrada aberto para hoje
        const hoje = new Date();
        const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
        const fimDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

        const pontoAbertoSnapshot = await db.collection('pontos_pf')
            .where('funcionarioId', '==', funcionarioId)
            .where('status', '==', 'aberto')
            // Firestore não permite where em campos diferentes com desigualdade, então filtramos a data no cliente
            .get();
        
        const pontosAbertosHoje = pontoAbertoSnapshot.docs.filter(doc => {
            const dataPonto = doc.data().data.toDate();
            return dataPonto >= inicioDoDia && dataPonto <= fimDoDia;
        });

        if (pontosAbertosHoje.length === 0) {
            // 3. Se não houver, registrar ENTRADA
            const novoPonto = {
                funcionarioId: funcionarioId,
                nomeFuncionario: nomeFuncionario,
                empresaId: funcionario.empresaId || null,
                setor: funcionario.setor || null,
                data: firebase.firestore.Timestamp.fromDate(new Date()),
                horarioEntrada: firebase.firestore.Timestamp.fromDate(new Date()),
                horarioSaida: null,
                status: 'aberto',
                totalHoras: 0
            };
            await db.collection('pontos_pf').add(novoPonto);
            
            const horaEntrada = new Date().toLocaleTimeString('pt-BR');
            statusDiv.innerHTML = `<div class="alert alert-success">
                <strong>Entrada registrada para ${nomeFuncionario}</strong><br>
                Horário: ${horaEntrada}
            </div>`;

        } else {
            // 4. Se houver, registrar SAÍDA
            const pontoDoc = pontosAbertosHoje[0];
            const horarioEntrada = pontoDoc.data().horarioEntrada.toDate();
            const horarioSaida = new Date();

            // Calcula a duração em horas
            const diffMs = horarioSaida - horarioEntrada;
            const diffHours = diffMs / (1000 * 60 * 60);

            await db.collection('pontos_pf').doc(pontoDoc.id).update({
                horarioSaida: firebase.firestore.Timestamp.fromDate(horarioSaida),
                status: 'fechado',
                totalHoras: parseFloat(diffHours.toFixed(2))
            });

            // 5. Enviar para autorização de horas extras
            await criarSolicitacaoHoraExtra(funcionarioId, nomeFuncionario, funcionario, horarioEntrada, horarioSaida);

            const horaSaida = horarioSaida.toLocaleTimeString('pt-BR');
            statusDiv.innerHTML = `<div class="alert alert-primary">
                <strong>Saída registrada para ${nomeFuncionario}</strong><br>
                Horário: ${horaSaida}<br>
                Total de Horas: ${diffHours.toFixed(2)}h
            </div>`;
        }
    } catch (error) {
        console.error("Erro ao processar ponto:", error);
        statusDiv.innerHTML = `<div class="alert alert-danger">Ocorreu um erro: ${error.message}</div>`;
    }
};

/**
 * Calcula o valor estimado da hora extra, similar à lógica em autorizacao-horas.js
 */
async function calcularValorEstimadoHE(start, end, employeeId) {
    try {
        const duracaoMinutos = (end - start) / (1000 * 60);
        if (duracaoMinutos <= 0) return 0;

        const funcDoc = await db.collection('funcionarios').doc(employeeId).get();
        let salario = 0;
        if (funcDoc.exists) {
            salario = parseFloat(funcDoc.data().salario || 0);
        }
        
        if (salario <= 0) {
            console.warn(`Salário não encontrado ou zerado para funcionário ${employeeId}.`);
            return 0;
        }

        const valorHora = salario / 220;
        const horas = duracaoMinutos / 60;
        const valorExtra = horas * (valorHora * 1.5); // 50% de acréscimo
        const dsr = valorExtra / 6; // DSR simplificado

        return parseFloat((valorExtra + dsr).toFixed(2));
    } catch (error) {
        console.error("Erro no cálculo do valor estimado de HE:", error);
        return 0;
    }
}


async function criarSolicitacaoHoraExtra(funcionarioId, nomeFuncionario, funcionarioData, horarioEntrada, horarioSaida) {
    console.log(`Criando solicitação de hora extra para ${nomeFuncionario}.`);
    const statusDiv = document.getElementById('ponto-pf-status');

    try {
        const user = firebase.auth().currentUser;
        const valorEstimado = await calcularValorEstimadoHE(horarioEntrada, horarioSaida, funcionarioId);

        const solicitacao = {
            start: firebase.firestore.Timestamp.fromDate(horarioEntrada),
            end: firebase.firestore.Timestamp.fromDate(horarioSaida),
            employeeId: funcionarioId,
            employeeName: nomeFuncionario,
            reason: "Registrado via Ponto P.F.",
            status: "pendente",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdByName: user ? user.displayName : "Sistema",
            createdByUid: user ? user.uid : null,
            valorEstimado: valorEstimado,
            valorOriginalSolicitado: valorEstimado
        };

        await db.collection('solicitacoes_horas').add(solicitacao);
        
        console.log("Solicitação de hora extra criada com sucesso.");
        statusDiv.innerHTML += `<div class="alert alert-secondary mt-2">Solicitação de hora extra enviada para aprovação.</div>`;

    } catch (error) {
        console.error("Erro ao criar solicitação de hora extra:", error);
        statusDiv.innerHTML += `<div class="alert alert-danger mt-2">Falha ao enviar solicitação de hora extra.</div>`;
    }
}
