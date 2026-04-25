// =============================================
// SEJA CREATE — SUPABASE INTEGRATION
// =============================================
// INSTRUÇÕES DE CONFIGURAÇÃO:
// 1. Crie um projeto no Supabase (supabase.com)
// 2. Vá em Settings > API
// 3. Copie a URL e a anon key
// 4. Substitua os valores abaixo
// 5. Execute o SQL em supabase-schema.sql no SQL Editor
// =============================================

// Lê credenciais do config.local.js (não versionado).
// Se não existir, roda em modo demo sem Supabase.
const SUPABASE_URL      = window.APP_CONFIG?.supabaseUrl      || 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.supabaseAnonKey  || 'SUA_ANON_KEY_AQUI';

// ─── CLIENTE SUPABASE ────────────────────────
// Importado via CDN no index.html
let supabaseClient = null;
let _supabaseReady = false;

function initSupabase() {
  try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        }
      });
      _supabaseReady = true;
      console.log('✅ Supabase inicializado');
    } else {
      console.warn('⚠️ Supabase SDK não carregado — usando dados locais (modo demo)');
      _supabaseReady = false;
    }
  } catch (err) {
    console.warn('⚠️ Erro ao inicializar Supabase:', err.message, '— usando dados locais');
    _supabaseReady = false;
  }
}

function isSupabaseReady() {
  return _supabaseReady && supabaseClient !== null
    && SUPABASE_URL !== 'https://SEU_PROJETO.supabase.co';
}

// ─── ESTADO DE SESSÃO ────────────────────────
const SB = {
  session: null,
  profile: null,

  // ─── AUTH ────────────────────────────────
  async login(email, password) {
    if (!isSupabaseReady()) {
      return { error: { message: 'Supabase não configurado — use o modo demo' } };
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { error };
    this.session = data.session;
    await this.loadProfile(data.user.id);
    return { data };
  },

  async logout() {
    if (!isSupabaseReady()) return;
    await supabaseClient.auth.signOut();
    this.session = null;
    this.profile = null;
  },

  async getSession() {
    if (!isSupabaseReady()) return null;
    const { data } = await supabaseClient.auth.getSession();
    this.session = data?.session || null;
    if (this.session) {
      await this.loadProfile(this.session.user.id);
    }
    return this.session;
  },

  async loadProfile(userId) {
    if (!isSupabaseReady()) return null;
    const { data } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    this.profile = data;
    return data;
  },

  onAuthStateChange(callback) {
    if (!isSupabaseReady()) return;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      this.session = session;
      callback(event, session);
    });
  },

  // ─── GENERIC CRUD ────────────────────────
  async list(table, options = {}) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    let query = supabaseClient.from(table).select(options.select || '*');
    if (options.filters) {
      options.filters.forEach(f => {
        if (f.op === 'eq') query = query.eq(f.col, f.val);
        if (f.op === 'neq') query = query.neq(f.col, f.val);
        if (f.op === 'gte') query = query.gte(f.col, f.val);
        if (f.op === 'lte') query = query.lte(f.col, f.val);
        if (f.op === 'in') query = query.in(f.col, f.val);
        if (f.op === 'ilike') query = query.ilike(f.col, `%${f.val}%`);
      });
    }
    if (options.order) query = query.order(options.order.col, { ascending: options.order.asc ?? true });
    if (options.limit) query = query.limit(options.limit);
    return await query;
  },

  async get(table, id) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    return await supabaseClient.from(table).select('*').eq('id', id).single();
  },

  async insert(table, payload) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    return await supabaseClient.from(table).insert(payload).select().single();
  },

  async update(table, id, payload) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    return await supabaseClient.from(table).update(payload).eq('id', id).select().single();
  },

  async remove(table, id) {
    if (!isSupabaseReady()) return { error: null };
    return await supabaseClient.from(table).delete().eq('id', id);
  },

  async removeWhere(table, filters) {
    if (!isSupabaseReady()) return { error: null };
    let q = supabaseClient.from(table).delete();
    filters.forEach(f => {
      if (f.op === 'eq')  q = q.eq(f.col, f.val);
      if (f.op === 'neq') q = q.neq(f.col, f.val);
      if (f.op === 'gte') q = q.gte(f.col, f.val);
      if (f.op === 'lte') q = q.lte(f.col, f.val);
    });
    return await q;
  },

  async upsert(table, payload, conflictCol = 'id') {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    return await supabaseClient.from(table).upsert(payload, { onConflict: conflictCol }).select().single();
  },

  // ─── STORAGE ─────────────────────────────
  async uploadFile(bucket, path, file) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'offline' } };
    const { data, error } = await supabaseClient.storage.from(bucket).upload(path, file, {
      cacheControl: '3600', upsert: true
    });
    if (error) return { data: null, error };
    const { data: urlData } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    return { data: urlData.publicUrl, error: null };
  },

  getPublicUrl(bucket, path) {
    if (!isSupabaseReady()) return null;
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  // ─── REALTIME ────────────────────────────
  subscribe(table, callback, filter = null) {
    if (!isSupabaseReady()) return null;
    let channel = supabaseClient.channel(`realtime-${table}`);
    const config = { event: '*', schema: 'public', table };
    if (filter) config.filter = filter;
    channel = channel.on('postgres_changes', config, callback);
    channel.subscribe();
    return channel;
  },

  unsubscribe(channel) {
    if (channel && isSupabaseReady()) supabaseClient.removeChannel(channel);
  },
};

