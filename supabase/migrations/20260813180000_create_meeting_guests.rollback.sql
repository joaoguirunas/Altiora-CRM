-- Rollback de 20260813180000_create_meeting_guests.sql
--
-- Derruba a tabela inteira: os convidados externos existem apenas aqui e no
-- attendees[] do evento já criado no Google Calendar. Reverter NÃO remove
-- ninguém de eventos já enviados — quem já recebeu o convite continua com ele.
-- Para desconvidar de verdade, editar a reunião no CRM antes de rodar isto.

BEGIN;

DROP POLICY IF EXISTS meeting_guests_access_policy ON public.meeting_guests;
DROP TABLE IF EXISTS public.meeting_guests;

COMMIT;

NOTIFY pgrst, 'reload schema';
