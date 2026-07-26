-- Rollback for: 20260702150000_kiwify_reconcile_cron.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- KFY-1.6 — unschedule kiwify_reconcile cron job

SELECT cron.unschedule('kiwify_reconcile');
