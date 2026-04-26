// =============================================
// SEJA CREATE — CRM (Pipeline + Drag-and-Drop)
// =============================================

let draggedLeadId = null;
let _leadData = [];

const stageColors = {
  'Lead Novo': 'blue', 'Contato Iniciado': 'purple', 'Proposta Enviada': 'yellow',
  'Negociação': 'yellow', 'Fechado': 'green', 'Perdido': 'red'
};
const stageIcons = {
  'Lead Novo': 'fa-user-plus', 'Contato Iniciado': 'fa-phone', 'Proposta Enviada': 'fa-file-alt',
  'Negociação': 'fa-handshake', 'Fechado': 'fa-check-circle', 'Perdido': 'fa-times-circle'
};
const stageCSSColors = {
  'Lead Novo': '#3b82f6', 'Contato Iniciado': '#8b5cf6', 'Proposta Enviada': '#f59e0b',
  'Negociação': '#f97316', 'Fechado': '#10b981', 'Perdido': '#ef4444'
};

async function renderCRM() {
  const pc = document.getElementById('page-content');
  // Ativa modo kanban imediatamente para layout correto
  pc.classList.add('kanban-mode');
  pc.innerHTML = `
    <div class="page-header" style="flex-shrink:0">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">CRM — Pipeline Comercial</h1>
          <p class="page-subtitle">Arraste leads entre colunas para atualizar o estágio</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="show-crm-list"><i class="fas fa-list"></i> Lista</button>
          <button class="btn btn-primary" data-action="open-lead-modal"><i class="fas fa-plus"></i> Novo Lead</button>
        </div>
      </div>
    </div>
    <div id="crm-kpis" style="flex-shrink:0">
      <div class="loading-state" style="padding:30px 0"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
    <div id="crm-board-container" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;">
      <div class="loading-state" style="padding:60px 0"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
  `;

  _leadData = await Data.leads();
  _renderCRMContent();
}

