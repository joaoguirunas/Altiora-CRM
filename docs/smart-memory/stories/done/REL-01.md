---
title: "REL-01: Versioned Releases — release.json + adm_client_versions audit + GH Action"
type: story
status: done
epic: release-pipeline-v1
priority: P1
complexity: M
agent: dev-data-engineer + dev-devops
created: 2026-04-24
updated: 2026-07-25
tags: [story, release, versioning, control-plane, github-actions, P1]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-02]]", "[[REL-03]]"]
---

# REL-01: Versioned Releases — release.json + adm_client_versions audit + GH Action

## Objetivo
Estabelecer modelo de release atômica versionada: cada PR mergado em main com migrations gera `release.json` agregado (lista de migrations dessa versão) e tag git `release-v{N}`; control plane registra catálogo de releases em `adm_releases`; cada tenant rastreia `current_version` + `target_version`; `adm_client_versions` arquiva trail de aplicações.

## Acceptance Criteria

- [ ] **AC1 — Schema `release.json` na raiz do repo:**
  ```json
  {
    "version": "2.00",
    "major": 2, "minor": 0,
    "created_at": "2026-04-24T05:30:00.000Z",
    "git_sha": "abc1234",
    "migrations": [
      "20260424050000_add_mfa_recovery_codes.sql",
      "20260424051000_add_mfa_grace_until.sql"
    ],
    "min_compat_from": "1.50",
    "changelog": "AUTH-V2-03a: MFA backend\nAUTH-V2-03b: MFA UI"
  }
  ```
  - `min_compat_from`: versão mínima de origem que pode aplicar este release sem squashing intermediário (default: ultima baseline).
  - `changelog`: extraído de PR title/body via GH API (lib/regex no script).

- [ ] **AC2 — GitHub Action `release-tag.yml`:**
  - Trigger: `push: branches: [main]` com paths em `supabase/migrations/**`.
  - Steps:
    1. Lê migrations novas (diff vs último tag `release-v*`).
    2. Bumpa `version.json` (já existe).
    3. Gera `release.json` com lista de migrations + changelog.
    4. Commit `release.json` + tag `release-v{version}` + push.
    5. POST para edge fn `adm-releases-register` (ver AC4).
  - Concurrency: `release-tag` group cancel-in-progress: false.

- [ ] **AC3 — Migrations no control plane:**
  - `migrations_adm/{ts}_adm_releases.sql`: tabela `adm_releases(id uuid PK, version text UNIQUE, git_sha text, migrations jsonb, min_compat_from text, changelog text, created_at timestamptz)`.
  - `migrations_adm/{ts}_adm_client_versions.sql`: tabela `adm_client_versions(id uuid PK, client_id uuid FK adm_clients, from_version text, to_version text, applied_at timestamptz, applied_by uuid FK auth.users, status text CHECK (status IN ('success', 'failed', 'partial')), error_summary text, sync_job_id uuid)` + index `(client_id, applied_at DESC)`.
  - `migrations_adm/{ts}_adm_clients_version_columns.sql`: `ALTER TABLE adm_clients ADD COLUMN current_version text, target_version text` (default null = nunca atualizado).
  - RLS: super-admin only (mesmo padrão de `adm_clients`).

- [ ] **AC4 — Edge fn `adm-releases-register`:**
  - POST authenticated com service_role.
  - Body: payload do `release.json`.
  - Action: INSERT em `adm_releases` (idempotente via `ON CONFLICT (version) DO NOTHING`).
  - Triggered: pelo CI no AC2 step 5.

- [ ] **AC5 — Atualização do `useAdmClients` hook:**
  - SELECT inclui `current_version`, `target_version`.
  - Novo hook `useAdmReleases()` lista as últimas 20 releases para UI consumir.
  - Tipos atualizados em `src/integrations/supabase/types.ts`.

