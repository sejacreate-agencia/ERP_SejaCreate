// =============================================
// FINANCEIRO — Lançamentos (criar / editar / pagar)
// =============================================

// ── HELPERS DE FORMULÁRIO ─────────────────────────────────────────────────────

function _pagOpts(selected) {
  return ['PIX','Transferência','Boleto','Cartão de Crédito','Cartão de Débito','Dinheiro','Outro']
    .map(p => `<option value="${p}" ${p===selected?'selected':''}>${p}</option>`).join('');
}

function _contaOpts(selected) {
  return ['', ..._CONTAS_BANCARIAS]
    .map(c => `<option value="${c}" ${c===selected?'selected':''}>${c||'— Conta bancária —'}</option>`).join('');
}

function _ccOpts(selected) {
  return ['', ..._CENTROS_CUSTO]
    .map(c => `<option value="${c}" ${c===selected?'selected':''}>${c||'— Centro de custo —'}</option>`).join('');
}

function _recStatusOpts(selected) {
  return ['previsto','pendente','pago','parcialmente_pago','atrasado','cancelado']
    .map(s => {
      const l = {previsto:'Previsto',pendente:'Pendente',pago:'Pago',parcialmente_pago:'Parcialmente Pago',atrasado:'Vencido',cancelado:'Cancelado'}[s]||s;
      return `<option value="${s}" ${s===selected?'selected':''}>${l}</option>`;
    }).join('');
}

function _payStatusOpts(selected) {
  return ['provisionado','previsto','pendente','pago','parcialmente_pago','atrasado','cancelado']
    .map(s => {
      const l = {provisionado:'Provisionado',previsto:'Previsto',pendente:'Pendente',pago:'Pago',parcialmente_pago:'Parcialmente Pago',atrasado:'Vencido',cancelado:'Cancelado'}[s]||s;
      return `<option value="${s}" ${s===selected?'selected':''}>${l}</option>`;
    }).join('');
}

// ── REGISTRAR PAGAMENTO / RECEBIMENTO ─────────────────────────────────────────

