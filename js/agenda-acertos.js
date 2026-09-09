/**
 * Módulo de Execução de Acertos Rescisórios e Agendamento de Exames
 */

let modalExecutarAcertoRef = null;
let acertoAtualId = null;
let acertoAtualDados = null;

// Intercepta a conclusão do evento na Agenda
async function abrirModalExecutarAcerto(id, dados) {
    acertoAtualId = id;
    acertoAtualDados = dados;
    
    // Injeta o modal no DOM se não existir
    if (!document.getElementById('modal-executar-acerto')) {
        try {
            const resp = await fetch('views/modal-executar-acerto.html');
            if (resp.ok) {
                const html = await resp.text();
                const div = document.createElement('div');
                div.innerHTML = html;
                document.body.appendChild(div);
            }
        } catch (e) {
            console.error("Erro ao carregar modal de acerto:", e);
            mostrarMensagem("Erro ao carregar módulo de acerto.", "error");
            return;
        }
    }

    // Resetar UI
    document.getElementById('area-mensagem-acerto').style.display = 'none';
    document.getElementById('footer-acoes-acerto').style.display = 'block';
    document.getElementById('footer-finalizado-acerto').style.display = 'none';
    document.getElementById('btn-confirmar-acerto').disabled = false;
    document.getElementById('acerto-data-modal').disabled = false;
    document.getElementById('acerto-hora-modal').disabled = false;
    document.getElementById('exame-data-modal').disabled = false;
    document.getElementById('exame-hora-modal').disabled = false;

    // Calcular datas
    // O `dados.data` é a data do acerto que já estava no card (geralmente os 8 dias úteis)
    let dataAcertoObj = null;
    if (dados.data && typeof dados.data.toDate === 'function') {
        dataAcertoObj = dados.data.toDate();
    } else if (dados.data) {
        dataAcertoObj = new Date(dados.data);
    } else {
        dataAcertoObj = new Date();
    }

    const dataAcertoIso = dataAcertoObj.toISOString().split('T')[0];
    document.getElementById('acerto-data-modal').value = dataAcertoIso;
    document.getElementById('acerto-hora-modal').value = "16:00";

    // Calcular data do Exame (Terça, Quarta ou Quinta, igual ou anterior à rescisão)
    let dataExameObj = new Date(dataAcertoIso + 'T12:00:00');
    let diaSemana = dataExameObj.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sab

    // Regra: "Puxar para o ÚLTIMO dia de exame válido ANTES da rescisão"
    if (diaSemana === 1) { // Segunda -> volta para Quinta (4 dias atrás)
        dataExameObj.setDate(dataExameObj.getDate() - 4);
    } else if (diaSemana === 5) { // Sexta -> volta para Quinta (1 dia atrás)
        dataExameObj.setDate(dataExameObj.getDate() - 1);
    } else if (diaSemana === 6) { // Sábado -> volta para Quinta (2 dias atrás)
        dataExameObj.setDate(dataExameObj.getDate() - 2);
    } else if (diaSemana === 0) { // Domingo -> volta para Quinta (3 dias atrás)
        dataExameObj.setDate(dataExameObj.getDate() - 3);
    }
    // Se for 2, 3 ou 4 (Ter, Qua, Qui), mantém o próprio dia!

    document.getElementById('exame-data-modal').value = dataExameObj.toISOString().split('T')[0];
    document.getElementById('exame-hora-modal').value = "07:00";

    // Mostrar modal
    if (!modalExecutarAcertoRef) {
        modalExecutarAcertoRef = new bootstrap.Modal(document.getElementById('modal-executar-acerto'));
    }
    modalExecutarAcertoRef.show();
}

