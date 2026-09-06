-- =============================================
-- MIGRATION 026 — RPCs transacionais
-- Execute no Supabase SQL Editor. Depende da 024 e da 025.
-- =============================================
-- A peça que faz a baixa automática ser confiável.
--
-- O caminho ingênuo seria o webhook fazer três chamadas PostgREST seguidas:
-- atualiza a cobrança, atualiza o recebível, insere a nota. Uma falha de rede
-- no meio deixaria o dinheiro registrado como recebido sem nota enfileirada —
-- ou pior, a cobrança paga e o recebível ainda pendente — e nada perceberia.
--
-- Aqui os três acontecem num único BEGIN/COMMIT. A chamada externa ao Sefin
-- fica FORA da transação: o que a RPC insere em service_invoices é apenas uma
-- linha de fila, e por isso é retentável.

-- ---------------------------------------------
-- 1) LIQUIDAR COBRANÇA
-- ---------------------------------------------
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
  v_nota_id     UUID := NULL;
  v_nota_status TEXT := NULL;
BEGIN
  -- FOR UPDATE é o que torna o replay seguro: duas entregas simultâneas do
  -- mesmo webhook serializam aqui, e a segunda encontra o estado já final.
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

  -- Idempotência de verdade: mesmo estado e mesmo valor = nada a fazer.
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

  -- Só o pagamento mexe no financeiro. Uma cobrança que virou 'vencida' não
  -- muda o recebível: `atrasado` já é derivado em tempo de execução pelo front.
  IF v_novo_status <> 'paga' THEN
    RETURN jsonb_build_object('ok', true, 'cobranca_status', v_novo_status,
                              'recebivel_atualizado', false);
  END IF;

  SELECT * INTO v_rec FROM public.financial_receivables
   WHERE id = v_charge.receivable_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'recebivel_sumiu',
                              'cobranca_status', v_novo_status);
  END IF;

  v_pago_reais := round(coalesce(p_total_paid_cents, 0)::numeric / 100, 2);

  -- Pagamento a menor vira baixa parcial, não baixa cheia. O CHECK que aceita
  -- 'parcialmente_pago' veio na migration 022.
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

  -- ── Gancho fiscal ──
  SELECT * INTO v_fiscal FROM public.fiscal_settings
   WHERE org_id = v_charge.org_id;

  IF FOUND AND v_fiscal.gatilho_emissao = 'pagamento' THEN
    -- Nasce BLOQUEADA enquanto a emissão não estiver habilitada. Se nascesse
    -- 'pendente_emissao', no dia em que o certificado chegasse o processador
    -- tentaria emitir meses de backlog de uma vez, com competências
    -- retroativas. Desbloquear é ato explícito (ação `liberar_backlog`).
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
      -- valor do SERVIÇO, não o valor pago: multa e juros não são base de ISS.
      v_rec.value,
      v_fiscal.aliquota_iss,
      coalesce(nullif(v_rec.description,''),
               v_fiscal.descricao_servico_padrao, 'Serviço prestado'),
      v_fiscal.codigo_servico,
      coalesce(to_jsonb(c) - 'notes' - 'briefing', '{}'::jsonb)
    FROM public.clients c WHERE c.id = v_rec.client_id
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_nota_id;

    -- Recebível sem cliente vinculado: o SELECT acima não devolve linha.
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

-- Só o service_role das Edge Functions chama. Se ficasse acessível ao papel
-- `authenticated`, QUALQUER usuário logado — inclusive o perfil 'cliente' —
-- marcaria recebíveis como pagos via PostgREST.
REVOKE ALL ON FUNCTION public.cora_liquidar_cobranca(TEXT,TEXT,BIGINT,TIMESTAMPTZ,TEXT,JSONB)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------
-- 2) ALOCAR NÚMERO DE DPS
-- ---------------------------------------------
-- Numeração de documento fiscal não pode ter buraco nem repetição. Ler o
-- próximo número no front e gravar depois abriria uma corrida entre duas
-- emissões simultâneas; aqui o UPDATE ... RETURNING resolve num passo.
CREATE OR REPLACE FUNCTION public.nfse_alocar_numero(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org    UUID;
  v_serie  TEXT;
  v_numero BIGINT;
BEGIN
  SELECT org_id INTO v_org FROM public.service_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'nota_desconhecida');
  END IF;

  UPDATE public.fiscal_settings
     SET proximo_numero_dps = proximo_numero_dps + 1
   WHERE org_id = v_org
   RETURNING serie_dps, proximo_numero_dps - 1 INTO v_serie, v_numero;

  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_configuracao_fiscal');
  END IF;

  UPDATE public.service_invoices
     SET serie_dps = v_serie, numero_dps = v_numero, status = 'emitindo'
   WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true, 'serie', v_serie, 'numero', v_numero);
END;
$$;

REVOKE ALL ON FUNCTION public.nfse_alocar_numero(UUID)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- Nenhuma das duas pode estar acessível a `authenticated`:
-- SELECT p.proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_executa
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname='public'
--    AND p.proname IN ('cora_liquidar_cobranca','nfse_alocar_numero');
-- Esperado: false nas duas.
