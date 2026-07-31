-- =============================================
-- MIGRATION 003 — Meta Reports
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS public.meta_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Rascunho'
               CHECK (status IN ('Rascunho', 'Revisão', 'Revisado', 'Enviado')),
  fb_data      JSONB DEFAULT '{}'::jsonb,
  ig_data      JSONB DEFAULT '{}'::jsonb,
  canva_url    TEXT,
  sent_at      TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, month, year)
);

-- Trigger de updated_at (reutiliza a função criada na migration 001)
DROP TRIGGER IF EXISTS meta_reports_updated_at ON public.meta_reports;
CREATE TRIGGER meta_reports_updated_at
  BEFORE UPDATE ON public.meta_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: mesma política permissiva usada nas outras tabelas
ALTER TABLE public.meta_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_reports_all" ON public.meta_reports;
CREATE POLICY "meta_reports_all" ON public.meta_reports
  FOR ALL USING (true) WITH CHECK (true);