// ─── MÓDULOS DE QUERY ────────────────────────

const DB = {

  // ── PROFILES ────────────────────────────
  profiles: {
    async list() {
      return SB.list('profiles', { order: { col: 'full_name', asc: true } });
    },
    async get(id) { return SB.get('profiles', id); },
    async create(data) { return SB.insert('profiles', data); },
    async update(id, data) { return SB.update('profiles', id, data); },
    async remove(id) { return SB.remove('profiles', id); },
    async getByRole(role) {
      return SB.list('profiles', { filters: [{ op: 'eq', col: 'role', val: role }] });
    },
  },

  // ── TEAMS ───────────────────────────────
  teams: {
    async list() {
      return SB.list('teams', {
        select: '*, team_members(profile_id, profiles(full_name, avatar_initials, role))',
        order: { col: 'name', asc: true }
      });
    },
    async get(id) { return SB.get('teams', id); },
    async create(data) { return SB.insert('teams', data); },
    async update(id, data) { return SB.update('teams', id, data); },
    async remove(id) { return SB.remove('teams', id); },
    async addMember(teamId, profileId) {
      return SB.insert('team_members', { team_id: teamId, profile_id: profileId });
    },
    async removeMember(teamId, profileId) {
      if (!isSupabaseReady()) return { error: { message: 'offline' } };
      return supabaseClient.from('team_members')
        .delete().eq('team_id', teamId).eq('profile_id', profileId);
    },
  },

  // ── CLIENTS ─────────────────────────────
  clients: {
    async list() {
      return SB.list('clients', { order: { col: 'name', asc: true } });
    },
    async get(id) { return SB.get('clients', id); },
    async create(data) { return SB.insert('clients', data); },
    async update(id, data) { return SB.update('clients', id, data); },
    async remove(id) { return SB.remove('clients', id); },
    async listActive() {
      return SB.list('clients', {
        filters: [{ op: 'eq', col: 'status', val: 'ativo' }],
        order: { col: 'name', asc: true }
      });
    },
  },

  // ── SUPPLIERS ───────────────────────────
  suppliers: {
    async list() { return SB.list('suppliers', { order: { col: 'name', asc: true } }); },
    async create(data) { return SB.insert('suppliers', data); },
    async update(id, data) { return SB.update('suppliers', id, data); },
    async remove(id) { return SB.remove('suppliers', id); },
  },

  // ── LEADS ───────────────────────────────
  leads: {
    async list() {
      return SB.list('leads', {
        select: '*, assignee:profiles!leads_assignee_id_fkey(full_name, avatar_initials)',
        order: { col: 'created_at', asc: false }
      });
    },
    async getByStage(stage) {
      return SB.list('leads', {
        select: '*, assignee:profiles!leads_assignee_id_fkey(full_name, avatar_initials)',
        filters: [{ op: 'eq', col: 'stage', val: stage }]
      });
    },
    async create(data) { return SB.insert('leads', data); },
    async update(id, data) { return SB.update('leads', id, data); },
    async remove(id) { return SB.remove('leads', id); },
    async updateStage(id, stage) {
      return SB.update('leads', id, { stage, last_contact: new Date().toISOString().split('T')[0] });
    },
  },

  // ── TASKS ───────────────────────────────
  tasks: {
    async list(filters = {}) {
      const sbFilters = [];
      if (filters.client_id) sbFilters.push({ op: 'eq', col: 'client_id', val: filters.client_id });
      if (filters.assignee_id) sbFilters.push({ op: 'eq', col: 'assignee_id', val: filters.assignee_id });
      if (filters.status) sbFilters.push({ op: 'eq', col: 'status', val: filters.status });
      if (filters.priority) sbFilters.push({ op: 'eq', col: 'priority', val: filters.priority });
      return SB.list('tasks', {
        select: `*, client:clients(id, name), assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_initials),
                 task_checklists(id, text, done, sort_order),
                 task_comments(id, text, created_at, user:profiles!task_comments_user_id_fkey(full_name, avatar_initials))`,
        filters: sbFilters,
        order: { col: 'created_at', asc: false }
      });
    },
    async get(id) {
      return SB.list('tasks', {
        select: `*, client:clients(id, name, phone), assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_initials, role),
                 task_checklists(id, text, done, sort_order),
                 task_comments(id, text, created_at, user:profiles!task_comments_user_id_fkey(full_name, avatar_initials)),
                 task_attachments(id, file_url, file_name, file_type, created_at)`,
        filters: [{ op: 'eq', col: 'id', val: id }]
      });
    },
    async create(data) { return SB.insert('tasks', data); },
    async update(id, data) { return SB.update('tasks', id, data); },
    async remove(id) { return SB.remove('tasks', id); },
    async updateStatus(id, status) { return SB.update('tasks', id, { status }); },
    async getByClient(clientId) {
      return SB.list('tasks', {
        filters: [{ op: 'eq', col: 'client_id', val: clientId }],
        order: { col: 'post_date', asc: true }
      });
    },
    async getApproved() {
      return SB.list('tasks', {
        filters: [{ op: 'in', col: 'status', val: ['Aprovado', 'Programado', 'Publicado'] }],
        order: { col: 'post_date', asc: true }
      });
    },
  },

  // ── TASK COMMENTS ───────────────────────
  taskComments: {
    async add(taskId, userId, text) {
      return SB.insert('task_comments', { task_id: taskId, user_id: userId, text });
    },
    async list(taskId) {
      return SB.list('task_comments', {
        select: '*, user:profiles!task_comments_user_id_fkey(full_name, avatar_initials)',
        filters: [{ op: 'eq', col: 'task_id', val: taskId }],
        order: { col: 'created_at', asc: true }
      });
    },
  },

  // ── TASK CHECKLISTS ─────────────────────
  taskChecklists: {
    async add(taskId, text, sortOrder = 0) {
      return SB.insert('task_checklists', { task_id: taskId, text, done: false, sort_order: sortOrder });
    },
    async toggle(id, done) {
      return SB.update('task_checklists', id, { done });
    },
    async remove(id) { return SB.remove('task_checklists', id); },
  },

  // ── TASK ATTACHMENTS ────────────────────
  taskAttachments: {
    async add(taskId, fileUrl, fileName, fileType) {
      return SB.insert('task_attachments', {
        task_id: taskId, file_url: fileUrl, file_name: fileName, file_type: fileType
      });
    },
    async list(taskId) {
      return SB.list('task_attachments', {
        filters: [{ op: 'eq', col: 'task_id', val: taskId }],
        order: { col: 'created_at', asc: false }
      });
    },
    async remove(id) { return SB.remove('task_attachments', id); },
  },

  // ── APPROVALS ───────────────────────────
  approvals: {
    async list(taskId) {
      return SB.list('approvals', {
        select: '*, reviewer:profiles!approvals_reviewer_id_fkey(full_name, avatar_initials)',
        filters: [{ op: 'eq', col: 'task_id', val: taskId }],
        order: { col: 'created_at', asc: false }
      });
    },
    async create(taskId, reviewerId, decision, feedback) {
      return SB.insert('approvals', {
        task_id: taskId, reviewer_id: reviewerId, decision, feedback
      });
    },
    async listPending(clientId) {
      return SB.list('approvals', {
        select: '*, task:tasks(id, title, status, post_date, text, task_attachments(file_url, file_name))',
        filters: [
          { op: 'eq', col: 'client_id', val: clientId },
          { op: 'eq', col: 'decision', val: 'pendente' }
        ],
        order: { col: 'created_at', asc: false }
      });
    },
  },

  // ── FINANCIAL: RECEIVABLES ───────────────
  receivables: {
    async list() {
      return SB.list('financial_receivables', {
        select: '*, client:clients(id, name, phone)',
        order: { col: 'due_date', asc: true }
      });
    },
    async create(data) { return SB.insert('financial_receivables', data); },
    async update(id, data) { return SB.update('financial_receivables', id, data); },
    async markPaid(id) {
      return SB.update('financial_receivables', id, {
        status: 'pago', paid_at: new Date().toISOString()
      });
    },
    async listOverdue() {
      const today = new Date().toISOString().split('T')[0];
      return SB.list('financial_receivables', {
        select: '*, client:clients(id, name, phone)',
        filters: [
          { op: 'lte', col: 'due_date', val: today },
          { op: 'eq', col: 'status', val: 'pendente' }
        ],
        order: { col: 'due_date', asc: true }
      });
    },
    async remove(id) { return SB.remove('financial_receivables', id); },
  },

  // ── FINANCIAL: PAYABLES ─────────────────
  payables: {
    async list() {
      return SB.list('financial_payables', { order: { col: 'due_date', asc: true } });
    },
    async create(data) { return SB.insert('financial_payables', data); },
    async update(id, data) { return SB.update('financial_payables', id, data); },
    async markPaid(id) {
      return SB.update('financial_payables', id, {
        status: 'pago', paid_at: new Date().toISOString()
      });
    },
    async remove(id) { return SB.remove('financial_payables', id); },
  },

  // ── ACTIVITY LOGS ───────────────────────
  activityLogs: {
    async add(userId, action, resourceType, resourceId, details = null) {
      return SB.insert('activity_logs', {
        user_id: userId, action, resource_type: resourceType,
        resource_id: resourceId, details
      });
    },
    async listRecent(limit = 20) {
      return SB.list('activity_logs', {
        select: '*, user:profiles!activity_logs_user_id_fkey(full_name, avatar_initials)',
        order: { col: 'created_at', asc: false },
        limit
      });
    },
  },
};

