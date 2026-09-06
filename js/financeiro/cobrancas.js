// =============================================
// SEJA CREATE — COBRANÇA CORA (a partir do A Receber)
// =============================================
// Modais de gerar e visualizar cobrança. Toda escrita passa pela Edge Function
// `cora`: o navegador nunca manda valor nem vencimento, só o receivable_id.
//
// Este arquivo NÃO recria a tela A Receber — só acrescenta ações a ela.

// ─── Helpers de estado ────────────────────────
// O embed vem do PostgREST como array (é uma relação 1-N), mas na prática só há
// uma cobrança viva por recebível — o índice uniq_charge_viva_por_recebivel
// garante isso no banco.
function _cobrancaDe(r) {
  const c = r?.charge;
  if (!c) return null;
  const lista = Array.isArray(c) ? c : [c];
  return lista.find(x => x && !['cancelada', 'falha_envio'].includes(x.status)) || null;
}

function _notaDe(r) {
  const n = r?.nfse;
  if (!n) return null;
  const lista = Array.isArray(n) ? n : [n];
  return lista.find(x => x && !['cancelada', 'falha', 'rejeitada'].includes(x.status)) || null;
}

const _COB_TAGS = {
  rascunho:     { cls: 'tag-gray',   label: 'Rascunho' },
  enviando:     { cls: 'tag-blue',   label: 'Enviando' },
  falha_envio:  { cls: 'tag-red',    label: 'Falhou' },
  aberta:       { cls: 'tag-blue',   label: 'Aberta' },
  em_pagamento: { cls: 'tag-purple', label: 'Em pagamento' },
  vencida:      { cls: 'tag-red',    label: 'Vencida' },
  paga:         { cls: 'tag-green',  label: 'Paga' },
  cancelada:    { cls: 'tag-gray',   label: 'Cancelada' },
};

const _NFSE_TAGS = {
  rascunho:             { cls: 'tag-gray',   label: 'Rascunho' },
  bloqueada:            { cls: 'tag-gray',   label: 'Bloqueada' },
  pendente_emissao:     { cls: 'tag-yellow', label: 'Pendente' },
  emitindo:             { cls: 'tag-yellow', label: 'Emitindo' },
  emitida:              { cls: 'tag-green',  label: 'Emitida' },
  emitida_externamente: { cls: 'tag-green',  label: 'Externa' },
  rejeitada:            { cls: 'tag-red',    label: 'Rejeitada' },
  falha:                { cls: 'tag-red',    label: 'Falha' },
  cancelamento_pendente:{ cls: 'tag-yellow', label: 'Cancelando' },
  cancelada:            { cls: 'tag-gray',   label: 'Cancelada' },
};

// Célula da coluna "Cobrança / NF" do A Receber. Discreta de propósito: dois
// badges pequenos, com o detalhe no title.
function _cobrancaCelula(r) {
  const c = _cobrancaDe(r);
  const n = _notaDe(r);
  const partes = [];

  if (c) {
    const t = _COB_TAGS[c.status] || _COB_TAGS.aberta;
    const formas = [c.boleto_digitable ? 'boleto' : null, c.pix_emv ? 'Pix' : null]
      .filter(Boolean).join(' + ');
    partes.push(
      `<span class="tag ${t.cls}" style="cursor:pointer" data-action="ver-cobranca"
             data-id="${r.id}" title="Cobrança Cora ${t.label.toLowerCase()}${formas ? ' — ' + formas : ''}">
         <i class="fas fa-barcode"></i> ${t.label}
       </span>`);
  }

  if (n) {
    const t = _NFSE_TAGS[n.status] || _NFSE_TAGS.rascunho;
    const titulo = n.numero_nfse ? `NFS-e nº ${n.numero_nfse}` : `NFS-e ${t.label.toLowerCase()}`;
    partes.push(
      `<span class="tag ${t.cls}" title="${_cobEsc(titulo)}${n.motivo_bloqueio ? ' — ' + _cobEsc(n.motivo_bloqueio) : ''}">
         <i class="fas fa-receipt"></i> NF
       </span>`);
  }

  if (!partes.length) {
    // Sem cobrança: o botão de gerar. Só para quem pode mexer no financeiro.
    if (r.status === 'pago' || r.status === 'cancelado') return '<span style="color:var(--text-muted)">—</span>';
    return `<button class="btn btn-sm btn-ghost" data-action="open-cobranca" data-id="${r.id}"
                    title="Gerar cobrança na Cora" style="font-size:11px;white-space:nowrap">
              <i class="fas fa-barcode"></i> Gerar
            </button>`;
  }
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">${partes.join('')}</div>`;
}

