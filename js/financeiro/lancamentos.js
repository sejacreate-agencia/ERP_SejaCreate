// =============================================
// FINANCEIRO — Lançamentos (criar / editar / pagar)
// =============================================

async function markAsPaid(type, id) {
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.markPaid : DB.payables.markPaid;
    const { error } = await fn(id);
    if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  } else {
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
  const contaOpts  = SC.planoDeContas
    .filter(c => c.ativo)
    .map(c => `<option value="${c.id}">${c.codigo} — ${c.nome}</option>`)
    .join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus" style="color:var(--purple-light);margin-right:8px"></i>Novo Lançamento</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col">
          <label>Tipo</label>
          <select class="select-field" id="nl-type" data-action="toggle-lanc-type">
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
      <div class="form-row">
        <div class="form-col full">
          <label>Conta Contábil <span style="font-size:11px;color:var(--text-secondary)">(Plano de Contas — classifica a DRE)</span></label>
          <select class="select-field" id="nl-conta">
            <option value="">— Sem classificação —</option>
            ${contaOpts}
          </select>
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
  document.getElementById('nl-client-row').style.display   = t === 'receivable' ? '' : 'none';
  document.getElementById('nl-supplier-row').style.display = t === 'payable'    ? '' : 'none';
}

async function saveNewLanc() {
  const type  = document.getElementById('nl-type').value;
  const value = parseFloat(document.getElementById('nl-val').value);
  const desc  = document.getElementById('nl-desc').value.trim();
  if (!desc || !value) { showToast('Preencha todos os campos obrigatórios!', 'error'); return; }

  const btn = document.getElementById('btn-save-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const contaId = document.getElementById('nl-conta')?.value || '';

  if (type === 'receivable') {
    const clientId = document.getElementById('nl-client').value;
    const due      = document.getElementById('nl-due').value;
    const payload  = { client_id: clientId, description: desc, value, due_date: due || null, status: 'pendente', conta_id: contaId || null };

    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.create(payload);
      if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; } return; }
      _recData.push({ ...data, client: { name: SC.getClientName(parseInt(clientId)) } });
    } else {
      const newItem = { id: Date.now(), client: parseInt(clientId), client_id: parseInt(clientId), desc, description: desc, value, due, due_date: due, status: 'pendente', conta_id: contaId ? parseInt(contaId) : null };
      SC.finances.receivable.push(newItem);
      _recData.push(newItem);
    }
  } else {
    const supplierName = document.getElementById('nl-supplier').value.trim() || 'Fornecedor';
    const due          = document.getElementById('nl-due-pay').value;
    const payload      = { supplier_name: supplierName, description: desc, value, due_date: due || null, status: 'pendente', conta_id: contaId || null };

    if (isSupabaseReady()) {
      const { data, error } = await DB.payables.create(payload);
      if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; } return; }
      _payData.push(data);
    } else {
      const newItem = { id: Date.now(), supplier: supplierName, supplier_name: supplierName, desc, description: desc, value, due, due_date: due, status: 'pendente', conta_id: contaId ? parseInt(contaId) : null };
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

  const statusOpts = ['pendente','pago','atrasado','cancelado']
    .map(s => `<option value="${s}" ${s===item.status?'selected':''}>${s}</option>`).join('');
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
  const desc   = document.getElementById('el-desc').value.trim();
  const value  = parseFloat(document.getElementById('el-val').value);
  const due    = document.getElementById('el-due').value;
  const status = document.getElementById('el-status').value;
  if (!desc || !value) { showToast('Preencha todos os campos!', 'error'); return; }

  const btn = document.getElementById('btn-save-edit-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const payload = { description: desc, value, due_date: due || null, status };
  const list    = type === 'receivable' ? _recData : _payData;
  const item    = list.find(x => String(x.id) === String(id));

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
