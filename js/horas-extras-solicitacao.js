// Painel de Solicitação de Horas - gerente solicita, aprovador aprova/ajusta

/**
 * Calcula o número de domingos e feriados em um determinado mês e ano.
 * Reutilizado da tela de lançamento para padronizar o cálculo de DSR.
 * @param {number} year - O ano.
 * @param {number} month - O mês (0-11).
 * @returns {number} - O número de dias não úteis (domingos + feriados).
 */
function getDiasNaoUteis(year, month) {
    const feriadosFixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
    let diasNaoUteis = 0;
    const diasNoMes = new Date(year, month + 1, 0).getDate();
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = new Date(year, month, dia);
        if (data.getDay() === 0 || feriadosFixos.includes(`${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)) diasNaoUteis++;
    }
    return diasNaoUteis;
}

async function inicializarSolicitacaoHoras() {
    // placeholder para inicialização futura (registro em sectionInitializers)
    console.log('Módulo de Solicitação de Horas inicializado');
}

// Renderiza as solicitações do usuário atual na seção 'dp-horas-solicitacao'
async function renderMinhasSolicitacoes() {
  const container = document.getElementById('minhas-solicitacoes-container');
  if (!container) return;
  container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando suas solicitações...</div>';

  try {
    const user = firebase.auth().currentUser;
    if (!user) { container.innerHTML = '<p class="text-muted">Faça login para ver suas solicitações.</p>'; return; }

    const snap = await db.collection('solicitacoes_horas').where('createdByUid','==',user.uid).orderBy('createdAt','desc').limit(50).get();
    if (snap.empty) { container.innerHTML = '<p class="text-muted">Você não possui solicitações recentes.</p>'; return; }

    let html = '<table class="table table-sm"><thead><tr><th>Data</th><th>Início</th><th>Fim</th><th>Min</th><th>Valor Est.</th><th>Status</th><th></th></tr></thead><tbody>';
    for (const doc of snap.docs) {
      const s = doc.data();
      // CORREÇÃO: Garante que 'start' e 'end' sejam objetos Date válidos.
      const created = s.createdAt && s.createdAt.toDate ? formatarData(s.createdAt.toDate()) : '—';
      const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
      const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
      const inicio = formatarData(start) + ' ' + start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      const fim = formatarData(end) + ' ' + end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      const minutes = Math.round((end - start) / (1000*60));

      // calcular valor estimado usando salário do funcionário (se disponível)
      let valorEst = 0;
      try {
        const funcDoc = await db.collection('funcionarios').doc(s.employeeId).get();
        if (funcDoc.exists) {
          const salario = parseFloat(funcDoc.data().salario || 0);
          const hourlyRate = salario / 220;
          const overtimeRate = hourlyRate * 1.5; // assumimos 50% por padrão nas solicitações
          const hoursDisplayFormat = parseFloat((minutes / 60).toFixed(2)); // Formato decimal padrão
          const overtimePay = overtimeRate * hoursDisplayFormat;
          
          // **CÁLCULO CORRIGIDO E PADRONIZADO**
          const dataLancamento = start;
          const diasNoMes = new Date(dataLancamento.getFullYear(), dataLancamento.getMonth() + 1, 0).getDate();
          const diasNaoUteis = getDiasNaoUteis(dataLancamento.getFullYear(), dataLancamento.getMonth());
          const diasUteis = diasNoMes - diasNaoUteis;
          const dsr = diasUteis > 0 ? (overtimePay / diasUteis) * diasNaoUteis : 0;

          valorEst = parseFloat((overtimePay + dsr).toFixed(2));
        }
      } catch (err) {
        console.error('Erro ao calcular valor estimado:', err);
      }

      html += `<tr><td>${created}</td><td>${inicio}</td><td>${fim}</td><td>${minutes}</td><td>R$ ${valorEst.toFixed(2)}</td><td>${s.status}</td><td class="text-end">`;
      if (s.status === 'pendente') {
        html += `<button class="btn btn-sm btn-primary" onclick="abrirModalAjusteSolicitacao('${doc.id}')" title="Editar"><i class="fas fa-edit"></i></button> `;
        html += `<button class="btn btn-sm btn-warning" onclick="rejeitarSolicitacao('${doc.id}')" title="Cancelar Solicitação"><i class="fas fa-times-circle"></i></button> `;
        html += `<button class="btn btn-sm btn-danger" onclick="excluirSolicitacao('${doc.id}')" title="Excluir Permanentemente"><i class="fas fa-trash"></i></button>`;
      }
      html += `</td></tr>`
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    console.error('Erro ao carregar minhas solicitações:', err);
    container.innerHTML = '<div class="alert alert-danger">Erro ao carregar suas solicitações.</div>';
  }
}

// Renderiza o dashboard de autorização (Controladoria)
async function renderAutorizacaoDashboard() {
  const totalSolicitadoEl = document.getElementById('auth-total-solicitado');
  const totalAprovadoEl = document.getElementById('auth-total-aprovado');
  const diferencaEl = document.getElementById('auth-diferenca');
  const tableContainer = document.getElementById('auth-solicitacoes-table');
  const chartContainer = document.getElementById('auth-chart-container');

  if (!totalSolicitadoEl || !totalAprovadoEl || !diferencaEl || !tableContainer || !chartContainer) return;

  totalSolicitadoEl.textContent = 'Carregando...';
  totalAprovadoEl.textContent = 'Carregando...';
  diferencaEl.textContent = 'Carregando...';
  tableContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
  chartContainer.innerHTML = '';

  try {
    // Limitar período para 30 dias para dashboard
    const now = new Date();
    const since = new Date(); since.setDate(now.getDate() - 30);

    const snap = await db.collection('solicitacoes_horas').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(since)).orderBy('createdAt','desc').get();

    let totalSolicitado = 0;
    let totalAprovado = 0;
    const rows = [];

    for (const doc of snap.docs) {
      const s = doc.data();
      // CORREÇÃO: Garante que 'start' e 'end' sejam objetos Date válidos.
      const start = s.start?.toDate ? s.start.toDate() : new Date(s.start);
      const end = s.end?.toDate ? s.end.toDate() : new Date(s.end);
      const minutes = Math.round((end - start) / (1000*60));

      // obter salario do funcionario
      let valorEst = 0;
      try {
        const funcDoc = await db.collection('funcionarios').doc(s.employeeId).get();
        if (funcDoc.exists) {
          const salario = parseFloat(funcDoc.data().salario || 0);
          const hourlyRate = salario / 220;
          const overtimeRate = hourlyRate * 1.5; // Assumindo 50% para estimativa
          const hoursDisplayFormat = parseFloat((minutes / 60).toFixed(2)); // Formato decimal padrão
          const overtimePay = overtimeRate * hoursDisplayFormat;

          // **CÁLCULO CORRIGIDO E PADRONIZADO**
          const dataLancamento = start;
          const diasNoMes = new Date(dataLancamento.getFullYear(), dataLancamento.getMonth() + 1, 0).getDate();
          const diasNaoUteis = getDiasNaoUteis(dataLancamento.getFullYear(), dataLancamento.getMonth());
          const diasUteis = diasNoMes - diasNaoUteis;
          const dsr = diasUteis > 0 ? (overtimePay / diasUteis) * diasNaoUteis : 0;

          valorEst = parseFloat((overtimePay + dsr).toFixed(2));
        }
      } catch (err) {
        console.error('Erro ao calcular valor estimado (dashboard):', err);
      }

      totalSolicitado += valorEst;
      if (s.status === 'aprovado') totalAprovado += valorEst;

      rows.push({ id: doc.id, createdAt: s.createdAt, employeeName: s.employeeName, start, end, minutes, valorEst, status: s.status });
    }

    totalSolicitadoEl.textContent = `R$ ${totalSolicitado.toFixed(2)}`;
    totalAprovadoEl.textContent = `R$ ${totalAprovado.toFixed(2)}`;
    diferencaEl.textContent = `R$ ${(totalSolicitado - totalAprovado).toFixed(2)}`;

    // Tabela simples
    if (rows.length === 0) {
      tableContainer.innerHTML = '<p class="text-muted">Nenhuma solicitação no período.</p>';
    } else {
      let html = '<table class="table table-hover table-sm"><thead><tr><th>Data</th><th>Funcionário</th><th>Minutos</th><th>Valor Est.</th><th>Status</th><th class="text-end">Ações</th></tr></thead><tbody>';
      rows.slice(0,50).forEach(r => {
        const created = r.createdAt && r.createdAt.toDate ? formatarData(r.createdAt.toDate()) : '—';
        html += `
            <tr>
                <td>${created}</td>
                <td>${r.employeeName}</td>
                <td>${r.minutes}</td>
                <td>R$ ${r.valorEst.toFixed(2)}</td>
                <td><span class="badge bg-warning text-dark">${r.status}</span></td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">${getAcoesParaSolicitacao(r)}</div>
                </td>
            </tr>`;
      });
      html += '</tbody></table>';
      tableContainer.innerHTML = html;
    }

    // Gráfico simplificado: barras solicitadas vs aprovadas por dia
    // Preparar dados por dia
    const byDay = {};
    rows.forEach(r => {
      const d = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
      const key = d.toISOString().split('T')[0];
      if (!byDay[key]) byDay[key] = { solicitado: 0, aprovado: 0 };
      byDay[key].solicitado += r.valorEst;
      if (r.status === 'aprovado') byDay[key].aprovado += r.valorEst;
    });

    const labels = Object.keys(byDay).sort();
    const solicitadosData = labels.map(l => byDay[l].solicitado);
    const aprovadosData = labels.map(l => byDay[l].aprovado);

    // Renderizar gráfico com Chart.js se disponível, senão fallback
    if (typeof Chart !== 'undefined') {
      chartContainer.innerHTML = '<canvas id="authChartCanvas"></canvas>';
      const ctx = document.getElementById('authChartCanvas').getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Solicitado (R$)', data: solicitadosData, backgroundColor: 'rgba(54,162,235,0.6)' },
            { label: 'Aprovado (R$)', data: aprovadosData, backgroundColor: 'rgba(75,192,192,0.6)' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } else {
      chartContainer.innerHTML = '<p class="text-muted">Instale Chart.js para visualizar o gráfico.</p>';
    }

  } catch (err) {
    console.error('Erro ao renderizar dashboard de autorização:', err);
    totalSolicitadoEl.textContent = 'Erro';
    totalAprovadoEl.textContent = 'Erro';
    diferencaEl.textContent = 'Erro';
    tableContainer.innerHTML = '<div class="alert alert-danger">Erro ao carregar dados.</div>';
    chartContainer.innerHTML = '';
  }
}

function getAcoesParaSolicitacao(solicitacao) {
    let acoes = `<button class="btn btn-outline-secondary" onclick="imprimirSolicitacao('${solicitacao.id}')" title="Imprimir"><i class="fas fa-print"></i></button>`;
    if (solicitacao.status === 'pendente') {
        acoes += `
            <button class="btn btn-outline-success" onclick="aprovarSolicitacao('${solicitacao.id}')" title="Aprovar"><i class="fas fa-check"></i></button>
            <button class="btn btn-outline-primary" onclick="abrirModalAjusteSolicitacao('${solicitacao.id}')" title="Editar/Ajustar"><i class="fas fa-edit"></i></button>
            <button class="btn btn-outline-danger" onclick="rejeitarSolicitacao('${solicitacao.id}')" title="Rejeitar"><i class="fas fa-times"></i></button>
            <button class="btn btn-danger" onclick="excluirSolicitacao('${solicitacao.id}')" title="Excluir Permanentemente"><i class="fas fa-trash"></i></button>
        `;
    } else {
        // Ação de reverter ou visualizar para outros status
        acoes += `<button class="btn btn-outline-info" onclick="abrirModalAjusteSolicitacao('${solicitacao.id}', true)" title="Visualizar"><i class="fas fa-eye"></i></button>`;
    }
    return acoes;
}

async function abrirModalSolicitacaoHoras() {
    // Cria modal dinâmico para o gerente solicitar horas
    const modalId = 'solicitacaoHorasModal';
    if (document.getElementById(modalId)) {
        const existing = document.getElementById(modalId);
        const modal = bootstrap.Modal.getOrCreateInstance(existing);
        modal.show();
        return;
    }

    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Solicitação de Horas - Gerente</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="form-solicitacao-horas">
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Funcionário</label>
                <select id="sol-employee" class="form-select"></select>
              </div>
              <div class="col-md-3"><label class="form-label">Data Início</label><input type="date" id="sol-start-date" class="form-control" required></div>
              <div class="col-md-3"><label class="form-label">Hora Início</label><input type="time" id="sol-start-time" class="form-control" required></div>
              <div class="col-md-3"><label class="form-label">Data Fim</label><input type="date" id="sol-end-date" class="form-control" required></div>
              <div class="col-md-3"><label class="form-label">Hora Fim</label><input type="time" id="sol-end-time" class="form-control" required></div>
              <div class="col-12"><label class="form-label">Motivo / Observações</label><textarea id="sol-reason" class="form-control" rows="3"></textarea></div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Solicitação</button>
          </div>
          </form>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // popular lista de funcionários
    const select = document.getElementById('sol-employee');
    select.innerHTML = '<option value="">Carregando...</option>';
    try {
        const snapshot = await db.collection('funcionarios').where('status','==','Ativo').orderBy('nome').get();
        select.innerHTML = '<option value="">Selecione um funcionário</option>';
        snapshot.forEach(doc => {
            const f = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = f.nome;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Erro ao carregar funcionários para solicitacao:', err);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    // configurar submissão
    const form = document.getElementById('form-solicitacao-horas');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarSolicitacaoHoras();
    });

    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
}

async function salvarSolicitacaoHoras() {
    const employeeId = document.getElementById('sol-employee').value;
    const startDate = document.getElementById('sol-start-date').value;
    const startTime = document.getElementById('sol-start-time').value;
    const endDate = document.getElementById('sol-end-date').value;
    const endTime = document.getElementById('sol-end-time').value;
    const reason = document.getElementById('sol-reason').value;

    // Validação mais robusta para garantir que as datas e horas não estão apenas presentes, mas são válidas.
    if (!employeeId || !startDate || !startTime || !endDate || !endTime || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}$/.test(startTime)) {
        mostrarMensagem('Preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    try {
        // Cria os objetos Date de forma segura, evitando "Invalid Date"
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);

        // Verifica se as datas criadas são válidas
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            mostrarMensagem('Data ou hora inválida. Verifique os valores inseridos.', 'error');
            console.error('Tentativa de salvar com data inválida:', { startDate, startTime, endDate, endTime });
            return;
        }

        const user = firebase.auth().currentUser;

        // obter nome do funcionário para facilitar leitura
        const funcDoc = await db.collection('funcionarios').doc(employeeId).get();
        const employeeName = funcDoc.exists ? funcDoc.data().nome : '';

        const data = {
            employeeId,
            employeeName,
            start: start,
            end: end,
            reason: reason || null,
            status: 'pendente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdByUid: user ? user.uid : null
        };

        await db.collection('solicitacoes_horas').add(data);
        mostrarMensagem('Solicitação salva com sucesso!', 'success');

        const modal = bootstrap.Modal.getInstance(document.getElementById('solicitacaoHorasModal'));
        modal.hide();

    } catch (err) {
        console.error('Erro ao salvar solicitação de horas:', err);
        mostrarMensagem('Falha ao salvar solicitação.', 'error');
    }
}

async function carregarSolicitacoesPendentes() {
    // Abre modal com lista de solicitações pendentes para aprovação/ajuste
    const modalId = 'solicitacoesPendentesModal';
    if (document.getElementById(modalId)) {
        const existing = document.getElementById(modalId);
        const modal = bootstrap.Modal.getOrCreateInstance(existing);
        modal.show();
        await atualizarTabelaSolicitacoes(modalId);
        return;
    }

    const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Solicitações de Horas - Pendentes</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div id="solicitacoes-pendentes-container">Carregando...</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
          </div>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
    await atualizarTabelaSolicitacoes(modalId);
}

async function atualizarTabelaSolicitacoes(modalId) {
    const container = document.getElementById('solicitacoes-pendentes-container');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    try {
        const snap = await db.collection('solicitacoes_horas').where('status','==','pendente').orderBy('createdAt','desc').get();
        if (snap.empty) {
            container.innerHTML = '<p class="text-muted">Nenhuma solicitação pendente.</p>';
            return;
        }

        let html = '<table class="table table-sm"><thead><tr><th>Data</th><th>Funcionário</th><th>Início</th><th>Fim</th><th>Motivo</th><th class="text-end">Ações</th></tr></thead><tbody>';
        snap.forEach(doc => {
            const s = doc.data();
            const created = s.createdAt && s.createdAt.toDate ? formatarData(s.createdAt.toDate()) : '—';
            const inicio = s.start && s.start.toDate ? formatarData(s.start.toDate()) + ' ' + (new Date(s.start.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})) : '—';
            const fim = s.end && s.end.toDate ? formatarData(s.end.toDate()) + ' ' + (new Date(s.end.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})) : '—';
            html += `<tr>
                <td>${created}</td>
                <td>${s.employeeName || 'N/A'}</td>
                <td>${inicio}</td>
                <td>${fim}</td>
                <td>${s.reason || ''}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-success" onclick="aprovarSolicitacao('${doc.id}')">Aprovar</button>
                        <button class="btn btn-primary" onclick="abrirModalAjusteSolicitacao('${doc.id}')">Ajustar</button>
                        <button class="btn btn-danger" onclick="rejeitarSolicitacao('${doc.id}')">Rejeitar</button>
                    </div>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Erro ao carregar solicitações pendentes:', err);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar solicitações.</div>';
    }
}

async function aprovarSolicitacao(id) {
    if (!confirm('Aprovar esta solicitação?')) return;
    try {
        await db.collection('solicitacoes_horas').doc(id).update({
            status: 'aprovado',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedByUid: firebase.auth().currentUser?.uid || null
        });
        mostrarMensagem('Solicitação aprovada.', 'success');
        // atualizar lista se modal aberto
        if (document.getElementById('solicitacoesPendentesModal')) await atualizarTabelaSolicitacoes('solicitacoesPendentesModal');
    } catch (err) {
        console.error('Erro ao aprovar solicitação:', err);
        mostrarMensagem('Falha ao aprovar solicitação.', 'error');
    }
}

async function rejeitarSolicitacao(id) {
    const motivo = prompt('Motivo da rejeição (opcional):');
    if (motivo === null) return; // cancel
    try {
        await db.collection('solicitacoes_horas').doc(id).update({
            status: 'rejeitado',
            rejectionReason: motivo || null,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectedByUid: firebase.auth().currentUser?.uid || null
        });
        mostrarMensagem('Solicitação rejeitada.', 'success');
        if (document.getElementById('solicitacoesPendentesModal')) await atualizarTabelaSolicitacoes('solicitacoesPendentesModal');
    } catch (err) {
        console.error('Erro ao rejeitar solicitação:', err);
        mostrarMensagem('Falha ao rejeitar solicitação.', 'error');
    }
}

async function abrirModalAjusteSolicitacao(id, readOnly = false) {
    // Abre modal de edição simples para ajustar intervalo/motivo
    try {
        const doc = await db.collection('solicitacoes_horas').doc(id).get();
        if (!doc.exists) { mostrarMensagem('Solicitação não encontrada.', 'error'); return; }
        const s = doc.data();

        const modalId = 'ajusteSolicitacaoModal';
        if (document.getElementById(modalId)) document.getElementById(modalId).remove();

        const html = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white"><h5 class="modal-title">${readOnly ? 'Visualizar' : 'Ajustar'} Solicitação</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
              <form id="form-ajuste-solicitacao">
              <div class="modal-body">
                <div class="alert alert-info"><strong>Funcionário:</strong> ${s.employeeName || 'N/A'}</div>
                <div class="row g-3">
                  <div class="col-md-6"><label class="form-label">Data Início</label><input type="date" id="adj-start-date" class="form-control" required ${readOnly ? 'disabled' : ''}></div>
                  <div class="col-md-6"><label class="form-label">Hora Início</label><input type="time" id="adj-start-time" class="form-control" required ${readOnly ? 'disabled' : ''}></div>
                  <div class="col-md-6"><label class="form-label">Data Fim</label><input type="date" id="adj-end-date" class="form-control" required ${readOnly ? 'disabled' : ''}></div>
                  <div class="col-md-6"><label class="form-label">Hora Fim</label><input type="time" id="adj-end-time" class="form-control" required ${readOnly ? 'disabled' : ''}></div>
                </div>
                <div class="mt-3"><label class="form-label">Motivo</label><textarea id="adj-reason" class="form-control" rows="3" ${readOnly ? 'disabled' : ''}></textarea></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                ${!readOnly ? '<button type="submit" class="btn btn-primary">Salvar Ajuste</button>' : ''}
              </div>
              </form>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);

        // preenche campos
        const start = s.start && s.start.toDate ? s.start.toDate() : new Date(s.start || Date.now());
        const end = s.end && s.end.toDate ? s.end.toDate() : new Date(s.end || Date.now());
        document.getElementById('adj-start-date').value = start.toISOString().split('T')[0];
        document.getElementById('adj-start-time').value = start.toTimeString().slice(0,5);
        document.getElementById('adj-end-date').value = end.toISOString().split('T')[0];
        document.getElementById('adj-end-time').value = end.toTimeString().slice(0,5);
        document.getElementById('adj-reason').value = s.reason || '';

        const form = document.getElementById('form-ajuste-solicitacao');
        if (!readOnly) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                try {
                    const st = new Date(document.getElementById('adj-start-date').value + 'T' + document.getElementById('adj-start-time').value + ':00');
                    const ed = new Date(document.getElementById('adj-end-date').value + 'T' + document.getElementById('adj-end-time').value + ':00');
                    const reason = document.getElementById('adj-reason').value;
                    await db.collection('solicitacoes_horas').doc(id).update({
                        start: st,
                        end: ed,
                        reason: reason || null,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedByUid: firebase.auth().currentUser?.uid || null
                    });
                    mostrarMensagem('Ajuste salvo.', 'success');
                    bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
                    if (document.getElementById('control-horas-autorizacao').offsetParent !== null) await renderAutorizacaoDashboard();
                } catch (err) {
                    console.error('Erro ao salvar ajuste:', err);
                    mostrarMensagem('Falha ao salvar ajuste.', 'error');
                }
            };
        }

        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();

      } catch (err) {
        console.error('Erro ao abrir ajuste:', err);
        mostrarMensagem('Falha ao abrir ajuste.', 'error');
      }
}

