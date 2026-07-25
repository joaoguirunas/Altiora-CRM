---
title: "AUTH-V2-09: Rate limit real no login via edge function intermediária"
type: story
status: backlog
epic: auth-v2
complexity: M
agent: dev-dev-alpha
created: 2026-04-22
updated: 2026-04-22
tags: [story, auth, security, rate-limit, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../stories/backlog/US-CFG-02]]"]
---

# AUTH-V2-09: Rate limit real no login via edge function intermediária

## Objetivo
Implementar rate limit server-side no fluxo de login via edge function intermediária que tracked tentativas por IP + email, impedindo brute-force independentemente do Supabase Auth nativo.

## Acceptance Criteria
- [ ] AC1: Edge function `auth-login` recebe `{ email, password, tenant_host }`, verifica rate limit em `auth_login_attempts` (ip_hash, email_hash, attempts, blocked_until, tenant_id), retorna 429 com `{ retry_after_seconds }` se bloqueado
- [ ] AC2: Após rate limit check, delega para `supabase.auth.signInWithPassword` — em caso de sucesso, reseta contagem; em falha, incrementa `attempts`
- [ ] AC3: `useSimpleAuth.signIn` chama `auth-login` edge fn em vez de `supabase.auth.signInWithPassword` diretamente — resposta de sucesso inclui `access_token` e `refresh_token` para setar sessão via `supabase.auth.setSession()`
- [ ] AC4: Configuração de threshold lida de `settings.login_max_attempts` (US-CFG-02) se disponível, ou fallback para constante `DEFAULT_MAX_ATTEMPTS = 10`
- [ ] AC5: `pg_cron` job limpa entradas de `auth_login_attempts` com `blocked_until < now()` a cada hora

## Escopo

**IN:**
- Edge function `auth-login` (Deno) com acesso a `auth_login_attempts` via service_role
- Migration: tabela `auth_login_attempts` (ip_hash, email_hash, tenant_id, attempts integer, blocked_until timestamptz, last_attempt timestamptz)
- Modificação de `useSimpleAuth.signIn` para chamar a edge fn
- `pg_cron` cleanup job

**OUT:**
- Rate limit de outros endpoints (registro, reset de senha)
- Bloqueio por IP puro sem email (risco de falso positivo em NAT compartilhado)
- CAPTCHA (escopo separado)
- Integração com Cloudflare (requer mudança de infra)

## Contexto Técnico
Deep-dive §9 débito #4 e §8 "sem rate limit no /login — confia no Supabase Auth (genérico)". A abordagem de edge function intermediária não requer Cloudflare — roda no mesmo Supabase onde o app já opera. `ip_hash = encode(sha256(req.headers.get('x-forwarded-for')::bytea), 'hex')` — hashed para evitar armazenar PII (IP). `email_hash = encode(sha256(email::bytea), 'hex')`. Após `signInWithPassword` bem-sucedido, chamar `supabase.auth.setSession({ access_token, refresh_token })` no client para estabelecer sessão — Supabase suporta esse fluxo. Esta story tem dependência lógica mas não técnica de US-CFG-02 (que cria o campo `login_max_attempts`).

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | — |
| Iniciado   | — |
| Concluído  | — |
| Branch     | feat/auth-login-rate-limit |

## File List
<!-- Dev preenche ao concluir -->

## QA Results
<!-- QA preenche ao revisar -->
