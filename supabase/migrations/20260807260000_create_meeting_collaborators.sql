-- ALTIORA-26: tabela de junção para colaboradores adicionais em uma reunião
-- (R1/R2/R3). Ver docs/smart-memory/stories/backlog/ALTIORA-26-db-meeting-collaborators.md
-- e docs/smart-memory/decisions/ADR-ALTIORA-01-reunioes-multiplos-colaboradores.md.
--
-- NÃO altera meetings.users_id (organizador único, dono do token OAuth do
-- evento no Google Calendar) nem leads.altiora_closer_id (Closer dono do
-- lead). Colaborador extra aqui é convidado/co-host adicional, nunca dono do
-- lead nem organizador do evento.
--
-- Nomes de coluna confirmados contra information_schema no banco live
-- (dtsmbqrzyxhjjjvpjfjd) antes de escrever esta migration:
--   meetings.id, meetings.users_id (organizador) — sem drift
--   settings_users.id — sem drift
--
-- *** DIVERGÊNCIA RLS — LER ANTES DE ALTERAR ***
-- A story (AC3) e o ADR-ALTIORA-01 pressupõem herdar a "mesma condição" das
-- policies granulares `users_manage_own_meetings`/`users_read_own_meetings`
-- definidas em supabase/migrations/20260716150000_meetings_rls_pipeline_access.sql.
-- Essas policies NUNCA foram aplicadas no banco real — confirmado em
-- 2026-08-07 via pg_policy: a ÚNICA policy ativa em public.meetings hoje é
-- `meetings_access_policy` (cmd=ALL, USING (true), sem WITH CHECK) — ou seja,
-- RLS ligada mas sem nenhuma restrição de posse/pipeline na prática. As
-- funções que a migration do repo pressupõe (`is_admin_or_manager()`,
-- `get_current_settings_user_id()`, `lead_pipeline_accessible_to_current_user()`)
-- também NÃO existem no banco (zero resultados em pg_proc).
--
-- Decisão do Chief (2026-08-07): esta migration espelha o estado REAL de
-- `meetings` hoje (permissivo), em vez de implementar as regras granulares
-- que só existem no desenho do ADR. Apertar a RLS de `meetings` é uma
-- decisão de segurança maior, fora do escopo desta story, que será tratada
-- em story própria com o dono do produto ciente do impacto.
--
-- TODO(quando a RLS de meetings for endurecida): endurecer esta tabela
-- junto, trocando `USING (true)` por EXISTS contra a policy real de
-- `meetings` na época. Não é descuido — é reflexo intencional do status quo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_collaborators (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.settings_users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'co_host' CHECK (role IN ('co_host', 'observer')),
  added_by     uuid REFERENCES public.settings_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

COMMENT ON TABLE public.meeting_collaborators IS
  'Colaboradores adicionais (co-hosts/observadores) de uma reunião Altiora (R1/R2/R3). '
  'NÃO substitui meetings.users_id (organizador único, dono do token OAuth do evento no '
  'Google Calendar) nem leads.altiora_closer_id (Closer dono do lead) — ambos permanecem '
  'intocados. Ver ADR-ALTIORA-01. RLS desta tabela espelha meetings_access_policy '
  '(USING true) como ela existe de fato em produção hoje, não as policies granulares que '
  '20260716150000_meetings_rls_pipeline_access.sql pressupõe mas nunca foi aplicada — '
  'ver comentário completo no arquivo da migration 20260807260000.';

COMMENT ON COLUMN public.meeting_collaborators.meeting_id IS 'Reunião à qual o colaborador foi adicionado (FK meetings.id, ON DELETE CASCADE).';
COMMENT ON COLUMN public.meeting_collaborators.user_id IS 'Usuário colaborador (FK settings_users.id, ON DELETE CASCADE) — não é o organizador nem o Closer dono do lead.';
COMMENT ON COLUMN public.meeting_collaborators.role IS 'co_host (padrão) ou observer — papel do colaborador na reunião, sem relação com user_type/gestor/super_adm.';
COMMENT ON COLUMN public.meeting_collaborators.added_by IS 'Quem adicionou este colaborador (FK settings_users.id, ON DELETE SET NULL para preservar histórico se o autor for removido).';

CREATE INDEX IF NOT EXISTS idx_meeting_collaborators_meeting_id ON public.meeting_collaborators(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_collaborators_user_id ON public.meeting_collaborators(user_id);

ALTER TABLE public.meeting_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_collaborators_access_policy ON public.meeting_collaborators;
CREATE POLICY meeting_collaborators_access_policy ON public.meeting_collaborators
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY meeting_collaborators_access_policy ON public.meeting_collaborators IS
  'Espelha meetings_access_policy (USING true) — estado real de RLS em meetings hoje, não o '
  'desenho granular do ADR-ALTIORA-01. TODO: endurecer junto quando/se meetings for endurecida.';

COMMIT;
