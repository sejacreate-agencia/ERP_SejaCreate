// =============================================
// DITADO → COMPROMISSO
// =============================================
// O usuário toca no campo e usa o MICROFONE DO TECLADO do iPhone. Não há
// gravação nem API de voz do navegador: num PWA aberto pela tela de início o
// iOS quebra tanto o webkitSpeechRecognition quanto o MediaRecorder (ambos
// documentados no fórum da Apple). Quem transcreve é o próprio sistema; aqui
// só chega texto.
//
// O interpretador não precisa acertar sempre — o resultado abre num
// formulário de confirmação, e nada vai para a agenda sem revisão.

const _AG_MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const _AG_DIAS  = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function _agNorm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const _agP2 = v => String(v).padStart(2, '0');

// "reunião com a Luanna terça às 15h" → { titulo, clienteId, dia, horaInicio, horaFim }
function agInterpretar(texto, base = new Date()) {
  const n = _agNorm(texto);
  const r = { titulo: '', clienteId: '', dia: '', horaInicio: '', horaFim: '', sugerido: {} };
  const remover = [];
  let mm;

  // ── HORA ──
  let h = null, m = 0;
  if ((mm = n.match(/\bas?\s*(\d{1,2})(?:[:h](\d{2}))?/))) {
    h = +mm[1]; m = +(mm[2] || 0); remover.push(mm[0]);
  } else if ((mm = n.match(/\b(\d{1,2})\s*h(?:oras)?\s*(\d{2})?\b/))) {
    h = +mm[1]; m = +(mm[2] || 0); remover.push(mm[0]);
  } else if ((mm = n.match(/\b(\d{1,2}):(\d{2})\b/))) {
    h = +mm[1]; m = +mm[2]; remover.push(mm[0]);
  } else if ((mm = n.match(/\b(\d{1,2})\s*(?:da|de|a)\s*(manha|tarde|noite)\b/))) {
    h = +mm[1]; remover.push(mm[0]);          // "3 da tarde"
  } else if (/\bmeio dia\b/.test(n)) {
    h = 12; remover.push('meio dia');
  } else if (/\bmeia noite\b/.test(n)) {
    h = 0; remover.push('meia noite');
  }

  // "3 da tarde" → 15h
  if (h !== null && h < 12 && /\b(da|de|a)\s*(tarde|noite)\b/.test(n)) h += 12;

  if (h === null) { h = 9; r.sugerido.hora = true; }   // sem hora dita, sugere 09:00
  if (h > 23) h = 23;
  r.horaInicio = `${_agP2(h)}:${_agP2(m)}`;
  r.horaFim    = `${_agP2((h + 1) % 24)}:${_agP2(m)}`;

  // ── DIA ──
  const d = new Date(base); d.setHours(0, 0, 0, 0);
  const hojeZero = new Date(base); hojeZero.setHours(0, 0, 0, 0);
  let achouDia = true;

  if (/\bdepois de amanha\b/.test(n)) {
    d.setDate(d.getDate() + 2); remover.push('depois de amanha');
  } else if (/\bamanha\b/.test(n)) {
    d.setDate(d.getDate() + 1); remover.push('amanha');
  } else if (/\bhoje\b/.test(n)) {
    remover.push('hoje');
  } else if ((mm = n.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    if (mm[3]) d.setFullYear(+mm[3] < 100 ? 2000 + +mm[3] : +mm[3]);
    d.setMonth(+mm[2] - 1, +mm[1]);
    remover.push(mm[0]);
  } else if ((mm = n.match(new RegExp('\\b(\\d{1,2}) de (' + _AG_MESES.join('|') + ')')))) {
    d.setMonth(_AG_MESES.indexOf(mm[2]), +mm[1]);
    if (d < hojeZero) d.setFullYear(d.getFullYear() + 1);
    remover.push(mm[0]);
  } else if ((mm = n.match(/\bdia (\d{1,2})\b/))) {
    d.setDate(+mm[1]);
    if (d < hojeZero) d.setMonth(d.getMonth() + 1);
    remover.push(mm[0]);
  } else if ((mm = n.match(new RegExp('\\b(' + _AG_DIAS.join('|') + ')(?:\\s*-?\\s*feira)?')))) {
    const alvo = _AG_DIAS.indexOf(mm[1]);
    let delta = (alvo - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;                       // "terça" dito numa terça = a próxima
    if (/\b(que vem|proxima|proximo)\b/.test(n)) delta += 7;
    d.setDate(d.getDate() + delta);
    remover.push(mm[0]);
  } else {
    achouDia = false;
  }

  r.dia = `${d.getFullYear()}-${_agP2(d.getMonth() + 1)}-${_agP2(d.getDate())}`;
  if (!achouDia) r.sugerido.dia = true;

  // ── CLIENTE ──
  const cli = agAcharCliente(n);
  if (cli) { r.clienteId = cli.id; if (cli.trecho) remover.push(cli.trecho); }

  r.titulo = _agTitulo(texto, remover);
  return r;
}

const _AG_STOP = ['com', 'a', 'o', 'as', 'os', 'da', 'de', 'do', 'na', 'no',
                  'para', 'pra', 'e', 'em', 'ao'];

// Monta o título com as palavras do texto ORIGINAL que sobraram.
//
// Trabalha por palavra, e não por regex sobre o texto todo, por dois motivos
// que só apareceram no teste:
//  1. o \b do JavaScript ignora acento — como "ã" não é \w, existe fronteira
//     antes do "o" de "Reunião", e remover o artigo "o" comia a letra;
//  2. os fragmentos a remover estão normalizados ("as 15"), e não casariam
//     contra o original acentuado ("às 15h").
// Comparar palavra a palavra na versão normalizada resolve os dois.
function _agTitulo(texto, remover) {
  const orig = String(texto || '').split(/\s+/).filter(Boolean);
  const norm = orig.map(_agNorm);
  const fora = new Array(orig.length).fill(false);

  remover.filter(Boolean).forEach(frag => {
    const alvo = _agNorm(frag).split(' ').filter(Boolean);
    if (!alvo.length) return;
    for (let i = 0; i <= norm.length - alvo.length; i++) {
      if (fora[i]) continue;
      // O primeiro token pode vir "colado" (ex.: "15h" contendo "15")
      const casa = alvo.every((a, k) => norm[i + k] === a || norm[i + k].startsWith(a));
      if (casa) { for (let k = 0; k < alvo.length; k++) fora[i + k] = true; break; }
    }
  });

  const palavras = orig.filter((_, i) => !fora[i] && !_AG_STOP.includes(norm[i]));
  const t = palavras.join(' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Compromisso';
}

// Distância de edição (Levenshtein)
function _agDist(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let ant = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = tmp;
    }
  }
  return dp[b.length];
}

// Aproxima grafias que o ditado confunde: Luanna/Luana, Cássia/Cassia, Rocha/Roxa
function _agFonetico(s) {
  return _agNorm(s)
    .replace(/ss|c(?=[ei])/g, 's')
    .replace(/lh/g, 'ly').replace(/nh/g, 'ny')
    .replace(/ph/g, 'f').replace(/qu/g, 'k')
    .replace(/(.)\1+/g, '$1');
}

// Casa contra o NOME do cliente e contra o CONTATO (resp): "reunião com a
// Luanna" quase sempre cita a pessoa, não a razão social.
// Sem casamento confiável devolve null — melhor deixar em branco do que errar.
function agAcharCliente(textoNorm) {
  const clientes = (typeof SC !== 'undefined' && SC.clients) || [];
  const palavras = textoNorm.split(' ').filter(p => p.length >= 3);
  let melhor = null;

  clientes.forEach(c => {
    [c.name, c.resp].filter(Boolean).forEach(alvo => {
      const alvoN = _agNorm(alvo);
      if (alvoN.length < 3) return;

      // Nome completo aparece literalmente: melhor sinal possível
      if (textoNorm.includes(alvoN)) {
        if (!melhor || melhor.score < 1) melhor = { id: c.id, score: 1, trecho: alvoN };
        return;
      }
      alvoN.split(' ').forEach(tokenAlvo => {
        if (tokenAlvo.length < 3) return;
        palavras.forEach(p => {
          let score;
          if (p === tokenAlvo) score = 0.9;
          else {
            const a = _agFonetico(p), b = _agFonetico(tokenAlvo);
            score = 1 - _agDist(a, b) / Math.max(a.length, b.length);
          }
          if (score >= 0.75 && (!melhor || score > melhor.score)) {
            melhor = { id: c.id, score, trecho: p };
          }
        });
      });
    });
  });

  return melhor;
}

// ─── MODAL ───────────────────────────────────
function agAbrirDitado() {
  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-microphone" style="color:var(--purple-light);margin-right:8px"></i>
        Novo compromisso
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" id="ag-ditado-body">
      <label style="font-size:12px;color:var(--text-secondary)">
        Toque no campo, aperte o <b>microfone do teclado</b> e fale
      </label>
      <textarea class="input-field" id="ag-ditado" rows="3" autocapitalize="sentences"
                placeholder="Ex.: reunião com a Luanna terça às 15h"
                style="margin-top:6px;font-size:15px"></textarea>
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px">
        Você confere tudo antes de salvar.
      </p>
    </div>
    <div class="modal-footer" id="ag-ditado-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="ag-interpretar">
        <i class="fas fa-arrow-right"></i> Continuar
      </button>
    </div>
  `);
  setTimeout(() => document.getElementById('ag-ditado')?.focus(), 120);
}

// Interpreta só no clique — NUNCA no evento input. Durante o ditado o iOS
// reescreve o campo continuamente, e re-renderizar no meio encerra a sessão
// de voz: o usuário perde o que estava falando.
function agInterpretarDitado() {
  const texto = (document.getElementById('ag-ditado')?.value || '').trim();
  if (!texto) { showToast('Fale ou escreva o compromisso.', 'warning'); return; }

  const r = agInterpretar(texto, new Date());
  const esc = typeof _agEsc === 'function' ? _agEsc : (s => s);
  const clientes = (SC.clients || []);
  const opts = '<option value="">— sem cliente —</option>' + clientes
    .map(c => `<option value="${c.id}" ${String(c.id) === String(r.clienteId) ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const alerta = 'style="border-color:var(--warning)"';

  document.getElementById('ag-ditado-body').innerHTML = `
    <div class="form-row"><div class="form-col full">
      <label>Título</label>
      <input class="input-field" id="ag-f-titulo" value="${esc(r.titulo)}">
    </div></div>
    <div class="form-row"><div class="form-col full">
      <label>Cliente ${r.clienteId ? '<span style="color:var(--text-muted);font-weight:400">— sugerido pelo que você falou</span>' : ''}</label>
      <select class="select-field" id="ag-f-cliente">${opts}</select>
    </div></div>
    <div class="form-row">
      <div class="form-col">
        <label>Data ${r.sugerido.dia ? '<span style="color:var(--warning);font-weight:400">— confira</span>' : ''}</label>
        <input type="date" class="input-field" id="ag-f-dia" value="${r.dia}" ${r.sugerido.dia ? alerta : ''}>
      </div>
      <div class="form-col">
        <label>Início ${r.sugerido.hora ? '<span style="color:var(--warning);font-weight:400">— confira</span>' : ''}</label>
        <input type="time" class="input-field" id="ag-f-hi" value="${r.horaInicio}" ${r.sugerido.hora ? alerta : ''}>
      </div>
      <div class="form-col">
        <label>Fim</label>
        <input type="time" class="input-field" id="ag-f-hf" value="${r.horaFim}">
      </div>
    </div>
    <div class="form-row"><div class="form-col full">
      <label>Observações</label>
      <textarea class="input-field" id="ag-f-desc" rows="2">${esc(texto)}</textarea>
    </div></div>
  `;

  document.getElementById('ag-ditado-footer').innerHTML = `
    <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
    <button class="btn btn-primary" id="ag-btn-salvar" data-action="ag-salvar-compromisso">
      <i class="fab fa-google"></i> Criar no Google Agenda
    </button>`;
}

async function agSalvarCompromisso() {
  const g = id => document.getElementById(id);
  const titulo = g('ag-f-titulo')?.value.trim();
  const dia = g('ag-f-dia')?.value;
  const hi = g('ag-f-hi')?.value;
  const hf = g('ag-f-hf')?.value;
  if (!titulo || !dia || !hi || !hf) { showToast('Preencha título, data e horários.', 'warning'); return; }
  if (hf <= hi) { showToast('O horário final precisa ser depois do inicial.', 'warning'); return; }

  const clienteId = g('ag-f-cliente')?.value;
  const nomeCliente = clienteId ? SC.getClientName(clienteId) : '';
  const desc = [g('ag-f-desc')?.value.trim(), nomeCliente ? `Cliente: ${nomeCliente}` : '']
    .filter(Boolean).join('\n\n');

  const btn = g('ag-btn-salvar');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...'; }

  const r = await GoogleCalendarService.criar({
    titulo, dia, horaInicio: hi, horaFim: hf, descricao: desc,
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-google"></i> Criar no Google Agenda'; }
  if (r.erro) { showToast(r.erro, 'error'); return; }

  closeModal();
  showToast('✅ Compromisso criado no Google Agenda!', 'success');
  if (typeof _agCarregarCompromissos === 'function' && dia === _agKey(_agDate)) {
    _agCarregarCompromissos();
  }
}
