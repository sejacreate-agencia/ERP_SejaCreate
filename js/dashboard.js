// =============================================
// SEJA CREATE — DASHBOARD (com permissões)
// =============================================

function renderDashboard() {
  const u = SC.currentUser;
  if (!u) return;

  const hasFinanceiro = SC.hasPermission('financeiro');
  const myTasks = SC.getUserTasks(u.id);
  const overdueTasks = SC.tasks.filter(t => SC.isOverdue(t.postDate) && t.status !== 'Publicado');
  const pendingApproval = SC.tasks.filter(t => t.status === 'Enviado ao Cliente' || t.status === 'Aprovação Interna');
  const scheduled = SC.tasks.filter(t => t.status === 'Programado' || t.status === 'Aprovado');
  const done = SC.tasks.filter(t => t.status === 'Publicado');
  const pending = SC.finances.receivable.filter(r => r.status !== 'pago');
  const activeClients = SC.clients.filter(c => c.status === 'ativo').length;
  const inProgress = SC.tasks.filter(t => t.status !== 'Publicado').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // KPIs comuns a todos
  const commonKPIs = `
    <div class="kpi-card" data-action="navigate" data-page="cadastro" style="cursor:pointer">
      <div class="kpi-icon purple"><i class="fas fa-users"></i></div>
      <div class="kpi-value">${activeClients}</div>
      <div class="kpi-label">Clientes Ativos</div>
      <div class="kpi-change up"><i class="fas fa-arrow-up"></i> +2 este mês</div>
    </div>
    <div class="kpi-card" data-action="navigate" data-page="tarefas" style="cursor:pointer">
      <div class="kpi-icon blue"><i class="fas fa-tasks"></i></div>
      <div class="kpi-value">${inProgress}</div>
      <div class="kpi-label">Tarefas em Andamento</div>
      <div class="kpi-change up"><i class="fas fa-arrow-up"></i> 3 novas hoje</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
      <div class="kpi-value">${done.length}</div>
      <div class="kpi-label">Tarefas Concluídas</div>
      <div class="kpi-change up"><i class="fas fa-arrow-up"></i> +85% vs mês ant.</div>
    </div>
    <div class="kpi-card" data-action="navigate" data-page="tarefas" style="cursor:pointer">
      <div class="kpi-icon yellow"><i class="fas fa-hourglass-half"></i></div>
      <div class="kpi-value">${pendingApproval.length}</div>
      <div class="kpi-label">Aguardando Aprovação</div>
      <div class="kpi-change down"><i class="fas fa-exclamation-triangle"></i> Ação necessária</div>
    </div>
    <div class="kpi-card" data-action="navigate" data-page="calendario" style="cursor:pointer">
      <div class="kpi-icon purple"><i class="fas fa-calendar-check"></i></div>
      <div class="kpi-value">${scheduled.length}</div>
      <div class="kpi-label">Posts Programados</div>
      <div class="kpi-change up"><i class="fas fa-calendar"></i> Esta semana</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon green"><i class="fas fa-shipping-fast"></i></div>
      <div class="kpi-value">${done.length}</div>
      <div class="kpi-label">Entregas Concluídas</div>
      <div class="kpi-change up"><i class="fas fa-star"></i> Este mês</div>
    </div>
  `;

  // KPIs financeiros — só para quem tem permissão
  const finKPIs = hasFinanceiro ? `
    <div class="kpi-card" data-action="navigate" data-page="financeiro" style="cursor:pointer">
      <div class="kpi-icon green"><i class="fas fa-dollar-sign"></i></div>
      <div class="kpi-value" style="font-size:18px">R$ 27.100</div>
      <div class="kpi-label">Faturamento do Mês</div>
      <div class="kpi-change up"><i class="fas fa-arrow-up"></i> +14,8% vs fev</div>
    </div>
    <div class="kpi-card" data-action="navigate" data-page="financeiro" style="cursor:pointer">
      <div class="kpi-icon yellow"><i class="fas fa-file-invoice-dollar"></i></div>
      <div class="kpi-value" style="font-size:18px">${SC.formatCurrency(pending.reduce((a,r)=>a+r.value,0))}</div>
      <div class="kpi-label">Contas a Receber</div>
      <div class="kpi-change down"><i class="fas fa-clock"></i> ${pending.length} faturas</div>
    </div>
  ` : '';

  // Insights — filtrado por permissão
  const finInsights = hasFinanceiro ? `
    <div class="insight-box" style="border-color:var(--danger-subtle)">
      <span class="insight-icon" style="color:var(--danger)">💸</span>
      <div class="insight-text"><strong>1 fatura atrasada</strong> <span>— Café Aroma precisa de cobrança</span></div>
    </div>
  ` : '';

  document.getElementById('page-content').innerHTML = `
    <!-- HEADER -->
    <div class="page-header">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">${greeting}, ${u.name.split(' ')[0]}! 👋</h1>
          <p class="page-subtitle">Aqui está o resumo da sua operação — ${new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="navigate" data-page="tarefas"><i class="fas fa-columns"></i> Ver Quadro</button>
          <button class="btn btn-primary" data-action="show-new-task-modal"><i class="fas fa-plus"></i> Nova Tarefa</button>
        </div>
      </div>
    </div>

    ${!hasFinanceiro ? `
    <div style="background:var(--warning-subtle);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:10px 16px;margin-bottom:16px;font-size:12px;color:var(--warning);display:flex;align-items:center;gap:8px">
      <i class="fas fa-info-circle"></i>
      Seu perfil não tem acesso a informações financeiras. Alguns indicadores estão ocultos.
    </div>` : ''}

    <!-- KPIs -->
    <div class="kpi-grid">
      ${commonKPIs}
      ${finKPIs}
    </div>

    <!-- INSIGHTS + MY TASKS -->
    <div class="two-col-layout">

      <!-- LEFT: MY TASKS -->
      <div>
        <div class="section-block">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h3 class="section-title" style="margin:0">Minhas Tarefas</h3>
            <button class="btn btn-ghost btn-sm" data-action="navigate" data-page="tarefas">Ver todas <i class="fas fa-arrow-right"></i></button>
          </div>
          <div id="my-tasks-list">
            ${myTasks.length
              ? myTasks.slice(0,4).map(t => renderTaskCard(t)).join('')
              : `<div class="empty-state" style="padding:24px"><i class="fas fa-check-circle"></i><p>Nenhuma tarefa atribuída a você</p></div>`}
          </div>
        </div>

        <!-- ACTIVITY FEED -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-stream" style="color:var(--purple-light);margin-right:8px"></i>Atividade Recente</span>
          </div>
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-date">Há 15 min</div>
              <div class="timeline-text">Camila moveu <strong>"Post Saúde"</strong> para Aprovação Interna</div>
            </div>
            <div class="timeline-item">
              <div class="timeline-date">Há 1h</div>
              <div class="timeline-text">Cliente <strong>Café Aroma</strong> solicitou ajuste no card #4</div>
            </div>
            <div class="timeline-item">
              <div class="timeline-date">Há 2h</div>
              <div class="timeline-text">Lead <strong>Juliana — Clínica Glow</strong> entrou em negociação</div>
            </div>
            ${hasFinanceiro ? `
            <div class="timeline-item">
              <div class="timeline-date">Hoje, 09:30</div>
              <div class="timeline-text"><strong>R$ 5.200</strong> recebido — Bella Moda Store</div>
            </div>` : ''}
            <div class="timeline-item">
              <div class="timeline-date">Ontem, 17:45</div>
              <div class="timeline-text">Diego publicou <strong>"Story Verão"</strong> para Imobiliária Horizonte</div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: INSIGHTS + SUMMARY -->
      <div>
        <div class="card section-block">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-lightbulb" style="color:var(--warning);margin-right:8px"></i>Insights do Sistema</span>
            <button class="btn btn-ghost btn-sm" data-action="navigate" data-page="avisos">Ver todos</button>
          </div>
          <div class="insight-box" style="border-color:var(--danger-subtle)">
            <span class="insight-icon" style="color:var(--danger)">⏰</span>
            <div class="insight-text">Você tem <strong>${overdueTasks.length} tarefas vencidas</strong> <span>que precisam de ação imediata</span></div>
          </div>
          <div class="insight-box" style="border-color:var(--warning-subtle)">
            <span class="insight-icon" style="color:var(--warning)">✅</span>
            <div class="insight-text"><strong>${pendingApproval.length} conteúdos</strong> <span>aguardam aprovação do cliente</span></div>
          </div>
          <div class="insight-box" style="border-color:var(--info-subtle)">
            <span class="insight-icon" style="color:var(--info)">📞</span>
            <div class="insight-text"><strong>2 clientes</strong> <span>estão sem retorno há mais de 3 dias</span></div>
          </div>
          <div class="insight-box" style="border-color:var(--purple-border)">
            <span class="insight-icon" style="color:var(--purple-light)">📅</span>
            <div class="insight-text"><strong>${scheduled.length} posts</strong> <span>estão programados para esta semana</span></div>
          </div>
          ${finInsights}
        </div>

        <!-- WEEK SUMMARY -->
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fas fa-calendar-week" style="color:var(--purple-light);margin-right:8px"></i>Resumo da Semana</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-secondary)">Posts Programados</span>
                <span style="font-size:12px;font-weight:700">${scheduled.length}/12</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(Math.round(scheduled.length/12*100),100)}%"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-secondary)">Aprovações Pendentes</span>
                <span style="font-size:12px;font-weight:700;color:var(--warning)">${pendingApproval.length}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(Math.round(pendingApproval.length/5*100),100)}%;background:var(--warning)"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-secondary)">Entregas Concluídas</span>
                <span style="font-size:12px;font-weight:700;color:var(--success)">${done.length}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill green" style="width:${Math.min(Math.round(done.length/10*100),100)}%"></div></div>
            </div>
            ${hasFinanceiro ? `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-secondary)">Faturamento Previsto</span>
                <span style="font-size:12px;font-weight:700;color:var(--success)">R$ 27.100</span>
              </div>
              <div class="progress-bar"><div class="progress-fill green" style="width:82%"></div></div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTaskCard(t) {
  const overdue = SC.isOverdue(t.postDate) && t.status !== 'Publicado';
  const soon = SC.isDueSoon(t.postDate);
  const cls = overdue ? 'overdue' : soon ? 'due-soon' : 'on-time';
  const sc = SC.statusColor(t.status);
  return `
    <div class="task-card ${cls}" data-action="open-task-modal" data-id="${t.id}" style="cursor:pointer">
      <div class="task-card-header">
        <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:0">
          <div class="priority-dot p-${t.priority}"></div>
          <span class="task-card-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</span>
        </div>
        <span class="tag tag-${sc}" style="flex-shrink:0;font-size:10px">${t.status}</span>
      </div>
      <div class="task-card-meta">
        <div class="task-meta-item"><i class="fas fa-building"></i>${SC.getClientName(t.client)}</div>
        <div class="task-meta-item"><i class="fas fa-calendar"></i>${SC.formatDate(t.postDate) || 'S/data'}${overdue ? ' <span style="color:var(--danger);font-weight:700">VENCIDA</span>' : ''}</div>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" data-action="open-task-modal" data-id="${t.id}" data-stop-propagation="1">
          <i class="fas fa-external-link-alt"></i> Abrir
        </button>
      </div>
    </div>`;
}

