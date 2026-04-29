// =============================================
// TOAST — Notificações temporárias
// =============================================

const Toast = {

  _colors: { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#79009d' },
  _icons:  { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' },

  show(msg, type = 'success') {
    const color = this._colors[type] || this._colors.info;
    const icon  = this._icons[type]  || this._icons.info;

    document.querySelectorAll('.sc-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'sc-toast';
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      background:var(--bg-card); border:1px solid ${color};
      border-left:4px solid ${color};
      padding:12px 18px; border-radius:8px; font-size:13px;
      color:var(--text-primary); animation:slideUp 0.3s ease;
      max-width:340px; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      display:flex; align-items:center; gap:10px;
    `;
    toast.innerHTML = `<i class="fas ${icon}" style="color:${color};font-size:15px;flex-shrink:0"></i><span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // Toast específico para a tela de login
  login(msg, type = 'error') {
    const existing = document.querySelector('.login-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'login-toast';
    toast.style.cssText = `
      background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4);
      border-radius:8px; padding:10px 14px; font-size:13px;
      color:#ef4444; margin-top:12px; text-align:center;
      animation:slideUp 0.3s ease;
    `;
    toast.textContent = msg;

    const loginForm = document.querySelector('.login-form');
    if (loginForm) loginForm.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg)    { this.show(msg, 'info'); },
};

// Aliases de compatibilidade — mantêm chamadas antigas funcionando
function showToast(msg, type)      { Toast.show(msg, type); }
function showToastLogin(msg, type) { Toast.login(msg, type); }
