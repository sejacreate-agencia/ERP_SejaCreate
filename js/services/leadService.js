// =============================================
// LEAD SERVICE — Pipeline CRM
// =============================================

const LeadService = {

  _cache: null,

  async list() {
    if (this._cache) return this._cache;
    this._cache = await Data.leads();
    return this._cache;
  },

  async getByStage(stage) {
    const all = await this.list();
    return all.filter(l => l.stage === stage);
  },

  async create(payload) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.leads.create(payload);
      if (error) throw error;
      return data;
    }
    const newLead = {
      id: Date.now(),
      name: payload.name,
      company: payload.company,
      email: payload.email,
      phone: payload.phone,
      origin: payload.origin,
      service: payload.service,
      stage: payload.stage || 'Lead Novo',
      value: Number(payload.value || 0),
      notes: payload.notes || '',
      last_contact: new Date().toISOString().split('T')[0],
      assignee_id: payload.assignee_id,
      assignee: {
        full_name: SC.getEmployeeName(payload.assignee_id),
        avatar_initials: SC.getEmployeeAvatar(payload.assignee_id),
      },
    };
    SC.leads.push({
      id: newLead.id, name: newLead.name, company: newLead.company,
      email: newLead.email, phone: newLead.phone, origin: newLead.origin,
      service: newLead.service, assignee: payload.assignee_id,
      stage: newLead.stage, value: newLead.value,
      notes: newLead.notes, lastContact: newLead.last_contact,
    });
    return newLead;
  },

  async update(id, payload) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { data, error } = await DB.leads.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.leads.findIndex(l => l.id === id);
    if (idx !== -1) {
      const l = SC.leads[idx];
      if (payload.name)        l.name = payload.name;
      if (payload.company)     l.company = payload.company;
      if (payload.email)       l.email = payload.email;
      if (payload.phone)       l.phone = payload.phone;
      if (payload.service)     l.service = payload.service;
      if (payload.value)       l.value = payload.value;
      if (payload.notes)       l.notes = payload.notes;
      if (payload.assignee_id) l.assignee = payload.assignee_id;
    }
    return SC.leads[idx];
  },

  async updateStage(id, stage) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.leads.updateStage(id, stage);
      if (error) throw error;
      return;
    }
    const lead = SC.leads.find(l => l.id === id);
    if (lead) {
      lead.stage = stage;
      lead.lastContact = new Date().toISOString().split('T')[0];
    }
  },

  async remove(id) {
    this._cache = null;
    if (isSupabaseReady()) {
      const { error } = await DB.leads.remove(id);
      if (error) throw error;
      return;
    }
    const idx = SC.leads.findIndex(l => l.id === id);
    if (idx !== -1) SC.leads.splice(idx, 1);
  },

  // Contagens por estágio para KPIs do CRM
  async getKPIs() {
    const leads = await this.list();
    const fechados  = leads.filter(l => l.stage === 'Fechado');
    const perdidos  = leads.filter(l => l.stage === 'Perdido');
    const ativos    = leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido');
    const totalVal  = ativos.reduce((s, l) => s + (l.value || 0), 0);
    const convRate  = leads.length > 0
      ? Math.round((fechados.length / leads.length) * 100) : 0;

    return {
      total: leads.length,
      fechados: fechados.length,
      perdidos: perdidos.length,
      ativos: ativos.length,
      pipelineValue: totalVal,
      conversionRate: convRate,
    };
  },
};
