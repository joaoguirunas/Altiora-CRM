-- Rollback for: 20260725210000_altiora_stage_history.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: ALTIORA-12 AC4 — stage transition audit log
-- WARNING: CASCADE removes all stage history rows. Confirm no production data before applying.

BEGIN;

DROP TABLE IF EXISTS public.lead_stage_history CASCADE;

COMMIT;
