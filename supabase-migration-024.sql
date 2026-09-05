-- =============================================
-- MIGRATION 024 — Cobrança Cora
-- Execute no Supabase SQL Editor. Depende da 023.
-- =============================================
-- Quatro tabelas: a conexão (segredo), o bilhete do OAuth (segredo), a cobrança
-- (operacional) e o registro de eventos do webhook (a trava de idempotência).
--
-- MODELO ESCOLHIDO: Parceria Cora, OAuth2 authorization_code. A alternativa
-- (Integração Direta) autentica por mTLS com certificado de cliente, e o
-- suporte do Edge Runtime do Supabase a isso é incerto. O OAuth funciona hoje,
-- e reaproveita o desenho já provado do Google Agenda (migration 020).
--
-- A diferença importante em relação ao Google: lá a credencial é POR USUÁRIO
-- (cada um conecta a própria agenda); aqui é POR ORGANIZAÇÃO. A conta bancária
-- é da empresa, não de quem clicou.

-- ---------------------------------------------
-- 1) CONEXÃO — access_token, refresh_token
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL DEFAULT public.current_org_id()
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL CHECK (provider IN ('cora','nfse_nacional')),
  ambiente          TEXT NOT NULL CHECK (ambiente IN ('stage','producao','restrita')),
  status            TEXT NOT NULL DEFAULT 'nao_configurado'
                      CHECK (status IN ('nao_configurado','conectado','erro','expirado','desconectado')),

  -- ── OAuth (SEGREDOS) ──
  access_token      TEXT,
  access_expires_at TIMESTAMPTZ,
  refresh_token     TEXT,
  scope             TEXT,             -- o que a Cora REALMENTE concedeu
  -- A sessão do cliente final morre com 60 dias de inatividade e derruba os
  -- dois tokens. Guardamos a última renovação bem-sucedida para a tela poder
  -- avisar antes de quebrar, em vez de descobrir na hora de emitir um boleto.
  ultimo_refresh_em TIMESTAMPTZ,

  -- ── Identificação da conta autorizada (escopo `account`) ──
  conta_nome        TEXT,
  conta_documento   TEXT,

  -- ── Webhook ──
  webhook_endpoint_id   TEXT,
  webhook_url           TEXT,
  webhook_registrado_em TIMESTAMPTZ,

  conectado_em      TIMESTAMPTZ,
  desconectado_em   TIMESTAMPTZ,
  ultimo_ok_em      TIMESTAMPTZ,
  ultimo_erro       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, provider, ambiente)
);

DROP TRIGGER IF EXISTS integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS SEM NENHUMA POLICY — mesmo padrão da migration 020, e pelo mesmo motivo.
-- Com RLS ligado e zero policies o comportamento é "nega tudo": nem `anon` nem
-- `authenticated` leem uma linha, nem por descuido numa query futura. Só o
-- service_role das Edge Functions entra.
--
-- Se alguém precisar mostrar algo daqui no front, NÃO crie policy: acrescente
-- um campo na resposta da ação `status` da função `cora`. Um refresh_token da
-- conta bancária da empresa não pode ter caminho de leitura pelo navegador.
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_connections FROM anon, authenticated;

-- ---------------------------------------------
-- 2) STATE DO OAUTH
-- ---------------------------------------------
-- O callback é público (o navegador volta da Cora sem Authorization), então
-- precisa de outra forma de saber que aquele `code` é de um fluxo que NÓS
-- iniciamos. Sem isso, qualquer um autoriza o nosso app na PRÓPRIA conta Cora,
-- chama o nosso callback com o código, e a conta bancária da agência é
-- substituída pela dele — trocamos a conexão sem ninguém perceber.
--
-- Tabela genérica de propósito: o próximo provedor OAuth reusa.
CREATE TABLE IF NOT EXISTS public.integration_oauth_states (
  state      TEXT PRIMARY KEY,
  provider   TEXT NOT NULL,
  ambiente   TEXT NOT NULL,
  org_id     UUID NOT NULL DEFAULT public.current_org_id()
               REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- quem clicou em "Conectar" — só para a trilha de auditoria
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  used_at    TIMESTAMPTZ
);

