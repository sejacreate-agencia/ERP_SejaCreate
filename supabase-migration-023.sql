-- =============================================
-- MIGRATION 023 — Organização + dados fiscais do cliente
-- Execute no Supabase SQL Editor.
-- =============================================
-- Base das integrações Cora e NFS-e. Duas coisas independentes:
--   1) uma noção de "empresa dona do dado", para as tabelas novas;
--   2) os campos de tomador que boleto registrado e nota fiscal exigem e que
--      a tabela `clients` nunca teve.
--
-- Nada aqui altera comportamento existente: a organização é uma linha só, e
-- todas as colunas novas de `clients` nascem NULL.

-- ---------------------------------------------
-- 1) ORGANIZAÇÃO
-- ---------------------------------------------
-- Este banco é single-tenant: nenhuma das 32 tabelas atuais tem coluna de
-- empresa, e todo usuário interno enxerga tudo. Isto NÃO muda isso.
--
-- O que esta tabela compra é uma coisa só, e vale ser honesto sobre o tamanho
-- dela: as tabelas novas (credenciais, cobranças, notas fiscais) já nascem com
-- `org_id`, então o dia em que o ERP virar multiempresa de verdade não vai
-- precisar de backfill nem de migração de dados fiscais. A parte difícil —
-- as 32 tabelas existentes e suas policies — continua inteira pela frente.
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exatamente uma organização padrão. Sem esta trava, current_org_id() vira
-- loteria no dia em que alguém inserir a segunda linha.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_uma_default
  ON public.organizations (is_default) WHERE is_default;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.organizations (nome, slug, is_default)
  VALUES ('Seja Create', 'seja-create', true)
  ON CONFLICT (slug) DO NOTHING;

-- Mesmo molde do get_my_role() (supabase-schema.sql:309): SECURITY DEFINER
-- STABLE, para poder ser usada como DEFAULT de coluna e dentro de policy.
--
-- PONTO DE VIRADA FUTURO — é aqui que alguém vai procurar:
-- para multiempresa de verdade, esta função passa a ser
--   SELECT org_id FROM public.profiles WHERE id = auth.uid()
-- e cada policy das tabelas novas ganha `AND org_id = public.current_org_id()`.
-- Enquanto houver uma organização só, as policies NÃO filtram por org —
-- filtrar hoje seria teatro, porque a função devolveria sempre o mesmo valor.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID AS $$
  SELECT id FROM public.organizations WHERE is_default LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Leitura liberada para quem está logado: o nome da organização aparece na
-- tela de configurações. Escrita, só admin.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "organizations_modify" ON public.organizations;
CREATE POLICY "organizations_modify" ON public.organizations
  FOR ALL USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

-- ---------------------------------------------
-- 2) DADOS FISCAIS E ENDEREÇO DO CLIENTE
-- ---------------------------------------------
-- Hoje `clients` tem exatamente um documento (`cnpj TEXT`, sem validação) e
-- NENHUM campo de endereço. O boleto registrado da Cora pede
-- customer.address{street,number,district,city,state,zip_code}; a NFS-e pede
-- o código IBGE do município do tomador. Sem isto, nem uma coisa nem outra.
--
-- Todas as colunas nascem NULL de propósito: nenhum cadastro existente quebra,
-- e a exigência aparece só na hora de emitir — a ação `validar` da função nfse
-- devolve a lista nominal do que falta, cliente a cliente.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tipo_pessoa         TEXT CHECK (tipo_pessoa IN ('PF','PJ')),
  ADD COLUMN IF NOT EXISTS cpf                 TEXT,
  ADD COLUMN IF NOT EXISTS razao_social        TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual  TEXT,
  ADD COLUMN IF NOT EXISTS cep                 TEXT,
  ADD COLUMN IF NOT EXISTS logradouro          TEXT,
  ADD COLUMN IF NOT EXISTS numero              TEXT,
  ADD COLUMN IF NOT EXISTS complemento         TEXT,
  ADD COLUMN IF NOT EXISTS bairro              TEXT,
  ADD COLUMN IF NOT EXISTS municipio           TEXT,
  ADD COLUMN IF NOT EXISTS uf                  TEXT,
  ADD COLUMN IF NOT EXISTS municipio_ibge      TEXT;

-- Os CHECK vão separados: ADD COLUMN IF NOT EXISTS não é reexecutável junto com
-- CHECK numa base onde a coluna já existe.
DO $$
BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_uf_check CHECK (uf IS NULL OR length(uf) = 2);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- cMun da NFS-e é o código IBGE de 7 dígitos, não o nome da cidade. O ViaCEP
  -- devolve exatamente isso no campo `ibge`, então o preenchimento vem junto
  -- com a busca de CEP no cadastro.
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_ibge_check
    CHECK (municipio_ibge IS NULL OR municipio_ibge ~ '^[0-9]{7}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Busca por documento, para a checagem de duplicidade no cadastro.
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_cpf  ON public.clients(cpf)  WHERE cpf  IS NOT NULL;

-- `clients` já tem policies (supabase-schema.sql:329-338) e elas valem para as
-- colunas novas — RLS no Postgres é por linha, não por coluna. Nada a fazer.

-- ---------------------------------------------
-- Conferência
-- ---------------------------------------------
-- Deve devolver uma linha, 'Seja Create':
-- SELECT id, nome, slug, is_default FROM public.organizations;
-- SELECT public.current_org_id();
--
-- Deve listar as 13 colunas novas:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'clients'
--    AND column_name IN ('tipo_pessoa','cpf','razao_social','inscricao_municipal',
--        'inscricao_estadual','cep','logradouro','numero','complemento','bairro',
--        'municipio','uf','municipio_ibge')
--  ORDER BY column_name;
--
-- Teste dos CHECK (copie, descomente e rode inteiro — o ROLLBACK desfaz):
-- BEGIN;
--   INSERT INTO public.clients (name, uf) VALUES ('ZZ teste', 'SP');            -- ok
--   INSERT INTO public.clients (name, municipio_ibge) VALUES ('ZZ ok', '3550308');   -- ok
--   -- as duas linhas abaixo DEVEM falhar:
--   -- INSERT INTO public.clients (name, uf) VALUES ('ZZ ruim', 'Sao Paulo');
--   -- INSERT INTO public.clients (name, municipio_ibge) VALUES ('ZZ ruim', '355');
-- ROLLBACK;
