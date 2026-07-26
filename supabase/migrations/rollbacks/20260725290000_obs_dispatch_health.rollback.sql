-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK: OBS-DISPATCH-HEALTH-01 (20260725290000)
-- Desfaz view v_dispatch_health, RPC get_send_health e helper _get_cron_health_metrics.
-- Não há alterações de schema (sem CREATE TABLE / ADD COLUMN) — rollback é limpo.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Drop RPC (deve vir antes do helper que usa a função) ────────────────────
DROP FUNCTION IF EXISTS public.get_send_health(uuid);

-- ─── Drop view ───────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_dispatch_health;

-- ─── Drop helper (depois da view que o usa) ──────────────────────────────────
DROP FUNCTION IF EXISTS public._get_cron_health_metrics();

COMMIT;
