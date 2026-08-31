// =============================================
// AGENDA — o que há para fazer no dia, por cliente
// =============================================
// Responde "o que eu faço hoje" agrupando as tarefas do dia por cliente.
// Complementa o Calendário (que é a visão do mês) com a visão do dia.
//
// Fonte: Data.tasks() e NÃO SC.tasks — o hydrateFromSupabase traz só um
// subconjunto dos campos (sem channels, publish_type, deadline, tags).

let _agDate = new Date();      // dia em exibição
let _agData = [];              // tasks carregadas (Data.tasks())

// ─── DATAS ───────────────────────────────────
// Mesmo formato usado no calendário (js/calendario.js:101): YYYY-MM-DD local.
// Não usar toISOString(), que converte para UTC e vira o dia anterior à noite.
function _agKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _agEhHoje(d) {
  return _agKey(d) === _agKey(new Date());
}

function _agRotulo(d) {
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

// ─── CLIENTE ─────────────────────────────────
// A task pode trazer client_id, um objeto client embutido (join do Supabase)
// ou o legado t.client. Resolve os três. Sempre String() — nunca parseInt,
// que quebra com UUID (o bug vivo em js/calendario.js:72).
function _agClienteId(t) {
  const id = t.client_id ?? (t.client && typeof t.client === 'object' ? t.client.id : t.client);
  return id == null ? '' : String(id);
}

function _agClienteNome(t) {
  if (t.client && typeof t.client === 'object' && t.client.name) return t.client.name;
  const id = _agClienteId(t);
  if (!id) return 'Sem cliente';
  return SC.getClientName(id) || 'Sem cliente';
}

function _agResponsavel(t) {
  if (t.assignee && typeof t.assignee === 'object') {
    return {
      nome: t.assignee.full_name || '—',
      avatar: t.assignee.avatar_initials || (t.assignee.full_name || '??').slice(0, 2),
    };
  }
  const id = t.assignee_id ?? t.assignee;
  return { nome: SC.getEmployeeName(id) || '—', avatar: SC.getEmployeeAvatar(id) || '?' };
}

// ─── RENDER ──────────────────────────────────
async function renderAgenda() {
  const pc = document.getElementById('page-content');

  // Skeleton ANTES do await: o Router.navigate chama esta função sem await
  // (js/core/router.js:47), então sem isto a tela fica em branco.
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div><h1 class="page-title">Agenda</h1></div>
        <div class="page-actions" id="ag-actions"></div>
      </div>
    </div>
    <div id="ag-nav"></div>
    <div id="ag-body">
      <div class="loading-state" style="padding:60px 0;text-align:center">
        <i class="fas fa-spinner fa-spin" style="font-size:28px"></i>
        <span style="margin-top:12px;display:block">Carregando agenda...</span>
      </div>
    </div>
  `;

  _agData = await Data.tasks();
  _agPintar();
}

function _agPintar() {
  const nav = document.getElementById('ag-nav');
  const body = document.getElementById('ag-body');
  if (!nav || !body) return;

  const chave = _agKey(_agDate);
  const hoje = _agEhHoje(_agDate);

  nav.innerHTML = `
    <div class="agenda-nav">
      <button class="btn btn-ghost btn-sm" data-action="ag-dia" data-dir="-1" title="Dia anterior">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="agenda-nav-label">
        <div class="agenda-nav-dia">${_agRotulo(_agDate)}</div>
        ${hoje ? '<span class="tag tag-purple" style="font-size:10px">HOJE</span>' : ''}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="ag-dia" data-dir="1" title="Próximo dia">
        <i class="fas fa-chevron-right"></i>
      </button>
      ${hoje ? '' : '<button class="btn btn-secondary btn-sm" data-action="ag-hoje">Voltar para hoje</button>'}
    </div>
  `;

  // Tarefas do dia. post_date é DATE (YYYY-MM-DD); o legado usa postDate.
  const doDia = _agData.filter(t => {
    const d = t.post_date || t.postDate;
    return d && String(d).slice(0, 10) === chave;
  });

  body.innerHTML = `
    ${_agTarefasHtml(doDia)}
    ${_agCompromissosHtml()}
  `;

  _agCarregarCompromissos();   // assíncrono, não bloqueia as tarefas
}

// ── Tarefas agrupadas por cliente ──
function _agTarefasHtml(tarefas) {
  if (!tarefas.length) {
    return `
      <div class="card" style="margin-bottom:18px">
        <div class="empty-state" style="padding:38px 0;text-align:center">
          <i class="fas fa-mug-hot" style="font-size:26px;color:var(--text-muted)"></i>
          <p style="margin-top:10px;color:var(--text-muted);font-size:13px">Nenhuma tarefa com data para este dia.</p>
        </div>
      </div>`;
  }

  // Agrupa por cliente, preservando o nome para o cabeçalho
  const grupos = new Map();
  tarefas.forEach(t => {
    const id = _agClienteId(t) || '__sem__';
    if (!grupos.has(id)) grupos.set(id, { nome: _agClienteNome(t), itens: [] });
    grupos.get(id).itens.push(t);
  });

  // Cliente com mais tarefas primeiro; "Sem cliente" sempre por último
  const ordenados = [...grupos.entries()].sort((a, b) => {
    if (a[0] === '__sem__') return 1;
    if (b[0] === '__sem__') return -1;
    return b[1].itens.length - a[1].itens.length;
  });

  const total = tarefas.length;

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header">
        <span class="card-title">
          <i class="fas fa-list-check" style="color:var(--purple-light);margin-right:8px"></i>
          Tarefas do dia
          <span style="font-size:11px;color:var(--text-muted);font-weight:400">
            (${total} ${total === 1 ? 'tarefa' : 'tarefas'} · ${ordenados.length} ${ordenados.length === 1 ? 'cliente' : 'clientes'})
          </span>
        </span>
      </div>
      ${ordenados.map(([, g]) => `
        <div class="agenda-grupo">
          <div class="agenda-grupo-head">
            <i class="fas fa-building" style="font-size:11px;color:var(--purple-light)"></i>
            <span>${_agEsc(g.nome)}</span>
            <span class="agenda-grupo-count">${g.itens.length}</span>
          </div>
          ${g.itens.map(t => _agLinha(t)).join('')}
        </div>`).join('')}
    </div>`;
}

// Linha de tarefa — mesmo visual do popup do dia (js/calendario.js:264-276)
function _agLinha(t) {
  const cls = t.status === 'Publicado' ? 'published'
    : (t.status === 'Aprovado' || t.status === 'Programado') ? ''
    : t.status === 'Enviado ao Cliente' ? 'awaiting' : 'pending';
  const resp = _agResponsavel(t);
  const prazo = t.post_date || t.postDate;
  const atrasada = prazo && SC.isOverdue(prazo) && t.status !== 'Publicado';

  return `
    <div class="day-task-row" data-action="open-task-modal" data-id="${t.id}">
      <span class="cal-event ${cls}" style="width:6px;height:34px;padding:0;flex-shrink:0;border-radius:3px"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${_agEsc(t.title)}
        </div>
        <div style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
          <span>${_agEsc(resp.nome)}</span>
          ${atrasada ? '<span class="tag tag-red" style="font-size:9px">VENCIDA</span>' : ''}
        </div>
      </div>
      ${getStatusTag(t.status)}
    </div>`;
}

// ── Compromissos do Google Agenda ──
// Carrega em separado das tarefas: uma conexão quebrada com o Google não
// pode derrubar a lista de tarefas, que é a parte essencial da tela.
function _agCompromissosHtml() {
  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">
          <i class="fab fa-google" style="color:var(--purple-light);margin-right:8px"></i>
          Compromissos
        </span>
        <button class="btn btn-primary btn-sm" data-action="ag-novo-compromisso">
          <i class="fas fa-microphone"></i> Ditar
        </button>
      </div>
      <div id="ag-compromissos">
        <div class="loading-state" style="padding:24px 0;text-align:center;font-size:13px;color:var(--text-muted)">
          <i class="fas fa-spinner fa-spin"></i> Carregando compromissos...
        </div>
      </div>
    </div>`;
}

async function _agCarregarCompromissos() {
  const alvo = document.getElementById('ag-compromissos');
  if (!alvo) return;
  const dia = _agKey(_agDate);

  if (typeof GoogleCalendarService === 'undefined' || !isSupabaseReady()) {
    alvo.innerHTML = _agAvisoConectar('O Google Agenda ainda não está conectado.');
    return;
  }

  // Confere na tabela ANTES de chamar a Edge Function. Quem ainda não conectou
  // (ou o projeto onde a função nem foi publicada) não gera chamada nenhuma —
  // evita erro de CORS no console e bloco de erro nesta tela, que é a do dia a
  // dia. A leitura passa pela RLS: cada um só enxerga a própria linha.
  const { data: cfg, error: cfgErro } = await SB.list('google_calendars', {
    filters: [{ op: 'eq', col: 'user_id', val: SB.profile?.id }],
    limit: 1,
  });
  if (cfgErro || !cfg || !cfg.length || !cfg[0].verified_at) {
    alvo.innerHTML = _agAvisoConectar('O Google Agenda ainda não está conectado.');
    return;
  }

  const r = await GoogleCalendarService.listar(dia);

  // A resposta pode chegar depois de o usuário já ter mudado de dia
  if (_agKey(_agDate) !== dia) return;

  if (r.codigo === 'agenda_nao_configurada' || r.codigo === 'google_nao_configurado') {
    alvo.innerHTML = _agAvisoConectar(r.erro);
    return;
  }
  if (r.erro) {
    // Tom discreto, não alarme: aqui a lista de tarefas é o essencial, e um
    // problema no Google não deve dominar a tela.
    alvo.innerHTML = `
      <div style="padding:20px;text-align:center">
        <p style="font-size:13px;color:var(--text-muted);margin:0">${_agEsc(r.erro)}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:10px" data-action="ag-recarregar-compromissos">
          <i class="fas fa-rotate"></i> Tentar de novo
        </button>
      </div>`;
    return;
  }

  const eventos = r.dados?.eventos || [];
  if (!eventos.length) {
    alvo.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted)">Nenhum compromisso neste dia.</div>`;
    return;
  }

  alvo.innerHTML = eventos.map(e => {
    const hora = e.diaTodo
      ? 'dia todo'
      : (e.inicio || '').slice(11, 16) + (e.fim ? ` – ${e.fim.slice(11, 16)}` : '');
    return `
      <div class="day-task-row" ${e.link ? `onclick="window.open('${e.link}','_blank')"` : ''}>
        <span style="width:6px;height:34px;flex-shrink:0;border-radius:3px;background:var(--purple-light)"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${_agEsc(e.titulo)}
          </div>
          <div style="font-size:11px;color:var(--text-muted)">
            ${_agEsc(hora)}${e.local ? ' · ' + _agEsc(e.local) : ''}
          </div>
        </div>
        ${e.link ? '<i class="fas fa-external-link-alt" style="font-size:11px;color:var(--text-muted)"></i>' : ''}
      </div>`;
  }).join('');
}

function _agAvisoConectar(msg) {
  return `
    <div style="padding:26px;text-align:center">
      <p style="color:var(--text-muted);font-size:13px;margin:0">${_agEsc(msg)}</p>
      <button class="btn btn-secondary btn-sm" style="margin-top:12px"
              data-action="navigate" data-page="configuracoes">
        <i class="fas fa-plug"></i> Conectar em Integrações
      </button>
    </div>`;
}

function _agEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── AÇÕES ───────────────────────────────────
function agMudarDia(dir) {
  _agDate.setDate(_agDate.getDate() + dir);
  _agPintar();
}

function agHoje() {
  _agDate = new Date();
  _agPintar();
}

Router.register('agenda', renderAgenda, 'Agenda');
