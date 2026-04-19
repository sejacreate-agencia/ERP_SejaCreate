// =============================================
// FINANCEIRO — Plano de Contas
// =============================================

const DRE_GRUPO_LABELS = {
  receita:        'Receita Bruta de Serviços',
  impostos:       'Impostos e Deduções',
  custos_diretos: 'Custo de Produção / Terceiros',
  folha:          'Folha de Pagamento',
  despesas_op:    'Despesas Operacionais',
};

function renderFinPlanoDeContas() {
  const contas = SC.planoDeContas;
  const grupos = SC.dreGrupos;

  const byGrupo = {};
  grupos.forEach(g => { byGrupo[g.id] = []; });
  contas.forEach(c => { if (byGrupo[c.dre_grupo]) byGrupo[c.dre_grupo].push(c); });

  const grupoRows = grupos.map(g => {
    const lista = byGrupo[g.id] || [];
    const rows  = lista.map(c => `
      <tr>
        <td style="padding-left:24px;color:var(--text-secondary);font-size:12px">${c.codigo}</td>
        <td>${c.nome}</td>
        <td><span class="status-tag status-${c.tipo === 'receita' ? 'green' : 'red'}">${c.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td>
        <td><span class="status-tag status-${c.ativo ? 'green' : 'gray'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td style="text-align:right">
          <button class="btn btn-sm" data-action="open-conta-modal" data-id="${c.id}" style="margin-right:4px"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm" data-action="toggle-conta-status" data-id="${c.id}" title="${c.ativo ? 'Desativar' : 'Ativar'}">
            <i class="fas fa-${c.ativo ? 'eye-slash' : 'eye'}"></i>
          </button>
        </td>
      </tr>`).join('');

    return `
      <tr style="background:rgba(255,255,255,0.03)">
        <td colspan="5" style="padding:8px 12px;font-size:11px;font-weight:700;
          color:var(--text-secondary);letter-spacing:.06em;text-transform:uppercase">
          ${g.label}
        </td>
      </tr>
      ${rows || `<tr><td colspan="5" style="padding:8px 24px;font-size:12px;color:var(--text-secondary)">Nenhuma conta cadastrada</td></tr>`}
    `;
  }).join('');

  return `
    <div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <p style="font-size:13px;color:var(--text-secondary);margin:0">
            Classifique suas receitas e despesas para alimentar a DRE automaticamente.
          </p>
        </div>
        <button class="btn btn-primary" data-action="open-conta-modal" data-id="">
          <i class="fas fa-plus"></i> Nova Conta
        </button>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <i class="fas fa-sitemap" style="color:var(--purple-light);margin-right:8px"></i>
            Plano de Contas — ${contas.length} contas cadastradas
          </span>
        </div>
        <div class="table-wrap">
          <table style="font-size:13px">
            <thead>
              <tr>
                <th style="width:90px">Código</th>
                <th>Nome da Conta</th>
                <th style="width:100px">Tipo</th>
                <th style="width:80px">Status</th>
                <th style="width:100px;text-align:right">Ações</th>
              </tr>
            </thead>
            <tbody>${grupoRows}</tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <span class="card-title">
            <i class="fas fa-info-circle" style="color:var(--purple-light);margin-right:8px"></i>
            Como funciona
          </span>
        </div>
        <div style="padding:12px 0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div style="padding:12px;background:rgba(139,92,246,0.06);border-radius:8px;border:1px solid rgba(139,92,246,0.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fas fa-list" style="color:var(--purple-light);margin-right:6px"></i>1. Crie as contas</div>
            <p style="font-size:12px;color:var(--text-secondary);margin:0">Defina o código, nome e o grupo da DRE que cada conta alimenta.</p>
          </div>
          <div style="padding:12px;background:rgba(139,92,246,0.06);border-radius:8px;border:1px solid rgba(139,92,246,0.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fas fa-tags" style="color:var(--purple-light);margin-right:6px"></i>2. Classifique lançamentos</div>
            <p style="font-size:12px;color:var(--text-secondary);margin:0">Ao criar um lançamento, selecione a conta contábil correspondente.</p>
          </div>
          <div style="padding:12px;background:rgba(139,92,246,0.06);border-radius:8px;border:1px solid rgba(139,92,246,0.15)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px"><i class="fas fa-chart-bar" style="color:var(--purple-light);margin-right:6px"></i>3. DRE automática</div>
            <p style="font-size:12px;color:var(--text-secondary);margin:0">A DRE consolida os valores por grupo automaticamente a cada lançamento.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openContaModal(id) {
  const conta  = id ? SC.planoDeContas.find(c => c.id === parseInt(id)) : null;
  const grupos = SC.dreGrupos;

  const grupoOpts = grupos.map(g =>
    `<option value="${g.id}" ${conta?.dre_grupo === g.id ? 'selected' : ''}>${g.label}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <span class="modal-title">
        <i class="fas fa-${conta ? 'edit' : 'plus'}" style="color:var(--purple-light);margin-right:8px"></i>
        ${conta ? 'Editar Conta' : 'Nova Conta'}
      </span>
      <button class="modal-close" data-action="close-modal"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-col" style="flex:0 0 140px">
          <label>Código *</label>
          <input class="input-field" id="conta-codigo" placeholder="Ex: 5.1.4" value="${conta?.codigo || ''}" />
        </div>
        <div class="form-col">
          <label>Nome da Conta *</label>
          <input class="input-field" id="conta-nome" placeholder="Ex: Aluguel e Infraestrutura" value="${conta?.nome || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label>Grupo DRE *</label>
          <select class="select-field" id="conta-grupo">
            <option value="">— Selecione —</option>
            ${grupoOpts}
          </select>
        </div>
        <div class="form-col">
          <label>Tipo</label>
          <select class="select-field" id="conta-tipo">
            <option value="receita"  ${conta?.tipo === 'receita'  ? 'selected' : ''}>Receita</option>
            <option value="despesa"  ${conta?.tipo === 'despesa'  ? 'selected' : ''}>Despesa</option>
          </select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      ${conta ? `<button class="btn btn-danger" data-action="delete-conta" data-id="${conta.id}"><i class="fas fa-trash"></i> Excluir</button>` : ''}
      <button class="btn btn-secondary" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" data-action="save-conta" data-id="${conta?.id || ''}">
        <i class="fas fa-save"></i> Salvar
      </button>
    </div>
  `);
}

function saveConta(id) {
  const codigo = document.getElementById('conta-codigo').value.trim();
  const nome   = document.getElementById('conta-nome').value.trim();
  const grupo  = document.getElementById('conta-grupo').value;
  const tipo   = document.getElementById('conta-tipo').value;

  if (!codigo || !nome || !grupo) {
    showToast('Preencha todos os campos obrigatórios!', 'error');
    return;
  }

  if (id) {
    const conta = SC.planoDeContas.find(c => c.id === parseInt(id));
    if (conta) Object.assign(conta, { codigo, nome, dre_grupo: grupo, tipo });
    showToast('✅ Conta atualizada!', 'success');
  } else {
    const newId = Math.max(...SC.planoDeContas.map(c => c.id), 0) + 1;
    SC.planoDeContas.push({ id: newId, codigo, nome, tipo, dre_grupo: grupo, ativo: true });
    showToast('✅ Conta criada!', 'success');
  }

  closeModal();
  renderFinanceiro('plano-contas');
}

function deleteContaConfirm(id) {
  const idx = SC.planoDeContas.findIndex(c => c.id === parseInt(id));
  if (idx === -1) return;
  SC.planoDeContas.splice(idx, 1);
  closeModal();
  showToast('Conta excluída.', 'success');
  renderFinanceiro('plano-contas');
}

function toggleContaStatus(id) {
  const conta = SC.planoDeContas.find(c => c.id === parseInt(id));
  if (!conta) return;
  conta.ativo = !conta.ativo;
  showToast(conta.ativo ? '✅ Conta ativada!' : 'Conta desativada.', 'success');
  renderFinanceiro('plano-contas');
}
