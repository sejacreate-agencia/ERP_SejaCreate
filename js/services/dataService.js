// =============================================
// DATA SERVICE — Adapter unificado (shim)
// =============================================
// Este arquivo é uma camada de compatibilidade.
// O objeto `Data` original vive em supabase.js e
// já implementa o dual-mode (Supabase ou mock).
//
// Aqui adicionamos helpers de perfil/equipe que
// os módulos de página precisam, e centralizamos
// o acesso a dados que ainda não têm service próprio.

const DataService = {

  // ── PERFIS / EQUIPE ───────────────────────

  async profiles() {
    return Data.profiles();
  },

  async teams() {
    if (isSupabaseReady()) {
      const { data } = await DB.teams.list();
      return data || [];
    }
    return SC.equipes.map(e => ({
      id: e.id,
      name: e.name,
      description: e.desc,
      color: e.color,
      team_members: (e.members || []).map(pid => {
        const p = SC.employees.find(emp => emp.id === pid);
        return {
          profile_id: pid,
          profiles: p ? {
            full_name: p.name,
            avatar_initials: p.avatar || p.name.split(' ').map(w => w[0]).join('').slice(0, 2),
            role: p.role,
          } : null,
        };
      }),
    }));
  },

  getEmployeeName(id) {
    return SC.getEmployeeName(id);
  },

  getEmployeeAvatar(id) {
    return SC.getEmployeeAvatar(id);
  },

  // ── APROVAÇÕES ────────────────────────────

  async getPendingApprovals(clientId) {
    if (isSupabaseReady()) {
      const { data } = await DB.approvals.listPending(clientId);
      return data || [];
    }
    // Demo: tarefas no status "Enviado ao Cliente" do cliente
    return (await Data.tasks({ client_id: clientId }))
      .filter(t => t.status === 'Enviado ao Cliente' || t.status === 'Ajuste Solicitado');
  },

  async addApproval(taskId, decision, feedback) {
    const userId = SC.currentUser?.id;
    if (isSupabaseReady()) {
      const { data, error } = await DB.approvals.create(taskId, userId, decision, feedback);
      if (error) throw error;
      return data;
    }
    // Demo: atualiza status da tarefa diretamente
    const newStatus = decision === 'aprovado' ? 'Aprovado' : 'Ajuste Solicitado';
    await TaskService.update(taskId, { status: newStatus });
    const task = SC.tasks.find(t => t.id === taskId);
    if (task && feedback) {
      task.comments.push({ user: userId, text: feedback, date: new Date().toISOString().split('T')[0] });
    }
  },

  // ── ACTIVITY LOG ──────────────────────────

  async getRecentActivity(limit = 10) {
    if (isSupabaseReady()) {
      const { data } = await DB.activityLogs.listRecent(limit);
      return data || [];
    }
    // Demo: constrói atividade sintética a partir de tarefas recentes
    return SC.tasks.slice(-limit).reverse().map(t => ({
      id: t.id,
      action: 'update',
      resource_type: 'task',
      resource_id: t.id,
      details: t.title,
      created_at: t.created,
      user: {
        full_name: SC.getEmployeeName(t.assignee),
        avatar_initials: SC.getEmployeeAvatar(t.assignee),
      },
    }));
  },
};
