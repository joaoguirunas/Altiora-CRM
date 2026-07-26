-- ══════════════════════════════════════════════════════════════════════════════
-- Cleanup: DROP sends_import_presets (tabela órfã)
--
-- Origem: dev-gamma (SENDS-IMPORT-01) removeu useImportPresets do frontend.
-- Auditoria 2026-07-25 (Bythak):
--   - Zero callers em src/ (exceto types.ts auto-gerado)
--   - Zero callers em supabase/functions/
--   - Zero FKs de outras tabelas apontando para sends_import_presets
--   - Apenas 1 migration a referencia (a de criação: 20260430110000)
--
-- Tabela: public.sends_import_presets
-- Criada em: 20260430110000_fwup23_sends_import_presets.sql
-- Dados: tabela de configuração — zero impacto funcional em prod.
--
-- Pré-condição: confirmar 0 rows antes do apply (tabela nunca populada em prod).
--   SELECT COUNT(*) FROM public.sends_import_presets;  -- deve ser 0
--
-- Rollback: supabase/migrations/rollbacks/20260725280000_drop_sends_import_presets.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_count int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sends_import_presets'
  ) THEN
    SELECT COUNT(*) INTO v_count FROM public.sends_import_presets;
    IF v_count > 0 THEN
      RAISE WARNING 'DROP sends_import_presets: tabela tem % rows — prosseguindo (zero callers confirmados 2026-07-25)', v_count;
    END IF;
  END IF;
END;
$$;

-- CASCADE remove trigger update_sends_import_presets_updated_at + policy + RLS automaticamente.
DROP TABLE IF EXISTS public.sends_import_presets CASCADE;

COMMIT;

-- ─── Smoke-test pós-apply ─────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name = 'sends_import_presets';
-- -- Esperado: 0 rows