ALTER TABLE public.integration_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integration_oauth_states FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires
  ON public.integration_oauth_states(expires_at);

-- ---------------------------------------------
-- 3) COBRANÇA
-- ---------------------------------------------
-- Satélite do recebível, nunca substituto dele. `financial_receivables`
-- continua sendo a fonte central do financeiro; esta tabela só sabe o que a
-- Cora sabe.
CREATE TABLE IF NOT EXISTS public.payment_charges (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL DEFAULT public.current_org_id()
                        REFERENCES public.organizations(id),
  receivable_id       UUID NOT NULL REFERENCES public.financial_receivables(id)
                        ON DELETE RESTRICT,
  client_id           UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  provider            TEXT NOT NULL DEFAULT 'cora',
  ambiente            TEXT NOT NULL CHECK (ambiente IN ('stage','producao')),

  provider_charge_id  TEXT,                                       -- inv_...
  -- Gravada ANTES do POST, e reusada em cada retentativa. Se a chave nascesse
  -- na hora da chamada, um duplo-clique ou um retry após timeout de rede
  -- registraria DOIS boletos no banco do cliente.
  idempotency_key     UUID NOT NULL DEFAULT uuid_generate_v4(),

  status              TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
                        'rascunho','enviando','falha_envio','aberta',
                        'em_pagamento','vencida','paga','cancelada')),
  -- String CRUA da Cora (OPEN, LATE, PAID, IN_PAYMENT, CANCELLED...). O status
  -- acima é uma TRADUÇÃO, não um espelho: se a Cora inventar um estado novo
  -- amanhã, ele cai aqui e não estoura o CHECK.
  provider_status     TEXT,

  valor_centavos      BIGINT NOT NULL CHECK (valor_centavos > 0),
  valor_pago_centavos BIGINT NOT NULL DEFAULT 0,
  vencimento          DATE NOT NULL,
  formas              TEXT[] NOT NULL DEFAULT '{BANK_SLIP,PIX}',

  boleto_barcode      TEXT,
  boleto_digitable    TEXT,
  boleto_url          TEXT,
  pix_emv             TEXT,           -- Pix copia e cola

  ocorrencia_em       TIMESTAMPTZ,    -- quando o cliente pagou, segundo a Cora
  provider_payload    JSONB,          -- última resposta completa, para auditoria
  -- Congela nome/documento/endereço enviados. Se o cadastro do cliente mudar
  -- depois, o boleto emitido continua tendo sido emitido com estes dados.
  cliente_snapshot    JSONB,
  tentativas          INT NOT NULL DEFAULT 0,
  ultimo_erro         TEXT,
  criado_por          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS payment_charges_updated_at ON public.payment_charges;
CREATE TRIGGER payment_charges_updated_at
  BEFORE UPDATE ON public.payment_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_charge_provider_id
  ON public.payment_charges(provider, provider_charge_id)
  WHERE provider_charge_id IS NOT NULL;

-- A trava definitiva contra boleto duplicado: no máximo UMA cobrança viva por
-- recebível. É banco, não validação de tela — sobrevive a duplo-clique, a duas
-- abas abertas e a chamada direta na API.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_charge_viva_por_recebivel
  ON public.payment_charges(receivable_id)
  WHERE status NOT IN ('cancelada','falha_envio');

-- Consulta da reconciliação: cobranças que ainda podem mudar de estado.
CREATE INDEX IF NOT EXISTS idx_charge_reconciliar
  ON public.payment_charges(status, updated_at)
  WHERE status IN ('aberta','em_pagamento','vencida');

CREATE INDEX IF NOT EXISTS idx_charge_receivable
  ON public.payment_charges(receivable_id);

ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;

