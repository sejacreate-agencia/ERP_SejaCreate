-- =============================================
-- MIGRATION 020 — Google Agenda por OAuth (botão "Conectar")
-- Execute no Supabase SQL Editor.
-- =============================================
-- Substitui a conta de serviço da migration 019. Agora cada pessoa clica em
-- "Conectar com o Google", autoriza na tela do Google e pronto — sem copiar
-- e-mail nem mexer nas configurações de compartilhamento do Google Agenda.
--
-- Por que agora dá para usar OAuth: o limite de 7 dias do refresh token vale
-- APENAS para apps com status "Testing" (documentação oficial do Google).
-- Publicando o app, mesmo sem verificação, o token deixa de expirar. O custo
-- é a tela "o Google não verificou este app", que cada pessoa vê uma única vez.

-- ---------------------------------------------
-- 1) CREDENCIAIS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_credentials (
  user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_sub         TEXT,          -- id estável da conta Google (o e-mail pode mudar)
  google_email       TEXT,
  refresh_token      TEXT NOT NULL, -- vida longa; só a Edge Function lê
  access_token       TEXT,          -- cache, expira em ~1h
  access_expires_at  TIMESTAMPTZ,
  scope              TEXT,          -- o que o Google REALMENTE concedeu
  calendar_id        TEXT NOT NULL DEFAULT 'primary',
  revoked_at         TIMESTAMPTZ,   -- marcado quando o Google devolve invalid_grant
  last_error         TEXT,
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS google_credentials_updated_at ON public.google_credentials;
CREATE TRIGGER google_credentials_updated_at
  BEFORE UPDATE ON public.google_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS SEM NENHUMA POLICY — é proposital, e é o ponto mais importante daqui.
-- Com RLS ligado e zero policies, o comportamento é "nega tudo": nem `anon`
-- nem `authenticated` leem uma linha sequer, nem por descuido numa query
-- futura. Só o service_role das Edge Functions entra.
--
-- Se um dia alguém precisar expor algo desta tabela ao front, NÃO crie policy
-- aqui: acrescente um campo na resposta da ação 'status' da função gcal. O
-- refresh_token não pode ter caminho de leitura a partir do navegador.
ALTER TABLE public.google_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_credentials FROM anon, authenticated;

-- ---------------------------------------------
-- 2) STATE DO OAUTH
-- ---------------------------------------------
-- O callback é público (o navegador volta do Google sem Authorization), então
-- ele precisa de outra forma de saber de QUEM é o código recebido. O `state`
-- é esse bilhete: gravado por uma função autenticada, com o user_id tirado do
-- JWT, e consumido uma única vez.
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,      -- PKCE
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used_at       TIMESTAMPTZ
);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_oauth_states FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_google_states_expires
  ON public.google_oauth_states(expires_at);

-- ---------------------------------------------
-- 3) Aposenta a tabela da conta de serviço
-- ---------------------------------------------
-- A migration 019 guardava qual agenda cada um havia compartilhado. Com OAuth
-- a agenda é sempre a 'primary' de quem autorizou, então a tabela perde a
-- função. Quem estava conectado precisa clicar em "Conectar com o Google" uma
-- vez — leva alguns segundos.
DROP TABLE IF EXISTS public.google_calendars;

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- SELECT p.full_name, g.google_email, g.connected_at, g.revoked_at
--   FROM public.google_credentials g
--   JOIN public.profiles p ON p.id = g.user_id;
