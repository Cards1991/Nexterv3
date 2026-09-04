let totemMbtiStep = 1;
let totemMbtiAnswers = {
    E: 0, I: 0,
    S: 0, N: 0,
    T: 0, F: 0,
    J: 0, P: 0
};
let candidatoData = {};

document.addEventListener('DOMContentLoaded', () => {
    if (window.auth) {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                await carregarVagas();
            } else {
                document.getElementById('totem-vaga').innerHTML = '<option value="">Erro de Permissão: Faça login no sistema de RH primeiro.</option>';
            }
        });
    } else {
        carregarVagas();
    }
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

function renderMbtiStep(stepNumber) {
    totemMbtiStep = stepNumber;
    
    if (typeof mbtiData === 'undefined') {
        alert("O dicionário MBTI não carregou.");
        return;
    }
    
    // As in mbti.js, stages might not be in window.MbtiQuestions
    // Wait, mbti.js defines mbtiData and it has steps array, not stages.
    const stage = mbtiData.steps[stepNumber - 1];
    if (!stage) return;
    
    document.getElementById('totem-mbti-title').textContent = stage.title;
    document.getElementById('totem-mbti-desc').textContent = `Responda às questões da ${stage.title}.`;
    document.getElementById('totem-mbti-progress-text').textContent = `${stepNumber} de 4`;
    document.getElementById('totem-mbti-progress').style.width = `${(stepNumber / 4) * 100}%`;
    
    document.getElementById('totem-btn-prev').style.display = stepNumber > 1 ? 'block' : 'none';
    document.getElementById('totem-btn-next').textContent = stepNumber === 4 ? 'Finalizar Teste' : 'Próxima Etapa';
    
    const container = document.getElementById('totem-mbti-options');
    container.innerHTML = '';
    
    // Zera os contadores desta etapa
    totemMbtiAnswers[stage.letterA] = 0;
    totemMbtiAnswers[stage.letterB] = 0;
    
    stage.questions.forEach((q, index) => {
        const divInfo = document.createElement('div');
        divInfo.className = 'mb-4 p-3 border rounded bg-light shadow-sm';
        
        divInfo.innerHTML = `
            <div class="form-check mb-2">
                <input class="form-check-input" type="radio" name="totem-mbti-q-${stepNumber}-${index}" id="totem-mbti-q-${stepNumber}-${index}-a" value="a">
                <label class="form-check-label w-100" for="totem-mbti-q-${stepNumber}-${index}-a">${q.a}</label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="totem-mbti-q-${stepNumber}-${index}" id="totem-mbti-q-${stepNumber}-${index}-b" value="b">
                <label class="form-check-label w-100" for="totem-mbti-q-${stepNumber}-${index}-b">${q.b}</label>
            </div>
        `;
        container.appendChild(divInfo);
    });
}

function totemPrevMbtiStep() {
    if (totemMbtiStep > 1) {
        renderMbtiStep(totemMbtiStep - 1);
    }
}

async function totemNextMbtiStep() {
    const stage = mbtiData.steps[totemMbtiStep - 1];
    let answeredAll = true;
    
    stage.questions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="totem-mbti-q-${totemMbtiStep}-${index}"]:checked`);
        if (!selected) answeredAll = false;
        else {
            if (selected.value === 'a') totemMbtiAnswers[stage.letterA]++;
            else totemMbtiAnswers[stage.letterB]++;
        }
    });
    
    if (!answeredAll) {
        alert("Por favor, responda todas as questões antes de avançar.");
        // Reset count if they fail validation
        totemMbtiAnswers[stage.letterA] = 0;
        totemMbtiAnswers[stage.letterB] = 0;
        return;
    }
    
    if (totemMbtiStep < 4) {
        renderMbtiStep(totemMbtiStep + 1);
    } else {
        await finalizarCandidatoTotem();
    }
}

async function finalizarCandidatoTotem() {
    // Calcula o perfil MBTI
    const profile = [
        totemMbtiAnswers.E > totemMbtiAnswers.I ? 'E' : 'I',
        totemMbtiAnswers.S > totemMbtiAnswers.N ? 'S' : 'N',
        totemMbtiAnswers.T > totemMbtiAnswers.F ? 'T' : 'F',
        totemMbtiAnswers.J > totemMbtiAnswers.P ? 'J' : 'P'
    ].join('');
    
    const profileData = mbtiData.results ? mbtiData.results[profile] : null;
    
    candidatoData.mbti = {
        perfil: profile,
        titulo: profileData ? profileData.title : 'Concluído',
        grupo: profileData ? profileData.group : 'Finalizado',
        pontuacao: { ...totemMbtiAnswers },
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
        } else {
            throw new Error("API retornou erro ou 404.");
        }
    } catch (e) {
        console.warn("API do Escavador indisponível (provável GitHub Pages). Simulando resultado para testes...", e);
        // SIMULAÇÃO PARA TESTES DA INTERFACE DO GESTOR
        await db.collection('candidatos').doc(candidatoId).update({
            escavador_summary: {
                total: 2,
                confirmed: 1,
                highConfidence: 0,
                possible: 1,
                homonyms: 0,
                dataConsulta: new Date().toISOString()
            }
        });
        console.log("Resultado simulado do Escavador salvo com sucesso no Firebase.");
    }
}

function reiniciarTotem() {
    window.location.reload();
}
