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
          <button class="btn btn-primary" onclick="openNewCadastroModal()"><i class="fas fa-plus"></i> Novo ${cadastroTab === 'clientes' ? 'Cliente' : cadastroTab === 'funcionarios' ? 'Funcionário' : 'Fornecedor'}</button>
        </div>
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(t => `
        <button class="tab-btn ${cadastroTab === t.id ? 'active' : ''}" onclick="renderCadastro('${t.id}')">
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
    <tr onclick="openClientDetail(${c.id})" style="cursor:pointer">
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
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openClientDetail(${c.id})"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();toggleClientStatus(${c.id})"><i class="fas fa-power-off"></i></button>
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
        <button class="btn btn-sm btn-ghost" onclick="openFuncModal(${e.id})"><i class="fas fa-edit"></i></button>
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
      <td style="font-size:12px">${s.contact}</td>
      <td style="font-size:12px">${s.phone}</td>
      <td><span class="tag tag-blue">${s.service}</span></td>
      <td><span class="tag ${s.status === 'ativo' ? 'tag-green' : 'tag-gray'}">${s.status}</span></td>
      <td><button class="btn btn-sm btn-ghost"><i class="fas fa-edit"></i></button></td>
    </tr>
  `).join('');
  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fornecedor</th><th>Contato</th><th>Telefone</th><th>Serviço</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
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
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="tabs" style="margin-bottom:16px">
        <button class="tab-btn active" id="ct1" onclick="switchClientTab(1)">Geral</button>
        <button class="tab-btn" id="ct2" onclick="switchClientTab(2)">Contrato</button>
        <button class="tab-btn" id="ct3" onclick="switchClientTab(3)">Tarefas</button>
        <button class="tab-btn" id="ct4" onclick="switchClientTab(4)">Financeiro</button>
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
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn btn-primary" onclick="showToast('Dados salvos!')"><i class="fas fa-save"></i> Salvar</button>
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
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome da Empresa *</label><input class="input-field" id="nc-name" placeholder="Ex: TechVision Soluções" /></div>
        <div class="form-col"><label>Responsável *</label><input class="input-field" id="nc-resp" placeholder="Nome do responsável" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>E-mail</label><input class="input-field" id="nc-email" type="email" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="nc-phone" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>CNPJ / CPF</label><input class="input-field" id="nc-cnpj" /></div>
        <div class="form-col"><label>Plano</label>
          <select class="select-field" id="nc-plan"><option>Basic</option><option>Starter</option><option>Padrão</option><option>Premium</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Mensalidade (R$)</label><input class="input-field" id="nc-revenue" type="number" /></div>
        <div class="form-col"><label>Data de Início</label><input class="input-field" id="nc-start" type="date" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveNewClient()"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveNewClient() {
  const name = document.getElementById('nc-name').value;
  if (!name) { showToast('Nome da empresa é obrigatório!', 'error'); return; }
  SC.clients.push({
    id: SC.clients.length + 1, name,
    resp: document.getElementById('nc-resp').value,
    email: document.getElementById('nc-email').value,
    phone: document.getElementById('nc-phone').value,
    cnpj: document.getElementById('nc-cnpj').value,
    services: [], plan: document.getElementById('nc-plan').value,
    start: document.getElementById('nc-start').value,
    expiry: '', status: 'ativo',
    revenue: parseFloat(document.getElementById('nc-revenue').value) || 0,
  });
  closeModal(); showToast('Cliente cadastrado!'); renderCadastro('clientes');
}

function openFuncModal(id) {
  const e = id ? SC.employees.find(x => x.id === id) : null;
  const roleOpts = Object.entries(SC.roleLabels).map(([k,v]) => `<option value="${k}" ${e && e.role === k ? 'selected' : ''}>${v}</option>`).join('');
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user" style="color:var(--purple-light);margin-right:8px"></i>${e ? 'Editar Funcionário' : 'Novo Funcionário'}</span>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
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
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveFuncionario(${id||0})"><i class="fas fa-save"></i> Salvar</button>
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
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
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
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveNewSupplier()"><i class="fas fa-save"></i> Salvar</button>
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
