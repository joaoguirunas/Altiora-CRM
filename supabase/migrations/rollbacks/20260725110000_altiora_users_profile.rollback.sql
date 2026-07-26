-- Rollback: 20260725110000_altiora_users_profile.sql

BEGIN;

DROP INDEX IF EXISTS public.idx_settings_users_user_type;

ALTER TABLE public.settings_users
  DROP CONSTRAINT IF EXISTS settings_users_user_type_check,
  DROP COLUMN IF EXISTS user_type,
  DROP COLUMN IF EXISTS fuso_horario;

COMMIT;
