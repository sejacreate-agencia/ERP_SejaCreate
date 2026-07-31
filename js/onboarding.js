// =============================================
// SEJA CREATE — ONBOARDING / WORKSPACE DO CLIENTE
// =============================================
// Por cliente: checklist de onboarding (9 etapas fixas), dados/briefing
// (com anexos), anotações de reunião e links importantes.

const OB_STEPS = [
  { key: 'briefing',        label: 'Reunião de briefing' },
  { key: 'contrato',        label: 'Assinatura de contrato' },
  { key: 'pagamento',       label: 'Pagamento da mensalidade' },
  { key: 'acessos',         label: 'Informações de acesso' },
  { key: 'identidade',      label: 'Solicitação de identidade visual e fotos' },
  { key: 'reuniao_plano',   label: 'Reunião 1: Apresentação do Plano de marca' },
  { key: 'primeiras_artes', label: 'Envio das primeiras artes para aprovação' },
  { key: 'ajustes',         label: 'Ajustes de artes' },
  { key: 'primeira_pub',    label: 'Primeira publicação' },
];

let _obClients = [];
let _obRows = [];
let _obSearch = '';

// Estado do workspace aberto
let _wsClient = null;
let _wsTab = 'onboarding';
let _wsData = { onboardingId: null, steps: [], notes: [], links: [], attachments: [], briefing: null };

async function renderOnboarding() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Dossiê do Cliente</h1>
        </div>
        <div class="page-actions">
          <input class="filter-select" id="ob-search" placeholder="🔍 Buscar cliente..." style="min-width:220px" oninput="applyObSearch()" value="${_obSearch}">
          <button class="btn btn-secondary" data-action="ob-abrir-import" title="Importar respostas antigas do Google Forms">
            <i class="fas fa-file-import"></i> Importar briefings
          </button>
        </div>
      </div>
    </div>
    <div id="ob-list"><div class="loading-state" style="padding:60px 0"><i class="fas fa-spinner fa-spin" style="font-size:26px"></i></div></div>
  `;

  if (!isSupabaseReady()) {
    document.getElementById('ob-list').innerHTML = `<div class="empty-state"><i class="fas fa-plug"></i><p>Onboarding disponível apenas com o Supabase conectado.<br>Rode a migration 011.</p></div>`;
    return;
  }

  _obClients = await Data.clients();
  const { data, error } = await DB.clientOnboarding.listAll();
  if (error) {
    document.getElementById('ob-list').innerHTML = `<div class="empty-state"><i class="fas fa-database"></i><p>Tabelas do Onboarding não encontradas.<br>Rode a <b>migration 011</b> no SQL Editor do Supabase.</p></div>`;
    return;
  }
  _obRows = data || [];
  renderObList();
}

function _obProgress(clientId) {
  const row = _obRows.find(r => String(r.client_id) === String(clientId));
  const steps = row?.steps || [];
  const done = steps.filter(s => s.done).length;
  return { done, total: OB_STEPS.length };
}

function applyObSearch() {
  _obSearch = document.getElementById('ob-search')?.value || '';
  renderObList();
}

function renderObList() {
  const el = document.getElementById('ob-list');
  if (!el) return;
  const q = _obSearch.toLowerCase();
  const clients = _obClients.filter(c => !q || (c.name || '').toLowerCase().includes(q));
  if (!clients.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum cliente encontrado.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="grid-auto">${clients.map(buildObCard).join('')}</div>`;
}

function buildObCard(c) {
  const { done, total } = _obProgress(c.id);
  const pct = Math.round((done / total) * 100);
  const complete = done === total;
  const statusColor = c.status === 'ativo' ? 'green' : c.status === 'inadimplente' ? 'red' : 'gray';
  return `
    <div class="report-card" data-action="ob-open" data-id="${c.id}" style="cursor:pointer;text-align:left;align-items:stretch">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:14px">${c.name}</div>
        <span class="tag tag-${statusColor}" style="font-size:10px">${c.status || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:5px">
        <span><i class="fas fa-clipboard-check"></i> Progresso</span>
        <span style="font-weight:700;color:${complete ? 'var(--success)' : 'var(--text-secondary)'}">${done}/${total}${complete ? ' ✓' : ''}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;${complete ? 'background:var(--success)' : ''}"></div></div>
    </div>`;
}

