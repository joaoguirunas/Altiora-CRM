---
title: "REL-02: ADM 'Atualizar Cliente' UI — botão por cliente + bulk + Realtime status"
type: story
status: backlog
epic: release-pipeline-v1
priority: P1
complexity: L
agent: dev-dev-alpha + dev-ux
created: 2026-04-24
updated: 2026-04-24
tags: [story, release, adm, ui, realtime, bulk-actions, P1]
related: ["[[../../decisions/ADR-REL-01-release-pipeline]]", "[[REL-01]]", "[[REL-03]]"]
---

# REL-02: ADM "Atualizar Cliente" UI — botão por cliente + bulk + Realtime status

## Objetivo
Substituir o sync push-based por experiência operacional explícita: super-admin enxerga "cliente X está em vN, target vM, 2 versões atrás", clica "Atualizar", confirma 2× (com changelog visível), acompanha progresso via Realtime, e vê histórico de updates em audit log. Bulk action "Atualizar todos os clientes" para deploys em massa.

## Acceptance Criteria

- [ ] **AC1 — Coluna nova "Versão" em `AdmClientRow`:**
  - Mostra `current_version` em mono font.
  - Se `current_version !== target_version`: badge amber "{N} versões atrás" clicável (abre modal).
  - Se `current_version === target_version`: badge emerald "Atualizado".
  - Se `current_version === null`: badge muted "Nunca sincronizado".
  - Reusa estética de `getDriftStatus` (ADM-V3-08 done).

- [ ] **AC2 — Modal "Atualizar Cliente":**
  - Header: nome do cliente + versão atual → versão alvo.
  - Body:
    - **Changelog**: lista das releases entre `current_version` e `target_version` (lê `adm_releases` via `useAdmReleases`).
    - **Migrations a aplicar**: lista de filenames (de `release.migrations[]`).
    - **Drift detected**: se REL-03 já entregou e `adm_client_drift` tem entry, mostra warning "Drift detectado em {datetime} — recomenda-se Repair antes de Atualizar" com link para REL-03.
    - **Estimativa**: "~{N} segundos" baseado em count de migrations (regra simples: 0.5s/migration).
  - Footer:
    - Checkbox **obrigatório**: "Confirmo que entendo que esta operação modificará o schema do banco do cliente".
    - Botão "Cancelar" + botão "Atualizar agora" (disabled até checkbox).

- [ ] **AC3 — Background job + Realtime status:**
  - Click em "Atualizar agora" → INSERT `adm_sync_jobs` (status `pending`) + invoke edge fn `adm-sync-client` com `target_version`.
  - Modal NÃO fecha — substitui body por progress view:
    - Status pill (pending → running → success/failed).
    - Lista de migrations com check ✓ / spinner / ✗.
    - Logs streaming (subscribe Realtime channel `adm_sync_logs:job_id=eq.{jobId}` — channel já existe per AdmSyncPanel).
  - Após `success`: toast verde + auto-refresh `useAdmClients` + opção "Fechar".
  - Após `failed`: toast vermelho + erro destacado + opção "Ver detalhes" (abre AdmSyncPanel filtrado por job).

- [ ] **AC4 — Bulk button "Atualizar todos":**
  - Botão no header de `/adm` (próximo aos tabs).
  - Disabled se nenhum cliente tem `current_version !== target_version`.
  - Click → modal "Atualizar todos os clientes desatualizados":
    - Lista TODOS clientes desatualizados com checkboxes (default: todos selecionados).
    - Mostra changelog COMUM (release alvo única — ou "múltiplas releases" se variar).
    - Confirmação dupla (checkbox + button).
    - Background: dispara N edge fns em paralelo (max 5 concurrent — control para não sobrecarregar control plane).
    - Progress view com tabela: cada cliente como linha + status individual.

