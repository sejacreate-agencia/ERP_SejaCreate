-- =============================================
-- MIGRATION 028 — Listas de configuração e plano de contas
-- Execute no Supabase SQL Editor.
-- =============================================
-- Quatro recursos que existiam só em memória: as telas salvavam em
-- SC.<coisa>, anunciavam sucesso e perdiam tudo no recarregamento. Não era
-- bug de uma função — era ausência de tabela. Esta migration cria o lugar.
--
-- "Etapas do Funil" NÃO entra aqui: ela usa SC.kanbanCols, e kanban_columns já
-- é tabela desde a migration 008. Lá o problema é só a tela de configuração não
-- gravar nela, e isso se resolve no front.

-- ---------------------------------------------
-- 1) PLANO DE CONTAS
-- ---------------------------------------------
-- ATENÇÃO ao tipo da chave: financial_payables.conta_id e
-- financial_receivables.conta_id são INTEGER (migration 005) e já apontam para
-- os ids 1..14 do mock. Usar UUID aqui orfanaria esses lançamentos. Por isso a
-- PK é INTEGER, e a sequência começa depois dos ids semeados.
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id         INTEGER PRIMARY KEY,
  codigo     TEXT NOT NULL,
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  dre_grupo  TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.chart_of_accounts_id_seq
  AS INTEGER START WITH 100 OWNED BY public.chart_of_accounts.id;
ALTER TABLE public.chart_of_accounts
  ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_chart_codigo ON public.chart_of_accounts(codigo);

DROP TRIGGER IF EXISTS chart_of_accounts_updated_at ON public.chart_of_accounts;
CREATE TRIGGER chart_of_accounts_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Semeia exatamente o que estava em js/data.js, com os mesmos ids.
INSERT INTO public.chart_of_accounts (id, codigo, nome, tipo, dre_grupo) VALUES
  (1,  '1.1.1', 'Receita de Social Media',         'receita', 'receita'),
  (2,  '1.1.2', 'Receita de Design',               'receita', 'receita'),
  (3,  '1.1.3', 'Receita de Tráfego Pago',         'receita', 'receita'),
  (4,  '1.1.4', 'Receita de Projetos Extras',      'receita', 'receita'),
  (5,  '2.1.1', 'ISS / Impostos sobre Serviços',   'despesa', 'impostos'),
  (6,  '3.1.1', 'Fotografia e Vídeo',              'despesa', 'custos_diretos'),
  (7,  '3.1.2', 'Freelancers e Terceiros',         'despesa', 'custos_diretos'),
  (8,  '3.1.3', 'Ferramentas de Produção',         'despesa', 'custos_diretos'),
  (9,  '4.1.1', 'Salários e Pro-labore',           'despesa', 'folha'),
  (10, '4.1.2', 'Encargos Trabalhistas',           'despesa', 'folha'),
  (11, '5.1.1', 'Marketing e Ads',                 'despesa', 'despesas_op'),
  (12, '5.1.2', 'Aluguel e Infraestrutura',        'despesa', 'despesas_op'),
  (13, '5.1.3', 'Assinaturas e Softwares',         'despesa', 'despesas_op'),
  (14, '5.1.4', 'Outras Despesas Administrativas', 'despesa', 'despesas_op')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chart_select" ON public.chart_of_accounts;
CREATE POLICY "chart_select" ON public.chart_of_accounts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chart_modify" ON public.chart_of_accounts;
CREATE POLICY "chart_modify" ON public.chart_of_accounts
  FOR ALL USING (get_my_role() IN ('admin','gestor','financeiro'))
  WITH CHECK (get_my_role() IN ('admin','gestor','financeiro'));