// ─── WORKSPACE ───────────────────────────────
async function openClientWorkspace(clientId) {
  _wsClient = _obClients.find(c => String(c.id) === String(clientId));
  if (!_wsClient) { showToast('Cliente não encontrado.', 'error'); return; }
  _wsTab = 'onboarding';

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-user-gear" style="color:var(--purple-light);margin-right:8px"></i>${_wsClient.name}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="tabs" style="margin:0 0 4px;padding:0 4px;flex-wrap:wrap">
      <button class="tab-btn active" data-action="ws-tab" data-tab="onboarding"><i class="fas fa-clipboard-check"></i> Onboarding</button>
      <button class="tab-btn" data-action="ws-tab" data-tab="dados"><i class="fas fa-id-card"></i> Dados</button>
      <button class="tab-btn" data-action="ws-tab" data-tab="briefing"><i class="fas fa-clipboard-question"></i> Briefing</button>
      <button class="tab-btn" data-action="ws-tab" data-tab="notas"><i class="fas fa-sticky-note"></i> Anotações</button>
      <button class="tab-btn" data-action="ws-tab" data-tab="links"><i class="fas fa-link"></i> Links</button>
    </div>
    <div class="modal-body" id="ws-tab-content" style="min-height:300px">
      <div class="loading-state" style="padding:40px 0"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
  `, 'modal-lg');

  await wsReload();
}

async function wsReload() {
  const cid = _wsClient.id;
  const [ob, notesRes, linksRes, attRes, brRes] = await Promise.all([
    DB.clientOnboarding.get(cid),
    DB.clientNotes.listByClient(cid),
    DB.clientLinks.listByClient(cid),
    DB.clientAttachments.listByClient(cid),
    DB.clientBriefings.get(cid),
  ]);
  _wsData.onboardingId = ob?.id || null;
  _wsData.steps = _wsMergeSteps(ob?.steps);
  _wsData.notes = notesRes.data || [];
  _wsData.links = linksRes.data || [];
  _wsData.attachments = attRes.data || [];
  _wsData.briefing = brRes.data || null;
  wsRenderTab();
}

function _wsMergeSteps(saved) {
  const map = {};
  (saved || []).forEach(s => { map[s.key] = s; });
  return OB_STEPS.map(t => {
    const s = map[t.key] || {};
    return { key: t.key, label: t.label, done: !!s.done, done_at: s.done_at || null, note: s.note || '' };
  });
}

function wsSwitchTab(tab) {
  _wsTab = tab;
  document.querySelectorAll('.modal .tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  wsRenderTab();
}

function wsRenderTab() {
  const el = document.getElementById('ws-tab-content');
  if (!el) return;
  el.innerHTML = {
    onboarding: wsOnboardingHtml, dados: wsDadosHtml, briefing: wsBriefingHtml,
    notas: wsNotesHtml, links: wsLinksHtml,
  }[_wsTab]();
}

// ── ABA: ONBOARDING (timeline com checkpoints) ──
function wsOnboardingHtml() {
  const done = _wsData.steps.filter(s => s.done).length;
  const pct = Math.round((done / OB_STEPS.length) * 100);
  const last = _wsData.steps.length - 1;
  return `
    <div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="font-weight:700">Progresso do onboarding</span>
        <span style="font-weight:700;${done === OB_STEPS.length ? 'color:var(--success)' : ''}">${done}/${OB_STEPS.length}${done === OB_STEPS.length ? ' ✓' : ''}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;${done === OB_STEPS.length ? 'background:var(--success)' : ''}"></div></div>
    </div>
    <div style="padding:4px 0">
      ${_wsData.steps.map((s, i) => {
        const doneColor = s.done ? 'var(--success)' : 'var(--border)';
        return `
        <div style="position:relative;padding-left:38px;padding-bottom:${i === last ? '4' : '20'}px">
          ${i < last ? `<div style="position:absolute;left:12px;top:26px;bottom:0;width:2px;background:${s.done && _wsData.steps[i + 1].done ? 'var(--success)' : 'var(--border)'}"></div>` : ''}
          <div onclick="toggleObStep(${i}, ${!s.done})" title="${s.done ? 'Desmarcar' : 'Marcar como concluída'}"
               style="position:absolute;left:0;top:2px;width:26px;height:26px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2px solid ${doneColor};background:${s.done ? 'var(--success)' : 'var(--bg-input)'};color:${s.done ? '#fff' : 'var(--text-muted)'};font-size:12px;font-weight:700;transition:all .15s">
            ${s.done ? '<i class="fas fa-check"></i>' : (i + 1)}
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;${s.done ? 'color:var(--text-muted)' : ''}">
              ${s.label}
              ${s.done && s.done_at ? `<span style="font-size:11px;color:var(--success);font-weight:400;margin-left:6px"><i class="fas fa-calendar-check"></i> ${formatDateBR(s.done_at)}</span>` : ''}
            </div>
            <input class="input-field" style="margin-top:6px;font-size:12px" placeholder="Anotação (opcional)" value="${(s.note || '').replace(/"/g, '&quot;')}" onchange="saveObNote(${i}, this.value)">
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function _persistOnboarding() {
  const steps = _wsData.steps.map(s => ({ key: s.key, done: s.done, done_at: s.done_at, note: s.note }));
  if (_wsData.onboardingId) {
    await DB.clientOnboarding.save(_wsData.onboardingId, steps);
  } else {
    const { data } = await DB.clientOnboarding.create(_wsClient.id, steps);
    if (data) _wsData.onboardingId = data.id;
  }
  // Atualiza progresso na lista de fundo
  const idx = _obRows.findIndex(r => String(r.client_id) === String(_wsClient.id));
  if (idx >= 0) _obRows[idx].steps = steps;
  else _obRows.push({ client_id: _wsClient.id, steps });
}

async function toggleObStep(i, checked) {
  _wsData.steps[i].done = checked;
  _wsData.steps[i].done_at = checked ? new Date().toISOString().slice(0, 10) : null;
  await _persistOnboarding();
  wsRenderTab();
  renderObList();
}

async function saveObNote(i, value) {
  _wsData.steps[i].note = value;
  await _persistOnboarding();
}

// ── ABA: DADOS / BRIEFING ──
function wsDadosHtml() {
  const c = _wsClient;
  const files = _wsData.attachments.filter(a => a.kind === 'briefing');
  const field = (label, val) => `<div><div style="font-size:11px;color:var(--text-muted)">${label}</div><div style="font-size:13px;font-weight:600">${val || '—'}</div></div>`;
  return `
    <div class="grid-2" style="gap:12px;margin-bottom:16px">
      ${field('Contato', c.contact_name)}
      ${field('Telefone', c.phone)}
      ${field('E-mail', c.email)}
      ${field('Plano', c.plan)}
      ${field('Status', c.status)}
      ${field('Vencimento', c.dia_vencimento ? 'Dia ' + c.dia_vencimento : '—')}
    </div>
    <div style="margin-bottom:8px">
      <label style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Observações gerais</label>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">
        Anotações livres da equipe. As respostas do formulário ficam na aba <strong>Briefing</strong>.
      </div>
      <textarea class="input-field" id="ws-briefing" rows="5" placeholder="Observações da equipe sobre o cliente...">${c.briefing || ''}</textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" data-action="ws-save-briefing"><i class="fas fa-save"></i> Salvar observações</button>
    </div>
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Anexos do briefing (download)</label>
        <div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-bottom:0"><i class="fas fa-upload"></i> Arquivo<input type="file" style="display:none" onchange="wsUploadFile('briefing', this)"></label>
          <button class="btn btn-ghost btn-sm" data-action="ws-add-link" data-kind="briefing"><i class="fas fa-link"></i> Link</button>
        </div>
      </div>
      ${wsAttachmentsHtml(files)}
    </div>
  `;
}

async function saveBriefing() {
  const val = document.getElementById('ws-briefing')?.value || '';
  await DB.clients.update(_wsClient.id, { briefing: val });
  _wsClient.briefing = val;
  showToast('✅ Briefing salvo!', 'success');
}

// ── ABA: BRIEFING ──
// O cliente responde pelo link tokenizado (briefing.html?t=...). Aqui a
// equipe gera/reenvia o link e lê as respostas.

function _briefingUrl(token) {
  // Mesma origem/pasta do index.html — funciona tanto no GitHub Pages
  // (subpasta do repo) quanto em domínio próprio.
  const base = location.href.replace(/[^/]*$/, '');
  return `${base}briefing.html?t=${encodeURIComponent(token)}`;
}

function _briefingToken() {
  // crypto.randomUUID não existe em WebViews antigas; o fallback mantém
  // entropia suficiente para um token de uso único.
  if (window.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  const a = new Uint8Array(16);
  (window.crypto || {}).getRandomValues?.(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('') || String(Date.now()) + Math.random().toString(36).slice(2);
}

function _obEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function wsBriefingHtml() {
  const b = _wsData.briefing;
  const c = _wsClient;

  if (!b) {
    return `
      <div class="empty-state" style="padding:32px">
        <i class="fas fa-clipboard-question" style="color:var(--purple-light)"></i>
        <p style="margin-top:10px;font-weight:600">Nenhum briefing gerado ainda</p>
        <p style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.5">
          Gere um link exclusivo e envie para ${_obEsc(c.contact_name || c.name)}.<br>
          São ${BRIEFING_QUESTIONS.length} perguntas, respondidas pelo celular, com o
          progresso salvo automaticamente.
        </p>
        <button class="btn btn-primary" style="margin-top:16px" data-action="ws-gerar-briefing">
          <i class="fas fa-link"></i> Gerar link do briefing
        </button>
      </div>`;
  }

  const url = _briefingUrl(b.token);
  const respondido = b.status === 'respondido';
  const fone = (c.phone || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(
    `Olá! Para começarmos a estratégia digital de ${c.name}, preencha o briefing neste link: ${url}`);

  const cabecalho = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <span class="tag ${respondido ? 'tag-green' : 'tag-yellow'}">
        <i class="fas ${respondido ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>
        ${respondido ? 'Respondido em ' + formatDateBR(b.submitted_at) : 'Aguardando resposta'}
      </span>
      ${b.source === 'import' ? `<span class="tag tag-gray" style="font-size:10px"><i class="fas fa-file-import"></i> Importado do Forms</span>` : ''}
    </div>`;

  const linkBox = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:6px">
        Link do cliente
      </div>
      <input class="input-field" readonly value="${_obEsc(url)}" data-action="ws-select-link"
             style="font-size:11px;margin-bottom:8px" />
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-action="ws-copiar-briefing" data-url="${_obEsc(url)}">
          <i class="fas fa-copy"></i> Copiar
        </button>
        ${fone ? `<a class="btn btn-sm btn-success" target="_blank" href="https://wa.me/55${fone}?text=${waMsg}">
          <i class="fab fa-whatsapp"></i> Enviar no WhatsApp
        </a>` : `<span style="font-size:11px;color:var(--text-muted);align-self:center">Cliente sem telefone cadastrado</span>`}
        <a class="btn btn-sm btn-ghost" target="_blank" href="${_obEsc(url)}">
          <i class="fas fa-up-right-from-square"></i> Abrir
        </a>
        ${respondido ? `<button class="btn btn-sm btn-ghost" data-action="ws-reabrir-briefing" data-id="${b.id}"
                                style="margin-left:auto;color:var(--warning)">
          <i class="fas fa-rotate-left"></i> Reabrir para nova resposta
        </button>` : ''}
      </div>
    </div>`;

  if (!respondido) {
    return cabecalho + linkBox + `
      <div class="empty-state" style="padding:24px">
        <i class="fas fa-hourglass-half" style="color:var(--warning)"></i>
        <p style="font-size:13px">O cliente ainda não enviou as respostas.</p>
      </div>`;
  }

  const respostas = BRIEFING_SECTIONS.map(sec => {
    const itens = sec.questions.map(q => {
      const v = briefingFormatValue(b.answers?.[q.key]);
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border-light)">
          <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${_obEsc(q.label)}</div>
          <div style="font-size:13px;white-space:pre-wrap;margin-top:3px;${v ? '' : 'color:var(--text-muted);font-style:italic'}">
            ${v ? _obEsc(v) : 'Não respondido'}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:18px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--purple-light);margin-bottom:4px">
          <i class="fas ${sec.icon}"></i> ${_obEsc(sec.title)}
        </div>
        ${itens}
      </div>`;
  }).join('');

  return cabecalho + linkBox + respostas;
}

async function wsGerarBriefing() {
  const token = _briefingToken();
  const { data, error } = await DB.clientBriefings.create(_wsClient.id, token);
  if (error) { showToast(`Erro ao gerar o link: ${error.message}`, 'error'); return; }
  _wsData.briefing = data;
  showToast('🔗 Link gerado! Envie para o cliente.', 'success');
  wsRenderTab();
}

function wsCopiarBriefing(url) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copiado!', 'success'))
      .catch(() => showToast('Não foi possível copiar — selecione o link e copie manualmente.', 'warning'));
  } else {
    showToast('Selecione o link e copie manualmente.', 'info');
  }
}

