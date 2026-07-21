-- =============================================
-- MIGRATION 008 — Solicitar Artes + Kanban evoluído
-- =============================================
-- Fase 1 do plano da Suíte Operacional de Marketing.
-- - Garante bucket task-arts + policies (destrava upload de artes)
-- - Adiciona campos de "solicitação de arte" na tabela tasks
-- - Numeração automática ART-001 (sequence + trigger)
-- - Torna as colunas do Kanban customizáveis (tabela kanban_columns)
-- - Adiciona kind aos anexos (arte | referencia | ...)
--
-- Idempotente: pode ser executada mais de uma vez com segurança.
-- Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) TASKS — campos de solicitação de arte
-- ─────────────────────────────────────────────
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS request_number  TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS art_type        TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS channel         TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approval_target TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deadline        DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requester_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS origin          TEXT DEFAULT 'solicitacao';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planning_id     UUID;  -- FK adicionada na migration 010 (Planejamentos)

-- Remove o CHECK fixo de status: as colunas passam a ser validadas pela
-- existência em kanban_columns (customizáveis pelo usuário).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- ─────────────────────────────────────────────
-- 2) Numeração automática ART-001
-- ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.marketing_art_seq START 1;

CREATE OR REPLACE FUNCTION public.set_task_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'ART-' || lpad(nextval('public.marketing_art_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_request_number ON public.tasks;
CREATE TRIGGER tasks_request_number
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_request_number();

-- Backfill dos cards existentes que ainda não têm número
UPDATE public.tasks
   SET request_number = 'ART-' || lpad(nextval('public.marketing_art_seq')::text, 3, '0')
 WHERE request_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_request_number ON public.tasks(request_number);
CREATE INDEX IF NOT EXISTS idx_tasks_origin ON public.tasks(origin);

-- ─────────────────────────────────────────────
-- 3) TASK_ATTACHMENTS — tipo de anexo (arte/referência)
-- ─────────────────────────────────────────────
ALTER TABLE public.task_attachments ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'arte';

-- ─────────────────────────────────────────────
-- 4) KANBAN_COLUMNS — colunas customizáveis
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,   -- valor gravado em tasks.status
  label      TEXT NOT NULL,          -- rótulo exibido
  position   INT  NOT NULL DEFAULT 0,
  color      TEXT DEFAULT '#64748b',
  is_system  BOOLEAN NOT NULL DEFAULT false,  -- true = usada por integrações (não renomeável/removível)
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS kanban_columns_updated_at ON public.kanban_columns;
CREATE TRIGGER kanban_columns_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed com as 9 colunas atuais (mantém cards existentes válidos).
-- is_system=true nos statuses reservados por WhatsApp/Meta/Área do Cliente.
INSERT INTO public.kanban_columns (key, label, position, color, is_system) VALUES
  ('Pauta',                 'Pauta',                 1, '#64748b', false),
  ('Conteúdo em Produção',  'Conteúdo em Produção',  2, '#3b82f6', false),
  ('Arte em Produção',      'Arte em Produção',      3, '#8b5cf6', false),
  ('Aprovação Interna',     'Aprovação Interna',     4, '#f59e0b', false),
  ('Enviado ao Cliente',    'Enviado ao Cliente',    5, '#06b6d4', true),
  ('Ajuste Solicitado',     'Ajuste Solicitado',     6, '#ef4444', true),
  ('Aprovado',              'Aprovado',              7, '#10b981', true),
  ('Programado',            'Programado',            8, '#ec4899', true),
  ('Publicado',             'Publicado',             9, '#22c55e', true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kanban_columns_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_all" ON public.kanban_columns
  FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5) STORAGE — garante bucket público + policies (destrava upload)
-- ─────────────────────────────────────────────
-- Envolvido em DO/EXCEPTION: se sua conta não permitir criar policies em
-- storage.objects via SQL, o bloco falha silenciosamente (RAISE NOTICE) e o
-- restante da migration acima permanece aplicado. Nesse caso, crie o bucket
-- "task-arts" (público) pelo Dashboard → Storage.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
    VALUES ('task-arts', 'task-arts', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

  EXECUTE 'DROP POLICY IF EXISTS "task_arts_select" ON storage.objects';
  EXECUTE 'CREATE POLICY "task_arts_select" ON storage.objects FOR SELECT USING (bucket_id = ''task-arts'')';

  EXECUTE 'DROP POLICY IF EXISTS "task_arts_insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "task_arts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''task-arts'' AND auth.role() = ''authenticated'')';

  EXECUTE 'DROP POLICY IF EXISTS "task_arts_update" ON storage.objects';
  EXECUTE 'CREATE POLICY "task_arts_update" ON storage.objects FOR UPDATE USING (bucket_id = ''task-arts'' AND auth.role() = ''authenticated'')';

  EXECUTE 'DROP POLICY IF EXISTS "task_arts_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "task_arts_delete" ON storage.objects FOR DELETE USING (bucket_id = ''task-arts'' AND (auth.uid()::text = (storage.foldername(name))[1] OR get_my_role() IN (''admin'',''gestor'')))';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage não configurado via SQL (crie o bucket task-arts pelo Dashboard): %', SQLERRM;
END $$;
