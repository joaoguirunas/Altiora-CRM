---
title: "AUDIT-FIX-08: P1 Backend Security — adm-client-config e auth-login"
type: story
status: done
epic: AUDIT-FIX
complexity: M
agent: dev-beta + dev-dev-delta
created: 2026-04-26
updated: 2026-04-26
tags: [story, security, p1, edge-functions]
related: ["[[../../audit/resilience]]", "[[../../audit/QA-VERDICT]]"]
---

# AUDIT-FIX-08: P1 Backend Security — adm-client-config e auth-login

## Objetivo
Fechar buracos de segurança em edge functions públicas.

## Acceptance Criteria
- [x] AC1: `adm-client-config` tem rate limiting por IP e log de hosts suspeitos
- [x] AC2: `auth-login` aplica rate limit por `tenant_host` (não global cross-tenant)
- [x] AC3: `/conversas/demo` acessível apenas para super-admin ou feature flag

## Escopo

**IN:**
- `supabase/functions/adm-client-config/` — rate limit + log host
- `supabase/functions/auth-login/` — rate limit por tenant_host
- `src/pages/ConversasDemo.tsx` + route — adicionar guard super-admin ou feature flag

**OUT:**
- Rotação de credenciais (operacional)

## Dev Agent Record
| Agente | Serak (dev-dev-gamma) |
| Iniciado | 2026-04-26 |
| Concluído | 2026-04-26 |
| Commit | 34aa9009 |

## File List
- `supabase/functions/adm-client-config/index.ts`
- `supabase/functions/auth-login/index.ts`
- `src/App.tsx`

## Status
✅ Concluído
