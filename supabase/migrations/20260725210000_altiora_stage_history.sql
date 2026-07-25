-- =============================================================================
-- Migration: 20260725210000_altiora_stage_history.sql
-- Tabela de histórico de transições de etapa (ALTIORA-12 AC4)
--
-- Registra cada mudança de etapa com: lead, de/para, autor, timestamp,
-- flag de salto de etapa confirmado.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_stage_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage_id   uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  to_stage_id     uuid REFERENCES public.leads_stages(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  skip_confirmed  boolean NOT NULL DEFAULT false,
  notes           text
);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead_id
  ON public.lead_stage_history(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_changed_at
  ON public.lead_stage_history(changed_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_stage_history_authenticated
  ON public.lead_stage_history
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Comentários ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.lead_stage_history IS
  'Histórico auditável de transições de etapa por lead (ALTIORA-12 AC4).';

COMMENT ON COLUMN public.lead_stage_history.skip_confirmed IS
  'true = usuário confirmou explicitamente o salto de etapas (AC3).';

COMMIT;