async function wsReabrirBriefing(id) {
  if (!confirm('Reabrir o briefing? O cliente poderá responder de novo pelo mesmo link, substituindo as respostas atuais.')) return;
  const { error } = await DB.clientBriefings.reabrir(id);
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  showToast('Briefing reaberto.', 'success');
  await wsReload();
}

// ── ABA: ANOTAÇÕES ──
function wsNotesHtml() {
  return `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:14px">
      <input class="input-field" id="ws-note-title" placeholder="Título (ex.: Reunião 21/07)" style="margin-bottom:8px">
      <textarea class="input-field" id="ws-note-content" rows="3" placeholder="Anotações da reunião..."></textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" data-action="ws-add-note"><i class="fas fa-plus"></i> Adicionar anotação</button>
    </div>
    ${_wsData.notes.length ? _wsData.notes.map(n => `
      <div style="border-bottom:1px solid var(--border-light);padding:12px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:13px">${n.title || 'Anotação'}</strong>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:var(--text-muted)">${formatDateBR(n.created_at)}${n.author?.full_name ? ' · ' + n.author.full_name.split(' ')[0] : ''}</span>
            <button class="btn btn-ghost btn-sm" data-action="ws-del-note" data-id="${n.id}" title="Excluir"><i class="fas fa-trash" style="color:var(--danger);font-size:11px"></i></button>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;margin-top:4px">${n.content || ''}</div>
      </div>
    `).join('') : `<div class="empty-state" style="padding:20px"><i class="fas fa-sticky-note"></i><p>Nenhuma anotação ainda.</p></div>`}
  `;
}

