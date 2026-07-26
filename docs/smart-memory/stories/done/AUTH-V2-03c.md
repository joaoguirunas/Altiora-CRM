---
title: "AUTH-V2-03c — Step-up Auth (AAL2 Challenge + Recovery Login)"
type: story
status: done
priority: high
created: 2026-04-24
updated: 2026-04-24
tags: [auth, mfa, step-up, aal2, recovery, frontend]
related: ["[[AUTH-V2-03b]]", "[[../../../src/hooks/useMFA]]"]
---

# AUTH-V2-03c — Step-up Auth

## Description

Implement AAL2 challenge page for MFA-enrolled users at login, step-up auth dialog for sensitive actions,
and recovery code login flow for lost-device scenarios.

**Architect risk flag resolved:** Supabase Admin API cannot issue AAL2 JWTs directly. Decision: after consuming a recovery code, the MFA factor is removed (user is now AAL1-only) and they are redirected to re-enroll. This is the correct "lost device" UX (same as GitHub/Vercel).

## Acceptance Criteria

- [x] AC1 — `/mfa-verify` route: AAL2 challenge after login for enrolled users
- [x] AC2 — `useStepUpAuth` hook: verify current AAL, trigger dialog if AAL1 but AAL2 needed
- [x] AC3 — `StepUpAuthDialog`: 6-digit TOTP input modal for sensitive actions
- [x] AC4 — Recovery code consume flow: validates code, removes TOTP factor, redirects to re-enroll
- [x] AC5 — ProtectedRoute: check AAL level, redirect to /mfa-verify if needed
- [x] AC6 — `useMFA` extended: `getAssuranceLevel()`, `consumeRecoveryCode()`, `unenrollSelf()` methods

## Dev Agent Record

| Field | Value |
|---|---|
| Agente | Nova (dev-dev-alpha) |
| Iniciado | 2026-04-24 |
| Concluído | 2026-04-24 |
| Branch | main |

## File List

- `src/hooks/useMFA.ts` — modificado (getAssuranceLevel, consumeRecoveryCode, unenrollSelf)
- `src/hooks/useStepUpAuth.ts` — criado
- `src/components/auth/StepUpAuthDialog.tsx` — criado
- `src/pages/MfaVerify.tsx` — criado (TOTP challenge + recovery code flow)
- `src/components/auth/ProtectedRoute.tsx` — modificado (AAL2 check + redirect to /mfa-verify)
- `src/App.tsx` — modificado (/mfa-verify route)
- `docs/smart-memory/stories/active/AUTH-V2-03c.md` — criado

## Architecture Decision: AAL2 Elevation via Recovery Code

Supabase Admin API cannot issue AAL2 JWTs from a browser context. After `mfa_recovery_consume` succeeds:
1. The TOTP factor is removed via `supabase.auth.mfa.unenroll()`
2. User is redirected to `/settings/mfa-setup` to re-enroll
This is the standard "lost device" UX (GitHub, Vercel pattern). No `mfa-recovery-elevate` edge fn needed.

## QA Results

**VEREDICTO: CONCERNS** — Story 03c | Data: 2026-04-26 | Reviewer: Axikar (dev-qa)

### Checklist 8/8 verificados

| # | Critério                              | Resultado |
|---|---------------------------------------|-----------|
| 1 | Code review (patterns, legibilidade)  | OK        |
| 2 | Unit tests / coverage                 | N/A — projeto sem framework de teste configurado (lint+tsc como gate) |
| 3 | Acceptance criteria                   | 6/6 atendidos |
| 4 | Sem regressões                        | OK — fluxos existentes (login, MFA enroll/regenerate) intactos |
| 5 | Performance                           | OK — `getAuthenticatorAssuranceLevel` chamado 1x por mount; `lastGrantedAt` evita re-challenge desnecessário |
| 6 | Security                              | OK — recovery code via RPC bcrypt-hashed (`mfa_recovery_consume`); design "unenroll + re-enroll" alinhado com GitHub/Vercel |
| 7 | Documentação                          | OK — story documenta a Architecture Decision (AAL2 elevation impossibility) |
| 8 | Contratos de API                      | N/A — usa apenas APIs Supabase Auth e RPCs já existentes |

### Verificação de ACs

- **AC1** ✅ `/mfa-verify` registrado em [App.tsx:684](../../../../src/App.tsx); página `MfaVerify.tsx` implementa TOTP step + recovery step com countdown de 30s; `state.from` preservado para retorno pós-verify.
- **AC2** ✅ `useStepUpAuth` em [src/hooks/useStepUpAuth.ts](../../../../src/hooks/useStepUpAuth.ts) — checa AAL real via `getAuthenticatorAssuranceLevel`, abre dialog se AAL1, cacheia grant 5min via module-scope `lastGrantedAt`. Implementação ok.
- **AC3** ✅ `StepUpAuthDialog` em [src/components/auth/StepUpAuthDialog.tsx](../../../../src/components/auth/StepUpAuthDialog.tsx) — InputOTP de 6 dígitos, auto-submit, error com `role="alert"`/`aria-live="assertive"`, `autoComplete="one-time-code"`, disabled durante pending.
- **AC4** ✅ Recovery flow correto: `consumeRecoveryCode.mutateAsync` → `unenrollSelf.mutateAsync` → `navigate('/settings/mfa-setup')`. Toast informa o usuário.
- **AC5** ✅ `ProtectedRoute` checa `hasTotp` via `listFactors`, depois `currentLevel !== 'aal2'` redireciona para `/mfa-verify`. Exempt paths cobrem mfa-setup, mfa-recovery-regenerate e mfa-verify.
- **AC6** ✅ `useMFA` exporta `getAssuranceLevel`, `consumeRecoveryCode`, `unenrollSelf` (este último invalida `mfa-factors` cache).

### Quality gates locais

- `tsc --noEmit` → exit 0
- `eslint` (arquivos da story) → exit 0

### Issues (todos LOW, não-bloqueantes)

- **[LOW] AC2/AC3 sem consumer:** [src/hooks/useStepUpAuth.ts](../../../../src/hooks/useStepUpAuth.ts) e [src/components/auth/StepUpAuthDialog.tsx](../../../../src/components/auth/StepUpAuthDialog.tsx) não são importados por nenhum action sensível ainda. A story entrega o mecanismo, mas o ROI só se materializa quando aplicado (alteração de email, troca de role, exclusão de conta, etc.). Sugestão: criar story-sucessora para conectar a 1+ action concreta.
- **[LOW] `lastGrantedAt` é module-scope mutável** em useStepUpAuth.ts:19 — funciona dentro da SPA carregada, mas resetta em reload. Aceitável para um cache de UX (não substitui validação backend).
- **[LOW] Race auto-submit assimétrico:** [MfaVerify.tsx:54-58](../../../../src/pages/MfaVerify.tsx) dispara `handleVerifyTotp` quando `code.length === 6 && step === 'totp'` sem checar `isPending`, enquanto [StepUpAuthDialog.tsx:62-66](../../../../src/components/auth/StepUpAuthDialog.tsx) inclui `&& !isPending`. Em prática mutations dispostam loading rápido, mas adicionar a guarda em MfaVerify é a forma defensiva consistente. Sugestão de hardening, não bloqueante.

### Próximo passo

@dev-devops push (observações documentadas, não-bloqueantes).
