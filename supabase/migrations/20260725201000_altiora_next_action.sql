-- =============================================================================
-- Migration: 20260725201000_altiora_next_action.sql
-- Adiciona campos de "próxima ação" na tabela leads (Altiora UC19 — ALTIORA-11)
-- e estende o CHECK constraint de altiora_lead_interactions para incluir
-- tipos de interação usados em ALTIORA-11 e ALTIORA-14.
-- =============================================================================

BEGIN;

-- ── 1. Colunas next_action em leads ──────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_action_type        text,
  ADD COLUMN IF NOT EXISTS next_action_description text,
  ADD COLUMN IF NOT EXISTS next_action_due_at      timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_responsavel_id uuid
    REFERENCES public.settings_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.next_action_type IS
  'Tipo da próxima ação planejada (Ligação, Reunião, E-mail, Tarefa) — UC19';
COMMENT ON COLUMN public.leads.next_action_description IS
  'Descrição textual da próxima ação planejada — UC19';
COMMENT ON COLUMN public.leads.next_action_due_at IS
  'Prazo da próxima ação — card Kanban exibe badge vermelho quando vencido — ALTIORA-03';
COMMENT ON COLUMN public.leads.next_action_responsavel_id IS
  'Responsável pela próxima ação (padrão = Closer atribuído) — UC19';

-- ── 2. Estender CHECK constraint de altiora_lead_interactions ─────────────────
-- Dropa o constraint antigo e recria com os novos tipos.

DO $$
BEGIN
  -- Remove constraint antigo se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'altiora_lead_interactions'
      AND constraint_name = 'altiora_lead_interactions_type_check'
  ) THEN
    ALTER TABLE public.altiora_lead_interactions
      DROP CONSTRAINT altiora_lead_interactions_type_check;
  END IF;

  -- Recria com todos os tipos (originais + novos)
  ALTER TABLE public.altiora_lead_interactions
    ADD CONSTRAINT altiora_lead_interactions_type_check
    CHECK (type IN (
      'closer_assigned',
      'closer_reassigned',
      'stage_changed',
      'meeting_scheduled',
      'meeting_rescheduled',
      'meeting_cancelled',
      'meeting_completed',
      'note_added',
      'email_received',
      'manual_action',
      'first_contact',
      'next_action_set',
      'meeting_noshow',
      'referral_lost',
      'referral_reopened'
    ));
END;
$$;

COMMIT;