async function wsAddNote() {
  const title = document.getElementById('ws-note-title')?.value.trim();
  const content = document.getElementById('ws-note-content')?.value.trim();
  if (!content && !title) { showToast('Escreva a anotação.', 'warning'); return; }
  await DB.clientNotes.create({
    client_id: _wsClient.id, title, content,
    created_by: (typeof SB !== 'undefined' && SB.profile?.id) || null
  });
  showToast('✅ Anotação adicionada!', 'success');
  await wsReload();
}

async function wsDelNote(id) {
  if (!confirm('Excluir esta anotação?')) return;
  await DB.clientNotes.remove(id);
  await wsReload();
}

// ── ABA: LINKS ──
function wsLinksHtml() {
  const assets = _wsData.attachments.filter(a => a.kind !== 'briefing');
  const catLabel = { identidade: 'Identidade', fotos: 'Fotos', drive: 'Drive', outro: 'Outro' };
  return `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:14px">
      <div class="form-row">
        <div class="form-col"><input class="input-field" id="ws-link-label" placeholder="Rótulo (ex.: Manual da marca)"></div>
        <div class="form-col">
          <select class="select-field" id="ws-link-cat">
            <option value="identidade">Identidade visual</option>
            <option value="fotos">Fotos</option>
            <option value="drive">Drive / Pasta</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>
      <input class="input-field" id="ws-link-url" placeholder="https://..." style="margin-top:8px">
      <button class="btn btn-primary btn-sm" style="margin-top:8px" data-action="ws-add-link" data-kind="link"><i class="fas fa-plus"></i> Adicionar link</button>
    </div>
    ${_wsData.links.length ? _wsData.links.map(l => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light)">
        <i class="fas fa-link" style="color:var(--purple-light)"></i>
        <div style="flex:1;min-width:0">
          <a href="${l.url}" target="_blank" style="font-size:13px;font-weight:600;color:var(--purple-light)">${l.label}</a>
          <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.url}</div>
        </div>
        <span class="tag tag-gray" style="font-size:10px">${catLabel[l.category] || l.category}</span>
        <button class="btn btn-ghost btn-sm" data-action="ws-del-link" data-id="${l.id}"><i class="fas fa-trash" style="color:var(--danger);font-size:11px"></i></button>
      </div>
    `).join('') : `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum link ainda.</div>`}
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Arquivos (identidade / fotos)</label>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin-bottom:0"><i class="fas fa-upload"></i> Enviar arquivo<input type="file" style="display:none" onchange="wsUploadFile('identidade', this)"></label>
      </div>
      ${wsAttachmentsHtml(assets)}
    </div>
  `;
}

async function wsAddLink(kind) {
  // kind='link' → aba Links (client_links); kind='briefing' → anexo-link do briefing
  if (kind === 'briefing') {
    const url = prompt('Cole o link (Drive, etc.):');
    if (!url || !/^https?:\/\//i.test(url)) { if (url) showToast('URL inválida.', 'error'); return; }
    await DB.clientAttachments.add(_wsClient.id, url, /drive\.google/.test(url) ? 'Link do Drive' : 'Link', 'uri', 'briefing', (typeof SB !== 'undefined' && SB.profile?.id) || null);
    showToast('✅ Link adicionado!', 'success');
    await wsReload();
    return;
  }
  const label = document.getElementById('ws-link-label')?.value.trim();
  const url = document.getElementById('ws-link-url')?.value.trim();
  const category = document.getElementById('ws-link-cat')?.value || 'outro';
  if (!label) { showToast('Informe o rótulo.', 'warning'); return; }
  if (!url || !/^https?:\/\//i.test(url)) { showToast('URL inválida (comece com http).', 'error'); return; }
  await DB.clientLinks.create({ client_id: _wsClient.id, label, url, category });
  showToast('✅ Link adicionado!', 'success');
  await wsReload();
}

async function wsDelLink(id) {
  await DB.clientLinks.remove(id);
  await wsReload();
}

// ── ANEXOS (compartilhado) ──
function wsAttachmentsHtml(files) {
  if (!files.length) return `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum arquivo.</div>`;
  const isImg = (a) => a.file_type?.startsWith('image/') || a.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  return files.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)">
      <i class="fas ${isImg(a) ? 'fa-image' : /drive\.google/.test(a.file_url) ? 'fa-link' : 'fa-file'}" style="color:var(--purple-light)"></i>
      <a href="${a.file_url}" target="_blank" style="flex:1;font-size:13px;color:var(--purple-light);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.file_name || 'Arquivo'}</a>
      <a href="${a.file_url}" target="_blank" download class="btn btn-ghost btn-sm" title="Abrir/baixar"><i class="fas fa-download" style="font-size:11px"></i></a>
      <button class="btn btn-ghost btn-sm" data-action="ws-del-file" data-id="${a.id}"><i class="fas fa-trash" style="color:var(--danger);font-size:11px"></i></button>
    </div>`).join('');
}