-- Copia fin_rec_modify, mas DELIBERADAMENTE sem o escape do perfil `cliente`
-- que existe em fin_rec_select. Motivo: `provider_payload` guarda a resposta
-- crua da Cora e `cliente_snapshot` guarda documento e endereço.
-- No dia em que a Área do Cliente precisar mostrar o boleto, a saída é a mesma
-- da migration 020: uma ação `meu_boleto` na Edge Function devolvendo só
-- {digitable, url, pix_emv} — não uma policy nova aqui.
DROP POLICY IF EXISTS "charges_select" ON public.payment_charges;
CREATE POLICY "charges_select" ON public.payment_charges
  FOR SELECT USING (get_my_role() IN ('admin','gestor','financeiro'));

-- Só leitura pelo PostgREST. Toda ESCRITA passa por Edge Function com
-- service_role: emitir e cancelar cobrança são operações que falam com um
-- banco, e não podem depender de o navegador mandar os valores certos.
DROP POLICY IF EXISTS "charges_modify" ON public.payment_charges;

-- ---------------------------------------------
-- 4) EVENTOS DE WEBHOOK — idempotência
-- ---------------------------------------------
-- A notificação da Cora chega com CORPO VAZIO e sem assinatura: só os headers
-- webhook-event-id, webhook-event-type e webhook-resource-id. Não há HMAC nem
-- segredo compartilhado para validar.
--
-- Por isso o desenho é: a notificação nunca é fonte de verdade. Ela é um aviso
-- de "algo mudou"; a verdade vem de um GET /v2/invoices/{id} que NÓS fazemos,
-- autenticado com o nosso próprio token. Quem forjar uma notificação consegue,
-- no máximo, nos fazer consultar a nossa própria API.
--
-- A PK composta é a trava de replay: a segunda entrega do mesmo evento viola a
-- chave e o handler responde "duplicado" sem tocar em dinheiro.
CREATE TABLE IF NOT EXISTS public.provider_webhook_events (
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  org_id        UUID NOT NULL DEFAULT public.current_org_id()
                  REFERENCES public.organizations(id),
  event_type    TEXT,
  resource_id   TEXT,
  headers       JSONB,
  recebido_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  resultado     TEXT,
  erro          TEXT,
  PRIMARY KEY (provider, event_id)
);

-- Deny-all: `headers` guarda os cabeçalhos crus da requisição. Quem precisa ver
-- o histórico usa a ação `eventos` da função `cora`.
ALTER TABLE public.provider_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_webhook_events FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_webhook_events_recebido
  ON public.provider_webhook_events(recebido_em DESC);

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- As quatro tabelas devem aparecer, e as três de segredo com rowsecurity = true
-- e ZERO policies:
-- SELECT c.relname, c.relrowsecurity,
--        (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public'
--    AND c.relname IN ('integration_connections','integration_oauth_states',
--                      'payment_charges','provider_webhook_events');
-- Esperado: integration_connections 0, integration_oauth_states 0,
--           provider_webhook_events 0, payment_charges 1 (só o SELECT).
--
-- Teste da trava de cobrança duplicada (copie, descomente, rode inteiro):
-- BEGIN;
--   INSERT INTO public.financial_receivables (description, value, due_date)
--     VALUES ('ZZ teste cobranca', 100, CURRENT_DATE);
--   INSERT INTO public.payment_charges (receivable_id, ambiente, valor_centavos, vencimento)
--     SELECT id, 'stage', 10000, CURRENT_DATE FROM public.financial_receivables
--      WHERE description = 'ZZ teste cobranca';
--   -- A segunda DEVE falhar com uniq_charge_viva_por_recebivel:
--   -- INSERT INTO public.payment_charges (receivable_id, ambiente, valor_centavos, vencimento)
--   --   SELECT id, 'stage', 10000, CURRENT_DATE FROM public.financial_receivables
--   --    WHERE description = 'ZZ teste cobranca';
-- ROLLBACK;
