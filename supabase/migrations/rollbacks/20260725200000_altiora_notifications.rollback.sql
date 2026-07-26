-- Rollback for: 20260725200000_altiora_notifications.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: UC03 / UC12 (ALTIORA-07) — in-app notifications for Gestor + Closer
-- WARNING: CASCADE removes all notification rows. Confirm no production data before applying.

BEGIN;

DROP TABLE IF EXISTS public.altiora_notifications CASCADE;

COMMIT;
