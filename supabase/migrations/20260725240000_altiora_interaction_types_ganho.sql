-- =============================================================================
-- Migration: 20260725240000_altiora_interaction_types_ganho.sql
-- Estende o CHECK constraint de altiora_lead_interactions para incluir
-- 'referral_won' (ALTIORA-20 UC29) e 'stage_skipped' (ALTIORA-12).
-- =============================================================================

BEGIN;

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

  -- Recria com todos os tipos incluindo referral_won e stage_skipped
  ALTER TABLE public.altiora_lead_interactions
    ADD CONSTRAINT altiora_lead_interactions_type_check
    CHECK (type IN (
      -- Tipos originais
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
      -- ALTIORA-11 (UC19)
      'first_contact',
      'next_action_set',
      -- ALTIORA-14 (UC23)
      'meeting_noshow',
      -- ALTIORA-19 (encerramento)
      'referral_lost',
      'referral_reopened',
      -- ALTIORA-20 (UC29 — ganho)
      'referral_won',
      -- ALTIORA-12 (validação de etapas)
      'stage_skipped'
    ));
END;
$$;

COMMIT;
