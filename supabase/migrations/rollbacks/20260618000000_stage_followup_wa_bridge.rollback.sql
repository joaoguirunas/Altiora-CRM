-- Rollback for: 20260618000000_stage_followup_wa_bridge.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- @no-rollback reason: This migration used CREATE OR REPLACE FUNCTION for
--   notify_lead_stage_changed() — the prior version of this function is not
--   recoverable from this file alone. Restore from git history if needed:
--     git show HEAD~N:supabase/migrations/... or prior migration defining this function.
--   Dropping the function would break any triggers that call it.

-- no-op: see header comment
