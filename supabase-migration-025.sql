-- =============================================
-- MIGRATION 025 — NFS-e: configuração fiscal e notas
-- Execute no Supabase SQL Editor. Depende da 023.
-- =============================================
-- Estrutura da emissão de NFS-e pelo Sistema Nacional (Sefin). A EMISSÃO em si
-- nasce DESLIGADA, e é proposital: a empresa ainda não tem o certificado
-- e-CNPJ A1, sem o qual o Sefin não aceita nada.
--
-- Por que criar tudo agora, então: as telas de cadastro precisam saber quais
-- campos fiscais faltam em cada cliente, e isso é um trabalho longo, manual e
-- que não depende de certificado nenhum. Quanto antes começar, melhor.

-- ---------------------------------------------
-- 1) DADOS DO PRESTADOR
-- ---------------------------------------------
-- Uma linha por organização. Nada aqui é segredo — é o que sai impresso na
-- nota —, então usa RLS por perfil, não o deny-all das credenciais.
CREATE TABLE IF NOT EXISTS public.fiscal_settings (
  org_id                   UUID PRIMARY KEY DEFAULT public.current_org_id()
                             REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- ── Identificação ──
  cnpj                     TEXT,
  razao_social             TEXT,
  nome_fantasia            TEXT,
  inscricao_municipal      TEXT,
  cep                      TEXT,
  logradouro               TEXT,
  numero                   TEXT,
  complemento              TEXT,
  bairro                   TEXT,
  municipio                TEXT,
  uf                       TEXT,
  municipio_ibge           TEXT,

  -- ── Tributação ──
  regime_tributario        TEXT,
  opcao_simples            BOOLEAN NOT NULL DEFAULT true,
  regime_especial          TEXT,

  -- ── Serviço padrão ──
  codigo_servico           TEXT,      -- código de tributação nacional / LC 116
  cnae                     TEXT,
  aliquota_iss             NUMERIC(5,4),
  iss_retido_padrao        BOOLEAN NOT NULL DEFAULT false,
  descricao_servico_padrao TEXT,

  -- ── Numeração da DPS ──
  serie_dps                TEXT   NOT NULL DEFAULT '00001',
  -- NUNCA lido-e-gravado pelo front: duas emissões simultâneas pegariam o
  -- mesmo número. A alocação é atômica, pela RPC nfse_alocar_numero (026).
  proximo_numero_dps       BIGINT NOT NULL DEFAULT 1,

  ambiente                 TEXT NOT NULL DEFAULT 'restrita'
                             CHECK (ambiente IN ('restrita','producao')),

  -- ── As duas travas ──
  -- O município precisa ser conveniado ao Emissor Nacional. Se não for, a
  -- emissão acontece no portal da prefeitura e o ERP só registra a nota
  -- (status 'emitida_externamente').
  municipio_conveniado     BOOLEAN NOT NULL DEFAULT false,
  emissao_habilitada       BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueio          TEXT NOT NULL DEFAULT 'certificado_ausente',

  -- Quando emitir. NÃO é decisão técnica: para mensalidade de agência o fato
  -- gerador do ISS costuma ser a COMPETÊNCIA (serviço prestado), não o
  -- recebimento. Fica 'manual' até o contador responder.
  gatilho_emissao          TEXT NOT NULL DEFAULT 'manual'
                             CHECK (gatilho_emissao IN ('manual','pagamento','competencia')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS fiscal_settings_updated_at ON public.fiscal_settings;
CREATE TRIGGER fiscal_settings_updated_at
  BEFORE UPDATE ON public.fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.fiscal_settings (org_id)
  VALUES (public.current_org_id())
  ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_settings_select" ON public.fiscal_settings;
CREATE POLICY "fiscal_settings_select" ON public.fiscal_settings
  FOR SELECT USING (get_my_role() IN ('admin','gestor','financeiro'));

-- Escrita só de admin: emissao_habilitada e municipio_conveniado são as travas
-- que impedem emissão indevida, e alíquota errada é problema fiscal, não bug.
DROP POLICY IF EXISTS "fiscal_settings_modify" ON public.fiscal_settings;
CREATE POLICY "fiscal_settings_modify" ON public.fiscal_settings
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- ---------------------------------------------
-- 2) NOTAS FISCAIS
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_invoices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL DEFAULT public.current_org_id()
                      REFERENCES public.organizations(id),
  receivable_id     UUID REFERENCES public.financial_receivables(id) ON DELETE SET NULL,
  charge_id         UUID REFERENCES public.payment_charges(id)       ON DELETE SET NULL,
  client_id         UUID REFERENCES public.clients(id)               ON DELETE SET NULL,

  status            TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
                      'rascunho','bloqueada','pendente_emissao','emitindo','emitida',
                      'rejeitada','falha','cancelamento_pendente','cancelada',
                      'emitida_externamente')),
  motivo_bloqueio   TEXT,

  competencia       DATE NOT NULL,
  -- SEMPRE o valor do serviço, NUNCA o valor pago: multa e juros de atraso não
  -- são base de cálculo do ISS.
  valor_servico     NUMERIC(10,2) NOT NULL,
  aliquota_iss      NUMERIC(5,4),
  valor_iss         NUMERIC(10,2),
  descricao         TEXT NOT NULL,
  codigo_servico    TEXT,

  serie_dps         TEXT,
  numero_dps        BIGINT,
  id_dps            TEXT,
  chave_acesso      TEXT,          -- 50 caracteres, devolvida pelo Sefin
  numero_nfse       TEXT,
  emitida_em        TIMESTAMPTZ,

  -- Congela o tomador no ato da emissão: a nota vale pelo que foi declarado,
  -- não pelo cadastro de hoje.
  tomador_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  dps_xml           TEXT,          -- o XML assinado que enviamos
  retorno_xml       TEXT,
  danfse_url        TEXT,

  erro_codigo       TEXT,
  erro_mensagem     TEXT,
  tentativas        INT NOT NULL DEFAULT 0,

  cancelada_em      TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  evento_xml        TEXT,

  criado_por        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS service_invoices_updated_at ON public.service_invoices;
