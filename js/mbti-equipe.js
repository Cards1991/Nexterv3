let equipeMbtiStep = 1;
let equipeMbtiAnswers = {
    E: 0, I: 0,
    S: 0, N: 0,
    T: 0, F: 0,
    J: 0, P: 0
};
let membroData = {};

function formatarCpfEquipe(campo) {
    let cpf = campo.value.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.slice(0, 11);
    if (cpf.length > 9) cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (cpf.length > 6) cpf = cpf.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (cpf.length > 3) cpf = cpf.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    campo.value = cpf;
}

function avancarParaMbti() {
    const form = document.getElementById('form-equipe-mbti');
    if(!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const cpfRaw = document.getElementById('equipe-cpf').value;
    const cpf = cpfRaw.replace(/\D/g, '');
    if(cpf.length !== 11) {
        alert("Digite um CPF válido com 11 números.");
        return;
    }

    membroData = {
        nome: document.getElementById('equipe-nome').value.trim(),
        cpf: cpfRaw,
        dataTeste: firebase.firestore.FieldValue.serverTimestamp(),
    };

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
    
    membroData.mbti = {
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
        // Salva na coleção dedicada equipe_mbti
        await db.collection('equipe_mbti').add(membroData);
        
        // Também tenta atualizar na coleção 'funcionarios' se o CPF existir lá.
        const funcionarioSnap = await db.collection('funcionarios').where('cpf', '==', membroData.cpf).get();
        if(!funcionarioSnap.empty) {
            const funcDocId = funcionarioSnap.docs[0].id;
            await db.collection('funcionarios').doc(funcDocId).update({
                mbti: {
                    tipo: profile,
                    grupo: profileData.group,
                    titulo: profileData.title,
                    descricao: profileData.description,
                    dataTeste: firebase.firestore.FieldValue.serverTimestamp()
                }
            });
        }
        
        // Mostra tela de sucesso
        document.getElementById('step-mbti').classList.remove('active');
        document.getElementById('step-conclusao').classList.add('active');
        
    } catch (error) {
        console.error("Erro ao salvar resultado da equipe:", error);
        alert("Erro ao registrar suas respostas. Por favor, tente novamente ou chame o RH.");
        btnNext.innerHTML = 'Finalizar Teste';
        btnNext.disabled = false;
    }
}

function reiniciarTeste() {
    window.location.reload();
}
