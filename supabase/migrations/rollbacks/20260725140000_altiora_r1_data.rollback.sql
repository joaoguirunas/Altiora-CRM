-- Rollback: 20260725140000_altiora_r1_data.sql

BEGIN;

DROP TRIGGER IF EXISTS altiora_r1_data_updated_at ON public.altiora_r1_data;
DROP TABLE IF EXISTS public.altiora_r1_data;

COMMIT;
