-- =============================================
-- MIGRATION 017 — Limite de tamanho dos anexos de arte
-- Execute no Supabase SQL Editor.
-- =============================================
-- O bucket 'task-arts' foi criado sem file_size_limit, então herdava o
-- limite GLOBAL do projeto. Aqui ele passa a ser explícito.
--
-- IMPORTANTE: o limite efetivo é sempre o MENOR entre:
--   1. este valor do bucket
--   2. o limite global do projeto
--      (Dashboard → Storage → Settings → "Upload file size limit")
--
-- Subir só o valor daqui NÃO adianta se o global estiver menor. No plano
-- Free o teto é 50MB por arquivo; acima disso exige plano pago.
--
-- Se mudar este número, ajuste também ART_MAX_MB em js/tarefas.js —
-- é ele que dá a mensagem amigável antes de tentar o upload.

UPDATE storage.buckets
   SET file_size_limit = 52428800          -- 50 MB
 WHERE id IN ('task-arts', 'crm-files');

-- Conferência:
-- SELECT id, public, file_size_limit,
--        pg_size_pretty(file_size_limit) AS limite
--   FROM storage.buckets;
