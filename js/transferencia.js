// let db; // Firebase Firestore
// let currentUserPermissions; // Permissões do usuário atual
// ========================================
// Módulo: Transferência de Funcionários
// Descrição: Gerencia a transferência de funcionários entre empresas.
// ========================================

// Utilitários compartilhados são providos por `js/utils.js`

async function inicializarTransferencia() {
    try {
        await carregarDadosParaTransferencia();
        configurarFormularioTransferencia();
    } catch (e) {
        console.error("Erro ao inicializar módulo de transferência:", e);
        mostrarMensagem("Erro ao carregar dados para transferência.", "error");
    }
}

async function carregarDadosParaTransferencia() {
    const funcSelect = document.getElementById('transf-funcionario');
    const destinoSelect = document.getElementById('transf-empresa-destino');

    funcSelect.innerHTML = '<option value="">Selecione um funcionário</option>';
    destinoSelect.innerHTML = '<option value="">Selecione a empresa de destino</option>';

    const [funcionariosSnap, empresasSnap] = await Promise.all([
        db.collection('funcionarios').where('status', '==', 'Ativo').orderBy('nome').get(),
        db.collection('empresas').orderBy('nome').get()
    ]);

    const funcionarios = funcionariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const empresas = empresasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    window.__transferencia_cache = { funcionarios, empresas };

    funcionarios.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.nome;
        funcSelect.appendChild(option);
    });

    empresas.forEach(e => {
        const option = document.createElement('option');
        option.value = e.id;
        option.textContent = e.nome;
        destinoSelect.appendChild(option);
    });
}

function configurarFormularioTransferencia() {
    const funcSelect = document.getElementById('transf-funcionario');
    const origemInput = document.getElementById('transf-empresa-origem');
    const destinoSelect = document.getElementById('transf-empresa-destino');
    const dataInput = document.getElementById('transf-data');

    dataInput.valueAsDate = new Date();

    funcSelect.onchange = () => {
        const funcId = funcSelect.value;
        if (!funcId) {
            origemInput.value = 'Selecione um funcionário';
            destinoSelect.value = '';
            return;
        }

        const { funcionarios, empresas } = window.__transferencia_cache;
        const func = funcionarios.find(f => f.id === funcId);
        const empresaOrigem = empresas.find(e => e.id === func.empresaId);

        origemInput.value = empresaOrigem ? empresaOrigem.nome : 'Empresa não encontrada';
        
        // Impede que a empresa de destino seja a mesma de origem
        Array.from(destinoSelect.options).forEach(opt => {
            opt.disabled = (opt.value === func.empresaId);
        });
    };
}

