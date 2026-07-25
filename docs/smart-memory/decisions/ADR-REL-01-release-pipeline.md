---
title: "ADR-REL-01: Release Pipeline V1 — versioned releases, ADM dispatch, drift detection, baseline squashing"
type: decision
status: accepted
agent: dev-architect
created: 2026-04-24
updated: 2026-04-24
tags: [adr, release, pipeline, multi-tenant, sync, drift, migrations, devops]
related: ["[[../project/modules/adm-control-plane]]", "[[ADR-ADM-01-project-per-tenant]]", "[[ADR-ADM-04-batch-vs-incremental-sync]]"]
---

# ADR-REL-01: Release Pipeline V1

## Contexto

Estado atual (Sprint 04/2026):
- **746 migrations** em `supabase/migrations/` (massivo histórico desde 2025).
- `version.json` v1.93 existe — mas é só um marcador de build do app, não release agregada.
- `client-migrations.json` (manifest) lista quais migrations são aplicáveis a tenants — gerado por `auto-update-manifest.js` no CI.
- `sync-clients.yml` (GitHub Action) dispara em push para `main` com paths em `supabase/migrations/` ou `supabase/functions/`.
- `sync-clients.js` invoca edge fn `adm-sync-client` por HTTP (workaround do IPv6 — ver ADR-ADM-04).
- Edge fn `adm-sync-client` aplica migrations pendentes incrementalmente; drift acumula silenciosamente.

**Problema observado (sprint atual):**
- Cliente "The Mentor" acumulou ~15 migrations falhando em cascata (drift histórico).
- Sync passa "verde" mesmo deixando migrations não-aplicadas.
- Sem rollback, sem changelog visível, sem botão "tentar de novo". Operação manual via SQL editor por sessão.
- Sprint terminou ~30 stories de código novo, mas a propagação ficou frágil. **Velocidade de feature × maturidade do delivery** desbalanceada.

**Inspiração:** padrão "Release Pipeline" de Vercel/Render/Heroku — releases versionadas, deploy explícito por target, observability, rollback. Aplicar ao multi-tenant Supabase.

## Opções consideradas

### Decisão 1 — Modelo de versão

**1A. Release tag agregada (`release.json` no main, escolhido)**
- A cada merge em main com migrations, GitHub Action gera `release.json` com `{ version, migrations[], created_at, min_compat_from }`.
- Tag git correspondente `release-v{N}` para audit trail.
- Pros: snapshot atômico (cliente sabe exatamente qual conjunto receber); rollback granular (puxar release N-1); changelog generated.
- Contras: precisa CI confiável; muda fluxo atual.

**1B. Manter `client-migrations.json` como single source**
- Status quo.
- Pros: nada a mudar.
- Contras: não tem versionamento agregado; impossível "voltar para release X"; sem changelog.

→ **1A** + manter `client-migrations.json` como cache derivado (auto-update continua, mas `release.json` é a fonte autoritativa de "o que é uma versão N").

### Decisão 2 — Dispatch para tenant

**2A. Botão "Atualizar cliente" no ADM, opt-in (escolhido)**
- Hoje sync dispara em push para main (push-based, todo cliente recebe).
- Mudança: sync NÃO dispara automático em push. Em vez disso, ADM mostra "Cliente X está em release v1.93, target v1.95 (2 versões atrás)" + botão "Atualizar agora".
- Background job (Realtime status) mostra progresso ao vivo.
- Bulk button "Atualizar todos os clientes" para super-admin.
- Pros: controle do operador; "deploy windows"; clientes em horário de pico não levam migration disruptive.
- Contras: requer disciplina operacional (ninguém clicar = todo mundo desatualizado).

**2B. Push-based (status quo) com gates manuais por cliente**
- Continuar push-based, mas marcar tenants `auto_sync = false` para opt-out.
- Pros: menos mudança.
- Contras: mistura modelos; manutenção dupla.

→ **2A** com **fallback opcional**: tenant configura `auto_apply_minor: boolean` para receber automaticamente patches sem migration nova (só code/edge fn deploys). Migrations sempre opt-in via UI.

### Decisão 3 — Drift detection

**3A. `pg_dump --schema-only` por cliente, hash-based diff (escolhido)**
- Cron edge fn (1×/dia) faz `pg_dump --schema-only` no DB do tenant.
- Hash SHA-256 do dump.
- Compara com baseline esperado (computado também no control plane a partir de `release.json`).
- Mismatch = drift; armazena em `adm_client_drift(client_id, detected_at, expected_hash, actual_hash, diff_summary)`.
- Pros: detecção objetiva; não depende de "registramos que aplicou".
- Contras: cron precisa rodar; `pg_dump` em edge fn requer wrapper (Supabase Management API tem dump endpoint).

**3B. Tracking apenas por `adm_migration_runs` (status quo)**
- Olha tabela de runs, conta diff de "deveria estar aplicado" vs "está".
- Pros: zero infra nova.
- Contras: cego para drift causado por mudanças manuais (DBA ad-hoc, restore parcial); não detecta colunas/triggers órfãos.

