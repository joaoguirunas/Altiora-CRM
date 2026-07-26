-- Rollback: 20260725150000_altiora_finvity.sql

BEGIN;

DROP TRIGGER IF EXISTS altiora_finvity_analise_updated_at ON public.altiora_finvity_analise;
DROP TABLE IF EXISTS public.altiora_finvity_analise;

COMMIT;
