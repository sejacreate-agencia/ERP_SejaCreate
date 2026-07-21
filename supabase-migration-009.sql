-- =============================================
-- MIGRATION 009 — Histórico de movimentação de cards
-- =============================================
-- Fase 2 do plano. Registra automaticamente (via trigger) toda mudança
-- de status e de responsável dos cards do Kanban, para alimentar a
-- análise de tempo do Dashboard de Marketing (tempo por card, por coluna,
-- gargalos, permanência).
--
-- Idempotente. Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) TABELAS DE HISTÓRICO
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tsh_task ON public.task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_tsh_changed ON public.task_status_history(changed_at);

CREATE TABLE IF NOT EXISTS public.task_assignment_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_assignee UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_assignee   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tah_task ON public.task_assignment_history(task_id);

-- ─────────────────────────────────────────────
-- 2) TRIGGER — status
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
      VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by)
      VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_log_status ON public.tasks;
CREATE TRIGGER tasks_log_status
  AFTER INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();

-- ─────────────────────────────────────────────
-- 3) TRIGGER — responsável
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_task_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.task_assignment_history (task_id, from_assignee, to_assignee, changed_by)
      VALUES (NEW.id, OLD.assignee_id, NEW.assignee_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_log_assignment ON public.tasks;
CREATE TRIGGER tasks_log_assignment
  AFTER UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_assignment_change();

-- ─────────────────────────────────────────────
-- 4) RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.task_status_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tsh_all" ON public.task_status_history;
CREATE POLICY "tsh_all" ON public.task_status_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tah_all" ON public.task_assignment_history;
CREATE POLICY "tah_all" ON public.task_assignment_history FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5) Bootstrap — cria histórico inicial para cards já existentes
-- ─────────────────────────────────────────────
INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_at)
SELECT t.id, NULL, t.status, COALESCE(t.created_at, NOW())
FROM public.tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_status_history h WHERE h.task_id = t.id
);
