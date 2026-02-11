// js/cid-map.js
// Mapeamento de CIDs (Classificação Internacional de Doenças) para regiões do corpo (Mesh Names)

export const CID_TO_BODY_REGION = {
    // Cabeça e Pescoço (Head)
    'F': 'Head', // Transtornos mentais e comportamentais
    'G43': 'Head', // Enxaqueca
    'G44': 'Head', // Outras síndromes de algias cefálicas
    'H': 'Head', // Doenças do olho e ouvido
    'J00': 'Head', // Nasofaringite aguda
    'J01': 'Head', // Sinusite aguda
    'R51': 'Head', // Cefaleia

    // Coluna (Spine - Agrupado ou separado)
    'M50': 'Spine_Cervical', // Transtornos dos discos cervicais
    'M54.2': 'Spine_Cervical', // Cervicalgia
    'M54': 'Spine_Lumbar', // Dorsalgia (Genérico vai para lombar se não especificado)
    'M54.5': 'Spine_Lumbar', // Lombalgia
    'M51': 'Spine_Lumbar', // Transtornos de discos intervertebrais

    // Ombros (Shoulders)
    'M75': 'Shoulder_R', // Lesões do ombro (Padrão direita para visualização, ou lógica para ambos)
    'S43': 'Shoulder_R', // Luxação do ombro

    // Membros Superiores (Arms/Hands)
    'M65': 'Arm_R', // Sinovite e tenossinovite
    'M77': 'Arm_R', // Outras entesopatias (Epicondilite)
    'G56': 'Arm_R', // Mononeuropatias do membro superior (Túnel do carpo)

    // Quadril (Hips)
    'M16': 'Hips', // Coxartrose
    'S70': 'Hips', // Traumatismo do quadril

    // Joelhos (Knees)
    'M17': 'Knee_R', // Gonartrose
    'M23': 'Knee_R', // Transtornos internos dos joelhos
    'S83': 'Knee_R', // Luxação/Entorse do joelho

    // Tornozelos e Pés (Ankles/Feet)
    'S93': 'Ankle_R', // Luxação/Entorse do tornozelo
    'M19': 'Ankle_R', // Outras artroses
    'M79.6': 'Ankle_R' // Dor em membro (Genérico)
};

// Nota: Para simplificação visual, CIDs laterais (Direito/Esquerdo) podem ser mapeados para uma malha genérica ou espelhada.