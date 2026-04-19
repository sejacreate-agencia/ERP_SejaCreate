// =============================================
// FINANCIAL SERVICE — Financeiro completo
// =============================================
// Contas a receber, a pagar, fluxo de caixa,
// DRE gerencial e provisionamento.

const FinancialService = {

  // ── CONTAS A RECEBER ──────────────────────

  async getReceivables() {
    return Data.receivables();
  },

  async createReceivable(payload) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.create(payload);
      if (error) throw error;
      return data;
    }
    const newRec = {
      id: Date.now(),
      client_id: payload.client_id,
      client: { id: payload.client_id, name: ClientService.getName(payload.client_id) },
      description: payload.description,
      value: Number(payload.value),
      due_date: payload.due_date,
      status: payload.status || 'pendente',
      paid_at: null,
    };
    SC.finances.receivable.push({
      id: newRec.id, client: payload.client_id, desc: payload.description,
      value: newRec.value, due: payload.due_date, status: newRec.status,
    });
    return newRec;
  },

  async updateReceivable(id, payload) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.receivables.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.finances.receivable.findIndex(r => r.id === id);
    if (idx !== -1) Object.assign(SC.finances.receivable[idx], {
      desc: payload.description, value: payload.value,
      due: payload.due_date, status: payload.status,
    });
    return SC.finances.receivable[idx];
  },

  async markReceivablePaid(id) {
    if (isSupabaseReady()) {
      const { error } = await DB.receivables.markPaid(id);
      if (error) throw error;
      return;
    }
    const item = SC.finances.receivable.find(r => r.id === id);
    if (item) item.status = 'pago';
  },

  // ── CONTAS A PAGAR ────────────────────────

  async getPayables() {
    return Data.payables();
  },

  async createPayable(payload) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.payables.create(payload);
      if (error) throw error;
      return data;
    }
    const newPay = {
      id: Date.now(),
      supplier_name: payload.supplier_name,
      description: payload.description,
      value: Number(payload.value),
      due_date: payload.due_date,
      status: payload.status || 'pendente',
      category: payload.category || 'despesa-operacional',
      recurrence_type: payload.recurrence_type || null,
      paid_at: null,
    };
    SC.finances.payable.push({
      id: newPay.id, supplier: payload.supplier_name, desc: payload.description,
      value: newPay.value, due: payload.due_date, status: newPay.status,
    });
    return newPay;
  },

  async updatePayable(id, payload) {
    if (isSupabaseReady()) {
      const { data, error } = await DB.payables.update(id, payload);
      if (error) throw error;
      return data;
    }
    const idx = SC.finances.payable.findIndex(p => p.id === id);
    if (idx !== -1) Object.assign(SC.finances.payable[idx], {
      supplier: payload.supplier_name, desc: payload.description,
      value: payload.value, due: payload.due_date, status: payload.status,
    });
    return SC.finances.payable[idx];
  },

  async markPayablePaid(id) {
    if (isSupabaseReady()) {
      const { error } = await DB.payables.markPaid(id);
      if (error) throw error;
      return;
    }
    const item = SC.finances.payable.find(p => p.id === id);
    if (item) item.status = 'pago';
  },

  // ── PROVISIONAMENTO ───────────────────────
  // Cria N lançamentos futuros a partir de uma
  // conta a pagar recorrente.

  async createProvisionedPayable(payload, months = 3) {
    const created = [];
    const baseDate = new Date(payload.due_date);

    for (let i = 0; i < months; i++) {
      const dueDate = new Date(baseDate);

      if (payload.recurrence_type === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (payload.recurrence_type === 'quarterly') {
        dueDate.setMonth(dueDate.getMonth() + i * 3);
      } else if (payload.recurrence_type === 'annual') {
        dueDate.setFullYear(dueDate.getFullYear() + i);
      } else {
        break; // sem recorrência: cria apenas 1
      }

      const dueDateStr = dueDate.toISOString().split('T')[0];
      const suffix = months > 1 ? ` (${i + 1}/${months})` : '';

      const entry = await this.createPayable({
        ...payload,
        due_date: dueDateStr,
        description: payload.description + suffix,
        status: 'pendente',
      });

      created.push(entry);
    }

    return created;
  },

  // ── RESUMO FINANCEIRO ─────────────────────
  // Retorna KPIs agregados para os cards do topo.

  async getSummary() {
    const [receivables, payables] = await Promise.all([
      this.getReceivables(),
      this.getPayables(),
    ]);

    const today = new Date().toDateString();

    const totalRec      = receivables.reduce((s, r) => s + (r.value || 0), 0);
    const totalRecPago  = receivables.filter(r => r.status === 'pago').reduce((s, r) => s + r.value, 0);
    const totalRecPend  = receivables.filter(r => r.status === 'pendente').reduce((s, r) => s + r.value, 0);
    const totalRecAtr   = receivables.filter(r => {
      return r.status !== 'pago' && r.due_date && new Date(r.due_date) < new Date(today);
    }).reduce((s, r) => s + r.value, 0);

    const totalPay      = payables.reduce((s, p) => s + (p.value || 0), 0);
    const totalPayPago  = payables.filter(p => p.status === 'pago').reduce((s, p) => s + p.value, 0);
    const totalPayPend  = payables.filter(p => p.status === 'pendente').reduce((s, p) => s + p.value, 0);

    const saldo = totalRecPago - totalPayPago;

    return {
      totalRec, totalRecPago, totalRecPend, totalRecAtr,
      totalPay, totalPayPago, totalPayPend,
      saldo,
      receivables,
      payables,
    };
  },

  // ── FLUXO DE CAIXA ────────────────────────
  // Retorna entradas vs saídas por mês.
  // months: quantos meses exibir (padrão 6).

  async getCashflow(months = 6) {
    if (isSupabaseReady()) {
      // Com Supabase: agrega do banco pelos paid_at
      const [rec, pay] = await Promise.all([
        this.getReceivables(),
        this.getPayables(),
      ]);
      return this._computeCashflow(rec, pay, months);
    }
    // Modo demo: usa dados mock
    return SC.finances.cashflow.slice(-months);
  },

  _computeCashflow(receivables, payables, months) {
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      const inflow = receivables
        .filter(r => r.status === 'pago' && r.paid_at)
        .filter(r => {
          const pd = new Date(r.paid_at);
          return pd.getFullYear() === y && pd.getMonth() === m;
        })
        .reduce((s, r) => s + r.value, 0);

      const outflow = payables
        .filter(p => p.status === 'pago' && p.paid_at)
        .filter(p => {
          const pd = new Date(p.paid_at);
          return pd.getFullYear() === y && pd.getMonth() === m;
        })
        .reduce((s, p) => s + p.value, 0);

      result.push({ month: monthNames[m], year: y, in: inflow, out: outflow });
    }

    return result;
  },

  // ── DRE GERENCIAL ─────────────────────────
  // Demonstrativo de Resultado do Exercício
  // simplificado por período.

  async getDRE(month, year) {
    const [receivables, payables] = await Promise.all([
      this.getReceivables(),
      this.getPayables(),
    ]);

    const inPeriod = (item) => {
      const dateStr = item.paid_at || item.due_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    };

    // Receita Bruta = recebíveis pagos no período
    const receitaBruta = receivables
      .filter(r => r.status === 'pago' && inPeriod(r))
      .reduce((s, r) => s + r.value, 0);

    // Custos Diretos = contas a pagar com category='custo-direto' pagas no período
    const custosDiretos = payables
      .filter(p => p.status === 'pago' && inPeriod(p) && p.category === 'custo-direto')
      .reduce((s, p) => s + p.value, 0);

    // Despesas Operacionais = demais contas pagas no período
    const despesasOp = payables
      .filter(p => p.status === 'pago' && inPeriod(p) && p.category !== 'custo-direto')
      .reduce((s, p) => s + p.value, 0);

    // Totais derivados
    const receitaLiquida = receitaBruta;           // sem deduções por ora
    const margemBruta    = receitaLiquida - custosDiretos;
    const ebitda         = margemBruta - despesasOp;

    const pct = (v) => receitaBruta > 0 ? Math.round((v / receitaBruta) * 100) : 0;

    return [
      { label: 'Receita Bruta',          value: receitaBruta,   type: 'revenue', pct: pct(receitaBruta) },
      { label: 'Deduções',               value: 0,              type: 'deduction', pct: 0 },
      { label: 'Receita Líquida',        value: receitaLiquida, type: 'subtotal', pct: pct(receitaLiquida) },
      { label: 'Custos Diretos',         value: custosDiretos,  type: 'cost', pct: pct(custosDiretos) },
      { label: 'Margem Bruta',           value: margemBruta,    type: 'subtotal', pct: pct(margemBruta) },
      { label: 'Despesas Operacionais',  value: despesasOp,     type: 'expense', pct: pct(despesasOp) },
      { label: 'EBITDA',                 value: ebitda,         type: 'total', pct: pct(ebitda) },
    ];
  },

  // ── MARCA PAGO (unificado) ─────────────────

  async markPaid(type, id) {
    const numId = parseInt(id);
    if (type === 'receivable') {
      await this.markReceivablePaid(numId);
    } else if (type === 'payable') {
      await this.markPayablePaid(numId);
    }
  },
};
