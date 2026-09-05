-- =============================================
-- MIGRATION 022 — Baixa parcial de recebíveis
-- Execute no Supabase SQL Editor.
-- =============================================
-- O front grava 'parcialmente_pago' desde a migration 005 (saveMarkPaid, em
-- js/financeiro/lancamentos.js:156 decide o status pelo valor líquido), mas o
-- CHECK original de financial_receivables só aceita quatro valores. Resultado:
-- toda baixa parcial de recebível falha, e o fallback da própria função reenvia
-- o mesmo status inválido — falha duas vezes e cai no toast de erro.
--
-- A migration 001 já fez exatamente esta correção do lado de financial_payables
-- (acrescentou 'provisionado'). Aqui é o espelho, para recebíveis.
--
-- ⚠️ NÃO APLIQUE ESTA MIGRATION SOZINHA.
-- Enquanto o CHECK rejeitava, 'parcialmente_pago' NUNCA existiu no banco — e
-- três consumidores tratam esse valor errado justamente porque nunca o viram:
--   js/financeiro/index.js  — o card "A Receber" some com o saldo restante
--   js/dashboard.js         — o KPI conta o valor CHEIO como pendente
--   js/avisos.js            — uma parcial vencida não gera aviso nenhum
-- Liberar o valor sem corrigir os três troca um erro visível (falha ao salvar)
-- por três erros invisíveis. Os consertos vão no mesmo commit desta migration.
--
-- Sobre 'previsto': está no <select> de status (lancamentos.js:33) e no mapa de
-- cores (index.js:239), mas nenhum agregador do sistema o conhece — um recebível
-- "previsto" é indistinguível de um pendente futuro. Em vez de acrescentá-lo ao
-- CHECK, ele sai do <select>. Menor raio de explosão.

ALTER TABLE public.financial_receivables
  DROP CONSTRAINT IF EXISTS financial_receivables_status_check;

ALTER TABLE public.financial_receivables
  ADD CONSTRAINT financial_receivables_status_check
  CHECK (status IN ('pendente','pago','atrasado','cancelado','parcialmente_pago'));

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- Deve devolver a constraint com os cinco valores:
-- SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.financial_receivables'::regclass
--    AND conname  = 'financial_receivables_status_check';
--
-- Teste transacional (copie, descomente e rode inteiro — o ROLLBACK desfaz):
-- BEGIN;
--   INSERT INTO public.financial_receivables (description, value, due_date, status)
--     VALUES ('ZZ teste parcial', 100, CURRENT_DATE, 'pendente');
--   UPDATE public.financial_receivables
--      SET status = 'parcialmente_pago', valor_pago = 40
--    WHERE description = 'ZZ teste parcial';        -- antes da 022 isto falhava
--   SELECT status, value, valor_pago, value - valor_pago AS saldo_aberto
--     FROM public.financial_receivables WHERE description = 'ZZ teste parcial';
-- ROLLBACK;
