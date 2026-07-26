---
title: "AUTH-V2-11: Recovery flow robusto — não depender de type=recovery na URL"
type: story
status: done
epic: auth-v2
complexity: S
agent: dev-ux
created: 2026-04-22
updated: 2026-04-23
tags: [story, auth, resilience, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../decisions/ADR-AUTH-02-fallback-profile-timeout]]"]
---

# AUTH-V2-11: Recovery flow robusto — não depender de type=recovery na URL

## Objetivo
Tornar o fluxo de reset de senha resiliente a mudanças no formato de URL do Supabase, usando o evento `PASSWORD_RECOVERY` do `onAuthStateChange` em vez de parsing de `type=recovery` na URL.

## Acceptance Criteria
- [x] AC1: `useSimpleAuth` captura evento `PASSWORD_RECOVERY` no listener `onAuthStateChange` — seta `isPasswordRecovery: true` no state e NÃO tenta fetch de profile
- [x] AC2: `ProtectedRoute` usa `isPasswordRecovery` via `useAuth()` — redireciona para `/reset-password` ao invés de checar URL
- [x] AC3: Lógica de detecção de `type=recovery` via URL removida de `ProtectedRoute` e `useSimpleAuth`
- [x] AC4: Fluxo: `PASSWORD_RECOVERY` → `isPasswordRecovery=true` → redirect `/reset-password`
- [x] AC5: SIGNED_IN após PASSWORD_RECOVERY (race condition) ignorado quando `isPasswordRecovery` está ativo

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-23 |
| Concluído  | 2026-04-23 |
| Branch     | main |

## File List
- `src/hooks/useSimpleAuthSingleTenant.ts` (isPasswordRecovery state + PASSWORD_RECOVERY handler, URL parsing removido)
- `src/components/auth/ProtectedRoute.tsx` (isPasswordRecovery de useAuth(), URL parsing removido)

## QA Results
<!-- QA preenche ao revisar -->
