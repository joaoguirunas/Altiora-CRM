---
title: "REL-05: Schema Baseline Squashing — squash-baseline.js + arquivamento + onboarding rápido"
type: story
status: backlog
epic: release-pipeline-v1
priority: P2
complexity: M
agent: dev-data-engineer
created: 2026-04-24
updated: 2026-04-24
tags: [story, release, baseline, squashing, migrations, onboarding, P2]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-04]]"]
---

# REL-05: Schema Baseline Squashing — squash-baseline.js + arquivamento + onboarding rápido

## Objetivo
Consolidar 100+ migrations em 1 baseline `_baseline_v{N}.sql` quando o histórico atinge threshold; arquivar originals em `supabase/migrations/archived/`; novos clientes começam da baseline mais recente (onboarding ~30 min → segundos); tenants existentes seguem aplicando incremental sem disrupção.

## Acceptance Criteria

- [ ] **AC1 — Script `scripts/squash-baseline.js`:**
  - Input: `--up-to {timestamp}` (último arquivo a incluir no squash) ou `--auto` (detecta threshold).
  - Algoritmo:
    1. Lê todas migrations em `supabase/migrations/` ordenadas por timestamp.
    2. Para cada migration: extrai DDL (filtra DML como inserts seed, mantendo seeds críticos no baseline final).
    3. Concatena na ordem cronológica em `supabase/migrations/_baseline_v{N}.sql`.
    4. Header do baseline: `-- BASELINE v{N} generated 2026-04-24 — squashed {count} migrations from {first_ts} to {last_ts}`.
    5. **NÃO move originals automaticamente** — apenas gera baseline candidate.
  - Output: `supabase/migrations/_baseline_v{N}.candidate.sql` + relatório `docs/smart-memory/ops/baseline-v{N}-report.md` com: count squashed, tabelas afetadas, warnings (ex: "DROP TABLE detected — verifique").

- [ ] **AC2 — Approve workflow:**
  - Após gerar candidate, super-admin abre PR com label `baseline-squash-approved`.
  - Workflow `.github/workflows/baseline-approve.yml` aciona em label:
    1. Verifica que candidate file existe.
    2. Roda dry-run em snapshot (REL-04 dry-run reutilizado).
    3. Se OK: rename `_baseline_v{N}.candidate.sql` → `_baseline_v{N}.sql`.
    4. Move originals para `supabase/migrations/archived/v{N}/`.
    5. Update `client-migrations.json` para refletir nova baseline.
    6. INSERT entry em `adm_releases` com flag `is_baseline: true`.
    7. Bump release version (REL-01).

- [ ] **AC3 — Onboarding novos clientes:**
  - `adm-sync-client` edge fn (REL-01 refactor) já aceita `target_version`.
  - Nova lógica: se `current_version IS NULL` (cliente nunca sincronizado), aplica baseline mais recente FIRST + migrations posteriores ao baseline.
  - Smoke test: criar cliente novo, sincronizar — deve aplicar `_baseline_v{N}.sql` + N migrations posteriores apenas, NÃO 700+ originais.

- [ ] **AC4 — Compatibilidade com tenants existentes:**
  - Tenants com `current_version >= baseline.created_for_version` continuam aplicando incremental.
  - Tenants com `current_version < baseline.created_for_version` (caso raro de tenant muito atrás): aviso "Baseline gap detected — recomenda-se re-aplicar do zero" + opção manual no ADM (out-of-scope desta story; documentar como edge case).
  - `min_compat_from` em `release.json` (REL-01) marca compat: baseline v3.0 tem `min_compat_from: '1.0'`; releases v3.x posteriores tem `min_compat_from: '3.0'`.

- [ ] **AC5 — Política automática:**
  - Cron edge fn `adm-baseline-check` (1×/semana, sábado): conta migrations ativas (não-archived) — se > 100, dispara notificação ao super-admin (audit log + opcional email).
  - **NÃO auto-aplica squash** — sempre requer aprovação humana via PR (AC2).

- [ ] **AC6 — Reverter arquivamento (rollback):**
  - Caso baseline gere problema descoberto após merge: workflow `baseline-restore.yml` move `archived/v{N}/*` de volta para `migrations/`, deleta `_baseline_v{N}.sql`, reverte `client-migrations.json`.
  - Trigger: PR com label `baseline-revert-{N}`.
  - Limita a 1 baseline reverted por vez (sanidade).

