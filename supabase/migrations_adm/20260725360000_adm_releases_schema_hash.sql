-- ══════════════════════════════════════════════════════════════════════════════
-- REL-03 AC2 (suporte DB) — adm_releases.schema_hash
-- Applies ONLY to control plane (NOT synced to clients)
--
-- Adiciona coluna `schema_hash` à tabela `adm_releases` para armazenar
-- o hash SHA-256 do schema canônico de cada release.
--
-- Uso:
--   - adm-releases-register: popula schema_hash ao registrar nova release
--     (hash computado em CI a partir do ambiente de referência).
--   - adm-drift-check: lê schema_hash para comparar com hash real do tenant.
--     Se schema_hash for NULL para uma release, adm-drift-check popula o campo
--     com o hash do primeiro tenant checado (lazy baseline establishment).
--
-- Rollback: supabase/migrations_adm/rollbacks/20260725360000_adm_releases_schema_hash.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.adm_releases
  ADD COLUMN IF NOT EXISTS schema_hash text;

COMMENT ON COLUMN public.adm_releases.schema_hash IS
  'REL-03 AC2: Hash SHA-256 do schema público do tenant para esta release. '
  'Computado por compute_schema_hash() (migration 20260725320000). '
  'NULL = baseline ainda não estabelecido (adm-drift-check popula no primeiro check). '
  'Quando preenchido pelo CI, representa o schema esperado no momento do release.';

COMMIT;

-- ─── Smoke-test ───────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'adm_releases' AND column_name = 'schema_hash';
-- -- Esperado: 1 row, data_type = 'text', is_nullable = 'YES'
