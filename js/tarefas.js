// =============================================
// SEJA CREATE — GESTÃO DE TAREFAS (KANBAN)
// =============================================

let taskView = 'kanban';
let taskFilters = { client: '', assignee: '', status: '', priority: '' };
let draggedTaskId = null;
let _taskData = [];
let _kanbanCols = [];   // colunas dinâmicas (kanban_columns) carregadas do banco
let _mentionUsers = []; // perfis para autocomplete de @menção no card

const TASK_CHANNELS = ['Instagram Feed', 'Instagram Reels', 'Instagram Stories', 'Facebook Feed', 'Facebook Reels', 'Facebook Stories'];
const TASK_PUBLISH_TYPES = ['Feed', 'Carrossel', 'Reels / Vídeo', 'Stories', 'Anúncio'];

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escapa o texto e realça @Menções
function _renderMentions(text) {
  const esc = _escapeHtml(text);
  return esc.replace(/@([\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)/g, (m) => `<span style="color:var(--purple-light);font-weight:600">${m}</span>`);
}

async function renderTarefas() {
  const pc = document.getElementById('page-content');
  // Ativa modo kanban imediatamente para layout correto
  if (taskView === 'kanban') pc.classList.add('kanban-mode');
  pc.innerHTML = `
    <div class="page-header" style="flex-shrink:0">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Gestão de Tarefas</h1>
          <p class="page-subtitle" id="task-subtitle">Carregando cards...</p>
        </div>
        <div class="page-actions">
          <div class="tabs" style="margin:0">
            <button class="tab-btn ${taskView==='kanban'?'active':''}" data-action="set-task-view" data-view="kanban"><i class="fas fa-columns"></i> Kanban</button>
            <button class="tab-btn ${taskView==='lista'?'active':''}" data-action="set-task-view" data-view="lista"><i class="fas fa-list"></i> Lista</button>
          </div>
          <button class="btn btn-secondary" data-action="manage-columns"><i class="fas fa-table-columns"></i> Colunas</button>
          <button class="btn btn-primary" data-action="open-card-modal"><i class="fas fa-plus"></i> Novo Card</button>
        </div>
      </div>
    </div>

    <div class="filters-bar" id="task-filters-bar" style="flex-shrink:0">
      <div class="loading-state" style="width:100%;padding:10px 0">
        <i class="fas fa-spinner fa-spin"></i> Carregando filtros...
      </div>
    </div>

    <div id="task-board-area" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;">
      <div class="loading-state" style="padding:60px 0">
        <i class="fas fa-spinner fa-spin" style="font-size:28px"></i>
        <span style="margin-top:12px;display:block">Carregando board...</span>
      </div>
    </div>
  `;

  // Carrega dados
  _taskData = await Data.tasks();
  _kanbanCols = await Data.kanbanColumns();
  const clients = await Data.clients();
  const profiles = await Data.profiles();

  // Atualiza subtítulo
  const sub = document.getElementById('task-subtitle');
  if (sub) sub.textContent = `Quadro kanban de produção de conteúdo — ${_taskData.length} cards ativos`;

  // Renderiza filtros
  const clientOpts = `<option value="">Todos os clientes</option>${clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}`;
  const empOpts = `<option value="">Todos</option>${profiles.map(e=>`<option value="${e.id}">${e.full_name.split(' ')[0]}</option>`).join('')}`;
  const filtersBar = document.getElementById('task-filters-bar');
  if (filtersBar) {
    filtersBar.innerHTML = `
      <select class="filter-select" id="tf-client" onchange="applyTaskFilters()">
        ${clientOpts}
      </select>
      <select class="filter-select" id="tf-assignee" onchange="applyTaskFilters()">
        ${empOpts}
      </select>
      <select class="filter-select" id="tf-priority" onchange="applyTaskFilters()">
        <option value="">Todas as prioridades</option>
        <option value="alta">🔴 Alta</option>
        <option value="media">🟡 Média</option>
        <option value="baixa">🟢 Baixa</option>
      </select>
      <button class="btn btn-ghost btn-sm" data-action="clear-task-filters"><i class="fas fa-times"></i> Limpar</button>
      <span style="font-size:11px;color:var(--text-muted);margin-left:auto">
        <i class="fas fa-hand-pointer"></i> Arraste os cards entre colunas
      </span>
    `;
  }

  // Restaura valores dos filtros
  ['tf-client','tf-assignee','tf-priority'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const key = id.replace('tf-', '').replace('assignee','assignee').replace('client','client').replace('priority','priority');
      if (taskFilters[key]) el.value = taskFilters[key];
    }
  });

  renderTaskBoard();
}

function setTaskView(v) {
  taskView = v;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');
  // Gerencia o modo kanban no page-wrapper
  const pw = document.getElementById('page-content');
  if (v === 'kanban') {
    pw?.classList.add('kanban-mode');
  } else {
    pw?.classList.remove('kanban-mode');
  }
  renderTaskBoard();
}

function applyTaskFilters() {
  taskFilters.client = document.getElementById('tf-client')?.value || '';
  taskFilters.assignee = document.getElementById('tf-assignee')?.value || '';
  taskFilters.priority = document.getElementById('tf-priority')?.value || '';
  renderTaskBoard();
}

