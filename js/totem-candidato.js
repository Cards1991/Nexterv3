let currentMbtiStep = 1;
let mbtiAnswers = {
    E: 0, I: 0,
    S: 0, N: 0,
    T: 0, F: 0,
    J: 0, P: 0
};
let candidatoData = {};

document.addEventListener('DOMContentLoaded', async () => {
    await carregarVagas();
});

function formatarCpfTotem(campo) {
    let cpf = campo.value.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.slice(0, 11);
    if (cpf.length > 9) cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    else if (cpf.length > 6) cpf = cpf.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (cpf.length > 3) cpf = cpf.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    campo.value = cpf;
}

async function carregarVagas() {
    const select = document.getElementById('totem-vaga');
    try {
        const vagasSnap = await db.collection('vagas').where('status', '==', 'Aberta').get();
        if(vagasSnap.empty) {
            select.innerHTML = '<option value="">Nenhuma vaga aberta no momento</option>';
            return;
        }
        
        vagasSnap.forEach(doc => {
            const vaga = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${vaga.titulo} (${vaga.empresaNome})`;
            option.dataset.titulo = vaga.titulo;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Erro ao carregar vagas", e);
        select.innerHTML = '<option value="">Erro ao carregar vagas</option>';
    }
}

function avancarParaMbti() {
    const form = document.getElementById('form-candidato-totem');
    if(!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const cpfRaw = document.getElementById('totem-cpf').value;
    const cpf = cpfRaw.replace(/\D/g, '');
    if(cpf.length !== 11) {
        alert("Digite um CPF válido com 11 números.");
        return;
    }

    const selectVaga = document.getElementById('totem-vaga');

    candidatoData = {
        nome: document.getElementById('totem-nome').value.trim(),
        cpf: cpfRaw,
        telefone: document.getElementById('totem-telefone').value.trim(),
        vagaId: selectVaga.value,
        vagaTitulo: selectVaga.options[selectVaga.selectedIndex].dataset.titulo,
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'Novo', // status inicial no kanban
        origem: 'Totem'
    };

    document.getElementById('step-dados').classList.remove('active');
    document.getElementById('step-mbti').classList.add('active');
    
    renderMbtiStep(1);
}

// Lógica simplificada do MBTI adaptada do mbti.js
function renderMbtiStep(stepNumber) {
    currentMbtiStep = stepNumber;
    
    if (!window.MbtiQuestions) {
        alert("O dicionário MBTI não carregou.");
        return;
    }
    
    const stage = window.MbtiQuestions.stages.find(s => s.id === stepNumber);
    if (!stage) return;
    
    document.getElementById('totem-mbti-title').textContent = `Etapa ${stepNumber}`;
    document.getElementById('totem-mbti-desc').textContent = `Escolha os 4 comportamentos que mais se parecem com você nesta etapa (${stage.desc}).`;
    document.getElementById('totem-mbti-progress-text').textContent = `${stepNumber} de 4`;
    document.getElementById('totem-mbti-progress').style.width = `${(stepNumber / 4) * 100}%`;
    
    document.getElementById('totem-btn-prev').style.display = stepNumber > 1 ? 'block' : 'none';
    document.getElementById('totem-btn-next').textContent = stepNumber === 4 ? 'Finalizar Teste' : 'Próxima Etapa';
    
    const container = document.getElementById('totem-mbti-options');
    container.innerHTML = '';
    
    // Zera os contadores desta etapa para evitar duplicação se o usuário voltar
    mbtiAnswers[stage.traitA] = 0;
    mbtiAnswers[stage.traitB] = 0;
    
    stage.questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'mbti-option-card';
        div.textContent = q.text;
        div.dataset.trait = q.trait;
        
        div.onclick = function() {
            this.classList.toggle('selected');
            const trait = this.dataset.trait;
            const selectedCount = container.querySelectorAll('.mbti-option-card.selected').length;
            
            if (this.classList.contains('selected')) {
                if (selectedCount > 4) {
                    this.classList.remove('selected');
                    alert("Você já selecionou as 4 características permitidas para esta etapa.");
                    return;
                }
                mbtiAnswers[trait]++;
            } else {
                mbtiAnswers[trait]--;
            }
        };
        container.appendChild(div);
    });
}

function totemPrevMbtiStep() {
    if (currentMbtiStep > 1) {
        renderMbtiStep(currentMbtiStep - 1);
    }
}

async function totemNextMbtiStep() {
    const selectedCount = document.querySelectorAll('#totem-mbti-options .mbti-option-card.selected').length;
    
    if (selectedCount !== 4) {
        alert("Por favor, selecione exatamente 4 características que mais combinam com você antes de avançar.");
        return;
    }
    
    if (currentMbtiStep < 4) {
        renderMbtiStep(currentMbtiStep + 1);
    } else {
        await finalizarCandidatoTotem();
    }
}

async function finalizarCandidatoTotem() {
    // Calcula o perfil MBTI
    const profile = [
        mbtiAnswers.E > mbtiAnswers.I ? 'E' : 'I',
        mbtiAnswers.S > mbtiAnswers.N ? 'S' : 'N',
        mbtiAnswers.T > mbtiAnswers.F ? 'T' : 'F',
        mbtiAnswers.J > mbtiAnswers.P ? 'J' : 'P'
    ].join('');
    
    const profileData = window.MbtiQuestions.profiles[profile];
    
    candidatoData.mbti = {
        perfil: profile,
        titulo: profileData ? profileData.title : 'Desconhecido',
        grupo: profileData ? profileData.group : 'Desconhecido',
        pontuacao: { ...mbtiAnswers },
        dataRealizacao: new Date().toISOString()
    };
    
    const btnNext = document.getElementById('totem-btn-next');
    btnNext.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btnNext.disabled = true;
    
    try {
        // Salva Candidato no Firestore
        const docRef = await db.collection('candidatos').add(candidatoData);
        const candidatoId = docRef.id;
        
        // Dispara o Background Check (Escavador) silenciosamente e não bloqueia a tela!
        dispararEscavador(candidatoId, candidatoData.cpf, candidatoData.nome);
        
        // Mostra tela de sucesso
        document.getElementById('step-mbti').classList.remove('active');
        document.getElementById('step-conclusao').classList.add('active');
        
    } catch (error) {
        console.error("Erro ao salvar candidato", error);
        alert("Erro ao registrar seus dados. Por favor, tente novamente ou chame o recrutador.");
        btnNext.innerHTML = 'Finalizar Teste';
        btnNext.disabled = false;
    }
}

async function dispararEscavador(candidatoId, cpfRaw, nomeRaw) {
    const cpf = cpfRaw.replace(/\D/g, '');
    console.log(`Disparando Escavador background para candidato: ${candidatoId}`);
    try {
        // Chama API interna proxy Escavador
        const response = await fetch('/api/legal/process-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                personId: candidatoId,
                cpfRaw: cpf,
                nomeRaw: nomeRaw,
                mode: 'AUTO' // Busca baseada nas regras iniciais padrão
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'SUCCESS_WITH_RESULTS') {
            const sum = data.summary;
            // Salva o resumo no Firebase no perfil do candidato
            await db.collection('candidatos').doc(candidatoId).update({
                escavador_summary: {
                    total: sum.total,
                    confirmed: sum.confirmed,
                    highConfidence: sum.highConfidence,
                    possible: sum.possible,
                    homonyms: sum.homonyms,
                    dataConsulta: new Date().toISOString()
                }
            });
            console.log("Escavador Summary salvo com sucesso.");
        } else if (response.ok && data.status === 'NO_RESULTS') {
            await db.collection('candidatos').doc(candidatoId).update({
                escavador_summary: {
                    total: 0,
                    dataConsulta: new Date().toISOString()
                }
            });
            console.log("Nenhum processo encontrado no Escavador.");
        }
    } catch (e) {
        console.error("Erro ao disparar automação Escavador:", e);
    }
}

function reiniciarTotem() {
    window.location.reload();
}
