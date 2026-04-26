// =============================================
// FINANCEIRO — Contas a Pagar + Inadimplência
// =============================================

function renderFinPagar() {
  const today = new Date(new Date().toDateString());
  const provisionados = _payData.filter(p => p.status === 'provisionado');
  const demais        = _payData.filter(p => p.status !== 'provisionado');
  const sorted        = [...provisionados, ...demais];
  const provTotal     = provisionados.reduce((s, p) => s + (p.value||0), 0);
  const isComp        = finRegime === 'competencia';

  const rows = sorted.map(p => {
    const dueDate  = p.due_date || p.due;
    const paidDate = p.paid_date || (p.paid_at||'').slice(0,10);
    const isOverdue = (p.status==='pendente'||p.status==='previsto') && dueDate && new Date(dueDate.split('T')[0]) < today;
    const effStatus = isOverdue && p.status==='pendente' ? 'atrasado' : p.status;

    const catTag   = p.categoria    ? `<div style="font-size:10px;color:var(--text-muted)">${p.categoria}</div>` : '';
    const ccTag    = p.centro_custo ? `<div style="font-size:10px;color:var(--text-muted)">${p.centro_custo}</div>` : '';
    const valorPagoCell = p.valor_pago ? `<span style="color:var(--danger)">(${SC.formatCurrency(p.valor_pago)})</span>` : '—';
    const formaPag = p.forma_pagamento ? `<span style="font-size:11px;color:var(--text-secondary)">${p.forma_pagamento}</span>` : '—';

    return `
    <tr style="${p.status==='provisionado'?'opacity:.7':''}">
      <td style="font-size:13px">${p.supplier_name||p.supplier||'—'}</td>
      <td style="font-size:12px">
        ${p.description||p.desc}
        ${p.provisao_grupo ? `<span style="font-size:10px;color:var(--text-muted);display:block">Provisão ${p.provisao_mes}/${p.provisao_total} meses</span>` : ''}
        ${catTag}${ccTag}
      </td>
      <td style="font-weight:700;color:var(--danger);white-space:nowrap">- ${SC.formatCurrency(p.value||0)}</td>
      <td style="font-size:12px">${valorPagoCell}</td>
      <td style="font-size:12px;${isOverdue?'color:var(--danger);font-weight:600':''}">${formatDateBR(dueDate)||'—'}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${paidDate ? formatDateBR(paidDate) : '—'}</td>
      <td style="font-size:12px">${formaPag}</td>
      <td>${_finStatusTag(effStatus)}</td>
      <td>
        <div style="display:flex;gap:5px">
          ${p.status==='provisionado' ? `<button class="btn btn-sm" style="background:rgba(139,92,246,.15);color:var(--purple-light)" data-action="confirm-provisao" data-id="${p.id}"><i class="fas fa-check-circle"></i> Confirmar</button>` : ''}
          ${p.status==='pendente'||p.status==='atrasado'||p.status==='previsto' ? `<button class="btn btn-sm btn-success" data-action="mark-paid" data-type="payable" data-id="${p.id}"><i class="fas fa-check"></i> Pagar</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-action="open-edit-lanc" data-type="payable" data-id="${p.id}"><i class="fas fa-edit"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const regimeInfo = isComp
    ? `<span class="tag tag-blue" style="font-size:11px"><i class="fas fa-calendar-check"></i> Competência</span>`
    : `<span class="tag tag-purple" style="font-size:11px"><i class="fas fa-coins"></i> Caixa</span>`;

  const provBanner = provisionados.length ? `
    <div style="padding:10px 16px;background:rgba(139,92,246,.08);border-bottom:1px solid rgba(139,92,246,.15);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--purple-light)">
      <i class="fas fa-layer-group"></i>
      <span><strong>${provisionados.length}</strong> conta(s) provisionada(s) · ${SC.formatCurrency(provTotal)} previsto</span>
    </div>` : '';

  return `
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      ${regimeInfo}
      <button class="btn btn-primary" data-action="open-new-lancamento-pagar">
        <i class="fas fa-plus"></i> Nova Despesa
      </button>
    </div>
    <div class="card">
      ${provBanner}
      <div class="table-wrap">
        <table style="font-size:12px">
          <thead>
            <tr>
              <th>Fornecedor</th>
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

function renderFinInadimplencia() {
  const today     = new Date(new Date().toDateString());
  const atrasados = _recData.filter(r =>
    r.status === 'atrasado' ||
    (r.status === 'pendente' && (r.due_date||r.due) && new Date((r.due_date||r.due).split('T')[0]) < today)
  );

  if (!atrasados.length) return `
    <div class="empty-state">
      <i class="fas fa-check-circle" style="color:var(--success);font-size:48px"></i>
      <p style="margin-top:12px">Nenhuma inadimplência registrada!</p>
      <p style="font-size:12px;color:var(--text-muted)">Todos os clientes estão em dia.</p>
    </div>`;

  const waMsg = encodeURIComponent('Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?');
  const totalAtrasado = atrasados.reduce((s,r)=>s+(r.value||0),0);

  const rows = atrasados.map(r => {
    const dueDate = r.due_date || r.due;
    const dias    = dueDate ? Math.max(0, Math.round((today - new Date(dueDate.split('T')[0]))/86400000)) : 0;
    const clientObj = r.client;
    let phone = '', clientName = 'N/A', contactName = '';
    if (clientObj && typeof clientObj === 'object') {
      phone       = (clientObj.phone||'').replace(/\D/g,'');
      clientName  = clientObj.name||'N/A';
      contactName = clientObj.contact_name||'';
    } else {
      const cl    = SC.clients.find(c=>c.id===(r.client_id||r.client));
      phone       = (cl?.phone||'').replace(/\D/g,'');
      clientName  = cl?.name||'N/A';
      contactName = cl?.resp||'';
    }
    const waLink = `https://wa.me/55${phone}?text=${waMsg}`;
    const multaEstimada = dias > 5 ? Math.round((r.value||0) * 0.02) : 0;
    const jurosEstimado = dias > 0 ? Math.round((r.value||0) * 0.001 * dias) : 0;

    return `<tr>
      <td>
        <div style="font-weight:600">${clientName}</div>
        ${contactName ? `<div style="font-size:11px;color:var(--text-muted)">${contactName}</div>` : ''}
      </td>
      <td style="font-size:13px">${r.description||r.desc}</td>
      <td style="color:var(--danger);font-weight:700">${SC.formatCurrency(r.value||0)}</td>
      <td style="color:var(--danger);font-size:12px">${formatDateBR(dueDate)||'—'}</td>
      <td><span class="tag tag-red" style="font-weight:700">${dias} dias</span></td>
      <td style="font-size:11px">
        ${multaEstimada ? `<div style="color:var(--danger)">Multa ~${SC.formatCurrency(multaEstimada)}</div>` : ''}
        ${jurosEstimado ? `<div style="color:var(--warning)">Juros ~${SC.formatCurrency(jurosEstimado)}</div>` : ''}
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${phone ? `<a href="${waLink}" target="_blank" class="btn-whatsapp" data-action="whatsapp-cobrar" data-client="${clientName}" data-stop-propagation="1"><i class="fab fa-whatsapp"></i> Cobrar</a>` : `<span style="font-size:11px;color:var(--text-muted)">Sem telefone</span>`}
          <button class="btn btn-sm btn-success" data-action="mark-paid" data-type="receivable" data-id="${r.id}"><i class="fas fa-check"></i> Pago</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title" style="color:var(--danger)"><i class="fas fa-exclamation-circle"></i> Inadimplência</span>
        <span style="font-size:12px;color:var(--text-muted)">${atrasados.length} fatura(s) · ${SC.formatCurrency(totalAtrasado)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Atraso</th><th>Encargos Estimados</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
