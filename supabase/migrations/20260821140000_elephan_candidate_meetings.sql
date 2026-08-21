-- Elephan.ai — confirmação de contato quando o match automático é ambíguo.
--
-- Até aqui o elephan-inbound só estacionava a call em elephan_unmatched_events
-- quando NÃO achava reunião nenhuma; achando várias, colava na primeira da
-- janela (limit(1)) sem ninguém confirmar — call gravada no negócio errado, em
-- silêncio. Agora, quando há mais de um candidato (ou quando o match só
-- apareceu numa janela larga, de baixa confiança), a call vira uma pendência
-- 'needs_confirmation' com os candidatos junto, para o closer escolher de qual
-- contato era aquela reunião.
--
-- Guardamos só os IDs: nome do negócio/pessoa é resolvido na hora pela UI, para
-- a pendência não exibir um nome velho se o negócio for renomeado.

BEGIN;

ALTER TABLE public.elephan_unmatched_events
  ADD COLUMN IF NOT EXISTS candidate_meeting_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.elephan_unmatched_events.candidate_meeting_ids IS
  'Reuniões que o match automático considerou plausíveis para esta call. A UI '
  'sugere estas primeiro na hora do vínculo manual. Vazio = nenhum candidato.';

ALTER TABLE public.elephan_unmatched_events
  DROP CONSTRAINT IF EXISTS elephan_unmatched_events_status_check;

ALTER TABLE public.elephan_unmatched_events
  ADD CONSTRAINT elephan_unmatched_events_status_check
  CHECK (status IN ('pending', 'needs_confirmation', 'linked', 'ignored'));

COMMIT;
