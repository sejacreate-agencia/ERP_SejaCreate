// =============================================
// RELATÓRIOS META — Instagram + Facebook
// =============================================
// Depende de: SB, DB, Data, MetaService,
//             openModal, closeModal, showToast,
//             Router, isSupabaseReady
// =============================================

// ─── CONSTANTES ──────────────────────────────

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

const META_STATUS_BADGE = {
  'Rascunho': { color: '#6b7280', bg: 'rgba(107,114,128,.15)', icon: 'fa-file-alt'       },
  'Revisão':  { color: '#f59e0b', bg: 'rgba(245,158,11,.15)',  icon: 'fa-eye'             },
  'Revisado': { color: '#3b82f6', bg: 'rgba(59,130,246,.15)',  icon: 'fa-check-circle'    },
  'Enviado':  { color: '#10b981', bg: 'rgba(16,185,129,.15)',  icon: 'fa-paper-plane'     },
};

// ─── BANCO: meta_reports ─────────────────────

const MetaReportsDB = {

  async list(filters = {}) {
    if (!isSupabaseReady()) return [];
    let q = supabaseClient
      .from('meta_reports')
      .select('*, client:clients(id, name, email, contact_name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (filters.client_id) q = q.eq('client_id', filters.client_id);
    if (filters.status)    q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) { console.error('MetaReportsDB.list:', error); return []; }
    return data || [];
  },

  async get(id) {
    if (!isSupabaseReady()) return null;
    const { data, error } = await supabaseClient
      .from('meta_reports')
      .select('*, client:clients(id, name, email, contact_name, phone)')
      .eq('id', id)
      .single();
    if (error) { console.error('MetaReportsDB.get:', error); return null; }
    return data;
  },

  async upsert(payload) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'Supabase offline' } };
    return supabaseClient
      .from('meta_reports')
      .upsert(payload, { onConflict: 'client_id,month,year' })
      .select()
      .single();
  },

  async update(id, payload) {
    if (!isSupabaseReady()) return { data: null, error: { message: 'Supabase offline' } };
    return supabaseClient
      .from('meta_reports')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
  },

  async remove(id) {
    if (!isSupabaseReady()) return { error: null };
    return supabaseClient.from('meta_reports').delete().eq('id', id);
  },
};

// ─── COLETA DE DADOS — GRAPH API ─────────────

