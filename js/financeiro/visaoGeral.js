// =============================================
// FINANCEIRO — Visão Geral + Fluxo de Caixa
// =============================================

function renderFinVisaoGeral() {
  const byClient = _recData
    .filter(r => r.status !== 'cancelado')
    .reduce((acc, r) => {
      const name = r.client?.name || SC.getClientName(r.client_id || r.client) || 'N/A';
      acc[name] = (acc[name] || 0) + (r.value || 0);
      return acc;
    }, {});

  const clientList = Object.entries(byClient)
    .map(([name, revenue]) => ({ name: name.split(' ').slice(0,2).join(' '), revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const maxRev = clientList[0]?.revenue || 1;

  return `
    <div class="grid-2">
      <div class="card" data-perm="financial">
        <div class="card-header"><span class="card-title"><i class="fas fa-chart-bar" style="color:var(--purple-light);margin-right:8px"></i>Fluxo de Caixa — Últimos 6 Meses</span></div>
        <div class="chart-container" style="height:280px">
          <canvas id="cashflow-chart"></canvas>
        </div>
      </div>
      <div class="card" data-perm="financial">
        <div class="card-header"><span class="card-title"><i class="fas fa-users" style="color:var(--purple-light);margin-right:8px"></i>Faturamento por Cliente</span></div>
        <div>
          ${clientList.map(c => `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px">${c.name}</span>
                <span style="font-size:12px;font-weight:700;color:var(--success)">${SC.formatCurrency(c.revenue)}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill green" style="width:${Math.round(c.revenue/maxRev*100)}%"></div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header"><span class="card-title"><i class="fas fa-exchange-alt" style="color:var(--purple-light);margin-right:8px"></i>Lançamentos Recentes</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            ${_recData.slice(0,4).map(r => `
              <tr>
                <td>${r.description || r.desc}</td>
                <td><span class="tag tag-green" style="font-size:11px"><i class="fas fa-arrow-down"></i> Entrada</span></td>
                <td style="font-size:12px">${formatDateBR(r.due_date || r.due) || '—'}</td>
                <td style="font-weight:700;color:var(--success)">${SC.formatCurrency(r.value || 0)}</td>
                <td><span class="tag ${r.status==='pago'?'tag-green':r.status==='atrasado'?'tag-red':'tag-yellow'}">${r.status}</span></td>
              </tr>`).join('')}
            ${_payData.slice(0,2).map(p => `
              <tr>
                <td>${p.description || p.desc}</td>
                <td><span class="tag tag-red" style="font-size:11px"><i class="fas fa-arrow-up"></i> Saída</span></td>
                <td style="font-size:12px">${formatDateBR(p.due_date || p.due) || '—'}</td>
                <td style="font-weight:700;color:var(--danger)">- ${SC.formatCurrency(p.value || 0)}</td>
                <td><span class="tag ${p.status==='pago'?'tag-green':'tag-yellow'}">${p.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderFluxoCaixa() {
  const ctx = document.getElementById('cashflow-chart');
  if (!ctx) return;
  if (finChart) { finChart.destroy(); finChart = null; }
  const cf = Data.cashflow();
  finChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cf.map(c => c.month),
      datasets: [
        { label: 'Entradas', data: cf.map(c => c.in),  backgroundColor: 'rgba(16,185,129,0.5)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 },
        { label: 'Saídas',   data: cf.map(c => c.out), backgroundColor: 'rgba(239,68,68,0.4)',  borderColor: '#ef4444', borderWidth: 2, borderRadius: 6 },
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