-- ---------------------------------------------
-- 2) TIPOS DE CONTEÚDO E SERVIÇOS
-- ---------------------------------------------
-- Duas listas de rótulo puro. Mesma forma, tabelas separadas: juntá-las numa
-- tabela genérica de "listas" economizaria DDL e custaria clareza em toda
-- consulta futura.
CREATE TABLE IF NOT EXISTS public.content_types (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL UNIQUE,
  posicao    INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_catalog (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL UNIQUE,
  posicao    INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.content_types (nome, posicao) VALUES
  ('Post Estático',0),('Carrossel',1),('Reels / Vídeo',2),('Story',3),
  ('Anúncio (Ads)',4),('Blog / Artigo',5),('Newsletter',6),('Outro',7)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.service_catalog (nome, posicao) VALUES
  ('Social Media',0),('Design Gráfico',1),('Tráfego Pago',2),('Branding',3),
  ('Consultoria',4),('Audiovisual',5),('SEO',6),('E-mail Marketing',7)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.content_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_types_select" ON public.content_types;
CREATE POLICY "content_types_select" ON public.content_types
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "content_types_modify" ON public.content_types;
CREATE POLICY "content_types_modify" ON public.content_types
  FOR ALL USING (get_my_role() IN ('admin','gestor'))
  WITH CHECK (get_my_role() IN ('admin','gestor'));

DROP POLICY IF EXISTS "service_catalog_select" ON public.service_catalog;
CREATE POLICY "service_catalog_select" ON public.service_catalog
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_catalog_modify" ON public.service_catalog;
CREATE POLICY "service_catalog_modify" ON public.service_catalog
  FOR ALL USING (get_my_role() IN ('admin','gestor'))
  WITH CHECK (get_my_role() IN ('admin','gestor'));

-- ---------------------------------------------
-- 3) MODELOS DE APROVAÇÃO
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_models (
  id         INTEGER PRIMARY KEY,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  icone      TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No máximo um modelo ativo. A tela já tratava isso desligando os outros antes
-- de ligar um; aqui a regra fica no banco, onde não depende do front acertar.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_approval_model_ativo
  ON public.approval_models (ativo) WHERE ativo;

DROP TRIGGER IF EXISTS approval_models_updated_at ON public.approval_models;
CREATE TRIGGER approval_models_updated_at
  BEFORE UPDATE ON public.approval_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.approval_models (id, nome, descricao, icone, ativo) VALUES
  (1,'Aprovação Simples','Cliente aprova ou reprova com um clique','✅',false),
  (2,'Aprovação com Comentário','Cliente deve comentar ao reprovar','💬',true),
  (3,'Aprovação com Motivo','Cliente seleciona motivo da devolução','📝',false),
  (4,'Aprovação Interna + Cliente','Aprovação em dois níveis antes de publicar','🔒',false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.approval_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approval_models_select" ON public.approval_models;
CREATE POLICY "approval_models_select" ON public.approval_models
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "approval_models_modify" ON public.approval_models;
CREATE POLICY "approval_models_modify" ON public.approval_models
  FOR ALL USING (get_my_role() IN ('admin','gestor'))
  WITH CHECK (get_my_role() IN ('admin','gestor'));

-- ---------------------------------------------
-- 4) MATRIZ DE PERMISSÕES POR PERFIL
-- ---------------------------------------------
-- A matriz vivia em js/data.js e voltava ao padrão a cada recarregamento.
--
-- LIMITE QUE PRECISA FICAR CLARO: isto controla o que o FRONT mostra. A
-- barreira real continua sendo a RLS, escrita por papel em cada policy. Mudar
-- um valor aqui esconde um menu; não impede ninguém de ler a tabela pela API.
-- Hoje as duas divergem — `gestor` tem o módulo financeiro desligado na matriz,
-- mas fin_rec_select e fin_rec_modify incluem 'gestor'. Alinhar é decisão de
-- produto: ou o gestor vê o financeiro, ou sai das policies.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role       TEXT PRIMARY KEY
               CHECK (role IN ('admin','gestor','social','designer','comercial','financeiro','cliente')),
  acoes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  modulos    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS role_permissions_updated_at ON public.role_permissions;
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.role_permissions (role, acoes, modulos) VALUES
 ('admin',
  '{"visualizar":1,"criar":1,"editar":1,"comentar":1,"aprovar":1,"programar":1,"publicar":1,"financeiro":1,"relatorios":1}',
  '{"comercial":1,"operacional":1,"financeiro":1,"relatorios":1,"integracoes":1,"config":1,"clienteArea":1,"avisos":1}'),
 ('gestor',
  '{"visualizar":1,"criar":1,"editar":1,"comentar":1,"aprovar":1,"programar":1,"publicar":1,"financeiro":0,"relatorios":1}',
  '{"comercial":1,"operacional":1,"financeiro":0,"relatorios":1,"integracoes":0,"config":1,"clienteArea":1,"avisos":1}'),
 ('social',
  '{"visualizar":1,"criar":1,"editar":1,"comentar":1,"aprovar":0,"programar":1,"publicar":1,"financeiro":0,"relatorios":0}',
  '{"comercial":0,"operacional":1,"financeiro":0,"relatorios":0,"integracoes":0,"config":1,"clienteArea":1,"avisos":1}'),
 ('designer',
  '{"visualizar":1,"criar":1,"editar":1,"comentar":1,"aprovar":0,"programar":0,"publicar":0,"financeiro":0,"relatorios":0}',
  '{"comercial":0,"operacional":1,"financeiro":0,"relatorios":0,"integracoes":0,"config":0,"clienteArea":0,"avisos":1}'),
 ('comercial',
  '{"visualizar":1,"criar":1,"editar":1,"comentar":0,"aprovar":0,"programar":0,"publicar":0,"financeiro":0,"relatorios":1}',
  '{"comercial":1,"operacional":0,"financeiro":0,"relatorios":1,"integracoes":0,"config":1,"clienteArea":1,"avisos":1}'),
 ('financeiro',
  '{"visualizar":1,"criar":0,"editar":0,"comentar":0,"aprovar":0,"programar":0,"publicar":0,"financeiro":1,"relatorios":1}',
  '{"comercial":0,"operacional":0,"financeiro":1,"relatorios":1,"integracoes":1,"config":0,"clienteArea":0,"avisos":1}'),
 ('cliente',
  '{"visualizar":1,"criar":0,"editar":0,"comentar":1,"aprovar":1,"programar":0,"publicar":0,"financeiro":0,"relatorios":0}',
  '{"comercial":0,"operacional":0,"financeiro":0,"relatorios":0,"integracoes":0,"config":0,"clienteArea":1,"avisos":0}')
ON CONFLICT (role) DO NOTHING;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
-- Todo mundo lê: o app precisa da matriz no login para montar o menu.
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
-- Só admin escreve. Permitir que um gestor editasse a própria linha seria
-- escalação de privilégio com um clique.
DROP POLICY IF EXISTS "role_permissions_modify" ON public.role_permissions;
CREATE POLICY "role_permissions_modify" ON public.role_permissions
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- SELECT 'chart' t, count(*) FROM chart_of_accounts
-- UNION ALL SELECT 'content_types', count(*) FROM content_types
-- UNION ALL SELECT 'service_catalog', count(*) FROM service_catalog
-- UNION ALL SELECT 'approval_models', count(*) FROM approval_models
-- UNION ALL SELECT 'role_permissions', count(*) FROM role_permissions;
-- Esperado: 14 | 8 | 8 | 4 | 7
--
-- Os lançamentos existentes continuam apontando para contas válidas:
-- SELECT count(*) AS orfaos FROM financial_payables p
--  WHERE p.conta_id IS NOT NULL
--    AND NOT EXISTS (SELECT 1 FROM chart_of_accounts c WHERE c.id = p.conta_id);
-- Esperado: 0
