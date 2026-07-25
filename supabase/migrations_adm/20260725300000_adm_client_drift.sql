-- ══════════════════════════════════════════════════════════════════════════════
-- REL-03 AC1 — adm_client_drift: tabela de registro de drift de schema
-- Applies ONLY to control plane (NOT synced to clients)
--
-- Registra mismatch entre o schema esperado (hash da release) e o schema
-- real de cada tenant. Consumido pelo badge "Drift detectado" (AC5 — UI)
-- e pelo botão Repair (AC7 — adm-drift-repair edge fn).
--
-- Rollback: supabase/migrations_adm/rollbacks/20260725300000_adm_client_drift.rollback.sql
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.adm_client_drift (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid        NOT NULL REFERENCES public.adm_clients(id) ON DELETE CASCADE,
  detected_at            timestamptz NOT NULL DEFAULT now(),
  expected_hash          text        NOT NULL,
  actual_hash            text        NOT NULL,
  expected_release       text        NOT NULL,  -- adm_releases.version (ex: '2.00')
  diff_summary           text,                  -- texto curto: "5 tabelas inesperadas, 2 colunas faltando"
  status                 text        NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'repaired', 'acknowledged_persistent')),
  repaired_at            timestamptz,
  repaired_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Lookup rápido por cliente (dashboard badge e stats card)
CREATE INDEX IF NOT EXISTS adm_client_drift_client_detected_idx
  ON public.adm_client_drift (client_id, detected_at DESC);

-- Filtro por status para stats agregados (count com drift ativo)
CREATE INDEX IF NOT EXISTS adm_client_drift_status_idx
  ON public.adm_client_drift (status)
  WHERE status = 'detected';

ALTER TABLE public.adm_client_drift ENABLE ROW LEVEL SECURITY;

-- Super-admin: acesso total
CREATE POLICY "adm_client_drift_super_admin"
  ON public.adm_client_drift FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.settings_users
      WHERE auth_user_id = auth.uid()
        AND super_admin  = true
        AND active       = true
        AND deleted_at   IS NULL
    )
  );

-- service_role: INSERT (chamado por adm-drift-check edge fn via cron)
-- e UPDATE (chamado por adm-drift-repair)
CREATE POLICY "adm_client_drift_service_role"
  ON public.adm_client_drift FOR ALL
  TO service_role
  WITH CHECK (true);

COMMIT;

-- ─── Smoke-test ───────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name = 'adm_client_drift';
-- -- Esperado: 1 row
