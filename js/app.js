// =============================================
// SEJA CREATE — APP CORE (Auth + Navegação)
// =============================================

async function doLogin() {
  const role = document.getElementById('login-role').value;
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;

  const btn = document.querySelector('.btn-login');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...'; }

  try {
    if (isSupabaseReady()) {
      // ── Autenticação real ──────────────────
      const { data, error } = await SB.login(email, pass);
      if (error) {
        showToastLogin(`❌ ${error.message}`, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar na plataforma'; }
        return;
      }

      const profile = SB.profile;
      if (!profile) {
        showToastLogin('Perfil não encontrado. Contate o administrador.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar na plataforma'; }
        return;
      }

      // Mapeia perfil Supabase → SC.currentUser
      SC.currentUser = {
        id: profile.id,
        name: profile.full_name,
        role: profile.role,
        avatar: profile.avatar_initials || profile.full_name?.slice(0,2) || '??',
        email: profile.email,
        cargo: profile.cargo,
        client_id: profile.client_id,
      };

      // Carrega permissões customizadas do perfil (se houver)
      if (profile.permissions) {
        try {
          const customPerms = JSON.parse(profile.permissions);
          Object.assign(SC.permissoes[profile.role], customPerms);
        } catch { /* ignora JSON inválido */ }
      }

      _postLogin(profile.role);
    } else {
      // ── Modo demo (sem Supabase) ───────────
      await new Promise(r => setTimeout(r, 350));
      const user = SC.users.find(u => u.role === role);
      if (!user) {
        showToastLogin('Usuário não encontrado', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar na plataforma'; }
        return;
      }
      SC.currentUser = user;
      _postLogin(role);
    }
  } catch (err) {
    console.error('Login error:', err);
    showToastLogin('Erro inesperado. Tente novamente.', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar na plataforma'; }
  }
}

function _postLogin(role) {
  const u = SC.currentUser;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const av = u.avatar || u.name?.slice(0,2) || '?';
  document.getElementById('user-avatar').textContent = av;
  document.getElementById('topbar-avatar').textContent = av;
  document.getElementById('user-name').textContent = u.name || u.full_name || '—';
  document.getElementById('user-role-label').textContent = SC.roleLabels[role] || role;

  applyPermissions(role);

  // Navegação inicial por perfil
  if (role === 'cliente') navigate('cliente-area');
  else if (role === 'financeiro') navigate('financeiro');
  else if (role === 'comercial') navigate('crm');
  else navigate('dashboard');
}

async function doLogout() {
  if (isSupabaseReady()) {
    await SB.logout();
  }
  SC.currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');

  // Limpa estado
  if (typeof _taskData !== 'undefined') window._taskData = [];
  if (typeof _leadData !== 'undefined') window._leadData = [];
}

// ─── PERMISSÕES POR PERFIL ───────────────────

function applyPermissions(role) {
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  const show = id => { const el = document.getElementById(id); if (el) el.style.display = ''; };

  // Reset
  ['nav-comercial','nav-operacional','nav-financeiro','nav-relatorios','nav-config'].forEach(show);
  document.querySelectorAll('.nav-item').forEach(el => el.style.display = '');

  const hideFinancial = () => {
    hide('nav-financeiro');
    // Esconde KPIs financeiros no dashboard (será verificado no renderDashboard)
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  };

  switch (role) {
    case 'cliente':
      hide('nav-comercial');
      hide('nav-operacional');
      hide('nav-financeiro');
      hide('nav-relatorios');
      hide('nav-config');
      document.querySelector('[data-page="avisos"]').style.display = 'none';
      break;

    case 'designer':
      hideFinancial();
      // Designer não vê CRM/Cadastro
      hide('nav-comercial');
      break;

    case 'social':
      hideFinancial();
      hide('nav-comercial');
      break;

    case 'comercial':
      hideFinancial();
      hide('nav-operacional');
      break;

    case 'financeiro':
      hide('nav-config');
      // Financeiro não vê módulos operacionais
      ['[data-page="tarefas"]','[data-page="calendario"]'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el && (el.style.display = 'none'));
      });
      break;

    case 'gestor':
      hideFinancial();
      break;

    case 'admin':
    default:
      // Admin vê tudo — não esconde nada
      break;
  }
}

// ─── CHECAR SESSÃO PERSISTIDA ───────────────

async function checkExistingSession() {
  if (!isSupabaseReady()) return;

  const session = await SB.getSession();
  if (!session) return;

  const profile = SB.profile;
  if (!profile) return;

  SC.currentUser = {
    id: profile.id,
    name: profile.full_name,
    role: profile.role,
    avatar: profile.avatar_initials || profile.full_name?.slice(0,2) || '??',
    email: profile.email,
    cargo: profile.cargo,
    client_id: profile.client_id,
  };

  _postLogin(profile.role);
}

// ─── NAVEGAÇÃO ───────────────────────────────

function navigate(page) {
  SC.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const labels = {
    dashboard: 'Dashboard', avisos: 'Avisos Importantes', crm: 'CRM',
    cadastro: 'Cadastro', tarefas: 'Gestão de Tarefas', calendario: 'Calendário',
    financeiro: 'Financeiro', relatorios: 'Relatórios', configuracoes: 'Configurações',
    'cliente-area': 'Área do Cliente'
  };
  document.getElementById('page-breadcrumb').textContent = labels[page] || page;

  const content = document.getElementById('page-content');
  content.innerHTML = '';
  content.className = 'page-wrapper animate-in';

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'avisos': renderAvisos(); break;
    case 'crm': renderCRM(); break;
    case 'cadastro': renderCadastro(); break;
    case 'tarefas': renderTarefas(); break;
    case 'calendario': renderCalendario(); break;
    case 'financeiro': renderFinanceiro(); break;
    case 'relatorios': renderRelatorios(); break;
    case 'configuracoes': renderConfiguracoes(); break;
    case 'cliente-area': renderClienteArea(); break;
    default:
      content.innerHTML = `<div class="empty-state"><i class="fas fa-question-circle"></i><p>Página não encontrada</p></div>`;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main-content').classList.toggle('expanded');
}

// ─── MODAL ────────────────────────────────────

function openModal(html, size = '') {
  closeModal(); // Fecha modal existente, se houver
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay fade-in';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
}

// ─── TOAST ────────────────────────────────────

function showToast(msg, type = 'success') {
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#7c3aed' };
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

  // Remove toast anterior do mesmo tipo
  document.querySelectorAll('.sc-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'sc-toast';
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:var(--bg-card); border:1px solid ${colors[type]};
    border-left: 4px solid ${colors[type]};
    padding:12px 18px; border-radius:8px; font-size:13px;
    color:var(--text-primary); animation:slideUp 0.3s ease;
    max-width:340px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    display:flex; align-items:center; gap:10px;
  `;
  toast.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:15px;flex-shrink:0"></i><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function showToastLogin(msg, type = 'error') {
  const existing = document.querySelector('.login-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'login-toast';
  toast.style.cssText = `
    background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4);
    border-radius: 8px; padding: 10px 14px; font-size: 13px;
    color: #ef4444; margin-top: 12px; text-align: center;
    animation: slideUp 0.3s ease;
  `;
  toast.textContent = msg;
  const loginForm = document.querySelector('.login-form');
  if (loginForm) loginForm.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── HELPERS ─────────────────────────────────

function getStatusTag(s) {
  const c = SC.statusColor(s);
  return `<span class="tag tag-${c}">${s}</span>`;
}

function getPriorityTag(p) {
  const map = { alta: 'red', media: 'yellow', baixa: 'green' };
  const label = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
  return `<span class="tag tag-${map[p]||'gray'}">${label[p]||p}</span>`;
}

function getClientTag(id) {
  return `<span style="font-size:12px;color:var(--text-purple)"><i class="fas fa-building" style="font-size:10px;margin-right:4px"></i>${SC.getClientName(id)}</span>`;
}

// ─── GLOBAL DATE HELPER ─────────────────────
function formatDateBR(d) {
  if (!d) return null;
  try {
    const str = String(d).split('T')[0];
    const p = str.split('-');
    if (p.length < 3) return d;
    return `${p[2]}/${p[1]}/${p[0]}`;
  } catch { return String(d); }
}

// ─── PROTEÇÃO DE ROTAS ───────────────────────

function requirePermission(action) {
  if (!SC.hasPermission(action)) {
    showToast('Você não tem permissão para esta ação.', 'error');
    return false;
  }
  return true;
}

// ─── INIT ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tenta restaurar sessão existente do Supabase
  setTimeout(() => checkExistingSession(), 100);
});