function clearTaskFilters() {
  taskFilters = { client: '', assignee: '', status: '', priority: '' };
  ['tf-client','tf-assignee','tf-priority'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderTaskBoard();
}

function getFilteredTasks() {
  return _taskData.filter(t => {
    const clientId = t.client_id !== undefined ? t.client_id : t.client;
    const assigneeId = t.assignee_id !== undefined ? t.assignee_id : t.assignee;
    if (taskFilters.client && String(clientId) !== String(taskFilters.client)) return false;
    if (taskFilters.assignee && String(assigneeId) !== String(taskFilters.assignee)) return false;
    if (taskFilters.priority && t.priority !== taskFilters.priority) return false;
    return true;
  });
}

function renderTaskBoard() {
  const area = document.getElementById('task-board-area');
  if (!area) return;

  // Modo kanban: page-wrapper precisa de overflow hidden para o kanban ter scroll próprio
  const pw = document.getElementById('page-content');
  if (taskView === 'kanban') {
    pw?.classList.add('kanban-mode');
    area.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;';
  } else {
    pw?.classList.remove('kanban-mode');
    area.style.cssText = '';
  }

  area.innerHTML = taskView === 'kanban' ? buildKanbanBoard() : buildListView();
  if (taskView === 'kanban') {
    setTimeout(() => bindTaskDragEvents(), 60);
  }
}

/* ─── KANBAN BOARD ────────────────────── */

function buildKanbanBoard() {
  const filtered = getFilteredTasks();
  const colList = (_kanbanCols && _kanbanCols.length)
    ? _kanbanCols
    : (SC.kanbanCols || []).map((k, i) => ({ key: k, label: k, position: i + 1, color: getColColor(k) }));
  const cols = colList.map(colObj => {
    const col = colObj.key;
    const label = colObj.label || col;
    const cards = filtered.filter(t => t.status === col);
    const colColor = colObj.color || getColColor(col);
    return `
      <div class="kanban-col" data-col="${col}">
        <div class="kanban-col-header" style="border-top:3px solid ${colColor}">
          <div class="kanban-col-title" title="${label}">${label}</div>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        <div class="kanban-col-body" data-col="${col}"
             ondragover="taskDragOver(event)"
             ondragleave="taskDragLeave(event)"
             ondrop="taskDrop(event,'${col.replace(/'/g, "\\'")}')">
          ${cards.map(c => buildKanbanCard(c)).join('')}
          <button class="add-card-btn" data-action="open-card-modal" data-col="${col}">
            <i class="fas fa-plus"></i> Adicionar card
          </button>
        </div>
      </div>
    `;
  }).join('');

  // kanban-wrapper ocupa o espaço flex restante e faz scroll horizontal
  return `
    <div class="kanban-wrapper" style="flex:1;min-height:0;">
      <div class="kanban-board">
        ${cols}
      </div>
    </div>
  `;
}

function getColColor(col) {
  const map = {
    'Pauta': '#5a5a70',
    'Conteúdo em Produção': '#3b82f6',
    'Arte em Produção': '#ac5ec0',
    'Aprovação Interna': '#f59e0b',
    'Enviado ao Cliente': '#c880d8',
    'Ajuste Solicitado': '#ef4444',
    'Aprovado': '#10b981',
    'Programado': '#79009d',
    'Publicado': '#059669',
  };
  return map[col] || '#5a5a70';
}

function buildKanbanCard(t) {
  const postDate = t.post_date || t.postDate;
  const clientId = t.client_id !== undefined ? t.client_id : t.client;
  const assigneeId = t.assignee_id !== undefined ? t.assignee_id : t.assignee;

  const overdue = postDate && new Date(postDate) < new Date(new Date().toDateString()) && t.status !== 'Publicado';

  // Nome e avatar do responsável (pode ser objeto Supabase ou ID numérico)
  let avText = '?';
  let clientName = 'N/A';
  if (t.assignee && typeof t.assignee === 'object') {
    avText = t.assignee.avatar_initials || t.assignee.full_name?.slice(0,2) || '?';
  } else {
    avText = SC.getEmployeeAvatar(assigneeId) || '?';
  }
  if (t.client && typeof t.client === 'object') {
    clientName = t.client.name?.split(' ').slice(0,2).join(' ') || 'N/A';
  } else {
    clientName = SC.getClientName(clientId)?.split(' ').slice(0,2).join(' ') || 'N/A';
  }

  const checklists = t.task_checklists || t.checklist || [];
  const checkDone = checklists.filter(c => c.done).length;
  const checkTotal = checklists.length;
  const comments = t.task_comments || t.comments || [];

  return `
    <div class="kanban-card"
         draggable="true"
         data-id="${t.id}"
         ondragstart="taskDragStart(event,${JSON.stringify(t.id)})"
         ondragend="taskDragEnd(event)"
         data-action="open-task-modal">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="priority-dot p-${t.priority}"></div>
          ${t.request_number ? `<span style="font-size:9px;font-weight:800;letter-spacing:.3px;color:var(--text-muted)">${t.request_number}</span>` : ''}
        </div>
        ${overdue ? `<span style="font-size:9px;background:var(--danger-subtle);color:var(--danger);padding:1px 6px;border-radius:8px;font-weight:700">VENCIDO</span>` : ''}
      </div>
      <div class="kanban-card-title">${t.title}</div>
      <div class="kanban-card-client"><i class="fas fa-building" style="font-size:9px;margin-right:3px"></i>${clientName}</div>
      ${t.origin === 'planejamento' ? `<div style="font-size:9px;color:var(--purple-light);margin-top:3px"><i class="fas fa-calendar-check" style="margin-right:3px"></i>Origem: Planejamento</div>` : ''}
      <div class="kanban-card-footer">
        <div class="kanban-card-date">
          <i class="fas fa-calendar" style="${overdue?'color:var(--danger)':''}"></i>
          <span style="${overdue?'color:var(--danger);font-weight:700':''}">${formatDateBR(postDate) || '—'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          ${checkTotal ? `<span style="font-size:10px;color:var(--text-muted)">${checkDone}/${checkTotal}</span>` : ''}
          ${comments.length ? `<span style="font-size:10px;color:var(--text-muted)"><i class="fas fa-comment"></i> ${comments.length}</span>` : ''}
          <div class="avatar-xs">${avText}</div>
        </div>
      </div>
    </div>`;
}

// formatDateBR é definida globalmente em app.js

/* ─── DRAG AND DROP ────────────────────── */

function bindTaskDragEvents() {
  document.querySelectorAll('.kanban-card[data-id]').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedTaskId = card.dataset.id;
      setTimeout(() => card.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.id);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });
}