- [ ] **AC6 — `adm-sync-client` edge fn (refactor):**
  - Aceita parâmetro opcional `target_version` no body.
  - Se ausente: usa última release.
  - Se presente: aplica apenas migrations dessa release (busca `release.migrations[]`).
  - Após sucesso: UPDATE `adm_clients.current_version`, INSERT `adm_client_versions` audit.

- [ ] **AC7 — Sync-clients.yml refactor:**
  - REMOVE auto-trigger em push para main.
  - **NÃO sincroniza tenants automaticamente** (mudança de comportamento — flag em CHANGELOG).
  - Mantém `workflow_dispatch` para casos manuais (super-admin force).
  - Dispatch deixa de ser default — **tenant updates passam a ser opt-in via UI** (REL-02).

- [ ] **AC8 — Documentação:**
  - README na raiz (ou CHANGELOG) explicando: "A partir de release v{N}, sync para tenants é opt-in via ADM UI. Push para main não dispara mais sync automaticamente."
  - Comentário inline em `sync-clients.yml` reforçando.

## Escopo

**IN:**
- 3 migrations em `migrations_adm/` (releases table + client_versions table + columns).
- Edge fn `adm-releases-register/index.ts`.
- Edge fn `adm-sync-client/index.ts` refactor (target_version opcional).
- GitHub Action `release-tag.yml` novo.
- `sync-clients.yml` refactor (remove auto-trigger).
- Hook `useAdmReleases` em `src/hooks/useAdmReleases.ts`.
- Tipos em `src/integrations/supabase/types.ts`.
- CHANGELOG/README.

**OUT:**
- UI de "Atualizar cliente" (REL-02).
- Drift detection (REL-03).
- Lint discipline (REL-04).
- Baseline squashing (REL-05).
- Backfill de `current_version` para tenants existentes — escopo pós-MVP (data migration separada; default null = "desconhecido", primeiro update via REL-02 popula).

## Contexto Técnico

**`min_compat_from` racional:** quando REL-05 squash gerar baseline `_baseline_v3.0.sql`, releases v3.x terão `min_compat_from: "3.0"`. Tentar aplicar v3.1 num tenant em v2.5 = avisar "precisa baseline primeiro". Sem squash ainda em REL-01, este campo apenas existe (default `"1.0"`).

**Mudança de comportamento (AC7) é breaking change operacional:** comunicar via PR description + CHANGELOG. Operadores precisam clicar "Atualizar" após cada release. Compensado por REL-02 com bulk button + visibilidade (badge "N versões atrás").

**Idempotência crítica:**
- `release.json` commit no CI: race condition possível se 2 PRs merge quase simultâneo. Concurrency group + `git pull --rebase` no CI antes do push.
- `adm-releases-register` com `ON CONFLICT DO NOTHING` evita dup.
- `adm_client_versions` registra cada tentativa (mesmo failed) — audit trail completo.

## Dev Agent Record

| Campo | Valor |
|---|---|
| Agente | dev-data-engineer (Bythak) — AC3 + AC4 |
| Iniciado | 2026-07-25 |
| Concluído (DB+edge fn) | 2026-07-25 |
| Branch | feature/04-terminologia-referral |
| ACs pendentes | AC2 (release-tag.yml — dev-devops), AC7 (sync-clients.yml — dev-devops), AC8 (docs) |
| Agente | dev-dev-beta (Rex) — AC5 + AC6 |
| Iniciado (AC5+AC6) | 2026-07-25 |
| Concluído (AC5+AC6) | 2026-07-25 |

## Acceptance Criteria — Status

- [x] **AC1** — `release.json` schema: já existe em repo (v4.69) com formato correto ✅
- [x] **AC2** — GitHub Action `release-tag.yml` ✅ (dev-devops — 246 linhas)
- [x] **AC3** — Migrations control plane ✅
  - `migrations_adm/20260424012000_adm_releases.sql` — tabela + RLS + service_role policy
  - `migrations_adm/20260424013000_adm_client_versions.sql` — tabela + índice + RLS
  - `migrations_adm/20260424014000_adm_clients_version_columns.sql` — current_version + target_version em adm_clients
