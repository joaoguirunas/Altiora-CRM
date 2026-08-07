-- Rollback: 20260807260000_create_meeting_collaborators.sql
-- Remove a tabela meeting_collaborators por completo (policy + índices caem
-- junto via DROP TABLE). Não afeta meetings, leads nem settings_users.

BEGIN;

DROP TABLE IF EXISTS public.meeting_collaborators;

COMMIT;
