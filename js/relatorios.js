// =============================================
// SEJA CREATE — RELATÓRIOS (com dados reais)
// =============================================

let relCharts = {};
let currentReport = null;
let relFilters = { period: '', client: '', assignee: '' };
let _relTasks = [], _relClients = [], _relProfiles = [], _relReceivables = [];

async function renderRelatorios() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Relatórios</h1>
          <p class="page-subtitle">Análise completa de desempenho da agência</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="export-report"><i class="fas fa-download"></i> Exportar</button>
        </div>
      </div>
    </div>

    <!-- FILTROS GLOBAIS -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:600">PERÍODO</div>
          <select class="select-field" id="rel-period" onchange="applyRelFilters()" style="width:160px">
            <option value="">Todos os períodos</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="mar2025">Março 2025</option>
            <option value="fev2025">Fevereiro 2025</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:600">CLIENTE</div>
          <select class="select-field" id="rel-client" onchange="applyRelFilters()" style="width:180px">
            <option value="">Todos os clientes</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px;font-weight:600">RESPONSÁVEL</div>
          <select class="select-field" id="rel-assignee" onchange="applyRelFilters()" style="width:180px">
            <option value="">Toda a equipe</option>
          </select>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="clear-rel-filters"><i class="fas fa-times"></i> Limpar</button>
        <div id="rel-loading" style="display:none;color:var(--text-muted);font-size:12px">
          <i class="fas fa-spinner fa-spin"></i> Carregando...
        </div>
      </div>
    </div>

    <div id="rel-content">
      <div class="loading-state" style="padding:60px 0">
        <i class="fas fa-spinner fa-spin" style="font-size:32px"></i>
        <span style="margin-top:12px;display:block">Carregando dados...</span>
      </div>
    </div>
  `;

  // Carrega todos os dados em paralelo
  [_relTasks, _relClients, _relProfiles, _relReceivables] = await Promise.all([
    Data.tasks(), Data.clients(), Data.profiles(), Data.receivables()
  ]);

  // Popula selects de filtro
  const clientSel = document.getElementById('rel-client');
  const assigneeSel = document.getElementById('rel-assignee');
  if (clientSel) {
    _relClients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.name;
      clientSel.appendChild(opt);
    });
  }
  if (assigneeSel) {
    _relProfiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.full_name;
      assigneeSel.appendChild(opt);
    });
  }

  renderRelContent();
}

function applyRelFilters() {
  relFilters.period = document.getElementById('rel-period')?.value || '';
  relFilters.client = document.getElementById('rel-client')?.value || '';
  relFilters.assignee = document.getElementById('rel-assignee')?.value || '';
  renderRelContent();
}

function clearRelFilters() {
  relFilters = { period: '', client: '', assignee: '' };
  ['rel-period','rel-client','rel-assignee'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderRelContent();
}

function getFilteredRelTasks() {
  let tasks = [..._relTasks];

  if (relFilters.client) {
    tasks = tasks.filter(t => String(t.client_id || t.client) === String(relFilters.client));
  }
  if (relFilters.assignee) {
    tasks = tasks.filter(t => String(t.assignee_id || t.assignee) === String(relFilters.assignee));
  }
  if (relFilters.period) {
    const now = new Date();
    let cutoff = null;
    if (relFilters.period === '7d') cutoff = new Date(now - 7*86400000);
    if (relFilters.period === '30d') cutoff = new Date(now - 30*86400000);
    if (relFilters.period === '90d') cutoff = new Date(now - 90*86400000);
    if (relFilters.period === 'mar2025') {
      tasks = tasks.filter(t => { const d = t.post_date || t.postDate; return d && d.startsWith('2025-03'); });
    } else if (relFilters.period === 'fev2025') {
      tasks = tasks.filter(t => { const d = t.post_date || t.postDate; return d && d.startsWith('2025-02'); });
    } else if (cutoff) {
      tasks = tasks.filter(t => {
        const d = t.post_date || t.postDate || t.created_at || t.created;
        return d && new Date(d) >= cutoff;
      });
    }
  }
  return tasks;
}

function renderRelContent() {
  // Destrói charts anteriores
  Object.values(relCharts).forEach(c => { try { c.destroy(); } catch {} });
  relCharts = {};

  const tasks = getFilteredRelTasks();
  const content = document.getElementById('rel-content');
  if (!content) return;

  const kpis = calcRelKPIs(tasks);

  content.innerHTML = `
    <!-- KPIs PRINCIPAIS -->
    <div class="kpi-grid" style="margin-bottom:24px">
      <div class="kpi-card">
        <div class="kpi-icon purple"><i class="fas fa-layer-group"></i></div>
        <div class="kpi-value">${kpis.total}</div>
        <div class="kpi-label">Total de Cards</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon green"><i class="fas fa-check-double"></i></div>
        <div class="kpi-value">${kpis.published}</div>
        <div class="kpi-label">Publicados</div>
        <div class="kpi-change up"><i class="fas fa-arrow-up"></i> ${kpis.pubRate}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon yellow"><i class="fas fa-redo"></i></div>
        <div class="kpi-value">${kpis.adjustments}</div>
        <div class="kpi-label">Ajustes Solicitados</div>
        <div class="kpi-change ${kpis.adjRate > 20 ? 'down' : 'up'}">
          <i class="fas ${kpis.adjRate > 20 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${kpis.adjRate}%
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon blue"><i class="fas fa-thumbs-up"></i></div>
        <div class="kpi-value">${kpis.approvalRate}%</div>
        <div class="kpi-label">Taxa de Aprovação</div>
      </div>
      <div class="kpi-card" data-perm="financial">
        <div class="kpi-icon green"><i class="fas fa-dollar-sign"></i></div>
        <div class="kpi-value" style="font-size:18px">${SC.formatCurrency(kpis.revenue)}</div>
        <div class="kpi-label">Receita Mensal</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon purple"><i class="fas fa-users"></i></div>
        <div class="kpi-value">${kpis.activeClients}</div>
        <div class="kpi-label">Clientes Ativos</div>
      </div>
    </div>

    <!-- CHARTS PRINCIPAIS -->
    <div class="grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-pie" style="color:var(--purple-light);margin-right:8px"></i>Cards por Status</span></div>
        <div style="height:260px"><canvas id="rel-chart-status"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-bar" style="color:var(--purple-light);margin-right:8px"></i>Cards por Responsável</span></div>
        <div style="height:260px"><canvas id="rel-chart-prod"></canvas></div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-bar" style="color:var(--purple-light);margin-right:8px"></i>Cards por Cliente</span></div>
        <div style="height:260px"><canvas id="rel-chart-clients"></canvas></div>
      </div>
      <div class="card" data-perm="financial">
        <div class="card-header"><span class="card-title"><i class="fas fa-dollar-sign" style="color:var(--purple-light);margin-right:8px"></i>Faturamento por Cliente</span></div>
        <div style="height:260px"><canvas id="rel-chart-revenue"></canvas></div>
      </div>
    </div>

    <!-- RELATÓRIOS INDIVIDUAIS -->
    <div class="card-header" style="margin-bottom:16px">
      <h2 style="font-size:16px;font-weight:700">Relatórios Detalhados</h2>
    </div>
    <div class="report-grid" style="margin-bottom:24px">
      ${[
        { id: 'produtividade', icon: '👥', name: 'Produtividade da Equipe', desc: 'Performance por colaborador' },
        { id: 'cards-cliente', icon: '📊', name: 'Cards por Cliente', desc: 'Distribuição de conteúdo' },
        { id: 'aprovados', icon: '✅', name: 'Conteúdos Aprovados', desc: 'Aprovados e publicados' },
        { id: 'devolvidos', icon: '🔄', name: 'Conteúdos Devolvidos', desc: 'Ajustes solicitados' },
        { id: 'calendario-pub', icon: '📅', name: 'Calendário de Publicações', desc: 'Datas e status de postagem' },
        { id: 'financeiro', icon: '💰', name: 'Faturamento por Cliente', desc: 'Receita e inadimplência', perm: true },
        { id: 'clientes-ativos', icon: '🏢', name: 'Clientes Ativos', desc: 'Status e contratos' },
        { id: 'operacional', icon: '⚡', name: 'Performance Operacional', desc: 'Funnel e eficiência' },
      ].map(r => `
        <div class="report-card" data-action="open-report" data-id="${r.id}" ${r.perm && !SC.hasPermission('financeiro') ? 'style="opacity:0.5;pointer-events:none"' : ''}>
          <div class="report-icon">${r.icon}</div>
          <div class="report-name">${r.name}</div>
          <div class="report-desc">${r.desc}</div>
          <div style="margin-top:10px"><span class="tag tag-purple" style="font-size:11px"><i class="fas fa-arrow-right"></i> Ver relatório</span></div>
        </div>`).join('')}
    </div>

    <!-- TABELA: PRODUTIVIDADE DA EQUIPE -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-table" style="color:var(--purple-light);margin-right:8px"></i>Produtividade da Equipe</span>
        <span style="font-size:12px;color:var(--text-muted)">${tasks.length} cards no período</span>
      </div>
      ${renderProdutividadeTable(tasks)}
    </div>
  `;

  // Aplica permissões
  if (!SC.hasPermission('financeiro')) {
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  }

  // Renderiza charts com delay para DOM estar pronto
  setTimeout(() => {
    renderStatusChart(tasks);
    renderProdChart(tasks);
    renderClientChart(tasks);
    if (SC.hasPermission('financeiro')) renderRevenueChart();
  }, 100);
}

/* ─── KPIs ────────────────────────────── */

function calcRelKPIs(tasks) {
  const total = tasks.length;
  const published = tasks.filter(t => t.status === 'Publicado').length;
  const approved = tasks.filter(t => ['Aprovado','Programado','Publicado'].includes(t.status)).length;
  const adjustments = tasks.filter(t => t.status === 'Ajuste Solicitado').length;
  const sent = tasks.filter(t => ['Enviado ao Cliente','Ajuste Solicitado','Aprovado','Programado','Publicado'].includes(t.status)).length;

  const pubRate = total > 0 ? Math.round(published / total * 100) : 0;
  const adjRate = total > 0 ? Math.round(adjustments / total * 100) : 0;
  const approvalRate = sent > 0 ? Math.round((approved) / total * 100) : 0;

  const activeClients = _relClients.filter(c => c.status === 'ativo').length;
  const revenue = _relClients.filter(c => c.status === 'ativo').reduce((s, c) => s + (c.monthly_revenue || c.revenue || 0), 0);

  return { total, published, approved, adjustments, sent, pubRate, adjRate, approvalRate, activeClients, revenue };
}

/* ─── CHARTS ──────────────────────────── */

const chartColors = ['#8b5cf6','#10b981','#f59e0b','#3b82f6','#ef4444','#06b6d4','#f97316','#ec4899','#84cc16'];

function renderStatusChart(tasks) {
  const ctx = document.getElementById('rel-chart-status');
  if (!ctx) return;
  const statusCounts = {};
  SC.kanbanCols.forEach(col => { statusCounts[col] = tasks.filter(t => t.status === col).length; });
  const labels = Object.keys(statusCounts).filter(k => statusCounts[k] > 0);
  const data = labels.map(k => statusCounts[k]);

  relCharts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: chartColors.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#9090a8', font: { size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/tasks.length*100)}%)` } }
      }
    }
  });
}

