-- Rollback de 20260821120000_add_meeting_invite_override.sql
-- Derruba os overrides de convite; reuniões voltam a usar só o template.

BEGIN;

ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS invite_title,
  DROP COLUMN IF EXISTS invite_description;

COMMIT;
