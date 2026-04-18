// =============================================
// VALIDATORS — Funções puras de validação
// =============================================

const Validators = {

  isRequired(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  },

  email(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  },

  phone(phone) {
    const d = String(phone).replace(/\D/g, '');
    return d.length >= 10 && d.length <= 11;
  },

  // Valida CNPJ com algoritmo oficial da Receita Federal
  cnpj(raw) {
    const c = String(raw).replace(/\D/g, '');
    if (c.length !== 14) return false;
    if (/^(\d)\1+$/.test(c)) return false;

    const calc = (str, weights) => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += parseInt(str[i]) * weights[i];
      const rem = sum % 11;
      return rem < 2 ? 0 : 11 - rem;
    };

    const d1 = calc(c, [5,4,3,2,9,8,7,6,5,4,3,2]);
    const d2 = calc(c, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return parseInt(c[12]) === d1 && parseInt(c[13]) === d2;
  },

  positiveNumber(n) {
    return !isNaN(n) && Number(n) > 0;
  },

  date(str) {
    if (!str) return false;
    const d = new Date(str);
    return d instanceof Date && !isNaN(d);
  },

  // Valida múltiplos campos de uma vez.
  // fields: [{ id: 'input-id', label: 'Nome', rules: ['required', 'email'] }]
  // Retorna: { valid: boolean, errors: { fieldId: 'mensagem de erro' } }
  form(fields) {
    const errors = {};

    for (const field of fields) {
      const el = document.getElementById(field.id);
      const value = el ? el.value : '';

      for (const rule of (field.rules || [])) {
        if (rule === 'required' && !Validators.isRequired(value)) {
          errors[field.id] = `${field.label || field.id} é obrigatório`;
          break;
        }
        if (rule === 'email' && value && !Validators.email(value)) {
          errors[field.id] = `${field.label || field.id} inválido`;
          break;
        }
        if (rule === 'phone' && value && !Validators.phone(value)) {
          errors[field.id] = `${field.label || field.id} inválido`;
          break;
        }
        if (rule === 'cnpj' && value && !Validators.cnpj(value)) {
          errors[field.id] = `CNPJ inválido`;
          break;
        }
        if (rule === 'positive' && value && !Validators.positiveNumber(value)) {
          errors[field.id] = `${field.label || field.id} deve ser maior que zero`;
          break;
        }
        if (rule === 'date' && value && !Validators.date(value)) {
          errors[field.id] = `Data inválida`;
          break;
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  // Aplica borda vermelha nos campos com erro e remove dos válidos
  highlightErrors(errors) {
    // Limpa erros anteriores
    document.querySelectorAll('.field-error').forEach(el => {
      el.style.borderColor = '';
      el.classList.remove('field-error');
    });
    document.querySelectorAll('.field-error-msg').forEach(el => el.remove());

    for (const [id, msg] of Object.entries(errors)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.borderColor = '#ef4444';
      el.classList.add('field-error');
      const span = document.createElement('span');
      span.className = 'field-error-msg';
      span.style.cssText = 'color:#ef4444;font-size:11px;display:block;margin-top:3px;';
      span.textContent = msg;
      el.parentNode.appendChild(span);
    }
  },
};
