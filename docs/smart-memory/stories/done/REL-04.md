---
title: "REL-04: Migration Discipline — lint-migrations.js + CI block + dry-run em snapshot"
type: story
status: done
epic: release-pipeline-v1
priority: P1
complexity: M
agent: dev-devops + dev-data-engineer
created: 2026-04-24
updated: 2026-07-25
tags: [story, release, lint, ci, discipline, migrations, P1]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-03]]"]
---

# REL-04: Migration Discipline — lint-migrations.js + CI block + dry-run em snapshot

## Objetivo
Enforce padrões obrigatórios em migrations via lint script + CI gate; cada migration nova precisa rollback file correspondente; DDL crítico precisa `IF NOT EXISTS`; PRs com migrations passam por dry-run em DB clone antes de marcar release como ready.

## Acceptance Criteria

- [ ] **AC1 — Script `scripts/lint-migrations.js`:**
  - Input: paths de migrations modificadas/adicionadas no PR (ou todas se `--all`).
  - Regras (cada uma com error code + descrição clara):
    - `MIG001`: filename precisa ter timestamp ISO `\d{14}_` no início.
    - `MIG002`: `CREATE TABLE` sem `IF NOT EXISTS` → erro (a menos que header tem `-- @lint-skip MIG002`).
    - `MIG003`: `CREATE INDEX` sem `IF NOT EXISTS` → erro.
    - `MIG004`: `ALTER TABLE ... ADD COLUMN` sem `IF NOT EXISTS` → erro.
    - `MIG005`: `DROP TABLE` sem header `-- @allow-destructive` → erro.
    - `MIG006`: rollback file existe em `supabase/migrations/rollbacks/{same-name}.rollback.sql` → erro se ausente (a menos que `-- @no-rollback` com justificativa).
    - `MIG007`: arquivo > 500 linhas → warning (sugere split).
    - `MIG008`: `CREATE FUNCTION` sem `OR REPLACE` → warning.
  - Output: tabela formatada (filename, line, code, message). Exit 1 se algum erro.
  - Comments suportados: `-- @lint-skip MIG002 reason: ...` no início do arquivo (whitelist por regra).
  - Idempotente, executável local (`node scripts/lint-migrations.js --all`) ou em CI (`--changed-only`).

- [ ] **AC2 — GitHub Action `lint-migrations.yml`:**
  - Trigger: `pull_request` em paths `supabase/migrations/**` ou `supabase/migrations_adm/**`.
  - Steps:
    1. Detect changed migrations files vs base branch.
    2. Run `node scripts/lint-migrations.js --changed-only`.
    3. Se erro: post comment no PR com summary.
    4. Block merge via required check.

- [ ] **AC3 — Dry-run job:**
  - Trigger: `pull_request` quando migration mudada **OR** label `migration-heavy` aplicado.
  - Steps:
    1. Spin up Supabase branch (Supabase Branching API).
    2. Apply current main schema.
    3. Apply PR migrations.
    4. Verify success + rollback (apply rollback file, verify schema reverte).
    5. Report results no PR comment.
  - Se Supabase Branching não disponível: fallback simplified — rodar migrations + rollbacks em **local Postgres em container** dentro do GitHub runner. Documentar limitação.

- [ ] **AC4 — Rollback file convenção:**
  - Estrutura: `supabase/migrations/rollbacks/{ts}_{name}.rollback.sql`.
  - Conteúdo: SQL que REVERTE o que `{ts}_{name}.sql` faz (ex: se main faz `CREATE TABLE foo`, rollback faz `DROP TABLE IF EXISTS foo`).
  - Header obrigatório: `-- Rollback for: {original_filename}` + `-- Tested-against: {pg_version}`.
  - Exemplo template em `supabase/migrations/rollbacks/_TEMPLATE.sql`.

- [ ] **AC5 — Documentação:**
  - `docs/smart-memory/conventions/migrations-discipline.md` (NEW): explica regras, exemplos OK/NOT OK, como rodar lint local, como adicionar `--lint-skip` justificado.
  - Atualizar `docs/smart-memory/project/conventions.md` (já existe per overview) com link.
  - Templates: `_TEMPLATE.sql` para novas migrations + `_TEMPLATE.rollback.sql` para rollbacks.

- [ ] **AC6 — Backfill (one-time pass):**
  - Rodar lint em **TODAS** migrations existentes (`--all`).
  - Aceitar que muitas vão falhar (trabalho histórico). NÃO bloquear retroativamente.
  - Gerar relatório `docs/smart-memory/ops/migrations-lint-baseline-{date}.md` com count por error code — base para tracking de débito.
  - PRs futuros (após merge desta story) seguem disciplina; backlog historico fica como tech debt.

