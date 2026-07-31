// =============================================
// NOTIFICATION SERVICE — Avisos + Notificações (@menção)
// =============================================

const NotificationService = {

  _readIds: new Set(),
  _mentionUnread: 0,

  // Avisos derivados (SC.avisos) — mantidos como antes
  async list() {
    return SC.avisos || [];
  },

  // Notificações direcionadas do usuário logado (ex.: @menção)
  async listMentions() {
    if (!isSupabaseReady() || typeof SB === 'undefined' || !SB.profile) return [];
    const { data } = await DB.notifications.listForUser(SB.profile.id);
    return data || [];
  },

  async getUnreadCount() {
    const all = await this.list();
    const avisosUnread = all.filter(a => !this._readIds.has(a.id)).length;
    return avisosUnread + (this._mentionUnread || 0);
  },

  markRead(id) {
    this._readIds.add(id);
    this._updateBadge();
  },

  markAllRead() {
    (SC.avisos || []).forEach(a => this._readIds.add(a.id));
    if (isSupabaseReady() && typeof SB !== 'undefined' && SB.profile) {
      DB.notifications.markAllRead(SB.profile.id).then(() => { this._mentionUnread = 0; this._updateBadge(); });
    }
    this._updateBadge();
  },

  _updateBadge() {
    this.getUnreadCount().then(count => {
      const badge = document.getElementById('badge-avisos');
      if (!badge) return;
      if (count > 0) { badge.textContent = count; badge.style.display = ''; }
      else { badge.style.display = 'none'; }
    });
  },

  // Recarrega a contagem de menções não lidas e atualiza o badge
  async refreshBadge() {
    if (isSupabaseReady() && typeof SB !== 'undefined' && SB.profile) {
      const { count } = await DB.notifications.unreadCount(SB.profile.id);
      this._mentionUnread = count || 0;
    }
    this._updateBadge();
  },
};
