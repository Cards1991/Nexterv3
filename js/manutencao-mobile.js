document.addEventListener('DOMContentLoaded', function() {
    // Pega o nome da máquina da URL
    const urlParams = new URLSearchParams(window.location.search);
    const maquinaId = urlParams.get('maquina');

    const maquinaInput = document.getElementById('mobile-maquina-id');
    const motivoTextarea = document.getElementById('mobile-motivo');
    const salvarBtn = document.getElementById('btn-salvar-chamado-mobile');

    if (maquinaId) {
        maquinaInput.value = maquinaId;
    } else {
        maquinaInput.value = "Máquina não identificada!";
        maquinaInput.classList.add('is-invalid');
        salvarBtn.disabled = true;
    }

    salvarBtn.addEventListener('click', async () => {
        const motivo = motivoTextarea.value.trim();

        if (!maquinaId || !motivo) {
            alert("A máquina deve ser identificada e o motivo deve ser preenchido.");
            return;
        }

        // Desabilitar botão para evitar cliques duplos
        salvarBtn.disabled = true;
        salvarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const chamadoData = {
                maquinaId: maquinaId,
                motivo: motivo,
                observacoes: 'Aberto via Celular',
                maquinaParada: document.getElementById('mobile-maquina-parada').checked,
                status: 'Aberto',
                dataAbertura: firebase.firestore.FieldValue.serverTimestamp(),
                dataEncerramento: null,
                tempoParada: null,
                tipoManutencao: null,
                observacoesMecanico: null,
            };

            await db.collection('manutencao_chamados').add(chamadoData);

            // Mostrar mensagem de sucesso
            document.getElementById('form-container').classList.add('d-none');
            document.getElementById('success-message').classList.remove('d-none');

        } catch (error) {
            console.error("Erro ao abrir chamado via mobile:", error);
            alert("Ocorreu um erro ao tentar abrir o chamado. Tente novamente.");
            salvarBtn.disabled = false;
            salvarBtn.innerHTML = '<i class="fas fa-save"></i> Abrir Chamado';
        }
    });
});