- [ ] **AC7 — Pre-commit hook (opcional, devops decide):**
  - `.husky/pre-commit` ou `.git/hooks/pre-commit` que roda lint em migrations staged.
  - Failure local previne commit ruim antes mesmo de PR.
  - Documentar em `CONTRIBUTING.md`.

## Escopo

**IN:**
- `scripts/lint-migrations.js` (NEW).
- `.github/workflows/lint-migrations.yml` (NEW).
- `.github/workflows/migrations-dry-run.yml` (NEW — Supabase branching ou container fallback).
- `supabase/migrations/rollbacks/_TEMPLATE.sql` (NEW).
- `supabase/migrations/_TEMPLATE.sql` (NEW).
- `docs/smart-memory/conventions/migrations-discipline.md` (NEW).
- `docs/smart-memory/ops/migrations-lint-baseline-{date}.md` (NEW — backfill report).
- README/CONTRIBUTING update se aplicável.

**OUT:**
- Refactor retroativo de migrations existentes (apenas baseline report; correção é tech debt).
- Lint de schema produção (ex: validar que tabelas em prod batem com migrations) — escopo de REL-03.
- Auto-fix lint errors (ex: `--fix` flag) — fora de escopo MVP.

## Contexto Técnico

**Por que `IF NOT EXISTS` obrigatório:** REL-03 Repair button depende de re-aplicação idempotente. Migration sem `IF NOT EXISTS` quebra na 2ª aplicação.

**Por que rollback obrigatório:** rollback granular (REL-V3 futuro) precisa de rollbacks reais. Hoje devs frequentemente esquecem; lint força disciplina.

**Por que dry-run em snapshot:** atualmente sync vai direto para tenant em produção. Erro detectado em produção = downtime / drift. Dry-run captura erros estruturais antes (sintaxe SQL inválida, referência a tabela inexistente, etc).

**Supabase Branching status:** em beta no momento da escrita. Verificar disponibilidade. Fallback container (postgres oficial Docker image) é acceptable MVP — não é production-equivalent (sem RLS overrides, sem extensions Supabase) mas captura sintax errors + ordem de dependência.

**Lint regra MIG006 (rollback obrigatório) é a mais polêmica:** alguns devs argumentam "rollback para migration de seed é trivial". OK — `-- @no-rollback reason: data seed only` no header skipa a rule. Documentar bem.

**Backfill (AC6):** baseline report ESTABELECE divida histórica. Não força reescrita de 700+ migrations. Tech debt visível, sem disrupção.

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) — AC1, AC5 (MIG009), AC6 |
| Iniciado | 2026-07-25 |
| Concluído (script + manifest + backfill) | 2026-07-25 |
| Branch | feature/04-terminologia-referral |
| ACs pendentes | AC2 (lint-migrations.yml — dev-devops), AC3 (dry-run workflow — dev-devops), AC7 (pre-commit — dev-devops opcional) |

## Acceptance Criteria — Status

- [x] **AC1** — `scripts/lint-migrations.js` com MIG001-MIG009 ✅
  - MIG001: timestamp prefix
  - MIG002: CREATE TABLE sem IF NOT EXISTS
  - MIG003: CREATE INDEX sem IF NOT EXISTS
  - MIG004: ADD COLUMN sem IF NOT EXISTS
  - MIG005: DROP TABLE sem @allow-destructive
  - MIG006: rollback ausente
  - MIG007: arquivo > 500 linhas (warning)
  - MIG008: CREATE FUNCTION sem OR REPLACE (warning)
  - MIG009: migration não em migrations-manifest.json (só em --changed-only) ← **NOVO (AC5)**
- [x] **AC2** — `lint-migrations.yml` GitHub Action ✅ (dev-devops — 200 linhas)
- [x] **AC3** — `migrations-dry-run.yml` ✅ (dev-devops — 315 linhas)
- [x] **AC4** — Rollback file convention + templates ✅ (existem em supabase/migrations/rollbacks/)
- [x] **AC5** — `migrations-manifest.json` integration via MIG009 em `lint-migrations.js` ✅
- [x] **AC6** — Backfill report ✅
  - `docs/smart-memory/ops/migrations-lint-baseline-2026-07-25.md`
  - 902 arquivos · 1.801 erros · 21 warnings
  - Top: MIG006 (822), MIG003 (295), MIG002 (214)
- [ ] **AC7** — Pre-commit hook (opcional) — dev-devops ⏳

## File List