- [x] **AC4** — Edge fn `adm-releases-register` ✅
  - `supabase/functions/adm-releases-register/index.ts`
  - Auth: service_role only (Bearer token match)
  - POST body: version, git_sha, migrations[], min_compat_from, changelog, is_baseline
  - Idempotente: ON CONFLICT (version) DO NOTHING → `{ ok: true, inserted: false }`
  - Audit log: insere em `adm_audit_log` (action: release.registered)
- [x] **AC5** — `useAdmReleases` hook ✅ (`src/hooks/useAdmReleases.ts` — `useAdmReleases()` + `useAdmReleasesBetween()`)
- [x] **AC6** — `adm-sync-client` edge fn (`supabase/functions/adm-sync-client/index.ts`) ✅ 2026-07-25
- [x] **AC7** — `sync-clients.yml` refactor ✅ (dev-devops — workflow_dispatch only, breaking change documentado)
- [x] **AC8** — Documentação ✅ (`CHANGELOG.md` — [4.72] entry com breaking change diagram)

## File List

### Criados por Bythak (AC3 + AC4)
- `supabase/migrations_adm/20260424012000_adm_releases.sql` — AC3a — adm_releases table
- `supabase/migrations_adm/20260424012000_adm_releases.rollback.sql`
- `supabase/migrations_adm/20260424013000_adm_client_versions.sql` — AC3b — adm_client_versions table
- `supabase/migrations_adm/20260424013000_adm_client_versions.rollback.sql`
- `supabase/migrations_adm/20260424014000_adm_clients_version_columns.sql` — AC3c — current_version + target_version
- `supabase/migrations_adm/20260424014000_adm_clients_version_columns.rollback.sql`
- `supabase/functions/adm-releases-register/index.ts` — AC4

### Criados/confirmados por Rex (AC5 + AC6)
- `src/hooks/useAdmReleases.ts` — AC5: `useAdmReleases()` + `useAdmReleasesBetween()` + `useLatestAdmRelease()`
- `supabase/functions/adm-sync-client/index.ts` — AC6: nova edge fn — resolve release, decripta credentials, filtra migrations tenant-side, fetch SQL do GitHub, aplica via Management API `/database/query`, audit em `adm_client_versions` + `adm_audit_log`

## QA Results