// ─── HELPER: TRATAR ERRO ─────────────────────
function dbError(error, fallbackFn) {
  if (error?.message === 'offline' || !isSupabaseReady()) {
    if (typeof fallbackFn === 'function') return fallbackFn();
    return null;
  }
  console.error('DB Error:', error);
  showToast(`Erro no banco: ${error.message}`, 'error');
  return null;
}

// ─── HELPER: LOADING STATE ───────────────────
function setLoading(containerId, on = true) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (on) {
    el.innerHTML = `
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Carregando...</span>
      </div>`;
  }
}

// ─── HELPER: EMPTY STATE ─────────────────────
function renderEmptyState(icon, title, subtitle = '') {
  return `<div class="empty-state">
    <i class="fas ${icon}"></i>
    <p>${title}</p>
    ${subtitle ? `<small>${subtitle}</small>` : ''}
  </div>`;
}

// ─── HELPER: LOG DE ATIVIDADE ────────────────
async function logActivity(action, resourceType, resourceId, details = null) {
  if (!isSupabaseReady() || !SB.profile) return;
  try {
    await DB.activityLogs.add(SB.profile.id, action, resourceType, resourceId, details);
  } catch (e) {
    // silencioso — log não deve quebrar fluxo
  }
}

// ─── FALLBACK: ADAPTER SC → FORMATO SUPABASE ─
// Converte dados do mock SC para o mesmo formato que o Supabase retornaria
const SCAdapter = {
  tasks() {
    return SC.tasks.map(t => ({
      id: t.id,
      title: t.title,
      text: t.text,
      status: t.status,
      priority: t.priority,
      post_date: t.postDate,
      created_at: t.created,
      client_id: t.client,
      assignee_id: t.assignee,
      client: { id: t.client, name: SC.getClientName(t.client) },
      assignee: {
        id: t.assignee,
        full_name: SC.getEmployeeName(t.assignee),
        avatar_initials: SC.getEmployeeAvatar(t.assignee)
      },
      task_checklists: t.checklist.map((c, i) => ({
        id: `cl-${t.id}-${i}`, text: c.text, done: c.done, sort_order: i
      })),
      task_comments: t.comments.map((c, i) => ({
        id: `cm-${t.id}-${i}`, text: c.text,
        created_at: c.date,
        user: {
          full_name: SC.getEmployeeName(c.user),
          avatar_initials: SC.getEmployeeAvatar(c.user)
        }
      })),
      task_attachments: [],
    }));
  },

  leads() {
    return SC.leads.map(l => ({
      id: l.id,
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone,
      origin: l.origin,
      service: l.service,
      stage: l.stage,
      value: l.value,
      notes: l.notes,
      last_contact: l.lastContact,
      assignee_id: l.assignee,
      assignee: {
        full_name: SC.getEmployeeName(l.assignee),
        avatar_initials: SC.getEmployeeAvatar(l.assignee)
      },
    }));
  },

  clients() {
    return SC.clients.map(c => ({
      id: c.id,
      name: c.name,
      contact_name: c.resp,
      email: c.email,
      phone: c.phone,
      cnpj: c.cnpj,
      services: c.services,
      plan: c.plan,
      start_date: c.start,
      expiry_date: c.expiry,
      status: c.status,
      monthly_revenue: c.revenue,
    }));
  },

  profiles() {
    return SC.employees.map(e => ({
      id: e.id,
      full_name: e.name,
      avatar_initials: e.avatar || e.name.split(' ').map(w=>w[0]).join('').slice(0,2),
      email: e.email,
      phone: e.phone,
      role: e.role,
      cargo: e.cargo,
      status: e.status,
    }));
  },

  receivables() {
    return SC.finances.receivable.map(r => ({
      id: r.id,
      client_id: r.client,
      client: { id: r.client, name: SC.getClientName(r.client), phone: SC.clients.find(c=>c.id===r.client)?.phone || '' },
      description: r.desc,
      value: r.value,
      due_date: r.due,
      status: r.status,
      paid_at: null,
    }));
  },

  payables() {
    return SC.finances.payable.map(p => ({
      id: p.id,
      supplier_name: p.supplier,
      description: p.desc,
      value: p.value,
      due_date: p.due,
      status: p.status,
      paid_at: null,
    }));
  },

  cashflow() {
    return SC.finances.cashflow;
  },

  dre() {
    return SC.finances.dre;
  },
};