function renderProdChart(tasks) {
  const ctx = document.getElementById('rel-chart-prod');
  if (!ctx) return;

  const byAssignee = {};
  tasks.forEach(t => {
    const id = t.assignee_id || t.assignee;
    let name = 'N/A';
    if (t.assignee && typeof t.assignee === 'object') name = t.assignee.full_name?.split(' ')[0] || 'N/A';
    else name = SC.getEmployeeName(id)?.split(' ')[0] || 'N/A';
    if (!byAssignee[name]) byAssignee[name] = { total: 0, published: 0, adjusted: 0 };
    byAssignee[name].total++;
    if (t.status === 'Publicado') byAssignee[name].published++;
    if (t.status === 'Ajuste Solicitado') byAssignee[name].adjusted++;
  });

  const labels = Object.keys(byAssignee);
  relCharts.prod = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total', data: labels.map(l => byAssignee[l].total), backgroundColor: 'rgba(139,92,246,0.6)', borderColor: '#8b5cf6', borderWidth: 2, borderRadius: 6 },
        { label: 'Publicado', data: labels.map(l => byAssignee[l].published), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
        { label: 'Ajuste', data: labels.map(l => byAssignee[l].adjusted), backgroundColor: 'rgba(245,158,11,0.6)', borderColor: '#f59e0b', borderWidth: 2, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9090a8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9090a8' }, grid: { display: false } },
        y: { ticks: { color: '#9090a8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderClientChart(tasks) {
  const ctx = document.getElementById('rel-chart-clients');
  if (!ctx) return;

  const byClient = {};
  tasks.forEach(t => {
    const id = t.client_id !== undefined ? t.client_id : t.client;
    let name = 'N/A';
    if (t.client && typeof t.client === 'object') name = t.client.name?.split(' ').slice(0,2).join(' ') || 'N/A';
    else name = SC.getClientName(id)?.split(' ').slice(0,2).join(' ') || 'N/A';
    byClient[name] = (byClient[name] || 0) + 1;
  });

  const entries = Object.entries(byClient).sort((a,b) => b[1]-a[1]);
  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);

  relCharts.clients = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Cards', data, backgroundColor: chartColors.slice(0, labels.length).map(c => c + 'aa'), borderColor: chartColors.slice(0, labels.length), borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9090a8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function renderRevenueChart() {
  const ctx = document.getElementById('rel-chart-revenue');
  if (!ctx) return;

  const activeClients = _relClients.filter(c => c.status === 'ativo');
  const labels = activeClients.map(c => c.name.split(' ').slice(0,2).join(' '));
  const data = activeClients.map(c => c.monthly_revenue || c.revenue || 0);

  relCharts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Receita Mensal', data, backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9090a8', callback: v => 'R$ ' + (v/1000).toFixed(0) + 'k' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

/* ─── TABELA PRODUTIVIDADE ───────────────── */

function renderProdutividadeTable(tasks) {
  const byPerson = {};
  _relProfiles.forEach(p => {
    byPerson[p.id] = { name: p.full_name, cargo: p.cargo || '', total: 0, published: 0, approved: 0, adjusted: 0, active: 0 };
  });

  tasks.forEach(t => {
    const id = String(t.assignee_id || t.assignee);
    if (!byPerson[id]) {
      const name = (t.assignee && typeof t.assignee === 'object' ? t.assignee.full_name : SC.getEmployeeName(parseInt(id))) || 'N/A';
      byPerson[id] = { name, cargo: '', total: 0, published: 0, approved: 0, adjusted: 0, active: 0 };
    }
    byPerson[id].total++;
    if (t.status === 'Publicado') byPerson[id].published++;
    if (['Aprovado','Programado','Publicado'].includes(t.status)) byPerson[id].approved++;
    if (t.status === 'Ajuste Solicitado') byPerson[id].adjusted++;
    if (!['Publicado','Perdido'].includes(t.status)) byPerson[id].active++;
  });

  const rows = Object.entries(byPerson).filter(([,p]) => p.total > 0).map(([, p]) => {
    const perf = p.total > 0 ? Math.round(p.published / p.total * 100) : 0;
    const perfColor = perf >= 70 ? 'var(--success)' : perf >= 40 ? 'var(--warning)' : 'var(--danger)';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar-sm">${p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
            <div>
              <div style="font-weight:600;font-size:13px">${p.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${p.cargo}</div>
            </div>
          </div>
        </td>
        <td style="text-align:center;font-weight:700">${p.total}</td>
        <td style="text-align:center;color:var(--info)">${p.active}</td>
        <td style="text-align:center;color:var(--success)">${p.published}</td>
        <td style="text-align:center;color:var(--warning)">${p.adjusted}</td>
        <td style="text-align:center">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="progress-bar" style="flex:1;height:8px">
              <div class="progress-fill" style="width:${perf}%;background:${perfColor}"></div>
            </div>
            <span style="font-weight:700;color:${perfColor};font-size:12px;min-width:36px">${perf}%</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Colaborador</th><th style="text-align:center">Total</th><th style="text-align:center">Ativos</th><th style="text-align:center">Publicados</th><th style="text-align:center">Ajustes</th><th style="min-width:160px">Performance</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum dado para o período selecionado</td></tr>'}</tbody>
      </table>
    </div>`;
}

/* ─── RELATÓRIOS INDIVIDUAIS ─────────────── */

function openReport(id) {
  const titles = {
    produtividade: '👥 Produtividade da Equipe',
    'cards-cliente': '📊 Cards por Cliente',
    aprovados: '✅ Conteúdos Aprovados',
    devolvidos: '🔄 Conteúdos Devolvidos',
    'calendario-pub': '📅 Calendário de Publicações',
    financeiro: '💰 Faturamento por Cliente',
    'clientes-ativos': '🏢 Clientes Ativos',
    operacional: '⚡ Performance Operacional',
  };

  currentReport = id;
  const tasks = getFilteredRelTasks();

  const content = {
    produtividade: () => reportProdutividade(tasks),
    'cards-cliente': () => reportCardsPorCliente(tasks),
    aprovados: () => reportAprovados(tasks),
    devolvidos: () => reportDevolvidos(tasks),
    'calendario-pub': () => reportCalendarioPub(tasks),
    financeiro: () => reportFinanceiro(),
    'clientes-ativos': () => reportClientesAtivos(),
    operacional: () => reportOperacional(tasks),
  };

  const fn = content[id];
  if (!fn) return;

  openModal(`
    <div class="modal-header">
      <span class="modal-title">${titles[id] || 'Relatório'}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto">
      ${fn()}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="export-report"><i class="fas fa-download"></i> Exportar</button>
      <button class="btn btn-primary" data-action="close-modal">Fechar</button>
    </div>
  `, 'modal-lg');

  // Renderiza charts no modal após render
  setTimeout(() => {
    if (id === 'operacional') renderOperacionalChart(tasks);
    if (id === 'financeiro') renderFinChartModal();
  }, 100);
}

function reportProdutividade(tasks) {
  return `
    <div style="margin-bottom:16px">
      <canvas id="modal-prod-chart" style="max-height:280px"></canvas>
    </div>
    ${renderProdutividadeTable(tasks)}
  `;
}

function reportCardsPorCliente(tasks) {
  const byClient = {};
  tasks.forEach(t => {
    const id = t.client_id !== undefined ? t.client_id : t.client;
    let name = 'N/A';
    if (t.client && typeof t.client === 'object') name = t.client.name || 'N/A';
    else name = SC.getClientName(id) || 'N/A';
    if (!byClient[name]) byClient[name] = { total: 0, published: 0, adjusted: 0, approved: 0 };
    byClient[name].total++;
    if (t.status === 'Publicado') byClient[name].published++;
    if (t.status === 'Ajuste Solicitado') byClient[name].adjusted++;
    if (['Aprovado','Programado','Publicado'].includes(t.status)) byClient[name].approved++;
  });

  const entries = Object.entries(byClient).sort((a,b) => b[1].total - a[1].total);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th style="text-align:center">Total</th><th style="text-align:center">Aprovados</th><th style="text-align:center">Publicados</th><th style="text-align:center">Ajustes</th></tr></thead>
        <tbody>
          ${entries.map(([name, d]) => `
            <tr>
              <td style="font-weight:600">${name}</td>
              <td style="text-align:center">${d.total}</td>
              <td style="text-align:center;color:var(--success)">${d.approved}</td>
              <td style="text-align:center;color:var(--success)">${d.published}</td>
              <td style="text-align:center;color:var(--warning)">${d.adjusted}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Sem dados</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function reportAprovados(tasks) {
  const aprovados = tasks.filter(t => ['Aprovado','Programado','Publicado'].includes(t.status));
  return _taskTable(aprovados, 'Nenhum conteúdo aprovado no período');
}

function reportDevolvidos(tasks) {
  const devolvidos = tasks.filter(t => t.status === 'Ajuste Solicitado');
  const rows = devolvidos.map(t => {
    const comments = t.task_comments || t.comments || [];
    const lastComment = comments[comments.length - 1];
    let clientName = 'N/A';
    if (t.client && typeof t.client === 'object') clientName = t.client.name || 'N/A';
    else clientName = SC.getClientName(t.client_id || t.client) || 'N/A';
    let empAv = '?';
    if (t.assignee && typeof t.assignee === 'object') empAv = t.assignee.avatar_initials || '?';
    else empAv = SC.getEmployeeAvatar(t.assignee_id || t.assignee) || '?';

    return `
      <div class="approval-card" style="margin-bottom:12px">
        <div class="approval-body" style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-weight:600;font-size:13px">${t.title}</div>
              <div style="font-size:12px;color:var(--text-purple)">${clientName}</div>
            </div>
            <div class="avatar-sm">${empAv}</div>
          </div>
          ${lastComment ? `
            <div style="background:var(--bg-input);border-left:3px solid var(--warning);padding:10px 14px;border-radius:0 6px 6px 0;font-size:12px;color:var(--text-secondary)">
              <strong>Motivo:</strong> ${lastComment.text}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  return rows || `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success)"></i><p>Nenhum conteúdo devolvido no período!</p></div>`;
}

function reportCalendarioPub(tasks) {
  const scheduled = tasks.filter(t => t.post_date || t.postDate).sort((a,b) => {
    const da = a.post_date || a.postDate, db = b.post_date || b.postDate;
    return new Date(da) - new Date(db);
  });
  return _taskTable(scheduled, 'Nenhum conteúdo com data de postagem definida');
}

function reportFinanceiro() {
  if (!SC.hasPermission('financeiro')) return '<div class="empty-state"><i class="fas fa-lock"></i><p>Sem permissão para ver relatório financeiro</p></div>';

  const activeClients = _relClients.filter(c => c.status === 'ativo').sort((a,b) => (b.monthly_revenue||0) - (a.monthly_revenue||0));
  const totalRevenue = activeClients.reduce((s,c) => s+(c.monthly_revenue||c.revenue||0),0);
  const overdueRec = _relReceivables.filter(r => r.status === 'atrasado' || (r.status === 'pendente' && r.due_date && new Date(r.due_date) < new Date()));
  const overdueVal = overdueRec.reduce((s,r) => s+(r.value||0),0);

  return `
    <div class="grid-2" style="margin-bottom:20px">
      <div class="fin-card">
        <div class="fin-label">Receita Mensal Total</div>
        <div class="fin-value positive">${SC.formatCurrency(totalRevenue)}</div>
        <div class="fin-sub">${activeClients.length} clientes ativos</div>
      </div>
      <div class="fin-card">
        <div class="fin-label">Inadimplência</div>
        <div class="fin-value negative">${SC.formatCurrency(overdueVal)}</div>
        <div class="fin-sub">${overdueRec.length} fatura(s) em atraso</div>
      </div>
    </div>
    <div style="height:280px;margin-bottom:20px"><canvas id="fin-revenue-modal-chart"></canvas></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Plano</th><th>Serviços</th><th style="text-align:right">Receita</th><th>Status</th></tr></thead>
        <tbody>
          ${activeClients.map(c => `
            <tr>
              <td style="font-weight:600">${c.name}</td>
              <td><span class="tag tag-purple">${c.plan}</span></td>
              <td style="font-size:12px;color:var(--text-muted)">${Array.isArray(c.services) ? c.services.join(', ') : c.services}</td>
              <td style="text-align:right;font-weight:700;color:var(--success)">${SC.formatCurrency(c.monthly_revenue||c.revenue||0)}</td>
              <td><span class="tag tag-green">ativo</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderFinChartModal() {
  const ctx = document.getElementById('fin-revenue-modal-chart');
  if (!ctx) return;
  const activeClients = _relClients.filter(c => c.status === 'ativo').sort((a,b) => (b.monthly_revenue||0)-(a.monthly_revenue||0));
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: activeClients.map(c => c.name.split(' ').slice(0,2).join(' ')),
      datasets: [{ label: 'Receita', data: activeClients.map(c => c.monthly_revenue||c.revenue||0), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9090a8' }, grid: { display: false } },
        y: { ticks: { color: '#9090a8', callback: v => 'R$ '+(v/1000).toFixed(0)+'k' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function reportClientesAtivos() {
  const rows = _relClients.map(c => {
    const plan = { Premium: 'tag-purple', Padrão: 'tag-blue', Starter: 'tag-yellow', Basic: 'tag-gray' };
    const expiry = c.expiry_date || c.expiry;
    const isExpiring = expiry && new Date(expiry) < new Date(Date.now() + 30*86400000);
    return `
      <tr>
        <td style="font-weight:600">${c.name}</td>
        <td style="font-size:12px;color:var(--text-muted)">${c.contact_name || c.resp || '—'}</td>
        <td><span class="tag ${plan[c.plan]||'tag-gray'}">${c.plan}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${Array.isArray(c.services) ? c.services.join(', ') : (c.services||'—')}</td>
        <td style="font-size:12px${isExpiring?';color:var(--warning);font-weight:700':''}">${formatDateBR(expiry)||'—'}${isExpiring?' ⚠️':''}</td>
        <td style="font-weight:700;color:var(--success)">${SC.formatCurrency(c.monthly_revenue||c.revenue||0)}</td>
        <td><span class="tag ${c.status==='ativo'?'tag-green':'tag-red'}">${c.status}</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Contato</th><th>Plano</th><th>Serviços</th><th>Vencimento</th><th>Receita</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function reportOperacional(tasks) {
  const total = tasks.length;
  const published = tasks.filter(t => t.status === 'Publicado').length;
  const adjusted = tasks.filter(t => t.status === 'Ajuste Solicitado').length;
  const overdue = tasks.filter(t => {
    const d = t.post_date || t.postDate;
    return d && new Date(d) < new Date(new Date().toDateString()) && t.status !== 'Publicado';
  }).length;
  const pending = tasks.filter(t => ['Enviado ao Cliente','Aprovação Interna'].includes(t.status)).length;

  return `
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-icon purple"><i class="fas fa-layer-group"></i></div><div class="kpi-value">${total}</div><div class="kpi-label">Total de Cards</div></div>
      <div class="kpi-card"><div class="kpi-icon green"><i class="fas fa-check"></i></div><div class="kpi-value">${published}</div><div class="kpi-label">Publicados</div></div>
      <div class="kpi-card"><div class="kpi-icon yellow"><i class="fas fa-redo"></i></div><div class="kpi-value">${adjusted}</div><div class="kpi-label">Com Ajuste</div></div>
      <div class="kpi-card"><div class="kpi-icon red"><i class="fas fa-clock"></i></div><div class="kpi-value">${overdue}</div><div class="kpi-label">Vencidos</div></div>
    </div>
    <div style="height:280px;margin-bottom:20px"><canvas id="operacional-chart"></canvas></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${[
        { label: 'Taxa de Publicação', val: total > 0 ? Math.round(published/total*100) : 0, color: 'var(--success)' },
        { label: 'Taxa de Ajuste', val: total > 0 ? Math.round(adjusted/total*100) : 0, color: 'var(--warning)' },
        { label: 'Cards Vencidos', val: total > 0 ? Math.round(overdue/total*100) : 0, color: 'var(--danger)' },
        { label: 'Aguardando Aprovação', val: total > 0 ? Math.round(pending/total*100) : 0, color: 'var(--info)' },
      ].map(m => `
        <div class="fin-card">
          <div class="fin-label">${m.label}</div>
          <div style="font-size:22px;font-weight:800;color:${m.color}">${m.val}%</div>
          <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${m.val}%;background:${m.color}"></div></div>
        </div>`).join('')}
    </div>`;
}

function renderOperacionalChart(tasks) {
  const ctx = document.getElementById('operacional-chart');
  if (!ctx) return;
  const counts = SC.kanbanCols.map(col => tasks.filter(t => t.status === col).length);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: SC.kanbanCols,
      datasets: [{ label: 'Cards', data: counts, backgroundColor: chartColors.map(c => c + '99'), borderColor: chartColors, borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9090a8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

/* ─── HELPERS ─────────────────────────── */

function _taskTable(tasks, emptyMsg) {
  if (!tasks.length) return `<div class="empty-state"><i class="fas fa-inbox"></i><p>${emptyMsg}</p></div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Título</th><th>Cliente</th><th>Status</th><th>Data</th><th>Responsável</th></tr></thead>
        <tbody>
          ${tasks.map(t => {
            const postDate = t.post_date || t.postDate;
            let clientName = 'N/A';
            if (t.client && typeof t.client === 'object') clientName = t.client.name || 'N/A';
            else clientName = SC.getClientName(t.client_id||t.client)||'N/A';
            let empAv = '?';
            if (t.assignee && typeof t.assignee === 'object') empAv = t.assignee.avatar_initials || '?';
            else empAv = SC.getEmployeeAvatar(t.assignee_id||t.assignee)||'?';
            return `
              <tr>
                <td style="font-weight:600;font-size:12px">${t.title}</td>
                <td style="font-size:12px;color:var(--text-purple)">${clientName}</td>
                <td>${getStatusTag(t.status)}</td>
                <td style="font-size:12px">${formatDateBR(postDate)||'—'}</td>
                <td><div class="avatar-xs">${empAv}</div></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function exportReport() {
  showToast('📥 Exportação PDF/Excel disponível com backend configurado', 'info');
}
