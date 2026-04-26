// =============================================
// FINANCEIRO — Orquestrador principal
// =============================================

const _FIN_LABELS = {
  'visao-geral':   'Visão Geral',
  'receber':       'A Receber',
  'pagar':         'A Pagar',
  'inadimplencia': 'Inadimplência',
  'fluxo-caixa':   'Fluxo de Caixa',
  'dre':           'DRE',
  'plano-contas':  'Plano de Contas',
};

let finTab          = 'visao-geral';
let finRegime       = 'competencia'; // 'caixa' | 'competencia'
let finChart        = null;
let _recData        = [];
let _payData        = [];
let _recDataAll     = [];
let _payDataAll     = [];
let _finFilterYear  = new Date().getFullYear();
let _finFilterMonth = 0;

const _CONTAS_BANCARIAS = ['Conta Corrente Principal', 'Conta Poupança', 'Caixa', 'Conta Digital', 'Conta Empresarial'];
const _CENTROS_CUSTO    = ['Geral', 'Marketing', 'Operações', 'Comercial', 'RH', 'TI', 'Administrativo'];

async function renderFinanceiro(tab) {
  if (tab) finTab = tab;

  const pc = document.getElementById('page-content');
  pc.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 class="page-title">Financeiro</h1>
          <p class="page-subtitle">Controle financeiro completo da agência</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-action="open-new-lanc-modal"><i class="fas fa-plus"></i> Novo Lançamento</button>
        </div>
      </div>
    </div>
    <div id="fin-summary-area">
      <div class="loading-state" style="padding:30px 0"><i class="fas fa-spinner fa-spin"></i> Carregando dados financeiros...</div>
    </div>
  `;

  [_recDataAll, _payDataAll] = await Promise.all([Data.receivables(), Data.payables()]);
  _recData = [..._recDataAll];
  _payData = [..._payDataAll];
  _renderFinContent();
}

function _applyFinFilter(data) {
  if (!_finFilterMonth) return data;
  return data.filter(r => {
    const d = (r.due_date || r.due || '').split('T')[0];
    if (!d) return false;
    const parts = d.split('-');
    return parseInt(parts[0]) === _finFilterYear && parseInt(parts[1]) === _finFilterMonth;
  });
}

function switchFinFilter() {
  const yearEl  = document.getElementById('fin-filter-year');
  const monthEl = document.getElementById('fin-filter-month');
  if (yearEl)  _finFilterYear  = parseInt(yearEl.value);
  if (monthEl) _finFilterMonth = parseInt(monthEl.value);
  _recData = [..._recDataAll];
  _payData = [..._payDataAll];
  _renderFinContent();
}

function _renderFinContent() {
  // Aplica filtro mês/ano sobre os dados completos
  _recData = _applyFinFilter([..._recDataAll]);
  _payData = _applyFinFilter([..._payDataAll]);

  const totalRec     = _recData.reduce((s, r) => s + (r.value || 0), 0);
  const totalPago    = _recData.filter(r => r.status === 'pago').reduce((s, r) => s + (r.value || 0), 0);
  const totalPend    = _recData.filter(r => r.status === 'pendente').reduce((s, r) => s + (r.value || 0), 0);
  const totalAtras   = _recData.filter(r => r.status === 'atrasado').reduce((s, r) => s + (r.value || 0), 0);
  const totalPay     = _payData.reduce((s, r) => s + (r.value || 0), 0);
  const totalPayPago = _payData.filter(r => r.status === 'pago').reduce((s, r) => s + (r.value || 0), 0);

  const finSummaryArea = document.getElementById('fin-summary-area');
  if (!finSummaryArea) return;

  const curYear = new Date().getFullYear();
  const yearOpts = [curYear-1, curYear, curYear+1].map(y =>
    `<option value="${y}" ${y === _finFilterYear ? 'selected' : ''}>${y}</option>`
  ).join('');
  const mLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthOpts = `<option value="0" ${!_finFilterMonth ? 'selected' : ''}>Todos os meses</option>` +
    mLabels.map((m, i) =>
      `<option value="${i+1}" ${(i+1) === _finFilterMonth ? 'selected' : ''}>${m}</option>`
    ).join('');

  finSummaryArea.innerHTML = `
    <!-- FILTRO MÊS/ANO + REGIME -->
    <div class="filters-bar" style="margin-bottom:16px">
      <span class="filter-label"><i class="fas fa-filter"></i> Período:</span>
      <select class="filter-select" id="fin-filter-month" data-action="switch-fin-filter">${monthOpts}</select>
      <select class="filter-select" id="fin-filter-year"  data-action="switch-fin-filter">${yearOpts}</select>
      ${_finFilterMonth ? `<span class="tag tag-purple" style="font-size:11px">${mLabels[_finFilterMonth-1]}/${_finFilterYear}</span>` : ''}
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">Regime:</span>
        <select class="filter-select" id="fin-regime-select" data-action="switch-fin-regime" style="min-width:145px">
          <option value="competencia" ${finRegime==='competencia'?'selected':''}>📊 Competência</option>
          <option value="caixa"       ${finRegime==='caixa'      ?'selected':''}>💰 Caixa</option>
        </select>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div class="fin-summary">
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Faturamento do Mês</div>
        <div class="fin-value positive">${SC.formatCurrency(totalRec)}</div>
        <div class="fin-sub">Total a receber</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Recebido</div>
        <div class="fin-value positive">${SC.formatCurrency(totalPago)}</div>
        <div class="fin-sub">${_recData.filter(r=>r.status==='pago').length} faturas pagas</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">A Receber</div>
        <div class="fin-value neutral">${SC.formatCurrency(totalPend)}</div>
        <div class="fin-sub">${_recData.filter(r=>r.status==='pendente').length} faturas pendentes</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Inadimplência</div>
        <div class="fin-value negative">${SC.formatCurrency(totalAtras)}</div>
        <div class="fin-sub" style="color:var(--danger)">${_recData.filter(r=>r.status==='atrasado').length} fatura(s) atrasada(s)</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Contas a Pagar</div>
        <div class="fin-value negative">${SC.formatCurrency(totalPay)}</div>
        <div class="fin-sub">${_payData.length} fornecedores</div>
      </div>
      <div class="fin-card" data-perm="financial">
        <div class="fin-label">Saldo do Período</div>
        <div class="fin-value ${(totalPago-totalPayPago)>=0?'positive':'negative'}">${SC.formatCurrency(totalPago - totalPayPago)}</div>
        <div class="fin-sub">Recebido − Pago</div>
      </div>
    </div>

    <div id="fin-tab-content">
      ${finTab === 'visao-geral'    ? renderFinVisaoGeral()       :
        finTab === 'receber'        ? renderFinReceber()           :
        finTab === 'pagar'          ? renderFinPagar()             :
        finTab === 'fluxo-caixa'    ? renderFinFluxoCaixa()        :
        finTab === 'dre'            ? renderFinDRE()               :
        finTab === 'plano-contas'   ? renderFinPlanoDeContas()     :
        renderFinInadimplencia()}
    </div>
  `;

  if (finTab === 'visao-geral') {
    setTimeout(() => renderFluxoCaixa(), 100);
  }
  if (finTab === 'fluxo-caixa') {
    setTimeout(() => { renderFcChart(); _renderFcBody(); }, 100);
  }

  if (!SC.hasPermission('financeiro')) {
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  }

  _syncFinSidebarActive();
}

function switchFinRegime(regime) {
  finRegime = regime;
  _renderFinContent();
}

function _finStatusTag(status) {
  const map = {
    pago:              { cls: 'tag-green',  label: 'Pago' },
    pendente:          { cls: 'tag-yellow', label: 'Pendente' },
    atrasado:          { cls: 'tag-red',    label: 'Vencido' },
    previsto:          { cls: 'tag-blue',   label: 'Previsto' },
    parcialmente_pago: { cls: 'tag-purple', label: 'Parcial' },
    cancelado:         { cls: 'tag-gray',   label: 'Cancelado' },
    provisionado:      { cls: 'tag-gray',   label: 'Provisionado' },
  };
  const { cls, label } = map[status] || { cls: 'tag-gray', label: status };
  return `<span class="tag ${cls}">${label}</span>`;
}

function _guessDreGrupo(p) {
  const desc = (p.description || p.desc || p.supplier_name || '').toLowerCase();
  if (/salário|salario|folha|funcionário|funcionario|colaborador|férias|ferias|13º/.test(desc)) return 'folha';
  if (/terceiro|freelance|produção|custo|fornecedor|gráfica|grafica|video|foto/.test(desc)) return 'custos_diretos';
  return 'despesas_op';
}

function _computeDreMonths() {
  const dateField = finRegime === 'caixa' ? 'paid_at' : 'due_date';
  const today = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleString('pt-BR',{month:'short'}).replace('.','') + '/' + String(d.getFullYear()).slice(2);
    months.push({ key, month: label, receita:0, custos_diretos:0, folha:0, despesas_op:0, impostos:0 });
  }
  const monthKeys = months.map(m => m.key);

  (_recDataAll||[]).forEach(r => {
    const ds = (dateField==='paid_at' ? (r.paid_at||r.paid_date||r.due_date||'') : (r.due_date||r.due||'')).slice(0,7);
    if (!monthKeys.includes(ds)) return;
    if (finRegime==='caixa' && r.status!=='pago' && r.status!=='parcialmente_pago') return;
    if (r.status==='cancelado') return;
    const m = months.find(x=>x.key===ds);
    if (m) m.receita += (r.valor_pago||r.value||0);
  });

  (_payDataAll||[]).forEach(p => {
    const ds = (dateField==='paid_at' ? (p.paid_at||p.paid_date||p.due_date||'') : (p.due_date||p.due||'')).slice(0,7);
    if (!monthKeys.includes(ds)) return;
    if (finRegime==='caixa' && p.status!=='pago' && p.status!=='parcialmente_pago') return;
    if (p.status==='cancelado' || p.status==='provisionado') return;
    const conta = p.conta_id ? SC.planoDeContas.find(c=>c.id===parseInt(p.conta_id)) : null;
    const grupo = conta?.dre_grupo || _guessDreGrupo(p);
    const m = months.find(x=>x.key===ds);
    if (m) {
      if (grupo==='folha') m.folha += (p.valor_pago||p.value||0);
      else if (grupo==='custos_diretos') m.custos_diretos += (p.valor_pago||p.value||0);
      else m.despesas_op += (p.valor_pago||p.value||0);
    }
  });

  return months.map(m => ({ ...m, impostos: Math.round(m.receita*0.06) }));
}

function _syncFinSidebarActive() {
  document.querySelectorAll('.nav-item[data-fin-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.finTab === finTab);
  });
  const bc = document.getElementById('page-breadcrumb');
  if (bc) bc.textContent = _FIN_LABELS[finTab] || 'Financeiro';
}

function navigateFinTab(tab) {
  finTab = tab || 'visao-geral';
  if (SC.currentPage !== 'financeiro') {
    Router.navigate('financeiro');
  } else {
    _renderFinContent();
  }
  _syncFinSidebarActive();
}

Router.register('financeiro', renderFinanceiro, 'Financeiro');
