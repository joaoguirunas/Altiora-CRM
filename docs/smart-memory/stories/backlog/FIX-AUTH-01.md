---
title: "FIX-AUTH-01: Hardening de auth — fallbackProfile, rate limit login, remover stubs legados"
type: story
status: backlog
priority: P2
complexity: M
agent: dev-architect
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth-tenant-bootstrap, debt, P2, security]
related: ["[[../../project/modules/auth-tenant-bootstrap]]"]
---

# FIX-AUTH-01: Hardening de auth — fallbackProfile, rate limit login, remover stubs legados

## Objetivo
Tornar o fallbackProfile menos permissivo, adicionar rate limit no login, e remover vestígios de código legado de tenant (`crm_tenants`, `useTenants`, `useTenantContext` stub).

## Acceptance Criteria
- [x] AC1: `fallbackProfile` com timeout 2s substituído por comportamento fail-fast ou timeout configurável via env
- [x] AC2: Rate limit no login implementado (ex: max 5 tentativas / 1 min por IP)
- [x] AC3: Referências a `crm_tenants`, `useTenants`, `useTenantContext` (stub) removidas do codebase
- [x] AC4: Nenhuma regressão no fluxo normal de auth (bootstrap hostname → sessionStorage → mount)

## Escopo

**IN:**
- `useSimpleAuth` ou equivalente — revisar lógica de fallbackProfile
- Middleware/hook de rate limit no endpoint de login
- Busca e remoção de referências legadas: `grep -r "crm_tenants\|useTenants\|useTenantContext"`

**OUT:**
- MFA (escopo separado, se priorizado)
- Mudança no sistema de RLS
- Refactor completo do auth

## Contexto Técnico
Auth usa hostname→sessionStorage→mount como bootstrap. `fallbackProfile` tem timeout de 2s e é permissivo demais (pode deixar passar usuário sem perfil válido). Sem rate limit no login (risco de brute force). Código legado de `crm_tenants` e hooks stub ainda presente. Ver `docs/smart-memory/project/modules/auth-tenant-bootstrap.md`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup |

## File List
- `src/hooks/useAuth.ts` — AC1 (VITE_AUTH_PROFILE_TIMEOUT_MS env) + AC2 (auth-login edge fn): já implementados em commit 792d4a7 (AUTH-V2-08)
- `src/hooks/useTenants.ts` — DELETADO (stub vazio, zero callers)
- `src/hooks/useSimpleAuthSingleTenant.ts` — DELETADO (re-export stub, zero callers)
- `src/components/auth/SimpleAuthProvider.tsx` — DELETADO (re-export stub, zero callers)
- Nota: `crm_tenants` em `src/integrations/supabase/types.ts` são FK refs auto-geradas — não removíveis sem DROP da tabela no banco

## QA Results
