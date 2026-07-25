-- ROLLBACK: REL-03 AC4 — compute_schema_hash (20260725320000)
BEGIN;
DROP FUNCTION IF EXISTS public.compute_schema_hash();
COMMIT;