function _cobEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _recPorId(id) {
  return (_recDataAll || []).find(x => String(x.id) === String(id))
      || (_recData || []).find(x => String(x.id) === String(id));
}

// Nome do cliente, que vem ora como objeto do join, ora como id solto.
function _cobClienteNome(r) {
  if (r?.client && typeof r.client === 'object') return r.client.name || 'Cliente';
  return SC.getClientName(r?.client_id || r?.client) || 'Cliente';
}

// ─── GERAR COBRANÇA ───────────────────────────
async function openCobrancaModal(receivableId) {
  const r = _recPorId(receivableId);
  if (!r) { showToast('Recebimento não encontrado.', 'error'); return; }

  const jaTem = _cobrancaDe(r);
  if (jaTem && jaTem.provider_charge_id) { verCobranca(receivableId); return; }

  const cfg = (await DB.chargeSettings.get()).data || {};
  const multaPct = cfg.aplicar_multa ? Number(cfg.multa_percentual) || 0 : 0;
  const jurosPct = cfg.aplicar_juros ? Number(cfg.juros_percentual_mes) || 0 : 0;

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-barcode"></i> Gerar cobrança</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="background:var(--bg-input);border-radius:var(--border-radius-sm);
                  padding:12px 14px;margin-bottom:16px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Cliente</span>
          <strong>${_cobEsc(_cobClienteNome(r))}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Descrição</span>
          <strong>${_cobEsc(r.description || r.desc || '—')}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Valor</span>
          <strong style="color:var(--success)">${SC.formatCurrency(r.value || 0)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Vencimento</span>
          <strong>${formatDateBR(r.due_date || r.due) || '—'}</strong></div>
      </div>

      <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px">Método</label>
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <label style="display:flex;gap:7px;align-items:center;cursor:pointer;font-size:13px">
          <input type="checkbox" id="cob-boleto" ${cfg.gerar_boleto !== false ? 'checked' : ''}> Boleto
        </label>
        <label style="display:flex;gap:7px;align-items:center;cursor:pointer;font-size:13px">
          <input type="checkbox" id="cob-pix" ${cfg.gerar_pix !== false ? 'checked' : ''}> QR Code Pix
        </label>
      </div>

      <div class="form-row">
        <div class="form-col">
          <label>Multa</label>
          <input type="number" class="input-field" id="cob-multa" step="0.01" min="0" value="${multaPct}">
          <span style="font-size:11px;color:var(--text-muted)">% sobre o valor, após o vencimento</span>
        </div>
        <div class="form-col">
          <label>Juros</label>
          <input type="number" class="input-field" id="cob-juros" step="0.01" min="0" value="${jurosPct}">
          <span style="font-size:11px;color:var(--text-muted)">% ao mês</span>
        </div>
      </div>

      <p style="font-size:11px;color:var(--text-muted);margin-top:12px;line-height:1.6">
        O valor e o vencimento vêm do recebimento e não podem ser alterados aqui —
        para mudá-los, edite o lançamento antes de gerar a cobrança.
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" id="btn-emitir-cob"
              data-action="emitir-cobranca" data-id="${r.id}">
        <i class="fas fa-barcode"></i> Gerar cobrança
      </button>
    </div>`, 'modal-lg');
}

async function emitirCobranca(receivableId) {
  const btn = document.getElementById('btn-emitir-cob');
  const boleto = document.getElementById('cob-boleto')?.checked;
  const pix    = document.getElementById('cob-pix')?.checked;
  if (!boleto && !pix) { showToast('Escolha pelo menos um método.', 'error'); return; }

  // Trava de duplo-clique no cliente. A de verdade é a idempotency_key gravada
  // no servidor antes da chamada — esta aqui é só cortesia visual.
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...'; }

  const r = await CoraService.emitir(receivableId, {
    formas: [...(boleto ? ['BANK_SLIP'] : []), ...(pix ? ['PIX'] : [])],
    jurosPercentual: Number(document.getElementById('cob-juros')?.value) || 0,
    multaCentavos: (() => {
      const rec = _recPorId(receivableId);
      const pct = Number(document.getElementById('cob-multa')?.value) || 0;
      return pct ? Math.round((Number(rec?.value) || 0) * 100 * pct / 100) : 0;
    })(),
  });

  if (r.erro) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-barcode"></i> Gerar cobrança'; }
    // cliente_incompleto vem com a lista NOMINAL do que falta — mostrá-la evita
    // o usuário ficar adivinhando qual campo do cadastro está vazio.
    if (r.codigo === 'cliente_incompleto' && r.extra?.faltando?.length) {
      Modal.alert(
        `Faltam estes dados no cadastro do cliente:<br><br><strong>${
          r.extra.faltando.map(_cobEsc).join('</strong>, <strong>')
        }</strong><br><br>Complete em Cadastro → o cliente → Dados fiscais.`,
        'Cliente incompleto');
      return;
    }
    if (r.codigo === 'cobranca_ja_existe') { closeModal(); verCobranca(receivableId); return; }
    showToast(r.erro, 'error');
    return;
  }

  _aplicarCobrancaNoEstado(receivableId, r.dados.cobranca);
  closeModal();
  showToast('✅ Cobrança gerada!', 'success');
  _renderFinContent();
  verCobranca(receivableId);
}

// As três cópias em memória do mesmo recebível (_recData, _recDataAll e
// SC.finances.receivable) são sincronizadas à mão em cada operação do
// financeiro. Não sincronizar aqui faria o badge sumir na próxima renderização.
function _aplicarCobrancaNoEstado(receivableId, cobranca) {
  const aplica = lista => {
    const it = (lista || []).find(x => String(x.id) === String(receivableId));
    if (it) it.charge = cobranca ? [cobranca] : [];
  };
  aplica(_recData);
  aplica(_recDataAll);
  // SC.finances.receivable alimenta avisos e dashboard, que não leem `charge`.
  // Deixado de fora de propósito.
}

// ─── VISUALIZAR COBRANÇA ──────────────────────
async function verCobranca(receivableId) {
  const r = _recPorId(receivableId);
  const c = _cobrancaDe(r);
  if (!c) { showToast('Nenhuma cobrança para este recebimento.', 'error'); return; }

  const t = _COB_TAGS[c.status] || _COB_TAGS.aberta;
  const cfg = (await DB.chargeSettings.get()).data || {};

  const bloco = (titulo, corpo) => `
    <div style="border:1px solid var(--border);border-radius:var(--border-radius);
                padding:14px 16px;margin-bottom:12px">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;
                  color:var(--text-muted);margin-bottom:10px">${titulo}</div>
      ${corpo}
    </div>`;

  const copiavel = (valor, rotulo) => `
    <div style="display:flex;gap:8px;align-items:flex-start">
      <code style="flex:1;min-width:0;font-size:11px;word-break:break-all;
                   background:var(--bg-input);padding:8px 10px;border-radius:6px;
                   line-height:1.5">${_cobEsc(valor)}</code>
      <button class="btn btn-sm btn-secondary" data-action="copiar-texto"
              data-valor="${_cobEsc(valor)}" data-rotulo="${_cobEsc(rotulo)}"
              style="flex-shrink:0"><i class="fas fa-copy"></i></button>
    </div>`;

  const temPix = !!c.pix_emv && cfg.incluir_pix_copia_cola !== false;

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-barcode"></i> Cobrança</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" style="max-height:72vh;overflow-y:auto">
      <div style="background:var(--bg-input);border-radius:var(--border-radius-sm);
                  padding:12px 14px;margin-bottom:16px;font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Cliente</span>
          <strong>${_cobEsc(_cobClienteNome(r))}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Descrição</span>
          <strong>${_cobEsc(r.description || r.desc || '—')}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Valor</span>
          <strong style="color:var(--success)">${SC.formatCurrency((c.valor_centavos || 0) / 100)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Vencimento</span>
          <strong>${formatDateBR(c.vencimento) || '—'}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;align-items:center">
          <span style="color:var(--text-secondary)">Status</span>
          <span class="tag ${t.cls}">${t.label}</span></div>
        ${c.valor_pago_centavos ? `
        <div style="display:flex;justify-content:space-between;padding:3px 0">
          <span style="color:var(--text-secondary)">Pago</span>
          <strong>${SC.formatCurrency(c.valor_pago_centavos / 100)}</strong></div>` : ''}
      </div>

      ${temPix ? bloco('Pix', `
        <div id="cob-qr" style="display:flex;justify-content:center;margin-bottom:12px"></div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Pix Copia e Cola</div>
        ${copiavel(c.pix_emv, 'Código Pix')}`) : ''}

      ${c.boleto_digitable ? bloco('Boleto', `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Linha digitável</div>
        ${copiavel(c.boleto_digitable, 'Linha digitável')}
        ${c.boleto_url ? `
          <a href="${_cobEsc(c.boleto_url)}" target="_blank" rel="noopener"
             class="btn btn-secondary btn-sm" style="margin-top:10px">
            <i class="fas fa-file-pdf"></i> Visualizar boleto
          </a>` : ''}`) : ''}

      ${c.ultimo_erro ? `
        <div class="tag tag-red" style="display:block;padding:9px 12px;font-size:12px">
          <i class="fas fa-triangle-exclamation"></i> ${_cobEsc(c.ultimo_erro).slice(0, 200)}
        </div>` : ''}
    </div>
    <div class="modal-footer" style="flex-wrap:wrap;gap:8px">
      ${c.status !== 'paga' && c.status !== 'cancelada' ? `
        <button class="btn btn-danger btn-sm" data-action="cancelar-cobranca"
                data-id="${r.id}" style="margin-right:auto">
          <i class="fas fa-ban"></i> Cancelar cobrança
        </button>` : ''}
      <button class="btn btn-secondary" data-action="whatsapp-cobranca" data-id="${r.id}">
        <i class="fab fa-whatsapp"></i> Enviar pelo WhatsApp
      </button>
      <button class="btn btn-primary" data-action="close-modal">Fechar</button>
    </div>`, 'modal-lg');

  if (temPix) _desenharQR('cob-qr', c.pix_emv);
}

