-- Rollback for: 20260609000000_drop_coach_pro_and_call_pro.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- @no-rollback reason: This migration DROPs multiple tables (evaluation_criteria_results,
--   evaluation_section_results, coach_email_log, meeting_evaluations,
--   meeting_playbook_assignments, playbook_criteria, playbook_sections, playbooks,
--   coach_pro_*, call_pro_*, etc.) along with their data (CASCADE).
--   Once applied, the data is lost and the tables cannot be restored from this file.
--   Recovery requires a database backup taken before this migration was applied.

-- no-op: see header comment
