---
title: "ADM-V3-09: Health check periódico via cron — popular last_health_check_at"
type: story
status: done
epic: adm-v3
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, adm, control-plane, reliability, monitoring, P2]
related: ["[[../../project/modules/adm-control-plane]]"]
---

# ADM-V3-09: Health check periódico via cron — popular last_health_check_at

## Objetivo
Automatizar o health check de todos os tenants via `pg_cron`, populando `adm_clients.last_health_check_at` e `last_health_status` para que o super-admin veja o estado de saúde sem precisar acionar manualmente via UI.

## Acceptance Criteria
- [x] AC1: Colunas `last_health_check_at timestamptz` e `last_health_status text CHECK ('healthy'|'degraded'|'down'|'unknown')` adicionadas a `adm_clients` — migration em `migrations_adm/20260422004000_adm_health_check_columns.sql`
- [x] AC2: Edge function `adm-health-check-batch` itera todos `adm_clients WHERE status = 'active'`, invoca health check para cada um — atualiza `last_health_check_at` e `last_health_status`; timeout de 5s por cliente, budget de 50s total
- [x] AC3: `pg_cron` job `adm_health_check_batch` chama `adm-health-check-batch` via `net.http_post` a cada 30 minutos — migration em `migrations_adm/`
- [x] AC4: `HealthBadge` exibe `last_health_status` com tooltip "Verificado há X" via `persistedStatus`/`persistedAt` props — sem ação manual do super-admin para ver estado atual
- [x] AC5: Manual health check via botão persiste resultado em `adm_clients` (last_health_check_at + last_health_status) — `useCheckHealth` atualiza e invalida query `adm-clients`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations_adm/20260422004000_adm_health_check_columns.sql`
- `supabase/functions/adm-health-check-batch/index.ts` (novo)
- `src/hooks/useAdmClients.ts` (AdmClient + SELECT + useCheckHealth persist)
- `src/components/adm/HealthBadge.tsx` (persistedStatus/persistedAt props + "Verificado há X" tooltip)
- `src/components/adm/AdmClientRow.tsx` (passa persistedStatus/persistedAt para HealthBadge)

## QA Results
<!-- QA preenche ao revisar -->