function _renderCRMContent() {
  const totalPipeline = _leadData.filter(l => l.stage !== 'Perdido').reduce((s, l) => s + (l.value || 0), 0);
  const closedVal = _leadData.filter(l => l.stage === 'Fechado').reduce((s, l) => s + (l.value || 0), 0);
  const convRate = _leadData.length ? Math.round(_leadData.filter(l => l.stage === 'Fechado').length / _leadData.length * 100) : 0;

  // KPIs
  const kpiEl = document.getElementById('crm-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="kpi-card">
        <div class="kpi-icon blue"><i class="fas fa-users"></i></div>
        <div class="kpi-value">${_leadData.length}</div>
        <div class="kpi-label">Total de Leads</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${_leadData.filter(l=>l.stage==='Fechado').length}</div>
        <div class="kpi-label">Fechados</div>
        <div class="kpi-change up"><i class="fas fa-percent"></i> ${convRate}% conv.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon yellow"><i class="fas fa-funnel-dollar"></i></div>
        <div class="kpi-value" style="font-size:16px">${SC.formatCurrency(totalPipeline)}</div>
        <div class="kpi-label">Pipeline Total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon purple"><i class="fas fa-trophy"></i></div>
        <div class="kpi-value" style="font-size:16px">${SC.formatCurrency(closedVal)}</div>
        <div class="kpi-label">Receita Fechada</div>
      </div>
    </div>`;

  // Board
  const boardEl = document.getElementById('crm-board-container');
  if (boardEl) {
    // O crm-board-container ocupa o espaço restante e faz scroll horizontal
    boardEl.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;';
    boardEl.innerHTML = `
      <div class="crm-pipeline-wrapper" style="flex:1;min-height:0;">
        <div id="crm-board" class="crm-pipeline-board">
          ${SC.crmStages.map(stage => renderCRMColumn(stage)).join('')}
        </div>
      </div>`;
  }

  // Ativa modo kanban no page-wrapper para permitir scroll horizontal
  const pw = document.getElementById('page-content');
  if (pw) pw.classList.add('kanban-mode');

  // Bind drag events
  setTimeout(() => bindLeadDragEvents(), 60);
}

function renderCRMColumn(stage) {
  const leads = _leadData.filter(l => l.stage === stage);
  const cssColor = stageCSSColors[stage] || '#5a5a70';
  const totalVal = leads.reduce((s, l) => s + (l.value || 0), 0);

  return `
    <div class="pipeline-col" data-stage="${stage}" style="width:220px;flex-shrink:0">
      <div class="pipeline-col-header" style="border-top:3px solid ${cssColor}">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <i class="fas ${stageIcons[stage]}" style="color:${cssColor};font-size:13px;flex-shrink:0"></i>
          <div style="min-width:0">
            <div class="pipeline-col-name">${stage}</div>
            <div class="pipeline-col-count">${leads.length} lead${leads.length !== 1 ? 's' : ''} · ${SC.formatCurrency(totalVal)}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon" data-action="open-lead-modal" data-stage="${stage}" title="Adicionar lead">
          <i class="fas fa-plus" style="font-size:12px"></i>
        </button>
      </div>
      <div class="pipeline-col-body"
           data-stage="${stage}"
           ondragover="crmDragOver(event)"
           ondragleave="crmDragLeave(event)"
           ondrop="crmDrop(event,'${stage}')">
        ${leads.map(l => renderLeadCard(l)).join('')}
        ${!leads.length ? `<div class="crm-empty-col">
          <i class="fas fa-inbox" style="font-size:20px;margin-bottom:6px;display:block"></i>
          Sem leads
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderLeadCard(l) {
  let empAv = '?', empName = 'N/A';
  if (l.assignee && typeof l.assignee === 'object') {
    empAv = l.assignee.avatar_initials || l.assignee.full_name?.slice(0,2) || '?';
    empName = l.assignee.full_name || 'N/A';
  } else {
    empAv = SC.getEmployeeAvatar(l.assignee_id || l.assignee) || '?';
    empName = SC.getEmployeeName(l.assignee_id || l.assignee) || 'N/A';
  }

  const lastContact = l.last_contact || l.lastContact;

  return `
    <div class="lead-card"
         draggable="true"
         data-id="${l.id}"
         ondragstart="crmDragStart(event,${JSON.stringify(l.id)})"
         ondragend="crmDragEnd(event)"
         data-action="open-lead-detail" data-id="${l.id}">
      <div class="lead-name">${l.name}</div>
      <div class="lead-company"><i class="fas fa-building" style="font-size:10px;margin-right:4px"></i>${l.company}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
        <i class="fas fa-tag" style="font-size:9px"></i> ${l.service}
      </div>
      <div class="lead-footer">
        <div class="lead-value">${SC.formatCurrency(l.value || 0)}</div>
        <div class="avatar-xs" title="${empName}">${empAv}</div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:6px">
        <i class="fas fa-clock" style="font-size:9px"></i> ${formatDateBR(lastContact) || '—'}
      </div>
    </div>
  `;
}

/* ─── DRAG AND DROP CRM ─────────────────── */

function bindLeadDragEvents() {
  document.querySelectorAll('.lead-card[data-id]').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedLeadId = card.dataset.id;
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function crmDragStart(e, id) {
  draggedLeadId = String(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function crmDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedLeadId = null;
}

function crmDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function crmDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function crmDrop(e, targetStage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const idStr = draggedLeadId || e.dataTransfer.getData('text/plain');
  if (!idStr) return;

  const lead = _leadData.find(l => String(l.id) === String(idStr));
  if (!lead || lead.stage === targetStage) return;

  const prevStage = lead.stage;
  lead.stage = targetStage;
  lead.last_contact = lead.lastContact = new Date().toISOString().split('T')[0];
  draggedLeadId = null;

  // Persiste
  if (isSupabaseReady()) {
    const { error } = await DB.leads.updateStage(idStr, targetStage);
    if (error) {
      showToast(`Erro ao salvar: ${error.message}`, 'error');
      lead.stage = prevStage;
      _renderCRMContent();
      return;
    }
    await logActivity('lead.stage_changed', 'lead', String(idStr), JSON.stringify({ from: prevStage, to: targetStage }));
  } else {
    const scLead = SC.leads.find(l => String(l.id) === String(idStr));
    if (scLead) { scLead.stage = targetStage; scLead.lastContact = lead.last_contact; }
  }

  showToast(`✅ Lead movido para "${targetStage}"`, 'success');
  _renderCRMContent();
}

/* ─── MODAL LEAD DETAIL ─────────────────── */

async function openLeadDetail(id) {
  const l = _leadData.find(x => String(x.id) === String(id));
  if (!l) return;

  const profiles = await Data.profiles();
  const empOpts = profiles.map(e => `<option value="${e.id}" ${String(e.id) === String(l.assignee_id || l.assignee) ? 'selected' : ''}>${e.full_name}</option>`).join('');
  const stageOpts = SC.crmStages.map(s => `<option value="${s}" ${s === l.stage ? 'selected' : ''}>${s}</option>`).join('');

  let empAv = '?', empName = 'N/A';
  if (l.assignee && typeof l.assignee === 'object') {
    empAv = l.assignee.avatar_initials || '?';
    empName = l.assignee.full_name || 'N/A';
  } else {
    empAv = SC.getEmployeeAvatar(l.assignee_id || l.assignee) || '?';
    empName = SC.getEmployeeName(l.assignee_id || l.assignee) || 'N/A';
  }

  const lastContact = l.last_contact || l.lastContact;

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user" style="color:var(--purple-light);margin-right:8px"></i>${l.name} — ${l.company}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Empresa</div>
          <div style="font-size:14px;font-weight:600">${l.company}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Serviço de Interesse</div>
          <div style="font-size:13px">${l.service}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Contato</div>
          <div style="font-size:13px">${l.email || '—'}<br/>${l.phone || '—'}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Origem</div>
          <div><span class="tag tag-purple">${l.origin}</span></div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Valor Estimado</div>
          <div style="font-size:16px;font-weight:700;color:var(--success)">${SC.formatCurrency(l.value || 0)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Responsável Comercial</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar-sm">${empAv}</div>
            <span style="font-size:13px">${empName}</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">Observações</div>
        <textarea class="input-field" id="lead-notes-${id}" rows="3" style="resize:vertical">${l.notes || ''}</textarea>
      </div>

      <div style="margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">Etapa do Pipeline</div>
          <select class="select-field" id="lead-stage-select">${stageOpts}</select>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">Responsável</div>
          <select class="select-field" id="lead-assignee-select">${empOpts}</select>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">Histórico de Interação</div>
        <div class="timeline" style="margin-left:10px">
          <div class="timeline-item">
            <div class="timeline-date">${formatDateBR(lastContact) || '—'}</div>
            <div class="timeline-text">Último contato registrado</div>
          </div>
          <div class="timeline-item">
            <div class="timeline-date">Etapa atual</div>
            <div class="timeline-text"><strong style="color:${stageCSSColors[l.stage]}">${l.stage}</strong></div>
          </div>
        </div>
      </div>

      ${l.phone ? `
      <div style="background:var(--success-subtle);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--success)"><i class="fab fa-whatsapp"></i> Contato via WhatsApp</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${l.phone}</div>
        </div>
        <a href="https://wa.me/55${(l.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent('Olá '+l.name+'! Sou da Seja Create e gostaria de dar continuidade ao nosso contato. Tem um momento?')}"
           target="_blank" class="btn btn-success btn-sm">
          <i class="fab fa-whatsapp"></i> Abrir WhatsApp
        </a>
      </div>
      ` : ''}

      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-top:12px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-primary)"><i class="fas fa-file-contract"></i> Proposta Comercial</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px" id="proposal-status-${id}">
            ${l.proposal_url
              ? `<a href="${l.proposal_url}" target="_blank" style="color:var(--primary)"><i class="fas fa-external-link-alt"></i> Ver proposta gerada</a>`
              : 'Nenhuma proposta gerada ainda'}
          </div>
        </div>
        <button class="btn btn-sm" style="background:var(--primary);color:#fff" data-action="gerar-proposta-crm" data-id="${id}" data-name="${l.name}">
          <i class="fas fa-magic"></i> ${l.proposal_url ? 'Regerar Proposta' : 'Gerar Proposta'}
        </button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm btn-danger" data-action="delete-lead" data-id="${id}">
        <i class="fas fa-trash"></i> Excluir
      </button>
      ${l.stage !== 'Fechado' && l.stage !== 'Perdido' ?
        `<button class="btn btn-success" data-action="convert-lead" data-id="${id}"><i class="fas fa-user-plus"></i> Converter em Cliente</button>` : ''}
      ${l.proposal_url ? `
        <a href="https://wa.me/55${(l.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent('Olá '+l.name+'! Preparei uma proposta especial para você: '+l.proposal_url)}"
           target="_blank" class="btn btn-success">
          <i class="fab fa-whatsapp"></i> Enviar Proposta
        </a>` : ''}
      <button class="btn btn-primary" id="btn-save-lead-${id}" data-action="update-lead-stage" data-id="${id}">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
  `, 'modal-lg');
}

async function updateLeadStage(id) {
  const lead = _leadData.find(l => String(l.id) === String(id));
  if (!lead) return;

  const newStage = document.getElementById('lead-stage-select').value;
  const notes = document.getElementById(`lead-notes-${id}`)?.value || lead.notes;
  const assigneeId = document.getElementById('lead-assignee-select')?.value;

  const btn = document.getElementById(`btn-save-lead-${id}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const payload = {
    stage: newStage,
    notes,
    assignee_id: assigneeId,
    last_contact: new Date().toISOString().split('T')[0]
  };

  if (isSupabaseReady()) {
    const { error } = await DB.leads.update(id, payload);
    if (error) {
      showToast(`Erro: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações'; }
      return;
    }
  } else {
    const scLead = SC.leads.find(l => String(l.id) === String(id));
    if (scLead) {
      scLead.stage = newStage;
      scLead.notes = notes;
      scLead.lastContact = payload.last_contact;
    }
  }

  lead.stage = newStage;
  lead.notes = notes;
  lead.last_contact = payload.last_contact;

  closeModal();
  showToast(`✅ Lead atualizado — ${newStage}`, 'success');
  _renderCRMContent();
}

