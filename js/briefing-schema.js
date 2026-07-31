// =============================================
// SEJA CREATE — SCHEMA DO BRIEFING
// =============================================
// Fonte única das perguntas, compartilhada por:
//   - briefing.html        (formulário público que o cliente responde)
//   - js/onboarding.js     (exibição no Dossiê + importador do CSV)
//
// IMPORTANTE: o campo `label` precisa ser IDÊNTICO ao cabeçalho da coluna
// na planilha de respostas do Google Forms. É por esse texto que o
// importador casa coluna ↔ pergunta, sem mapeamento manual.
//
// As opções abaixo foram conferidas contra os valores distintos que
// realmente aparecem nas 32 respostas já coletadas — não contra a
// aparência do formulário, que divergia em vários rótulos.

const BRIEFING_SECTIONS = [
  {
    id: 'negocio',
    title: 'Sobre o negócio',
    icon: 'fa-briefcase',
    questions: [
      { key: 'nome_funcao',   type: 'texto',
        label: 'Qual o seu nome? E sua função na empresa?' },
      { key: 'nicho',         type: 'texto',
        label: 'Qual seu nicho de atuação?' },
      { key: 'diferencial',   type: 'paragrafo',
        label: 'O que você considera que seja seu principal diferencial em relação aos concorrentes?' },
      { key: 'produtos',      type: 'paragrafo',
        label: 'Quais os produtos/serviços da sua empresa que você deseja trabalhar?' },
      { key: 'objetivos',     type: 'paragrafo',
        label: 'Quais os objetivos do seu negócio a curto, médio e longo prazo?' },
      { key: 'atendimento',   type: 'escolha',
        label: 'Você atende de forma digital, presencial ou ambos?',
        options: ['Digital', 'Presencial', 'Ambas as formas'] },
      { key: 'cidades',       type: 'paragrafo',
        label: 'Coloque aqui as principais cidades que você gostaria de atingir com o seu negócio:' },
      { key: 'identidade',    type: 'escolha',
        label: 'Você já possui uma identidade visual definida?',
        options: ['Sim, já tenho', 'Ainda não tenho'] },
      { key: 'site',          type: 'texto', required: false,
        label: 'Você possui site? Se sim, insira o link aqui' },
    ],
  },
  {
    id: 'concorrencia',
    title: 'Concorrência e referências',
    icon: 'fa-users-viewfinder',
    questions: [
      { key: 'concorrentes',  type: 'paragrafo',
        label: 'Quem são os seus principais concorrentes?',
        hint: 'Inclua nome, Instagram e site de cada um.' },
      { key: 'ref_fora',      type: 'paragrafo',
        label: 'Por favor, cite profissionais (de um nicho diferente do seu) que você considera sua forma de atuar no digital uma referência e comente sobre cada um.' },
      { key: 'ref_nicho',     type: 'paragrafo',
        label: 'Por favor, cite profissionais (do seu nicho) que você considera sua forma de atuar no digital uma referência e comente sobre cada um.' },
      { key: 'nao_gosta',     type: 'paragrafo',
        label: 'Tem alguém do seu nicho que você não gosta da forma de comunicação?' },
    ],
  },
  {
    id: 'redes',
    title: 'Redes sociais',
    icon: 'fa-hashtag',
    questions: [
      { key: 'objetivo_redes', type: 'multipla',
        label: 'Qual o seu objetivo com o uso das redes sociais?',
        options: ['Captar clientes', 'Aumentar a visibilidade do meu negócio', 'Gerar autoridade',
                  'Iniciar um novo negócio', 'Estar presente'] },
      { key: 'dificuldade_digital', type: 'paragrafo',
        label: 'Qual a sua maior dificuldade no digital?' },
      { key: 'ja_inserida',   type: 'paragrafo',
        label: 'Sua empresa já está inserida nas redes sociais?',
        hint: 'Se sim, informe os @ dos perfis.' },
      { key: 'temas',         type: 'paragrafo',
        label: 'Liste temas e/ou assuntos que você acha importante trabalhar nas redes sociais do seu negócio' },
      { key: 'conforto_video', type: 'escolha',
        label: 'Você se sente confortável aparecendo nos Stories e gravando vídeos?',
        options: ['Sim', 'Não', 'Ainda não, mas desejo melhorar.'] },
      { key: 'foco_produtos', type: 'paragrafo',
        label: 'Quais os principais produtos/serviços você gostaria de focar nas suas redes sociais?' },
      { key: 'dificuldade_negocio', type: 'paragrafo',
        label: 'Qual a maior dificuldade do seu negócio que podemos auxiliar com o uso das redes sociais?' },
    ],
  },
  {
    id: 'marca',
    title: 'Marca e conteúdo',
    icon: 'fa-bullhorn',
    questions: [
      { key: 'reconhecida_sim', type: 'paragrafo',
        label: 'Como você gostaria que a sua empresa fosse reconhecida nas redes sociais?' },
      { key: 'reconhecida_nao', type: 'paragrafo',
        label: 'Como você NÃO gostaria que a sua empresa fosse ser reconhecida nas redes sociais?' },
      { key: 'ref_conteudo',  type: 'paragrafo',
        label: 'Liste referências de conteúdo confiável para o seu negócio' },
      { key: 'palavras_chave', type: 'paragrafo',
        label: 'Liste 10 palavras-chave que você acredita que sejam relevantes' },
    ],
  },
  {
    id: 'publico',
    title: 'Público-alvo',
    icon: 'fa-bullseye',
    questions: [
      { key: 'idade_publico', type: 'multipla',
        label: 'Qual a idade média dos clientes que você deseja captar/atender?',
        options: ['Crianças e adolescentes', '18 - 24 anos', '25 - 34 anos', '35 - 45 anos', '+ 45 anos'] },
      { key: 'idade_decisor', type: 'multipla',
        label: 'Qual a idade média dos clientes responsáveis pela compra do seu produto/serviço?',
        options: ['Crianças e adolescentes', '18 - 24 anos', '25 - 34 anos', '35 - 45 anos', '+ 45 anos'] },
      { key: 'autoridade',    type: 'escolha',
        label: 'Seu cliente reconhece você como autoridade na sua área de atuação?',
        options: ['Sim', 'Não'] },
      { key: 'escolaridade',  type: 'escolha',
        label: 'Qual grau de escolaridade dos seus clientes?',
        options: ['Ensino Fundamental Completo', 'Ensino Médio Completo', 'Ensino Superior Completo'] },
      { key: 'classe_social', type: 'escolha',
        label: 'Qual a classe social do cliente que você deseja atingir?',
        options: ['Classe A+', 'Classe A', 'Classe B', 'Classe C', 'Classe D'] },
      { key: 'usa_redes',     type: 'escolha',
        label: 'Seu cliente usa as redes sociais?',
        options: ['Sim', 'Não', 'Ele não, mas o tomador de decisão sim'] },
      { key: 'cliente_ideal', type: 'paragrafo',
        label: 'Por favor descreva o cliente ideal que você gostaria de receber no seu negócio.' },
    ],
  },
  {
    id: 'extras',
    title: 'Para finalizar',
    icon: 'fa-circle-check',
    questions: [
      { key: 'extras',        type: 'paragrafo', required: false,
        label: 'Para finalizar, descreva informações importantes sobre o seu projeto que não foram questionadas anteriormente.' },
    ],
  },
];

