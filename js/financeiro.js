// =============================================
// SEJA CREATE — FINANCEIRO (com Supabase)
// =============================================

let finTab = 'visao-geral';
let finChart = null;
let _recData = [];
let _payData = [];

async function renderFinanceiro(tab) {
  if (tab) finTab = tab;

  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Financeiro</h1>
          <p class="page-subtitle">Controle financeiro completo da agência</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-action="open-new-lanc-modal"><i class="fas fa-plus"></i> Novo Lançamento</button>
        </div>
      </div>
    </div>
    <div id="fin-summary-area">
      <div class="loading-state" style="padding:30px 0"><i class="fas fa-spinner fa-spin"></i> Carregando dados financeiros...</div>
    </div>
  `;

  // Carrega dados
  [_recData, _payData] = await Promise.all([Data.receivables(), Data.payables()]);
  _renderFinContent();
}

function _renderFinContent() {
  const totalRec = _recData.reduce((s, r) => s + (r.value || 0), 0);
  const totalPago = _recData.filter(r => r.status === 'pago').reduce((s, r) => s + (r.value || 0), 0);
  const totalPend = _recData.filter(r => r.status === 'pendente').reduce((s, r) => s + (r.value || 0), 0);
  const totalAtras = _recData.filter(r => r.status === 'atrasado').reduce((s, r) => s + (r.value || 0), 0);
  const totalPay = _payData.reduce((s, r) => s + (r.value || 0), 0);
  const totalPayPago = _payData.filter(r => r.status === 'pago').reduce((s, r) => s + (r.value || 0), 0);

  const finSummaryArea = document.getElementById('fin-summary-area');
  if (!finSummaryArea) return;

  finSummaryArea.innerHTML = `
    <!-- SUMMARY CARDS -->
    <div class="fin-summary">
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Faturamento do Mês</div>
        <div class="fin-value positive">${SC.formatCurrency(totalRec)}</div>
        <div class="fin-sub">Total a receber</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Recebido</div>
        <div class="fin-value positive">${SC.formatCurrency(totalPago)}</div>
        <div class="fin-sub">${_recData.filter(r=>r.status==='pago').length} faturas pagas</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">A Receber</div>
        <div class="fin-value neutral">${SC.formatCurrency(totalPend)}</div>
        <div class="fin-sub">${_recData.filter(r=>r.status==='pendente').length} faturas pendentes</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Inadimplência</div>
        <div class="fin-value negative">${SC.formatCurrency(totalAtras)}</div>
        <div class="fin-sub" style="color:var(--danger)">${_recData.filter(r=>r.status==='atrasado').length} fatura(s) atrasada(s)</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Contas a Pagar</div>
        <div class="fin-value negative">${SC.formatCurrency(totalPay)}</div>
        <div class="fin-sub">${_payData.length} fornecedores</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Saldo do Período</div>
        <div class="fin-value ${(totalPago-totalPayPago)>=0?'positive':'negative'}">${SC.formatCurrency(totalPago - totalPayPago)}</div>
        <div class="fin-sub">Recebido − Pago</div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tabs">
      <button class="tab-btn ${finTab==='visao-geral'?'active':''}" data-action="switch-fin-tab" data-tab="visao-geral"><i class="fas fa-chart-line"></i> Visão Geral</button>
      <button class="tab-btn ${finTab==='receber'?'active':''}" data-action="switch-fin-tab" data-tab="receber"><i class="fas fa-arrow-down"></i> A Receber</button>
      <button class="tab-btn ${finTab==='pagar'?'active':''}" data-action="switch-fin-tab" data-tab="pagar"><i class="fas fa-arrow-up"></i> A Pagar</button>
      <button class="tab-btn ${finTab==='inadimplencia'?'active':''}" data-action="switch-fin-tab" data-tab="inadimplencia"><i class="fas fa-exclamation-circle"></i> Inadimplência</button>
    </div>

    <div id="fin-tab-content">
      ${finTab === 'visao-geral' ? renderFinVisaoGeral() :
        finTab === 'receber' ? renderFinReceber() :
        finTab === 'pagar' ? renderFinPagar() :
        renderFinInadimplencia()}
    </div>
  `;

  if (finTab === 'visao-geral') {
    setTimeout(() => renderFluxoCaixa(), 100);
  }

  // Aplica permissões financeiras
  if (!SC.hasPermission('financeiro')) {
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  }
}

/* ─── ABAS ────────────────────────────── */

function renderFinVisaoGeral() {
  const byClient = _recData
    .filter(r => r.status !== 'cancelado')
    .reduce((acc, r) => {
      const name = r.client?.name || SC.getClientName(r.client_id || r.client) || 'N/A';
      acc[name] = (acc[name] || 0) + (r.value || 0);
      return acc;
    }, {});

  const clientList = Object.entries(byClient)
    .map(([name, revenue]) => ({ name: name.split(' ').slice(0,2).join(' '), revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const maxRev = clientList[0]?.revenue || 1;
  const cashflow = Data.cashflow();

  return `
    <div class="grid-2">
      <div class="card" data-perm="financial">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-bar" style="color:var(--purple-light);margin-right:8px"></i>Fluxo de Caixa — Últimos 6 Meses</span></div>
        <div class="chart-container" style="height:280px">
          <canvas id="cashflow-chart"></canvas>
        </div>
      </div>
      <div class="card" data-perm="financial">
        <div class="card-header"><span class="card-title"><i class="fas fa-users" style="color:var(--purple-light);margin-right:8px"></i>Faturamento por Cliente</span></div>
        <div>
          ${clientList.map(c => `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px">${c.name}</span>
                <span style="font-size:12px;font-weight:700;color:var(--success)">${SC.formatCurrency(c.revenue)}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill green" style="width:${Math.round(c.revenue/maxRev*100)}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title"><i class="fas fa-exchange-alt" style="color:var(--purple-light);margin-right:8px"></i>Lançamentos Recentes</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            ${_recData.slice(0,4).map(r => `
              <tr>
                <td>${r.description || r.desc}</td>
                <td><span class="tag tag-green" style="font-size:11px"><i class="fas fa-arrow-down"></i> Entrada</span></td>
                <td style="font-size:12px">${formatDateBR(r.due_date || r.due) || '—'}</td>
                <td style="font-weight:700;color:var(--success)">${SC.formatCurrency(r.value || 0)}</td>
                <td><span class="tag ${r.status==='pago'?'tag-green':r.status==='atrasado'?'tag-red':'tag-yellow'}">${r.status}</span></td>
              </tr>`).join('')}
            ${_payData.slice(0,2).map(p => `
              <tr>
                <td>${p.description || p.desc}</td>
                <td><span class="tag tag-red" style="font-size:11px"><i class="fas fa-arrow-up"></i> Saída</span></td>
                <td style="font-size:12px">${formatDateBR(p.due_date || p.due) || '—'}</td>
                <td style="font-weight:700;color:var(--danger)">- ${SC.formatCurrency(p.value || 0)}</td>
                <td><span class="tag ${p.status==='pago'?'tag-green':'tag-yellow'}">${p.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderFluxoCaixa() {
  const ctx = document.getElementById('cashflow-chart');
  if (!ctx) return;
  if (finChart) { finChart.destroy(); finChart = null; }
  const cf = Data.cashflow();
  finChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cf.map(c => c.month),
      datasets: [
        { label: 'Entradas', data: cf.map(c => c.in), backgroundColor: 'rgba(16,185,129,0.5)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
        { label: 'Saídas', data: cf.map(c => c.out), backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#ef4444', borderWidth: 2, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9090a8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9090a8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderFinReceber() {
  const rows = _recData.map(r => {
    const clientObj = r.client;
    let phone = '';
    if (clientObj && typeof clientObj === 'object') phone = (clientObj.phone || '').replace(/\D/g, '');
    else phone = (SC.clients.find(c => c.id === (r.client_id || r.client))?.phone || '').replace(/\D/g, '');

    const clientName = (clientObj?.name) || SC.getClientName(r.client_id || r.client) || 'N/A';
    const waMsg = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');
    const waLink = `https://wa.me/55${phone}?text=${waMsg}`;
    const dueDate = r.due_date || r.due;
    const isOverdue = r.status === 'atrasado' || (r.status === 'pendente' && dueDate && new Date(dueDate) < new Date(new Date().toDateString()));

    return `
    <tr>
      <td><div style="font-weight:600">${clientName}</div></td>
      <td style="font-size:13px">${r.description || r.desc}</td>
      <td style="font-weight:700;color:var(--success)">${SC.formatCurrency(r.value || 0)}</td>
      <td style="font-size:12px;${isOverdue?'color:var(--danger);font-weight:700':''}">${formatDateBR(dueDate) || '—'}</td>
      <td><span class="tag ${r.status==='pago'?'tag-green':isOverdue?'tag-red':'tag-yellow'}">${r.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${r.status !== 'pago' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}"><i class="fas fa-check"></i> Pago</button>` : ''}
          ${r.status !== 'pago' && phone ? `
            <a href="${waLink}" target="_blank" class="btn-whatsapp" data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1">
              <i class="fab fa-whatsapp"></i> Cobrar
            </a>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="receivable" data-id="${r.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderFinPagar() {
  const rows = _payData.map(p => `
    <tr>
      <td>${p.supplier_name || p.supplier}</td>
      <td style="font-size:13px">${p.description || p.desc}</td>
      <td style="font-weight:700;color:var(--danger)">- ${SC.formatCurrency(p.value || 0)}</td>
      <td style="font-size:12px">${formatDateBR(p.due_date || p.due) || '—'}</td>
      <td><span class="tag ${p.status==='pago'?'tag-green':'tag-yellow'}">${p.status}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${p.status !== 'pago' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="payable" data-id="${p.id}"><i class="fas fa-check"></i> Pagar</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="payable" data-id="${p.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fornecedor</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderFinInadimplencia() {
  const today = new Date(new Date().toDateString());
  const atrasados = _recData.filter(r =>
    r.status === 'atrasado' ||
    (r.status === 'pendente' && (r.due_date || r.due) && new Date((r.due_date || r.due).split('T')[0]) < today)
  );

  if (!atrasados.length) return `
    <div class="empty-state">
      <i class="fas fa-check-circle" style="color:var(--success);font-size:48px"></i>
      <p style="margin-top:12px">Nenhuma inadimplência registrada!</p>
      <p style="font-size:12px;color:var(--text-muted)">Todos os clientes estão em dia.</p>
    </div>`;

  const waMsg = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title" style="color:var(--danger)">
          <i class="fas fa-exclamation-circle"></i> Clientes Inadimplentes
        </span>
        <span style="font-size:12px;color:var(--text-muted)">${atrasados.length} fatura(s) em atraso · Total: ${SC.formatCurrency(atrasados.reduce((s,r)=>s+(r.value||0),0))}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Dias em Atraso</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${atrasados.map(r => {
              const dueDate = r.due_date || r.due;
              const dias = dueDate ? Math.max(0, Math.round((today - new Date(dueDate.split('T')[0])) / 86400000)) : 0;
              const clientObj = r.client;
              let phone = '';
              let clientName = 'N/A', contactName = '';
              if (clientObj && typeof clientObj === 'object') {
                phone = (clientObj.phone || '').replace(/\D/g, '');
                clientName = clientObj.name || 'N/A';
                contactName = clientObj.contact_name || '';
              } else {
                const cl = SC.clients.find(c => c.id === (r.client_id || r.client));
                phone = (cl?.phone || '').replace(/\D/g, '');
                clientName = cl?.name || 'N/A';
                contactName = cl?.resp || '';
              }
              const waLink = `https://wa.me/55${phone}?text=${waMsg}`;
              return `<tr>
                <td>
                  <div style="font-weight:600">${clientName}</div>
                  ${contactName ? `<div style="font-size:11px;color:var(--text-muted)">${contactName}</div>` : ''}
                </td>
                <td style="font-size:13px">${r.description || r.desc}</td>
                <td style="color:var(--danger);font-weight:700">${SC.formatCurrency(r.value || 0)}</td>
                <td style="color:var(--danger);font-size:12px">${formatDateBR(dueDate) || '—'}</td>
                <td><span class="tag tag-red" style="font-weight:700">${dias} dias</span></td>
                <td>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${phone ? `
                    <a href="${waLink}" target="_blank" class="btn-whatsapp"
                       data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1">
                      <i class="fab fa-whatsapp"></i> Cobrar
                    </a>` : `<span style="font-size:11px;color:var(--text-muted)">Sem telefone</span>`}
                    <button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}">
                      <i class="fas fa-check"></i> Pago
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ─── AÇÕES ───────────────────────────── */

async function markAsPaid(type, id) {
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.markPaid : DB.payables.markPaid;
    const { error } = await fn(id);
    if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  } else {
    // Fallback local
    const scList = type === 'receivable' ? SC.finances.receivable : SC.finances.payable;
    const scItem = scList.find(x => String(x.id) === String(id));
    if (scItem) scItem.status = 'pago';
  }

  item.status = 'pago';
  item.paid_at = new Date().toISOString();
  showToast('✅ Lançamento marcado como pago!', 'success');
  _renderFinContent();
}

function openNewLancModal() {
  const clientOpts = SC.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus" style="color:var(--purple-light);margin-right:8px"></i>Novo Lançamento</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col">
          <label>Tipo</label>
          <select class="select-field" id="nl-type" onchange="toggleLancType()">
            <option value="receivable">Conta a Receber</option>
            <option value="payable">Conta a Pagar</option>
          </select>
        </div>
        <div class="form-col">
          <label>Valor (R$) *</label>
          <input class="input-field" id="nl-val" type="number" placeholder="0,00" step="0.01" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Descrição *</label>
          <input class="input-field" id="nl-desc" placeholder="Ex: Mensalidade Março" />
        </div>
      </div>
      <div class="form-row" id="nl-client-row">
        <div class="form-col">
          <label>Cliente</label>
          <select class="select-field" id="nl-client">${clientOpts}</select>
        </div>
        <div class="form-col">
          <label>Vencimento</label>
          <input class="input-field" id="nl-due" type="date" />
        </div>
      </div>
      <div class="form-row" id="nl-supplier-row" style="display:none">
        <div class="form-col">
          <label>Fornecedor</label>
          <input class="input-field" id="nl-supplier" placeholder="Nome do fornecedor" />
        </div>
        <div class="form-col">
          <label>Vencimento</label>
          <input class="input-field" id="nl-due-pay" type="date" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-lanc" data-action="save-new-lanc"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function toggleLancType() {
  const t = document.getElementById('nl-type').value;
  document.getElementById('nl-client-row').style.display = t === 'receivable' ? '' : 'none';
  document.getElementById('nl-supplier-row').style.display = t === 'payable' ? '' : 'none';
}

async function saveNewLanc() {
  const type = document.getElementById('nl-type').value;
  const value = parseFloat(document.getElementById('nl-val').value);
  const desc = document.getElementById('nl-desc').value.trim();
  if (!desc || !value) { showToast('Preencha todos os campos obrigatórios!', 'error'); return; }

  const btn = document.getElementById('btn-save-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  if (type === 'receivable') {
    const clientId = document.getElementById('nl-client').value;
    const due = document.getElementById('nl-due').value;
    const payload = { client_id: clientId, description: desc, value, due_date: due || null, status: 'pendente' };

    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.create(payload);
      if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; } return; }
      _recData.push({ ...data, client: { name: SC.getClientName(parseInt(clientId)) } });
    } else {
      const newItem = { id: Date.now(), client: parseInt(clientId), client_id: parseInt(clientId), desc, description: desc, value, due, due_date: due, status: 'pendente' };
      SC.finances.receivable.push(newItem);
      _recData.push(newItem);
    }
  } else {
    const supplierName = document.getElementById('nl-supplier').value.trim() || 'Fornecedor';
    const due = document.getElementById('nl-due-pay').value;
    const payload = { supplier_name: supplierName, description: desc, value, due_date: due || null, status: 'pendente' };

    if (isSupabaseReady()) {
      const { data, error } = await DB.payables.create(payload);
      if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; } return; }
      _payData.push(data);
    } else {
      const newItem = { id: Date.now(), supplier: supplierName, supplier_name: supplierName, desc, description: desc, value, due, due_date: due, status: 'pendente' };
      SC.finances.payable.push(newItem);
      _payData.push(newItem);
    }
  }

  closeModal();
  showToast('✅ Lançamento criado!', 'success');
  _renderFinContent();
}

function openEditLancModal(type, id) {
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;

  const statusOpts = ['pendente','pago','atrasado','cancelado'].map(s => `<option value="${s}" ${s===item.status?'selected':''}>${s}</option>`).join('');
  const dueDate = item.due_date || item.due || '';

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-edit" style="color:var(--purple-light);margin-right:8px"></i>Editar Lançamento</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col full">
          <label>Descrição *</label>
          <input class="input-field" id="el-desc" value="${item.description || item.desc || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Valor (R$)</label><input class="input-field" id="el-val" type="number" value="${item.value || 0}" step="0.01" /></div>
        <div class="form-col"><label>Vencimento</label><input class="input-field" id="el-due" type="date" value="${dueDate.split('T')[0] || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Status</label>
          <select class="select-field" id="el-status">${statusOpts}</select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-edit-lanc" data-action="save-edit-lanc" data-type="${type}" data-id="${id}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

async function saveEditLanc(type, id) {
  const desc = document.getElementById('el-desc').value.trim();
  const value = parseFloat(document.getElementById('el-val').value);
  const due = document.getElementById('el-due').value;
  const status = document.getElementById('el-status').value;
  if (!desc || !value) { showToast('Preencha todos os campos!', 'error'); return; }

  const btn = document.getElementById('btn-save-edit-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const payload = { description: desc, value, due_date: due || null, status };
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.update : DB.payables.update;
    const { error } = await fn(id, payload);
    if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  } else {
    const scList = type === 'receivable' ? SC.finances.receivable : SC.finances.payable;
    const scItem = scList.find(x => String(x.id) === String(id));
    if (scItem) Object.assign(scItem, { desc, value, due, due_date: due, status });
  }

  if (item) Object.assign(item, { description: desc, value, due_date: due, status });
  closeModal();
  showToast('✅ Lançamento atualizado!', 'success');
  _renderFinContent();
}
