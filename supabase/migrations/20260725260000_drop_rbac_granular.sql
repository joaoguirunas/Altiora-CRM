-- ══════════════════════════════════════════════════════════════════════════════
-- ARCH-RBAC-02 AC3: Drop completo do sistema RBAC granular (tenant_roles)
-- Story: docs/smart-memory/stories/backlog/ARCH-RBAC-02-drop-rbac-granular.md
-- ADR:   docs/smart-memory/decisions/ADR-AUTH-09-rbac-granular-decision.md
--
-- Remove as 2 tabelas + 1 coluna FK + 1 enum + 1 função do sistema RBAC granular
-- que nunca foi exercido em produção (tenant_roles: 0 rows, tenant_role_permissions:
-- 0 rows, settings_users.role_id: NULL em todos os registros — verificado 2026-05-07).
--
-- Pré-condições verificadas antes do apply:
--   - tenant_roles: 0 rows
--   - tenant_role_permissions: 0 rows
--   - settings_users.role_id: NULL em todos → zero perda de dados
--   - Frontend limpo pelo dev-alpha (AC1 + AC2) antes desta migration
--
-- Idempotência: todos os DROPs usam IF EXISTS — re-execução é segura.
-- Rollback: supabase/migrations/rollbacks/20260725260000_drop_rbac_granular.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Diagnóstico pré-apply (segurança) ───────────────────────────────────────
-- Verifica que as tabelas estão vazias antes de dropar.
-- Em produção: confirmar via SELECT antes de executar.
--
-- SELECT COUNT(*) FROM public.tenant_roles;              -- deve ser 0
-- SELECT COUNT(*) FROM public.tenant_role_permissions;   -- deve ser 0
-- SELECT COUNT(*) FROM public.settings_users WHERE role_id IS NOT NULL;  -- deve ser 0

DO $$
DECLARE
  v_roles_count int;
  v_perms_count int;
  v_role_id_count int;
BEGIN
  -- Só verifica se as tabelas existem
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_roles') THEN
    SELECT COUNT(*) INTO v_roles_count FROM public.tenant_roles;
    IF v_roles_count > 0 THEN
      RAISE WARNING 'ARCH-RBAC-02: tenant_roles has % rows — proceeding with DROP (ADR-AUTH-09 approved)', v_roles_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_role_permissions') THEN
    SELECT COUNT(*) INTO v_perms_count FROM public.tenant_role_permissions;
    IF v_perms_count > 0 THEN
      RAISE WARNING 'ARCH-RBAC-02: tenant_role_permissions has % rows — proceeding with DROP (ADR-AUTH-09 approved)', v_perms_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='settings_users' AND column_name='role_id') THEN
    SELECT COUNT(*) INTO v_role_id_count FROM public.settings_users WHERE role_id IS NOT NULL;
    IF v_role_id_count > 0 THEN
      RAISE WARNING 'ARCH-RBAC-02: settings_users has % rows with non-null role_id — these will be set NULL by CASCADE', v_role_id_count;
    END IF;
  END IF;
END;
$$;


-- ─── 1. Drop coluna FK: settings_users.role_id ───────────────────────────────
-- ON DELETE SET NULL já remove a FK constraint; DROP COLUMN é necessário.
ALTER TABLE public.settings_users
  DROP COLUMN IF EXISTS role_id;


-- ─── 2. Drop índice (CASCADE cuida, mas IF EXISTS defensivo) ─────────────────
DROP INDEX IF EXISTS public.settings_users_role_id_idx;


-- ─── 3. Drop tabelas em ordem reversa de FK ───────────────────────────────────
-- tenant_role_permissions referencia tenant_roles → drop permissions primeiro.
DROP TABLE IF EXISTS public.tenant_role_permissions CASCADE;
DROP TABLE IF EXISTS public.tenant_roles            CASCADE;


-- ─── 4. Drop enum feature_key ────────────────────────────────────────────────
-- Enum não tem dependências após as tabelas serem dropadas.
DROP TYPE IF EXISTS public.feature_key;


-- ─── 5. Drop função seed_default_tenant_roles ────────────────────────────────
-- Nenhuma edge function ou trigger referencia esta função (verificado 2026-05-07).
DROP FUNCTION IF EXISTS public.seed_default_tenant_roles(uuid);


COMMIT;

-- ─── Smoke-test pós-apply ─────────────────────────────────────────────────────
-- Confirmar que as 2 tabelas, 1 coluna, 1 enum e 1 função foram dropados:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN ('tenant_roles','tenant_role_permissions');
-- -- Esperado: 0 rows
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='settings_users' AND column_name='role_id';
-- -- Esperado: 0 rows
--
-- SELECT typname FROM pg_type WHERE typname='feature_key';
-- -- Esperado: 0 rows
--
-- SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema='public' AND routine_name='seed_default_tenant_roles';
-- -- Esperado: 0 rows
