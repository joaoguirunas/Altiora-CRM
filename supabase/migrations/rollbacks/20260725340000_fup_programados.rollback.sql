-- ROLLBACK: FUP-AUTO-01 — fup_programados (20260725340000)
-- @allow-destructive reason: rollback completo da feature FUP-AUTO-01

-- 1. Remove cron (fora de transação)
SELECT cron.unschedule('fup-programados-worker');

-- 2. Remove RPC, tabela e índices
BEGIN;

DROP FUNCTION IF EXISTS public.agendar_fup(uuid, text, timestamptz, uuid, text, text, text, text, uuid);
DROP TABLE IF EXISTS public.fup_programados CASCADE;

COMMIT;
