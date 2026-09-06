-- =============================================
-- MIGRATION 027 — Configurações de cobrança
-- Execute no Supabase SQL Editor. Depende da 024 e da 026.
-- =============================================
-- Os padrões que a tela de Integrações → Cora edita: multa, juros, desconto e
-- os automatismos. Nada aqui é segredo — é parâmetro de negócio —, então usa
-- RLS por perfil, e não o deny-all de integration_connections.

CREATE TABLE IF NOT EXISTS public.charge_settings (
  org_id                 UUID PRIMARY KEY DEFAULT public.current_org_id()
                           REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- ── Formas de pagamento ──
  gerar_boleto           BOOLEAN NOT NULL DEFAULT true,
  gerar_pix              BOOLEAN NOT NULL DEFAULT true,
  -- O "copia e cola" é o mesmo EMV do QR Code; o que muda é só exibi-lo como
  -- texto copiável na tela da cobrança.
  incluir_pix_copia_cola BOOLEAN NOT NULL DEFAULT true,

  -- ── Encargos ──
  -- ATENÇÃO à unidade: aqui a multa é PERCENTUAL, porque é assim que se
  -- configura. A API da Cora quer payment_terms.fine.amount em CENTAVOS, então
  -- a conversão (valor * percentual / 100) acontece na Edge Function.
  -- Já os juros a Cora quer em percentual ao mês, e vão direto.
  aplicar_multa          BOOLEAN NOT NULL DEFAULT false,
  multa_percentual       NUMERIC(5,2) NOT NULL DEFAULT 2.00,
  aplicar_juros          BOOLEAN NOT NULL DEFAULT false,
  juros_percentual_mes   NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  aplicar_desconto       BOOLEAN NOT NULL DEFAULT false,
  desconto_percentual    NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  desconto_dias          INT     NOT NULL DEFAULT 0,

  -- ── Automatismos ──
  enviar_apos_geracao    BOOLEAN NOT NULL DEFAULT false,
  -- Quando false, o webhook marca a COBRANÇA como paga mas NÃO dá baixa no
  -- recebível — fica para conferência manual. É fluxo legítimo de quem quer
  -- conciliar antes de fechar o mês.
  baixar_automatico      BOOLEAN NOT NULL DEFAULT true,
  dias_cancelamento      INT     NOT NULL DEFAULT 0,   -- 0 = nunca cancelar

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT charge_settings_percentuais CHECK (
    multa_percentual BETWEEN 0 AND 100 AND
    juros_percentual_mes BETWEEN 0 AND 100 AND
    desconto_percentual BETWEEN 0 AND 100 AND
    desconto_dias >= 0 AND dias_cancelamento >= 0
  ),
  -- Cobrança sem forma de pagamento nenhuma não existe.
  CONSTRAINT charge_settings_alguma_forma CHECK (gerar_boleto OR gerar_pix)
);

DROP TRIGGER IF EXISTS charge_settings_updated_at ON public.charge_settings;
CREATE TRIGGER charge_settings_updated_at
  BEFORE UPDATE ON public.charge_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.charge_settings (org_id)
  VALUES (public.current_org_id())
  ON CONFLICT (org_id) DO NOTHING;

ALTER TABLE public.charge_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_settings_select" ON public.charge_settings;
CREATE POLICY "charge_settings_select" ON public.charge_settings
  FOR SELECT USING (get_my_role() IN ('admin','gestor','financeiro'));