function openMarkPaidModal(type, id) {
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;

  const today = new Date().toISOString().slice(0, 10);
  const valor = item.value || 0;
  const titulo = type === 'receivable' ? 'Registrar Recebimento' : 'Registrar Pagamento';
  const icon   = type === 'receivable' ? 'fa-arrow-down' : 'fa-arrow-up';
  const color  = type === 'receivable' ? 'var(--success)' : 'var(--danger)';

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas ${icon}" style="color:${color};margin-right:8px"></i>${titulo}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px 16px;margin-bottom:16px;border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${type==='receivable'?'Cliente':'Fornecedor'}</div>
        <div style="font-weight:600;font-size:14px">${item.description||item.desc||'—'}</div>
        <div style="display:flex;gap:16px;margin-top:6px;font-size:12px">
          <span>Valor original: <strong style="color:${color}">${SC.formatCurrency(valor)}</strong></span>
          <span>Vencimento: <strong>${formatDateBR(item.due_date||item.due)||'—'}</strong></span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Data do ${type==='receivable'?'Recebimento':'Pagamento'} *</label>
          <input class="input-field" id="mp-date" type="date" value="${today}" />
        </div>
        <div class="form-col">
          <label>Valor Original (R$)</label>
          <input class="input-field" id="mp-valor" type="number" value="${valor.toFixed(2)}" step="0.01" oninput="_calcValorLiquido()" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Multa (R$)</label>
          <input class="input-field" id="mp-multa" type="number" value="0" min="0" step="0.01" oninput="_calcValorLiquido()" />
        </div>
        <div class="form-col">
          <label>Juros (R$)</label>
          <input class="input-field" id="mp-juros" type="number" value="0" min="0" step="0.01" oninput="_calcValorLiquido()" />
        </div>
        <div class="form-col">
          <label>Desconto (R$)</label>
          <input class="input-field" id="mp-desconto" type="number" value="0" min="0" step="0.01" oninput="_calcValorLiquido()" />
        </div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 16px;margin:0 0 14px;font-size:13px;border:1px solid var(--border)">
        Valor líquido: <strong id="mp-liquido-val" style="color:${color}">${SC.formatCurrency(valor)}</strong>
        <span style="font-size:11px;color:var(--text-muted);margin-left:8px">(original + multa + juros − desconto)</span>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Forma de Pagamento</label>
          <select class="select-field" id="mp-forma">
            <option value="">—</option>
            ${_pagOpts(item.forma_pagamento||'')}
          </select>
        </div>
        <div class="form-col">
          <label>Conta Bancária</label>
          <select class="select-field" id="mp-conta">${_contaOpts(item.conta_bancaria||'')}</select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-success" id="btn-save-mp" data-action="save-mark-paid" data-type="${type}" data-id="${id}">
        <i class="fas fa-check"></i> Confirmar ${type==='receivable'?'Recebimento':'Pagamento'}
      </button>
    </div>
  `);
}

function _calcValorLiquido() {
  const val  = parseFloat(document.getElementById('mp-valor')?.value)   || 0;
  const mul  = parseFloat(document.getElementById('mp-multa')?.value)   || 0;
  const jur  = parseFloat(document.getElementById('mp-juros')?.value)   || 0;
  const des  = parseFloat(document.getElementById('mp-desconto')?.value)|| 0;
  const liq  = val + mul + jur - des;
  const el   = document.getElementById('mp-liquido-val');
  if (el) el.textContent = SC.formatCurrency(Math.max(0, liq));
}

async function saveMarkPaid(type, id) {
  const paidDate = document.getElementById('mp-date')?.value;
  const valor    = parseFloat(document.getElementById('mp-valor')?.value)    || 0;
  const multa    = parseFloat(document.getElementById('mp-multa')?.value)    || 0;
  const juros    = parseFloat(document.getElementById('mp-juros')?.value)    || 0;
  const desconto = parseFloat(document.getElementById('mp-desconto')?.value) || 0;
  const forma    = document.getElementById('mp-forma')?.value  || '';
  const conta    = document.getElementById('mp-conta')?.value  || '';

  if (!paidDate) { showToast('Informe a data do pagamento!', 'error'); return; }

  const btn = document.getElementById('btn-save-mp');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  const valorLiquido = Math.max(0, valor + multa + juros - desconto);
  const isPartial    = valor > 0 && Math.abs(valorLiquido - (item?.value||0)) > 0.01 && valorLiquido < (item?.value||0);
  const newStatus    = isPartial ? 'parcialmente_pago' : 'pago';

  const payload = {
    status:          newStatus,
    paid_date:       paidDate,
    paid_at:         new Date(paidDate + 'T12:00:00').toISOString(),
    valor_pago:      valorLiquido,
    multa:           multa || null,
    juros:           juros || null,
    desconto:        desconto || null,
    forma_pagamento: forma || null,
    conta_bancaria:  conta || null,
  };

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.update : DB.payables.update;
    let { error } = await fn(id, payload);
    if (error) {
      const fallback = { status: newStatus, paid_at: payload.paid_at };
      const res = await fn(id, fallback);
      error = res.error;
      if (!error) showToast('⚠️ Salvo com campos básicos — execute migration-005.sql no Supabase.', 'warning');
    }
    if (error) {
      showToast(`Erro: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Confirmar'; }
      return;
    }
  } else {
    const scList = type === 'receivable' ? SC.finances.receivable : SC.finances.payable;
    const scItem = scList.find(x => String(x.id) === String(id));
    if (scItem) Object.assign(scItem, payload);
  }

  if (item) Object.assign(item, payload);
  const allList = type === 'receivable' ? _recDataAll : _payDataAll;
  const allItem = allList?.find(x => String(x.id) === String(id));
  if (allItem) Object.assign(allItem, payload);

  closeModal();
  showToast(`✅ ${type==='receivable'?'Recebimento':'Pagamento'} registrado!`, 'success');
  _renderFinContent();
}

// ── NOVO LANÇAMENTO ───────────────────────────────────────────────────────────

