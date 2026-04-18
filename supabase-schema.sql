-- =============================================
-- SEJA CREATE — SUPABASE SCHEMA COMPLETO
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES (espelha auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'social'
                  CHECK (role IN ('admin','gestor','social','designer','comercial','financeiro','cliente')),
  cargo         TEXT,
  avatar_initials TEXT,
  avatar_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  client_id     UUID,  -- referência ao cliente (apenas role=cliente)
  permissions   JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger: criar profile automaticamente ao signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'social')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. TEAMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT 'purple'
                CHECK (color IN ('purple','blue','green','yellow','red','orange','gray')),
  status      TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 3. TEAM MEMBERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, profile_id)
);

-- =============================================
-- 4. CLIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  contact_name      TEXT,
  email             TEXT,
  phone             TEXT,
  cnpj              TEXT,
  services          TEXT[] DEFAULT '{}',
  plan              TEXT DEFAULT 'Padrão' CHECK (plan IN ('Basic','Starter','Padrão','Premium')),
  start_date        DATE,
  expiry_date       DATE,
  status            TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','inadimplente')),
  monthly_revenue   NUMERIC(10,2) DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atualizar FK em profiles após criar clients
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profile_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- =============================================
-- 5. SUPPLIERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  service_type  TEXT,
  status        TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 6. LEADS
-- =============================================
CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  company       TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  origin        TEXT DEFAULT 'Outro'
                  CHECK (origin IN ('Instagram','LinkedIn','Indicação','Google','Site','Evento','Outro')),
  service       TEXT,
  stage         TEXT NOT NULL DEFAULT 'Lead Novo'
                  CHECK (stage IN ('Lead Novo','Contato Iniciado','Proposta Enviada','Negociação','Fechado','Perdido')),
  value         NUMERIC(10,2) DEFAULT 0,
  notes         TEXT,
  assignee_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_contact  DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 7. TASKS
-- =============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  text          TEXT,
  status        TEXT NOT NULL DEFAULT 'Pauta'
                  CHECK (status IN ('Pauta','Conteúdo em Produção','Arte em Produção','Aprovação Interna',
                                    'Enviado ao Cliente','Ajuste Solicitado','Aprovado','Programado','Publicado')),
  priority      TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','baixa')),
  client_id     UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  assignee_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  post_date     DATE,
  content_type  TEXT DEFAULT 'Post Estático',
  art_url       TEXT,
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_tasks_client_id    ON public.tasks(client_id);
CREATE INDEX idx_tasks_assignee_id  ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status       ON public.tasks(status);
CREATE INDEX idx_tasks_post_date    ON public.tasks(post_date);

-- =============================================
-- 8. TASK COMMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);

-- =============================================
-- 9. TASK CHECKLISTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER task_checklists_updated_at BEFORE UPDATE ON public.task_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_task_checklists_task_id ON public.task_checklists(task_id);

-- =============================================
-- 10. TASK ATTACHMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  file_type     TEXT,
  uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

-- =============================================
-- 11. APPROVALS
-- =============================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  reviewer_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision      TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (decision IN ('pendente','aprovado','ajuste_solicitado')),
  feedback      TEXT,
  reviewed_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_approvals_task_id   ON public.approvals(task_id);
CREATE INDEX idx_approvals_client_id ON public.approvals(client_id);

