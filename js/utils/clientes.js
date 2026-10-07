// =============================================
// SEJA CREATE — VISIBILIDADE DE CLIENTES
// =============================================
// Cliente inativo polui todo seletor do sistema: ele aparece em Planejamentos,
// Tarefas, Calendário e Dossiê mesmo quando a agência já encerrou o contrato.
// Aqui fica a regra única — esconder os inativos por padrão, com uma chave
// global para revê-los quando precisar.
//
// A preferência é por navegador (localStorage), não por usuário no banco: é
// escolha de visualização, não configuração da empresa.

const _CLI_CHAVE = 'sc-ver-inativos';

const Clientes = {

  verInativos: (() => {
    try { return localStorage.getItem(_CLI_CHAVE) === '1'; } catch { return false; }
  })(),

  alternarInativos() {
    this.verInativos = !this.verInativos;
    try { localStorage.setItem(_CLI_CHAVE, this.verInativos ? '1' : '0'); } catch { /* modo privado */ }
    return this.verInativos;
  },

  ehInativo(c) { return (c?.status || 'ativo') === 'inativo'; },

  quantosInativos(lista) {
    return (lista || SC.clients || []).filter(c => this.ehInativo(c)).length;
  },

  // Lista para exibição. `manterId` é o ponto importante: ao EDITAR um registro
  // cujo cliente foi desativado depois, ele precisa continuar na lista — senão o
  // <select> abre sem o valor atual e salvar apagaria o vínculo em silêncio.
  visiveis(lista, manterId = null) {
    const base = lista || SC.clients || [];
    if (this.verInativos) return base;
    return base.filter(c => !this.ehInativo(c) || String(c.id) === String(manterId));
  },

  // Monta as <option> de um seletor de cliente.
  //   vazio        — rótulo da opção "todos" (omitir para seletor obrigatório)
  //   selecionado  — id atual; entra na lista mesmo se inativo
  opcoes(lista, { vazio = null, selecionado = null } = {}) {
    const itens = this.visiveis(lista, selecionado).map(c => {
      const sel = String(c.id) === String(selecionado) ? ' selected' : '';
      const marca = this.ehInativo(c) ? ' (inativo)' : '';
      return `<option value="${c.id}"${sel}>${_cliEsc(c.name)}${marca}</option>`;
    }).join('');
    const topo = vazio
      ? `<option value=""${selecionado ? '' : ' selected'}>${_cliEsc(vazio)}</option>`
      : '';
    return topo + itens;
  },

  // Chip de alternância. Só aparece quando há inativo para mostrar — um botão
  // que nunca muda nada é ruído.
  chip(lista) {
    const n = this.quantosInativos(lista);
    if (!n) return '';
    const on = this.verInativos;
    return `
      <button class="btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}"
              data-action="toggle-ver-inativos" style="font-size:11px;white-space:nowrap"
              title="${on ? 'Ocultar' : 'Mostrar'} os ${n} cliente(s) inativo(s)">
        <i class="fas fa-eye${on ? '' : '-slash'}"></i> Inativos ${on ? `(${n})` : ''}
      </button>`;
  },
};

function _cliEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Alterna e repinta a tela atual. Router.navigate re-executa a função de render
// da página, então vale para todas sem cada uma precisar saber do botão.
function toggleVerInativos() {
  const agora = Clientes.alternarInativos();
  showToast(agora ? 'Mostrando clientes inativos.' : 'Clientes inativos ocultos.', 'info');
  if (SC.currentPage && typeof Router !== 'undefined') Router.navigate(SC.currentPage);
}