function taskDragStart(e, id) {
  draggedTaskId = String(id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function taskDragEnd(e) {
  e.target.classList.remove('dragging');
}

function taskDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function taskDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function taskDrop(e, targetCol) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const idStr = draggedTaskId || e.dataTransfer.getData('text/plain');
  if (!idStr) return;

  const task = _taskData.find(t => String(t.id) === String(idStr));
  if (!task) return;
  if (task.status === targetCol) return;

  const prevStatus = task.status;
  task.status = targetCol;
  draggedTaskId = null;

  // Atualiza no Supabase (ou local)
  _saveTaskStatus(task.id, targetCol, prevStatus);
  renderTaskBoard();
}

async function _saveTaskStatus(id, newStatus, prevStatus) {
  if (isSupabaseReady()) {
    const { error } = await DB.tasks.updateStatus(id, newStatus);
    if (error) {
      showToast(`Erro ao salvar: ${error.message}`, 'error');
      // Reverte
      const task = _taskData.find(t => String(t.id) === String(id));
      if (task) task.status = prevStatus;
      renderTaskBoard();
      return;
    }
    await logActivity('task.status_changed', 'task', String(id), JSON.stringify({ from: prevStatus, to: newStatus }));
  } else {
    // Atualiza mock
    const scTask = SC.tasks.find(t => String(t.id) === String(id));
    if (scTask) scTask.status = newStatus;
  }
  showToast(`✅ Card movido para "${newStatus}"`, 'success');
}

/* ─── LIST VIEW ───────────────────────── */

function buildListView() {
  const filtered = getFilteredTasks();
  const rows = filtered.map(t => {
    const postDate = t.post_date || t.postDate;
    const clientId = t.client_id !== undefined ? t.client_id : t.client;
    const assigneeId = t.assignee_id !== undefined ? t.assignee_id : t.assignee;
    const overdue = postDate && new Date(postDate) < new Date(new Date().toDateString()) && t.status !== 'Publicado';

    let empName = 'N/A', empAv = '?';
    if (t.assignee && typeof t.assignee === 'object') {
      empName = t.assignee.full_name?.split(' ')[0] || 'N/A';
      empAv = t.assignee.avatar_initials || empName.slice(0,2);
    } else {
      empName = SC.getEmployeeName(assigneeId)?.split(' ')[0] || 'N/A';
      empAv = SC.getEmployeeAvatar(assigneeId) || '?';
    }

    let clientName = 'N/A';
    if (t.client && typeof t.client === 'object') {
      clientName = t.client.name || 'N/A';
    } else {
      clientName = SC.getClientName(clientId) || 'N/A';
    }

    return `
      <tr data-action="open-task-modal" data-id="${t.id}" style="cursor:pointer${overdue?';background:rgba(239,68,68,0.04)':''}">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="priority-dot p-${t.priority}"></div>
            <strong style="font-size:13px">${t.title}</strong>
            ${overdue ? `<span class="tag tag-red" style="font-size:10px">VENCIDO</span>` : ''}
          </div>
        </td>
        <td style="font-size:12px;color:var(--text-purple)">${clientName}</td>
        <td>${getStatusTag(t.status)}</td>
        <td>${getPriorityTag(t.priority)}</td>
        <td style="font-size:12px;${overdue?'color:var(--danger);font-weight:700':''}">${formatDateBR(postDate) || '—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="avatar-xs">${empAv}</div>
            <span style="font-size:12px">${empName}</span>
          </div>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" data-action="open-task-modal" data-stop-propagation="1" data-id="${t.id}"><i class="fas fa-eye"></i></button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Cliente</th><th>Status</th><th>Prioridade</th><th>Data Postagem</th><th>Responsável</th><th>Ação</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum card encontrado com os filtros aplicados</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

/* ─── MODAIS ──────────────────────────── */

async function openCardModal(stage = 'Solicitado') {
  const clients = await Data.clients();
  const profiles = await Data.profiles();
  const solicitante = (typeof SB !== 'undefined' && SB.profile?.full_name) || SC.currentUser?.name || 'Usuário';
  const CANAIS = ['Instagram', 'Facebook', 'WhatsApp', 'Site / Blog', 'LinkedIn', 'E-mail', 'Impresso', 'Outro'];

  const clientOpts = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const empOpts = profiles.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
  const _colKeys = (_kanbanCols && _kanbanCols.length) ? _kanbanCols.map(c => c.key) : (SC.kanbanCols || []);
  // Se 'Solicitado' ainda não existir nas colunas, cai na primeira disponível
  if (!_colKeys.includes(stage)) stage = _colKeys[0] || 'Pauta';
  const stageOpts = _colKeys.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus-square" style="color:var(--purple-light);margin-right:8px"></i>Novo Card</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Solicitante</label><input class="input-field" value="${_escapeHtml(solicitante)}" disabled></div>
        <div class="form-col"><label>Empresa *</label><select class="select-field" id="nc-client">${clientOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Título *</label><input class="input-field" id="nc-title" placeholder="Título da arte/conteúdo" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Tipo de Arte</label><select class="select-field" id="nc-type">${SC.tiposConteudo.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div class="form-col"><label>Responsável *</label><select class="select-field" id="nc-assignee">${empOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Prazo</label><input type="date" class="input-field" id="nc-date" /></div>
        <div class="form-col"><label>Prioridade</label>
          <select class="select-field" id="nc-priority">
            <option value="media">🟡 Média</option>
            <option value="alta">🔴 Alta</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Etapa Inicial</label><select class="select-field" id="nc-stage">${stageOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Canal de Uso <span style="color:var(--text-muted);font-weight:400">(pode marcar mais de um)</span></label>
          <div style="display:flex;flex-wrap:wrap;gap:12px;padding-top:6px">
            ${CANAIS.map(c => `<label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:400"><input type="checkbox" class="nc-channel" value="${c}"> ${c}</label>`).join('')}
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Descrição / Briefing *</label><textarea class="input-field" id="nc-text" rows="4" placeholder="Detalhe o que precisa ser criado..."></textarea></div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Anexos (referência / arte)</label>
          <input type="file" id="nc-files" multiple accept="image/*,video/*,.pdf" class="input-field" style="padding:8px">
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px">Imagens, vídeos ou PDF (opcional). Você também pode anexar depois, dentro do card.</p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-card" data-action="save-new-card"><i class="fas fa-save"></i> Criar Card</button>
    </div>
  `, 'modal-lg');
}

async function saveNewCard() {
  const title = document.getElementById('nc-title').value.trim();
  const text = document.getElementById('nc-text').value.trim();
  if (!title) { showToast('Título é obrigatório!', 'error'); return; }
  if (!text) { showToast('Texto do conteúdo é obrigatório!', 'error'); return; }

  const btn = document.getElementById('btn-save-card');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const deadline = document.getElementById('nc-date').value || null;
  const payload = {
    title,
    text,
    client_id: document.getElementById('nc-client').value,
    assignee_id: document.getElementById('nc-assignee').value,
    post_date: deadline,
    deadline,
    status: document.getElementById('nc-stage').value,
    priority: document.getElementById('nc-priority').value,
    content_type: document.getElementById('nc-type')?.value || 'Post Estático',
    art_type: document.getElementById('nc-type')?.value || null,
    channel: Array.from(document.querySelectorAll('.nc-channel:checked')).map(c => c.value).join(', ') || null,
    requester_id: (typeof SB !== 'undefined' && SB.profile?.id) || null,
    origin: 'solicitacao',
  };

  if (isSupabaseReady()) {
    const { data, error } = await DB.tasks.create(payload);
    if (error) {
      showToast(`Erro ao criar card: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Criar Card'; }
      return;
    }
    // Anexos escolhidos na criação
    const files = document.getElementById('nc-files')?.files || [];
    for (const file of files) {
      const path = `tasks/${data.id}/${Date.now()}_${file.name}`;
      const { data: url, error: upErr } = await SB.uploadFile('task-arts', path, file);
      if (!upErr && url) await DB.taskAttachments.add(data.id, url, file.name, file.type, 'arte');
    }
    await logActivity('task.created', 'task', data.id, JSON.stringify({ title }));
    closeModal();
    showToast('✅ Card criado com sucesso!', 'success');
    await renderTarefas();
  } else {
    // Fallback mock
    setTimeout(() => {
      const clientId = parseInt(payload.client_id) || 1;
      const assigneeId = parseInt(payload.assignee_id) || 1;
      const newCard = {
        id: Date.now(),
        title: payload.title,
        text: payload.text,
        client: clientId,
        client_id: clientId,
        assignee: assigneeId,
        assignee_id: assigneeId,
        created: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        post_date: payload.post_date,
        postDate: payload.post_date,
        status: payload.status,
        priority: payload.priority,
        content_type: payload.content_type,
        task_checklists: [], checklist: [],
        task_comments: [], comments: [],
        task_attachments: [],
        client: { id: clientId, name: SC.getClientName(clientId) },
        assignee: {
          id: assigneeId,
          full_name: SC.getEmployeeName(assigneeId),
          avatar_initials: SC.getEmployeeAvatar(assigneeId)
        },
      };
      SC.tasks.unshift(newCard);
      _taskData.unshift(newCard);
      closeModal();
      showToast('✅ Card criado com sucesso!', 'success');
      renderTarefas();
    }, 350);
  }
}

async function openTaskModal(id) {
  let t = _taskData.find(x => String(x.id) === String(id));
  if (!t && isSupabaseReady()) { _taskData = await Data.tasks(); t = _taskData.find(x => String(x.id) === String(id)); }
  if (!t) return;

  const postDate = t.post_date || t.postDate;
  const overdue = postDate && new Date(postDate) < new Date(new Date().toDateString()) && t.status !== 'Publicado';

  let empName = 'N/A', empAv = '?';
  if (t.assignee && typeof t.assignee === 'object') {
    empName = t.assignee.full_name || 'N/A';
    empAv = t.assignee.avatar_initials || empName.slice(0,2);
  } else {
    empName = SC.getEmployeeName(t.assignee_id || t.assignee) || 'N/A';
    empAv = SC.getEmployeeAvatar(t.assignee_id || t.assignee) || '?';
  }

  let clientName = 'N/A';
  if (t.client && typeof t.client === 'object') clientName = t.client.name || 'N/A';
  else clientName = SC.getClientName(t.client_id || t.client) || 'N/A';

  // Perfis (responsável / @menção)
  const profiles = isSupabaseReady() ? await Data.profiles() : (SC.employees || []).map(e => ({ id: e.id, full_name: e.name, avatar_initials: e.avatar, email: e.email }));
  _mentionUsers = profiles;

  // Solicitante (resolvido pela lista de perfis — evita embed frágil na query)
  const reqProf = t.requester_id ? profiles.find(p => String(p.id) === String(t.requester_id)) : null;
  const reqName = reqProf?.full_name || (t.requester && t.requester.full_name) || '—';
  const reqEmail = reqProf?.email || (t.requester && t.requester.email) || '';

  // Links relacionados (carregados sob demanda; tabela pode não existir antes da migration 012)
  if (isSupabaseReady()) {
    try { const lr = await DB.taskLinks.listByTask(id); if (!lr.error) t.task_links = lr.data || []; } catch (e) {}
  }
  const assigneeOpts = profiles.map(p => `<option value="${p.id}" ${String(p.id) === String(t.assignee_id) ? 'selected' : ''}>${_escapeHtml(p.full_name)}</option>`).join('');

  const _colKeys2 = (_kanbanCols && _kanbanCols.length) ? _kanbanCols.map(c => c.key) : (SC.kanbanCols || []);
  const stageOpts = _colKeys2.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('');
  const checklists = t.task_checklists || t.checklist || [];
  const comments = t.task_comments || t.comments || [];
  const attachments = t.task_attachments || [];
  const channels = t.channels || [];

  const checklistHtml = checklists.map((item, idx) => `
    <div class="checklist-item" id="cli-${idx}">
      <input type="checkbox" id="ci-${idx}" ${item.done ? 'checked' : ''}
        onchange="toggleCheck(${JSON.stringify(id)},${JSON.stringify(item.id || idx)},this.checked,${idx})">
      <label for="ci-${idx}" class="${item.done ? 'done' : ''}">${_escapeHtml(item.text)}</label>
    </div>`).join('');

  const commentsHtml = comments.map(c => {
    let uName = 'Usuário', uAv = '?';
    if (c.user && typeof c.user === 'object') {
      uName = c.user.full_name || 'Usuário';
      uAv = c.user.avatar_initials || uName.slice(0,2);
    } else if (c.user) {
      uName = SC.getEmployeeName(c.user) || 'Usuário';
      uAv = SC.getEmployeeAvatar(c.user) || '?';
    }
    return `<div class="comment-item">
      <div class="avatar-sm">${_escapeHtml(uAv)}</div>
      <div class="comment-body">
        <div class="comment-author">${_escapeHtml(uName)}</div>
        <div class="comment-text">${_renderMentions(c.text)}</div>
        <div class="comment-date">${formatDateBR(c.date || c.created_at) || 'Hoje'}</div>
      </div>
    </div>`;
  }).join('');

  const _isImg = (a) => a.file_type?.startsWith('image/') || a.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const _isDrive = (a) => /drive\.google|docs\.google/.test(a.file_url || '');
  const artHtml = (attachments.length > 0)
    ? attachments.map(a => `
        <div style="background:var(--bg-input);border-radius:8px;overflow:hidden;margin-bottom:6px;position:relative">
          <button data-action="del-art" data-id="${a.id}" data-task="${id}" title="Remover"
            style="position:absolute;top:6px;right:6px;z-index:2;background:rgba(0,0,0,.55);color:#fff;border:none;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:12px">&times;</button>
          ${_isImg(a)
            ? `<a href="${a.file_url}" target="_blank"><img src="${a.file_url}" alt="${a.file_name || 'arte'}" style="width:100%;max-height:200px;object-fit:cover;display:block"></a>`
            : `<div style="padding:12px;display:flex;align-items:center;gap:8px;font-size:12px">
                 <i class="${_isDrive(a) ? 'fab fa-google-drive' : 'fas fa-file'}" style="color:var(--purple-light);font-size:16px"></i>
                 <a href="${a.file_url}" target="_blank" style="color:var(--purple-light);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.file_name || (_isDrive(a) ? 'Abrir no Drive' : 'Abrir link')}</a>
                 <i class="fas fa-external-link-alt" style="color:var(--text-muted);font-size:11px"></i>
               </div>`
          }
        </div>`).join('')
    : `<div style="background:var(--bg-input);border:2px dashed var(--border);border-radius:8px;height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-image" style="font-size:22px;color:var(--text-muted)"></i>
        <span style="font-size:12px;color:var(--text-muted)">Sem arte ainda</span>
        <span style="font-size:11px;color:var(--text-muted)">Use <b>Upload</b> ou <b>Link do Drive</b> acima</span>
      </div>`;

  openModal(`
    <div class="modal-header">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap">
          ${t.request_number ? `<span class="tag tag-gray">${t.request_number}</span>` : ''}
          ${getPriorityTag(t.priority)}
          ${getStatusTag(t.status)}
          ${overdue ? `<span class="tag tag-red">⏰ VENCIDA</span>` : ''}
        </div>
        <span class="modal-title">${_escapeHtml(t.title)}</span>
      </div>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 260px;gap:20px">
        <!-- LEFT -->
        <div>
          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase">Descrição / Briefing</div>
            <div style="background:var(--bg-input);padding:14px;border-radius:8px;font-size:13px;line-height:1.7;color:var(--text-secondary);white-space:pre-wrap">${_escapeHtml(t.text) || '—'}</div>
          </div>

          <details style="margin-bottom:16px;background:var(--bg-secondary);border-radius:8px;padding:12px">
            <summary style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;cursor:pointer">📣 Informações de postagem</summary>
            <div style="margin-top:10px">
              <div class="form-row">
                <div class="form-col"><label>Título da postagem</label><input class="input-field" id="pi-title-${id}" value="${_escapeHtml(t.post_title || '')}" placeholder="Ex.: Dia dos Pais"></div>
                <div class="form-col"><label>Conta / perfil</label><input class="input-field" id="pi-account-${id}" value="${_escapeHtml(t.social_account || '')}" placeholder="@perfil"></div>
              </div>
              <div class="form-row"><div class="form-col full"><label>Legenda</label><textarea class="input-field" id="pi-caption-${id}" rows="3" placeholder="Legenda da postagem...">${_escapeHtml(t.caption || '')}</textarea></div></div>
              <div class="form-row">
                <div class="form-col"><label>Hashtags</label><input class="input-field" id="pi-hash-${id}" value="${_escapeHtml(t.hashtags || '')}" placeholder="#tag #tag"></div>
                <div class="form-col"><label>Tipo de publicação</label><select class="select-field" id="pi-ptype-${id}"><option value="">—</option>${TASK_PUBLISH_TYPES.map(p => `<option ${t.publish_type === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
              </div>
              <label style="font-size:11px;color:var(--text-muted)">Canais</label>
              <div style="display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 8px">
                ${TASK_CHANNELS.map(ch => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:400"><input type="checkbox" class="pi-chan-${id}" value="${ch}" ${channels.includes(ch) ? 'checked' : ''}> ${ch}</label>`).join('')}
              </div>
              <div class="form-row"><div class="form-col full"><label>Observações internas (não vão para a postagem)</label><textarea class="input-field" id="pi-internal-${id}" rows="2">${_escapeHtml(t.internal_notes || '')}</textarea></div></div>
              <button class="btn btn-primary btn-sm" data-action="save-post-info" data-id="${id}"><i class="fas fa-save"></i> Salvar informações</button>
            </div>
          </details>

          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase">
              Arte / Anexos
              ${isSupabaseReady() ? `
                <button class="btn btn-sm btn-ghost" data-action="upload-art-modal" data-id="${id}" style="font-size:11px;margin-left:8px"><i class="fas fa-upload"></i> Upload</button>
                <button class="btn btn-sm btn-ghost" data-action="add-art-link" data-id="${id}" style="font-size:11px"><i class="fas fa-link"></i> Link do Drive</button>
              ` : ''}
            </div>
            ${artHtml}
          </div>

          <details style="margin-bottom:16px;background:var(--bg-secondary);border-radius:8px;padding:12px">
            <summary style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;cursor:pointer">🔗 Links relacionados</summary>
            <div style="margin-top:10px">
              <div id="task-links-${id}">${_taskLinksHtml(t, id)}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <input class="input-field" id="new-link-label-${id}" placeholder="Rótulo" style="width:110px">
                <input class="input-field" id="new-link-url-${id}" placeholder="https://..." style="flex:1">
                <button class="btn btn-secondary btn-sm" data-action="add-task-link" data-id="${id}"><i class="fas fa-plus"></i></button>
              </div>
            </div>
          </details>

          <details style="margin-bottom:16px;background:var(--bg-secondary);border-radius:8px;padding:12px">
            <summary style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;cursor:pointer">✅ Checklist (${checklists.filter(c=>c.done).length}/${checklists.length})</summary>
            <div style="margin-top:10px">
              <div id="checklist-${id}">
                ${checklistHtml || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum item no checklist</div>'}
              </div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <input class="input-field" id="new-check-${id}" placeholder="Novo item..." style="flex:1" onkeyup="if(event.key==='Enter')addCheckItem(${JSON.stringify(id)})" />
                <button class="btn btn-secondary btn-sm" data-action="add-check-item" data-id="${id}"><i class="fas fa-plus"></i></button>
              </div>
            </div>
          </details>

          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">Comentários (${comments.length})</div>
            <div id="comments-${id}">
              ${commentsHtml || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum comentário</div>'}
            </div>
            <div style="position:relative;margin-top:10px">
              <div id="mention-box-${id}" class="mention-box" style="display:none;position:absolute;bottom:calc(100% + 2px);left:0;right:60px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;max-height:170px;overflow:auto;z-index:20;box-shadow:0 6px 20px rgba(0,0,0,.25)"></div>
              <div style="display:flex;gap:8px">
                <textarea class="input-field" id="comment-input-${id}" rows="2" placeholder="Escreva... use @ para mencionar" oninput="onCommentInput('${id}')" style="flex:1;resize:vertical"></textarea>
                <button class="btn btn-primary btn-sm" data-action="add-comment" data-id="${id}" style="align-self:flex-end;white-space:nowrap"><i class="fas fa-paper-plane"></i></button>
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Digite @ para mencionar e notificar.</div>
            </div>
          </div>

          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">Histórico</div>
            <div id="task-history-${id}"><div style="font-size:12px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin"></i></div></div>
          </div>
        </div>

        <!-- RIGHT -->
        <div style="border-left:1px solid var(--border);padding-left:18px">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Cliente</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-purple)">${_escapeHtml(clientName)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Solicitante</div>
              <div style="font-size:13px">${_escapeHtml(reqName)}</div>
              ${reqEmail ? `<div style="font-size:11px;color:var(--text-muted)">${_escapeHtml(reqEmail)}</div>` : ''}
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;display:flex;justify-content:space-between">Responsável</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <div class="avatar-sm">${_escapeHtml(empAv)}</div>
                <span style="font-size:13px">${_escapeHtml(empName)}</span>
              </div>
              <select class="select-field" style="width:100%;font-size:12px" onchange="reassignTask('${id}', this.value)">
                <option value="">Alterar responsável…</option>${assigneeOpts}
              </select>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Data de Postagem</div>
              <div style="font-size:13px;font-weight:600;${overdue?'color:var(--danger)':''}">${formatDateBR(postDate) || '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">TAGS</div>
              <div id="task-tags-${id}">${_taskTagsHtml(t, id)}</div>
              <input class="input-field" id="new-tag-${id}" placeholder="+ tag e Enter" style="font-size:12px;margin-top:4px" onkeyup="if(event.key==='Enter')addTaskTag('${id}')">
            </div>
            <div class="divider" style="margin:4px 0"></div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Mover para Etapa</div>
              <select class="select-field" id="task-stage-${id}" style="width:100%">${stageOpts}</select>
            </div>
            <button class="btn btn-primary" style="width:100%" data-action="move-task" data-id="${id}">
              <i class="fas fa-arrow-right"></i> Mover Etapa
            </button>
            <div class="divider" style="margin:4px 0"></div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:700;text-transform:uppercase">Ações Rápidas</div>
            <button class="btn btn-secondary btn-sm" style="width:100%" data-action="send-to-client" data-id="${id}">
              <i class="fas fa-share"></i> Enviar ao Cliente
            </button>
            <button class="btn btn-sm" style="width:100%;background:#25D366;color:#fff;border-color:#1da851" data-action="send-approval-whatsapp" data-id="${id}">
              <i class="fab fa-whatsapp"></i> Enviar p/ aprovação (WhatsApp)
            </button>
            <button class="btn btn-success btn-sm" style="width:100%" data-action="approve-task" data-id="${id}">
              <i class="fas fa-check"></i> Aprovar
            </button>
            <button class="btn btn-warning btn-sm" style="width:100%" data-action="request-adjust" data-id="${id}">
              <i class="fas fa-redo"></i> Solicitar Ajuste
            </button>
            <div class="divider" style="margin:4px 0"></div>
            <button class="btn btn-sm" style="width:100%;background:rgba(24,119,242,.15);color:#93c5fd;border-color:rgba(24,119,242,.3)" data-action="open-meta-schedule" data-id="${id}">
              <i class="fab fa-facebook" style="margin-right:4px"></i><i class="fab fa-instagram" style="color:#f472b6;margin-right:6px"></i> Programar no Meta
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-sm btn-danger" data-action="delete-task" data-id="${id}"><i class="fas fa-trash"></i> Excluir</button>
      <button class="btn btn-secondary" data-action="close-modal">Fechar</button>
    </div>
  `, 'modal-lg');

  _loadTaskHistory(id);
}

// ─── HELPERS DO CARD (tags, links, histórico, menção) ───
function _taskTagsHtml(t, id) {
  const tags = t.tags || [];
  if (!tags.length) return '<span style="font-size:11px;color:var(--text-muted)">Nenhuma tag.</span>';
  return tags.map(tag => `<span class="tag tag-purple" style="font-size:10px;margin:0 3px 3px 0;display:inline-flex;align-items:center;gap:4px">${_escapeHtml(tag)}<i class="fas fa-times" style="cursor:pointer" onclick="removeTaskTag('${id}', ${JSON.stringify(tag)})"></i></span>`).join('');
}

function _taskLinksHtml(t, id) {
  const links = t.task_links || [];
  if (!links.length) return '<div style="font-size:12px;color:var(--text-muted)">Nenhum link.</div>';
  return links.map(l => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0">
      <i class="fas fa-link" style="color:var(--purple-light);font-size:11px"></i>
      <a href="${_escapeHtml(l.url)}" target="_blank" style="flex:1;font-size:12px;color:var(--purple-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escapeHtml(l.label || l.url)}</a>
      <i class="fas fa-times" style="cursor:pointer;color:var(--danger);font-size:11px" onclick="removeTaskLink('${l.id}', '${id}')"></i>
    </div>`).join('');
}

async function _loadTaskHistory(id) {
  const el = document.getElementById(`task-history-${id}`);
  if (!el) return;
  if (!isSupabaseReady()) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">—</div>'; return; }
  const [sh, ah] = await Promise.all([
    DB.taskStatusHistory.listByTask(id),
    DB.taskAssignmentHistory.listByTask(id),
  ]);
  const events = [];
  (sh.data || []).forEach(h => events.push({ when: h.changed_at, who: h.changer?.full_name, text: h.from_status ? `${h.from_status} → ${h.to_status}` : `Criado em "${h.to_status}"` }));
  (ah.data || []).forEach(h => events.push({ when: h.changed_at, who: h.changer?.full_name, text: `Responsável: ${h.to_user?.full_name || '—'}` }));
  events.sort((a, b) => new Date(b.when) - new Date(a.when));
  el.innerHTML = events.length
    ? events.map(e => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-light)">
        <i class="fas fa-circle" style="font-size:6px;color:var(--purple-light);margin-top:6px"></i>
        <div><div style="font-size:12px">${_escapeHtml(e.text)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${e.who ? _escapeHtml(e.who) + ' · ' : ''}${formatDateBR(e.when)}</div></div>
      </div>`).join('')
    : '<div style="font-size:12px;color:var(--text-muted)">Sem histórico.</div>';
}

function onCommentInput(id) {
  const ta = document.getElementById(`comment-input-${id}`);
  const box = document.getElementById(`mention-box-${id}`);
  if (!ta || !box) return;
  const upto = ta.value.slice(0, ta.selectionStart);
  const m = upto.match(/@([\wÀ-ÿ]*)$/);
  if (!m) { box.style.display = 'none'; return; }
  const q = m[1].toLowerCase();
  const matches = (_mentionUsers || []).filter(u => (u.full_name || '').toLowerCase().includes(q)).slice(0, 6);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(u => `
    <div style="padding:8px 10px;cursor:pointer;display:flex;gap:8px;align-items:center"
         onmousedown="event.preventDefault();pickMention('${id}', ${JSON.stringify(u.full_name)})">
      <div class="avatar-xs">${_escapeHtml(u.avatar_initials || (u.full_name || '').slice(0,2))}</div>
      <span style="font-size:13px">${_escapeHtml(u.full_name)}</span>
    </div>`).join('');
  box.style.display = 'block';
}

function pickMention(id, fullName) {
  const ta = document.getElementById(`comment-input-${id}`);
  if (!ta) return;
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos).replace(/@([\wÀ-ÿ]*)$/, '@' + fullName + ' ');
  ta.value = before + ta.value.slice(pos);
  const box = document.getElementById(`mention-box-${id}`);
  if (box) box.style.display = 'none';
  ta.focus();
  ta.selectionStart = ta.selectionEnd = before.length;
}

async function saveTaskPostInfo(id) {
  const g = (s) => document.getElementById(s + id);
  const payload = {
    post_title: g('pi-title-')?.value.trim() || null,
    social_account: g('pi-account-')?.value.trim() || null,
    caption: g('pi-caption-')?.value.trim() || null,
    hashtags: g('pi-hash-')?.value.trim() || null,
    publish_type: g('pi-ptype-')?.value || null,
    channels: Array.from(document.querySelectorAll(`.pi-chan-${id}:checked`)).map(c => c.value),
    internal_notes: g('pi-internal-')?.value.trim() || null,
  };
  if (!isSupabaseReady()) { showToast('Disponível com Supabase.', 'info'); return; }
  const { error } = await DB.tasks.update(id, payload);
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  const t = _taskData.find(x => String(x.id) === String(id));
  if (t) Object.assign(t, payload);
  showToast('✅ Informações de postagem salvas!', 'success');
}

async function reassignTask(id, assigneeId) {
  if (!assigneeId || !isSupabaseReady()) return;
  const { error } = await DB.tasks.update(id, { assignee_id: assigneeId });
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  const t = _taskData.find(x => String(x.id) === String(id));
  const prof = (_mentionUsers || []).find(p => String(p.id) === String(assigneeId));
  if (t && prof) { t.assignee = { id: prof.id, full_name: prof.full_name, avatar_initials: prof.avatar_initials }; t.assignee_id = assigneeId; }
  showToast('Responsável atualizado.', 'success');
  renderTaskBoard();
  _loadTaskHistory(id);
}

async function addTaskTag(id) {
  const inp = document.getElementById(`new-tag-${id}`);
  const tag = inp?.value.trim();
  if (!tag) return;
  const t = _taskData.find(x => String(x.id) === String(id));
  if (!t) return;
  t.tags = t.tags || [];
  if (t.tags.includes(tag)) { inp.value = ''; return; }
  t.tags.push(tag);
  if (isSupabaseReady()) await DB.tasks.update(id, { tags: t.tags });
  inp.value = '';
  const box = document.getElementById(`task-tags-${id}`);
  if (box) box.innerHTML = _taskTagsHtml(t, id);
}

async function removeTaskTag(id, tag) {
  const t = _taskData.find(x => String(x.id) === String(id));
  if (!t || !t.tags) return;
  t.tags = t.tags.filter(x => x !== tag);
  if (isSupabaseReady()) await DB.tasks.update(id, { tags: t.tags });
  const box = document.getElementById(`task-tags-${id}`);
  if (box) box.innerHTML = _taskTagsHtml(t, id);
}

async function addTaskLink(id) {
  const label = document.getElementById(`new-link-label-${id}`)?.value.trim();
  const url = document.getElementById(`new-link-url-${id}`)?.value.trim();
  if (!url || !/^https?:\/\//i.test(url)) { showToast('URL inválida (comece com http).', 'error'); return; }
  if (!isSupabaseReady()) { showToast('Disponível com Supabase.', 'info'); return; }
  const { data, error } = await DB.taskLinks.create({ task_id: id, label: label || null, url });
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  const t = _taskData.find(x => String(x.id) === String(id));
  if (t) { t.task_links = t.task_links || []; t.task_links.push(data || { id: `tmp-${Date.now()}`, label, url }); }
  document.getElementById(`new-link-label-${id}`).value = '';
  document.getElementById(`new-link-url-${id}`).value = '';
  const box = document.getElementById(`task-links-${id}`);
  if (box) box.innerHTML = _taskLinksHtml(t, id);
}

async function removeTaskLink(linkId, taskId) {
  if (isSupabaseReady()) await DB.taskLinks.remove(linkId);
  const t = _taskData.find(x => String(x.id) === String(taskId));
  if (t && t.task_links) t.task_links = t.task_links.filter(l => String(l.id) !== String(linkId));
  const box = document.getElementById(`task-links-${taskId}`);
  if (box) box.innerHTML = _taskLinksHtml(t, taskId);
}

async function toggleCheck(taskId, checkId, val, idx) {
  // Atualiza visualmente
  const label = document.querySelector(`#ci-${idx} + label, label[for="ci-${idx}"]`);
  if (label) label.classList.toggle('done', val);

  // Atualiza dados
  const task = _taskData.find(x => String(x.id) === String(taskId));
  const checklists = task?.task_checklists || task?.checklist || [];

  if (isSupabaseReady() && typeof checkId === 'string' && checkId.startsWith && !checkId.startsWith('cl-')) {
    await DB.taskChecklists.toggle(checkId, val);
  } else {
    // Fallback local
    const item = checklists[idx];
    if (item) item.done = val;
    const scTask = SC.tasks.find(t => String(t.id) === String(taskId));
    if (scTask?.checklist[idx]) scTask.checklist[idx].done = val;
  }
}

async function addCheckItem(taskId) {
  const inp = document.getElementById(`new-check-${taskId}`);
  const val = inp.value.trim();
  if (!val) return;

  const task = _taskData.find(x => String(x.id) === String(taskId));
  if (!task) return;

  const checklists = task.task_checklists || task.checklist || [];
  const sortOrder = checklists.length;
  let newItem = { id: `cl-${taskId}-${sortOrder}`, text: val, done: false, sort_order: sortOrder };

  if (isSupabaseReady()) {
    const { data, error } = await DB.taskChecklists.add(taskId, val, sortOrder);
    if (!error && data) newItem = data;
  } else {
    // Fallback mock
    const scTask = SC.tasks.find(t => String(t.id) === String(taskId));
    if (scTask) scTask.checklist.push({ done: false, text: val });
  }

  if (task.task_checklists) task.task_checklists.push(newItem);
  else if (task.checklist) task.checklist.push({ done: false, text: val });

  inp.value = '';
  const container = document.getElementById(`checklist-${taskId}`);
  if (container) {
    const noItem = container.querySelector('[style*="padding:8px 0"]');
    if (noItem) noItem.remove();
    const idx = checklists.length - 1;
    const div = document.createElement('div');
    div.className = 'checklist-item';
    div.id = `cli-${idx}`;
    div.innerHTML = `<input type="checkbox" id="ci-${idx}" onchange="toggleCheck(${JSON.stringify(taskId)},${JSON.stringify(newItem.id)},this.checked,${idx})"><label for="ci-${idx}">${val}</label>`;
    container.appendChild(div);
  }
  showToast('Item adicionado!', 'success');
}

async function addComment(taskId) {
  const inp = document.getElementById(`comment-input-${taskId}`);
  const text = inp.value.trim();
  if (!text) { showToast('Digite um comentário!', 'warning'); return; }

  const u = SC.currentUser;
  const task = _taskData.find(x => String(x.id) === String(taskId));

  let newComment = { text, created_at: new Date().toISOString(), user: { full_name: u?.name || u?.full_name || 'Usuário', avatar_initials: u?.avatar || '?' } };

  let commentId = null;
  if (isSupabaseReady() && SB.profile) {
    const { data, error } = await DB.taskComments.add(taskId, SB.profile.id, text);
    if (!error && data) { newComment = { ...data, user: { full_name: SB.profile.full_name, avatar_initials: SB.profile.avatar_initials } }; commentId = data.id; }
    // @menções → notificações
    _notifyMentions(taskId, text, commentId);
  } else {
    const today = new Date().toISOString().split('T')[0];
    const scTask = SC.tasks.find(t => String(t.id) === String(taskId));
    if (scTask) scTask.comments.push({ user: u?.id || 1, text, date: today });
    if (task) {
      if (task.task_comments) task.task_comments.push(newComment);
      else if (task.comments) task.comments.push({ user: u?.id || 1, text, date: today });
    }
  }

  inp.value = '';
  const box = document.getElementById(`mention-box-${taskId}`);
  if (box) box.style.display = 'none';
  const container = document.getElementById(`comments-${taskId}`);
  if (container) {
    const noComment = container.querySelector('[style*="padding:8px 0"]');
    if (noComment) noComment.remove();
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="avatar-sm">${_escapeHtml(newComment.user.avatar_initials)}</div>
      <div class="comment-body">
        <div class="comment-author">${_escapeHtml(newComment.user.full_name)}</div>
        <div class="comment-text">${_renderMentions(text)}</div>
        <div class="comment-date">Agora</div>
      </div>`;
    container.appendChild(div);
  }
  showToast('Comentário enviado!', 'success');
}

// Detecta @Nome no texto, resolve para perfis e cria notificações
async function _notifyMentions(taskId, text, commentId) {
  if (!isSupabaseReady() || !SB.profile) return;
  const users = _mentionUsers && _mentionUsers.length ? _mentionUsers : (await Data.profiles());
  const lower = text.toLowerCase();
  const mentioned = users.filter(u => {
    const fn = (u.full_name || '').toLowerCase();
    if (!fn) return false;
    if (String(u.id) === String(SB.profile.id)) return false; // não notifica a si mesmo
    return lower.includes('@' + fn) || lower.includes('@' + fn.split(' ')[0]);
  });
  // dedup por id
  const seen = new Set();
  for (const u of mentioned) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    await DB.notifications.create({
      recipient_id: u.id, actor_id: SB.profile.id, task_id: taskId, comment_id: commentId,
      type: 'mention', text: `${SB.profile.full_name} mencionou você: "${text.slice(0, 80)}"`,
    });
  }
  if (mentioned.length && typeof NotificationService !== 'undefined') NotificationService.refreshBadge();
}

async function moveTask(id) {
  const t = _taskData.find(x => String(x.id) === String(id));
  const newStage = document.getElementById(`task-stage-${id}`)?.value;
  if (!t || !newStage) return;

  if (newStage === t.status) {
    showToast('Card já está nesta etapa.', 'warning');
    return;
  }

  const prev = t.status;
  t.status = newStage;
  await _saveTaskStatus(id, newStage, prev);
  closeModal();
  renderTaskBoard();

  if (newStage === 'Programado' && MetaService.isClientConfigured(t.client_id || t.client)) {
    setTimeout(() => MetaService.openScheduleModal(t), 350);
  }
}

async function sendToClient(id) {
  await _changeTaskStatus(id, 'Enviado ao Cliente', '📤 Card enviado ao cliente!', 'success');
}

// Envia o conteúdo para aprovação do cliente via WhatsApp (Cloud API).
// O cliente aprova / pede ajuste dentro da própria conversa.
// Requer Supabase conectado, arte enviada (art_url) e telefone do cliente.
async function sendApprovalWhatsApp(id) {
  if (!isSupabaseReady()) {
    showToast('Disponível apenas na versão conectada ao Supabase.', 'warning');
    return;
  }

  const t = _taskData?.find(x => String(x.id) === String(id))
        || SC.tasks.find(x => String(x.id) === String(id));
  if (!t) return;

  if (!t.art_url) {
    showToast('Envie a arte do conteúdo antes de mandar para aprovação.', 'warning');
    return;
  }

  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar p/ aprovação (WhatsApp)'; } };

  try {
    const { data, error } = await supabaseClient.functions.invoke('wa-send', {
      body: { task_id: id },
    });

    if (error || data?.error) {
      const code = data?.error || error?.message || 'erro';
      const msgs = {
        client_phone_missing: 'O cliente não tem telefone cadastrado.',
        art_url_missing: 'Envie a arte do conteúdo antes de mandar para aprovação.',
        task_not_found: 'Tarefa não encontrada no banco.',
        unauthorized: 'Sessão expirada. Faça login novamente.',
        whatsapp_send_failed: 'Falha ao enviar pelo WhatsApp. Verifique a configuração da API.',
      };
      showToast(`Erro: ${msgs[code] || code}`, 'error');
      resetBtn();
      return;
    }

    // Reflete o novo status localmente (mesmo do fluxo web)
    t.status = 'Enviado ao Cliente';
    if (typeof _taskData !== 'undefined') {
      const td = _taskData.find(x => String(x.id) === String(id));
      if (td) td.status = 'Enviado ao Cliente';
    }

    showToast('✅ Enviado para aprovação no WhatsApp!', 'success');
    closeModal();
    renderTaskBoard();
  } catch (e) {
    showToast(`Erro inesperado: ${e.message || e}`, 'error');
    resetBtn();
  }
}

async function approveTask(id) {
  await _changeTaskStatus(id, 'Aprovado', '✅ Card aprovado!', 'success');
}

async function requestAdjust(id) {
  await _changeTaskStatus(id, 'Ajuste Solicitado', '🔄 Ajuste solicitado!', 'warning');
}

async function _changeTaskStatus(id, newStatus, toastMsg, toastType) {
  const t = _taskData.find(x => String(x.id) === String(id));
  if (!t) return;
  const prev = t.status;
  t.status = newStatus;
  await _saveTaskStatus(id, newStatus, prev);
  showToast(toastMsg, toastType);
  closeModal();
  renderTaskBoard();
}

async function deleteTask(id) {
  if (!confirm('Deseja realmente excluir este card? Esta ação não pode ser desfeita.')) return;

  if (isSupabaseReady()) {
    const { error } = await DB.tasks.remove(id);
    if (error) { showToast(`Erro ao excluir: ${error.message}`, 'error'); return; }
  } else {
    SC.tasks = SC.tasks.filter(t => String(t.id) !== String(id));
  }

  _taskData = _taskData.filter(t => String(t.id) !== String(id));
  closeModal();
  showToast('Card excluído.', 'error');
  renderTaskBoard();
}

function uploadArtModal(taskId) {
  if (!isSupabaseReady()) {
    showToast('Upload disponível com Supabase configurado', 'info');
    return;
  }
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-upload" style="color:var(--purple-light);margin-right:8px"></i>Upload de Arte</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="border:2px dashed var(--border);border-radius:8px;padding:30px;text-align:center">
        <i class="fas fa-cloud-upload-alt" style="font-size:36px;color:var(--text-muted);margin-bottom:12px;display:block"></i>
        <input type="file" id="art-file-input" accept="image/*,video/*,.pdf" style="display:none" onchange="handleArtUpload(${JSON.stringify(taskId)},this)">
        <button class="btn btn-primary" data-action="trigger-art-upload">
          <i class="fas fa-folder-open"></i> Selecionar Arquivo
        </button>
        <p style="font-size:12px;color:var(--text-muted);margin-top:10px">PNG, JPG, GIF, MP4, PDF (máx. 20MB)</p>
      </div>
      <div id="upload-progress" style="margin-top:12px;display:none">
        <div class="progress-bar"><div class="progress-fill" id="upload-bar" style="width:0%"></div></div>
        <p id="upload-status" style="font-size:12px;color:var(--text-muted);margin-top:6px;text-align:center">Fazendo upload...</p>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
    </div>
  `);
}

async function handleArtUpload(taskId, input) {
  const file = input.files[0];
  if (!file) return;

  const progress = document.getElementById('upload-progress');
  const bar = document.getElementById('upload-bar');
  const status = document.getElementById('upload-status');
  if (progress) progress.style.display = 'block';

  // Simula progresso
  let p = 0;
  const interval = setInterval(() => {
    p = Math.min(p + 15, 90);
    if (bar) bar.style.width = p + '%';
  }, 200);

  const path = `tasks/${taskId}/${Date.now()}_${file.name}`;
  const { data: url, error } = await SB.uploadFile('task-arts', path, file);

  clearInterval(interval);
  if (bar) bar.style.width = '100%';

  if (error) {
    if (status) status.textContent = `Erro: ${error.message}`;
    showToast('Erro no upload', 'error');
    return;
  }

  const { data: att } = await DB.taskAttachments.add(taskId, url, file.name, file.type, 'arte');
  const tUp = _taskData.find(x => String(x.id) === String(taskId));
  if (tUp && !tUp.art_url) await DB.tasks.update(taskId, { art_url: url });
  _reflectAttachment(taskId, att || { id: `tmp-${Date.now()}`, file_url: url, file_name: file.name, file_type: file.type, kind: 'arte' }, url);
  if (status) status.textContent = 'Upload concluído!';
  showToast('Arte enviada com sucesso!', 'success');

  setTimeout(() => {
    closeModal();
    openTaskModal(taskId);
  }, 800);
}

// Atualiza o card em memória com o novo anexo (evita recarregar o board inteiro)
function _reflectAttachment(taskId, att, artUrl) {
  const t = _taskData.find(x => String(x.id) === String(taskId));
  if (!t) return;
  t.task_attachments = t.task_attachments || [];
  if (att) t.task_attachments.push(att);
  if (artUrl && !t.art_url) t.art_url = artUrl;
}

// Adicionar arte por LINK (Google Drive, etc.) — não depende de upload/bucket
function addArtLinkModal(taskId) {
  if (!isSupabaseReady()) { showToast('Disponível com Supabase configurado', 'info'); return; }
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fab fa-google-drive" style="color:var(--purple-light);margin-right:8px"></i>Link da Arte (Drive, etc.)</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row"><div class="form-col full">
        <label>URL *</label>
        <input class="input-field" id="art-link-url" placeholder="https://drive.google.com/...">
      </div></div>
      <div class="form-row"><div class="form-col full">
        <label>Nome (opcional)</label>
        <input class="input-field" id="art-link-name" placeholder="Ex.: Arte final - carrossel">
      </div></div>
      <p style="font-size:12px;color:var(--text-muted)"><i class="fas fa-info-circle"></i> Cole o link compartilhável do Google Drive (ou qualquer URL da arte).</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="art-link-save" data-action="save-art-link" data-id="${taskId}"><i class="fas fa-link"></i> Adicionar Link</button>
    </div>
  `);
}

async function saveArtLink(taskId) {
  const url = document.getElementById('art-link-url')?.value.trim();
  const name = document.getElementById('art-link-name')?.value.trim();
  if (!url) { showToast('Cole a URL da arte.', 'warning'); return; }
  if (!/^https?:\/\//i.test(url)) { showToast('URL inválida (comece com http).', 'error'); return; }

  const btn = document.getElementById('art-link-save');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

  const label = name || (/drive\.google|docs\.google/.test(url) ? 'Link do Drive' : 'Link da arte');
  const { data, error } = await DB.taskAttachments.add(taskId, url, label, 'uri', 'link');
  if (error) {
    showToast(`Erro: ${error.message}`, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> Adicionar Link'; }
    return;
  }
  const t = _taskData.find(x => String(x.id) === String(taskId));
  if (t && !t.art_url) await DB.tasks.update(taskId, { art_url: url });
  _reflectAttachment(taskId, data || { id: `tmp-${Date.now()}`, file_url: url, file_name: label, kind: 'link' }, url);

  closeModal();
  showToast('✅ Link adicionado!', 'success');
  openTaskModal(taskId);
}

async function deleteArt(attId, taskId) {
  if (!confirm('Remover este anexo?')) return;
  await DB.taskAttachments.remove(attId);
  const t = _taskData.find(x => String(x.id) === String(taskId));
  if (t && t.task_attachments) t.task_attachments = t.task_attachments.filter(a => String(a.id) !== String(attId));
  showToast('Anexo removido.', 'info');
  openTaskModal(taskId);
}

/* ─── GERENCIAR COLUNAS DO KANBAN (modal no board) ─── */
let _colModalData = [];

async function openColumnsModal() {
  if (!isSupabaseReady()) { showToast('Gerenciar colunas requer Supabase.', 'info'); return; }
  const { data } = await DB.kanbanColumns.list();
  _colModalData = data || [];
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-table-columns" style="color:var(--purple-light);margin-right:8px"></i>Colunas do Kanban</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Adicione, renomeie, reordene ou remova etapas. As de <b>sistema</b> <i class="fas fa-lock"></i> são usadas por integrações (WhatsApp/Meta/Área do Cliente) e não podem ser removidas.</p>
      <div id="kbcol-list">${_colModalBody()}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <div class="form-col" style="flex:1"><label>Nova coluna</label><input class="input-field" id="kbcol-new-label" placeholder="Nome da etapa"></div>
        <div class="form-col" style="width:64px"><label>Cor</label><input type="color" class="input-field" id="kbcol-new-color" value="#8b5cf6" style="padding:3px;height:38px"></div>
        <button class="btn btn-primary" data-action="kbcol-add"><i class="fas fa-plus"></i> Adicionar</button>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" data-action="close-modal">Fechar</button></div>
  `, 'modal-lg');
}

function _colModalBody() {
  return _colModalData.map((c, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px">
      <span style="width:14px;height:14px;border-radius:4px;background:${c.color || '#64748b'};flex-shrink:0"></span>
      <input class="input-field" style="flex:1" value="${_escapeHtml(c.label || '')}" ${c.is_system ? 'disabled' : ''} onchange="kbRenameColumn('${c.id}', this.value)">
      ${c.is_system ? '<span class="tag tag-gray" style="font-size:10px"><i class="fas fa-lock"></i> Sistema</span>' : ''}
      <button class="btn btn-ghost btn-sm" ${i === 0 ? 'disabled' : ''} data-action="kbcol-up" data-id="${c.id}" title="Subir"><i class="fas fa-arrow-up"></i></button>
      <button class="btn btn-ghost btn-sm" ${i === _colModalData.length - 1 ? 'disabled' : ''} data-action="kbcol-down" data-id="${c.id}" title="Descer"><i class="fas fa-arrow-down"></i></button>
      ${c.is_system ? '' : `<button class="btn btn-ghost btn-sm" data-action="kbcol-del" data-id="${c.id}" title="Remover"><i class="fas fa-trash" style="color:var(--danger)"></i></button>`}
    </div>`).join('');
}

async function _refreshColsAndBoard() {
  const { data } = await DB.kanbanColumns.list();
  _colModalData = data || [];
  _kanbanCols = await Data.kanbanColumns();
  const listEl = document.getElementById('kbcol-list');
  if (listEl) listEl.innerHTML = _colModalBody();
  renderTaskBoard();
}

async function kbRenameColumn(id, label) {
  label = (label || '').trim();
  if (!label) return;
  await DB.kanbanColumns.update(id, { label });
  showToast('Coluna atualizada.', 'success');
  await _refreshColsAndBoard();
}

async function kbAddColumn() {
  const label = document.getElementById('kbcol-new-label')?.value.trim();
  const color = document.getElementById('kbcol-new-color')?.value || '#8b5cf6';
  if (!label) { showToast('Informe o nome da coluna.', 'warning'); return; }
  if (_colModalData.some(c => c.key === label)) { showToast('Já existe uma coluna com esse nome.', 'error'); return; }
  const position = _colModalData.reduce((m, c) => Math.max(m, c.position || 0), 0) + 1;
  const { error } = await DB.kanbanColumns.create({ key: label, label, position, color, is_system: false });
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  const inp = document.getElementById('kbcol-new-label'); if (inp) inp.value = '';
  showToast('✅ Coluna adicionada!', 'success');
  await _refreshColsAndBoard();
}

async function kbDeleteColumn(id) {
  const col = _colModalData.find(c => c.id === id);
  if (!col) return;
  if (_taskData.some(t => t.status === col.key)) { showToast('Há cards nesta coluna. Mova-os antes de remover.', 'error'); return; }
  if (!confirm(`Remover a coluna "${col.label}"?`)) return;
  await DB.kanbanColumns.remove(id);
  showToast('Coluna removida.', 'info');
  await _refreshColsAndBoard();
}

async function kbMoveColumn(id, dir) {
  const idx = _colModalData.findIndex(c => c.id === id);
  const sw = idx + dir;
  if (idx < 0 || sw < 0 || sw >= _colModalData.length) return;
  const a = _colModalData[idx], b = _colModalData[sw];
  await Promise.all([
    DB.kanbanColumns.update(a.id, { position: b.position }),
    DB.kanbanColumns.update(b.id, { position: a.position }),
  ]);
  await _refreshColsAndBoard();
}

Router.register('tarefas', renderTarefas, 'Gestão de Tarefas');
