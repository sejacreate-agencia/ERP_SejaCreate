// =============================================
// SEJA CREATE — ÁREA DO CLIENTE
// =============================================

let clientTab = 'aprovacao';
let clientCalView = 'mensal';
let clientCalDate = new Date(2025, 2, 1); // Março 2025

function renderClienteArea() {
  // Se o usuário logado é cliente, filtra pelo cliente vinculado
  const u = SC.currentUser;
  const isCliente = u?.role === 'cliente';

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title"><i class="fas fa-user-check" style="color:var(--purple-light);margin-right:10px"></i>Área do Cliente</h1>
          <p class="page-subtitle">Aprove conteúdos, visualize seu calendário e acompanhe entregas</p>
        </div>
        ${!isCliente ? `
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="navigate" data-page="tarefas">
            <i class="fas fa-columns"></i> Ver Kanban
          </button>
        </div>` : ''}
      </div>
    </div>

    <!-- ABAS -->
    <div class="tabs" style="margin-bottom:24px">
      <button class="tab-btn ${clientTab==='aprovacao'?'active':''}" data-action="set-client-tab" data-tab="aprovacao">
        <i class="fas fa-check-circle"></i> Aprovação de Conteúdos
      </button>
      <button class="tab-btn ${clientTab==='calendario'?'active':''}" data-action="set-client-tab" data-tab="calendario">
        <i class="fas fa-calendar-alt"></i> Calendário de Posts
      </button>
      <button class="tab-btn ${clientTab==='historico'?'active':''}" data-action="set-client-tab" data-tab="historico">
        <i class="fas fa-history"></i> Histórico
      </button>
    </div>

    <div id="client-tab-content">
      ${renderClientTabContent()}
    </div>
  `;
}

function setClientTab(tab) {
  clientTab = tab;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const el = document.getElementById('client-tab-content');
  if (el) el.innerHTML = renderClientTabContent();
}

function renderClientTabContent() {
  switch (clientTab) {
    case 'aprovacao':  return renderClientAprovacao();
    case 'calendario': return renderClientCalendario();
    case 'historico':  return renderClientHistorico();
    default: return '';
  }
}

/* ─── ABA: APROVAÇÃO DE CONTEÚDOS ──────── */

function renderClientAprovacao() {
  const u = SC.currentUser;
  // Tarefas enviadas ao cliente (visíveis)
  let tasks = SC.tasks.filter(t =>
    ['Enviado ao Cliente', 'Aprovado', 'Ajuste Solicitado', 'Programado', 'Publicado'].includes(t.status)
  );

  // Se for cliente, filtrar pelo cliente vinculado
  if (u?.role === 'cliente') {
    const clientLink = SC.clients.find(c => c.email === u.email || c.resp === u.name);
    if (clientLink) tasks = tasks.filter(t => t.client === clientLink.id);
  }

  const pendentes = tasks.filter(t => t.status === 'Enviado ao Cliente');
  const aprovados = tasks.filter(t => ['Aprovado','Programado','Publicado'].includes(t.status));
  const ajustes   = tasks.filter(t => t.status === 'Ajuste Solicitado');

  return `
    <!-- RESUMO -->
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
      <div class="kpi-card">
        <div class="kpi-icon yellow"><i class="fas fa-hourglass-half"></i></div>
        <div class="kpi-value">${pendentes.length}</div>
        <div class="kpi-label">Aguardando Aprovação</div>
        ${pendentes.length > 0 ? `<div class="kpi-change down"><i class="fas fa-exclamation-triangle"></i> Ação necessária</div>` : ''}
      </div>
      <div class="kpi-card">
        <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
        <div class="kpi-value">${aprovados.length}</div>
        <div class="kpi-label">Aprovados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red"><i class="fas fa-redo"></i></div>
        <div class="kpi-value">${ajustes.length}</div>
        <div class="kpi-label">Em Ajuste</div>
      </div>
    </div>

    <!-- PENDENTES DE APROVAÇÃO -->
    ${pendentes.length ? `
    <div style="margin-bottom:24px">
      <h3 class="section-title" style="color:var(--warning);display:flex;align-items:center;gap:8px">
        <i class="fas fa-hourglass-half"></i> Aguardando sua aprovação (${pendentes.length})
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${pendentes.map(t => renderClientContentCard(t, true)).join('')}
      </div>
    </div>` : `
    <div class="empty-state" style="padding:32px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--border-radius);margin-bottom:24px">
      <i class="fas fa-check-circle" style="color:var(--success)"></i>
      <p>Nenhum conteúdo aguardando aprovação!</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:4px">Tudo em dia 🎉</p>
    </div>`}

    <!-- APROVADOS / PROGRAMADOS -->
    ${aprovados.length ? `
    <div>
      <h3 class="section-title" style="color:var(--success);display:flex;align-items:center;gap:8px">
        <i class="fas fa-check-circle"></i> Aprovados e Programados (${aprovados.length})
      </h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${aprovados.map(t => renderClientContentCard(t, false)).join('')}
      </div>
    </div>` : ''}
  `;
}

function renderClientContentCard(t, isPending) {
  const taskIcons = {
    'Post Estático': '🖼️', 'Carrossel': '📑', 'Reels / Vídeo': '🎬',
    'Story': '📱', 'Anúncio (Ads)': '📣'
  };
  const icon = taskIcons[t.tipo] || getContentIcon(t.title);
  const sc = SC.statusColor(t.status);
  const overdue = SC.isOverdue(t.postDate) && t.status !== 'Publicado';

  return `
    <div class="content-preview-card">
      <div class="content-preview-img" data-action="open-client-content-modal" data-id="${t.id}" title="Clique para ver detalhes">
        <div style="text-align:center">
          <div style="font-size:60px;margin-bottom:8px">${icon}</div>
          <div style="font-size:11px;color:var(--text-muted)">${SC.getClientName(t.client)}</div>
        </div>
      </div>
      <div class="content-preview-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div class="content-preview-title">${t.title}</div>
          <span class="tag tag-${sc}" style="font-size:10px;flex-shrink:0">${t.status}</span>
        </div>
        <div class="content-preview-caption">${t.text.slice(0, 100)}${t.text.length > 100 ? '…' : ''}</div>
        <div class="content-preview-date">
          <i class="fas fa-calendar" style="margin-right:4px;${overdue?'color:var(--danger)':'color:var(--text-muted)'}"></i>
          <span style="${overdue?'color:var(--danger);font-weight:700':''}">
            ${t.postDate ? SC.formatDate(t.postDate) : 'Sem data definida'}
          </span>
          ${overdue ? ` <span class="tag tag-red" style="font-size:9px">VENCIDO</span>` : ''}
        </div>
        <div class="content-preview-actions">
          ${isPending ? `
            <button class="btn btn-success btn-sm" style="flex:1;background:var(--success-subtle);color:var(--success);border:1px solid rgba(16,185,129,0.3)" data-action="client-approve-content" data-id="${t.id}">
              <i class="fas fa-check"></i> Aprovar
            </button>
            <button class="btn btn-sm" style="flex:1;background:var(--danger-subtle);color:var(--danger);border:1px solid rgba(239,68,68,0.3)" data-action="client-request-adjust" data-id="${t.id}">
              <i class="fas fa-redo"></i> Ajuste
            </button>
          ` : `
            <button class="btn btn-sm btn-secondary" style="flex:1" data-action="open-client-content-modal" data-id="${t.id}">
              <i class="fas fa-eye"></i> Ver Detalhes
            </button>
          `}
        </div>
      </div>
    </div>`;
}

function getContentIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('reel') || t.includes('vídeo') || t.includes('video')) return '🎬';
  if (t.includes('story') || t.includes('storie')) return '📱';
  if (t.includes('carrossel')) return '📑';
  if (t.includes('post')) return '🖼️';
  if (t.includes('anúncio') || t.includes('ad')) return '📣';
  return '📄';
}

async function clientApproveContent(tid) {
  const t = SC.tasks.find(x => x.id === tid);
  if (!t) return;

  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const u = SC.currentUser;
  const today = new Date().toISOString().split('T')[0];

  if (isSupabaseReady()) {
    // Atualiza status da task
    const { error: taskError } = await DB.tasks.updateStatus(tid, 'Aprovado');
    if (taskError) { showToast(`Erro: ${taskError.message}`, 'error'); if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Aprovar'; } return; }

    // Salva aprovação
    const clientId = t.client_id || t.client;
    await DB.approvals.create(tid, SB.profile?.id || u?.id, 'aprovado', '✅ Conteúdo aprovado pelo cliente.');

    // Salva comentário
    await DB.taskComments.add(tid, SB.profile?.id || u?.id, '✅ Conteúdo aprovado pelo cliente.');
    await logActivity('approval.approved', 'task', String(tid), null);
  }

  // Atualiza local
  t.status = 'Aprovado';
  if (t.comments) t.comments.push({ user: u?.id || 1, text: '✅ Conteúdo aprovado pelo cliente.', date: today });
  if (t.task_comments) t.task_comments.push({ text: '✅ Conteúdo aprovado pelo cliente.', created_at: today, user: { full_name: u?.name || 'Cliente', avatar_initials: u?.avatar || '?' } });

  // Atualiza _taskData se existir
  if (typeof _taskData !== 'undefined') {
    const td = _taskData.find(x => String(x.id) === String(tid));
    if (td) td.status = 'Aprovado';
  }

  showToast('✅ Conteúdo aprovado com sucesso!', 'success');
  const tabContent = document.getElementById('client-tab-content');
  if (tabContent) tabContent.innerHTML = renderClientTabContent();
}

function clientRequestAdjust(tid) {
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-redo" style="color:var(--warning);margin-right:8px"></i>Solicitar Ajuste</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
        Descreva o que precisa ser ajustado neste conteúdo. Nossa equipe vai revisar e enviar uma nova versão.
      </p>
      <div class="form-col">
        <label>Motivo do Ajuste *</label>
        <select class="select-field" id="adjust-reason" style="margin-bottom:10px">
          <option value="texto">Texto / legenda</option>
          <option value="cores">Cores ou identidade visual</option>
          <option value="imagem">Imagem ou arte</option>
          <option value="informacao">Informação incorreta</option>
          <option value="outros">Outros</option>
        </select>
        <label>Comentário detalhado *</label>
        <textarea class="input-field" id="adjust-text" rows="4" placeholder="Ex: A cor do fundo não combina com nossa identidade visual. Por favor, use o azul #003366..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-warning" style="background:var(--warning-subtle);color:var(--warning);border:1px solid rgba(245,158,11,0.4)" data-action="confirm-adjust" data-id="${tid}">
        <i class="fas fa-paper-plane"></i> Enviar Solicitação
      </button>
    </div>
  `);
}

