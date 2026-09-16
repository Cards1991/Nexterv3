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
    "COSTURA",
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

// Impedir modificação deste array em tempo de execução
if (typeof Object.freeze === 'function') {
    Object.freeze(SETORES_OFICIAIS);
}
