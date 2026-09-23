// js/migracao-setores.js

/**
 * Script de Migracao de Setores
 */

window.iniciarMigracaoDeSetores = async function() {
    if (!confirm("ATENCAO: Tem certeza que deseja rodar a migracao? Isso apagara TODOS os documentos da colecao 'setores' e criara apenas os 33 globais.")) return;
    
    console.log("INICIANDO MIGRACAO DE SETORES...");
    
    try {
        const batch = db.batch();
        
        // 1. Apagar TODOS os setores atuais
        console.log("Apagando setores antigos...");
        const setoresSnap = await db.collection('setores').get();
        const docs = setoresSnap.docs;
        
        console.log(`Marcado ${docs.length} setores antigos para exclusao.`);

        // Processar delecoes em lotes de 400
        for (let i = 0; i < docs.length; i += 400) {
            const chunk = docs.slice(i, i + 400);
            const delBatch = db.batch();
            chunk.forEach(doc => delBatch.delete(doc.ref));
            await delBatch.commit();
            console.log(`Apagado lote de ${chunk.length} setores...`);
        }

        // 2. Inserir os 33 oficiais
        console.log("Inserindo os 33 setores globais oficiais...");
        
        const insBatch = db.batch();
        for (const setorNome of SETORES_OFICIAIS) {
            const newRef = db.collection('setores').doc();
            insBatch.set(newRef, {
                nome: setorNome,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await insBatch.commit();

        console.log("SUCESSO! Migracao concluida.");
        alert("Migracao concluida! Todos os setores foram apagados e os 33 oficiais foram criados.");
        
    } catch (e) {
        console.error("Erro na migracao:", e);
        alert("Erro na migracao: " + e.message);
    }
};

window.sincronizarSetoresDoTeorema = async function() {
    if (!confirm('Tem certeza que deseja sincronizar os Setores e Empresas do banco local (Teorema) com a nuvem (Nexter)?\nIsso pode levar alguns minutos.')) {
        return;
    }
    
    try {
        console.log('Iniciando sincronizacao com Teorema...');
        const res = await fetch('http://localhost:3000/api/teorema-setores');
        if (!res.ok) throw new Error('Erro na comunicacao com o servidor local do Teorema');
        
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Erro desconhecido');

        const teoremaMap = json.data;
        const empresasTeorema = json.empresasTeorema || {};

        // Criar mapeamento reverso (codigo -> nome)
        const MAPA_REVERSO = {};
        for (const [nome, codigo] of Object.entries(SETORES_CODIGOS)) {
            MAPA_REVERSO[codigo] = nome;
        }

        // Buscar empresas do Firebase para cruzar pelo CNPJ
        const firebaseEmpresasSnap = await db.collection('empresas').get();
        const firebaseEmpresasMap = {};
        for (const doc of firebaseEmpresasSnap.docs) {
            const empData = doc.data();
            if (empData.cnpj) {
                const cnpjLp = String(empData.cnpj).replace(/\D/g, '');
                firebaseEmpresasMap[cnpjLp] = doc.id;
            }
        }

        // Mapear Codigo Teorema -> Firebase Empresa ID
        const teoremaParaFirebaseEmpresa = {};
        for (const [codigoT, cnpjT] of Object.entries(empresasTeorema)) {
            if (firebaseEmpresasMap[cnpjT]) {
                teoremaParaFirebaseEmpresa[codigoT] = firebaseEmpresasMap[cnpjT];
            }
        }

        console.log('Buscando funcionarios na nuvem...');
        const nexterSnap = await db.collection('funcionarios').get();

        let ops = 0;
        let totalUpdated = 0;
        let semCorrespondenciaSetor = 0;
        let currentBatch = db.batch();

        for (const doc of nexterSnap.docs) {
            const data = doc.data();
            if (!data.cpf) continue;

            const cpfLp = String(data.cpf).replace(/\D/g, '');
            const teoremaInfo = teoremaMap[cpfLp];

            if (teoremaInfo) {
                const codigoSetor = teoremaInfo.setor;
                const codigoEmpresa = teoremaInfo.empresaCodigo;
                
                const novoSetorNome = MAPA_REVERSO[codigoSetor];
                const novaEmpresaId = teoremaParaFirebaseEmpresa[codigoEmpresa];

                const atualizacoes = {};
                let precisaAtualizar = false;

                if (novoSetorNome && data.setor !== novoSetorNome) {
                    atualizacoes.setor = novoSetorNome;
                    precisaAtualizar = true;
                } else if (!novoSetorNome) {
                    semCorrespondenciaSetor++;
                }

                if (novaEmpresaId && data.empresaId !== novaEmpresaId) {
                    atualizacoes.empresaId = novaEmpresaId;
                    precisaAtualizar = true;
                }

                if (precisaAtualizar) {
                    currentBatch.update(doc.ref, atualizacoes);
                    ops++;
                    totalUpdated++;

                    if (ops >= 400) {
                        await currentBatch.commit();
                        currentBatch = db.batch();
                        ops = 0;
                        console.log(`Atualizados ${totalUpdated} funcionarios...`);
                    }
                }
            }
        }

        if (ops > 0) {
            await currentBatch.commit();
        }

        console.log(`Sincronizacao concluida! ${totalUpdated} atualizados.`);
        alert(`Sincronizacao concluida!\n\n${totalUpdated} funcionarios tiveram seu Setor ou Empresa atualizados.\n${semCorrespondenciaSetor} ignorados no setor.`);
        window.location.reload();

    } catch (e) {
        console.error('Erro na sincronizacao:', e);
        alert('Erro na sincronizacao: ' + e.message);
    }
};
