-- =============================================
-- MIGRAÇÃO 001 — Adicionar campos de provisão
-- Execute no Supabase SQL Editor se já rodou
-- o supabase-schema.sql anteriormente.
-- =============================================

-- Adicionar status 'provisionado' em financial_payables
ALTER TABLE public.financial_payables
  DROP CONSTRAINT IF EXISTS financial_payables_status_check;

ALTER TABLE public.financial_payables
  ADD CONSTRAINT financial_payables_status_check
  CHECK (status IN ('pendente','pago','atrasado','cancelado','provisionado'));

-- Adicionar colunas de provisão
ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS provisao_grupo  TEXT,
  ADD COLUMN IF NOT EXISTS provisao_mes    INTEGER,
  ADD COLUMN IF NOT EXISTS provisao_total  INTEGER;
