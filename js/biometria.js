// Documento: js/biometria.js
// Responsável: Gemini
// Data: 2024-07-29
// Descrição: Gerencia o cadastro, visualização e remoção de biometrias dos funcionários,
// integrando com o hardware Android via interface JavaScript e persistindo os dados no Firestore.

// Estado global para gerenciar o processo de cadastro
const biometriaState = {
    funcionarioId: null,
    dedoSelecionado: null,
};

/**
 * Abre o modal para selecionar o dedo a ser cadastrado.
 * @param {string} funcionarioId - O ID do funcionário para o qual a biometria será cadastrada.
 */
function abrirModalSelecaoDedo(funcionarioId) {
    console.log(`Abrindo modal de seleção de dedo para o funcionário: ${funcionarioId}`);
    biometriaState.funcionarioId = funcionarioId;

    const modal = new bootstrap.Modal(document.getElementById('modalSelecaoDedo'));
    verificarBiometriasFuncionario(funcionarioId); // Atualiza o status dos botões
    modal.show();
}

/**
 * Lida com a seleção de um dedo no modal.
 * Inicia o processo de cadastro biométrico no dispositivo Android.
 * @param {string} dedo - O nome do dedo selecionado (e.g., 'polegar_direito').
 */
function selecionarDedo(dedo) {
    biometriaState.dedoSelecionado = dedo;
    console.log(`Dedo selecionado: ${dedo} para o funcionário ${biometriaState.funcionarioId}`);

    // Fecha o modal antes de chamar a função nativa
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalSelecaoDedo'));
    modal.hide();

    // Mostra um feedback visual para o usuário
    showToast(`Por favor, posicione o ${dedo.replace('_', ' ')} no sensor biométrico.`, 'info');

    // Chama a interface do Android para iniciar o cadastro
    if (window.AndroidBiometria && typeof window.AndroidBiometria.cadastrarBiometria === 'function') {
        window.AndroidBiometria.cadastrarBiometria(biometriaState.funcionarioId);
    } else {
        console.error('Interface AndroidBiometria.cadastrarBiometria não encontrada. Usando modo de simulação.');
        // Simulação para ambientes de teste (desktop)
        setTimeout(() => {
            // Simula uma resposta de sucesso do Android
            onBiometriaCadastrada(biometriaState.funcionarioId, true);
        }, 2000);
    }
}

/**
 * Callback chamado pelo Android após a tentativa de cadastro biométrico.
 * @param {string} funcionarioId - O ID do funcionário retornado pelo Android.
 * @param {boolean} sucesso - True se o cadastro foi bem-sucedido, false caso contrário.
 */
window.onBiometriaCadastrada = function(funcionarioId, sucesso) {
    console.log(`Callback onBiometriaCadastrada recebido: funcId=${funcionarioId}, sucesso=${sucesso}`);

    if (funcionarioId !== biometriaState.funcionarioId || !biometriaState.dedoSelecionado) {
        console.error('ID do funcionário ou dedo selecionado não corresponde ao estado atual.', {
            expected: biometriaState.funcionarioId,
            received: funcionarioId,
            dedo: biometriaState.dedoSelecionado
        });
        showToast('Erro de inconsistência. Tente novamente.', 'error');
        return;
    }

    if (sucesso) {
        console.log('Biometria cadastrada com sucesso no dispositivo. Salvando no Firestore...');
        salvarBiometriaFirestore(funcionarioId, biometriaState.dedoSelecionado);
    } else {
        console.error('Falha ao cadastrar biometria no dispositivo Android.');
        showToast('Falha no cadastro da biometria. O sensor não conseguiu capturar a digital.', 'error');
    }

    // Limpa o estado após a operação
    biometriaState.funcionarioId = null;
    biometriaState.dedoSelecionado = null;
};

/**
 * Salva a referência da biometria no Firestore.
 * @param {string} funcionarioId - O ID do funcionário.
 * @param {string} dedo - O dedo que foi cadastrado.
 */
