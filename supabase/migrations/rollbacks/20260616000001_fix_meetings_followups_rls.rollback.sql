-- Rollback for: 20260616000001_fix_meetings_followups_rls.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Restores the meetings_followups write policy to open authenticated access.
-- (Prior policy was permissive — this migration tightened it to admin/manager only.)

BEGIN;

DROP POLICY IF EXISTS meet_fup_write ON public.meetings_followups;

-- Restore previous permissive write policy
CREATE POLICY meet_fup_write ON public.meetings_followups
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
