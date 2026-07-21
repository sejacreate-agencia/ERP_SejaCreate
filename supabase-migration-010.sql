-- =============================================
-- MIGRATION 010 — Planejamentos (calendário editorial)
-- =============================================
-- Fase 3 do plano. Cria a tabela de planejamento de conteúdo e liga o
-- card do Kanban ao planejamento de origem (tasks.planning_id).
-- Aprovar um planejamento gera automaticamente um card no Kanban (feito no app).
--
-- Idempotente. Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.marketing_plannings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  content           TEXT,
  format            TEXT,                          -- Carrossel, Stories, Reels, Post...
  channels          TEXT[] DEFAULT '{}',           -- Instagram, Facebook...
  planned_date      DATE,
  assignee_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  production_status TEXT DEFAULT 'Planejado'
                    CHECK (production_status IN ('Planejado','Em Produção','Produzido')),
  approval_status   TEXT DEFAULT 'Aguardando'
                    CHECK (approval_status IN ('Aguardando','Aprovado','Ajuste')),
  status            TEXT DEFAULT 'Em andamento'
                    CHECK (status IN ('Em andamento','Concluído','Cancelado')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plannings_client ON public.marketing_plannings(client_id);
CREATE INDEX IF NOT EXISTS idx_plannings_date   ON public.marketing_plannings(planned_date);

DROP TRIGGER IF EXISTS plannings_updated_at ON public.marketing_plannings;
CREATE TRIGGER plannings_updated_at
  BEFORE UPDATE ON public.marketing_plannings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.marketing_plannings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plannings_all" ON public.marketing_plannings;
CREATE POLICY "plannings_all" ON public.marketing_plannings
  FOR ALL USING (true) WITH CHECK (true);

-- Liga o card do Kanban ao planejamento de origem (coluna criada na migration 008)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_planning_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_planning_id_fkey
  FOREIGN KEY (planning_id) REFERENCES public.marketing_plannings(id) ON DELETE SET NULL;
