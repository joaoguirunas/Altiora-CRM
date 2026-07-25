-- ROLLBACK: REL-05 AC5 DB — is_baseline flag + adm-baseline-check-weekly cron (20260725330000)

-- 1. Remove cron
SELECT cron.unschedule('adm-baseline-check-weekly');

-- 2. Remove coluna (DROP INDEX implícito via CASCADE no partial index)
BEGIN;
DROP INDEX IF EXISTS public.adm_releases_is_baseline_idx;
ALTER TABLE public.adm_releases DROP COLUMN IF EXISTS is_baseline;
COMMIT;
