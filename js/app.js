// =============================================
// SEJA CREATE — APP CORE (navegação + permissões)
// =============================================
// Auth delegado para AuthService (services/authService.js).
// Modal/Toast/StatusTag em components/.
// Formatters em utils/formatters.js.

// ─── AUTH (wrappers para onclick do HTML) ────

async function doLogin() {
  const role  = document.getElementById('login-role').value;
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  await AuthService.login(email, pass, role);
}

async function doLogout() {
  await AuthService.logout();
}

async function checkExistingSession() {
  await AuthService.checkSession();
}

// ─── PERMISSÕES POR PERFIL ───────────────────

function applyPermissions(role) {
  const hide = id => Dom.hide(id);
  const show = id => Dom.show(id);

  // Reset — mostra tudo antes de aplicar restrições
  ['nav-comercial','nav-operacional','nav-financeiro','nav-relatorios','nav-config'].forEach(show);
  document.querySelectorAll('.nav-item').forEach(el => el.style.display = '');

  const hideFinancial = () => {
    hide('nav-financeiro');
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  };

  switch (role) {
    case 'cliente':
      hide('nav-comercial');
      hide('nav-operacional');
      hide('nav-financeiro');
      hide('nav-relatorios');
      hide('nav-config');
      document.querySelector('[data-page="avisos"]')?.style && (document.querySelector('[data-page="avisos"]').style.display = 'none');
      break;

    case 'designer':
      hideFinancial();
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
      ['[data-page="tarefas"]','[data-page="calendario"]'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el && (el.style.display = 'none'));
      });
      break;

    case 'gestor':
      hideFinancial();
      break;

    case 'admin':
    default:
      break;
  }
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
    case 'dashboard':     renderDashboard();     break;
    case 'avisos':        renderAvisos();        break;
    case 'crm':           renderCRM();           break;
    case 'cadastro':      renderCadastro();      break;
    case 'tarefas':       renderTarefas();       break;
    case 'calendario':    renderCalendario();    break;
    case 'financeiro':    renderFinanceiro();    break;
    case 'relatorios':    renderRelatorios();    break;
    case 'configuracoes': renderConfiguracoes(); break;
    case 'cliente-area':  renderClienteArea();   break;
    default:
      content.innerHTML = `<div class="empty-state"><i class="fas fa-question-circle"></i><p>Página não encontrada</p></div>`;
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main-content').classList.toggle('expanded');
}

// ─── PROTEÇÃO DE ROTAS ───────────────────────

function requirePermission(action) {
  if (!SC.hasPermission(action)) {
    Toast.error('Você não tem permissão para esta ação.');
    return false;
  }
  return true;
}

// ─── INIT ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => checkExistingSession(), 100);
  NotificationService.refreshBadge();
});