const MetaInsights = {

  base() { return `https://graph.facebook.com/${MetaService.GRAPH_VER}`; },

  // Período: dia 1 ao último dia do mês
  _period(month, year) {
    const since = new Date(year, month - 1, 1);
    const until = new Date(year, month, 0); // último dia do mês
    return {
      since: Math.floor(since.getTime() / 1000),
      until: Math.floor(until.getTime() / 1000) + 86399,
    };
  },

  async _get(url) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      return { error: { message: e.message } };
    }
  },

  // ── FACEBOOK ────────────────────────────────

  async fetchFacebookData(pageId, pageToken, month, year) {
    const { since, until } = this._period(month, year);
    const base = this.base();

    const metricas = [
      'page_fans',
      'page_impressions',
      'page_reach',
      'page_engaged_users',
      'page_post_engagements',
      'page_fan_adds',
    ].join(',');

    const [insightsRes, postsRes] = await Promise.all([
      this._get(
        `${base}/${pageId}/insights?metric=${metricas}&since=${since}&until=${until}&period=month&access_token=${pageToken}`
      ),
      this._get(
        `${base}/${pageId}/posts?fields=id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares&since=${since}&until=${until}&limit=50&access_token=${pageToken}`
      ),
    ]);

    if (insightsRes.error || postsRes.error) {
      return { ok: false, error: insightsRes.error || postsRes.error, raw: {} };
    }

    // Extrai métricas do array data
    const extract = (key) => {
      const item = (insightsRes.data || []).find(x => x.name === key);
      if (!item || !item.values) return 0;
      // Soma todos os valores do período
      return item.values.reduce((s, v) => s + (v.value || 0), 0);
    };

    const fans            = extract('page_fans');
    const fanAdds         = extract('page_fan_adds');
    const impressions     = extract('page_impressions');
    const reach           = extract('page_reach');
    const engagedUsers    = extract('page_engaged_users');
    const postEngagements = extract('page_post_engagements');

    // Top 5 posts por engajamento
    const posts = (postsRes.data || [])
      .map(p => ({
        id:          p.id,
        message:     (p.message || '').slice(0, 120),
        created:     p.created_time,
        picture:     p.full_picture || null,
        permalink:   p.permalink_url || null,
        likes:       p.likes?.summary?.total_count || 0,
        comments:    p.comments?.summary?.total_count || 0,
        shares:      p.shares?.count || 0,
        engajamento: (p.likes?.summary?.total_count || 0) +
                     (p.comments?.summary?.total_count || 0) +
                     (p.shares?.count || 0),
      }))
      .sort((a, b) => b.engajamento - a.engajamento)
      .slice(0, 5);

    return {
      ok: true,
      fans,
      fan_adds: fanAdds,
      impressions,
      reach,
      engaged_users: engagedUsers,
      post_engagements: postEngagements,
      taxa_crescimento: fans > 0 ? ((fanAdds / (fans - fanAdds)) * 100).toFixed(1) : 0,
      top_posts: posts,
    };
  },

  // ── INSTAGRAM ───────────────────────────────

  async fetchInstagramData(igAccountId, pageToken, month, year) {
    const { since, until } = this._period(month, year);
    const base = this.base();

    const metricas = ['reach', 'impressions', 'profile_views', 'follower_count'].join(',');

    const [accountRes, insightsRes, mediaRes] = await Promise.all([
      this._get(
        `${base}/${igAccountId}?fields=followers_count,media_count&access_token=${pageToken}`
      ),
      this._get(
        `${base}/${igAccountId}/insights?metric=${metricas}&since=${since}&until=${until}&period=month&access_token=${pageToken}`
      ),
      this._get(
        `${base}/${igAccountId}/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count,media_url&since=${since}&until=${until}&limit=50&access_token=${pageToken}`
      ),
    ]);

    const hasError = accountRes.error || insightsRes.error;
    if (hasError) {
      return { ok: false, error: accountRes.error || insightsRes.error, raw: {} };
    }

    const extract = (key) => {
      const item = (insightsRes.data || []).find(x => x.name === key);
      if (!item || !item.values) return 0;
      return item.values.reduce((s, v) => s + (v.value || 0), 0);
    };

    const followers    = accountRes.followers_count || 0;
    const mediaCount   = accountRes.media_count || 0;
    const reach        = extract('reach');
    const impressions  = extract('impressions');
    const profileViews = extract('profile_views');
    const followerGain = extract('follower_count');

    // Top 5 posts por likes + comentários
    const posts = (mediaRes.data || [])
      .map(p => ({
        id:          p.id,
        caption:     (p.caption || '').slice(0, 120),
        type:        p.media_type,
        timestamp:   p.timestamp,
        permalink:   p.permalink || null,
        media_url:   p.media_url || null,
        likes:       p.like_count || 0,
        comments:    p.comments_count || 0,
        engajamento: (p.like_count || 0) + (p.comments_count || 0),
      }))
      .sort((a, b) => b.engajamento - a.engajamento)
      .slice(0, 5);

    return {
      ok: true,
      followers,
      follower_gain: followerGain,
      media_count: mediaCount,
      reach,
      impressions,
      profile_views: profileViews,
      taxa_crescimento: followers > 0
        ? ((followerGain / (followers - followerGain)) * 100).toFixed(1)
        : 0,
      top_posts: posts,
    };
  },
};

// ─── HELPERS ─────────────────────────────────

