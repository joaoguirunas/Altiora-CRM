---
title: "AUTH-V2-03b — MFA Enrollment UI"
type: story
status: active
priority: high
created: 2026-04-24
updated: 2026-04-24
tags: [auth, mfa, enrollment, frontend, ui]
related: ["[[../../../src/pages/MfaSetup]]", "[[../../../src/hooks/useMFA]]"]
---

# AUTH-V2-03b — MFA Enrollment UI

## Description

Implement the complete MFA enrollment UI: 4-step enrollment flow, recovery codes display, grace banner in DashLayout, MFA section in Profile, and admin unenroll button in UsuariosConfig.

## Acceptance Criteria

- [x] AC1 — `useMFA` hook: enroll, challenge, verify, generateRecoveryCodes, listFactors (TanStack Query)
- [x] AC2 — `RecoveryCodesDisplay` shared component: amber callout, 2×5 grid, download .txt, mandatory checkbox
- [x] AC3 — 4-step `MfaSetup.tsx`: intro → qr → verify → recovery (stepper, InputOTP, auto-submit, countdown)
- [x] AC4 — `MfaRecoveryRegenerate.tsx`: re-auth via TOTP + new codes display
- [x] AC5 — `MfaGraceBanner.tsx` in DashLayout: 3 urgency levels, sessionStorage dismiss, role="alert"
- [x] AC6 — `MfaSection` in Profile: status badge, regenerate link, disabled Desativar button with tooltip
- [x] AC7 — Admin unenroll in UsuariosConfig: uses `admin-unenroll-mfa` edge fn, amber AlertDialog
- [x] AC8 — `src/types/mfa.ts`: MfaFactor, MfaFactorList, MfaEnrollData, MfaEnrollStep types
- [x] AC9 — New route `/settings/mfa-recovery-regenerate` in App.tsx (protected)

## Dev Agent Record

| Field | Value |
|---|---|
| Agente | Nova (dev-dev-alpha) |
| Iniciado | 2026-04-24 |
| Concluído | 2026-04-24 |
| Branch | main (in-progress team session) |

## File List

- `src/types/mfa.ts` — criado
- `src/hooks/useMFA.ts` — criado
- `src/components/auth/RecoveryCodesDisplay.tsx` — criado
- `src/pages/MfaSetup.tsx` — modificado (3-step → 4-step, InputOTP, useMFA hook)
- `src/pages/MfaRecoveryRegenerate.tsx` — criado
- `src/components/layout/MfaGraceBanner.tsx` — criado
- `src/components/layout/DashLayout.tsx` — modificado (integrar MfaGraceBanner)
- `src/components/profile/MfaSection.tsx` — criado
- `src/pages/Perfil.tsx` — modificado (integrar MfaSection)
- `src/components/config/UsuariosConfig.tsx` — modificado (admin-unenroll-mfa edge fn, amber dialog)
- `src/App.tsx` — modificado (MfaRecoveryRegenerate route)

## Notes

- `mfa_grace_until` field not yet in DB schema — banner shows based on `require_mfa_for_gestores` policy + role
- `mfa_active` field not on Usuario type — admin button conditioned on `require_mfa_for_gestores` policy
- QR code rendered via Supabase's `data.totp.qr_code` SVG (no extra dependency needed)
- `generateRecoveryCodes` calls RPC `mfa_recovery_generate` — edge fn must exist
