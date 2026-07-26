-- Rollback for: 20260725201000_altiora_next_action.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: UC19 (ALTIORA-11) — next_action fields in leads + extended interaction types
--
-- This migration did two things:
--   1. ADD COLUMN next_action_* on public.leads (4 columns)
--   2. Extended altiora_lead_interactions CHECK constraint to add:
--      first_contact, next_action_set, meeting_noshow, referral_lost, referral_reopened
--
-- CAUTION: If any rows in altiora_lead_interactions use the new types,
--          restoring the old constraint will FAIL. Verify first:
--   SELECT DISTINCT type FROM public.altiora_lead_interactions
--   WHERE type IN ('first_contact','next_action_set','meeting_noshow','referral_lost','referral_reopened');
--
-- NOTE: 20260725240000 extends the constraint further — rollback THAT migration first.

BEGIN;

-- ── 1. Drop next_action columns from leads ──────────────────────────────────
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS next_action_type,
  DROP COLUMN IF EXISTS next_action_description,
  DROP COLUMN IF EXISTS next_action_due_at,
  DROP COLUMN IF EXISTS next_action_responsavel_id;

-- ── 2. Restore CHECK constraint to original (20260725190000) version ─────────
-- Removes: first_contact, next_action_set, meeting_noshow, referral_lost, referral_reopened

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

  -- Restore to original 10-value set from 20260725190000
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
      'manual_action'
    ));
END;
$$;

COMMIT;
