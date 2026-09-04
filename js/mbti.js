// js/mbti.js

const mbtiData = {
    steps: [
        {
            title: "Etapa 1: Direção de Energia",
            description: "Extrovertido (E) ou Introvertido (I)",
            letterA: "E",
            letterB: "I",
            questions: [
                {
                    a: "Eu normalmente gosto de ter muitas pessoas à minha volta.",
                    b: "Normalmente eu preciso de muito tempo sozinho."
                },
                {
                    a: "Eu me distraio facilmente.",
                    b: "Eu posso me concentrar sobre o assunto em questão por muito tempo, sem me distrair."
                },
                {
                    a: "É fácil para mim, abordar pessoas desconhecidas e estabelecer contato com elas.",
                    b: "Eu sou mais reservado e criterioso com desconhecidos, com novas relações ou amizades."
                },
                {
                    a: "Minhas ações e decisões, muitas vezes são impulsivas.",
                    b: "Penso nas coisas intensamente, antes de agir ou decidir."
                },
                {
                    a: "Prefiro estar no centro das coisas, tenho muitos amigos e diria, uma vida social intensa.",
                    b: "Eu sou mais reservado, prefiro uma noite tranquila, no máximo com poucos amigos."
                },
                {
                    a: "Eu gosto de organizar o meu tempo livre junto com mais pessoas.",
                    b: "Eu gosto de gastar o meu tempo livre sozinho, lendo, ou talvez, até sonhando acordado."
                },
                {
                    a: "Eu não sei deixar de expressar meu ponto de vista quando estou debatendo algum assunto.",
                    b: "Poucos sabem o que eu realmente penso, sou um tanto calado."
                },
                {
                    a: "Meus sentimentos são animados e espontâneos.",
                    b: "Meus sentimentos são discretos, com frequência os escondo."
                },
                {
                    a: "Um clube de férias, um parque ou viajar com um grupo de amigos é a coisa certa para mim.",
                    b: "A minha ideia para um bom feriado é uma viagem sozinho, ir a uma casa de campo, ou talvez a uma ilha."
                },
                {
                    a: "Eu prefiro discutir os meus problemas com os outros.",
                    b: "Se alguma coisa me incomoda, eu tento resolver isto o quanto antes, sem envolver outras pessoas."
                }
            ]
        },
        {
            title: "Etapa 2: Processamento de Informação",
            description: "Sensorial (S) ou Intuitivo (N)",
            letterA: "S",
            letterB: "N",
            questions: [
                {
                    a: "Quando tomo decisões, sou guiado pelos meus cinco sentidos, pelas informações concretas, exatas.",
                    b: "Quando preciso tomar decisões, muitas vezes deixo que minha intuição me guie, até improvisando."
                },
                {
                    a: "Eu não gosto de deixar as coisas simplesmente ao acaso.",
                    b: "Eu não gosto quando tudo é muito previsível, muito exato."
                },
                {
                    a: "Sou daqueles que só acredita vendo.",
                    b: "Acredito no que me dizem e por isso, às vezes me envolvo em problemas."
                },
                {
                    a: "Eu prefiro trabalhar praticamente e não ficar teorizando.",
                    b: "Eu gosto, até prefiro trabalhar com coisas teóricas."
                },
                {
                    a: "Eu normalmente não tenho nenhum problema em partilhar minhas coisas e meu espaço pessoal com os outros.",
                    b: "Eu preciso de o meu próprio espaço pessoal e uma grande quantidade de tempo só para mim."
                },
                {
                    a: "Quando eu tenho a minha opinião sobre um determinado assunto, me atenho a ele e o defendo persistente.",
                    b: "Gosto de começar algo novo e rapidamente me aborreço com os antigos projetos."
                },
                {
                    a: "Eu gosto de enfrentar os verdadeiros problemas do cotidiano.",
                    b: "Pode-se até dizer, que tenho uma 'veia filosófica'."
                },
                {
                    a: "Ao trabalhar, os meus pontos fortes incluem paciência e cuidado.",
                    b: "Trabalho bem com dados aproximados e o resultado disso é normalmente bom."
                },
                {
                    a: "Posso quase sempre dizer que estou satisfeito com minha vida.",
                    b: "Estou sempre à procura de novas ideias, mudanças e em busca de possibilidades."
                },
                {
                    a: "Acima de tudo, eu vivo no aqui e agora.",
                    b: "Penso muito sobre o futuro."
                }
            ]
        },
        {
            title: "Etapa 3: Tomada de Decisão",
            description: "Racional (T) ou Emotivo (F)",
            letterA: "T",
            letterB: "F",
            questions: [
                {
                    a: "Minhas decisões cotidianas são normalmente baseadas em lógica.",
                    b: "Eu baseio muitas das minhas decisões em meu instinto, confio nele."
                },
                {
                    a: "No meu trabalho, reflexão e análise prévia são medidas necessárias.",
                    b: "No meu trabalho, não tenho qualquer dificuldade em me relacionar com as pessoas."
                },
                {
                    a: "Na maior parte das vezes, digo o que penso, ainda que desagrade a alguns.",
                    b: "Eu tento não machucar os outros com minhas palavras, ainda que às vezes tenha vontade disso."
                },
                {
                    a: "Muitos me consideram demasiado rigoroso, porque sou exigente e não deixo passar erros.",
                    b: "Procuro focar nos aspectos positivos de uma pessoa e não nos pontos fracos."
                },
                {
                    a: "Nem sempre acompanho as últimas novidades entre as pessoas do meu círculo de amigos.",
                    b: "Eu sou normalmente a primeira pessoa a ser chamada se alguém tem algo novo a dizer, ou precisa de ajuda."
                },
                {
                    a: "Posso muito bem lidar com as críticas a meu respeito, não me abalo facilmente.",
                    b: "Sou sensível a críticas e às vezes isso torna fácil de me machucar."
                },
                {
                    a: "Meias palavras não estão na minha preferência, as pessoas devem dizer claramente o que querem.",
                    b: "Eu noto se há algo dito nas entrelinhas, ou intenções por trás das palavras."
                },
                {
                    a: "Posso até dizer que gosto de discussões, nem que seja para lutar por alguma coisa.",
                    b: "Eu tento evitar discussões, pois a harmonia e paz é muito importante para mim."
                },
                {
                    a: "Acima de tudo, eu me deixo guiar pela razão, pela lógica.",
                    b: "Eu ouço, e muito frequentemente obedeço meus sentimentos e instintos."
                },
                {
                    a: "Eu não gosto de demonstrar minhas emoções para outras pessoas.",
                    b: "Eu não tenho dificuldade em demonstrar meus sentimentos para outras pessoas."
                }
            ]
        },
        {
            title: "Etapa 4: Estilo de Vida",
            description: "Julgador (J) ou Perceptivo (P)",
            letterA: "J", 
            letterB: "P",
            questions: [
                {
                    a: "Eu prefiro planejar tudo com antecedência, para não ter surpresas.",
                    b: "Eu gosto de surpresas."
                },
                {
                    a: "Faço uma coisa de cada vez.",
                    b: "Não tenho nenhum problema em fazer várias coisas ao mesmo tempo."
                },
                {
                    a: "Normalmente sou confiável e pontual e não gosto nada quando os outros não o são.",
                    b: "Acho difícil cumprir horários e prazos."
                },
                {
                    a: "Sou da opinião que primeiro vem o trabalho, depois a diversão.",
                    b: "Eu gosto de um trabalho que me agrade e não seja apenas um meio de ganhar a vida."
                },
                {
                    a: "Eu prefiro tudo no seu devido lugar e me incomoda a desorganização das coisas.",
                    b: "Acredito que mesmo onde há desorganização, está presente a criatividade."
                },
                {
                    a: "Tomo decisões claras, rápidas e práticas e espero o mesmo dos outros.",
                    b: "Às vezes tenho problemas em decidir, pois gosto de estar aberto a mais opções ao invés de escolher uma só."
                },
                {
                    a: "Eu gosto de ordem, regras e de regulamentos e me irritam as pessoas que não agem assim.",
                    b: "Espontaneidade e flexibilidade são mais importantes para mim do que as regras e regulamentos."
                },
                {
                    a: "Planejo meu trabalho com cuidado a fim de que não haja nenhuma correria de última hora.",
                    b: "Muitas vezes deixo as minhas tarefas para o último minuto."
                },
                {
                    a: "Eu já sei exatamente o que vou fazer no próximo fim de semana, procuro me programar e prever.",
                    b: "Não tenho a menor ideia do que acontecerá, mas as coisas se transformam e acho que no fim, tudo dará certo."
                },
                {
                    a: "Normalmente, eu faço primeiro as coisas das quais não gosto, para me livrar delas o quanto antes.",
                    b: "Eu tenho o hábito de simplesmente tentar esquecer ou me esquivar de assuntos desagradáveis, pesados."
                }
            ]
        }
    ],
    results: {
        "INFJ": {
            group: "Os Idealistas",
            title: "O Conselheiro (INFJ)",
            description: "Sensitivo, profundo e algumas vezes místico. Sério ao considerar valores pessoais e convicções. Tem vida interior rica e valoriza a integridade pessoal. Criativo, original e idealista. Reservado, gentil e compassivo. Aprecia a solidão e sente grande necessidade de harmonia. Consciencioso, determinado e perseverante.",
            profissoes: "Psicólogo, Conselheiro, Professor, Escritor, Assistente Social"
        },
        "ISTJ": {
            group: "Os Administradores",
            title: "O Inspetor (ISTJ)",
            description: "Reservado, perseverante, fiel e cuidadoso. Sistemático, organizado e atento aos fatos. Trabalhador, meticuloso, obediente. Pé no chão, pragmático, honesto, honra seus compromissos. Faz o que é certo e espera o mesmo dos outros. É calmo e firme em momentos de crise.",
            profissoes: "Contador, Auditor, Administrador, Engenheiro, Policial"
        },
        "ISFJ": {
            group: "Os Administradores",
            title: "O Protetor (ISFJ)",
            description: "Consciencioso, honesto e cooperativo. Leal, digno de crédito e autodisciplinado. Demonstra respeitar a ética profissional e completa suas tarefas nos prazos. Excelente memória para detalhes. Amigo silencioso, sério e reservado. Frequentemente trabalha nos bastidores, ajudando os outros. Modesto e simples. Emotivo, diplomata e gentil.",
            profissoes: "Enfermeiro, Professor Infantil, Assistente Social, Nutricionista, RH"
        },
        "INTJ": {
            group: "Os Pesquisadores",
            title: "O Arquiteto (INTJ)",
            description: "Independente e individualista. Tem muita perspicácia e visão. Hábil em criar teorias e métodos. Estimula a si mesmo e aos outros para alcançar seus objetivos e auto-desenvolvimento. Engenhoso e criativo ao resolver problemas. Organizado, determinado e líder confiável. Responsável, reservado e discreto.",
            profissoes: "Engenheiro, Cientista, Estrategista de TI, Arquiteto, Analista de Dados"
        },
        "ISTP": {
            group: "Os Ativos",
            title: "O Artesão (ISTP)",
            description: "Prefere agir do que conversar. Gosta de aventura e desafios. Resolve bem as crises. Se sai bem em trabalhos com ferramentas, máquinas ou quaisquer outros que requerem habilidade manual. Cheio de expediente, independente e determinado. Coerente, realista e prático. Reservado, desapegado, observador curioso.",
            profissoes: "Mecânico, Engenheiro Civil, Desenvolvedor de Software, Piloto, Analista de Sistemas"
        },
        "ISFP": {
            group: "Os Ativos",
            title: "O Compositor (ISFP)",
            description: "Gentil, leal e compassivo. Aparenta ser reservado e simples. Ajuda os outros discretamente. Paciente, sabe aceitar as coisas como são e não faz julgamentos. É a favor da filosofia do viver e deixar viver. Sensibiliza-se com conflitos e discórdias. Tem pouca necessidade de dominar ou controlar os outros.",
            profissoes: "Designer, Artista, Músico, Fotógrafo, Estilista"
        },
        "INFP": {
            group: "Os Idealistas",
            title: "O Curador (INFP)",
            description: "Devotado, compassivo, mente aberta e gentil. Detesta regras, ordens, planejamentos e prazos. Gosta de aprender e estar envolvido em projetos próprios. Tem convicções apaixonadas e persegue ideais. Estabelece padrões elevados para si mesmo. Idealista, sensível e criativo. Pode ser reservado e contemplativo.",
            profissoes: "Escritor, Artista, Psicólogo, Editor, Tradutor"
        },
        "INTP": {
            group: "Os Pesquisadores",
            title: "O Pensador (INTP)",
            description: "Analítico e brilhante. Pensador original, competente para solucionar problemas. Idiossincrático e não-conformista. Valoriza a precisão no pensar e no falar. Observa a inconsistência, as contradições e os lapsos no discurso alheio. Independente, curioso e compreensivo. Discreto, reservado e introspectivo.",
            profissoes: "Programador, Matemático, Analista Financeiro, Pesquisador, Cientista"
        },
        "ESTP": {
            group: "Os Ativos",
            title: "O Promotor (ESTP)",
            description: "Gosta de enfrentar riscos, desafios e aventuras. Cheio de energia, vive em constante movimento. Leva a vida às últimas consequências. Atento, confiante e persuasivo. Pode ser escandaloso, direto, impulsivo. Competente, cheio de expedientes, responde bem às crises. Realista e pragmático. Negociador habilidoso.",
            profissoes: "Vendedor, Empreendedor, Corretor, Bombeiro, Gestor de Crises"
        },
        "ESFP": {
            group: "Os Ativos",
            title: "O Animador (ESFP)",
            description: "Solícito, generoso, cooperativo, gosta de ajudar os outros. Amigável, gregário, enérgico, vivaz e charmoso. É quase sempre a alma da festa. Tolerante, aceita a si mesmo e aos outros. Tem senso prático. Enfatiza o positivo. Gosta de novas experiências e tem entusiasmo pela vida.",
            profissoes: "Ator, Relações Públicas, Designer, Organizador de Eventos, Recreador"
        },
        "ENFP": {
            group: "Os Idealistas",
            title: "O Campeão (ENFP)",
            description: "Acolhedor, prestativo, respeitador e compassivo. Cheio de entusiasmo e novas ideias. Valoriza a liberdade e a autonomia. Sabe se comunicar muito bem e inspirar ações. Criativo, espontâneo, positivo e amante de diversões. Individualista, introspectivo, perceptivo.",
            profissoes: "Jornalista, Ator, Consultor de RH, Publicitário, Empreendedor Criativo"
        },
        "ENTP": {
            group: "Os Pesquisadores",
            title: "O Inventor (ENTP)",
            description: "Franco, é desenvolto em desafios e debates. Entusiasta, charmoso e espirituoso. Valoriza a liberdade e a independência. Criativo, empreendedor e competente. Espontâneo e impulsivo. Gosta de enfrentar riscos e está atento a todas as possibilidades. Inquiridor e curioso.",
            profissoes: "Consultor, Empreendedor, Relações Públicas, Advogado, Diretor de Criação"
        },
        "ESTJ": {
            group: "Os Administradores",
            title: "O Supervisor (ESTJ)",
            description: "Extrovertido, ativo, fidedigno. Eficiente, organizado e decidido. Gosta de administrar e dirigir. Ótimo para definir e aplicar políticas e procedimentos. Afirmativo, franco e direto. Preocupa-se em solucionar problemas. Responsável, esforçado, bom planejador. Consistente, pragmático e coerente.",
            profissoes: "Gerente, Diretor, Juiz, Policial, Executivo"
        },
        "ESFJ": {
            group: "Os Administradores",
            title: "O Provedor (ESFJ)",
            description: "Entusiasta, sociável, cativante. Gosta de se sentir necessário e estimado. Bem-apessoado, compreensivo e cooperativo. É solidário e diligente em tarefas organizacionais. Digno de confiança, leal e responsável. Valoriza a harmonia e demonstra seu amor através de atitudes práticas.",
            profissoes: "Professor, Enfermeiro, Analista de RH, Varejista, Assistente Social"
        },
        "ENFJ": {
            group: "Os Idealistas",
            title: "O Professor (ENFJ)",
            description: "Amigável, charmoso, entusiasta e socialmente ativo. Orador persuasivo e inspirado, líder carismático que motiva outras pessoas. Simpático, caloroso, prestativo e solidário. Pode idealizar pessoas e relacionamentos. Responsável, consciente e idealista. Diplomático e bom em promover harmonia.",
            profissoes: "Professor, Gerente de RH, Palestrante, Facilitador, Político"
        },
        "ENTJ": {
            group: "Os Pesquisadores",
            title: "O Comandante (ENTJ)",
            description: "Líder confiável que gosta de estar no comando. Decidido e ambicioso. Aprecia o intercâmbio intelectual. Engenhoso e competente para resolver problemas complexos. Inovador, analítico e coerente. Determinado e independente. Aspira ser o melhor em tudo o que faz.",
            profissoes: "Executivo (CEO), Empreendedor, Advogado, Analista de Gestão, Consultor Corporativo"
        }
    }
};

