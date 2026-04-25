// =============================================
// SEJA CREATE — CADASTRO
// =============================================

let cadastroTab = 'clientes';

function renderCadastro(tab) {
  if (tab) cadastroTab = tab;

  const tabs = [
    { id: 'clientes', label: 'Clientes', icon: 'fa-building', count: SC.clients.length },
    { id: 'funcionarios', label: 'Funcionários', icon: 'fa-users', count: SC.employees.length },
    { id: 'fornecedores', label: 'Fornecedores', icon: 'fa-truck', count: SC.suppliers.length },
  ];

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Cadastro</h1>
          <p class="page-subtitle">Gestão de clientes, funcionários e fornecedores</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-action="open-new-cadastro-modal"><i class="fas fa-plus"></i> Novo ${cadastroTab === 'clientes' ? 'Cliente' : cadastroTab === 'funcionarios' ? 'Funcionário' : 'Fornecedor'}</button>
        </div>
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(t => `
        <button class="tab-btn ${cadastroTab === t.id ? 'active' : ''}" data-action="switch-cadastro-tab" data-tab="${t.id}">
          <i class="fas ${t.icon}"></i> ${t.label} <span style="font-size:11px;opacity:0.7">(${t.count})</span>
        </button>`).join('')}
    </div>
    <div id="cadastro-content">
      ${cadastroTab === 'clientes' ? renderClientesTab() : cadastroTab === 'funcionarios' ? renderFuncionariosTab() : renderFornecedoresTab()}
    </div>
  `;
}

function renderClientesTab() {
  const rows = SC.clients.map(c => `
    <tr data-action="open-client-detail" data-id="${c.id}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm">${c.name.charAt(0)}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${c.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${c.resp}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12px">${c.email}</td>
      <td>
        ${c.services.map(s => `<span class="tag tag-purple" style="margin-right:4px;margin-bottom:2px">${s}</span>`).join('')}
      </td>
      <td><span class="tag tag-blue">${c.plan}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${SC.formatDate(c.expiry) || '—'}</td>
      <td style="color:var(--success);font-weight:700;font-size:13px">${c.revenue ? SC.formatCurrency(c.revenue) : '—'}</td>
      <td>
        <span class="tag ${c.status === 'ativo' ? 'tag-green' : 'tag-gray'}">
          <span class="status-dot ${c.status === 'ativo' ? 'dot-green' : 'dot-gray'}"></span>
          ${c.status.charAt(0).toUpperCase() + c.status.slice(1)}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-ghost" data-action="open-client-detail" data-id="${c.id}" data-stop-propagation="1"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-ghost" data-action="open-edit-client" data-id="${c.id}" data-stop-propagation="1" title="Editar cliente"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-ghost" data-action="toggle-client-status" data-id="${c.id}" data-stop-propagation="1"><i class="fas fa-power-off"></i></button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="filters-bar">
      <input class="filter-select" style="width:240px" placeholder="🔍 Buscar cliente..." oninput="filterClients(this.value)" />
      <select class="filter-select" onchange="filterClientStatus(this.value)">
        <option value="">Todos os status</option>
        <option value="ativo">Ativos</option>
        <option value="inativo">Inativos</option>
      </select>
      <select class="filter-select" onchange="filterClientPlan(this.value)">
        <option value="">Todos os planos</option>
        <option>Premium</option><option>Padrão</option><option>Starter</option><option>Basic</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table id="clients-table">
          <thead><tr><th>Cliente</th><th>E-mail</th><th>Serviços</th><th>Plano</th><th>Vencimento</th><th>Mensalidade</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFuncionariosTab() {
  const rows = SC.employees.map(e => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm">${e.name.slice(0,2).toUpperCase()}</div>
          <div><div style="font-weight:600;font-size:13px">${e.name}</div></div>
        </div>
      </td>
      <td style="font-size:12px">${e.cargo}</td>
      <td style="font-size:12px">${e.email}</td>
      <td style="font-size:12px">${e.phone}</td>
      <td><span class="tag tag-purple">${SC.roleLabels[e.role]}</span></td>
      <td><span class="tag ${e.status === 'ativo' ? 'tag-green' : 'tag-gray'}">${e.status}</span></td>
      <td>
        <button class="btn btn-sm btn-ghost" data-action="open-func-modal" data-id="${e.id}"><i class="fas fa-edit"></i></button>
      </td>
    </tr>
  `).join('');
  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFornecedoresTab() {
  const rows = SC.suppliers.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td style="font-size:12px">${s.contact || '—'}</td>
      <td style="font-size:12px">${s.phone || '—'}</td>
      <td><span class="tag tag-blue">${s.service || '—'}</span></td>
      <td><span class="tag ${s.status === 'ativo' ? 'tag-green' : 'tag-gray'}">${s.status}</span></td>
      <td>
        <button class="btn btn-sm btn-ghost" data-action="open-edit-supplier" data-id="${s.id}">
          <i class="fas fa-edit"></i>
        </button>
      </td>
    </tr>
  `).join('');
  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fornecedor</th><th>Contato</th><th>Telefone</th><th>Serviço</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum fornecedor cadastrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function openEditSupplierModal(id) {
  const s = SC.suppliers.find(x => String(x.id) === String(id));
  if (!s) return;
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-truck" style="color:var(--purple-light);margin-right:8px"></i>Editar Fornecedor</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col full"><label>Nome *</label><input class="input-field" id="es-name" value="${s.name}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Contato</label><input class="input-field" id="es-contact" value="${s.contact || ''}" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="es-phone" value="${s.phone || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Serviço Prestado</label><input class="input-field" id="es-service" value="${s.service || ''}" /></div>
        <div class="form-col"><label>Status</label>
          <select class="select-field" id="es-status">
            <option value="ativo" ${s.status === 'ativo' ? 'selected' : ''}>Ativo</option>
            <option value="inativo" ${s.status === 'inativo' ? 'selected' : ''}>Inativo</option>
          </select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-edit-supplier" data-id="${id}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveEditSupplier(id) {
  const s = SC.suppliers.find(x => String(x.id) === String(id));
  if (!s) return;
  const name = document.getElementById('es-name').value.trim();
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  s.name    = name;
  s.contact = document.getElementById('es-contact').value;
  s.phone   = document.getElementById('es-phone').value;
  s.service = document.getElementById('es-service').value;
  s.status  = document.getElementById('es-status').value;
  closeModal(); showToast('Fornecedor atualizado!'); renderCadastro('fornecedores');
}

function openClientDetail(id) {
  const c = SC.clients.find(x => x.id === id);
  if (!c) return;
  const tasks = SC.tasks.filter(t => t.client === id);
  const financials = SC.finances.receivable.filter(f => f.client === id);

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <div class="avatar-sm" style="display:inline-flex;margin-right:8px">${c.name.charAt(0)}</div>
        ${c.name}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab-btn active" id="ct1" data-action="switch-client-tab" data-tab="1">Geral</button>
        <button class="tab-btn" id="ct2" data-action="switch-client-tab" data-tab="2">Contrato</button>
        <button class="tab-btn" id="ct3" data-action="switch-client-tab" data-tab="3">Tarefas</button>
        <button class="tab-btn" id="ct4" data-action="switch-client-tab" data-tab="4">Financeiro</button>
      </div>

      <div id="client-tab-1">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Responsável</div><div style="font-weight:600">${c.resp}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">E-mail</div><div>${c.email}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Telefone</div><div>${c.phone}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">CNPJ/CPF</div><div>${c.cnpj}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Status</div>
            <span class="tag ${c.status === 'ativo' ? 'tag-green' : 'tag-gray'}">${c.status}</span>
          </div>
        </div>
        <div style="margin-top:16px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Serviços Contratados</div>
          <div>${c.services.map(s => `<span class="tag tag-purple" style="margin-right:4px">${s}</span>`).join('')}</div>
        </div>
      </div>

      <div id="client-tab-2" class="hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><div style="font-size:11px;color:var(--text-muted)">Plano</div><div class="tag tag-blue" style="margin-top:4px">${c.plan}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted)">Início</div><div style="font-weight:600;margin-top:4px">${SC.formatDate(c.start)}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted)">Vencimento</div><div style="font-weight:600;margin-top:4px">${SC.formatDate(c.expiry) || '—'}</div></div>
          <div><div style="font-size:11px;color:var(--text-muted)">Mensalidade</div><div style="font-weight:700;color:var(--success);margin-top:4px">${c.revenue ? SC.formatCurrency(c.revenue) : '—'}</div></div>
        </div>
      </div>

      <div id="client-tab-3" class="hidden">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">${tasks.length} tarefa(s) vinculada(s)</div>
        ${tasks.map(t => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
            <div><div style="font-size:13px;font-weight:500">${t.title}</div><div style="font-size:11px;color:var(--text-muted)">${SC.formatDate(t.postDate)}</div></div>
            <span class="tag tag-${SC.statusColor(t.status)}">${t.status}</span>
          </div>`).join('') || '<div class="empty-state" style="padding:20px"><p>Sem tarefas</p></div>'}
      </div>

      <div id="client-tab-4" class="hidden">
        ${financials.map(f => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
            <div><div style="font-size:13px;font-weight:500">${f.desc}</div><div style="font-size:11px;color:var(--text-muted)">Vence: ${SC.formatDate(f.due)}</div></div>
            <div style="text-align:right">
              <div style="font-weight:700;color:var(--success)">${SC.formatCurrency(f.value)}</div>
              <span class="tag ${f.status==='pago'?'tag-green':f.status==='atrasado'?'tag-red':'tag-yellow'}">${f.status}</span>
            </div>
          </div>`).join('') || '<div class="empty-state" style="padding:20px"><p>Sem lançamentos</p></div>'}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Fechar</button>
      <button class="btn btn-primary" data-action="save-new-client"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `, 'modal-lg');
}

function switchClientTab(n) {
  [1,2,3,4].forEach(i => {
    const t = document.getElementById(`client-tab-${i}`);
    const b = document.getElementById(`ct${i}`);
    if (t) { t.classList.toggle('hidden', i !== n); }
    if (b) { b.classList.toggle('active', i === n); }
  });
}

function toggleClientStatus(id) {
  const c = SC.clients.find(x => x.id === id);
  if (c) { c.status = c.status === 'ativo' ? 'inativo' : 'ativo'; renderCadastro('clientes'); showToast('Status atualizado!'); }
}

function openNewCadastroModal() {
  if (cadastroTab === 'clientes') openNewClientModal();
  else if (cadastroTab === 'funcionarios') openFuncModal();
  else openNewSupplierModal();
}

function openNewClientModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-building" style="color:var(--purple-light);margin-right:8px"></i>Novo Cliente</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome da Empresa *</label><input class="input-field" id="nc-name" placeholder="Ex: TechVision Soluções" /></div>
        <div class="form-col"><label>Responsável</label><input class="input-field" id="nc-resp" placeholder="Nome do responsável" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>E-mail</label><input class="input-field" id="nc-email" type="email" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="nc-phone" /></div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Serviços Contratados <span style="font-size:11px;color:var(--text-secondary)">(separados por vírgula)</span></label>
          <input class="input-field" id="nc-services" placeholder="Ex: Social Media, Design, Tráfego Pago" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>CNPJ / CPF</label><input class="input-field" id="nc-cnpj" /></div>
        <div class="form-col"><label>Plano</label>
          <select class="select-field" id="nc-plan"><option>Basic</option><option>Starter</option><option>Padrão</option><option>Premium</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Mensalidade (R$)</label><input class="input-field" id="nc-revenue" type="number" step="0.01" /></div>
        <div class="form-col"><label>Dia de Vencimento</label><input class="input-field" id="nc-diaVenc" type="number" min="1" max="31" placeholder="Ex: 10" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Data de Início</label><input class="input-field" id="nc-start" type="date" /></div>
        <div class="form-col"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-new-client"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `, 'modal-lg');
}

async function saveNewClient() {
  const name = document.getElementById('nc-name').value.trim();
  if (!name) { showToast('Nome da empresa é obrigatório!', 'error'); return; }

  const btn = document.querySelector('[data-action="save-new-client"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const servicesRaw = document.getElementById('nc-services')?.value || '';
  const services    = servicesRaw ? servicesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const diaVenc     = parseInt(document.getElementById('nc-diaVenc')?.value) || null;
  const revenue     = parseFloat(document.getElementById('nc-revenue')?.value) || 0;
  const startDate   = document.getElementById('nc-start')?.value || null;

  const payload = {
    name,
    contact_name:    document.getElementById('nc-resp').value,
    email:           document.getElementById('nc-email').value,
    phone:           document.getElementById('nc-phone').value,
    cnpj:            document.getElementById('nc-cnpj').value,
    services,
    plan:            document.getElementById('nc-plan').value,
    start_date:      startDate,
    status:          'ativo',
    monthly_revenue: revenue,
    dia_vencimento:  diaVenc,
  };

  let clientId;

  if (isSupabaseReady()) {
    let { data, error } = await DB.clients.create(payload);
    if (error && (error.message.includes('dia_vencimento') || error.message.includes('services') || error.message.includes('schema cache'))) {
      const fallback = { ...payload };
      delete fallback.dia_vencimento;
      delete fallback.services;
      const res = await DB.clients.create(fallback);
      data = res.data; error = res.error;
      if (!error) showToast('⚠️ Cliente salvo sem dia_vencimento/serviços — execute a migration-002.sql no Supabase.', 'warning');
    }
    if (error) {
      showToast(`Erro ao criar cliente: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
      return;
    }
    clientId = data.id;
    SC.clients.push({
      id: data.id, name: data.name, resp: data.contact_name || '', email: data.email || '',
      phone: data.phone || '', cnpj: data.cnpj || '', services: data.services || [],
      plan: data.plan, start: data.start_date || '', expiry: data.expiry_date || '',
      status: data.status, revenue: data.monthly_revenue || 0, diaVenc: data.dia_vencimento,
    });
    await logActivity('client.created', 'client', data.id, JSON.stringify({ name }));
  } else {
    clientId = Date.now();
    SC.clients.push({
      id: clientId, name, resp: payload.contact_name, email: payload.email,
      phone: payload.phone, cnpj: payload.cnpj, services, plan: payload.plan,
      start: startDate || '', expiry: '', status: 'ativo', revenue, diaVenc,
    });
  }

  closeModal();
  renderCadastro('clientes');

  if (revenue > 0 && diaVenc) {
    _openGerarParcelasModal(clientId, name, revenue, diaVenc, startDate);
  } else {
    showToast('✅ Cliente cadastrado com sucesso!', 'success');
  }
}

function openFuncModal(id) {
  const e = id ? SC.employees.find(x => x.id === id) : null;
  const roleOpts = Object.entries(SC.roleLabels).map(([k,v]) => `<option value="${k}" ${e && e.role === k ? 'selected' : ''}>${v}</option>`).join('');
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user" style="color:var(--purple-light);margin-right:8px"></i>${e ? 'Editar Funcionário' : 'Novo Funcionário'}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome *</label><input class="input-field" id="nf-name" value="${e ? e.name : ''}" /></div>
        <div class="form-col"><label>Cargo *</label><input class="input-field" id="nf-cargo" value="${e ? e.cargo : ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>E-mail</label><input class="input-field" id="nf-email" type="email" value="${e ? e.email : ''}" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="nf-phone" value="${e ? e.phone : ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Perfil de Acesso</label><select class="select-field" id="nf-role">${roleOpts}</select></div>
        <div class="form-col"><label>Status</label>
          <select class="select-field" id="nf-status"><option value="ativo" ${!e||e.status==='ativo'?'selected':''}>Ativo</option><option value="inativo" ${e&&e.status==='inativo'?'selected':''}>Inativo</option></select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-funcionario" data-id="${id||0}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveFuncionario(id) {
  const name = document.getElementById('nf-name').value;
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  if (id) {
    const e = SC.employees.find(x => x.id === id);
    if (e) { e.name = name; e.cargo = document.getElementById('nf-cargo').value; e.email = document.getElementById('nf-email').value; e.phone = document.getElementById('nf-phone').value; e.role = document.getElementById('nf-role').value; e.status = document.getElementById('nf-status').value; }
  } else {
    SC.employees.push({ id: SC.employees.length + 1, name, cargo: document.getElementById('nf-cargo').value, email: document.getElementById('nf-email').value, phone: document.getElementById('nf-phone').value, role: document.getElementById('nf-role').value, status: document.getElementById('nf-status').value });
  }
  closeModal(); showToast('Funcionário salvo!'); renderCadastro('funcionarios');
}

function openNewSupplierModal() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-truck" style="color:var(--purple-light);margin-right:8px"></i>Novo Fornecedor</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col full"><label>Nome *</label><input class="input-field" id="ns-name" placeholder="Nome do fornecedor" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Contato</label><input class="input-field" id="ns-contact" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="ns-phone" /></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Serviço Prestado</label><input class="input-field" id="ns-service" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-new-supplier"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveNewSupplier() {
  const name = document.getElementById('ns-name').value;
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  SC.suppliers.push({ id: SC.suppliers.length + 1, name, contact: document.getElementById('ns-contact').value, phone: document.getElementById('ns-phone').value, service: document.getElementById('ns-service').value, status: 'ativo' });
  closeModal(); showToast('Fornecedor cadastrado!'); renderCadastro('fornecedores');
}

function filterClients(q) {
  const rows = document.querySelectorAll('#clients-table tbody tr');
  rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; });
}
function filterClientStatus(v) {
  const rows = document.querySelectorAll('#clients-table tbody tr');
  rows.forEach(r => { r.style.display = !v || r.textContent.toLowerCase().includes(v) ? '' : 'none'; });
}
function filterClientPlan(v) {
  const rows = document.querySelectorAll('#clients-table tbody tr');
  rows.forEach(r => { r.style.display = !v || r.textContent.includes(v) ? '' : 'none'; });
}

// ── EDITAR CLIENTE ────────────────────────────────────────────────────────────

function openEditClientModal(id) {
  const c = SC.clients.find(x => String(x.id) === String(id));
  if (!c) return;

  const servicesStr = (c.services || []).join(', ');
  const planOpts    = ['Basic','Starter','Padrão','Premium'].map(p =>
    `<option ${c.plan === p ? 'selected' : ''}>${p}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-building" style="color:var(--purple-light);margin-right:8px"></i>
        Editar Cliente: ${c.name}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome da Empresa *</label><input class="input-field" id="ec-name" value="${c.name}" /></div>
        <div class="form-col"><label>Responsável</label><input class="input-field" id="ec-resp" value="${c.resp || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>E-mail</label><input class="input-field" id="ec-email" type="email" value="${c.email || ''}" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="ec-phone" value="${c.phone || ''}" /></div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Serviços Contratados <span style="font-size:11px;color:var(--text-secondary)">(separados por vírgula)</span></label>
          <input class="input-field" id="ec-services" value="${servicesStr}" placeholder="Ex: Social Media, Design, Tráfego Pago" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Plano</label><select class="select-field" id="ec-plan">${planOpts}</select></div>
        <div class="form-col"><label>Status</label>
          <select class="select-field" id="ec-status">
            <option value="ativo"        ${c.status === 'ativo'        ? 'selected' : ''}>Ativo</option>
            <option value="inativo"      ${c.status === 'inativo'      ? 'selected' : ''}>Inativo</option>
            <option value="inadimplente" ${c.status === 'inadimplente' ? 'selected' : ''}>Inadimplente</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Mensalidade (R$)</label><input class="input-field" id="ec-revenue" type="number" value="${c.revenue || ''}" step="0.01" /></div>
        <div class="form-col"><label>Dia de Vencimento</label><input class="input-field" id="ec-diaVenc" type="number" min="1" max="31" value="${c.diaVenc || ''}" placeholder="Ex: 10" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Data de Início</label><input class="input-field" id="ec-start" type="date" value="${c.start || ''}" /></div>
        <div class="form-col"><label>CNPJ / CPF</label><input class="input-field" id="ec-cnpj" value="${c.cnpj || ''}" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-edit-client" data-id="${id}">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `, 'modal-lg');
}

async function saveEditClient(id) {
  const name = document.getElementById('ec-name').value.trim();
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }

  const btn = document.querySelector('[data-action="save-edit-client"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const servicesRaw = document.getElementById('ec-services').value;
  const services    = servicesRaw ? servicesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const diaVenc     = parseInt(document.getElementById('ec-diaVenc').value) || null;

  const payload = {
    name,
    contact_name:    document.getElementById('ec-resp').value,
    email:           document.getElementById('ec-email').value,
    phone:           document.getElementById('ec-phone').value,
    cnpj:            document.getElementById('ec-cnpj').value,
    services,
    plan:            document.getElementById('ec-plan').value,
    status:          document.getElementById('ec-status').value,
    start_date:      document.getElementById('ec-start').value || null,
    monthly_revenue: parseFloat(document.getElementById('ec-revenue').value) || 0,
    dia_vencimento:  diaVenc,
  };

  if (isSupabaseReady()) {
    let { error } = await DB.clients.update(id, payload);
    if (error && (error.message.includes('dia_vencimento') || error.message.includes('services') || error.message.includes('schema cache'))) {
      // Migration 002 ainda não foi executada — salvar sem os campos novos
      const fallback = { ...payload };
      delete fallback.dia_vencimento;
      delete fallback.services;
      const res = await DB.clients.update(id, fallback);
      error = res.error;
      if (!error) showToast('⚠️ Salvo sem dia_vencimento/serviços — execute a migration-002.sql no Supabase.', 'warning');
    }
    if (error) {
      showToast(`Erro ao atualizar cliente: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações'; }
      return;
    }
  }

  const c = SC.clients.find(x => String(x.id) === String(id));
  if (c) {
    c.name    = payload.name;         c.resp    = payload.contact_name;
    c.email   = payload.email;        c.phone   = payload.phone;
    c.cnpj    = payload.cnpj;         c.services = payload.services;
    c.plan    = payload.plan;         c.status  = payload.status;
    c.start   = payload.start_date || '';
    c.revenue = payload.monthly_revenue;
    c.diaVenc = diaVenc;
  }

  closeModal();
  showToast('✅ Cliente atualizado com sucesso!', 'success');
  renderCadastro('clientes');
}

// ── GERAÇÃO DE PARCELAS ───────────────────────────────────────────────────────

function _calcVencimento(mes, ano, dia) {
  const maxDay = new Date(ano, mes, 0).getDate();
  const d      = new Date(ano, mes - 1, Math.min(dia, maxDay));
  return d.toISOString().slice(0, 10);
}

function _openGerarParcelasModal(clientId, clientName, valor, diaVenc, startDate) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const mNames   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-file-invoice-dollar" style="color:var(--success);margin-right:8px"></i>
        Gerar Contas a Receber
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
        <i class="fas fa-check-circle" style="color:var(--success);margin-right:6px"></i>
        Cliente <strong style="color:var(--text-primary)">${clientName}</strong> cadastrado! Deseja gerar as cobranças mensais automaticamente?
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Valor da Mensalidade (R$)</label>
          <input class="input-field" id="gp-valor" type="number" value="${valor}" step="0.01" />
        </div>
        <div class="form-col">
          <label>Dia de Vencimento</label>
          <input class="input-field" id="gp-dia" type="number" min="1" max="31" value="${diaVenc}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Mês de início</label>
          <select class="select-field" id="gp-mes">
            ${mNames.map((m, i) => `<option value="${i + 1}" ${(i + 1) === mesAtual ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-col">
          <label>Ano de início</label>
          <input class="input-field" id="gp-ano" type="number" min="2020" max="2035" value="${anoAtual}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Quantidade de parcelas *</label>
          <input class="input-field" id="gp-parcelas" type="number" min="1" max="60" value="12" />
        </div>
        <div class="form-col"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Pular</button>
      <button class="btn btn-primary" id="btn-gerar-parcelas"
        data-action="gerar-parcelas"
        data-client-id="${clientId}"
        data-client-name="${clientName.replace(/"/g, '&quot;')}">
        <i class="fas fa-magic"></i> Gerar Parcelas
      </button>
    </div>
  `);
}

async function _confirmarGerarParcelas(clientId, clientName) {
  const valor    = parseFloat(document.getElementById('gp-valor')?.value) || 0;
  const dia      = parseInt(document.getElementById('gp-dia')?.value) || 1;
  const mes      = parseInt(document.getElementById('gp-mes')?.value) || (new Date().getMonth() + 1);
  const ano      = parseInt(document.getElementById('gp-ano')?.value) || new Date().getFullYear();
  const parcelas = Math.max(1, parseInt(document.getElementById('gp-parcelas')?.value) || 1);

  if (!valor || !parcelas) { showToast('Preencha valor e quantidade de parcelas!', 'error'); return; }

  const btn = document.getElementById('btn-gerar-parcelas');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...'; }

  let erros = 0;

  for (let i = 0; i < parcelas; i++) {
    const parcelaMes = ((mes - 1 + i) % 12) + 1;
    const parcelaAno = ano + Math.floor((mes - 1 + i) / 12);
    const dueDate    = _calcVencimento(parcelaMes, parcelaAno, dia);
    const desc       = parcelas > 1
      ? `Mensalidade - ${clientName} (${i + 1}/${parcelas})`
      : `Mensalidade - ${clientName}`;

    const payload = {
      client_id:      clientId,
      description:    desc,
      value:          valor,
      due_date:       dueDate,
      status:         'pendente',
      parcela_numero: i + 1,
      parcela_total:  parcelas,
    };

    if (isSupabaseReady()) {
      const { error } = await DB.receivables.create(payload);
      if (error) { erros++; console.error('Erro ao criar parcela:', error.message); }
    } else {
      SC.finances.receivable.push({
        id: Date.now() + i, client_id: clientId,
        client: { name: clientName },
        description: desc, desc, value: valor,
        due_date: dueDate, due: dueDate, status: 'pendente',
        parcela_numero: i + 1, parcela_total: parcelas,
      });
    }
  }

  closeModal();
  if (erros === 0) {
    showToast(`✅ Cliente criado e ${parcelas} conta(s) a receber gerada(s) com sucesso!`, 'success');
  } else {
    showToast(`⚠️ ${parcelas - erros} parcela(s) criada(s), ${erros} com erro. Verifique o console.`, 'warning');
  }
}

Router.register('cadastro', renderCadastro, 'Cadastro');