DROP POLICY IF EXISTS "charge_settings_modify" ON public.charge_settings;
CREATE POLICY "charge_settings_modify" ON public.charge_settings
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- ---------------------------------------------
-- A RPC passa a respeitar `baixar_automatico`
-- ---------------------------------------------
-- Único ponto alterado em relação à 026: quando o automatismo está desligado, a
-- cobrança vira 'paga' mas o recebível NÃO é tocado, e nenhuma nota é
-- enfileirada. O log registra o motivo, para não parecer que o webhook falhou.
CREATE OR REPLACE FUNCTION public.cora_liquidar_cobranca(
  p_provider_charge_id TEXT,
  p_provider_status    TEXT,
  p_total_paid_cents   BIGINT,
  p_occurrence_date    TIMESTAMPTZ,
  p_forma_pagamento    TEXT,
  p_payload            JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge      public.payment_charges%ROWTYPE;
  v_rec         public.financial_receivables%ROWTYPE;
  v_novo_status TEXT;
  v_pago_reais  NUMERIC(10,2);
  v_rec_status  TEXT;
  v_fiscal      public.fiscal_settings%ROWTYPE;
  v_auto        BOOLEAN := true;
  v_nota_id     UUID := NULL;
  v_nota_status TEXT := NULL;
BEGIN
  SELECT * INTO v_charge FROM public.payment_charges
   WHERE provider_charge_id = p_provider_charge_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'cobranca_desconhecida');
  END IF;

  v_novo_status := CASE upper(coalesce(p_provider_status,''))
    WHEN 'PAID'             THEN 'paga'
    WHEN 'CANCELLED'        THEN 'cancelada'
    WHEN 'CANCELED'         THEN 'cancelada'
    WHEN 'LATE'             THEN 'vencida'
    WHEN 'IN_PAYMENT'       THEN 'em_pagamento'
    WHEN 'OPEN'             THEN 'aberta'
    WHEN 'INITIATED'        THEN 'aberta'
    WHEN 'DRAFT'            THEN 'rascunho'
    WHEN 'RECURRENCE_DRAFT' THEN 'rascunho'
    ELSE 'aberta'
  END;

  IF v_charge.status = v_novo_status
     AND v_charge.valor_pago_centavos = coalesce(p_total_paid_cents, 0) THEN
    RETURN jsonb_build_object('ok', true, 'ja_processada', true,
                              'status', v_charge.status);
  END IF;

  UPDATE public.payment_charges SET
    status              = v_novo_status,
    provider_status     = p_provider_status,
    valor_pago_centavos = coalesce(p_total_paid_cents, valor_pago_centavos),
    ocorrencia_em       = coalesce(p_occurrence_date, ocorrencia_em),
    provider_payload    = coalesce(p_payload, provider_payload),
    ultimo_erro         = NULL
  WHERE id = v_charge.id;

  IF v_novo_status <> 'paga' THEN
    RETURN jsonb_build_object('ok', true, 'cobranca_status', v_novo_status,
                              'recebivel_atualizado', false);
  END IF;

  SELECT baixar_automatico INTO v_auto FROM public.charge_settings
   WHERE org_id = v_charge.org_id;
  v_auto := coalesce(v_auto, true);

  IF NOT v_auto THEN
    INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
    VALUES (NULL, 'cobranca.paga_sem_baixa', 'payment_charge', v_charge.id::text,
            jsonb_build_object('provider_charge_id', p_provider_charge_id,
                               'motivo', 'baixa_automatica_desligada'));
    RETURN jsonb_build_object('ok', true, 'cobranca_status', v_novo_status,
                              'recebivel_atualizado', false,
                              'motivo', 'baixa_automatica_desligada');
  END IF;

  SELECT * INTO v_rec FROM public.financial_receivables
   WHERE id = v_charge.receivable_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'recebivel_sumiu',
                              'cobranca_status', v_novo_status);
  END IF;

  v_pago_reais := round(coalesce(p_total_paid_cents, 0)::numeric / 100, 2);
  v_rec_status := CASE
    WHEN v_pago_reais >= v_rec.value THEN 'pago'
    ELSE 'parcialmente_pago'
  END;

  UPDATE public.financial_receivables SET
    status          = v_rec_status,
    valor_pago      = v_pago_reais,
    paid_at         = coalesce(p_occurrence_date, NOW()),
    paid_date       = coalesce(p_occurrence_date, NOW())::date,
    forma_pagamento = coalesce(p_forma_pagamento, forma_pagamento)
  WHERE id = v_rec.id;

  SELECT * INTO v_fiscal FROM public.fiscal_settings
   WHERE org_id = v_charge.org_id;

  IF FOUND AND v_fiscal.gatilho_emissao = 'pagamento' THEN
    v_nota_status := CASE
      WHEN v_fiscal.emissao_habilitada AND v_fiscal.municipio_conveniado
        THEN 'pendente_emissao'
      ELSE 'bloqueada'
    END;

    INSERT INTO public.service_invoices (
      org_id, receivable_id, charge_id, client_id, status, motivo_bloqueio,
      competencia, valor_servico, aliquota_iss, descricao, codigo_servico,
      tomador_snapshot
    )
    SELECT
      v_charge.org_id, v_rec.id, v_charge.id, v_rec.client_id, v_nota_status,
      CASE WHEN v_nota_status = 'bloqueada'
           THEN v_fiscal.motivo_bloqueio ELSE NULL END,
      date_trunc('month', coalesce(v_rec.due_date, CURRENT_DATE))::date,
      v_rec.value,
      v_fiscal.aliquota_iss,
      coalesce(nullif(v_rec.description,''),
               v_fiscal.descricao_servico_padrao, 'Serviço prestado'),
      v_fiscal.codigo_servico,
      coalesce(to_jsonb(c) - 'notes' - 'briefing', '{}'::jsonb)
    FROM public.clients c WHERE c.id = v_rec.client_id
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_nota_id;

    IF v_nota_id IS NULL AND v_rec.client_id IS NULL THEN
      v_nota_status := NULL;
    END IF;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    NULL, 'cobranca.liquidada', 'payment_charge', v_charge.id::text,
    jsonb_build_object(
      'provider_charge_id', p_provider_charge_id,
      'provider_status',    p_provider_status,
      'valor_pago',         v_pago_reais,
      'receivable_id',      v_rec.id,
      'receivable_status',  v_rec_status,
      'nfse_status',        v_nota_status
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cobranca_status',      v_novo_status,
    'recebivel_atualizado', true,
    'recebivel_status',     v_rec_status,
    'valor_pago',           v_pago_reais,
    'nfse_status',          v_nota_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cora_liquidar_cobranca(TEXT,TEXT,BIGINT,TIMESTAMPTZ,TEXT,JSONB)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- SELECT * FROM public.charge_settings;
--
-- Teste do automatismo desligado (copie, descomente, rode inteiro):
-- BEGIN;
--   UPDATE public.charge_settings SET baixar_automatico = false
--    WHERE org_id = public.current_org_id();
--   INSERT INTO public.financial_receivables (description, value, due_date, status)
--     VALUES ('ZZ sem baixa', 50, CURRENT_DATE, 'pendente');
--   INSERT INTO public.payment_charges (receivable_id, ambiente, provider_charge_id,
--                                       valor_centavos, vencimento, status)
--     SELECT id,'stage','inv_ZZ_sembaixa',5000,CURRENT_DATE,'aberta'
--       FROM public.financial_receivables WHERE description='ZZ sem baixa';
--   SELECT public.cora_liquidar_cobranca('inv_ZZ_sembaixa','PAID',5000,NOW(),'PIX','{}'::jsonb);
--   -- espera motivo=baixa_automatica_desligada e o recebivel AINDA pendente:
--   SELECT status FROM public.financial_receivables WHERE description='ZZ sem baixa';
-- ROLLBACK;