```
VEREDICTO (v1): FAIL — 2026-07-25 (anterior, superado)
VEREDICTO (v2): PASS — 2026-07-25 (AC2+AC3+AC4)
VEREDICTO (v3): PASS — 2026-07-25 (AC7 — sync-clients.yml + sync-clients.js)

Story: REL-01 | Data: 2026-07-25 (revisão v3 — AC7 acumulado a v2)
AC1 pré-existente. AC2+AC3+AC4 ✅ (v2). AC5/AC6 aguardam dev-beta. AC8 aguarda devops.

──── AC7 ────
AC7 ✅  .github/workflows/sync-clients.yml: workflow_dispatch ONLY — zero push trigger.
        BREAKING CHANGE documentada em header extenso (linhas 1-29 do arquivo):
          "A partir do REL-01, o sync automático de tenants foi REMOVIDO.
           Push para main NÃO dispara mais sync para clientes."
          Fluxo normal pós-REL-02 explicado passo a passo. ✅
        Inputs: client_slug (opt), target_version (opt), deploy_functions (opt),
          reason (REQUIRED — campo obrigatório para auditoria). ✅
        Validação extra: if reason vazio → exit 1 (além do required:true). ✅
        Audit log step no início: actor, datetime, target, target_version, reason. ✅
        TRIGGERED_BY passado como "manual:${{ github.actor }}". ✅
        SYNC_REASON passado de inputs.reason para sync-clients.js. ✅

        scripts/sync-clients.js:
          TARGET_VERSION (L48), TRIGGERED_BY (L50), SYNC_REASON (L51). ✅
          Todos 3 enviados no body do adm-sync-client (L113-115). ✅
          audit trail via console.log com reason+trigger (L214-218). ✅

        Tenant updates agora opt-in via UI (REL-02) — sync automático desabilitado. ✅

──── Status acumulado ────
AC1 ✅ (pré-existente) | AC2 ✅ | AC3 ✅ | AC4 ✅ | AC7 ✅
AC5 ✅ (useAdmReleases.ts) | AC6 ✅ (adm-sync-client/index.ts) | AC8 ⏳ dev-devops

Próximo passo: @dev-beta AC5 (useAdmReleases) + AC6 (adm-sync-client refactor).
               @dev-devops AC8 (CHANGELOG/README). Resubmeter para gate final.

Escopo desta revisão: AC2 (release-tag.yml) + AC3 (migrations control plane) + AC4 (edge fn)
AC1 pré-existente. AC5/AC6/AC7/AC8 aguardam dev-beta + dev-devops (fora deste gate).

AC2 ✅  .github/workflows/release-tag.yml confirmado (246 linhas).
        Trigger: push branches:[main] paths: supabase/migrations/**. ✅
        Concurrency: group:release-tag, cancel-in-progress:false. ✅
        Steps confirmados:
          1. Detecta migrations desde último tag release-v* (git tag --list 'release-v*'). ✅
          2. Bump version.json (major/minor/build). ✅
          3. Gera release.json (lista migrations + changelog do git log). ✅
          4. Commit + tag release-v{version} + push com [skip ci]. ✅
          5. POST para adm-releases-register com SUPABASE_SERVICE_ROLE secret. ✅
        Idempotência: [skip ci] previne loop; ON CONFLICT no endpoint. ✅

AC3 ✅  Três migrations em supabase/migrations_adm/:
        20260424012000_adm_releases.sql:
          CREATE TABLE IF NOT EXISTS adm_releases (id uuid PK, version text UNIQUE,
          git_sha, migrations jsonb, min_compat_from DEFAULT '1.0', changelog,
          created_at, created_by FK auth.users). ✅
          RLS: super_admin EXISTS check + service_role INSERT policy. ✅
          Rollback: 20260424012000_adm_releases.rollback.sql ✅
        20260424013000_adm_client_versions.sql: ✅ (+ rollback ✅)
        20260424014000_adm_clients_version_columns.sql: ✅ (+ rollback ✅)

AC4 ✅  supabase/functions/adm-releases-register/index.ts:
        Auth: Bearer token vs SUPABASE_SERVICE_KEY — service_role only. ✅
        POST method check (405 para outros métodos). ✅
        ReleasePayload interface: version, git_sha, migrations[], min_compat_from?,
          changelog?, is_baseline?. ✅
        Semver validation em L79. ✅
        INSERT em adm_releases ON CONFLICT (version) DO NOTHING → inserted:false. ✅
        adm_audit_log INSERT quando inserted=true (action:'release.registered'). ✅
        Response: { ok:true, inserted:bool, version }. ✅

AC5/AC6/AC7/AC8: fora do escopo — aguardam dev-beta + dev-devops.

AC5 ✅ (useAdmReleases.ts — 3 exports: useAdmReleases, useAdmReleasesBetween, useLatestAdmRelease)
AC6 ✅ (adm-sync-client/index.ts — new fn, GitHub fetch + Management API /database/query + adm_client_versions audit)
Próximo passo: @dev-devops AC8 (CHANGELOG/README). Gate final pendente.
```

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO — 8 ACs |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (M) | GO — 3 migrations + 2 edge fns + 2 GH actions changes |
| 5 | Alinhamento com arquitetura atual | GO — extends ADR-ADM-01/04 sem quebrar |

**Veredicto:** GO (5/5).

## Dependências

- **Blocked by:** nenhuma (foundational).
- **Coordena com:** devops (workflows YAML) + data-engineer (migrations + edge fn refactor).
- **Bloqueia:** REL-02 (UI consome `adm_releases` + `current_version`/`target_version`), REL-03 (drift compara contra release expected hash), REL-05 (squash precisa do conceito de release).
