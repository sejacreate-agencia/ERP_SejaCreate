// =============================================
// SEJA CREATE — CONFIGURAÇÕES (CRUD COMPLETO)
// =============================================

let configSection = 'usuarios';

function renderConfiguracoes(section) {
  if (section) configSection = section;

  const navItems = [
    { id: 'usuarios',   icon: 'fa-users',        label: 'Usuários' },
    { id: 'equipes',    icon: 'fa-sitemap',       label: 'Equipes' },
    { id: 'perfis',     icon: 'fa-shield-alt',    label: 'Perfis de Acesso' },
    { id: 'permissoes', icon: 'fa-lock',          label: 'Permissões' },
    { id: 'funil',      icon: 'fa-columns',       label: 'Etapas do Funil' },
    { id: 'tipos',      icon: 'fa-tag',           label: 'Tipos de Conteúdo' },
    { id: 'servicos',   icon: 'fa-briefcase',     label: 'Serviços' },
    { id: 'aprovacao',    icon: 'fa-check-double',  label: 'Aprovação' },
    { id: 'integracoes', icon: 'fa-plug',           label: 'Integrações' },
  ];

  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Configurações</h1>
      <p class="page-subtitle">Administre usuários, permissões, funis e regras do sistema</p>
    </div>
    <div class="config-layout">
      <div class="config-sidebar-nav">
        ${navItems.map(n => `
          <div class="config-nav-item ${configSection === n.id ? 'active' : ''}"
               data-action="switch-config-section" data-section="${n.id}">
            <i class="fas ${n.icon}" style="font-size:13px;width:16px;text-align:center"></i>
            ${n.label}
          </div>`).join('')}
      </div>
      <div class="config-content" id="config-main">
        ${renderConfigSection()}
      </div>
    </div>
  `;
}

function switchConfigSection(section) {
  configSection = section;
  const el = document.getElementById('config-main');
  if (el) {
    el.innerHTML = renderConfigSection();
    document.querySelectorAll('.config-nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.section === section);
    });
  }
}

function renderConfigSection() {
  switch (configSection) {
    case 'usuarios':   return renderConfigUsuarios();
    case 'equipes':    return renderConfigEquipes();
    case 'perfis':     return renderConfigPerfis();
    case 'permissoes': return renderConfigPermissoes();
    case 'funil':      return renderConfigFunil();
    case 'tipos':      return renderConfigTipos();
    case 'servicos':   return renderConfigServicos();
    case 'aprovacao':    return renderConfigAprovacao();
    case 'integracoes':  return renderConfigIntegracoes();
    default: return '<p style="color:var(--text-muted)">Selecione uma seção</p>';
  }
}

/* ─── USUÁRIOS ─────────────────────────── */

function renderConfigUsuarios() {
  const rows = SC.employees.map(e => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm" style="background:linear-gradient(135deg,var(--purple),var(--purple-light))">${e.name.slice(0,2).toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${e.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${e.phone || '—'}</div>
          </div>
        </div>
      </td>
      <td style="font-size:12px">${e.email}</td>
      <td style="font-size:12px">${e.cargo}</td>
      <td><span class="tag tag-purple">${SC.roleLabels[e.role] || e.role}</span></td>
      <td>
        <span class="tag ${e.status === 'ativo' ? 'tag-green' : 'tag-gray'}">
          <span class="status-dot ${e.status === 'ativo' ? 'dot-green' : 'dot-gray'}"></span>
          ${e.status}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" data-action="open-func-modal" data-id="${e.id}">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm" style="background:var(--danger-subtle);color:var(--danger)"
                  data-action="delete-employee" data-id="${e.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Usuários do Sistema</h3>
      <button class="btn btn-primary" data-action="open-func-modal">
        <i class="fas fa-plus"></i> Novo Usuário
      </button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Usuário</th><th>E-mail</th><th>Cargo</th><th>Perfil</th><th>Status</th><th>Ações</th></tr>
        </thead>
        <tbody id="users-table-body">${rows}</tbody>
      </table>
    </div>`;
}

