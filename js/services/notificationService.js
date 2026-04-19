// =============================================
// NOTIFICATION SERVICE — Avisos e alertas
// =============================================

const NotificationService = {

  _readIds: new Set(),

  async list() {
    if (isSupabaseReady()) {
      // Futuro: DB.notifications.list() quando a tabela existir
    }
    return SC.avisos || [];
  },

  async getUnreadCount() {
    const all = await this.list();
    return all.filter(a => !this._readIds.has(a.id)).length;
  },

  markRead(id) {
    this._readIds.add(id);
    this._updateBadge();
  },

  markAllRead() {
    SC.avisos.forEach(a => this._readIds.add(a.id));
    this._updateBadge();
  },

  _updateBadge() {
    this.getUnreadCount().then(count => {
      const badge = document.getElementById('badge-avisos');
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    });
  },

  async refreshBadge() {
    this._updateBadge();
  },
};