### Criados/modificados por Bythak
- `scripts/lint-migrations.js` — AC1+AC5 — MIG009 adicionado + getManifestSet() helper
- `docs/smart-memory/ops/migrations-lint-baseline-2026-07-25.md` — AC6 — backfill report

### Pendente (dev-devops — AC2 + AC3)
- `.github/workflows/lint-migrations.yml`
- `.github/workflows/migrations-dry-run.yml`

## QA Results

```
VEREDICTO (v1): FAIL — 2026-07-25 (anterior, superado pela resubmissão)
VEREDICTO (v2): PASS — 2026-07-25 (AC1-AC6 completos)

Story: REL-04 | Data: 2026-07-25 (revisão v2 — AC1-AC6 completos)
AC7 pre-commit hook: opcional, dev-devops decide. Não bloqueia.

AC1 ✅  scripts/lint-migrations.js com MIG001-MIG009 confirmado.
        MIG001: timestamp 14-dígitos ✅
        MIG002: CREATE TABLE sem IF NOT EXISTS ✅
        MIG003: CREATE INDEX sem IF NOT EXISTS ✅
        MIG004: ADD COLUMN sem IF NOT EXISTS ✅
        MIG005: DROP TABLE sem @allow-destructive ✅
        MIG006: rollback ausente ✅
        MIG007: arquivo >500 linhas (warning) ✅
        MIG008: CREATE FUNCTION sem OR REPLACE (warning) ✅
        MIG009 (AC5): migration não em migrations-manifest.json ✅
                      getManifestSet() helper + skip em --all mode. ✅
        @lint-skip por arquivo suportado. ✅

AC2 ✅  .github/workflows/lint-migrations.yml confirmado (~200 linhas).
        Trigger: pull_request paths:supabase/migrations/** e migrations_adm/**. ✅
        Steps: detecta changed files → node scripts/lint-migrations.js. ✅
        Posta comentário no PR com summary. ✅
        exit 1 se erros → bloqueia merge (required check). ✅

AC3 ✅  .github/workflows/migrations-dry-run.yml confirmado (~315 linhas).
        Trigger: pull_request + label "migration-heavy". ✅
        Condition: action != labeled OR label.name == migration-heavy. ✅
        Postgres 15 container em serviço (sem credenciais externas). ✅
        Forward dry-run: BEGIN...ROLLBACK por migration (verifica sintaxe sem alterar estado). ✅
        Rollback dry-run: aplica .rollback.sql correspondente. ✅
        PR comment com resultados detalhados. ✅
        Limitação documentada: "sem extensões Supabase (vault, pg_net, pg_cron)"
          → migrations que usam cron.* podem falhar no dry-run container.
          Aceitável per spec ("fallback MVP container"). ✅

AC4 ✅  Rollback file convention + templates: _TEMPLATE.sql + _TEMPLATE.rollback.sql
        existem em supabase/migrations/rollbacks/. ✅ (confirmado em rodada anterior)
        Header obrigatório com "-- Rollback for:" + "-- Tested-against:". ✅

AC5 ✅  MIG009 integrado em lint-migrations.js (getManifestSet helper). ✅
        docs/smart-memory/conventions/migrations-discipline.md EXISTS. ✅
        (confirmado em rodada anterior)

AC6 ✅  docs/smart-memory/ops/migrations-lint-baseline-2026-07-25.md confirmado:
        902 arquivos analisados. 1.801 erros. 21 warnings.
        Top: MIG006 (822 — rollback ausente), MIG003 (295), MIG002 (214). ✅
        Tabela de priorização de débito (P1/P2/P3). ✅
        Baseline NÃO bloqueia retroativamente — apenas tracking de débito. ✅

AC7: opcional — dev-devops decide. Não bloqueia gate.

[INFO] Extensões Supabase (cron.*, vault, pg_net) causarão fail no dry-run container
       Postgres 15. Documentado como limitação aceita. Upgrade para Supabase Branching
       quando GA eliminará esse gap.

Próximo passo: @dev-devops push
```

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO — 7 ACs com error codes específicos |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (M) | GO — script + 2 workflows + docs |
| 5 | Alinhamento com arquitetura atual | GO — adiciona disciplina sem quebrar fluxo |

**Veredicto:** GO (5/5).

## Dependências

- **Blocked by:** nenhum (foundational, pode ir paralelo a REL-01).
- **Recomendado fazer ANTES de REL-03:** Repair button funciona melhor com migrations idempotentes garantidas pelo lint.
- **Coordena com:** devops (workflows + CI integration) + data-engineer (regras SQL + templates).