// Lista achatada, na ordem do formulário.
const BRIEFING_QUESTIONS = BRIEFING_SECTIONS.flatMap(s =>
  s.questions.map(q => ({ ...q, section: s.id, required: q.required !== false }))
);

// Normaliza um cabeçalho para comparação: o Forms varia acentuação,
// espaços duplos e quebras de linha entre a planilha e o formulário.
function briefingNormalizeLabel(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cabeçalho da planilha → key da pergunta. Usado pelo importador.
function briefingKeyFromLabel(header) {
  const alvo = briefingNormalizeLabel(header);
  const q = BRIEFING_QUESTIONS.find(q => briefingNormalizeLabel(q.label) === alvo);
  return q ? q.key : null;
}

// Valor cru do CSV → formato interno. Perguntas de múltipla seleção chegam
// com as opções unidas por ", " numa célula só.
function briefingParseValue(q, raw) {
  const v = String(raw ?? '').trim();
  if (!v) return q.type === 'multipla' ? [] : '';
  if (q.type !== 'multipla') return v;
  // Nenhuma opção de múltipla seleção contém ", ", então o split é seguro.
  return v.split(/,\s+/).map(s => s.trim()).filter(Boolean);
}

// Exibição de uma resposta já gravada.
function briefingFormatValue(value) {
  if (Array.isArray(value)) return value.join(' · ');
  return String(value ?? '');
}
