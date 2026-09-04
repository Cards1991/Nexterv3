let equipeMbtiStep = 1;
let equipeMbtiAnswers = {
    E: 0, I: 0,
    S: 0, N: 0,
    T: 0, F: 0,
    J: 0, P: 0
};
let membroToken = null;
let membroData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    membroToken = urlParams.get('t');

    if (membroToken) {
        // Se houver token na URL, tentamos usar, mas não bloqueamos
        try {
            const docSnap = await db.collection('equipe_mbti').doc(membroToken).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                if (data.status === 'Concluído') {
                    mostrarErro("Você já concluiu este teste anteriormente. Obrigado!");
                    return;
                }
            }
        } catch (e) {
            console.warn("Aviso: Falha ao ler token inicial. Validaremos por CPF.", e);
        }
    }

    // Mostra a tela de CPF
    document.getElementById('step-loading').classList.remove('active');
    document.getElementById('step-validar-cpf').classList.add('active');
});

// Tenta logar anonimamente caso o sistema exija auth != null
async function garantirAutenticacao() {
    return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                resolve(true);
            } else {
                firebase.auth().signInAnonymously()
                    .then(() => resolve(true))
                    .catch(err => {
                        console.warn("Login anônimo não ativado no Firebase.", err);
                        resolve(false); // continua tentando mesmo sem auth
                    });
            }
        });
    });
}

function formatarCpfTotem(campo) {
    let cpf = campo.value.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.slice(0, 11);
    if (cpf.length > 9) cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (cpf.length > 6) cpf = cpf.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (cpf.length > 3) cpf = cpf.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    campo.value = cpf;
}

async function buscarColaboradorPorCpf() {
    const cpfRaw = document.getElementById('equipe-cpf').value;
    const cpfLimpo = cpfRaw.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
        alert("Por favor, digite um CPF válido.");
        return;
    }

    const btn = document.getElementById('btn-buscar-cpf');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
    btn.disabled = true;

    await garantirAutenticacao(); // Tenta o bypass anônimo antes de consultar

    try {
        // Busca funcionário pelo CPF
        let snap = await db.collection('funcionarios').where('cpf', '==', cpfRaw).get();
        if (snap.empty) {
            // Tenta buscar pelo CPF sem pontuação caso no banco esteja assim
            snap = await db.collection('funcionarios').where('cpf', '==', cpfLimpo).get();
        }

        if (snap.empty) {
            alert("Nenhum colaborador encontrado com este CPF. Verifique a digitação ou contate o RH.");
            btn.innerHTML = 'Buscar Cadastro';
            btn.disabled = false;
            return;
        }

        const funcDoc = snap.docs[0];
        membroData = funcDoc.data();
        membroData.funcionarioId = funcDoc.id;

        // Preenche o campo não editável
        document.getElementById('equipe-nome-encontrado').value = membroData.nome;
        document.getElementById('area-colaborador-encontrado').classList.remove('d-none');
        btn.style.display = 'none';

    } catch (error) {
        console.error("Erro ao buscar CPF:", error);
        
        let msg = "Erro de conexão ao buscar CPF.";
        if (error.message.includes("permissions") || error.code === "permission-denied") {
            msg = "ATENÇÃO RH: O banco de dados bloqueou a consulta por segurança (Missing or insufficient permissions). \n\n" +
                  "Você PRECISA acessar o Firebase Console > Firestore > Rules e liberar a leitura da coleção 'funcionarios' e 'equipe_mbti' conforme as instruções fornecidas pelo assistente. O código não consegue alterar isso sozinho.";
        }
        
        alert(msg);
        btn.innerHTML = 'Buscar Cadastro';
        btn.disabled = false;
    }
}

function mostrarErro(msg) {
    document.getElementById('step-loading').classList.remove('active');
    document.getElementById('step-erro').classList.add('active');
    document.getElementById('msg-erro').textContent = msg;
}

function avancarParaMbti() {
    // Se ainda havia step-dados, esconde. Mas o principal agora é step-validar-cpf.
    const stepDados = document.getElementById('step-dados');
    if (stepDados) stepDados.classList.remove('active');
    
    document.getElementById('step-validar-cpf').classList.remove('active');
    document.getElementById('step-mbti').classList.add('active');
    renderMbtiStep(1);
}

