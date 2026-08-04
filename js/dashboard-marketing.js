// =============================================
// SEJA CREATE — DASHBOARD DE MARKETING
// =============================================
// Indicadores das solicitações de arte: KPIs, gráficos e análise de
// tempo por etapa do Kanban (a partir de task_status_history).
// Exporta em PDF e XLSX.

let _dmTasks = [];
let _dmHistory = [];
let _dmClients = [];
let _dmProfiles = [];
let _dmFilters = { period: '30d', client: '', priority: '' };
const _dmCharts = {};
const DM_COLORS = ['#ac5ec0', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#84cc16'];

async function renderDashboardMarketing() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Dashboard de Marketing</h1>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" data-action="dm-export-pdf"><i class="fas fa-file-pdf"></i> PDF</button>
          <button class="btn btn-secondary btn-sm" data-action="dm-export-xlsx"><i class="fas fa-file-excel"></i> Excel</button>
        </div>
      </div>
    </div>
    <div class="filters-bar" id="dm-filters" style="margin-bottom:16px"></div>
    <div id="dm-body"><div class="loading-state" style="padding:60px 0"><i class="fas fa-spinner fa-spin" style="font-size:26px"></i></div></div>
  `;

  _dmTasks = await Data.tasks();
  _dmClients = await Data.clients();
  _dmProfiles = await Data.profiles();
  _dmHistory = [];
  if (isSupabaseReady()) {
    const { data } = await DB.taskStatusHistory.listAll();
    _dmHistory = data || [];
  }

  renderDmFilters();
  renderDmBody();
}

function renderDmFilters() {
  const fb = document.getElementById('dm-filters');
  if (!fb) return;
  const clientOpts = `<option value="">Todas as empresas</option>${_dmClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
  fb.innerHTML = `
    <select class="filter-select" id="dm-period" onchange="applyDmFilters()">
      <option value="7d">Últimos 7 dias</option>
      <option value="30d">Últimos 30 dias</option>
      <option value="90d">Últimos 90 dias</option>
      <option value="all">Todo o período</option>
    </select>
    <select class="filter-select" id="dm-client" onchange="applyDmFilters()">${clientOpts}</select>
    <select class="filter-select" id="dm-priority" onchange="applyDmFilters()">
      <option value="">Todas as prioridades</option>
      <option value="alta">🔴 Urgente</option>
      <option value="media">🟡 Média</option>
      <option value="baixa">🟢 Baixa</option>
    </select>
  `;
  document.getElementById('dm-period').value = _dmFilters.period;
  if (_dmFilters.client) document.getElementById('dm-client').value = _dmFilters.client;
  if (_dmFilters.priority) document.getElementById('dm-priority').value = _dmFilters.priority;
}

function applyDmFilters() {
  _dmFilters.period = document.getElementById('dm-period')?.value || '30d';
  _dmFilters.client = document.getElementById('dm-client')?.value || '';
  _dmFilters.priority = document.getElementById('dm-priority')?.value || '';
  renderDmBody();
}

function getDmTasks() {
  const now = new Date();
  const days = { '7d': 7, '30d': 30, '90d': 90 }[_dmFilters.period];
  return _dmTasks.filter(t => {
    const clientId = t.client_id !== undefined ? t.client_id : t.client;
    if (_dmFilters.client && String(clientId) !== String(_dmFilters.client)) return false;
    if (_dmFilters.priority && t.priority !== _dmFilters.priority) return false;
    if (days) {
      const ref = t.created_at || t.deadline || t.post_date || t.postDate;
      if (!ref) return false;
      const diff = (now - new Date(ref)) / 86400000;
      if (diff > days) return false;
    }
    return true;
  });
}

// ─── ANÁLISE DE TEMPO (a partir do histórico) ───
function _dmMs(ms) {
  if (!ms || ms < 0) return '—';
  const h = ms / 3600000;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

// Retorna { perColumn: {status: {totalMs, segments}}, perCardMs: [ms...] }
function computeTimeAnalysis(taskIds) {
  const byTask = {};
  _dmHistory.forEach(h => {
    if (taskIds && !taskIds.has(h.task_id)) return;
    (byTask[h.task_id] = byTask[h.task_id] || []).push(h);
  });
  const perColumn = {};
  const perCardMs = [];
  const now = Date.now();
  Object.values(byTask).forEach(rows => {
    rows.sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
    if (rows.length) {
      const span = new Date(rows[rows.length - 1].changed_at) - new Date(rows[0].changed_at);
      if (span > 0) perCardMs.push(span);
    }
    rows.forEach((r, i) => {
      const enter = new Date(r.changed_at).getTime();
      const exit = rows[i + 1] ? new Date(rows[i + 1].changed_at).getTime() : now;
      const left = !!rows[i + 1];
      const dur = exit - enter;
      if (!left) return; // só conta segmentos concluídos (coluna já deixada)
      const st = r.to_status;
      perColumn[st] = perColumn[st] || { totalMs: 0, segments: 0 };
      perColumn[st].totalMs += dur;
      perColumn[st].segments += 1;
    });
  });
  return { perColumn, perCardMs };
}

function renderDmBody() {
  const el = document.getElementById('dm-body');
  if (!el) return;
  const tasks = getDmTasks();
  const ids = new Set(tasks.map(t => t.id));
  const ta = computeTimeAnalysis(ids);

  // KPIs
  const overdue = tasks.filter(t => {
    const d = t.deadline || t.post_date || t.postDate;
    return d && new Date(d) < new Date(new Date().toDateString()) && t.status !== 'Publicado';
  }).length;
  const urgentes = tasks.filter(t => t.priority === 'alta' && t.status !== 'Publicado').length;
  const emAndamento = tasks.filter(t => !['Aprovado', 'Programado', 'Publicado'].includes(t.status)).length;
  const aprovado = tasks.filter(t => ['Aprovado', 'Programado', 'Publicado'].includes(t.status)).length;
  const alteracoes = tasks.filter(t => t.status === 'Ajuste Solicitado').length;
  const avgCard = ta.perCardMs.length ? ta.perCardMs.reduce((a, b) => a + b, 0) / ta.perCardMs.length : 0;

  // Maior gargalo
  let gargalo = { st: '—', avg: 0 };
  Object.entries(ta.perColumn).forEach(([st, v]) => {
    const avg = v.totalMs / v.segments;
    if (avg > gargalo.avg) gargalo = { st, avg };
  });

  const kpi = (icon, color, value, label) => `
    <div class="kpi-card">
      <div class="kpi-icon ${color}"><i class="fas ${icon}"></i></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
    </div>`;

  el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:20px">
      ${kpi('fa-clipboard-list', 'purple', tasks.length, 'Total de Solicitações')}
      ${kpi('fa-spinner', 'blue', emAndamento, 'Em Andamento')}
      ${kpi('fa-check-circle', 'green', aprovado, 'Aprovadas')}
      ${kpi('fa-redo', 'yellow', alteracoes, 'Em Alteração')}
      ${kpi('fa-exclamation-triangle', 'red', overdue, 'Atrasadas')}
      ${kpi('fa-fire', 'red', urgentes, 'Urgentes')}
      ${kpi('fa-stopwatch', 'purple', _dmMs(avgCard), 'Tempo Médio / Card')}
      ${kpi('fa-hourglass-half', 'yellow', gargalo.st === '—' ? '—' : gargalo.st, 'Maior Gargalo')}
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Por Status</h3><div style="height:260px"><canvas id="dm-c-status"></canvas></div></div>
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Por Prioridade</h3><div style="height:260px"><canvas id="dm-c-priority"></canvas></div></div>
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Por Empresa</h3><div style="height:260px"><canvas id="dm-c-client"></canvas></div></div>
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Solicitações por Mês</h3><div style="height:260px"><canvas id="dm-c-month"></canvas></div></div>
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Top Tipos de Arte</h3><div style="height:260px"><canvas id="dm-c-type"></canvas></div></div>
      <div class="card"><h3 style="margin:0 0 12px;font-size:14px">Tempo Médio por Coluna</h3><div style="height:260px"><canvas id="dm-c-coltime"></canvas></div></div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 12px;font-size:14px">Permanência média por etapa</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Etapa</th><th>Passagens</th><th>Tempo médio</th></tr></thead>
          <tbody>${renderColTimeRows(ta.perColumn)}</tbody>
        </table>
      </div>
    </div>
  `;

  setTimeout(() => drawDmCharts(tasks, ta), 100);
}

function renderColTimeRows(perColumn) {
  const rows = Object.entries(perColumn).map(([st, v]) => ({ st, seg: v.segments, avg: v.totalMs / v.segments }))
    .sort((a, b) => b.avg - a.avg);
  if (!rows.length) return `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">Sem histórico ainda — mova cards entre colunas para gerar dados.</td></tr>`;
  return rows.map(r => `<tr><td>${r.st}</td><td>${r.seg}</td><td>${_dmMs(r.avg)}</td></tr>`).join('');
}

function _dmChartOpts(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9090a8', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#9090a8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#9090a8' }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  }, extra);
}

