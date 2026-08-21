-- "Reunião Extra": um quarto valor para meetings.altiora_tipo, fora da
-- sequência R1 → R2 → R3.
--
-- POR QUE NÃO É SÓ MAIS UMA REUNIÃO GENÉRICA (altiora_tipo NULL):
-- reunião com altiora_tipo NULL não aparece na aba "Reuniões" do referral nem
-- nos filtros de Reuniões — ela some do fluxo. O closer precisa marcar
-- conversas avulsas (retomada, alinhamento com o cônjuge, dúvida pontual)
-- dentro do mesmo negócio, sem fingir que são uma R1/R2/R3.
--
-- DIFERENÇAS EM RELAÇÃO A R1/R2/R3, todas propositais:
--  * não tem etapa de pipeline associada — agendar uma Extra não move o negócio
--    e não satisfaz requisito de transição (ver useAltioraStageTransition, que
--    consulta explicitamente altiora_tipo = 'R1'/'R2'/'R3');
--  * pode acontecer quantas vezes for preciso no mesmo negócio;
--  * o título que o cliente vê é editável no modal e vai para
--    meetings.invite_title (ver 20260821120000_add_meeting_invite_override.sql).
--    O template só fornece o padrão "Reunião Extra — <cliente>".
--
-- Métricas de conversão (useAltioraMetrics) contam R1 explicitamente, então
-- Extras não distorcem taxa de comparecimento nem funil.

BEGIN;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_altiora_tipo_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_altiora_tipo_check
  CHECK (altiora_tipo IS NULL OR altiora_tipo IN ('R1', 'R2', 'R3', 'EXTRA'));

COMMIT;
