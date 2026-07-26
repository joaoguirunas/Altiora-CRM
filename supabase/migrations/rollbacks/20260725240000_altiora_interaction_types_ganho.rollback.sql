-- Rollback for: 20260725240000_altiora_interaction_types_ganho.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: ALTIORA-20 (UC29 — referral_won) + ALTIORA-12 (stage_skipped)
--
-- This migration extended the CHECK constraint to add: referral_won, stage_skipped
--
-- CAUTION: If any rows in altiora_lead_interactions use these types,
--          restoring the old constraint will FAIL. Verify first:
--   SELECT DISTINCT type FROM public.altiora_lead_interactions
--   WHERE type IN ('referral_won', 'stage_skipped');
--
-- Restores to the 15-value set from 20260725201000_altiora_next_action.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'altiora_lead_interactions'
      AND constraint_name = 'altiora_lead_interactions_type_check'
  ) THEN
    ALTER TABLE public.altiora_lead_interactions
      DROP CONSTRAINT altiora_lead_interactions_type_check;
  END IF;

  -- Restore to 15-value set from 20260725201000 (without referral_won and stage_skipped)
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
