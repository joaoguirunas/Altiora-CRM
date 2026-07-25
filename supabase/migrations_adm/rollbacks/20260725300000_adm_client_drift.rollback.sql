-- ROLLBACK: REL-03 AC1 — adm_client_drift (20260725300000)
-- Remove tabela, índices e policies do controle de drift ADM.
-- ATENÇÃO: dropa todos os registros de drift detectados.

BEGIN;

DROP TABLE IF EXISTS public.adm_client_drift CASCADE;

COMMIT;