async function wsUploadFile(kind, input) {
  const file = input.files[0];
  if (!file) return;
  showToast('Enviando arquivo...', 'info');
  const path = `clients/${_wsClient.id}/${kind}_${Date.now()}_${file.name}`;
  const { data: url, error } = await SB.uploadFile('task-arts', path, file);
  if (error) { showToast(`Erro no upload: ${error.message}. Tente adicionar por Link.`, 'error'); return; }
  await DB.clientAttachments.add(_wsClient.id, url, file.name, file.type, kind, (typeof SB !== 'undefined' && SB.profile?.id) || null);
  showToast('✅ Arquivo enviado!', 'success');
  await wsReload();
}

async function wsDelFile(id) {
  if (!confirm('Remover este arquivo?')) return;
  await DB.clientAttachments.remove(id);
  await wsReload();
}

/* ─── IMPORTAR RESPOSTAS ANTIGAS DO GOOGLE FORMS ─────────────
   Importação única das respostas coletadas antes do formulário nativo.
   O CSV entra por upload em vez de fetch direto: a planilha é pública,
   mas o endpoint do Google não libera CORS para outras origens. */

let _impLinhas = [];   // [{ nome, dataHora, answers, clientId }]

function openBriefingImport() {
  if (!isSupabaseReady() || !_obClients.length) {
    showToast('Conecte o Supabase e carregue os clientes antes de importar.', 'warning');
    return;
  }
  const clientOpts = `<option value="">— Escolher cliente —</option>` +
    _obClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-file-import" style="color:var(--purple-light);margin-right:8px"></i>Importar briefings do Google Forms</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--text-secondary);line-height:1.6">
        Na planilha de respostas: <strong>Arquivo → Fazer download → CSV</strong>.
        Depois selecione o arquivo abaixo. As colunas são reconhecidas pelo texto
        do cabeçalho, então não mexa nos títulos das perguntas.
      </div>
      <input type="file" class="input-field" id="imp-file" accept=".csv,text/csv" />
      <button class="btn btn-primary btn-sm" style="margin-top:10px" data-action="ob-import-parse">
        <i class="fas fa-magnifying-glass"></i> Ler arquivo
      </button>
      <div id="imp-resultado" style="margin-top:16px"></div>
    </div>
    <div class="modal-footer" id="imp-footer"></div>
  `, 'modal-lg');

  // Guardado para montar os selects sem refazer a lista a cada linha
  openBriefingImport._clientOpts = clientOpts;
}

function briefingImportParse() {
  const file = document.getElementById('imp-file')?.files?.[0];
  const box  = document.getElementById('imp-resultado');
  if (!file) { showToast('Escolha o arquivo CSV primeiro.', 'warning'); return; }
  if (typeof XLSX === 'undefined') {
    box.innerHTML = `<div style="color:var(--danger);font-size:13px">Biblioteca de leitura de planilha não carregou. Atualize a página e tente de novo.</div>`;
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    let linhas;
    try {
      const wb = XLSX.read(e.target.result, { type: 'string' });
      linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    } catch (err) {
      box.innerHTML = `<div style="color:var(--danger);font-size:13px">Não foi possível ler o arquivo: ${_obEsc(err.message)}</div>`;
      return;
    }

    if (!linhas.length) {
      box.innerHTML = `<div style="color:var(--warning);font-size:13px">O arquivo não tem nenhuma resposta.</div>`;
      return;
    }

    // Cabeçalho → key da pergunta
    const headers = Object.keys(linhas[0]);
    const mapa = {};
    headers.forEach(h => { const k = briefingKeyFromLabel(h); if (k) mapa[h] = k; });
    const reconhecidas = Object.keys(mapa).length;
    const naoReconhecidas = headers.filter(h => !mapa[h] && !/carimbo|timestamp/i.test(h));

    _impLinhas = linhas.map(row => {
      const answers = {};
      Object.entries(mapa).forEach(([h, key]) => {
        const q = BRIEFING_QUESTIONS.find(x => x.key === key);
        const v = briefingParseValue(q, row[h]);
        if (Array.isArray(v) ? v.length : v) answers[key] = v;
      });
      const dataHora = row[headers.find(h => /carimbo|timestamp/i.test(h))] || '';
      return { nome: answers.nome_funcao || '(sem nome)', dataHora, answers, clientId: _sugerirCliente(answers.nome_funcao) };
    });

    box.innerHTML = `
      <div style="font-size:13px;margin-bottom:10px">
        <strong>${_impLinhas.length}</strong> resposta(s) lida(s) ·
        <strong>${reconhecidas}</strong> de ${BRIEFING_QUESTIONS.length} perguntas reconhecidas
      </div>
      ${naoReconhecidas.length ? `
        <div style="background:var(--warning-subtle,rgba(245,158,11,.12));border:1px solid var(--warning);border-radius:8px;padding:10px;font-size:12px;margin-bottom:12px">
          <i class="fas fa-triangle-exclamation" style="color:var(--warning)"></i>
          ${naoReconhecidas.length} coluna(s) não bateram com nenhuma pergunta e serão ignoradas:
          <span style="color:var(--text-muted)">${_obEsc(naoReconhecidas.slice(0, 3).join(' · '))}${naoReconhecidas.length > 3 ? '…' : ''}</span>
        </div>` : ''}
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
        Escolha o cliente de cada resposta. O formulário não tem campo de empresa,
        então a sugestão é só pelo nome de quem respondeu — confira antes de importar.
        Linhas sem cliente são puladas.
      </div>
      <div class="table-wrap" style="max-height:320px;overflow:auto">
        <table style="font-size:12px">
          <thead><tr><th>Respondente</th><th>Data</th><th>Preenchidas</th><th style="min-width:180px">Cliente</th></tr></thead>
          <tbody>
            ${_impLinhas.map((l, i) => `
              <tr>
                <td style="max-width:200px">${_obEsc(String(l.nome).slice(0, 60))}</td>
                <td style="white-space:nowrap;color:var(--text-muted)">${_obEsc(String(l.dataHora).slice(0, 10))}</td>
                <td>${Object.keys(l.answers).length}</td>
                <td>
                  <select class="select-field imp-cliente" data-idx="${i}" style="font-size:12px">
                    ${openBriefingImport._clientOpts.replace(
                      new RegExp(`value="${l.clientId}"`), `value="${l.clientId}" selected`)}
                  </select>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('imp-footer').innerHTML = `
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="ob-import-salvar">
        <i class="fas fa-download"></i> Importar selecionados
      </button>`;
  };

  reader.onerror = () => {
    box.innerHTML = `<div style="color:var(--danger);font-size:13px">Falha ao ler o arquivo.</div>`;
  };
  reader.readAsText(file, 'UTF-8');
}

// Sugestão pelo nome de quem respondeu — o formulário não pede a empresa,
// então isso é só um atalho: a conferência final é do usuário.
function _sugerirCliente(nomeResposta) {
  const alvo = briefingNormalizeLabel(nomeResposta);
  if (!alvo) return '';
  const hit = _obClients.find(c => {
    const nome = briefingNormalizeLabel(c.name);
    const resp = briefingNormalizeLabel(c.contact_name);
    return (resp && alvo.includes(resp)) || (nome && alvo.includes(nome));
  });
  return hit ? hit.id : '';
}

async function briefingImportSalvar() {
  document.querySelectorAll('.imp-cliente').forEach(sel => {
    _impLinhas[parseInt(sel.dataset.idx)].clientId = sel.value;
  });

  const aImportar = _impLinhas.filter(l => l.clientId);
  if (!aImportar.length) { showToast('Nenhuma linha tem cliente selecionado.', 'warning'); return; }

  const btn = document.querySelector('[data-action="ob-import-salvar"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...'; }

  let ok = 0, falhas = 0;
  for (const l of aImportar) {
    const dt = l.dataHora ? _impParseData(l.dataHora) : null;
    const { error } = await DB.clientBriefings.importar(l.clientId, _briefingToken(), l.answers, dt);
    if (error) { falhas++; console.warn('Falha ao importar', l.nome, error); } else { ok++; }
  }

  closeModal();
  showToast(`${ok} briefing(s) importado(s)${falhas ? ` · ${falhas} falharam` : ''}.`, falhas ? 'warning' : 'success');
  renderOnboarding();
}

// O carimbo do Forms vem como "dd/mm/aaaa hh:mm:ss" — Date() interpretaria
// como mês/dia e jogaria a data para outro mês.
function _impParseData(s) {
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})[ ,]*(\d{2}:\d{2}(:\d{2})?)?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00:00'}`;
}

Router.register('onboarding', renderOnboarding, 'Dossiê do Cliente');
