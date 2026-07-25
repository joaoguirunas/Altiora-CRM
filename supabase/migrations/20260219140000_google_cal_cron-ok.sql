-- Schedule PRO™ — pg_cron: Google Calendar sync every 15 minutes

-- Enable extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Remove old job if exists (safe to re-run)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'google-calendar-sync';

-- Schedule sync every 15 minutes
SELECT cron.schedule(
  'google-calendar-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ohzwetkaazgxafubzvop.supabase.co/functions/v1/google-cal-sync-to-db',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oendldGthYXpneGFmdWJ6dm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyOTkyNCwiZXhwIjoyMDY1NzA1OTI0fQ.PATf5qATNFcH1Sbgj7xvWXtacf326wn2R0awMe7WGbc'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
