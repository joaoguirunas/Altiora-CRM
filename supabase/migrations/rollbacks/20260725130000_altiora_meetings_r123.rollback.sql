-- Rollback: 20260725130000_altiora_meetings_r123.sql

BEGIN;

DROP INDEX IF EXISTS public.meetings_google_event_id_uq;
DROP INDEX IF EXISTS public.idx_meetings_altiora_tipo;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_altiora_tipo_check,
  DROP COLUMN IF EXISTS altiora_tipo,
  DROP COLUMN IF EXISTS altiora_duracao_minutos,
  DROP COLUMN IF EXISTS google_event_id,
  DROP COLUMN IF EXISTS altiora_compareceu,
  DROP COLUMN IF EXISTS altiora_motivo_ausencia,
  DROP COLUMN IF EXISTS altiora_resultado,
  DROP COLUMN IF EXISTS altiora_pauta,
  DROP COLUMN IF EXISTS altiora_proxima_acao,
  DROP COLUMN IF EXISTS altiora_created_by,
  DROP COLUMN IF EXISTS altiora_data_hora;

COMMIT;
