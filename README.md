# 🚀 Seja Create — Plataforma de Gestão para Agências

## 📋 Visão Geral
Sistema SaaS completo para gestão de agências de marketing digital, com kanban de tarefas, CRM, financeiro, relatórios, calendário e área do cliente.

**Stack:** HTML5 + CSS3 + JavaScript puro (sem frameworks) + Supabase (opcional)

---

## ✅ Funcionalidades Implementadas

### 🔐 Autenticação
- Login com Supabase Auth (email + senha) quando configurado
- Modo demo com 7 perfis pré-definidos (sem backend)
- Sessão persistida com `supabase.auth.getSession()`
- Logout limpa sessão e estado local
- Proteção de rotas por perfil

### 📊 Dashboard
- KPIs: clientes ativos, tarefas em progresso, posts programados, receita mensal
- Seções financeiras ocultas para perfis sem permissão (`data-perm="financial"`)
- Resumo semanal com barras de progresso
- Feed de atividades recentes
- Modal de criação rápida de tarefa

### 📋 Gestão de Tarefas (Kanban)
- **Scroll horizontal garantido** via `.kanban-wrapper { overflow-x: auto }` + `.kanban-board { min-width: max-content }`
- 9 colunas com `min-width: 240px; flex-shrink: 0`
- **Drag-and-drop** nativo HTML5 com `ondragstart/ondragover/ondrop`
- Status persistido no Supabase via `DB.tasks.updateStatus()`
- Upload de artes no Supabase Storage (bucket `task-arts`)
- Checklist, comentários, histórico por card
- Filtros por cliente, responsável, prioridade
- Vista lista + kanban

### 🎯 CRM Pipeline
- **Scroll horizontal** com `.crm-pipeline-wrapper` + `.crm-pipeline-board { min-width: max-content }`
- **Drag-and-drop** entre colunas com persistência imediata no Supabase
- 6 etapas: Lead Novo → Fechado / Perdido
- KPIs: total leads, fechados, taxa de conversão, pipeline total
- Modal de detalhe com histórico de interação
- Botão WhatsApp direto para o lead
- Conversão automática de lead → cliente

### 💰 Financeiro
- Contas a receber/pagar com CRUD completo
- **Botão "Cobrar" via WhatsApp**: `https://wa.me/55NUMERO?text=mensagem`
  - Mensagem padrão: *"Olá, tudo bem? Identificamos um pagamento pendente referente ao seu contrato. Poderia verificar, por favor?"*
- Aba Inadimplência: lista clientes atrasados com dias em atraso
- Fluxo de caixa com Chart.js
- Seções financeiras visíveis apenas para roles `admin`, `financeiro`, `gestor`
- Edição de lançamentos com modal
- Marcar como pago com atualização em tempo real

### 📈 Relatórios
- **Filtros funcionais**: por período, cliente e responsável
- 6 gráficos Chart.js: status, produtividade, cards/cliente, receita
- Relatórios detalhados em modal:
  - 👥 Produtividade da equipe
  - 📊 Cards por cliente
  - ✅ Conteúdos aprovados
  - 🔄 Conteúdos devolvidos
  - 📅 Calendário de publicações
  - 💰 Faturamento por cliente (apenas com permissão financeira)
  - 🏢 Clientes ativos
  - ⚡ Performance operacional

### ⚙️ Configurações
- **CRUD completo**: usuários, equipes, perfis de acesso, permissões, funil CRM, tipos de conteúdo, serviços, modelos de aprovação
- Integração com `DB.profiles` do Supabase
- Matriz de permissões editável por role
- Gestão de etapas do kanban e CRM

### 🌐 Área do Cliente
- Exibe conteúdos enviados para aprovação
- **Aprovar**: atualiza `tasks.status` → `Aprovado` + salva em `approvals`
- **Solicitar ajuste**: salva feedback em `approvals` + `task_comments`
- Calendário com visualização mensal, semanal e lista
- Histórico de aprovações/ajustes

### 📅 Calendário
- Visualização mensal e semanal
- Conectado a `tasks.post_date`
- Clique no evento abre card completo
- Filtros por cliente/responsável/status

---

## 🗄️ Integração Supabase

### Configuração
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Acesse **Settings → API**
3. Copie **Project URL** e **anon public key**
4. Edite `js/supabase.js`:
```javascript
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';
```
5. Execute `supabase-schema.sql` no **SQL Editor** do Supabase
6. Crie os usuários via **Authentication → Users**