// ─── DADOS UNIFICADOS (Supabase OU Local) ────
const Data = {
  async tasks(filters = {}) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.tasks.list(filters);
      if (!error) return data || [];
    }
    let tasks = SCAdapter.tasks();
    if (filters.client_id) tasks = tasks.filter(t => t.client_id === parseInt(filters.client_id));
    if (filters.assignee_id) tasks = tasks.filter(t => t.assignee_id === parseInt(filters.assignee_id));
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    return tasks;
  },

  async task(id) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.tasks.get(id);
      if (!error && data?.length) return data[0];
    }
    return SCAdapter.tasks().find(t => t.id === id) || null;
  },

  async leads() {
    if (isSupabaseReady()) {
      const { data, error } = await DB.leads.list();
      if (!error) return data || [];
    }
    return SCAdapter.leads();
  },

  async clients() {
    if (isSupabaseReady()) {
      const { data, error } = await DB.clients.list();
      if (!error) return data || [];
    }
    return SCAdapter.clients();
  },

  async profiles() {
    if (isSupabaseReady()) {
      const { data, error } = await DB.profiles.list();
      if (!error) return data || [];
    }
    return SCAdapter.profiles();
  },

  async receivables() {
    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.list();
      if (!error) return data || [];
    }
    return SCAdapter.receivables();
  },

  async payables() {
    if (isSupabaseReady()) {
      const { data, error } = await DB.payables.list();
      if (!error) return data || [];
    }
    return SCAdapter.payables();
  },

  cashflow() {
    return SCAdapter.cashflow();
  },

  dre() {
    return SCAdapter.dre();
  },
};

