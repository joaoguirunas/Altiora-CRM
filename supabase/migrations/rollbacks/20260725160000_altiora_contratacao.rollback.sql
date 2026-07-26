-- Rollback: 20260725160000_altiora_contratacao.sql

BEGIN;

DROP INDEX IF EXISTS public.idx_altiora_contratacao_underwriting;
DROP INDEX IF EXISTS public.idx_altiora_contratacao_entrevista;
DROP TRIGGER IF EXISTS altiora_contratacao_updated_at ON public.altiora_contratacao;
DROP TABLE IF EXISTS public.altiora_contratacao;

COMMIT;
