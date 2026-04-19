// =============================================
// FINANCEIRO — Contas a Receber
// =============================================

function renderFinReceber() {
  const rows = _recData.map(r => {
    const clientObj = r.client;
    let phone = '';
    if (clientObj && typeof clientObj === 'object') {
      phone = (clientObj.phone || '').replace(/\D/g, '');
    } else {
      phone = (SC.clients.find(c => c.id === (r.client_id || r.client))?.phone || '').replace(/\D/g, '');
    }

    const clientName = clientObj?.name || SC.getClientName(r.client_id || r.client) || 'N/A';
    const waMsg  = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');
    const waLink = `https://wa.me/55${phone}?text=${waMsg}`;
    const dueDate   = r.due_date || r.due;
    const isOverdue = r.status === 'atrasado' ||
      (r.status === 'pendente' && dueDate && new Date(dueDate) < new Date(new Date().toDateString()));

    return `
    <tr>
      <td><div style="font-weight:600">${clientName}</div></td>
      <td style="font-size:13px">${r.description || r.desc}</td>
      <td style="font-weight:700;color:var(--success)">${SC.formatCurrency(r.value || 0)}</td>
      <td style="font-size:12px;${isOverdue?'color:var(--danger);font-weight:700':''}">${formatDateBR(dueDate) || '—'}</td>
      <td><span class="tag ${r.status==='pago'?'tag-green':isOverdue?'tag-red':'tag-yellow'}">${r.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${r.status !== 'pago' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}"><i class="fas fa-check"></i> Pago</button>` : ''}
          ${r.status !== 'pago' && phone ? `
            <a href="${waLink}" target="_blank" class="btn-whatsapp" data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1">
              <i class="fab fa-whatsapp"></i> Cobrar
            </a>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="receivable" data-id="${r.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}
