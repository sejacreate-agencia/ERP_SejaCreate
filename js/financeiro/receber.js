// =============================================
// FINANCEIRO — Contas a Receber
// =============================================

function renderFinReceber() {
  const today   = new Date(new Date().toDateString());
  const waMsg   = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');
  const isComp  = finRegime === 'competencia';

  const rows = _recData.map(r => {
    const clientObj  = r.client;
    let phone = '', clientName = 'N/A';
    if (clientObj && typeof clientObj === 'object') {
      phone      = (clientObj.phone || '').replace(/\D/g, '');
      clientName = clientObj.name || 'N/A';
    } else {
      const cl   = SC.clients.find(c => c.id === (r.client_id || r.client));
      phone      = (cl?.phone || '').replace(/\D/g, '');
      clientName = cl?.name || 'N/A';
    }

    const waLink     = `https://wa.me/55${phone}?text=${waMsg}`;
    const dueDate    = r.due_date || r.due;
    const paidDate   = r.paid_date || (r.paid_at||'').slice(0,10);
    const isOverdue  = r.status === 'atrasado' ||
      (r.status === 'pendente' && dueDate && new Date(dueDate.split('T')[0]) < today);
    const effStatus  = isOverdue && r.status === 'pendente' ? 'atrasado' : r.status;

    const parcTag = r.parcela_total > 1
      ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px">${r.parcela_numero}/${r.parcela_total}</span>`
      : '';
    const catTag = r.categoria ? `<div style="font-size:10px;color:var(--text-muted)">${r.categoria}</div>` : '';
    const formaPag = r.forma_pagamento ? `<span style="font-size:11px;color:var(--text-secondary)">${r.forma_pagamento}</span>` : '—';
    const valorPagoCell = r.valor_pago ? `<span style="color:var(--success)">${SC.formatCurrency(r.valor_pago)}</span>` : '—';

    return `
    <tr>
      <td>
        <div style="font-weight:600;font-size:13px">${clientName}</div>
      </td>
      <td style="font-size:13px">
        ${r.description || r.desc || ''}${parcTag}
        ${catTag}
      </td>
      <td style="font-weight:700;color:var(--success);white-space:nowrap">${SC.formatCurrency(r.value || 0)}</td>
      <td style="font-size:12px">${valorPagoCell}</td>
      <td style="font-size:12px;${isOverdue?'color:var(--danger);font-weight:600':''}">${formatDateBR(dueDate)||'—'}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${paidDate ? formatDateBR(paidDate) : '—'}</td>
      <td style="font-size:12px">${formaPag}</td>
      <td>${_finStatusTag(effStatus)}</td>
      <td>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${r.status !== 'pago' && r.status !== 'cancelado' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}"><i class="fas fa-check"></i> Pago</button>` : ''}
          ${r.status !== 'pago' && phone ? `<a href="${waLink}" target="_blank" class="btn-whatsapp" data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1"><i class="fab fa-whatsapp"></i></a>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="receivable" data-id="${r.id}"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const regimeInfo = isComp
    ? `<span class="tag tag-blue" style="font-size:11px"><i class="fas fa-calendar-check"></i> Competência — por vencimento</span>`
    : `<span class="tag tag-purple" style="font-size:11px"><i class="fas fa-coins"></i> Caixa — por pagamento</span>`;

  return `
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      ${regimeInfo}
      <button class="btn btn-primary" data-action="open-new-recebimento">
        <i class="fas fa-plus"></i> Novo Recebimento
      </button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table style="font-size:12px">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Pago</th>
              <th>Vencimento</th>
              <th>Dt. Pag.</th>
              <th>Forma Pag.</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}
