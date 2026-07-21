// =============================================
// SEJA CREATE — PLANEJAMENTOS (calendário editorial)
// =============================================
// Planejamento de conteúdo por cliente. Aprovar um planejamento gera
// automaticamente um card no Kanban (origin='planejamento').

let plView = 'tabela';
let plDate = new Date();
let plFilters = { client: '', production: '', approval: '' };
let _plData = [];
let _plClients = [];
let _plProfiles = [];

const PL_CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube'];
const PL_FORMATS = ['Post', 'Carrossel', 'Reels / Vídeo', 'Stories', 'Anúncio'];
const PL_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function _plPriorityFromDeadline(d) {
  if (!d) return 'media';
  const days = Math.ceil((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  return days <= 2 ? 'alta' : days <= 5 ? 'media' : 'baixa';
}

async function renderPlanejamentos() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Planejamentos</h1>
          <p class="page-subtitle">Calendário editorial — planeje, aprove e envie para produção</p>
        </div>
        <div class="page-actions">
          <div class="tabs" style="margin:0">
            <button class="tab-btn ${plView === 'tabela' ? 'active' : ''}" data-action="pl-set-view" data-view="tabela"><i class="fas fa-table"></i> Tabela</button>
            <button class="tab-btn ${plView === 'calendario' ? 'active' : ''}" data-action="pl-set-view" data-view="calendario"><i class="fas fa-calendar"></i> Calendário</button>
          </div>
          <button class="btn btn-primary" data-action="pl-open-new"><i class="fas fa-plus"></i> Novo Planejamento</button>
        </div>
      </div>
    </div>
    <div class="filters-bar" id="pl-filters" style="margin-bottom:16px"></div>
    <div id="pl-body"><div class="loading-state" style="padding:60px 0"><i class="fas fa-spinner fa-spin" style="font-size:26px"></i></div></div>
  `;

  if (!isSupabaseReady()) {
    document.getElementById('pl-body').innerHTML = `<div class="empty-state"><i class="fas fa-plug"></i><p>Planejamentos disponíveis apenas com o Supabase conectado.<br>Rode a migration 010.</p></div>`;
    return;
  }

  _plData = await Data.plannings();
  _plClients = await Data.clients();
  _plProfiles = await Data.profiles();

  renderPlFilters();
  renderPlBody();
}

function renderPlFilters() {
  const fb = document.getElementById('pl-filters');
  if (!fb) return;
  const clientOpts = `<option value="">Todas as empresas</option>${_plClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
  fb.innerHTML = `
    <button class="btn btn-ghost btn-sm" data-action="pl-change-month" data-dir="-1"><i class="fas fa-chevron-left"></i></button>
    <span id="pl-month-label" style="font-size:15px;font-weight:700;min-width:160px;text-align:center">${PL_MONTHS[plDate.getMonth()]} ${plDate.getFullYear()}</span>
    <button class="btn btn-ghost btn-sm" data-action="pl-change-month" data-dir="1"><i class="fas fa-chevron-right"></i></button>
    <select class="filter-select" id="pl-f-client" onchange="applyPlFilters()">${clientOpts}</select>
    <select class="filter-select" id="pl-f-prod" onchange="applyPlFilters()">
      <option value="">Produção: todas</option><option>Planejado</option><option>Em Produção</option><option>Produzido</option>
    </select>
    <select class="filter-select" id="pl-f-appr" onchange="applyPlFilters()">
      <option value="">Aprovação: todas</option><option>Aguardando</option><option>Aprovado</option><option>Ajuste</option>
    </select>
  `;
  if (plFilters.client) document.getElementById('pl-f-client').value = plFilters.client;
  if (plFilters.production) document.getElementById('pl-f-prod').value = plFilters.production;
  if (plFilters.approval) document.getElementById('pl-f-appr').value = plFilters.approval;
}

function applyPlFilters() {
  plFilters.client = document.getElementById('pl-f-client')?.value || '';
  plFilters.production = document.getElementById('pl-f-prod')?.value || '';
  plFilters.approval = document.getElementById('pl-f-appr')?.value || '';
  renderPlBody();
}

function getPlFiltered(monthOnly = true) {
  return _plData.filter(p => {
    if (plFilters.client && String(p.client_id) !== String(plFilters.client)) return false;
    if (plFilters.production && p.production_status !== plFilters.production) return false;
    if (plFilters.approval && p.approval_status !== plFilters.approval) return false;
    if (monthOnly && p.planned_date) {
      const d = new Date(p.planned_date + 'T00:00:00');
      if (d.getMonth() !== plDate.getMonth() || d.getFullYear() !== plDate.getFullYear()) return false;
    }
    return true;
  });
}

function renderPlBody() {
  const el = document.getElementById('pl-body');
  if (!el) return;
  el.innerHTML = plView === 'calendario' ? buildPlCalendar() : buildPlTable();
}

function _plClientName(p) {
  return (p.client && typeof p.client === 'object') ? p.client.name : (SC.getClientName(p.client_id) || 'N/A');
}
function _plProdTag(s) {
  const c = { 'Planejado': 'gray', 'Em Produção': 'blue', 'Produzido': 'green' }[s] || 'gray';
  return `<span class="tag tag-${c}">${s}</span>`;
}
function _plApprTag(s) {
  const c = { 'Aguardando': 'yellow', 'Aprovado': 'green', 'Ajuste': 'red' }[s] || 'gray';
  return `<span class="tag tag-${c}">${s}</span>`;
}

function buildPlTable() {
  const rows = getPlFiltered().sort((a, b) => (a.planned_date || '').localeCompare(b.planned_date || ''));
  if (!rows.length) return `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>Nenhum planejamento neste mês. Clique em "Novo Planejamento".</p></div>`;
  const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Data</th><th>Empresa</th><th>Conteúdo</th><th>Formato</th><th>Responsável</th>
          <th>Redes</th><th>Produção</th><th>Aprovação</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(p => {
            const d = p.planned_date ? new Date(p.planned_date + 'T00:00:00') : null;
            const resp = (p.assignee && typeof p.assignee === 'object') ? p.assignee.full_name : '—';
            return `
              <tr style="cursor:pointer" data-action="pl-open-edit" data-id="${p.id}">
                <td><strong>${p.planned_date ? formatDateBR(p.planned_date) : '—'}</strong><div style="font-size:11px;color:var(--text-muted)">${d ? wd[d.getDay()] : ''}</div></td>
                <td>${_plClientName(p)}</td>
                <td>${p.title || ''}</td>
                <td>${p.format || '—'}</td>
                <td>${resp}</td>
                <td>${(p.channels || []).map(c => `<span class="tag tag-purple" style="font-size:10px">${c}</span>`).join(' ') || '—'}</td>
                <td>${_plProdTag(p.production_status)}</td>
                <td>${_plApprTag(p.approval_status)}</td>
                <td style="white-space:nowrap" onclick="event.stopPropagation()">
                  ${p.approval_status !== 'Aprovado'
                    ? `<button class="btn btn-success btn-sm" data-action="pl-approve" data-id="${p.id}" title="Aprovar e gerar card"><i class="fas fa-check"></i></button>`
                    : `<span class="tag tag-green" style="font-size:10px"><i class="fas fa-arrow-right"></i> Card gerado</span>`}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function buildPlCalendar() {
  const year = plDate.getFullYear(), month = plDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = new Date();
  const items = getPlFiltered();
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let cells = dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  for (let i = firstDay - 1; i >= 0; i--) cells += `<div class="cal-cell other-month"><div class="cal-day">${daysInPrev - i}</div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayItems = items.filter(p => p.planned_date === dateStr);
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    cells += `
      <div class="cal-cell ${isToday ? 'today' : ''}">
        <div class="cal-day">${d}</div>
        ${dayItems.slice(0, 3).map(p => {
          const cls = p.approval_status === 'Aprovado' ? '' : p.approval_status === 'Ajuste' ? 'pending' : 'pending';
          return `<div class="cal-event ${cls}" data-action="pl-open-edit" data-id="${p.id}" title="${_plClientName(p)} — ${p.title}">${(p.title || '').slice(0, 18)}</div>`;
        }).join('')}
        ${dayItems.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:2px 4px">+${dayItems.length - 3} mais</div>` : ''}
      </div>`;
  }
  const total = firstDay + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= rem; d++) cells += `<div class="cal-cell other-month"><div class="cal-day">${d}</div></div>`;

  return `<div class="calendar-grid">${cells}</div>`;
}

function setPlView(v) {
  plView = v;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (event?.target?.closest) event.target.closest('.tab-btn')?.classList.add('active');
  renderPlBody();
}

function changePlMonth(dir) {
  plDate = new Date(plDate.getFullYear(), plDate.getMonth() + dir, 1);
  const lbl = document.getElementById('pl-month-label');
  if (lbl) lbl.textContent = `${PL_MONTHS[plDate.getMonth()]} ${plDate.getFullYear()}`;
  renderPlBody();
}

// ─── MODAL NOVO/EDITAR ───────────────────────
function openPlanningModal(id) {
  const p = id ? _plData.find(x => String(x.id) === String(id)) : null;
  const clientOpts = _plClients.map(c => `<option value="${c.id}" ${p && String(p.client_id) === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('');
  const empOpts = `<option value="">—</option>` + _plProfiles.map(e => `<option value="${e.id}" ${p && String(p.assignee_id) === String(e.id) ? 'selected' : ''}>${e.full_name}</option>`).join('');
  const fmtOpts = PL_FORMATS.map(f => `<option ${p && p.format === f ? 'selected' : ''}>${f}</option>`).join('');
  const chans = p?.channels || [];
  const prodOpts = ['Planejado', 'Em Produção', 'Produzido'].map(s => `<option ${p && p.production_status === s ? 'selected' : ''}>${s}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-calendar-plus" style="color:var(--purple-light);margin-right:8px"></i>${p ? 'Editar' : 'Novo'} Planejamento</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Empresa *</label><select class="select-field" id="pl-client">${clientOpts}</select></div>
        <div class="form-col"><label>Data *</label><input type="date" class="input-field" id="pl-date" value="${p?.planned_date || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Conteúdo / Título *</label><input class="input-field" id="pl-title" value="${(p?.title || '').replace(/"/g, '&quot;')}" placeholder="Ex.: Placar da Produtividade"></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Formato</label><select class="select-field" id="pl-format">${fmtOpts}</select></div>
        <div class="form-col"><label>Responsável</label><select class="select-field" id="pl-assignee">${empOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Redes</label>
          <div style="display:flex;gap:14px;flex-wrap:wrap;padding-top:4px">
            ${PL_CHANNELS.map(c => `<label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:400"><input type="checkbox" class="pl-chan" value="${c}" ${chans.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Produção</label><select class="select-field" id="pl-prod">${prodOpts}</select></div>
        <div class="form-col"><label>&nbsp;</label><div style="font-size:12px;color:var(--text-muted);padding-top:10px"><i class="fas fa-info-circle"></i> A aprovação é feita pelo botão ✓ na lista.</div></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Descrição / Observações</label><textarea class="input-field" id="pl-content" rows="3">${p?.content || ''}</textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      ${p ? `<button class="btn btn-sm btn-danger" data-action="pl-delete" data-id="${p.id}"><i class="fas fa-trash"></i> Excluir</button>` : ''}
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="pl-btn-save" data-action="pl-save" data-id="${p?.id || ''}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `, 'modal-lg');
}

async function savePlanning(id) {
  const title = document.getElementById('pl-title').value.trim();
  const client_id = document.getElementById('pl-client').value;
  const planned_date = document.getElementById('pl-date').value || null;
  if (!title) { showToast('Informe o conteúdo/título!', 'error'); return; }
  if (!client_id) { showToast('Selecione a empresa!', 'error'); return; }

  const channels = Array.from(document.querySelectorAll('.pl-chan:checked')).map(c => c.value);
  const payload = {
    client_id, title, planned_date,
    content: document.getElementById('pl-content').value.trim(),
    format: document.getElementById('pl-format').value,
    assignee_id: document.getElementById('pl-assignee').value || null,
    production_status: document.getElementById('pl-prod').value,
    channels,
  };

  const btn = document.getElementById('pl-btn-save');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const res = id ? await DB.plannings.update(id, payload) : await DB.plannings.create(payload);
  if (res.error) {
    showToast(`Erro: ${res.error.message}`, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
    return;
  }
  closeModal();
  showToast('✅ Planejamento salvo!', 'success');
  await renderPlanejamentos();
}

async function deletePlanning(id) {
  if (!confirm('Excluir este planejamento?')) return;
  await DB.plannings.remove(id);
  closeModal();
  showToast('Planejamento excluído.', 'info');
  await renderPlanejamentos();
}

// Aprovar → marca aprovado e gera card no Kanban
async function approvePlanning(id) {
  const p = _plData.find(x => String(x.id) === String(id));
  if (!p) return;

  const cols = await Data.kanbanColumns();
  const firstCol = cols[0]?.key || 'Pauta';

  const { error: taskErr } = await DB.tasks.create({
    title: p.title,
    text: p.content || '',
    client_id: p.client_id,
    assignee_id: p.assignee_id || null,
    art_type: p.format || null,
    content_type: p.format || 'Post Estático',
    deadline: p.planned_date,
    post_date: p.planned_date,
    status: firstCol,
    priority: _plPriorityFromDeadline(p.planned_date),
    origin: 'planejamento',
    planning_id: p.id,
  });
  if (taskErr) { showToast(`Erro ao gerar card: ${taskErr.message}`, 'error'); return; }

  await DB.plannings.update(id, { approval_status: 'Aprovado' });
  await logActivity('planning.approved', 'planning', id, JSON.stringify({ title: p.title }));
  showToast('✅ Aprovado! Card gerado no Kanban.', 'success');
  await renderPlanejamentos();
}

Router.register('planejamentos', renderPlanejamentos, 'Planejamentos');
