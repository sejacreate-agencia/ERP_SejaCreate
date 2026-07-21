// =============================================
// SEJA CREATE — SOLICITAR ARTES
// =============================================
// Intake de pedidos de criação de arte. Cada solicitação vira um card
// no Kanban (tabela tasks, origin='solicitacao'), numerado ART-00X.
// A prioridade é calculada automaticamente pelo prazo.

let _saData = [];
let _saFilters = { client: '', priority: '', search: '' };

const SA_CANAIS = ['Instagram', 'Facebook', 'WhatsApp', 'Site / Blog', 'LinkedIn', 'E-mail', 'Impresso', 'Outro'];

// Baixa / Média / Urgente conforme a proximidade do prazo.
function _saPriorityFromDeadline(deadline) {
  if (!deadline) return 'media';
  const days = Math.ceil((new Date(deadline + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  if (days <= 2) return 'alta';
  if (days <= 5) return 'media';
  return 'baixa';
}

function _saPriorityLabel(p) {
  return { alta: '🔴 Urgente', media: '🟡 Média', baixa: '🟢 Baixa' }[p] || p;
}

async function renderSolicitarArtes() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Solicitar Artes</h1>
          <p class="page-subtitle" id="sa-subtitle">Carregando solicitações...</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-action="sa-open-new"><i class="fas fa-plus"></i> Nova Solicitação</button>
        </div>
      </div>
    </div>
    <div class="kpi-grid" id="sa-kpis" style="margin-bottom:16px"></div>
    <div class="filters-bar" id="sa-filters" style="margin-bottom:16px"></div>
    <div id="sa-list"><div class="loading-state" style="padding:50px 0"><i class="fas fa-spinner fa-spin" style="font-size:26px"></i></div></div>
  `;

  _saData = await Data.tasks();
  const clients = await Data.clients();

  const sub = document.getElementById('sa-subtitle');
  if (sub) sub.textContent = `${_saData.length} solicitações registradas`;

  // Filtros
  const clientOpts = `<option value="">Todas as empresas</option>${clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
  const fb = document.getElementById('sa-filters');
  if (fb) {
    fb.innerHTML = `
      <input class="filter-select" id="sa-search" placeholder="🔍 Buscar por título ou número..." style="min-width:220px" oninput="applySaFilters()" value="${_saFilters.search}">
      <select class="filter-select" id="sa-client" onchange="applySaFilters()">${clientOpts}</select>
      <select class="filter-select" id="sa-priority" onchange="applySaFilters()">
        <option value="">Todas as prioridades</option>
        <option value="alta">🔴 Urgente</option>
        <option value="media">🟡 Média</option>
        <option value="baixa">🟢 Baixa</option>
      </select>
      <button class="btn btn-ghost btn-sm" data-action="sa-clear-filters"><i class="fas fa-times"></i> Limpar</button>
    `;
    if (_saFilters.client) document.getElementById('sa-client').value = _saFilters.client;
    if (_saFilters.priority) document.getElementById('sa-priority').value = _saFilters.priority;
  }

  renderSaKPIs();
  renderSaList();
}

function renderSaKPIs() {
  const total = _saData.length;
  const urgentes = _saData.filter(t => t.priority === 'alta' && t.status !== 'Publicado').length;
  const atrasadas = _saData.filter(t => {
    const d = t.deadline || t.post_date || t.postDate;
    return d && new Date(d) < new Date(new Date().toDateString()) && t.status !== 'Publicado';
  }).length;
  const aprovadas = _saData.filter(t => ['Aprovado', 'Programado', 'Publicado'].includes(t.status)).length;

  const el = document.getElementById('sa-kpis');
  if (!el) return;
  const card = (icon, color, value, label) => `
    <div class="kpi-card">
      <div class="kpi-icon ${color}"><i class="fas ${icon}"></i></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;
  el.innerHTML =
    card('fa-clipboard-list', 'purple', total, 'Total de Solicitações') +
    card('fa-fire', 'red', urgentes, 'Urgentes') +
    card('fa-exclamation-triangle', 'yellow', atrasadas, 'Atrasadas') +
    card('fa-check-circle', 'green', aprovadas, 'Aprovadas');
}

function getFilteredSaData() {
  const q = (_saFilters.search || '').toLowerCase();
  return _saData.filter(t => {
    const clientId = t.client_id !== undefined ? t.client_id : t.client;
    if (_saFilters.client && String(clientId) !== String(_saFilters.client)) return false;
    if (_saFilters.priority && t.priority !== _saFilters.priority) return false;
    if (q) {
      const hay = `${t.request_number || ''} ${t.title || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function renderSaList() {
  const el = document.getElementById('sa-list');
  if (!el) return;
  const rows = getFilteredSaData();
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Nenhuma solicitação encontrada</p></div>`;
    return;
  }
  el.innerHTML = `<div class="grid-auto">${rows.map(buildSaCard).join('')}</div>`;
}

function buildSaCard(t) {
  const clientName = (t.client && typeof t.client === 'object')
    ? t.client.name
    : (SC.getClientName(t.client_id || t.client) || 'N/A');
  const deadline = t.deadline || t.post_date || t.postDate;
  const overdue = deadline && new Date(deadline) < new Date(new Date().toDateString()) && t.status !== 'Publicado';
  const stTag = (typeof getStatusTag === 'function') ? getStatusTag(t.status) : `<span class="tag tag-gray">${t.status}</span>`;
  return `
    <div class="report-card" data-action="open-task-modal" data-id="${t.id}" style="cursor:pointer;text-align:left;align-items:stretch">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;font-weight:800;color:var(--text-muted)">${t.request_number || '—'}</span>
        <span style="font-size:10px;font-weight:700">${_saPriorityLabel(t.priority)}</span>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${t.title || 'Sem título'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px"><i class="fas fa-building" style="margin-right:4px"></i>${clientName}${t.art_type ? ` · ${t.art_type}` : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto">
        ${stTag}
        <span style="font-size:11px;${overdue ? 'color:var(--danger);font-weight:700' : 'color:var(--text-muted)'}">
          <i class="fas fa-calendar"></i> ${formatDateBR(deadline) || 'sem prazo'}
        </span>
      </div>
    </div>`;
}

function applySaFilters() {
  _saFilters.search = document.getElementById('sa-search')?.value || '';
  _saFilters.client = document.getElementById('sa-client')?.value || '';
  _saFilters.priority = document.getElementById('sa-priority')?.value || '';
  renderSaKPIs();
  renderSaList();
}

function clearSaFilters() {
  _saFilters = { client: '', priority: '', search: '' };
  renderSolicitarArtes();
}

// ─── NOVA SOLICITAÇÃO ────────────────────────
async function openNewSolicitacaoModal() {
  const clients = await Data.clients();
  const clientOpts = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const tipoOpts = (SC.tiposConteudo || []).map(t => `<option>${t}</option>`).join('');
  const canalOpts = SA_CANAIS.map(c => `<option>${c}</option>`).join('');
  const solicitante = (typeof SB !== 'undefined' && SB.profile?.full_name) || SC.currentUser?.name || SC.currentUser?.full_name || 'Usuário';

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus-square" style="color:var(--purple-light);margin-right:8px"></i>Nova Solicitação de Arte</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Solicitante</label><input class="input-field" value="${solicitante}" disabled></div>
        <div class="form-col"><label>Empresa *</label><select class="select-field" id="sa-f-client">${clientOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Tipo de Arte</label><select class="select-field" id="sa-f-type">${tipoOpts}</select></div>
        <div class="form-col"><label>Canal de Uso</label><select class="select-field" id="sa-f-channel">${canalOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Título *</label><input class="input-field" id="sa-f-title" placeholder="Título da arte solicitada"></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Qual arte será aprovada?</label><input class="input-field" id="sa-f-approval" placeholder="Ex.: arte final para o feed"></div>
        <div class="form-col"><label>Prazo *</label><input type="date" class="input-field" id="sa-f-deadline"></div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Descrição / Briefing <span id="sa-desc-count" style="color:var(--text-muted);font-weight:400">(0/1000)</span></label>
          <textarea class="input-field" id="sa-f-desc" rows="4" maxlength="1000" placeholder="Detalhe o que precisa..." oninput="document.getElementById('sa-desc-count').textContent='('+this.value.length+'/1000)'"></textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Anexos de referência</label>
          <input type="file" id="sa-f-files" multiple accept="image/*,video/*,.pdf" class="input-field" style="padding:8px">
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px">Imagens, vídeos ou PDF de referência (opcional).</p>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted)"><i class="fas fa-info-circle"></i> A prioridade é calculada automaticamente pelo prazo.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="sa-btn-save" data-action="sa-save"><i class="fas fa-paper-plane"></i> Enviar Solicitação</button>
    </div>
  `, 'modal-lg');
}

async function saveNovaSolicitacao() {
  const title = document.getElementById('sa-f-title').value.trim();
  const deadline = document.getElementById('sa-f-deadline').value || null;
  if (!title) { showToast('Título é obrigatório!', 'error'); return; }
  if (!deadline) { showToast('Informe o prazo!', 'error'); return; }

  if (!isSupabaseReady()) {
    showToast('Solicitações disponíveis apenas na versão conectada ao Supabase.', 'warning');
    return;
  }

  const btn = document.getElementById('sa-btn-save');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

  const cols = await Data.kanbanColumns();
  const firstCol = cols[0]?.key || 'Pauta';
  const priority = _saPriorityFromDeadline(deadline);

  const payload = {
    title,
    text: document.getElementById('sa-f-desc').value.trim(),
    client_id: document.getElementById('sa-f-client').value || null,
    art_type: document.getElementById('sa-f-type').value,
    content_type: document.getElementById('sa-f-type').value,
    channel: document.getElementById('sa-f-channel').value,
    approval_target: document.getElementById('sa-f-approval').value.trim() || null,
    deadline,
    post_date: deadline,
    requester_id: (typeof SB !== 'undefined' && SB.profile?.id) || null,
    origin: 'solicitacao',
    status: firstCol,
    priority,
  };

  const { data, error } = await DB.tasks.create(payload);
  if (error) {
    showToast(`Erro ao criar solicitação: ${error.message}`, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Solicitação'; }
    return;
  }

  // Anexos de referência
  const files = document.getElementById('sa-f-files')?.files || [];
  for (const file of files) {
    const path = `tasks/${data.id}/ref_${Date.now()}_${file.name}`;
    const { data: url, error: upErr } = await SB.uploadFile('task-arts', path, file);
    if (!upErr && url) await DB.taskAttachments.add(data.id, url, file.name, file.type, 'referencia');
  }

  await logActivity('task.created', 'task', data.id, JSON.stringify({ title, origin: 'solicitacao' }));
  closeModal();
  showToast('✅ Solicitação enviada!', 'success');
  await renderSolicitarArtes();
}

Router.register('solicitar-artes', renderSolicitarArtes, 'Solicitar Artes');
