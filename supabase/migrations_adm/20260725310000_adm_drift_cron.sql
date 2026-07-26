-- ══════════════════════════════════════════════════════════════════════════════
-- REL-03 AC3 — pg_cron job: adm-drift-check-daily
-- Applies ONLY to control plane (NOT synced to clients)
--
-- Dispara `adm-drift-check` edge fn às 4h UTC diariamente.
-- Segue padrão ADM de cron: current_setting('app.supabase_url') + GUC key.
-- Idempotente: cron.unschedule antes de re-schedule.
--
-- Requer: adm-drift-check edge fn (dev-beta AC2) deployada antes de ativar.
-- ══════════════════════════════════════════════════════════════════════════════

SELECT cron.unschedule('adm-drift-check-daily');

SELECT cron.schedule(
  'adm-drift-check-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/adm-drift-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ─── Smoke-test ───────────────────────────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'adm-drift-check-daily';
-- -- Esperado: 1 row, active = true, schedule = '0 4 * * *'
