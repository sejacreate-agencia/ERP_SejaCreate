// =============================================
// PERMISSIONS — Controle de acesso por role
// =============================================
// Extraído de app.js. applyPermissions() ainda
// é chamada por AuthService._postLogin().

function applyPermissions(role) {
  const hide = id => Dom.hide(id);
  const show = id => Dom.show(id);

  // Reset — garante estado limpo antes de aplicar restrições
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
      document.querySelectorAll('[data-page="avisos"]').forEach(el => el.style.display = 'none');
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
      // Admin vê tudo
      break;
  }
}

function requirePermission(action) {
  if (!SC.hasPermission(action)) {
    Toast.error('Você não tem permissão para esta ação.');
    return false;
  }
  return true;
}