function renderMbtiStep(stepNumber) {
    equipeMbtiStep = stepNumber;
    
    if (typeof mbtiData === 'undefined') {
        alert("O dicionário MBTI não carregou.");
        return;
    }
    
    const stage = mbtiData.steps[stepNumber - 1];
    if (!stage) return;
    
    document.getElementById('equipe-mbti-title').textContent = stage.title;
    document.getElementById('equipe-mbti-desc').textContent = `Responda às questões da ${stage.title}.`;
    document.getElementById('equipe-mbti-progress-text').textContent = `${stepNumber} de 4`;
    document.getElementById('equipe-mbti-progress').style.width = `${(stepNumber / 4) * 100}%`;
    
    document.getElementById('equipe-btn-prev').style.display = stepNumber > 1 ? 'block' : 'none';
    document.getElementById('equipe-btn-next').textContent = stepNumber === 4 ? 'Finalizar Teste' : 'Próxima Etapa';
    
    const container = document.getElementById('equipe-mbti-options');
    container.innerHTML = '';
    
    // Zera os contadores desta etapa
    equipeMbtiAnswers[stage.letterA] = 0;
    equipeMbtiAnswers[stage.letterB] = 0;
    
    stage.questions.forEach((q, index) => {
        const divInfo = document.createElement('div');
        divInfo.className = 'mb-4 p-3 border rounded bg-light shadow-sm';
        
        divInfo.innerHTML = `
            <div class="form-check mb-2">
                <input class="form-check-input" type="radio" name="equipe-mbti-q-${stepNumber}-${index}" id="equipe-mbti-q-${stepNumber}-${index}-a" value="a">
                <label class="form-check-label w-100" for="equipe-mbti-q-${stepNumber}-${index}-a" style="cursor: pointer;">${q.a}</label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="equipe-mbti-q-${stepNumber}-${index}" id="equipe-mbti-q-${stepNumber}-${index}-b" value="b">
                <label class="form-check-label w-100" for="equipe-mbti-q-${stepNumber}-${index}-b" style="cursor: pointer;">${q.b}</label>
            </div>
        `;
        container.appendChild(divInfo);
    });
}

function equipePrevMbtiStep() {
    if (equipeMbtiStep > 1) {
        renderMbtiStep(equipeMbtiStep - 1);
    }
}

async function equipeNextMbtiStep() {
    const stage = mbtiData.steps[equipeMbtiStep - 1];
    let answeredAll = true;
    
    stage.questions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="equipe-mbti-q-${equipeMbtiStep}-${index}"]:checked`);
        if (!selected) answeredAll = false;
        else {
            if (selected.value === 'a') equipeMbtiAnswers[stage.letterA]++;
            else equipeMbtiAnswers[stage.letterB]++;
        }
    });
    
    if (!answeredAll) {
        alert("Por favor, responda todas as questões antes de avançar.");
        // Reset count if they fail validation
        equipeMbtiAnswers[stage.letterA] = 0;
        equipeMbtiAnswers[stage.letterB] = 0;
        return;
    }
    
    if (equipeMbtiStep < 4) {
        renderMbtiStep(equipeMbtiStep + 1);
    } else {
        await finalizarTesteEquipe();
    }
}

async function finalizarTesteEquipe() {
    // Calcula o perfil MBTI
    const profile = [
        equipeMbtiAnswers.E >= equipeMbtiAnswers.I ? 'E' : 'I',
        equipeMbtiAnswers.S >= equipeMbtiAnswers.N ? 'S' : 'N',
        equipeMbtiAnswers.T >= equipeMbtiAnswers.F ? 'T' : 'F',
        equipeMbtiAnswers.J >= equipeMbtiAnswers.P ? 'J' : 'P'
    ].join('');
    
    const profileData = mbtiData.results ? mbtiData.results[profile] : null;
    
    const mbtiResultData = {
        perfil: profile,
        titulo: profileData ? profileData.title : 'Concluído',
        grupo: profileData ? profileData.group : 'Finalizado',
        descricao: profileData ? profileData.description : '',
        pontuacao: { ...equipeMbtiAnswers }
    };
    
    const btnNext = document.getElementById('equipe-btn-next');
    btnNext.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnNext.disabled = true;
    
    try {
        // Atualiza o documento gerado pelo convite, ou cria um novo se for link genérico
        if (membroToken) {
            await db.collection('equipe_mbti').doc(membroToken).update({
                mbti: mbtiResultData,
                status: 'Concluído',
                dataTeste: firebase.firestore.FieldValue.serverTimestamp(),
                nome: membroData.nome, // Atualiza nome caso CPF não bata exatamente
                funcionarioId: membroData.funcionarioId
            });
        } else {
            await db.collection('equipe_mbti').add({
                nome: membroData.nome,
                funcionarioId: membroData.funcionarioId,
                mbti: mbtiResultData,
                status: 'Concluído',
                dataTeste: firebase.firestore.FieldValue.serverTimestamp(),
                dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Mostra tela de sucesso
        document.getElementById('step-mbti').classList.remove('active');
        document.getElementById('step-conclusao').classList.add('active');
        
    } catch (error) {
        console.error("Erro ao salvar resultado da equipe:", error);
        alert("Erro ao registrar suas respostas. Por favor, tente novamente.");
        btnNext.innerHTML = 'Finalizar Teste';
        btnNext.disabled = false;
    }
}
