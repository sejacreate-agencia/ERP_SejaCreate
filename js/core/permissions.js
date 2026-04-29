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

  const mods = (SC.modulePermissions && SC.modulePermissions[role]) || {};

  if (!mods.comercial) hide('nav-comercial');

  if (!mods.operacional) hide('nav-operacional');

  if (!mods.financeiro) {
    hide('nav-financeiro');
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  }

  if (!mods.relatorios) hide('nav-relatorios');

  if (!mods.avisos) {
    document.querySelectorAll('[data-page="avisos"]').forEach(el => el.style.display = 'none');
  }

  // nav-config contém dois itens independentes: Configurações e Área do Cliente
  if (!mods.config) {
    document.querySelectorAll('[data-page="configuracoes"]').forEach(el => el.style.display = 'none');
  }
  if (!mods.clienteArea) {
    document.querySelectorAll('[data-page="cliente-area"]').forEach(el => el.style.display = 'none');
  }
  if (!mods.config && !mods.clienteArea) hide('nav-config');
}

function requirePermission(action) {
  if (!SC.hasPermission(action)) {
    Toast.error('Você não tem permissão para esta ação.');
    return false;
  }
  return true;
}