- [ ] **AC5 — Histórico em `AdmClientSingle`:**
  - Nova section "Histórico de releases" abaixo de Sync Jobs.
  - Lê `adm_client_versions` ordenado por `applied_at DESC` (limit 20).
  - Cada row: from_version → to_version, applied_at, applied_by (email lookup), status badge, link "Ver job" → AdmSyncPanel.

- [ ] **AC6 — Hook `useUpdateClient`:**
  - `useUpdateClient.mutate({ clientId, targetVersion })` → invoke edge fn + return jobId.
  - `useBulkUpdateClients.mutate({ clientIds, targetVersion })` → fan-out controlado.
  - Audit log via `insertAuditLog` (action `client.updated_to_release`, details: from/to/sync_job_id).

- [ ] **AC7 — Notificação in-app:**
  - Quando `useAdmReleases` retorna release nova (last_seen via localStorage), toast info "Nova release disponível: v{N}. Clique para ver clientes desatualizados." → navega para `/adm`.
  - Dismissable por release.

- [ ] **AC8 — Acessibilidade:**
  - Modal trap focus.
  - Botão "Atualizar agora" com `aria-busy` durante mutation.
  - Progress view com `role="status"` + `aria-live="polite"`.

## Escopo

**IN:**
- `src/components/adm/UpdateClientModal.tsx` (NEW — modal principal).
- `src/components/adm/BulkUpdateModal.tsx` (NEW — bulk).
- `src/components/adm/UpdateProgressView.tsx` (NEW — Realtime progress).
- `src/components/adm/ClientVersionsHistory.tsx` (NEW — histórico).
- Modificações em `AdmClientRow.tsx` (nova coluna, abre modal).
- Modificações em `AdmClientSingle.tsx` (nova section histórico).
- Modificações em `Adm.tsx` (bulk button no header).
- Hook `useUpdateClient` + `useBulkUpdateClients` em `src/hooks/useAdmClients.ts`.
- Notificação de nova release (integrar em DashLayout ou Adm.tsx).

**OUT:**
- Mudança nas edge functions (REL-01).
- Drift detection backend (REL-03).
- Schema squashing (REL-05).
- Rollback button (REL-V3 futuro).
- Schema preview (REL-V4 futuro).

## Contexto Técnico

**`ROW_COLS` em AdmClientRow precisa expandir:** atual `grid-cols-[1fr_190px_96px_140px_152px_90px_80px]` (7 cols) → 8 cols com nova "Versão". Atualizar header em Adm.tsx em paralelo. Considerar mover "Health" para dropdown se row ficar apertada.

**Realtime já existe:** `useAdmSyncJobs` + `useAdmSyncLogs` já fazem live update via Supabase Realtime + polling fallback. Reusar.

**Concurrency control no bulk (AC4):** 5 paralelo é arbitrário — control plane suporta mais, mas evita "thundering herd" em caso de bulk de 50+ tenants. Tunable via constante `MAX_PARALLEL_UPDATES`.

**Notificação (AC7):** simples — comparar `release.version` mais recente vs `localStorage.lastSeenRelease`. Se diff, mostra toast 1×.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/rel-02-adm-update-ui |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->

## Validação 5-pontos (zael)

| # | Critério | Status |
|---|---|---|
| 1 | Título claro e objetivo | GO |
| 2 | Acceptance criteria testáveis e mensuráveis | GO — 8 ACs |
| 3 | Escopo definido (IN/OUT explícitos) | GO |
| 4 | Complexidade estimada (L) | GO — 4 componentes novos + bulk fan-out + Realtime + 3 mods |
| 5 | Alinhamento com arquitetura atual | GO — reusa `useAdmSyncJobs`/Realtime existente |

**Veredicto:** GO (5/5).

## Dependências

- **Blocked by:** REL-01 (precisa de `adm_releases` table, `current_version`/`target_version` columns, edge fn refactor).
- **Coordenação:** alpha + ux (modal flow, bulk UX layout).
