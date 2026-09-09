/**
 * Módulo: Entrevista de Desligamento
 * Lógica de CPF lookup, cálculo de dias úteis e integração com Agenda.
 * O responsável pelo acerto é configurado pelo gestor e salvo no Firestore.
 */
window.entrevistaDesligamento = (function () {

    // ─── UTILITÁRIOS ────────────────────────────────────────────────────
    function formatarCPF(input) {
        let v = input.value.replace(/\D/g, '');
        if (v.length > 3) v = v.slice(0, 3) + '.' + v.slice(3);
        if (v.length > 7) v = v.slice(0, 7) + '.' + v.slice(7);
        if (v.length > 11) v = v.slice(0, 11) + '-' + v.slice(11);
        input.value = v.slice(0, 14);
    }

    function adicionarDiasUteis(dataStr, dias) {
        let d = new Date(dataStr + 'T12:00:00');
        let adicionados = 0;
        while (adicionados < dias) {
            d.setDate(d.getDate() + 1);
            const dia = d.getDay();
            if (dia !== 0 && dia !== 6) adicionados++;
        }
        return d;
    }

    function formatarDataBR(date) {
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    // ─── FLUXO PRINCIPAL ────────────────────────────────────────────────

    async function buscarColaborador() {
        const input = document.getElementById('entrevista-cpf-input');
        if (!input) return;
        const cpfRaw = input.value.replace(/\D/g, '');
        const feedback = document.getElementById('entrevista-busca-feedback');

        if (cpfRaw.length !== 11) {
            feedback.innerHTML = '<div class="alert alert-warning py-2 small"><i class="fas fa-exclamation-triangle me-1"></i> Digite um CPF completo com 11 dígitos.</div>';
            return;
        }

        feedback.innerHTML = '<div class="text-muted small"><i class="fas fa-spinner fa-spin me-1"></i> Buscando colaborador...</div>';

        try {
            const snap = await db.collection('funcionarios').where('cpf', '==', cpfRaw).limit(1).get();

            if (snap.empty) {
                feedback.innerHTML = '<div class="alert alert-danger py-2 small"><i class="fas fa-times-circle me-1"></i> Nenhum funcionário encontrado com este CPF.</div>';
                return;
            }

            const doc = snap.docs[0];
            const data = doc.data();

            document.getElementById('entrevista-funcionario-id').value = doc.id;
            document.getElementById('entrevista-funcionario-cpf').value = cpfRaw;
            document.getElementById('entrevista-nome').value = data.nome || '';
            document.getElementById('entrevista-cargo').value = data.cargo || '';
            document.getElementById('entrevista-setor').value = data.setor || data.setorNome || '';
            document.getElementById('entrevista-data-entrevista').value = new Date().toISOString().split('T')[0];

            document.getElementById('etapa-busca-cpf').style.display = 'none';
            const configCard = document.getElementById('card-config-responsavel');
            if (configCard) configCard.style.display = 'none';
            document.getElementById('etapa-formulario').style.display = 'block';
            document.getElementById('btnExportarEntrevista').style.display = 'inline-block';

            // Submissão
            const form = document.getElementById('form-entrevista-desligamento');
            const novoForm = form.cloneNode(true);
            form.parentNode.replaceChild(novoForm, form);
            novoForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                await salvarEntrevista();
            });

        } catch (e) {
            console.error('Erro na busca:', e);
            feedback.innerHTML = '<div class="alert alert-danger py-2 small">Erro ao buscar no banco de dados.</div>';
        }
    }

    async function salvarEntrevista() {
        const btn = document.getElementById('btn-salvar-entrevista');
        const dataDesligamento = document.getElementById('entrevista-data-desligamento').value;

        if (!dataDesligamento) {
            if (typeof mostrarMensagem === 'function') mostrarMensagem('Preencha a Data de Desligamento.', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Salvando...';

        try {
            const motivosSelecionados = [...document.querySelectorAll('input[name="motivos"]:checked')].map(el => el.value);
            const motivoOutros = document.getElementById('motivo-outros').value.trim();
            if (motivoOutros) motivosSelecionados.push('Outros: ' + motivoOutros);

            const nomeFuncionario = document.getElementById('entrevista-nome').value;
            const uid = (typeof currentUser !== 'undefined' && currentUser?.uid) || 'sistema';

            const entrevistaData = {
                funcionarioId: document.getElementById('entrevista-funcionario-id').value,
                funcionarioNome: nomeFuncionario,
                cargo: document.getElementById('entrevista-cargo').value,
                setor: document.getElementById('entrevista-setor').value,
                dataDesligamento,
                dataEntrevista: document.getElementById('entrevista-data-entrevista').value,
                motivosDesligamento: motivosSelecionados,
                apoioEmpresa: document.querySelector('input[name="apoio-empresa"]:checked')?.value || '',
                apoioComentarios: document.getElementById('apoio-comentarios').value,
                avaliacaoGeral: document.querySelector('input[name="avaliacao-geral"]:checked')?.value || '',
                avaliacaoComentarios: document.getElementById('avaliacao-comentarios').value,
                pontosPositivos: document.getElementById('pontos-positivos').value,
                desafios: document.getElementById('desafios-enfrentados').value,
                sugestoesMelhoria: document.getElementById('sugestoes-melhoria').value,
                comentarioAdicional: document.getElementById('comentario-adicional').value,
                recomendaria: document.querySelector('input[name="recomendaria"]:checked')?.value || '',
                recomendariaPorque: document.getElementById('recomendaria-porque').value,
                retornar: document.querySelector('input[name="retornar"]:checked')?.value || '',
                retornarComentarios: document.getElementById('retornar-comentarios').value,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                criadoPor: uid
            };

            // 1. Salvar entrevista
            await db.collection('entrevistas_desligamento').add(entrevistaData);

            // 2. Criar evento na agenda — responsável definido pelo gestor na Configuração Global
            const dataAcerto = adicionarDiasUteis(dataDesligamento, 8);
            
            let respId = uid;
            let respNome = typeof currentUser !== 'undefined' ? (currentUser.displayName || currentUser.email) : 'Sistema';
            
            if (typeof window.configFluxos !== 'undefined') {
                const configId = await window.configFluxos.getConfiguracao('acertoRescisorioId');
                const configNome = await window.configFluxos.getConfiguracao('acertoRescisorioNome');
                if (configId && configNome) {
                    respId = configId;
                    respNome = configNome;
                }
            }

            await db.collection('agenda_atividades').add({
                titulo: 'Acerto Rescisório — ' + nomeFuncionario,
                descricao: 'Acerto trabalhista referente ao desligamento em ' + new Date(dataDesligamento + 'T12:00:00').toLocaleDateString('pt-BR') + '. Cargo: ' + entrevistaData.cargo + ' | Setor: ' + entrevistaData.setor,
                tipo: 'Acerto',
                status: 'Pendente',
                data: firebase.firestore.Timestamp.fromDate(dataAcerto),
                cor: '#dc3545',
                criadoPor: uid,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                atribuidoParaId: respId,
                atribuidoParaNome: respNome,
                funcionarioId: entrevistaData.funcionarioId,
                funcionarioNome: nomeFuncionario
            });

            // 3. Atualizar quadro de funcionários
            await db.collection('funcionarios').doc(entrevistaData.funcionarioId).update({
                status: 'Inativo',
                dataDesligamento: firebase.firestore.Timestamp.fromDate(new Date(dataDesligamento + 'T12:00:00')),
                motivoDesligamento: motivosSelecionados.join(', ') || 'Pedido de Demissão',
                entrevistaDesligamentoRealizada: true,
                dataEntrevistaDesligamento: firebase.firestore.Timestamp.fromDate(new Date())
            });

            if (typeof mostrarMensagem === 'function') {
                mostrarMensagem(
                    `Entrevista salva com sucesso!`,
                    'success'
                );
            }resetar();

        } catch (e) {
            console.error('Erro ao salvar:', e);
            if (typeof mostrarMensagem === 'function') mostrarMensagem('Erro ao salvar a entrevista. Tente novamente.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Entrevista & Agendar Acerto';
        }
    }

    function resetar() {
        const isAdmin = window.currentUserPermissions?.isAdmin;
        const configCard = document.getElementById('card-config-responsavel');
        if (configCard) configCard.style.display = isAdmin ? 'block' : 'none';

        const etapaBusca = document.getElementById('etapa-busca-cpf');
        const etapaForm = document.getElementById('etapa-formulario');
        const cpfInput = document.getElementById('entrevista-cpf-input');
        const feedback = document.getElementById('entrevista-busca-feedback');
        const btnExportar = document.getElementById('btnExportarEntrevista');
        const btn = document.getElementById('btn-salvar-entrevista');
        
        if (etapaBusca) etapaBusca.style.display = 'block';
        if (etapaForm) etapaForm.style.display = 'none';
        if (cpfInput) cpfInput.value = '';
        if (feedback) feedback.innerHTML = '';
        if (btnExportar) btnExportar.style.display = 'none';
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Entrevista'; }
        const form = document.getElementById('form-entrevista-desligamento');
        if (form) form.reset();
    }

    return { buscarColaborador, formatarCPF, resetar };
})();
