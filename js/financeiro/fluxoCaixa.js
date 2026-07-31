// =============================================
// FINANCEIRO — Fluxo de Caixa
// Baseado em dados reais de contas pagas
// =============================================

let _fcChart       = null;
let _fcFilterYear  = new Date().getFullYear();
let _fcFilterMonth = 0;
let _fcFilterClient = '';
let _fcFilterType   = '';

function renderFinFluxoCaixa() {
  const cf   = _buildRealMonthly();
  const rows = _buildFcRows(cf);
  const proj = _buildForecast(cf);

  const cur       = rows.length ? rows[rows.length - 1] : { saldo_final: 0, month: '—' };
  const melhorMes = rows.length ? rows.reduce((m, r) => r.saldo_mensal > m.saldo_mensal ? r : m, rows[0]) : { saldo_mensal: 0, month: '—' };
  const avgIn     = rows.length ? Math.round(rows.reduce((s, r) => s + r.in,  0) / rows.length) : 0;
  const avgOut    = rows.length ? Math.round(rows.reduce((s, r) => s + r.out, 0) / rows.length) : 0;

  const curYear  = new Date().getFullYear();
  const yearOpts = [curYear - 1, curYear, curYear + 1]
    .map(y => `<option value="${y}" ${y === _fcFilterYear ? 'selected' : ''}>${y}</option>`).join('');
  const mNames  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthOpts = `<option value="0" ${!_fcFilterMonth ? 'selected' : ''}>Todos os meses</option>` +
    mNames.map((m, i) => `<option value="${i + 1}" ${(i + 1) === _fcFilterMonth ? 'selected' : ''}>${m}</option>`).join('');
  const typeOpts = [
    ['', 'Entradas + Saídas'],
    ['entrada', 'Somente Entradas'],
    ['saida',   'Somente Saídas'],
  ].map(([v, l]) => `<option value="${v}" ${v === _fcFilterType ? 'selected' : ''}>${l}</option>`).join('');

  const histRows = rows.map(r => `
    <tr>
      <td style="font-weight:600">${r.month}</td>
      <td style="text-align:right;color:var(--success)">${SC.formatCurrency(r.in)}</td>
      <td style="text-align:right;color:var(--danger)">(${SC.formatCurrency(r.out)})</td>
      <td style="text-align:right;font-weight:700;color:${r.saldo_mensal >= 0 ? 'var(--success)' : 'var(--danger)'}">${SC.formatCurrency(r.saldo_mensal)}</td>
      <td style="text-align:right;font-weight:700;color:var(--purple-light)">${SC.formatCurrency(r.saldo_final)}</td>
    </tr>`).join('');

  const projRows = proj.map(r => `
    <tr style="opacity:.85">
      <td style="font-weight:600">${r.month} <span style="font-size:10px;color:var(--text-secondary)">(proj.)</span></td>
      <td style="text-align:right;color:var(--success)">${SC.formatCurrency(r.in)}</td>
      <td style="text-align:right;color:var(--danger)">(${SC.formatCurrency(r.out)})</td>
      <td style="text-align:right;font-weight:700;color:${r.saldo_mensal >= 0 ? 'var(--success)' : 'var(--danger)'}">${SC.formatCurrency(r.saldo_mensal)}</td>
      <td style="text-align:right;font-weight:700;color:var(--purple-light)">${SC.formatCurrency(r.saldo_final)}</td>
    </tr>`).join('');

  const thStyle = 'style="text-align:right"';
  const thCommon = `<th>Mês</th><th ${thStyle}>Entradas</th><th ${thStyle}>Saídas</th><th ${thStyle}>Saldo Mês</th><th ${thStyle}>Acumulado</th>`;

  const regimeTag = finRegime === 'caixa'
    ? `<span class="tag tag-purple" style="font-size:11px"><i class="fas fa-coins"></i> Regime Caixa — movimentação real</span>`
    : `<span class="tag tag-blue" style="font-size:11px"><i class="fas fa-calendar-check"></i> Regime Competência — por vencimento</span>`;

  return `
    <div style="margin-top:8px">
      <div style="margin-bottom:12px">${regimeTag}</div>
      <div class="fin-summary" style="margin-bottom:20px">
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Saldo Acumulado</div>
          <div class="fin-value ${cur.saldo_final >= 0 ? 'positive' : 'negative'}">${SC.formatCurrency(cur.saldo_final)}</div>
          <div class="fin-sub">até ${cur.month}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Melhor Mês</div>
          <div class="fin-value positive">${SC.formatCurrency(melhorMes.saldo_mensal)}</div>
          <div class="fin-sub">${melhorMes.month}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Média Mensal (Entradas)</div>
          <div class="fin-value positive">${SC.formatCurrency(avgIn)}</div>
          <div class="fin-sub">últimos 6 meses</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Média Mensal (Saídas)</div>
          <div class="fin-value negative">${SC.formatCurrency(avgOut)}</div>
          <div class="fin-sub">últimos 6 meses</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px" data-perm="financial">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-chart-area" style="color:var(--purple-light);margin-right:8px"></i>Evolução do Saldo Acumulado</span>
        </div>
        <div class="chart-container" style="height:240px"><canvas id="fc-chart"></canvas></div>
      </div>

      <!-- Lançamentos filtráveis -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-list" style="color:var(--purple-light);margin-right:8px"></i>Lançamentos do Fluxo de Caixa</span>
        </div>
        <div class="filters-bar" style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <select class="filter-select" onchange="_setFcFilter('year',this.value)">${yearOpts}</select>
          <select class="filter-select" onchange="_setFcFilter('month',this.value)">${monthOpts}</select>
          <input class="filter-select" style="width:180px" placeholder="🔍 Cliente / Fornecedor..." oninput="_setFcFilter('client',this.value)" value="${_fcFilterClient}" />
          <select class="filter-select" onchange="_setFcFilter('type',this.value)">${typeOpts}</select>
        </div>
        <div id="fc-transactions-wrap"><!-- preenchido por _renderFcBody --></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fas fa-table" style="color:var(--purple-light);margin-right:8px"></i>Histórico Mensal</span></div>
          <div class="table-wrap">
            <table style="font-size:13px">
              <thead><tr>${thCommon}</tr></thead>
              <tbody>${histRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Nenhum dado ainda</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fas fa-crystal-ball" style="color:var(--purple-light);margin-right:8px"></i>Projeção — Próximos 3 Meses</span></div>
          <p style="font-size:12px;color:var(--text-secondary);padding:8px 16px 0">Baseado na média dos últimos 3 meses com tendência de crescimento (+5%).</p>
          <div class="table-wrap">
            <table style="font-size:13px">
              <thead><tr>${thCommon}</tr></thead>
              <tbody>${projRows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Sem dados para projeção</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Filtros ───────────────────────────────────────────────────────────────────

function _setFcFilter(field, value) {
  if (field === 'year')   _fcFilterYear   = parseInt(value) || new Date().getFullYear();
  if (field === 'month')  _fcFilterMonth  = parseInt(value) || 0;
  if (field === 'client') _fcFilterClient = value;
  if (field === 'type')   _fcFilterType   = value;
  _renderFcBody();
}

function _renderFcBody() {
  const wrap = document.getElementById('fc-transactions-wrap');
  if (!wrap) return;

  const recAll = (_recDataAll || _recData || []);
  const payAll = (_payDataAll || _payData || []);

  const isCaixa = finRegime === 'caixa';
  const allTx = [
    ...recAll.filter(r => isCaixa ? (r.status==='pago'||r.status==='parcialmente_pago') : r.status!=='cancelado').map(r => ({
      date:     isCaixa
        ? (r.paid_date||(r.paid_at||'').slice(0,10)||r.due_date||'').slice(0,10)
        : (r.due_date||r.due||'').slice(0,10),
      desc:     r.description || r.desc || 'Recebimento',
      tipo:     'entrada',
      client:   r.client?.name || (SC.clients.find(c=>String(c.id)===String(r.client_id||r.client))?.name) || '—',
      category: r.categoria || 'Recebimento',
      value:    r.valor_pago || r.value || 0,
      status:   r.status,
    })),
    ...payAll.filter(p => isCaixa ? (p.status==='pago'||p.status==='parcialmente_pago') : (p.status!=='cancelado'&&p.status!=='provisionado')).map(p => ({
      date:     isCaixa
        ? (p.paid_date||(p.paid_at||'').slice(0,10)||p.due_date||'').slice(0,10)
        : (p.due_date||p.due||'').slice(0,10),
      desc:     p.description || p.desc || 'Pagamento',
      tipo:     'saida',
      client:   p.supplier_name || p.supplier || '—',
      category: p.categoria || p.category || 'Despesa',
      value:    p.valor_pago || p.value || 0,
      status:   p.status,
    })),
  ].filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date));

  let filtered = allTx;
  if (_fcFilterYear)   filtered = filtered.filter(t => parseInt(t.date.slice(0, 4)) === _fcFilterYear);
  if (_fcFilterMonth)  filtered = filtered.filter(t => parseInt(t.date.slice(5, 7)) === _fcFilterMonth);
  if (_fcFilterClient) filtered = filtered.filter(t => t.client.toLowerCase().includes(_fcFilterClient.toLowerCase()));
  if (_fcFilterType)   filtered = filtered.filter(t => t.tipo === _fcFilterType);

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fas fa-inbox" style="font-size:28px;color:var(--text-muted)"></i><p style="margin-top:8px">Nenhum lançamento no período</p></div>`;
    return;
  }

  const totalE = filtered.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.value, 0);
  const totalS = filtered.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.value, 0);
  let   bal    = 0;
  const txRows = filtered.map(t => {
    bal += t.tipo === 'entrada' ? t.value : -t.value;
    return `
      <tr>
        <td style="white-space:nowrap;color:var(--text-secondary);font-size:12px">${t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px" title="${t.desc}">${t.desc}</td>
        <td><span class="tag ${t.tipo === 'entrada' ? 'tag-green' : 'tag-red'}" style="font-size:10px"><i class="fas fa-arrow-${t.tipo === 'entrada' ? 'down' : 'up'}"></i> ${t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
        <td style="font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary)">${t.client}</td>
        <td style="font-size:11px;color:var(--text-muted)">${t.category}</td>
        <td style="text-align:right;font-weight:600;color:${t.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">${t.tipo === 'entrada' ? '+' : '-'}${SC.formatCurrency(t.value)}</td>
        <td style="text-align:right;font-weight:700;color:${bal >= 0 ? 'var(--purple-light)' : 'var(--danger)'}">${SC.formatCurrency(bal)}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div style="padding:8px 16px;display:flex;gap:20px;font-size:12px;color:var(--text-secondary);border-bottom:1px solid var(--border)">
      <span>Entradas: <strong style="color:var(--success)">${SC.formatCurrency(totalE)}</strong></span>
      <span>Saídas: <strong style="color:var(--danger)">${SC.formatCurrency(totalS)}</strong></span>
      <span>Saldo: <strong style="color:${totalE - totalS >= 0 ? 'var(--success)' : 'var(--danger)'}">${SC.formatCurrency(totalE - totalS)}</strong></span>
      <span style="margin-left:auto;color:var(--text-muted)">${filtered.length} lançamento(s)</span>
    </div>
    <div class="table-wrap">
      <table style="font-size:13px">
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Cliente / Fornecedor</th><th>Categoria</th><th style="text-align:right">Valor</th><th style="text-align:right">Saldo Acum.</th></tr></thead>
        <tbody>${txRows}</tbody>
      </table>
    </div>`;
}

// ── Dados reais ───────────────────────────────────────────────────────────────

function _buildRealMonthly() {
  const recAll = (_recDataAll || _recData || []);
  const payAll = (_payDataAll || _payData || []);
  const isCaixa = finRegime === 'caixa';
  const monthMap = {};

  recAll.forEach(r => {
    if (isCaixa && r.status !== 'pago' && r.status !== 'parcialmente_pago') return;
    if (!isCaixa && (r.status === 'cancelado')) return;
    const dateStr = isCaixa
      ? (r.paid_date || (r.paid_at||'').slice(0,10) || r.due_date || '').slice(0, 10)
      : (r.due_date || r.due || '').slice(0, 10);
    if (!dateStr) return;
    const d = new Date(dateStr + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { key, month: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''), year: d.getFullYear(), in: 0, out: 0 };
    monthMap[key].in += (r.valor_pago || r.value || 0);
  });

  payAll.forEach(p => {
    if (isCaixa && p.status !== 'pago' && p.status !== 'parcialmente_pago') return;
    if (!isCaixa && (p.status === 'cancelado' || p.status === 'provisionado')) return;
    const dateStr = isCaixa
      ? (p.paid_date || (p.paid_at||'').slice(0,10) || p.due_date || '').slice(0, 10)
      : (p.due_date || p.due || '').slice(0, 10);
    if (!dateStr) return;
    const d = new Date(dateStr + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { key, month: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''), year: d.getFullYear(), in: 0, out: 0 };
    monthMap[key].out += (p.valor_pago || p.value || 0);
  });

  const sorted = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  return sorted.length ? sorted : [];
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function renderFcChart() {
  const ctx = document.getElementById('fc-chart');
  if (!ctx) return;
  if (_fcChart) { _fcChart.destroy(); _fcChart = null; }

  const cf      = _buildRealMonthly();
  const rows    = _buildFcRows(cf);
  const proj    = _buildForecast(cf);
  const allRows = [...rows, ...proj];
  if (!allRows.length) return;

  _fcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allRows.map(r => r.month + (r.isProj ? ' ★' : '')),
      datasets: [
        {
          label: 'Saldo Acumulado',
          data: allRows.map(r => r.saldo_final),
          borderColor: '#ac5ec0', backgroundColor: 'rgba(172,94,192,0.15)',
          borderWidth: 2, tension: 0.35, fill: true,
          pointBackgroundColor: allRows.map(r => r.isProj ? 'rgba(172,94,192,0.4)' : '#ac5ec0'),
        },
        {
          label: 'Entradas', data: allRows.map(r => r.in),
          borderColor: '#10b981', backgroundColor: 'transparent',
          borderWidth: 1.5, pointRadius: 3, tension: 0.3,
        },
        {
          label: 'Saídas', data: allRows.map(r => r.out),
          borderColor: '#ef4444', backgroundColor: 'transparent',
          borderWidth: 1.5, pointRadius: 3, tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9090a8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9090a8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', callback: v => 'R$\u00a0' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // Renderizar a lista de transações após o chart
  _renderFcBody();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildFcRows(cf) {
  if (!cf.length) return [];
  let acumulado = 0;
  return cf.map(c => {
    const saldo_mensal = c.in - c.out;
    acumulado += saldo_mensal;
    return { ...c, saldo_mensal, saldo_final: acumulado };
  });
}

function _buildForecast(cf) {
  if (!cf.length) return [];
  const last3    = cf.slice(-3);
  const avgIn    = Math.round(last3.reduce((s, r) => s + r.in,  0) / last3.length);
  const avgOut   = Math.round(last3.reduce((s, r) => s + r.out, 0) / last3.length);
  const allRows  = _buildFcRows(cf);
  let   acum     = allRows.length ? allRows[allRows.length - 1].saldo_final : 0;
  const baseDate = cf[cf.length - 1]?.key ? new Date(cf[cf.length - 1].key + '-01T12:00:00') : new Date();

  return [1, 2, 3].map((_, i) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i + 1);
    const inVal  = Math.round(avgIn  * Math.pow(1.05, i + 1));
    const outVal = Math.round(avgOut * Math.pow(1.02, i + 1));
    const saldo  = inVal - outVal;
    acum += saldo;
    return { month: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''), in: inVal, out: outVal, saldo_mensal: saldo, saldo_final: acum, isProj: true };
  });
}