// Gera o QR do Pix. A biblioteca entra sob demanda — carregar mais um script no
// index.html por causa de um modal que quase nunca abre não se paga.
// Se falhar, o copia e cola continua na tela e resolve sozinho.
function _desenharQR(elId, texto) {
  const alvo = document.getElementById(elId);
  if (!alvo) return;

  const desenhar = () => {
    if (typeof QRCode === 'undefined' || !QRCode.toCanvas) return;
    const canvas = document.createElement('canvas');
    alvo.appendChild(canvas);
    QRCode.toCanvas(canvas, texto, { width: 190, margin: 1 }, err => {
      if (err) { alvo.innerHTML = ''; console.warn('QR falhou:', err); }
    });
  };

  if (typeof QRCode !== 'undefined') { desenhar(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
  s.onload = desenhar;
  s.onerror = () => console.warn('QR: biblioteca não carregou; use o copia e cola.');
  document.head.appendChild(s);
}

async function copiarTexto(valor, rotulo) {
  try {
    await navigator.clipboard.writeText(valor);
    showToast(`✅ ${rotulo || 'Texto'} copiado.`, 'success');
  } catch {
    // clipboard exige contexto seguro e permissão; o fallback nunca falha.
    const ta = document.createElement('textarea');
    ta.value = valor; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    showToast(`✅ ${rotulo || 'Texto'} copiado.`, 'success');
  }
}

function cancelarCobrancaConfirm(receivableId) {
  const c = _cobrancaDe(_recPorId(receivableId));
  if (!c) return;
  Modal.confirm(
    'Cancelar esta cobrança na Cora? O boleto deixa de ser pagável. '
    + 'O recebimento continua no sistema e pode receber uma nova cobrança depois.',
    async () => {
      const r = await CoraService.cancelar(c.id);
      if (r.erro) { showToast(r.erro, 'error'); return; }
      if (r.dados?.motivo === 'ja_paga') {
        showToast('Esta cobrança já foi paga — acabei de conciliá-la.', 'warning');
      } else {
        showToast('Cobrança cancelada.', 'success');
        _aplicarCobrancaNoEstado(receivableId, null);
      }
      closeModal();
      _recarregarFinanceiro();
    },
    { title: 'Cancelar cobrança', confirmLabel: 'Cancelar cobrança', danger: true },
  );
}

// Reaproveita o fluxo de WhatsApp que já existe: abre o wa.me numa aba, com a
// mensagem montada. Nada é disparado automaticamente.
function enviarCobrancaWhatsApp(receivableId) {
  const r = _recPorId(receivableId);
  const c = _cobrancaDe(r);
  if (!r) return;

  const tel = (r.client && typeof r.client === 'object' ? r.client.phone : null)
    || SC.clients.find(x => x.id === (r.client_id || r.client))?.phone || '';
  const digitos = String(tel).replace(/\D/g, '');
  if (!digitos) { showToast('Este cliente não tem telefone cadastrado.', 'error'); return; }

  window.open(`https://wa.me/55${digitos}?text=${encodeURIComponent(_msgCobranca(r, c))}`, '_blank');
}

// Mensagem única de cobrança. Antes desta função o texto estava duplicado
// literalmente em receber.js e pagar.js, sem nome do cliente nem valor.
function _msgCobranca(r, cobranca) {
  const nome  = _cobClienteNome(r).split(' ')[0];
  const c     = cobranca || _cobrancaDe(r);
  const valor = SC.formatCurrency(finSaldoAberto(r) || r.value || 0);
  const venc  = formatDateBR(r.due_date || r.due) || '';

  const linhas = [
    `Olá, ${nome}!`, '',
    'Segue sua cobrança referente a:',
    r.description || r.desc || 'serviços prestados', '',
    `Valor: ${valor}`,
    venc ? `Vencimento: ${venc}` : '',
  ];

  if (c?.pix_emv) linhas.push('', 'PIX Copia e Cola:', c.pix_emv);
  if (c?.boleto_url) linhas.push('', 'Boleto:', c.boleto_url);
  else if (c?.boleto_digitable) linhas.push('', 'Linha digitável:', c.boleto_digitable);
  if (!c) linhas.push('', 'Qualquer dúvida, estamos à disposição.');

  return linhas.filter(l => l !== null && l !== undefined).join('\n');
}

// Recarrega os recebíveis do banco e repinta. Usado depois de operações que
// mexem no servidor, para não confiar só no estado local.
async function _recarregarFinanceiro() {
  const dados = await Data.receivables();
  if (Array.isArray(dados)) {
    _recDataAll = dados;
    if (typeof _renderFinContent === 'function') _renderFinContent();
  }
}
