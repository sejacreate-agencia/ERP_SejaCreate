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
  'forgot-password':      ()  => AuthService.resetPassword(document.getElementById('login-email')?.value?.trim()),
  'save-recovery-password': () => AuthService.saveRecoveryPassword(
    document.getElementById('recovery-pass')?.value,
    document.getElementById('recovery-pass-confirm')?.value
  ),
  'change-password':      ()  => openChangePasswordModal(),
  'save-change-password': ()  => saveChangePassword(),
  'open-reset-pass-modal': el => openResetPassModal(el.dataset.name, el.dataset.email),
  'send-reset-email':      el => AuthService.sendResetEmailForUser(el.dataset.email),
  'resend-confirmation':   el => AuthService.resendConfirmation(el.dataset.email),

  // ── AVISOS ────────────────────────────────
  'refresh-avisos':       ()  => renderAvisos(),
  'notif-open':           el  => openNotification(el.dataset.id, el.dataset.task),
  'notif-mark-all':       ()  => markAllNotifications(),
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
  'gerar-proposta-crm':   el  => gerarPropostaCRM(el.dataset.id, el.dataset.name),

  // ── CADASTRO ──────────────────────────────
  'open-new-cadastro-modal': () => openNewCadastroModal(),
  'switch-cadastro-tab':  el  => renderCadastro(el.dataset.tab),
  'open-client-detail':   el  => openClientDetail(el.dataset.id),
  'toggle-client-status': el  => toggleClientStatus(el.dataset.id),
  'open-func-modal':      el  => openFuncModal(el.dataset.id || null),
  'switch-client-tab':    el  => switchClientTab(parseInt(el.dataset.tab)),
  'save-new-client':      ()  => saveNewClient(),
  'save-funcionario':     el  => saveFuncionario(el.dataset.id ? parseInt(el.dataset.id) : 0),
  'save-new-supplier':    ()  => saveNewSupplier(),
  'open-edit-supplier':   el  => openEditSupplierModal(el.dataset.id),
  'save-edit-supplier':   el  => saveEditSupplier(el.dataset.id),
  'open-edit-client':     el  => openEditClientModal(el.dataset.id),
  'save-edit-client':     el  => saveEditClient(el.dataset.id),
  'gerar-parcelas':       el  => _confirmarGerarParcelas(el.dataset.clientId, el.dataset.clientName),

  // ── FINANCEIRO ────────────────────────────
  'open-new-lanc-modal':  ()  => openNewLancModal(),
  'switch-fin-tab':       el  => renderFinanceiro(el.dataset.tab),
  'navigate-fin':         el  => navigateFinTab(el.dataset.finTab),
  'switch-fin-filter':    ()  => switchFinFilter(),
  'mark-paid':            el  => openMarkPaidModal(el.dataset.type, el.dataset.id),
  'save-mark-paid':       el  => saveMarkPaid(el.dataset.type, el.dataset.id),
  'switch-fin-regime':    el  => switchFinRegime(el.value),
  'open-edit-lanc':       el  => openEditLancModal(el.dataset.type, el.dataset.id),
  'toggle-lanc-type':     ()  => toggleLancType(),
  'save-new-lanc':        ()  => saveNewLanc(),
  'save-edit-lanc':       el  => saveEditLanc(el.dataset.type, el.dataset.id),
  'confirm-provisao':     el  => confirmProvisao(el.dataset.id),
  'open-new-recebimento':     ()  => openNewRecebimentoModal(),
  'save-new-recebimento':     ()  => saveNewRecebimento(),
  'delete-lanc':              el  => deleteLanc(el.dataset.type, el.dataset.id),
  'open-new-lancamento-pagar':()  => openNewLancModal('payable'),
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
  'open-task-modal':      el  => openTaskModal(el.dataset.id),
  'save-new-card':        ()  => saveNewCard(),
  'add-check-item':       el  => addCheckItem(el.dataset.id),
  'add-comment':          el  => addComment(el.dataset.id),
  'move-task':            el  => moveTask(el.dataset.id),
  'send-to-client':       el  => sendToClient(el.dataset.id),
  'send-approval-whatsapp': el => sendApprovalWhatsApp(el.dataset.id),
  'approve-task':         el  => approveTask(el.dataset.id),
  'request-adjust':       el  => requestAdjust(el.dataset.id),
  'delete-task':          el  => deleteTask(el.dataset.id),
  'upload-art-modal':     el  => uploadArtModal(el.dataset.id),
  'add-art-link':         el  => addArtLinkModal(el.dataset.id),
  'save-art-link':        el  => saveArtLink(el.dataset.id),
  'del-art':              el  => deleteArt(el.dataset.id, el.dataset.task),
  'save-post-info':       el  => saveTaskPostInfo(el.dataset.id),
  'edit-task-briefing':   el  => editTaskBriefing(el.dataset.id),
  'save-task-briefing':   el  => saveTaskBriefing(el.dataset.id),
  'cancel-task-briefing': el  => cancelTaskBriefing(el.dataset.id),
  'add-task-link':        el  => addTaskLink(el.dataset.id),
  'manage-columns':       ()  => openColumnsModal(),
  'kbcol-add':            ()  => kbAddColumn(),
  'kbcol-del':            el  => kbDeleteColumn(el.dataset.id),
  'kbcol-up':             el  => kbMoveColumn(el.dataset.id, -1),
  'kbcol-down':           el  => kbMoveColumn(el.dataset.id, 1),
  'trigger-art-upload':   ()  => { const fi = document.getElementById('art-file-input'); if (fi) fi.click(); },

  // ── DASHBOARD DE MARKETING ────────────────
  'dm-export-pdf':        ()  => exportDmPdf(),
  'dm-export-xlsx':       ()  => exportDmXlsx(),

  // ── ONBOARDING / WORKSPACE DO CLIENTE ─────
  'ob-open':              el  => openClientWorkspace(el.dataset.id),
  'ws-tab':               el  => wsSwitchTab(el.dataset.tab),
  'ws-save-briefing':     ()  => saveBriefing(),
  'ws-add-note':          ()  => wsAddNote(),
  'ws-del-note':          el  => wsDelNote(el.dataset.id),
  'ws-add-link':          el  => wsAddLink(el.dataset.kind),
  'ws-del-link':          el  => wsDelLink(el.dataset.id),
  'ws-del-file':          el  => wsDelFile(el.dataset.id),

  // ── PLANEJAMENTOS ─────────────────────────
  'pl-set-view':          el  => setPlView(el.dataset.view),
  'pl-change-month':      el  => changePlMonth(parseInt(el.dataset.dir)),
  'pl-open-new':          ()  => openPlanningModal(null),
  'pl-open-edit':         el  => openPlanningModal(el.dataset.id),
  'pl-save':              el  => savePlanning(el.dataset.id || null),
  'pl-approve':           el  => approvePlanning(el.dataset.id),
  'pl-delete':            el  => deletePlanning(el.dataset.id),

  // ── CONFIGURAÇÕES ─────────────────────────
  'switch-config-section':   el  => switchConfigSection(el.dataset.section),
  'delete-employee':         el  => deleteEmployee(el.dataset.id),
  'save-func-modal':         el  => saveFuncModal(el.dataset.id || null),
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
  'cfg-col-add':             ()  => addKanbanColumn(),
  'cfg-col-del':             el  => deleteKanbanColumn(el.dataset.id),
  'cfg-col-up':              el  => moveKanbanColumn(el.dataset.id, -1),
  'cfg-col-down':            el  => moveKanbanColumn(el.dataset.id, 1),

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
