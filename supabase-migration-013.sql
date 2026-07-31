-- =============================================
-- MIGRATION 013 — CRM: anotações e anexos de proposta + vínculo cliente↔usuário
-- =============================================
-- 1) Anotações datadas por lead (histórico de contato)
-- 2) Anexos por lead (proposta em PDF, contrato, etc.)
-- 3) Índice/constraint do profiles.client_id (portal do cliente)
-- 4) Bucket de storage 'crm-files'
--
-- Idempotente. Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) LEAD_NOTES — anotações datadas
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON public.lead_notes(lead_id);

-- ─────────────────────────────────────────────
-- 2) LEAD_ATTACHMENTS — proposta e demais arquivos
--    kind: 'proposta' | 'contrato' | 'outro'
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT,
  file_type   TEXT,
  kind        TEXT NOT NULL DEFAULT 'proposta',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead ON public.lead_attachments(lead_id);

-- ─────────────────────────────────────────────
-- 3) RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.lead_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_notes_all" ON public.lead_notes;
CREATE POLICY "lead_notes_all" ON public.lead_notes
  FOR ALL USING (get_my_role() IN ('admin','gestor','comercial'))
  WITH CHECK (get_my_role() IN ('admin','gestor','comercial'));

DROP POLICY IF EXISTS "lead_attachments_all" ON public.lead_attachments;
CREATE POLICY "lead_attachments_all" ON public.lead_attachments
  FOR ALL USING (get_my_role() IN ('admin','gestor','comercial'))
  WITH CHECK (get_my_role() IN ('admin','gestor','comercial'));

-- ─────────────────────────────────────────────
-- 4) PROFILES.CLIENT_ID — portal do cliente
--    Sem esse vínculo o RLS de tasks/clients devolve 0 linhas
--    e o usuário com role='cliente' vê a Área do Cliente vazia.
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles(client_id);

-- Diagnóstico: usuários com role='cliente' ainda sem vínculo.
-- Enquanto aparecerem aqui, esses usuários NÃO enxergam conteúdo algum.
DO $$
DECLARE orfaos TEXT;
BEGIN
  SELECT string_agg(COALESCE(full_name, email), ', ')
    INTO orfaos
    FROM public.profiles
   WHERE role = 'cliente' AND client_id IS NULL;

  IF orfaos IS NOT NULL THEN
    RAISE NOTICE 'Usuários cliente SEM cliente vinculado (não veem conteúdo): %', orfaos;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 5) STORAGE — bucket para arquivos do CRM
-- ─────────────────────────────────────────────
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('crm-files', 'crm-files', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  EXECUTE 'DROP POLICY IF EXISTS "crm_files_select" ON storage.objects';
  EXECUTE 'CREATE POLICY "crm_files_select" ON storage.objects FOR SELECT USING (bucket_id = ''crm-files'')';

  EXECUTE 'DROP POLICY IF EXISTS "crm_files_insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "crm_files_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''crm-files'' AND auth.role() = ''authenticated'')';

  EXECUTE 'DROP POLICY IF EXISTS "crm_files_update" ON storage.objects';
  EXECUTE 'CREATE POLICY "crm_files_update" ON storage.objects FOR UPDATE USING (bucket_id = ''crm-files'' AND auth.role() = ''authenticated'')';

  EXECUTE 'DROP POLICY IF EXISTS "crm_files_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "crm_files_delete" ON storage.objects FOR DELETE USING (bucket_id = ''crm-files'' AND get_my_role() IN (''admin'',''gestor'',''comercial''))';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage não configurado via SQL (crie o bucket crm-files pelo Dashboard): %', SQLERRM;
END $$;