async function deleteLead(id) {
  if (!confirm('Deseja excluir este lead?')) return;

  if (isSupabaseReady()) {
    const { error } = await DB.leads.remove(id);
    if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  } else {
    SC.leads = SC.leads.filter(l => String(l.id) !== String(id));
  }

  _leadData = _leadData.filter(l => String(l.id) !== String(id));
  closeModal();
  showToast('Lead excluído.', 'error');
  _renderCRMContent();
}

async function convertLead(id) {
  const lead = _leadData.find(l => String(l.id) === String(id));
  if (!lead) return;

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Convertendo...'; }

  const clientPayload = {
    name: lead.company,
    contact_name: lead.name,
    email: lead.email,
    phone: lead.phone,
    services: [lead.service],
    plan: 'Padrão',
    start_date: new Date().toISOString().split('T')[0],
    status: 'ativo',
    monthly_revenue: lead.value || 0,
  };

  if (isSupabaseReady()) {
    const { data: newClient, error: clientError } = await DB.clients.create(clientPayload);
    if (clientError) { showToast(`Erro ao criar cliente: ${clientError.message}`, 'error'); return; }
    await DB.leads.update(id, { stage: 'Fechado', last_contact: new Date().toISOString().split('T')[0] });
  } else {
    const newClient = { id: SC.clients.length + 1, name: lead.company, resp: lead.name, email: lead.email, phone: lead.phone, cnpj: '', services: [lead.service], plan: 'Padrão', start: new Date().toISOString().split('T')[0], expiry: '', status: 'ativo', revenue: lead.value || 0 };
    SC.clients.push(newClient);
    const scLead = SC.leads.find(l => String(l.id) === String(id));
    if (scLead) scLead.stage = 'Fechado';
  }

  lead.stage = 'Fechado';
  closeModal();
  showToast(`🎉 ${lead.company} convertido em cliente!`, 'success');
  _renderCRMContent();
}

