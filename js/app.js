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

// ─── HELPERS ─────────────────────────────────
// Modal, Toast, StatusTag e formatDateBR foram movidos para:
//   js/components/modal.js
//   js/components/toast.js
//   js/components/statusTag.js
//   js/utils/formatters.js
// Os aliases de compatibilidade estão nos arquivos acima.

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