-- =============================================
-- 12. FINANCIAL: RECEIVABLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.financial_receivables (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  value       NUMERIC(10,2) NOT NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER fin_rec_updated_at BEFORE UPDATE ON public.financial_receivables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_fin_rec_client_id ON public.financial_receivables(client_id);
CREATE INDEX idx_fin_rec_status    ON public.financial_receivables(status);

-- =============================================
-- 13. FINANCIAL: PAYABLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.financial_payables (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name   TEXT NOT NULL,
  description     TEXT NOT NULL,
  value           NUMERIC(10,2) NOT NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  paid_at         TIMESTAMPTZ,
  category        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER fin_pay_updated_at BEFORE UPDATE ON public.financial_payables FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 14. ACTIVITY LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_resource ON public.activity_logs(resource_type, resource_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payables   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs        ENABLE ROW LEVEL SECURITY;

-- ─── Helper: obter role do usuário atual ─────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── PROFILES ────────────────────────────────
-- Qualquer usuário autenticado pode ler
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
-- Usuário pode editar somente o próprio perfil; admin edita todos
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR get_my_role() = 'admin');
-- Apenas admin pode inserir/deletar
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (get_my_role() = 'admin');

-- ─── CLIENTS ─────────────────────────────────
-- Equipe interna vê todos; cliente vê apenas o próprio
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  get_my_role() IN ('admin','gestor','social','designer','comercial','financeiro')
  OR id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','gestor','comercial'));
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE USING (get_my_role() IN ('admin','gestor','comercial'));
CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE USING (get_my_role() = 'admin');

-- ─── TASKS ───────────────────────────────────
-- Equipe interna vê tudo; cliente vê apenas tarefas do seu cliente
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  get_my_role() IN ('admin','gestor','social','designer','comercial','financeiro')
  OR client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (get_my_role() IN ('admin','gestor','social','designer'));
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (get_my_role() IN ('admin','gestor','social','designer')
    OR (get_my_role() = 'cliente' AND client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (get_my_role() IN ('admin','gestor'));

-- ─── TASK COMMENTS ───────────────────────────
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (
    get_my_role() IN ('admin','gestor','social','designer','comercial')
    OR t.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  ))
);
CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "task_comments_delete" ON public.task_comments
  FOR DELETE USING (user_id = auth.uid() OR get_my_role() IN ('admin','gestor'));

-- ─── TASK CHECKLISTS ─────────────────────────
CREATE POLICY "task_checklists_all" ON public.task_checklists
  FOR ALL USING (get_my_role() IN ('admin','gestor','social','designer'));

-- ─── TASK ATTACHMENTS ────────────────────────
CREATE POLICY "task_attachments_select" ON public.task_attachments FOR SELECT USING (
  get_my_role() IN ('admin','gestor','social','designer')
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND
    t.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "task_attachments_insert" ON public.task_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "task_attachments_delete" ON public.task_attachments
  FOR DELETE USING (uploaded_by = auth.uid() OR get_my_role() IN ('admin','gestor'));

-- ─── APPROVALS ───────────────────────────────
CREATE POLICY "approvals_select" ON public.approvals FOR SELECT USING (
  get_my_role() IN ('admin','gestor','social','designer')
  OR reviewer_id = auth.uid()
  OR client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "approvals_insert" ON public.approvals
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- ─── LEADS ───────────────────────────────────
CREATE POLICY "leads_all" ON public.leads
  FOR ALL USING (get_my_role() IN ('admin','gestor','comercial'));

-- ─── FINANCEIRO ──────────────────────────────
CREATE POLICY "fin_rec_select" ON public.financial_receivables FOR SELECT USING (
  get_my_role() IN ('admin','gestor','financeiro')
  OR client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "fin_rec_modify" ON public.financial_receivables
  FOR ALL USING (get_my_role() IN ('admin','gestor','financeiro'));

CREATE POLICY "fin_pay_all" ON public.financial_payables
  FOR ALL USING (get_my_role() IN ('admin','gestor','financeiro'));

-- ─── TEAMS ───────────────────────────────────
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "teams_modify" ON public.teams
  FOR ALL USING (get_my_role() IN ('admin','gestor'));

CREATE POLICY "team_members_select" ON public.team_members
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "team_members_modify" ON public.team_members
  FOR ALL USING (get_my_role() IN ('admin','gestor'));

-- ─── SUPPLIERS ───────────────────────────────
CREATE POLICY "suppliers_select" ON public.suppliers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "suppliers_modify" ON public.suppliers
  FOR ALL USING (get_my_role() IN ('admin','gestor','financeiro'));

-- ─── ACTIVITY LOGS ───────────────────────────
CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT USING (get_my_role() IN ('admin','gestor') OR user_id = auth.uid());
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================
-- STORAGE BUCKETS
-- =============================================
-- Execute via Supabase Dashboard → Storage → New Bucket
-- Ou via API:
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('task-arts', 'task-arts', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage RLS para task-arts
CREATE POLICY "task_arts_select" ON storage.objects FOR SELECT USING (bucket_id = 'task-arts');
CREATE POLICY "task_arts_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'task-arts' AND auth.role() = 'authenticated'
);
CREATE POLICY "task_arts_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'task-arts' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR get_my_role() IN ('admin','gestor')
  )
);
*/

-- =============================================
-- DADOS INICIAIS DE EXEMPLO
-- =============================================
-- Descomente e execute após criar os usuários via Auth Dashboard

/*
-- Usuários de demonstração (crie via Auth Dashboard primeiro):
-- admin@sejacreate.com / 123456 — role: admin
-- gestor@sejacreate.com / 123456 — role: gestor
-- etc.

-- Clientes de exemplo
INSERT INTO public.clients (name, contact_name, email, phone, services, plan, monthly_revenue, status) VALUES
  ('TechVision Soluções', 'Carlos Mendes', 'carlos@techvision.com', '(11) 9 8765-4321', ARRAY['Social Media','Design','Tráfego Pago'], 'Premium', 8500, 'ativo'),
  ('Bella Moda Store', 'Patricia Sousa', 'paty@bellamoda.com', '(11) 9 7654-3210', ARRAY['Social Media','Design'], 'Padrão', 5200, 'ativo'),
  ('Construtora Rocha & Cia', 'Roberto Rocha', 'roberto@rocha.com', '(21) 9 6543-2109', ARRAY['Branding','Design'], 'Starter', 3800, 'ativo'),
  ('Café Aroma Especial', 'Mariana Luz', 'mariana@aromaespecial.com', '(11) 9 5432-1098', ARRAY['Social Media'], 'Basic', 2500, 'ativo'),
  ('Pharma Saúde Total', 'Dra. Beatriz Faria', 'beatriz@pharmasaude.com', '(41) 9 3210-9876', ARRAY['Social Media','Consultoria'], 'Padrão', 4100, 'ativo');
*/
