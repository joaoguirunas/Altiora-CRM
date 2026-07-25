-- Rollback for: 20260717130000_clients_people_rls_pipeline_access.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Restores clients_people RLS policies to pre-pipeline-access state.

BEGIN;

DROP POLICY IF EXISTS users_read_own_clients   ON public.clients_people;
DROP POLICY IF EXISTS users_update_own_clients ON public.clients_people;

-- Restore without lead_pipeline_accessible_to_current_user dependency
CREATE POLICY users_read_own_clients ON public.clients_people
  FOR SELECT
  USING (
    is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.people_id = clients_people.id
        AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id
        AND sut.user_id = get_current_settings_user_id()
    )
  );

CREATE POLICY users_update_own_clients ON public.clients_people
  FOR UPDATE
  USING (
    is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.people_id = clients_people.id
        AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id
        AND sut.user_id = get_current_settings_user_id()
    )
  )
  WITH CHECK (
    is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.people_id = clients_people.id
        AND l.user_id = get_current_settings_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.settings_users_teams sut ON sut.team_id = l.teams_id
      WHERE l.people_id = clients_people.id
        AND sut.user_id = get_current_settings_user_id()
    )
  );

COMMIT;
