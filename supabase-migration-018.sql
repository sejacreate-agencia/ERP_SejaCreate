-- =============================================
-- MIGRATION 018 — Recupera os anexos perdidos pelo bug do uploaded_by
-- Execute no Supabase SQL Editor.
-- =============================================
-- Contexto: até a correção do uploaded_by, a policy
-- task_attachments_insert recusava TODO insert de anexo (403). O arquivo
-- subia para o storage, mas a linha nunca era criada — o card seguia
-- mostrando "Sem arte ainda".
--
-- Esta migration reconstrói as linhas a partir do próprio storage. Roda no
-- SQL Editor como postgres, então enxerga storage.objects e não esbarra na
-- RLS — por isso consegue preservar o uploader ORIGINAL (owner_id), coisa
-- que o frontend não conseguiria fazer.
--
-- Idempotente: só insere o que ainda não existe. Pode rodar de novo sem
-- duplicar.

-- ---------------------------------------------
-- 1) Conferir ANTES (opcional)
-- ---------------------------------------------
-- SELECT count(*) AS arquivos_no_storage
--   FROM storage.objects
--  WHERE bucket_id = 'task-arts' AND name LIKE 'tasks/%/%';
-- SELECT count(*) AS anexos_registrados FROM public.task_attachments;

-- ---------------------------------------------
-- 2) Reconstruir
-- ---------------------------------------------
WITH arquivos AS (
  SELECT
    o.name,
    o.owner_id,
    o.created_at,
    o.metadata->>'mimetype' AS mimetype,
    split_part(o.name, '/', 2)        AS task_txt,
    split_part(o.name, '/', 3)        AS arquivo
  FROM storage.objects o
  WHERE o.bucket_id = 'task-arts'
    AND o.name LIKE 'tasks/%/%'
    -- ignora pastas mais profundas e nomes fora do padrão
    AND split_part(o.name, '/', 4) = ''
    -- a pasta precisa ser um UUID válido
    AND split_part(o.name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
),
prontos AS (
  SELECT
    a.task_txt::uuid AS task_id,
    -- o <img> quebra em espaço, # e ?; o resto o navegador resolve
    'https://owauukcjdasumguvzqch.supabase.co/storage/v1/object/public/task-arts/'
      || replace(replace(replace(a.name, ' ', '%20'), '#', '%23'), '?', '%3F') AS file_url,
    -- tira o prefixo de timestamp que o upload adiciona: 1786149548549_0_foto.png
    regexp_replace(a.arquivo, '^\d{10,16}_(\d+_)?', '') AS file_name,
    COALESCE(a.mimetype, 'application/octet-stream')    AS file_type,
    CASE WHEN a.arquivo LIKE 'ref\_%' THEN 'referencia' ELSE 'arte' END AS kind,
    -- só usa o dono se ele ainda existir em profiles (a FK exige).
    -- storage.objects.owner_id é TEXT e profiles.id é UUID — compara como
    -- texto, que também evita erro caso o owner_id não seja um UUID válido.
    (SELECT p.id FROM public.profiles p WHERE p.id::text = a.owner_id) AS uploaded_by,
    a.created_at
  FROM arquivos a
  -- só para tarefas que ainda existem
  WHERE EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = a.task_txt::uuid)
)
INSERT INTO public.task_attachments (task_id, file_url, file_name, file_type, kind, uploaded_by, created_at)
SELECT p.task_id, p.file_url, p.file_name, p.file_type, p.kind, p.uploaded_by, p.created_at
FROM prontos p
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_attachments ta
   WHERE ta.task_id = p.task_id AND ta.file_url = p.file_url
);

-- ---------------------------------------------
-- 3) Capa do card (art_url) para quem ficou sem
-- ---------------------------------------------
UPDATE public.tasks t
   SET art_url = sub.file_url
  FROM (
    SELECT DISTINCT ON (task_id) task_id, file_url
      FROM public.task_attachments
     WHERE kind = 'arte' AND file_type LIKE 'image/%'
     ORDER BY task_id, created_at ASC
  ) sub
 WHERE t.id = sub.task_id
   AND (t.art_url IS NULL OR t.art_url = '');

-- ---------------------------------------------
-- 4) Conferir DEPOIS
-- ---------------------------------------------
-- SELECT count(*) AS anexos_recuperados FROM public.task_attachments;
-- SELECT t.title, ta.file_name, ta.kind, p.full_name AS enviado_por
--   FROM public.task_attachments ta
--   JOIN public.tasks t ON t.id = ta.task_id
--   LEFT JOIN public.profiles p ON p.id = ta.uploaded_by
--  ORDER BY ta.created_at DESC;

-- ---------------------------------------------
-- Arquivos orfaos (tarefa ja excluida) — NAO sao recuperados acima,
-- porque nao ha card a que vincular. Para ver o que sobrou no storage:
--
-- SELECT o.name, pg_size_pretty((o.metadata->>'size')::bigint) AS tamanho, o.created_at
--   FROM storage.objects o
--  WHERE o.bucket_id = 'task-arts' AND o.name LIKE 'tasks/%/%'
--    AND NOT EXISTS (
--      SELECT 1 FROM public.tasks t WHERE t.id::text = split_part(o.name, '/', 2))
--  ORDER BY o.created_at;
