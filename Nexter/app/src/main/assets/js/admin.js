// c:/Users/RH - CALÇADOS CRIVAL/Desktop/Controle de Admissões e Demissões/sistema-rh/bkp/js/admin.js

async function inicializarAdmin() {
    await carregarUsuariosAdmin();
}

async function carregarUsuariosAdmin() {
    const tbody = document.getElementById('tabela-usuarios-admin');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

    try {
        const usersSnap = await db.collection('usuarios').get();
        if (usersSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        usersSnap.forEach(doc => {
            const user = doc.data();
            const row = `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.nome || '-'}</td>
                    <td>${user.permissoes?.isAdmin ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Não</span>'}</td>
                    <td>${user.permissoes?.restricaoSetor || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary" title="Editar Permissões" onclick="abrirModalPermissoes('${doc.id}')">
                            <i class="fas fa-edit"></i> Editar Permissões
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" title="Resetar Senha" onclick="resetarSenhaUsuario('${user.email}')">
                            <i class="fas fa-key"></i> Resetar Senha
                        </button>
                        <button class="btn btn-sm btn-outline-danger" title="Excluir Usuário" onclick="excluirUsuario('${doc.id}', '${user.email}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro ao carregar usuários.</td></tr>';
    }
}

async function abrirModalPermissoes(uid) {
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
        mostrarMensagem('Usuário não encontrado.', 'error');
        return;
    }
    const userData = userDoc.data();
    const permissoes = userData.permissoes || {};

    document.getElementById('perm-user-uid').value = uid;
    document.getElementById('perm-user-email').textContent = userData.email;
    document.getElementById('perm-user-nome').value = userData.nome || '';
    document.getElementById('perm-is-admin').checked = permissoes.isAdmin || false;

    // Popular seções
    const secoesContainer = document.getElementById('perm-secoes-container');
    secoesContainer.innerHTML = '';

    // Definição dos grupos de permissões
    const gruposPermissoes = {
        'Análise (Dashboards)': [
            'analise-rescisao', 'analise-pessoas', 'dashboard-atividades', 'dashboard-faltas',
            'dashboard-manutencao', 'frota-dashboard', 'juridico-dashboard', 'dp-horas-extras',
            'analise-epi', 'analise-custos'
        ],
        'Departamento Pessoal': [
            'funcionarios', 'admissao', 'demissao', 'painel-demitidos', 'alteracao-funcao',
            'dp-calculos', 'dp-horas-solicitacao', 'dp-horas-extras-lancamento', 'transferencia',
            'faltas', 'controle-disciplinar', 'gestao-sumidos', 'movimentacoes'
        ],
        'Saúde Ocupacional': [
            'afastamentos', 'saude-psicossocial', 'atestados', 'estoque-epi', 'consumo-epi', 'epi-compras'
        ],
        'Controladoria': [
            'financeiro', 'control-horas-autorizacao'
        ],
        'ISO 9001': [
            'iso-manutencao', 'iso-maquinas', 'iso-mecanicos', 'iso-temperatura-injetoras',
            'iso-organograma', 'gerenciar-avaliacoes', 'iso-swot', 'iso-avaliacao-colaboradores'
        ],
        'Logística': [
            'frota-veiculos', 'frota-motoristas', 'frota-utilizacao', 'frota-destinos', 'frota-tabelas-frete'
        ],
        'Jurídico': [
            'juridico-processos', 'juridico-clientes', 'juridico-automacao', 'juridico-financeiro',
            'juridico-documentos', 'compliance-denuncia', 'juridico-analise-cpf'
        ],
        'Geral / Admin': [
            'agenda', 'empresas', 'relatorios', 'admin-usuarios'
        ]
    };

    // Identificar seções que não estão nos grupos definidos (para garantir que nada fique de fora)
    const secoesAgrupadas = new Set(Object.values(gruposPermissoes).flat());
    const secoesRestantes = (typeof TODAS_SECOES !== 'undefined' ? TODAS_SECOES : []).filter(s => !secoesAgrupadas.has(s));
    
    if (secoesRestantes.length > 0) {
        gruposPermissoes['Outros'] = secoesRestantes;
    }

    for (const [grupo, secoes] of Object.entries(gruposPermissoes)) {
        const secoesValidas = (typeof TODAS_SECOES !== 'undefined') ? secoes.filter(s => TODAS_SECOES.includes(s)) : secoes;
        
        if (secoesValidas.length === 0) continue;

        secoesContainer.innerHTML += `<div class="col-12 mt-3 mb-2"><h6 class="border-bottom pb-1 text-primary fw-bold">${grupo}</h6></div>`;

        secoesValidas.forEach(secao => {
            const isChecked = (permissoes.secoesPermitidas || []).includes(secao);
            const label = secao.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            secoesContainer.innerHTML += `
                <div class="col-md-4 mb-1">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${secao}" id="perm-check-${secao}" ${isChecked ? 'checked' : ''}>
                        <label class="form-check-label small" for="perm-check-${secao}">${label}</label>
                    </div>
                </div>
            `;
        });
    }

    // Popular setores
    const setorSelect = document.getElementById('perm-user-setor');
    setorSelect.innerHTML = '<option value="">Todos os setores</option>';
    const empresasSnap = await db.collection('empresas').get();
    const todosSetores = new Set();
    empresasSnap.forEach(empDoc => {
        const setores = empDoc.data().setores || [];
        setores.forEach(s => todosSetores.add(s));
    });
    todosSetores.forEach(setor => {
        setorSelect.innerHTML += `<option value="${setor}">${setor}</option>`;
    });
    setorSelect.value = permissoes.restricaoSetor || '';

    const modal = new bootstrap.Modal(document.getElementById('permissoesModal'));
    modal.show();
}

async function salvarPermissoes() {
    const uid = document.getElementById('perm-user-uid').value;
    const nome = document.getElementById('perm-user-nome').value;
    const isAdmin = document.getElementById('perm-is-admin').checked;
    const restricaoSetor = document.getElementById('perm-user-setor').value;

    const secoesPermitidas = [];
    document.querySelectorAll('#perm-secoes-container input[type="checkbox"]:checked').forEach(checkbox => {
        secoesPermitidas.push(checkbox.value);
    });

    try {
        await db.collection('usuarios').doc(uid).set({
            nome: nome,
            email: document.getElementById('perm-user-email').textContent, // Manter o email
            permissoes: {
                isAdmin: isAdmin,
                secoesPermitidas: secoesPermitidas,
                restricaoSetor: restricaoSetor || null
            }
        }, { merge: true });

        mostrarMensagem('Permissões salvas com sucesso!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('permissoesModal')).hide();
        await carregarUsuariosAdmin();
    } catch (error) {
        console.error("Erro ao salvar permissões:", error);
        mostrarMensagem('Erro ao salvar permissões.', 'error');
    }
}

function abrirModalNovoUsuario() {
    const modalEl = document.getElementById('novoUsuarioModal');
    if (!modalEl) {
        console.error("Modal de novo usuário não encontrado no HTML.");
        return;
    }

    document.getElementById('form-novo-usuario').reset();
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function salvarNovoUsuario() {
    const email = document.getElementById('novo-usuario-email').value;
    const senha = document.getElementById('novo-usuario-senha').value;
    const nome = document.getElementById('novo-usuario-nome').value;

    if (!email || !senha || !nome) {
        mostrarMensagem("Preencha todos os campos.", "warning");
        return;
    }

    if (senha.length < 6) {
        mostrarMensagem("A senha deve ter no mínimo 6 caracteres.", "warning");
        return;
    }

    try {
        // Cria o usuário no Firebase Authentication
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, senha);
        const user = userCredential.user;

        // Cria o documento do usuário no Firestore com permissões padrão
        await db.collection('usuarios').doc(user.uid).set({
            email: user.email,
            nome: nome,
            permissoes: {
                isAdmin: false,
                secoesPermitidas: ['dashboard'], // Acesso inicial apenas ao dashboard
                restricaoSetor: null
            }
        });

        mostrarMensagem("Usuário criado com sucesso! Edite as permissões conforme necessário.", "success");
        bootstrap.Modal.getInstance(document.getElementById('novoUsuarioModal')).hide();
        await carregarUsuariosAdmin(); // Atualiza a lista de usuários

    } catch (error) {
        console.error("Erro ao criar novo usuário:", error);
        if (error.code === 'auth/email-already-in-use') {
            mostrarMensagem("Este e-mail já está cadastrado no sistema.", "error");
        } else {
            mostrarMensagem(`Erro ao criar usuário: ${error.message}`, "error");
        }
    }
}

async function resetarSenhaUsuario(email) {
    if (!confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
        return;
    }

    try {
        await firebase.auth().sendPasswordResetEmail(email);
        mostrarMensagem(`E-mail de redefinição de senha enviado para ${email}.`, "success");
    } catch (error) {
        console.error("Erro ao enviar e-mail de reset de senha:", error);
        mostrarMensagem(`Erro ao enviar e-mail: ${error.message}`, "error");
    }
}

async function excluirUsuario(uid, email) {
    if (!confirm(`ATENÇÃO!\n\nTem certeza que deseja excluir o usuário ${email}?\n\nEsta ação removerá todos os acessos e permissões do usuário do sistema.`)) {
        return;
    }

    try {
        // No lado do cliente, não podemos excluir o usuário da Autenticação do Firebase.
        // A melhor abordagem é remover o registro do usuário do Firestore,
        // o que efetivamente remove todas as suas permissões e o acesso ao sistema.
        await db.collection('usuarios').doc(uid).delete();

        mostrarMensagem("Usuário removido do sistema com sucesso!", "success");
        await carregarUsuariosAdmin(); // Atualiza a lista

    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        mostrarMensagem(`Erro ao excluir usuário: ${error.message}`, "error");
    }
}