// =============================================
// ROUTER — Registry de páginas
// =============================================
// Substitui o switch/case em app.js.
// Cada módulo de página se auto-registra com
// Router.register() no final do próprio arquivo.

const Router = {

  _registry: {},    // { pageName: { fn, label } }
  _current: null,

  // Chamado por cada módulo de página para se registrar
  register(name, renderFn, label) {
    this._registry[name] = { fn: renderFn, label };
  },

  navigate(page) {
    if (!this._registry[page]) {
      // Página não registrada — usa o navigate legado de app.js
      if (typeof navigate === 'function') navigate(page);
      return;
    }

    this._current = page;
    SC.currentPage = page;

    // Atualiza nav ativo
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    // Atualiza breadcrumb
    const label = this._registry[page]?.label || page;
    const bc = document.getElementById('page-breadcrumb');
    if (bc) bc.textContent = label;

    // Limpa e anima conteúdo
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = '';
      content.className = 'page-wrapper animate-in';
    }

    // Executa render
    try {
      this._registry[page].fn();
    } catch (err) {
      console.error(`Router: erro ao renderizar "${page}":`, err);
      if (content) {
        content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar a página</p></div>`;
      }
    }
  },

  getCurrent() {
    return this._current;
  },

  isRegistered(page) {
    return !!this._registry[page];
  },
};