async function confirmAdjust(tid) {
  const reason = document.getElementById('adjust-reason').value;
  const text = document.getElementById('adjust-text').value.trim();
  if (!text) { showToast('Descreva o ajuste necessário!', 'error'); return; }

  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

  const u = SC.currentUser;
  const today = new Date().toISOString().split('T')[0];
  const feedbackText = `🔄 Ajuste solicitado (${reason}): ${text}`;

  if (isSupabaseReady()) {
    await DB.tasks.updateStatus(tid, 'Ajuste Solicitado');
    const clientId = SC.tasks.find(x => x.id === tid)?.client;
    await DB.approvals.create(tid, SB.profile?.id || u?.id, 'ajuste_solicitado', feedbackText);
    await DB.taskComments.add(tid, SB.profile?.id || u?.id, feedbackText);
    await logActivity('approval.adjust_requested', 'task', String(tid), JSON.stringify({ reason, text }));
  }

  const t = SC.tasks.find(x => x.id === tid);
  if (t) {
    t.status = 'Ajuste Solicitado';
    if (t.comments) t.comments.push({ user: u?.id || 1, text: feedbackText, date: today });
    if (t.task_comments) t.task_comments.push({ text: feedbackText, created_at: today, user: { full_name: u?.name || 'Cliente', avatar_initials: u?.avatar || '?' } });
  }

  // Atualiza _taskData global
  if (typeof _taskData !== 'undefined') {
    const td = _taskData.find(x => String(x.id) === String(tid));
    if (td) td.status = 'Ajuste Solicitado';
  }

  closeModal();
  showToast('🔄 Solicitação de ajuste enviada à equipe!', 'warning');
  const tabContent = document.getElementById('client-tab-content');
  if (tabContent) tabContent.innerHTML = renderClientTabContent();
}

