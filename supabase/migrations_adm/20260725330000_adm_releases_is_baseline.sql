-- ══════════════════════════════════════════════════════════════════════════════
-- REL-05 AC5 (parte DB) — is_baseline flag + adm-baseline-check cron
-- Applies ONLY to control plane (NOT synced to clients)
--
-- 1. Adiciona coluna is_baseline a adm_releases (REL-01 AC3a)
-- 2. Registra cron semanal adm-baseline-check (sábados 5h UTC)
--    que conta migrations ativas e notifica se > threshold (100)
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. is_baseline flag em adm_releases ─────────────────────────────────────
-- Distingue releases de consolidação histórica (baseline squash)
-- de releases de feature incremental. Útil para UI changelog (REL-02).
ALTER TABLE public.adm_releases
  ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS adm_releases_is_baseline_idx
  ON public.adm_releases (is_baseline)
  WHERE is_baseline = true;

COMMENT ON COLUMN public.adm_releases.is_baseline IS
  'REL-05: true quando esta release é um squash de baseline '
  '(consolidação de N migrations anteriores). UI usa para badge "Baseline".';

COMMIT;

-- ─── 2. Cron semanal: adm-baseline-check ─────────────────────────────────────
-- Cron roda FORA de transaction (SELECT não pode ir dentro de BEGIN..COMMIT
-- junto com cron.schedule por causa do comportamento do pg_cron no Supabase).
SELECT cron.unschedule('adm-baseline-check-weekly');

SELECT cron.schedule(
  'adm-baseline-check-weekly',
  '0 5 * * 6',   -- sábados às 5h UTC
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/adm-baseline-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{"threshold": 100}'::jsonb
  );
  $$
);

-- ─── Smoke-test ───────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'adm_releases' AND column_name = 'is_baseline';
-- -- Esperado: 1 row
--
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'adm-baseline-check-weekly';
-- -- Esperado: 1 row, active = true, schedule = '0 5 * * 6'
