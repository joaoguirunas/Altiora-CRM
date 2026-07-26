-- Rollback for: 20260716140000_leads_rls_pipeline_access.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Restores leads RLS policies to pre-pipeline-access state (without
-- lead_pipeline_accessible_to_current_user() function dependency).
--
-- NOTE: Also drops lead_pipeline_accessible_to_current_user() function which was
--       introduced by this migration. If 20260716150000 or 20260717130000 reference
--       it, rollback those migrations first.

BEGIN;

-- Remove pipeline-aware policies
DROP POLICY IF EXISTS users_read_own_leads   ON public.leads;
DROP POLICY IF EXISTS users_update_own_leads ON public.leads;

-- Restore pre-pipeline policies (simpler: admin_or_manager OR own team OR own user_id)
CREATE POLICY users_read_own_leads ON public.leads
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR (user_id = get_current_settings_user_id())
    OR (teams_id IN (
      SELECT team_id FROM public.settings_users_teams
      WHERE user_id = get_current_settings_user_id()
    ))
  );

CREATE POLICY users_update_own_leads ON public.leads
  FOR UPDATE
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

-- Drop the helper function introduced by this migration
DROP FUNCTION IF EXISTS public.lead_pipeline_accessible_to_current_user(uuid);

COMMIT;
