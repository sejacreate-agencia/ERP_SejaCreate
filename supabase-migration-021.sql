-- =============================================
-- MIGRATION 021 — Agenda do dia: itens pessoais
-- Execute no Supabase SQL Editor.
-- =============================================
-- Lista pessoal de cada usuário, separada dos cards de cliente da tabela
-- `tasks`. É o que sustenta a captura rápida e os dois modos (criativo e
-- administrativo) da aba Agenda.
--
-- Por que tabela nova e não reaproveitar `tasks`: dois impedimentos concretos.
--   1. A policy tasks_insert (supabase-schema.sql:346) bloqueia os perfis
--      'comercial' e 'financeiro' — justamente quem mais usaria o modo
--      administrativo.
--   2. Todo INSERT em `tasks` dispara o trigger tasks_request_number e consome
--      um ART-00X da sequência das artes, poluindo a numeração do kanban com
--      recados pessoais.

CREATE TABLE IF NOT EXISTS public.agenda_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  -- inbox    = capturado, ainda não triado (ignora o dia até ser triado)
  -- criativo = estratégia, conteúdo, decisões
  -- admin    = financeiro, atendimento, gestão
  modo       TEXT NOT NULL DEFAULT 'inbox'
               CHECK (modo IN ('inbox', 'criativo', 'admin')),
  dia        DATE NOT NULL DEFAULT CURRENT_DATE,
  feito      BOOLEAN NOT NULL DEFAULT false,
  feito_em   TIMESTAMPTZ,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_items_user_dia
  ON public.agenda_items(user_id, dia, modo);

-- Itens em aberto: a consulta mais frequente da tela (pendências de dias
-- anteriores + caixa de entrada).
CREATE INDEX IF NOT EXISTS idx_agenda_items_abertos
  ON public.agenda_items(user_id, feito) WHERE feito = false;

DROP TRIGGER IF EXISTS agenda_items_updated_at ON public.agenda_items;
CREATE TRIGGER agenda_items_updated_at
  BEFORE UPDATE ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- RLS — estritamente pessoal
-- ---------------------------------------------
-- Sem exceção para admin ou gestor, de propósito: é a lista particular de cada
-- um. Ninguém precisa ver a do outro, nem para "supervisionar" — para isso
-- existe o kanban, que é onde mora o trabalho de cliente.
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda_items_select" ON public.agenda_items;
CREATE POLICY "agenda_items_select" ON public.agenda_items
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "agenda_items_insert" ON public.agenda_items;
CREATE POLICY "agenda_items_insert" ON public.agenda_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agenda_items_update" ON public.agenda_items;
CREATE POLICY "agenda_items_update" ON public.agenda_items
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "agenda_items_delete" ON public.agenda_items;
CREATE POLICY "agenda_items_delete" ON public.agenda_items
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- SELECT modo, dia, feito, texto FROM public.agenda_items
--  WHERE user_id = auth.uid() ORDER BY dia DESC, modo, ordem;