let currentMbtiStep = 0;
let mbtiAnswers = [[], [], [], []]; // Armazena escolhas de 'a' ou 'b' para cada step
let mbtiContext = { id: null, type: null }; // type: 'candidato' ou 'funcionario'

function abrirModalMBTI(id, type) {
    mbtiContext = { id, type };
    currentMbtiStep = 0;
    mbtiAnswers = [[], [], [], []];
    
    // Iniciar Modal
    const modalEl = document.getElementById('mbtiModal');
    if(!modalEl) {
        console.error("Modal MBTI não encontrado no DOM");
        return;
    }
    
    document.getElementById('mbti-result-container').style.display = 'none';
    document.getElementById('mbti-test-container').style.display = 'block';
    
    renderMbtiStep();
    
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function renderMbtiStep() {
    if(currentMbtiStep >= mbtiData.steps.length) {
        calcularResultadoMBTI();
        return;
    }
    
    const stepData = mbtiData.steps[currentMbtiStep];
    
    document.getElementById('mbti-step-title').textContent = stepData.title;
    document.getElementById('mbti-step-desc').textContent = stepData.description;
    
    // Barra de progresso
    const progress = ((currentMbtiStep) / mbtiData.steps.length) * 100;
    document.getElementById('mbti-progress').style.width = progress + '%';
    document.getElementById('mbti-progress-text').textContent = `Etapa ${currentMbtiStep + 1} de 4`;
    
    const container = document.getElementById('mbti-questions-container');
    container.innerHTML = '';
    
    stepData.questions.forEach((q, index) => {
        // Obter valor já selecionado, se houver
        const savedAnswer = mbtiAnswers[currentMbtiStep][index];
        
        const qHtml = `
            <div class="mb-4 p-3 border rounded bg-light shadow-sm">
                <p class="fw-bold mb-2">Situação ${index + 1}:</p>
                <div class="form-check mb-2 custom-radio-wrapper">
                    <input class="form-check-input" type="radio" name="mbti_q${index}" id="mbti_q${index}_a" value="a" ${savedAnswer === 'a' ? 'checked' : ''}>
                    <label class="form-check-label w-100 p-2 rounded user-select-none" for="mbti_q${index}_a" style="cursor: pointer;">
                        ${q.a}
                    </label>
                </div>
                <div class="form-check custom-radio-wrapper">
                    <input class="form-check-input" type="radio" name="mbti_q${index}" id="mbti_q${index}_b" value="b" ${savedAnswer === 'b' ? 'checked' : ''}>
                    <label class="form-check-label w-100 p-2 rounded user-select-none" for="mbti_q${index}_b" style="cursor: pointer;">
                        ${q.b}
                    </label>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', qHtml);
    });
    
    // Botoes
    document.getElementById('mbti-btn-prev').style.display = currentMbtiStep > 0 ? 'block' : 'none';
    document.getElementById('mbti-btn-next').textContent = currentMbtiStep === 3 ? 'Finalizar e Ver Resultado' : 'Próxima Etapa';
}

function nextMbtiStep() {
    // Validar se respondeu as 10 questoes
    const stepData = mbtiData.steps[currentMbtiStep];
    const answers = [];
    
    for(let i=0; i<stepData.questions.length; i++) {
        const selected = document.querySelector(`input[name="mbti_q${i}"]:checked`);
        if(!selected) {
            if(typeof mostrarMensagem === 'function') {
                mostrarMensagem('Por favor, responda todas as questões desta etapa antes de continuar.', 'warning');
            } else {
                alert('Por favor, responda todas as questões desta etapa antes de continuar.');
            }
            return;
        }
        answers.push(selected.value);
    }
    
    mbtiAnswers[currentMbtiStep] = answers;
    currentMbtiStep++;
    renderMbtiStep();
    
    const modalBody = document.querySelector('#mbtiModal .modal-body');
    if(modalBody) modalBody.scrollTop = 0;
}

function prevMbtiStep() {
    if(currentMbtiStep > 0) {
        currentMbtiStep--;
        renderMbtiStep();
        const modalBody = document.querySelector('#mbtiModal .modal-body');
        if(modalBody) modalBody.scrollTop = 0;
    }
}

async function calcularResultadoMBTI() {
    let mbtiResult = "";
    
    for(let i=0; i<mbtiData.steps.length; i++) {
        const answers = mbtiAnswers[i];
        const countA = answers.filter(a => a === 'a').length;
        const countB = answers.length - countA;
        
        const stepData = mbtiData.steps[i];
        if(countA >= countB) {
            mbtiResult += stepData.letterA;
        } else {
            mbtiResult += stepData.letterB;
        }
    }
    
    const profile = mbtiData.results[mbtiResult];
    
    // Exibir Resultado
    document.getElementById('mbti-test-container').style.display = 'none';
    document.getElementById('mbti-result-container').style.display = 'block';
    
    document.getElementById('mbti-res-type').textContent = mbtiResult;
    document.getElementById('mbti-res-group').textContent = profile.group;
    document.getElementById('mbti-res-title').textContent = profile.title;
    document.getElementById('mbti-res-desc').textContent = profile.description;
    
    // Salvar no Banco
    await salvarMBTI(mbtiResult, profile);
}

async function salvarMBTI(type, profile) {
    if(!mbtiContext.id || !mbtiContext.type) return;
    
    const btn = document.getElementById('mbti-btn-fechar');
    if(btn) {
        btn.disabled = true;
    }
    
    const collection = mbtiContext.type === 'candidato' ? 'candidatos' : 'funcionarios';
    
    try {
        await db.collection(collection).doc(mbtiContext.id).update({
            mbti: {
                tipo: type,
                grupo: profile.group,
                titulo: profile.title,
                descricao: profile.description,
                dataTeste: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
        if(typeof mostrarMensagem === 'function') {
            mostrarMensagem('Resultado MBTI salvo com sucesso!', 'success');
        }
        
        // Atualizar interface de quem chamou se necessário
        if(mbtiContext.type === 'candidato' && typeof carregarMBTICandidato === 'function') {
            carregarMBTICandidato(mbtiContext.id);
        } else if (mbtiContext.type === 'funcionario' && typeof carregarMBTIFuncionario === 'function') {
            carregarMBTIFuncionario(mbtiContext.id);
        }
        
    } catch(error) {
        console.error("Erro ao salvar MBTI:", error);
        if(typeof mostrarMensagem === 'function') {
            mostrarMensagem("Erro ao salvar o teste. Tente novamente.", "error");
        }
    } finally {
        if(btn) {
            btn.disabled = false;
        }
    }
}

// Estilo auxiliar para o radio
const style = document.createElement('style');
style.innerHTML = `
    .custom-radio-wrapper input:checked + label {
        background-color: #e9ecef;
        border: 1px solid #0d6efd;
        color: #0d6efd;
        font-weight: 500;
    }
    .custom-radio-wrapper label {
        border: 1px solid transparent;
        transition: all 0.2s ease-in-out;
    }
    .custom-radio-wrapper label:hover {
        background-color: #f8f9fa;
        border-color: #dee2e6;
    }
`;
document.head.appendChild(style);