// ─── HELPERS DE CÁLCULO FINANCEIRO ───────────

function _computeCashflowFromRealData(receivables, payables) {
  const today = new Date();
  const result = [];
  const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const inVal  = receivables.filter(r => (r.due_date || r.due || '').startsWith(key))
                              .reduce((s, r) => s + (r.value || 0), 0);
    const outVal = payables.filter(p => (p.due_date || p.due || '').startsWith(key) && p.status !== 'cancelado')
                           .reduce((s, p) => s + (p.value || 0), 0);
    result.push({ month: mNames[d.getMonth()], in: inVal, out: outVal });
  }
  return result;
}

function _computeDREFromRealData(receivables, payables) {
  const today = new Date();
  const result = [];
  const mNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for (let i = 5; i >= 0; i--) {
    const d      = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key    = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label  = `${mNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    const receita = receivables.filter(r => (r.due_date || r.due || '').startsWith(key))
                               .reduce((s, r) => s + (r.value || 0), 0);
    const custos  = payables.filter(p => (p.due_date || p.due || '').startsWith(key) && p.status !== 'cancelado')
                            .reduce((s, p) => s + (p.value || 0), 0);
    result.push({
      month: label,
      receita,
      impostos: Math.round(receita * 0.06),
      custos_diretos: custos,
      folha: 0,
      despesas_op: 0,
    });
  }
  return result;
}

// ─── HYDRATE SC FROM SUPABASE ────────────────
// Carrega dados reais do Supabase nos arrays SC.*
// para que módulos legados (dashboard, etc.) funcionem com dados reais.
// Se o banco estiver vazio, SC.* fica vazio → sem dados demo.
async function hydrateFromSupabase() {
  if (!isSupabaseReady()) return;

  try {
    const [clients, profiles, tasks, leads, receivables, payables] = await Promise.all([
      SB.list('clients', { order: { col: 'name', asc: true } }),
      SB.list('profiles', { order: { col: 'full_name', asc: true } }),
      SB.list('tasks', {
        select: '*, client:clients(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name,avatar_initials), task_checklists(id,text,done,sort_order), task_comments(id,text,created_at,user_id)',
        order: { col: 'created_at', asc: false }
      }),
      SB.list('leads', {
        select: '*, assignee:profiles!leads_assignee_id_fkey(full_name,avatar_initials)',
        order: { col: 'created_at', asc: false }
      }),
      SB.list('financial_receivables', {
        select: '*, client:clients(id,name,phone)',
        order: { col: 'due_date', asc: true }
      }),
      SB.list('financial_payables', { order: { col: 'due_date', asc: true } }),
    ]);

    // Clientes
    SC.clients = (clients.data || []).map(c => ({
      id: c.id, name: c.name, resp: c.contact_name || '', email: c.email || '',
      phone: c.phone || '', cnpj: c.cnpj || '', services: c.services || [],
      plan: c.plan || 'Padrão', start: c.start_date || '', expiry: c.expiry_date || '',
      status: c.status, revenue: c.monthly_revenue || 0, notes: c.notes || '',
      diaVenc: c.dia_vencimento || null,
    }));

    // Funcionários
    SC.employees = (profiles.data || []).filter(p => p.role !== 'cliente').map(p => ({
      id: p.id, name: p.full_name, avatar: p.avatar_initials || p.full_name?.slice(0,2) || '??',
      avatar_initials: p.avatar_initials || '', email: p.email || '', phone: p.phone || '',
      role: p.role, cargo: p.cargo || '', status: p.status,
    }));

    // Tarefas
    SC.tasks = (tasks.data || []).map(t => ({
      id: t.id, title: t.title, text: t.text || '', status: t.status, priority: t.priority,
      client: t.client_id, client_id: t.client_id,
      assignee: t.assignee_id, assignee_id: t.assignee_id,
      postDate: t.post_date, post_date: t.post_date,
      created: t.created_at?.split('T')[0], created_at: t.created_at,
      contentType: t.content_type, content_type: t.content_type,
      art_url: t.art_url || null,
      checklist: (t.task_checklists || []).map(c => ({ id: c.id, text: c.text, done: c.done })),
      task_checklists: t.task_checklists || [],
      comments: (t.task_comments || []).map(c => ({ id: c.id, text: c.text, date: c.created_at, user: c.user_id })),
      task_comments: t.task_comments || [],
    }));

    // Leads
    SC.leads = (leads.data || []).map(l => ({
      id: l.id, name: l.name, company: l.company, email: l.email || '',
      phone: l.phone || '', origin: l.origin, service: l.service || '',
      stage: l.stage, value: l.value || 0, notes: l.notes || '',
      assignee: l.assignee_id, assignee_id: l.assignee_id,
      lastContact: l.last_contact, last_contact: l.last_contact,
    }));

    // Financeiro
    SC.finances.receivable = (receivables.data || []).map(r => ({
      id: r.id, client: r.client_id, client_id: r.client_id,
      desc: r.description, description: r.description,
      value: r.value, due: r.due_date, due_date: r.due_date,
      status: r.status, paid_at: r.paid_at || null,
    }));

    SC.finances.payable = (payables.data || []).map(p => ({
      id: p.id, supplier: p.supplier_name, supplier_name: p.supplier_name,
      desc: p.description, description: p.description,
      value: p.value, due: p.due_date, due_date: p.due_date,
      status: p.status, paid_at: p.paid_at || null,
      provisao_grupo: p.provisao_grupo || null,
      provisao_mes: p.provisao_mes || null,
      provisao_total: p.provisao_total || null,
    }));

    // Limpa demo data
    SC.suppliers = [];
    SC.avisos    = [];

    // Recalcula Fluxo de Caixa e DRE a partir dos dados reais
    SC.finances.cashflow = _computeCashflowFromRealData(SC.finances.receivable, SC.finances.payable);
    SC.finances.dre      = _computeDREFromRealData(SC.finances.receivable, SC.finances.payable);

    // Gera avisos dinâmicos e atualiza badge
    if (typeof generateAvisosFromData === 'function') generateAvisosFromData();
    NotificationService.refreshBadge();

  } catch (err) {
    console.warn('hydrateFromSupabase error:', err);
  }
}

// ─── INICIALIZAÇÃO ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  if (isSupabaseReady()) {
    SB.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        SC.currentUser = null;
        const app = document.getElementById('app');
        const login = document.getElementById('login-screen');
        if (app) app.classList.add('hidden');
        if (login) login.classList.remove('hidden');
      }
    });
  }
});
