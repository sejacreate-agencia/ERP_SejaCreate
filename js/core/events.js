// =============================================
// EVENTS — Hub de event delegation
// =============================================
// Um único listener em document.body captura
// todos os cliques com data-action="..." e
// despacha para o handler correto.
//
// Substitui ~178 onclick= inline distribuídos
// nos módulos de página.

const Actions = {

  // ── GLOBAIS ───────────────────────────────
  'navigate':             el => navigate(el.dataset.page),
  'logout':               ()  => AuthService.logout(),
  'toggle-sidebar':       ()  => toggleSidebar(),
  'close-modal':          ()  => Modal.close(),
  'login':                ()  => doLogin(),

  // ── AVISOS ────────────────────────────────
  'refresh-avisos':       ()  => renderAvisos(),
  'resolve-aviso':        el  => resolveAviso(parseInt(el.dataset.id)),
  'snooze-aviso':         el  => snoozeAviso(parseInt(el.dataset.id)),

  // ── CALENDÁRIO ────────────────────────────
  'set-cal-mode':         el  => setCalMode(el.dataset.mode),
  'change-month':         el  => changeMonth(parseInt(el.dataset.dir)),

  // ── DASHBOARD ─────────────────────────────
  'show-new-task-modal':  ()  => showNewTaskModal(),
  'save-new-task':        ()  => saveNewTask(),

  // ── RELATÓRIOS ────────────────────────────
  'export-report':        ()  => exportReport(),
  'clear-rel-filters':    ()  => clearRelFilters(),
  'open-report':          el  => openReport(el.dataset.id),

  // ── CRM ───────────────────────────────────
  'show-crm-list':        ()  => showCRMList(),
  'render-crm':           ()  => renderCRM(),
  'open-lead-modal':      el  => openLeadModal(el.dataset.stage || null),
  'open-lead-detail':     el  => openLeadDetail(parseInt(el.dataset.id)),
  'delete-lead':          el  => deleteLead(parseInt(el.dataset.id)),
  'convert-lead':         el  => convertLead(parseInt(el.dataset.id)),
  'update-lead-stage':    el  => updateLeadStage(parseInt(el.dataset.id)),
  'save-new-lead':        ()  => saveNewLead(),

  // ── CADASTRO ──────────────────────────────
  'open-new-cadastro-modal': () => openNewCadastroModal(),
  'switch-cadastro-tab':  el  => renderCadastro(el.dataset.tab),
  'open-client-detail':   el  => openClientDetail(parseInt(el.dataset.id)),
  'toggle-client-status': el  => toggleClientStatus(parseInt(el.dataset.id)),
  'open-func-modal':      el  => openFuncModal(el.dataset.id ? parseInt(el.dataset.id) : null),
  'switch-client-tab':    el  => switchClientTab(parseInt(el.dataset.tab)),
  'save-new-client':      ()  => saveNewClient(),
  'save-funcionario':     el  => saveFuncionario(el.dataset.id ? parseInt(el.dataset.id) : 0),
  'save-new-supplier':    ()  => saveNewSupplier(),
  'open-edit-supplier':   el  => openEditSupplierModal(el.dataset.id),
  'save-edit-supplier':   el  => saveEditSupplier(el.dataset.id),

  // ── FINANCEIRO ────────────────────────────
  'open-new-lanc-modal':  ()  => openNewLancModal(),
  'switch-fin-tab':       el  => renderFinanceiro(el.dataset.tab),
  'switch-fin-filter':    ()  => switchFinFilter(),
  'mark-paid':            el  => markAsPaid(el.dataset.type, parseInt(el.dataset.id)),
  'open-edit-lanc':       el  => openEditLancModal(el.dataset.type, parseInt(el.dataset.id)),
  'toggle-lanc-type':     ()  => toggleLancType(),
  'save-new-lanc':        ()  => saveNewLanc(),
  'save-edit-lanc':       el  => saveEditLanc(el.dataset.type, parseInt(el.dataset.id)),
  'confirm-provisao':     el  => confirmProvisao(parseInt(el.dataset.id)),
  // ── META ─────────────────────────────────
  'open-meta-schedule':   el  => { const t = _taskData?.find(x => String(x.id) === String(el.dataset.id)); if (t) MetaService.openScheduleModal(t); },
  'meta-schedule-post':   el  => MetaService.executeSchedule(el.dataset.taskId),
  'open-meta-config':     el  => openMetaConfigModal(el.dataset.clientId),
  'save-meta-config':     el  => saveMetaConfig(el.dataset.clientId),
  'remove-meta-config':   el  => removeMetaConfig(el.dataset.clientId),
  'verify-meta-page':     el  => verifyMetaPage(el.dataset.clientId),
  'whatsapp-cobrar':      el  => Toast.info(`📱 WhatsApp aberto para ${el.dataset.client}`),
  // ── PLANO DE CONTAS ───────────────────────
  'open-conta-modal':     el  => openContaModal(el.dataset.id),
  'save-conta':           el  => saveConta(el.dataset.id),
  'delete-conta':         el  => deleteContaConfirm(el.dataset.id),
  'toggle-conta-status':  el  => toggleContaStatus(el.dataset.id),

  // ── TAREFAS ───────────────────────────────
  'set-task-view':        el  => setTaskView(el.dataset.view),
  'open-card-modal':      el  => openCardModal(el.dataset.col || null),
  'clear-task-filters':   ()  => clearTaskFilters(),
  'open-task-modal':      el  => openTaskModal(parseInt(el.dataset.id)),
  'save-new-card':        ()  => saveNewCard(),
  'add-check-item':       el  => addCheckItem(parseInt(el.dataset.id)),
  'add-comment':          el  => addComment(parseInt(el.dataset.id)),
  'move-task':            el  => moveTask(parseInt(el.dataset.id)),
  'send-to-client':       el  => sendToClient(parseInt(el.dataset.id)),
  'approve-task':         el  => approveTask(parseInt(el.dataset.id)),
  'request-adjust':       el  => requestAdjust(parseInt(el.dataset.id)),
  'delete-task':          el  => deleteTask(parseInt(el.dataset.id)),
  'upload-art-modal':     el  => uploadArtModal(parseInt(el.dataset.id)),
  'trigger-art-upload':   ()  => { const fi = document.getElementById('art-file-input'); if (fi) fi.click(); },

  // ── CONFIGURAÇÕES ─────────────────────────
  'switch-config-section':   el  => switchConfigSection(el.dataset.section),
  'delete-employee':         el  => deleteEmployee(parseInt(el.dataset.id)),
  'save-func-modal':         el  => saveFuncModal(parseInt(el.dataset.id)),
  'open-equipe-modal':       el  => openEquipeModal(el.dataset.id ? parseInt(el.dataset.id) : null),
  'delete-equipe':           el  => deleteEquipe(parseInt(el.dataset.id)),
  'save-equipe':             el  => saveEquipe(parseInt(el.dataset.id)),
  'open-perfil-modal':       el  => openPerfilModal(el.dataset.role),
  'save-perfil-perms':       el  => savePerfilPerms(el.dataset.role),
  'save-permissoes':         ()  => savePermissoes(),
  'open-funil-stage-modal':  el  => openFunilStageModal(el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null),
  'delete-funil-stage':      el  => deleteFunilStage(parseInt(el.dataset.idx)),
  'save-funil-stage':        el  => saveFunilStage(parseInt(el.dataset.idx)),
  'open-tipo-modal':         el  => openTipoModal(el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null),
  'delete-tipo':             el  => deleteTipo(parseInt(el.dataset.idx)),
  'save-tipo':               el  => saveTipo(parseInt(el.dataset.idx)),
  'open-servico-modal':      el  => openServicoModal(el.dataset.idx !== undefined ? parseInt(el.dataset.idx) : null),
  'delete-servico':          el  => deleteServico(parseInt(el.dataset.idx)),
  'save-servico':            el  => saveServico(parseInt(el.dataset.idx)),
  'toggle-modelo-aprovacao': el  => toggleModeloAprovacao(parseInt(el.dataset.id)),

  // ── ÁREA DO CLIENTE ───────────────────────
  'set-client-tab':            el  => setClientTab(el.dataset.tab),
  'open-client-content-modal': el  => openClientContentModal(parseInt(el.dataset.id)),
  'client-approve-content':    el  => clientApproveContent(parseInt(el.dataset.id)),
  'client-request-adjust':     el  => clientRequestAdjust(parseInt(el.dataset.id)),
  'confirm-adjust':            el  => confirmAdjust(parseInt(el.dataset.id)),
  'add-client-comment':        el  => addClientComment(parseInt(el.dataset.id)),
  'client-cal-prev':           ()  => clientCalPrev(),
  'client-cal-next':           ()  => clientCalNext(),
  'set-client-cal-view':       el  => setClientCalView(el.dataset.view),
  'approve-and-close':         el  => { clientApproveContent(parseInt(el.dataset.id)); Modal.close(); },
  'request-adjust-and-close':  el  => { Modal.close(); clientRequestAdjust(parseInt(el.dataset.id)); },
};

// ─── LISTENER ÚNICO ──────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;

    const action  = el.dataset.action;
    const handler = Actions[action];

    if (!handler) {
      console.warn(`Events: ação desconhecida "${action}"`);
      return;
    }

    if (el.dataset.stopPropagation) e.stopPropagation();

    try {
      handler(el, e);
    } catch (err) {
      console.error(`Events: erro ao executar "${action}":`, err);
    }
  });

  // Listener separado para <select data-action="...">
  document.body.addEventListener('change', e => {
    const el = e.target.closest('select[data-action]');
    if (!el) return;
    const handler = Actions[el.dataset.action];
    if (handler) {
      try { handler(el, e); } catch (err) { console.error(`Events (change): erro "${el.dataset.action}":`, err); }
    }
  });
});