/* ─── NOVO LEAD MODAL ────────────────── */

async function openLeadModal(stage = 'Lead Novo') {
  const profiles = await Data.profiles();
  const empOpts = profiles.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
  const stageOpts = SC.crmStages.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user-plus" style="color:var(--purple-light);margin-right:8px"></i>Novo Lead</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome *</label><input class="input-field" id="nl-name" placeholder="Nome do contato" /></div>
        <div class="form-col"><label>Empresa *</label><input class="input-field" id="nl-company" placeholder="Nome da empresa" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>E-mail</label><input class="input-field" id="nl-email" type="email" placeholder="email@empresa.com" /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="nl-phone" placeholder="(11) 9 0000-0000" /></div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Origem</label>
          <select class="select-field" id="nl-origin">
            <option>Instagram</option><option>LinkedIn</option><option>Indicação</option>
            <option>Google</option><option>Site</option><option>Evento</option><option>Outro</option>
          </select>
        </div>
        <div class="form-col"><label>Valor Estimado (R$)</label><input class="input-field" id="nl-value" type="number" placeholder="0" min="0" /></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Serviço de Interesse</label><input class="input-field" id="nl-service" placeholder="Ex: Social Media + Design" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Responsável</label><select class="select-field" id="nl-assignee">${empOpts}</select></div>
        <div class="form-col"><label>Etapa</label><select class="select-field" id="nl-stage">${stageOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Observações</label><textarea class="input-field" id="nl-notes" rows="2" placeholder="Observações sobre o lead..."></textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-new-lead" data-action="save-new-lead"><i class="fas fa-save"></i> Salvar Lead</button>
    </div>
  `);
}

async function saveNewLead() {
  const name = document.getElementById('nl-name').value.trim();
  const company = document.getElementById('nl-company').value.trim();
  if (!name || !company) { showToast('Nome e empresa são obrigatórios!', 'error'); return; }

  const btn = document.getElementById('btn-save-new-lead');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const payload = {
    name, company,
    email: document.getElementById('nl-email').value,
    phone: document.getElementById('nl-phone').value,
    origin: document.getElementById('nl-origin').value,
    service: document.getElementById('nl-service').value || 'A definir',
    assignee_id: document.getElementById('nl-assignee').value,
    stage: document.getElementById('nl-stage').value,
    value: parseFloat(document.getElementById('nl-value').value) || 0,
    notes: document.getElementById('nl-notes').value,
    last_contact: new Date().toISOString().split('T')[0],
  };

  if (isSupabaseReady()) {
    const { data, error } = await DB.leads.create(payload);
    if (error) {
      showToast(`Erro: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar Lead'; }
      return;
    }
    _leadData.push({ ...data, assignee: { full_name: 'N/A', avatar_initials: '?' } });
    await logActivity('lead.created', 'lead', data.id, JSON.stringify({ name, company }));
  } else {
    const newLead = {
      id: Date.now(), ...payload,
      assignee: { full_name: SC.getEmployeeName(parseInt(payload.assignee_id)), avatar_initials: SC.getEmployeeAvatar(parseInt(payload.assignee_id)) },
    };
    SC.leads.push(newLead);
    _leadData.push(newLead);
  }

  closeModal();
  showToast('🎯 Lead criado com sucesso!', 'success');
  _renderCRMContent();
}

