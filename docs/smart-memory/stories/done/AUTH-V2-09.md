---
title: "AUTH-V2-09: Rate limit real no login via edge function intermediária"
type: story
status: done
epic: auth-v2
complexity: M
agent: dev-dev-beta
created: 2026-04-22
updated: 2026-04-24
tags: [story, auth, security, rate-limit, P2]
related: ["[[../../project/modules/auth-tenant-bootstrap]]", "[[../../stories/backlog/US-CFG-02]]"]
---

# AUTH-V2-09: Rate limit real no login via edge function intermediária

## Objetivo
Implementar rate limit server-side no fluxo de login via edge function intermediária que tracked tentativas por IP + email, impedindo brute-force independentemente do Supabase Auth nativo.

## Acceptance Criteria
- [x] AC1: Edge function `auth-login` recebe `{ email, password }`, verifica rate limit em `auth_login_attempts` (ip_hash, email_hash, attempts, blocked_until, tenant_id), retorna 429 com `{ retry_after_seconds }` se bloqueado
- [x] AC2: Após rate limit check, delega para `supabase.auth.signInWithPassword` — em caso de sucesso, reseta contagem; em falha, incrementa `attempts`
- [x] AC3: `useAuth.signIn` chama `auth-login` edge fn em vez de `supabase.auth.signInWithPassword` diretamente — resposta de sucesso inclui `access_token` e `refresh_token` para setar sessão via `supabase.auth.setSession()`
- [x] AC4: Configuração de threshold lida de `settings.login_max_attempts` se disponível, ou fallback para constante `DEFAULT_MAX_ATTEMPTS = 10`
- [x] AC5: `pg_cron` job limpa entradas de `auth_login_attempts` com `blocked_until < now() - 1h` a cada hora

## Dev Agent Record

| Campo      | Valor |
|---         |---|
| Agente     | dev-dev-beta (rex) |
| Iniciado   | 2026-04-24 |
| Concluído  | 2026-04-24 |
| Branch     | feat/auth-login-rate-limit |

## File List

- `supabase/functions/auth-login/index.ts` — nova edge fn: rate limit check, proxy auth, bloqueio progressivo
- `supabase/migrations/20260423018000_auth_login_attempts.sql` — tabela + índices + RLS + pg_cron cleanup
- `src/hooks/useAuth.ts` — signIn agora chama auth-login edge fn + setSession + fallback gracioso

## Resultado

**Commit:** `8c9f19f4`

**AC1 & AC2 (Rate limit + proxy):**
- Edge fn `auth-login` extrai IP do header `x-forwarded-for` e computa `sha256hex(ip)` e `sha256hex(email)` — sem armazenar PII
- Consulta `auth_login_attempts` por `(ip_hash, email_hash)` — se `blocked_until > now()`, retorna 429 com `retry_after_seconds`
- Chama `supabase.auth.signInWithPassword` com `anonKey` em client efêmero (sem persistSession)
- Falha: incrementa `attempts`, seta `blocked_until = now() + 15min` quando `attempts >= maxAttempts`; sucesso: reseta counter para 0
- Bloco de 15 minutos (constante `BLOCK_DURATION_MINUTES`) após esgotar tentativas

**AC3 (Frontend):**
- `useAuth.signIn` faz `fetch` direto para `{supabaseUrl}/functions/v1/auth-login` (sem auth header — público por design)
- 429 → mensagem amigável com tempo de espera em minutos
- 401 → erro de credenciais + `attempts_remaining` disponível para feedback futuro
- Sucesso → `supabase.auth.setSession({ access_token, refresh_token })` estabelece sessão normalmente
- Fallback: se edge fn inalcançável (rede), cai no `supabase.auth.signInWithPassword` direto — sem quebra

**AC4 (Threshold configurável):**
- Edge fn lê `settings.login_max_attempts` via service role — se null, usa `DEFAULT_MAX_ATTEMPTS = 10`
- Campo já existia da migration anterior `20260423001000_settings_login_max_attempts.sql`

**AC5 (pg_cron cleanup):**
- `cleanup_auth_login_attempts()` SECURITY DEFINER deleta registros com `blocked_until < now() - 1h`
- Cron schedule: `0 * * * *` (todo início de hora)

**Sem regressão:**
- LoginPage não modificado — já usa `signIn` do hook
- Google OAuth não afetado (fluxo separado via `signInWithGoogle`)
- Password recovery não afetado

## QA Results
<!-- QA preenche ao revisar -->
