// =============================================
// MODAL — Overlay e diálogos
// =============================================

const Modal = {

  open(html, size = '') {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay fade-in';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `<div class="modal ${size}">${html}</div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    document.body.appendChild(overlay);
  },

  close() {
    const m = document.getElementById('modal-overlay');
    if (m) m.remove();
  },

  // Diálogo de confirmação com dois botões
  // onConfirm: função chamada ao clicar em "Confirmar"
  confirm(message, onConfirm, options = {}) {
    const {
      title        = 'Confirmar ação',
      confirmLabel = 'Confirmar',
      cancelLabel  = 'Cancelar',
      danger       = false,
    } = options;

    const btnClass = danger ? 'btn btn-danger' : 'btn btn-primary';

    this.open(`
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="Modal.close()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="padding:24px 28px;">
        <p style="color:var(--text-secondary);line-height:1.6;">${message}</p>
      </div>
      <div class="modal-footer" style="padding:16px 28px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border-color);">
        <button class="btn btn-ghost" onclick="Modal.close()">${cancelLabel}</button>
        <button class="${btnClass}" id="modal-confirm-btn">${confirmLabel}</button>
      </div>
    `);

    // Anexa o handler após inserir no DOM
    setTimeout(() => {
      const btn = document.getElementById('modal-confirm-btn');
      if (btn) btn.addEventListener('click', () => {
        this.close();
        onConfirm();
      });
    }, 0);
  },

  // Alerta simples (somente botão OK)
  alert(message, title = 'Aviso') {
    this.open(`
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="Modal.close()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body" style="padding:24px 28px;">
        <p style="color:var(--text-secondary);line-height:1.6;">${message}</p>
      </div>
      <div class="modal-footer" style="padding:16px 28px;display:flex;justify-content:flex-end;border-top:1px solid var(--border-color);">
        <button class="btn btn-primary" onclick="Modal.close()">OK</button>
      </div>
    `);
  },
};

// Aliases de compatibilidade — mantêm chamadas antigas funcionando
function openModal(html, size)  { Modal.open(html, size); }
function closeModal()           { Modal.close(); }
