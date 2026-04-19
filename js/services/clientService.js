// =============================================
// CLIENT SERVICE — Clientes e fornecedores
// =============================================
// Cache em memória evita múltiplas chamadas ao
// banco por página. Resetado no logout.

const ClientService = {

  _cache: null,       // Client[]
  _suppCache: null,   // Supplier[]

  // ── CLIENTES ──────────────────────────────

  async list() {
    if (this._cache) return this._cache;
    this._cache = await Data.clients();
    return this._cache;
  },

  async listActive() {
    const all = await this.list();
    return all.filter(c => c.status === 'ativo');
  },

  async get(id) {
    const all = await this.list();
    const cached = all.find(c => c.id === id);
    if (cached) return cached;

    if (isSupabaseReady()) {
      const { data } = await DB.clients.get(id);
      return data || null;
    }
    return null;
  },

  async create(payload) {
    this._cache = null; // invalida cache
    if (isSupabaseReady()) {
      const { data, error } = await DB.clients.create(payload);
      if (error) throw error;
      return data;
    }
    // Demo: adiciona localmente com id gerado
    const newClient = { ...payload, id: Date.now() };
    SC.clients.push({ ...payload, id: newClient.id, revenue: payload.monthly_revenue || 0 });
    return newClient;
  },

  async update(id, payload) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.clients.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.clients.findIndex(c => c.id === id);
    if (idx !== -1) Object.assign(SC.clients[idx], payload);
    return SC.clients[idx];
  },

  async remove(id) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.clients.remove(id);
      if (error) throw error;
      return;
    }
    const idx = SC.clients.findIndex(c => c.id === id);
    if (idx !== -1) SC.clients.splice(idx, 1);
  },

  // Retorno síncrono do nome — usa cache se disponível, senão SC.clients
  getName(id) {
    if (this._cache) {
      const c = this._cache.find(c => c.id === id || c.id === parseInt(id));
      if (c) return c.name;
    }
    return SC.getClientName(id);
  },

  getPhone(id) {
    if (this._cache) {
      const c = this._cache.find(c => c.id === id || c.id === parseInt(id));
      if (c) return c.phone || c.contact_phone || '';
    }
    return SC.clients.find(c => c.id === id)?.phone || '';
  },

  // ── FORNECEDORES ──────────────────────────

  async listSuppliers() {
    if (this._suppCache) return this._suppCache;
    if (isSupabaseReady()) {
      const { data } = await DB.suppliers.list();
      this._suppCache = data || [];
    } else {
      this._suppCache = SC.suppliers || [];
    }
    return this._suppCache;
  },

  async createSupplier(payload) {
    this._suppCache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.suppliers.create(payload);
      if (error) throw error;
      return data;
    }
    const newSupp = { ...payload, id: Date.now() };
    SC.suppliers.push(newSupp);
    return newSupp;
  },

  async updateSupplier(id, payload) {
    this._suppCache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.suppliers.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.suppliers.findIndex(s => s.id === id);
    if (idx !== -1) Object.assign(SC.suppliers[idx], payload);
    return SC.suppliers[idx];
  },

  async removeSupplier(id) {
    this._suppCache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.suppliers.remove(id);
      if (error) throw error;
      return;
    }
    const idx = SC.suppliers.findIndex(s => s.id === id);
    if (idx !== -1) SC.suppliers.splice(idx, 1);
  },
};
