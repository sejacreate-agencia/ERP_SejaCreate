// =============================================
// SEJA CREATE — APP LIFECYCLE
// =============================================
// Auth   → services/authService.js
// Perms  → core/permissions.js
// Router → core/router.js
// Events → core/events.js

// ─── AUTH ────────────────────────────────────

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

// ─── NAVEGAÇÃO ───────────────────────────────
// Wrapper público — mantém compatibilidade com
// qualquer código que chame navigate() diretamente.

function navigate(page) {
  Router.navigate(page);
}

// ─── UI ──────────────────────────────────────

function noCelular() {
  return window.matchMedia('(max-width: 768px)').matches;
}

// No celular a sidebar fica FORA da tela (translateX(-100%)) e quem a traz de
// volta é a classe .mobile-open. Alternar .collapsed ali só mudava a largura de
// um elemento invisível — por isso o menu não abria no iPhone.
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  if (!sidebar) return;

  if (noCelular()) {
    const aberta = sidebar.classList.toggle('mobile-open');
    document.body.classList.toggle('sidebar-aberta', aberta);
    return;
  }

  // Desktop: recolhe para a faixa de ícones
  sidebar.classList.remove('mobile-open');
  document.body.classList.remove('sidebar-aberta');
  sidebar.classList.toggle('collapsed');
  if (main) main.classList.toggle('expanded');
}

// Escolher um item no celular fecha o menu — senão ele fica por cima do
// conteúdo que a pessoa acabou de abrir.
function fecharMenuMobile() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || !sidebar.classList.contains('mobile-open')) return;
  sidebar.classList.remove('mobile-open');
  document.body.classList.remove('sidebar-aberta');
}

// ─── INIT ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Retorno do consentimento do Google (?google=ok|erro). Depois do bloco de
  // recuperacao de senha para nao atrapalhar aquele fluxo.
  setTimeout(() => {
    if (typeof GoogleCalendarService !== 'undefined') GoogleCalendarService.tratarRetorno();
  }, 400);

  // Esconde seletor de perfil demo quando Supabase está configurado
  if (isSupabaseReady()) {
    const demoRow = document.querySelector('.login-roles');
    if (demoRow) demoRow.style.display = 'none';
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.value = '';
    const passInput = document.getElementById('login-pass');
    if (passInput) passInput.value = '';
  }

  // Não faz auto-login se o usuário chegou via link de reset de senha (hash contém type=recovery)
  const _hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (_hashParams.get('type') !== 'recovery') {
    setTimeout(() => checkExistingSession(), 100);
  }
  NotificationService.refreshBadge();
});