function _mrFmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function _mrBadge(status) {
  const s = META_STATUS_BADGE[status] || META_STATUS_BADGE['Rascunho'];
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;color:${s.color};background:${s.bg}">
    <i class="fas ${s.icon}" style="font-size:10px"></i>${status}
  </span>`;
}

function _mrMesAno(month, year) {
  return `${MESES[month - 1]} / ${year}`;
}

function _mrDefaultMonth() {
  const d = new Date();
  let m = d.getMonth(); // mês anterior (0-based = mês atual - 1)
  let y = d.getFullYear();
  if (m === 0) { m = 12; y--; } // se janeiro, vai para dezembro do ano anterior
  return { month: m, year: y };
}

function _mrTextEmail(report, clientName, contactName) {
  const mesAno   = _mrMesAno(report.month, report.year);
  const ig       = report.ig_data || {};
  const fb       = report.fb_data || {};
  const igFoll   = ig.followers    ? `${_mrFmt(ig.followers)} seguidores no Instagram` : null;
  const igReach  = ig.reach        ? `alcance de ${_mrFmt(ig.reach)} pessoas no Instagram` : null;
  const fbFans   = fb.fans         ? `${_mrFmt(fb.fans)} curtidores no Facebook` : null;
  const fbReach  = fb.reach        ? `alcance de ${_mrFmt(fb.reach)} pessoas no Facebook` : null;

  const destaques = [igFoll, igReach, fbFans, fbReach].filter(Boolean).slice(0, 3);
  const destaquesHtml = destaques.length
    ? destaques.map(d => `• ${d}`).join('\n')
    : '• Confira os dados detalhados no relatório';

  return {
    assunto: `Relatório de Redes Sociais — ${clientName} — ${mesAno}`,
    corpo: `Olá, ${contactName || clientName}!

Temos ótimas notícias: seu relatório de redes sociais de ${mesAno} está pronto!

Confira os principais resultados deste mês:
${destaquesHtml}

Acesse o relatório completo no link abaixo e veja todos os detalhes do desempenho das suas redes sociais. Estamos sempre trabalhando para trazer os melhores resultados para o seu negócio.

${report.canva_url ? `Ver relatório completo: ${report.canva_url}` : ''}

Qualquer dúvida, estamos à disposição!

Equipe Seja Create
sejacreate@gmail.com`,
  };
}

// ─── ESTADO LOCAL (filtros) ───────────────────

let _mrState = {
  clientFilter: '',
  reports: [],
};

// ─── RENDER PRINCIPAL ────────────────────────

async function renderRelatoriosMeta() {
  const content = document.getElementById('page-content');
  if (!content) return;

  content.innerHTML = `
    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0">Relatórios Meta</h2>
          <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0">Instagram + Facebook por cliente</p>
        </div>
        <button class="btn btn-primary" id="btn-novo-relatorio" style="gap:8px">
          <i class="fas fa-plus"></i> Gerar Relatório
        </button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <select id="mr-filter-client" class="input-field" style="width:220px;padding:8px 12px;font-size:13px">
          <option value="">Todos os clientes</option>
        </select>
        <select id="mr-filter-status" class="input-field" style="width:160px;padding:8px 12px;font-size:13px">
          <option value="">Todos os status</option>
          <option value="Rascunho">Rascunho</option>
          <option value="Revisão">Em Revisão</option>
          <option value="Revisado">Revisado</option>
          <option value="Enviado">Enviado</option>
        </select>
      </div>

      <div id="mr-list-container">
        <div class="loading-state"><i class="fas fa-spinner fa-spin"></i><span>Carregando relatórios...</span></div>
      </div>
    </div>
  `;

  // Popula select de clientes
  const clients = await Data.clients();
  const clientSel = document.getElementById('mr-filter-client');
  if (clientSel) {
    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      clientSel.appendChild(opt);
    });
    if (_mrState.clientFilter) clientSel.value = _mrState.clientFilter;
    clientSel.addEventListener('change', () => {
      _mrState.clientFilter = clientSel.value;
      _mrLoadList();
    });
  }

  const statusSel = document.getElementById('mr-filter-status');
  if (statusSel) {
    statusSel.addEventListener('change', () => _mrLoadList());
  }

  document.getElementById('btn-novo-relatorio')?.addEventListener('click', () => {
    _mrOpenGerarModal(clients);
  });

  await _mrLoadList();
}

async function _mrLoadList() {
  const container = document.getElementById('mr-list-container');
  if (!container) return;

  const clientFilter = document.getElementById('mr-filter-client')?.value || '';
  const statusFilter = document.getElementById('mr-filter-status')?.value  || '';

  container.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><span>Carregando...</span></div>`;

  let reports;
  if (isSupabaseReady()) {
    reports = await MetaReportsDB.list({
      client_id: clientFilter || null,
      status:    statusFilter || null,
    });
  } else {
    reports = [];
  }

  _mrState.reports = reports;

  if (!reports.length) {
    const msg = isSupabaseReady()
      ? 'Clique em "Gerar Relatório" para criar o primeiro.'
      : 'Execute a migration SQL e configure o Supabase para usar este módulo.';
    container.innerHTML = `<div class="empty-state"><i class="fas fa-chart-bar"></i><p>Nenhum relatório encontrado</p><p style="font-size:12px;color:var(--text-muted)">${msg}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
      ${reports.map(r => _mrCardHtml(r)).join('')}
    </div>
  `;

  // Eventos dos cards
  container.querySelectorAll('[data-mr-open]').forEach(el => {
    el.addEventListener('click', () => _mrOpenDetailModal(el.dataset.mrOpen));
  });
  container.querySelectorAll('[data-mr-status]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _mrChangeStatus(el.dataset.mrId, el.dataset.mrStatus);
    });
  });
  container.querySelectorAll('[data-mr-send]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _mrOpenSendModal(el.dataset.mrSend);
    });
  });
  container.querySelectorAll('[data-mr-delete]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _mrDelete(el.dataset.mrDelete);
    });
  });
}

