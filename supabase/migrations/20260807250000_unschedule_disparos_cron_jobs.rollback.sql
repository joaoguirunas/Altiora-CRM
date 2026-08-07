-- Rollback: 20260807250000_unschedule_disparos_cron_jobs.sql
-- Recria os 2 cron jobs do módulo Disparos com o schedule/command originais
-- (snapshot em backups/cron-sends-jobs-before-20260807250000.json). Só usar
-- se o dono do produto decidir religar o módulo Disparos.
-- Idempotente: cron.unschedule prévio evita erro de "job already exists".

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sends-dispatch-batch') THEN
    PERFORM cron.unschedule('sends-dispatch-batch');
  END IF;
  PERFORM cron.schedule(
    'sends-dispatch-batch',
    '* * * * *',
    'SELECT public.trigger_sends_dispatch_batch()'
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-stale-sending') THEN
    PERFORM cron.unschedule('reset-stale-sending');
  END IF;
  PERFORM cron.schedule(
    'reset-stale-sending',
    '*/5 * * * *',
    ' SELECT reset_stale_sending_messages(); '
  );
END $$;
