-- Migration 004: Adiciona coluna proposal_url na tabela leads
-- Executar no Supabase SQL Editor

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS proposal_url TEXT;

COMMENT ON COLUMN public.leads.proposal_url IS 'URL do design Canva da proposta comercial gerada para o lead';
