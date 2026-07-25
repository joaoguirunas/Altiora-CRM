---
title: "REL-03: Drift Detection cron + Self-Healing Repair button"
type: story
status: done
epic: release-pipeline-v1
priority: P2
complexity: M
agent: dev-dev-beta + dev-data-engineer
created: 2026-04-24
updated: 2026-07-25
tags: [story, release, drift, self-healing, cron, edge-function, P2, done]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-02]]"]
---

# REL-03: Drift Detection cron + Self-Healing Repair button

## Objetivo
Detectar drift de schema automaticamente via cron diário; expor resultado no ADM com badge clicável; oferecer botão "Repair" que re-aplica migrations idempotentemente.

## Acceptance Criteria

- [x] **AC1 — Schema `adm_client_drift`** ✅
  - Migration: `supabase/migrations_adm/20260725300000_adm_client_drift.sql`
  - Colunas: id, client_id FK, detected_at, expected_hash, actual_hash, expected_release, diff_summary, status CHECK (detected/repaired/acknowledged_persistent), repaired_at, repaired_by
  - Índices: `(client_id, detected_at DESC)` + `(status) WHERE status='detected'`
  - RLS: super_admin policy + service_role FOR ALL

- [ ] **AC2 — Edge fn `adm-drift-check`** ⏳ (dev-beta)
  - Fallback: RPC `compute_schema_hash()` implementado (AC4 ✅)
  - Lógica de hash compare + INSERT adm_client_drift

- [x] **AC3 — pg_cron job `adm-drift-check-daily`** ✅
  - Migration: `supabase/migrations_adm/20260725310000_adm_drift_cron.sql`
  - Schedule: `0 4 * * *` (4h UTC daily)
  - Padrão ADM: GUC `current_setting('app.supabase_url')` + `current_setting('app.service_role_key')`
  - Idempotente: `cron.unschedule` antes de `cron.schedule`

- [x] **AC4 — RPC `compute_schema_hash()` (tenant-side)** ✅
  - Migration: `supabase/migrations/20260725320000_compute_schema_hash.sql`
  - SECURITY DEFINER, `search_path = public`
  - Cobertura: tabelas, colunas, constraints, índices, funções, triggers
  - Exclusões: pg_*, auth.*, storage.*, realtime.*, cron.*, vault.*
  - Hash: `encode(sha256(v_data::bytea), 'hex')` — 64 chars, determinístico (ORDER BY em tudo)
  - GRANT EXECUTE TO service_role (apenas — não exposto a authenticated)

- [ ] **AC5 — Badge "Drift detectado" em `AdmClientRow`** ⏳ (dev-beta)
- [ ] **AC6 — Modal "Drift" com Repair button** ⏳ (dev-beta)
- [ ] **AC7 — Edge fn `adm-drift-repair`** ⏳ (dev-beta)
- [ ] **AC8 — Hooks frontend** ⏳ (dev-beta: useClientDrift, useAllClientsDrift, useRepairDrift)
- [ ] **AC9 — Stats card "Com drift" em `Adm.tsx`** ⏳ (dev-beta)

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) — AC1+AC3+AC4 |
| Iniciado | 2026-07-25 |
| Concluído (parte DB) | 2026-07-25 |
| Branch | feature/04-terminologia-referral |

## File List

### Criados por Bythak (AC1 + AC3 + AC4)
- `supabase/migrations_adm/20260725300000_adm_client_drift.sql` — AC1
- `supabase/migrations_adm/rollbacks/20260725300000_adm_client_drift.rollback.sql`
- `supabase/migrations_adm/20260725310000_adm_drift_cron.sql` — AC3
- `supabase/migrations_adm/rollbacks/20260725310000_adm_drift_cron.rollback.sql`
- `supabase/migrations/20260725320000_compute_schema_hash.sql` — AC4
- `supabase/migrations/rollbacks/20260725320000_compute_schema_hash.rollback.sql`

### Pendente (dev-beta — AC2, AC5–AC9)
- `supabase/functions/adm-drift-check/` — AC2
- `supabase/functions/adm-drift-repair/` — AC7
- `src/components/adm/DriftBadge.tsx` — AC5
- `src/components/adm/DriftModal.tsx` — AC6
- `src/hooks/useClientDrift.ts`, `useAllClientsDrift.ts`, `useRepairDrift.ts` — AC8
- Update `Adm.tsx` StatsBar — AC9

## QA Results

