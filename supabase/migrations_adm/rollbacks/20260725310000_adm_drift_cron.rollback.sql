-- ROLLBACK: REL-03 AC3 — adm-drift-check-daily cron (20260725310000)
SELECT cron.unschedule('adm-drift-check-daily');
