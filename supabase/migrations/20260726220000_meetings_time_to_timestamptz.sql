-- Migration: 20260726220000_meetings_time_to_timestamptz.sql
--
-- Problema: start_time e end_time foram criados como tipo TIME (HH:MM:SS).
-- O código insere ISO timestamps completos (ex: 2026-07-28T17:00:00.000Z).
-- PostgreSQL rejeita com "invalid input syntax for type time".
--
-- Fix: alterar para TIMESTAMPTZ usando o campo date (date) para compor
-- o timestamp completo dos registros existentes.

BEGIN;

-- Garante que NOT NULL é mantido com default temporário durante a conversão
ALTER TABLE public.meetings
  ALTER COLUMN start_time TYPE timestamptz
  USING (
    CASE
      WHEN date IS NOT NULL
        THEN ((date::text || 'T' || start_time::text || '+00:00')::timestamptz)
      ELSE (CURRENT_DATE::text || 'T' || start_time::text || '+00:00')::timestamptz
    END
  );

ALTER TABLE public.meetings
  ALTER COLUMN end_time TYPE timestamptz
  USING (
    CASE
      WHEN date IS NOT NULL
        THEN ((date::text || 'T' || end_time::text || '+00:00')::timestamptz)
      ELSE (CURRENT_DATE::text || 'T' || end_time::text || '+00:00')::timestamptz
    END
  );

COMMIT;