→ **3A** como source of truth. **3B** continua como sinal complementar (se `adm_migration_runs` discorda do `pg_dump` hash, há algo errado nos dois lados — alarme).

### Decisão 4 — Migration discipline

**4A. Lint script + CI rule + dry-run (escolhido)**
- `scripts/lint-migrations.js` valida cada `.sql` novo:
  - DDL crítico precisa `IF NOT EXISTS` / `IF EXISTS`.
  - Cada migration precisa um `.rollback.sql` correspondente em `supabase/migrations/rollbacks/`.
  - Sem `DROP TABLE` sem opt-in flag (`-- @allow-destructive` no header).
  - Sem migrations sem timestamp ISO em filename.
- CI rule (GitHub Action) bloqueia PR que falha o lint.
- Dry-run em DB clone (snapshot Supabase) antes de marcar release como ready.
- Pros: fail-fast; documentação enforced.
- Contras: lint pode ter falsos positivos; dry-run consome budget de Supabase project clone.

**4B. Code review manual**
- Status quo (revisor humano).
- Pros: zero infra.
- Contras: erro humano (a "moddatetime" ausente passou em revisão na sprint).

→ **4A** complementando 4B (revisor + lint).

### Decisão 5 — Baseline squashing

**5A. Squash a cada 100 migrations (escolhido)**
- `scripts/squash-baseline.js` consolida N migrations em 1 baseline `_baseline_v{N}.sql`.
- Migrations originais movidas para `supabase/migrations/archived/`.
- Novos clientes começam da baseline mais recente.
- Tenants existentes continuam aplicando incremental (não quebra histórico).
- Política: trigger automático quando `migrations/*.sql` count > 100.
- Pros: novos onboardings rápidos (1 baseline vs 700+ migrations); reduz ruído; resumo legível.
- Contras: complexidade do script (ordem dependencies); risco de inconsistência se squash for mal-feito.

**5B. Manter histórico linear infinito**
- Status quo (746 migrations).
- Pros: simplicidade.
- Contras: novo cliente leva 30+ min para aplicar tudo; debugging fica impossível.

→ **5A** com gate humano (script gera o baseline candidate, super-admin aprova antes de mover originais para `archived/`).

## Decisão (consolidada)

Adotar **Release Pipeline V1** com 5 capabilities:

1. **REL-01 — Versioned Releases:** `release.json` no main + `adm_clients.current_version`/`target_version` + `adm_client_versions` audit + GitHub Action que cria release tag em PR merge.
2. **REL-02 — ADM "Atualizar Cliente" UI:** botão por cliente + bulk; modal com versão atual/pendentes/changelog/drift; Realtime status; histórico em audit log.
3. **REL-03 — Drift Detection + Self-Healing:** cron edge fn `pg_dump` hash diff; badge no ADM; "Repair" button aplica diff idempotente.
4. **REL-04 — Migration Discipline:** `scripts/lint-migrations.js` + CI block + dry-run em snapshot; padrão `IF NOT EXISTS` + rollback obrigatório.
5. **REL-05 — Schema Baseline Squashing:** `scripts/squash-baseline.js` consolida 100+ migrations em baseline; novos tenants começam do baseline; old movido para `archived/`.

## Diagrama — fluxo end-to-end

```mermaid
flowchart TB
    subgraph Dev["Dev Workflow"]
        PR[Open PR] --> Lint[CI: lint-migrations.js]
        Lint -->|pass| Review[Code Review]
        Lint -->|fail| Block[❌ Block merge]
        Review --> Merge[Merge to main]
    end

    subgraph CI["GitHub Actions"]
        Merge --> Tag[Release Action]
        Tag --> Bump[Bump version.json]
        Tag --> Release[Generate release.json<br/>+ git tag release-v{N}]
        Release --> Manifest[Update client-migrations.json]
        Manifest --> CommitTag[Commit + Push tag]
    end

    subgraph CP["Control Plane"]
        CommitTag --> RegistryUpdate[Update adm_releases registry]
        RegistryUpdate --> NotifyADM[ADM UI shows new version available]
    end

    subgraph ADM["ADM Operator (Super-Admin)"]
        NotifyADM --> View[/adm/clients]
        View --> SeeDrift{Drift<br/>detected?}
        SeeDrift -->|yes| Repair[Repair button]
        SeeDrift -->|no| Update[Atualizar cliente button]
        Update --> Modal[Modal: changelog + diff]
        Modal --> Confirm[Double confirm]
        Confirm --> Job[Background job created]
    end

    subgraph Sync["Tenant Sync"]
        Job --> Edge[adm-sync-client edge fn]
        Edge --> Apply[Apply migrations to tenant DB]
        Apply --> Update2[UPDATE adm_clients.current_version]
        Apply --> Audit2[INSERT adm_client_versions audit]
        Apply --> Realtime[Push status via Realtime]
        Realtime --> ADM
    end

    subgraph Drift["Daily Drift Check"]
        Cron[pg_cron 1x/day] --> Dump[adm-drift-check edge fn]
        Dump --> PgDump[pg_dump --schema-only per tenant]
        PgDump --> Hash[SHA-256 hash]
        Hash --> Compare{matches expected?}
        Compare -->|no| Mark[INSERT adm_client_drift]
        Mark --> ADM
        Compare -->|yes| OK[no-op]
    end

    subgraph Squash["Quarterly: Baseline Squashing"]
        Trigger[migrations count > 100] --> Squash2[squash-baseline.js]
        Squash2 --> Baseline[_baseline_v{N}.sql created]
        Squash2 --> Archive[Old migrations → archived/]
        Squash2 --> Approve[Super-admin reviews + approves]
        Approve --> Merge2[Merge baseline PR]
    end

    classDef green fill:#dcfce7,stroke:#16a34a
    classDef blue fill:#dbeafe,stroke:#2563eb
    classDef amber fill:#fef3c7,stroke:#d97706
    class Dev,Lint,Review,Merge green
    class CI,Tag,Bump,Release,Manifest,CommitTag blue
    class ADM,Update,Confirm,Repair amber
```