- [ ] **AC7 — Documentação:**
  - `docs/smart-memory/conventions/baseline-squashing.md` (NEW): explica quando/como/quem aprova; exemplos de baseline gerado; troubleshooting.
  - Update `README.md` com seção "Schema baselines" curta + link para a doc.

## Escopo

**IN:**
- `scripts/squash-baseline.js` (NEW).
- `.github/workflows/baseline-approve.yml` (NEW).
- `.github/workflows/baseline-restore.yml` (NEW).
- Edge fn `adm-baseline-check` (NEW — cron weekly).
- Migration `migrations_adm/` para flag `is_baseline boolean DEFAULT false` em `adm_releases` table (REL-01).
- Edge fn `adm-sync-client` adjust para AC3 (logic para `current_version IS NULL`).
- `docs/smart-memory/conventions/baseline-squashing.md` (NEW).
- README update.

**OUT:**
- Auto-apply squash sem revisão humana — proibido.
- Múltiplos baselines simultâneos — sempre 1 ativo.
- Migration de DML/data — script foca em DDL (data fica nas migrations originais para tenants existentes; novos clientes herdam apenas schema, depois rodam seeds via app bootstrap).
- Compaction de archived/ — arquivos lá ficam para sempre (~1KB cada × 1000 = 1MB, irrelevante).

## Contexto Técnico

**Por que threshold 100:** arbitrário mas razoável — 100 migrations × ~15s/aplicação = ~25 min onboarding. Inaceitável para novos tenants. Threshold tunable via `--threshold N` no script.

**Por que squash NÃO automático:** alto risco. Bug no script de extração DDL = baseline corrupto = todos novos clientes nascem broken. Aprovação humana em PR + dry-run + capability de revert = 3 camadas de segurança.

**`is_baseline` flag em `adm_releases`:** UI pode distinguir baseline release (consolidação histórica) vs feature release (novos changes). Útil para changelog em REL-02 modal.

**Migrations originals movidas para `archived/`:** preserva audit trail Git. `git log supabase/migrations/archived/v3/` mostra histórico completo. **NUNCA deletar.**

**Risco de DDL não-deterministic:** algumas migrations geram secrets (random keys), timestamps, etc. Squash script deve detectar (`gen_random_uuid()`, `now()`, `NEW UUID generation patterns`) e marcar warning para revisão. Exemplos críticos: setup de extensions com chaves aleatórias.

**Riscos arqueológicos:** migrations antigas frequentemente fazem ALTERs em ordem específica (`ALTER TABLE foo ADD COLUMN bar` em ts1, `UPDATE foo SET bar = ...` em ts2, `ALTER TABLE foo ALTER COLUMN bar SET NOT NULL` em ts3). Squashing precisa preservar ordem ou reescrever para `CREATE TABLE foo (..., bar text NOT NULL)`. Script tenta detectar e reescreve quando trivial; warning quando complexo.

**Ordem de implementação dentro do épico:** **última** (REL-05). Depende de REL-01 (release model), REL-04 (lint para garantir que migrations futuras sejam squash-friendly), idealmente REL-03 (drift) para confirmar que baseline v{N} bate com prod nos tenants atualizados antes de adotar como onboarding default.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/rel-05-baseline-squashing |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO — 7 ACs |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (M) | GO — script + 2 workflows + edge fn cron + adjusts |
| 5 | Alinhamento com arquitetura atual | GO — extends release model sem quebrar |

**Veredicto:** GO (5/5) com nota: AC1 (squash algoritmo) tem complexidade real em DDL não-deterministic. Story instrui script a marcar warnings + super-admin revisar — NÃO trust automation 100%.

## Dependências

- **Blocked by:** REL-01 (release model + `adm_releases.is_baseline` flag), REL-04 (lint discipline para migrations futuras serem squash-friendly).
- **Idealmente após:** REL-03 (drift detection valida que baseline reflete schema real dos tenants atualizados).
- **Owner:** data-engineer único (script SQL-heavy + edge fn).