async function salvarBiometriaFirestore(funcionarioId, dedo) {
    const db = firebase.firestore();
    const funcionarioRef = db.collection('funcionarios').doc(funcionarioId);

    const biometriaData = {
        [`biometrias.${dedo}`]: {
            ativa: true,
            dataCadastro: firebase.firestore.FieldValue.serverTimestamp()
        }
    };

    try {
        await funcionarioRef.update(biometriaData);
        showToast(`Digital do ${dedo.replace('_', ' ')} cadastrada com sucesso!`, 'success');
        console.log(`Biometria para ${dedo} salva no Firestore para o funcionário ${funcionarioId}`);

        // Reabre o modal para que o usuário possa cadastrar outro dedo ou fechar
        abrirModalSelecaoDedo(funcionarioId);
    } catch (error) {
        console.error('Erro ao salvar biometria no Firestore:', error);
        showToast('Erro ao salvar a digital no banco de dados.', 'error');
    }
}

/**
 * Verifica as biometrias já cadastradas para um funcionário e atualiza a interface do modal.
 * @param {string} funcionarioId - O ID do funcionário.
 */
async function verificarBiometriasFuncionario(funcionarioId) {
    const db = firebase.firestore();
    const funcionarioRef = db.collection('funcionarios').doc(funcionarioId);

    try {
        const doc = await funcionarioRef.get();
        if (!doc.exists) {
            console.warn(`Funcionário com ID ${funcionarioId} não encontrado.`);
            return;
        }

        const funcionario = doc.data();
        const biometrias = funcionario.biometrias || {};
        const totalCadastradas = Object.values(biometrias).filter(b => b.ativa).length;

        // Atualiza o contador no modal
        document.getElementById('contador-digitais').textContent = `${totalCadastradas}/10`;

        // Atualiza os botões no modal
        const botoes = document.querySelectorAll('#modalSelecaoDedo .btn-dedo');
        botoes.forEach(botao => {
            const dedo = botao.dataset.dedo;
            if (biometrias[dedo] && biometrias[dedo].ativa) {
                botao.classList.remove('btn-outline-primary');
                botao.classList.add('btn-success');
                botao.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${botao.textContent.replace(/<i.*?>/g, '').trim()}`;
                // Adiciona a opção de remover
                botao.onclick = () => confirmarRemocao(funcionarioId, dedo);
            } else {
                botao.classList.remove('btn-success');
                botao.classList.add('btn-outline-primary');
                botao.innerHTML = botao.textContent.replace(/<i.*?>/g, '').trim();
                // Adiciona a opção de cadastrar
                botao.onclick = () => selecionarDedo(dedo);
            }
        });
    } catch (error) {
        console.error('Erro ao verificar biometrias do funcionário:', error);
    }
}

/**
 * Exibe uma confirmação antes de remover uma biometria.
 * @param {string} funcionarioId - O ID do funcionário.
 * @param {string} dedo - O dedo a ser removido.
 */
function confirmarRemocao(funcionarioId, dedo) {
    const nomeDedo = dedo.replace('_', ' ');
    if (confirm(`Tem certeza que deseja remover a digital do ${nomeDedo}?`)) {
        removerBiometria(funcionarioId, dedo);
    }
}

/**
 * Remove (desativa) uma biometria no Firestore.
 * @param {string} funcionarioId - O ID do funcionário.
 * @param {string} dedo - O dedo a ser removido.
 */
async function removerBiometria(funcionarioId, dedo) {
    const db = firebase.firestore();
    const funcionarioRef = db.collection('funcionarios').doc(funcionarioId);

    // Usamos a notação de ponto para atualizar um campo aninhado
    const updates = {};
    updates[`biometrias.${dedo}`] = firebase.firestore.FieldValue.delete();

    try {
        await funcionarioRef.update(updates);
        showToast(`Digital do ${dedo.replace('_', ' ')} removida.`, 'warning');
        console.log(`Biometria para ${dedo} removida no Firestore para o funcionário ${funcionarioId}`);
        // Atualiza a interface do modal
        verificarBiometriasFuncionario(funcionarioId);
    } catch (error) {
        console.error('Erro ao remover biometria no Firestore:', error);
        showToast('Erro ao remover a digital.', 'error');
    }
}

// Função auxiliar para exibir toasts (mensagens flutuantes)
function showToast(message, type = 'info') {
    // Implemente sua lógica de Toast aqui, ou use uma biblioteca como Toastify.js
    // Por simplicidade, vamos usar um console.log como fallback
    console.log(`[TOAST - ${type}]: ${message}`);
    // Exemplo com um toast simples de Bootstrap, se você tiver o container no seu HTML:
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        const toastId = `toast-${Date.now()}`;
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        toastContainer.innerHTML += toastHTML;
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
}
