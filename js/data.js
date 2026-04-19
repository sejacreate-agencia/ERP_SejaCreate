// =============================================
// SEJA CREATE — DADOS SIMULADOS
// =============================================

const SC = {
  currentUser: null,
  currentPage: 'dashboard',

  users: [
    { id: 1, name: 'Ana Paula Silva', role: 'admin', avatar: 'AP', email: 'ana@sejacreate.com', cargo: 'Administradora' },
    { id: 2, name: 'Bruno Carvalho', role: 'gestor', avatar: 'BC', email: 'bruno@sejacreate.com', cargo: 'Gestor de Projetos' },
    { id: 3, name: 'Camila Rocha', role: 'social', avatar: 'CR', email: 'camila@sejacreate.com', cargo: 'Social Media' },
    { id: 4, name: 'Diego Martins', role: 'designer', avatar: 'DM', email: 'diego@sejacreate.com', cargo: 'Designer' },
    { id: 5, name: 'Fernanda Luz', role: 'comercial', avatar: 'FL', email: 'fernanda@sejacreate.com', cargo: 'Comercial' },
    { id: 6, name: 'Gabriel Costa', role: 'financeiro', avatar: 'GC', email: 'gabriel@sejacreate.com', cargo: 'Financeiro' },
    { id: 7, name: 'Helena Neves', role: 'cliente', avatar: 'HN', email: 'helena@cliente.com', cargo: 'Cliente' },
  ],

  roleLabels: {
    admin: 'Administrador', gestor: 'Gestor', social: 'Social Media',
    designer: 'Designer', comercial: 'Comercial', financeiro: 'Financeiro', cliente: 'Cliente'
  },

  clients: [
    { id: 1, name: 'TechVision Soluções', resp: 'Carlos Mendes', email: 'carlos@techvision.com', phone: '(11) 9 8765-4321', cnpj: '12.345.678/0001-90', services: ['Social Media', 'Design', 'Tráfego Pago'], plan: 'Premium', start: '2024-01-15', expiry: '2025-01-15', status: 'ativo', revenue: 8500 },
    { id: 2, name: 'Bella Moda Store', resp: 'Patricia Sousa', email: 'paty@bellamoda.com', phone: '(11) 9 7654-3210', cnpj: '98.765.432/0001-10', services: ['Social Media', 'Design'], plan: 'Padrão', start: '2024-03-01', expiry: '2025-03-01', status: 'ativo', revenue: 5200 },
    { id: 3, name: 'Construtora Rocha & Cia', resp: 'Roberto Rocha', email: 'roberto@rocha.com', phone: '(21) 9 6543-2109', cnpj: '56.789.012/0001-34', services: ['Branding', 'Design'], plan: 'Starter', start: '2023-11-01', expiry: '2024-11-01', status: 'ativo', revenue: 3800 },
    { id: 4, name: 'Café Aroma Especial', resp: 'Mariana Luz', email: 'mariana@aromaespecial.com', phone: '(11) 9 5432-1098', cnpj: '34.567.890/0001-56', services: ['Social Media'], plan: 'Basic', start: '2024-06-01', expiry: '2025-06-01', status: 'ativo', revenue: 2500 },
    { id: 5, name: 'Imobiliária Horizonte', resp: 'João Horizonte', email: 'joao@horizonte.com', phone: '(31) 9 4321-0987', cnpj: '67.890.123/0001-78', services: ['Tráfego Pago', 'Social Media', 'Design'], plan: 'Premium', start: '2023-08-15', expiry: '2024-08-15', status: 'inativo', revenue: 0 },
    { id: 6, name: 'Pharma Saúde Total', resp: 'Dra. Beatriz Faria', email: 'beatriz@pharmasaude.com', phone: '(41) 9 3210-9876', cnpj: '45.678.901/0001-23', services: ['Social Media', 'Consultoria'], plan: 'Padrão', start: '2024-09-01', expiry: '2025-09-01', status: 'ativo', revenue: 4100 },
  ],

  employees: [
    { id: 1, name: 'Ana Paula Silva', cargo: 'Administradora', email: 'ana@sejacreate.com', phone: '(11) 9 9999-0001', role: 'admin', status: 'ativo' },
    { id: 2, name: 'Bruno Carvalho', cargo: 'Gestor de Projetos', email: 'bruno@sejacreate.com', phone: '(11) 9 9999-0002', role: 'gestor', status: 'ativo' },
    { id: 3, name: 'Camila Rocha', cargo: 'Social Media', email: 'camila@sejacreate.com', phone: '(11) 9 9999-0003', role: 'social', status: 'ativo' },
    { id: 4, name: 'Diego Martins', cargo: 'Designer', email: 'diego@sejacreate.com', phone: '(11) 9 9999-0004', role: 'designer', status: 'ativo' },
    { id: 5, name: 'Fernanda Luz', cargo: 'Comercial', email: 'fernanda@sejacreate.com', phone: '(11) 9 9999-0005', role: 'comercial', status: 'ativo' },
    { id: 6, name: 'Gabriel Costa', cargo: 'Financeiro', email: 'gabriel@sejacreate.com', phone: '(11) 9 9999-0006', role: 'financeiro', status: 'ativo' },
  ],

  suppliers: [
    { id: 1, name: 'Estúdio Foto HD', contact: 'Lucas Foto', phone: '(11) 9 8888-1111', service: 'Fotografia', status: 'ativo' },
    { id: 2, name: 'VideoMax Produtora', contact: 'Renata Video', phone: '(11) 9 8888-2222', service: 'Produção de Vídeo', status: 'ativo' },
    { id: 3, name: 'Gráfica Express', contact: 'Paulo Gráfica', phone: '(11) 9 8888-3333', service: 'Impressão', status: 'ativo' },
  ],

  kanbanCols: ['Pauta', 'Conteúdo em Produção', 'Arte em Produção', 'Aprovação Interna', 'Enviado ao Cliente', 'Ajuste Solicitado', 'Aprovado', 'Programado', 'Publicado'],

  // Configurações editáveis
  equipes: [
    { id: 1, name: 'Criação', desc: 'Social Media e Design', members: [3, 4], color: 'purple' },
    { id: 2, name: 'Comercial', desc: 'Vendas e CRM', members: [5], color: 'blue' },
    { id: 3, name: 'Gestão', desc: 'Administração e Projetos', members: [1, 2], color: 'green' },
    { id: 4, name: 'Financeiro', desc: 'Finanças e Cobranças', members: [6], color: 'yellow' },
  ],

  tiposConteudo: ['Post Estático', 'Carrossel', 'Reels / Vídeo', 'Story', 'Anúncio (Ads)', 'Blog / Artigo', 'Newsletter', 'Outro'],

  servicos: ['Social Media', 'Design Gráfico', 'Tráfego Pago', 'Branding', 'Consultoria', 'Audiovisual', 'SEO', 'E-mail Marketing'],

  modelosAprovacao: [
    { id: 1, name: 'Aprovação Simples', desc: 'Cliente aprova ou reprova com um clique', icon: '✅', ativo: false },
    { id: 2, name: 'Aprovação com Comentário', desc: 'Cliente deve comentar ao reprovar', icon: '💬', ativo: true },
    { id: 3, name: 'Aprovação com Motivo', desc: 'Cliente seleciona motivo da devolução', icon: '📝', ativo: false },
    { id: 4, name: 'Aprovação Interna + Cliente', desc: 'Aprovação em dois níveis antes de publicar', icon: '🔒', ativo: false },
  ],

  // Matriz de permissões editável
  permissoes: {
    admin:     { visualizar:1, criar:1, editar:1, comentar:1, aprovar:1, programar:1, publicar:1, financeiro:1, relatorios:1 },
    gestor:    { visualizar:1, criar:1, editar:1, comentar:1, aprovar:1, programar:1, publicar:1, financeiro:0, relatorios:1 },
    social:    { visualizar:1, criar:1, editar:1, comentar:1, aprovar:0, programar:1, publicar:1, financeiro:0, relatorios:0 },
    designer:  { visualizar:1, criar:1, editar:1, comentar:1, aprovar:0, programar:0, publicar:0, financeiro:0, relatorios:0 },
    comercial: { visualizar:1, criar:1, editar:1, comentar:0, aprovar:0, programar:0, publicar:0, financeiro:0, relatorios:1 },
    financeiro:{ visualizar:1, criar:0, editar:0, comentar:0, aprovar:0, programar:0, publicar:0, financeiro:1, relatorios:1 },
    cliente:   { visualizar:1, criar:0, editar:0, comentar:1, aprovar:1, programar:0, publicar:0, financeiro:0, relatorios:0 },
  },

  hasPermission(action) {
    const role = this.currentUser?.role;
    if (!role) return false;
    return !!(this.permissoes[role]?.[action]);
  },

  tasks: [
    { id: 1, title: 'Post Janeiro — Promoção Verão', client: 1, assignee: 3, created: '2025-03-10', postDate: '2025-03-28', status: 'Enviado ao Cliente', priority: 'alta', text: 'Aproveite o verão com nossas promoções especiais! Até 40% de desconto em produtos selecionados. Corra e garanta o seu!', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [{user:2,text:'Arte está ótima, aguardando aprovação do cliente',date:'2025-03-25'}] },
    { id: 2, title: 'Carrossel Dicas de Moda', client: 2, assignee: 4, created: '2025-03-12', postDate: '2025-03-30', status: 'Arte em Produção', priority: 'media', text: '5 dicas essenciais para montar looks incríveis neste outono. Roupas que combinam com tudo!', checklist: [{done:true,text:'Briefing'},{done:false,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [] },
    { id: 3, title: 'Institucional Construtora', client: 3, assignee: 3, created: '2025-03-08', postDate: '2025-04-02', status: 'Aprovado', priority: 'baixa', text: 'Há mais de 20 anos construindo sonhos. A Rocha & Cia tem o imóvel perfeito para você.', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:true,text:'Arte aprovada'}], comments: [{user:3,text:'Cliente aprovou!',date:'2025-03-26'}] },
    { id: 4, title: 'Reels — Lançamento Blend Especial', client: 4, assignee: 3, created: '2025-03-15', postDate: '2025-03-29', status: 'Ajuste Solicitado', priority: 'alta', text: 'Apresentando nosso novo blend exclusivo. Aromas únicos, sabor incomparável. Experimente!', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:false,text:'Arte refeita'}], comments: [{user:7,text:'Favor ajustar a cor do fundo, não combina com nossa identidade',date:'2025-03-25'}] },
    { id: 5, title: 'Story — Campanha Imóveis Verão', client: 5, assignee: 4, created: '2025-03-05', postDate: '2025-03-27', status: 'Publicado', priority: 'media', text: 'Encontre seu imóvel dos sonhos neste verão. Condições especiais e localização privilegiada.', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:true,text:'Arte aprovada'},{done:true,text:'Publicado'}], comments: [] },
    { id: 6, title: 'Post Saúde — Dicas de Inverno', client: 6, assignee: 3, created: '2025-03-18', postDate: '2025-04-05', status: 'Pauta', priority: 'media', text: 'Cuide da sua saúde neste inverno. Conheça nossos produtos para imunidade.', checklist: [{done:false,text:'Briefing'},{done:false,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [] },
    { id: 7, title: 'Carrossel TechVision — Cases', client: 1, assignee: 4, created: '2025-03-20', postDate: '2025-04-08', status: 'Conteúdo em Produção', priority: 'alta', text: 'Conheça nossos cases de sucesso. Soluções tecnológicas que transformam negócios.', checklist: [{done:true,text:'Briefing'},{done:false,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [] },
    { id: 8, title: 'Post Pharma — Prevenção Gripe', client: 6, assignee: 3, created: '2025-03-22', postDate: '2025-04-10', status: 'Aprovação Interna', priority: 'media', text: 'Com a chegada do frio, é hora de se prevenir. Conheça nossos suplementos imunológicos.', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [] },
    { id: 9, title: 'Reel Café — Processo de Torra', client: 4, assignee: 4, created: '2025-03-14', postDate: '2025-04-01', status: 'Programado', priority: 'baixa', text: 'Do grão ao copo: conheça o processo artesanal de torra do nosso café especial.', checklist: [{done:true,text:'Briefing'},{done:true,text:'Redação'},{done:true,text:'Arte aprovada'},{done:true,text:'Programado'}], comments: [] },
    { id: 10, title: 'Story Moda — Liquidação', client: 2, assignee: 3, created: '2025-03-25', postDate: '2025-04-12', status: 'Pauta', priority: 'alta', text: 'Grande liquidação de outono! Peças com até 50% de desconto por tempo limitado.', checklist: [{done:false,text:'Briefing'},{done:false,text:'Redação'},{done:false,text:'Arte aprovada'}], comments: [] },
  ],

  leads: [
    { id: 1, name: 'Marcos Oliveira', company: 'Fitness Prime Academia', email: 'marcos@fitnessprime.com', phone: '(11) 9 7777-1111', origin: 'Instagram', service: 'Social Media + Design', assignee: 5, stage: 'Proposta Enviada', value: 6500, notes: 'Cliente muito interessado, quer fechar antes do mês', lastContact: '2025-03-24' },
    { id: 2, name: 'Juliana Ribeiro', company: 'Clínica Estética Glow', email: 'ju@clinicaglow.com', phone: '(21) 9 6666-2222', origin: 'Indicação', service: 'Social Media', assignee: 5, stage: 'Negociação', value: 4200, notes: 'Negociando valor, pode fechar por 3800', lastContact: '2025-03-26' },
    { id: 3, name: 'Rafael Souza', company: 'Auto Peças Souza', email: 'rafael@autopecas.com', phone: '(31) 9 5555-3333', origin: 'Google', service: 'Tráfego Pago', assignee: 5, stage: 'Contato Iniciado', value: 3000, notes: 'Primeiro contato realizado por WhatsApp', lastContact: '2025-03-23' },
    { id: 4, name: 'Viviane Alves', company: 'Pet Shop Fofo', email: 'vivi@petfofo.com', phone: '(11) 9 4444-4444', origin: 'LinkedIn', service: 'Branding + Social', assignee: 2, stage: 'Lead Novo', value: 5800, notes: 'Chegou pelo LinkedIn, ainda aguardando retorno', lastContact: '2025-03-22' },
    { id: 5, name: 'Eduardo Lima', company: 'Restaurante Sabor Brasil', email: 'edu@saborbrasil.com', phone: '(41) 9 3333-5555', origin: 'Site', service: 'Social Media', assignee: 5, stage: 'Fechado', value: 3500, notes: 'Fechado! Início em abril', lastContact: '2025-03-25' },
    { id: 6, name: 'Tatiana Moura', company: 'Joalheria Brilhante', email: 'tati@brilhante.com', phone: '(11) 9 2222-6666', origin: 'Indicação', service: 'Design + Social', assignee: 5, stage: 'Perdido', value: 4000, notes: 'Optou por outra agência, menor preço', lastContact: '2025-03-20' },
  ],

  avisos: [
    { id: 1, type: 'tarefa-vencida', title: 'Post TechVision — Campanha Q1 vencida', priority: 'alta', assignee: 3, client: 1, deadline: '2025-03-20', action: 'tarefas', icon: '⏰' },
    { id: 2, type: 'aprovacao-pendente', title: '3 conteúdos aguardando aprovação do cliente', priority: 'alta', assignee: 2, client: 2, deadline: '2025-03-29', action: 'tarefas', icon: '✅' },
    { id: 3, type: 'ajuste-solicitado', title: 'Cliente Café Aroma solicitou ajuste no card #4', priority: 'alta', assignee: 4, client: 4, deadline: '2025-03-28', action: 'tarefas', icon: '🔄' },
    { id: 4, type: 'sem-retorno', title: 'Construtora Rocha sem retorno há 4 dias', priority: 'media', assignee: 2, client: 3, deadline: '2025-03-27', action: 'crm', icon: '📞' },
    { id: 5, type: 'pagamento-aberto', title: 'Pharma Saúde — fatura de março em aberto', priority: 'alta', assignee: 6, client: 6, deadline: '2025-03-31', action: 'financeiro', icon: '💸' },
    { id: 6, type: 'contrato-vencendo', title: 'Imobiliária Horizonte — contrato vence em 14 dias', priority: 'media', assignee: 2, client: 5, deadline: '2025-04-11', action: 'cadastro', icon: '📋' },
    { id: 7, type: 'post-sem-programa', title: 'Story Moda — Liquidação sem data programada', priority: 'baixa', assignee: 3, client: 2, deadline: null, action: 'tarefas', icon: '📅' },
  ],

  finances: {
    receivable: [
      { id: 1, client: 1, desc: 'Mensalidade Março — TechVision', value: 8500, due: '2025-03-31', status: 'pendente' },
      { id: 2, client: 2, desc: 'Mensalidade Março — Bella Moda', value: 5200, due: '2025-03-28', status: 'pago' },
      { id: 3, client: 3, desc: 'Mensalidade Março — Construtora Rocha', value: 3800, due: '2025-04-05', status: 'pendente' },
      { id: 4, client: 4, desc: 'Mensalidade Março — Café Aroma', value: 2500, due: '2025-03-25', status: 'atrasado' },
      { id: 5, client: 6, desc: 'Mensalidade Março — Pharma Saúde', value: 4100, due: '2025-03-31', status: 'pendente' },
      { id: 6, client: 1, desc: 'Projeto extra — Landing Page', value: 3200, due: '2025-04-15', status: 'pendente' },
    ],
    payable: [
      { id: 1, supplier: 'Estúdio Foto HD', desc: 'Sessão fotográfica março', value: 1200, due: '2025-03-30', status: 'pendente' },
      { id: 2, supplier: 'VideoMax Produtora', desc: 'Produção de reels — lote março', value: 2400, due: '2025-04-05', status: 'pendente' },
      { id: 3, supplier: 'Adobe Creative Cloud', desc: 'Licença mensal', value: 420, due: '2025-04-01', status: 'pago' },
      { id: 4, supplier: 'Meta Ads', desc: 'Créditos de impulsionamento', value: 3500, due: '2025-03-31', status: 'pago' },
    ],
    cashflow: [
      { month: 'Out', in: 18200, out: 6400 },
      { month: 'Nov', in: 21500, out: 7200 },
      { month: 'Dez', in: 25000, out: 8100 },
      { month: 'Jan', in: 22800, out: 7600 },
      { month: 'Fev', in: 23600, out: 7900 },
      { month: 'Mar', in: 27100, out: 7520 },
    ],
    dre: [
      { month: 'Out/24', receita: 18200, impostos: 1092, custos_diretos: 3600, folha: 10200, despesas_op: 2800 },
      { month: 'Nov/24', receita: 21500, impostos: 1290, custos_diretos: 4100, folha: 10200, despesas_op: 3100 },
      { month: 'Dez/24', receita: 25000, impostos: 1500, custos_diretos: 4800, folha: 10200, despesas_op: 3300 },
      { month: 'Jan/25', receita: 22800, impostos: 1368, custos_diretos: 3900, folha: 10200, despesas_op: 3700 },
      { month: 'Fev/25', receita: 23600, impostos: 1416, custos_diretos: 4200, folha: 10200, despesas_op: 3700 },
      { month: 'Mar/25', receita: 27100, impostos: 1626, custos_diretos: 4020, folha: 10200, despesas_op: 3500 },
    ],
  },

  getClientName(id) { return this.clients.find(c => c.id === id)?.name || 'N/A'; },
  getEmployeeName(id) { const u = this.users.find(u => u.id === id); return u ? u.name : 'N/A'; },
  getEmployeeAvatar(id) { return this.users.find(u => u.id === id)?.avatar || '?'; },
  getTasksByCol(col) { return this.tasks.filter(t => t.status === col); },
  getLeadsByStage(stage) { return this.leads.filter(l => l.stage === stage); },
  getUserTasks(userId) { return this.tasks.filter(t => t.assignee === userId); },
  formatCurrency(v) { return 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2}); },
  formatDate(d) { if(!d) return '—'; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; },
  isOverdue(d) { if(!d) return false; return new Date(d) < new Date(new Date().toDateString()); },
  isDueSoon(d) { if(!d) return false; const diff = (new Date(d) - new Date(new Date().toDateString())) / 86400000; return diff >= 0 && diff <= 2; },

  statusColor(s) {
    const map = {
      'Pauta': 'gray', 'Conteúdo em Produção': 'blue', 'Arte em Produção': 'blue',
      'Aprovação Interna': 'yellow', 'Enviado ao Cliente': 'purple', 'Ajuste Solicitado': 'red',
      'Aprovado': 'green', 'Programado': 'purple', 'Publicado': 'green'
    };
    return map[s] || 'gray';
  },

  priorityColors: { 'alta': 'red', 'media': 'yellow', 'baixa': 'green' },

  crmStages: ['Lead Novo', 'Contato Iniciado', 'Proposta Enviada', 'Negociação', 'Fechado', 'Perdido'],
};
