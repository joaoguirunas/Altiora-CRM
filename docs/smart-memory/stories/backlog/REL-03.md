---
title: "REL-03: Drift Detection cron + Self-Healing Repair button"
type: story
status: backlog
epic: release-pipeline-v1
priority: P2
complexity: M
agent: dev-dev-beta + dev-data-engineer
created: 2026-04-24
updated: 2026-04-24
tags: [story, release, drift, self-healing, cron, edge-function, P2]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-02]]"]
---

# REL-03: Drift Detection cron + Self-Healing Repair button

## Objetivo
Detectar drift de schema (mudança fora do fluxo oficial) automaticamente via cron diário que faz `pg_dump --schema-only` por cliente, hashea e compara com baseline esperado; expor resultado no ADM com badge clicável "Drift detectado"; oferecer botão "Repair" que re-aplica migrations idempotentemente para reconciliar.

## Acceptance Criteria

- [ ] **AC1 — Schema `adm_client_drift`:**
  - Migration em `migrations_adm/`: `adm_client_drift(id uuid PK, client_id uuid FK adm_clients, detected_at timestamptz DEFAULT now(), expected_hash text, actual_hash text, expected_release text, diff_summary text, status text CHECK (status IN ('detected', 'repaired', 'acknowledged_persistent')), repaired_at timestamptz, repaired_by uuid)` + index `(client_id, detected_at DESC)`.
  - RLS super-admin only.

- [ ] **AC2 — Edge fn `adm-drift-check`:**
  - POST authenticated (service_role from cron).
  - Body opcional: `{ client_id?: uuid }` (se ausente, processa TODOS active clients).
  - Para cada cliente:
    1. Fetch `release.json` da versão `current_version` (lê `adm_releases.migrations[]`).
    2. Computa `expected_hash` localmente: SHA-256 do conteúdo concatenado das migrations files (ler do storage `migrations-archive/{version}.tar.gz` se REL-05 entregue, OU diretamente do GitHub raw URL via release tag).
    3. Pede `actual_hash` ao tenant via Supabase Management API endpoint que executa `pg_dump --schema-only --no-owner --no-comments | sha256sum`. **Se Management API não suportar dump direto:** fallback técnico — RPC `compute_schema_hash()` no tenant que usa `pg_catalog` queries para gerar hash deterministic do schema (lista de tabelas, colunas, índices, FKs concatenado + sha256).
    4. Compare. Se mismatch: INSERT `adm_client_drift` com `status='detected'` + `diff_summary` (texto curto: "5 tabelas inesperadas, 2 colunas faltando").
    5. Se match: no-op (não polui tabela).

- [ ] **AC3 — pg_cron job:**
  - Migration `migrations_adm/{ts}_adm_drift_cron.sql`:
    ```sql
    SELECT cron.schedule(
      'adm-drift-check-daily',
      '0 4 * * *',   -- 4 AM UTC daily
      $$ SELECT net.http_post(
           url := '...adm-drift-check',
           headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
           body := '{}'::jsonb
         ); $$
    );
    ```
  - Idempotente (`SELECT cron.unschedule('adm-drift-check-daily')` antes de re-schedule).

