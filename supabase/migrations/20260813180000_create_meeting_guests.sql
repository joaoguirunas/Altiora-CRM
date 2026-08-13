-- Convidados externos de uma reunião — e-mails digitados à mão no modal de
-- agendamento, no mesmo espírito do campo "Adicionar convidados" do Google Meet.
--
-- POR QUE UMA TABELA NOVA, e não `meeting_collaborators`:
-- `meeting_collaborators.user_id` é FK NOT NULL para settings_users, ou seja,
-- só aceita gente de dentro. Convidado externo não tem (e não deve ter) linha
-- em settings_users — criar usuário interno só para convidar alguém para uma
-- call daria acesso ao CRM a quem não deveria ter.
--
-- A distinção não é só técnica. Colaborador é co-host: é corresponsável pela
-- reunião e o nome dele entra na assinatura do convite ("Rafael e André —
-- Altiora Advisory Group", ver buildAltioraInvite). Convidado é só participante:
-- entra em attendees[] do evento e nada mais. Ver ADR-ALTIORA-01, que decidiu
-- que o convite cita nomes de responsáveis e não vira lista de contatos.
--
-- RLS: espelha `meeting_collaborators`, que por sua vez espelha o estado real de
-- `meetings` em produção (meetings_access_policy, USING true). Não é descuido —
-- é o mesmo status quo documentado em 20260807260000, com o mesmo TODO: apertar
-- as três juntas quando a RLS de meetings for endurecida.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_guests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  email        text NOT NULL,
  -- Nome é opcional: no fluxo do Meet você digita só o e-mail. Quando vier
  -- preenchido, serve para exibir "Maria (maria@x.com)" no badge do modal.
  name         text,
  added_by     uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Guarda de sanidade no banco, não substituto da validação no frontend:
  -- barra string vazia e texto sem "@" caso algum call site futuro esqueça.
  CONSTRAINT meeting_guests_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- Dedup case-insensitive: "Maria@X.com" e "maria@x.com" são o mesmo convidado.
-- Índice único funcional porque UNIQUE(meeting_id, email) deixaria os dois passar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_guests_unique_email
  ON public.meeting_guests (meeting_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_meeting_guests_meeting_id
  ON public.meeting_guests (meeting_id);

COMMENT ON TABLE public.meeting_guests IS
  'Convidados externos de uma reunião (e-mails livres, estilo "Adicionar convidados" do '
  'Google Meet). Entram apenas em attendees[] do evento de calendário. NÃO são co-hosts: '
  'diferente de meeting_collaborators, não aparecem na assinatura do convite e não têm '
  'linha em settings_users nem acesso ao CRM. Ver ADR-ALTIORA-01.';

COMMENT ON COLUMN public.meeting_guests.email IS 'E-mail do convidado. Único por reunião, case-insensitive (idx_meeting_guests_unique_email).';
COMMENT ON COLUMN public.meeting_guests.name IS 'Nome opcional para exibição — o fluxo padrão captura só o e-mail.';
COMMENT ON COLUMN public.meeting_guests.added_by IS 'Quem convidou (FK settings_users.id, ON DELETE SET NULL para preservar histórico).';

ALTER TABLE public.meeting_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_guests_access_policy ON public.meeting_guests;
CREATE POLICY meeting_guests_access_policy ON public.meeting_guests
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY meeting_guests_access_policy ON public.meeting_guests IS
  'Espelha meeting_collaborators_access_policy / meetings_access_policy (USING true) — estado '
  'real de RLS em meetings hoje. TODO: endurecer as três juntas.';

COMMIT;

NOTIFY pgrst, 'reload schema';
