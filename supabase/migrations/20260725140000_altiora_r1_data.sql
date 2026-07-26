-- =============================================================================
-- Migration: 20260725140000_altiora_r1_data.sql
-- Cria tabela altiora_r1_data para dados de diagnóstico da Reunião 1 (R1)
--
-- Relação 1:1 com leads (lead_id como PK) — garante exatamente um registro
-- de diagnóstico por referral, sem ambiguidade.
--
-- Caso de uso coberto:
--   UC24 — Registrar Informações da R1
--     - Diagnóstico do playbook (campos semi-estruturados em JSONB)
--     - Scorecard Elephan importado (JSONB)
--     - Flags de importação/conflito Elephan
--     - Data prevista para R2
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.altiora_r1_data (
  -- PK = lead_id → 1 registro por referral
  lead_id               uuid PRIMARY KEY
                        REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Scorecard importado da Elephan (estrutura varia conforme API)
  scorecard             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Diagnóstico do playbook preenchido pelo Closer
  -- Estrutura sugerida: {campo: {valor, origem, conflito}}
  diagnostico           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Flags de integração Elephan
  elephan_importado     boolean NOT NULL DEFAULT false,
  elephan_conflito      boolean NOT NULL DEFAULT false,

  -- Data prevista para realização da R2 (definida ao fechar R1)
  data_r2_prevista      date,

  -- Auditoria
  created_by            uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  updated_by            uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger updated_at ───────────────────────────────────────────────────────

CREATE TRIGGER altiora_r1_data_updated_at
  BEFORE UPDATE ON public.altiora_r1_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Padrão do projeto: RLS ativo, policy permissiva (autenticado),
-- controle de acesso por perfil feito na camada de aplicação.

ALTER TABLE public.altiora_r1_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY altiora_r1_data_authenticated
  ON public.altiora_r1_data
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.altiora_r1_data IS
  'Dados de diagnóstico da Reunião 1 (R1) — 1:1 com leads. Contém scorecard Elephan e campos do playbook (UC24).';

COMMENT ON COLUMN public.altiora_r1_data.scorecard IS
  'Dados importados da Elephan: scorecard financeiro e patrimonial do cliente.';

COMMENT ON COLUMN public.altiora_r1_data.diagnostico IS
  'Campos do playbook de diagnóstico preenchidos pelo Closer. Estrutura: {campo: {valor, origem: "manual"|"elephan", conflito: bool}}.';

COMMENT ON COLUMN public.altiora_r1_data.elephan_importado IS
  'true = dados Elephan foram importados automaticamente (UC24-FA01).';

COMMENT ON COLUMN public.altiora_r1_data.elephan_conflito IS
  'true = dados Elephan conflitam com preenchimento manual — exige revisão antes de consolidar (UC24-FE01).';

COMMENT ON COLUMN public.altiora_r1_data.data_r2_prevista IS
  'Data prevista para a R2, definida pelo Closer ao fechar a R1 (UC24).';

COMMIT;
