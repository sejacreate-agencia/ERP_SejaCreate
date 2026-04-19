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
          <label>Vencimento (1º mês)</label>
          <input class="input-field" id="nl-due-pay" type="date" />
        </div>
      </div>
      <div class="form-row" id="nl-provisao-row" style="display:none">
        <div class="form-col full" style="background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:8px;padding:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:0">
            <input type="checkbox" id="nl-provisao-check" onchange="toggleProvisaoCheck()" style="width:16px;height:16px;accent-color:var(--purple-light)" />
            <span style="font-size:13px;font-weight:500"><i class="fas fa-layer-group" style="color:var(--purple-light);margin-right:4px"></i> Provisionar por múltiplos meses</span>
          </label>
          <p style="font-size:11px;color:var(--text-secondary);margin:6px 0 0 24px">Cria uma entrada por mês com status <em>Provisionado</em> — confirme cada uma quando o gasto for realizado.</p>
          <div id="nl-provisao-meses-wrap" style="display:none;margin-top:10px;margin-left:24px">
            <label style="font-size:12px">Número de meses *</label>
            <input class="input-field" id="nl-provisao-meses" type="number" min="2" max="60" placeholder="Ex: 12" style="width:100px;margin-top:4px" />
          </div>
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
  document.getElementById('nl-client-row').style.display    = t === 'receivable' ? '' : 'none';
  document.getElementById('nl-supplier-row').style.display  = t === 'payable'    ? '' : 'none';
  document.getElementById('nl-provisao-row').style.display  = t === 'payable'    ? '' : 'none';
}

function toggleProvisaoCheck() {
  const checked = document.getElementById('nl-provisao-check').checked;
  document.getElementById('nl-provisao-meses-wrap').style.display = checked ? '' : 'none';
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
    const supplierName  = document.getElementById('nl-supplier').value.trim() || 'Fornecedor';
    const dueBase       = document.getElementById('nl-due-pay').value;
    const isProvisao    = document.getElementById('nl-provisao-check')?.checked;
    const meses         = isProvisao ? Math.max(1, parseInt(document.getElementById('nl-provisao-meses')?.value) || 1) : 1;
    const grupoId       = isProvisao && meses > 1 ? `prov_${Date.now()}` : null;

    for (let i = 0; i < meses; i++) {
      let dueDate = dueBase;
      if (dueBase && i > 0) {
        const d = new Date(dueBase + 'T12:00:00');
        d.setMonth(d.getMonth() + i);
        dueDate = d.toISOString().slice(0, 10);
      }
      const status  = isProvisao ? 'provisionado' : 'pendente';
      const descMes = meses > 1 ? `${desc} (${i + 1}/${meses})` : desc;
      const payload = { supplier_name: supplierName, description: descMes, value, due_date: dueDate || null, status, conta_id: contaId || null };

      if (isSupabaseReady()) {
        const { data, error } = await DB.payables.create(payload);
        if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; } return; }
        _payData.push(data);
      } else {
        const newItem = { id: Date.now() + i, supplier: supplierName, supplier_name: supplierName, desc: descMes, description: descMes, value, due: dueDate, due_date: dueDate, status, conta_id: contaId ? parseInt(contaId) : null, provisao_grupo: grupoId, provisao_mes: i + 1, provisao_total: meses };
        SC.finances.payable.push(newItem);
        _payData.push(newItem);
      }
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

  const statusLabels = { pendente:'Pendente', pago:'Pago', atrasado:'Atrasado', cancelado:'Cancelado', provisionado:'Provisionado' };
  const statusOpts = (type === 'payable'
    ? ['provisionado','pendente','pago','atrasado','cancelado']
    : ['pendente','pago','atrasado','cancelado'])
    .map(s => `<option value="${s}" ${s===item.status?'selected':''}>${statusLabels[s]||s}</option>`).join('');
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

function confirmProvisao(id) {
  const item = _payData.find(x => String(x.id) === String(id));
  if (!item) return;

  if (isSupabaseReady()) {
    DB.payables.update(id, { status: 'pendente' }).then(({ error }) => {
      if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
    });
  } else {
    const scItem = SC.finances.payable.find(x => String(x.id) === String(id));
    if (scItem) scItem.status = 'pendente';
  }

  item.status = 'pendente';
  showToast('✅ Provisionado confirmado — status atualizado para Pendente!', 'success');
  _renderFinContent();
}
