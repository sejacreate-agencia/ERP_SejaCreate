// =============================================
// SEJA CREATE — BRIEFING PÚBLICO (briefing.html)
// =============================================
// Página que o cliente abre pelo link tokenizado, normalmente no celular.
// Não depende do app: fala com o Supabase só pelas RPCs briefing_get e
// briefing_submit (migration 014), que são a única porta de entrada da
// chave anônima para a tabela client_briefings.

(function () {
  const root  = document.getElementById('bf-root');
  const token = new URLSearchParams(location.search).get('t');

  let sb = null;
  let clientName = '';
  let answers = {};
  let step = 0;

  const draftKey = () => `sc-briefing-draft-${token}`;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function msg(icon, color, title, detail) {
    root.innerHTML = `
      <div class="bf-msg">
        <i class="fas ${icon}" style="color:${color}"></i>
        <p style="font-weight:600;font-size:16px">${title}</p>
        ${detail ? `<p style="font-size:13px;color:var(--text-muted);margin-top:8px;line-height:1.5">${detail}</p>` : ''}
      </div>`;
  }

  /* ─── RASCUNHO ─────────────────────────────
     O cliente responde 32 perguntas pelo celular; sem rascunho, qualquer
     interrupção (ligação, aba fechada) perderia tudo. */

  function saveDraft() {
    try { localStorage.setItem(draftKey(), JSON.stringify({ answers, step })); } catch (e) { /* cota cheia */ }
  }

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (d && d.answers) { answers = d.answers; step = Math.min(d.step || 0, BRIEFING_SECTIONS.length - 1); return true; }
    } catch (e) { /* rascunho corrompido — ignora */ }
    return false;
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) { /* ignora */ }
  }

  /* ─── RENDER ───────────────────────────────── */

  function questionHtml(q) {
    const val = answers[q.key];
    const req = q.required ? '<span class="bf-req">*</span>' : '';
    const head = `
      <label class="bf-label" for="q-${q.key}">${esc(q.label)}${req}</label>
      ${q.hint ? `<div class="bf-hint">${esc(q.hint)}</div>` : ''}`;

    if (q.type === 'escolha' || q.type === 'multipla') {
      const multi = q.type === 'multipla';
      const sel = multi ? (Array.isArray(val) ? val : []) : [val];
      return `
        <div class="bf-q" data-key="${q.key}">
          ${head}
          ${multi ? `<div class="bf-hint" style="margin-top:-4px">Pode marcar mais de uma.</div>` : ''}
          <div id="q-${q.key}">
            ${q.options.map((o, i) => `
              <label class="bf-opt ${sel.includes(o) ? 'sel' : ''}">
                <input type="${multi ? 'checkbox' : 'radio'}" name="opt-${q.key}"
                       value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''}
                       data-q="${q.key}" data-multi="${multi ? 1 : 0}" />
                <span>${esc(o)}</span>
              </label>`).join('')}
          </div>
        </div>`;
    }

    if (q.type === 'paragrafo') {
      return `
        <div class="bf-q" data-key="${q.key}">
          ${head}
          <textarea class="input-field" id="q-${q.key}" rows="3"
                    data-q="${q.key}">${esc(val || '')}</textarea>
        </div>`;
    }

    return `
      <div class="bf-q" data-key="${q.key}">
        ${head}
        <input class="input-field" id="q-${q.key}" type="text"
               value="${esc(val || '')}" data-q="${q.key}" />
      </div>`;
  }

  function render() {
    const sec = BRIEFING_SECTIONS[step];
    const total = BRIEFING_SECTIONS.length;
    const pct = Math.round((step / total) * 100);
    const last = step === total - 1;

    root.innerHTML = `
      <div class="bf-steps">
        <span><i class="fas ${sec.icon}"></i> ${esc(sec.title)}</span>
        <span>Etapa ${step + 1} de ${total}</span>
      </div>
      <div class="progress-bar" style="margin-bottom:20px"><div class="progress-fill" style="width:${pct}%"></div></div>

      ${step === 0 ? `
        <p style="font-size:13px;color:var(--text-muted);line-height:1.55;margin-bottom:20px">
          Olá! Este briefing é a base da estratégia digital de
          <strong style="color:var(--text-primary)">${esc(clientName)}</strong>.
          Quanto mais detalhada e honesta a resposta, melhor o resultado.
          Suas respostas ficam salvas neste aparelho — você pode parar e voltar depois.
        </p>` : ''}

      <form id="bf-form" novalidate>
        ${sec.questions.map(questionHtml).join('')}
      </form>

      <div id="bf-alert"></div>

      <div class="bf-nav">
        ${step > 0 ? `<button type="button" class="btn btn-secondary" id="bf-prev"><i class="fas fa-arrow-left"></i> Voltar</button>` : ''}
        <button type="button" class="btn btn-primary" id="bf-next">
          ${last ? '<i class="fas fa-paper-plane"></i> Enviar briefing' : 'Avançar <i class="fas fa-arrow-right"></i>'}
        </button>
      </div>`;

    bind();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bind() {
    root.querySelectorAll('input[type=text], textarea').forEach(el => {
      el.addEventListener('input', () => {
        answers[el.dataset.q] = el.value;
        el.classList.remove('bf-err');
        saveDraft();
      });
    });

    root.querySelectorAll('.bf-opt input').forEach(el => {
      el.addEventListener('change', () => {
        const key = el.dataset.q;
        if (el.dataset.multi === '1') {
          const marcados = [...root.querySelectorAll(`input[name="opt-${key}"]:checked`)].map(i => i.value);
          answers[key] = marcados;
        } else {
          answers[key] = el.value;
        }
        // Realce visual da opção escolhida
        root.querySelectorAll(`input[name="opt-${key}"]`).forEach(i =>
          i.closest('.bf-opt').classList.toggle('sel', i.checked));
        saveDraft();
      });
    });

    const prev = document.getElementById('bf-prev');
    if (prev) prev.addEventListener('click', () => { step--; render(); });
    document.getElementById('bf-next').addEventListener('click', onNext);
  }

  function onNext() {
    const sec = BRIEFING_SECTIONS[step];
    const faltando = sec.questions.filter(q => {
      if (!q.required) return false;
      const v = answers[q.key];
      return Array.isArray(v) ? !v.length : !String(v || '').trim();
    });

    if (faltando.length) {
      faltando.forEach(q => {
        const el = document.getElementById(`q-${q.key}`);
        if (el && el.classList) el.classList.add('bf-err');
      });
      document.getElementById('bf-alert').innerHTML = `
        <div style="background:var(--danger-subtle);border:1px solid var(--danger);border-radius:8px;
                    padding:10px 14px;margin-top:14px;font-size:13px;color:var(--danger)">
          <i class="fas fa-exclamation-triangle"></i>
          ${faltando.length === 1 ? 'Falta responder 1 pergunta' : `Faltam responder ${faltando.length} perguntas`} nesta etapa.
        </div>`;
      const primeiro = document.querySelector(`.bf-q[data-key="${faltando[0].key}"]`);
      if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (step < BRIEFING_SECTIONS.length - 1) { step++; saveDraft(); render(); return; }
    submit();
  }

  async function submit() {
    const btn = document.getElementById('bf-next');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const { data, error } = await sb.rpc('briefing_submit', { p_token: token, p_answers: answers });

    if (error) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar briefing';
      document.getElementById('bf-alert').innerHTML = `
        <div style="background:var(--danger-subtle);border:1px solid var(--danger);border-radius:8px;
                    padding:10px 14px;margin-top:14px;font-size:13px;color:var(--danger)">
          <i class="fas fa-triangle-exclamation"></i> Não conseguimos enviar agora: ${esc(error.message)}.
          Suas respostas estão salvas — tente novamente em instantes.
        </div>`;
      return;
    }

    if (data === false) {
      msg('fa-link-slash', 'var(--danger)', 'Este link não é mais válido',
          'Peça um novo link para a equipe da Seja Create.');
      return;
    }

    clearDraft();
    msg('fa-circle-check', 'var(--success)', 'Briefing enviado. Obrigado!',
        `Recebemos suas respostas e já vamos começar a trabalhar na estratégia de <strong>${esc(clientName)}</strong>.`);
  }

  /* ─── BOOT ─────────────────────────────────── */

  async function boot() {
    if (!token) {
      msg('fa-link-slash', 'var(--warning)', 'Link incompleto',
          'Abra o link exatamente como recebeu da equipe da Seja Create.');
      return;
    }

    const cfg = window.APP_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
      msg('fa-plug-circle-xmark', 'var(--danger)', 'Serviço indisponível',
          'Não conseguimos conectar ao servidor. Tente novamente em alguns minutos.');
      return;
    }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    const { data, error } = await sb.rpc('briefing_get', { p_token: token });
    if (error) {
      msg('fa-triangle-exclamation', 'var(--danger)', 'Não conseguimos carregar seu briefing',
          esc(error.message));
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      msg('fa-link-slash', 'var(--warning)', 'Link inválido ou expirado',
          'Peça um novo link para a equipe da Seja Create.');
      return;
    }

    clientName = row.client_name || '';

    if (row.status === 'respondido') {
      clearDraft();
      msg('fa-circle-check', 'var(--success)', 'Você já respondeu este briefing',
          `Recebemos as respostas de <strong>${esc(clientName)}</strong>. Se precisar alterar
           alguma informação, fale com a equipe da Seja Create.`);
      return;
    }

    // Rascunho local tem prioridade sobre o que estiver no banco: é o que o
    // cliente digitou por último neste aparelho.
    if (!loadDraft()) answers = row.answers && Object.keys(row.answers).length ? row.answers : {};

    render();
  }

  boot();
})();