function _mrCardHtml(r) {
  const clientName = r.client?.name || 'Cliente';
  const contact    = r.client?.contact_name || '';
  const created    = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '—';
  const ig         = r.ig_data || {};
  const fb         = r.fb_data || {};
  const status     = r.status || 'Rascunho';

  const canSend    = status === 'Revisado';
  const canReview  = status === 'Rascunho';
  const canRevised = status === 'Revisão';

  return `
    <div class="card" style="cursor:pointer;transition:transform .15s;position:relative" data-mr-open="${r.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:14px;margin-bottom:2px">${clientName}</div>
          ${contact ? `<div style="font-size:11px;color:var(--text-muted)">${contact}</div>` : ''}
        </div>
        ${_mrBadge(status)}
      </div>

      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
        <i class="fas fa-calendar-alt" style="margin-right:5px"></i>${_mrMesAno(r.month, r.year)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:rgba(225,48,108,.07);border:1px solid rgba(225,48,108,.2);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#e1306c;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
            <i class="fab fa-instagram"></i> Seguidores
          </div>
          <div style="font-size:18px;font-weight:700">${_mrFmt(ig.followers || 0)}</div>
          ${ig.follower_gain ? `<div style="font-size:10px;color:var(--text-muted)">+${_mrFmt(ig.follower_gain)} no mês</div>` : ''}
        </div>
        <div style="background:rgba(24,119,242,.07);border:1px solid rgba(24,119,242,.2);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:#1877f2;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
            <i class="fab fa-facebook"></i> Curtidores
          </div>
          <div style="font-size:18px;font-weight:700">${_mrFmt(fb.fans || 0)}</div>
          ${fb.fan_adds ? `<div style="font-size:10px;color:var(--text-muted)">+${_mrFmt(fb.fan_adds)} no mês</div>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${canReview ? `
          <button class="btn btn-secondary" style="font-size:11px;padding:5px 10px" data-mr-status="Revisão" data-mr-id="${r.id}">
            <i class="fas fa-eye"></i> Enviar p/ Revisão
          </button>` : ''}
        ${canRevised ? `
          <button class="btn btn-secondary" style="font-size:11px;padding:5px 10px;color:#3b82f6;border-color:#3b82f6" data-mr-status="Revisado" data-mr-id="${r.id}">
            <i class="fas fa-check"></i> Marcar Revisado
          </button>` : ''}
        ${canSend ? `
          <button class="btn btn-primary" style="font-size:11px;padding:5px 10px;background:#10b981;border-color:#10b981" data-mr-send="${r.id}">
            <i class="fas fa-paper-plane"></i> Enviar ao Cliente
          </button>` : ''}
        ${r.canva_url ? `
          <a href="${r.canva_url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:5px 10px;border-radius:6px;background:rgba(0,200,150,.1);color:#00c896;text-decoration:none;border:1px solid rgba(0,200,150,.2)">
            <i class="fas fa-external-link-alt"></i> Canva
          </a>` : ''}
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 8px;margin-left:auto;color:var(--text-muted)" data-mr-delete="${r.id}" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>

      <div style="font-size:10px;color:var(--text-muted);margin-top:10px">
        Criado em ${created}
      </div>
    </div>
  `;
}

// ─── MODAL: GERAR RELATÓRIO ──────────────────

async function _mrOpenGerarModal(clients) {
  // Filtra clientes com Meta configurado
  const configured = (clients || []).filter(c => MetaService.isClientConfigured(c.id));

  const { month, year } = _mrDefaultMonth();

  // Options de mês
  const monthOpts = MESES.map((m, i) =>
    `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`
  ).join('');

  // Options de ano
  const curYear = new Date().getFullYear();
  const yearOpts = [curYear - 1, curYear].map(y =>
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fab fa-meta" style="color:var(--purple);margin-right:8px"></i>
        Gerar Relatório Meta
      </span>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="padding:24px 28px;display:flex;flex-direction:column;gap:16px">
      ${!configured.length ? `
        <div style="text-align:center;padding:20px">
          <i class="fas fa-plug" style="font-size:32px;color:var(--text-muted);display:block;margin-bottom:12px"></i>
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">
            Nenhum cliente tem integração Meta configurada.
          </p>
          <button class="btn btn-primary" onclick="closeModal();Router.navigate('configuracoes')">
            <i class="fas fa-cog"></i> Ir para Configurações
          </button>
        </div>
      ` : `
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">CLIENTE</label>
          <select id="mr-gen-client" class="input-field">
            <option value="">Selecione um cliente...</option>
            ${configured.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px">
            Apenas clientes com integração Meta ativa aparecem aqui.
          </p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">MÊS</label>
            <select id="mr-gen-month" class="input-field">${monthOpts}</select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">ANO</label>
            <select id="mr-gen-year" class="input-field">${yearOpts}</select>
          </div>
        </div>
        <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:8px;padding:12px;font-size:12px;color:var(--text-muted)">
          <i class="fas fa-info-circle" style="color:var(--purple);margin-right:6px"></i>
          Os dados serão coletados via Meta Graph API. Se houver falha de CORS ou token inválido,
          o relatório será salvo com dados zerados e você pode editar manualmente.
        </div>
      `}
    </div>
    <div class="modal-footer" style="justify-content:flex-end;gap:10px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      ${configured.length ? `
      <button class="btn btn-primary" id="btn-mr-gen-confirm">
        <i class="fas fa-cloud-download-alt"></i> Coletar dados e Salvar
      </button>` : ''}
    </div>
  `);

  document.getElementById('btn-mr-gen-confirm')?.addEventListener('click', _mrDoGerar);
}

