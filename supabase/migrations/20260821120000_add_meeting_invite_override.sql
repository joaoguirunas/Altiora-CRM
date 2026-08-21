-- Convite de reunião editável pelo closer (título + corpo do e-mail).
--
-- Hoje o texto do convite é sempre gerado pelo servidor: para R1/R2/R3 pelos
-- templates do playbook (_shared/altiora-invite-template.ts) e, fora do fluxo
-- Altiora, pelo texto genérico "Reunião — <cliente> / Agendado via app".
-- O modal de agendamento passa a mostrar esse texto já preenchido e a permitir
-- ajustá-lo caso a caso (cliente que pediu outro assunto, reunião com pauta
-- fora do padrão, etc).
--
-- Semântica: NULL/vazio = usa o template (comportamento atual, inalterado).
-- Preenchido = o texto do closer substitui o do template, sem exceção. Isso
-- mantém o template como fonte de verdade para a esmagadora maioria das
-- reuniões — só quem editou de fato carrega um override na linha.
--
-- Os três provedores de calendário (Google, MS Teams, Zoom) leem estas colunas,
-- para que o mesmo override valha independentemente de onde a call acontece.
-- O sufixo [ref:<meeting_id>] do título e o "Link: ..." do corpo continuam
-- sendo anexados pelo servidor — não fazem parte do que o closer edita.

BEGIN;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS invite_title       text,
  ADD COLUMN IF NOT EXISTS invite_description text;

COMMENT ON COLUMN public.meetings.invite_title IS
  'Título do convite editado pelo closer. NULL/vazio = usa o template do servidor.';
COMMENT ON COLUMN public.meetings.invite_description IS
  'Corpo do convite editado pelo closer. NULL/vazio = usa o template do servidor.';

COMMIT;