function drawDmCharts(tasks, ta) {
  if (typeof Chart === 'undefined') return;
  Object.values(_dmCharts).forEach(c => { try { c.destroy(); } catch (e) {} });

  const countBy = (fn) => {
    const m = {};
    tasks.forEach(t => { const k = fn(t) || '—'; m[k] = (m[k] || 0) + 1; });
    return m;
  };

  // Status (doughnut)
  const st = countBy(t => t.status);
  _dmCharts.status = new Chart(document.getElementById('dm-c-status'), {
    type: 'doughnut',
    data: { labels: Object.keys(st), datasets: [{ data: Object.values(st), backgroundColor: DM_COLORS }] },
    options: _dmChartOpts({ scales: {}, plugins: { legend: { position: 'right', labels: { color: '#9090a8', font: { size: 10 } } } } })
  });

  // Prioridade (doughnut)
  const pr = countBy(t => ({ alta: 'Urgente', media: 'Média', baixa: 'Baixa' }[t.priority] || t.priority));
  _dmCharts.priority = new Chart(document.getElementById('dm-c-priority'), {
    type: 'doughnut',
    data: { labels: Object.keys(pr), datasets: [{ data: Object.values(pr), backgroundColor: ['#ef4444', '#f59e0b', '#10b981'] }] },
    options: _dmChartOpts({ scales: {}, plugins: { legend: { position: 'right', labels: { color: '#9090a8', font: { size: 11 } } } } })
  });

  // Empresa (bar horizontal)
  const cl = countBy(t => (t.client && typeof t.client === 'object') ? t.client.name : SC.getClientName(t.client_id || t.client));
  const clTop = Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 8);
  _dmCharts.client = new Chart(document.getElementById('dm-c-client'), {
    type: 'bar',
    data: { labels: clTop.map(x => x[0]), datasets: [{ data: clTop.map(x => x[1]), backgroundColor: '#ac5ec0aa', borderRadius: 6 }] },
    options: _dmChartOpts({ indexAxis: 'y', plugins: { legend: { display: false } } })
  });

  // Por mês (bar)
  const mNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mo = {};
  tasks.forEach(t => {
    const ref = t.created_at || t.deadline || t.post_date || t.postDate;
    if (!ref) return;
    const d = new Date(ref);
    const k = `${mNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    mo[k] = (mo[k] || 0) + 1;
  });
  _dmCharts.month = new Chart(document.getElementById('dm-c-month'), {
    type: 'bar',
    data: { labels: Object.keys(mo), datasets: [{ data: Object.values(mo), backgroundColor: '#3b82f6', borderRadius: 6 }] },
    options: _dmChartOpts({ plugins: { legend: { display: false } } })
  });

  // Tipos (bar horizontal)
  const ty = countBy(t => t.art_type || t.content_type);
  const tyTop = Object.entries(ty).sort((a, b) => b[1] - a[1]).slice(0, 8);
  _dmCharts.type = new Chart(document.getElementById('dm-c-type'), {
    type: 'bar',
    data: { labels: tyTop.map(x => x[0]), datasets: [{ data: tyTop.map(x => x[1]), backgroundColor: '#10b981aa', borderRadius: 6 }] },
    options: _dmChartOpts({ indexAxis: 'y', plugins: { legend: { display: false } } })
  });

  // Tempo médio por coluna (bar, em horas)
  const colRows = Object.entries(ta.perColumn).map(([s, v]) => ({ s, h: (v.totalMs / v.segments) / 3600000 })).sort((a, b) => b.h - a.h);
  _dmCharts.coltime = new Chart(document.getElementById('dm-c-coltime'), {
    type: 'bar',
    data: { labels: colRows.map(x => x.s), datasets: [{ label: 'horas', data: colRows.map(x => x.h.toFixed(1)), backgroundColor: '#f59e0baa', borderRadius: 6 }] },
    options: _dmChartOpts({ indexAxis: 'y', plugins: { legend: { display: false } } })
  });
}

// ─── EXPORTAÇÃO ──────────────────────────────
function _dmSummaryRows() {
  const tasks = getDmTasks();
  const ta = computeTimeAnalysis(new Set(tasks.map(t => t.id)));
  const byStatus = {};
  tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
  return { tasks, ta, byStatus };
}

function exportDmPdf() {
  if (!window.jspdf) { showToast('Biblioteca de PDF não carregada.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { tasks, ta, byStatus } = _dmSummaryRows();
  doc.setFontSize(16); doc.text('Dashboard de Marketing — Seja Create', 14, 18);
  doc.setFontSize(10); doc.setTextColor(120);
  doc.text(`Período: ${_dmFilters.period} · Total de solicitações: ${tasks.length}`, 14, 26);

  doc.autoTable({
    startY: 34, head: [['Status', 'Qtd']],
    body: Object.entries(byStatus).map(([s, n]) => [s, String(n)]),
    theme: 'striped', headStyles: { fillColor: [172, 94, 192] }
  });
  const colRows = Object.entries(ta.perColumn).map(([s, v]) => [s, String(v.segments), _dmMs(v.totalMs / v.segments)]);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8, head: [['Etapa', 'Passagens', 'Tempo médio']],
    body: colRows.length ? colRows : [['—', '—', '—']],
    theme: 'striped', headStyles: { fillColor: [172, 94, 192] }
  });
  doc.save(`dashboard-marketing-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportDmXlsx() {
  if (!window.XLSX) { showToast('Biblioteca de Excel não carregada.', 'error'); return; }
  const { tasks, ta, byStatus } = _dmSummaryRows();
  const wb = XLSX.utils.book_new();

  const solic = tasks.map(t => ({
    Numero: t.request_number || '',
    Titulo: t.title || '',
    Empresa: (t.client && typeof t.client === 'object') ? t.client.name : SC.getClientName(t.client_id || t.client),
    Tipo: t.art_type || t.content_type || '',
    Prioridade: { alta: 'Urgente', media: 'Média', baixa: 'Baixa' }[t.priority] || t.priority,
    Status: t.status,
    Prazo: t.deadline || t.post_date || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(solic), 'Solicitações');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    Object.entries(byStatus).map(([Status, Qtd]) => ({ Status, Qtd }))), 'Por Status');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    Object.entries(ta.perColumn).map(([Etapa, v]) => ({ Etapa, Passagens: v.segments, 'Tempo médio': _dmMs(v.totalMs / v.segments) }))), 'Tempo por Etapa');

  XLSX.writeFile(wb, `dashboard-marketing-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

Router.register('dashboard-marketing', renderDashboardMarketing, 'Dashboard de Marketing');
