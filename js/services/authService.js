// =============================================
// AUTH SERVICE — Autenticação e sessão
// =============================================
// Centraliza toda lógica de login/logout.
// Abstrai Supabase (produção) e modo demo.

const AuthService = {

  // Retorna o usuário logado atual
  getCurrentUser() {
    return SC.currentUser || null;
  },

  // Verifica permissão do usuário atual
  hasPermission(action) {
    return SC.hasPermission(action);
  },

  // Rótulos de exibição por role
  roleLabels: {
    admin: 'Administrador', gestor: 'Gestor', social: 'Social Media',
    designer: 'Designer', comercial: 'Comercial', financeiro: 'Financeiro', cliente: 'Cliente'
  },

  async login(email, password, role) {
    const btn = document.querySelector('.btn-login');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    }

    try {
      if (isSupabaseReady()) {
        return await this._loginSupabase(email, password);
      } else {
        return await this._loginDemo(role);
      }
    } catch (err) {
      console.error('AuthService.login error:', err);
      Toast.login('Erro inesperado. Tente novamente.');
      return { error: err };
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar na plataforma';
      }
    }
  },

  async _loginSupabase(email, password) {
    const { data, error } = await SB.login(email, password);
    if (error) {
      Toast.login(`❌ ${error.message}`);
      return { error };
    }

    const profile = SB.profile;
    if (!profile) {
      Toast.login('Perfil não encontrado. Contate o administrador.');
      return { error: { message: 'profile_not_found' } };
    }

    SC.currentUser = this._mapProfile(profile);

    if (profile.permissions) {
      try {
        const customPerms = JSON.parse(profile.permissions);
        Object.assign(SC.permissoes[profile.role], customPerms);
      } catch { /* ignora JSON inválido */ }
    }

    this._postLogin(profile.role);
    return { data: SC.currentUser };
  },

  async _loginDemo(role) {
    await new Promise(r => setTimeout(r, 350));
    const user = SC.users.find(u => u.role === role);
    if (!user) {
      Toast.login('Usuário não encontrado');
      return { error: { message: 'user_not_found' } };
    }
    SC.currentUser = user;
    this._postLogin(role);
    return { data: user };
  },

  _mapProfile(profile) {
    return {
      id: profile.id,
      name: profile.full_name,
      role: profile.role,
      avatar: profile.avatar_initials || profile.full_name?.slice(0, 2) || '??',
      email: profile.email,
      cargo: profile.cargo,
      client_id: profile.client_id,
    };
  },

  _postLogin(role) {
    const u = SC.currentUser;
    Dom.hide('login-screen');
    Dom.show('app');

    const av = u.avatar || u.name?.slice(0, 2) || '?';
    Dom.setText('user-avatar', av);
    Dom.setText('topbar-avatar', av);
    Dom.setText('user-name', u.name || u.full_name || '—');
    Dom.setText('user-role-label', this.roleLabels[role] || role);

    applyPermissions(role);

    // Navegação inicial por role
    if (role === 'cliente')     navigate('cliente-area');
    else if (role === 'financeiro') navigate('financeiro');
    else if (role === 'comercial')  navigate('crm');
    else navigate('dashboard');
  },

  async logout() {
    if (isSupabaseReady()) {
      await SB.logout();
    }

    SC.currentUser = null;

    // Limpa estado dos módulos
    if (typeof _taskData !== 'undefined')  window._taskData = [];
    if (typeof _leadData !== 'undefined')  window._leadData = [];

    // Limpa caches dos services
    ClientService._cache = null;
    TaskService._cache   = null;

    Dom.hide('app');
    Dom.show('login-screen');
  },

  async checkSession() {
    if (!isSupabaseReady()) return null;

    const session = await SB.getSession();
    if (!session) return null;

    const profile = SB.profile;
    if (!profile) return null;

    SC.currentUser = this._mapProfile(profile);
    this._postLogin(profile.role);
    return SC.currentUser;
  },
};