function openFuncModal(id) {
  const e = id !== null ? SC.employees.find(x => x.id === id) : null;
  const isNew = !e;
  const roleOpts = Object.entries(SC.roleLabels).map(([k,v]) =>
    `<option value="${k}" ${e?.role===k?'selected':''}>${v}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-user-${isNew?'plus':'edit'}" style="color:var(--purple-light);margin-right:8px"></i>
        ${isNew ? 'Novo Usuário' : 'Editar Usuário'}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome completo *</label><input class="input-field" id="fu-name" value="${e?.name||''}" placeholder="Nome do funcionário" /></div>
        <div class="form-col"><label>E-mail *</label><input class="input-field" id="fu-email" type="email" value="${e?.email||''}" placeholder="email@sejacreate.com" /></div>
      </div>
      <div class="form-row">
        <div class="form-col"><label>Cargo</label><input class="input-field" id="fu-cargo" value="${e?.cargo||''}" placeholder="Ex: Designer, Social Media..." /></div>
        <div class="form-col"><label>Telefone</label><input class="input-field" id="fu-phone" value="${e?.phone||''}" placeholder="(11) 9 0000-0000" /></div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Perfil de Acesso</label>
          <select class="select-field" id="fu-role">${roleOpts}</select>
        </div>
        <div class="form-col">
          <label>Status</label>
          <select class="select-field" id="fu-status">
            <option value="ativo" ${e?.status==='ativo'?'selected':''}>Ativo</option>
            <option value="inativo" ${e?.status==='inativo'?'selected':''}>Inativo</option>
          </select>
        </div>
      </div>
      ${isNew ? `
      <div class="form-row">
        <div class="form-col"><label>Senha inicial</label><input class="input-field" id="fu-pass" type="password" placeholder="Senha..." /></div>
        <div class="form-col"></div>
      </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-func-modal" data-id="${id}">
        <i class="fas fa-save"></i> ${isNew ? 'Criar Usuário' : 'Salvar Alterações'}
      </button>
    </div>
  `);
}

async function saveFuncModal(id) {
  const name  = document.getElementById('fu-name').value.trim();
  const email = document.getElementById('fu-email').value.trim();
  if (!name || !email) { showToast('Nome e e-mail são obrigatórios!', 'error'); return; }

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  const resetBtn = (label = 'Salvar Alterações') => {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-save"></i> ${label}`;
  };

  const profilePayload = {
    full_name: name,
    email,
    cargo:           document.getElementById('fu-cargo').value.trim() || 'Colaborador',
    phone:           document.getElementById('fu-phone').value.trim(),
    role:            document.getElementById('fu-role').value,
    status:          document.getElementById('fu-status').value,
    avatar_initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
  };

  if (isSupabaseReady()) {
    if (!id) {
      // ── 1. CRIAR USUÁRIO ────────────────────────────────────────────
      const pass = document.getElementById('fu-pass')?.value?.trim();
      if (!pass || pass.length < 6) {
        showToast('Senha obrigatória com no mínimo 6 caracteres!', 'error');
        resetBtn('Criar Usuário');
        return;
      }

      // Salva sessão do admin para restaurar após o signUp
      const { data: { session: adminSession } } = await supabaseClient.auth.getSession();

      // Passo 1: cria o usuário no Auth
      const { data: signUpData, error: authError } = await supabaseClient.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name, role: profilePayload.role } },
      });

      // Restaura sessão do admin (signUp pode criar nova sessão se confirmação de e-mail estiver desligada)
      if (adminSession) {
        await supabaseClient.auth.setSession({
          access_token:  adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (authError || !signUpData?.user?.id) {
        showToast(`Erro ao criar usuário: ${authError?.message || 'ID não retornado pelo Auth'}`, 'error');
        resetBtn('Criar Usuário');
        return;
      }

      const userId = signUpData.user.id;

      // Passo 2: upsert em profiles com o id retornado pelo Auth
      const { error: profileError } = await SB.upsert('profiles', { id: userId, ...profilePayload });

      if (profileError) {
        showToast(`Usuário criado, mas erro ao salvar perfil: ${profileError.message}`, 'warning');
      } else {
        showToast(`✅ Usuário "${name}" criado com sucesso!`, 'success');
      }

    } else {
      // ── 2. EDITAR USUÁRIO EXISTENTE ─────────────────────────────────
      const { error } = await DB.profiles.update(id, profilePayload);
      if (error) {
        showToast(`Erro ao atualizar usuário: ${error.message}`, 'error');
        resetBtn();
        return;
      }
      showToast(`✅ Usuário "${name}" atualizado com sucesso!`, 'success');
    }

  } else {
    // ── MODO DEMO (sem Supabase) ────────────────────────────────────
    await new Promise(r => setTimeout(r, 350));
    const legacyData = {
      name, email,
      cargo: profilePayload.cargo, phone: profilePayload.phone,
      role: profilePayload.role, status: profilePayload.status,
    };
    if (!id) {
      const newEmp = { id: Date.now(), ...legacyData };
      SC.employees.push(newEmp);
      SC.users.push({ id: newEmp.id, name, role: profilePayload.role, avatar: profilePayload.avatar_initials, email, cargo: profilePayload.cargo });
      showToast(`✅ Usuário "${name}" criado!`, 'success');
    } else {
      const emp = SC.employees.find(e => e.id === id);
      if (emp) Object.assign(emp, legacyData);
      const usr = SC.users.find(u => u.id === id);
      if (usr) { usr.name = name; usr.role = profilePayload.role; usr.email = email; usr.cargo = profilePayload.cargo; }
      showToast(`✅ Usuário "${name}" atualizado!`, 'success');
    }
  }

  closeModal();
  switchConfigSection('usuarios');
}

