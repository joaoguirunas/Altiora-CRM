---
title: "ADM-V3-10: Soft-delete de tenant com grace period"
type: story
status: done
epic: adm-v3
complexity: L
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, lifecycle, P2]
related: ["[[../../project/modules/adm-control-plane]]", "[[../../decisions/ADR-ADM-01-project-per-tenant]]"]
---

# ADM-V3-10: Soft-delete de tenant com grace period

## Objetivo
Implementar um fluxo seguro de desativação e remoção de tenants: soft-delete com grace period de 30 dias antes de expurgo permanente dos secrets do control plane.

## Acceptance Criteria
- [x] AC1: Colunas `deleted_at timestamptz` e `delete_requested_by uuid` adicionadas a `adm_clients` — migration em `migrations_adm/20260422005000_adm_soft_delete.sql`
- [x] AC2: `useDeleteAdmClient` faz soft-delete: UPDATE `status = 'suspended'`, `deleted_at = now()`, `delete_requested_by = actor_id` — NÃO faz DELETE SQL. Audit log `client.soft_deleted` com `{ grace_period_days: 30, expires_at }`
- [x] AC3: UI em `AdmClientRow` exibe badge "Excluindo — X dias restantes" para clientes com `deleted_at` não-null — botão "Reativar cliente" no dropdown chama `useReactivateAdmClient` que limpa `deleted_at` e volta `status = 'active'`
- [x] AC4: `pg_cron` job `adm_purge_deleted` (daily 04:00 UTC) chama `adm-purge-tenant` para clientes com `deleted_at < now() - 30d` — purge: secrets → string vazia + `status = 'inactive'`; sem DROP PROJECT
- [x] AC5: `adm-client-config` já filtra `status = 'active'` — tenant suspenso recebe 404 (comportamento atual não alterado)

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations_adm/20260422005000_adm_soft_delete.sql` — colunas + pg_cron job
- `supabase/functions/adm-purge-tenant/index.ts` (novo) — wipe secrets + audit log
- `src/hooks/useAdmClients.ts` — AdmClient interface + SELECT + `useDeleteAdmClient` (soft) + `useReactivateAdmClient` (novo)
- `src/components/adm/AdmClientRow.tsx` — badge + reativação no dropdown + dialog atualizado

## QA Results
<!-- QA preenche ao revisar -->
