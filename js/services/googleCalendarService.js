// =============================================
// GOOGLE CALENDAR SERVICE
// =============================================
// Fala com as Edge Functions 'gcal' e 'google-oauth-start'. Nenhum token do
// Google encosta no navegador — ao contrário do metaService.js, que guarda
// page_token em localStorage e chama a API direto daqui.

const GoogleCalendarService = {

  _msgs: {
    google_nao_configurado: 'Integração com o Google ainda não configurada no servidor.',
    nao_conectado:          'Conecte sua conta do Google para ver seus compromissos.',
    reautorizar:            'Sua conexão com o Google expirou. Conecte novamente.',
    dia_invalido:           'Data inválida.',
    hora_invalida:          'Horário inválido.',
    fim_antes_do_inicio:    'O horário final precisa ser depois do inicial.',
    titulo_required:        'Dê um título ao compromisso.',
    unauthorized:           'Sessão expirada. Entre novamente.',
    google_auth_failed:     'Falha ao autenticar no Google.',
    google_api_failed:      'O Google recusou a chamada. Tente de novo em instantes.',
    state_falhou:           'Não foi possível iniciar a conexão. Tente de novo.',
  },

  _traduz(codigo, detalhe) {
    const base = this._msgs[codigo] || `Erro: ${codigo}`;
    return detalhe ? `${base} (${detalhe})` : base;
  },

  async _chamar(funcao, corpo) {
    if (!isSupabaseReady()) {
      return { erro: 'Disponível apenas na versão conectada ao Supabase.' };
    }
    const { data, error } = await supabaseClient.functions.invoke(funcao, { body: corpo });

    // Erro HTTP da function: o corpo com o código vem em error.context
    if (error) {
      let codigo = 'google_api_failed', detalhe = null;
      try {
        const j = await error.context?.json?.();
        if (j?.error) { codigo = j.error; detalhe = j.detalhe; }
      } catch { /* corpo não-JSON: fica no código genérico */ }
      return { erro: this._traduz(codigo, detalhe), codigo };
    }
    if (data?.error) return { erro: this._traduz(data.error, data.detalhe), codigo: data.error };
    return { dados: data };
  },

  // Leva o usuário para a tela de consentimento do Google.
  // Navegação de página inteira, e não popup: num PWA em tela cheia no iOS o
  // popup abre fora do app e perde o vínculo com a janela de origem.
  async conectar() {
    const r = await this._chamar('google-oauth-start', {});
    if (r.erro) return r;
    window.location.href = r.dados.auth_url;
    return r;
  },

  async status()      { return this._chamar('gcal', { acao: 'status' }); },
  async listar(dia)   { return this._chamar('gcal', { acao: 'listar', dia }); },
  async desconectar() { return this._chamar('gcal', { acao: 'desconectar' }); },

  async criar({ titulo, dia, horaInicio, horaFim, descricao }) {
    return this._chamar('gcal', {
      acao: 'criar', titulo, dia,
      hora_inicio: horaInicio, hora_fim: horaFim, descricao,
    });
  },

  // Lê o ?google=ok|erro com que o callback devolve o usuário ao app.
  // Chamado no boot, depois do fluxo de recuperação de senha.
  tratarRetorno() {
    const p = new URLSearchParams(window.location.search);
    const st = p.get('google');
    if (!st) return;

    if (st === 'ok') {
      showToast('✅ Google Agenda conectado!', 'success');
    } else {
      const motivos = {
        access_denied:      'Você cancelou a autorização no Google.',
        state_invalido:     'O link de conexão expirou. Tente conectar de novo.',
        sem_refresh_token:  'O Google não devolveu autorização de longo prazo. Tente novamente.',
        troca_falhou:       'Falha ao concluir a conexão com o Google.',
      };
      showToast(motivos[p.get('motivo')] || 'Não foi possível conectar ao Google.', 'error');
    }

    // Tira os parâmetros da URL: o supabase-js roda com detectSessionInUrl e
    // fica inspecionando a query no boot.
    history.replaceState({}, '', window.location.pathname);
  },
};
