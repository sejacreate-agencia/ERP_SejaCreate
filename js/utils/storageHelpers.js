// =============================================
// STORAGE HELPERS — localStorage com segurança
// =============================================

const Storage = {

  PREFIX: 'sc_',

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch { /* silencioso */ }
  },

  clear() {
    try {
      const toRemove = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* silencioso */ }
  },

  // Retorna todas as chaves do prefixo sc_
  keys() {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(this.PREFIX))
        .map(k => k.slice(this.PREFIX.length));
    } catch { return []; }
  },
};
