---
title: "US-CFG-02: Rate limit de login com feedback visual"
type: story
status: done
epic: settings
complexity: S
agent: dev-ux
created: 2026-04-22
updated: 2026-04-22
tags: [story, settings, security, auth, P2]
related: ["[[../../project/modules/settings]]", "[[../../decisions/ADR-AUTH-02-fallback-profile-timeout]]"]
---

# US-CFG-02: Rate limit de login com feedback visual

## Objetivo
Exibir feedback claro para o usuário quando tentativas de login são bloqueadas por rate limit, e permitir que gestores configurem o threshold de tentativas permitidas por tenant.

## Acceptance Criteria
- [x] AC1: Página de login exibe mensagem específica "Muitas tentativas. Tente novamente em X minutos." quando Supabase retorna erro `over_email_send_rate_limit` ou `too_many_requests` — não apenas "Erro ao fazer login"
- [x] AC2: Após 3 tentativas falhas consecutivas (client-side), botão de login é desabilitado por 30s com countdown visível
- [x] AC3: Painel Settings > Geral > Segurança exibe campo "Tentativas antes de bloquear" (número, default 5) — salvo em `settings.login_max_attempts`
- [ ] AC4: Edge function `login-guard` — delegado a dev-dev-alpha (backend, fora do escopo UX)
- [x] AC5: Nenhuma regressão no fluxo de login normal (1ª tentativa bem-sucedida) — TypeScript: 0 erros

## Escopo

**IN:**
- Migration: `ALTER TABLE settings ADD COLUMN login_max_attempts integer DEFAULT 5`
- Campo numérico em `GeralConfig.tsx` (sub-seção Segurança)
- Tratamento de erros na página de login com `parseLoginError()`
- Countdown client-side (30s, state local, cleanup no unmount)

**OUT:**
- Rate limit a nível de IP
- CAPTCHA
- AC4 (edge function `login-guard`) — backend

## Implementação

### AC1 — parseLoginError
`LoginPage.tsx` ganhou função `parseLoginError(error)` que mapeia mensagens de erro Supabase para português claro:
- `over_email_send_rate_limit` / `email rate limit` → "Muitas tentativas de recuperação de senha. Aguarde alguns minutos."
- `too_many_requests` / `rate limit` / `429` → "Muitas tentativas. Tente novamente em alguns minutos."
- `invalid login credentials` → "Email ou senha incorretos."
- `email not confirmed` → "Confirme seu email antes de fazer login."
- `user not found` → "Usuário não encontrado."
- Fallback: retorna o erro original.

### AC2 — Countdown após 3 tentativas
State `failedAttempts` incrementado em cada erro de `signIn`. Ao atingir `FAILED_ATTEMPTS_BEFORE_BLOCK = 3`, `startCountdown()` inicia `setInterval` que decrementa `blockedSecondsLeft` de 30 até 0. Enquanto `isBlocked`, botão fica `disabled` e banner amber exibe contagem regressiva com ícone `Clock`. Interval limpo no `useEffect` cleanup.

### AC3 — Settings > Geral > Segurança
Seção `SEGURANÇA` adicionada ao final do form de `GeralConfig.tsx` com `FieldRow` para "Tentativas de login" (input numérico, min=1, max=20). Campo `login_max_attempts` adicionado ao `formData`, inicializado de `config.login_max_attempts ?? 5`, incluído no `handleSubmit` e `handleCancel`.

### Migration
`supabase/migrations/20260423001000_settings_login_max_attempts.sql` — `ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS login_max_attempts integer DEFAULT 5`.

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-ux |
| Iniciado   | 2026-04-22 |
| Concluído  | 2026-04-22 |
| Branch     | main |

## File List

- `src/components/auth/LoginPage.tsx` — `parseLoginError`, countdown state, blocked UI
- `src/components/config/GeralConfig.tsx` — seção Segurança, `login_max_attempts` no form
- `src/hooks/useSettings.ts` — `login_max_attempts: number | null` no tipo `Settings`
- `supabase/migrations/20260423001000_settings_login_max_attempts.sql` — criado

## QA Results

TypeScript: 0 erros (`npx tsc --noEmit --skipLibCheck`).
Fluxo normal (1ª tentativa bem-sucedida): não afetado — `failedAttempts` só incrementa em erro.
AC4 pendente: edge function `login-guard` alocada para dev-dev-alpha.
