---
title: "US-CFG-01: MFA / Two-Factor Authentication para gestores"
type: story
status: done
epic: settings
complexity: L
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, security, auth, P2]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-AUTH-02-fallback-profile-timeout]]"]
---

# US-CFG-01: MFA / Two-Factor Authentication para gestores

## Objetivo
Permitir que tenants habilitem MFA obrigatório para usuários com role `gestor` e `super_adm`, reduzindo risco de account takeover em credenciais de configuração.

## Acceptance Criteria
- [x] AC1: Painel Settings > Geral > Segurança exibe toggle "Exigir MFA para gestores" — salvo em `settings.require_mfa_for_gestores` (boolean)
- [x] AC2: Quando habilitado, gestor sem TOTP configurado é redirecionado para `/settings/mfa-setup` ao próximo login antes de acessar qualquer rota protegida
- [x] AC3: Página de setup de MFA exibe QR code TOTP (Supabase Auth MFA API) e campo de confirmação de código de 6 dígitos
- [x] AC4: Após setup, TOTP factor fica com status 'verified' — ProtectedRoute verifica via `supabase.auth.mfa.listFactors()` na próxima navegação
- [x] AC5: Gestor pode revogar MFA de um usuário da equipe via Settings > Usuários (botão ShieldOff "Remover MFA") — requer confirmação modal, chama edge fn `mfa-revoke-factor` com service_role

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux (Vela+Astra) |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `supabase/migrations/20260423006000_settings_require_mfa.sql` — ADD COLUMN require_mfa_for_gestores boolean DEFAULT false
- `supabase/functions/mfa-revoke-factor/index.ts` — edge fn (service_role): lista fatores TOTP do target user → deleteFactor para cada um
- `src/hooks/useSettings.ts` — adicionado require_mfa_for_gestores: boolean | null à interface Settings
- `src/pages/MfaSetup.tsx` — página standalone: enroll TOTP → QR code + manual secret → verify code → done (3 steps com indicador)
- `src/App.tsx` — import MfaSetup + route `/settings/mfa-setup` (ProtectedRoute, sem DashLayout)
- `src/components/auth/ProtectedRoute.tsx` — MFA guard useEffect: checa require_mfa_for_gestores + listFactors → redireciona para /settings/mfa-setup se gestor sem TOTP verified
- `src/components/config/GeralConfig.tsx` — Switch "Exigir MFA para gestores" na seção SEGURANÇA + require_mfa_for_gestores em formData/handleSubmit/handleCancel
- `src/components/config/UsuariosConfig.tsx` — botão ShieldOff "Remover MFA" (visível quando require_mfa_for_gestores=true) + AlertDialog de confirmação + handleRevokeMfa via mfa-revoke-factor edge fn

## QA Results
<!-- QA preenche ao revisar -->