function showNewTaskModal() {
  const clientOpts = SC.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const empOpts = SC.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-plus" style="color:var(--purple-light);margin-right:8px"></i>Nova Tarefa</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col full">
          <label>Título *</label>
          <input class="input-field" id="nt-title" placeholder="Título da tarefa" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Cliente *</label>
          <select class="select-field" id="nt-client">${clientOpts}</select>
        </div>
        <div class="form-col">
          <label>Responsável *</label>
          <select class="select-field" id="nt-assignee">${empOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Data de Postagem</label>
          <input type="date" class="input-field" id="nt-date" />
        </div>
        <div class="form-col">
          <label>Prioridade</label>
          <select class="select-field" id="nt-priority">
            <option value="media">🟡 Média</option>
            <option value="alta">🔴 Alta</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col full">
          <label>Texto / Caption</label>
          <textarea class="input-field" id="nt-text" rows="3" placeholder="Texto do conteúdo..."></textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-new-task"><i class="fas fa-save"></i> Criar Tarefa</button>
    </div>
  `);
}

function saveNewTask() {
  const title = document.getElementById('nt-title').value.trim();
  if (!title) { showToast('Informe o título da tarefa', 'error'); return; }

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

  setTimeout(() => {
    const newTask = {
      id: Date.now(),
      title,
      client: parseInt(document.getElementById('nt-client').value),
      assignee: parseInt(document.getElementById('nt-assignee').value),
      created: new Date().toISOString().split('T')[0],
      postDate: document.getElementById('nt-date').value || null,
      status: 'Pauta',
      priority: document.getElementById('nt-priority').value,
      text: document.getElementById('nt-text').value || '',
      checklist: [],
      comments: [],
    };
    SC.tasks.unshift(newTask);
    closeModal();
    showToast('✅ Tarefa criada com sucesso!');
    renderDashboard();
  }, 400);
}