function openNewLancModal() {
  const clientOpts = SC.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const contaOpts  = SC.planoDeContas.filter(c=>c.ativo)
    .map(c => `<option value="${c.id}">${c.codigo} — ${c.nome}</option>`).join('');
  const hoje = new Date().toISOString().slice(0,10);

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
        <div class="form-col">
          <label>Conta Contábil</label>
          <select class="select-field" id="nl-conta">
            <option value="">— Sem classificação —</option>
            ${contaOpts}
          </select>
        </div>
        <div class="form-col">
          <label>Categoria</label>
          <input class="input-field" id="nl-categoria" placeholder="Ex: Mensalidade" />
        </div>
      </div>
      <div class="form-row" id="nl-client-row">
        <div class="form-col">
          <label>Cliente</label>
          <select class="select-field" id="nl-client">
            <option value="">— Avulso —</option>
            ${clientOpts}
          </select>
        </div>
        <div class="form-col">
          <label>Vencimento</label>
          <input class="input-field" id="nl-due" type="date" value="${hoje}" />
        </div>
      </div>
      <div class="form-row" id="nl-supplier-row" style="display:none">
        <div class="form-col">
          <label>Fornecedor</label>
          <input class="input-field" id="nl-supplier" placeholder="Nome do fornecedor" />
        </div>
        <div class="form-col">
          <label>Vencimento (1º mês)</label>
          <input class="input-field" id="nl-due-pay" type="date" value="${hoje}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Forma de Pagamento</label>
          <select class="select-field" id="nl-forma">
            <option value="">—</option>
            ${_pagOpts('')}
          </select>
        </div>
        <div class="form-col">
          <label>Centro de Custo</label>
          <select class="select-field" id="nl-cc">${_ccOpts('')}</select>
        </div>
      </div>
      <div class="form-row" id="nl-provisao-row" style="display:none">
        <div class="form-col full" style="background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:8px;padding:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:0">
            <input type="checkbox" id="nl-provisao-check" onchange="toggleProvisaoCheck()" style="width:16px;height:16px;accent-color:var(--purple-light)" />
            <span style="font-size:13px;font-weight:500"><i class="fas fa-layer-group" style="color:var(--purple-light);margin-right:4px"></i> Provisionar por múltiplos meses</span>
          </label>
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
  const type      = document.getElementById('nl-type').value;
  const value     = parseFloat(document.getElementById('nl-val').value);
  const desc      = document.getElementById('nl-desc').value.trim();
  if (!desc || !value) { showToast('Preencha descrição e valor!', 'error'); return; }

  const btn = document.getElementById('btn-save-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const contaId   = document.getElementById('nl-conta')?.value     || '';
  const categoria = document.getElementById('nl-categoria')?.value.trim() || '';
  const forma     = document.getElementById('nl-forma')?.value      || '';
  const cc        = document.getElementById('nl-cc')?.value         || '';

  if (type === 'receivable') {
    const clientId = document.getElementById('nl-client').value || null;
    const due      = document.getElementById('nl-due').value;
    const dbPayload = { client_id: clientId||null, description: desc, value, due_date: due||null, status: 'pendente',
      forma_pagamento: forma||null, categoria: categoria||null, centro_custo: cc||null, conta_id: contaId?parseInt(contaId):null };

    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.create(dbPayload);
      if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Salvar';} return; }
      const clientName = SC.clients.find(c=>String(c.id)===String(clientId))?.name||'—';
      _recData.push({...data,client:{name:clientName}}); _recDataAll.push({...data,client:{name:clientName}});
    } else {
      const clientName = SC.clients.find(c=>String(c.id)===String(clientId))?.name||'—';
      const newItem = { id:Date.now(), client_id:clientId, client:{name:clientName}, description:desc, desc, value,
        due_date:due, due, status:'pendente', forma_pagamento:forma, categoria, centro_custo:cc, conta_id:contaId?parseInt(contaId):null };
      SC.finances.receivable.push(newItem); _recData.push(newItem); _recDataAll.push(newItem);
    }
  } else {
    const supplierName = document.getElementById('nl-supplier').value.trim() || 'Fornecedor';
    const dueBase      = document.getElementById('nl-due-pay').value;
    const isProvisao   = document.getElementById('nl-provisao-check')?.checked;
    const meses        = isProvisao ? Math.max(1, parseInt(document.getElementById('nl-provisao-meses')?.value)||1) : 1;
    const grupoId      = isProvisao && meses > 1 ? `prov_${Date.now()}` : null;

    for (let i = 0; i < meses; i++) {
      let dueDate = dueBase;
      if (dueBase && i > 0) { const d=new Date(dueBase+'T12:00:00'); d.setMonth(d.getMonth()+i); dueDate=d.toISOString().slice(0,10); }
      const status  = isProvisao ? 'provisionado' : 'pendente';
      const descMes = meses > 1 ? `${desc} (${i+1}/${meses})` : desc;
      const dbPayload = { supplier_name:supplierName, description:descMes, value, due_date:dueDate||null, status,
        forma_pagamento:forma||null, categoria:categoria||null, centro_custo:cc||null, conta_id:contaId?parseInt(contaId):null };

      if (isSupabaseReady()) {
        const { data, error } = await DB.payables.create(dbPayload);
        if (error) { showToast(`Erro: ${error.message}`, 'error'); if (btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Salvar';} return; }
        _payData.push(data); _payDataAll.push(data);
      } else {
        const newItem = { id:Date.now()+i, supplier:supplierName, supplier_name:supplierName, desc:descMes, description:descMes,
          value, due:dueDate, due_date:dueDate, status, forma_pagamento:forma, categoria, centro_custo:cc,
          conta_id:contaId?parseInt(contaId):null, provisao_grupo:grupoId, provisao_mes:i+1, provisao_total:meses };
        SC.finances.payable.push(newItem); _payData.push(newItem); _payDataAll.push(newItem);
      }
    }
  }

  closeModal();
  showToast('✅ Lançamento criado!', 'success');
  _renderFinContent();
}

// ── EDITAR LANÇAMENTO ─────────────────────────────────────────────────────────

function openEditLancModal(type, id) {
  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return;

  const contaOpts = SC.planoDeContas.filter(c=>c.ativo)
    .map(c => `<option value="${c.id}" ${String(c.id)===String(item.conta_id)?'selected':''}>${c.codigo} — ${c.nome}</option>`).join('');
  const clientOpts = type === 'receivable'
    ? SC.clients.map(c=>`<option value="${c.id}" ${String(c.id)===String(item.client_id||item.client)?'selected':''}>${c.name}</option>`).join('')
    : '';
  const dueDate  = (item.due_date||item.due||'').split('T')[0];
  const paidDate = (item.paid_date||(item.paid_at||'').slice(0,10)||'');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-edit" style="color:var(--purple-light);margin-right:8px"></i>Editar Lançamento</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      ${type==='receivable'?`
      <div class="form-row">
        <div class="form-col full"><label>Cliente</label>
          <select class="select-field" id="el-client"><option value="">— Avulso —</option>${clientOpts}</select>
        </div>
      </div>`:''}
      <div class="form-row">
        <div class="form-col full"><label>Descrição *</label>
          <input class="input-field" id="el-desc" value="${item.description||item.desc||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Valor Original (R$)</label><input class="input-field" id="el-val" type="number" value="${item.value||0}" step="0.01" /></div>
        <div class="form-col"><label>Valor Pago (R$)</label><input class="input-field" id="el-vpago" type="number" value="${item.valor_pago||item.value||0}" step="0.01" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Vencimento</label><input class="input-field" id="el-due" type="date" value="${dueDate}" /></div>
        <div class="form-col"><label>Data Pagamento</label><input class="input-field" id="el-paid" type="date" value="${paidDate}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Multa (R$)</label><input class="input-field" id="el-multa" type="number" value="${item.multa||0}" step="0.01" /></div>
        <div class="form-col"><label>Juros (R$)</label><input class="input-field" id="el-juros" type="number" value="${item.juros||0}" step="0.01" /></div>
        <div class="form-col"><label>Desconto (R$)</label><input class="input-field" id="el-desconto" type="number" value="${item.desconto||0}" step="0.01" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Status</label>
          <select class="select-field" id="el-status">${type==='receivable'?_recStatusOpts(item.status):_payStatusOpts(item.status)}</select>
        </div>
        <div class="form-col"><label>Forma de Pagamento</label>
          <select class="select-field" id="el-pag">
            <option value="">—</option>
            ${_pagOpts(item.forma_pagamento||'')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Conta Bancária</label>
          <select class="select-field" id="el-conta">${_contaOpts(item.conta_bancaria||'')}</select>
        </div>
        <div class="form-col">
          <label>Centro de Custo</label>
          <select class="select-field" id="el-cc">${_ccOpts(item.centro_custo||'')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Conta Contábil</label>
          <select class="select-field" id="el-plano">
            <option value="">— Sem classificação —</option>
            ${contaOpts}
          </select>
        </div>
        <div class="form-col">
          <label>Categoria</label>
          <input class="input-field" id="el-categoria" value="${item.categoria||''}" placeholder="Ex: Mensalidade" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Observações</label>
          <textarea class="input-field" id="el-obs" rows="2" style="resize:vertical">${item.observacoes||''}</textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" data-action="delete-lanc" data-type="${type}" data-id="${id}" style="margin-right:auto">
        <i class="fas fa-trash"></i> Excluir
      </button>
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-edit-lanc" data-action="save-edit-lanc" data-type="${type}" data-id="${id}">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `);
}

async function saveEditLanc(type, id) {
  const desc       = document.getElementById('el-desc').value.trim();
  const value      = parseFloat(document.getElementById('el-val').value);
  const valorPago  = parseFloat(document.getElementById('el-vpago')?.value) || null;
  const due        = document.getElementById('el-due').value;
  const paidDate   = document.getElementById('el-paid')?.value || null;
  const multa      = parseFloat(document.getElementById('el-multa')?.value)   || null;
  const juros      = parseFloat(document.getElementById('el-juros')?.value)   || null;
  const desconto   = parseFloat(document.getElementById('el-desconto')?.value)|| null;
  const status     = document.getElementById('el-status').value;
  const formaPag   = document.getElementById('el-pag')?.value    || '';
  const conta      = document.getElementById('el-conta')?.value  || '';
  const cc         = document.getElementById('el-cc')?.value     || '';
  const contaId    = document.getElementById('el-plano')?.value  || '';
  const categoria  = document.getElementById('el-categoria')?.value.trim() || '';
  const obs        = document.getElementById('el-obs')?.value?.trim() || '';
  const clientId   = document.getElementById('el-client')?.value || null;

  if (!desc || !value) { showToast('Preencha descrição e valor!', 'error'); return; }

  const btn = document.getElementById('btn-save-edit-lanc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const list = type === 'receivable' ? _recData : _payData;
  const item = list.find(x => String(x.id) === String(id));

  const payload = {
    description:     desc,
    value,
    due_date:        due || null,
    paid_date:       paidDate || null,
    paid_at:         paidDate ? new Date(paidDate+'T12:00:00').toISOString() : (status==='pago'&&item?.status!=='pago' ? new Date().toISOString() : undefined),
    valor_pago:      valorPago,
    multa:           multa,
    juros:           juros,
    desconto:        desconto,
    status,
    forma_pagamento: formaPag || null,
    conta_bancaria:  conta || null,
    centro_custo:    cc || null,
    conta_id:        contaId ? parseInt(contaId) : null,
    categoria:       categoria || null,
    observacoes:     obs || null,
  };
  if (payload.paid_at === undefined) delete payload.paid_at;
  if (clientId) payload.client_id = clientId;

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.update : DB.payables.update;
    let { error } = await fn(id, payload);
    if (error) {
      const fallback = { description:payload.description, value:payload.value, due_date:payload.due_date, status:payload.status };
      if (payload.client_id) fallback.client_id = payload.client_id;
      if (payload.paid_at)   fallback.paid_at   = payload.paid_at;
      const res = await fn(id, fallback);
      error = res.error;
      if (!error) showToast('⚠️ Salvo com campos básicos — execute migration-005.sql.', 'warning');
    }
    if (error) { showToast(`Erro: ${error.message}`, 'error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Salvar';} return; }
  } else {
    const scList = type === 'receivable' ? SC.finances.receivable : SC.finances.payable;
    const scItem = scList.find(x => String(x.id) === String(id));
    if (scItem) Object.assign(scItem, { description:desc, desc, value, due:due, due_date:due, status, forma_pagamento:formaPag, observacoes:obs });
  }

  if (item) Object.assign(item, payload);
  const allList = type === 'receivable' ? _recDataAll : _payDataAll;
  const allItem = allList?.find(x => String(x.id) === String(id));
  if (allItem && item) Object.assign(allItem, item);

  closeModal();
  showToast('✅ Lançamento atualizado!', 'success');
  _renderFinContent();
}

// ── NOVO RECEBIMENTO ─────────────────────────────────────────────────────────

function openNewRecebimentoModal() {
  const clientOpts = SC.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const hoje       = new Date().toISOString().slice(0, 10);

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-arrow-down" style="color:var(--success);margin-right:8px"></i>Novo Recebimento
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col">
          <label>Cliente</label>
          <select class="select-field" id="nr-client">
            <option value="">— Avulso —</option>
            ${clientOpts}
          </select>
        </div>
        <div class="form-col"><label>Valor (R$) *</label><input class="input-field" id="nr-val" type="number" placeholder="0,00" step="0.01" /></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Descrição *</label><input class="input-field" id="nr-desc" placeholder="Ex: Mensalidade Março" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>1º Vencimento *</label><input class="input-field" id="nr-due" type="date" value="${hoje}" /></div>
        <div class="form-col"><label>Nº de Parcelas</label><input class="input-field" id="nr-parcelas" type="number" min="1" max="60" value="1" /></div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Status</label>
          <select class="select-field" id="nr-status">${_recStatusOpts('pendente')}</select>
        </div>
        <div class="form-col">
          <label>Forma de Pagamento</label>
          <select class="select-field" id="nr-pag"><option value="">—</option>${_pagOpts('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Conta Bancária</label>
          <select class="select-field" id="nr-conta">${_contaOpts('')}</select>
        </div>
        <div class="form-col">
          <label>Centro de Custo</label>
          <select class="select-field" id="nr-cc">${_ccOpts('')}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Observações</label>
          <textarea class="input-field" id="nr-obs" rows="2" style="resize:vertical"></textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-nr" data-action="save-new-recebimento">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `);
}

async function saveNewRecebimento() {
  const clientId = document.getElementById('nr-client').value || null;
  const valor    = parseFloat(document.getElementById('nr-val').value);
  const desc     = document.getElementById('nr-desc').value.trim();
  const dueBase  = document.getElementById('nr-due').value;
  const parcelas = Math.max(1, parseInt(document.getElementById('nr-parcelas').value)||1);
  const status   = document.getElementById('nr-status').value;
  const formaPag = document.getElementById('nr-pag').value;
  const contaBan = document.getElementById('nr-conta')?.value || '';
  const cc       = document.getElementById('nr-cc')?.value    || '';
  const obs      = document.getElementById('nr-obs').value.trim();

  if (!desc || !valor || !dueBase) { showToast('Preencha descrição, valor e vencimento!', 'error'); return; }

  const btn = document.getElementById('btn-save-nr');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const isPago  = status === 'pago';
  const paidAt  = isPago ? new Date().toISOString() : null;
  const paidDt  = isPago ? new Date().toISOString().slice(0,10) : null;

  for (let i = 0; i < parcelas; i++) {
    let dueDate = dueBase;
    if (i > 0) { const d=new Date(dueBase+'T12:00:00'); d.setMonth(d.getMonth()+i); dueDate=d.toISOString().slice(0,10); }
    const descParcela = parcelas > 1 ? `${desc} (${i+1}/${parcelas})` : desc;
    const payload = {
      client_id: clientId, description: descParcela, value: valor, due_date: dueDate, status,
      forma_pagamento: formaPag||null, conta_bancaria: contaBan||null, centro_custo: cc||null,
      observacoes: obs||null, parcela_numero: i+1, parcela_total: parcelas,
      paid_at: paidAt, paid_date: paidDt, valor_pago: isPago ? valor : null,
    };

    if (isSupabaseReady()) {
      let { data, error } = await DB.receivables.create(payload);
      if (error && (error.message.includes('schema cache')||error.message.includes('parcela')||error.message.includes('conta_bancaria')||error.message.includes('centro_custo'))) {
        const fallback = { client_id:payload.client_id, description:payload.description, value:payload.value, due_date:payload.due_date, status:payload.status, paid_at:payload.paid_at };
        const res = await DB.receivables.create(fallback);
        data=res.data; error=res.error;
        if (!error) showToast('⚠️ Parcela salva com campos básicos — execute migration-005.sql.', 'warning');
      }
      if (error) { showToast(`Erro ${i+1}: ${error.message}`, 'error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Salvar';} return; }
      const clientName = SC.clients.find(c=>String(c.id)===String(clientId))?.name||'—';
      const item = {...data, client:{name:clientName}};
      _recData.push(item); _recDataAll.push(item);
    } else {
      const clientName = SC.clients.find(c=>String(c.id)===String(clientId))?.name||'—';
      const item = { id:Date.now()+i, client_id:clientId, client:{name:clientName}, description:descParcela, desc:descParcela,
        value:valor, due_date:dueDate, due:dueDate, status, forma_pagamento:formaPag, conta_bancaria:contaBan,
        centro_custo:cc, observacoes:obs, parcela_numero:i+1, parcela_total:parcelas, paid_at:paidAt, paid_date:paidDt, valor_pago:isPago?valor:null };
      SC.finances.receivable.push(item); _recData.push(item); _recDataAll.push(item);
    }
  }

  closeModal();
  showToast(parcelas > 1 ? `✅ ${parcelas} lançamentos criados!` : '✅ Lançamento criado!', 'success');
  _renderFinContent();
}

// ── EXCLUIR LANÇAMENTO ───────────────────────────────────────────────────────

async function deleteLanc(type, id) {
  if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return;

  if (isSupabaseReady()) {
    const fn = type === 'receivable' ? DB.receivables.remove : DB.payables.remove;
    const { error } = await fn(id);
    if (error) { showToast(`Erro ao excluir: ${error.message}`, 'error'); return; }
  } else {
    const scList = type === 'receivable' ? SC.finances.receivable : SC.finances.payable;
    const idx = scList.findIndex(x => String(x.id) === String(id));
    if (idx !== -1) scList.splice(idx, 1);
  }

  if (type === 'receivable') {
    _recData    = _recData.filter(x=>String(x.id)!==String(id));
    _recDataAll = _recDataAll.filter(x=>String(x.id)!==String(id));
  } else {
    _payData    = _payData.filter(x=>String(x.id)!==String(id));
    _payDataAll = _payDataAll.filter(x=>String(x.id)!==String(id));
  }

  closeModal();
  showToast('✅ Lançamento excluído!', 'success');
  _renderFinContent();
}

function confirmProvisao(id) {
  const item = _payData.find(x => String(x.id) === String(id));
  if (!item) return;

  if (isSupabaseReady()) {
    DB.payables.update(id, { status: 'pendente' }).then(({ error }) => {
      if (error) showToast(`Erro: ${error.message}`, 'error');
    });
  } else {
    const scItem = SC.finances.payable.find(x => String(x.id) === String(id));
    if (scItem) scItem.status = 'pendente';
  }

  item.status = 'pendente';
  showToast('✅ Confirmado — status atualizado para Pendente!', 'success');
  _renderFinContent();
}
