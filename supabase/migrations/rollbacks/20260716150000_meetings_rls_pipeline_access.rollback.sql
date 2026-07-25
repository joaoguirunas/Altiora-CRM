-- Rollback for: 20260716150000_meetings_rls_pipeline_access.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Restores meetings RLS policies to pre-pipeline-access state.

BEGIN;

DROP POLICY IF EXISTS users_manage_own_meetings ON public.meetings;
DROP POLICY IF EXISTS users_read_own_meetings   ON public.meetings;

-- Restore pre-pipeline policies (without lead_pipeline_accessible_to_current_user)
CREATE POLICY users_manage_own_meetings ON public.meetings
  FOR ALL
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (
      SELECT team_id FROM public.settings_users_teams
      WHERE user_id = get_current_settings_user_id()
    ))
  )
  WITH CHECK (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (
      SELECT team_id FROM public.settings_users_teams
      WHERE user_id = get_current_settings_user_id()
    ))
  );

CREATE POLICY users_read_own_meetings ON public.meetings
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (
      SELECT team_id FROM public.settings_users_teams
      WHERE user_id = get_current_settings_user_id()
    ))
  );

COMMIT;
