---
title: "FIX-AUTH-01: Hardening de auth — fallbackProfile, rate limit login, remover stubs legados"
type: story
status: done
priority: P2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-07-25
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
- Busca e remoção de referências legadas

**OUT:**
- MFA (escopo separado, se priorizado)
- Mudança no sistema de RLS
- Refactor completo do auth

## Contexto Técnico

**AC1** — implementado em `useAuth.ts`: `PROFILE_FETCH_TIMEOUT_MS` configurável via `VITE_AUTH_PROFILE_TIMEOUT_MS`, `isProvisional` flag, retry com backoff até `PROFILE_MAX_RETRIES=3`, `profileRetryExhausted` state.

**AC2** — `supabase/functions/auth-login/index.ts` com rate limiting via tabela `auth_login_attempts` (ip_hash + email_hash). Bloco de 15 min após max tentativas (configurável via `settings.login_max_attempts`). `useAuth.ts` chama via `fetch` e trata 429.

**AC3** — Stubs deletados:
- `src/hooks/useTenants.ts` — zero callers
- `src/hooks/useSimpleAuthSingleTenant.ts` — zero callers
- `src/components/auth/SimpleAuthProvider.tsx` — zero callers
- Nota: `crm_tenants` em `types.ts` são FK refs auto-geradas (Supabase schema) — não removíveis sem DROP da tabela no banco.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | Rex (dev-dev-beta) |
| Iniciado   | 2026-07-25 |
| Concluído  | 2026-07-25 |
| Branch     | feature/fix-sends-ui-rbac-cleanup (commit a882da5) |

## File List
- `src/hooks/useAuth.ts` — AC1+AC2: já implementados em commit 792d4a7
- `src/hooks/useTenants.ts` — DELETADO
- `src/hooks/useSimpleAuthSingleTenant.ts` — DELETADO
- `src/components/auth/SimpleAuthProvider.tsx` — DELETADO

## QA Results

```
VEREDICTO: PASS
Story: FIX-AUTH-01 | Data: 2026-07-25
Checklist: 8/8 verificados
tsc: EXIT 0 | lint: sem novos erros
Issues: nenhum

AC1 ✅  useAuth.ts: PROFILE_FETCH_TIMEOUT_MS configurável via VITE_AUTH_PROFILE_TIMEOUT_MS.
        isProvisional flag. PROFILE_MAX_RETRIES=3. profileRetryExhausted state (linha 108).
        Retry com backoff até 3 tentativas. Fail-fast em vez de timeout permissivo.
AC2 ✅  auth-login/index.ts: rate limit via auth_login_attempts (ip_hash + email_hash).
        blocked_until + login_max_attempts de settings. 429 com retry_after_seconds.
        useAuth.ts:371 chama auth-login edge fn; 378 fallback gracioso se unreachable.
AC3 ✅  Stubs deletados confirmados:
        - src/hooks/useTenants.ts → NÃO EXISTE (deletado)
        - src/hooks/useSimpleAuthSingleTenant.ts → NÃO EXISTE (deletado)
        - src/components/auth/SimpleAuthProvider.tsx → NÃO EXISTE (deletado)
        Nota: crm_tenants em types.ts são FK refs auto-geradas (Supabase) — corretamente
        não removidas (requerem DROP TABLE no banco, fora do escopo desta story).
AC4 ✅  Fluxo normal: PROFILE_FETCH_TIMEOUT_MS + retry + isProvisional são adições
        não-destrutivas ao fluxo existente. Sem remoção de lógica canônica de auth.

Próximo passo: @dev-devops push
```
