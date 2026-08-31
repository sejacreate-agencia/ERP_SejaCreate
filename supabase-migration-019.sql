-- =============================================
-- MIGRATION 019 — Google Agenda por conta de serviço
-- Execute no Supabase SQL Editor.
-- =============================================
-- Guarda QUAL agenda do Google pertence a cada usuário do ERP.
--
-- Não há segredo nesta tabela: `calendar_id` é apenas o e-mail da agenda.
-- A única credencial da integração é a chave da conta de serviço, que vive
-- exclusivamente no ambiente da Edge Function (supabase secrets set) e nunca
-- encosta no banco nem no navegador.
--
-- Por que conta de serviço e não OAuth: com contas @gmail.com (sem Google
-- Workspace), um app OAuth em modo Testing tem os refresh tokens revogados a
-- cada 7 dias — a equipe inteira teria que reconectar toda semana. A conta de
-- serviço não expira: cada pessoa compartilha a própria agenda uma vez, pelo
-- Google Agenda, e nunca mais precisa mexer.

CREATE TABLE IF NOT EXISTS public.google_calendars (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- O id de uma agenda do Google é o e-mail dela. Para a agenda principal de
  -- uma pessoa, é o próprio e-mail da conta Google.
  calendar_id TEXT NOT NULL,
  label       TEXT,
  -- Última vez que a Edge Function confirmou que consegue ler esta agenda.
  -- NULL = configurado mas nunca verificado (provável falta do compartilhamento).
  verified_at TIMESTAMPTZ,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS google_calendars_updated_at ON public.google_calendars;
CREATE TRIGGER google_calendars_updated_at
  BEFORE UPDATE ON public.google_calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------
-- RLS — cada um cuida da própria agenda
-- ---------------------------------------------
ALTER TABLE public.google_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_calendars_select" ON public.google_calendars;
CREATE POLICY "google_calendars_select" ON public.google_calendars
  FOR SELECT USING (user_id = auth.uid() OR get_my_role() IN ('admin','gestor'));

DROP POLICY IF EXISTS "google_calendars_insert" ON public.google_calendars;
CREATE POLICY "google_calendars_insert" ON public.google_calendars
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "google_calendars_update" ON public.google_calendars;
CREATE POLICY "google_calendars_update" ON public.google_calendars
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "google_calendars_delete" ON public.google_calendars;
CREATE POLICY "google_calendars_delete" ON public.google_calendars
  FOR DELETE USING (user_id = auth.uid() OR get_my_role() = 'admin');

-- ---------------------------------------------
-- Conferência (opcional)
-- ---------------------------------------------
-- SELECT p.full_name, g.calendar_id, g.verified_at, g.last_error
--   FROM public.google_calendars g
--   JOIN public.profiles p ON p.id = g.user_id
--  ORDER BY p.full_name;
