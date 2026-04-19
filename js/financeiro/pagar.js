// =============================================
// FINANCEIRO — Contas a Pagar + Inadimplência
// =============================================

function renderFinPagar() {
  const rows = _payData.map(p => `
    <tr>
      <td>${p.supplier_name || p.supplier}</td>
      <td style="font-size:13px">${p.description || p.desc}</td>
      <td style="font-weight:700;color:var(--danger)">- ${SC.formatCurrency(p.value || 0)}</td>
      <td style="font-size:12px">${formatDateBR(p.due_date || p.due) || '—'}</td>
      <td><span class="tag ${p.status==='pago'?'tag-green':'tag-yellow'}">${p.status}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          ${p.status !== 'pago' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="payable" data-id="${p.id}"><i class="fas fa-check"></i> Pagar</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="payable" data-id="${p.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fornecedor</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderFinInadimplencia() {
  const today     = new Date(new Date().toDateString());
  const atrasados = _recData.filter(r =>
    r.status === 'atrasado' ||
    (r.status === 'pendente' && (r.due_date || r.due) && new Date((r.due_date || r.due).split('T')[0]) < today)
  );

  if (!atrasados.length) return `
    <div class="empty-state">
      <i class="fas fa-check-circle" style="color:var(--success);font-size:48px"></i>
      <p style="margin-top:12px">Nenhuma inadimplência registrada!</p>
      <p style="font-size:12px;color:var(--text-muted)">Todos os clientes estão em dia.</p>
    </div>`;

  const waMsg = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title" style="color:var(--danger)">
          <i class="fas fa-exclamation-circle"></i> Clientes Inadimplentes
        </span>
        <span style="font-size:12px;color:var(--text-muted)">${atrasados.length} fatura(s) em atraso · Total: ${SC.formatCurrency(atrasados.reduce((s,r)=>s+(r.value||0),0))}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Dias em Atraso</th><th>Ações</th></tr>
          </thead>
          <tbody>
            ${atrasados.map(r => {
              const dueDate = r.due_date || r.due;
              const dias    = dueDate ? Math.max(0, Math.round((today - new Date(dueDate.split('T')[0])) / 86400000)) : 0;
              const clientObj = r.client;
              let phone = '', clientName = 'N/A', contactName = '';
              if (clientObj && typeof clientObj === 'object') {
                phone       = (clientObj.phone || '').replace(/\D/g, '');
                clientName  = clientObj.name || 'N/A';
                contactName = clientObj.contact_name || '';
              } else {
                const cl    = SC.clients.find(c => c.id === (r.client_id || r.client));
                phone       = (cl?.phone || '').replace(/\D/g, '');
                clientName  = cl?.name || 'N/A';
                contactName = cl?.resp || '';
              }
              const waLink = `https://wa.me/55${phone}?text=${waMsg}`;
              return `<tr>
                <td>
                  <div style="font-weight:600">${clientName}</div>
                  ${contactName ? `<div style="font-size:11px;color:var(--text-muted)">${contactName}</div>` : ''}
                </td>
                <td style="font-size:13px">${r.description || r.desc}</td>
                <td style="color:var(--danger);font-weight:700">${SC.formatCurrency(r.value || 0)}</td>
                <td style="color:var(--danger);font-size:12px">${formatDateBR(dueDate) || '—'}</td>
                <td><span class="tag tag-red" style="font-weight:700">${dias} dias</span></td>
                <td>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                    ${phone ? `
                    <a href="${waLink}" target="_blank" class="btn-whatsapp"
                       data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1">
                      <i class="fab fa-whatsapp"></i> Cobrar
                    </a>` : `<span style="font-size:11px;color:var(--text-muted)">Sem telefone</span>`}
                    <button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}">
                      <i class="fas fa-check"></i> Pago
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
