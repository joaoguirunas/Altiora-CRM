-- =============================================================================
-- Migration: 20260725210000_altiora_r2_r3_data.sql
-- Tabelas de dados pós-R2 e pós-R3 para o pipeline Altiora
--
-- Padrão idêntico ao altiora_r1_data (20260725140000):
-- - PK = lead_id → 1 registro por referral
-- - Dados do playbook em JSONB (resultado_*)
-- - Data prevista do próximo passo
-- =============================================================================

BEGIN;

-- ── altiora_r2_data ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.altiora_r2_data (
  lead_id                uuid PRIMARY KEY
                         REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Campos do resultado da R2 (JSON semi-estruturado)
  resultado              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Data prevista para a R3
  data_r3_prevista       date,

  created_by             uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  updated_by             uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER altiora_r2_data_updated_at
  BEFORE UPDATE ON public.altiora_r2_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.altiora_r2_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_r2_data_authenticated
  ON public.altiora_r2_data FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.altiora_r2_data IS
  'Dados do resultado da Reunião 2 (R2) — 1:1 com leads (UC26 — ALTIORA-17).';

-- ── altiora_r3_data ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.altiora_r3_data (
  lead_id                uuid PRIMARY KEY
                         REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Campos do resultado da R3 (JSON semi-estruturado)
  resultado              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Decisão do cliente: 'avançar' | 'nao_avançar' | 'continuar'
  decisao_cliente        text,

  created_by             uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  updated_by             uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER altiora_r3_data_updated_at
  BEFORE UPDATE ON public.altiora_r3_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.altiora_r3_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_r3_data_authenticated
  ON public.altiora_r3_data FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.altiora_r3_data IS
  'Dados do resultado da Reunião 3 (R3) — 1:1 com leads (UC27 — ALTIORA-18).';

COMMIT;