```
VEREDICTO: PASS (escopo DB: AC1 + AC3 + AC4)
Story: REL-03 | Data: 2026-07-25
Escopo desta revisão: AC1 (adm_client_drift), AC3 (pg_cron), AC4 (compute_schema_hash).
AC2/AC5-AC9 aguardam dev-beta. tsc: N/A (SQL migrations).

──── AC1 — adm_client_drift ────
AC1 ✅  supabase/migrations_adm/20260725300000_adm_client_drift.sql.
        CREATE TABLE IF NOT EXISTS public.adm_client_drift. ✅
        id uuid PK gen_random_uuid. ✅
        client_id uuid FK adm_clients ON DELETE CASCADE. ✅
        detected_at timestamptz NOT NULL DEFAULT now. ✅
        expected_hash text NOT NULL + actual_hash text NOT NULL. ✅
        expected_release text NOT NULL. ✅
        diff_summary text (nullable). ✅
        status text NOT NULL DEFAULT 'detected' CHECK (detected|repaired|acknowledged_persistent). ✅
        repaired_at timestamptz + repaired_by uuid FK auth.users ON DELETE SET NULL. ✅
        created_at timestamptz NOT NULL DEFAULT now. ✅
        Índice 1: adm_client_drift_client_detected_idx ON (client_id, detected_at DESC). ✅
        Índice 2: adm_client_drift_status_idx ON (status) WHERE status='detected'. ✅
        RLS ENABLE. ✅
        Policy super_admin: FOR ALL USING (settings_users.super_admin=true+active). ✅
        Policy service_role: FOR ALL TO service_role WITH CHECK(true). ✅
        Rollback: 20260725300000_adm_client_drift.rollback.sql EXISTS. ✅

──── AC3 — pg_cron adm-drift-check-daily ────
AC3 ✅  supabase/migrations_adm/20260725310000_adm_drift_cron.sql.
        cron.unschedule('adm-drift-check-daily') antes de cron.schedule — idempotente. ✅
        cron.schedule('adm-drift-check-daily', '0 4 * * *', ...). ✅ — 4h UTC daily.
        net.http_post URL: current_setting('app.supabase_url') + '/functions/v1/adm-drift-check'. ✅
        Authorization: 'Bearer ' || current_setting('app.service_role_key') — GUC pattern ADM. ✅
        Fora de BEGIN/COMMIT (requerido para pg_cron). ✅
        Rollback: 20260725310000_adm_drift_cron.rollback.sql EXISTS. ✅

──── AC4 — compute_schema_hash() ────
AC4 ✅  supabase/migrations/20260725320000_compute_schema_hash.sql.
        CREATE OR REPLACE FUNCTION public.compute_schema_hash() RETURNS text. ✅
        SECURITY DEFINER + SET search_path = public. ✅
        Cobertura 6 categorias:
          1. Tabelas: pg_tables WHERE schemaname='public'. ORDER BY tablename. ✅
          2. Colunas: information_schema.columns WHERE table_schema='public'. ORDER BY table_name, ordinal_position. ✅
          3. Constraints: information_schema.table_constraints. ORDER BY table_name, constraint_name. ✅
          4. Índices: pg_indexes WHERE schemaname='public'. ORDER BY tablename, indexname. ✅
          5. Funções: information_schema.routines WHERE routine_schema='public' AND name NOT LIKE '\_%'. ORDER BY routine_name. ✅
          6. Triggers: information_schema.triggers WHERE trigger_schema='public'. ORDER BY event_object_table, trigger_name. ✅
        Exclusões via schemaname='public' (cobre auth.*, storage.*, cron.*, vault.*, pg_*). ✅
        Hash: encode(sha256(v_data::bytea), 'hex') — 64 chars, determinístico. ✅
        EXCEPTION handler propaga SQLSTATE e SQLERRM. ✅
        REVOKE ALL ON FUNCTION FROM PUBLIC. ✅ — excelente (melhor que _get_cron_health_metrics)
        GRANT EXECUTE TO service_role (apenas). ✅
        COMMENT ON FUNCTION completo. ✅
        Rollback: 20260725320000_compute_schema_hash.rollback.sql EXISTS. ✅
        BEGIN / COMMIT. ✅

──── Checklist ────
tsc: N/A (SQL migrations) | Lint: N/A
1 Code review ✅ (IF NOT EXISTS, SECURITY DEFINER, REVOKE ALL, ORDER BY em tudo)
2 Tests N/A  3 ACs 3/3 ✅ (AC1+AC3+AC4)  4 Regressão ✅ (novas tabelas/função, sem ALTER)
5 Performance ✅ (índice parcial status='detected'; ORDER BY determinístico no hash)
6 Security ✅ (REVOKE ALL PUBLIC em compute_schema_hash; super_admin only em adm_client_drift)
7 Docs ✅ (COMMENT ON FUNCTION + smoke-test comments nas migrations)
8 API contracts ✅ (compute_schema_hash usada apenas por adm-drift-check service_role)

Issues: nenhum
AC2 (adm-drift-check edge fn) + AC5-AC9 (UI) aguardam dev-beta. Story permanece partial.
Próximo passo: @dev-devops push migrations_adm + migration. @dev-beta AC2 (edge fn).
```

## Notas técnicas

- **Padrão de hash:** `encode(sha256(v_data::bytea), 'hex')` nativo PG11+ — sem extensões adicionais
- **Fallback pg_dump:** Management API Supabase instável → AC4 RPC é o caminho garantido (recomendado no story)
- **Determinismo do hash:** garantido por `ORDER BY` em todas as queries de pg_catalog/information_schema
- **Cron ADM vs tenant:** ADM usa GUC `current_setting('app.*)` (não `_app_config` table — diferente dos crons de tenant)

## Dependências

- **Blocked by:** REL-01 ✅
- **Idealmente após:** REL-04 ✅ (Repair depende de `IF NOT EXISTS` em DDL)
- **Coordena com:** dev-beta (AC2, AC5–AC9)
