// =============================================
// DOM HELPERS — Atalhos para manipulação de DOM
// =============================================

const Dom = {

  // Seleciona um elemento (atalho para querySelector)
  $(selector, ctx = document) {
    return ctx.querySelector(selector);
  },

  // Seleciona múltiplos elementos como Array
  $$(selector, ctx = document) {
    return Array.from(ctx.querySelectorAll(selector));
  },

  show(target) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) { el.style.display = ''; el.classList.remove('hidden'); }
  },

  hide(target) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.style.display = 'none';
  },

  toggle(target, force) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    if (force === true) el.style.display = '';
    else if (force === false) el.style.display = 'none';
    else el.style.display = el.style.display === 'none' ? '' : 'none';
  },

  addClass(target, cls) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.classList.add(cls);
  },

  removeClass(target, cls) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.classList.remove(cls);
  },

  toggleClass(target, cls) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (el) el.classList.toggle(cls);
  },

  // Define innerHTML de um elemento pelo id
  setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  },

  // Define textContent de um elemento pelo id (seguro contra XSS)
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  // Retorna o valor de um input pelo id
  val(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  },

  // Define o valor de um input pelo id
  setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  },

  // Executa fn quando o DOM estiver pronto
  onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  },

  // Cria elemento com atributos e filhos opcionais
  createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === 'string') el.insertAdjacentHTML('beforeend', child);
      else el.appendChild(child);
    }
    return el;
  },
};

// Alias global curto para uso em templates HTML gerados por JS
const $ = (sel, ctx) => Dom.$(sel, ctx);
const $$ = (sel, ctx) => Dom.$$(sel, ctx);
