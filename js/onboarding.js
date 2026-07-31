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
let _wsData = { onboardingId: null, steps: [], notes: [], links: [], attachments: [] };

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
      <button class="tab-btn" data-action="ws-tab" data-tab="dados"><i class="fas fa-id-card"></i> Dados / Briefing</button>
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
  const [ob, notesRes, linksRes, attRes] = await Promise.all([
    DB.clientOnboarding.get(cid),
    DB.clientNotes.listByClient(cid),
    DB.clientLinks.listByClient(cid),
    DB.clientAttachments.listByClient(cid),
  ]);
  _wsData.onboardingId = ob?.id || null;
  _wsData.steps = _wsMergeSteps(ob?.steps);
  _wsData.notes = notesRes.data || [];
  _wsData.links = linksRes.data || [];
  _wsData.attachments = attRes.data || [];
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
  el.innerHTML = { onboarding: wsOnboardingHtml, dados: wsDadosHtml, notas: wsNotesHtml, links: wsLinksHtml }[_wsTab]();
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
      <label style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">Briefing</label>
      <textarea class="input-field" id="ws-briefing" rows="5" placeholder="Informações do briefing do cliente...">${c.briefing || ''}</textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" data-action="ws-save-briefing"><i class="fas fa-save"></i> Salvar briefing</button>
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

Router.register('onboarding', renderOnboarding, 'Dossiê do Cliente');
