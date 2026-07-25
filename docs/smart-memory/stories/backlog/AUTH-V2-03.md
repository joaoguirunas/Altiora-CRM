---
title: "AUTH-V2-03: MFA opcional via TOTP (Supabase Auth)"
type: story
status: backlog
epic: auth-v2
complexity: L
agent: dev-dev-alpha
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth, security, mfa, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../stories/backlog/US-CFG-01]]"]
---

# AUTH-V2-03: MFA opcional via TOTP (Supabase Auth)

## Objetivo
Implementar o lado backend/Auth da autenticação multifator: enroll, challenge e verify TOTP via Supabase Auth MFA API, expondo hooks que a story US-CFG-01 (Settings UI) consomem.

## Acceptance Criteria
- [ ] AC1: Hook `useMFA()` em `src/hooks/useMFA.ts` expõe: `enroll()` → retorna `{ qr_code, secret }` de `supabase.auth.mfa.enroll({factorType: 'totp'})`; `challenge(factorId)` → `supabase.auth.mfa.challenge()`; `verify(factorId, challengeId, code)` → `supabase.auth.mfa.verify()`; `listFactors()` → `supabase.auth.mfa.listFactors()`; `unenroll(factorId)` → `supabase.auth.mfa.unenroll()`
- [ ] AC2: `useSimpleAuth.fetchUserProfile` verifica `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` após login — se tenant requer MFA (`settings.require_mfa_for_gestores = true`) e user é gestor mas `currentLevel < nextLevel`, seta `needsMFAChallenge: true` no profile
- [ ] AC3: `ProtectedRoute` verifica `user.profile.needsMFAChallenge` — se true, redireciona para `/mfa-verify` (nova rota pública fora do DashLayout)
- [ ] AC4: Página `/mfa-verify` exibe input de 6 dígitos, chama `useMFA().verify()` e após sucesso navega para a rota original via `location.state.from`
- [ ] AC5: `useSimpleAuth.signOut` chama `supabase.auth.mfa.unenroll` de todos os fatores ativos quando gestor remove MFA de si mesmo (endpoint separado de unenroll por outro gestor via edge fn com service_role)

## Escopo

**IN:**
- Hook `useMFA()` + tipo `MFAFactor`
- Campo `needsMFAChallenge: boolean` no `UserProfile`
- Rota `/mfa-verify` + componente `MFAVerifyPage`
- Integração com `ProtectedRoute` para redirect
- Edge function `admin-unenroll-mfa(userId)` com service_role para revogação por gestor admin

**OUT:**
- UI de setup de MFA (coberto em US-CFG-01)
- Backup codes / recovery
- WebAuthn / hardware keys
- MFA obrigatório para não-gestores

## Contexto Técnico
Supabase Auth MFA está disponível nativamente — nenhuma dependência externa. `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` retorna `{ currentLevel: 'aal1'|'aal2', nextLevel: 'aal1'|'aal2' }` — `aal2` significa MFA verificado. A policy de MFA obrigatório (`settings.require_mfa_for_gestores`) é lida via `useSettings` (já existe). `ProtectedRoute` em `src/components/auth/ProtectedRoute.tsx` já tem lógica de redirecionamento condicional — adicionar check de `needsMFAChallenge` ali. Deep-dive §8 confirma "sem MFA configurado" como não-integração atual.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/auth-mfa-totp |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
