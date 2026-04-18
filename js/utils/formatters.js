// =============================================
// FORMATTERS — Funções puras de formatação
// =============================================
// Nenhuma dependência externa. Seguras para uso
// em qualquer camada (services, components, pages).

const Fmt = {

  currency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return 'R$ ' + Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // Aceita ISO (2025-03-28), ISO com hora (2025-03-28T10:00:00) ou DD/MM/YYYY
  dateBR(d) {
    if (!d) return '—';
    try {
      const str = String(d).split('T')[0];
      const p = str.split('-');
      if (p.length < 3 || p[0].length !== 4) return String(d);
      return `${p[2]}/${p[1]}/${p[0]}`;
    } catch { return String(d); }
  },

  // Converte DD/MM/YYYY → YYYY-MM-DD (para salvar no banco)
  dateISO(ddmmyyyy) {
    if (!ddmmyyyy) return null;
    const p = String(ddmmyyyy).split('/');
    if (p.length < 3) return ddmmyyyy;
    return `${p[2]}-${p[1]}-${p[0]}`;
  },

  // Retorna "Março/2025" a partir de YYYY-MM-DD ou YYYY-MM
  monthYear(isoDate) {
    if (!isoDate) return '—';
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const p = String(isoDate).split('-');
    const m = parseInt(p[1], 10) - 1;
    return `${months[m] || p[1]}/${p[0]}`;
  },

  phone(raw) {
    if (!raw) return '—';
    const d = String(raw).replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return raw;
  },

  cnpj(raw) {
    if (!raw) return '—';
    const d = String(raw).replace(/\D/g, '');
    if (d.length !== 14) return raw;
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  },

  truncate(str, max = 40) {
    if (!str) return '';
    return String(str).length > max ? String(str).slice(0, max) + '...' : String(str);
  },

  percentage(value, total) {
    if (!total || total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  },
};

// Aliases de compatibilidade — mantêm o código antigo funcionando
// enquanto a migração gradual ocorre.
function formatDateBR(d) { return Fmt.dateBR(d); }
