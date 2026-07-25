-- Rollback: 20260725100000_altiora_pipeline.sql
-- Remove pipeline Altiora e suas 13 etapas
-- ATENÇÃO: executar somente se nenhum lead usar este pipeline

BEGIN;

-- Stages primeiro (FK para o pipeline)
DELETE FROM public.leads_stages
WHERE leads_pipelines_id = 'a1000000-0000-0000-0000-000000000001'::uuid;

-- Pipeline
DELETE FROM public.leads_pipelines
WHERE id = 'a1000000-0000-0000-0000-000000000001'::uuid;

COMMIT;
