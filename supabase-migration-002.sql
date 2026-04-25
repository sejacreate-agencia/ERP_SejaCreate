-- =============================================
-- SEJA CREATE — Migration 002
-- Campos novos: clientes, contas a receber e a pagar
-- Execute no Supabase SQL Editor
-- =============================================

-- Dia de vencimento da mensalidade
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS dia_vencimento INT CHECK (dia_vencimento BETWEEN 1 AND 31);

-- Melhorias em contas a receber
ALTER TABLE public.financial_receivables
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS parcela_numero  INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_total   INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT;

-- Observações em contas a pagar
ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Índice para busca de parcelas de um grupo
CREATE INDEX IF NOT EXISTS idx_receivables_client_status
  ON public.financial_receivables(client_id, status);
