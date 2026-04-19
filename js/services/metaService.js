// =============================================
// META SERVICE — Integração com Graph API
// =============================================

const MetaService = {
  GRAPH_VER: 'v19.0',

  getConfig() {
    try { return JSON.parse(localStorage.getItem('sc_meta_config') || '{}'); } catch { return {}; }
  },

  saveConfig(cfg) {
    localStorage.setItem('sc_meta_config', JSON.stringify(cfg));
  },

  getClientConfig(clientId) {
    return (this.getConfig().clients || {})[String(clientId)] || null;
  },

  saveClientConfig(clientId, data) {
    const cfg = this.getConfig();
    if (!cfg.clients) cfg.clients = {};
    cfg.clients[String(clientId)] = { ...data };
    this.saveConfig(cfg);
  },

  removeClientConfig(clientId) {
    const cfg = this.getConfig();
    if (cfg.clients) delete cfg.clients[String(clientId)];
    this.saveConfig(cfg);
  },

  isClientConfigured(clientId) {
    const c = this.getClientConfig(clientId);
    return !!(c && c.page_token && c.page_id);
  },

  // ── GRAPH API ────────────────────────────

  async scheduleOnFacebook({ pageId, pageToken, caption, scheduledUnix }) {
    const url  = `https://graph.facebook.com/${this.GRAPH_VER}/${pageId}/feed`;
    const body = new URLSearchParams({
      message:                 caption,
      published:               'false',
      scheduled_publish_time:  String(scheduledUnix),
      access_token:            pageToken,
    });
    try {
      const res = await fetch(url, { method: 'POST', body });
      return await res.json();
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  async scheduleOnInstagram({ igAccountId, pageToken, caption, imageUrl, scheduledUnix }) {
    const base = `https://graph.facebook.com/${this.GRAPH_VER}`;
    try {
      const createBody = new URLSearchParams({
        image_url:              imageUrl,
        caption,
        published:              'false',
        scheduled_publish_time: String(scheduledUnix),
        access_token:           pageToken,
      });
      const createRes  = await fetch(`${base}/${igAccountId}/media`, { method: 'POST', body: createBody });
      const createData = await createRes.json();
      if (createData.error) return createData;

      const publishBody = new URLSearchParams({
        creation_id:  createData.id,
        access_token: pageToken,
      });
      const publishRes = await fetch(`${base}/${igAccountId}/media_publish`, { method: 'POST', body: publishBody });
      return await publishRes.json();
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  async fetchPageName(pageId, pageToken) {
    try {
      const url = `https://graph.facebook.com/${this.GRAPH_VER}/${pageId}?fields=name&access_token=${pageToken}`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // ── MODAL DE AGENDAMENTO ─────────────────

  openScheduleModal(task) {
    const clientId  = String(task.client_id || task.client);
    const cfg       = this.getClientConfig(clientId);
    const postDate  = task.post_date || task.postDate || '';
    const caption   = task.text || task.description || '';
    const defaultDT = postDate ? postDate.split('T')[0] + 'T10:00' : '';
    const hasIG     = !!(cfg && cfg.ig_account_id);
    const isReady   = !!(cfg && cfg.page_token && cfg.page_id);

    openModal(`
      <div class="modal-header">
        <span class="modal-title">
          <i class="fab fa-facebook" style="color:#1877f2;margin-right:4px"></i>
          <i class="fab fa-instagram" style="color:#e1306c;margin-right:8px"></i>
          Programar no Meta
        </span>
        <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        ${!isReady ? `
          <div style="padding:20px;text-align:center">
            <i class="fas fa-plug" style="color:var(--text-muted);font-size:32px;margin-bottom:12px;display:block"></i>
            <p style="font-size:13px;margin-bottom:12px">Este cliente não tem integração Meta configurada.</p>
            <button class="btn btn-primary" onclick="closeModal();navigate('configuracoes');setTimeout(()=>switchConfigSection('integracoes'),300)">
              <i class="fas fa-cog"></i> Configurar Integrações
            </button>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:14px">
            <div style="padding:10px 12px;background:rgba(24,119,242,.1);border:1px solid rgba(24,119,242,.25);border-radius:8px;font-size:12px;color:#93c5fd;display:flex;align-items:center;gap:10px">
              <i class="fab fa-facebook" style="font-size:16px"></i>
              <span>Página: <strong>${cfg.page_name || cfg.page_id}</strong></span>
              ${hasIG ? `<span style="opacity:.6">·</span><i class="fab fa-instagram" style="color:#f472b6;font-size:16px"></i><span>Instagram conectado</span>` : ''}
            </div>
            <div class="form-row">
              <div class="form-col full">
                <label>Legenda / Caption</label>
                <textarea class="input-field" id="meta-caption" rows="4" style="resize:vertical">${caption}</textarea>
              </div>
            </div>
            <div class="form-row">
              <div class="form-col">
                <label>Data e hora de publicação *</label>
                <input class="input-field" id="meta-datetime" type="datetime-local" value="${defaultDT}" />
                <span style="font-size:11px;color:var(--text-muted)">Mín: 10 minutos a partir de agora</span>
              </div>
              <div class="form-col">
                <label>URL da imagem / arte final</label>
                <input class="input-field" id="meta-image-url" placeholder="https://..." value="${task.art_url || ''}" />
                <span style="font-size:11px;color:var(--text-muted)">Obrigatório para Instagram</span>
              </div>
            </div>
            <div style="display:flex;gap:16px;padding:10px 12px;background:var(--card-bg);border-radius:8px;border:1px solid var(--border)">
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px">
                <input type="checkbox" id="meta-fb-check" checked style="accent-color:#1877f2;width:15px;height:15px" />
                <i class="fab fa-facebook" style="color:#1877f2;font-size:15px"></i> Facebook
              </label>
              ${hasIG ? `
              <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px">
                <input type="checkbox" id="meta-ig-check" style="accent-color:#e1306c;width:15px;height:15px" />
                <i class="fab fa-instagram" style="color:#e1306c;font-size:15px"></i> Instagram
              </label>` : `
              <span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
                <i class="fab fa-instagram" style="opacity:.4"></i> Instagram — configure a conta em Integrações
              </span>`}
            </div>
          </div>
        `}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
        ${isReady ? `
        <button class="btn btn-primary" id="btn-meta-schedule" data-action="meta-schedule-post" data-task-id="${task.id}" style="background:#1877f2;border-color:#1877f2">
          <i class="fab fa-facebook"></i> Programar agora
        </button>` : ''}
      </div>
    `);
  },

  async executeSchedule(taskId) {
    const task = (window._taskData || []).find(x => String(x.id) === String(taskId));
    if (!task) return;

    const clientId    = String(task.client_id || task.client);
    const cfg         = this.getClientConfig(clientId);
    if (!cfg?.page_token) { showToast('Configure a integração Meta primeiro.', 'error'); return; }

    const caption     = document.getElementById('meta-caption')?.value?.trim() || '';
    const datetimeVal = document.getElementById('meta-datetime')?.value;
    const imageUrl    = document.getElementById('meta-image-url')?.value?.trim() || '';
    const doFB        = document.getElementById('meta-fb-check')?.checked;
    const doIG        = document.getElementById('meta-ig-check')?.checked;

    if (!datetimeVal) { showToast('Informe a data e hora de publicação.', 'error'); return; }

    const scheduledUnix = Math.floor(new Date(datetimeVal).getTime() / 1000);
    if (scheduledUnix < Math.floor(Date.now() / 1000) + 600) {
      showToast('A data deve ser pelo menos 10 minutos à frente.', 'error');
      return;
    }

    const btn = document.getElementById('btn-meta-schedule');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; }

    const results = [];

    if (doFB) {
      const r = await this.scheduleOnFacebook({ pageId: cfg.page_id, pageToken: cfg.page_token, caption, scheduledUnix });
      results.push({ platform: 'Facebook', ok: !r.error, data: r });
    }

    if (doIG && cfg.ig_account_id) {
      if (!imageUrl) { showToast('Informe a URL da imagem para o Instagram.', 'warning'); }
      else {
        const r = await this.scheduleOnInstagram({ igAccountId: cfg.ig_account_id, pageToken: cfg.page_token, caption, imageUrl, scheduledUnix });
        results.push({ platform: 'Instagram', ok: !r.error, data: r });
      }
    }

    closeModal();

    results.filter(r => r.ok).forEach(r => showToast(`✅ Publicação programada no ${r.platform}!`, 'success'));
    results.filter(r => !r.ok).forEach(r => showToast(`Erro ${r.platform}: ${r.data.error?.message}`, 'error'));
    if (!results.length) showToast('Selecione pelo menos Facebook ou Instagram.', 'warning');
  },
};
