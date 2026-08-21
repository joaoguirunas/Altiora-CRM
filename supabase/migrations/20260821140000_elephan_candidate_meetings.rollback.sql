-- Rollback de 20260821140000_elephan_candidate_meetings.sql
--
-- ATENÇÃO: pendências em 'needs_confirmation' violariam o CHECK antigo. Elas
-- voltam a ser 'pending' — continuam na fila de vínculo manual, só perdem a
-- distinção entre "não achei reunião" e "achei mais de uma".

BEGIN;

UPDATE public.elephan_unmatched_events
   SET status = 'pending'
 WHERE status = 'needs_confirmation';

ALTER TABLE public.elephan_unmatched_events
  DROP CONSTRAINT IF EXISTS elephan_unmatched_events_status_check;

ALTER TABLE public.elephan_unmatched_events
  ADD CONSTRAINT elephan_unmatched_events_status_check
  CHECK (status IN ('pending', 'linked', 'ignored'));

ALTER TABLE public.elephan_unmatched_events
  DROP COLUMN IF EXISTS candidate_meeting_ids;

COMMIT;
