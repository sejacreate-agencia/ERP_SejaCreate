// =============================================
// SEJA CREATE — CALENDÁRIO
// =============================================

let calMode = 'mensal';
let calDate = new Date();
let calFilters = { client: '', assignee: '', status: '' };

function renderCalendario() {
  const clientOpts = `<option value="">Todos os clientes</option>${SC.clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}`;
  const empOpts = `<option value="">Todos</option>${SC.employees.map(e=>`<option value="${e.id}">${e.name.split(' ')[0]}</option>`).join('')}`;
  const statusOpts = `<option value="">Todos os status</option>${SC.kanbanCols.map(s=>`<option value="${s}">${s}</option>`).join('')}`;

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Calendário de Publicações</h1>
          <p class="page-subtitle">Visualize e acompanhe os conteúdos aprovados e programados</p>
        </div>
        <div class="page-actions">
          <div class="tabs" style="margin:0">
            <button class="tab-btn ${calMode==='mensal'?'active':''}" data-action="set-cal-mode" data-mode="mensal"><i class="fas fa-calendar"></i> Mensal</button>
            <button class="tab-btn ${calMode==='semanal'?'active':''}" data-action="set-cal-mode" data-mode="semanal"><i class="fas fa-calendar-week"></i> Semanal</button>
          </div>
        </div>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="filters-bar">
      <button class="btn btn-ghost btn-sm" data-action="change-month" data-dir="-1"><i class="fas fa-chevron-left"></i></button>
      <span id="cal-month-label" style="font-size:15px;font-weight:700;min-width:180px;text-align:center">
        ${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}
      </span>
      <button class="btn btn-ghost btn-sm" data-action="change-month" data-dir="1"><i class="fas fa-chevron-right"></i></button>
      <div style="margin-left:10px;display:flex;gap:8px;flex-wrap:wrap">
        <select class="filter-select" id="cal-client" onchange="applyCalFilters()">${clientOpts}</select>
        <select class="filter-select" id="cal-assignee" onchange="applyCalFilters()">${empOpts}</select>
        <select class="filter-select" id="cal-status" onchange="applyCalFilters()">${statusOpts}</select>
      </div>
    </div>

    <!-- LEGEND -->
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px"><div style="width:10px;height:10px;border-radius:50%;background:var(--purple)"></div> Programado/Aprovado</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px"><div style="width:10px;height:10px;border-radius:50%;background:var(--success)"></div> Publicado</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px"><div style="width:10px;height:10px;border-radius:50%;background:var(--warning)"></div> Pendente</div>
    </div>

    <div id="cal-grid-area">
      ${renderCalGrid()}
    </div>

    <!-- UPCOMING LIST -->
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-list" style="color:var(--purple-light);margin-right:8px"></i>Posts do Mês — Detalhado</span>
      </div>
      <div id="upcoming-list">${renderUpcomingList()}</div>
    </div>
  `;
}

function getCalendarTasks() {
  return SC.tasks.filter(t => {
    if (!t.postDate) return false;
    const d = new Date(t.postDate + 'T00:00:00');
    if (d.getMonth() !== calDate.getMonth() || d.getFullYear() !== calDate.getFullYear()) return false;
    if (calFilters.client && t.client !== parseInt(calFilters.client)) return false;
    if (calFilters.assignee && t.assignee !== parseInt(calFilters.assignee)) return false;
    if (calFilters.status && t.status !== calFilters.status) return false;
    return true;
  });
}

function renderCalGrid() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = new Date();
  const tasks = getCalendarTasks();
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  let cells = '';
  const headers = dayNames.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  // Prev month cells
  for (let i = firstDay - 1; i >= 0; i--) {
    cells += `<div class="cal-cell other-month"><div class="cal-day">${daysInPrev - i}</div></div>`;
  }

  // Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayTasks = tasks.filter(t => t.postDate === dateStr);
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    cells += `
      <div class="cal-cell ${isToday ? 'today' : ''}">
        <div class="cal-day">${d}</div>
        ${dayTasks.slice(0,3).map(t => {
          const cls = t.status === 'Publicado' ? 'published' : t.status === 'Aprovado' || t.status === 'Programado' ? '' : 'pending';
          return `<div class="cal-event ${cls}" title="${SC.getClientName(t.client)} — ${t.title}" data-action="open-task-modal" data-id="${t.id}">${t.title.slice(0,20)}${t.title.length>20?'…':''}</div>`;
        }).join('')}
        ${dayTasks.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:2px 4px">+${dayTasks.length-3} mais</div>` : ''}
      </div>`;
  }

  // Fill remaining cells
  const total = firstDay + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= rem; d++) {
    cells += `<div class="cal-cell other-month"><div class="cal-day">${d}</div></div>`;
  }

  return `
    <div class="calendar-grid">
      ${headers}
      ${cells}
    </div>`;
}

function renderUpcomingList() {
  const tasks = getCalendarTasks().sort((a, b) => a.postDate.localeCompare(b.postDate));
  if (!tasks.length) return `<div class="empty-state" style="padding:20px"><i class="fas fa-calendar-times"></i><p>Nenhum post neste mês com os filtros selecionados</p></div>`;
  return tasks.map(t => {
    const emp = SC.users.find(u => u.id === t.assignee);
    const sc = SC.statusColor(t.status);
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border-light);cursor:pointer" data-action="open-task-modal" data-id="${t.id}">
        <div style="min-width:50px;text-align:center;background:var(--bg-input);border-radius:8px;padding:6px">
          <div style="font-size:18px;font-weight:800">${t.postDate.split('-')[2]}</div>
          <div style="font-size:10px;color:var(--text-muted)">${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(t.postDate.split('-')[1])-1]}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</div>
          <div style="font-size:11px;color:var(--text-purple);margin-top:2px"><i class="fas fa-building" style="font-size:10px"></i> ${SC.getClientName(t.client)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <span class="tag tag-${sc}" style="font-size:11px">${t.status}</span>
          <div style="display:flex;align-items:center;gap:5px">
            <div class="avatar-xs">${SC.getEmployeeAvatar(t.assignee)}</div>
            <span style="font-size:11px;color:var(--text-muted)">${emp ? emp.name.split(' ')[0] : '?'}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function changeMonth(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + dir, 1);
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;
  document.getElementById('cal-grid-area').innerHTML = renderCalGrid();
  document.getElementById('upcoming-list').innerHTML = renderUpcomingList();
}

function setCalMode(mode) {
  calMode = mode;
  renderCalendario();
}

function applyCalFilters() {
  calFilters.client = document.getElementById('cal-client').value;
  calFilters.assignee = document.getElementById('cal-assignee').value;
  calFilters.status = document.getElementById('cal-status').value;
  document.getElementById('cal-grid-area').innerHTML = renderCalGrid();
  document.getElementById('upcoming-list').innerHTML = renderUpcomingList();
}

Router.register('calendario', renderCalendario, 'Calendário');
