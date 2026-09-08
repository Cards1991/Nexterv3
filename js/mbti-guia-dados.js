const mbti_work_guidance = {
    ISTJ: {
        quick_guide: {
            to_work_well: ["Seja claro e objetivo nas instruções", "Respeite prazos e cronogramas", "Apresente dados e fatos", "Reconheça a dedicação e o trabalho duro deles"],
            avoid: ["Mudanças de última hora sem justificativa lógica", "Reuniões sem pauta ou foco", "Desorganização e quebra de promessas"],
            best_approach: "Mantenha a comunicação estruturada, valorize a organização e forneça diretrizes e limites claros."
        },
        communication: "Seja claro sobre o objetivo da conversa. Vá direto ao ponto, apresentando fatos e dados concretos. Evite excesso de abstração e forneça o contexto prático de como as coisas devem funcionar. Quando necessário, confirme se a mensagem foi compreendida através de exemplos práticos.",
        delegation: "Apresente claramente o resultado esperado, os prazos e os procedimentos. O ISTJ prefere saber as regras do jogo e ter autonomia para executar dentro do que foi combinado. Evite microgerenciamento após as regras estarem claras.",
        feedback: "Dê feedback focado nos resultados concretos e no comportamento observável. O feedback positivo deve reconhecer a confiabilidade e precisão. O feedback corretivo deve ser direto e focado em 'como fazer certo da próxima vez'.",
        motivation: "Pode ser motivado por estabilidade, regras claras, reconhecimento por um trabalho bem feito (especialmente tarefas difíceis ou detalhadas) e por ter responsabilidades onde sua precisão é valorizada.",
        conflict: "Aborde conflitos focando em fatos e nos processos que falharam. Evite discussões muito acaloradas ou emocionais; prefira focar em 'qual é o procedimento correto a seguir para resolver isso?'.",
        mistakes: "Explique o problema objetivamente e mostre onde houve o desvio do processo ou da expectativa. Eles tendem a ser muito autocríticos, então seja focado na solução prática e em como evitar a recorrência.",
        change: "Apresente mudanças com antecedência e com um plano claro. Explique a lógica e os passos para a transição. Eles podem resistir a mudanças repentinas que não pareçam ter uma razão prática.",
        pressure: {
            signals: "Pode se tornar excessivamente rígido com regras, focar em microdetalhes e se afastar de interações sociais.",
            act: "Ajude a priorizar tarefas. Reduza as interrupções e permita que se concentrem em uma coisa de cada vez.",
            avoid: "Adicionar novas variáveis ou exigir que 'improvisem' soluções rápidas sob alta pressão."
        },
        development: "Incentive-os a considerar novas formas de fazer as coisas. Ajude-os a delegar mais e a entender que a colaboração muitas vezes traz soluções que a execução isolada não permite.",
        teamwork: "Funcionam bem em equipes onde os papéis são claramente definidos. Eles trazem estrutura e confiabilidade, garantindo que os projetos sigam as normas estabelecidas.",
        avoid: ["Microgerenciamento restrito após delegação", "Mudar os objetivos no meio da tarefa", "Pressionar por reações emocionais em conversas técnicas"]
    },
    ISFJ: {
        quick_guide: {
            to_work_well: ["Seja educado e valorize o bem-estar da equipe", "Reconheça o esforço contínuo", "Dê instruções claras e estruturadas", "Dê tempo para adaptação a mudanças"],
            avoid: ["Críticas ríspidas ou em público", "Ambientes de trabalho muito caóticos", "Exigir improvisação excessiva"],
            best_approach: "Comunique-se com empatia, ofereça estrutura e mostre como o trabalho deles suporta os colegas e o objetivo comum."
        },
        communication: "Comunique-se de forma respeitosa, estruturada e harmoniosa. Eles preferem conversas onde há consideração pessoal, além de detalhes práticos. Explicar o impacto humano das tarefas ajuda na compreensão.",
        delegation: "Forneça expectativas claras, exemplos de como foi feito antes e confirme se eles se sentem confortáveis com o prazo. Evite jogar tarefas totalmente sem estrutura ou direção clara.",
        feedback: "O feedback corretivo deve ser dado com muito cuidado, focando no comportamento e reafirmando o valor deles para a equipe. O feedback positivo deve ser sincero, reconhecendo suas contribuições que muitas vezes ocorrem nos bastidores.",
        motivation: "Pode ser motivado por se sentir útil e apreciado. Eles valorizam um ambiente colaborativo e seguro, onde sabem que seu trabalho está fazendo a diferença para a equipe.",
        conflict: "Tendem a evitar conflitos diretos. Quando ocorrer, aborde de forma privada, gentil e com foco em restaurar a harmonia e o bom andamento do trabalho conjunto.",
        mistakes: "Mostre empatia. Eles geralmente assumem a responsabilidade e se cobram muito. Foque em como corrigir o problema em equipe, garantindo que o erro não os desvalorize como profissionais.",
        change: "Apresente mudanças gradualmente. Mostre como a mudança vai beneficiar as pessoas envolvidas e respeite a necessidade deles de tempo para processar e se adaptar à nova rotina.",
        pressure: {
            signals: "Podem assumir trabalho demais para não decepcionar os outros, ficando sobrecarregados ou silenciosamente ansiosos.",
            act: "Intervenha ativamente para redistribuir a carga de trabalho. Ajude-os a priorizar e a dizer 'não'.",
            avoid: "Ignorar os sinais de sobrecarga ou exigir produtividade máxima sem apoio emocional."
        },
        development: "Ajude-os a estabelecer limites, a dizer não a demandas irracionais e a falar sobre suas próprias necessidades e ideias de forma mais assertiva.",
        teamwork: "São excelentes suportes na equipe, garantindo que tudo funcione bem e que todos estejam assistidos. Trabalham melhor quando há respeito mútuo e cooperação real.",
        avoid: ["Falta de consideração e grosseria", "Deixá-los no escuro sobre mudanças importantes", "Forçá-los aos holofotes sem preparação"]
    },
    INFJ: {
        quick_guide: {
            to_work_well: ["Conecte as tarefas ao propósito maior", "Dê espaço para que pensem e planejem", "Mantenha a autenticidade", "Escute a intuição deles"],
            avoid: ["Tarefas puramente repetitivas e sem significado", "Atmosfera de trabalho tóxica ou superficial", "Microgerenciamento de execução"],
            best_approach: "Forneça a visão de longo prazo, valorize as ideias deles e ofereça autonomia para a execução estratégica."
        },
        communication: "Valorizam a profundidade e a conexão. Vá além do superficial, explique o impacto futuro e o significado do projeto. Tente ter conversas individuais para um alinhamento mais genuíno.",
        delegation: "Forneça o objetivo final e o significado da tarefa. Dê autonomia para que eles decidam *como* chegar lá, desde que entendam a visão geral e as expectativas.",
        feedback: "O feedback deve focar no desenvolvimento pessoal e no impacto do trabalho deles. Críticas construtivas devem ser feitas mostrando que a intenção é o crescimento e a melhoria dos processos humanos.",
        motivation: "A maior motivação é o propósito e a congruência de valores. Tendem a responder bem quando percebem que seu trabalho ajuda as pessoas ou contribui para uma visão significativa e de longo prazo.",
        conflict: "Lidam mal com agressividade aberta. Prefira a diplomacia e a empatia. Busque um terreno comum focado no bem maior ou no objetivo compartilhado da equipe.",
        mistakes: "Aponte o erro suavemente, focando em como aquilo afeta o projeto, e pergunte como podem ajustar a visão para corrigir o desvio de forma construtiva.",
        change: "Apresente a visão do futuro que a mudança trará. Eles lidam bem com mudanças que fazem sentido estratégico e melhoram a organização, mas precisam de tempo para internalizar a ideia.",
        pressure: {
            signals: "Podem se fechar, parecerem excessivamente críticos consigo mesmos e com os outros, ou se desconectarem temporariamente da equipe.",
            act: "Ofereça espaço, escuta ativa e apoio para reestruturarem as prioridades. Ajude a reduzir a visão de que tudo é responsabilidade exclusiva deles.",
            avoid: "Minimizar a pressão que estão sentindo ou exigir reações imediatas e impulsivas."
        },
        development: "Incentive-os a não buscar sempre a perfeição absoluta e a comunicar suas ideias complexas de forma mais simplificada e prática para os outros membros da equipe.",
        teamwork: "Trazem insight valioso e foco no futuro. Focam em construir consenso e garantir que a missão não se perca, mas preferem interações significativas a socializações superficiais.",
        avoid: ["Falsidade ou manipulação", "Focar apenas em métricas ignorando o impacto humano", "Desconsiderar suas visões intuitivas"]
    },
    INTJ: {
        quick_guide: {
            to_work_well: ["Seja lógico e eficiente", "Apresente o objetivo e dê autonomia para que desenhem o sistema", "Mostre dados e razões", "Desafie-os intelectualmente"],
            avoid: ["Reuniões sem objetividade", "Argumentos puramente emocionais", "Microgerenciar as etapas do processo"],
            best_approach: "Trate-os com respeito intelectual, forneça o quadro geral e permita que construam a melhor estratégia de forma independente."
        },
        communication: "Foque na eficiência e na lógica. Apresente ideias de forma clara e estruturada. Eles apreciam debates baseados em dados, mas têm pouca paciência para redundâncias.",
        delegation: "Diga 'o que' precisa ser alcançado e 'por que' é importante estrategicamente. Não determine o 'como'. Eles preferem desenhar o próprio método e encontrar a forma mais eficiente.",
        feedback: "Seja direto, focado na competência e baseado em resultados. Críticas lógicas são bem aceitas e esperadas se os ajudarem a otimizar o trabalho. Elogios devem focar na competência intelectual.",
        motivation: "Pode ser motivado por desafios intelectuais complexos, oportunidade de otimizar sistemas, autonomia e trabalhar com pessoas que consideram igualmente competentes.",
        conflict: "Gostam que os conflitos sejam abordados de forma puramente lógica e objetiva. Evite argumentos emocionais; se você provar seu ponto com dados concretos, a resolução será rápida.",
        mistakes: "Mostre o erro no processo ou no resultado. Eles tentarão analisar e corrigir a falha sistêmica rapidamente. Não precisam de amortecimento emocional excessivo.",
        change: "Apoiam firmemente mudanças que fazem sentido lógico e aumentam a eficiência geral. Apresente a mudança com uma estratégia clara e uma razão irrefutável.",
        pressure: {
            signals: "Podem se tornar impacientes, excessivamente críticos com as falhas alheias e focar de forma obstinada na execução técnica.",
            act: "Forneça os recursos, remova os obstáculos práticos e dê espaço para que resolvam o problema sistêmico.",
            avoid: "Tentar confortá-los emocionalmente ou interrompê-los com procedimentos burocráticos desnecessários."
        },
        development: "Ajude-os a valorizar a inteligência emocional nas lideranças e a perceber que a colaboração da equipe, mesmo que pareça menos eficiente no curto prazo, garante o sucesso sustentável.",
        teamwork: "Trazem visão estratégica e altos padrões de excelência. Podem parecer distantes, então trabalham melhor com colegas que valorizam a eficácia e não levam a objetividade deles para o lado pessoal.",
        avoid: ["Perda de tempo com processos ineficientes", "Imposição de métodos sem justificativa lógica", "Dramatizações no ambiente de trabalho"]
    },
    ISTP: {
        quick_guide: {
            to_work_well: ["Seja direto e prático", "Dê espaço e autonomia para resolução de problemas", "Foque em resultados imediatos", "Evite excesso de burocracia"],
            avoid: ["Microgerenciamento restrito", "Reuniões longas e teóricas", "Exigir planejamento rígido de longo prazo"],
            best_approach: "Apresente o problema tático, forneça as ferramentas e deixe que descubram a maneira mais rápida de resolver."
        },
        communication: "Vá direto ao ponto. Prefira a comunicação baseada em fatos e problemas práticos. Evite longos discursos teóricos que não têm aplicação imediata no projeto atual.",
        delegation: "Forneça a meta clara e os limites práticos (prazos, orçamento). Deixe-os livres para agir e experimentar abordagens durante a execução. Eles entregam resultados através da ação.",
        feedback: "Foque em fatos tangíveis, na eficiência e na qualidade técnica da entrega. Críticas objetivas são bem aceitas se focarem na melhoria da técnica. Elogios muito sentimentais podem deixá-los desconfortáveis.",
        motivation: "Motivam-se por problemas que precisam ser consertados na hora, tarefas que exigem habilidades técnicas, autonomia de execução e variedade nas rotinas diárias.",
        conflict: "Aborde conflitos de forma pragmática e calma. Fale sobre o que precisa ser ajustado na prática, não sobre sentimentos. Eles tendem a resolver a situação rapidamente se a lógica for aplicável.",
        mistakes: "Costumam perceber o erro e tentar consertar na hora. Aborde de forma prática: 'O que aconteceu e qual a solução tática agora?'",
        change: "São incrivelmente adaptáveis a mudanças de curto prazo e adoram gerenciar crises repentinas. Adaptações rápidas são a especialidade deles.",
        pressure: {
            signals: "Sob estresse, podem agir por impulsividade ou ignorar as regras de segurança/corporativas para forçar uma solução.",
            act: "Dê a eles um problema prático imediato para resolver ou ofereça flexibilidade tática. Remova exigências burocráticas temporariamente.",
            avoid: "Pressioná-los com mais teorias ou forçá-los a discutir o impacto emocional da crise."
        },
        development: "Pode ser útil desenvolvê-los na comunicação proativa da equipe (informar o que estão fazendo) e na consideração dos impactos de longo prazo de suas soluções rápidas.",
        teamwork: "Funcionam bem como solucionadores independentes. Não gostam de excesso de alinhamento, mas são essenciais quando ocorrem emergências práticas.",
        avoid: ["Regras sem utilidade prática", "Reuniões intermináveis de status", "Forçar intimidade emocional no trabalho"]
    },
    ISFP: {
        quick_guide: {
            to_work_well: ["Seja amigável e ofereça suporte", "Dê espaço para que executem no próprio ritmo", "Forneça feedback gentil", "Permita soluções criativas práticas"],
            avoid: ["Ambientes excessivamente agressivos", "Criticar severamente", "Impor rotinas inflexíveis e repetitivas"],
            best_approach: "Oriente com gentileza, mostre como o trabalho é importante e ofereça um ambiente harmonioso e taticamente flexível."
        },
        communication: "Aborde-os de forma calma e atenciosa. Eles apreciam a harmonia e se comunicam de forma mais observadora e empática. Fale sobre aspectos práticos, mas sem perder o toque humano.",
        delegation: "Defina claramente o resultado prático esperado, mas dê flexibilidade sobre como e quando realizar a tarefa dentro do prazo. Mostre que a porta está aberta para tirar dúvidas.",
        feedback: "Eles podem ser sensíveis a críticas. Comece pelo que está bom e apresente as áreas de melhoria como sugestões colaborativas de desenvolvimento, mantendo o tom construtivo.",
        motivation: "Pode valorizar um ambiente colaborativo e flexível. Motivam-se quando percebem que seu trabalho prático é apreciado e quando podem aplicar seu próprio senso estético ou tático.",
        conflict: "Detestam confrontos abertos. Para resolver divergências, tenha uma conversa calma no 1 a 1, assegurando que o relacionamento profissional não está em risco.",
        mistakes: "Seja suave e construtivo. Eles tendem a ser muito duros consigo mesmos quando falham. Foque na busca conjunta pela solução.",
        change: "Apresente mudanças focando nos impactos práticos e positivos no dia a dia. Eles podem resistir internamente se sentirem que a mudança torna o ambiente mais burocrático ou insensível.",
        pressure: {
            signals: "Podem se retrair completamente, evitar contato visual ou tornarem-se cínicos e desmotivados.",
            act: "Ofereça suporte prático, ajude na divisão das tarefas e mostre compreensão genuína, reduzindo a pressão imediata onde for possível.",
            avoid: "Exigir explicações rápidas em público ou pressioná-los agressivamente por prazos inatingíveis."
        },
        development: "Ajude-os a expressar mais ativamente suas excelentes observações práticas nas reuniões e a aprender a dar e receber feedback corretivo com mais facilidade.",
        teamwork: "São colaboradores leais que ajudam os outros de forma prática e nos bastidores. Preferem equipes unidas e sem disputa de egos.",
        avoid: ["Microgerenciamento restritivo", "Cobranças ríspidas na frente da equipe", "Ignorar as contribuições práticas silenciosas deles"]
    },
    INFP: {
        quick_guide: {
            to_work_well: ["Conecte o trabalho a valores e propósitos", "Dê flexibilidade criativa", "Comunique-se com empatia e autenticidade", "Escute suas ideias originais"],
            avoid: ["Criticar seus valores de forma ríspida", "Tarefas puramente rotineiras sem significado", "Ambientes focados estritamente em metas predatórias"],
            best_approach: "Mostre o impacto positivo do trabalho e dê autonomia para que encontrem soluções criativas alinhadas aos valores da empresa."
        },
        communication: "Valorizam autenticidade e conexão genuína. Comunique-se abertamente. Eles processam melhor a informação quando ela está ligada a ideias, possibilidades e ao fator humano.",
        delegation: "Foque no 'porquê' e no impacto positivo que a tarefa trará. Dê flexibilidade sobre o método de execução. Lembre-os gentilmente dos prazos para manter o alinhamento operacional.",
        feedback: "O feedback deve ser cuidadoso e humano, focando no esforço e nas intenções. Críticas construtivas devem ser feitas com muita empatia, pois tendem a internalizar as falhas.",
        motivation: "Motivam-se por acreditar no que estão fazendo, ambientes que valorizam a inovação criativa e a oportunidade de facilitar o crescimento das pessoas ao redor.",
        conflict: "Evitam confrontos abertos. Se a divergência for sobre valores essenciais, podem se tornar firmes silenciosamente. Busque o alinhamento de intenções e um caminho de compromisso mútuo.",
        mistakes: "Aja com empatia, reafirmando o valor da pessoa na equipe. Foque no aprendizado que a situação traz e na correção prática do erro.",
        change: "Apoiarão mudanças que visem o bem-estar da equipe e a evolução qualitativa da empresa. Podem resistir a mudanças percebidas como frias ou focadas apenas em corte de custos corporativos.",
        pressure: {
            signals: "Podem se isolar, duvidar de sua própria competência ou atacar a lógica de procedimentos de forma inesperada.",
            act: "Lembre-os do valor deles. Ajude a organizar e quebrar as tarefas maiores em passos tangíveis e alcançáveis.",
            avoid: "Fazer cobranças estritamente numéricas ou invalidar o estresse emocional que estão sentindo."
        },
        development: "Podem precisar de suporte prático para organização pessoal, cumprimento rigoroso de prazos e aprender a não levar críticas aos projetos para o lado pessoal.",
        teamwork: "Trazem criatividade, novas perspectivas e uma forte bússola moral. Trabalham melhor em ambientes de suporte mútuo e com lideranças inspiradoras.",
        avoid: ["Descartar suas ideias criativas sem consideração", "Gerenciamento focado apenas em resultados financeiros", "Políticas inflexíveis e desumanizadas"]
    },
    INTP: {
        quick_guide: {
            to_work_well: ["Seja lógico e objetivo", "Ofereça problemas complexos para analisar", "Permita autonomia", "Valorize a precisão intelectual"],
            avoid: ["Forçar atividades de socialização intensas", "Microgerenciar o 'como'", "Exigir adesão a processos irracionais"],
            best_approach: "Apresente o desafio intelectual, forneça os dados e dê espaço para que achem a solução otimizada."
        },
        communication: "Seja claro, lógico e livre de floreios emocionais. Eles não ligam para formalidades excessivas. Adoram que suas ideias lógicas sejam debatidas de forma construtiva.",
        delegation: "Defina claramente o problema e o escopo esperado. Deixe que eles desenvolvam a estrutura e a arquitetura da solução. Dê autonomia total para a fase de análise e criação do sistema.",
        feedback: "O feedback deve ser rigorosamente lógico, objetivo e baseado na competência. Críticas fundamentadas e objetivas são bem aceitas e até bem-vindas. Elogios emocionais podem ser recebidos com indiferença.",
        motivation: "Motivados pela descoberta intelectual, resolução de quebra-cabeças técnicos difíceis e pela criação de modelos conceituais precisos. Autonomia é fundamental.",
        conflict: "Lidam perfeitamente com debates e críticas lógicas (veem como aperfeiçoamento de sistemas). Se o conflito for interpessoal emocional, tendem a se afastar. Mantenha as discussões focadas no projeto.",
        mistakes: "Basta apontar a falha lógica no modelo. Eles reconhecerão imediatamente o erro se for provado e voltarão rapidamente para consertá-lo. Não há necessidade de tato pessoal exacerbado.",
        change: "Apoiarão fortemente qualquer mudança que traga eficiência, melhoria arquitetônica ou lógica clara para os processos. Podem até promover ativamente a desconstrução de regras antigas.",
        pressure: {
            signals: "Podem ficar paralisados analisando todas as possibilidades infinitamente, ou ter frustrações se os outros não acompanharem seu raciocínio.",
            act: "Ajude a definir um limite prático para a fase de análise e auxilie na tomada de decisão rápida baseada nos dados já disponíveis.",
            avoid: "Exigir reações emocionais ou pressioná-los com regras sem sentido na hora da crise."
        },
        development: "Precisam desenvolver a habilidade de concluir e entregar projetos na fase final operacional, além de aprender a comunicar suas conclusões de forma clara para o resto da equipe.",
        teamwork: "Trazem inovações técnicas e capacidade analítica excepcional. Preferem o trabalho individual ou parcerias com especialistas focados. Burocracia excessiva drena a energia deles.",
        avoid: ["'Porque sim' ou 'porque sempre foi assim' como justificativas", "Reuniões de status improdutivas", "Dramatizações no local de trabalho"]
    },
    ESTP: {
        quick_guide: {
            to_work_well: ["Foque em resultados imediatos", "Seja direto e prático", "Dê tarefas variadas e dinâmicas", "Permita ação rápida"],
            avoid: ["Reuniões de puro planejamento longo", "Excesso de regras operacionais limitantes", "Teorias sem aplicação prática"],
            best_approach: "Apresente a meta imediata, dê liberdade de ação e valorize a energia e a capacidade deles de resolver crises."
        },
        communication: "Seja direto, rápido e voltado para a ação. Responda claramente 'O que precisa ser feito?' e 'Qual o impacto imediato?'. Eles têm pouca tolerância para digressões abstratas.",
        delegation: "Forneça metas táticas. Deixe-os livres para agir, usar recursos e encontrar os atalhos. Eles são brilhantes em contornar obstáculos práticos em tempo real.",
        feedback: "Dê feedback rápido, direto e informal. Aceitam correções contanto que sejam baseadas em resultados visíveis e abordagens que tragam impacto imediato.",
        motivation: "Motivam-se por ação, variedade, negociações dinâmicas, gerenciamento de crises e poder ver o resultado concreto e rápido do seu esforço no dia a dia.",
        conflict: "Enfrentam conflitos diretamente. Aborde o problema objetivamente e foque na solução prática. Eles geralmente não levam as discussões adiante após o fim do conflito.",
        mistakes: "Seja objetivo: aponte o erro e a ação imediata necessária para reparar o estrago. Eles não ficam remoendo o passado e logo partem para a ação corretiva.",
        change: "Altamente adaptáveis, eles amam dinamismo e mudam de rota rapidamente se a nova direção oferecer mais resultados ou uma abordagem mais eficiente no curto prazo.",
        pressure: {
            signals: "Podem agir impulsivamente demais, tomando riscos descabidos e ignorando as consequências de longo prazo.",
            act: "Redirecione a energia para um foco tático específico e auxilie contendo um pouco o ímpeto, trazendo alguma visão de segurança do processo.",
            avoid: "Prendê-los em burocracia excessiva enquanto o problema precisa ser solucionado ativamente."
        },
        development: "Precisam ser lembrados de considerar o planejamento estratégico de longo prazo, de ler as instruções até o final antes de começar a agir e de avaliar o impacto de suas ações na equipe.",
        teamwork: "Trazem agilidade, praticidade e energia para qualquer time. Destravam execuções lentas e lideram a ação na linha de frente, mas podem precisar de suporte para a fase de documentação.",
        avoid: ["Trabalho puramente teórico e isolado", "Falta de ação da gestão", "Microgerenciamento excessivo"]
    },
    ESFP: {
        quick_guide: {
            to_work_well: ["Mantenha um ambiente positivo", "Seja prático", "Celebre vitórias da equipe", "Dê tarefas interativas"],
            avoid: ["Críticas ríspidas", "Isolamento prolongado", "Microgerenciamento sistemático"],
            best_approach: "Oriente com entusiasmo, incentive o engajamento com a equipe e estruture metas práticas em prazos curtos."
        },
        communication: "Comunique-se de forma clara, amigável e cheia de energia. Eles respondem muito bem a conversas informais que misturam trabalho com um genuíno interesse pessoal.",
        delegation: "Apresente as tarefas de forma dinâmica, estabeleça prazos práticos e permita que eles colaborem com outras pessoas para a execução. Ambientes de colaboração os fazem brilhar.",
        feedback: "Sensíveis ao tom da crítica. Comece evidenciando o impacto positivo deles no grupo e na produção. Formule as melhorias como formas práticas de aumentar o sucesso da equipe no dia a dia.",
        motivation: "Motivam-se pela variedade, ambientes sociais estimulantes, projetos que exijam contato humano direto e pelo reconhecimento explícito do seu trabalho prático e entusiasmo.",
        conflict: "Evitam tensões. Quando necessário, aborde o conflito com leveza e empatia, buscando restaurar a boa relação interpessoal o mais rápido possível.",
        mistakes: "Seja compreensivo e prático. Mostre o erro focando na solução conjunta e imediata, garantindo que a correção não afeta a contribuição essencial deles ao grupo.",
        change: "Adaptação fácil se a mudança promover interação e melhoria prática no ambiente. Podem resistir se a mudança introduzir frieza, excesso de burocracia ou isolamento social.",
        pressure: {
            signals: "Podem ficar dramáticos, perder completamente o foco nas tarefas e tentar agradar todo mundo de forma desesperada.",
            act: "Traga-os de volta para as ações imediatas. Ajude-os a listar o que precisa ser feito agora e ofereça suporte prático e caloroso.",
            avoid: "Exigir grandes planejamentos de longo prazo ou fazer cobranças frias e puramente lógicas."
        },
        development: "O desenvolvimento deve focar no planejamento antecipado, cumprimento de prazos em tarefas repetitivas e no aprendizado para não levar feedback profissional para o lado pessoal.",
        teamwork: "Constroem o espírito de equipe, melhoram o moral e são fantásticos no trato com clientes ou na linha de frente. Trabalham muito bem acompanhados, menos bem isolados.",
        avoid: ["Teoria seca sem interação humana", "Ambientes severos", "Afastá-los do contato com pessoas"]
    },
    ENFP: {
        quick_guide: {
            to_work_well: ["Dê liberdade criativa", "Foque na visão de futuro", "Mostre apreço pelas ideias deles", "Permita variedade"],
            avoid: ["Rotinas repetitivas sem inovação", "Frieza na comunicação", "Microgerenciamento dos processos detalhados"],
            best_approach: "Apresente a visão do projeto, engaje-os nas possibilidades de melhoria e permita autonomia na execução das ideias."
        },
        communication: "Foque no futuro, no impacto positivo e no potencial humano. Eles adoram debates abertos, sessões de brainstorming e detestam se sentir restritos a análises passadas.",
        delegation: "Explique a meta geral e o 'porquê'. Não delegue um passo a passo. Eles criarão caminhos únicos. Certifique-se de estabelecer prazos e formas de acompanhamento regulares.",
        feedback: "O feedback deve ser inspirador. Elogie a originalidade. As correções de rumo devem focar em como direcionar melhor toda essa energia criativa para atingir o resultado de forma consistente.",
        motivation: "Inovação contínua, início de novos projetos, ambientes que incentivam o crescimento pessoal e equipes abertas a pensar fora da caixa.",
        conflict: "Embora tentem evitar confrontos, defenderão passionalmente ideias e valores. Traga o foco da discussão para soluções colaborativas e mantenha um ambiente de escuta ativa.",
        mistakes: "Foque na lição aprendida e nos ajustes futuros. Evite atitudes punitivas ou focar em como as 'regras do sistema' foram quebradas (eles tendem a achar regras restritivas mesmo).",
        change: "Geralmente são os entusiastas da mudança, desde que a nova direção represente crescimento e inovação. Resistem fortemente a mudanças para processos burocráticos engessados.",
        pressure: {
            signals: "Podem perder completamente o foco, começar múltiplas tarefas e abandonar todas pela metade, ou tornar-se obsessivos com detalhes irrelevantes.",
            act: "Ofereça estrutura amigável. Ajude a priorizar uma única tarefa por vez e forneça acompanhamento sem parecer que está microgerenciando.",
            avoid: "Adicionar mais ideias e projetos para eles ou exigir resultados perfeitos de imediato."
        },
        development: "Precisam desenvolver a persistência para concluir as tarefas de rotina pós-inovação, a organização pessoal e o cumprimento sistemático de prazos.",
        teamwork: "Trazem motivação imensa e ideias disruptivas. São excelentes iniciadores, mas equipes com ENFPs precisam de colegas mais práticos para ajudar a finalizar e documentar o trabalho.",
        avoid: ["Descartar inovações sem debater", "Ambientes sem estímulo criativo", "Regras e procedimentos inflexíveis"]
    },
    ENTP: {
        quick_guide: {
            to_work_well: ["Seja aberto a debates intelectuais", "Ofereça problemas para solucionar de forma inovadora", "Dê autonomia", "Foque na competência"],
            avoid: ["Argumentos 'porque sempre foi assim'", "Detalhes burocráticos rotineiros", "Levar os questionamentos deles para o lado pessoal"],
            best_approach: "Desafie-os intelectualmente, estabeleça o problema central e confie neles para desenhar a solução."
        },
        communication: "Comunique-se com lógica e dinamismo. Eles adoram debater ideias. Não veja o questionamento deles como insubordinação, mas sim como a forma deles de refinar as soluções.",
        delegation: "Forneça problemas complexos para serem resolvidos. Evite fornecer a solução prévia. Dê liberdade na criação estratégica, mas lembre de estabelecer pontos de controle para verificar as entregas táticas.",
        feedback: "Aceitam feedback se ele for analítico, justo e justificado. Elogie a inovação e a capacidade argumentativa. A crítica direta e impessoal funciona melhor.",
        motivation: "A superação de desafios lógicos, liberdade para inovar sistemas obsoletos e a autonomia de criar soluções que comprovem sua capacidade de visão estratégica.",
        conflict: "O conflito intelectual é o habitat natural deles e eles não se ofendem facilmente. Mantenha os argumentos focados na melhor alternativa estratégica e evite levar as discussões para o aspecto pessoal.",
        mistakes: "Mostre a falha no modelo de pensamento com argumentos sólidos. Se os dados mostrarem que erraram, eles reavaliarão a estratégia sem maiores problemas de ego.",
        change: "Mudança é o que eles buscam. Sempre dispostos a pivotar e reformular processos quando identificam uma oportunidade estratégica mais inteligente.",
        pressure: {
            signals: "Podem perder o contato com as necessidades da equipe e ficar obsessivos com a resolução ou argumentação de detalhes lógicos secundários.",
            act: "Ajude-os a delegar a rotina para que possam focar no desafio principal. Relembre o objetivo macro do projeto.",
            avoid: "Impor restrições burocráticas irrelevantes ou tentar silenciar os questionamentos deles sob pressão."
        },
        development: "Precisam aprimorar a capacidade de seguir prazos em rotinas operacionais (conclusão de projetos) e desenvolver mais sensibilidade aos impactos emocionais de suas ideias nas pessoas da equipe.",
        teamwork: "Catalisadores de mudanças e inovações disruptivas. Estimulam o raciocínio da equipe, mas necessitam de parceiros organizados para levar as inovações até a etapa final de execução.",
        avoid: ["Gerenciamento engessado e repetitivo", "Não abrir espaço para brainstorming", "Ofender-se quando tiverem a estratégia questionada"]
    },
    ESTJ: {
        quick_guide: {
            to_work_well: ["Seja objetivo, lógico e entregue resultados", "Respeite as regras e hierarquias", "Cumpra os prazos", "Comunique-se de forma clara"],
            avoid: ["Indecisão ou ineficiência crônica", "Ignorar os procedimentos combinados", "Dar desculpas para falhas"],
            best_approach: "Apresente metas de forma estruturada, valorize a capacidade organizacional deles e cumpra todos os combinados."
        },
        communication: "Comunique-se com clareza, eficiência e fatos comprováveis. Vá direto ao assunto de negócios. Eles respeitam muito a honestidade direta e as discussões orientadas a metas concretas.",
        delegation: "Seja cristalino sobre objetivos, prazos, orçamentos e as métricas de sucesso. Eles organizam muito bem o trabalho e são confiáveis na execução, exigindo o mesmo de quem lhes delega.",
        feedback: "O feedback corretivo não precisa de cerimônias: aborde a falha no processo, aponte a métrica não atingida e exija o ajuste. O feedback positivo deve ressaltar a confiabilidade, a ordem e o cumprimento das metas.",
        motivation: "Alcançar os resultados organizacionais, liderar projetos eficientes, manter a ordem no ambiente, cumprir o dever e ver os objetivos serem concretizados conforme o plano.",
        conflict: "Eles abordam os problemas de frente e buscam solução imediata e definitiva. Fale objetivamente e use lógica e regras como apoio para a resolução.",
        mistakes: "Aponte o erro baseando-se no procedimento que foi quebrado ou na meta não alcançada. Eles corrigiriam a rota com rapidez para manter a operação em andamento.",
        change: "Apoiarão mudanças se o planejamento prévio for sólido e se a nova direção oferecer ganhos explícitos de eficiência. Rejeitam mudanças impulsivas ou não estruturadas.",
        pressure: {
            signals: "Podem se tornar microgerenciadores excessivos, controladores inflexíveis com a equipe e ríspidos nas cobranças.",
            act: "Seja resolutivo e assuma ativamente responsabilidades práticas para ajudar a operação a andar. Cumpra suas tarefas rapidamente.",
            avoid: "Fazer perguntas não práticas ou questionar a autoridade do plano de ação em meio ao problema urgente."
        },
        development: "Precisam ouvir os subordinados de forma mais receptiva (sem cortar ideias), aceitar que nem toda solução precisa ser convencional e aumentar a inteligência emocional na liderança.",
        teamwork: "Mantêm a equipe e os projetos exatamente no prazo, impondo ordem e padrões operacionais fortes. Podem precisar ser lembrados de garantir que o time também se sinta ouvido.",
        avoid: ["Incompetência persistente", "Não cumprir o próprio papel na equipe", "Subjetividade onde o que importa é o resultado"]
    },
    ESFJ: {
        quick_guide: {
            to_work_well: ["Seja colaborativo e educado", "Forneça estrutura clara", "Reconheça a dedicação", "Mantenha o grupo unido"],
            avoid: ["Frieza nas relações interpessoais", "Críticas em público", "Mudanças bruscas e caóticas"],
            best_approach: "Ofereça metas práticas claras em um ambiente de comunicação amigável e reconhecimento mútuo."
        },
        communication: "Valorizam conversas sociáveis que misturem os objetivos práticos com as necessidades e interesses da equipe. Demonstre reconhecimento e cortesia genuína no trato diário.",
        delegation: "Forneça o objetivo claro, os recursos e os padrões de sucesso, além de explicar como esse trabalho é importante para todos. Eles se esforçam ativamente para entregar o melhor para a organização.",
        feedback: "Dê feedback com atenção ao tom. Elogie a dedicação, a organização e o cuidado deles. O feedback corretivo deve ser dado com cuidado empático, reafirmando que eles são profissionais valorizados.",
        motivation: "Pertencimento a uma equipe coesa, reconhecimento de seu trabalho árduo, liderança comunitária, organização eficiente do escritório e ver o impacto prático de sua colaboração no dia a dia.",
        conflict: "Focam ativamente em manter ou restaurar a harmonia. Se o conflito for necessário, certifique-se de conduzir de forma diplomática, com o foco em realinhar as expectativas práticas da equipe.",
        mistakes: "Aja de modo encorajador. Eles frequentemente assumem muita responsabilidade pelo erro. Trate o erro como um lapso comum e voltem o foco prático para a resolução sem julgamentos de valor.",
        change: "Preferem estruturas conhecidas e estáveis. Se a mudança for necessária, forneça treinamento adequado, introduza em etapas e destaque como a rotina futura será mais tranquila para a equipe.",
        pressure: {
            signals: "Podem começar a se sentir não apreciados, preocupar-se excessivamente com o status do relacionamento com os outros e agir de maneira passivo-agressiva.",
            act: "Valide as preocupações deles, assegure verbalmente o valor e a importância deles, e ofereça ajuda imediata para os detalhes práticos que se acumularam.",
            avoid: "Apenas exigir resultados ignorando o estresse interpessoal que sentem."
        },
        development: "Ajudar no distanciamento dos conflitos e na capacidade de dar feedback negativo e firme aos colegas. É preciso desenvolvê-los para aceitar melhor as críticas lógicas.",
        teamwork: "Eles são excelentes em apoiar a estrutura do grupo, celebrar as datas importantes e promover um ótimo clima interno, enquanto se certificam de que o trabalho rotineiro está sendo finalizado.",
        avoid: ["Grosseria e isolamento social", "Ignorar suas regras e rotinas", "Falta de agradecimento pelo esforço organizacional e social"]
    },
    ENFJ: {
        quick_guide: {
            to_work_well: ["Conecte as metas à visão da empresa e das pessoas", "Forneça feedback autêntico", "Apoie o desenvolvimento da equipe", "Seja claro e diplomático"],
            avoid: ["Visão de negócios exclusivamente voltada para o lucro e predatória", "Isolamento prolongado", "Falta de comunicação assertiva e aberta"],
            best_approach: "Envolva-os na visão, incentive-os a organizar o time e mantenha um canal aberto e inspirador."
        },
        communication: "Eles apreciam uma comunicação entusiasmada, que mescle organização e potencial humano. Seja claro sobre suas intenções e use um tom expressivo e caloroso nas discussões de planejamento.",
        delegation: "Forneça o escopo e os resultados esperados. Confie na capacidade natural deles de mobilizar os colegas. Eles são excelentes em gerenciar grupos e engajar as pessoas em torno das metas delegadas.",
        feedback: "Buscam crescimento contínuo e gostam de aprender a liderar melhor. O feedback corretivo deve ser direto, mas focado no potencial deles, e o elogio deve destacar seu papel inspirador.",
        motivation: "Ver o crescimento e o sucesso da equipe ao seu redor, alinhar visões e projetos ao impacto coletivo, assumir funções de mentoria e conduzir inovações estratégicas em processos de RH/Gestão.",
        conflict: "Habilidosos para lidar com as emoções da equipe, são excelentes mediadores. Contudo, evitam ser eles o próprio causador da tensão. Fale de forma colaborativa com foco no realinhamento mútuo.",
        mistakes: "Costumam ser muito críticos com as próprias falhas por achar que decepcionaram o time. Aponte o desvio operacional e trate o erro como um aprendizado positivo e valioso no caminho da liderança.",
        change: "Excelentes em implementar mudanças com uma abordagem humana. Se eles acreditarem na visão da mudança, serão a engrenagem que mobilizará toda a organização com facilidade.",
        pressure: {
            signals: "Podem tentar agradar a todos em excesso, exaurindo-se e tomando os problemas pessoais do time como se fossem seus próprios fardos.",
            act: "Incentive-os ativamente a colocar limites, focar nas próprias prioridades do dia e lembre-os de que eles não precisam solucionar a vida de cada pessoa ao redor o tempo todo.",
            avoid: "Adicionar cargas emocionais extras exigindo decisões frias sem o devido apoio e suporte de liderança superior."
        },
        development: "Precisam desenvolver a habilidade de priorizar decisões puramente racionais sobre o consenso de grupo quando for preciso e entender que, às vezes, um nível pequeno de descontentamento na equipe é inevitável.",
        teamwork: "Líderes carismáticos. Mobilizam os outros a darem o melhor de si e coordenam as relações do grupo perfeitamente, mas se exigem demais.",
        avoid: ["Clima de traição ou falsidade", "Falta de engajamento do líder", "Deixá-los de fora de debates que impactam as pessoas"]
    },
    ENTJ: {
        quick_guide: {
            to_work_well: ["Seja objetivo e eficiente", "Foque nas metas e na estratégia global", "Dê espaço para assumirem o comando dos projetos", "Apresente respostas lógicas"],
            avoid: ["Perda de tempo ou ineficiência", "Dramatizações ao discutir problemas", "Microgerenciamento ou inibição da autonomia de liderança deles"],
            best_approach: "Estabeleça metas ambiciosas, ofereça desafios complexos e relacione-se em um plano estritamente racional e focado na eficácia corporativa."
        },
        communication: "Eles adoram discursos vigorosos e assertivos. Comunique-se de maneira clara, orientada para soluções e estruturada. Se for discordar, use fatos incontestáveis, lógica robusta e estratégia. Eles o respeitarão mais.",
        delegation: "Entregue a estratégia macro e os objetivos globais e saia da frente. Eles não precisam ser ensinados sobre 'como' executar. Logo criarão um roteiro tático detalhado e guiarão a equipe com eficácia.",
        feedback: "Apreciam sinceridade agressiva se for útil e embasada. Criticas focadas em melhoria de performance e resultados objetivos não os abalam, e eles exigirão as mesmas correções da equipe sem rodeios emocionais.",
        motivation: "Assumir a frente, implementar inovações que aumentem lucros ou otimização de processos de larga escala, conquistar metas que exigem alto nível e interagir com parceiros que julgam competentes.",
        conflict: "O conflito é apenas uma ferramenta de alinhamento e filtro de más ideias. Defendem suas visões apaixonadamente. Fale pautado em fatos, seja combativo logicamente quando seguro, sem se abalar pelas cobranças frontais deles.",
        mistakes: "Diga a falha do modelo. Eles são rápidos em identificar inconsistências e agir corretivamente sem qualquer culpa ou autopiedade.",
        change: "Grandes impulsionadores de revoluções organizacionais focadas em melhoria. Constantemente buscarão maneiras lógicas e racionais de mudar os fluxos até atingirem o cenário perfeito.",
        pressure: {
            signals: "Tornam-se controladores e implacáveis no comando, e podem afastar e ignorar sistematicamente as sugestões dos demais de forma ríspida.",
            act: "Ofereça apoio pragmático provando a eficácia através de fatos e opções, acalmando as inquietações com resolução realística de obstáculos.",
            avoid: "Discutir a pressão sob perspectiva de bem-estar na crise ou apresentar hesitações."
        },
        development: "O aprimoramento contínuo passa pelo desenvolvimento e empatia no uso da inteligência emocional, reconhecendo que a sinergia com o grupo rende retornos organizacionais fantásticos que a força e a coerção brutais jamais atingirão.",
        teamwork: "Líderes estratégicos formidáveis. Elevam padrões, estruturam diretrizes e guiam equipes para o sucesso como um relógio, contudo precisam ser lembrados de garantir escuta ativa às opiniões do grupo.",
        avoid: ["Indecisão", "Processos que não fazem sentido sistêmico", "Apelação emocional e procrastinação na rotina"]
    }
};

if (typeof window !== 'undefined') {
    window.mbti_work_guidance = mbti_work_guidance;
}
