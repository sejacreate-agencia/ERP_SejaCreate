// =============================================
// FINANCEIRO — Fluxo de Caixa Expandido
// =============================================

let _fcChart = null;

function renderFinFluxoCaixa() {
  const cf   = Data.cashflow();
  const rows = _buildFcRows(cf);
  const cur  = rows[rows.length - 1];
  const proj = _buildForecast(cf);

  const saldoAtual = cur.saldo_final;
  const melhorMes  = rows.reduce((m, r) => r.saldo_mensal > m.saldo_mensal ? r : m, rows[0]);
  const piorMes    = rows.reduce((m, r) => r.saldo_mensal < m.saldo_mensal ? r : m, rows[0]);

  return `
    <div style="margin-top:8px">
      <!-- Summary cards -->
      <div class="fin-summary" style="margin-bottom:20px">
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Saldo Acumulado</div>
          <div class="fin-value ${saldoAtual >= 0 ? 'positive' : 'negative'}">${SC.formatCurrency(saldoAtual)}</div>
          <div class="fin-sub">até ${cur.month}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Melhor Mês</div>
          <div class="fin-value positive">${SC.formatCurrency(melhorMes.saldo_mensal)}</div>
          <div class="fin-sub">${melhorMes.month}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Média Mensal (Entradas)</div>
          <div class="fin-value positive">${SC.formatCurrency(Math.round(rows.reduce((s,r) => s + r.in, 0) / rows.length))}</div>
          <div class="fin-sub">últimos 6 meses</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Média Mensal (Saídas)</div>
          <div class="fin-value negative">${SC.formatCurrency(Math.round(rows.reduce((s,r) => s + r.out, 0) / rows.length))}</div>
          <div class="fin-sub">últimos 6 meses</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="card" style="margin-bottom:16px" data-perm="financial">
        <div class="card-header">
          <span class="card-title">
            <i class="fas fa-chart-area" style="color:var(--purple-light);margin-right:8px"></i>
            Evolução do Saldo Acumulado
          </span>
        </div>
        <div class="chart-container" style="height:240px">
          <canvas id="fc-chart"></canvas>
        </div>
      </div>

      <div class="grid-2">
        <!-- Tabela histórico -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-table" style="color:var(--purple-light);margin-right:8px"></i>Histórico Mensal</span>
          </div>
          <div class="table-wrap">
            <table style="font-size:13px">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style="text-align:right">Entradas</th>
                  <th style="text-align:right">Saídas</th>
                  <th style="text-align:right">Saldo Mês</th>
                  <th style="text-align:right">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td style="font-weight:600">${r.month}</td>
                    <td style="text-align:right;color:var(--success)">${SC.formatCurrency(r.in)}</td>
                    <td style="text-align:right;color:var(--danger)">(${SC.formatCurrency(r.out)})</td>
                    <td style="text-align:right;font-weight:700;color:${r.saldo_mensal >= 0 ? 'var(--success)' : 'var(--danger)'}">${SC.formatCurrency(r.saldo_mensal)}</td>
                    <td style="text-align:right;font-weight:700;color:var(--purple-light)">${SC.formatCurrency(r.saldo_final)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Projeção -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-crystal-ball" style="color:var(--purple-light);margin-right:8px"></i>Projeção — Próximos 3 Meses</span>
          </div>
          <div style="padding:4px 0 8px">
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px">
              Baseado na média dos últimos 3 meses com tendência de crescimento (+5%).
            </p>
          </div>
          <div class="table-wrap">
            <table style="font-size:13px">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style="text-align:right">Entradas est.</th>
                  <th style="text-align:right">Saídas est.</th>
                  <th style="text-align:right">Saldo Mês</th>
                  <th style="text-align:right">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                ${proj.map(r => `
                  <tr style="opacity:.85">
                    <td style="font-weight:600">${r.month} <span style="font-size:10px;color:var(--text-secondary)">(proj.)</span></td>
                    <td style="text-align:right;color:var(--success)">${SC.formatCurrency(r.in)}</td>
                    <td style="text-align:right;color:var(--danger)">(${SC.formatCurrency(r.out)})</td>
                    <td style="text-align:right;font-weight:700;color:var(--success)">${SC.formatCurrency(r.saldo_mensal)}</td>
                    <td style="text-align:right;font-weight:700;color:var(--purple-light)">${SC.formatCurrency(r.saldo_final)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFcChart() {
  const ctx = document.getElementById('fc-chart');
  if (!ctx) return;
  if (_fcChart) { _fcChart.destroy(); _fcChart = null; }

  const cf   = Data.cashflow();
  const rows = _buildFcRows(cf);
  const proj = _buildForecast(cf);
  const allRows = [...rows, ...proj];

  _fcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allRows.map(r => r.month + (r.isProj ? ' ★' : '')),
      datasets: [
        {
          label: 'Saldo Acumulado',
          data: allRows.map(r => r.saldo_final),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.15)',
          borderWidth: 2,
          pointBackgroundColor: allRows.map(r => r.isProj ? 'rgba(139,92,246,0.4)' : '#8b5cf6'),
          pointBorderDash: [],
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Entradas',
          data: allRows.map(r => r.in),
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: allRows.map((_,i) => i >= rows.length ? [4,3] : []),
          pointRadius: 3,
          tension: 0.3,
        },
        {
          label: 'Saídas',
          data: allRows.map(r => r.out),
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 3,
          tension: 0.3,
        },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9090a8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#9090a8' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9090a8', callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function _buildFcRows(cf) {
  let acumulado = 12000;
  return cf.map(c => {
    const saldo_mensal = c.in - c.out;
    acumulado += saldo_mensal;
    return { ...c, saldo_mensal, saldo_final: acumulado };
  });
}

function _buildForecast(cf) {
  const last3   = cf.slice(-3);
  const avgIn   = Math.round(last3.reduce((s, r) => s + r.in,  0) / 3);
  const avgOut  = Math.round(last3.reduce((s, r) => s + r.out, 0) / 3);
  const months  = ['Abr', 'Mai', 'Jun'];
  const allRows = _buildFcRows(cf);
  let   acum    = allRows[allRows.length - 1].saldo_final;

  return months.map((m, i) => {
    const inVal  = Math.round(avgIn  * Math.pow(1.05, i + 1));
    const outVal = Math.round(avgOut * Math.pow(1.02, i + 1));
    const saldo  = inVal - outVal;
    acum += saldo;
    return { month: m, in: inVal, out: outVal, saldo_mensal: saldo, saldo_final: acum, isProj: true };
  });
}
