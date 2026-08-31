// =============================================
// GOOGLE CALENDAR SERVICE
// =============================================
// Fala com a Edge Function 'gcal'. Nenhuma credencial do Google encosta no
// navegador — ao contrário do metaService.js, que guarda page_token em
// localStorage e chama a Graph API direto daqui.

const GoogleCalendarService = {

  // Códigos de erro da Edge Function traduzidos, no mesmo espírito do
  // mapa de sendApprovalWhatsApp (js/tarefas.js).
  _msgs: {
    google_nao_configurado:  'Integração com o Google ainda não configurada no servidor.',
    agenda_nao_configurada:  'Você ainda não conectou sua agenda. Vá em Configurações → Integrações.',
    agenda_nao_compartilhada:'A conta de serviço não tem acesso a essa agenda. Confira o compartilhamento no Google Agenda.',
    calendar_id_required:    'Informe o e-mail da sua agenda do Google.',
    dia_invalido:            'Data inválida.',
    hora_invalida:           'Horário inválido.',
    fim_antes_do_inicio:     'O horário final precisa ser depois do inicial.',
    titulo_required:         'Dê um título ao compromisso.',
    unauthorized:            'Sessão expirada. Entre novamente.',
    google_auth_failed:      'Falha ao autenticar no Google. Confira a chave da conta de serviço.',
    google_api_failed:       'O Google recusou a chamada. Tente de novo em instantes.',
  },

  _traduz(codigo, detalhe) {
    const base = this._msgs[codigo] || `Erro: ${codigo}`;
    return detalhe ? `${base} (${detalhe})` : base;
  },

  async _chamar(corpo) {
    if (!isSupabaseReady()) {
      return { erro: 'Disponível apenas na versão conectada ao Supabase.' };
    }
    const { data, error } = await supabaseClient.functions.invoke('gcal', { body: corpo });

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

  async status()                 { return this._chamar({ acao: 'status' }); },
  async verificar(calendarId)    { return this._chamar({ acao: 'verificar', calendar_id: calendarId }); },
  async listar(dia)              { return this._chamar({ acao: 'listar', dia }); },
  async desconectar()            { return this._chamar({ acao: 'desconectar' }); },

  async criar({ titulo, dia, horaInicio, horaFim, descricao }) {
    return this._chamar({
      acao: 'criar',
      titulo, dia,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      descricao,
    });
  },
};
