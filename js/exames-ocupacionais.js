/**
 * Módulo: Exames Ocupacionais
 */

async function inicializarExamesOcupacionais() {
    const tbody = document.getElementById('lista-exames-ocupacionais');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-success" role="status"></div><br>Buscando exames...</td></tr>';

    try {
        const snap = await db.collection('agenda_atividades')
            .where('tipo', '==', 'Saúde Ocupacional')
            .get();

        const exames = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Aceita qualquer exame ocupacional
            exames.push({ id: doc.id, ...data });
        });

        // Ordenar em memória (descendente por data)
        exames.sort((a, b) => {
            const timeA = a.data && typeof a.data.toMillis === 'function' ? a.data.toMillis() : 0;
            const timeB = b.data && typeof b.data.toMillis === 'function' ? b.data.toMillis() : 0;
            return timeB - timeA;
        });

        if (exames.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum exame ocupacional encontrado.</td></tr>';
            return;
        }

        let html = '';
        exames.forEach(ex => {
            let dataFormatada = 'Sem data';
            if (ex.data && ex.data.toDate) {
                dataFormatada = ex.data.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            }

            let statusBadge = '';
            if (ex.status === 'Concluído') {
                statusBadge = '<span class="badge bg-success">Realizado</span>';
            } else {
                statusBadge = '<span class="badge bg-warning text-dark">Pendente</span>';
            }

            html += `
                <tr>
                    <td class="fw-bold">${ex.funcionarioNome || 'Desconhecido'}</td>
                    <td>${dataFormatada}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="window.visualizarEvento('${ex.id}', 'agenda_atividades')" title="Ver Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;

    } catch (e) {
        console.error("Erro ao carregar exames ocupacionais:", e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erro ao carregar exames.</td></tr>';
    }
}

// A função visualizarDetalhesExame não é mais necessária, pois chamamos diretamente window.visualizarEvento no onClick
