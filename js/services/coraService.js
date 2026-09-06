// =============================================
// CORA SERVICE
// =============================================
// Fala com as Edge Functions 'cora' e 'cora-oauth-start'. Nenhum token da Cora
// encosta no navegador: as tabelas de credencial são deny-all e a única coisa
// que a ação `status` devolve é metadado (ambiente, conectado, último erro).
//
// Espelha o GoogleCalendarService — mesmo _chamar, mesmo contrato de retorno
// { dados } ou { erro, codigo }, e nunca lança.

const CoraService = {

  _msgs: {
    cora_nao_configurada:  'A integração com a Cora ainda não foi configurada no servidor.',
    nao_conectado:         'Conecte a conta da Cora para gerar cobranças.',
    reautorizar:           'A conexão com a Cora expirou. Conecte novamente.',
    sem_permissao:         'Seu perfil não tem permissão para esta ação.',
    unauthorized:          'Sessão expirada. Entre novamente.',
    state_falhou:          'Não foi possível iniciar a conexão. Tente de novo.',
    webhook_sem_token:     'Falta configurar o CORA_WEBHOOK_TOKEN no servidor.',

    receivable_id_obrigatorio: 'Recebimento não informado.',
    recebivel_nao_encontrado:  'Recebimento não encontrado.',
    recebivel_cancelado:       'Este recebimento está cancelado.',
    recebivel_ja_pago:         'Este recebimento já está pago.',
    valor_invalido:            'O valor precisa ser maior que zero.',
    sem_vencimento:            'Informe a data de vencimento antes de gerar a cobrança.',
    cliente_incompleto:        'Faltam dados do cliente para gerar a cobrança.',
    cobranca_ja_existe:        'Este recebimento já possui uma cobrança Cora.',
    cobranca_nao_encontrada:   'Cobrança não encontrada.',
    gravacao_falhou:           'Não foi possível salvar a cobrança.',

    cora_api_falhou:       'Não foi possível falar com a Cora. Tente de novo em instantes.',
    token_falhou:          'A Cora recusou as credenciais do servidor.',
    acao_desconhecida:     'Ação desconhecida.',
  },

  _traduz(codigo, detalhe) {
    const base = this._msgs[codigo] || `Não foi possível concluir (${codigo}).`;
    // O detalhe traz corpo cru de HTTP da Cora — útil no console, nunca na tela.
    if (detalhe) console.warn('CoraService:', codigo, detalhe);
    return base;
  },

  async _chamar(funcao, corpo) {
    if (!isSupabaseReady()) {
      return { erro: 'Disponível apenas na versão conectada ao Supabase.' };
    }
    const { data, error } = await supabaseClient.functions.invoke(funcao, { body: corpo });

    if (error) {
      let codigo = 'cora_api_falhou', detalhe = null, extra = null;
      try {
        const j = await error.context?.json?.();
        if (j?.error) { codigo = j.error; detalhe = j.detalhe; extra = j; }
      } catch { /* corpo não-JSON: fica no código genérico */ }
      return { erro: this._traduz(codigo, detalhe), codigo, extra };
    }
    if (data?.error) {
      return { erro: this._traduz(data.error, data.detalhe), codigo: data.error, extra: data };
    }
    return { dados: data };
  },

  // Navegação de página inteira, não popup — mesmo motivo do Google: num PWA
  // em tela cheia no iOS o popup abre fora do app.
  async conectar() {
    const r = await this._chamar('cora-oauth-start', {});
    if (r.erro) return r;
    window.location.href = r.dados.auth_url;
    return r;
  },

  async status()            { return this._chamar('cora', { acao: 'status' }); },
  async testar()            { return this._chamar('cora', { acao: 'testar_conexao' }); },
  async registrarWebhook()  { return this._chamar('cora', { acao: 'registrar_webhook' }); },
  async desconectar()       { return this._chamar('cora', { acao: 'desconectar' }); },
  async eventos(limite)     { return this._chamar('cora', { acao: 'eventos', limite }); },

  async emitir(receivableId, opcoes = {}) {
    return this._chamar('cora', {
      acao: 'emitir',
      receivable_id: receivableId,
      formas: opcoes.formas,
      multa_centavos: opcoes.multaCentavos,
      juros_percentual: opcoes.jurosPercentual,
      desconto_percentual: opcoes.descontoPercentual,
    });
  },

  async consultar(chargeId)  { return this._chamar('cora', { acao: 'consultar', charge_id: chargeId }); },
  async cancelar(chargeId)   { return this._chamar('cora', { acao: 'cancelar',  charge_id: chargeId }); },
  async reconciliar(limite)  { return this._chamar('cora', { acao: 'reconciliar', limite }); },

  // Lê o ?cora=ok|erro com que o callback devolve o usuário ao app.
  tratarRetorno() {
    const p = new URLSearchParams(window.location.search);
    const st = p.get('cora');
    if (!st) return;

    if (st === 'ok') {
      showToast('✅ Conta da Cora conectada!', 'success');
    } else {
      const motivos = {
        access_denied:     'Você cancelou a autorização na Cora.',
        state_invalido:    'O link de conexão expirou. Tente conectar de novo.',
        sem_refresh_token: 'A Cora não devolveu autorização de longo prazo. Tente novamente.',
        troca_falhou:      'Falha ao concluir a conexão com a Cora.',
        gravacao_falhou:   'A conexão foi autorizada, mas não foi possível salvá-la.',
      };
      showToast(motivos[p.get('motivo')] || 'Não foi possível conectar à Cora.', 'error');
    }

    // O supabase-js roda com detectSessionInUrl e inspeciona a query no boot.
    history.replaceState({}, '', window.location.pathname);
  },
};
