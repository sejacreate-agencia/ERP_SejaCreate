// =============================================
// SEJA CREATE — GESTÃO DE TAREFAS (KANBAN)
// =============================================

let taskView = 'kanban';
let taskFilters = { client: '', assignee: '', status: '', priority: '' };
let draggedTaskId = null;
let _taskData = [];
let _kanbanCols = [];   // colunas dinâmicas (kanban_columns) carregadas do banco

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

async function openCardModal(stage = 'Pauta') {
  const clients = await Data.clients();
  const profiles = await Data.profiles();

  const clientOpts = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const empOpts = profiles.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
  const _colKeys = (_kanbanCols && _kanbanCols.length) ? _kanbanCols.map(c => c.key) : (SC.kanbanCols || []);
  const stageOpts = _colKeys.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus-square" style="color:var(--purple-light);margin-right:8px"></i>Novo Card</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col full"><label>Título *</label><input class="input-field" id="nc-title" placeholder="Título do conteúdo" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Cliente *</label><select class="select-field" id="nc-client">${clientOpts}</select></div>
        <div class="form-col"><label>Responsável *</label><select class="select-field" id="nc-assignee">${empOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Data de Postagem</label><input type="date" class="input-field" id="nc-date" /></div>
        <div class="form-col"><label>Prioridade</label>
          <select class="select-field" id="nc-priority">
            <option value="media">🟡 Média</option>
            <option value="alta">🔴 Alta</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Etapa Inicial</label><select class="select-field" id="nc-stage">${stageOpts}</select></div>
        <div class="form-col">
          <label>Tipo de Conteúdo</label>
          <select class="select-field" id="nc-type">
            ${SC.tiposConteudo.map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full"><label>Texto / Caption *</label><textarea class="input-field" id="nc-text" rows="3" placeholder="Texto do conteúdo que será publicado..."></textarea></div>
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

  const payload = {
    title,
    text,
    client_id: document.getElementById('nc-client').value,
    assignee_id: document.getElementById('nc-assignee').value,
    post_date: document.getElementById('nc-date').value || null,
    status: document.getElementById('nc-stage').value,
    priority: document.getElementById('nc-priority').value,
    content_type: document.getElementById('nc-type')?.value || 'Post Estático',
  };

  if (isSupabaseReady()) {
    const { data, error } = await DB.tasks.create(payload);
    if (error) {
      showToast(`Erro ao criar card: ${error.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Criar Card'; }
      return;
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
  const t = _taskData.find(x => String(x.id) === String(id));
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

  const _colKeys2 = (_kanbanCols && _kanbanCols.length) ? _kanbanCols.map(c => c.key) : (SC.kanbanCols || []);
  const stageOpts = _colKeys2.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('');
  const checklists = t.task_checklists || t.checklist || [];
  const comments = t.task_comments || t.comments || [];
  const attachments = t.task_attachments || [];

  const checklistHtml = checklists.map((item, idx) => `
    <div class="checklist-item" id="cli-${idx}">
      <input type="checkbox" id="ci-${idx}" ${item.done ? 'checked' : ''}
        onchange="toggleCheck(${JSON.stringify(id)},${JSON.stringify(item.id || idx)},this.checked,${idx})">
      <label for="ci-${idx}" class="${item.done ? 'done' : ''}">${item.text}</label>
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
      <div class="avatar-sm">${uAv}</div>
      <div class="comment-body">
        <div class="comment-author">${uName}</div>
        <div class="comment-text">${c.text}</div>
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
          ${getPriorityTag(t.priority)}
          ${getStatusTag(t.status)}
          ${overdue ? `<span class="tag tag-red">⏰ VENCIDA</span>` : ''}
        </div>
        <span class="modal-title">${t.title}</span>
      </div>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 260px;gap:20px">
        <!-- LEFT -->
        <div>
          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase">Texto do Conteúdo</div>
            <div style="background:var(--bg-input);padding:14px;border-radius:8px;font-size:13px;line-height:1.7;color:var(--text-secondary)">${t.text || '—'}</div>
          </div>

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

          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">
              Checklist (${checklists.filter(c=>c.done).length}/${checklists.length})
            </div>
            <div id="checklist-${id}">
              ${checklistHtml || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum item no checklist</div>'}
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <input class="input-field" id="new-check-${id}" placeholder="Novo item..." style="flex:1" onkeyup="if(event.key==='Enter')addCheckItem(${JSON.stringify(id)})" />
              <button class="btn btn-secondary btn-sm" data-action="add-check-item" data-id="${id}"><i class="fas fa-plus"></i></button>
            </div>
          </div>

          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;font-weight:700;text-transform:uppercase">Comentários (${comments.length})</div>
            <div id="comments-${id}">
              ${commentsHtml || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum comentário</div>'}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <textarea class="input-field" id="comment-input-${id}" rows="2" placeholder="Escreva um comentário..." style="flex:1;resize:vertical"></textarea>
              <button class="btn btn-primary btn-sm" data-action="add-comment" data-id="${id}" style="align-self:flex-end;white-space:nowrap"><i class="fas fa-paper-plane"></i> Enviar</button>
            </div>
          </div>
        </div>

        <!-- RIGHT -->
        <div style="border-left:1px solid var(--border);padding-left:18px">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Cliente</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-purple)">${clientName}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Responsável</div>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="avatar-sm">${empAv}</div>
                <span style="font-size:13px">${empName}</span>
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Criado em</div>
              <div style="font-size:13px">${formatDateBR(t.created_at || t.created) || '—'}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Data de Postagem</div>
              <div style="font-size:13px;font-weight:600;${overdue?'color:var(--danger)':''}">${formatDateBR(postDate) || '—'}</div>
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

  if (isSupabaseReady() && SB.profile) {
    const { data, error } = await DB.taskComments.add(taskId, SB.profile.id, text);
    if (!error && data) newComment = { ...data, user: { full_name: SB.profile.full_name, avatar_initials: SB.profile.avatar_initials } };
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
  const container = document.getElementById(`comments-${taskId}`);
  if (container) {
    const noComment = container.querySelector('[style*="padding:8px 0"]');
    if (noComment) noComment.remove();
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.innerHTML = `
      <div class="avatar-sm">${newComment.user.avatar_initials}</div>
      <div class="comment-body">
        <div class="comment-author">${newComment.user.full_name}</div>
        <div class="comment-text">${text}</div>
        <div class="comment-date">Agora</div>
      </div>`;
    container.appendChild(div);
  }
  showToast('Comentário enviado!', 'success');
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

Router.register('tarefas', renderTarefas, 'Gestão de Tarefas');