CREATE TRIGGER service_invoices_updated_at
  BEFORE UPDATE ON public.service_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nfse_chave
  ON public.service_invoices(chave_acesso) WHERE chave_acesso IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nfse_numero
  ON public.service_invoices(org_id, serie_dps, numero_dps) WHERE numero_dps IS NOT NULL;

-- Uma nota viva por recebível — o equivalente fiscal da trava de cobrança
-- duplicada. Emitir duas notas do mesmo serviço é problema com a prefeitura.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nfse_viva_por_recebivel
  ON public.service_invoices(receivable_id)
  WHERE receivable_id IS NOT NULL
    AND status NOT IN ('cancelada','falha','rejeitada');

-- Este índice É a fila. Não existe tabela de job neste projeto; existe este
-- WHERE, drenado pela ação `processar_pendentes` da função nfse.
CREATE INDEX IF NOT EXISTS idx_nfse_fila
  ON public.service_invoices(created_at) WHERE status = 'pendente_emissao';

CREATE INDEX IF NOT EXISTS idx_nfse_receivable
  ON public.service_invoices(receivable_id);

ALTER TABLE public.service_invoices ENABLE ROW LEVEL SECURITY;

-- Sem escape para o perfil `cliente`: tomador_snapshot guarda documento e
-- endereço. Se a Área do Cliente precisar da nota, a saída é uma ação na Edge
-- Function devolvendo só {numero, chave, danfse_url}.
DROP POLICY IF EXISTS "service_invoices_select" ON public.service_invoices;
CREATE POLICY "service_invoices_select" ON public.service_invoices
  FOR SELECT USING (get_my_role() IN ('admin','gestor','financeiro'));

-- Nenhuma policy de escrita: emitir e cancelar nota passam por Edge Function.

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- A configuração deve nascer bloqueada:
-- SELECT emissao_habilitada, motivo_bloqueio, municipio_conveniado,
--        gatilho_emissao, ambiente, serie_dps, proximo_numero_dps
--   FROM public.fiscal_settings;
-- Esperado: false | certificado_ausente | false | manual | restrita | 00001 | 1
--
-- RLS: as duas com policies de SELECT, e service_invoices sem policy de escrita.
-- SELECT c.relname, c.relrowsecurity,
--        (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname='public' AND c.relname IN ('fiscal_settings','service_invoices');
