-- Rollback for: 20260610000003_whatsapp_template_sync_cron.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- WAT-SYNC-02 — removes last_synced_at column + unschedules the auto-sync cron.

BEGIN;

-- Unschedule cron (safe even if not scheduled)
DO $$
BEGIN
  PERFORM cron.unschedule('whatsapp_templates_auto_sync');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.unschedule: %', SQLERRM;
END;
$$;

-- Remove the column added by this migration
ALTER TABLE public.whatsapp_templates
  DROP COLUMN IF EXISTS last_synced_at;

COMMIT;
