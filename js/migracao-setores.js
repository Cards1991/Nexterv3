// js/migracao-setores.js

/**
 * Script Descartável de Migração de Setores (O.D.)
 * 
 * Este script deve ser executado MANUALMENTE via console do navegador (DevTools)
 * Comando: window.iniciarMigracaoDeSetores()
 * 
 * ATENÇÃO: Esta ação APAGA todos os setores antigos e recria os 34 OFICIAIS globalmente.
 */

window.iniciarMigracaoDeSetores = async function() {
    if (!confirm("⚠️ ATENÇÃO: Tem certeza que deseja rodar a migração? Isso apagará TODOS os documentos da coleção 'setores' e criará apenas os 34 globais. Certifique-se de que o sistema está fora de uso.")) return;
    if (!confirm("⚠️ SEGUNDO AVISO: Esta ação é destrutiva na coleção 'setores'. Confirma?")) return;
    
    console.log("🚀 INICIANDO MIGRAÇÃO DE SETORES...");
    
    try {
        const batch = db.batch();
        let opsCont = 0;
        
        // 1. Apagar TODOS os setores atuais
        console.log("🧹 Apagando setores antigos...");
        const setoresSnap = await db.collection('setores').get();
        
        setoresSnap.forEach(doc => {
            batch.delete(doc.ref);
            opsCont++;
            
            // O Firestore limita batches a 500 operações. Como são poucos setores (esperamos < 200),
            // podemos colocar tudo no mesmo batch, mas manteremos o contador seguro.
        });
        
        console.log(`🧹 Marcado ${opsCont} setores antigos para exclusão.`);

        // 2. Inserir os 34 oficiais
        console.log("🌱 Inserindo os 34 setores globais oficiais...");
        if (typeof SETORES_OFICIAIS === 'undefined' || SETORES_OFICIAIS.length !== 34) {
            throw new Error("❌ ERRO: A constante SETORES_OFICIAIS não foi carregada ou não contém exatos 34 itens.");
        }
        
        SETORES_OFICIAIS.forEach(nomeSetor => {
            const docRef = db.collection('setores').doc(); // Auto-id
            batch.set(docRef, {
                descricao: nomeSetor,
                empresaId: "GLOBAL", // Marca como setor global
                global: true,
                gerenteId: null,
                qtdIdeal: 0,
                controlaProducao: false,
                horarioEntrada: "",
                horarioSaida: "",
                observacao: "Criado automaticamente pela Migração O.D.",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            opsCont++;
        });

        // 3. Efetivar as operações no Firestore
        console.log("🔥 Efetivando transação (Batch Commit)...");
        await batch.commit();
        
        console.log("✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
        console.log(`✅ Foram excluídos ${setoresSnap.size} setores antigos e criados 34 novos setores globais.`);
        alert("Migração concluída! Verifique o console para detalhes.");
        
    } catch (error) {
        console.error("❌ ERRO FATAL NA MIGRAÇÃO:", error);
        alert("Erro na migração! Veja o console.");
    }
};