async function confirmarExecucaoAcerto() {
    const btn = document.getElementById('btn-confirmar-acerto');
    const dataAcertoVal = document.getElementById('acerto-data-modal').value;
    const horaAcertoVal = document.getElementById('acerto-hora-modal').value;
    const dataExameVal = document.getElementById('exame-data-modal').value;
    const horaExameVal = document.getElementById('exame-hora-modal').value;

    if (!dataAcertoVal || !horaAcertoVal || !dataExameVal || !horaExameVal) {
        mostrarMensagem('Preencha todas as datas e horários.', 'warning');
        return;
    }

    const diaSemanaExame = new Date(dataExameVal + 'T12:00:00').getDay();
    if (diaSemanaExame !== 2 && diaSemanaExame !== 3 && diaSemanaExame !== 4) {
        if (!confirm('Atenção: A data escolhida para o exame não cai em uma Terça, Quarta ou Quinta-feira. Deseja prosseguir assim mesmo?')) {
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processando...';

    try {
        // 1. Buscar responsável pelo exame na configuração de fluxo
        let exameRespId = null;
        let exameRespNome = 'Responsável de Saúde Ocupacional';
        if (window.configFluxos) {
            exameRespId = await window.configFluxos.getConfiguracao('exameDemissionalId') || window.currentUser?.uid;
            exameRespNome = await window.configFluxos.getConfiguracao('exameDemissionalNome') || 'Responsável';
        }

        const funcNome = acertoAtualDados.funcionarioNome || 'Colaborador';
        const funcId = acertoAtualDados.funcionarioId || '';

        // Formatação para BR
        const dataExameBR = dataExameVal.split('-').reverse().join('/');
        const dataAcertoBR = dataAcertoVal.split('-').reverse().join('/');

        // 2. Gerar Tarefa de Exame Demissional
        const exameDescricao = `Exame Demissional de ${funcNome}. Acerto marcado para ${dataAcertoBR} às ${horaAcertoVal}.`;
        const dateObjExame = new Date(`${dataExameVal}T${horaExameVal}:00`);

        await db.collection('agenda_atividades').add({
            titulo: 'Exame Demissional - ' + funcNome,
            assunto: 'Exame Demissional - ' + funcNome,
            descricao: exameDescricao,
            tipo: 'Saúde Ocupacional',
            status: 'Pendente',
            data: firebase.firestore.Timestamp.fromDate(dateObjExame),
            cor: '#198754', // Success green
            criadoPor: window.currentUser?.uid || '',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            atribuidoParaId: exameRespId,
            atribuidoParaNome: exameRespNome,
            funcionarioId: funcId,
            funcionarioNome: funcNome,
            sourceCollection: 'exames_ocupacionais'
        });

        // 3. Atualizar e Concluir a Tarefa Original de Acerto
        const dateObjAcerto = new Date(`${dataAcertoVal}T${horaAcertoVal}:00`);
        const startTime = acertoAtualDados.executionStartTime || acertoAtualDados.criadoEm;
        
        await db.collection('agenda_atividades').doc(acertoAtualId).update({
            status: 'Concluído',
            concluidoEm: firebase.firestore.FieldValue.serverTimestamp(),
            tempoResolucao: calcularTempoResolucao(startTime),
            dataAgendadaExame: firebase.firestore.Timestamp.fromDate(dateObjExame),
            dataAgendadaAcerto: firebase.firestore.Timestamp.fromDate(dateObjAcerto)
        });

        // 4. Gerar Texto Final
        const texto = `DOCUMENTOS PARA A RESCISÃO:

Favor Comparecer no dia ${dataExameBR}, às ${horaExameVal}, na clinica ControlSegue, Rua professor Souza Araujo Nº 633, próximo a Auto escola futura, em Imbituva-PR, para a realização e exames Médicos demissionais.

A Rescisão está agendada para dia ${dataAcertoBR} às ${horaAcertoVal}.
Favor trazer os uniformes que foram utilizados e chaves de armários.`;

        // Travar inputs e mostrar resultado (botão de imprimir)
        document.getElementById('area-mensagem-acerto').style.display = 'block';
        document.getElementById('footer-acoes-acerto').style.display = 'none';
        document.getElementById('footer-finalizado-acerto').style.display = 'block';

        document.getElementById('acerto-data-modal').disabled = true;
        document.getElementById('acerto-hora-modal').disabled = true;
        document.getElementById('exame-data-modal').disabled = true;
        document.getElementById('exame-hora-modal').disabled = true;

        mostrarMensagem('Acerto concluído e exame agendado com sucesso!', 'success');

    } catch (e) {
        console.error("Erro ao concluir acerto e agendar exame:", e);
        mostrarMensagem('Ocorreu um erro ao processar. Tente novamente.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-1"></i> Confirmar Agendamento e Gerar Mensagem';
    }
}

// Função copiarMensagemAcerto removida conforme solicitação.

function fecharModalAcertoComSucesso() {
    if (modalExecutarAcertoRef) modalExecutarAcertoRef.hide();
    if (typeof carregarAgenda === 'function') {
        carregarAgenda();
    }
}

async function imprimirCartaExame() {
    const dataAcertoVal = document.getElementById('acerto-data-modal').value;
    const horaAcertoVal = document.getElementById('acerto-hora-modal').value;
    const dataExameVal = document.getElementById('exame-data-modal').value;
    const horaExameVal = document.getElementById('exame-hora-modal').value;
    const isPedidoDemissao = document.getElementById('check-pedido-demissao')?.checked || false;

    const dataExameBR = dataExameVal.split('-').reverse().join('/');
    const dataAcertoBR = dataAcertoVal.split('-').reverse().join('/');
    const funcNome = acertoAtualDados?.funcionarioNome || 'Colaborador';
    const funcId = acertoAtualDados?.funcionarioId || null;

    // Abra a janela de forma síncrona para evitar bloqueadores de pop-up
    const janelaPrint = window.open('', '_blank', 'width=800,height=600');
    janelaPrint.document.write('Carregando informações para impressão...');

    // Buscar dados do colaborador
    let funcCpf = '[CPF NÃO ENCONTRADO]';
    let funcCargo = '[CARGO NÃO ENCONTRADO]';
    let empresaNome = '[NOME DA EMPRESA]';
    let cidadeUF = 'Imbituva/PR';

    // Helper para formatar CPF
    const formatarCPF = (cpf) => {
        const p = cpf.replace(/\D/g, '');
        if (p.length === 11) return p.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return cpf;
    };

    if (funcId) {
        try {
            const docFunc = await db.collection('funcionarios').doc(funcId).get();
            if (docFunc.exists) {
                const dadosFunc = docFunc.data();
                if (dadosFunc.cpf) funcCpf = formatarCPF(dadosFunc.cpf);
                if (dadosFunc.cargo) funcCargo = dadosFunc.cargo;
                
                if (dadosFunc.empresaId) {
                    const docEmp = await db.collection('empresas').doc(dadosFunc.empresaId).get();
                    if (docEmp.exists && docEmp.data().nomeFantasia) {
                        empresaNome = docEmp.data().nomeFantasia;
                    }
                }
            }
        } catch (e) {
            console.error("Erro ao buscar dados do funcionário para impressão:", e);
        }
    }

    const logoUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'assets/LOGO.png';
    
    // Usando CSS limpo e profissional
    const docHTML = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Encaminhamento - Exame Demissional</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 40px;
                color: #333;
                line-height: 1.6;
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #2c3e50;
                padding-bottom: 20px;
                margin-bottom: 40px;
            }
            .header img {
                max-height: 80px;
                margin-bottom: 10px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                color: #2c3e50;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .content {
                font-size: 16px;
                text-align: justify;
            }
            .highlight-box {
                background-color: #f8f9fa;
                border-left: 4px solid #e74c3c;
                padding: 20px;
                margin: 30px 0;
                border-radius: 4px;
            }
            .highlight-box p {
                margin: 5px 0;
            }
            .signature-box {
                display: flex;
                justify-content: space-between;
                margin-top: 60px;
                text-align: center;
                gap: 40px;
            }
            .signature {
                flex: 1;
                text-align: center;
            }
            .signature-line {
                width: 100%;
                max-width: 300px;
                border-top: 1px solid #333;
                margin: 0 auto 10px auto;
            }
            .footer {
                margin-top: 60px;
                font-size: 12px;
                text-align: center;
                color: #7f8c8d;
                border-top: 1px solid #eee;
                padding-top: 10px;
            }
            .page-break {
                page-break-before: always;
            }
            @media print {
                @page { 
                    margin: 0; 
                    size: auto; 
                }
                body { padding: 2cm; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: right; margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #2c3e50; color: white; border: none; cursor: pointer; border-radius: 4px;">Imprimir</button>
        </div>

        <div class="header">
            <img src="${logoUrl}" alt="Logo da Empresa">
        </div>

        <div class="content">
            <p><strong>Ao(a) Sr(a). ${funcNome}</strong>,</p>

            <p>Vimos por meio desta carta informar os agendamentos obrigatórios referentes ao seu processo de desligamento.</p>

            <div class="highlight-box">
                <h3 style="margin-top:0; color: #c0392b;">DOCUMENTOS PARA A RESCISÃO</h3>
                
                <p><strong>1. Exame Médico Demissional</strong></p>
                <p>Favor comparecer no dia <strong>${dataExameBR}</strong>, às <strong>${horaExameVal}</strong>, na clínica <strong>ControlSegue</strong>, localizada na Rua Professor Souza Araujo Nº 633 (próximo à Auto Escola Futura), em Imbituva-PR, para a realização do exame.</p>
                <br>
                <p><strong>2. Acerto Rescisório (Assinaturas)</strong></p>
                <p>A assinatura da sua rescisão está agendada para o dia <strong>${dataAcertoBR}</strong>, às <strong>${horaAcertoVal}</strong>.</p>
            </div>

            <p><strong>ATENÇÃO:</strong> Favor trazer todos os uniformes que foram utilizados durante o seu período na empresa, bem como eventuais chaves de armários ou crachás em sua posse.</p>

            <div class="signature">
                <div class="signature-line"></div>
                <p><strong>Recursos Humanos</strong><br>Departamento Pessoal</p>
            </div>
        </div>

        ${isPedidoDemissao ? `
        <div class="page-break"></div>
        <div class="header" style="margin-top: 20px;">
            <img src="${logoUrl}" alt="Logo da Empresa">
            <h1>PEDIDO DE DEMISSÃO</h1>
        </div>
        <div class="content">
            <p><strong>À empresa:</strong> ${empresaNome}</p>

            <p>Eu, <strong>${funcNome}</strong>, inscrito(a) no CPF sob nº <strong>${funcCpf}</strong>, ocupante do cargo de <strong>${funcCargo}</strong>, venho, por meio deste, apresentar formalmente meu <strong>pedido de demissão</strong>, por minha livre e espontânea vontade.</p>

            <p>Solicito o encerramento do meu contrato de trabalho, estando ciente das condições legais aplicáveis à rescisão contratual e das verbas e descontos decorrentes do desligamento.</p>

            <div style="margin: 30px 0;">
                <p><strong>[ &nbsp; ] Solicito a dispensa do cumprimento do aviso-prévio.</strong></p>
                <p><strong>[ &nbsp; ] Cumprirei o aviso-prévio conforme previsto na legislação trabalhista.</strong></p>
                <p><strong>[ &nbsp; ] Informo que não cumprirei o aviso-prévio, estando ciente dos descontos legais eventualmente aplicáveis.</strong></p>
            </div>

            <p>Declaro, ainda, que esta solicitação é realizada de forma voluntária e consciente.</p>

            <p><strong>Local:</strong> ${cidadeUF}</p>
            <p><strong>Data:</strong> ${dataAcertoBR}</p>

            <div class="signature" style="margin-top: 60px;">
                <div class="signature-line"></div>
                <p><strong>${funcNome}</strong><br>CPF: ${funcCpf}</p>
            </div>
        </div>

        <div class="page-break"></div>
        <div class="header" style="margin-top: 20px;">
            <img src="${logoUrl}" alt="Logo da Empresa">
            <h1>CIÊNCIA DA EMPRESA</h1>
        </div>
        <div class="content" style="padding-top: 20px; text-align: center;">
            <p style="font-size: 18px; margin-bottom: 50px;">Recebemos o presente pedido de demissão assinado pelo(a) colaborador(a) <strong>${funcNome}</strong> em <strong>${dataAcertoBR}</strong>.</p>
            
            <div class="signature" style="margin-top: 80px; width: 400px; margin-left: auto; margin-right: auto;">
                <div class="signature-line" style="width: 100%;"></div>
                <p><strong>Representante da empresa</strong><br>Nome: _______________________<br>Cargo: _______________________</p>
            </div>
        </div>
        ` : ''}

        <div class="footer">
            Documento gerado automaticamente pelo sistema de RH em ${new Date().toLocaleDateString('pt-BR')}.
        </div>

        <script>
            // Abre o painel de impressão automaticamente logo após carregar a janela
            setTimeout(() => { window.print(); }, 800);
        </script>
    </body>
    </html>
    `;

    janelaPrint.document.open();
    janelaPrint.document.write(docHTML);
    janelaPrint.document.close();
}
