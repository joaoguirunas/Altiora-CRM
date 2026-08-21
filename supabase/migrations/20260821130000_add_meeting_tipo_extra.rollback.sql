-- Rollback de 20260821130000_add_meeting_tipo_extra.sql
--
-- ATENÇÃO: reuniões já gravadas como 'EXTRA' violariam a constraint antiga.
-- Elas voltam a ser reuniões genéricas (altiora_tipo NULL) antes do CHECK ser
-- reapertado — preferível a perder a linha inteira.

BEGIN;

UPDATE public.meetings SET altiora_tipo = NULL WHERE altiora_tipo = 'EXTRA';

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_altiora_tipo_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_altiora_tipo_check
  CHECK (altiora_tipo IS NULL OR altiora_tipo IN ('R1', 'R2', 'R3'));

COMMIT;