function openClientContentModal(tid) {
  const t = SC.tasks.find(x => x.id === tid);
  if (!t) return;
  const emp = SC.users.find(u => u.id === t.assignee);
  const icon = getContentIcon(t.title);
  const sc = SC.statusColor(t.status);
  const isPending = t.status === 'Enviado ao Cliente';

  openModal(`
    <div class="modal-header">
      <div style="flex:1">
        <span class="tag tag-${sc}" style="margin-bottom:6px;display:inline-block">${t.status}</span>
        <div class="modal-title">${t.title}</div>
      </div>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 240px;gap:20px">
        <!-- ARTE / PREVIEW -->
        <div>
          <div style="background:linear-gradient(135deg,var(--purple-subtle),var(--bg-secondary));
                      border-radius:12px;display:flex;flex-direction:column;align-items:center;
                      justify-content:center;padding:40px 20px;margin-bottom:16px;
                      border:2px dashed var(--border)">
            <div style="font-size:80px;margin-bottom:12px">${icon}</div>
            <div style="font-size:12px;color:var(--text-muted);text-align:center">
              Arte do conteúdo<br/>
              <span style="font-size:11px">(Upload disponível na versão completa)</span>
            </div>
          </div>

          <!-- LEGENDA / TEXTO -->
          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase">
              Legenda / Texto do Post
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:8px;
                        font-size:14px;line-height:1.7;color:var(--text-primary);
                        border:1px solid var(--border)">
              ${t.text}
            </div>
          </div>

          <!-- COMENTÁRIOS -->
          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">
              Comentários (${t.comments.length})
            </div>
            <div id="modal-comments-${tid}">
              ${t.comments.map(c => {
                const u = SC.users.find(x => x.id === c.user);
                return `<div class="comment-item">
                  <div class="avatar-sm">${u ? u.avatar : '?'}</div>
                  <div class="comment-body">
                    <div class="comment-author">${u ? u.name : 'Usuário'}</div>
                    <div class="comment-text">${c.text}</div>
                    <div class="comment-date">${SC.formatDate(c.date)}</div>
                  </div>
                </div>`;
              }).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum comentário</div>'}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <textarea class="input-field" id="modal-comment-input-${tid}" rows="2"
                        placeholder="Adicione um comentário..." style="flex:1;resize:vertical"></textarea>
              <button class="btn btn-primary btn-sm" data-action="add-client-comment" data-id="${tid}" style="align-self:flex-end">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- SIDEBAR INFORMAÇÕES -->
        <div style="border-left:1px solid var(--border);padding-left:16px">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Cliente</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-purple)">${SC.getClientName(t.client)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Responsável</div>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="avatar-sm">${SC.getEmployeeAvatar(t.assignee)}</div>
                <span style="font-size:13px">${emp ? emp.name : 'N/A'}</span>
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Data de Postagem</div>
              <div style="font-size:14px;font-weight:700">${t.postDate ? SC.formatDate(t.postDate) : '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Prioridade</div>
              ${getPriorityTag(t.priority)}
            </div>
            ${t.checklist.length ? `
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Checklist</div>
              ${t.checklist.map(item => `
                <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">
                  <i class="fas fa-${item.done?'check-circle':'circle'}"
                     style="color:${item.done?'var(--success)':'var(--text-muted)'}"></i>
                  <span style="${item.done?'text-decoration:line-through;color:var(--text-muted)':''}">${item.text}</span>
                </div>`).join('')}
            </div>` : ''}
          </div>

          ${isPending ? `
          <div class="divider" style="margin:12px 0"></div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">
            Sua Decisão
          </div>
          <button class="btn btn-success" style="width:100%;margin-bottom:8px;background:var(--success-subtle);color:var(--success);border:1px solid rgba(16,185,129,0.3)"
                  data-action="approve-and-close" data-id="${tid}">
            <i class="fas fa-check"></i> Aprovar Conteúdo
          </button>
          <button class="btn" style="width:100%;background:var(--danger-subtle);color:var(--danger);border:1px solid rgba(239,68,68,0.3)"
                  data-action="request-adjust-and-close" data-id="${tid}">
            <i class="fas fa-redo"></i> Solicitar Ajuste
          </button>` : ''}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Fechar</button>
    </div>
  `, 'modal-lg');
}