async function excluirSolicitacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta solicitação permanentemente? Esta ação não pode ser desfeita.')) return;
    try {
        await db.collection('solicitacoes_horas').doc(id).delete();
        mostrarMensagem('Solicitação excluída com sucesso.', 'success');
        // Recarrega a view correta
        const solicitacaoSection = document.getElementById('dp-horas-solicitacao');
        const autorizacaoSection = document.getElementById('control-horas-autorizacao');
        if (solicitacaoSection && !solicitacaoSection.classList.contains('d-none')) {
            await renderMinhasSolicitacoes();
        }
        if (autorizacaoSection && !autorizacaoSection.classList.contains('d-none')) {
            await renderAutorizacaoDashboard();
        }
    } catch (err) {
        console.error('Erro ao excluir solicitação:', err);
        mostrarMensagem('Falha ao excluir a solicitação.', 'error');
    }
}

async function imprimirSolicitacao(id) {
    try {
        const doc = await db.collection('solicitacoes_horas').doc(id).get();
        if (!doc.exists) {
            mostrarMensagem("Solicitação não encontrada.", "error");
            return;
        }
        const s = doc.data();
        const start = s.start.toDate();
        const end = s.end.toDate();
        const minutes = Math.round((end - start) / (1000 * 60));

        const conteudo = `
            <html>
                <head>
                    <title>Solicitação de Horas Extras</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>body { padding: 2rem; } .header { text-align: center; margin-bottom: 2rem; }</style>
                </head>
                <body>
                    <div class="header"><h2>Solicitação de Horas Extras</h2></div>
                    <p><strong>Funcionário:</strong> ${s.employeeName}</p>
                    <p><strong>Data da Solicitação:</strong> ${s.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                    <hr>
                    <p><strong>Período Solicitado:</strong> de ${start.toLocaleString('pt-BR')} até ${end.toLocaleString('pt-BR')}</p>
                    <p><strong>Total de Minutos:</strong> ${minutes}</p>
                    <p><strong>Motivo:</strong> ${s.reason || 'Não informado'}</p>
                    <p><strong>Status:</strong> ${s.status}</p>
                </body>
            </html>
        `;
        openPrintWindow(conteudo, { autoPrint: true });
    } catch (error) {
        console.error("Erro ao imprimir solicitação:", error);
        mostrarMensagem("Falha ao gerar documento para impressão.", "error");
    }
}

// Registrar inicializador para integração com o carregamento se necessário
document.addEventListener('DOMContentLoaded', () => {
    if (window.sectionInitializers) window.sectionInitializers['dp-solicitacao-horas'] = inicializarSolicitacaoHoras;
  if (window.sectionInitializers) window.sectionInitializers['dp-horas-solicitacao'] = renderMinhasSolicitacoes;
  if (window.sectionInitializers) window.sectionInitializers['control-horas-autorizacao'] = renderAutorizacaoDashboard;
});

// Exportar funções para escopo global para facilitar chamadas a partir de botões
window.abrirModalSolicitacaoHoras = abrirModalSolicitacaoHoras;
window.carregarSolicitacoesPendentes = carregarSolicitacoesPendentes;
window.aprovarSolicitacao = aprovarSolicitacao;
window.rejeitarSolicitacao = rejeitarSolicitacao;
window.abrirModalAjusteSolicitacao = abrirModalAjusteSolicitacao;
window.renderMinhasSolicitacoes = renderMinhasSolicitacoes;
window.renderAutorizacaoDashboard = renderAutorizacaoDashboard;
window.imprimirSolicitacao = imprimirSolicitacao;
window.excluirSolicitacao = excluirSolicitacao;
