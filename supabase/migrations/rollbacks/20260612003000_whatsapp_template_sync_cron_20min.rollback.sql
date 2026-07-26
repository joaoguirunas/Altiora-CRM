-- Rollback for: 20260612003000_whatsapp_template_sync_cron_20min.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- Changes cron schedule of whatsapp_templates_auto_sync from */5 to */20.
-- Rollback: reschedule back to */5 (or unschedule if that was the original state).

SELECT cron.unschedule('whatsapp_templates_auto_sync');
-- To restore the */5 schedule from 20260610000003:
-- PERFORM cron.schedule('whatsapp_templates_auto_sync', '*/5 * * * *', '...');
-- (retrieve the original command from 20260610000003_whatsapp_template_sync_cron.sql)