### Modo Demo (sem Supabase)
Se `SUPABASE_URL` não for configurado, o sistema opera com dados mock em memória (`js/data.js`). Todas as funcionalidades visuais funcionam normalmente.

---

## 📁 Estrutura de Arquivos

```
index.html              — Página principal, imports de JS/CSS
css/
  style.css             — Estilos globais (dark theme, kanban, CRM, modais...)
js/
  data.js               — Dados mock e helpers (modo demo)
  supabase.js           — Cliente Supabase, CRUD helpers, adaptadores
  app.js                — Auth, navegação, permissões, modais, toasts
  dashboard.js          — Dashboard com KPIs e gráficos
  avisos.js             — Avisos e notificações
  crm.js                — Pipeline CRM com drag-and-drop
  cadastro.js           — Cadastro de clientes e fornecedores
  tarefas.js            — Kanban de tarefas com drag-and-drop
  calendario.js         — Calendário mensal/semanal
  financeiro.js         — Financeiro com WhatsApp
  relatorios.js         — Relatórios com filtros e gráficos
  configuracoes.js      — Configurações CRUD
  cliente-area.js       — Área do cliente (aprovação, calendário)
supabase-schema.sql     — DDL completo + RLS policies
README.md               — Esta documentação
```

---

## 🗃️ Tabelas Supabase (14)

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários + perfis de acesso |
| `teams` | Equipes da agência |
| `team_members` | Membros por equipe |
| `clients` | Clientes da agência |
| `suppliers` | Fornecedores |
| `leads` | Pipeline de vendas |
| `tasks` | Cards do kanban |
| `task_comments` | Comentários por task |
| `task_checklists` | Checklist por task |
| `task_attachments` | Anexos/artes por task |
| `approvals` | Registro de aprovações |
| `financial_receivables` | Contas a receber |
| `financial_payables` | Contas a pagar |
| `activity_logs` | Log de atividades |

---

## 👥 Perfis de Acesso

| Role | Financeiro | CRM | Operacional | Relatórios | Config |
|------|-----------|-----|------------|-----------|--------|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gestor` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `social` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `designer` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `comercial` | ❌ | ✅ | ❌ | ✅ | ❌ |
| `financeiro` | ✅ | ❌ | ❌ | ✅ | ❌ |
| `cliente` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🔗 URLs e Rotas

| Rota interna | Módulo | Função de render |
|-------------|--------|-----------------|
| `dashboard` | Dashboard | `renderDashboard()` |
| `avisos` | Avisos | `renderAvisos()` |
| `crm` | CRM Pipeline | `renderCRM()` |
| `cadastro` | Cadastro | `renderCadastro()` |
| `tarefas` | Kanban Tasks | `renderTarefas()` |
| `calendario` | Calendário | `renderCalendario()` |
| `financeiro` | Financeiro | `renderFinanceiro()` |
| `relatorios` | Relatórios | `renderRelatorios()` |
| `configuracoes` | Configurações | `renderConfiguracoes()` |
| `cliente-area` | Área do Cliente | `renderClienteArea()` |

---

## 🔒 Segurança (RLS)
- Row Level Security habilitado em todas as 14 tabelas
- Função `get_my_role()` retorna o role do usuário autenticado
- Clientes acessam **somente** dados vinculados ao seu `client_id`
- Service role key **nunca** exposta no frontend
- Financeiro visível apenas para `admin`, `financeiro`, `gestor`

---

## 🎨 Design
- Dark theme com paleta **preto + roxo** (#0a0a0f, #7c3aed, #8b5cf6)
- Totalmente responsivo (mobile-first)
- Animações CSS suaves (slideUp, fadeIn)
- Loading states com spinner
- Toasts de feedback (success/error/warning/info)
- ScrollX nativo em kanban e CRM (touch-friendly)

---

## 🚧 Próximos Passos
1. **Configurar Supabase**: definir URL/anon-key em `js/supabase.js`
2. **Executar schema**: rodar `supabase-schema.sql` no SQL Editor
3. **Criar usuários**: via Authentication → Users no dashboard Supabase
4. **Storage**: criar bucket `task-arts` para upload de artes
5. **Realtime**: habilitar Realtime nas tabelas `tasks` e `approvals` para atualizações ao vivo
6. **Export PDF/Excel**: implementar via Supabase Edge Functions
7. **Email notifications**: configurar via Supabase Auth templates
8. **Deploy**: usar a aba **Publish** para colocar em produção
