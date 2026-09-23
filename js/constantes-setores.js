// js/constantes-setores.js

/**
 * LISTA OFICIAL E IMUTÁVEL DE SETORES DO SISTEMA NEXTER
 * Nenhum setor fora desta lista é permitido no sistema.
 * Não deve haver variação de maiúsculas/minúsculas.
 */
const SETORES_OFICIAIS = [
    "ACABAMENTO BIDENSIDADE",
    "ACABAMENTO MONODENSIDADE",
    "ADMINISTRATIVO",
    "AFASTADOS",
    "ALMOXARIFADO",
    "CAMERAS",
    "COMERCIAL",
    "CORTE",
    "COSTURA FECHAMENTO",
    "COSTURA ORISOL",
    "CURTUME",
    "CUSTOS",
    "DIFERENCIADO",
    "DIVISORA",
    "EXPEDICAO",
    "EXTERNOS",
    "GERENTE DE PRODUÇÃO",
    "INJETORA BIDENSIDADE",
    "INJETORA MONODENSIDADE",
    "JOVEM APRENDIZ",
    "MANUTENCAO",
    "MARKETING",
    "MONTAGEM BIDENSIDADE",
    "MONTAGEM INFINITY",
    "MONTAGEM MONO",
    "PREPARACAO P.U.",
    "PVC",
    "PVC - NOITE",
    "SESMT",
    "SUMIDOS",
    "TRANSPORTE",
    "VIGIAS",
    "ZELADOR"
];

const SETORES_CODIGOS = {
    "ZELADOR": 137,
    "MONTAGEM INFINITY": 149,
    "EXPEDICAO": 150,
    "PVC": 151,
    "CURTUME": 152,
    "ALMOXARIFADO": 153,
    "VIGIAS": 154,
    "COSTURA ORISOL": 157,
    "COSTURA FECHAMENTO": 158,
    "COMERCIAL": 159,
    "ADMINISTRATIVO": 160,
    "MARKETING": 162,
    "PREPARACAO P.U.": 163,
    "CORTE": 164,
    "ACABAMENTO BIDENSIDADE": 166,
    "ACABAMENTO MONODENSIDADE": 167,
    "INJETORA BIDENSIDADE": 168,
    "INJETORA MONODENSIDADE": 169,
    "MONTAGEM BIDENSIDADE": 170,
    "MONTAGEM MONO": 171,
    "DIFERENCIADO": 172,
    "SESMT": 173,
    "TRANSPORTE": 174,
    "DIVISORA": 175,
    "MANUTENCAO": 176,
    "GERENTE DE PRODUÇÃO": 177,
    "EXTERNOS": 178,
    "PVC - NOITE": 180,
    "AFASTADOS": 182,
    "SUMIDOS": 183,
    "CAMERAS": 184,
    "CUSTOS": 185,
    "JOVEM APRENDIZ": 186
};

// Impedir modificação deste array em tempo de execução
if (typeof Object.freeze === 'function') {
    Object.freeze(SETORES_OFICIAIS);
    Object.freeze(SETORES_CODIGOS);
}
