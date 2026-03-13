// js/data-fix.js

async function fixMissingFuncoes() {
    console.log("Iniciando verificação de empresas sem funções...");

    const defaultFuncoes = [
        'Analista de RH',
        'Assistente de RH',
        'Auxiliar de Produção',
        'Gerente de Produção',
        'Supervisor de Produção',
        'Operador de Máquinas',
        'Inspetor de Qualidade',
        'Almoxarife',
        'Auxiliar de Almoxarifado',
        'Gerente Administrativo',
        'Assistente Administrativo'
    ];

    try {
        const empresasSnapshot = await db.collection('empresas').get();
        const batch = db.batch();
        let updatedCount = 0;

        empresasSnapshot.forEach(doc => {
            const empresa = doc.data();
            const empresaRef = db.collection('empresas').doc(doc.id);

            if (!empresa.funcoes || empresa.funcoes.length === 0) {
                console.log(`Empresa "${empresa.nome}" (ID: ${doc.id}) não possui funções. Adicionando padrões.`);
                batch.update(empresaRef, { funcoes: defaultFuncoes });
                updatedCount++;
            } else {
                console.log(`Empresa "${empresa.nome}" (ID: ${doc.id}) já possui funções.`);
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            console.log(`${updatedCount} empresa(s) atualizada(s) com funções padrão.`);
            mostrarMensagem(`${updatedCount} empresa(s) tiveram a lista de funções padrão adicionada.`, 'success');
        } else {
            console.log("Nenhuma empresa precisou ser atualizada.");
            mostrarMensagem("Todas as empresas já possuem listas de funções.", 'info');
        }
    } catch (error) {
        console.error("Erro ao verificar e corrigir empresas:", error);
        mostrarMensagem("Ocorreu um erro ao tentar corrigir os dados das empresas.", 'error');
    }
}

// Para executar a função, você pode chamá-la a partir do console do navegador
// ou adicionar um botão temporário na sua interface.
// Exemplo de como chamar pelo console:
// fixMissingFuncoes();
