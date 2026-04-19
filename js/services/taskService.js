// =============================================
// TASK SERVICE — Gestão de tarefas / kanban
// =============================================

const TaskService = {

  _cache: null,

  async list(filters = {}) {
    const tasks = await Data.tasks(filters);
    if (!filters || Object.keys(filters).length === 0) {
      this._cache = tasks;
    }
    return tasks;
  },

  async get(id) {
    return Data.task(id);
  },

  async getByColumn(col) {
    const all = await this.list();
    return all.filter(t => t.status === col);
  },

  async create(payload) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.tasks.create(payload);
      if (error) throw error;
      await logActivity('create', 'task', data.id, payload.title);
      return data;
    }
    const newTask = {
      id: Date.now(),
      title: payload.title,
      text: payload.text || '',
      status: payload.status || 'Pauta',
      priority: payload.priority || 'media',
      post_date: payload.post_date,
      created_at: new Date().toISOString().split('T')[0],
      client_id: payload.client_id,
      assignee_id: payload.assignee_id,
      client: { id: payload.client_id, name: ClientService.getName(payload.client_id) },
      assignee: {
        id: payload.assignee_id,
        full_name: SC.getEmployeeName(payload.assignee_id),
        avatar_initials: SC.getEmployeeAvatar(payload.assignee_id),
      },
      task_checklists: [],
      task_comments: [],
      task_attachments: [],
    };
    SC.tasks.push({
      id: newTask.id, title: newTask.title, client: payload.client_id,
      assignee: payload.assignee_id, created: newTask.created_at,
      postDate: payload.post_date, status: newTask.status,
      priority: newTask.priority, text: newTask.text,
      checklist: [], comments: [],
    });
    return newTask;
  },

  async update(id, payload) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.tasks.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      const t = SC.tasks[idx];
      if (payload.title)       t.title = payload.title;
      if (payload.status)      t.status = payload.status;
      if (payload.priority)    t.priority = payload.priority;
      if (payload.post_date)   t.postDate = payload.post_date;
      if (payload.client_id)   t.client = payload.client_id;
      if (payload.assignee_id) t.assignee = payload.assignee_id;
    }
    return SC.tasks[idx];
  },

  async updateStatus(id, status) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.tasks.updateStatus(id, status);
      if (error) throw error;
      return;
    }
    const task = SC.tasks.find(t => t.id === id);
    if (task) task.status = status;
  },

  async remove(id) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.tasks.remove(id);
      if (error) throw error;
      return;
    }
    const idx = SC.tasks.findIndex(t => t.id === id);
    if (idx !== -1) SC.tasks.splice(idx, 1);
  },

  // ── COMENTÁRIOS ───────────────────────────

  async addComment(taskId, text) {
    const userId = SC.currentUser?.id;
    if (isSupabaseReady()) {
      const { data, error } = await DB.taskComments.add(taskId, userId, text);
      if (error) throw error;
      return data;
    }
    const task = SC.tasks.find(t => t.id === taskId);
    if (task) task.comments.push({ user: userId, text, date: new Date().toISOString().split('T')[0] });
  },

  // ── CHECKLIST ─────────────────────────────

  async toggleChecklist(taskId, checkIndex, done) {
    if (isSupabaseReady()) {
      // Requer id do item de checklist — gerenciado pelo módulo de tarefas
      return;
    }
    const task = SC.tasks.find(t => t.id === taskId);
    if (task?.checklist?.[checkIndex] !== undefined) {
      task.checklist[checkIndex].done = done;
    }
  },
};
