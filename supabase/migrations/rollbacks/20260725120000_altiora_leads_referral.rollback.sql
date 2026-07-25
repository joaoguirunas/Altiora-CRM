-- Rollback: 20260725120000_altiora_leads_referral.sql

BEGIN;

DROP INDEX IF EXISTS public.idx_leads_altiora_closer_id;
DROP INDEX IF EXISTS public.idx_leads_altiora_gestor_id;
DROP INDEX IF EXISTS public.idx_leads_altiora_origem;
DROP INDEX IF EXISTS public.idx_leads_altiora_data_handoff;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_altiora_origem_check,
  DROP CONSTRAINT IF EXISTS leads_altiora_origem_atribuicao_check,
  DROP COLUMN IF EXISTS altiora_origem,
  DROP COLUMN IF EXISTS altiora_closer_id,
  DROP COLUMN IF EXISTS altiora_gestor_id,
  DROP COLUMN IF EXISTS altiora_data_handoff,
  DROP COLUMN IF EXISTS altiora_data_atribuicao,
  DROP COLUMN IF EXISTS altiora_email_handoff_id,
  DROP COLUMN IF EXISTS altiora_origem_atribuicao,
  DROP COLUMN IF EXISTS altiora_possibilidade_retomada,
  DROP COLUMN IF EXISTS altiora_etapa_perda,
  DROP COLUMN IF EXISTS altiora_obs_atribuicao;

COMMIT;
