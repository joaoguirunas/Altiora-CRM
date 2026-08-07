-- Módulo Disparos foi aposentado de vez pelo dono do produto (confirmado
-- 2026-08-07 — foi ele quem removeu `sends_contacts` intencionalmente, ver
-- 20260807240000_fix_merge_persons_step8_remove_sends.sql). `public.sends`
-- tem 0 linhas hoje — os 2 cron jobs abaixo são no-op no momento, mas ficam
-- ativos indefinidamente sem necessidade. Limpeza de higiene, não emergência.
--
-- Jobs desagendados (snapshot completo em
-- backups/cron-sends-jobs-before-20260807250000.json):
--   jobid=6,  jobname='reset-stale-sending',  schedule='*/5 * * * *', command='SELECT reset_stale_sending_messages();'
--   jobid=17, jobname='sends-dispatch-batch', schedule='* * * * *',   command='SELECT public.trigger_sends_dispatch_batch()'
--
-- Desagenda por NOME (jobid não é estável entre ambientes/tenants).
-- Idempotente: se o job não existir (já desagendado, ou tenant onde nunca
-- existiu), não falha.
--
-- NÃO dropa as functions trigger_sends_dispatch_batch() nem
-- reset_stale_sending_messages(), e NÃO mexe na tabela sends — só
-- desagenda. Reversível de forma trivial via rollback (cron.schedule com o
-- schedule/command originais acima); dropar function seria mais caro de
-- reverter caso o dono do produto religue Disparos no futuro.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sends-dispatch-batch') THEN
    PERFORM cron.unschedule('sends-dispatch-batch');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-stale-sending') THEN
    PERFORM cron.unschedule('reset-stale-sending');
  END IF;
END $$;
