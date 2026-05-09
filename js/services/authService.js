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
      Toast.login('Conta autenticada, mas sem perfil cadastrado. Peça ao admin para criar seu perfil na tabela "profiles".');
      return { error: { message: 'profile_not_found' } };
    }

    SC.currentUser = this._mapProfile(profile);

    if (profile.permissions) {
      try {
        const customPerms = JSON.parse(profile.permissions);
        Object.assign(SC.permissoes[profile.role], customPerms);
      } catch { /* ignora JSON inválido */ }
    }

    await hydrateFromSupabase();
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

  async resetPassword(email) {
    if (!isSupabaseReady()) {
      Toast.show('Reset de senha disponível apenas na versão conectada ao Supabase.', 'warning');
      return;
    }
    if (!email) {
      Toast.show('Preencha o e-mail antes de solicitar o reset.', 'warning');
      return;
    }
    const redirectTo = AuthService._getRedirectUrl();
    const opts = redirectTo ? { redirectTo } : {};
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, opts);
    if (error) {
      Toast.show(`Erro: ${error.message}`, 'error');
    } else {
      Toast.show('✅ E-mail de redefinição enviado! Verifique sua caixa de entrada.', 'success');
    }
  },

  async changePassword(newPass, confirmPass) {
    if (!newPass || newPass.length < 6) {
      Toast.show('A senha deve ter no mínimo 6 caracteres.', 'warning');
      return false;
    }
    if (newPass !== confirmPass) {
      Toast.show('As senhas não coincidem.', 'warning');
      return false;
    }
    if (!isSupabaseReady()) {
      Toast.show('Alteração de senha disponível apenas na versão conectada ao Supabase.', 'warning');
      return false;
    }
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) {
      Toast.show(`Erro: ${error.message}`, 'error');
      return false;
    }
    Toast.show('✅ Senha alterada com sucesso!', 'success');
    return true;
  },

  // URL correta para redirect do Supabase (funciona em GitHub Pages e localhost)
  _getRedirectUrl() {
    if (window.APP_CONFIG?.siteUrl) return window.APP_CONFIG.siteUrl;
    if (window.location.protocol === 'file:') return null;
    return window.location.origin + window.location.pathname;
  },

  // Salva nova senha após chegar via link de reset (PASSWORD_RECOVERY)
  async saveRecoveryPassword(newPass, confirmPass) {
    if (!newPass || newPass.length < 6) {
      Toast.show('A senha deve ter no mínimo 6 caracteres.', 'warning');
      return false;
    }
    if (newPass !== confirmPass) {
      Toast.show('As senhas não coincidem.', 'warning');
      return false;
    }
    if (!isSupabaseReady()) {
      Toast.show('Supabase não conectado.', 'warning');
      return false;
    }
    const btn = document.querySelector('[data-action="save-recovery-password"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> Salvar Nova Senha'; }

    if (error) {
      Toast.show(`Erro: ${error.message}`, 'error');
      return false;
    }

    await supabaseClient.auth.signOut();
    Toast.show('✅ Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
    this._showLoginForm();
    return true;
  },

  // Envia e-mail de reset para qualquer usuário (uso do admin)
  async sendResetEmailForUser(email) {
    if (!isSupabaseReady()) {
      Toast.show('Supabase não conectado.', 'warning');
      return false;
    }
    const redirectTo = this._getRedirectUrl();
    const opts = redirectTo ? { redirectTo } : {};
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, opts);
    if (error) {
      Toast.show(`Erro: ${error.message}`, 'error');
      return false;
    }
    Toast.show(`✅ Link de redefinição enviado para ${email}`, 'success');
    return true;
  },

  // Gera senha aleatória segura
  generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
      .map(b => chars[b % chars.length]).join('');
  },

  // Alterna entre o form de login e o de recuperação
  _showLoginForm() {
    const lf = document.querySelector('#login-screen .login-form');
    const rf = document.getElementById('recovery-form');
    if (lf) lf.style.display = '';
    if (rf) rf.style.display = 'none';
  },

  _showRecoveryForm() {
    const lf = document.querySelector('#login-screen .login-form');
    const rf = document.getElementById('recovery-form');
    if (lf) lf.style.display = 'none';
    if (rf) rf.style.display = '';
    // Garante que a tela de login está visível
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
  },

  async checkSession() {
    if (!isSupabaseReady()) return null;

    const session = await SB.getSession();
    if (!session) return null;

    const profile = SB.profile;
    if (!profile) return null;

    SC.currentUser = this._mapProfile(profile);
    await hydrateFromSupabase();
    this._postLogin(profile.role);
    return SC.currentUser;
  },
};
