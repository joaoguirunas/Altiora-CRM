---
title: Release Pipeline V1 — Convenções e Fluxo Operacional
type: convention
agent: dev-devops
created: 2026-07-25
updated: 2026-07-25
tags: [release, pipeline, devops, ci, migrations, multi-tenant, sync]
related: ["[[../decisions/ADR-REL-01-release-pipeline]]", "[[migrations-discipline]]", "[[baseline-squashing]]"]
---

# Release Pipeline V1 — Convenções e Fluxo Operacional

> **Implementado em:** REL-01, REL-04, REL-05 (v4.72, 2026-07-25)
> **Breaking change:** sync automático de tenants removido — leia a seção [Tenant Sync](#tenant-sync-opt-in) antes de operar.

## Visão Geral

O Release Pipeline V1 estabelece **releases versionadas e atômicas**: cada conjunto de migrations que chega em `main` gera um `release.json` com versão semântica, tag git correspondente e registro no control plane. Tenants são atualizados de forma explícita e auditada — não mais automaticamente.

```
Developer → git push main
                │
                ├─ Vercel: deploya frontend automaticamente
                │
                └─ GitHub Actions:
                     ├─ release-tag.yml      → release.json + tag release-v{N}
                     │   └─ adm-releases-register → INSERT em adm_releases
                     │
                     ├─ lint-migrations.yml  → MIG001-MIG009 gate (PRs)
                     └─ migrations-dry-run.yml → BEGIN…ROLLBACK (PRs)

Operador → ADM UI
                │
                ├─ Vê badge "N versões atrás" por cliente
                └─ Clica "Atualizar" → adm-sync-client edge fn
                     └─ INSERT em adm_client_versions (audit trail)
```

---

## Arquivos do Pipeline

| Arquivo | Propósito |
|---|---|
| `release.json` | Snapshot da release atual (raiz do repo) |
| `version.json` | Fonte de versão semântica — bumped pelo CI |
| `.github/workflows/release-tag.yml` | Auto-tag ao push em main com migrations |
| `.github/workflows/lint-migrations.yml` | CI gate de qualidade em PRs |
| `.github/workflows/migrations-dry-run.yml` | Dry-run sintático em PRs |
| `.github/workflows/sync-clients.yml` | **Manual only** — force-sync de emergência |
| `.github/workflows/baseline-approve.yml` | Aprova squash de baseline (REL-05) |
| `.github/workflows/baseline-restore.yml` | Restaura baseline em emergência (REL-05) |
| `scripts/sync-clients.js` | Script invocado pelo workflow manual |
| `scripts/squash-baseline.js` | Gera candidato de baseline (REL-05) |
| `scripts/lint-migrations.js` | Lint de migrations (MIG001-MIG009) |
| `supabase/functions/adm-releases-register/` | Edge fn — registra release em adm_releases |
| `supabase/migrations_adm/20260725300000_adm_client_drift.sql` | Schema drift detection |

---

## Schema de release.json

```json
{
  "version": "4.72",
  "major": 4,
  "minor": 72,
  "created_at": "2026-07-25T10:00:00.000Z",
  "git_sha": "abc1234",
  "migrations": [
    "supabase/migrations/20260725250000_fix_legacy_cron_urls.sql",
    "supabase/migrations/20260725260000_drop_rbac_granular.sql"
  ],
  "min_compat_from": "1.0",
  "changelog": "feat: migrations wave3|fix: legacy cron urls"
}
```

**Campos:**

| Campo | Descrição |
|---|---|
| `version` | `{major}.{minor}` — bumped automaticamente pelo CI a cada release |
| `min_compat_from` | Versão mínima de origem para aplicar este release sem squash intermediário |
| `migrations` | Lista de migration files incluídos nesta release (relativo à raiz) |
| `changelog` | Commits desde a release anterior, pipe-separated (exclu `[skip ci]`) |

---

## Versão Semântica

**`version.json`** é a fonte de verdade. O CI bumpa `minor` a cada release:

```
4.71 → (merge com migrations) → 4.72 → 4.73 → ...
```

**`major`** é bumped manualmente quando há baseline squash (REL-05): v4.x → v5.0.

**`min_compat_from`**: default `"1.0"`. Quando REL-05 gerar `_baseline_v5.0.sql`, releases v5.x terão `min_compat_from: "5.0"`. Tentar aplicar v5.1 num tenant em v4.x → aviso "precisa baseline primeiro".

---

## Tenant Sync (opt-in)

> ⚠️ **BREAKING CHANGE desde v4.72.**

### Fluxo antigo (< v4.72) — REMOVIDO

```
push main → sync-clients.yml dispara → TODOS os tenants recebem migrations silenciosamente
```

### Fluxo atual (≥ v4.72)

```
push main → release-tag.yml → release.json + adm_releases
          ↓
ADM UI (REL-02) — operador vê badge "N versões atrás"
          ↓
Clique "Atualizar" → adm-sync-client → adm_client_versions (audit)
```

### Por que opt-in?

1. **Controle de janela de deploy**: operador escolhe quando cada cliente recebe migrations (horário de baixo uso, pós-backup, etc).
2. **Audit trail**: `adm_client_versions` registra cada tentativa com `from_version`, `to_version`, `status`, `error_summary`.
3. **Target version**: operador pode aplicar release específica (não necessariamente a última) via `target_version`.
4. **Rollback granular**: com `adm_releases` e `min_compat_from`, futuro REL-03 pode detectar drift e REL-05 pode fazer squash seguro.

---

## Force-Sync Manual (emergência)

Use o workflow manual **apenas** quando:
- ADM UI (REL-02) não estiver disponível
- Incidente P1 que requer sync imediato de todos os tenants
- Operação de manutenção autorizada por super-admin

```
GitHub Actions → "Sync Clients — Manual (super-admin)" → Run workflow
```

**Inputs obrigatórios:**

| Input | Descrição | Default |
|---|---|---|
| `client_slug` | Slug do cliente alvo | vazio = todos |
| `target_version` | Versão a aplicar (ex: `4.72`) | vazio = última |
| `deploy_functions` | Deploy de edge fns também? | `true` |
| `reason` | **Obrigatório** — motivo para audit (ex: "Incidente P1 hotfix") | — |

O `reason` é passado ao `adm-sync-client` e registrado em `adm_client_versions.error_summary` ou nos logs do control plane para rastreabilidade futura.

---

## CI Gates em PRs com Migrations

### lint-migrations.yml

Verifica qualidade de cada migration alterada. **Bloqueia merge** se houver erros.

Regras:

| Code | Regra | Severidade |
|---|---|---|
| MIG001 | Timestamp 14-dígitos no nome | Error |
| MIG002 | `CREATE TABLE IF NOT EXISTS` | Error |
| MIG003 | `CREATE INDEX IF NOT EXISTS` | Error |
| MIG004 | `ADD COLUMN IF NOT EXISTS` | Error |
| MIG005 | `DROP TABLE` requer `-- @allow-destructive` | Error |
| MIG006 | Rollback file obrigatório | Error |
| MIG007 | Arquivo > 500 linhas | Warning |
| MIG008 | `CREATE FUNCTION OR REPLACE` | Warning |
| MIG009 | Migration no manifest | Error (em CI) |

Para exceções justificadas:
```sql
-- @lint-skip MIG002 reason: seed data, CREATE TABLE sem IF NOT EXISTS é intencional
-- @no-rollback reason: data migration one-way, rollback via backup
-- @allow-destructive reason: cleanup de tabela legada aprovado em ADR-XX
```

### migrations-dry-run.yml

Aplica cada migration em `BEGIN…ROLLBACK` em Postgres 15 local. Captura erros de sintaxe e referências inválidas.

> ⚠️ **Limitação:** Postgres local não equivale 100% à produção Supabase (sem extensões específicas, RLS overrides, pg_net, vault). Upgrade futuro: Supabase Branching API quando estiver GA.

---

## Rollback de Migration

1. Cada migration deve ter rollback file em `supabase/migrations/rollbacks/{ts}_{name}.rollback.sql`
2. Header obrigatório:
   ```sql
   -- Rollback for: {original_filename}
   -- Tested-against: pg15
   ```
3. Rollback deve usar `IF EXISTS` e `DROP … CASCADE` — nunca falhar em double-apply.
4. Verificação automática pelo `migrations-dry-run.yml` em cada PR.

Ver detalhes em: [[migrations-discipline]]

---

## Baseline Squashing (REL-05)

Quando migrations acumularem > ~200 arquivos, gerar baseline:

```bash
node scripts/squash-baseline.js --output _baseline_v5.candidate.sql
```

Abre PR com o arquivo candidato. Adicionar label `baseline-squash-approved` no PR → `baseline-approve.yml` executa dry-run, arquiva migrations originais, registra `is_baseline=true` em `adm_releases`.

Ver detalhes em: [[baseline-squashing]]

---

## adm_releases — Tabela de Releases

```sql
adm_releases (
  id             uuid PK,
  version        text UNIQUE,     -- "4.72"
  git_sha        text,            -- short SHA
  migrations     jsonb,           -- array de filenames
  min_compat_from text,           -- "1.0" default
  changelog      text,            -- pipe-separated commit messages
  is_baseline    boolean,         -- true se foi gerado por squash
  status         text,            -- 'released' | 'draft'
  created_at     timestamptz
)
```

## adm_client_versions — Audit Trail

```sql
adm_client_versions (
  id             uuid PK,
  client_id      uuid FK adm_clients,
  from_version   text,
  to_version     text,
  applied_at     timestamptz,
  applied_by     uuid FK auth.users,
  status         text CHECK (status IN ('success', 'failed', 'partial')),
  error_summary  text,
  sync_job_id    uuid
)
```

Toda tentativa de sync — sucesso, falha ou parcial — gera um registro. Isso permite rastrear histórico completo de aplicação por cliente.
