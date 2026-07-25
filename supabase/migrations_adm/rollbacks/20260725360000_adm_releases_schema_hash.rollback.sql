-- Rollback for: 20260725360000_adm_releases_schema_hash.sql
-- Tested-against: PostgreSQL 15 (Supabase)
-- REL-03 AC2 suporte DB — remove schema_hash de adm_releases.
-- Seguro apenas se adm-drift-check não estiver em produção ainda.

BEGIN;

ALTER TABLE public.adm_releases
  DROP COLUMN IF EXISTS schema_hash;

COMMIT;
