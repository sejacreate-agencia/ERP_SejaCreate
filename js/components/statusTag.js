// =============================================
// STATUS TAG — Badges e etiquetas de status
// =============================================

const StatusTag = {

  // Tag genérica de status de tarefa (usa SC.statusColor)
  status(s) {
    const c = (typeof SC !== 'undefined') ? SC.statusColor(s) : 'gray';
    return `<span class="tag tag-${c}">${s}</span>`;
  },

  // Tag de prioridade (alta / media / baixa)
  priority(p) {
    const map   = { alta: 'red', media: 'yellow', baixa: 'green' };
    const label = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
    return `<span class="tag tag-${map[p] || 'gray'}">${label[p] || p}</span>`;
  },

  // Tag de nome do cliente (busca pelo id)
  client(id) {
    const name = (typeof SC !== 'undefined') ? SC.getClientName(id) : String(id);
    return `<span style="font-size:12px;color:var(--text-purple)"><i class="fas fa-building" style="font-size:10px;margin-right:4px"></i>${name}</span>`;
  },

  // Tag de status financeiro (pago / pendente / atrasado / cancelado)
  financial(status) {
    const map = {
      pago:      { cls: 'green',  label: '✓ Pago' },
      pendente:  { cls: 'yellow', label: '⏳ Pendente' },
      atrasado:  { cls: 'red',    label: '⚠ Atrasado' },
      cancelado: { cls: 'gray',   label: '✕ Cancelado' },
    };
    const s = (map[status] || { cls: 'gray', label: status });
    return `<span class="tag tag-${s.cls}">${s.label}</span>`;
  },

  // Tag de estágio do CRM
  crmStage(stage) {
    const map = {
      'Lead Novo':         'gray',
      'Contato Iniciado':  'blue',
      'Proposta Enviada':  'purple',
      'Negociação':        'yellow',
      'Fechado':           'green',
      'Perdido':           'red',
    };
    return `<span class="tag tag-${map[stage] || 'gray'}">${stage}</span>`;
  },

  // Tag de status de cliente (ativo / inativo)
  clientStatus(status) {
    return status === 'ativo'
      ? `<span class="tag tag-green">Ativo</span>`
      : `<span class="tag tag-gray">Inativo</span>`;
  },
};

// Aliases de compatibilidade — mantêm chamadas antigas funcionando
function getStatusTag(s)   { return StatusTag.status(s); }
function getPriorityTag(p) { return StatusTag.priority(p); }
function getClientTag(id)  { return StatusTag.client(id); }
