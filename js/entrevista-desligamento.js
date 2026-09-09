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
                funcionarioNome: nomeFuncionario, // SALVA CORRETAMENTE COMO funcionarioNome
                nomeFuncionario: nomeFuncionario, // TAMBÉM SALVO COMO nomeFuncionario para retrocompatibilidade
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
                titulo: 'Acerto Rescisório - ' + nomeFuncionario, // retrocompatibilidade
                assunto: 'Acerto Rescisório - ' + nomeFuncionario, // Usado na view da agenda.js
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

    // ─── ABA DE HISTÓRICO ───────────────────────────────────────────────

    let _historicoCache = [];

    async function carregarHistorico() {
        const tbody = document.getElementById('tbody-historico-entrevistas');
        if (!tbody) return;

        try {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin me-2"></i> Carregando histórico...</td></tr>';
            
            const snap = await db.collection('entrevistas_desligamento')
                .orderBy('dataDesligamento', 'desc')
                .get();

            _historicoCache = [];
            let html = '';

            snap.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                _historicoCache.push(data);

                // Tratamento de datas
                let dataExibicao = data.dataEntrevista || data.dataDesligamento || '';
                if (dataExibicao && dataExibicao.includes('-')) {
                    const [ano, mes, dia] = dataExibicao.split('-');
                    dataExibicao = `${dia}/${mes}/${ano}`;
                }

                html += `
                    <tr>
                        <td class="ps-4 fw-semibold text-dark">${data.nomeFuncionario || data.funcionarioNome || '—'}</td>
                        <td class="text-muted small">${data.cargo || '—'}</td>
                        <td class="text-muted small">${dataExibicao}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger me-1" onclick="window.entrevistaDesligamento.abrirVisualizacao('${data.id}')" title="Visualizar Respostas">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.entrevistaDesligamento.excluirEntrevista('${data.id}')" title="Excluir Entrevista">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            if (_historicoCache.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma entrevista registrada ainda.</td></tr>';
            } else {
                tbody.innerHTML = html;
            }

        } catch (e) {
            console.error("Erro ao carregar histórico:", e);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erro ao carregar o histórico.</td></tr>';
        }
    }

    function abrirVisualizacao(id) {
        const entrevista = _historicoCache.find(e => e.id === id);
        if (!entrevista) return;

        // Cabeçalho
        document.getElementById('vis-nome').textContent = entrevista.nomeFuncionario || '—';
        document.getElementById('vis-cargo').textContent = entrevista.cargo || '—';
        document.getElementById('vis-setor').textContent = entrevista.setor || '—';
        
        let dataExibicao = entrevista.dataEntrevista || entrevista.dataDesligamento || '—';
        if (dataExibicao && dataExibicao.includes('-')) {
            const [ano, mes, dia] = dataExibicao.split('-');
            dataExibicao = `${dia}/${mes}/${ano}`;
        }
        document.getElementById('vis-data').textContent = dataExibicao;

        // Motivos
        const motivosContainer = document.getElementById('vis-motivos');
        const motivos = entrevista.motivos || [];
        if (motivos.length > 0) {
            motivosContainer.innerHTML = motivos.map(m => `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger p-2">${m}</span>`).join('');
        } else {
            motivosContainer.innerHTML = '<span class="text-muted small">Nenhum motivo selecionado.</span>';
        }

        // Avaliação
        document.getElementById('vis-avaliacao').textContent = entrevista.avaliacaoGeral || '—';
        document.getElementById('vis-apoio').textContent = entrevista.apoioEmpresa || '—';
        document.getElementById('vis-avaliacao-comentarios').textContent = entrevista.apoioComentarios || entrevista.avaliacaoComentarios || 'Sem comentários.';

        // Pontos e Desafios
        document.getElementById('vis-pontos').textContent = entrevista.pontosPositivos || '—';
        document.getElementById('vis-desafios').textContent = entrevista.desafiosEnfrentados || '—';

        // Sugestões e Recomendação
        document.getElementById('vis-sugestoes').textContent = (entrevista.sugestoesMelhoria || '') + (entrevista.comentarioAdicional ? '\n' + entrevista.comentarioAdicional : '') || '—';
        document.getElementById('vis-recomendaria').textContent = entrevista.recomendaria || '—';
        document.getElementById('vis-retornar').textContent = (entrevista.retornarEmpresa || '—') + (entrevista.retornarComentarios ? ` (${entrevista.retornarComentarios})` : '');

        // Abrir Modal
        const modal = new bootstrap.Modal(document.getElementById('modalVisualizarEntrevista'));
        modal.show();
    }

    async function excluirEntrevista(id) {
        if (!confirm("Tem certeza que deseja excluir o registro desta entrevista permanentemente?")) return;
        try {
            await db.collection('entrevistas_desligamento').doc(id).delete();
            if (typeof mostrarMensagem === 'function') mostrarMensagem("Entrevista excluída com sucesso.", "success");
            await carregarHistorico();
        } catch (e) {
            console.error("Erro ao excluir entrevista:", e);
            if (typeof mostrarMensagem === 'function') mostrarMensagem("Erro ao excluir entrevista.", "error");
        }
    }

    return { buscarColaborador, formatarCPF, resetar, carregarHistorico, abrirVisualizacao, excluirEntrevista };
})();
