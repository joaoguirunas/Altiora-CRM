-- Rollback for: 20260708120000_add_comercial_role.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Removes 'comercial' from settings_users_user_type_check constraint.
--
-- CAUTION: If any users have user_type = 'comercial', this rollback will FAIL
--          because existing rows would violate the restored constraint.
--          Verify first:
--            SELECT count(*) FROM public.settings_users WHERE user_type = 'comercial';
--          If count > 0: UPDATE those rows to 'user' before applying this rollback.

BEGIN;

ALTER TABLE public.settings_users
  DROP CONSTRAINT IF EXISTS settings_users_user_type_check;

ALTER TABLE public.settings_users
  ADD CONSTRAINT settings_users_user_type_check
  CHECK (user_type = ANY (ARRAY['admin'::text, 'manager'::text, 'user'::text]));

COMMIT;