function addClientComment(tid) {
  const inp = document.getElementById(`modal-comment-input-${tid}`);
  const text = inp.value.trim();
  if (!text) return;
  const t = SC.tasks.find(x => x.id === tid);
  const u = SC.currentUser;
  if (t) {
    const today = new Date().toISOString().split('T')[0];
    t.comments.push({ user: u.id, text, date: today });
    inp.value = '';
    const container = document.getElementById(`modal-comments-${tid}`);
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="avatar-sm">${u.avatar}</div>
      <div class="comment-body">
        <div class="comment-author">${u.name}</div>
        <div class="comment-text">${text}</div>
        <div class="comment-date">Agora</div>
      </div>`;
    container.appendChild(div);
    showToast('Comentário enviado!');
  }
}

/* ─── ABA: CALENDÁRIO ──────────────────── */

function renderClientCalendario() {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const month = clientCalDate.getMonth();
  const year = clientCalDate.getFullYear();

  // Tarefas com data de postagem
  const u = SC.currentUser;
  let tasks = SC.tasks.filter(t => t.postDate && ['Aprovado','Programado','Publicado','Enviado ao Cliente'].includes(t.status));

  if (u?.role === 'cliente') {
    const clientLink = SC.clients.find(c => c.email === u.email || c.resp === u.name);
    if (clientLink) tasks = tasks.filter(t => t.client === clientLink.id);
  }

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" data-action="client-cal-prev"><i class="fas fa-chevron-left"></i></button>
        <h3 style="font-size:16px;font-weight:700;min-width:160px;text-align:center">
          ${months[month]} ${year}
        </h3>
        <button class="btn btn-secondary btn-sm" data-action="client-cal-next"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm ${clientCalView==='mensal'?'btn-primary':'btn-secondary'}" data-action="set-client-cal-view" data-view="mensal">
          <i class="fas fa-th-large"></i> Mensal
        </button>
        <button class="btn btn-sm ${clientCalView==='semanal'?'btn-primary':'btn-secondary'}" data-action="set-client-cal-view" data-view="semanal">
          <i class="fas fa-calendar-week"></i> Semanal
        </button>
        <button class="btn btn-sm ${clientCalView==='lista'?'btn-primary':'btn-secondary'}" data-action="set-client-cal-view" data-view="lista">
          <i class="fas fa-list"></i> Lista
        </button>
      </div>
    </div>
    <!-- LEGENDA -->
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;font-size:11px">
      <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:var(--purple-subtle);border:1px solid var(--purple-border);border-radius:3px"></div>Enviado ao Cliente</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:var(--success-subtle);border:1px solid rgba(16,185,129,0.3);border-radius:3px"></div>Aprovado / Programado</div>
      <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:3px"></div>Publicado</div>
    </div>`;

  let calBody;
  if (clientCalView === 'mensal') {
    calBody = renderClientCalMensal(tasks, year, month);
  } else if (clientCalView === 'semanal') {
    calBody = renderClientCalSemanal(tasks, year, month);
  } else {
    calBody = renderClientCalLista(tasks);
  }

  return `<div class="card" style="padding:20px">${header}${calBody}</div>`;
}

function renderClientCalMensal(tasks, year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  const getTasksForDay = (day) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return tasks.filter(t => {
      const d = t.post_date || t.postDate;
      return d && d.split('T')[0] === dateStr;
    });
  };

  let html = `<div class="calendar-grid">`;

  // Headers dos dias
  dayNames.forEach(d => {
    html += `<div class="cal-header-cell">${d}</div>`;
  });

  // Dias vazios antes do mês
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell other-month"></div>`;
  }

  // Dias do mês
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    const dayTasks = getTasksForDay(d);

    html += `
      <div class="cal-cell ${isToday ? 'today' : ''}">
        <div class="cal-day">${d}</div>
        ${dayTasks.slice(0,3).map(t => {
          let cls = '';
          if (t.status === 'Publicado') cls = 'published';
          else if (['Aprovado','Programado'].includes(t.status)) cls = 'pending';
          const icon = getContentIcon(t.title);
          return `
            <div class="cal-event ${cls}" data-action="open-client-content-modal" data-id="${t.id}" title="${t.title}">
              ${icon} ${t.title.slice(0,18)}${t.title.length>18?'…':''}
            </div>`;
        }).join('')}
        ${dayTasks.length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:2px 4px">+${dayTasks.length-3} mais</div>` : ''}
      </div>`;
  }

  // Preencher o resto
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    html += `<div class="cal-cell other-month"></div>`;
  }

  html += `</div>`;
  return html;
}

function renderClientCalSemanal(tasks, year, month) {
  // Pegar a semana atual do mês
  const today = new Date();
  let weekStart = new Date(year, month, 1);
  // Ajustar para o início da semana
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const weekDays = Array.from({length:7}, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const isToday = (d) => {
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const getDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
      ${weekDays.map(d => {
        const dateStr = getDateStr(d);
        const dayTasks = tasks.filter(t => t.postDate === dateStr);
        const isTod = isToday(d);
        return `
          <div style="background:${isTod?'var(--purple-subtle)':'var(--bg-input)'};border:1px solid ${isTod?'var(--purple-border)':'var(--border)'};
                      border-radius:10px;padding:12px;min-height:120px">
            <div style="font-size:11px;font-weight:700;color:${isTod?'var(--purple-light)':'var(--text-muted)'};text-align:center;margin-bottom:8px">
              ${dayNames[d.getDay()]}<br/>
              <span style="font-size:16px;font-weight:800;color:${isTod?'var(--purple-light)':'var(--text-primary)'}">${d.getDate()}</span>
            </div>
            ${dayTasks.map(t => {
              let bg = '';
              if (t.status === 'Publicado') bg = 'rgba(16,185,129,0.2)';
              else if (['Aprovado','Programado'].includes(t.status)) bg = 'rgba(16,185,129,0.1)';
              else bg = 'var(--purple-subtle)';
              return `
                <div data-action="open-client-content-modal" data-id="${t.id}"
                     style="background:${bg};border-radius:6px;padding:5px 7px;margin-bottom:5px;
                            font-size:10px;cursor:pointer;line-height:1.4;
                            border:1px solid rgba(121,0,157,0.2)">
                  ${getContentIcon(t.title)} ${t.title.slice(0,20)}
                </div>`;
            }).join('')}
            ${!dayTasks.length ? `<div style="font-size:10px;color:var(--text-muted);text-align:center;opacity:0.5">—</div>` : ''}
          </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-ghost btn-sm" data-action="client-cal-prev"><i class="fas fa-chevron-left"></i> Semana anterior</button>
      <button class="btn btn-ghost btn-sm" style="margin-left:8px" data-action="client-cal-next">Próxima semana <i class="fas fa-chevron-right"></i></button>
    </div>`;
}

function renderClientCalLista(tasks) {
  if (!tasks.length) {
    return `<div class="empty-state" style="padding:32px"><i class="fas fa-calendar"></i><p>Nenhum conteúdo programado</p></div>`;
  }

  const sorted = [...tasks].sort((a,b) => (a.postDate||'').localeCompare(b.postDate||''));
  const rows = sorted.map(t => {
    const sc = SC.statusColor(t.status);
    return `
      <tr data-action="open-client-content-modal" data-id="${t.id}" style="cursor:pointer">
        <td>
          <div style="background:var(--bg-input);border-radius:6px;padding:4px 8px;text-align:center;min-width:52px;display:inline-block">
            <div style="font-size:16px;font-weight:800">${t.postDate?.split('-')[2]||'—'}</div>
            <div style="font-size:10px;color:var(--text-muted)">
              ${t.postDate ? ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(t.postDate.split('-')[1])-1] : ''}
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">${getContentIcon(t.title)}</span>
            <strong style="font-size:13px">${t.title}</strong>
          </div>
        </td>
        <td style="color:var(--text-purple);font-size:12px">${SC.getClientName(t.client)}</td>
        <td><span class="tag tag-${sc}">${t.status}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="open-client-content-modal" data-id="${t.id}" data-stop-propagation="1">
            <i class="fas fa-eye"></i> Ver
          </button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Conteúdo</th><th>Cliente</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function clientCalPrev() {
  if (clientCalView === 'mensal') {
    clientCalDate = new Date(clientCalDate.getFullYear(), clientCalDate.getMonth() - 1, 1);
  } else {
    clientCalDate = new Date(clientCalDate.getFullYear(), clientCalDate.getMonth(), clientCalDate.getDate() - 7);
  }
  document.getElementById('client-tab-content').innerHTML = renderClientTabContent();
}

