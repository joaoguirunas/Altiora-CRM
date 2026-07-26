-- Rollback for: 20260717120000_whatsapp_templates_purpose.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Removes the `purpose` column added to whatsapp_templates.
-- WARNING: Any data stored in purpose is lost.

BEGIN;

ALTER TABLE public.whatsapp_templates
  DROP COLUMN IF EXISTS purpose;

COMMIT;
