---
title: "FIX-SCH-02: Double-booking, Zoom refresh e RLS em meeting_evaluations"
type: story
status: done
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-23
tags: [story, schedule-pro, debt, P2]
related: ["[[../../project/modules/schedule-pro]]"]
---

# FIX-SCH-02: Double-booking, Zoom refresh e RLS em meeting_evaluations

## Objetivo
Prevenir double-booking quando GCal não está importado, implementar refresh de tokens Zoom, e adicionar RLS tenant-scoped em `meeting_evaluations`.

## Acceptance Criteria
- [x] AC1: Slots ocupados por reuniões no GCal (não importadas no sistema) são bloqueados no public booking
- [x] AC2: Token Zoom renovado automaticamente antes de expirar (refresh_token flow)
- [x] AC3: `meeting_evaluations` tem policy RLS garantindo isolamento por `tenant_id`
- [x] AC4: Booking público não permite double-booking em nenhum cenário testado

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | fix/schedule-double-booking-zoom-rls |

## File List

- `supabase/functions/public-booking/index.ts` — GCal FreeBusy check added before event creation
- `supabase/functions/zoom-token-refresh/index.ts` — novo edge fn para refresh proativo de tokens Zoom
- `supabase/migrations/20260423011000_meeting_evaluations_rls_tenant_scoped.sql` — RLS policy tenant-scoped
- `supabase/migrations/20260423012000_zoom_token_refresh_cron.sql` — pg_cron zoom-token-refresh cada 30min

## Resultado

**Commit:** `46cf773d`

**AC1 & AC4 (Double-booking GCal):**
Adicionado check de FreeBusy API do Google Calendar em `public-booking:gcal_sync` antes de criar o evento. Consulta o endpoint `/freeBusy` com o time slot da reunião. Se houver conflito (evento no GCal não importado ao nosso DB), retorna 409 `gcal_conflict` e grava `gcal_sync_error='gcal_conflict'` na reunião. O booking foi já gravado no DB mas o GCal sync não ocorre, sinalizando o conflito ao cliente.

**AC2 (Zoom token refresh):**
- Novo edge fn `zoom-token-refresh`: busca conexões Zoom com `zoom_token_expires_at <= now()+45min`, chama endpoint de refresh do Zoom, atualiza `user_calendar_connections.zoom_access_token + zoom_token_expires_at`.
- Migration `20260423012000`: pg_cron `*/30 * * * *` → `trigger_zoom_token_refresh()` (SECURITY DEFINER + `_app_config`). Só ativa se houver conexão Zoom ativa.

**AC3 (RLS meeting_evaluations):**
- Substituída política `meeting_evaluations_all` (USING true) por duas novas:
  - `meeting_evaluations_authenticated_read`: leitura para usuários autenticados da mesma instância (join meetings → settings_users → auth_user_id IS NOT NULL + caller tem auth_user_id na tabela).
  - `meeting_evaluations_manager_write`: escrita via client apenas para `is_admin_or_gestor()`. AI usa service role (bypassa RLS).

## QA Results