function clientCalNext() {
  if (clientCalView === 'mensal') {
    clientCalDate = new Date(clientCalDate.getFullYear(), clientCalDate.getMonth() + 1, 1);
  } else {
    clientCalDate = new Date(clientCalDate.getFullYear(), clientCalDate.getMonth(), clientCalDate.getDate() + 7);
  }
  document.getElementById('client-tab-content').innerHTML = renderClientTabContent();
}

function setClientCalView(view) {
  clientCalView = view;
  document.getElementById('client-tab-content').innerHTML = renderClientTabContent();
}

/* ─── ABA: HISTÓRICO ───────────────────── */

function renderClientHistorico() {
  const u = SC.currentUser;
  let tasks = SC.tasks.filter(t => ['Aprovado','Programado','Publicado','Ajuste Solicitado'].includes(t.status));

  if (u?.role === 'cliente') {
    const clientLink = SC.clients.find(c => c.email === u.email || c.resp === u.name);
    if (clientLink) tasks = tasks.filter(t => t.client === clientLink.id);
  }

  const sorted = [...tasks].sort((a,b) => (b.postDate||'').localeCompare(a.postDate||''));

  if (!sorted.length) {
    return `<div class="empty-state"><i class="fas fa-history"></i><p>Nenhum histórico disponível</p></div>`;
  }

  // Agrupar por status
  const groups = [
    { label: 'Publicados', icon: '✅', status: ['Publicado'], color: 'var(--success)' },
    { label: 'Aprovados / Programados', icon: '📅', status: ['Aprovado','Programado'], color: 'var(--purple-light)' },
    { label: 'Em Ajuste', icon: '🔄', status: ['Ajuste Solicitado'], color: 'var(--warning)' },
  ];

  return groups.map(g => {
    const items = sorted.filter(t => g.status.includes(t.status));
    if (!items.length) return '';
    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:14px;font-weight:700;color:${g.color};margin-bottom:12px;display:flex;align-items:center;gap:6px">
          ${g.icon} ${g.label} (${items.length})
        </h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Conteúdo</th><th>Cliente</th><th>Status</th><th>Comentários</th><th>Ação</th></tr></thead>
            <tbody>
              ${items.map(t => {
                const sc = SC.statusColor(t.status);
                return `
                  <tr data-action="open-client-content-modal" data-id="${t.id}" style="cursor:pointer">
                    <td style="font-size:12px;white-space:nowrap">${SC.formatDate(t.postDate)||'—'}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span>${getContentIcon(t.title)}</span>
                        <strong>${t.title}</strong>
                      </div>
                    </td>
                    <td style="color:var(--text-purple);font-size:12px">${SC.getClientName(t.client)}</td>
                    <td><span class="tag tag-${sc}">${t.status}</span></td>
                    <td style="font-size:12px;color:var(--text-muted)">${t.comments.length} comentário(s)</td>
                    <td>
                      <button class="btn btn-sm btn-secondary" data-action="open-client-content-modal" data-id="${t.id}" data-stop-propagation="1">
                        <i class="fas fa-eye"></i>
                      </button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

Router.register('cliente-area', renderClienteArea, 'Área do Cliente');
