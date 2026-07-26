-- =============================================================================
-- Migration: 20260725220000_altiora_r2_data.sql
-- Dados de resultado da Reunião 2 (ALTIORA-17 UC26)
--
-- Relação 1:1 com leads (lead_id PK).
-- `resultado` JSONB: produto_apresentado, objecoes, nivel_interesse, resultado_geral
-- `data_r3_prevista`: refletida em leads.next_action_due_at
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.altiora_r2_data (
  lead_id               uuid PRIMARY KEY
                        REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Resultado da R2 em JSONB (estrutura flexível — compatível com hook useAltioraR2Data)
  -- Campos sugeridos: produto_apresentado, objecoes, nivel_interesse, resultado_geral
  resultado             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Data prevista para R3 (salva também em leads.next_action_due_at)
  data_r3_prevista      date,

  -- Auditoria
  updated_by            uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER altiora_r2_data_updated_at
  BEFORE UPDATE ON public.altiora_r2_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.altiora_r2_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_r2_data_authenticated
  ON public.altiora_r2_data
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_r2_data IS
  'Dados da Reunião 2 (R2) — produto, objeções, interesse, resultado (ALTIORA-17 UC26).';

COMMIT;
