-- =============================================================================
-- Migration: 20260725230000_altiora_r3_data.sql
-- Dados de resultado da Reunião 3 e decisão final (ALTIORA-18 UC27)
--
-- Relação 1:1 com leads (lead_id PK).
-- Campos: estrutura confirmada, valor estimado, resultado, decisão do cliente
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.altiora_r3_data (
  lead_id               uuid PRIMARY KEY
                        REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Resultado da R3 em JSONB (compatível com hook useAltioraR2Data — useSaveR3Data)
  -- Campos: estrutura_confirmada, valor_estimado, compareceu, resultado_geral, decisao_cliente
  resultado             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Decisão final do cliente (espelhada do JSONB para query direta)
  decisao_cliente       text CHECK (decisao_cliente IS NULL OR decisao_cliente IN (
                          'avancar', 'nao_avancar', 'continuar_negociacao'
                        )),

  -- Auditoria
  updated_by            uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER altiora_r3_data_updated_at
  BEFORE UPDATE ON public.altiora_r3_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_r3_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_r3_data_authenticated
  ON public.altiora_r3_data
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_r3_data IS
  'Dados da Reunião 3 (R3) — estrutura, resultado, decisão final do cliente (ALTIORA-18 UC27).';

COMMENT ON COLUMN public.altiora_r3_data.decisao_cliente IS
  'Decisão: avancar → Em contratação | nao_avancar → Perdido | continuar_negociacao → manter etapa.';

COMMIT;
