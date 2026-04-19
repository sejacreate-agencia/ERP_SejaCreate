// =============================================
// SEJA CREATE — AVISOS IMPORTANTES
// =============================================

function generateAvisosFromData() {
  if (!isSupabaseReady()) return; // mantém SC.avisos demo intacto em modo demo
  const avisos = [];
  const today = new Date(new Date().toDateString());
  let id = 1;

  // Financeiro: recebíveis em atraso
  (SC.finances.receivable || []).forEach(r => {
    const due = r.due_date || r.due;
    const isAtrasado = r.status === 'atrasado' ||
      (r.status === 'pendente' && due && new Date(due.split('T')[0]) < today);
    if (isAtrasado) {
      const clientName = SC.getClientName(r.client_id || r.client) || 'Cliente';
      avisos.push({
        id: id++, type: 'pagamento-aberto',
        title: `${clientName} — ${r.description || r.desc || 'fatura'} em atraso`,
        priority: 'alta', assignee: null, client: r.client_id || r.client,
        deadline: due, action: 'financeiro', icon: '💸',
      });
    }
  });

  // Tarefas: ajuste solicitado
  (SC.tasks || []).filter(t => t.status === 'Ajuste Solicitado').forEach(t => {
    avisos.push({
      id: id++, type: 'ajuste-solicitado',
      title: `Ajuste solicitado: ${t.title}`,
      priority: 'alta', assignee: t.assignee, client: t.client,
      deadline: t.postDate, action: 'tarefas', icon: '🔄',
    });
  });

  // Tarefas: aguardando aprovação do cliente
  (SC.tasks || []).filter(t => t.status === 'Enviado ao Cliente').forEach(t => {
    avisos.push({
      id: id++, type: 'aprovacao-pendente',
      title: `Aguardando aprovação: ${t.title}`,
      priority: 'media', assignee: t.assignee, client: t.client,
      deadline: t.postDate, action: 'tarefas', icon: '✅',
    });
  });

  // Contratos vencendo nos próximos 30 dias
  (SC.clients || []).forEach(c => {
    if (!c.expiry) return;
    const expiry = new Date(c.expiry);
    const diff = Math.round((expiry - today) / 86400000);
    if (diff >= 0 && diff <= 30) {
      avisos.push({
        id: id++, type: 'contrato-vencendo',
        title: `${c.name} — contrato vence em ${diff} dia${diff !== 1 ? 's' : ''}`,
        priority: diff <= 7 ? 'alta' : 'media', assignee: null, client: c.id,
        deadline: c.expiry, action: 'cadastro', icon: '📋',
      });
    }
  });

  SC.avisos = avisos;
}

