-- Rollback for: 20260725180000_altiora_email_queue.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Story: UC10 — ALTIORA-05 (altiora-email-referral-inbound deduplication log)
-- WARNING: CASCADE removes all rows. Confirm no production data before applying.

BEGIN;

DROP TABLE IF EXISTS public.altiora_email_queue CASCADE;

COMMIT;
