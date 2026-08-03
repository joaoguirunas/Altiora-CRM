-- Fix meetings table: add columns that may be missing depending on which
-- CREATE TABLE migration ran first on this Supabase project.
-- All statements use IF NOT EXISTS so they are safe to run multiple times.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS people_id      uuid REFERENCES public.clients_people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_link   text,
  ADD COLUMN IF NOT EXISTS description    text;

-- Ensure google_meet_link also exists (original schema used this name)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS google_meet_link text;

-- Copy meeting_link → google_meet_link where google_meet_link is null
UPDATE public.meetings
SET google_meet_link = meeting_link
WHERE meeting_link IS NOT NULL AND google_meet_link IS NULL;