async function deleteEmployee(id) {
  const emp = SC.employees.find(e => e.id === id);
  if (!emp) return;
  if (String(emp.id) === String(SC.currentUser?.id)) { showToast('Você não pode excluir sua própria conta!', 'error'); return; }
  if (!confirm(`Excluir o usuário "${emp.name}"? Esta ação não pode ser desfeita.`)) return;

  if (isSupabaseReady()) {
    const { error } = await DB.profiles.remove(id);
    if (error) { showToast(`Erro: ${error.message}`, 'error'); return; }
  }

  SC.employees = SC.employees.filter(e => String(e.id) !== String(id));
  SC.users = SC.users.filter(u => String(u.id) !== String(id));
  showToast(`Usuário "${emp.name}" excluído.`, 'error');
  switchConfigSection('usuarios');
}

/* ─── EQUIPES ──────────────────────────── */

function renderConfigEquipes() {
  const colorMap = { purple:'#7c3aed', blue:'#3b82f6', green:'#10b981', yellow:'#f59e0b', red:'#ef4444', gray:'#6b7280' };

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Equipes</h3>
      <button class="btn btn-primary" data-action="open-equipe-modal">
        <i class="fas fa-plus"></i> Nova Equipe
      </button>
    </div>
    <div id="equipes-list">
      ${SC.equipes.map(eq => {
        const color = colorMap[eq.color] || '#7c3aed';
        return `
          <div class="team-card">
            <div class="team-color-badge" style="background:${color}"></div>
            <div class="team-info">
              <div class="team-name">${eq.name}</div>
              <div class="team-desc">${eq.desc}</div>
              <div class="team-members">
                ${eq.members.map(mid => {
                  const u = SC.users.find(u => u.id === mid);
                  return u ? `<div class="avatar-xs" title="${u.name}">${u.avatar}</div>` : '';
                }).join('')}
                <span style="font-size:11px;color:var(--text-muted);margin-left:4px">${eq.members.length} membros</span>
              </div>
            </div>
            <div class="team-actions">
              <button class="btn btn-sm btn-secondary" data-action="open-equipe-modal" data-id="${eq.id}">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn btn-sm" style="background:var(--danger-subtle);color:var(--danger)" data-action="delete-equipe" data-id="${eq.id}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function openEquipeModal(id) {
  const eq = id !== null ? SC.equipes.find(e => e.id === id) : null;
  const isNew = !eq;
  const memberOpts = SC.employees.map(e => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
      <input type="checkbox" value="${e.id}" ${eq?.members.includes(e.id)?'checked':''} style="accent-color:var(--purple)">
      <div class="avatar-xs">${e.name.slice(0,2).toUpperCase()}</div>
      <span style="font-size:13px">${e.name}</span>
    </label>`).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-sitemap" style="color:var(--purple-light);margin-right:8px"></i>
        ${isNew ? 'Nova Equipe' : 'Editar Equipe'}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col"><label>Nome da Equipe *</label><input class="input-field" id="eq-name" value="${eq?.name||''}" placeholder="Ex: Criação, Comercial..." /></div>
        <div class="form-col"><label>Descrição</label><input class="input-field" id="eq-desc" value="${eq?.desc||''}" placeholder="Breve descrição..." /></div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Cor da Equipe</label>
          <select class="select-field" id="eq-color">
            ${['purple','blue','green','yellow','red','gray'].map(c => `<option value="${c}" ${eq?.color===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-col"></div>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:8px">Membros da Equipe</label>
        <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:12px;max-height:200px;overflow-y:auto" id="eq-members-list">
          ${memberOpts}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-equipe" data-id="${id}">
        <i class="fas fa-save"></i> ${isNew ? 'Criar Equipe' : 'Salvar'}
      </button>
    </div>
  `);
}

function saveEquipe(id) {
  const name = document.getElementById('eq-name').value.trim();
  if (!name) { showToast('Nome da equipe é obrigatório!', 'error'); return; }

  const members = [...document.querySelectorAll('#eq-members-list input[type=checkbox]:checked')]
    .map(cb => parseInt(cb.value));

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  setTimeout(() => {
    const data = {
      name,
      desc:    document.getElementById('eq-desc').value.trim(),
      color:   document.getElementById('eq-color').value,
      members,
    };

    if (id === null) {
      SC.equipes.push({ id: Date.now(), ...data });
      showToast(`✅ Equipe "${name}" criada!`, 'success');
    } else {
      const eq = SC.equipes.find(e => e.id === id);
      if (eq) Object.assign(eq, data);
      showToast(`✅ Equipe "${name}" atualizada!`, 'success');
    }
    closeModal();
    switchConfigSection('equipes');
  }, 400);
}

function deleteEquipe(id) {
  const eq = SC.equipes.find(e => e.id === id);
  if (!eq) return;
  if (confirm(`Excluir a equipe "${eq.name}"?`)) {
    SC.equipes = SC.equipes.filter(e => e.id !== id);
    showToast(`Equipe "${eq.name}" excluída.`, 'error');
    switchConfigSection('equipes');
  }
}

/* ─── PERFIS DE ACESSO ──────────────────── */

function renderConfigPerfis() {
  const perfilData = [
    { role:'admin',     label:'Administrador', desc:'Acesso total ao sistema', color:'purple', tags:['Tudo'] },
    { role:'gestor',    label:'Gestor',        desc:'Gerencia projetos e equipes', color:'blue', tags:['Projetos','Tarefas','Relatórios'] },
    { role:'social',    label:'Social Media',  desc:'Produz e publica conteúdos', color:'green', tags:['Tarefas','Calendário'] },
    { role:'designer',  label:'Designer',      desc:'Cria artes e materiais visuais', color:'yellow', tags:['Tarefas'] },
    { role:'comercial', label:'Comercial',     desc:'Gerencia leads e CRM', color:'orange', tags:['CRM','Cadastro','Relatórios'] },
    { role:'financeiro',label:'Financeiro',    desc:'Acessa módulo financeiro', color:'red', tags:['Financeiro','Relatórios'] },
    { role:'cliente',   label:'Cliente',       desc:'Aprova conteúdos e vê calendário', color:'gray', tags:['Aprovação'] },
  ];

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Perfis de Acesso</h3>
      <button class="btn btn-secondary" data-action="switch-config-section" data-section="permissoes">
        <i class="fas fa-lock"></i> Gerenciar Permissões
      </button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
      ${perfilData.map(p => `
        <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--border-radius);padding:16px;transition:var(--transition)"
             onmouseenter="this.style.borderColor='var(--purple-border)'"
             onmouseleave="this.style.borderColor='var(--border)'">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div class="avatar-sm" style="background:var(--purple-subtle);color:var(--purple-light)">${p.label.slice(0,2)}</div>
            <div>
              <div style="font-weight:700;font-size:14px">${p.label}</div>
              <div style="font-size:11px;color:var(--text-muted)">${p.desc}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
            ${p.tags.map(t => `<span class="tag tag-purple" style="font-size:10px">${t}</span>`).join('')}
          </div>
          <button class="btn btn-sm btn-secondary" style="width:100%" data-action="open-perfil-modal" data-role="${p.role}">
            <i class="fas fa-edit"></i> Editar Permissões
          </button>
        </div>`).join('')}
    </div>`;
}

function openPerfilModal(role) {
  const label = SC.roleLabels[role] || role;
  const perms = SC.permissoes[role] || {};
  const permLabels = {
    visualizar: 'Visualizar conteúdos',
    criar: 'Criar cards/conteúdos',
    editar: 'Editar conteúdos',
    comentar: 'Comentar',
    aprovar: 'Aprovar conteúdos',
    programar: 'Programar publicações',
    publicar: 'Publicar posts',
    financeiro: 'Acessar financeiro',
    relatorios: 'Acessar relatórios',
  };

  openModal(`
    <div class="modal-header">
      <span class="modal-title"><i class="fas fa-shield-alt" style="color:var(--purple-light);margin-right:8px"></i>Perfil: ${label}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Defina o que o perfil <strong>${label}</strong> pode fazer no sistema.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${Object.entries(permLabels).map(([key, label_]) => `
          <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
                        background:var(--bg-input);border-radius:8px;cursor:pointer;
                        border:1px solid var(--border)">
            <span style="font-size:13px">${label_}</span>
            <input type="checkbox" id="perm-${key}" ${perms[key] ? 'checked' : ''}
                   style="accent-color:var(--purple);width:16px;height:16px">
          </label>`).join('')}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-perfil-perms" data-role="${role}">
        <i class="fas fa-save"></i> Salvar Permissões
      </button>
    </div>
  `);
}

function savePerfilPerms(role) {
  const permKeys = ['visualizar','criar','editar','comentar','aprovar','programar','publicar','financeiro','relatorios'];
  permKeys.forEach(key => {
    const cb = document.getElementById(`perm-${key}`);
    if (cb && SC.permissoes[role]) {
      SC.permissoes[role][key] = cb.checked ? 1 : 0;
    }
  });
  closeModal();
  showToast(`✅ Permissões do perfil "${SC.roleLabels[role]}" salvas!`, 'success');
  switchConfigSection('perfis');
}

/* ─── MATRIZ DE PERMISSÕES ───────────────── */

function renderConfigPermissoes() {
  const actions = ['visualizar','criar','editar','comentar','aprovar','programar','publicar','financeiro','relatorios'];
  const actLabels = {
    visualizar:'Visualizar', criar:'Criar', editar:'Editar', comentar:'Comentar',
    aprovar:'Aprovar', programar:'Programar', publicar:'Publicar',
    financeiro:'Financeiro', relatorios:'Relatórios'
  };
  const roles = Object.keys(SC.permissoes);

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Matriz de Permissões</h3>
      <button class="btn btn-primary" data-action="save-permissoes">
        <i class="fas fa-save"></i> Salvar Alterações
      </button>
    </div>
    <div style="overflow-x:auto">
      <table class="perm-matrix">
        <thead>
          <tr>
            <th style="text-align:left">Perfil</th>
            ${actions.map(a => `<th>${actLabels[a]}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${roles.map(role => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="avatar-sm" style="background:var(--purple-subtle);color:var(--purple-light);font-size:10px">
                    ${SC.roleLabels[role]?.slice(0,2)||role.slice(0,2)}
                  </div>
                  ${SC.roleLabels[role]||role}
                </div>
              </td>
              ${actions.map(action => `
                <td>
                  <input type="checkbox" class="perm-checkbox"
                         id="pm-${role}-${action}"
                         data-role="${role}" data-action="${action}"
                         ${SC.permissoes[role]?.[action] ? 'checked' : ''}>
                </td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:14px;padding:12px;background:var(--bg-input);border-radius:8px;font-size:12px;color:var(--text-muted)">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>
      Marque ou desmarque as permissões e clique em <strong>Salvar Alterações</strong> para aplicar.
    </div>`;
}

function savePermissoes() {
  const checkboxes = document.querySelectorAll('.perm-checkbox');
  checkboxes.forEach(cb => {
    const role = cb.dataset.role;
    const action = cb.dataset.action;
    if (SC.permissoes[role]) {
      SC.permissoes[role][action] = cb.checked ? 1 : 0;
    }
  });
  showToast('✅ Permissões salvas com sucesso!', 'success');
  setTimeout(() => switchConfigSection('permissoes'), 600);
}

/* ─── FUNIL (ETAPAS KANBAN) ──────────────── */

function renderConfigFunil() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Etapas do Funil de Produção</h3>
      <button class="btn btn-primary" data-action="open-funil-stage-modal">
        <i class="fas fa-plus"></i> Nova Etapa
      </button>
    </div>
    <div id="funil-list">
      ${SC.kanbanCols.map((col, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-input);
                    border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
          <i class="fas fa-grip-vertical" style="color:var(--text-muted);cursor:grab"></i>
          <div style="width:10px;height:10px;border-radius:50%;background:var(--purple);flex-shrink:0"></div>
          <span style="flex:1;font-size:13px;font-weight:500">${col}</span>
          <span class="tag tag-gray" style="font-size:10px">Etapa ${i+1}</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" data-action="open-funil-stage-modal" data-idx="${i}">
              <i class="fas fa-edit"></i>
            </button>
            ${SC.kanbanCols.length > 3 ? `
            <button class="btn btn-sm" style="background:var(--danger-subtle);color:var(--danger)" data-action="delete-funil-stage" data-idx="${i}">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

function openFunilStageModal(idx) {
  const isNew = idx === null;
  const current = !isNew ? SC.kanbanCols[idx] : '';
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${isNew ? 'Nova Etapa' : 'Editar Etapa'}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-col">
        <label>Nome da Etapa *</label>
        <input class="input-field" id="funil-name" value="${current}" placeholder="Ex: Em Revisão..." />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-funil-stage" data-idx="${idx}">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `);
}

function saveFunilStage(idx) {
  const name = document.getElementById('funil-name').value.trim();
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  if (idx === null) {
    SC.kanbanCols.push(name);
    showToast(`✅ Etapa "${name}" adicionada!`, 'success');
  } else {
    SC.kanbanCols[idx] = name;
    showToast(`✅ Etapa atualizada para "${name}"!`, 'success');
  }
  closeModal();
  switchConfigSection('funil');
}

function deleteFunilStage(idx) {
  const name = SC.kanbanCols[idx];
  if (confirm(`Remover a etapa "${name}"? Cards nessa etapa serão movidos para "Pauta".`)) {
    SC.tasks.forEach(t => { if (t.status === name) t.status = 'Pauta'; });
    SC.kanbanCols.splice(idx, 1);
    showToast(`Etapa "${name}" removida.`, 'error');
    switchConfigSection('funil');
  }
}

/* ─── TIPOS DE CONTEÚDO ──────────────────── */

function renderConfigTipos() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Tipos de Conteúdo</h3>
      <button class="btn btn-primary" data-action="open-tipo-modal">
        <i class="fas fa-plus"></i> Novo Tipo
      </button>
    </div>
    <div id="tipos-list">
      ${SC.tiposConteudo.map((tipo, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-input);
                    border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
          <span style="font-size:18px">🏷️</span>
          <span style="flex:1;font-size:13px;font-weight:500">${tipo}</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" data-action="open-tipo-modal" data-idx="${i}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm" style="background:var(--danger-subtle);color:var(--danger)" data-action="delete-tipo" data-idx="${i}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`).join('')}
    </div>`;
}

function openTipoModal(idx) {
  const current = idx !== null ? SC.tiposConteudo[idx] : '';
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${idx === null ? 'Novo Tipo de Conteúdo' : 'Editar Tipo'}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-col">
        <label>Nome do Tipo *</label>
        <input class="input-field" id="tipo-name" value="${current}" placeholder="Ex: Post Estático, Reels..." />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-tipo" data-idx="${idx}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveTipo(idx) {
  const name = document.getElementById('tipo-name').value.trim();
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  if (idx === null) {
    SC.tiposConteudo.push(name);
    showToast(`✅ Tipo "${name}" adicionado!`, 'success');
  } else {
    SC.tiposConteudo[idx] = name;
    showToast(`✅ Tipo atualizado!`, 'success');
  }
  closeModal();
  switchConfigSection('tipos');
}

function deleteTipo(idx) {
  const name = SC.tiposConteudo[idx];
  if (confirm(`Remover o tipo "${name}"?`)) {
    SC.tiposConteudo.splice(idx, 1);
    showToast(`Tipo "${name}" removido.`, 'error');
    switchConfigSection('tipos');
  }
}

/* ─── SERVIÇOS ───────────────────────────── */

function renderConfigServicos() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Serviços Oferecidos</h3>
      <button class="btn btn-primary" data-action="open-servico-modal">
        <i class="fas fa-plus"></i> Novo Serviço
      </button>
    </div>
    <div id="servicos-list">
      ${SC.servicos.map((svc, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-input);
                    border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
          <span style="font-size:18px">💼</span>
          <span style="flex:1;font-size:13px;font-weight:500">${svc}</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" data-action="open-servico-modal" data-idx="${i}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm" style="background:var(--danger-subtle);color:var(--danger)" data-action="delete-servico" data-idx="${i}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`).join('')}
    </div>`;
}

function openServicoModal(idx) {
  const current = idx !== null ? SC.servicos[idx] : '';
  openModal(`
    <div class="modal-header">
      <span class="modal-title">${idx === null ? 'Novo Serviço' : 'Editar Serviço'}</span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-col">
        <label>Nome do Serviço *</label>
        <input class="input-field" id="svc-name" value="${current}" placeholder="Ex: Social Media, Design Gráfico..." />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-servico" data-idx="${idx}"><i class="fas fa-save"></i> Salvar</button>
    </div>
  `);
}

function saveServico(idx) {
  const name = document.getElementById('svc-name').value.trim();
  if (!name) { showToast('Nome é obrigatório!', 'error'); return; }
  if (idx === null) {
    SC.servicos.push(name);
    showToast(`✅ Serviço "${name}" adicionado!`, 'success');
  } else {
    SC.servicos[idx] = name;
    showToast(`✅ Serviço atualizado!`, 'success');
  }
  closeModal();
  switchConfigSection('servicos');
}

function deleteServico(idx) {
  const name = SC.servicos[idx];
  if (confirm(`Remover o serviço "${name}"?`)) {
    SC.servicos.splice(idx, 1);
    showToast(`Serviço "${name}" removido.`, 'error');
    switchConfigSection('servicos');
  }
}

/* ─── APROVAÇÃO ──────────────────────────── */

function renderConfigAprovacao() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <h3 style="font-size:16px;font-weight:700">Modelos de Aprovação</h3>
    </div>
    <div>
      ${SC.modelosAprovacao.map(m => `
        <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--bg-input);
                    border:1px solid ${m.ativo?'var(--purple-border)':'var(--border)'};
                    border-radius:var(--border-radius);margin-bottom:10px;transition:var(--transition)">
          <span style="font-size:28px">${m.icon}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px;margin-bottom:3px">${m.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${m.desc}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            ${m.ativo ? `<span class="tag tag-green" style="font-size:11px">✅ Ativo</span>` : ''}
            <button class="btn btn-sm ${m.ativo ? 'btn-secondary' : 'btn-primary'}"
                    data-action="toggle-modelo-aprovacao" data-id="${m.id}">
              ${m.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        </div>`).join('')}
    </div>
    <div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:8px;font-size:12px;color:var(--text-muted)">
      <i class="fas fa-info-circle"></i> Apenas um modelo pode estar ativo por vez.
    </div>`;
}

function toggleModeloAprovacao(id) {
  const m = SC.modelosAprovacao.find(x => x.id === id);
  if (!m) return;
  const isActivating = !m.ativo;
  SC.modelosAprovacao.forEach(x => { x.ativo = false; });
  if (isActivating) m.ativo = true;
  showToast(isActivating ? `✅ Modelo "${m.name}" ativado!` : 'Modelo desativado.', isActivating ? 'success' : 'info');
  switchConfigSection('aprovacao');
}

/* ─── INTEGRAÇÕES ───────────────────────── */

function renderConfigIntegracoes() {
  const rows = SC.clients.map(c => {
    const cfg        = MetaService.getClientConfig(c.id);
    const configured = !!(cfg && cfg.page_token && cfg.page_id);
    return `
      <tr>
        <td>
          <div style="font-weight:600">${c.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${c.services?.join(', ') || ''}</div>
        </td>
        <td>
          ${configured
            ? `<span class="tag tag-green"><i class="fab fa-facebook" style="margin-right:4px"></i>Conectado${cfg.ig_account_id ? ' + IG' : ''}</span>`
            : `<span class="tag tag-gray">Não configurado</span>`}
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${cfg?.page_name || (configured ? cfg.page_id : '—')}</td>
        <td style="text-align:right">
          <button class="btn btn-sm" data-action="open-meta-config" data-client-id="${c.id}">
            <i class="fas fa-${configured ? 'edit' : 'plug'}"></i> ${configured ? 'Editar' : 'Configurar'}
          </button>
          ${configured ? `<button class="btn btn-sm btn-danger" style="margin-left:4px" data-action="remove-meta-config" data-client-id="${c.id}" title="Remover integração"><i class="fas fa-unlink"></i></button>` : ''}
        </td>
      </tr>`;
  }).join('');

  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <h3 style="margin:0 0 4px;font-size:15px">Integrações Meta (Facebook & Instagram)</h3>
          <p style="font-size:12px;color:var(--text-muted);margin:0">Configure o Page Access Token de cada cliente para programar publicações direto no painel.</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <span class="card-title"><i class="fab fa-facebook" style="color:#1877f2;margin-right:6px"></i>Contas Meta por Cliente</span>
        </div>
        <div class="table-wrap">
          <table style="font-size:13px">
            <thead><tr><th>Cliente</th><th>Status</th><th>Página</th><th style="text-align:right">Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fas fa-question-circle" style="color:var(--purple-light);margin-right:6px"></i>Como obter o Page Access Token</span></div>
        <div style="padding:12px 0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
          <div style="padding:12px;background:rgba(24,119,242,.07);border-radius:8px;border:1px solid rgba(24,119,242,.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fas fa-code" style="color:#60a5fa;margin-right:6px"></i>1. Graph Explorer</div>
            <p style="font-size:12px;color:var(--text-muted);margin:0">Acesse <strong>developers.facebook.com/tools/explorer</strong>, selecione sua App e Page, e gere um token com <code>pages_manage_posts</code>.</p>
          </div>
          <div style="padding:12px;background:rgba(24,119,242,.07);border-radius:8px;border:1px solid rgba(24,119,242,.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fas fa-key" style="color:#60a5fa;margin-right:6px"></i>2. Token de Longa Duração</div>
            <p style="font-size:12px;color:var(--text-muted);margin:0">Converta para long-lived token (60 dias) usando o endpoint <code>/oauth/access_token?grant_type=fb_exchange_token</code>.</p>
          </div>
          <div style="padding:12px;background:rgba(24,119,242,.07);border-radius:8px;border:1px solid rgba(24,119,242,.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fab fa-instagram" style="color:#e1306c;margin-right:6px"></i>3. Instagram Business</div>
            <p style="font-size:12px;color:var(--text-muted);margin:0">A conta Instagram deve ser Business/Creator e vinculada à Página. O Account ID está em Configurações → Conta Profissional.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openMetaConfigModal(clientId) {
  const client = SC.clients.find(c => String(c.id) === String(clientId));
  if (!client) return;
  const cfg = MetaService.getClientConfig(clientId) || {};

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fab fa-facebook" style="color:#1877f2;margin-right:6px"></i>
        Meta — ${client.name}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-row">
          <div class="form-col full">
            <label>Page Access Token *</label>
            <input class="input-field" id="mc-token" type="password" placeholder="EAAxxxxx..." value="${cfg.page_token || ''}" />
            <span style="font-size:11px;color:var(--text-muted)">Token com permissão <code>pages_manage_posts</code> e <code>pages_read_engagement</code></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-col">
            <label>Facebook Page ID *</label>
            <input class="input-field" id="mc-page-id" placeholder="123456789" value="${cfg.page_id || ''}" />
          </div>
          <div class="form-col" style="display:flex;align-items:flex-end">
            <button class="btn btn-secondary" style="width:100%" data-action="verify-meta-page" data-client-id="${clientId}">
              <i class="fas fa-search"></i> Verificar página
            </button>
          </div>
        </div>
        <div id="mc-page-name-row" style="${cfg.page_name ? '' : 'display:none'}">
          <div style="padding:8px 12px;background:rgba(24,119,242,.08);border-radius:6px;font-size:12px;color:#93c5fd">
            <i class="fab fa-facebook" style="margin-right:6px"></i>
            <span id="mc-page-name-label">${cfg.page_name ? `Página: <strong>${cfg.page_name}</strong>` : ''}</span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-col full">
            <label>Instagram Business Account ID <span style="font-size:11px;color:var(--text-muted)">(opcional)</span></label>
            <input class="input-field" id="mc-ig-id" placeholder="987654321" value="${cfg.ig_account_id || ''}" />
            <span style="font-size:11px;color:var(--text-muted)">Encontre em: IG → Configurações → Conta Profissional → ID da conta</span>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-meta-config" data-client-id="${clientId}">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `);
}

async function verifyMetaPage(clientId) {
  const token  = document.getElementById('mc-token')?.value?.trim();
  const pageId = document.getElementById('mc-page-id')?.value?.trim();
  if (!token || !pageId) { showToast('Preencha o Token e o Page ID primeiro.', 'warning'); return; }

  const btn = document.querySelector('[data-action="verify-meta-page"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const result = await MetaService.fetchPageName(pageId, token);

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Verificar página'; }

  if (result.error) {
    showToast(`Erro: ${result.error.message}`, 'error');
  } else {
    const row   = document.getElementById('mc-page-name-row');
    const label = document.getElementById('mc-page-name-label');
    if (row)   row.style.display   = '';
    if (label) label.innerHTML = `Página encontrada: <strong>${result.name}</strong>`;
    showToast(`✅ Página "${result.name}" verificada!`, 'success');
  }
}

function saveMetaConfig(clientId) {
  const token      = document.getElementById('mc-token')?.value?.trim();
  const pageId     = document.getElementById('mc-page-id')?.value?.trim();
  const igId       = document.getElementById('mc-ig-id')?.value?.trim();
  const nameLabel  = document.getElementById('mc-page-name-label');
  const pageNameMatch = nameLabel?.innerHTML?.match(/<strong>(.*?)<\/strong>/);
  const pageName   = pageNameMatch ? pageNameMatch[1] : '';

  if (!token || !pageId) { showToast('Token e Page ID são obrigatórios!', 'error'); return; }

  MetaService.saveClientConfig(clientId, {
    page_token:    token,
    page_id:       pageId,
    page_name:     pageName,
    ig_account_id: igId || null,
  });

  closeModal();
  showToast('✅ Integração Meta salva!', 'success');
  switchConfigSection('integracoes');
}

function removeMetaConfig(clientId) {
  if (!confirm('Remover a integração Meta deste cliente?')) return;
  MetaService.removeClientConfig(clientId);
  showToast('Integração removida.', 'info');
  switchConfigSection('integracoes');
}

Router.register('configuracoes', renderConfiguracoes, 'Configurações');
