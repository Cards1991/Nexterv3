/**
 * NEXTER - Exportacao de Vencimentos de Experiencia
 */
async function exportarVencimentosExperienciaExcel() {
    const table = document.getElementById('lista-pendencias-experiencia');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr'));

    if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.trim().toLowerCase().includes('nenhum'))) {
        alert("Não há dados para exportar.");
        return;
    }

    const btn = document.querySelector('button[onclick="exportarVencimentosExperienciaExcel()"]');
    const originalText = btn ? btn.innerHTML : 'Exportar';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
        const data = [];
        data.push(["Colaborador", "CPF", "Matrícula", "Setor", "Admissão", "Período", "Vencimento", "Status", "Faltas", "Atestados", "Advertências"]);

        for (const row of rows) {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 5) {
                const nome = cols[0].innerText.trim();

                let cpf = '', matricula = '', setor = '';
                let faltas = 0, atestados = 0, advertencias = 0;

                // Tenta encontrar o ID do funcionário (assumindo que está no botão de ação ou buscando pelo nome)
                let funcId = null;
                const btnAction = row.querySelector('button');
                if (btnAction) {
                    const onclick = btnAction.getAttribute('onclick');
                    if (onclick) {
                        const match = onclick.match(/'([^']+)'/);
                        if (match) funcId = match[1];
                    }
                }

                if (!funcId) {
                    const snap = await db.collection('funcionarios').where('nome', '==', nome).limit(1).get();
                    if (!snap.empty) funcId = snap.docs[0].id;
                }

                if (funcId) {
                    const doc = await db.collection('funcionarios').doc(funcId).get();
                    if (doc.exists) {
                        const f = doc.data();
                        cpf = f.cpf || '';
                        matricula = f.matricula || '';
                        setor = f.setor || '';
                    }

                    // Buscas paralelas para contagem
                    const [snapFaltas, snapAtestados, snapAdv] = await Promise.all([
                        db.collection('faltas').where('funcionarioId', '==', funcId).get().catch(() => ({ size: 0 })),
                        db.collection('atestados').where('funcionarioId', '==', funcId).get().catch(() => ({ size: 0 })),
                        db.collection('controle_disciplinar').where('funcionarioId', '==', funcId).get().catch(() => ({ size: 0 }))
                    ]);

                    faltas = snapFaltas.size;
                    atestados = snapAtestados.size;
                    advertencias = snapAdv.size;
                }

                data.push([
                    nome,
                    cpf,
                    matricula,
                    setor,
                    cols[1].innerText.trim(),
                    cols[2].innerText.trim(),
                    cols[3].innerText.trim(),
                    cols[4].innerText.trim(),
                    faltas,
                    atestados,
                    advertencias
                ]);
            }
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vencimentos Detalhado");
        XLSX.writeFile(wb, "vencimentos_experiencia_detalhado.xlsx");
    } catch (error) {
        console.error("Erro na exportação:", error);
        alert("Erro ao gerar o arquivo Excel. Verifique o console.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}
