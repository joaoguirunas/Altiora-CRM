---
title: "REL-05: Schema Baseline Squashing — squash-baseline.js + arquivamento + onboarding rápido"
type: story
status: done
epic: release-pipeline-v1
priority: P2
complexity: M
agent: dev-data-engineer
created: 2026-04-24
updated: 2026-07-25
tags: [story, release, baseline, squashing, migrations, onboarding, P2, done]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-04]]", "[[../../conventions/baseline-squashing]]"]
---

# REL-05: Schema Baseline Squashing — squash-baseline.js + arquivamento + onboarding rápido

## Objetivo
Consolidar 100+ migrations em 1 baseline `_baseline_v{N}.sql` quando o histórico atinge threshold; arquivar originals em `supabase/migrations/archived/`; novos clientes começam da baseline mais recente (onboarding ~30 min → segundos); tenants existentes seguem aplicando incremental sem disrupção.

## Acceptance Criteria

- [x] **AC1 — Script `scripts/squash-baseline.js`** ✅
  - `--up-to {timestamp}`, `--auto`, `--threshold`, `--dry-run`, `--version`, `--output`
  - DDL extraction com filtro DML; marcador `-- @include-in-baseline` para seeds críticos
  - Warning detection: W001–W005 (gen_random_uuid, now, DROP TABLE, DROP DATABASE, GUC)
  - Output: `_baseline_vN.candidate.sql` + `docs/smart-memory/ops/baseline-vN-report-{date}.md`

- [x] **AC2 — Approve workflow `.github/workflows/baseline-approve.yml`** ✅
  - Trigger: label `baseline-squash-approved` em PR
  - Steps: detect candidate → dry-run psql → rename → archive originals → INSERT adm_releases → commit + push → comment PR

- [ ] **AC3 — Onboarding novos clientes** ⏳ (dev-beta — adm-sync-client adjust)
  - Lógica `current_version IS NULL` → aplica baseline + delta

- [ ] **AC4 — Compatibilidade tenants existentes** ⏳ (dev-beta — adm-sync-client + min_compat_from)

- [x] **AC5 — Política automática: cron `adm-baseline-check`** ✅ (parte DB)
  - Migration `20260725330000_adm_releases_is_baseline.sql`: flag `is_baseline` + cron sábados 5h UTC
  - Edge fn `adm-baseline-check` → dev-beta (notificação super-admin)

- [x] **AC6 — Restore workflow `.github/workflows/baseline-restore.yml`** ✅
  - Trigger: `workflow_dispatch` manual
  - Inputs: `baseline_version`, `apply` (dry-run default), `target_db_url`
  - Steps: detect → install psql → dry-run → resolve DB URL → apply (se apply=true) → delta migrations → smoke-test → summary

- [x] **AC7 — Documentação** ✅
  - `docs/smart-memory/conventions/baseline-squashing.md` — protocolo completo, checklist, warnings, rollback, seeds críticos

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) |
| Iniciado | 2026-07-25 |
| Concluído (parte DB) | 2026-07-25 |
| Branch | feature/04-terminologia-referral |

## File List

### Criados por Bythak (DB + scripts + workflows + docs)
- `scripts/squash-baseline.js` — AC1 — script principal de squash
- `.github/workflows/baseline-approve.yml` — AC2 — workflow de aprovação
- `.github/workflows/baseline-restore.yml` — AC6 — workflow de restauração
- `supabase/migrations_adm/20260725330000_adm_releases_is_baseline.sql` — AC5 DB — is_baseline flag + cron
- `supabase/migrations_adm/rollbacks/20260725330000_adm_releases_is_baseline.rollback.sql`
- `docs/smart-memory/conventions/baseline-squashing.md` — AC7 — documentação

### Pendente (dev-beta)
- Edge fn `supabase/functions/adm-baseline-check/` — AC5 edge fn — notificação super-admin
- `adm-sync-client` adjusts para AC3 e AC4

## QA Results
<!-- Axikar preenche ao revisar -->

## Dependências

- **Blocked by:** REL-01 ✅, REL-04 ✅
- **Idealmente após:** REL-03 ✅ (drift detection valida baseline)
- **Pendente dev-beta:** AC3, AC4, AC5 edge fn
