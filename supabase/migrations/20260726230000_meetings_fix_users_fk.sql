-- Fix: meetings.users_id FK aponta para public.users (vazio).
-- A tabela de usuários real do sistema é settings_users.
-- Recria o FK apontando para settings_users(id).

BEGIN;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_users_id_fkey;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_users_id_fkey
    FOREIGN KEY (users_id)
    REFERENCES public.settings_users(id)
    ON DELETE SET NULL;

COMMIT;
