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

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main-content').classList.toggle('expanded');
}

// ─── INIT ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => checkExistingSession(), 100);
  NotificationService.refreshBadge();
});
