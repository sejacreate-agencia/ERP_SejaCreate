// =============================================
// AGENDA DO DIA
// =============================================
// Tela pessoal de foco. Três camadas, de fora para dentro:
//   1. captura rápida → caixa de entrada (decide depois onde entra)
//   2. compromissos do Google Agenda
//   3. dois modos de trabalho: criativo e administrativo
// E, recolhido ao fim, o que há no kanban para o dia, agrupado por cliente.
//
// Os itens dos modos são PESSOAIS e ficam em `agenda_items` — separados da
// tabela `tasks`, que é o trabalho de cliente.

let _agDate = new Date();      // dia em exibição
let _agData = [];              // tasks do kanban (Data.tasks())
let _agItens = [];             // itens pessoais (agenda_items)

const AG_MODOS = {
  criativo: { titulo: 'Modo Criativo',       sub: 'estratégia · conteúdo · decisões' },
  admin:    { titulo: 'Modo Administrativo', sub: 'financeiro · atendimento · gestão' },
};

// ─── DATAS ───────────────────────────────────
// YYYY-MM-DD local. Não usar toISOString(), que converte para UTC e à noite
// devolve o dia anterior.
function _agKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _agEhHoje(d) {
  return _agKey(d) === _agKey(new Date());
}

function _agRotulo(d) {
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

// ─── CLIENTE (para a seção do kanban) ────────
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

function _agEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── RENDER ──────────────────────────────────
async function renderAgenda() {
  const pc = document.getElementById('page-content');

  // Skeleton ANTES do await: o Router.navigate chama esta função sem await
  // (js/core/router.js:47), então sem isto a tela fica em branco.
  pc.innerHTML = `
    <div class="agenda-zen">
      <div id="ag-topo"></div>
      <div id="ag-body">
        <div class="ag-carregando"><i class="fas fa-spinner fa-spin"></i> Carregando sua agenda...</div>
      </div>
    </div>`;

  _agPintarTopo();

  const [tasks, itens] = await Promise.allSettled([
    Data.tasks(),
    _agCarregarItens(),
  ]);
  _agData  = tasks.status === 'fulfilled' ? tasks.value : [];
  _agItens = itens.status === 'fulfilled' ? itens.value : [];

  _agPintar();
}

async function _agCarregarItens() {
  const uid = SC.currentUser?.id;
  if (!uid || !isSupabaseReady()) return [];
  const { data, error } = await DB.agendaItems.doDia(uid, _agKey(_agDate));
  if (error) {
    // Tabela ainda não criada (migration 021) não pode derrubar a tela
    console.warn('Agenda: itens indisponíveis —', error.message);
    return [];
  }
  return data;
}

// Cabeçalho: monograma, nome e a data. Fica fora do _agPintar porque não
// depende dos dados — aparece já no skeleton.
function _agPintarTopo() {
  const topo = document.getElementById('ag-topo');
  if (!topo) return;

  const nome = SB.profile?.full_name || SC.currentUser?.name || 'Usuário';
  // avatar_initials costuma ter 2 letras ("RM"); o monograma usa só a primeira
  const mono = (SC.currentUser?.avatar || nome).charAt(0).toUpperCase();
  const hoje = _agEhHoje(_agDate);

  topo.innerHTML = `
    <div class="ag-header">
      <div class="ag-header-quem">
        <div class="ag-mono">${_agEsc(mono)}</div>
        <div>
          <h1 class="ag-titulo">Agenda do dia</h1>
          <div class="ag-marca">Seja Create · ${_agEsc(nome)}</div>
        </div>
      </div>
      <div class="ag-data">
        ${hoje ? '' : '<button class="ag-link" data-action="ag-hoje">voltar para hoje</button>'}
        <button class="ag-seta" data-action="ag-dia" data-dir="-1" title="Dia anterior">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span id="ag-data-txt">${_agRotulo(_agDate)}${hoje ? ' · <em>hoje</em>' : ''}</span>
        <button class="ag-seta" data-action="ag-dia" data-dir="1" title="Próximo dia">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>`;
}

function _agPintar() {
  _agPintarTopo();
  const body = document.getElementById('ag-body');
  if (!body) return;

  const chave = _agKey(_agDate);
  const doDia = _agData.filter(t => {
    const d = t.post_date || t.postDate;
    return d && String(d).slice(0, 10) === chave;
  });

  body.innerHTML = `
    ${_agCapturaHtml()}
    ${_agInboxHtml()}
    ${_agCompromissosHtml()}
    ${_agModosHtml()}
    ${_agKanbanHtml(doDia)}
  `;

  _agCarregarCompromissos();   // assíncrono, não bloqueia o resto
}

// ── 1. CAPTURA RÁPIDA ──
// Texto cru direto para a caixa de entrada. Não interpreta data nem cliente
// de propósito: capturar é anotar sem decidir — quem decide é a triagem.
function _agCapturaHtml() {
  return `
    <div class="ag-captura">
      <span class="ag-captura-mic" title="Use o microfone do teclado do celular">
        <i class="fas fa-microphone"></i>
      </span>
      <input class="ag-captura-campo" id="ag-captura" autocapitalize="sentences"
             placeholder="Capturar uma demanda agora, decide depois onde entra..."
             onkeyup="if(event.key==='Enter')agCapturar()">
      <button class="ag-btn-acao" data-action="ag-capturar">Capturar</button>
    </div>`;
}

// ── 2. CAIXA DE ENTRADA ──
// Ignora o dia: um item capturado e não triado continua aparecendo até você
// decidir o que fazer com ele. É o que dá sentido a "decide depois".
function _agInboxHtml() {
  const inbox = _agItens.filter(i => i.modo === 'inbox' && !i.feito);
  if (!inbox.length) return '';

  return `
    <div class="ag-bloco ag-bloco-inbox">
      <div class="ag-bloco-titulo">Não triados <span class="ag-conta">${inbox.length}</span></div>
      ${inbox.map(i => `
        <div class="ag-inbox-linha">
          <span class="ag-inbox-texto">${_agEsc(i.texto)}</span>
          <span class="ag-inbox-acoes">
            <button class="ag-tag-btn" data-action="ag-triar" data-id="${i.id}" data-modo="criativo">Criativo</button>
            <button class="ag-tag-btn" data-action="ag-triar" data-id="${i.id}" data-modo="admin">Administrativo</button>
            <button class="ag-tag-btn ag-tag-x" data-action="ag-remover" data-id="${i.id}" title="Descartar">&times;</button>
          </span>
        </div>`).join('')}
    </div>`;
}

// ── 3. COMPROMISSOS (Google Agenda) ──
function _agCompromissosHtml() {
  return `
    <div class="ag-bloco">
      <div class="ag-bloco-titulo">
        Compromissos de hoje <span class="ag-sub">Google Agenda</span>
        <button class="ag-link" style="margin-left:auto" data-action="ag-novo-compromisso">
          <i class="fas fa-microphone"></i> ditar
        </button>
      </div>
      <div id="ag-compromissos">
        <div class="ag-vazio"><i class="fas fa-spinner fa-spin"></i> carregando...</div>
      </div>
    </div>`;
}

// Uma vez descoberto que o Google não está ligado, para de tentar: sem isto,
// cada navegação de dia dispara uma chamada que já se sabe que vai falhar, e
// enche o console de erro. Zerado ao conectar.
let _agGoogleIndisponivel = null;

async function _agCarregarCompromissos() {
  const alvo = document.getElementById('ag-compromissos');
  if (!alvo) return;
  const dia = _agKey(_agDate);

  if (typeof GoogleCalendarService === 'undefined' || !isSupabaseReady()) {
    alvo.innerHTML = _agAvisoConectar('O Google Agenda ainda não está conectado.');
    return;
  }
  if (_agGoogleIndisponivel) {
    alvo.innerHTML = _agAvisoConectar(_agGoogleIndisponivel.msg, _agGoogleIndisponivel.podeConectar);
    return;
  }

  const r = await GoogleCalendarService.listar(dia);

  // A resposta pode chegar depois de o usuário já ter mudado de dia
  if (_agKey(_agDate) !== dia) return;

  if (['nao_conectado', 'reautorizar', 'google_nao_configurado'].includes(r.codigo)) {
    const podeConectar = r.codigo !== 'google_nao_configurado';
    _agGoogleIndisponivel = { msg: r.erro, podeConectar };
    alvo.innerHTML = _agAvisoConectar(r.erro, podeConectar);
    return;
  }
  if (r.erro) {
    alvo.innerHTML = `
      <div class="ag-vazio">${_agEsc(r.erro)}
        <button class="ag-link" data-action="ag-recarregar-compromissos">tentar de novo</button>
      </div>`;
    return;
  }

  const eventos = r.dados?.eventos || [];
  if (!eventos.length) {
    alvo.innerHTML = `<div class="ag-vazio">Sem compromissos para este dia.</div>`;
    return;
  }

  alvo.innerHTML = eventos.map(e => {
    const hora = e.diaTodo
      ? 'dia todo'
      : (e.inicio || '').slice(11, 16) + (e.fim ? ` – ${e.fim.slice(11, 16)}` : '');
    return `
      <div class="ag-evento" ${e.link ? `onclick="window.open('${e.link}','_blank')"` : ''}>
        <span class="ag-evento-hora">${_agEsc(hora)}</span>
        <span class="ag-evento-titulo">${_agEsc(e.titulo)}</span>
        ${e.local ? `<span class="ag-sub">${_agEsc(e.local)}</span>` : ''}
      </div>`;
  }).join('');
}

function _agAvisoConectar(msg, podeConectar = true) {
  return `
    <div class="ag-vazio">${_agEsc(msg)}
      ${podeConectar ? '<button class="ag-link" data-action="gcal-conectar">conectar</button>' : ''}
    </div>`;
}

// ── 4. OS DOIS MODOS ──
function _agModosHtml() {
  return `<div class="ag-modos">${
    Object.keys(AG_MODOS).map(m => _agColunaHtml(m)).join('')
  }</div>`;
}

function _agColunaHtml(modo) {
  const cfg = AG_MODOS[modo];
  const chave = _agKey(_agDate);

  const itens = _agItens.filter(i => i.modo === modo)
    // Do dia escolhido, mais o que ficou em aberto para trás: uma lista diária
    // que engole silenciosamente o não feito é o jeito clássico de perder a
    // confiança de quem usa.
    .filter(i => i.dia === chave || (!i.feito && i.dia < chave))
    .sort((a, b) => (a.feito - b.feito) || (a.ordem - b.ordem) || a.created_at.localeCompare(b.created_at));

  const linhas = itens.length
    ? itens.map(i => {
        const atrasado = !i.feito && i.dia < chave;
        return `
          <div class="ag-item ${i.feito ? 'feito' : ''}">
            <button class="ag-check" data-action="ag-concluir" data-id="${i.id}"
                    title="${i.feito ? 'Reabrir' : 'Concluir'}">
              <i class="fas fa-${i.feito ? 'check-circle' : 'circle'}"></i>
            </button>
            <span class="ag-item-texto">${_agEsc(i.texto)}</span>
            ${atrasado ? `<span class="ag-atrasado" title="veio de ${i.dia.slice(8,10)}/${i.dia.slice(5,7)}">↩</span>` : ''}
            <button class="ag-item-x" data-action="ag-remover" data-id="${i.id}" title="Remover">&times;</button>
          </div>`;
      }).join('')
    : `<div class="ag-vazio">Nenhuma tarefa ainda.</div>`;

  return `
    <div class="ag-coluna">
      <div class="ag-coluna-titulo">${cfg.titulo}</div>
      <div class="ag-coluna-sub">${cfg.sub}</div>
      <div class="ag-coluna-lista">${linhas}</div>
      <div class="ag-add">
        <input class="ag-add-campo" id="ag-add-${modo}" autocapitalize="sentences"
               placeholder="Nova tarefa ${modo === 'criativo' ? 'criativa' : 'administrativa'}..."
               onkeyup="if(event.key==='Enter')agAdicionar('${modo}')">
        <button class="ag-add-btn" data-action="ag-adicionar" data-modo="${modo}">+</button>
      </div>
    </div>`;
}

// ── 5. DO KANBAN, RECOLHIDO ──
function _agKanbanHtml(tarefas) {
  if (!tarefas.length) return '';

  const grupos = new Map();
  tarefas.forEach(t => {
    const id = _agClienteId(t) || '__sem__';
    if (!grupos.has(id)) grupos.set(id, { nome: _agClienteNome(t), itens: [] });
    grupos.get(id).itens.push(t);
  });

  const ordenados = [...grupos.entries()].sort((a, b) => {
    if (a[0] === '__sem__') return 1;
    if (b[0] === '__sem__') return -1;
    return b[1].itens.length - a[1].itens.length;
  });

  return `
    <details class="ag-bloco ag-kanban">
      <summary class="ag-bloco-titulo">
        Do kanban, neste dia <span class="ag-conta">${tarefas.length}</span>
      </summary>
      <div style="margin-top:10px">
        ${ordenados.map(([, g]) => `
          <div class="ag-kanban-grupo">
            <div class="ag-kanban-cliente">${_agEsc(g.nome)}</div>
            ${g.itens.map(t => {
              const resp = _agResponsavel(t);
              const prazo = t.post_date || t.postDate;
              const atrasada = prazo && SC.isOverdue(prazo) && t.status !== 'Publicado';
              return `
                <div class="ag-kanban-linha" data-action="open-task-modal" data-id="${t.id}">
                  <span class="ag-kanban-titulo">${_agEsc(t.title)}</span>
                  <span class="ag-sub">${_agEsc(resp.nome)}${atrasada ? ' · vencida' : ''}</span>
                </div>`;
            }).join('')}
          </div>`).join('')}
      </div>
    </details>`;
}

// ─── AÇÕES ───────────────────────────────────

function agMudarDia(dir) {
  _agDate.setDate(_agDate.getDate() + dir);
  _agRecarregar();
}

function agHoje() {
  _agDate = new Date();
  _agRecarregar();
}

async function _agRecarregar() {
  _agItens = await _agCarregarItens();
  _agPintar();
}

async function _agGravar(payload) {
  const uid = SC.currentUser?.id;
  if (!uid) { showToast('Sessão expirada. Entre novamente.', 'error'); return false; }
  if (!isSupabaseReady()) { showToast('Disponível na versão conectada ao Supabase.', 'warning'); return false; }

  const { error } = await DB.agendaItems.criar({
    user_id: uid, dia: _agKey(_agDate), ...payload,
  });
  if (error) {
    showToast(`Não foi possível salvar: ${error.message}`, 'error');
    return false;
  }
  return true;
}

async function agCapturar() {
  const campo = document.getElementById('ag-captura');
  const texto = (campo?.value || '').trim();
  if (!texto) return;

  if (await _agGravar({ texto, modo: 'inbox' })) {
    campo.value = '';
    await _agRecarregar();
  }
}

async function agAdicionar(modo) {
  const campo = document.getElementById(`ag-add-${modo}`);
  const texto = (campo?.value || '').trim();
  if (!texto) return;

  if (await _agGravar({ texto, modo })) {
    campo.value = '';
    await _agRecarregar();
  }
}

// Triar: sai da caixa de entrada e passa a pertencer ao dia em exibição.
async function agTriar(id, modo) {
  const { error } = await DB.agendaItems.atualizar(id, { modo, dia: _agKey(_agDate) });
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  await _agRecarregar();
}

async function agConcluir(id) {
  const item = _agItens.find(i => String(i.id) === String(id));
  if (!item) return;
  const feito = !item.feito;

  const { error } = await DB.agendaItems.atualizar(id, {
    feito, feito_em: feito ? new Date().toISOString() : null,
  });
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  await _agRecarregar();
}

async function agRemover(id) {
  const { error } = await DB.agendaItems.remover(id);
  if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  await _agRecarregar();
}

Router.register('agenda', renderAgenda, 'Agenda');
