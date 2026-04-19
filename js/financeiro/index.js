// =============================================
// FINANCEIRO — Orquestrador principal
// =============================================

let finTab          = 'visao-geral';
let finChart        = null;
let _recData        = [];
let _payData        = [];
let _recDataAll     = []; // cópia completa antes do filtro
let _payDataAll     = []; // cópia completa antes do filtro
let _finFilterYear  = new Date().getFullYear();
let _finFilterMonth = 0; // 0 = todos os meses

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
    <!-- FILTRO MÊS/ANO -->
    <div class="filters-bar" style="margin-bottom:16px">
      <span class="filter-label"><i class="fas fa-filter"></i> Período:</span>
      <select class="filter-select" id="fin-filter-month" data-action="switch-fin-filter">${monthOpts}</select>
      <select class="filter-select" id="fin-filter-year"  data-action="switch-fin-filter">${yearOpts}</select>
      ${_finFilterMonth ? `<span class="tag tag-purple" style="font-size:11px">${mLabels[_finFilterMonth-1]}/${_finFilterYear}</span>` : ''}
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

    <!-- TABS -->
    <div class="tabs">
      <button class="tab-btn ${finTab==='visao-geral'?'active':''}" data-action="switch-fin-tab" data-tab="visao-geral"><i class="fas fa-chart-line"></i> Visão Geral</button>
      <button class="tab-btn ${finTab==='receber'?'active':''}" data-action="switch-fin-tab" data-tab="receber"><i class="fas fa-arrow-down"></i> A Receber</button>
      <button class="tab-btn ${finTab==='pagar'?'active':''}" data-action="switch-fin-tab" data-tab="pagar"><i class="fas fa-arrow-up"></i> A Pagar</button>
      <button class="tab-btn ${finTab==='inadimplencia'?'active':''}" data-action="switch-fin-tab" data-tab="inadimplencia"><i class="fas fa-exclamation-circle"></i> Inadimplência</button>
      <button class="tab-btn ${finTab==='fluxo-caixa'?'active':''}" data-action="switch-fin-tab" data-tab="fluxo-caixa"><i class="fas fa-water"></i> Fluxo de Caixa</button>
      <button class="tab-btn ${finTab==='dre'?'active':''}" data-action="switch-fin-tab" data-tab="dre"><i class="fas fa-file-invoice-dollar"></i> DRE</button>
      <button class="tab-btn ${finTab==='plano-contas'?'active':''}" data-action="switch-fin-tab" data-tab="plano-contas"><i class="fas fa-sitemap"></i> Plano de Contas</button>
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
    setTimeout(() => renderFcChart(), 100);
  }

  if (!SC.hasPermission('financeiro')) {
    document.querySelectorAll('[data-perm="financial"]').forEach(el => el.style.display = 'none');
  }
}

Router.register('financeiro', renderFinanceiro, 'Financeiro');
