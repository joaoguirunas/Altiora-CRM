---
title: "AUTH-V2-06: enabled_modules via Supabase Realtime (substituir polling 30s)"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, realtime, performance, P3]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# AUTH-V2-06: enabled_modules via Supabase Realtime

## Objetivo
Substituir polling 30s de `adm-enabled-modules` por canal Supabase Realtime, eliminando ~120 requests/hora por sessão.

## Acceptance Criteria
- [x] AC1: `useSystemModules` abre canal Realtime no `supabaseControlPlane` client: `channel('adm-modules-{client_id}').on('postgres_changes', { event: 'UPDATE', table: 'adm_clients', filter: 'id=eq.{client_id}' }, callback)`
- [x] AC2: Callback atualiza `['adm-enabled-modules', hostname]` via `queryClient.setQueryData` imediatamente — sem aguardar intervalo
- [x] AC3: `refetchInterval` removido quando Realtime está conectado (`realtimeConnected === true`); fallback 60s quando degradado
- [x] AC4: Canal fechado via `channel.unsubscribe()` no cleanup do useEffect — sem memory leak
- [x] AC5: Fallback: se canal não conecta (`status !== 'SUBSCRIBED'`), polling continua com `refetchInterval: 60_000`

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `src/hooks/useSystemModules.ts` (Realtime channel + realtimeConnected state + fallback polling)

## QA Results
<!-- QA preenche ao revisar -->
