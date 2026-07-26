-- Rollback for: 20260707190000_teams_pipelines_and_priority.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Features: settings_teams_pipelines table + is_priority column +
--           updated get_booking_eligible_user_ids / get_booking_session / book_meeting
--
-- WARNING: DROP TABLE CASCADE removes all team-pipeline assignments.
-- WARNING: DROP COLUMN removes is_priority for all team members.
-- WARNING: Functions are reverted to pre-pipeline signatures (DROP only — prior
--          versions are not recoverable from this file; restore from git if needed).

BEGIN;

-- 1. Drop the new table (indexes + policies cascade automatically)
DROP TABLE IF EXISTS public.settings_teams_pipelines CASCADE;

-- 2. Remove is_priority from settings_users_teams
ALTER TABLE public.settings_users_teams
  DROP COLUMN IF EXISTS is_priority;

-- 3. Drop functions introduced/updated by this migration
--    Prior versions can be restored from git history if needed.
DROP FUNCTION IF EXISTS public.lead_pipeline_accessible_to_current_user(uuid);
DROP FUNCTION IF EXISTS public.get_booking_eligible_user_ids(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_booking_session(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.book_meeting(uuid, uuid, uuid, integer, text, text, text, text, text);

COMMIT;
