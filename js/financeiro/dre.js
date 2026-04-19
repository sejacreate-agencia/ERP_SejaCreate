// =============================================
// FINANCEIRO — DRE (Demonstrativo de Resultado)
// =============================================

function renderFinDRE() {
  const raw = Data.dre();
  const rows = raw.map(_calcDreRow);
  const cur  = rows[rows.length - 1];

  return `
    <div style="margin-top:8px">
      <!-- Cards de margem -->
      <div class="fin-summary" style="margin-bottom:20px">
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Receita Líquida</div>
          <div class="fin-value positive">${SC.formatCurrency(cur.receita_liq)}</div>
          <div class="fin-sub">após impostos</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Margem Bruta</div>
          <div class="fin-value positive">${cur.mg_bruta.toFixed(1)}%</div>
          <div class="fin-sub">${SC.formatCurrency(cur.lucro_bruto)}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">EBITDA</div>
          <div class="fin-value ${cur.ebitda >= 0 ? 'positive' : 'negative'}">${cur.mg_ebitda.toFixed(1)}%</div>
          <div class="fin-sub">${SC.formatCurrency(cur.ebitda)}</div>
        </div>
        <div class="fin-card" data-perm="financial">
          <div class="fin-label">Resultado Líquido</div>
          <div class="fin-value ${cur.resultado >= 0 ? 'positive' : 'negative'}">${cur.mg_liq.toFixed(1)}%</div>
          <div class="fin-sub">${SC.formatCurrency(cur.resultado)}</div>
        </div>
      </div>

      <!-- Tabela DRE -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <i class="fas fa-file-invoice-dollar" style="color:var(--purple-light);margin-right:8px"></i>
            Demonstrativo de Resultado — Últimos 6 Meses
          </span>
        </div>
        <div class="table-wrap">
          <table style="font-size:13px">
            <thead>
              <tr>
                <th style="min-width:220px">Descrição</th>
                ${rows.map(r => `<th style="text-align:right">${r.month}</th>`).join('')}
                <th style="text-align:right;color:var(--text-secondary);font-size:11px">% Rec.</th>
              </tr>
            </thead>
            <tbody>
              ${_dreSection('RECEITAS')}
              ${_dreRow('Receita Bruta de Serviços', rows, 'receita', false, 'neutral')}
              ${_dreRow('(-) Impostos e Deduções (6%)', rows, 'impostos', true, '')}
              ${_dreRow('= Receita Líquida', rows, 'receita_liq', false, 'total')}
              ${_dreSection('CUSTOS')}
              ${_dreRow('(-) Custo de Produção / Terceiros', rows, 'custos_diretos', true, '')}
              ${_dreRow('= Lucro Bruto', rows, 'lucro_bruto', false, 'total')}
              ${_dreSection('DESPESAS OPERACIONAIS')}
              ${_dreRow('(-) Folha de Pagamento', rows, 'folha', true, '')}
              ${_dreRow('(-) Despesas Operacionais', rows, 'despesas_op', true, '')}
              ${_dreRow('= EBITDA', rows, 'ebitda', false, 'total')}
              ${_dreSection('RESULTADO')}
              ${_dreRow('(-) Provisões e Reservas (10%)', rows, 'provisoes', true, '')}
              ${_dreRow('= RESULTADO LÍQUIDO', rows, 'resultado', false, 'result')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function _calcDreRow(d) {
  const receita_liq  = d.receita - d.impostos;
  const lucro_bruto  = receita_liq - d.custos_diretos;
  const ebitda       = lucro_bruto - d.folha - d.despesas_op;
  const provisoes    = Math.round(Math.max(ebitda, 0) * 0.1);
  const resultado    = ebitda - provisoes;
  return {
    ...d,
    receita_liq,
    lucro_bruto,
    ebitda,
    provisoes,
    resultado,
    mg_bruta:  d.receita ? (lucro_bruto / d.receita) * 100 : 0,
    mg_ebitda: d.receita ? (ebitda      / d.receita) * 100 : 0,
    mg_liq:    d.receita ? (resultado   / d.receita) * 100 : 0,
  };
}

function _dreSection(label) {
  return `<tr style="background:rgba(255,255,255,0.03)">
    <td colspan="99" style="padding:8px 12px;font-size:11px;font-weight:700;
      color:var(--text-secondary);letter-spacing:.06em;text-transform:uppercase">${label}</td>
  </tr>`;
}

function _dreRow(label, rows, field, isDeduct, style) {
  const cur = rows[rows.length - 1];
  const pct = cur.receita ? ((cur[field] / cur.receita) * 100).toFixed(1) + '%' : '—';

  let rowStyle = '';
  if (style === 'total')  rowStyle = 'font-weight:700;border-top:1px solid rgba(255,255,255,0.08)';
  if (style === 'result') rowStyle = 'font-weight:700;font-size:14px;border-top:2px solid rgba(255,255,255,0.15)';

  const cells = rows.map(r => {
    const v   = r[field] || 0;
    const fmt = SC.formatCurrency(Math.abs(v));
    const clr = isDeduct ? 'var(--danger)' : v >= 0 ? 'var(--success)' : 'var(--danger)';
    return `<td style="text-align:right;color:${clr}">${isDeduct ? `(${fmt})` : fmt}</td>`;
  }).join('');

  const pctColor = isDeduct ? 'var(--danger)' : cur[field] >= 0 ? 'var(--success)' : 'var(--danger)';

  return `<tr style="${rowStyle}">
    <td style="padding-left:${style === 'total' || style === 'result' ? '12' : '24'}px">${label}</td>
    ${cells}
    <td style="text-align:right;font-size:11px;color:${pctColor}">${pct}</td>
  </tr>`;
}
