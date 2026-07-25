-- Rollback for: 20260630000002_webhook_logs.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- WARNING: CASCADE removes all webhook log rows. Confirm no production data needed before applying.

BEGIN;

DROP TABLE IF EXISTS public.webhook_logs CASCADE;

COMMIT;
