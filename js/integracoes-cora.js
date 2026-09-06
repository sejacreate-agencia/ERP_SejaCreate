// =============================================
// SEJA CREATE — INTEGRAÇÕES > CORA
// =============================================
// Status da conexão e os padrões de cobrança. Nenhum segredo passa por aqui: a
// ação `status` da Edge Function devolve só metadado, e as tabelas de
// credencial são deny-all no banco.

let _coraStatus = null;
let _coraCfg    = null;

// Router.navigate é SÍNCRONO (js/core/router.js:47): o esqueleto tem que ser
// pintado ANTES de qualquer await, senão a tela fica em branco.
function renderIntegracoesCora() {
  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Cora</h1>
          <p class="page-subtitle">
            Automatize suas cobranças e concilie os pagamentos do Seja Create.
          </p>
        </div>
      </div>
    </div>
    <div id="cora-corpo">
      <div class="loading-state" style="padding:40px;text-align:center;color:var(--text-muted)">
        <i class="fas fa-spinner fa-spin"></i> Consultando a integração...
      </div>
    </div>`;
  setTimeout(_coraHidratar, 0);
}

const _CORA_ESTADOS = {
  nao_configurado: { cls: 'tag-gray',   dot: 'var(--text-muted)', label: 'Não configurado' },
  conectado:       { cls: 'tag-green',  dot: 'var(--success)',    label: 'Conectado' },
  expirado:        { cls: 'tag-yellow', dot: 'var(--warning)',    label: 'Credencial expirada' },
  erro:            { cls: 'tag-red',    dot: 'var(--danger)',     label: 'Erro' },
  desconectado:    { cls: 'tag-gray',   dot: 'var(--text-muted)', label: 'Desconectado' },
};

async function _coraHidratar() {
  const alvo = document.getElementById('cora-corpo');
  // A página pode ter trocado entre o render e o timeout.
  if (!alvo) return;

  const [st, cfg] = await Promise.all([
    CoraService.status(),
    DB.chargeSettings.get(),
  ]);

  if (st.erro && st.codigo !== 'nao_conectado') {
    _coraStatus = { configurada: false, status: 'nao_configurado', erro: st.erro };
  } else {
    _coraStatus = st.dados || { configurada: false, status: 'nao_configurado' };
  }
  _coraCfg = cfg?.data || null;

  alvo.innerHTML = _coraStatusHtml() + _coraConfigHtml();
}

function _coraStatusHtml() {
  const s = _coraStatus || {};
  const estado = _CORA_ESTADOS[s.status] || _CORA_ESTADOS.nao_configurado;
  const admin = SC.currentUser?.role === 'admin';

  // Sem client_id/secret no servidor não adianta mostrar botão de conectar.
  if (!s.configurada) {
    return `
      <div class="card" style="margin-bottom:18px">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-plug"></i> Status da integração</span>
          <span class="tag tag-gray">Não configurado</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
          As credenciais da Cora ainda não foram cadastradas no servidor. É preciso
          pedir a <strong>Parceria Cora</strong> no painel da conta e configurar o
          <code>client_id</code> e o <code>client_secret</code>.
        </p>
        <p style="font-size:12px;color:var(--text-muted)">
          Passo a passo em <code>docs/cora-setup.md</code>.
        </p>
      </div>`;
  }

  const linha = (rotulo, valor) => valor
    ? `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;
                   border-bottom:1px solid var(--border-light);font-size:13px">
         <span style="color:var(--text-secondary)">${rotulo}</span>
         <strong style="text-align:right">${_coraEsc(String(valor))}</strong>
       </div>`
    : '';

  // A sessão da Cora morre com 60 dias de inatividade. Avisar aos 45 dá tempo
  // de reconectar sem descobrir na hora de emitir um boleto.
  const dias = s.dias_desde_refresh;
  const alertaSessao = (s.status === 'conectado' && dias != null && dias >= 45)
    ? `<div class="tag tag-yellow" style="display:block;padding:9px 12px;margin-bottom:12px;font-size:12px">
         <i class="fas fa-clock"></i> Sem uso há ${dias} dias. A conexão da Cora
         expira com 60 dias de inatividade — reconecte antes disso.
       </div>` : '';

  return `
    <div class="card" style="margin-bottom:18px">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-plug"></i> Status da integração</span>
        <span class="tag ${estado.cls}">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                       background:${estado.dot};margin-right:5px"></span>${estado.label}
        </span>
      </div>

      ${alertaSessao}
      ${s.ultimo_erro ? `
        <div class="tag tag-red" style="display:block;padding:9px 12px;margin-bottom:12px;font-size:12px">
          <i class="fas fa-triangle-exclamation"></i> ${_coraEsc(s.ultimo_erro).slice(0, 200)}
        </div>` : ''}

      <div style="margin-bottom:14px">
        ${linha('Ambiente', s.ambiente === 'producao' ? 'Produção' : 'Sandbox (stage)')}
        ${linha('Conta', s.conta_nome)}
        ${linha('CNPJ', s.conta_documento)}
        ${linha('Conectado em', s.conectado_em ? formatDateBR(s.conectado_em) : null)}
        ${linha('Última sincronização', s.ultimo_refresh_em ? formatDateBR(s.ultimo_refresh_em) : null)}
        ${linha('Cobranças em aberto', s.cobrancas_abertas)}
        <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px">
          <span style="color:var(--text-secondary)">Webhook</span>
          <span class="tag ${s.webhook_registrado ? 'tag-green' : 'tag-yellow'}">
            ${s.webhook_registrado ? 'Registrado' : 'Não registrado'}
          </span>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${!s.conectado ? `
          <button class="btn btn-primary" data-action="cora-conectar" ${admin ? '' : 'disabled'}>
            <i class="fas fa-link"></i> Conectar Cora
          </button>` : ''}
        <button class="btn btn-secondary" data-action="cora-testar" ${admin ? '' : 'disabled'}>
          <i class="fas fa-vial"></i> Testar conexão
        </button>
        <button class="btn btn-secondary" data-action="cora-sincronizar">
          <i class="fas fa-rotate"></i> Sincronizar
        </button>
        ${s.conectado && !s.webhook_registrado ? `
          <button class="btn btn-secondary" data-action="cora-registrar-webhook" ${admin ? '' : 'disabled'}>
            <i class="fas fa-satellite-dish"></i> Registrar webhook
          </button>` : ''}
        ${s.conectado ? `
          <button class="btn btn-danger" data-action="cora-desconectar" ${admin ? '' : 'disabled'}
                  style="margin-left:auto">
            <i class="fas fa-unlink"></i> Desconectar
          </button>` : ''}
      </div>
      ${admin ? '' : `
        <p style="font-size:11px;color:var(--text-muted);margin-top:10px">
          Conectar e desconectar são ações de administrador.
        </p>`}
    </div>`;
}

function _coraConfigHtml() {
  const c = _coraCfg;
  const admin = SC.currentUser?.role === 'admin';
  if (!c) {
    return `
      <div class="card">
        <div class="card-header"><span class="card-title">Configurações de cobrança</span></div>
        <div class="empty-state" style="padding:24px">
          <i class="fas fa-sliders"></i>
          <p style="margin-top:8px;font-size:13px">
            ${isSupabaseReady()
              ? 'Rode a <code>supabase-migration-027.sql</code> para liberar as configurações.'
              : 'Disponível apenas na versão conectada ao Supabase.'}
          </p>
        </div>
      </div>`;
  }

  const check = (id, campo, rotulo, dica) => `
    <label style="display:flex;gap:9px;align-items:flex-start;padding:8px 0;cursor:pointer">
      <input type="checkbox" id="${id}" ${c[campo] ? 'checked' : ''} ${admin ? '' : 'disabled'}
             style="margin-top:2px;flex-shrink:0">
      <span>
        <span style="font-size:13px">${rotulo}</span>
        ${dica ? `<span style="display:block;font-size:11px;color:var(--text-muted)">${dica}</span>` : ''}
      </span>
    </label>`;

  const num = (id, campo, rotulo, sufixo, passo = '0.01') => `
    <div class="form-col">
      <label>${rotulo}</label>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" class="input-field" id="${id}" step="${passo}" min="0"
               value="${c[campo] ?? 0}" ${admin ? '' : 'disabled'}>
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${sufixo}</span>
      </div>
    </div>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-sliders"></i> Configurações de cobrança</span>
        ${admin ? `
          <button class="btn btn-primary btn-sm" data-action="cora-salvar-config">
            <i class="fas fa-check"></i> Salvar
          </button>` : '<span class="tag tag-gray">Somente leitura</span>'}
      </div>

      <div class="form-row">
        <div class="form-col">
          ${check('cs-boleto', 'gerar_boleto', 'Gerar boleto')}
          ${check('cs-pix', 'gerar_pix', 'Gerar QR Code Pix')}
          ${check('cs-copiacola', 'incluir_pix_copia_cola', 'Incluir Pix Copia e Cola')}
          ${check('cs-multa', 'aplicar_multa', 'Aplicar multa')}
          ${check('cs-juros', 'aplicar_juros', 'Aplicar juros')}
        </div>
        <div class="form-col">
          ${check('cs-desconto', 'aplicar_desconto', 'Aplicar desconto')}
          ${check('cs-enviar', 'enviar_apos_geracao', 'Enviar cobrança automaticamente após gerar',
                  'Abre o WhatsApp com a mensagem pronta assim que a cobrança sai')}
          ${check('cs-baixar', 'baixar_automatico', 'Baixar recebimento após confirmação de pagamento',
                  'Desligado, o pagamento fica registrado na cobrança mas o recebimento espera baixa manual')}
        </div>
      </div>

      <div class="form-row" style="margin-top:8px">
        ${num('cs-multa-pct', 'multa_percentual', 'Multa padrão', '%')}
        ${num('cs-juros-pct', 'juros_percentual_mes', 'Juros padrão', '% ao mês')}
        ${num('cs-desc-pct', 'desconto_percentual', 'Desconto padrão', '%')}
      </div>
      <div class="form-row">
        ${num('cs-desc-dias', 'desconto_dias', 'Dias para desconto', 'dias antes do vencimento', '1')}
        ${num('cs-cancel-dias', 'dias_cancelamento', 'Cancelar após vencimento', 'dias (0 = nunca)', '1')}
      </div>

      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.6">
        A multa é configurada em <strong>percentual</strong> e convertida para centavos
        no momento de gerar a cobrança, que é o formato que a API da Cora aceita.
        Os juros vão como percentual ao mês.
      </p>
    </div>`;
}

function _coraEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── AÇÕES ────────────────────────────────────
async function coraConectar() {
  showToast('Redirecionando para a Cora...', 'info');
  const r = await CoraService.conectar();
  if (r.erro) showToast(r.erro, 'error');
}

async function coraTestar() {
  showToast('Testando...', 'info');
  const r = await CoraService.testar();
  showToast(r.erro || '✅ Conexão com a Cora funcionando.', r.erro ? 'error' : 'success');
  _coraHidratar();
}

async function coraRegistrarWebhook() {
  const r = await CoraService.registrarWebhook();
  showToast(r.erro || '✅ Webhook registrado na Cora.', r.erro ? 'error' : 'success');
  _coraHidratar();
}

// Rede de segurança para quando o webhook não chegar: consulta as cobranças
// ainda abertas e concilia o que mudou.
async function coraSincronizar() {
  showToast('Conferindo cobranças em aberto...', 'info');
  const r = await CoraService.reconciliar(25);
  if (r.erro) { showToast(r.erro, 'error'); return; }
  const n = r.dados?.conferidas ?? 0;
  showToast(n ? `✅ ${n} cobrança(s) conferida(s).` : 'Nenhuma cobrança em aberto.', 'success');
  _coraHidratar();
}

function coraDesconectar() {
  Modal.confirm(
    'Desconectar a conta da Cora? As cobranças já emitidas continuam valendo, '
    + 'mas o ERP deixa de gerar novas e de receber a baixa automática.',
    async () => {
      const r = await CoraService.desconectar();
      showToast(r.erro || 'Conta desconectada.', r.erro ? 'error' : 'success');
      _coraHidratar();
    },
    { title: 'Desconectar Cora', confirmLabel: 'Desconectar', danger: true },
  );
}

async function coraSalvarConfig() {
  const v   = id => document.getElementById(id);
  const chk = id => !!v(id)?.checked;
  const nm  = id => Number(v(id)?.value) || 0;

  const payload = {
    gerar_boleto:           chk('cs-boleto'),
    gerar_pix:              chk('cs-pix'),
    incluir_pix_copia_cola: chk('cs-copiacola'),
    aplicar_multa:          chk('cs-multa'),
    aplicar_juros:          chk('cs-juros'),
    aplicar_desconto:       chk('cs-desconto'),
    enviar_apos_geracao:    chk('cs-enviar'),
    baixar_automatico:      chk('cs-baixar'),
    multa_percentual:       nm('cs-multa-pct'),
    juros_percentual_mes:   nm('cs-juros-pct'),
    desconto_percentual:    nm('cs-desc-pct'),
    desconto_dias:          nm('cs-desc-dias'),
    dias_cancelamento:      nm('cs-cancel-dias'),
  };

  if (!payload.gerar_boleto && !payload.gerar_pix) {
    showToast('Escolha pelo menos uma forma de pagamento.', 'error');
    return;
  }

  const { error } = await DB.chargeSettings.salvar(_coraCfg.org_id, payload);
  if (error) { showToast(`Não foi possível salvar: ${error.message}`, 'error'); return; }
  showToast('✅ Configurações salvas.', 'success');
  _coraHidratar();
}

Router.register('integracoes-cora', renderIntegracoesCora, 'Integrações · Cora');
