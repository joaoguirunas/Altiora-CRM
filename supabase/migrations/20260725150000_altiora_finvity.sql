-- =============================================================================
-- Migration: 20260725150000_altiora_finvity.sql
-- Cria tabela altiora_finvity_analise para análise Finvity por referral
--
-- Estrutura:
--   - id UUID como PK (permite histórico futuro se necessário)
--   - UNIQUE(lead_id) → apenas uma análise ativa por referral
--   - Arrays de texto para dores, necessidades e produtos sugeridos
--   - Link e/ou arquivo do relatório Finvity
--
-- Caso de uso coberto:
--   UC25 — Registrar Análise do Finvity
--     - Link URL do relatório Finvity
--     - URL do arquivo anexado (Storage)
--     - Dores identificadas (text[])
--     - Necessidades identificadas (text[])
--     - Produtos sugeridos (text[])
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.altiora_finvity_analise (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referral associado (1 análise ativa por lead)
  lead_id             uuid NOT NULL
                      REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Relatório Finvity: link ou arquivo
  finvity_link        text,
  finvity_arquivo_url text,

  -- Diagnóstico em arrays de texto livre
  dores               text[] NOT NULL DEFAULT '{}',
  necessidades        text[] NOT NULL DEFAULT '{}',
  produtos_sugeridos  text[] NOT NULL DEFAULT '{}',

  -- Observações adicionais do Closer
  notas               text,

  -- Auditoria
  created_by          uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Restrição: apenas 1 análise ativa por referral
  CONSTRAINT altiora_finvity_lead_uq UNIQUE (lead_id)
);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER altiora_finvity_analise_updated_at
  BEFORE UPDATE ON public.altiora_finvity_analise
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_finvity_analise ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_finvity_analise_authenticated
  ON public.altiora_finvity_analise
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_finvity_analise IS
  'Análise Finvity por referral: link/arquivo do relatório, dores, necessidades e produtos sugeridos (UC25).';

COMMENT ON COLUMN public.altiora_finvity_analise.finvity_link IS
  'URL do relatório Finvity online (UC25).';

COMMENT ON COLUMN public.altiora_finvity_analise.finvity_arquivo_url IS
  'URL do arquivo PDF/relatório armazenado no Supabase Storage (UC25).';

COMMENT ON COLUMN public.altiora_finvity_analise.dores IS
  'Dores do cliente identificadas na análise Finvity (array de texto livre).';

COMMENT ON COLUMN public.altiora_finvity_analise.necessidades IS
  'Necessidades identificadas na análise Finvity.';

COMMENT ON COLUMN public.altiora_finvity_analise.produtos_sugeridos IS
  'Produtos de seguro/previdência sugeridos a partir da análise.';

COMMIT;