function renderAvisos() {
  generateAvisosFromData();
  const types = [
    { value: '', label: 'Todos os tipos' },
    { value: 'tarefa-vencida', label: 'Tarefas Vencidas' },
    { value: 'aprovacao-pendente', label: 'Aprovações Pendentes' },
    { value: 'ajuste-solicitado', label: 'Ajustes Solicitados' },
    { value: 'sem-retorno', label: 'Sem Retorno' },
    { value: 'pagamento-aberto', label: 'Pagamentos em Aberto' },
    { value: 'contrato-vencendo', label: 'Contratos Vencendo' },
    { value: 'post-sem-programa', label: 'Posts sem Programação' },
  ];

  const priorities = ['', 'alta', 'media', 'baixa'];

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">⚠️ Avisos Importantes</h1>
          <p class="page-subtitle">Central de pendências operacionais da agência — ${SC.avisos.length} avisos ativos</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="refresh-avisos"><i class="fas fa-sync"></i> Atualizar</button>
        </div>
      </div>
    </div>

    <!-- SUMMARY CHIPS -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <div class="tag tag-red" style="padding:8px 14px;font-size:13px">
        <i class="fas fa-exclamation-circle"></i> ${SC.avisos.filter(a=>a.priority==='alta').length} Urgentes
      </div>
      <div class="tag tag-yellow" style="padding:8px 14px;font-size:13px">
        <i class="fas fa-exclamation-triangle"></i> ${SC.avisos.filter(a=>a.priority==='media').length} Médias
      </div>
      <div class="tag tag-green" style="padding:8px 14px;font-size:13px">
        <i class="fas fa-info-circle"></i> ${SC.avisos.filter(a=>a.priority==='baixa').length} Baixas
      </div>
    </div>

    <!-- FILTERS -->
    <div class="filters-bar">
      <span class="filter-label">Filtrar por:</span>
      <select class="filter-select" id="aviso-type-filter" onchange="filterAvisos()">
        ${types.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
      </select>
      <select class="filter-select" id="aviso-priority-filter" onchange="filterAvisos()">
        <option value="">Todas as prioridades</option>
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa">Baixa</option>
      </select>
      <select class="filter-select" id="aviso-client-filter" onchange="filterAvisos()">
        <option value="">Todos os clientes</option>
        ${SC.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>

    <!-- AVISOS LIST -->
    <div id="avisos-list">
      ${renderAvisosList(SC.avisos)}
    </div>
  `;
}

function renderAvisosList(avisos) {
  if (!avisos.length) {
    return `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success)"></i><p>Nenhum aviso encontrado!</p></div>`;
  }

  // Sort: alta > media > baixa
  const order = { alta: 0, media: 1, baixa: 2 };
  const sorted = [...avisos].sort((a, b) => order[a.priority] - order[b.priority]);

  return sorted.map(a => {
    const clientName = SC.getClientName(a.client);
    const assigneeName = SC.getEmployeeName(a.assignee);
    const prioClass = `priority-${a.priority}`;
    const deadline = a.deadline ? SC.formatDate(a.deadline) : 'Sem prazo';
    const isUrgent = a.priority === 'alta';
    const borderColor = isUrgent ? 'var(--danger)' : a.priority === 'media' ? 'var(--warning)' : 'var(--success)';

    const actionLabels = {
      tarefas: '<i class="fas fa-columns"></i> Ver Tarefa',
      crm: '<i class="fas fa-funnel-dollar"></i> Ver CRM',
      financeiro: '<i class="fas fa-dollar-sign"></i> Ver Financeiro',
      cadastro: '<i class="fas fa-address-book"></i> Ver Cadastro',
    };

    return `
      <div class="alert-card" style="border-left:3px solid ${borderColor}">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-body">
          <div class="alert-title">${a.title}</div>
          <div class="alert-meta">
            <i class="fas fa-building" style="font-size:11px"></i> ${clientName} &nbsp;·&nbsp;
            <i class="fas fa-user" style="font-size:11px"></i> ${assigneeName} &nbsp;·&nbsp;
            <i class="fas fa-calendar" style="font-size:11px"></i> Prazo: ${deadline}
          </div>
          <div class="alert-actions">
            <button class="btn btn-sm btn-primary" data-action="navigate" data-page="${a.action}">
              ${actionLabels[a.action] || 'Ver detalhe'}
            </button>
            <button class="btn btn-sm btn-secondary" data-action="resolve-aviso" data-id="${a.id}">
              <i class="fas fa-check"></i> Resolver
            </button>
            <button class="btn btn-sm btn-ghost" data-action="snooze-aviso" data-id="${a.id}">
              <i class="fas fa-clock"></i> Adiar
            </button>
          </div>
        </div>
        <div>
          <span class="alert-priority ${prioClass}">${a.priority.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterAvisos() {
  const type = document.getElementById('aviso-type-filter').value;
  const priority = document.getElementById('aviso-priority-filter').value;
  const client = document.getElementById('aviso-client-filter').value;

  let filtered = SC.avisos;
  if (type) filtered = filtered.filter(a => a.type === type);
  if (priority) filtered = filtered.filter(a => a.priority === priority);
  if (client) filtered = filtered.filter(a => String(a.client) === String(client));

  document.getElementById('avisos-list').innerHTML = renderAvisosList(filtered);
}

function resolveAviso(id) {
  const idx = SC.avisos.findIndex(a => a.id === id);
  if (idx > -1) {
    SC.avisos.splice(idx, 1);
    document.getElementById('badge-avisos').textContent = SC.avisos.length;
    showToast('Aviso marcado como resolvido!', 'success');
    filterAvisos();
  }
}

function snoozeAviso(id) {
  showToast('Aviso adiado para amanhã.', 'info');
}

Router.register('avisos', renderAvisos, 'Avisos Importantes');
