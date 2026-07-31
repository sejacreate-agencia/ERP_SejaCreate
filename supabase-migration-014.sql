-- =============================================
-- MIGRATION 014 — Briefing nativo por cliente
-- =============================================
-- Substitui o Google Forms: cada cliente recebe um link tokenizado
-- (briefing.html?t=<token>) que ele abre pelo celular e responde. A
-- resposta cai direto no dossiê do cliente correspondente.
--
-- Idempotente. Rodar no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1) TABELA
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_briefings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','respondido')),
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  source       TEXT NOT NULL DEFAULT 'form'
                 CHECK (source IN ('form','import')),
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_briefings_client ON public.client_briefings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_briefings_token  ON public.client_briefings(token);

DROP TRIGGER IF EXISTS client_briefings_updated_at ON public.client_briefings;
CREATE TRIGGER client_briefings_updated_at
  BEFORE UPDATE ON public.client_briefings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- 2) RLS — equipe interna lê/escreve; anon NÃO toca na tabela
-- ─────────────────────────────────────────────
ALTER TABLE public.client_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_briefings_equipe" ON public.client_briefings;
CREATE POLICY "client_briefings_equipe" ON public.client_briefings
  FOR ALL
  USING      (get_my_role() IN ('admin','gestor','social','designer','comercial'))
  WITH CHECK (get_my_role() IN ('admin','gestor','social','designer','comercial'));

-- Nenhuma policy para anon: sem as funções abaixo, a tabela é inacessível
-- pela chave anônima. Isso é proposital — uma policy de SELECT permissiva
-- deixaria qualquer visitante listar os briefings de TODOS os clientes
-- via PostgREST, bastando remover o filtro de token da URL.

-- ─────────────────────────────────────────────
-- 3) RPCs — a única porta de entrada do formulário público
-- ─────────────────────────────────────────────

-- Lê apenas o briefing daquele token. Nunca devolve o client_id nem
-- permite listar — o token é a credencial.
CREATE OR REPLACE FUNCTION public.briefing_get(p_token TEXT)
RETURNS TABLE (client_name TEXT, status TEXT, answers JSONB, submitted_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, b.status, b.answers, b.submitted_at
    FROM public.client_briefings b
    JOIN public.clients c ON c.id = b.client_id
   WHERE b.token = p_token
   LIMIT 1;
$$;

-- Grava as respostas. Retorna TRUE se o token existia.
CREATE OR REPLACE FUNCTION public.briefing_submit(p_token TEXT, p_answers JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE achou INT;
BEGIN
  -- Guarda contra payload abusivo vindo de um cliente anônimo
  IF p_answers IS NULL OR pg_column_size(p_answers) > 200000 THEN
    RAISE EXCEPTION 'payload invalido';
  END IF;

  UPDATE public.client_briefings
     SET answers      = p_answers,
         status       = 'respondido',
         source       = 'form',
         submitted_at = NOW()
   WHERE token = p_token;

  GET DIAGNOSTICS achou = ROW_COUNT;
  RETURN achou > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.briefing_get(TEXT)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.briefing_submit(TEXT, JSONB)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.briefing_get(TEXT)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.briefing_submit(TEXT, JSONB) TO anon, authenticated;