async function _mrDoGerar() {
  const clientId = document.getElementById('mr-gen-client')?.value;
  const month    = parseInt(document.getElementById('mr-gen-month')?.value);
  const year     = parseInt(document.getElementById('mr-gen-year')?.value);

  if (!clientId) { showToast('Selecione um cliente.', 'warning'); return; }
  if (!month || !year) { showToast('Selecione mês e ano.', 'warning'); return; }

  const btn = document.getElementById('btn-mr-gen-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Coletando...'; }

  const cfg = MetaService.getClientConfig(clientId);
  let fb_data = {};
  let ig_data = {};

  if (cfg?.page_id && cfg?.page_token) {
    // Coleta Facebook
    try {
      const fbRes = await MetaInsights.fetchFacebookData(cfg.page_id, cfg.page_token, month, year);
      if (fbRes.ok) fb_data = fbRes;
      else console.warn('FB insights falhou:', fbRes.error);
    } catch (e) {
      console.warn('Erro ao buscar Facebook:', e);
    }

    // Coleta Instagram
    if (cfg.ig_account_id) {
      try {
        const igRes = await MetaInsights.fetchInstagramData(cfg.ig_account_id, cfg.page_token, month, year);
        if (igRes.ok) ig_data = igRes;
        else console.warn('IG insights falhou:', igRes.error);
      } catch (e) {
        console.warn('Erro ao buscar Instagram:', e);
      }
    }
  }

  const payload = {
    client_id: clientId,
    month,
    year,
    status: 'Rascunho',
    fb_data,
    ig_data,
  };

  const { data, error } = await MetaReportsDB.upsert(payload);

  closeModal();

  if (error) {
    showToast(`Erro ao salvar: ${error.message}`, 'error');
    return;
  }

  const hasData = Object.keys(fb_data).length > 0 || Object.keys(ig_data).length > 0;
  showToast(
    hasData
      ? 'Relatório gerado com dados da API Meta!'
      : 'Relatório criado (sem dados — verifique o token Meta nas configurações).',
    hasData ? 'success' : 'warning'
  );

  await _mrLoadList();
  if (data?.id) _mrOpenDetailModal(data.id);
}

