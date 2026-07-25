-- ══════════════════════════════════════════════════════════════════════════════
-- REL-03 AC4 — RPC compute_schema_hash() (per-tenant)
--
-- Gera hash SHA-256 determinístico do schema public do tenant.
-- Usado pelo adm-drift-check (AC2 — dev-beta) como fallback quando
-- Management API de pg_dump não está disponível.
--
-- Determinismo garantido por ORDER BY em todas as iterações.
-- Execuções múltiplas no mesmo schema → mesmo hash.
--
-- Cobertura: tabelas, colunas, constraints, índices, funções public, triggers.
-- Exclusões: pg_*, auth.*, storage.*, realtime.*, cron.*, vault.*
--            (foco exclusivo em schema public do tenant)
--
-- SECURITY DEFINER: necessário para leitura de pg_catalog e information_schema
-- sem precisar grant explícito ao role authenticated.
--
-- Rollback: supabase/migrations/rollbacks/20260725320000_compute_schema_hash.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_schema_hash()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts  text[];
  v_data   text;
BEGIN
  -- ── 1. Tabelas (ordenadas por nome) ──────────────────────────────────────
  v_parts := array_append(v_parts,
    'TABLES:' || COALESCE((
      SELECT string_agg('T:' || tablename, ',' ORDER BY tablename)
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    ), '')
  );

  -- ── 2. Colunas (tabela + posição + tipo + nullable + default) ────────────
  v_parts := array_append(v_parts,
    'COLUMNS:' || COALESCE((
      SELECT string_agg(
        'C:' || table_name || '.' || column_name
             || ':' || data_type
             || ':' || is_nullable
             || ':' || COALESCE(column_default, 'null'),
        ',' ORDER BY table_name, ordinal_position
      )
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   NOT LIKE 'pg_%'
    ), '')
  );

  -- ── 3. Constraints (PK, FK, UNIQUE, CHECK) ───────────────────────────────
  v_parts := array_append(v_parts,
    'CONSTRAINTS:' || COALESCE((
      SELECT string_agg(
        'K:' || tc.table_name || '.' || tc.constraint_name || ':' || tc.constraint_type,
        ',' ORDER BY tc.table_name, tc.constraint_name
      )
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name   NOT LIKE 'pg_%'
    ), '')
  );

  -- ── 4. Índices (nome + tabela + definição) ───────────────────────────────
  v_parts := array_append(v_parts,
    'INDEXES:' || COALESCE((
      SELECT string_agg(
        'I:' || indexname || ':' || tablename || ':' || indexdef,
        ',' ORDER BY tablename, indexname
      )
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  NOT LIKE 'pg_%'
    ), '')
  );

  -- ── 5. Funções públicas (excluindo helpers internos com prefixo _) ────────
  v_parts := array_append(v_parts,
    'FUNCTIONS:' || COALESCE((
      SELECT string_agg(
        'F:' || routine_name || ':' || routine_type || ':' || COALESCE(data_type, 'void'),
        ',' ORDER BY routine_name
      )
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name   NOT LIKE '\_%'  -- exclui helpers internos prefixados com _
        AND external_language NOT IN ('C', 'INTERNAL')  -- exclui funções C built-in
    ), '')
  );

  -- ── 6. Triggers (nome + tabela + evento) ─────────────────────────────────
  v_parts := array_append(v_parts,
    'TRIGGERS:' || COALESCE((
      SELECT string_agg(
        'G:' || trigger_name || ':' || event_object_table || ':' || event_manipulation || ':' || action_timing,
        ',' ORDER BY event_object_table, trigger_name, event_manipulation
      )
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table NOT LIKE 'pg_%'
    ), '')
  );

  -- ── Concatenar todas as partes e hashar ───────────────────────────────────
  v_data := array_to_string(v_parts, '||');

  -- SHA-256 hex (disponível em PG11+ nativo via sha256() built-in)
  RETURN encode(sha256(v_data::bytea), 'hex');

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'compute_schema_hash failed: %', SQLERRM
    USING ERRCODE = SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.compute_schema_hash() IS
  'REL-03 AC4: Gera hash SHA-256 determinístico do schema public do tenant. '
  'Usado por adm-drift-check como fallback para detectar drift de schema. '
  'Cobre: tabelas, colunas, constraints, índices, funções, triggers. '
  'Exclui schemas internos (auth, storage, cron, vault, pg_*). '
  'SECURITY DEFINER para acesso a pg_catalog e information_schema.';

-- Grant: service_role (chamado pelo adm-drift-check via Management API ou direto)
REVOKE ALL ON FUNCTION public.compute_schema_hash() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_schema_hash() TO service_role;

COMMIT;

-- ─── Smoke-test pós-apply ─────────────────────────────────────────────────────
-- SELECT public.compute_schema_hash();
-- -- Esperado: text hex de 64 chars (SHA-256)
-- -- Rode 2× — deve retornar mesmo valor (determinismo)