/* ─── LISTA DE LEADS ─────────────────── */

async function showCRMList() {
  const rows = _leadData.map(l => {
    let empAv = '?', empName = 'N/A';
    if (l.assignee && typeof l.assignee === 'object') {
      empAv = l.assignee.avatar_initials || '?';
      empName = l.assignee.full_name?.split(' ')[0] || 'N/A';
    } else {
      empAv = SC.getEmployeeAvatar(l.assignee_id || l.assignee) || '?';
      empName = SC.getEmployeeName(l.assignee_id || l.assignee)?.split(' ')[0] || 'N/A';
    }
    const sc = { 'Lead Novo':'blue', 'Contato Iniciado':'purple', 'Proposta Enviada':'yellow', 'Negociação':'yellow', 'Fechado':'green', 'Perdido':'red' };
    const lastContact = l.last_contact || l.lastContact;
    return `
      <tr data-action="open-lead-detail" data-id="${l.id}" style="cursor:pointer">
        <td><strong>${l.name}</strong><br/><span style="font-size:11px;color:var(--text-muted)">${l.company}</span></td>
        <td style="font-size:12px">${l.service}</td>
        <td><span class="tag tag-purple">${l.origin}</span></td>
        <td><span class="tag tag-${sc[l.stage]||'gray'}">${l.stage}</span></td>
        <td style="color:var(--success);font-weight:700">${SC.formatCurrency(l.value || 0)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="avatar-xs">${empAv}</div>
            <span style="font-size:12px">${empName}</span>
          </div>
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateBR(lastContact) || '—'}</td>
      </tr>`;
  }).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">CRM — Lista de Leads</h1>
          <p class="page-subtitle">${_leadData.length} leads no sistema</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="render-crm"><i class="fas fa-columns"></i> Pipeline</button>
          <button class="btn btn-primary" data-action="open-lead-modal"><i class="fas fa-plus"></i> Novo Lead</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Lead</th><th>Serviço</th><th>Origem</th><th>Etapa</th><th>Valor</th><th>Responsável</th><th>Último Contato</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum lead cadastrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function gerarPropostaCRM(id, name) {
  const cmd = `/proposta-crm id:${id} nome:"${name}"`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(cmd).then(() => {
      showToast(`Comando copiado! Cole no Claude Code: ${cmd}`, 'info', 6000);
    }).catch(() => {
      showToast(`Execute no Claude Code: ${cmd}`, 'info', 8000);
    });
  } else {
    showToast(`Execute no Claude Code: ${cmd}`, 'info', 8000);
  }
}

// formatDateBR é definida globalmente em app.js

Router.register('crm', renderCRM, 'CRM');