## Consequências

### Positivas

- **Releases versionadas:** rollback granular; debug ("qual release tem o bug X?"); changelog automático.
- **Controle operacional:** super-admin escolhe quando aplicar; sem disrupção em horário de pico.
- **Drift visível:** problema "The Mentor com 15 migrations falhando em silêncio" não acontece — badge alerta.
- **Self-healing:** repair button aplica diff idempotente sem forçar manual SQL.
- **Disciplina:** lint enforced em CI; novos devs aprendem padrão imediato (rollback obrigatório).
- **Baseline squashing:** novos tenants onboard em segundos vs minutos; codebase mais navegável.
- **Audit completo:** `adm_client_versions` trail por cliente.

### Negativas / riscos aceitos

- **Mudança de comportamento push-based → opt-in:** equipe precisa lembrar de "Atualizar Cliente" após cada release. Mitigation: bulk button + notificações in-app.
- **`pg_dump` em edge fn:** depende de Supabase Management API (não é endpoint nativo do Postgres). Validar viabilidade técnica em REL-03 — se impossível, fallback é executar dump em GitHub Action e armazenar hash via webhook.
- **Squash gera baseline gigante:** 100 migrations consolidadas podem ter 50k+ linhas SQL. Mitigation: squash respeita ordem de dependência; super-admin aprova antes de mover originals.
- **Lint pode ter falsos positivos:** alguns padrões legítimos (ex: `CREATE OR REPLACE`) não precisam `IF NOT EXISTS`. Mitigation: regras com whitelist; opt-out via comment header `-- @lint-skip <rule>`.
- **CI dry-run consome cota:** snapshot Supabase project tem custo. Mitigation: usar Supabase branching (feature beta) OU rodar dry-run apenas em PRs com label `migration-heavy`.

### Plano de evolução

- **REL-V2 (futuro):** **canary deployments** — release vai para 1 tenant beta primeiro, espera 24h sem incidente, libera para todos.
- **REL-V3 (futuro):** **rollback button** no ADM (puxa `release.json` N-1 e gera diff reverso).
- **REL-V4 (futuro):** **schema preview** — antes de "Atualizar Cliente", mostra dry-run output para super-admin (quais ALTERs vão rodar, quais tabelas tocadas).
- **REL-V5 (futuro):** **integração Stripe webhooks** — release crítica de billing requer hold em horário comercial automático.

## Stories implementam (5)

| Story | Escopo | Complexidade | Owner sugerido |
|---|---|---|---|
| [REL-01](../stories/backlog/REL-01.md) | Versioned Releases (release.json + adm_releases + columns + GH Action) | M | data-engineer + devops |
| [REL-02](../stories/backlog/REL-02.md) | ADM "Atualizar Cliente" UI + bulk + Realtime | L | alpha + ux |
| [REL-03](../stories/backlog/REL-03.md) | Drift Detection cron + repair button | M | beta + data-engineer |
| [REL-04](../stories/backlog/REL-04.md) | Migration Discipline (lint + CI + dry-run) | M | devops + data-engineer |
| [REL-05](../stories/backlog/REL-05.md) | Schema Baseline Squashing | M | data-engineer |

Sequência sugerida: REL-04 → REL-01 → REL-02 → REL-03 → REL-05 (lint primeiro previne novas falhas; release schema depois; UI depende de schema; drift depois de tudo; squash quando baseline maduro).

## Referências

- [ADR-ADM-01: Project-per-tenant](ADR-ADM-01-project-per-tenant.md) — base do modelo multi-tenant.
- [ADR-ADM-04: Batch vs Incremental Sync](ADR-ADM-04-batch-vs-incremental-sync.md) — comportamento atual de sync.
- [`scripts/sync-clients.js`](../../../scripts/sync-clients.js) — entry point CI atual.
- [`scripts/auto-update-manifest.js`](../../../scripts/auto-update-manifest.js) — manifest builder.
- [`.github/workflows/sync-clients.yml`](../../../.github/workflows/sync-clients.yml) — workflow atual.
- [Supabase Management API — branching](https://supabase.com/docs/guides/platform/branching) — possível host do dry-run.
- [Vercel deployment lifecycle](https://vercel.com/docs/deployments/overview) — inspiração de UX.