// ─── MODAL: DETALHE DO RELATÓRIO ─────────────

async function _mrOpenDetailModal(reportId) {
  const r = await MetaReportsDB.get(reportId);
  if (!r) { showToast('Relatório não encontrado.', 'error'); return; }

  const ig   = r.ig_data || {};
  const fb   = r.fb_data || {};
  const name = r.client?.name || 'Cliente';

  const topIgPosts = (ig.top_posts || []).slice(0, 3);
  const topFbPosts = (fb.top_posts || []).slice(0, 3);

  const _kpi = (label, value, icon, color) => `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:11px;color:${color};font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        <i class="fas ${icon}" style="margin-right:4px"></i>${label}
      </div>
      <div style="font-size:22px;font-weight:800">${_mrFmt(value)}</div>
    </div>`;

  const _postCard = (p, isIG) => `
    <div style="display:flex;gap:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px">
      ${(isIG ? p.media_url : p.picture) ? `
        <img src="${isIG ? p.media_url : p.picture}" alt="post"
          style="width:54px;height:54px;object-fit:cover;border-radius:6px;flex-shrink:0"
          onerror="this.style.display='none'" />` : `
        <div style="width:54px;height:54px;border-radius:6px;background:var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center">
          <i class="fas fa-image" style="color:var(--text-muted)"></i>
        </div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">
          ${isIG ? (p.caption || '(sem legenda)') : (p.message || '(sem texto)')}
        </div>
        <div style="display:flex;gap:12px;font-size:11px;font-weight:600">
          <span><i class="fas fa-heart" style="color:#ef4444;margin-right:3px"></i>${_mrFmt(p.likes)}</span>
          <span><i class="fas fa-comment" style="color:#3b82f6;margin-right:3px"></i>${_mrFmt(p.comments)}</span>
          ${!isIG && p.shares ? `<span><i class="fas fa-share" style="color:#10b981;margin-right:3px"></i>${_mrFmt(p.shares)}</span>` : ''}
        </div>
      </div>
      ${p.permalink ? `
        <a href="${p.permalink}" target="_blank" rel="noopener" style="flex-shrink:0;color:var(--text-muted);font-size:12px;align-self:center">
          <i class="fas fa-external-link-alt"></i>
        </a>` : ''}
    </div>`;

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fab fa-meta" style="color:var(--purple);margin-right:8px"></i>
        ${name} — ${_mrMesAno(r.month, r.year)}
      </span>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="padding:20px 28px;display:flex;flex-direction:column;gap:20px;max-height:72vh;overflow-y:auto">

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        ${_mrBadge(r.status)}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${r.status === 'Rascunho' ? `<button class="btn btn-secondary" style="font-size:12px" onclick="_mrChangeStatus('${r.id}','Revisão');closeModal()"><i class="fas fa-eye"></i> Enviar p/ Revisão</button>` : ''}
          ${r.status === 'Revisão'  ? `<button class="btn btn-secondary" style="font-size:12px;color:#3b82f6;border-color:#3b82f6" onclick="_mrChangeStatus('${r.id}','Revisado');closeModal()"><i class="fas fa-check"></i> Marcar Revisado</button>` : ''}
          ${r.status === 'Revisado' ? `<button class="btn btn-primary" style="font-size:12px;background:#10b981;border-color:#10b981" onclick="closeModal();_mrOpenSendModal('${r.id}')"><i class="fas fa-paper-plane"></i> Enviar ao Cliente</button>` : ''}
        </div>
      </div>

      <!-- URL Canva -->
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">LINK DO CANVA (design do relatório)</label>
        <div style="display:flex;gap:8px">
          <input class="input-field" id="mr-canva-url-${r.id}" type="url" placeholder="https://www.canva.com/design/..." value="${r.canva_url || ''}" style="flex:1;font-size:13px" />
          <button class="btn btn-secondary" id="btn-mr-save-canva-${r.id}" style="font-size:12px;white-space:nowrap">
            <i class="fas fa-save"></i> Salvar
          </button>
          ${r.canva_url ? `<a href="${r.canva_url}" target="_blank" rel="noopener" class="btn btn-ghost" style="font-size:12px"><i class="fas fa-external-link-alt"></i> Abrir</a>` : ''}
        </div>
      </div>

      <!-- Instagram KPIs -->
      <div>
        <div style="font-size:12px;font-weight:700;color:#e1306c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fab fa-instagram"></i> Instagram
        </div>
        ${!ig.followers && !ig.reach ? `
          <p style="font-size:12px;color:var(--text-muted)">Dados não disponíveis. Verifique a integração Meta nas Configurações.</p>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:14px">
            ${_kpi('Seguidores',    ig.followers     || 0, 'fa-user-friends', '#e1306c')}
            ${_kpi('Ganho mês',     ig.follower_gain || 0, 'fa-user-plus',    '#e1306c')}
            ${_kpi('Alcance',       ig.reach         || 0, 'fa-eye',          '#a855f7')}
            ${_kpi('Impressões',    ig.impressions   || 0, 'fa-layer-group',  '#a855f7')}
            ${_kpi('Visitas perfil',ig.profile_views || 0, 'fa-id-badge',     '#6366f1')}
          </div>
          ${topIgPosts.length ? `
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Top Posts</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${topIgPosts.map(p => _postCard(p, true)).join('')}
            </div>` : ''}
        `}
      </div>

      <!-- Facebook KPIs -->
      <div>
        <div style="font-size:12px;font-weight:700;color:#1877f2;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          <i class="fab fa-facebook"></i> Facebook
        </div>
        ${!fb.fans && !fb.reach ? `
          <p style="font-size:12px;color:var(--text-muted)">Dados não disponíveis. Verifique a integração Meta nas Configurações.</p>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:14px">
            ${_kpi('Curtidores',   fb.fans             || 0, 'fa-thumbs-up',    '#1877f2')}
            ${_kpi('Ganho mês',    fb.fan_adds         || 0, 'fa-user-plus',    '#1877f2')}
            ${_kpi('Alcance',      fb.reach            || 0, 'fa-eye',          '#3b82f6')}
            ${_kpi('Impressões',   fb.impressions      || 0, 'fa-layer-group',  '#6366f1')}
            ${_kpi('Engajamento',  fb.post_engagements || 0, 'fa-heart',        '#ef4444')}
          </div>
          ${topFbPosts.length ? `
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Top Posts</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${topFbPosts.map(p => _postCard(p, false)).join('')}
            </div>` : ''}
        `}
      </div>

      <!-- Notas internas -->
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">NOTAS INTERNAS</label>
        <textarea class="input-field" id="mr-notes-${r.id}" rows="3" style="width:100%;resize:vertical;font-size:13px" placeholder="Observações, insights, ajustes...">${r.notes || ''}</textarea>
        <button class="btn btn-ghost" id="btn-mr-save-notes-${r.id}" style="font-size:12px;margin-top:6px">
          <i class="fas fa-save"></i> Salvar notas
        </button>
      </div>

    </div>
    <div class="modal-footer" style="justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
    </div>
  `, 'modal-lg');

  // Handler: salvar URL do Canva
  document.getElementById(`btn-mr-save-canva-${r.id}`)?.addEventListener('click', async () => {
    const url = document.getElementById(`mr-canva-url-${r.id}`)?.value.trim();
    const { error } = await MetaReportsDB.update(r.id, { canva_url: url || null });
    if (error) { showToast('Erro ao salvar URL.', 'error'); return; }
    showToast('URL do Canva salva!', 'success');
    _mrLoadList();
  });

  // Handler: salvar notas
  document.getElementById(`btn-mr-save-notes-${r.id}`)?.addEventListener('click', async () => {
    const notes = document.getElementById(`mr-notes-${r.id}`)?.value.trim();
    const { error } = await MetaReportsDB.update(r.id, { notes: notes || null });
    if (error) { showToast('Erro ao salvar notas.', 'error'); return; }
    showToast('Notas salvas!', 'success');
  });
}

