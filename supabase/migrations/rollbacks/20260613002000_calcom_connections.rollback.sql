-- Rollback for: 20260613002000_calcom_connections.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- CAL-DB — Cal.com integration schema
-- WARNING: CASCADE removes all Cal.com OAuth connections. Confirm no active
--          connections before applying.

BEGIN;

DROP TABLE IF EXISTS public.user_calcom_connections CASCADE;

ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS calcom_uid;

ALTER TABLE public.settings
  DROP COLUMN IF EXISTS calcom_client_id;

COMMIT;
