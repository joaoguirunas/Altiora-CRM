---
title: "REL-01: Versioned Releases — release.json + adm_client_versions audit + GH Action"
type: story
status: backlog
epic: release-pipeline-v1
priority: P1
complexity: M
agent: dev-data-engineer + dev-devops
created: 2026-04-24
updated: 2026-04-24
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

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/rel-01-versioned-releases |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->

---

```
VEREDICTO: CONCERNS (escopo AC6 — adm-sync-client edge fn)
Story: REL-01 | Data: 2026-07-25
Checklist: 8/8 verificados | tsc: N/A (Deno edge fn)
Aprovado com 1 observação LOW. Push LIBERADO.

──── Auth gate ────
Auth ✅  L84-88: Bearer token comparado com SUPABASE_SERVICE_ROLE_KEY. ✅
         !auth.startsWith('Bearer ') || auth.slice(7) !== SUPABASE_KEY → 401. ✅
         POST-only enforced (L90: 405 para outros métodos). ✅
         Sem JWT Supabase — serviço interno service_role apenas. ✅

──── target_version opcional → latest quando ausente ────
target_version ✅  L135-156: if(target_version) → SELECT adm_releases WHERE version=target_version. ✅
                  else → SELECT adm_releases ORDER BY created_at DESC LIMIT 1 (latest). ✅
                  Ambos: return 404 se não encontrado. ✅

──── Idempotência: migrations já aplicadas são puladas ────
Idempotência ✅  L214-232: getAppliedMigrations() consulta supabase_migrations.schema_migrations
                  via Management API (SELECT version) → Set<string>. ✅
                  appliedVersions.has(version) → skipped++ + continue. ✅
                  Loop: skipped isolado de applied e errors. ✅
                  Se getAppliedMigrations falha → empty Set (non-fatal, log warn) →
                    re-tenta todas migrations — depende de SQL idempotência (IF NOT EXISTS).
                    Mitigado por REL-04 lint MIG004 (IF NOT EXISTS obrigatório). ✅

──── UPDATE current_version após sucesso ────
UPDATE version ✅  L273-276: condição correta: applied>0 OU (failed=0 AND skipped=total).
                   Em ambos os casos, cliente está na versão release. ✅
                   Se todos failed e nenhum applied → NÃO atualiza current_version. ✅
                   updateClientVersion(db, client_id, release.version). ✅

──── INSERT adm_client_versions ────
audit_versions ✅  L432-445: recordClientVersion INSERT com:
                   from_version (clientRecord.current_version), to_version, applied_at,
                   status ('success'|'partial'|'failed'), error_summary. ✅
                   SEMPRE inserido — mesmo em failed (audit trail completo). ✅
                   applied_by=null (service_role, sem user auth). ✅

──── Response compatible com sync-clients.js ────
response ✅  L285-292: { ok, applied, failed, skipped, version, errors? }. ✅
             sync-clients.js L125-133 lê: body.applied, body.failed, body.errors. ✅
             L133: failed>0 && applied=0 → throw Error "All N migration(s) failed". ✅
             L134: failed>0 → warn "partial success". ✅
             Formato exato esperado pelo chamador. ✅

──── adm_audit_log ────
audit_log ✅  insertAuditLog: action='client.sync', target_id=client_id,
              details: {version, applied, failed, skipped, triggered_by, reason}. ✅
              triggered_by passado pelo caller (sync-clients.js: "manual:$actor", GH Action: "github_actions"). ✅

──── Extras verificados ────
client filter ✅   .eq('status','active') — somente clients ativos recebem sync. ✅
migration filter ✅  supabase/migrations/ incluídas; migrations_adm/ excluídas (L194-198). ✅
no-tenant path ✅   clientMigrations.length=0 → versão atualizada, return ok:true (ADM-only release). ✅
github fetch ✅    rawgithubusercontent com git_sha da release (pinned, não branch HEAD). ✅
projectRef ✅      extraído do supabase_url URL.hostname.split('.')[0] — robusto. ✅
credentials ✅     adm_client_decrypted_secrets RPC; 422 se management_token ausente. ✅

[CONCERN-1 LOW] applyMigrationSql L402-406: INSERT em schema_migrations usa string
  interpolation para migName e safeVersion no trackSql. safeVersion é garantidamente
  14 dígitos numéricos (regex L226) — sem risco. migName (filename sem .sql, aspas escaped)
  vem de adm_releases.migrations (fonte controlada pelo ADM — não user-supplied). Baixo
  risco prático, mas string formatting para SQL sempre preferível via parâmetros.
  Management API /database/query não suporta parâmetros bind → constraint de plataforma.
  Não bloqueia.

──── Checklist ────
1 Code review ✅ (auth gate, target_version optional, idempotency, audit trail)
2 Tests N/A (Deno edge fn)  3 ACs ✅ (todos os pontos do AC6 verificados)
4 Regressão ✅ (nova fn, não altera existentes)
5 Performance ✅ (migrations serializadas — sem risco de parallel DDL conflicts)
6 Security ✅ (service_role only; credentials via RPC; management_token via env)
7 Docs ✅ (JSDoc extenso + inline comments)
8 API contracts ✅ (response compat com sync-clients.js confirmado)

Issues: CONCERN-1 LOW (SQL string interpolation — constraint de plataforma, risco baixo)
Próximo passo: @dev-devops push. AC8 (CHANGELOG/README) pendente para closure total de REL-01.
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