// ─── MODAL: ENVIO AO CLIENTE ─────────────────

async function _mrOpenSendModal(reportId) {
  const r = await MetaReportsDB.get(reportId);
  if (!r) { showToast('Relatório não encontrado.', 'error'); return; }

  if (r.status !== 'Revisado') {
    showToast('O relatório precisa estar com status "Revisado" para ser enviado.', 'warning');
    return;
  }

  const name    = r.client?.name         || 'Cliente';
  const contact = r.client?.contact_name || name;
  const email   = r.client?.email        || '';

  const { assunto, corpo } = _mrTextEmail(r, name, contact);

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-paper-plane" style="color:#10b981;margin-right:8px"></i>
        Enviar ao Cliente — ${name}
      </span>
      <button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="padding:24px 28px;display:flex;flex-direction:column;gap:16px">

      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">DESTINATÁRIO</label>
        <input class="input-field" id="mr-send-email" type="email" value="${email}" placeholder="email@cliente.com" />
      </div>

      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">ASSUNTO</label>
        <input class="input-field" id="mr-send-subject" type="text" value="${assunto}" />
      </div>

      ${!r.canva_url ? `
      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">LINK DO RELATÓRIO (Canva)</label>
        <input class="input-field" id="mr-send-canva" type="url" placeholder="https://www.canva.com/design/..." />
      </div>` : `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.2);border-radius:8px;font-size:12px">
        <i class="fas fa-link" style="color:#10b981"></i>
        <span style="color:var(--text-muted)">Canva: </span>
        <a href="${r.canva_url}" target="_blank" rel="noopener" style="color:#10b981;word-break:break-all">${r.canva_url}</a>
      </div>`}

      <div>
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">CORPO DO E-MAIL</label>
        <textarea class="input-field" id="mr-send-body" rows="10" style="width:100%;resize:vertical;font-size:13px;font-family:inherit;line-height:1.6">${corpo}</textarea>
      </div>

      <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--text-muted)">
        <i class="fas fa-info-circle" style="color:#3b82f6;margin-right:6px"></i>
        O botão "Enviar" abrirá seu cliente de e-mail com os dados preenchidos.
        O status do relatório será atualizado para <strong>Enviado</strong>.
      </div>
    </div>
    <div class="modal-footer" style="justify-content:flex-end;gap:10px">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-mr-do-send" style="background:#10b981;border-color:#10b981">
        <i class="fas fa-paper-plane"></i> Enviar via E-mail
      </button>
    </div>
  `, 'modal-lg');

  document.getElementById('btn-mr-do-send')?.addEventListener('click', async () => {
    const to      = document.getElementById('mr-send-email')?.value.trim();
    const subject = document.getElementById('mr-send-subject')?.value.trim();
    const body    = document.getElementById('mr-send-body')?.value.trim();
    const canvaIn = document.getElementById('mr-send-canva')?.value.trim();

    if (!to) { showToast('Informe o e-mail do destinatário.', 'warning'); return; }

    // Se foi digitada URL do Canva no campo, salvar
    if (canvaIn && !r.canva_url) {
      await MetaReportsDB.update(r.id, { canva_url: canvaIn });
    }

    // Abre mailto
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');

    // Atualiza status para Enviado
    const { error } = await MetaReportsDB.update(r.id, {
      status: 'Enviado',
      sent_at: new Date().toISOString(),
    });

    closeModal();

    if (error) {
      showToast('E-mail aberto, mas erro ao atualizar status: ' + error.message, 'warning');
    } else {
      showToast('Relatório marcado como Enviado!', 'success');
    }

    await _mrLoadList();
  });
}

// ─── CHANGE STATUS ───────────────────────────

async function _mrChangeStatus(reportId, newStatus) {
  const { error } = await MetaReportsDB.update(reportId, { status: newStatus });
  if (error) { showToast('Erro ao atualizar status: ' + error.message, 'error'); return; }

  const labels = { 'Revisão': 'em revisão', 'Revisado': 'revisado', 'Enviado': 'enviado' };
  showToast(`Status atualizado para ${labels[newStatus] || newStatus}!`, 'success');
  await _mrLoadList();
}

// ─── DELETE ──────────────────────────────────

function _mrDelete(reportId) {
  Modal.confirm(
    'Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.',
    async () => {
      const { error } = await MetaReportsDB.remove(reportId);
      if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
      showToast('Relatório excluído.', 'success');
      await _mrLoadList();
    },
    { title: 'Excluir Relatório', confirmLabel: 'Excluir', danger: true }
  );
}

// ─── REGISTRO DA ROTA ────────────────────────

Router.register('relatorios-meta', renderRelatoriosMeta, 'Relatórios Meta');