- [ ] **AC4 — RPC fallback `compute_schema_hash()`:**
  - Tenant-side RPC SECURITY DEFINER que retorna `text` (sha256 hex).
  - Lê `pg_catalog.pg_tables`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_proc` (functions), `pg_trigger` — concatena ordenadamente, hash.
  - Excludes: tabelas `pg_*`, `auth.*`, `storage.*`, `realtime.*`, `cron.*`, `vault.*` (focado em schema `public` do tenant).
  - Migration em `migrations/` (per-tenant).

- [ ] **AC5 — Badge "Drift detectado" em `AdmClientRow`:**
  - Lê `useClientDrift(client_id)` (hook novo) — última row de `adm_client_drift` com `status='detected'`.
  - Se existe: badge red "Drift" com tooltip mostrando `diff_summary` + `detected_at`.
  - Click → modal "Drift detectado" (AC6).

- [ ] **AC6 — Modal "Drift" com Repair button:**
  - Body:
    - Detalhes do drift (`diff_summary`, hashes esperado/atual, when detected).
    - Hipóteses comuns (texto educacional): "Mudança manual via SQL Editor? Restore parcial? Migration aplicada fora do CI?".
    - 3 botões:
      - **"Repair"**: dispara edge fn `adm-drift-repair` (AC7).
      - **"Acknowledge as persistent"**: marca `status='acknowledged_persistent'` (caso intencional, ex: tenant tem feature beta). Não retorna no badge.
      - **"Cancelar"**: fecha modal.

- [ ] **AC7 — Edge fn `adm-drift-repair`:**
  - POST authenticated (super-admin JWT).
  - Body: `{ client_id, drift_id }`.
  - Action: re-aplica TODAS migrations da `current_version` em modo idempotente (todas devem ser `IF NOT EXISTS` por REL-04 discipline). Reusa lógica do `adm-sync-client` mas força re-apply (ignora `adm_migration_runs` para esta release).
  - Após sucesso: re-roda `adm-drift-check` para o cliente. Se hash bate: UPDATE `adm_client_drift.status='repaired'`. Se ainda mismatch: response `{ ok: false, residual_drift: true }`.
  - Audit log: `client.drift_repaired` ou `client.drift_repair_failed`.

- [ ] **AC8 — Hooks frontend:**
  - `useClientDrift(client_id)` — query single drift latest.
  - `useAllClientsDrift()` — query agregada para sidebar/stats (count de clientes com drift).
  - `useRepairDrift()` — mutation que invoca `adm-drift-repair`.

- [ ] **AC9 — Stats em `Adm.tsx`:**
  - 6º card no `StatsBar` (atualmente 5 após ADM-V3-08): "Com drift" — count + warning amber.

## Escopo

**IN:**
- 2 migrations em `migrations_adm/` (table + cron).
- 1 migration em `migrations/` (RPC `compute_schema_hash`).
- 2 edge fns (`adm-drift-check`, `adm-drift-repair`).
- Componentes UI: `DriftBadge`, `DriftModal`, `DriftRepairButton`.
- Hooks: `useClientDrift`, `useAllClientsDrift`, `useRepairDrift`.
- Stats card update em `Adm.tsx`.

**OUT:**
- Notificação push externa (Slack/email) quando drift detectado — escopo futuro.
- Comparação granular tabela-a-tabela (mostra apenas summary string) — drilldown vira REL-V2.
- Auto-repair sem confirmação humana — sempre opt-in via UI.
- Drift histórico persistente (mantém apenas row mais recente por cliente; resolved drifts ficam no log de status `repaired`).

## Contexto Técnico

**`pg_dump` em edge fn — viabilidade:** Supabase Edge Functions Deno NÃO tem `pg_dump` binário. Opções:
- **A:** Supabase Management API tem `/v1/projects/{ref}/database/dump` (verificar status atual — em beta).
- **B:** RPC `compute_schema_hash()` no tenant que faz hash deterministic via SQL puro.

**Recomendação:** implementar **B** (RPC) primeiro — funciona garantido sem dep externa. **A** como evolução futura se Management API estabilizar.

**Hash deterministic challenge:** ordem importa. RPC deve `ORDER BY` em todas as iterações (table_name, column_name, etc) para hash ser estável. Test fixture: rodar 2× no mesmo schema = mesmo hash.

**Idempotência do Repair (AC7):** depende de REL-04 ter enforced `IF NOT EXISTS` em DDL. Se REL-04 não estiver done, Repair pode falhar em algumas migrations antigas — documentar como limitação MVP.

**Cron timing (4 AM UTC):** janela noturna BR/EU. Ajustável.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/rel-03-drift-detection |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO — 9 ACs |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (M) | GO — risco em AC4 (RPC hash) mas escopo limitado |
| 5 | Alinhamento com arquitetura atual | GO — pg_cron + edge fn pattern existente |

**Veredicto:** GO (5/5) com nota: AC2 step 3 tem incerteza (Management API). Story instrui dev a default para AC4 (RPC) como caminho garantido.

## Dependências

- **Blocked by:** REL-01 (precisa de `adm_releases` para hash expected).
- **Idealmente após:** REL-04 (Repair depende de migrations idempotentes — sem REL-04, Repair pode falhar para migrations antigas).
- **Coordena com:** beta (edge fn) + data-engineer (RPC + migrations).
