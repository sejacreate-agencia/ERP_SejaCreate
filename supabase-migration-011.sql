-- =============================================
-- MIGRATION 011 — Workspace do Cliente + Onboarding
-- =============================================
-- Fase 4 do plano. Por cliente: briefing (dados), onboarding (checklist de
-- 9 etapas), anotações de reunião, links importantes e anexos (arquivos).
--
-- Idempotente. Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) BRIEFING (campo de texto no cliente)
-- ─────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS briefing TEXT;

-- ─────────────────────────────────────────────
-- 2) ONBOARDING — checklist (1 linha por cliente, etapas em JSONB)
--    steps: [{ key, label, done, done_at, note }]
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_onboarding (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  steps      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id)
);
DROP TRIGGER IF EXISTS client_onboarding_updated_at ON public.client_onboarding;
CREATE TRIGGER client_onboarding_updated_at
  BEFORE UPDATE ON public.client_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 3) ANOTAÇÕES (log de reuniões)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title      TEXT,
  content    TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON public.client_notes(client_id);
DROP TRIGGER IF EXISTS client_notes_updated_at ON public.client_notes;
CREATE TRIGGER client_notes_updated_at
  BEFORE UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 4) LINKS IMPORTANTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_links (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  category   TEXT DEFAULT 'outro',   -- identidade | fotos | drive | outro
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_links_client ON public.client_links(client_id);

-- ─────────────────────────────────────────────
-- 5) ANEXOS (arquivos: briefing, identidade, fotos)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT,
  file_type   TEXT,
  kind        TEXT DEFAULT 'briefing',  -- briefing | identidade | foto | outro
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_attachments_client ON public.client_attachments(client_id);

-- ─────────────────────────────────────────────
-- 6) RLS (permissiva — mesmo padrão das demais migrations)
-- ─────────────────────────────────────────────
ALTER TABLE public.client_onboarding  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_attachments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_onboarding_all" ON public.client_onboarding;
CREATE POLICY "client_onboarding_all" ON public.client_onboarding FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_notes_all" ON public.client_notes;
CREATE POLICY "client_notes_all" ON public.client_notes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_links_all" ON public.client_links;
CREATE POLICY "client_links_all" ON public.client_links FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "client_attachments_all" ON public.client_attachments;
CREATE POLICY "client_attachments_all" ON public.client_attachments FOR ALL USING (true) WITH CHECK (true);
