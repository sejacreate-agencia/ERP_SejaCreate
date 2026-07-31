-- Migration 005: ERP Financeiro — campos avançados
-- Execute no Supabase SQL Editor

ALTER TABLE public.financial_receivables
  ADD COLUMN IF NOT EXISTS paid_date      DATE,
  ADD COLUMN IF NOT EXISTS valor_pago     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS multa          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto       NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conta_bancaria TEXT,
  ADD COLUMN IF NOT EXISTS categoria      TEXT,
  ADD COLUMN IF NOT EXISTS centro_custo   TEXT,
  ADD COLUMN IF NOT EXISTS conta_id       INTEGER;

ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS paid_date      DATE,
  ADD COLUMN IF NOT EXISTS valor_pago     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS multa          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros          NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto       NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conta_bancaria TEXT,
  ADD COLUMN IF NOT EXISTS categoria      TEXT,
  ADD COLUMN IF NOT EXISTS centro_custo   TEXT,
  ADD COLUMN IF NOT EXISTS conta_id       INTEGER;

-- Sincronizar paid_date a partir de paid_at existente
UPDATE public.financial_receivables SET paid_date = paid_at::DATE WHERE paid_at IS NOT NULL AND paid_date IS NULL;
UPDATE public.financial_payables    SET paid_date = paid_at::DATE WHERE paid_at IS NOT NULL AND paid_date IS NULL;

-- Valor pago padrão = valor original para itens já pagos
UPDATE public.financial_receivables SET valor_pago = value WHERE status = 'pago' AND valor_pago IS NULL;
UPDATE public.financial_payables    SET valor_pago = value WHERE status = 'pago' AND valor_pago IS NULL;
