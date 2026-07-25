---
title: "AUTH-V2-10: Audit log de eventos de auth (login, logout, falhas)"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, security, audit, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../stories/backlog/US-CFG-03]]"]
---

# AUTH-V2-10: Audit log de eventos de auth (login, logout, falhas)

## Objetivo
Registrar todos os eventos significativos de autenticação (login bem-sucedido, logout, falha de login, profile fetch timeout, token refresh) na tabela `auth_events_log` do tenant para auditoria e detecção de anomalias.

## Acceptance Criteria
- [x] AC1: Tabela `auth_events_log` criada (tenant_id, user_id uuid nullable, event_type, ip_hash, user_agent_hash, metadata jsonb, occurred_at timestamptz) com RLS
- [x] AC2: `useSimpleAuth` insere em `auth_events_log` nos eventos: `login_success`, `login_failure`, `logout`, `profile_fetch_timeout`, `session_refresh`
- [x] AC3: Inserção é fire-and-forget — `void supabase.from('auth_events_log').insert()` sem await no caminho crítico
- [x] AC4: Sub-tab "Segurança" em Settings > Outros com tabela paginada: data/hora, evento, user_id, metadata, filtro por tipo
- [x] AC5: `pg_cron` job apaga registros com `occurred_at < now() - interval '90 days'`

## Escopo

**IN:**
- Migration: tabela `auth_events_log` + RLS
- Instrumentação em `useSimpleAuth` (`src/hooks/useSimpleAuthSingleTenant.ts`)
- Hook `useAuthEventsLog(filters)` para a UI
- Sub-tab "Segurança" no `OutrosConfig.tsx` via `AuthEventsLogViewer`
- `pg_cron` cleanup

**OUT:**
- Audit log de mudanças de settings (coberto por US-CFG-03)
- Alertas em tempo real
- Exportação do audit log

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `supabase/migrations/20260423008000_auth_events_log.sql`
- `src/hooks/useSimpleAuthSingleTenant.ts` (instrumentação logAuthEvent)
- `src/hooks/useAuthEventsLog.ts`
- `src/components/config/AuthEventsLogViewer.tsx`
- `src/components/config/OutrosConfig.tsx` (tab "Segurança" adicionada)

## QA Results
<!-- QA preenche ao revisar -->
