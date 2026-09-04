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

    if (!membroToken) {
        mostrarErro("Nenhum código de convite encontrado na URL.");
        return;
    }

    try {
        const docSnap = await db.collection('equipe_mbti').doc(membroToken).get();
        if (!docSnap.exists) {
            mostrarErro("Convite não encontrado no sistema.");
            return;
        }

        membroData = docSnap.data();

        if (membroData.status === 'Concluído') {
            mostrarErro("Você já concluiu este teste anteriormente. Obrigado!");
            return;
        }

        // Mostra boas vindas
        document.getElementById('step-loading').classList.remove('active');
        document.getElementById('step-dados').classList.add('active');
        document.getElementById('equipe-nome-display').textContent = membroData.nome;

    } catch (error) {
        console.error("Erro ao validar token:", error);
        mostrarErro("Ocorreu um erro ao acessar o servidor. Tente novamente mais tarde.");
    }
});

function mostrarErro(msg) {
    document.getElementById('step-loading').classList.remove('active');
    document.getElementById('step-erro').classList.add('active');
    document.getElementById('msg-erro').textContent = msg;
}

function avancarParaMbti() {
    document.getElementById('step-dados').classList.remove('active');
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
        // Atualiza o documento gerado pelo convite
        await db.collection('equipe_mbti').doc(membroToken).update({
            mbti: mbtiResultData,
            status: 'Concluído',
            dataTeste: firebase.firestore.FieldValue.serverTimestamp()
        });
        
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
