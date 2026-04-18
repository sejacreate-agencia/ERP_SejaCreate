// Configuração da aplicação.
// Para desenvolvimento local, crie js/config.local.js com suas credenciais reais.
// O config.local.js é carregado ANTES deste arquivo pelo index.html.
// Se não existir, a aplicação roda em modo demo (sem Supabase).

window.APP_CONFIG = window.APP_CONFIG || {
  supabaseUrl: null,
  supabaseAnonKey: null,
};

window.APP_VERSION = '2.0.0';
window.APP_NAME = 'ERP SejaCreate';
