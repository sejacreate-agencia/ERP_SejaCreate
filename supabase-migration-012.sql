-- =============================================
-- MIGRATION 012 — Refinamentos (paridade LocHub)
-- =============================================
-- Fase 6: card rico (informações de postagem, tags, links relacionados),
-- notificações com @menção e etapa "Solicitado" no Kanban.
--
-- Idempotente. Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) TASKS — campos de postagem / organização
-- ─────────────────────────────────────────────
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS post_title      TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS caption         TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS hashtags        TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS social_account  TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS publish_type    TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS channels        TEXT[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS internal_notes  TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags            TEXT[] DEFAULT '{}';

-- ─────────────────────────────────────────────
-- 2) TASK_LINKS — links relacionados
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_links (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label      TEXT,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_links_task ON public.task_links(task_id);

-- ─────────────────────────────────────────────
-- 3) NOTIFICATIONS — notificações direcionadas (ex.: @menção)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_id      UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  comment_id   UUID,
  type         TEXT NOT NULL DEFAULT 'mention',
  text         TEXT,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- ─────────────────────────────────────────────
-- 4) RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.task_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_links_all" ON public.task_links;
CREATE POLICY "task_links_all" ON public.task_links FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5) KANBAN — etapa "Solicitado" (primeira)
-- ─────────────────────────────────────────────
INSERT INTO public.kanban_columns (key, label, position, color, is_system)
  VALUES ('Solicitado', 'Solicitado', 0, '#6366f1', false)
  ON CONFLICT (key) DO NOTHING;