async function executarTransferencia() {
    const funcId = document.getElementById('transf-funcionario').value;
    const destinoId = document.getElementById('transf-empresa-destino').value;
    const dataTransferencia = document.getElementById('transf-data').value;

    if (!funcId || !destinoId || !dataTransferencia) {
        mostrarMensagem("Preencha todos os campos para realizar a transferência.", "warning");
        return;
    }

    const { funcionarios, empresas } = window.__transferencia_cache;
    const funcionario = funcionarios.find(f => f.id === funcId);
    const empresaOrigem = empresas.find(e => e.id === funcionario.empresaId);
    const empresaDestino = empresas.find(e => e.id === destinoId);

    if (funcionario.empresaId === destinoId) {
        mostrarMensagem("A empresa de destino não pode ser a mesma de origem.", "warning");
        return;
    }

    if (!confirm(`Confirma a transferência de ${funcionario.nome} da empresa ${empresaOrigem.nome} para ${empresaDestino.nome}?`)) {
        return;
    }

    try {
        // 1. Atualizar o cadastro do funcionário
        await db.collection('funcionarios').doc(funcId).update({
            empresaId: destinoId,
            setor: null, // O setor deve ser redefinido ou escolhido
            cargo: null, // O cargo pode precisar de reavaliação
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Gerar o termo de transferência
        gerarTermoDeTransferencia(funcionario, empresaOrigem, empresaDestino, dataTransferencia);

        // 3. Limpar formulário e recarregar dados
        document.getElementById('form-transferencia').reset();
        await carregarDadosParaTransferencia();

        mostrarMensagem("Transferência realizada com sucesso! O termo foi gerado.", "success");

    } catch (error) {
        console.error("Erro ao executar transferência:", error);
        mostrarMensagem("Falha ao executar a transferência.", "error");
    }
}

function gerarTermoDeTransferencia(funcionario, empresaOrigem, empresaDestino, dataTransferencia) {
    const dataContratoOriginal = funcionario.dataAdmissao ? formatarData(funcionario.dataAdmissao.toDate(), 'long') : '.....';
    const dataTransfFormatada = formatarData(new Date(dataTransferencia.replace(/-/g, '\/')), 'long');
    const hojeFormatado = formatarData(new Date(), 'long');

    const conteudo = `
        <html>
            <head><title>Termo Aditivo de Transferência</title><style>body{font-family: 'Times New Roman', Times, serif; margin: 2cm;} h1{text-align:center; font-size: 16px;} p{line-height: 2; text-align: justify; font-size: 14px;} .assinatura{margin-top: 60px; text-align: center;}</style></head>
            <body>
                <h1>TERMO ADITIVO AO CONTRATO DE TRABALHO CELEBRADO EM ${escapeHTML(dataContratoOriginal)}</h1>
                <p>Que entre si celebraram, de um lado <strong>${escapeHTML(empresaOrigem.nome || '......')}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${escapeHTML(empresaOrigem.cnpj || '......')}, com sede na ${escapeHTML(empresaOrigem.endereco || '......, nº ......, bairro ......, cidade de ......, estado do ......')}, neste ato denominado <strong>EMPREGADOR TRANSFERENTE</strong>, e <strong>${escapeHTML(empresaDestino.nome || '......')}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${escapeHTML(empresaDestino.cnpj || '......')}, com sede na ${escapeHTML(empresaDestino.endereco || '......, nº ......, bairro ......, cidade de ......, estado do ......')}, neste ato denominado <strong>NOVO EMPREGADOR</strong>, e de outro, <strong>${escapeHTML(funcionario.nome)}</strong>, inscrito no CPF sob o nº ${escapeHTML(funcionario.cpf)}, neste ato denominado <strong>EMPREGADO</strong>, mediante as seguintes condições:</p>
                <p><strong>CLÁUSULA PRIMEIRA:</strong> As partes formalizam a transferência do vínculo de contrato de emprego existente entre o empregado e o EMPREGADOR TRANSFERENTE para a transferência com o NOVO EMPREGADOR, conforme abaixo descrito:</p>
                <p><strong>Parágrafo Primeiro:</strong> A partir de ${dataTransfFormatada} haverá transferência do empregado junto ao Empregador transferente para o novo empregador.</p>
                <p><strong>Parágrafo Segundo:</strong> Em razão da transferência haverá alteração do local de trabalho do empregado, passando a ser no endereço: ${escapeHTML(empresaDestino.endereco || 'Rua:___________, nº__, Bairro:_____, no município de _____-__')}.</p>
                <p><strong>Parágrafo Terceiro:</strong> Considerando que a transferência de local de trabalho, não acarretará alteração de localidade, nem mudança de domicílio do empregado, indevido qualquer adicional de transferência ou algo do gênero.</p>
                <p><strong>Parágrafo Quarto:</strong> Referida transferência não afetará o contrato de trabalho e os direitos adquiridos pelo empregado.</p>
                <p><strong>CLÁUSULA SEGUNDA:</strong> Ficam ratificadas as demais cláusulas do contrato em questão, desde que não contrariem o que ficou convencionado no presente Termo Aditivo.</p>
                <p>E, por estarem assim, justos e acordados, firmam o presente Termo Aditivo ao Contrato de Trabalho, em 03 (três) vias de igual teor, para que produzam seus jurídicos e legais efeitos.</p>
                <p style="text-align: right;">Cidade, ${hojeFormatado}.</p>
                <div class="assinatura"><p>___________________________<br><strong>${escapeHTML(funcionario.nome)}</strong><br>EMPREGADO</p></div>
                <div style="display: flex; justify-content: space-around; margin-top: 60px;">
                    <div class="assinatura"><p>___________________________<br><strong>${escapeHTML(empresaOrigem.nome)}</strong><br>EMPREGADOR TRANSFERENTE</p></div>
                    <div class="assinatura"><p>___________________________<br><strong>${escapeHTML(empresaDestino.nome)}</strong><br>NOVO EMPREGADOR</p></div>
                </div>
            </body>
        </html>
    `;

    openPrintWindow(conteudo, { autoPrint: true, name: '_blank' });
}

function formatarData(data, formato = 'short') {
    if (!data) return '.....';
    const d = data instanceof Date ? data : data.toDate();
    if (formato === 'long') {
        return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('pt-BR');
}